"""
Slide 1 — Cover.

Layout:
  • Full-bleed background photo (user-provided)
  • Dark gradient overlay for text legibility
  • "THE OFFICIAL PARTNER GUIDE" — large white bold
  • "PREPARED FOR: {PARTNER_NAME}" — medium white bold
  • Optional TEN logo at bottom center
"""
from __future__ import annotations
import os
from ..xml_helpers import (
    SLIDE_W, SLIDE_H, slide_xml, slide_rels, picture,
    textbox, rect, solid_fill, dark_top_gradient,
    para, run, empty_para, esc, copy_media
)


def build(partner_name: str, event_name: str,
          cover_photo_path: str | None,
          ten_logo_path: str | None,
          media_dir: str,
          media_prefix: str = "cover") -> tuple[str, str]:
    """
    Returns (slide_xml_str, slide_rels_str).
    Media files are copied to media_dir.
    """
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2   # id=1 is used by the nvGrpSpPr group

    # ── Background photo ──────────────────────────────────────────────────────
    if cover_photo_path and os.path.isfile(cover_photo_path):
        ext   = os.path.splitext(cover_photo_path)[1]
        fname = f"{media_prefix}_bg{ext}"
        rel   = copy_media(cover_photo_path, media_dir, fname)
        rids["rId2"] = rel
        shapes.append(picture(sid, "Background Photo", "rId2",
                               0, 0, SLIDE_W, SLIDE_H))
        sid += 1
    else:
        # Solid dark background as fallback
        shapes.append(rect(sid, "Background", 0, 0, SLIDE_W, SLIDE_H,
                           solid_fill("050F14")))
        sid += 1

    # ── Dark gradient overlay (bottom half) ───────────────────────────────────
    shapes.append(rect(sid, "Overlay", 0, int(SLIDE_H * 0.55),
                       SLIDE_W, int(SLIDE_H * 0.45),
                       dark_top_gradient()))
    sid += 1

    # ── Title text block ──────────────────────────────────────────────────────
    # Positioned in the lower third of the slide (matches real guide)
    title_x = 633_045
    title_y = 11_373_878
    title_w = 6_963_507
    title_h = 1_500_000

    title_body = (
        para(run("THE OFFICIAL PARTNER GUIDE",
                 font="Molde SemiExpanded-Bold", size_pt=30,
                 bold=True, color_hex="FFFFFF"),
             align="ctr", line_pct=90)
        + para(run(f"PREPARED FOR: {partner_name.upper()}",
                   font="Molde SemiExpanded-Bold", size_pt=27,
                   bold=True, color_hex="FFFFFF"),
               align="ctr", line_pct=125)
    )
    shapes.append(textbox(sid, "Title", title_x, title_y, title_w, title_h,
                          title_body))
    sid += 1

    # ── TEN logo (bottom center) ──────────────────────────────────────────────
    if ten_logo_path and os.path.isfile(ten_logo_path):
        ext   = os.path.splitext(ten_logo_path)[1]
        fname = f"{media_prefix}_ten_logo{ext}"
        rel   = copy_media(ten_logo_path, media_dir, fname)
        rid   = f"rId{len(rids) + 2}"
        rids[rid] = rel
        logo_w = 1_131_022
        logo_h = 391_146
        logo_x = (SLIDE_W - logo_w) // 2
        logo_y = 13_360_079
        shapes.append(picture(sid, "TEN Logo", rid,
                               logo_x, logo_y, logo_w, logo_h))
        sid += 1

    return slide_xml("\n".join(shapes)), slide_rels(rids)
