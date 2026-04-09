"""
Slide 3 — Event Overview.

Editable elements:
  - Footer text
  - TextBox 7:  "OVERVIEW" heading + overview body paragraph
  - TextBox 17: "ATTENDEE RETENTION ANALYTICS" heading + retention paragraph
  - Stat callouts: TextBox 31 (~500), TextBox 29 (70), TextBox 27 (~$25M), TextBox 25 (~100)
  - TextBox 33: "Details of Attendance Can Be Found Below:"  (leave unless overridden)
"""
from __future__ import annotations
import re
from ..manifest import ReportManifest
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name, replace_txbody_content,
    build_paragraph, build_empty_paragraph,
)

SLIDE = "slide3.xml"

# Stat shape names and their stat field names
_STATS = [
    ("TextBox 31", "guests"),
    ("TextBox 29", "cars"),
    ("TextBox 27", "car_value"),
    ("TextBox 25", "content_units"),
]

# Section textbox: (shape name, heading, body_field)
_SECTIONS = [
    ("TextBox 7",  "OVERVIEW",                     "overview_text"),
    ("TextBox 17", "ATTENDEE RETENTION ANALYTICS",  "retention_text"),
]


def _build_section(heading: str, body: str) -> str:
    """Build heading + body paragraphs for a section textbox."""
    parts = body.split("\n\n") if body else []
    xml = build_paragraph(heading, sz=2200, font="Futura Medium", bold=False)
    for p in parts:
        p = p.strip()
        if p:
            xml += build_paragraph(p, sz=1300, font="Futura Medium")
    xml += build_empty_paragraph()
    return xml


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    xml = read_slide(unpacked_dir, SLIDE)

    # ── Footer ──────────────────────────────────────────────────────────
    footer_text = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"
    xml = set_footer_text(xml, footer_text)

    # ── Section header bar ───────────────────────────────────────────────
    xml = replace_run_text(xml, "EVENT OVERVIEW", "EVENT OVERVIEW")  # preserve as-is

    # ── Stat callouts ────────────────────────────────────────────────────
    stats = manifest.stats
    for shape_name, field_name in _STATS:
        value = getattr(stats, field_name, "")
        if not value:
            continue
        result = find_shape_by_name(xml, shape_name)
        if result:
            shape_xml, start, end = result
            # Replace only the first <a:t> run (the large number)
            runs = re.findall(r"<a:t>[^<]*</a:t>", shape_xml)
            if runs:
                old_text = re.search(r"<a:t>([^<]*)</a:t>", shape_xml).group(1)
                new_shape = shape_xml.replace(
                    f"<a:t>{old_text}</a:t>",
                    f"<a:t>{value}</a:t>",
                    1
                )
                xml = xml[:start] + new_shape + xml[end:]

    # ── Overview and retention text sections ─────────────────────────────
    for shape_name, heading, body_field in _SECTIONS:
        body = getattr(manifest, body_field, "")
        if not body:
            continue
        result = find_shape_by_name(xml, shape_name)
        if result:
            shape_xml, start, end = result
            paras_xml = _build_section(heading, body)
            new_shape = replace_txbody_content(shape_xml, paras_xml)
            xml = xml[:start] + new_shape + xml[end:]

    write_slide(unpacked_dir, SLIDE, xml)
