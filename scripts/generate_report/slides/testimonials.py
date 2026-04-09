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
"""
from __future__ import annotations
import re
from ..manifest import ReportManifest, Testimonial
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name,
)

SLIDE = "slide11.xml"

# Ordered list of (group_name, quote_shape, attribution_shape), top → bottom.
# Verified against both template and sample report XML:
#   Group 40 (top bar):    TextBox 42 (quote) + TextBox 43 (attribution)
#   Group 4  (2nd bar):    TextBox 7  (quote) + TextBox 22 (attribution)
#                          NOTE: TextBox 7 & 22 are top-level shapes on the slide,
#                          not children of Group 4 in the XML, but visually aligned.
#   Group 15 (3rd bar):    TextBox 17 (quote) + TextBox 18 (attribution)
#   Group 30 (4th bar):    TextBox 32 (quote) + TextBox 33 (attribution)
#   Group 1  (bottom bar): TextBox 9  (quote) + TextBox 21 (attribution)
TESTIMONIAL_SHAPES = [
    ("Group 40", "TextBox 42", "TextBox 43"),
    ("Group 4",  "TextBox 7",  "TextBox 22"),
    ("Group 15", "TextBox 17", "TextBox 18"),
    ("Group 30", "TextBox 32", "TextBox 33"),
    ("Group 1",  "TextBox 9",  "TextBox 21"),
]


def _replace_textbox_content(xml: str, shape_name: str, new_text: str) -> str:
    """Replace all <a:t> text in a named shape with new_text, keeping formatting."""
    # Find the shape
    result = find_shape_by_name(xml, shape_name)
    if result is None:
        return xml
    shape_xml, start, end = result

    # Collect all <a:t> matches
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

    # Put all text into the first run, clear the rest
    new_shape = shape_xml
    for i, m in enumerate(reversed(t_matches)):
        abs_start = start + m.start()
        abs_end   = start + m.end()
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


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    xml = read_slide(unpacked_dir, SLIDE)

    # ── Footer ──────────────────────────────────────────────────────────
    footer = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"
    xml = set_footer_text(xml, footer)

    testimonials = manifest.testimonials

    for i, (group_name, quote_shape, attr_shape) in enumerate(TESTIMONIAL_SHAPES):
        if i < len(testimonials):
            t = testimonials[i]
            # Replace quote text
            if t.quote:
                xml = _replace_textbox_content(xml, quote_shape, t.quote)
            # Replace attribution
            if t.attribution:
                xml = _replace_textbox_content(xml, attr_shape, t.attribution)
        else:
            # Hide unused bars
            xml = _hide_group(xml, group_name)

    write_slide(unpacked_dir, SLIDE, xml)
