"""
PPTX skeleton builder.

Writes the boilerplate OOXML files that make a valid PPTX from scratch —
no template file required. All content slides are added separately.

Slide dimensions: 9" × 16"  (8 229 600 × 14 630 400 EMU)
"""
from __future__ import annotations
import os
import re

# ── Constants ─────────────────────────────────────────────────────────────────

SLIDE_W = 8_229_600   # 9 inches in EMU
SLIDE_H = 14_630_400  # 16 inches in EMU

# OOXML relationship type prefixes
_OFF = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"

# ── Static XML blobs ──────────────────────────────────────────────────────────

_RELS_RELS = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="{off}/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>""".replace("{off}", _PKG)


_APP_XML = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>TEN Document Studio</Application>
  <Slides>0</Slides>
  <PresentationFormat>Custom</PresentationFormat>
</Properties>"""


_CORE_XML = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>TEN Document Studio</dc:creator>
  <cp:lastModifiedBy>TEN Document Studio</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>"""


_PRES_PROPS = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:extLst/>
</p:presentationPr>"""


_TABLE_STYLES = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>"""


_VIEW_PROPS = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>
  <p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="59" d="100"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
    <a:sy n="59" d="100" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
    </p:scale><p:origin x="-1482" y="-96"/></p:cViewPr></p:cSldViewPr>
  </p:slideViewPr>
</p:viewPr>"""


# Dark theme — dk1=black, lt1=white, accent colours matching TEN branding
_THEME_XML = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TEN Guide Theme">
  <a:themeElements>
    <a:clrScheme name="TEN">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="092736"/></a:dk2>
      <a:lt2><a:srgbClr val="E8E8E8"/></a:lt2>
      <a:accent1><a:srgbClr val="CC1C1C"/></a:accent1>
      <a:accent2><a:srgbClr val="E97132"/></a:accent2>
      <a:accent3><a:srgbClr val="196B24"/></a:accent3>
      <a:accent4><a:srgbClr val="0F9ED5"/></a:accent4>
      <a:accent5><a:srgbClr val="A02B93"/></a:accent5>
      <a:accent6><a:srgbClr val="4EA72E"/></a:accent6>
      <a:hlink><a:srgbClr val="467886"/></a:hlink>
      <a:folHlink><a:srgbClr val="96607D"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="TEN">
      <a:majorFont>
        <a:latin typeface="Molde SemiExpanded-Bold" panose="020B0604020202020204"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Inter" panose="020B0604020202020204"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst>
          <a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs>
          <a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="100000"/></a:schemeClr></a:gs>
        </a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill>
        <a:gradFill rotWithShape="1"><a:gsLst>
          <a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs>
          <a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="100000"/></a:schemeClr></a:gs>
        </a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst>
          <a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs>
          <a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs>
          <a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs>
        </a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>"""


# Minimal slide master — dark background, no shapes
_SLIDE_MASTER_XML = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="050F14"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
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
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"
    accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5"
    accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle>
      <a:lvl1pPr algn="ctr">
        <a:defRPr sz="4400" b="1" lang="en-US">
          <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
          <a:latin typeface="Molde SemiExpanded-Bold" pitchFamily="2" charset="77"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:titleStyle>
    <p:bodyStyle>
      <a:lvl1pPr>
        <a:defRPr sz="2000" lang="en-US">
          <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
          <a:latin typeface="Inter"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:bodyStyle>
    <p:otherStyle>
      <a:lvl1pPr>
        <a:defRPr lang="en-US">
          <a:solidFill><a:schemeClr val="lt1"/></a:solidFill>
          <a:latin typeface="Inter"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:otherStyle>
  </p:txStyles>
</p:sldMaster>"""


_SLIDE_MASTER_RELS = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
    Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
    Target="../theme/theme1.xml"/>
</Relationships>"""


# Blank slide layout — all slides share this single layout
_SLIDE_LAYOUT_XML = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  type="blank" preserve="1">
  <p:cSld name="Blank">
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
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>"""


_SLIDE_LAYOUT_RELS = """\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
    Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"""


# ── Dynamic XML builders ──────────────────────────────────────────────────────

def build_content_types(num_slides: int, media_extensions: set[str]) -> str:
    """Build [Content_Types].xml for num_slides slides."""
    off = "application/vnd.openxmlformats-officedocument"
    pml = f"{off}.presentationml"

    overrides = []
    overrides.append(f'  <Override PartName="/ppt/presentation.xml" ContentType="{pml}.presentation.main+xml"/>')
    overrides.append(f'  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="{pml}.slideMaster+xml"/>')
    overrides.append(f'  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="{pml}.slideLayout+xml"/>')
    overrides.append(f'  <Override PartName="/ppt/theme/theme1.xml" ContentType="{off}.theme+xml"/>')
    for i in range(1, num_slides + 1):
        overrides.append(f'  <Override PartName="/ppt/slides/slide{i}.xml" ContentType="{pml}.slide+xml"/>')

    ext_defaults = {
        "rels": "application/vnd.openxmlformats-package.relationships+xml",
        "xml":  "application/xml",
        "jpeg": "image/jpeg",
        "jpg":  "image/jpeg",
        "png":  "image/png",
        "gif":  "image/gif",
        "svg":  "image/svg+xml",
    }
    for ext in media_extensions:
        ext_lower = ext.lower().lstrip(".")
        if ext_lower not in ext_defaults:
            ext_defaults[ext_lower] = f"image/{ext_lower}"

    defaults = "\n".join(
        f'  <Default Extension="{ext}" ContentType="{ct}"/>'
        for ext, ct in ext_defaults.items()
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
        + defaults + "\n"
        + "\n".join(overrides) + "\n"
        "</Types>"
    )


def build_presentation_xml(num_slides: int) -> str:
    """Build ppt/presentation.xml for num_slides slides (rId2..rIdN+1)."""
    slide_ids = "\n".join(
        f'    <p:sldId id="{256 + i}" r:id="rId{i + 1}"/>'
        for i in range(num_slides)
    )
    return f"""\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
{slide_ids}
  </p:sldIdLst>
  <p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="en-US"/></a:defPPr>
  </p:defaultTextStyle>
</p:presentation>"""


def build_presentation_rels(num_slides: int) -> str:
    """Build ppt/_rels/presentation.xml.rels."""
    rels = [
        '  <Relationship Id="rId1"'
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"'
        ' Target="slideMasters/slideMaster1.xml"/>',
    ]
    for i in range(num_slides):
        rels.append(
            f'  <Relationship Id="rId{i + 2}"'
            ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"'
            f' Target="slides/slide{i + 1}.xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        + "\n".join(rels) + "\n"
        "</Relationships>"
    )


# ── Skeleton writer ───────────────────────────────────────────────────────────

def write_skeleton(dest_dir: str, num_slides: int, media_extensions: set[str]) -> None:
    """
    Write all boilerplate PPTX files to dest_dir.
    Does NOT write slide XMLs — those are added by the slide builders.
    """
    def _w(rel_path: str, content: str) -> None:
        full = os.path.join(dest_dir, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(content)

    _w("[Content_Types].xml",             build_content_types(num_slides, media_extensions))
    _w("_rels/.rels",                     _RELS_RELS)
    _w("docProps/app.xml",                _APP_XML)
    _w("docProps/core.xml",               _CORE_XML)
    _w("ppt/presentation.xml",            build_presentation_xml(num_slides))
    _w("ppt/_rels/presentation.xml.rels", build_presentation_rels(num_slides))
    _w("ppt/presProps.xml",               _PRES_PROPS)
    _w("ppt/tableStyles.xml",             _TABLE_STYLES)
    _w("ppt/viewProps.xml",               _VIEW_PROPS)
    _w("ppt/theme/theme1.xml",            _THEME_XML)
    _w("ppt/slideMasters/slideMaster1.xml",               _SLIDE_MASTER_XML)
    _w("ppt/slideMasters/_rels/slideMaster1.xml.rels",    _SLIDE_MASTER_RELS)
    _w("ppt/slideLayouts/slideLayout1.xml",               _SLIDE_LAYOUT_XML)
    _w("ppt/slideLayouts/_rels/slideLayout1.xml.rels",    _SLIDE_LAYOUT_RELS)

    # Ensure slide directories exist
    os.makedirs(os.path.join(dest_dir, "ppt", "slides", "_rels"), exist_ok=True)
    os.makedirs(os.path.join(dest_dir, "ppt", "media"), exist_ok=True)
