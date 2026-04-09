/**
 * POST /api/batch-generate
 *
 * Generates multiple partner reports in parallel from a shared event manifest,
 * zips them, and streams SSE progress back to the browser.
 *
 * Request body:
 * {
 *   event_base: { ...all manifest fields except partner_name },
 *   partners:   [{ name: string, overrides?: Partial<manifest> }]
 * }
 *
 * SSE events:
 *   { partner: string, pct: number, step: string }          — per-partner progress
 *   { overall: number }                                      — 0-100 overall %
 *   { done: true, file: "/api/batch-generate/download?file=…" } — final ZIP ready
 *   { error: string }                                        — on failure
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { createWriteStream } from "fs";
import archiver from "archiver";

// Fallback template only used if no template_path is supplied in the request
const DEFAULT_TEMPLATE_PATH = path.join(process.cwd(), "template", "report_template.pptx");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — report generation can take a while

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitize(s: string): string {
  return s.replace(/[^\w\s-]/g, "").trim();
}

function runGenerator(
  manifest: object,
  outputPath: string,
  onProgress: (step: string, pct: number) => void,
  templatePath: string,
  coverPhotoPath?: string | null,
  titlePngPath?: string | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpManifest = path.join(os.tmpdir(), `ten_m_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2));

    const args = [
      "-m", "scripts.generate_report.generator",
      "--manifest", tmpManifest,
      "--template",  templatePath,
      "--output",    outputPath,
    ];
    if (coverPhotoPath) args.push("--cover-photo", coverPhotoPath);
    if (titlePngPath)   args.push("--title-png",   titlePngPath);

    const py = spawn("python3", args, { cwd: process.cwd() });

    py.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        const m = line.match(/^\[\s*(\d+)%\]\s+(.+)/);
        if (m) onProgress(m[2].trim(), parseInt(m[1], 10));
      }
    });

    py.on("close", (code: number) => {
      try { fs.unlinkSync(tmpManifest); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`Generator exited ${code}`));
    });

    py.stderr.on("data", () => {}); // suppress stderr noise
  });
}

async function zipFiles(
  files: { path: string; name: string }[],
  outputZip: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output  = createWriteStream(outputZip);
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", reject);
    output.on("close", resolve);
    archive.pipe(output);
    for (const f of files) archive.file(f.path, { name: f.name });
    archive.finalize();
  });
}


// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.event_base || !Array.isArray(body.partners) || body.partners.length === 0) {
    return NextResponse.json({ error: "Missing event_base or partners[]" }, { status: 400 });
  }

  const { event_base, partners, template_path, cover_path, title_png_path } = body as {
    event_base:      Record<string, unknown>;
    partners:        { name: string; overrides?: Record<string, unknown> }[];
    template_path?:  string;
    cover_path?:     string | null;
    title_png_path?: string | null;
  };

  const resolvedTemplate = template_path && fs.existsSync(template_path)
    ? template_path
    : DEFAULT_TEMPLATE_PATH;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const tmpDir    = os.tmpdir();
      const sessionId = `ten_batch_${Date.now()}`;
      const outDir    = path.join(tmpDir, sessionId);
      fs.mkdirSync(outDir, { recursive: true });

      // Progress tracking per partner
      const progress: Record<string, number> = {};
      for (const p of partners) progress[p.name] = 0;

      const calcOverall = () => {
        const vals = Object.values(progress);
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      };

      const generatedFiles: { path: string; name: string }[] = [];

      try {
        // Run all partners in parallel
        await Promise.all(
          partners.map(async ({ name, overrides }) => {
            const manifest = {
              ...event_base,
              ...overrides,
              partner_name: name,
            };

            const safeEvent   = sanitize(String(event_base.event_name || "Report"));
            const safePartner = sanitize(name);
            const filename    = `${safeEvent} - Report for ${safePartner}.pptx`;
            const outputPath  = path.join(outDir, filename);

            await runGenerator(
              manifest, outputPath,
              (step, pct) => {
                progress[name] = pct;
                send({ partner: name, pct, step });
                send({ overall: calcOverall() });
              },
              resolvedTemplate,
              cover_path,
              title_png_path,
            );

            generatedFiles.push({ path: outputPath, name: filename });
          })
        );

        // Zip all generated files
        send({ overall: 95, partner: "all", pct: 95, step: "Zipping reports…" });

        const safeEvent = sanitize(String(event_base.event_name || "Reports"));
        const zipName   = `${safeEvent} - Partner Reports.zip`;
        const zipPath   = path.join(tmpDir, zipName);

        await zipFiles(generatedFiles, zipPath);

        // Clean up individual files
        for (const f of generatedFiles) {
          try { fs.unlinkSync(f.path); } catch {}
        }
        try { fs.rmdirSync(outDir); } catch {}

        send({ overall: 100, partner: "all", pct: 100, step: "Done." });
        send({ done: true, file: `/api/batch-generate/download?file=${encodeURIComponent(zipName)}` });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ error: `Batch generation failed: ${msg}` });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}


// ── GET: serve ZIP download ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("file");

  if (!fileName || fileName.includes("..") || !fileName.endsWith(".zip")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(os.tmpdir(), fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  try { fs.unlinkSync(filePath); } catch {}

  return new Response(fileBuffer, {
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
