"""
Low-level XML helpers for building guide slide XML.

All measurements are in EMU (English Metric Units).
  1 inch = 914 400 EMU
  Slide:  9" × 16"  =  8 229 600 × 14 630 400 EMU
"""
from __future__ import annotations
import os
import re
import shutil

SLIDE_W = 8_229_600
SLIDE_H = 14_630_400

# ── Namespace declarations used on <p:sld> ────────────────────────────────────

NS_DECL = (
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
)

# ── Text escaping ─────────────────────────────────────────────────────────────

def esc(text: str) -> str:
    """XML-escape a plain string for embedding in <a:t>."""
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

# ── Run / paragraph builders ──────────────────────────────────────────────────

def run(text: str, *, font: str = "Inter", size_pt: int = 11,
        bold: bool = False, color_hex: str = "FFFFFF",
        spacing_pct: int | None = None) -> str:
    """Return a single <a:r> run."""
    sz    = size_pt * 100
    b_    = ' b="1"' if bold else ''
    spc_  = f'<a:spcPct val="{spacing_pct * 1000}"/>' if spacing_pct is not None else ""
    kern_ = ' kern="0"' if not bold else ' kern="700"'
    return (
        f'<a:r>'
        f'<a:rPr lang="en-US" sz="{sz}"{b_}{kern_} dirty="0">'
        f'<a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill>'
        f'<a:latin typeface="{font}" pitchFamily="2" charset="77"/>'
        f'</a:rPr>'
        f'<a:t>{esc(text)}</a:t>'
        f'</a:r>'
    )


def para(runs: str, *, align: str = "l", spacing_before: int = 0,
         spacing_after: int = 0, line_pct: int | None = None) -> str:
    """Return a <a:p> paragraph wrapping the given run XML."""
    spc_b = f'<a:spcBef><a:spcPts val="{spacing_before}"/></a:spcBef>' if spacing_before else ""
    spc_a = f'<a:spcAft><a:spcPts val="{spacing_after}"/></a:spcAft>' if spacing_after else ""
    line  = (f'<a:lnSpc><a:spcPct val="{line_pct * 1000}"/></a:lnSpc>' if line_pct else "")
    return (
        f'<a:p>'
        f'<a:pPr algn="{align}">{spc_b}{spc_a}{line}</a:pPr>'
        f'{runs}'
        f'</a:p>'
    )


def empty_para() -> str:
    return "<a:p><a:endParaRPr lang=\"en-US\" dirty=\"0\"/></a:p>"


# ── Shape builders ────────────────────────────────────────────────────────────

def textbox(shape_id: int, name: str,
            x: int, y: int, w: int, h: int,
            body: str, *,
            wrap: str = "square",
            anchor: str = "t",
            no_autofit: bool = False) -> str:
    """Return a plain text-box <p:sp>."""
    auto = "" if no_autofit else "<a:spAutoFit/>"
    return f"""\
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="{shape_id}" name="{name}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="{wrap}" rtlCol="0" anchor="{anchor}">{auto}</a:bodyPr>
    <a:lstStyle/>
    {body}
  </p:txBody>
</p:sp>"""


def rect(shape_id: int, name: str,
         x: int, y: int, w: int, h: int,
         fill_xml: str, *,
         rot: int = 0) -> str:
    """Return a solid or gradient rectangle <p:sp>."""
    rot_attr = f' rot="{rot}"' if rot else ""
    return f"""\
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="{shape_id}" name="{name}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm{rot_attr}><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    {fill_xml}
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>"""


def line_shape(shape_id: int, name: str,
               x: int, y: int, w: int, *,
               color_hex: str = "FFFFFF", alpha: int = 40_000) -> str:
    """Return a thin horizontal connector line."""
    return f"""\
<p:cxnSp>
  <p:nvCxnSpPr>
    <p:cNvPr id="{shape_id}" name="{name}"/>
    <p:cNvCxnSpPr/>
    <p:nvPr/>
  </p:nvCxnSpPr>
  <p:spPr>
    <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="0"/></a:xfrm>
    <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
  </p:spPr>
  <p:style>
    <a:lnRef idx="1">
      <a:srgbClr val="{color_hex}"><a:alpha val="{alpha}"/></a:srgbClr>
    </a:lnRef>
    <a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef>
    <a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>
    <a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>
  </p:style>
</p:cxnSp>"""


def picture(shape_id: int, name: str,
            rid: str,
            x: int, y: int, w: int, h: int) -> str:
    """Return a <p:pic> image shape."""
    return f"""\
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="{shape_id}" name="{name}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="{rid}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>"""


# ── Gradient fills (reusable XML snippets) ────────────────────────────────────

def dark_top_gradient() -> str:
    """Dark overlay fading from bottom of slide, used for text readability."""
    return """\
<a:gradFill>
  <a:gsLst>
    <a:gs pos="18000"><a:srgbClr val="092736"><a:alpha val="85098"/></a:srgbClr></a:gs>
    <a:gs pos="100000"><a:schemeClr val="tx1"><a:alpha val="0"/></a:schemeClr></a:gs>
  </a:gsLst>
  <a:lin ang="5400000" scaled="1"/>
</a:gradFill>"""


def dark_bottom_gradient() -> str:
    return """\
<a:gradFill>
  <a:gsLst>
    <a:gs pos="0"><a:schemeClr val="tx1"><a:alpha val="70000"/></a:schemeClr></a:gs>
    <a:gs pos="100000"><a:schemeClr val="tx1"><a:alpha val="0"/></a:schemeClr></a:gs>
  </a:gsLst>
  <a:lin ang="5400000" scaled="1"/>
</a:gradFill>"""


def solid_fill(color_hex: str, alpha: int = 100_000) -> str:
    alpha_xml = f"<a:alpha val=\"{alpha}\"/>" if alpha < 100_000 else ""
    return f"<a:solidFill><a:srgbClr val=\"{color_hex}\">{alpha_xml}</a:srgbClr></a:solidFill>"


# ── Slide wrapper ─────────────────────────────────────────────────────────────

def slide_xml(shapes: str) -> str:
    """Wrap shapes XML inside a complete <p:sld> document."""
    return f"""\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld {NS_DECL}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      {shapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""


def slide_rels(image_rids: dict[str, str]) -> str:
    """
    Build ppt/slides/_rels/slideN.xml.rels.
    image_rids maps rId → relative target, e.g. {"rId2": "../media/image1.png"}
    """
    entries = []
    for rid, target in image_rids.items():
        ext = os.path.splitext(target)[1].lower()
        if ext in (".png",):
            mime = "image/png"
        elif ext in (".svg",):
            mime = "image/svg+xml"
        else:
            mime = "image/jpeg"
        entries.append(
            f'  <Relationship Id="{rid}"'
            f' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"'
            f' Target="{target}"/>'
        )
    body = "\n".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        f'{body}\n'
        '</Relationships>'
    )


# ── Shared layout constants: footer bar positions ─────────────────────────────

# Footer bar sits at y = 14 117 052  (height 184 666)
FOOTER_Y       = 14_117_052
FOOTER_H       = 184_666
FOOTER_LINE_Y  = 14_209_385   # decorative lines sit slightly below

# TEN Logo in footer (left edge)
TEN_LOGO_X = 455_544
TEN_LOGO_Y = 14_140_603
TEN_LOGO_W = 397_779
TEN_LOGO_H = 137_565

# Slide Number (far right of footer)
SLIDE_NUM_X = 7_661_044
SLIDE_NUM_W = 104_196
SLIDE_NUM_H = 184_666


def footer_bar(shape_id_start: int,
               header_text: str,
               slide_num: int,
               ten_logo_rid: str | None,
               *,
               show_lines: bool = True) -> tuple[str, int]:
    """
    Build the footer bar shapes common to all content slides.
    Returns (shapes_xml, next_shape_id).

    Elements:
      • TEN Logo (if rid provided)
      • Left decorative line
      • "Header Text"  e.g. "TGT 2026 PARTNER GUIDE – COTA"
      • Right decorative line
      • Slide Number field
    """
    sid = shape_id_start
    parts: list[str] = []

    # Estimate header text width: ~75 000 EMU per character at the small font size
    text_w = max(1_500_000, len(header_text) * 72_000)

    # Center the header text on the slide
    header_x = (SLIDE_W - text_w) // 2
    header_x = max(header_x, 1_200_000)   # clamp left

    left_line_x  = TEN_LOGO_X + TEN_LOGO_W + 100_000
    left_line_w  = max(0, header_x - left_line_x - 100_000)
    right_line_x = header_x + text_w + 100_000
    right_line_w = max(0, SLIDE_NUM_X - right_line_x - 50_000)

    # TEN Logo
    if ten_logo_rid:
        parts.append(picture(sid, "TEN Logo", ten_logo_rid,
                             TEN_LOGO_X, TEN_LOGO_Y, TEN_LOGO_W, TEN_LOGO_H))
        sid += 1

    # Left line
    if show_lines and left_line_w > 50_000:
        parts.append(line_shape(sid, "Left Line", left_line_x, FOOTER_LINE_Y, left_line_w))
        sid += 1

    # Header text
    header_body = para(
        run(header_text, font="Inter Medium", size_pt=7, bold=True,
            color_hex="FFFFFF"),
        align="ctr"
    )
    parts.append(textbox(sid, "Header Text",
                         header_x, FOOTER_Y, text_w, FOOTER_H,
                         header_body, no_autofit=True))
    sid += 1

    # Right line
    if show_lines and right_line_w > 50_000:
        parts.append(line_shape(sid, "Right Line", right_line_x, FOOTER_LINE_Y, right_line_w))
        sid += 1

    # Slide Number (as a plain text field approximation)
    num_body = para(
        run(str(slide_num), font="Molde Black", size_pt=7, bold=True,
            color_hex="FFFFFF"),
        align="ctr"
    )
    parts.append(textbox(sid, "Slide Number",
                         SLIDE_NUM_X, FOOTER_Y, SLIDE_NUM_W, SLIDE_NUM_H,
                         num_body, no_autofit=True))
    sid += 1

    return "\n".join(parts), sid


# ── Media helpers ─────────────────────────────────────────────────────────────

def copy_media(src_path: str, media_dir: str, target_name: str) -> str:
    """
    Copy an image to the PPTX media directory.
    Returns the relative path usable in slide rels: "../media/filename".
    """
    os.makedirs(media_dir, exist_ok=True)
    dst = os.path.join(media_dir, target_name)
    shutil.copy2(src_path, dst)
    return f"../media/{target_name}"
