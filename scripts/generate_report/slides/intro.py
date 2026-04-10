"""
Slide 2 — Introduction letter.

Editable elements:
  - Footer text: "{event_name} Official Event Report - For {partner_name}"
  - TextBox 21: "TO THE {partner_name} TEAM,"
  - TextBox 19: intro body (multi-paragraph, 12pt Aptos)
  - Picture 3 (image4.png): partner logo — replaced with manifest.partner_logo_path
"""
from __future__ import annotations
import re
import os
import shutil
from ..manifest import ReportManifest
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name, replace_txbody_content,
    build_paragraph, build_empty_paragraph,
    read_rels, write_rels, add_image_rel, next_rId,
    find_slide_by_content,
)

# PRIMARY: shape names unique to the intro slide.
# FALLBACK: the word "INTRODUCTION" appears as a single text run on the intro slide.
_DETECT_PATTERNS = ('name="TextBox 19"', 'name="TextBox 21"')
_FALLBACK_TEXT   = ("INTRODUCTION",)

_IMAGE_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
)


def _replace_partner_logo(unpacked_dir: str, slide_name: str,
                          logo_src: str, partner_name: str) -> None:
    """
    Copy the partner logo into the PPTX media dir and update the intro slide rels
    so that the existing image4.png relationship now points to the new logo.
    Falls back silently if rels or shape cannot be found.
    """
    if not logo_src or not os.path.isfile(logo_src):
        return

    # ── 1. Copy file into media dir ────────────────────────────────────────
    media_dir  = os.path.join(unpacked_dir, "ppt", "media")
    ext        = os.path.splitext(logo_src)[1].lower() or ".png"
    # Sanitise partner name for a safe filename
    safe_name  = re.sub(r"[^\w\-]", "_", partner_name).strip("_") or "partner"
    media_file = f"partner_logo_{safe_name}{ext}"
    dst_path   = os.path.join(media_dir, media_file)
    shutil.copy2(logo_src, dst_path)

    # ── 2. Update the rels file ────────────────────────────────────────────
    rels = read_rels(unpacked_dir, slide_name)

    # Find the rId that currently points to image4.png (or image4.*)
    existing_m = re.search(
        r'<Relationship Id="(rId\d+)"[^>]+Target="\.\./media/image4\.[^"]*"',
        rels,
    )

    if existing_m:
        # Update the existing relationship to point to the new file
        rId = existing_m.group(1)
        rels = re.sub(
            rf'(<Relationship Id="{re.escape(rId)}"[^>]+Target=")[^"]+(")',
            rf"\g<1>../media/{media_file}\g<2>",
            rels,
        )
        write_rels(unpacked_dir, slide_name, rels)
    else:
        # No image4 rel found — add a new one and inject r:embed into Picture 3
        rId  = next_rId(rels)
        rels = add_image_rel(rels, rId, media_file)
        write_rels(unpacked_dir, slide_name, rels)

        # Patch Picture 3's r:embed attribute to use the new rId
        xml = read_slide(unpacked_dir, slide_name)
        # Find <p:pic> with name="Picture 3"
        pic_m = re.search(r'<p:pic>.*?name="Picture 3".*?</p:pic>', xml, re.DOTALL)
        if pic_m:
            pic_xml = pic_m.group(0)
            # Replace or inject r:embed
            if 'r:embed=' in pic_xml:
                new_pic = re.sub(r'r:embed="rId\d+"', f'r:embed="{rId}"', pic_xml)
            else:
                new_pic = pic_xml.replace(
                    '<a:blip ',
                    f'<a:blip r:embed="{rId}" ',
                )
            xml = xml[:pic_m.start()] + new_pic + xml[pic_m.end():]
            write_slide(unpacked_dir, slide_name, xml)


def edit(unpacked_dir: str, manifest: ReportManifest) -> None:
    # ── Locate the intro slide ───────────────────────────────────────────
    # PRIMARY: shape names
    slide = find_slide_by_content(unpacked_dir, *_DETECT_PATTERNS)
    if slide is None:
        # FALLBACK: "INTRODUCTION" label text
        slide = find_slide_by_content(unpacked_dir, *_FALLBACK_TEXT)
    if slide is None:
        raise FileNotFoundError(
            "Intro slide not found in template — "
            'expected a slide with TextBox 19/TextBox 21 shapes or "INTRODUCTION" text'
        )

    xml = read_slide(unpacked_dir, slide)

    # ── Footer ──────────────────────────────────────────────────────────
    footer_text = f"{manifest.event_abbrev or manifest.event_name} Official Event Report – Prepared For {manifest.partner_name}"
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

    write_slide(unpacked_dir, slide, xml)

    # ── Partner logo (Picture 3 / image4.png) ─────────────────────────────
    if manifest.partner_logo_path:
        _replace_partner_logo(
            unpacked_dir,
            slide,
            manifest.partner_logo_path,
            manifest.partner_name,
        )
