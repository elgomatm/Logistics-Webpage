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
class GallerySection:
    # Section title shown in header bar of gallery slides
    title: str = ""
    # Ordered list of local photo paths.
    # 7–8 per slide; generator auto-paginates.
    photos: list[str] = field(default_factory=list)


@dataclass
class GuestRow:
    full_name: str = ""
    email: str = ""
    exotic_car: str = ""


@dataclass
class ReportManifest:
    # ── Identity ──────────────────────────────────────────────────────────
    event_name: str = ""          # e.g. "Lone Star Supercars 2026"
    partner_name: str = ""        # e.g. "COTA"

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

    # ── Photo galleries ───────────────────────────────────────────────────
    # Each GallerySection maps to 1–2 gallery slides (7–8 photos each).
    # Template has 3 sections: starting_grid, hill_country, main_event.
    # Provide in the same order; extra sections get new gallery slides.
    gallery_sections: list[GallerySection] = field(default_factory=list)

    # ── Content Creation (Slide 19) ───────────────────────────────────────
    photo_album_url: str = ""
    photo_album_label: str = ""   # Link button text
    social_content_count: str = "0"
    # Up to 10 Instagram preview images
    social_preview_paths: list[str] = field(default_factory=list)

    # ── Guest Data (Slides 20–N) ──────────────────────────────────────────
    guests: list[GuestRow] = field(default_factory=list)

    # ── Output ────────────────────────────────────────────────────────────
    output_filename: str = ""     # Defaults to "{event_name} - Report for {partner_name}.pptx"


# ── Deserialise from plain dict (comes from JSON API body) ────────────────

def manifest_from_dict(d: dict) -> ReportManifest:
    stats = StatBlock(**d.get("stats", {})) if isinstance(d.get("stats"), dict) else StatBlock()
    mh    = MetaHeadline(**d.get("meta_headline", {})) if isinstance(d.get("meta_headline"), dict) else MetaHeadline()
    posts = [MetaPost(**p) for p in d.get("meta_posts", [])]
    tests = [Testimonial(**t) for t in d.get("testimonials", [])]
    sects = [GallerySection(**s) for s in d.get("gallery_sections", [])]
    gsts  = [GuestRow(**g) for g in d.get("guests", [])]

    return ReportManifest(
        event_name=d.get("event_name", ""),
        partner_name=d.get("partner_name", ""),
        intro_body=d.get("intro_body", ""),
        overview_text=d.get("overview_text", ""),
        retention_text=d.get("retention_text", ""),
        stats=stats,
        campaign_subtitle=d.get("campaign_subtitle", ""),
        campaign_description=d.get("campaign_description", ""),
        meta_headline=mh,
        meta_posts=posts,
        testimonials=tests,
        gallery_sections=sects,
        photo_album_url=d.get("photo_album_url", ""),
        photo_album_label=d.get("photo_album_label", f"{d.get('event_name','')} Event Photo Album"),
        social_content_count=str(d.get("social_content_count", "0")),
        social_preview_paths=d.get("social_preview_paths", []),
        guests=gsts,
        output_filename=d.get("output_filename", ""),
    )
