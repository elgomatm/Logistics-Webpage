"""
Slide 2 — Introduction Letter.

Layout (matches real guide from intelligence report):
  • Full-bleed blurred background photo
  • Dark gradient overlay (top fade + bottom fade)
  • "INTRO" small label — top left
  • Intro body text — takes up most of the slide height
  • Partner logo — lower centre area
  • Footer bar: TEN Logo | Left Line | Header Text | Right Line | Slide #
"""
from __future__ import annotations
import os
from ..xml_helpers import (
    SLIDE_W, SLIDE_H, slide_xml, slide_rels, picture,
    textbox, rect, solid_fill, dark_top_gradient, dark_bottom_gradient,
    para, run, empty_para, footer_bar, copy_media
)

# Exact positions from intelligence report (slide 2, File A)
_INTRO_LABEL_X = 511_424
_INTRO_LABEL_Y = 507_724
_INTRO_LABEL_W = 3_539_687
_INTRO_LABEL_H = 863_313

_BODY_X = 495_299
_BODY_Y = 1_701_791
_BODY_W = 7_269_941
_BODY_H = 5_863_144

_LOGO_X = 2_405_368
_LOGO_Y = 10_554_238
_LOGO_W = 3_233_424
_LOGO_H = 1_081_342


def build(partner_name: str, event_abbrev: str,
          intro_body: str,
          bg_path: str | None,
          partner_logo_path: str | None,
          ten_logo_path: str | None,
          media_dir: str,
          slide_num: int,
          media_prefix: str = "intro") -> tuple[str, str]:
    """
    Returns (slide_xml_str, slide_rels_str).
    """
    rids: dict[str, str] = {}
    shapes: list[str]    = []
    sid = 2
    rid_counter = 2   # rId2 onward

    def next_rid() -> str:
        nonlocal rid_counter
        r = f"rId{rid_counter}"
        rid_counter += 1
        return r

    # ── Background ────────────────────────────────────────────────────────────
    if bg_path and os.path.isfile(bg_path):
        ext   = os.path.splitext(bg_path)[1]
        fname = f"{media_prefix}_bg{ext}"
        rel   = copy_media(bg_path, media_dir, fname)
        rid   = next_rid()
        rids[rid] = rel
        shapes.append(picture(sid, "Background Photo", rid,
                               482, 182, SLIDE_W - 965, SLIDE_H - 1_423))
        sid += 1
    else:
        shapes.append(rect(sid, "Background", 0, 0, SLIDE_W, SLIDE_H,
                           solid_fill("050F14")))
        sid += 1

    # ── Gradient overlays ─────────────────────────────────────────────────────
    # Top overlay (fades from dark at top)
    shapes.append(rect(sid, "Overlay Top", -482, 0, SLIDE_W, SLIDE_H,
                       dark_top_gradient()))
    sid += 1

    # Bottom overlay (second layer for text readability)
    shapes.append(rect(sid, "Overlay Bottom", 0, int(SLIDE_H * 0.53),
                       SLIDE_W, int(SLIDE_H * 0.47),
                       dark_bottom_gradient(), rot=10_800_000))
    sid += 1

    # ── "INTRO" section label ─────────────────────────────────────────────────
    label_body = para(
        run("INTRO", font="Molde SemiExpanded-Bold", size_pt=72,
            bold=True, color_hex="FFFFFF"),
        align="l"
    )
    shapes.append(textbox(sid, "TextBox 11",
                          _INTRO_LABEL_X, _INTRO_LABEL_Y,
                          _INTRO_LABEL_W, _INTRO_LABEL_H,
                          label_body))
    sid += 1

    # ── Intro body text ───────────────────────────────────────────────────────
    paragraphs = intro_body.split("\n\n") if intro_body else [""]
    body_parts: list[str] = []
    for i, p_text in enumerate(paragraphs):
        p_text = p_text.strip()
        if not p_text:
            body_parts.append(para("", align="l"))
            continue
        after = 240 if i < len(paragraphs) - 1 else 0
        body_parts.append(para(
            run(p_text, font="Inter", size_pt=11, color_hex="FFFFFF"),
            align="l", spacing_after=after, line_pct=140
        ))

    body_xml = "".join(body_parts)
    shapes.append(textbox(sid, "TextBox 3",
                          _BODY_X, _BODY_Y, _BODY_W, _BODY_H,
                          body_xml, anchor="t"))
    sid += 1

    # ── Partner logo ──────────────────────────────────────────────────────────
    if partner_logo_path and os.path.isfile(partner_logo_path):
        ext   = os.path.splitext(partner_logo_path)[1]
        fname = f"{media_prefix}_partner_logo{ext}"
        rel   = copy_media(partner_logo_path, media_dir, fname)
        rid   = next_rid()
        rids[rid] = rel
        shapes.append(picture(sid, "Picture 9", rid,
                               _LOGO_X, _LOGO_Y, _LOGO_W, _LOGO_H))
        sid += 1

    # ── Footer bar ────────────────────────────────────────────────────────────
    ten_logo_rid = None
    if ten_logo_path and os.path.isfile(ten_logo_path):
        ext   = os.path.splitext(ten_logo_path)[1]
        fname = f"{media_prefix}_ten_logo{ext}"
        rel   = copy_media(ten_logo_path, media_dir, fname)
        rid   = next_rid()
        rids[rid] = rel
        ten_logo_rid = rid

    header_text = f"{event_abbrev} PARTNER GUIDE – {partner_name.upper()}"
    footer_shapes, sid = footer_bar(sid, header_text, slide_num, ten_logo_rid)
    shapes.append(footer_shapes)

    return slide_xml("\n".join(shapes)), slide_rels(rids)
