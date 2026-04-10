"""
Slide 19 — Content Creation.

Editable elements:
  - Footer text
  - TextBox 7:  "EVENT PHOTO ALBUMS:" heading + body (2 runs — replaceable individually)
  - TextBox 8:  "SOCIAL MEDIA CONTENT" heading + body (6 runs; event name is SPLIT
                across runs — must rebuild entire textbox from scratch)
  - Rounded Rectangle 19: hyperlink button text + actual URL in rels file
"""
from __future__ import annotations
import re
import os
from ..manifest import ReportManifest
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name, replace_txbody_content,
    build_paragraph, build_empty_paragraph,
    read_rels, write_rels, add_image_rel, next_rId,
    find_slide_by_content,
)

# PRIMARY: the "Content Creation" slide has a rounded rectangle hyperlink button.
# FALLBACK: "Content creation" appears as a text run in the slide's section label.
_DETECT_PATTERNS = ('name="Rounded Rectangle 19"',)
_FALLBACK_TEXT   = ("Content creation",)

# Type URI for hyperlinks in rels
_HYPERLINK_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
)


def _inject_hyperlink_url(unpacked_dir: str, slide_name: str,
                           shape_name: str, url: str) -> None:
    """
    Add (or update) the actual hyperlink URL for a shape's hlinkClick in the
    slide rels file.  Updates <a:hlinkClick r:id="rIdXX"/> inside the shape.
    """
    if not url:
        return

    xml  = read_slide(unpacked_dir, slide_name)
    rels = read_rels(unpacked_dir, slide_name)

    # Find the shape
    result = find_shape_by_name(xml, shape_name)
    if not result:
        return
    shape_xml, start, end = result

    # Check if shape already has an hlinkClick
    existing_m = re.search(r'<a:hlinkClick[^>]*r:id="(rId\d+)"', shape_xml)

    if existing_m:
        # Update existing relationship target
        rId = existing_m.group(1)
        rels = re.sub(
            rf'(<Relationship Id="{re.escape(rId)}"[^>]+Target=")[^"]+(")',
            rf"\g<1>{url}\g<2>",
            rels,
        )
        # Ensure TargetMode="External"
        rels = re.sub(
            rf'(<Relationship Id="{re.escape(rId)}"(?![^>]*TargetMode))',
            rf'\1 TargetMode="External"',
            rels,
        )
    else:
        # Add new relationship
        rId = next_rId(rels)
        new_rel = (
            f'<Relationship Id="{rId}" '
            f'Type="{_HYPERLINK_TYPE}" '
            f'Target="{url}" TargetMode="External"/>'
        )
        rels = rels.replace("</Relationships>", f"  {new_rel}\n</Relationships>")

        # Inject hlinkClick into shape's first run properties
        new_shape = shape_xml.replace(
            "</a:rPr>",
            f'<a:hlinkClick xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="{rId}"/></a:rPr>',
            1,
        )
        xml = xml[:start] + new_shape + xml[end:]
        write_slide(unpacked_dir, slide_name, xml)

    write_rels(unpacked_dir, slide_name, rels)


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    # ── Locate the content creation slide ───────────────────────────────
    # PRIMARY: rounded rectangle shape name
    slide = find_slide_by_content(unpacked_dir, *_DETECT_PATTERNS)
    if slide is None:
        # FALLBACK: "Content creation" section label text
        slide = find_slide_by_content(unpacked_dir, *_FALLBACK_TEXT)
    if slide is None:
        raise FileNotFoundError(
            "Content creation slide not found in template — "
            'expected a slide with "Rounded Rectangle 19" shape or "Content creation" text'
        )

    xml = read_slide(unpacked_dir, slide)

    # ── Footer ──────────────────────────────────────────────────────────
    footer = f"{manifest.event_abbrev or manifest.event_name} Official Event Report – Prepared For {manifest.partner_name}"
    xml = set_footer_text(xml, footer)

    # ── TextBox 7: Photo albums section ─────────────────────────────────
    # Run 1: heading  "LONE STAR SUPERCARS PHOTO ALBUMS:"
    # Run 2: body     "Please click below to access Lone Star Supercars 2026 photo albums…"
    # Each is a separate run — safe to replace_run_text individually.
    old_heading = "LONE STAR SUPERCARS PHOTO ALBUMS:"
    new_heading = f"{manifest.event_name.upper()} PHOTO ALBUMS:"
    xml = replace_run_text(xml, old_heading, new_heading)

    # Replace event name in the body run
    xml = replace_run_text(xml, "Lone Star Supercars 2026 photo albums",
                           f"{manifest.event_name} photo albums")

    # ── TextBox 8: Social media section — REBUILD FROM SCRATCH ──────────
    # The event name "Lone Star Supercars 2026" is split across two consecutive
    # <a:t> runs ("...related to Lone Star " | "Supercars 2026"), so replace_run_text
    # cannot find it.  Safest fix: replace the entire txBody content.
    social_count = manifest.social_content_count or "0"
    event_name   = manifest.event_name

    social_body = (
        f"Around {social_count} units of content related to {event_name} were posted on our "
        f"Instagram page. \"Units of content\" represent story posts, grid posts, reposts of "
        f"other people\u2019s stories, etc. Please click here to view all units."
    )

    social_paras = (
        build_paragraph("SOCIAL MEDIA CONTENT", sz=2200, font="Futura Medium")
        + build_paragraph(social_body, sz=1300, font="Futura Medium")
        + build_empty_paragraph()
    )

    result = find_shape_by_name(xml, "TextBox 8")
    if result:
        shape_xml, s, e = result
        new_shape = replace_txbody_content(shape_xml, social_paras)
        xml = xml[:s] + new_shape + xml[e:]

    # ── Rounded Rectangle 19: link button text ───────────────────────────
    label = manifest.photo_album_label or f"{manifest.event_name} Event Photo Album"
    safe_label = (label
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    result = find_shape_by_name(xml, "Rounded Rectangle 19")
    if result:
        shape_xml, s, e = result
        new_shape = re.sub(
            r"<a:t>[^<]*</a:t>",
            f"<a:t>{safe_label}</a:t>",
            shape_xml, count=1,
        )
        xml = xml[:s] + new_shape + xml[e:]

    write_slide(unpacked_dir, slide, xml)

    # ── Inject actual hyperlink URL into rels ────────────────────────────
    if manifest.photo_album_url:
        _inject_hyperlink_url(
            unpacked_dir, slide, "Rounded Rectangle 19", manifest.photo_album_url
        )

    # ── Inject Pixieset URL into "Please click here" text (TextBox 8) ────
    if manifest.pixieset_url:
        _inject_hyperlink_url(
            unpacked_dir, slide, "TextBox 8", manifest.pixieset_url
        )
