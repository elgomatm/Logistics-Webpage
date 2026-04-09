"""
Photo processing utilities.

- Smart-crop photos to match exact placeholder aspect ratio (fill, not letterbox)
- Resize to reasonable resolution (150 DPI equivalent) for fast generation
- Preserve EXIF orientation before cropping
- Output as JPEG for consistency with the template
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path

try:
    from PIL import Image, ImageOps, ExifTags
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# Placeholder dimensions (width, height) in inches from the template analysis
# These are used to compute the correct crop aspect ratio
PLACEHOLDER_DIMS: dict[str, tuple[float, float]] = {
    # Gallery slides (left column 3 rows)
    "left_short":  (3.640, 1.990),   # idx 20,26,27,28,29,30 etc
    # Gallery slides (right column tall)
    "right_tall":  (3.650, 2.660),   # idx 17
    # Gallery slides (right column extra tall)
    "right_xtall": (3.650, 2.680),   # idx on slides 14/15/16
    # Testimonial headshots
    "headshot":    (0.457, 0.457),   # square
    # Content creation instagram previews
    "insta":       (0.800, 1.000),   # portrait 4:5
}

TARGET_DPI = 150


def _open_corrected(path: str) -> "Image.Image":
    """Open image and apply EXIF orientation so crops are correct."""
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def smart_crop(img: "Image.Image", target_w_in: float, target_h_in: float) -> "Image.Image":
    """
    Resize + center-crop image to exactly fill target dimensions.
    Target dimensions in inches; output pixel size = inches * TARGET_DPI.
    """
    tw = round(target_w_in * TARGET_DPI)
    th = round(target_h_in * TARGET_DPI)

    src_w, src_h = img.size
    target_ratio = tw / th
    src_ratio    = src_w / src_h

    if src_ratio > target_ratio:
        # Source is wider — scale to height, crop width
        new_h = th
        new_w = round(src_w * (th / src_h))
    else:
        # Source is taller — scale to width, crop height
        new_w = tw
        new_h = round(src_h * (tw / src_w))

    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Center crop
    left   = (new_w - tw) // 2
    top    = (new_h - th) // 2
    right  = left + tw
    bottom = top + th
    return img.crop((left, top, right, bottom))


def prepare_photo(
    src_path: str,
    dest_path: str,
    placeholder_key: str = "left_short",
) -> None:
    """
    Process src_path → dest_path as a JPEG sized for `placeholder_key`.
    If PIL is not available, just copies the file as-is (degraded mode).
    """
    if not PIL_AVAILABLE:
        shutil.copy2(src_path, dest_path)
        return

    dims = PLACEHOLDER_DIMS.get(placeholder_key, (3.640, 1.990))
    img = _open_corrected(src_path)
    img = smart_crop(img, dims[0], dims[1])
    # Ensure RGB before JPEG save
    if img.mode == "RGBA":
        img = img.convert("RGB")
    img.save(dest_path, "JPEG", quality=88, optimize=True)


def prepare_headshot(src_path: str, dest_path: str) -> None:
    """Square crop for testimonial headshots."""
    prepare_photo(src_path, dest_path, "headshot")


def copy_as_is(src_path: str, dest_path: str) -> None:
    """Fallback: copy without processing."""
    shutil.copy2(src_path, dest_path)


def ext_to_mime(path: str) -> str:
    ext = Path(path).suffix.lower()
    return {
        ".jpg":  "jpeg",
        ".jpeg": "jpeg",
        ".png":  "png",
        ".gif":  "gif",
        ".webp": "webp",
    }.get(ext, "jpeg")
