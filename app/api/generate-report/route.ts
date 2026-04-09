/**
 * POST /api/generate-report
 *
 * Accepts a ReportManifest JSON body.
 * Spawns the Python generator and streams Server-Sent Events back:
 *   data: {"step":"Writing introduction…","pct":15}
 *   data: {"step":"Done.","pct":100,"file":"/download/filename.pptx"}
 *
 * The generated PPTX is written to /tmp and exposed via
 * GET /api/generate-report/download?file=filename.pptx
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const TEMPLATE_PATH = path.join(process.cwd(), "template", "report_template.pptx");
const GENERATOR_MOD = path.join(process.cwd(), "scripts", "generate_report", "generator.py");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Write manifest to temp file
  const tmpDir      = os.tmpdir();
  const manifestPath = path.join(tmpDir, `ten_manifest_${Date.now()}.json`);
  const eventName   = (body.event_name || "Report").replace(/[^\w\s-]/g, "").trim();
  const partnerName = (body.partner_name || "Partner").replace(/[^\w\s-]/g, "").trim();
  const outFilename  = `${eventName} - Report for ${partnerName}.pptx`;
  const outputPath   = path.join(tmpDir, outFilename);

  fs.writeFileSync(manifestPath, JSON.stringify(body, null, 2));

  // Server-Sent Events stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Spawn Python generator as a module (required for relative imports)
      const py = spawn("python3", [
        "-m", "scripts.generate_report.generator",
        "--manifest", manifestPath,
        "--template", TEMPLATE_PATH,
        "--output",   outputPath,
      ], { cwd: process.cwd() });

      let stdout = "";
      let stderr = "";

      py.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        // Parse progress lines: "[NN%] message"
        const lines = text.split("\n");
        for (const line of lines) {
          const m = line.match(/^\[(\s*\d+)%\]\s+(.+)/);
          if (m) {
            send({ step: m[2].trim(), pct: parseInt(m[1].trim(), 10) });
          }
          // Final output line: "OUTPUT:/path/to/file.pptx"
          if (line.startsWith("OUTPUT:")) {
            const filePath = line.slice("OUTPUT:".length).trim();
            const fileName = path.basename(filePath);
            send({ step: "Done.", pct: 100, file: `/api/generate-report/download?file=${encodeURIComponent(fileName)}` });
          }
        }
      });

      py.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      py.on("close", (code: number) => {
        // Clean up manifest
        try { fs.unlinkSync(manifestPath); } catch {}

        if (code !== 0) {
          send({ error: `Generator failed (exit ${code}): ${stderr.slice(0, 500)}` });
        }
        controller.close();
      });
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


/**
 * GET /api/generate-report/download?file=filename.pptx
 * Serves a previously generated PPTX from /tmp.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("file");

  if (!fileName || fileName.includes("..") || !fileName.endsWith(".pptx")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(os.tmpdir(), fileName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  // Clean up after serving
  try { fs.unlinkSync(filePath); } catch {}

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
