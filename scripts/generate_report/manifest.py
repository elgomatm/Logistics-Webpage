"""
Report manifest — the single data contract between the wizard UI and the generator.
All fields optional where the template has sensible defaults.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StatBlock:
    guests: str = "~500"
    cars: str = "70"
    car_value: str = "~$25M"
    content_units: str = "~100"


@dataclass
class MetaHeadline:
    total_views: str = ""
    total_reach: str = ""
    total_likes: str = ""
    total_shares: str = ""
    total_comments: str = ""
    total_saves: str = ""


@dataclass
class MetaPost:
    name: str = ""
    date: str = ""
    views: str = ""
    reach: str = ""
    likes: str = ""
    shares: str = ""
    comments: str = ""
    saves: str = ""


@dataclass
class Testimonial:
    quote: str = ""
    attribution: str = ""
    # Optional: local path to headshot image (will be auto-cropped to circle)
    photo_path: Optional[str] = None


@dataclass
class PhotoEntry:
    """One photo assigned to a gallery slot, with focal-point crop info."""
    path: str = ""          # Absolute server-side path to image file
    pos_x: float = 50.0    # Focal point X, 0–100 (50 = center)
    pos_y: float = 50.0    # Focal point Y, 0–100 (50 = center)
    zoom: float = 1.0       # Zoom level: 1.0 = cover fit, 2.0 = 2× zoom (max 4.0)


@dataclass
class GallerySlide:
    """One gallery slide: a title + exactly 7 photos (None = slot left empty)."""
    title: str = ""
    photos: list[Optional[PhotoEntry]] = field(default_factory=list)


@dataclass
class GuestRow:
    full_name: str = ""
    email: str = ""
    exotic_car: str = ""


@dataclass
class ReportManifest:
    # ── Identity ──────────────────────────────────────────────────────────
    event_name: str = ""          # e.g. "Lone Star Supercars 2026"
    event_abbrev: str = ""        # e.g. "LSS 2026" — used in slide footers
    partner_name: str = ""        # e.g. "COTA"
    partner_logo_path: Optional[str] = None   # Abs path to partner logo PNG
    include_guests: bool = True   # If False, guest slides are omitted

    # ── Intro (Slide 2) ───────────────────────────────────────────────────
    intro_body: str = ""          # Full letter body (multi-paragraph, \n\n separated)

    # ── Overview (Slide 3) ────────────────────────────────────────────────
    overview_text: str = ""       # OVERVIEW section paragraph
    retention_text: str = ""      # ATTENDEE RETENTION ANALYTICS paragraph
    stats: StatBlock = field(default_factory=StatBlock)

    # ── Digital Campaign (Slides 4–N) ────────────────────────────────────
    campaign_subtitle: str = ""   # e.g. "TEN'S LARGEST DIGITAL CAMPAIGN YET"
    campaign_description: str = ""
    meta_headline: MetaHeadline = field(default_factory=MetaHeadline)
    meta_posts: list[MetaPost] = field(default_factory=list)

    # ── Testimonials (Slide 11) ───────────────────────────────────────────
    # Exactly 5 testimonials to fill the 5 frosted-glass bars.
    # If fewer provided, remaining bars are hidden.
    testimonials: list[Testimonial] = field(default_factory=list)
    testimonials_bg_path: Optional[str] = None   # Abs path to bg photo for slide 11

    # ── Photo galleries ───────────────────────────────────────────────────
    # Up to 3 gallery slides (standard), each with a title + 7 photos.
    # Photos are in left-column-first order: L1, L2, L3, L4, R1, R2, R3.
    # None entries = slot left empty (shows slide background).
    gallery_slides: list[GallerySlide] = field(default_factory=list)

    # ── Content Creation (Slide 19) ───────────────────────────────────────
    photo_album_url: str = ""
    photo_album_label: str = ""   # Link button text
    social_content_count: str = "0"
    pixieset_url: str = ""        # "Please click here to view all units" link
    # Up to 10 Instagram preview images
    social_preview_paths: list[str] = field(default_factory=list)

    # ── Guest Data (Slides 20–N) ──────────────────────────────────────────
    guests: list[GuestRow] = field(default_factory=list)

    # ── Output ────────────────────────────────────────────────────────────
    output_filename: str = ""     # Defaults to "{event_name} - Report for {partner_name}.pptx"


# ── Deserialise from plain dict (comes from JSON API body) ────────────────

def _parse_photo_entry(p: object) -> "Optional[PhotoEntry]":
    if p is None:
        return None
    if isinstance(p, dict):
        return PhotoEntry(
            path=p.get("path", "") or "",
            pos_x=float(p.get("pos_x", 50)),
            pos_y=float(p.get("pos_y", 50)),
            zoom=float(p.get("zoom", 1.0)),
        )
    return None


def manifest_from_dict(d: dict) -> ReportManifest:
    stats = StatBlock(**d.get("stats", {})) if isinstance(d.get("stats"), dict) else StatBlock()
    mh    = MetaHeadline(**d.get("meta_headline", {})) if isinstance(d.get("meta_headline"), dict) else MetaHeadline()
    posts = [MetaPost(**p) for p in d.get("meta_posts", [])]
    tests = [Testimonial(**t) for t in d.get("testimonials", [])]
    gsts  = [GuestRow(**g) for g in d.get("guests", [])]

    # Parse gallery_slides (new format)
    raw_slides = d.get("gallery_slides", [])
    gallery_slides = []
    for rs in raw_slides:
        if not isinstance(rs, dict):
            continue
        photos = [_parse_photo_entry(p) for p in rs.get("photos", [])]
        # Pad / trim to exactly 7
        while len(photos) < 7:
            photos.append(None)
        gallery_slides.append(GallerySlide(
            title=rs.get("title", ""),
            photos=photos[:7],
        ))

    return ReportManifest(
        event_name=d.get("event_name", ""),
        event_abbrev=d.get("event_abbrev", ""),
        partner_name=d.get("partner_name", ""),
        partner_logo_path=d.get("partner_logo_path") or None,
        include_guests=bool(d.get("include_guests", True)),
        intro_body=d.get("intro_body", ""),
        overview_text=d.get("overview_text", ""),
        retention_text=d.get("retention_text", ""),
        stats=stats,
        campaign_subtitle=d.get("campaign_subtitle", ""),
        campaign_description=d.get("campaign_description", ""),
        meta_headline=mh,
        meta_posts=posts,
        testimonials=tests,
        testimonials_bg_path=d.get("testimonials_bg_path") or None,
        gallery_slides=gallery_slides,
        photo_album_url=d.get("photo_album_url", ""),
        photo_album_label=d.get("photo_album_label", f"{d.get('event_name','')} Event Photo Album"),
        social_content_count=str(d.get("social_content_count", "0")),
        pixieset_url=d.get("pixieset_url", ""),
        social_preview_paths=d.get("social_preview_paths", []),
        guests=gsts,
        output_filename=d.get("output_filename", ""),
    )
