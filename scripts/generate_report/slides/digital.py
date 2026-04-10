"""
Digital Campaign slides (4–10).

Slide 4  = header + 6 KPI callouts + "DIGITAL CAMPAIGN POSTS" label + first table page
Slides 5–N = "DIGITAL CAMPAIGN POSTS (CONT.)" + continuation table pages

Template has 7 digital campaign slides (slide4–slide10).
We keep exactly as many as needed:
  - 1 header slide + ceil(len(posts) / ROWS_PER_TABLE) table slides
  - Any extra template slides are deleted from sldIdLst + cleaned.

Table structure (from slide4):
  Columns: Content Name | Date Posted | Total Views | Total Reach |
           Total Likes  | Total Shares | Total Comments | Total Saves

The existing table XML is reused and its rows replaced.
ROWS_PER_TABLE = 14 (verified from template: slide4 has space for ~14 data rows
                       after the header row).
"""
from __future__ import annotations
import re
import os
from ..manifest import ReportManifest, MetaPost
from ..xml_utils import (
    read_slide, write_slide, set_footer_text,
    replace_run_text, find_shape_by_name, replace_txbody_content,
    build_paragraph, build_empty_paragraph,
    read_rels, write_rels,
    find_slides_by_content,
)

# ── Detection signatures (tried in order until one matches) ───────────────────
#
# PRIMARY — stable shape names set by the template author:
#   First slide uses "Table 1", continuation slides use "Table 4".
# FALLBACK — section-label text present on every digital slide:
#   All digital slides contain the string "DIGITAL CAMPAIGN" as a contiguous run.
#   The first found (by slide number) is treated as the header slide.
#
_DETECT_FIRST  = ('name="Table 1"',)   # header slide
_DETECT_CONTIN = ('name="Table 4"',)   # continuation slides
_FALLBACK_ALL  = ("DIGITAL CAMPAIGN",) # appears on ALL digital slides

ROWS_PER_TABLE = 14

# Table column widths in EMU from template slide4 (7 data cols + 1 name col)
# We preserve the existing table XML and only update cell text.

_COLS = ["Content Name", "Date Posted", "Total Views", "Total Reach",
         "Total Likes", "Total Shares", "Total Comments", "Total Saves"]


def _format_num(v: str | int | float) -> str:
    if v is None or v == "" or v == "-":
        return "-"
    try:
        n = int(float(str(v)))
        return f"{n:,}"
    except (ValueError, TypeError):
        return str(v)


def _replace_table_rows(xml: str, posts: list[MetaPost],
                        include_totals: bool = False) -> str:
    """
    Replace data rows in the first <a:tbl> found in the slide.
    The table has a fixed header row; we replace all subsequent rows.
    """
    # Find the table block
    tbl_m = re.search(r"<a:tbl>.*?</a:tbl>", xml, re.DOTALL)
    if not tbl_m:
        return xml

    tbl_xml = tbl_m.group(0)

    # Split into rows
    rows = re.findall(r"<a:tr[^>]*>.*?</a:tr>", tbl_xml, re.DOTALL)
    if not rows:
        return xml

    header_row = rows[0]

    # Build data rows using the structure of an existing data row as template
    template_row = rows[1] if len(rows) > 1 else rows[0]

    def _make_row(cells: list[str]) -> str:
        """Build a <a:tr> from a template row, replacing cell text."""
        row = template_row
        # Find all <a:tc> blocks in template row
        tcs = re.findall(r"<a:tc>.*?</a:tc>", row, re.DOTALL)
        for i, (tc, cell_val) in enumerate(zip(tcs, cells)):
            safe = str(cell_val).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            # Replace inner <a:t> text
            new_tc = re.sub(r"<a:t>[^<]*</a:t>", f"<a:t>{safe}</a:t>", tc, count=1)
            row = row.replace(tc, new_tc, 1)
        return row

    new_rows_xml = header_row
    for post in posts:
        cells = [
            post.name,
            post.date,
            _format_num(post.views),
            _format_num(post.reach),
            _format_num(post.likes),
            _format_num(post.shares),
            _format_num(post.comments),
            post.saves if post.saves == "-" else _format_num(post.saves),
        ]
        new_rows_xml += _make_row(cells)

    if include_totals and posts:
        # Sum numeric columns
        def _sum(attr):
            total = 0
            for p in posts:
                v = getattr(p, attr, "0")
                try:
                    total += int(float(str(v).replace(",", "")))
                except (ValueError, TypeError):
                    pass
            return total

        cells = [
            "TOTAL", "-",
            _format_num(_sum("views")),
            _format_num(_sum("reach")),
            _format_num(_sum("likes")),
            _format_num(_sum("shares")),
            _format_num(_sum("comments")),
            "-",
        ]
        new_rows_xml += _make_row(cells)

    new_tbl = re.sub(
        r"(<a:tbl>.*?<a:tr[^>]*>.*?</a:tr>)(.*?)(</a:tbl>)",
        lambda m: m.group(1) + new_rows_xml[len(header_row):] + m.group(3),
        tbl_xml, count=1, flags=re.DOTALL
    )

    return xml[:tbl_m.start()] + new_tbl + xml[tbl_m.end():]


def edit(unpacked_dir: str, manifest: ReportManifest,
         presentation_xml_path: str) -> list[str]:
    """
    Edit all digital campaign slides.
    Returns (kept_slides, delete_slides) — lists of slide filenames.

    Slides are detected by the presence of "Content Name" in their table headers,
    so this works regardless of how the template slides are numbered.
    """
    posts = manifest.meta_posts
    footer = f"{manifest.event_abbrev or manifest.event_name} Official Event Report – Prepared For {manifest.partner_name}"

    # ── Locate all digital campaign slides ───────────────────────────────
    # PRIMARY: shape names ("Table 1" for header, "Table 4" for continuations)
    first_slides  = find_slides_by_content(unpacked_dir, *_DETECT_FIRST)
    contin_slides = find_slides_by_content(unpacked_dir, *_DETECT_CONTIN)

    if not first_slides:
        # FALLBACK: find all slides containing the "DIGITAL CAMPAIGN" section label.
        # Sort by slide number; the first is the header, the rest are continuations.
        all_digital = find_slides_by_content(unpacked_dir, *_FALLBACK_ALL)
        first_slides  = all_digital[:1]
        contin_slides = all_digital[1:]

    if not first_slides:
        raise FileNotFoundError(
            "Digital campaign slides not found in template — "
            'expected slides with shape "Table 1"/"Table 4" or text "DIGITAL CAMPAIGN"'
        )

    # Build the full ordered list: header slide first, then continuations in order
    campaign_slides = first_slides[:1] + contin_slides

    # How many slides do we need?
    if not posts:
        chunks = [[]]
    else:
        chunks = [posts[i:i + ROWS_PER_TABLE]
                  for i in range(0, len(posts), ROWS_PER_TABLE)]
        if not chunks:
            chunks = [[]]

    needed    = len(chunks)
    available = len(campaign_slides)

    kept_slides   = campaign_slides[:min(needed, available)]
    delete_slides = campaign_slides[min(needed, available):]

    # ── First digital slide (header + KPI metrics + first table page) ─────
    first_slide_name = campaign_slides[0]
    first_slide = read_slide(unpacked_dir, first_slide_name)
    first_slide = set_footer_text(first_slide, footer)

    # Replace KPI callouts
    kpi_map = {
        "TextBox 8":  manifest.meta_headline.total_views,
        "TextBox 11": manifest.meta_headline.total_reach,
        "TextBox 13": manifest.meta_headline.total_likes,
        "TextBox 15": manifest.meta_headline.total_shares,
        "TextBox 22": manifest.meta_headline.total_comments,
        "TextBox 24": manifest.meta_headline.total_saves,
    }
    for shape_name, value in kpi_map.items():
        if not value:
            continue
        result = find_shape_by_name(first_slide, shape_name)
        if result:
            shape_xml, start, end = result
            runs = re.findall(r"<a:t>([^<]*)</a:t>", shape_xml)
            if runs:
                first = runs[0]
                new_shape = shape_xml.replace(f"<a:t>{first}</a:t>",
                                               f"<a:t>{value}</a:t>", 1)
                first_slide = first_slide[:start] + new_shape + first_slide[end:]

    # Campaign subtitle / description
    if manifest.campaign_subtitle:
        first_slide = replace_run_text(first_slide,
            "TEN\u2019S LARGEST DIGITAL CAMPAIGN YET",
            manifest.campaign_subtitle)
    if manifest.campaign_description:
        first_slide = replace_run_text(first_slide,
            "The following analytics represent the aggregate metrics across all "
            "event-related posts from the official TEN Instagram, Facebook, and "
            "TikTok accounts, TEN\u2019s largest campaign to date!",
            manifest.campaign_description)

    # Replace table rows on the first slide
    is_last = (needed == 1)
    first_slide = _replace_table_rows(first_slide, chunks[0], include_totals=is_last)
    write_slide(unpacked_dir, first_slide_name, first_slide)

    # ── Edit continuation slides ──────────────────────────────────────────
    for i, slide_name in enumerate(campaign_slides[1:], start=1):
        if i >= needed:
            break   # This slide will be deleted
        chunk = chunks[i]
        is_last = (i == needed - 1)
        xml = read_slide(unpacked_dir, slide_name)
        xml = set_footer_text(xml, footer)
        xml = _replace_table_rows(xml, chunk, include_totals=is_last)
        write_slide(unpacked_dir, slide_name, xml)

    return kept_slides, delete_slides
