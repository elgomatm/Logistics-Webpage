"""
Main report generation orchestrator.

Usage (CLI):
    python -m scripts.generate_report.generator \
        --manifest /tmp/manifest.json \
        --template /path/to/report_template.pptx \
        --output   /tmp/output.pptx

Or call generate() directly from Python.
"""
from __future__ import annotations
import os
import sys
import json
import shutil
import tempfile
import argparse
import re
from pathlib import Path

from .manifest import ReportManifest, manifest_from_dict
from .pptx_io import unpack, pack, clean_deleted_slides
from .slides import cover, intro, overview, digital, testimonials, gallery, content, guests


def _delete_slides_from_presentation(
    unpacked_dir: str,
    slide_filenames: list[str],
) -> None:
    """
    Remove given slide filenames from ppt/presentation.xml sldIdLst,
    then remove the physical files via pptx_io.clean_deleted_slides.
    """
    if not slide_filenames:
        return

    pres_path = os.path.join(unpacked_dir, "ppt", "presentation.xml")
    with open(pres_path, "r", encoding="utf-8") as f:
        pres_xml = f.read()

    pres_rels_path = os.path.join(unpacked_dir, "ppt", "_rels",
                                   "presentation.xml.rels")
    with open(pres_rels_path, "r", encoding="utf-8") as f:
        pres_rels = f.read()

    for slide_name in slide_filenames:
        # Find rId for this slide
        rId_m = re.search(
            rf'Id="(rId\d+)"[^>]+Target="[^"]*{re.escape(slide_name)}"',
            pres_rels,
        )
        if not rId_m:
            continue
        rId = rId_m.group(1)

        # Remove <p:sldId r:id="rId…"/> from sldIdLst
        pres_xml = re.sub(
            rf'<p:sldId[^>]+r:id="{re.escape(rId)}"[^/]*/>\s*',
            "",
            pres_xml,
        )

    with open(pres_path, "w", encoding="utf-8") as f:
        f.write(pres_xml)

    # Remove physical files + content-type entries
    clean_deleted_slides(unpacked_dir, slide_filenames)


def generate(
    manifest: ReportManifest,
    template_path: str,
    output_path: str,
    progress_callback=None,
    cover_photo_path: str | None = None,
    title_png_path: str | None = None,
) -> str:
    """
    Generate a partner report PPTX.

    Args:
        manifest:          Populated ReportManifest.
        template_path:     Path to the previous event PPTX used as base template.
        output_path:       Where to write the generated PPTX.
        progress_callback: Optional callable(step: str, pct: int).
        cover_photo_path:  Optional path to new cover background photo.
        title_png_path:    Optional path to event title PNG overlay.

    Returns:
        Absolute path to the generated PPTX.
    """
    def _progress(msg: str, pct: int) -> None:
        if progress_callback:
            progress_callback(msg, pct)
        else:
            print(f"[{pct:3d}%] {msg}", flush=True)

    # ── 1. Workspace ─────────────────────────────────────────────────────
    _progress("Setting up workspace…", 2)
    work_dir = tempfile.mkdtemp(prefix="ten_report_")
    unpacked = os.path.join(work_dir, "unpacked")

    try:
        # ── 2. Unpack template ───────────────────────────────────────────
        _progress("Unpacking template…", 5)
        unpack(template_path, unpacked)

        # ── 3. Cover slide ───────────────────────────────────────────────
        if cover_photo_path or title_png_path:
            _progress("Building cover slide…", 10)
            cover.edit(unpacked, cover_photo_path, title_png_path)

        # ── 4. Edit content slides ───────────────────────────────────────
        _progress("Writing introduction…", 15)
        intro.edit(unpacked, manifest)

        _progress("Writing event overview…", 25)
        overview.edit(unpacked, manifest)

        _progress("Building digital campaign tables…", 35)
        pres_path = os.path.join(unpacked, "ppt", "presentation.xml")
        _kept_digital, _del_digital = digital.edit(unpacked, manifest, pres_path)

        _progress("Writing testimonials…", 45)
        testimonials.edit(unpacked, manifest)

        _progress("Injecting gallery photos…", 55)
        _kept_gallery, _del_gallery = gallery.edit(unpacked, manifest)

        _progress("Writing content creation slide…", 65)
        content.edit(unpacked, manifest)

        _progress("Building guest data tables…", 72)
        _kept_guests, _del_guests = guests.edit(unpacked, manifest)

        # ── 4. Remove unused slides from presentation + disk ─────────────
        _progress("Removing unused slides…", 80)
        _delete_slides_from_presentation(
            unpacked, _del_digital + _del_gallery + _del_guests
        )

        # ── 5. Pack ──────────────────────────────────────────────────────
        _progress("Packing PPTX…", 90)
        pack(unpacked, output_path)

        _progress("Done.", 100)
        return os.path.abspath(output_path)

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def generate_from_json(
    json_path: str,
    template_path: str,
    output_path: str,
    cover_photo_path: str | None = None,
    title_png_path: str | None = None,
) -> str:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    m = manifest_from_dict(data)

    if not m.output_filename:
        safe_event   = re.sub(r"[^\w\s-]", "", m.event_name).strip()
        safe_partner = re.sub(r"[^\w\s-]", "", m.partner_name).strip()
        m.output_filename = f"{safe_event} - Report for {safe_partner}.pptx"

    if not output_path:
        output_path = os.path.join(os.path.dirname(json_path), m.output_filename)

    return generate(
        m, template_path, output_path,
        cover_photo_path=cover_photo_path,
        title_png_path=title_png_path,
    )


# ── CLI entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a TEN partner report PPTX")
    parser.add_argument("--manifest",     required=True, help="Path to manifest JSON")
    parser.add_argument("--template",     required=True, help="Path to previous event PPTX (template)")
    parser.add_argument("--output",       default="",    help="Output .pptx path")
    parser.add_argument("--cover-photo",  default="",    help="Path to new cover background photo")
    parser.add_argument("--title-png",    default="",    help="Path to event title PNG overlay")
    args = parser.parse_args()

    out = generate_from_json(
        args.manifest,
        args.template,
        args.output,
        cover_photo_path=args.cover_photo or None,
        title_png_path=args.title_png or None,
    )
    print(f"OUTPUT:{out}", flush=True)
