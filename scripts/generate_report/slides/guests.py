"""
Guest Data slides (20–26).

Each slide has a 3-column table: Full Name | Email | Exotic Car
15 rows per page. Template provides 7 slides (slides 20–26).
Unused slides are deleted; extra guests overflow to duplicate slides.
"""
from __future__ import annotations
import re
import os
from ..manifest import ReportManifest, GuestRow
from ..xml_utils import (
    read_slide, write_slide, set_footer_text, find_shape_by_name,
)

GUEST_SLIDES   = [f"slide{n}.xml" for n in range(20, 27)]  # slide20–slide26
ROWS_PER_PAGE  = 15


def _replace_guest_table(xml: str, rows: list[GuestRow]) -> str:
    """Replace all data rows in the guest table."""
    tbl_m = re.search(r"<a:tbl>.*?</a:tbl>", xml, re.DOTALL)
    if not tbl_m:
        return xml
    tbl_xml = tbl_m.group(0)

    all_rows = re.findall(r"<a:tr[^>]*>.*?</a:tr>", tbl_xml, re.DOTALL)
    if not all_rows:
        return xml

    header_row   = all_rows[0]
    template_row = all_rows[1] if len(all_rows) > 1 else all_rows[0]

    def _safe(s: str) -> str:
        return (s or "-").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def _make_row(g: GuestRow) -> str:
        row = template_row
        tcs = re.findall(r"<a:tc>.*?</a:tc>", row, re.DOTALL)
        values = [g.full_name, g.email, g.exotic_car or "-"]
        for tc, val in zip(tcs, values):
            safe_val = _safe(val)
            new_tc = re.sub(r"<a:t>[^<]*</a:t>", f"<a:t>{safe_val}</a:t>", tc, count=1)
            row = row.replace(tc, new_tc, 1)
        return row

    new_rows = header_row + "".join(_make_row(g) for g in rows)

    new_tbl = re.sub(
        r"(<a:tbl>.*?<a:tr[^>]*>.*?</a:tr>)(.*?)(</a:tbl>)",
        lambda m: m.group(1) + new_rows[len(header_row):] + m.group(3),
        tbl_xml, count=1, flags=re.DOTALL
    )
    return xml[:tbl_m.start()] + new_tbl + xml[tbl_m.end():]


def edit(unpacked_dir: str, manifest: ReportManifest) -> tuple[list[str], list[str]]:
    """
    Edit guest data slides.
    Returns (kept_slides, delete_slides).
    """
    guests  = manifest.guests
    footer  = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"

    if not guests:
        # Keep at least one slide (empty)
        chunks = [[]]
    else:
        chunks = [guests[i:i + ROWS_PER_PAGE]
                  for i in range(0, len(guests), ROWS_PER_PAGE)]

    needed    = max(1, len(chunks))
    available = len(GUEST_SLIDES)

    kept_slides   = GUEST_SLIDES[:min(needed, available)]
    delete_slides = GUEST_SLIDES[min(needed, available):]

    for i, slide_name in enumerate(kept_slides):
        xml = read_slide(unpacked_dir, slide_name)
        xml = set_footer_text(xml, footer)
        chunk = chunks[i] if i < len(chunks) else []
        if chunk:
            xml = _replace_guest_table(xml, chunk)
        write_slide(unpacked_dir, slide_name, xml)

    return kept_slides, delete_slides
