"""
Slide 2 — Introduction letter.

Editable elements:
  - Footer text: "{event_name} Official Event Report - For {partner_name}"
  - TextBox 21: "TO THE {partner_name} TEAM,"
  - TextBox 19: intro body (multi-paragraph, 12pt Aptos)
"""
from __future__ import annotations
import re
from ..manifest import ReportManifest
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name, replace_txbody_content,
    build_paragraph, build_empty_paragraph,
)

SLIDE = "slide2.xml"


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    xml = read_slide(unpacked_dir, SLIDE)

    # ── Footer ──────────────────────────────────────────────────────────
    footer_text = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"
    xml = set_footer_text(xml, footer_text)

    # ── "TO THE COTA TEAM," → partner salutation ────────────────────────
    xml = replace_run_text(xml, "TO THE COTA TEAM,",
                           f"TO THE {manifest.partner_name.upper()} TEAM,")

    # ── Body text (TextBox 19) ────────────────────────────────────────────
    if manifest.intro_body:
        paragraphs = manifest.intro_body.split("\n\n")
        paras_xml = ""
        for para in paragraphs:
            para = para.strip()
            if para:
                paras_xml += build_paragraph(
                    para, sz=1200, font="Aptos", spacing_pts=0
                )
        paras_xml += build_empty_paragraph()

        result = find_shape_by_name(xml, "TextBox 19")
        if result:
            shape_xml, start, end = result
            new_shape = replace_txbody_content(shape_xml, paras_xml)
            xml = xml[:start] + new_shape + xml[end:]

    write_slide(unpacked_dir, SLIDE, xml)
