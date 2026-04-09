"""
Self-contained PPTX pack / unpack / clean.

No external dependencies beyond stdlib zipfile.
PPTX = ZIP with specific content-type ordering requirements.
"""
from __future__ import annotations
import os
import re
import shutil
import zipfile


def unpack(pptx_path: str, dest_dir: str) -> None:
    """Unzip pptx_path → dest_dir (created fresh each time)."""
    if os.path.exists(dest_dir):
        shutil.rmtree(dest_dir)
    os.makedirs(dest_dir, exist_ok=True)
    with zipfile.ZipFile(pptx_path, "r") as z:
        z.extractall(dest_dir)


def pack(src_dir: str, output_path: str) -> None:
    """
    Rezip src_dir → output_path as a valid PPTX.

    OOXML requires:
      1. [Content_Types].xml must be the FIRST entry.
      2. All files use ZIP_DEFLATED (except already-compressed media).
    """
    # Collect all files
    all_files: list[str] = []
    for root, _, files in os.walk(src_dir):
        for f in files:
            full = os.path.join(root, f)
            all_files.append(full)

    # Sort so [Content_Types].xml is first, _rels/.rels second
    def _sort_key(path: str) -> tuple:
        rel = os.path.relpath(path, src_dir).replace("\\", "/")
        if rel == "[Content_Types].xml":
            return (0, rel)
        if rel == "_rels/.rels":
            return (1, rel)
        return (2, rel)

    all_files.sort(key=_sort_key)

    # Media extensions that shouldn't be re-compressed
    _no_compress = {".jpg", ".jpeg", ".png", ".gif", ".mp4", ".wmv", ".mp3", ".wav"}

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    with zipfile.ZipFile(output_path, "w") as zout:
        for full_path in all_files:
            arcname = os.path.relpath(full_path, src_dir).replace("\\", "/")
            ext = os.path.splitext(full_path)[1].lower()
            compress = (
                zipfile.ZIP_STORED if ext in _no_compress
                else zipfile.ZIP_DEFLATED
            )
            zout.write(full_path, arcname, compress_type=compress)


def clean_deleted_slides(
    unpacked_dir: str,
    deleted_slide_names: list[str],
) -> None:
    """
    Remove slide XML + rels files for deleted slides.
    Also removes their entries from [Content_Types].xml.
    Does NOT touch media files (shared across slides).
    """
    if not deleted_slide_names:
        return

    slides_dir = os.path.join(unpacked_dir, "ppt", "slides")
    rels_dir   = os.path.join(slides_dir, "_rels")

    for slide_name in deleted_slide_names:
        # Remove slide XML
        slide_path = os.path.join(slides_dir, slide_name)
        if os.path.exists(slide_path):
            os.remove(slide_path)

        # Remove rels file
        rels_path = os.path.join(rels_dir, slide_name + ".rels")
        if os.path.exists(rels_path):
            os.remove(rels_path)

    # Remove from [Content_Types].xml
    ct_path = os.path.join(unpacked_dir, "[Content_Types].xml")
    if os.path.exists(ct_path):
        with open(ct_path, "r", encoding="utf-8") as f:
            ct = f.read()
        for slide_name in deleted_slide_names:
            # e.g. PartName="/ppt/slides/slide10.xml"
            ct = re.sub(
                rf'\s*<Override[^>]+PartName="/ppt/slides/{re.escape(slide_name)}"[^/]*/>\s*',
                "\n",
                ct,
            )
        with open(ct_path, "w", encoding="utf-8") as f:
            f.write(ct)

    # Remove from presentation.xml rels
    pres_rels_path = os.path.join(unpacked_dir, "ppt", "_rels", "presentation.xml.rels")
    if os.path.exists(pres_rels_path):
        with open(pres_rels_path, "r", encoding="utf-8") as f:
            pres_rels = f.read()
        for slide_name in deleted_slide_names:
            pres_rels = re.sub(
                rf'\s*<Relationship[^>]+Target="slides/{re.escape(slide_name)}"[^/]*/>\s*',
                "\n",
                pres_rels,
            )
        with open(pres_rels_path, "w", encoding="utf-8") as f:
            f.write(pres_rels)
