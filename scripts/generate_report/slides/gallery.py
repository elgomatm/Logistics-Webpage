"""
Photo gallery slides (12–18).

Template layout:
  Slide 12: "The starting grid" — 8 picture placeholders
  Slide 13: "The starting grid" (cont.) — 8 placeholders
  Slide 14: "The hill country rally" — 8 placeholders
  Slide 15: "The hill country rally" (cont.) — 8 placeholders
  Slide 16: "The Main event" — 7 placeholders
  Slide 17: "The Main event" (cont.) — 7 placeholders
  Slide 18: "The Main event" (cont.) — 7 placeholders

CRITICAL RULES:
  1. NEVER touch Picture Placeholder 19 (idx=4294967295) — master-inherited frosted glass
  2. Only replace the r:embed Target in the rels file for user-provided photos
  3. If fewer photos than slots, leave remaining slots with their template images
  4. Photo cropping handled by photo_utils before injection

Gallery section → slides mapping (template):
  section[0] → slides 12, 13  (8 slots each)
  section[1] → slides 14, 15  (8 slots each)
  section[2] → slides 16, 17, 18  (7 slots each)

The generator uses exactly these slides. If user provides more gallery
sections than 3, extra sections are appended by duplicating the last gallery
slide pair (not yet implemented — V1 supports exactly 3 sections).
"""
from __future__ import annotations
import os
import re
import shutil
from ..manifest import ReportManifest, GallerySection
from ..xml_utils import (
    read_slide, write_slide, read_rels, write_rels,
    set_footer_text, replace_run_text, get_rId_for_placeholder,
    update_rel_target, MASTER_PH_IDX,
)
from ..photo_utils import prepare_photo, ext_to_mime

# Template slide groups for each gallery section (slide name, slots)
GALLERY_GROUPS = [
    # section 0: Starting grid
    [("slide12.xml", 8), ("slide13.xml", 8)],
    # section 1: Hill country rally
    [("slide14.xml", 8), ("slide15.xml", 8)],
    # section 2: Main event
    [("slide16.xml", 7), ("slide17.xml", 7), ("slide18.xml", 7)],
]

# All gallery slides
ALL_GALLERY_SLIDES = [
    s for group in GALLERY_GROUPS for (s, _) in group
]

# Placeholder idx order for each slide (left→right, top→bottom)
# From analysis — excludes idx=4294967295 (master header image)
# These are the CONTENT placeholders that can be replaced.
SLIDE_PH_ORDER: dict[str, list[str]] = {
    "slide12.xml": ["20", "17", "26", "27", "28", "29", "30"],   # idx values
    "slide13.xml": ["20", "17", "26", "27", "28", "29", "30"],
    "slide14.xml": ["20", "17", "26", "27", "28", "29", "30"],
    "slide15.xml": ["20", "17", "26", "27", "28", "29", "30"],
    "slide16.xml": ["16", "17", "18", "19_c", "20_c", "21_c", "22_c"],
    "slide17.xml": ["16", "17", "18", "19_c", "20_c", "21_c", "22_c"],
    "slide18.xml": ["16", "17", "18", "19_c", "20_c", "21_c", "22_c"],
}


def _get_layout_dims(unpacked_dir: str, slide_name: str) -> dict[str, tuple[int, int]]:
    """
    Return {idx: (cx_emu, cy_emu)} from the slide's layout for all picture
    placeholders.  Slides inherit placeholder dimensions from their layout when
    the slide XML doesn't override them.
    """
    EMU = 914400
    # Read slide rels to find layout path
    rels_path = os.path.join(unpacked_dir, "ppt", "slides", "_rels",
                             slide_name + ".rels")
    with open(rels_path, "r", encoding="utf-8") as f:
        slide_rels = f.read()

    layout_m = re.search(
        r'Type="[^"]*slideLayout"[^>]+Target="([^"]+)"', slide_rels
    )
    if not layout_m:
        return {}

    # Target is relative to ppt/slides/, so ../slideLayouts/slideLayoutN.xml
    layout_rel = layout_m.group(1)
    layout_path = os.path.normpath(
        os.path.join(unpacked_dir, "ppt", "slides", layout_rel)
    )
    if not os.path.exists(layout_path):
        return {}

    with open(layout_path, "r", encoding="utf-8") as f:
        lxml = f.read()

    dims: dict[str, tuple[int, int]] = {}
    for sp_m in re.finditer(r"<p:sp>(.*?)</p:sp>", lxml, re.DOTALL):
        sp = sp_m.group(1)
        idx_m = re.search(r'idx="(\d+)"', sp)
        cx_m  = re.search(r"<a:ext[^>]+cx=\"(\d+)\"[^>]+cy=\"(\d+)\"", sp)
        if idx_m and cx_m:
            dims[idx_m.group(1)] = (int(cx_m.group(1)), int(cx_m.group(2)))
    return dims


def _get_crop_key(pic_xml: str, layout_dims: dict[str, tuple[int, int]]) -> str:
    """
    Determine the correct photo_utils crop key for a picture placeholder.
    Reads cx/cy from the pic XML first; falls back to layout dims.
    Maps aspect ratio to the nearest known crop type.
    """
    idx_m = re.search(r'idx="(\d+)"', pic_xml)
    idx   = idx_m.group(1) if idx_m else ""

    # Try to get dims from slide XML first (xfrm)
    cx_m = re.search(
        r"<a:xfrm[^>]*>.*?<a:ext[^>]+cx=\"(\d+)\"[^>]+cy=\"(\d+)\"",
        pic_xml, re.DOTALL,
    )
    if cx_m:
        cx, cy = int(cx_m.group(1)), int(cx_m.group(2))
    elif idx and idx in layout_dims:
        cx, cy = layout_dims[idx]
    else:
        return "left_short"  # safe fallback

    ar = cx / cy if cy else 1.0
    # Three buckets from template analysis:
    #   ar ≈ 1.829 → "left_short"   (3.640" × 1.990")
    #   ar ≈ 1.372 → "right_tall"   (3.650" × 2.660")
    #   ar ≈ 1.362 → "right_xtall"  (3.650" × 2.680")
    if ar > 1.6:
        return "left_short"
    elif ar > 1.35:
        return "right_tall"
    else:
        return "right_xtall"


def _inject_photos_into_slide(
    unpacked_dir: str,
    slide_name: str,
    photos: list[str],
) -> None:
    """
    Inject up to len(photos) images into the picture placeholders of one slide.
    Skips the master-inherited placeholder (idx=4294967295).
    Reads actual placeholder dimensions (from slide or layout) to pick the
    correct smart-crop aspect ratio for each slot.
    """
    xml  = read_slide(unpacked_dir, slide_name)
    rels = read_rels(unpacked_dir, slide_name)
    media_dir = os.path.join(unpacked_dir, "ppt", "media")

    # Get layout dims for inherited placeholders
    layout_dims = _get_layout_dims(unpacked_dir, slide_name)

    # Build ordered list of (pic_xml, idx, rId) — excluding master placeholder
    slots: list[tuple[str, str, str]] = []
    for pic_m in re.finditer(r"<p:pic>(.*?)</p:pic>", xml, re.DOTALL):
        pic     = pic_m.group(1)
        idx_m   = re.search(r'idx="(\d+)"', pic)
        embed_m = re.search(r'r:embed="(rId\d+)"', pic)
        if not idx_m or not embed_m:
            continue
        idx = idx_m.group(1)
        if idx == MASTER_PH_IDX:
            continue
        slots.append((pic, idx, embed_m.group(1)))

    for i, (pic_xml, idx, rId) in enumerate(slots):
        if i >= len(photos):
            break

        src_path = photos[i]
        if not src_path or not os.path.exists(src_path):
            continue

        # Pick correct crop aspect ratio from actual placeholder dimensions
        ph_key = _get_crop_key(pic_xml, layout_dims)

        # Find the existing media filename from rels
        target_m = re.search(
            rf'Id="{re.escape(rId)}"[^>]+Target="\.\./media/([^"]+)"', rels
        )
        if not target_m:
            continue
        existing_media = target_m.group(1)
        dest_filename  = os.path.splitext(existing_media)[0] + ".jpg"
        dest_path      = os.path.join(media_dir, dest_filename)

        try:
            prepare_photo(src_path, dest_path, ph_key)
        except Exception:
            shutil.copy2(src_path, dest_path)

        if dest_filename != existing_media:
            rels = update_rel_target(rels, rId, f"../media/{dest_filename}")

    write_rels(unpacked_dir, slide_name, rels)


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    """Edit all gallery slides."""
    sections = manifest.gallery_sections
    footer   = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"

    for sec_idx, group in enumerate(GALLERY_GROUPS):
        # Get the corresponding section from manifest (or use empty)
        section: GallerySection = (
            sections[sec_idx] if sec_idx < len(sections)
            else GallerySection(title="", photos=[])
        )
        photos = section.photos
        photo_cursor = 0

        for slide_name, slot_count in group:
            xml = read_slide(unpacked_dir, slide_name)
            xml = set_footer_text(xml, footer)

            # Update section title in header bar if provided
            if section.title:
                # The header bar TextBox has the section title (e.g. "The starting grid")
                # We only want to replace the display text, not the AKIRA section label
                # The section title is in a run with font size ~34-40pt
                # Strategy: replace the old title text with the new one
                existing_titles = [
                    "The starting grid", "the starting grid",
                    "The hill country rally", "the hill country rally",
                    "The Main event", "The main event",
                ]
                for old_title in existing_titles:
                    if old_title.lower() in xml.lower():
                        xml = replace_run_text(xml, old_title, section.title)
                        break

            write_slide(unpacked_dir, slide_name, xml)

            # Inject photos into this slide's slots
            slide_photos = photos[photo_cursor:photo_cursor + slot_count]
            if slide_photos:
                _inject_photos_into_slide(unpacked_dir, slide_name, slide_photos)
            photo_cursor += slot_count
