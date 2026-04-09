/**
 * POST /api/upload-assets
 *
 * Accepts multipart/form-data with up to 3 files:
 *   - template   (.pptx  — previous event report used as base)
 *   - cover      (.jpg/.png — new event hero photo)
 *   - title_png  (.png — styled event title overlay)
 *
 * Returns JSON:
 *   { template: "/tmp/...", cover: "/tmp/...", title_png: "/tmp/..." }
 *
 * Files are written to /tmp/report-assets-<session> and paths returned
 * for use by the generation APIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

// Next.js 14 — disable body parser so we can read FormData
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const sessionId = randomBytes(8).toString("hex");
    const dir = join("/tmp", `report-assets-${sessionId}`);
    await mkdir(dir, { recursive: true });

    const result: Record<string, string> = { session_id: sessionId };

    const fields: Array<{ key: string; ext: string }> = [
      { key: "template",  ext: ".pptx" },
      { key: "cover",     ext: ""       },   // keep original extension
      { key: "title_png", ext: ".png"  },
    ];

    for (const { key, ext } of fields) {
      const file = form.get(key);
      if (!file || !(file instanceof File)) continue;

      const originalName = file.name;
      const fileExt = ext || originalName.slice(originalName.lastIndexOf(".")) || "";
      const dest = join(dir, `${key}${fileExt}`);

      const bytes = await file.arrayBuffer();
      await writeFile(dest, Buffer.from(bytes));
      result[key] = dest;
    }

    // Require at minimum the template
    if (!result.template) {
      return NextResponse.json(
        { error: "template file is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
