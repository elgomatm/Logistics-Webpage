"""
Main report generation orchestrator.

Usage (CLI):
    python -m scripts.generate_report.generator \
        --manifest /tmp/manifest.json \
        --template /path/to/report_template.pptx \
        --output   /tmp/output.pptx

Or call generate() directly from Python.
"""
from __future__ import annotations
import os
import sys
import json
import shutil
import tempfile
import argparse
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from .manifest import ReportManifest, manifest_from_dict
from .pptx_io import unpack, pack, clean_deleted_slides
from .slides import cover, intro, overview, digital, testimonials, gallery, content, guests
from .xml_utils import warm_slide_cache, clear_slide_cache

# Optional Pillow for image compression
try:
    from PIL import Image as _PILImage
    _PILLOW_AVAILABLE = True
except ImportError:
    _PILLOW_AVAILABLE = False


_TARGET_DPI = 220
_EMU_PER_INCH = 914_400


def _compress_images(unpacked_dir: str) -> None:
    """
    Compress every raster image referenced by any slide:
      • Apply <a:srcRect> crop in-place (delete cropped areas) and remove the
        XML attribute from the slide.
      • Resample down to _TARGET_DPI (220 PPI) at display size if currently larger.

    Gallery photos are pre-processed by gallery._inject_photo (already at display
    size, no srcRect).  This function is still useful for template images
    (background photos, cover, testimonials) that arrive at full resolution.

    Parallelised: slides are processed concurrently.  Per-media-file locks
    prevent two threads from writing to the same file simultaneously.  Each
    unique media file is also processed at most once (tracked via a shared set).
    """
    if not _PILLOW_AVAILABLE:
        return

    slides_dir = os.path.join(unpacked_dir, "ppt", "slides")
    media_dir  = os.path.join(unpacked_dir, "ppt", "media")
    rels_dir   = os.path.join(slides_dir, "_rels")

    slide_files = [
        f for f in os.listdir(slides_dir)
        if f.startswith("slide") and f.endswith(".xml")
        and not f.startswith("slideLayout")
        and not f.startswith("slideMaster")
    ]

    # Shared state for deduplication and per-file locking
    _done_media:     set[str]                  = set()
    _media_locks:    dict[str, threading.Lock] = {}
    _shared_lock = threading.Lock()

    def _get_media_lock(path: str) -> threading.Lock:
        with _shared_lock:
            if path not in _media_locks:
                _media_locks[path] = threading.Lock()
            return _media_locks[path]

    def _process_slide(slide_file: str) -> None:
        slide_path = os.path.join(slides_dir, slide_file)
        rels_path  = os.path.join(rels_dir, slide_file + ".rels")
        if not os.path.isfile(rels_path):
            return

        with open(slide_path, "r", encoding="utf-8") as fh:
            xml = fh.read()
        with open(rels_path, "r", encoding="utf-8") as fh:
            rels = fh.read()

        # rId → media filename
        rid_to_file: dict[str, str] = {
            m.group(1): m.group(2)
            for m in re.finditer(
                r'<Relationship Id="(rId\d+)"[^>]+Type="[^"]*image[^"]*"'
                r'[^>]+Target="\.\./media/([^"]+)"',
                rels,
            )
        }

        xml_modified = False

        for pic_m in re.finditer(r"<p:pic>.*?</p:pic>", xml, re.DOTALL):
            pic_xml = pic_m.group(0)
            if "<p:ph" in pic_xml:
                continue

            embed_m = re.search(r'r:embed="(rId\d+)"', pic_xml)
            if not embed_m:
                continue
            rId = embed_m.group(1)
            media_file = rid_to_file.get(rId)
            if not media_file:
                continue

            media_path = os.path.join(media_dir, media_file)
            if not os.path.isfile(media_path):
                continue

            ext = os.path.splitext(media_file)[1].lower()
            if ext not in (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif"):
                continue

            # Parse srcRect
            src_m   = re.search(r"<a:srcRect([^/]*)/?>", pic_xml)
            has_crop = src_m is not None
            if has_crop:
                attrs = src_m.group(1)
                def _attr(name: str, _a: str = attrs) -> float:
                    m_ = re.search(rf'{name}="(\d+)"', _a)
                    return int(m_.group(1)) / 100_000.0 if m_ else 0.0
                l_frac = _attr("l"); t_frac = _attr("t")
                r_frac = _attr("r"); b_frac = _attr("b")
                any_crop = l_frac or t_frac or r_frac or b_frac
            else:
                l_frac = t_frac = r_frac = b_frac = 0.0
                any_crop = False

            # Parse display size
            ext_m = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', pic_xml)
            if ext_m:
                disp_w_in = int(ext_m.group(1)) / _EMU_PER_INCH
                disp_h_in = int(ext_m.group(2)) / _EMU_PER_INCH
            else:
                disp_w_in = disp_h_in = 0.0

            # Check if this media file was already processed by another thread
            with _shared_lock:
                already_done = media_path in _done_media
                if not already_done:
                    _done_media.add(media_path)

            media_lock = _get_media_lock(media_path)
            with media_lock:
                try:
                    img = _PILImage.open(media_path)
                    orig_w, orig_h = img.size

                    # ── Step 1: Apply crop ────────────────────────────────
                    if not already_done and any_crop:
                        crop_l = max(0, int(l_frac * orig_w))
                        crop_t = max(0, int(t_frac * orig_h))
                        crop_r = min(orig_w, orig_w - int(r_frac * orig_w))
                        crop_b = min(orig_h, orig_h - int(b_frac * orig_h))
                        crop_r = max(crop_l + 1, crop_r)
                        crop_b = max(crop_t + 1, crop_b)
                        img = img.crop((crop_l, crop_t, crop_r, crop_b))

                    # ── Step 2: Resample to _TARGET_DPI ──────────────────
                    cur_w, cur_h = img.size
                    if (not already_done
                            and disp_w_in > 0 and disp_h_in > 0):
                        t_w = max(1, int(disp_w_in * _TARGET_DPI))
                        t_h = max(1, int(disp_h_in * _TARGET_DPI))
                        if cur_w > t_w or cur_h > t_h:
                            img = img.resize((t_w, t_h), _PILImage.LANCZOS)

                    # ── Save (no optimize=True — same quality, 2× faster) ──
                    if not already_done:
                        save_fmt = "JPEG" if ext in (".jpg", ".jpeg") else "PNG"
                        save_kw: dict = {}
                        if save_fmt == "JPEG":
                            save_kw["quality"] = 88
                            if img.mode in ("RGBA", "P"):
                                img = img.convert("RGB")
                        img.save(media_path, format=save_fmt, **save_kw)

                except Exception:
                    pass   # never crash the generator over compression

            # ── Remove srcRect from slide XML (always per-slide, per-pic) ──
            if has_crop:
                new_pic_xml = re.sub(r"<a:srcRect[^/]*/?>", "", pic_xml)
                xml = xml[:pic_m.start()] + new_pic_xml + xml[pic_m.end():]
                xml_modified = True

        if xml_modified:
            with open(slide_path, "w", encoding="utf-8") as fh:
                fh.write(xml)

    n_workers = min(len(slide_files), (os.cpu_count() or 2) + 2, 8)
    if n_workers <= 1 or len(slide_files) <= 1:
        for sf in slide_files:
            _process_slide(sf)
    else:
        with ThreadPoolExecutor(max_workers=n_workers) as pool:
            futs = [pool.submit(_process_slide, sf) for sf in slide_files]
            for fut in as_completed(futs):
                try:
                    fut.result()
                except Exception:
                    pass


def _delete_slides_from_presentation(
    unpacked_dir: str,
    slide_filenames: list[str],
) -> None:
    """
    Remove given slide filenames from ppt/presentation.xml sldIdLst,
    then remove the physical files via pptx_io.clean_deleted_slides.
    """
    if not slide_filenames:
        return

    pres_path = os.path.join(unpacked_dir, "ppt", "presentation.xml")
    with open(pres_path, "r", encoding="utf-8") as f:
        pres_xml = f.read()

    pres_rels_path = os.path.join(unpacked_dir, "ppt", "_rels",
                                   "presentation.xml.rels")
    with open(pres_rels_path, "r", encoding="utf-8") as f:
        pres_rels = f.read()

    for slide_name in slide_filenames:
        # Find rId for this slide
        rId_m = re.search(
            rf'Id="(rId\d+)"[^>]+Target="[^"]*{re.escape(slide_name)}"',
            pres_rels,
        )
        if not rId_m:
            continue
        rId = rId_m.group(1)

        # Remove <p:sldId r:id="rId…"/> from sldIdLst
        pres_xml = re.sub(
            rf'<p:sldId[^>]+r:id="{re.escape(rId)}"[^/]*/>\s*',
            "",
            pres_xml,
        )

    with open(pres_path, "w", encoding="utf-8") as f:
        f.write(pres_xml)

    # Remove physical files + content-type entries
    clean_deleted_slides(unpacked_dir, slide_filenames)


def _replace_master_header(
    unpacked_dir: str,
    header_path: str,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
    zoom: float = 1.0,
) -> None:
    """
    Replace the full-width header image (Picture 3, rId6 → ../media/image1.png)
    in the slide master with a new image.

    Strategy:
      1. Find the actual rId that targets the header image by looking for the
         shape named "Picture 3" in slideMaster1.xml and reading its r:embed value.
      2. Find the corresponding Relationship in the rels file and get the Target
         (e.g. "../media/image1.png").
      3. Copy the new image over that media file, preserving the filename so
         every slide that references it via the master picks up the new image.
         The extension may differ — if so, copy to a new filename and update the rels.
    """
    master_xml_path  = os.path.join(unpacked_dir, "ppt", "slideMasters", "slideMaster1.xml")
    master_rels_path = os.path.join(unpacked_dir, "ppt", "slideMasters", "_rels", "slideMaster1.xml.rels")
    media_dir        = os.path.join(unpacked_dir, "ppt", "media")

    if not os.path.isfile(master_xml_path) or not os.path.isfile(master_rels_path):
        raise FileNotFoundError("Slide master or its rels file not found in unpacked template")

    with open(master_xml_path, "r", encoding="utf-8") as f:
        master_xml = f.read()
    with open(master_rels_path, "r", encoding="utf-8") as f:
        master_rels = f.read()

    # ── Find the rId for "Picture 3" (or any picture shape at position 0,0) ──
    # First try to find the shape named "Picture 3" and extract its r:embed
    rId: str | None = None

    pic3_m = re.search(r'name="Picture 3"', master_xml)
    if pic3_m:
        # Walk back to find the <p:sp> or <p:pic> opening tag that encloses this
        region_start = master_xml.rfind("<p:pic>", 0, pic3_m.start())
        if region_start == -1:
            region_start = master_xml.rfind("<p:sp>", 0, pic3_m.start())
        if region_start != -1:
            # Find the closing tag after our position
            region_end_pic = master_xml.find("</p:pic>", region_start)
            region_end_sp  = master_xml.find("</p:sp>",  region_start)
            region_end = min(
                region_end_pic if region_end_pic != -1 else len(master_xml),
                region_end_sp  if region_end_sp  != -1 else len(master_xml),
            ) + 8  # include closing tag
            shape_xml = master_xml[region_start:region_end]
            embed_m = re.search(r'r:embed="(rId\d+)"', shape_xml)
            if embed_m:
                rId = embed_m.group(1)

    # Fallback: assume rId6 (historically correct for the original template)
    if rId is None:
        rId = "rId6"

    # ── Find the Target in rels ───────────────────────────────────────────
    target_m = re.search(
        rf'Id="{re.escape(rId)}"[^>]+Target="([^"]+)"',
        master_rels,
    )
    if not target_m:
        raise FileNotFoundError(
            f"Could not find relationship {rId} in slide master rels — "
            "master header image reference not found"
        )

    rel_target = target_m.group(1)  # e.g. "../media/image1.png"
    existing_media_path = os.path.normpath(
        os.path.join(unpacked_dir, "ppt", "slideMasters", rel_target)
    )

    # ── Optionally crop to the correct aspect ratio using PIL ─────────────
    # Read the header shape's display size from master XML to get exact aspect ratio.
    # The header image is positioned with <a:off> and <a:ext> inside its <p:pic> spPr.
    target_image_path = header_path  # may be replaced below if PIL crops it
    if _PILLOW_AVAILABLE:
        try:
            # Find the picture shape's extent (cx × cy) from master XML
            aspect_ratio: float | None = None
            pic3_m = re.search(r'name="Picture 3"', master_xml)
            if pic3_m:
                region_start = master_xml.rfind("<p:pic>", 0, pic3_m.start())
                if region_start != -1:
                    region_end = master_xml.find("</p:pic>", region_start)
                    if region_end != -1:
                        shape_region = master_xml[region_start:region_end + 8]
                        ext_m = re.search(r'<a:ext\s+cx="(\d+)"\s+cy="(\d+)"', shape_region)
                        if ext_m:
                            cx, cy = int(ext_m.group(1)), int(ext_m.group(2))
                            if cy > 0:
                                aspect_ratio = cx / cy

            if aspect_ratio is None:
                # Fallback: standard widescreen slide 13.33" × 7.5", header 85% × 17.4%
                aspect_ratio = (13.33 * 0.85) / (7.5 * 0.174)

            img = _PILImage.open(header_path)
            img_w, img_h = img.size
            img_ratio = img_w / img_h

            # Compute cover-scale then apply focal-point crop + zoom (same logic as gallery)
            zoom_clamped = max(1.0, zoom)
            scale_cover  = max(aspect_ratio / img_ratio, 1.0 / (img_ratio / aspect_ratio + 1e-9))
            # Actually: cover-scale to fit aspect_ratio
            if img_ratio > aspect_ratio:
                # Wider — constrain by height: scale = 1 (height fills)
                sc_w_cover = img_w * (1.0 / img_h)   # relative
                # Visible region in original-image coords
                vis_w = img_h * aspect_ratio / zoom_clamped
                vis_h = img_h / zoom_clamped
            else:
                # Taller — constrain by width
                vis_w = img_w / zoom_clamped
                vis_h = img_w / aspect_ratio / zoom_clamped

            excess_x = max(0.0, img_w - vis_w)
            excess_y = max(0.0, img_h - vis_h)
            left = max(0, min(int(focus_x * excess_x), img_w - max(1, int(vis_w))))
            top  = max(0, min(int(focus_y * excess_y), img_h - max(1, int(vis_h))))

            if abs(img_ratio - aspect_ratio) > 0.01 or zoom_clamped > 1.0:
                img = img.crop((left, top, left + max(1, int(vis_w)), top + max(1, int(vis_h))))

                # Save to a temp file then use that as the source
                cropped_tmp = header_path + "_cropped_tmp" + os.path.splitext(header_path)[1]
                save_fmt = "JPEG" if os.path.splitext(header_path)[1].lower() in (".jpg", ".jpeg") else "PNG"
                save_kw: dict = {}
                if save_fmt == "JPEG":
                    save_kw["quality"] = 92
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGB")
                img.save(cropped_tmp, format=save_fmt, **save_kw)
                target_image_path = cropped_tmp
        except Exception:
            pass  # never crash over cropping — fall back to original

    src_ext  = os.path.splitext(header_path)[1].lower()
    dest_ext = os.path.splitext(existing_media_path)[1].lower()

    try:
        if src_ext == dest_ext:
            # Same extension — just overwrite in place
            shutil.copy2(target_image_path, existing_media_path)
        else:
            # Different extension — copy to new filename and update rels target
            base_name      = os.path.splitext(os.path.basename(existing_media_path))[0]
            new_filename   = base_name + src_ext
            new_media_path = os.path.join(media_dir, new_filename)
            shutil.copy2(target_image_path, new_media_path)

            new_rel_target = f"../media/{new_filename}"
            master_rels = master_rels.replace(rel_target, new_rel_target)
            with open(master_rels_path, "w", encoding="utf-8") as f:
                f.write(master_rels)
    finally:
        # Clean up temp cropped file if we made one
        if target_image_path != header_path and os.path.isfile(target_image_path):
            try:
                os.unlink(target_image_path)
            except OSError:
                pass


def generate(
    manifest: ReportManifest,
    template_path: str,
    output_path: str,
    progress_callback=None,
    cover_photo_path: str | None = None,
    title_png_path: str | None = None,
    master_header_path: str | None = None,
    master_header_focus_x: float = 0.5,
    master_header_focus_y: float = 0.5,
    master_header_zoom: float = 1.0,
) -> str:
    """
    Generate a partner report PPTX.

    Args:
        manifest:               Populated ReportManifest.
        template_path:          Path to the previous event PPTX used as base template.
        output_path:            Where to write the generated PPTX.
        progress_callback:      Optional callable(step: str, pct: int).
        cover_photo_path:       Optional path to new cover background photo.
        title_png_path:         Optional path to event title PNG overlay.
        master_header_path:     Optional path to new slide master header image.
        master_header_focus_x:  Horizontal focal point for master header crop (0.0–1.0).
        master_header_focus_y:  Vertical focal point for master header crop (0.0–1.0).
        master_header_zoom:     Zoom level for master header crop (1.0 = cover fit).

    Returns:
        Absolute path to the generated PPTX.
    """
    def _progress(msg: str, pct: int) -> None:
        if progress_callback:
            progress_callback(msg, pct)
        else:
            print(f"[{pct:3d}%] {msg}", flush=True)

    # ── 1. Workspace ─────────────────────────────────────────────────────
    _progress("Setting up workspace…", 2)
    work_dir = tempfile.mkdtemp(prefix="ten_report_")
    unpacked = os.path.join(work_dir, "unpacked")

    try:
        # ── 2. Unpack template ───────────────────────────────────────────
        _progress("Unpacking template…", 5)
        unpack(template_path, unpacked)

        # ── 3. Warm slide XML cache ──────────────────────────────────────
        # Pre-read all slide XMLs once into memory.  All slide editors and
        # detection calls share this cache, eliminating repeated disk reads.
        warm_slide_cache(unpacked)

        # ── 4. Slide master header ───────────────────────────────────────
        if master_header_path:
            _progress("Replacing slide master header…", 8)
            _replace_master_header(
                unpacked, master_header_path,
                focus_x=master_header_focus_x,
                focus_y=master_header_focus_y,
                zoom=master_header_zoom,
            )

        # ── 5. Cover slide (independent of the parallel batch) ───────────
        if cover_photo_path or title_png_path:
            _progress("Building cover slide…", 10)
            try:
                cover.edit(unpacked, cover_photo_path, title_png_path,
                           partner_name=manifest.partner_name)
            except FileNotFoundError as e:
                print(f"[warn] Cover slide missing, skipping: {e}", file=sys.stderr, flush=True)

        # ── 6. Edit content slides in parallel ───────────────────────────
        # Each editor writes to completely different slide files, so they can
        # run concurrently without any locking.  Errors propagate after all
        # editors finish so no slide silently disappears.
        _progress("Editing slides (parallel)…", 15)
        pres_path = os.path.join(unpacked, "ppt", "presentation.xml")

        _editor_errors: list[BaseException] = []
        _del_digital: list[str] = []
        _del_gallery: list[str] = []
        _del_guests:  list[str] = []

        _progress_lock = threading.Lock()
        _completed = [0]
        _EDITOR_COUNT = 6   # intro, overview, digital, testimonials, gallery, content, guests

        def _tick(label: str) -> None:
            with _progress_lock:
                _completed[0] += 1
                pct = 15 + int(_completed[0] / _EDITOR_COUNT * 55)
                _progress(label, min(pct, 70))

        def _run_intro() -> None:
            intro.edit(unpacked, manifest)
            _tick("Introduction written…")

        def _run_overview() -> None:
            overview.edit(unpacked, manifest)
            _tick("Event overview written…")

        def _run_digital() -> tuple[list[str], list[str]]:
            result = digital.edit(unpacked, manifest, pres_path)
            _tick("Digital campaign tables built…")
            return result

        def _run_testimonials() -> None:
            testimonials.edit(unpacked, manifest)
            _tick("Testimonials written…")

        def _run_gallery() -> tuple[list[str], list[str]]:
            result = gallery.edit(unpacked, manifest)
            _tick("Gallery photos injected…")
            return result

        def _run_content() -> None:
            content.edit(unpacked, manifest)
            _tick("Content creation slide written…")

        def _run_guests() -> tuple[list[str], list[str]]:
            result = guests.edit(unpacked, manifest)
            _tick("Guest data tables built…")
            return result

        with ThreadPoolExecutor(max_workers=7) as pool:
            f_intro        = pool.submit(_run_intro)
            f_overview     = pool.submit(_run_overview)
            f_digital      = pool.submit(_run_digital)
            f_testimonials = pool.submit(_run_testimonials)
            f_gallery      = pool.submit(_run_gallery)
            f_content      = pool.submit(_run_content)
            f_guests       = pool.submit(_run_guests)

            # Collect results — re-raise first editor error if any
            for fut in (f_intro, f_overview, f_digital,
                        f_testimonials, f_gallery, f_content, f_guests):
                try:
                    result = fut.result()
                    if fut is f_digital:
                        _, _del_digital = result
                    elif fut is f_gallery:
                        _, _del_gallery = result
                    elif fut is f_guests:
                        _, _del_guests = result
                except Exception as exc:
                    _editor_errors.append(exc)

        # Release cache memory before next phase
        clear_slide_cache(unpacked)

        if _editor_errors:
            raise _editor_errors[0]   # surface first failure

        # ── 7. Remove unused slides from presentation + disk ─────────────
        _progress("Removing unused slides…", 78)
        _delete_slides_from_presentation(
            unpacked, _del_digital + _del_gallery + _del_guests
        )

        # ── 8. Compress images (220 DPI + delete cropped areas) ─────────
        # Gallery photos are already at display size (pre-processed by gallery.py).
        # This step handles template images (cover, testimonial backgrounds, etc.).
        _progress("Compressing images (220 PPI)…", 84)
        _compress_images(unpacked)

        # ── 9. Pack ──────────────────────────────────────────────────────
        _progress("Packing PPTX…", 92)
        pack(unpacked, output_path)

        _progress("Done.", 100)
        return os.path.abspath(output_path)

    finally:
        clear_slide_cache(unpacked)   # safety cleanup if we exited early
        shutil.rmtree(work_dir, ignore_errors=True)


def generate_from_json(
    json_path: str,
    template_path: str,
    output_path: str,
    cover_photo_path: str | None = None,
    title_png_path: str | None = None,
    master_header_path: str | None = None,
    master_header_focus_x: float = 0.5,
    master_header_focus_y: float = 0.5,
    master_header_zoom: float = 1.0,
) -> str:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    m = manifest_from_dict(data)

    if not m.output_filename:
        safe_event   = re.sub(r"[^\w\s-]", "", m.event_name).strip()
        safe_partner = re.sub(r"[^\w\s-]", "", m.partner_name).strip()
        m.output_filename = f"{safe_event} - Report for {safe_partner}.pptx"

    if not output_path:
        output_path = os.path.join(os.path.dirname(json_path), m.output_filename)

    return generate(
        m, template_path, output_path,
        cover_photo_path=cover_photo_path,
        title_png_path=title_png_path,
        master_header_path=master_header_path,
        master_header_focus_x=master_header_focus_x,
        master_header_focus_y=master_header_focus_y,
        master_header_zoom=master_header_zoom,
    )


# ── CLI entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a TEN partner report PPTX")
    parser.add_argument("--manifest",       required=True, help="Path to manifest JSON")
    parser.add_argument("--template",       required=True, help="Path to previous event PPTX (template)")
    parser.add_argument("--output",         default="",    help="Output .pptx path")
    parser.add_argument("--cover-photo",    default="",    help="Path to new cover background photo")
    parser.add_argument("--title-png",      default="",    help="Path to event title PNG overlay")
    parser.add_argument("--master-header",          default="",    help="Path to new slide master header image")
    parser.add_argument("--master-header-focus-x",  default="0.5", help="Horizontal focal point 0.0–1.0 (default 0.5)")
    parser.add_argument("--master-header-focus-y",  default="0.5", help="Vertical focal point 0.0–1.0 (default 0.5)")
    parser.add_argument("--master-header-zoom",     default="1.0", help="Zoom level for master header 1.0–4.0 (default 1.0)")
    args = parser.parse_args()

    try:
        out = generate_from_json(
            args.manifest,
            args.template,
            args.output,
            cover_photo_path=args.cover_photo or None,
            title_png_path=args.title_png or None,
            master_header_path=args.master_header or None,
            master_header_focus_x=float(args.master_header_focus_x),
            master_header_focus_y=float(args.master_header_focus_y),
            master_header_zoom=float(args.master_header_zoom),
        )
        print(f"OUTPUT:{out}", flush=True)
    except Exception as exc:
        import traceback
        # Print the full traceback to stderr so the Electron main process can surface it
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        sys.exit(1)
