"""
Guide manifest — data contract between the wizard UI and the guide generator.
All event-level content (schedule, venue, rules) is filled in once and shared
across all partners. Partner-specific fields (name, logo, intro) are per-partner.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ScheduleItem:
    time: str = ""
    activity: str = ""


@dataclass
class EmergencyContact:
    name: str = ""
    phone: str = ""


@dataclass
class GuidePartner:
    name: str = ""                          # e.g. "COTA" or "Ceramic Pro"
    logo_path: Optional[str] = None        # abs path to partner logo PNG
    intro_body: str = ""                   # personalised welcome letter body
    cover_photo_path: Optional[str] = None # per-partner cover override (falls back to event cover)


@dataclass
class GuideManifest:
    # ── Event identity ────────────────────────────────────────────────────────
    event_name:   str = ""   # "The Texas Grand Tour 2026"
    event_abbrev: str = ""   # "TGT 2026"  — used in footer on every content slide

    # ── Partners ──────────────────────────────────────────────────────────────
    partners: list[GuidePartner] = field(default_factory=list)

    # ── Cover (Slide 1) ───────────────────────────────────────────────────────
    cover_photo_path: Optional[str] = None   # event-wide cover background

    # ── Slide backgrounds (optional per slide) ────────────────────────────────
    intro_bg_path:    Optional[str] = None   # slide 2 blurred bg
    day1_bg_path:     Optional[str] = None   # slide 3
    venue_bg_path:    Optional[str] = None   # slide 4
    day2_bg_path:     Optional[str] = None   # slide 5
    rally_bg_path:    Optional[str] = None   # slide 6
    poi_bg_path:      Optional[str] = None   # slide 7
    race_bg_path:     Optional[str] = None   # slide 8
    hotel_bg_path:    Optional[str] = None   # slide 9
    rules_bg_path:    Optional[str] = None   # slide 10
    closing_bg_path:  Optional[str] = None   # slide 11

    # ── Day 1 Itinerary (Slide 3) ──────────────────────────────────────────────
    day1_title:   str = "Day 1\nItinerary"
    day1_opening: str = ""                   # "Please arrive at…"
    day1_items:   list[ScheduleItem] = field(default_factory=list)

    # ── Welcome Reception (Slide 4) ───────────────────────────────────────────
    venue_title:         str = "Welcome\nReception :"
    venue_location_name: str = ""            # e.g. "T11 COTA CAR CONDOS ARRIVAL:"
    venue_arrival_text:  str = ""            # main directions paragraph
    venue_directions:    str = ""            # secondary directions

    # ── Day 2 Itinerary (Slide 5) ─────────────────────────────────────────────
    day2_title:   str = "Day 2\nItinerary"
    day2_opening: str = ""
    day2_items:   list[ScheduleItem] = field(default_factory=list)

    # ── The Rally (Slide 6) ───────────────────────────────────────────────────
    rally_title: str = "Day 2\nThe RALLY :"

    # ── Points of Interest (Slide 7) ─────────────────────────────────────────
    include_poi_slide: bool = True
    poi_title:         str  = ""             # e.g. "Day 2\nCOTA POINTS OF\nINTEREST"
    poi_access_times:  str  = ""             # e.g. "PIT LANE WALK: 11:45 AM – 12:15 PM\n\nTEN LOUNGE ACCESS: 11:30 AM – 3:30 PM"

    # ── Race Day (Slide 8) ────────────────────────────────────────────────────
    race_title:          str = "Day 2\nRace Day"
    race_schedule_title: str = ""            # e.g. "GT WORLD CHALLENGE AMERICA SCHEDULE:"
    race_items:          list[ScheduleItem] = field(default_factory=list)

    # ── Hotel (Slide 9) ───────────────────────────────────────────────────────
    hotel_title: str = ""                    # e.g. "Fairmont\nAustin :"

    # ── Rules & Safety (Slide 10) ────────────────────────────────────────────
    rules_general:    str = ""
    rules_convoy:     str = ""
    rules_vehicle:    str = ""
    rules_emergency:  str = ""
    emergency_contacts: list[EmergencyContact] = field(default_factory=list)

    # ── Output ────────────────────────────────────────────────────────────────
    output_filename: str = ""   # defaults to "{event_name} – Guide for {partner}.pptx"


# ── Deserialise from plain dict (comes from JSON manifest) ────────────────────

def manifest_from_dict(d: dict) -> GuideManifest:
    partners = [
        GuidePartner(
            name=p.get("name", ""),
            logo_path=p.get("logo_path") or None,
            intro_body=p.get("intro_body", ""),
            cover_photo_path=p.get("cover_photo_path") or None,
        )
        for p in d.get("partners", [])
    ]

    day1_items = [ScheduleItem(time=i.get("time",""), activity=i.get("activity",""))
                  for i in d.get("day1_items", [])]
    day2_items = [ScheduleItem(time=i.get("time",""), activity=i.get("activity",""))
                  for i in d.get("day2_items", [])]
    race_items = [ScheduleItem(time=i.get("time",""), activity=i.get("activity",""))
                  for i in d.get("race_items", [])]
    contacts   = [EmergencyContact(name=c.get("name",""), phone=c.get("phone",""))
                  for c in d.get("emergency_contacts", [])]

    return GuideManifest(
        event_name=d.get("event_name", ""),
        event_abbrev=d.get("event_abbrev", ""),
        partners=partners,
        cover_photo_path=d.get("cover_photo_path") or None,
        intro_bg_path=d.get("intro_bg_path") or None,
        day1_bg_path=d.get("day1_bg_path") or None,
        venue_bg_path=d.get("venue_bg_path") or None,
        day2_bg_path=d.get("day2_bg_path") or None,
        rally_bg_path=d.get("rally_bg_path") or None,
        poi_bg_path=d.get("poi_bg_path") or None,
        race_bg_path=d.get("race_bg_path") or None,
        hotel_bg_path=d.get("hotel_bg_path") or None,
        rules_bg_path=d.get("rules_bg_path") or None,
        closing_bg_path=d.get("closing_bg_path") or None,
        day1_title=d.get("day1_title", "Day 1\nItinerary"),
        day1_opening=d.get("day1_opening", ""),
        day1_items=day1_items,
        venue_title=d.get("venue_title", "Welcome\nReception :"),
        venue_location_name=d.get("venue_location_name", ""),
        venue_arrival_text=d.get("venue_arrival_text", ""),
        venue_directions=d.get("venue_directions", ""),
        day2_title=d.get("day2_title", "Day 2\nItinerary"),
        day2_opening=d.get("day2_opening", ""),
        day2_items=day2_items,
        rally_title=d.get("rally_title", "Day 2\nThe RALLY :"),
        include_poi_slide=bool(d.get("include_poi_slide", True)),
        poi_title=d.get("poi_title", ""),
        poi_access_times=d.get("poi_access_times", ""),
        race_title=d.get("race_title", "Day 2\nRace Day"),
        race_schedule_title=d.get("race_schedule_title", ""),
        race_items=race_items,
        hotel_title=d.get("hotel_title", ""),
        rules_general=d.get("rules_general", ""),
        rules_convoy=d.get("rules_convoy", ""),
        rules_vehicle=d.get("rules_vehicle", ""),
        rules_emergency=d.get("rules_emergency", ""),
        emergency_contacts=contacts,
        output_filename=d.get("output_filename", ""),
    )
