"""
Guide generator — top-level entry point.

Usage (CLI):
    python -m scripts.generate_guide.generator \
        --manifest /tmp/guide_manifest.json \
        --output   /tmp/MyGuide.pptx

Or call generate_one() directly from Python.
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

from .manifest import GuideManifest, GuidePartner, manifest_from_dict
from .skeleton import write_skeleton
from .slides import cover, intro, content_slide, closing
from .xml_helpers import copy_media

# Reuse the proven pack() from the report generator
# (both live in the same scripts/ package tree)
_HERE = Path(__file__).parent
_REPORT_IO = _HERE.parent / "generate_report" / "pptx_io.py"

import importlib.util as _ilu
_spec = _ilu.spec_from_file_location("_pptx_io", str(_REPORT_IO))
_pptx_io = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_pptx_io)
pack = _pptx_io.pack   # type: ignore


# ── Progress reporting ─────────────────────────────────────────────────────────

def _p(pct: int, msg: str) -> None:
    print(f"[{pct:3d}%] {msg}", flush=True)


# ── Single-partner guide ───────────────────────────────────────────────────────

def generate_one(manifest: GuideManifest,
                 partner: GuidePartner,
                 output_path: str,
                 ten_logo_path: str | None = None,
                 on_progress=None) -> None:
    """
    Generate a single partner guide and save to output_path.
    on_progress(step_msg, pct_int) is called for progress updates.
    """
    prog = on_progress or (lambda msg, pct: _p(pct, msg))

    prog("Preparing workspace…", 2)
    tmp = tempfile.mkdtemp(prefix="ten_guide_")

    try:
        media_dir = os.path.join(tmp, "ppt", "media")
        os.makedirs(media_dir, exist_ok=True)

        # Collect all slides we'll generate
        slides: list[tuple[str, str]] = []   # [(slide_xml, rels_xml), ...]

        # Determine cover photo: per-partner override or event-level
        cover_photo = partner.cover_photo_path or manifest.cover_photo_path

        # ── Slide 1: Cover ────────────────────────────────────────────────────
        prog("Building cover slide…", 5)
        pfx = f"p{id(partner)}"
        s_xml, r_xml = cover.build(
            partner_name=partner.name,
            event_name=manifest.event_name,
            cover_photo_path=cover_photo,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            media_prefix=f"{pfx}_s1",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 2: Intro letter ──────────────────────────────────────────────
        prog("Building intro slide…", 15)
        s_xml, r_xml = intro.build(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            intro_body=partner.intro_body,
            bg_path=manifest.intro_bg_path or cover_photo,
            partner_logo_path=partner.logo_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=1,
            media_prefix=f"{pfx}_s2",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 3: Day 1 Itinerary ──────────────────────────────────────────
        prog("Building Day 1 itinerary…", 25)
        s_xml, r_xml = content_slide.build_schedule(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            title=manifest.day1_title or "Day 1\nItinerary",
            opening_line=manifest.day1_opening,
            items=manifest.day1_items,
            bg_path=manifest.day1_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=2,
            media_prefix=f"{pfx}_s3",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 4: Welcome Reception ────────────────────────────────────────
        prog("Building venue slide…", 35)
        s_xml, r_xml = content_slide.build_venue(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            venue_title=manifest.venue_title or "Welcome\nReception :",
            location_name=manifest.venue_location_name,
            arrival_text=manifest.venue_arrival_text,
            directions=manifest.venue_directions,
            bg_path=manifest.venue_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=3,
            media_prefix=f"{pfx}_s4",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 5: Day 2 Itinerary ──────────────────────────────────────────
        prog("Building Day 2 itinerary…", 44)
        s_xml, r_xml = content_slide.build_schedule(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            title=manifest.day2_title or "Day 2\nItinerary",
            opening_line=manifest.day2_opening,
            items=manifest.day2_items,
            bg_path=manifest.day2_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=4,
            media_prefix=f"{pfx}_s5",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 6: The Rally ────────────────────────────────────────────────
        prog("Building rally slide…", 53)
        s_xml, r_xml = content_slide.build_generic(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            title=manifest.rally_title or "Day 2\nThe RALLY :",
            body_text="",
            bg_path=manifest.rally_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=5,
            media_prefix=f"{pfx}_s6",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 7: Points of Interest (optional) ────────────────────────────
        if manifest.include_poi_slide:
            prog("Building POI slide…", 60)
            poi_body = manifest.poi_access_times or ""
            s_xml, r_xml = content_slide.build_generic(
                partner_name=partner.name,
                event_abbrev=manifest.event_abbrev,
                title=manifest.poi_title or "Day 2\nPoints of\nInterest",
                body_text=poi_body,
                bg_path=manifest.poi_bg_path,
                ten_logo_path=ten_logo_path,
                media_dir=media_dir,
                slide_num=6,
                media_prefix=f"{pfx}_s7",
            )
            slides.append((s_xml, r_xml))

        # ── Slide 8: Race Day ─────────────────────────────────────────────────
        prog("Building race day slide…", 68)
        race_body = ""
        if manifest.race_schedule_title:
            race_body = manifest.race_schedule_title
        s_xml, r_xml = content_slide.build_schedule(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            title=manifest.race_title or "Day 2\nRace Day",
            opening_line=manifest.race_schedule_title,
            items=manifest.race_items,
            bg_path=manifest.race_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=7,
            media_prefix=f"{pfx}_s8",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 9: Hotel ────────────────────────────────────────────────────
        prog("Building hotel slide…", 76)
        s_xml, r_xml = content_slide.build_generic(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            title=manifest.hotel_title or "Hotel :",
            body_text="",
            bg_path=manifest.hotel_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=8,
            media_prefix=f"{pfx}_s9",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 10: Rules & Safety ──────────────────────────────────────────
        prog("Building rules slide…", 83)
        s_xml, r_xml = content_slide.build_rules(
            partner_name=partner.name,
            event_abbrev=manifest.event_abbrev,
            general=manifest.rules_general,
            convoy=manifest.rules_convoy,
            vehicle=manifest.rules_vehicle,
            emergency=manifest.rules_emergency,
            contacts=manifest.emergency_contacts,
            bg_path=manifest.rules_bg_path,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            slide_num=9,
            media_prefix=f"{pfx}_s10",
        )
        slides.append((s_xml, r_xml))

        # ── Slide 11: Closing ─────────────────────────────────────────────────
        prog("Building closing slide…", 89)
        s_xml, r_xml = closing.build(
            event_name=manifest.event_name,
            bg_path=manifest.closing_bg_path or cover_photo,
            ten_logo_path=ten_logo_path,
            media_dir=media_dir,
            media_prefix=f"{pfx}_s11",
        )
        slides.append((s_xml, r_xml))

        # ── Write PPTX structure ──────────────────────────────────────────────
        prog("Writing PPTX structure…", 91)
        num_slides = len(slides)

        # Collect media extensions present
        media_exts: set[str] = set()
        for f in os.listdir(media_dir):
            ext = os.path.splitext(f)[1].lower().lstrip(".")
            if ext:
                media_exts.add(ext)

        write_skeleton(tmp, num_slides, media_exts)

        # Write each slide
        slides_dir = os.path.join(tmp, "ppt", "slides")
        rels_dir   = os.path.join(slides_dir, "_rels")
        os.makedirs(rels_dir, exist_ok=True)

        for i, (sxml, rels_xml) in enumerate(slides, start=1):
            with open(os.path.join(slides_dir, f"slide{i}.xml"), "w", encoding="utf-8") as fh:
                fh.write(sxml)
            with open(os.path.join(rels_dir, f"slide{i}.xml.rels"), "w", encoding="utf-8") as fh:
                fh.write(rels_xml)

        # ── Pack into PPTX ────────────────────────────────────────────────────
        prog("Packing PPTX…", 96)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        pack(tmp, output_path)

        prog("Done.", 100)

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── CLI entry point ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="TEN Guide Generator")
    parser.add_argument("--manifest",     required=True, help="Path to guide manifest JSON")
    parser.add_argument("--output",       required=True, help="Output .pptx path")
    parser.add_argument("--ten-logo",     default=None,  help="Path to TEN logo PNG")
    parser.add_argument("--partner-idx",  type=int, default=0,
                        help="Index into manifest.partners (0-based) — one file per call")
    args = parser.parse_args()

    with open(args.manifest, "r", encoding="utf-8") as fh:
        raw = json.load(fh)

    manifest = manifest_from_dict(raw)

    if not manifest.partners:
        print("[  0%] ERROR: No partners defined in manifest.", file=sys.stderr)
        sys.exit(1)

    idx = args.partner_idx
    if idx >= len(manifest.partners):
        print(f"[  0%] ERROR: partner_idx {idx} out of range.", file=sys.stderr)
        sys.exit(1)

    partner = manifest.partners[idx]

    generate_one(
        manifest=manifest,
        partner=partner,
        output_path=args.output,
        ten_logo_path=args.ten_logo,
    )


if __name__ == "__main__":
    main()
