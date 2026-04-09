"""
Photo gallery slides (slides 12–14 in template = user slides 1–3).

Standard: 3 gallery slides, each with exactly 7 photo placeholders.

Slot layout (from slideLayout3.xml) — 7 slots, left column first:
  Slot 0  idx=20  L1  x=6.793%  y=17.045%  w=42.824%  h=18.091%  ar≈1.829
  Slot 1  idx=26  L2  x=6.793%  y=35.510%  w=42.824%  h=18.091%  ar≈1.829
  Slot 2  idx=27  L3  x=6.793%  y=53.975%  w=42.824%  h=18.091%  ar≈1.829
  Slot 3  idx=28  L4  x=6.793%  y=72.439%  w=42.824%  h=18.091%  ar≈1.829
  Slot 4  idx=17  R1  x=50.196% y=17.045%  w=42.941%  h=24.182%  ar≈1.372
  Slot 5  idx=29  R2  x=50.196% y=41.606%  w=42.941%  h=24.364%  ar≈1.362
  Slot 6  idx=30  R3  x=50.196% y=66.348%  w=42.941%  h=24.182%  ar≈1.372

idx=4294967295 is the master-inherited frosted-glass header — NEVER touched.

Title text: "Text Placeholder 7" — sz=3800 (38pt) — normAutofit enabled.
"""
from __future__ import annotations
import os
import re
import shutil
import struct
from pathlib import Path
from typing import Optional
from ..manifest import ReportManifest, GallerySlide, PhotoEntry
from ..xml_utils import (
    read_slide, write_slide, read_rels, write_rels,
    set_footer_text, update_rel_target, MASTER_PH_IDX,
)

# ── Constants ──────────────────────────────────────────────────────────────────

# Template slides used for gallery (in order)
GALLERY_SLIDE_NAMES = ["slide12.xml", "slide13.xml", "slide14.xml"]

# Extra template gallery slides — deleted from output if not needed
GALLERY_EXTRA_SLIDES = ["slide15.xml", "slide16.xml", "slide17.xml", "slide18.xml"]

# The 7 slot placeholder indices, in UI/manifest order (L1 L2 L3 L4 R1 R2 R3)
SLOT_INDICES = ["20", "26", "27", "28", "17", "29", "30"]

# Actual placeholder dimensions from slideLayout3.xml (EMU)
SLOT_DIMS: dict[str, tuple[int, int]] = {
    "20": (3_328_416, 1_819_656),   # ar ≈ 1.829
    "26": (3_328_416, 1_819_656),
    "27": (3_328_416, 1_819_656),
    "28": (3_328_416, 1_819_656),
    "17": (3_337_560, 2_432_304),   # ar ≈ 1.372
    "29": (3_337_560, 2_450_592),   # ar ≈ 1.362
    "30": (3_337_560, 2_432_304),
}


# ── Image dimension helpers ────────────────────────────────────────────────────

def _png_dimensions(path: str) -> tuple[int, int]:
    with open(path, "rb") as f:
        if f.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError("Not a PNG")
        f.read(4)  # IHDR length
        if f.read(4) != b"IHDR":
            raise ValueError("Missing IHDR")
        w = struct.unpack(">I", f.read(4))[0]
        h = struct.unpack(">I", f.read(4))[0]
    return w, h


def _jpeg_dimensions(path: str) -> tuple[int, int]:
    with open(path, "rb") as f:
        if f.read(2) != b"\xff\xd8":
            raise ValueError("Not a JPEG")
        while True:
            marker = f.read(2)
            if len(marker) < 2 or marker[0] != 0xFF:
                break
            if marker[1] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                              0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                f.read(3)
                h = struct.unpack(">H", f.read(2))[0]
                w = struct.unpack(">H", f.read(2))[0]
                return w, h
            else:
                n = struct.unpack(">H", f.read(2))[0]
                f.seek(n - 2, 1)
    raise ValueError(f"Cannot read JPEG dims: {path}")


def _image_dimensions(path: str) -> tuple[int, int]:
    """Return (width, height) for PNG or JPEG without external deps."""
    try:
        from PIL import Image  # type: ignore
        with Image.open(path) as img:
            return img.width, img.height
    except ImportError:
        pass
    ext = Path(path).suffix.lower()
    if ext == ".png":
        return _png_dimensions(path)
    return _jpeg_dimensions(path)


# ── srcRect calculation ────────────────────────────────────────────────────────

def _calc_src_rect(
    img_w: int, img_h: int,
    ph_cx: int, ph_cy: int,
    pos_x: float, pos_y: float,
) -> dict[str, int]:
    """
    Compute OOXML srcRect values (0–100000) for a cover-crop with focal point.

    pos_x / pos_y: 0=left/top, 50=center, 100=right/bottom (0–100 range).
    Returns dict with keys l, t, r, b — units: thousandths of a percent.
    """
    ph_ar  = ph_cx / ph_cy if ph_cy else 1.0
    img_ar = img_w / img_h if img_h else 1.0

    if img_ar >= ph_ar:
        # Image wider → scale to fill height, crop sides
        scale   = ph_cy / img_h
        sc_w    = img_w * scale        # scaled image width
        sc_h    = ph_cy               # exact match
        excess_w = sc_w - ph_cx
        excess_h = 0.0
    else:
        # Image taller → scale to fill width, crop top/bottom
        scale   = ph_cx / img_w
        sc_w    = ph_cx
        sc_h    = img_h * scale
        excess_w = 0.0
        excess_h = sc_h - ph_cy

    focal_x = pos_x / 100.0   # 0.0 – 1.0
    focal_y = pos_y / 100.0

    left_px  = focal_x * excess_w
    right_px = excess_w - left_px
    top_px   = focal_y * excess_h
    bot_px   = excess_h - top_px

    def _pct(px: float, total: float) -> int:
        if total <= 0:
            return 0
        return max(0, min(100_000, int(px / total * 100_000)))

    return {
        "l": _pct(left_px,  sc_w),
        "r": _pct(right_px, sc_w),
        "t": _pct(top_px,   sc_h),
        "b": _pct(bot_px,   sc_h),
    }


# ── Slide XML helpers ──────────────────────────────────────────────────────────

def _remove_pic_by_idx(xml: str, idx: str) -> str:
    """Remove the <p:pic>…</p:pic> block whose <p:ph idx="…"> matches idx."""
    def replacer(m: re.Match) -> str:
        block = m.group(0)
        if re.search(rf'idx="{re.escape(idx)}"', block):
            return ""
        return block
    return re.sub(r"<p:pic>.*?</p:pic>", replacer, xml, flags=re.DOTALL)


def _get_pic_rid(xml: str, idx: str) -> Optional[str]:
    """Return the r:embed rId for the p:pic with the given placeholder idx."""
    for m in re.finditer(r"<p:pic>(.*?)</p:pic>", xml, re.DOTALL):
        block = m.group(1)
        if re.search(rf'idx="{re.escape(idx)}"', block):
            rid = re.search(r'r:embed="(rId\d+)"', block)
            if rid:
                return rid.group(1)
    return None


def _set_blip_fill_src_rect(xml: str, rid: str, src_rect: dict[str, int]) -> str:
    """
    Within the p:pic that has r:embed="<rid>", update its a:blipFill to include
    the given srcRect (replacing any existing one).
    """
    src_tag = (
        f'<a:srcRect l="{src_rect["l"]}" t="{src_rect["t"]}" '
        f'r="{src_rect["r"]}" b="{src_rect["b"]}"/>'
    )

    def replacer(m: re.Match) -> str:
        block = m.group(0)
        if f'r:embed="{rid}"' not in block:
            return block
        # Remove existing srcRect if any
        inner = re.sub(r"<a:srcRect[^/]*/>\s*", "", block)
        # Insert after <a:blip …/>
        inner = re.sub(
            r"(<a:blip[^/]*/>\s*)",
            rf"\1{src_tag}",
            inner,
        )
        return inner

    return re.sub(r"<p:pic>.*?</p:pic>", replacer, xml, flags=re.DOTALL)


def _update_gallery_title(xml: str, title: str) -> str:
    """
    Replace the text in 'Text Placeholder 7' and enable normAutofit
    so long titles shrink automatically.
    """
    def replacer(m: re.Match) -> str:
        block = m.group(0)
        if "Text Placeholder 7" not in block:
            return block

        # Replace all <a:t> content with the new title in a single run
        # Preserve the first run's formatting (font, colour etc.)
        first_run = re.search(r"(<a:r>)(.*?)(</a:r>)", block, re.DOTALL)
        if first_run:
            run_inner = re.sub(r"<a:t>[^<]*</a:t>", f"<a:t>{title}</a:t>",
                               first_run.group(2))
            new_run = first_run.group(1) + run_inner + first_run.group(3)
            # Replace all runs with just this one
            block = re.sub(r"<a:r>.*?</a:r>", "", block, flags=re.DOTALL)
            block = block.replace("</a:p>", new_run + "</a:p>", 1)

        # Enable normAutofit (shrink text to fit)
        if "<a:normAutofit" not in block and "<a:spAutoFit" not in block:
            block = re.sub(
                r"(<a:bodyPr\b[^>]*/?>)",
                r"\1<a:normAutofit/>",
                block,
            )
            # If bodyPr is self-closing, convert to open/close form first
            block = re.sub(
                r"(<a:bodyPr\b[^>]*)/><a:normAutofit/>",
                r"\1><a:normAutofit/></a:bodyPr>",
                block,
            )

        return block

    return re.sub(r"<p:sp>.*?</p:sp>", replacer, xml, flags=re.DOTALL)


# ── Photo injection ────────────────────────────────────────────────────────────

def _inject_photo(
    unpacked_dir: str,
    slide_name: str,
    xml: str,
    rels: str,
    idx: str,
    photo: PhotoEntry,
) -> tuple[str, str]:
    """
    Inject one photo into the slot with placeholder idx.
    Returns updated (xml, rels).
    """
    if not photo.path or not os.path.exists(photo.path):
        return xml, rels

    media_dir = os.path.join(unpacked_dir, "ppt", "media")

    # Find existing rId for this slot
    rid = _get_pic_rid(xml, idx)
    if not rid:
        return xml, rels

    # Determine existing media filename from rels
    target_m = re.search(
        rf'Id="{re.escape(rid)}"[^>]+Target="\.\./media/([^"]+)"', rels
    )
    if not target_m:
        return xml, rels
    existing_name = target_m.group(1)

    # Copy new photo into media dir — keep original extension, reuse slot name stem
    stem      = os.path.splitext(existing_name)[0]
    src_ext   = Path(photo.path).suffix.lower()
    new_name  = f"{stem}{src_ext}"
    dest_path = os.path.join(media_dir, new_name)
    shutil.copy2(photo.path, dest_path)

    # Update rels target
    if new_name != existing_name:
        rels = update_rel_target(rels, rid, f"../media/{new_name}")

    # Compute srcRect from image dims + focal point
    try:
        img_w, img_h = _image_dimensions(photo.path)
        ph_cx, ph_cy = SLOT_DIMS.get(idx, (3_328_416, 1_819_656))
        src_rect = _calc_src_rect(img_w, img_h, ph_cx, ph_cy,
                                   photo.pos_x, photo.pos_y)
    except Exception:
        src_rect = {"l": 0, "t": 0, "r": 0, "b": 0}

    # Inject srcRect into blipFill
    xml = _set_blip_fill_src_rect(xml, rid, src_rect)

    return xml, rels


# ── Public API ─────────────────────────────────────────────────────────────────

def edit(
    unpacked_dir: str,
    manifest: ReportManifest,
) -> tuple[list[str], list[str]]:
    """
    Edit gallery slides.

    Uses template slides 12, 13, 14 (index 0–2).
    Extra template slides 15–18 are returned in the delete list.

    Returns:
        kept:   list of slide filenames kept (e.g. ["slide12.xml", ...])
        delete: list of slide filenames to remove from presentation
    """
    footer  = f"{manifest.event_name} Official Event Report - For {manifest.partner_name}"
    slides  = manifest.gallery_slides  # user-provided, up to 3

    kept:   list[str] = []
    delete: list[str] = list(GALLERY_EXTRA_SLIDES)  # always remove extras

    for i, tmpl_slide in enumerate(GALLERY_SLIDE_NAMES):
        if i >= len(slides):
            # No user slide for this template slot → delete it
            delete.append(tmpl_slide)
            continue

        user_slide: GallerySlide = slides[i]
        xml  = read_slide(unpacked_dir, tmpl_slide)
        rels = read_rels(unpacked_dir, tmpl_slide)

        # 1. Update gallery title
        if user_slide.title:
            xml = _update_gallery_title(xml, user_slide.title)

        # 2. Inject photos into their slots
        for slot_i, idx in enumerate(SLOT_INDICES):
            photo_entry = (
                user_slide.photos[slot_i]
                if slot_i < len(user_slide.photos)
                else None
            )
            if photo_entry and photo_entry.path:
                xml, rels = _inject_photo(
                    unpacked_dir, tmpl_slide, xml, rels, idx, photo_entry
                )

        # 3. Update footer
        xml = set_footer_text(xml, footer)

        write_slide(unpacked_dir, tmpl_slide, xml)
        write_rels(unpacked_dir, tmpl_slide, rels)
        kept.append(tmpl_slide)

    return kept, delete
