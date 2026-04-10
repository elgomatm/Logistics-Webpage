"""
Safe XML helpers for PPTX slide editing.

Rules:
- ALWAYS use defusedxml, never xml.etree.ElementTree (corrupts namespaces)
- Never touch Picture Placeholder 19 (idx=4294967295) — master-inherited frosted glass
- When replacing run text, preserve ALL <a:rPr> attributes
- Smart quotes must be XML entities &#x201C; &#x201D;
"""
from __future__ import annotations
import re
import os
import copy


# ── Namespace map ──────────────────────────────────────────────────────────
NS = {
    "a":   "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p":   "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r":   "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a14": "http://schemas.microsoft.com/office/drawing/2010/main",
    "a16": "http://schemas.microsoft.com/office/drawing/2014/main",
}

# ── Constants ─────────────────────────────────────────────────────────────
MASTER_PH_IDX = "4294967295"   # Picture Placeholder 19 — NEVER touch


# ── Low-level text replace ─────────────────────────────────────────────────

def replace_run_text(xml: str, old: str, new: str) -> str:
    """
    Replace every occurrence of `old` inside <a:t>…</a:t> with `new`.
    Handles partial runs by working on the raw string (safer than DOM
    for complex multi-run shapes where defusedxml re-serialisation could
    reorder attributes).
    """
    # Escape entities in new so we don't inject raw XML
    new_escaped = (new
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&#x22;")
    )
    # Replace inside <a:t>…</a:t> only
    def _replace(m: re.Match) -> str:
        inner = m.group(1).replace(old, new_escaped)
        return f"<a:t>{inner}</a:t>"

    return re.sub(r"<a:t>([^<]*)</a:t>", _replace, xml)


def replace_first_run_text(xml: str, old: str, new: str) -> str:
    """Replace only the FIRST occurrence of old in <a:t> tags."""
    new_escaped = (new
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    replaced = [False]

    def _replace(m: re.Match) -> str:
        if replaced[0]:
            return m.group(0)
        inner = m.group(1)
        if old in inner:
            replaced[0] = True
            return f"<a:t>{inner.replace(old, new_escaped, 1)}</a:t>"
        return m.group(0)

    return re.sub(r"<a:t>([^<]*)</a:t>", _replace, xml)


# ── Shape finder ──────────────────────────────────────────────────────────

def find_shape_by_name(xml: str, name: str) -> tuple[str, int, int] | None:
    """
    Return (shape_xml, start_idx, end_idx) for the first <p:sp> whose
    cNvPr name attribute matches `name`, or None.
    """
    # Match <p:sp> blocks
    for m in re.finditer(r"<p:sp>.*?</p:sp>", xml, re.DOTALL):
        if f'name="{name}"' in m.group(0):
            return m.group(0), m.start(), m.end()
    return None


def replace_shape(xml: str, name: str, new_shape_xml: str) -> str:
    """Replace the entire <p:sp> block whose cNvPr name matches `name`."""
    result = find_shape_by_name(xml, name)
    if result is None:
        return xml
    _, start, end = result
    return xml[:start] + new_shape_xml + xml[end:]


def get_shape_text(xml: str, name: str) -> str | None:
    """Extract all text from a named shape, concatenated."""
    result = find_shape_by_name(xml, name)
    if result is None:
        return None
    texts = re.findall(r"<a:t>([^<]*)</a:t>", result[0])
    return "".join(texts)


# ── Paragraph builder ─────────────────────────────────────────────────────

def build_paragraph(text: str, sz: int, font: str = "Futura Medium",
                    bold: bool = False, color: str | None = None,
                    align: str = "l", spacing_pts: int = 0) -> str:
    """
    Build a single <a:p> XML string.
    sz is in hundredths of a point (e.g. 1200 = 12pt).
    """
    b_attr   = ' b="1"' if bold else ' b="0"'
    lang_attr = ' lang="en-US"'
    color_xml = ""
    if color:
        color_xml = f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
    spc_xml = ""
    if spacing_pts:
        spc_xml = f'<a:lnSpc><a:spcPts val="{spacing_pts * 100}"/></a:lnSpc>'

    safe = (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\u201c", "&#x201C;")
        .replace("\u201d", "&#x201D;")
        .replace("\u2018", "&#x2018;")
        .replace("\u2019", "&#x2019;")
        .replace("\u2014", "&#x2014;")
        .replace("\u00a0", "&#xA0;")
    )

    return (
        f'<a:p>'
        f'<a:pPr algn="{align}">{spc_xml}</a:pPr>'
        f'<a:r>'
        f'<a:rPr{lang_attr} sz="{sz}"{b_attr} dirty="0">'
        f'{color_xml}'
        f'<a:latin typeface="{font}"/>'
        f'</a:rPr>'
        f'<a:t>{safe}</a:t>'
        f'</a:r>'
        f'</a:p>'
    )


def build_empty_paragraph() -> str:
    return '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>'


# ── txBody replacer ───────────────────────────────────────────────────────

def replace_txbody_content(shape_xml: str, new_paragraphs_xml: str) -> str:
    """
    Replace the paragraph content inside <p:txBody>…</p:txBody>,
    preserving bodyPr and lstStyle.

    In PPTX shapes the text body uses the <p:txBody> namespace tag (not <a:txBody>).
    """
    # Try p:txBody first (shapes), then a:txBody (table cells, etc.)
    for tag in ("p:txBody", "a:txBody"):
        open_tag  = f"<{tag}>"
        close_tag = f"</{tag}>"

        header_m = re.search(
            rf"(<{re.escape(tag)}>.*?<a:lstStyle/>)", shape_xml, re.DOTALL
        )
        if not header_m:
            header_m = re.search(
                rf"(<{re.escape(tag)}>.*?(?:<a:bodyPr[^/]*/>\s*|<a:bodyPr/>))",
                shape_xml, re.DOTALL
            )
        if not header_m:
            continue

        return re.sub(
            rf"(<{re.escape(tag)}>.*?<a:lstStyle/>)(.*?)(</{re.escape(tag)}>)",
            lambda m: m.group(1) + new_paragraphs_xml + m.group(3),
            shape_xml, count=1, flags=re.DOTALL
        )

    return shape_xml  # unchanged if neither tag found


# ── Footer / slide number helpers ─────────────────────────────────────────

def set_footer_text(xml: str, text: str) -> str:
    """Replace text in all Footer Placeholder shapes."""
    safe = text.replace("&", "&amp;")
    # Match footer placeholder and replace the <a:t> text inside it
    def _repl(m: re.Match) -> str:
        block = m.group(0)
        # Replace <a:t>...</a:t> content inside
        block = re.sub(r"<a:t>[^<]*</a:t>", f"<a:t>{safe}</a:t>", block, count=1)
        return block

    return re.sub(
        r"<p:sp>.*?Footer Placeholder.*?</p:sp>",
        _repl, xml, flags=re.DOTALL
    )


# ── Relationship helpers ───────────────────────────────────────────────────

def get_rId_for_placeholder(slide_xml: str, ph_idx: str) -> str | None:
    """
    Given a placeholder idx, return the r:embed value from its blipFill.
    Returns None for the master-inherited placeholder.
    """
    if ph_idx == MASTER_PH_IDX:
        return None

    # Find <p:pic> blocks
    for pic_m in re.finditer(r"<p:pic>.*?</p:pic>", slide_xml, re.DOTALL):
        pic = pic_m.group(0)
        idx_m = re.search(r'idx="(\d+)"', pic)
        if idx_m and idx_m.group(1) == ph_idx:
            embed_m = re.search(r'r:embed="(rId\d+)"', pic)
            if embed_m:
                return embed_m.group(1)
    return None


def update_rel_target(rels_xml: str, rId: str, new_target: str) -> str:
    """Update the Target of a specific relationship by Id."""
    return re.sub(
        rf'(<Relationship Id="{re.escape(rId)}"[^>]+Target=")[^"]+(")',
        rf"\g<1>{new_target}\g<2>",
        rels_xml
    )


def add_image_rel(rels_xml: str, rId: str, media_filename: str) -> str:
    """Add a new image relationship before </Relationships>."""
    rel = (
        f'<Relationship Id="{rId}" '
        f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        f'Target="../media/{media_filename}"/>'
    )
    return rels_xml.replace("</Relationships>", f"  {rel}\n</Relationships>")


def next_rId(rels_xml: str) -> str:
    """Return the next available rId (rId<max+1>)."""
    ids = re.findall(r'Id="rId(\d+)"', rels_xml)
    if not ids:
        return "rId2"
    return f"rId{max(int(i) for i in ids) + 1}"


# ── File I/O ──────────────────────────────────────────────────────────────

def slide_exists(unpacked_dir: str, slide_name: str) -> bool:
    """Return True if the slide XML file exists in the unpacked template."""
    return os.path.isfile(os.path.join(unpacked_dir, "ppt", "slides", slide_name))


# ── Slide XML cache ───────────────────────────────────────────────────────────
#
# Populated once after unpacking (warm_slide_cache), then used read-only during
# all slide-editing and detection calls.  This converts N×8 disk reads (each
# editor scanning every slide) into a single up-front N reads.
#
# NOT thread-safe for writes; always populate before spawning worker threads.

_slide_xml_cache: dict[str, dict[str, str]] = {}   # unpacked_dir → {slide_name → xml}


def warm_slide_cache(unpacked_dir: str) -> None:
    """Pre-read all slide XMLs into memory.  Call once right after unpack()."""
    cache: dict[str, str] = {}
    for name in _all_slide_names(unpacked_dir):
        path = os.path.join(unpacked_dir, "ppt", "slides", name)
        try:
            with open(path, encoding="utf-8") as fh:
                cache[name] = fh.read()
        except OSError:
            pass
    _slide_xml_cache[unpacked_dir] = cache


def clear_slide_cache(unpacked_dir: str) -> None:
    """Release the in-memory cache for unpacked_dir (free memory)."""
    _slide_xml_cache.pop(unpacked_dir, None)


# ── Content-based slide discovery ────────────────────────────────────────────

def _all_slide_names(unpacked_dir: str) -> list[str]:
    """Return all slide XML filenames in the template, sorted numerically."""
    slides_dir = os.path.join(unpacked_dir, "ppt", "slides")
    names = [
        f for f in os.listdir(slides_dir)
        if f.startswith("slide") and f.endswith(".xml")
        and not f.startswith("slideLayout")
        and not f.startswith("slideMaster")
    ]

    def _num(n: str) -> int:
        m = re.search(r"\d+", n)
        return int(m.group()) if m else 0

    return sorted(names, key=_num)


def find_slide_by_content(unpacked_dir: str, *patterns: str) -> str | None:
    """
    Return the filename of the first slide (in numeric order) whose raw XML
    contains ALL of the given substrings.

    Uses the in-memory cache populated by warm_slide_cache() when available,
    falling back to disk reads.  Returns None if no slide matches.
    """
    cache = _slide_xml_cache.get(unpacked_dir, {})
    for name in _all_slide_names(unpacked_dir):
        try:
            xml = cache[name] if name in cache else read_slide(unpacked_dir, name)
        except OSError:
            continue
        if all(p in xml for p in patterns):
            return name
    return None


def find_slides_by_content(unpacked_dir: str, *patterns: str) -> list[str]:
    """
    Return filenames of ALL slides (in numeric order) whose raw XML contains
    ALL of the given substrings.

    Uses the in-memory cache populated by warm_slide_cache() when available.
    """
    cache = _slide_xml_cache.get(unpacked_dir, {})
    result: list[str] = []
    for name in _all_slide_names(unpacked_dir):
        try:
            xml = cache[name] if name in cache else read_slide(unpacked_dir, name)
        except OSError:
            continue
        if all(p in xml for p in patterns):
            result.append(name)
    return result


def find_slide_by_layout(unpacked_dir: str, layout_name: str) -> str | None:
    """
    Return the first slide (in numeric order) whose rels file references the
    given slide layout filename fragment (e.g. 'slideLayout4').

    This is useful as a fallback when shape-name-based detection fails — slide
    layouts are assigned per-slide-type and are preserved even after PowerPoint
    renumbers the presentation.
    """
    for name in _all_slide_names(unpacked_dir):
        rels_path = os.path.join(
            unpacked_dir, "ppt", "slides", "_rels", f"{name}.rels"
        )
        try:
            with open(rels_path, encoding="utf-8") as f:
                rels = f.read()
        except OSError:
            continue
        if layout_name in rels:
            return name
    return None


def find_slides_by_layout(unpacked_dir: str, layout_name: str) -> list[str]:
    """
    Return all slide filenames (in numeric order) whose rels file references
    the given slide layout filename fragment.
    """
    result: list[str] = []
    for name in _all_slide_names(unpacked_dir):
        rels_path = os.path.join(
            unpacked_dir, "ppt", "slides", "_rels", f"{name}.rels"
        )
        try:
            with open(rels_path, encoding="utf-8") as f:
                rels = f.read()
        except OSError:
            continue
        if layout_name in rels:
            result.append(name)
    return result


def read_slide(unpacked_dir: str, slide_name: str) -> str:
    path = os.path.join(unpacked_dir, "ppt", "slides", slide_name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_slide(unpacked_dir: str, slide_name: str, xml: str) -> None:
    path = os.path.join(unpacked_dir, "ppt", "slides", slide_name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)


def read_rels(unpacked_dir: str, slide_name: str) -> str:
    path = os.path.join(unpacked_dir, "ppt", "slides", "_rels",
                        slide_name + ".rels")
    if not os.path.isfile(path):
        return '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_rels(unpacked_dir: str, slide_name: str, xml: str) -> None:
    path = os.path.join(unpacked_dir, "ppt", "slides", "_rels",
                        slide_name + ".rels")
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
