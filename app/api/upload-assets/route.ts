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

    // ── Fixed asset fields ─────────────────────────────────────────────────
    const fixedFields: Array<{ key: string; ext: string }> = [
      { key: "template",  ext: ".pptx" },
      { key: "cover",     ext: ""       },
      { key: "title_png", ext: ".png"  },
    ];

    for (const { key, ext } of fixedFields) {
      const file = form.get(key);
      if (!file || !(file instanceof File)) continue;
      const fileExt = ext || file.name.slice(file.name.lastIndexOf(".")) || "";
      const dest = join(dir, `${key}${fileExt}`);
      await writeFile(dest, Buffer.from(await file.arrayBuffer()));
      result[key] = dest;
    }

    // Require at minimum the template
    if (!result.template) {
      return NextResponse.json(
        { error: "template file is required" },
        { status: 400 }
      );
    }

    // ── Gallery photos: field names gallery_N_M (slideIndex_slotIndex) ────
    const galleryPaths: Record<string, string> = {};
    for (const [fieldName, value] of form.entries()) {
      if (!fieldName.startsWith("gallery_") || !(value instanceof File)) continue;
      const fileExt = value.name.slice(value.name.lastIndexOf(".")) || ".jpg";
      const dest = join(dir, `${fieldName}${fileExt}`);
      await writeFile(dest, Buffer.from(await value.arrayBuffer()));
      galleryPaths[fieldName] = dest;
    }

    return NextResponse.json({ ...result, gallery_photos: galleryPaths });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
