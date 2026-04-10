"""
Slide 11 — Closing / Thank You.

Simple full-bleed photo with centred closing text.
"""
from __future__ import annotations
import os
from ..xml_helpers import (
    SLIDE_W, SLIDE_H, slide_xml, slide_rels, picture,
    textbox, rect, solid_fill, dark_top_gradient,
    para, run, copy_media
)


def build(event_name: str,
          bg_path: str | None,
          ten_logo_path: str | None,
          media_dir: str,
          media_prefix: str = "closing") -> tuple[str, str]:
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2
    rid_counter = 2

    def next_rid() -> str:
        nonlocal rid_counter
        r = f"rId{rid_counter}"
        rid_counter += 1
        return r

    # Background
    if bg_path and os.path.isfile(bg_path):
        ext   = os.path.splitext(bg_path)[1]
        fname = f"{media_prefix}_bg{ext}"
        rel   = copy_media(bg_path, media_dir, fname)
        rid   = next_rid()
        rids[rid] = rel
        shapes.append(picture(sid, "Background", rid, 0, 0, SLIDE_W, SLIDE_H))
        sid += 1
    else:
        shapes.append(rect(sid, "Background", 0, 0, SLIDE_W, SLIDE_H,
                           solid_fill("050F14")))
        sid += 1

    # Overlay
    shapes.append(rect(sid, "Overlay", 0, int(SLIDE_H * 0.4),
                       SLIDE_W, int(SLIDE_H * 0.6),
                       dark_top_gradient()))
    sid += 1

    # Closing message
    closing_body = (
        para(run("SEE YOU ON THE ROAD.",
                 font="Molde SemiExpanded-Bold", size_pt=36,
                 bold=True, color_hex="FFFFFF"),
             align="ctr")
        + para(run(event_name,
                   font="Inter", size_pt=18, color_hex="FFFFFF"),
               align="ctr")
        + para(run("— Your Family at The Exotics Network",
                   font="Inter", size_pt=14, color_hex="CCCCCC"),
               align="ctr")
    )
    shapes.append(textbox(sid, "ClosingText",
                          457_200, int(SLIDE_H * 0.58),
                          SLIDE_W - 914_400, int(SLIDE_H * 0.30),
                          closing_body, anchor="ctr"))
    sid += 1

    # TEN Logo
    if ten_logo_path and os.path.isfile(ten_logo_path):
        ext   = os.path.splitext(ten_logo_path)[1]
        fname = f"{media_prefix}_ten_logo{ext}"
        rel   = copy_media(ten_logo_path, media_dir, fname)
        rid   = next_rid()
        rids[rid] = rel
        logo_w = 1_500_000
        logo_h = 519_000
        shapes.append(picture(sid, "TEN Logo", rid,
                               (SLIDE_W - logo_w) // 2,
                               int(SLIDE_H * 0.12),
                               logo_w, logo_h))
        sid += 1

    return slide_xml("\n".join(shapes)), slide_rels(rids)
