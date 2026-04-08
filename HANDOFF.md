# TEN Document Studio — Handoff

**Live:** https://logistics-webpage.vercel.app | **Repo:** https://github.com/elgomatm/Logistics-Webpage | **Local:** `~/Desktop/ten-document-studio`

## Status
Everything is working. Auth, OneDrive connection, report file listing, homepage count, Vercel deploys — all green.

## What you're building
Full report generation pipeline. The 8-step UI already exists at `app/reports/page.tsx` but is all placeholder. Wire it up end-to-end:

1. **Clone & Setup** — user picks a template `.pptx` from the dropdown (already populated from OneDrive). Download it via Graph API: `GET /drives/{driveId}/items/{itemId}/content`
2. **Cover Page** — upload cover image, set title/subtitle → replace cover slide
3. **Partners** — select partners (one exported `.pptx` per partner), upload logos
4. **Master Header** — upload hero banner image used across all slides
5. **Event Details** — date, venue, city, vehicle count, guest count → populate text fields
6. **Metrics** — social reach, impressions, engagement → populate metrics slides
7. **Photo Gallery** — upload + select event photos → inject into slides
8. **Review & Export** — generate final `.pptx` per partner, download

Use **`python-pptx`** for PPTX manipulation (download template → swap images + text → export per partner). Parallelize per-partner generation. Show real-time progress — do not just show a spinner.

## Critical
This tool exists to save time. If it's slow or inaccurate it's worthless. Performance and correctness are the top priority.

## OneDrive
TEN is on Adonis Ordonez's drive, found via Microsoft Search API (`POST /search/query`). See `app/api/reports-count/route.ts` — `findTENFolder()` has the full pattern. `driveId` + `itemId` are available from the reports-count response, use them to download files.

## Confirmed report count
49 `.pptx` files across 4 events (Exotics & Elegance 14, Lone Star Supercars 14, Supercars & Superyachts 12, Scottsdale Grand Tour 9). 4 events have no Reports folder yet — correct, no reports exist for those.
