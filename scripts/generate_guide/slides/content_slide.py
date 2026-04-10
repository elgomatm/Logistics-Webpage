"""
Generic content slide builder.

Used for all event-content slides (Day 1 Itinerary, Welcome Reception,
Day 2 Itinerary, Rally, Race Day, Hotel, Rules & Safety).

Layout:
  • Full-bleed background photo or solid dark
  • Gradient overlays
  • TEN Logo + Left/Right Lines + Header Text + Slide# (footer bar)
  • Large section TITLE (upper-left, two-line with vertical break)
  • Main CONTENT area (right or centre, depending on slide type)
  • Optional SECONDARY content column (times for schedule slides)
"""
from __future__ import annotations
import os
from ..xml_helpers import (
    SLIDE_W, SLIDE_H, slide_xml, slide_rels, picture,
    textbox, rect, solid_fill, dark_top_gradient, dark_bottom_gradient,
    para, run, empty_para, footer_bar, copy_media, line_shape,
    FOOTER_Y
)

# ── Layout constants ──────────────────────────────────────────────────────────

_TITLE_X   = 457_200
_TITLE_Y   = 914_400   # ~1"
_TITLE_W   = 3_200_000
_TITLE_H   = 3_600_000

# Separator line between title and body columns
_SEP_X     = 3_810_000
_SEP_Y_TOP = 1_000_000
_SEP_H     = 11_500_000  # runs most of the slide height

# Main content column
_BODY_X    = 457_200
_BODY_Y    = 5_000_000
_BODY_W    = 7_315_200   # nearly full width
_BODY_H    = FOOTER_Y - 5_000_000 - 100_000

# Two-column layout (for schedule: times | activities)
_COL_TIMES_X = 457_200
_COL_TIMES_W = 2_200_000
_COL_ACTS_X  = 2_800_000
_COL_ACTS_W  = 5_000_000
_COL_Y       = 4_800_000
_COL_H       = FOOTER_Y - 4_800_000 - 100_000

# Opening text (above the schedule columns)
_OPEN_X = 457_200
_OPEN_Y = 3_200_000
_OPEN_W = 7_315_200
_OPEN_H = 1_600_000


def _bg_shapes(sid: int, bg_path: str | None,
               rids: dict[str, str], media_dir: str,
               prefix: str) -> tuple[list[str], int, dict[str, str]]:
    """Add background + overlay shapes. Returns updated (shapes, sid, rids)."""
    shapes: list[str] = []

    if bg_path and os.path.isfile(bg_path):
        ext   = os.path.splitext(bg_path)[1]
        fname = f"{prefix}_bg{ext}"
        rel   = copy_media(bg_path, media_dir, fname)
        rid   = f"rId{len(rids) + 2}"
        rids[rid] = rel
        shapes.append(picture(sid, "Background Photo", rid,
                               0, 0, SLIDE_W, SLIDE_H))
        sid += 1
    else:
        shapes.append(rect(sid, "Background", 0, 0, SLIDE_W, SLIDE_H,
                           solid_fill("050F14")))
        sid += 1

    # Dark overlay covering most of slide
    shapes.append(rect(sid, "Overlay", -482, 0, SLIDE_W + 964, SLIDE_H,
                       dark_top_gradient()))
    sid += 1
    shapes.append(rect(sid, "Overlay2", 0, int(SLIDE_H * 0.47),
                       SLIDE_W, int(SLIDE_H * 0.53),
                       dark_bottom_gradient(), rot=10_800_000))
    sid += 1

    return shapes, sid, rids


def build_schedule(*, partner_name: str, event_abbrev: str,
                   title: str, opening_line: str,
                   items: list,            # list[ScheduleItem]
                   bg_path: str | None,
                   ten_logo_path: str | None,
                   media_dir: str, slide_num: int,
                   media_prefix: str) -> tuple[str, str]:
    """
    Itinerary / schedule slide with two columns: times (left) | activities (right).
    """
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2

    bg_shapes, sid, rids = _bg_shapes(sid, bg_path, rids, media_dir, media_prefix)
    shapes.extend(bg_shapes)

    # Title (vertical line break → two visual lines)
    title_lines = title.replace("\n", "\x0b")   # vertical tab = line break in PPTX
    # Build title as separate paragraphs
    title_paras = []
    for part in title.split("\n"):
        title_paras.append(para(
            run(part, font="Molde SemiExpanded-Bold", size_pt=36, bold=True,
                color_hex="FFFFFF"),
            align="l", line_pct=100
        ))
    shapes.append(textbox(sid, "SlideTitle", _TITLE_X, _TITLE_Y, _TITLE_W, _TITLE_H,
                          "".join(title_paras), anchor="t"))
    sid += 1

    # Opening text
    if opening_line.strip():
        open_body = para(
            run(opening_line, font="Inter", size_pt=11, color_hex="FFFFFF"),
            align="l", line_pct=140
        )
        shapes.append(textbox(sid, "OpeningText",
                              _OPEN_X, _OPEN_Y, _OPEN_W, _OPEN_H,
                              open_body))
        sid += 1

    # Schedule columns
    if items:
        times_paras = "".join(
            para(run(it.time, font="Inter", size_pt=11,
                     color_hex="FFFFFF"), align="r", spacing_after=200)
            for it in items
        )
        acts_paras = "".join(
            para(run(it.activity, font="Inter", size_pt=11,
                     color_hex="FFFFFF"), align="l", spacing_after=200)
            for it in items
        )

        col_y = _OPEN_Y + _OPEN_H + 200_000 if opening_line.strip() else _COL_Y
        col_h = FOOTER_Y - col_y - 200_000

        shapes.append(textbox(sid, "Times", _COL_TIMES_X, col_y, _COL_TIMES_W, col_h,
                              times_paras))
        sid += 1
        shapes.append(textbox(sid, "Activities", _COL_ACTS_X, col_y, _COL_ACTS_W, col_h,
                              acts_paras))
        sid += 1

    shapes.extend(_footer(sid, partner_name, event_abbrev, ten_logo_path,
                          rids, media_dir, media_prefix, slide_num))
    return slide_xml("\n".join(shapes)), slide_rels(rids)


def build_venue(*, partner_name: str, event_abbrev: str,
                venue_title: str, location_name: str,
                arrival_text: str, directions: str,
                bg_path: str | None, ten_logo_path: str | None,
                media_dir: str, slide_num: int,
                media_prefix: str) -> tuple[str, str]:
    """Welcome Reception / venue details slide."""
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2

    bg_shapes, sid, rids = _bg_shapes(sid, bg_path, rids, media_dir, media_prefix)
    shapes.extend(bg_shapes)

    # Large venue title
    venue_paras = "".join(
        para(run(line, font="Molde SemiExpanded-Bold", size_pt=36, bold=True,
                 color_hex="FFFFFF"), align="l", line_pct=100)
        for line in venue_title.split("\n")
    )
    shapes.append(textbox(sid, "SlideTitle", _TITLE_X, _TITLE_Y, _TITLE_W, _TITLE_H,
                          venue_paras, anchor="t"))
    sid += 1

    # Location name (bold header)
    if location_name.strip():
        loc_body = para(run(location_name, font="Molde SemiExpanded-Bold",
                            size_pt=13, bold=True, color_hex="FFFFFF"), align="l")
        shapes.append(textbox(sid, "LocationName",
                              _OPEN_X, _OPEN_Y, _OPEN_W, 800_000, loc_body))
        sid += 1

    # Arrival text
    if arrival_text.strip():
        arr_body = para(run(arrival_text, font="Inter", size_pt=11,
                            color_hex="FFFFFF"), align="l", line_pct=140)
        arr_y = _OPEN_Y + 900_000
        arr_h = FOOTER_Y - arr_y - 1_500_000
        shapes.append(textbox(sid, "ArrivalText", _OPEN_X, arr_y, _OPEN_W, arr_h,
                              arr_body))
        sid += 1

    # Directions (smaller, below)
    if directions.strip():
        dir_body = para(run(directions, font="Inter", size_pt=10,
                            color_hex="CCCCCC"), align="l", line_pct=130)
        dir_y = FOOTER_Y - 2_500_000
        dir_h = 2_200_000
        shapes.append(textbox(sid, "Directions", _OPEN_X, dir_y, _OPEN_W, dir_h,
                              dir_body))
        sid += 1

    shapes.extend(_footer(sid, partner_name, event_abbrev, ten_logo_path,
                          rids, media_dir, media_prefix, slide_num))
    return slide_xml("\n".join(shapes)), slide_rels(rids)


def build_generic(*, partner_name: str, event_abbrev: str,
                  title: str, body_text: str,
                  secondary_text: str = "",
                  bg_path: str | None = None,
                  ten_logo_path: str | None = None,
                  media_dir: str, slide_num: int,
                  media_prefix: str) -> tuple[str, str]:
    """
    Fallback: title + body paragraph.  Used for Rally, Hotel, closing variants.
    """
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2

    bg_shapes, sid, rids = _bg_shapes(sid, bg_path, rids, media_dir, media_prefix)
    shapes.extend(bg_shapes)

    # Title
    title_paras = "".join(
        para(run(ln, font="Molde SemiExpanded-Bold", size_pt=36, bold=True,
                 color_hex="FFFFFF"), align="l", line_pct=100)
        for ln in title.split("\n")
    )
    shapes.append(textbox(sid, "SlideTitle", _TITLE_X, _TITLE_Y, _TITLE_W, _TITLE_H,
                          title_paras, anchor="t"))
    sid += 1

    # Body
    if body_text.strip():
        body_xml = "".join(
            para(run(p, font="Inter", size_pt=11, color_hex="FFFFFF"),
                 align="l", spacing_after=200, line_pct=140)
            for p in body_text.split("\n\n")
            if p.strip()
        )
        body_y = _OPEN_Y
        body_h = FOOTER_Y - body_y - 200_000
        if secondary_text:
            body_h = (FOOTER_Y - body_y - 200_000) // 2
        shapes.append(textbox(sid, "BodyText", _OPEN_X, body_y, _OPEN_W, body_h,
                              body_xml))
        sid += 1

    # Secondary text (e.g. directions)
    if secondary_text.strip():
        sec_xml = "".join(
            para(run(p, font="Inter", size_pt=10, color_hex="CCCCCC"),
                 align="l", spacing_after=150, line_pct=130)
            for p in secondary_text.split("\n\n")
            if p.strip()
        )
        sec_y = int(SLIDE_H * 0.6)
        sec_h = FOOTER_Y - sec_y - 200_000
        shapes.append(textbox(sid, "SecondaryText", _OPEN_X, sec_y, _OPEN_W, sec_h,
                              sec_xml))
        sid += 1

    shapes.extend(_footer(sid, partner_name, event_abbrev, ten_logo_path,
                          rids, media_dir, media_prefix, slide_num))
    return slide_xml("\n".join(shapes)), slide_rels(rids)


def build_rules(*, partner_name: str, event_abbrev: str,
                general: str, convoy: str, vehicle: str, emergency: str,
                contacts: list,
                bg_path: str | None, ten_logo_path: str | None,
                media_dir: str, slide_num: int,
                media_prefix: str) -> tuple[str, str]:
    """Rules & Safety slide with sections."""
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2

    bg_shapes, sid, rids = _bg_shapes(sid, bg_path, rids, media_dir, media_prefix)
    shapes.extend(bg_shapes)

    # Title
    title_paras = "".join(
        para(run(ln, font="Molde SemiExpanded-Bold", size_pt=36, bold=True,
                 color_hex="FFFFFF"), align="l")
        for ln in "RULES\nAND SAFETY".split("\n")
    )
    shapes.append(textbox(sid, "SlideTitle", _TITLE_X, _TITLE_Y, _TITLE_W, _TITLE_H,
                          title_paras, anchor="t"))
    sid += 1

    # Build combined rules text
    sections: list[str] = []
    if general.strip():
        sections.append("GENERAL PROTOCOLS\n" + general)
    if convoy.strip():
        sections.append("Convoy Etiquette\n" + convoy)
    if vehicle.strip():
        sections.append("VEHICLE PREPAREDNESS\n" + vehicle)
    if emergency.strip():
        sections.append("EMERGENCY PROCEDURES\n" + emergency)
    if contacts:
        contact_lines = "\n".join(f"{c.name}: {c.phone}" for c in contacts)
        sections.append("Emergency Contacts\n" + contact_lines)

    rules_paras: list[str] = []
    for section in sections:
        lines = section.split("\n", 1)
        header = lines[0].strip()
        body   = lines[1].strip() if len(lines) > 1 else ""
        rules_paras.append(
            para(run(header, font="Molde SemiExpanded-Bold", size_pt=10,
                     bold=True, color_hex="FFFFFF"), align="l")
        )
        if body:
            rules_paras.append(
                para(run(body, font="Inter", size_pt=9, color_hex="DDDDDD"),
                     align="l", spacing_after=180, line_pct=130)
            )

    body_y = _OPEN_Y
    body_h = FOOTER_Y - body_y - 200_000
    shapes.append(textbox(sid, "RulesText", _OPEN_X, body_y, _OPEN_W, body_h,
                          "".join(rules_paras), anchor="t"))
    sid += 1

    shapes.extend(_footer(sid, partner_name, event_abbrev, ten_logo_path,
                          rids, media_dir, media_prefix, slide_num))
    return slide_xml("\n".join(shapes)), slide_rels(rids)


# ── Footer helper ─────────────────────────────────────────────────────────────

def _footer(sid: int, partner_name: str, event_abbrev: str,
            ten_logo_path: str | None,
            rids: dict, media_dir: str, prefix: str,
            slide_num: int) -> list[str]:
    """Add footer shapes and update rids in-place. Returns list of shape strings."""
    ten_logo_rid = None
    if ten_logo_path and os.path.isfile(ten_logo_path):
        ext   = os.path.splitext(ten_logo_path)[1]
        fname = f"{prefix}_ten_logo{ext}"
        rel   = copy_media(ten_logo_path, media_dir, fname)
        rid   = f"rId{len(rids) + 2}"
        rids[rid] = rel
        ten_logo_rid = rid

    header_text = f"{event_abbrev} PARTNER GUIDE – {partner_name.upper()}"
    footer_xml, _ = footer_bar(sid, header_text, slide_num, ten_logo_rid)
    return [footer_xml]
