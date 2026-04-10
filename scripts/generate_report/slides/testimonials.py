"""
Slide 11 — Testimonials.

The slide has 5 frosted-glass bars, each built from a Group shape containing:
  - A background picture (the frosted bar image) — DO NOT TOUCH
  - A TextBox with the quote text  (15pt Futura Medium)
  - A TextBox with the attribution (11.7pt Futura Medium)
  - A TextBox with the opening quotation mark " (25.5pt)
  - (Optional) A small profile photo at left

Each Group is named: Group 40 (top), Group 4, Group 15, Group 30, Group 1 (bottom)
in visual top-to-bottom order.

Approach:
  - Find each attribution TextBox by its distinctive content pattern
  - Replace quote text and attribution
  - If fewer than 5 testimonials, hide the remaining Groups (set visibility)
  - If manifest.testimonials_bg_path is set, replace the slide background photo
"""
from __future__ import annotations
import re
import os
import shutil
from ..manifest import ReportManifest, Testimonial
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name,
    read_rels, write_rels, add_image_rel, next_rId,
    find_slide_by_content, find_slide_by_layout,
)

# ── Detection signatures (tried in order until one matches) ───────────────────
#
# PRIMARY  — group shape names unique to the testimonials slide.
# FALLBACK — the testimonials slide is the ONLY slide that uses slideLayout4;
#            this layout reference is stored in the slide's rels file and
#            survives PowerPoint renumbering.
#
_DETECT_PATTERNS = ('name="Group 40"', 'name="Group 1"')
_FALLBACK_LAYOUT = "slideLayout4"

# Ordered list of (group_name, quote_shape, attribution_shape), top → bottom.
TESTIMONIAL_SHAPES = [
    ("Group 40", "TextBox 42", "TextBox 43"),
    ("Group 4",  "TextBox 7",  "TextBox 22"),
    ("Group 15", "TextBox 17", "TextBox 18"),
    ("Group 30", "TextBox 32", "TextBox 33"),
    ("Group 1",  "TextBox 9",  "TextBox 21"),
]

_IMAGE_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
)


def _replace_textbox_content(xml: str, shape_name: str, new_text: str) -> str:
    """Replace all <a:t> text in a named shape with new_text, keeping formatting."""
    result = find_shape_by_name(xml, shape_name)
    if result is None:
        return xml
    shape_xml, start, end = result

    t_matches = list(re.finditer(r"<a:t>[^<]*</a:t>", shape_xml))
    if not t_matches:
        return xml

    safe = (new_text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\u201c", "&#x201C;")
        .replace("\u201d", "&#x201D;")
        .replace("\u2014", "&#x2014;")
        .replace("\u2018", "&#x2018;")
        .replace("\u2019", "&#x2019;")
        .replace("\u00a0", "&#xA0;")
    )

    new_shape = shape_xml
    for i, m in enumerate(reversed(t_matches)):
        replacement = f"<a:t>{safe}</a:t>" if i == len(t_matches) - 1 else "<a:t></a:t>"
        new_shape = new_shape[:m.start()] + replacement + new_shape[m.end():]

    return xml[:start] + new_shape + xml[end:]


def _hide_group(xml: str, group_name: str) -> str:
    """Set hidden=1 on a group shape's cNvPr."""
    return re.sub(
        rf'(<p:grpSp>.*?<p:cNvPr[^>]*name="{re.escape(group_name)}")',
        lambda m: m.group(0).replace(
            f'name="{group_name}"',
            f'name="{group_name}" hidden="1"'
        ),
        xml, count=1, flags=re.DOTALL
    )


def _replace_background_image(unpacked_dir: str, slide_name: str, bg_src: str) -> None:
    """
    Replace the slide background photo on the testimonials slide.
    The background is a full-bleed <p:pic> shape whose blipFill r:embed points to
    the background image file.  We copy the new file into media and update the
    relationship that targets the first non-master-placeholder picture on the slide.

    Strategy: find all <p:pic> elements that are NOT placeholder pictures (no <p:ph>
    element inside them).  The first one that is positioned near 0,0 (full-bleed)
    is the background.  Update its r:embed relationship to the new file.
    """
    if not bg_src or not os.path.isfile(bg_src):
        return

    # Copy new file into media dir
    media_dir  = os.path.join(unpacked_dir, "ppt", "media")
    ext        = os.path.splitext(bg_src)[1].lower() or ".jpg"
    media_file = f"testimonials_bg{ext}"
    shutil.copy2(bg_src, os.path.join(media_dir, media_file))

    xml  = read_slide(unpacked_dir, slide_name)
    rels = read_rels(unpacked_dir, slide_name)

    # Find all <p:pic> elements that are NOT placeholders
    for pic_m in re.finditer(r"<p:pic>.*?</p:pic>", xml, re.DOTALL):
        pic_xml = pic_m.group(0)
        # Skip placeholder pictures
        if "<p:ph" in pic_xml:
            continue
        # Look for an r:embed attribute in a blipFill
        embed_m = re.search(r'r:embed="(rId\d+)"', pic_xml)
        if not embed_m:
            continue
        rId = embed_m.group(1)

        # Check this rId points to an image rel in the slide rels
        rel_m = re.search(
            rf'<Relationship Id="{re.escape(rId)}"[^>]+Type="[^"]*image[^"]*"[^>]+Target="([^"]+)"',
            rels,
        )
        if not rel_m:
            continue

        # Update the target to our new background file
        rels = re.sub(
            rf'(<Relationship Id="{re.escape(rId)}"[^>]+Target=")[^"]+(")',
            rf"\g<1>../media/{media_file}\g<2>",
            rels,
        )
        write_rels(unpacked_dir, slide_name, rels)
        return   # only replace one (the background)


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    # ── Locate the testimonials slide ───────────────────────────────────
    # PRIMARY: group shape names
    slide = find_slide_by_content(unpacked_dir, *_DETECT_PATTERNS)
    if slide is None:
        # FALLBACK: only the testimonials slide uses slideLayout4
        slide = find_slide_by_layout(unpacked_dir, _FALLBACK_LAYOUT)
    if slide is None:
        raise FileNotFoundError(
            "Testimonials slide not found in template — "
            'expected a slide with Group 40/Group 1 shapes or using slideLayout4'
        )

    xml = read_slide(unpacked_dir, slide)

    # ── Footer ──────────────────────────────────────────────────────────
    footer = f"{manifest.event_abbrev or manifest.event_name} Official Event Report – Prepared For {manifest.partner_name}"
    xml = set_footer_text(xml, footer)

    testimonials = manifest.testimonials

    for i, (group_name, quote_shape, attr_shape) in enumerate(TESTIMONIAL_SHAPES):
        if i < len(testimonials):
            t = testimonials[i]
            if t.quote:
                xml = _replace_textbox_content(xml, quote_shape, t.quote)
            if t.attribution:
                xml = _replace_textbox_content(xml, attr_shape, t.attribution)
        else:
            xml = _hide_group(xml, group_name)

    write_slide(unpacked_dir, slide, xml)

    # ── Background image replacement ─────────────────────────────────────
    if manifest.testimonials_bg_path:
        _replace_background_image(unpacked_dir, slide, manifest.testimonials_bg_path)
