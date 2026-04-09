"""
Cover slide editor (Slide 1).

What this does:
  1. Replaces the full-bleed background photo (Picture 4 / rId3 → image3.png)
  2. Inserts the event title PNG as a new picture shape, positioned per spec:

Title PNG positioning spec:
  - Slide: 8.5 × 11 inches (7,772,400 × 10,058,400 EMU)
  - Center X  = 50% of slide width
  - Center Y  = 22% of slide height
  - Target W  = 75% of slide width  (range: 65%–82%)
  - Constraints: left/right margin ≥ 8%, top ≥ 8%, bottom ≤ 35%
  - Aspect ratio always preserved
  - Use true pixel dimensions of PNG (ignores transparent padding via bbox)
"""
from __future__ import annotations
import os
import re
import shutil
import struct
import zlib
from pathlib import Path

# ── EMU constants ──────────────────────────────────────────────────────────────
SLIDE_W = 7_772_400   # 8.5 inches
SLIDE_H = 10_058_400  # 11 inches

# Title positioning targets (in EMU)
TITLE_CENTER_X = int(SLIDE_W * 0.50)
TITLE_CENTER_Y = int(SLIDE_H * 0.22)
TITLE_TARGET_W = int(SLIDE_W * 0.75)
TITLE_MIN_W    = int(SLIDE_W * 0.65)
TITLE_MAX_W    = int(SLIDE_W * 0.82)
TITLE_MIN_LEFT = int(SLIDE_W * 0.08)
TITLE_MIN_TOP  = int(SLIDE_H * 0.08)
TITLE_MAX_BOT  = int(SLIDE_H * 0.35)

# ── PNG dimension reader (stdlib only) ─────────────────────────────────────────

def _png_dimensions(path: str) -> tuple[int, int]:
    """Return (width, height) in pixels from PNG IHDR chunk."""
    with open(path, "rb") as f:
        sig = f.read(8)
        if sig != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"Not a PNG: {path}")
        # IHDR is always first chunk
        length = struct.unpack(">I", f.read(4))[0]
        chunk_type = f.read(4)
        if chunk_type != b"IHDR":
            raise ValueError("PNG missing IHDR")
        w = struct.unpack(">I", f.read(4))[0]
        h = struct.unpack(">I", f.read(4))[0]
    return w, h


def _jpeg_dimensions(path: str) -> tuple[int, int]:
    """Return (width, height) from JPEG SOF marker."""
    with open(path, "rb") as f:
        if f.read(2) != b"\xff\xd8":
            raise ValueError(f"Not a JPEG: {path}")
        while True:
            marker = f.read(2)
            if len(marker) < 2:
                break
            if marker[0] != 0xFF:
                break
            # SOF markers: C0–C3, C5–C7, C9–CB, CD–CF
            if marker[1] in (0xC0, 0xC1, 0xC2, 0xC3,
                              0xC5, 0xC6, 0xC7,
                              0xC9, 0xCA, 0xCB,
                              0xCD, 0xCE, 0xCF):
                f.read(3)  # length (2) + precision (1)
                h = struct.unpack(">H", f.read(2))[0]
                w = struct.unpack(">H", f.read(2))[0]
                return w, h
            else:
                seg_len = struct.unpack(">H", f.read(2))[0]
                f.seek(seg_len - 2, 1)
    raise ValueError(f"Could not read JPEG dimensions: {path}")


def _image_dimensions(path: str) -> tuple[int, int]:
    ext = Path(path).suffix.lower()
    if ext == ".png":
        return _png_dimensions(path)
    elif ext in (".jpg", ".jpeg"):
        return _jpeg_dimensions(path)
    else:
        raise ValueError(f"Unsupported image type: {ext}")


# ── Title PNG visual bounds (simple: use full pixel dimensions) ────────────────
# For best results callers should pre-trim transparent padding before upload.
# Without Pillow we use full image size; the spec says "ignore transparent
# padding when possible" — add Pillow support if available.

def _visual_dimensions(path: str) -> tuple[int, int]:
    """Return visual (width, height) of image in pixels."""
    try:
        from PIL import Image  # type: ignore
        img = Image.open(path).convert("RGBA")
        bbox = img.getbbox()   # (left, upper, right, lower) of non-transparent area
        if bbox:
            return bbox[2] - bbox[0], bbox[3] - bbox[1]
        return img.width, img.height
    except ImportError:
        pass
    return _image_dimensions(path)


# ── Layout calculation ─────────────────────────────────────────────────────────

def _calc_title_placement(px_w: int, px_h: int) -> tuple[int, int, int, int]:
    """
    Given visual pixel dimensions (px_w, px_h), return (left, top, cx, cy)
    in EMU for the title PNG shape following the positioning spec.
    """
    aspect = px_w / px_h  # preserve this throughout

    # Start at target width
    cx = TITLE_TARGET_W
    cy = int(cx / aspect)

    # Scale down if too wide
    if cx > TITLE_MAX_W:
        cx = TITLE_MAX_W
        cy = int(cx / aspect)

    # Scale up if too narrow (short title)
    if cx < TITLE_MIN_W:
        cx = TITLE_MIN_W
        cy = int(cx / aspect)

    # Center anchoring
    left = TITLE_CENTER_X - cx // 2
    top  = TITLE_CENTER_Y - cy // 2

    # Enforce margin constraints — scale down iteratively if needed
    max_iterations = 20
    for _ in range(max_iterations):
        left = TITLE_CENTER_X - cx // 2
        top  = TITLE_CENTER_Y - cy // 2
        bot  = top + cy

        violation = False
        if left < TITLE_MIN_LEFT:
            # Reduce width so left margin is satisfied
            cx = int((TITLE_CENTER_X - TITLE_MIN_LEFT) * 2)
            cy = int(cx / aspect)
            violation = True
        if left + cx > SLIDE_W - TITLE_MIN_LEFT:
            cx = int((SLIDE_W - TITLE_MIN_LEFT - TITLE_CENTER_X) * 2)
            cy = int(cx / aspect)
            violation = True
        if top < TITLE_MIN_TOP:
            # Shift center down is NOT the right fix — scale down instead
            cy = int((TITLE_CENTER_Y - TITLE_MIN_TOP) * 2)
            cx = int(cy * aspect)
            violation = True
        if bot > TITLE_MAX_BOT:
            cy = TITLE_MAX_BOT - top
            cx = int(cy * aspect)
            violation = True
        if not violation:
            break

    # Final position
    left = TITLE_CENTER_X - cx // 2
    top  = TITLE_CENTER_Y - cy // 2
    return left, top, cx, cy


# ── XML helpers ────────────────────────────────────────────────────────────────

def _next_shape_id(slide_xml: str) -> int:
    ids = [int(x) for x in re.findall(r'<p:cNvPr[^>]+id="(\d+)"', slide_xml)]
    return max(ids, default=0) + 1


def _title_pic_xml(shape_id: int, r_id: str, left: int, top: int,
                   cx: int, cy: int) -> str:
    return (
        f'<p:pic>'
        f'<p:nvPicPr>'
        f'<p:cNvPr id="{shape_id}" name="TitlePNG"/>'
        f'<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
        f'<p:nvPr/>'
        f'</p:nvPicPr>'
        f'<p:blipFill>'
        f'<a:blip r:embed="{r_id}"/>'
        f'<a:stretch><a:fillRect/></a:stretch>'
        f'</p:blipFill>'
        f'<p:spPr>'
        f'<a:xfrm><a:off x="{left}" y="{top}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        f'</p:spPr>'
        f'</p:pic>'
    )


# ── Public API ─────────────────────────────────────────────────────────────────

def edit(
    unpacked_dir: str,
    cover_photo_path: str | None,
    title_png_path: str | None,
) -> None:
    """
    Edit slide 1 in an unpacked PPTX directory.

    Args:
        unpacked_dir:     Path to unpacked PPTX root (output of pptx_io.unpack)
        cover_photo_path: Absolute path to new full-bleed background photo.
                          None = leave existing background unchanged.
        title_png_path:   Absolute path to event title PNG.
                          None = skip title injection.
    """
    slide_xml_path = os.path.join(unpacked_dir, "ppt", "slides", "slide1.xml")
    rels_path      = os.path.join(unpacked_dir, "ppt", "slides", "_rels", "slide1.xml.rels")
    media_dir      = os.path.join(unpacked_dir, "ppt", "media")

    with open(slide_xml_path, "r", encoding="utf-8") as f:
        slide_xml = f.read()

    with open(rels_path, "r", encoding="utf-8") as f:
        rels_xml = f.read()

    # ── 1. Replace cover background photo ─────────────────────────────────────
    if cover_photo_path:
        ext      = Path(cover_photo_path).suffix.lower()  # .jpg or .png
        new_name = f"cover_bg{ext}"
        dest     = os.path.join(media_dir, new_name)
        shutil.copy2(cover_photo_path, dest)

        # Find rId for the existing background (rId3 targets image3.png)
        bg_rid_m = re.search(
            r'Id="(rId\d+)"[^>]+Type="[^"]*relationships/image"[^>]+Target="[^"]*image3\.',
            rels_xml,
        )
        if bg_rid_m:
            old_rid = bg_rid_m.group(1)
            # Update the Target for that rId in rels
            rels_xml = re.sub(
                rf'(Id="{re.escape(old_rid)}"[^>]+Target=")[^"]*(")',
                rf'\1../media/{new_name}\2',
                rels_xml,
            )
        else:
            # rId3 not found by filename — try by position: first image rel
            # Fallback: add new rId and swap r:embed in the p:pic element
            bg_rid_m2 = re.search(
                r'Id="(rId3)"[^>]+Type="[^"]*relationships/image"',
                rels_xml,
            )
            if bg_rid_m2:
                rels_xml = re.sub(
                    r'(Id="rId3"[^>]+Target=")[^"]*(")',
                    rf'\1../media/{new_name}\2',
                    rels_xml,
                )

    # ── 2. Insert title PNG ────────────────────────────────────────────────────
    if title_png_path:
        # Determine visual size
        px_w, px_h = _visual_dimensions(title_png_path)
        left, top, cx, cy = _calc_title_placement(px_w, px_h)

        # Copy PNG into media dir
        title_media_name = "cover_title.png"
        shutil.copy2(title_png_path, os.path.join(media_dir, title_media_name))

        # Find next available rId
        existing_rids = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels_xml)]
        next_rid_num  = max(existing_rids, default=0) + 1
        title_rid     = f"rId{next_rid_num}"

        # Add relationship
        new_rel = (
            f'<Relationship Id="{title_rid}" '
            f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
            f'Target="../media/{title_media_name}"/>'
        )
        rels_xml = rels_xml.replace("</Relationships>", new_rel + "</Relationships>")

        # Build shape XML and insert before </p:spTree>
        shape_id  = _next_shape_id(slide_xml)
        pic_xml   = _title_pic_xml(shape_id, title_rid, left, top, cx, cy)
        slide_xml = slide_xml.replace("</p:spTree>", pic_xml + "</p:spTree>")

    # ── Write back ─────────────────────────────────────────────────────────────
    with open(slide_xml_path, "w", encoding="utf-8") as f:
        f.write(slide_xml)

    with open(rels_path, "w", encoding="utf-8") as f:
        f.write(rels_xml)
