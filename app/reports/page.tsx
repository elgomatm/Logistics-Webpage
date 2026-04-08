"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Copy,
  FileImage,
  Users,
  ScanLine,
  CalendarDays,
  BarChart2,
  GalleryHorizontal,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  Plus,
  X,
  Upload,
  FolderOpen,
  Move,
  ImagePlus,
  Check,
} from "lucide-react";

// ─── Step definitions ─────────────────────────────────────────
const STEPS = [
  {
    number: "01",
    title: "Clone & Setup",
    subtitle: "Select a template and name your event",
    icon: Copy,
    description: "Choose an existing report to use as your starting point, give the new event its name, and pick where the final file will be saved.",
  },
  {
    number: "02",
    title: "Cover Page",
    subtitle: "Upload the cover image and set the title",
    icon: FileImage,
    description: "Upload a full-bleed cover image and define the event title and subtitle that will appear on the report cover.",
  },
  {
    number: "03",
    title: "Partners",
    subtitle: "Select partners receiving this report",
    icon: Users,
    description: "Choose which partners will be included in this report. Add a new partner and upload their logo if they don't exist yet.",
  },
  {
    number: "04",
    title: "Master Header",
    subtitle: "Set the hero banner across all slides",
    icon: ScanLine,
    description: "Upload the hero image that spans the header of every slide in this report. Preview and reposition within the crop area.",
  },
  {
    number: "05",
    title: "Event Details",
    subtitle: "Date, venue, city, and attendance",
    icon: CalendarDays,
    description: "Enter the core event information — date, venue name, location, total vehicles, and registered guest count.",
  },
  {
    number: "06",
    title: "Metrics",
    subtitle: "Social reach, impressions, and engagement",
    icon: BarChart2,
    description: "Enter the digital performance figures pulled from Meta Business Suite. These populate the metrics slides automatically.",
  },
  {
    number: "07",
    title: "Photo Gallery",
    subtitle: "Upload and select event photos",
    icon: GalleryHorizontal,
    description: "Upload event photography and select which shots go into the report. Preview and crop each image before adding.",
  },
  {
    number: "08",
    title: "Review & Export",
    subtitle: "Final review and report generation",
    icon: CheckCircle2,
    description: "Confirm all entered content, check your partner list, and generate the final PPTX when you're ready.",
  },
];

// ─── Mock partner data ─────────────────────────────────────────
const MOCK_PARTNERS = [
  { id: 1, name: "Lone Star Supercars", initials: "LSS", selected: true },
  { id: 2, name: "Porsche Austin", initials: "PA", selected: false },
  { id: 3, name: "Ferrari of Austin", initials: "FA", selected: false },
  { id: 4, name: "McLaren Dallas", initials: "MD", selected: false },
];

// ─── Slide transition variants ────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  }),
};

// ─── Individual step content ───────────────────────────────────
// Known events — always shown as fallback if OneDrive isn't connected
const KNOWN_REPORTS = [
  "Lone Star Supercars 2026 — COTA.pptx",
  "Supercars & Superyachts 2025.pptx",
  "Scottsdale Grand Tour 2025.pptx",
  "Exotics & Elegance 2025.pptx",
];

function StepContent({ stepIndex }: { stepIndex: number }) {
  const [partners, setPartners] = useState(MOCK_PARTNERS);
  const [addingPartner, setAddingPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [liveReports, setLiveReports] = useState<string[]>([]);

  // Fetch real report filenames from OneDrive
  useEffect(() => {
    fetch("/api/reports-count")
      .then((r) => r.json())
      .then((data) => {
        if (data?.events?.length) {
          // Flatten all files across all events into a unique sorted list
          const files: string[] = [];
          for (const event of data.events) {
            if (event.files?.length) files.push(...event.files);
          }
          const unique = Array.from(new Set(files)).sort((a, b) => b.localeCompare(a));
          if (unique.length > 0) setLiveReports(unique);
        }
      })
      .catch(() => {/* use fallback */});
  }, []);

  // Use live data if available, otherwise fall back to known list
  const reportOptions = liveReports.length > 0 ? liveReports : KNOWN_REPORTS;
  const coverInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleCoverImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCoverPreview(URL.createObjectURL(f));
  };

  const handleHeaderImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setHeaderPreview(URL.createObjectURL(f));
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoCount((e.target.files?.length ?? 0));
  };

  const togglePartner = (id: number) => {
    setPartners((p) =>
      p.map((pt) => (pt.id === id ? { ...pt, selected: !pt.selected } : pt))
    );
  };

  const addNewPartner = () => {
    if (!newPartnerName.trim()) return;
    const initials = newPartnerName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
    setPartners((p) => [
      ...p,
      { id: Date.now(), name: newPartnerName.trim(), initials, selected: true },
    ]);
    setNewPartnerName("");
    setAddingPartner(false);
  };

  // ── Step 01 — Clone & Setup ──
  if (stepIndex === 0) {
    return (
      <div className="space-y-6">
        <div className="step-row">
          <label className="field-label">Template Report</label>
          <div className="relative">
            <select className="input-field pr-10 w-full">
              <option value="">Choose existing report to clone…</option>
              {reportOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-white/20 mt-1">
            The selected file will be duplicated — your original is never modified.
          </p>
        </div>

        <div className="step-row">
          <label className="field-label">New Event Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. COTA Supercars Invitational 2026"
          />
        </div>

        <div className="step-row">
          <label className="field-label">Save Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1"
              readOnly
              placeholder="/OneDrive/TEN/Events/2026/…"
            />
            <button className="btn-primary px-4 gap-2 shrink-0">
              <FolderOpen size={13} strokeWidth={1.5} />
              Browse
            </button>
          </div>
          <p className="text-[10px] text-white/20 mt-1">
            The generated PPTX will be saved directly into this folder.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 02 — Cover Page ──
  if (stepIndex === 1) {
    return (
      <div className="space-y-6">
        <div className="step-row">
          <label className="field-label">Cover Background Image</label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverImage}
          />
          {coverPreview ? (
            <div className="relative w-full aspect-[3/2] overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreview}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setCoverPreview(null)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X size={12} />
              </button>
              <div className="absolute bottom-0 inset-x-0 h-px bg-white/20" />
            </div>
          ) : (
            <div
              className="upload-zone"
              onClick={() => coverInputRef.current?.click()}
            >
              <Upload size={20} strokeWidth={1} className="text-white/25" />
              <span className="upload-zone-label">Click to upload cover image</span>
              <span className="upload-zone-hint">JPG, PNG, WEBP — recommended 1920 × 2560px</span>
            </div>
          )}
        </div>

        <div className="step-row">
          <label className="field-label">Cover Title</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. LONE STAR SUPERCARS"
          />
        </div>

        <div className="step-row">
          <label className="field-label">Cover Subtitle / Date Line</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Circuit of The Americas — April 2026"
          />
        </div>
      </div>
    );
  }

  // ── Step 03 — Partners ──
  if (stepIndex === 2) {
    return (
      <div className="space-y-5">
        <div className="step-row">
          <label className="field-label">Select Partners — {partners.filter((p) => p.selected).length} selected</label>
          <div
            className="overflow-y-auto border border-white/[0.07]"
            style={{ maxHeight: "260px" }}
          >
            {partners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => togglePartner(partner.id)}
                className="flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors"
                style={{
                  background: partner.selected ? "rgba(255,255,255,0.04)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {/* Logo placeholder */}
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0 border"
                  style={{
                    borderColor: partner.selected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="font-bebas text-[11px] tracking-widest"
                    style={{ color: partner.selected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }}>
                    {partner.initials}
                  </span>
                </div>

                <span
                  className="text-[13px] flex-1"
                  style={{ color: partner.selected ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.30)" }}
                >
                  {partner.name}
                </span>

                {/* Checkbox */}
                <div
                  className="w-4 h-4 border flex items-center justify-center shrink-0"
                  style={{
                    borderColor: partner.selected ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
                    background: partner.selected ? "rgba(255,255,255,0.12)" : "transparent",
                  }}
                >
                  {partner.selected && <Check size={10} strokeWidth={2.5} className="text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add new partner */}
        <div className="border border-white/[0.07]">
          {!addingPartner ? (
            <button
              onClick={() => setAddingPartner(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-[11px] tracking-[0.14em] uppercase text-white/30 hover:text-white/60 hover:bg-white/[0.02] transition-all"
            >
              <Plus size={12} strokeWidth={2} />
              Add New Partner
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <label className="field-label">New Partner Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Lamborghini Austin"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNewPartner()}
                autoFocus
              />

              <div className="upload-zone" style={{ padding: "16px" }}>
                <Upload size={14} strokeWidth={1.5} className="text-white/20" />
                <span className="upload-zone-label" style={{ fontSize: "9px" }}>Upload partner logo</span>
              </div>

              <div className="flex gap-2">
                <button onClick={addNewPartner} className="btn-primary flex-1 justify-center py-2.5 text-[10px]">
                  Add Partner
                </button>
                <button
                  onClick={() => { setAddingPartner(false); setNewPartnerName(""); }}
                  className="btn-ghost px-4 py-2.5 text-[10px] cursor-pointer"
                  style={{ cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step 04 — Master Header Image ──
  if (stepIndex === 3) {
    return (
      <div className="space-y-6">
        <div className="step-row">
          <label className="field-label">Hero Banner Image</label>
          <p className="text-[11px] text-white/28 mb-3 leading-relaxed">
            This image spans the full header of every slide in the report. Upload a landscape photo, then drag to reposition within the crop frame.
          </p>
          <input
            ref={headerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleHeaderImage}
          />
          {headerPreview ? (
            <div className="space-y-3">
              {/* Crop frame */}
              <div
                className="relative w-full overflow-hidden border border-white/15"
                style={{ aspectRatio: "16 / 4" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={headerPreview}
                  alt="Header preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Crop overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5">
                    <Move size={11} strokeWidth={1.5} className="text-white/60" />
                    <span className="text-[9px] tracking-widest uppercase text-white/60">Drag to reposition</span>
                  </div>
                </div>
                {/* Rule thirds overlay */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                    backgroundSize: "33.33% 50%",
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[9px] tracking-widest uppercase text-white/20">
                  Crop area — 16 : 4 — full slide width
                </p>
                <button
                  onClick={() => setHeaderPreview(null)}
                  className="text-[9px] tracking-[0.14em] uppercase text-white/30 hover:text-white/60 transition-colors"
                >
                  Replace
                </button>
              </div>
            </div>
          ) : (
            <div
              className="upload-zone"
              style={{ aspectRatio: "16 / 4", padding: "0" }}
              onClick={() => headerInputRef.current?.click()}
            >
              <ImagePlus size={22} strokeWidth={1} className="text-white/20" />
              <span className="upload-zone-label">Click to upload header image</span>
              <span className="upload-zone-hint">Landscape — minimum 1920px wide</span>
            </div>
          )}
        </div>

        {/* Slide position preview */}
        <div className="border border-white/[0.06] p-4 space-y-2">
          <p className="field-label">Slide Preview</p>
          <div
            className="w-full border border-white/[0.06]"
            style={{ aspectRatio: "210 / 297", maxHeight: "200px", position: "relative", overflow: "hidden" }}
          >
            {/* Slide mockup */}
            <div className="absolute inset-x-0 top-0"
              style={{ height: "22%", background: headerPreview ? `url(${headerPreview}) center/cover` : "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            />
            <div className="absolute inset-x-4"
              style={{ top: "28%", height: "4px", background: "rgba(255,255,255,0.06)" }}
            />
            <div className="absolute inset-x-4 space-y-1.5"
              style={{ top: "38%" }}
            >
              {[80, 60, 40, 40].map((w, i) => (
                <div key={i} className="h-1.5"
                  style={{ width: `${w}%`, background: "rgba(255,255,255,0.05)" }}
                />
              ))}
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-[7px] tracking-widest uppercase text-white/15">
              Slide Preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 05 — Event Details ──
  if (stepIndex === 4) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="step-row col-span-2">
            <label className="field-label">Event Name</label>
            <input type="text" className="input-field" placeholder="e.g. Lone Star Supercars — COTA" />
          </div>

          <div className="step-row">
            <label className="field-label">Event Date</label>
            <input type="date" className="input-field" />
          </div>

          <div className="step-row">
            <label className="field-label">City / State</label>
            <input type="text" className="input-field" placeholder="e.g. Austin, TX" />
          </div>

          <div className="step-row col-span-2">
            <label className="field-label">Venue Name</label>
            <input type="text" className="input-field" placeholder="e.g. Circuit of The Americas" />
          </div>

          <div className="step-row">
            <label className="field-label">Total Vehicles</label>
            <input type="number" className="input-field" placeholder="0" min="0" />
          </div>

          <div className="step-row">
            <label className="field-label">Registered Guests</label>
            <input type="number" className="input-field" placeholder="0" min="0" />
          </div>
        </div>
      </div>
    );
  }

  // ── Step 06 — Metrics ──
  if (stepIndex === 5) {
    const metricFields = [
      { label: "Total Reach", placeholder: "e.g. 128,400", hint: "Meta unique accounts reached" },
      { label: "Total Impressions", placeholder: "e.g. 312,000", hint: "Total times content was displayed" },
      { label: "Story Impressions", placeholder: "e.g. 58,200", hint: "Instagram / Facebook stories only" },
      { label: "Engagement", placeholder: "e.g. 4,870", hint: "Likes, comments, shares, saves" },
      { label: "Profile Visits", placeholder: "e.g. 1,640", hint: "Accounts that visited the profile" },
      { label: "Website Clicks", placeholder: "e.g. 320", hint: "Link clicks to website or bio" },
    ];

    return (
      <div className="space-y-4">
        <p className="text-[11px] text-white/28 leading-relaxed">
          Pull these figures from <span className="text-white/50">Meta Business Suite → Insights</span> for the event window.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {metricFields.map((field) => (
            <div key={field.label} className="step-row">
              <label className="field-label">{field.label}</label>
              <input type="text" className="input-field" placeholder={field.placeholder} />
              <p className="text-[9px] text-white/18 mt-1">{field.hint}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 07 — Photo Gallery ──
  if (stepIndex === 6) {
    return (
      <div className="space-y-5">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotos}
        />

        <div className="step-row">
          <label className="field-label">
            Event Photos — {photoCount > 0 ? `${photoCount} uploaded` : "none uploaded yet"}
          </label>
          <div
            className="upload-zone"
            onClick={() => photoInputRef.current?.click()}
          >
            <GalleryHorizontal size={22} strokeWidth={1} className="text-white/20" />
            <span className="upload-zone-label">Click to upload event photos</span>
            <span className="upload-zone-hint">Select multiple — JPG, PNG, WEBP</span>
          </div>
        </div>

        {photoCount > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: Math.min(photoCount, 8) }).map((_, i) => (
              <div
                key={i}
                className="relative border border-white/[0.08] flex items-center justify-center"
                style={{ aspectRatio: "1", background: "rgba(255,255,255,0.03)" }}
              >
                <span className="text-[9px] tracking-widest uppercase text-white/20">
                  Photo {i + 1}
                </span>
                {/* Crop indicator */}
                <div className="absolute top-1 right-1">
                  <ScanLine size={9} strokeWidth={1.5} className="text-white/20" />
                </div>
              </div>
            ))}
            {photoCount > 8 && (
              <div
                className="flex items-center justify-center border border-white/[0.06]"
                style={{ aspectRatio: "1", background: "rgba(255,255,255,0.015)" }}
              >
                <span className="text-[10px] text-white/30">+{photoCount - 8} more</span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-4 gap-2 opacity-30 pointer-events-none select-none"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border border-white/[0.06]"
                style={{ aspectRatio: "1", background: "rgba(255,255,255,0.02)" }}
              />
            ))}
          </div>
        )}

        <p className="text-[10px] text-white/20 leading-relaxed">
          After uploading, you'll be able to reorder and crop each photo individually. Photos are laid out across the gallery slides automatically.
        </p>
      </div>
    );
  }

  // ── Step 08 — Review & Export ──
  if (stepIndex === 7) {
    const summaryItems = [
      { label: "Event", value: "COTA Supercars Invitational 2026" },
      { label: "Template", value: "Lone Star Supercars 2026 — COTA.pptx" },
      { label: "Partners", value: "1 selected" },
      { label: "Cover Image", value: "Not uploaded" },
      { label: "Header Image", value: "Not uploaded" },
      { label: "Event Date", value: "Not set" },
      { label: "Venue", value: "Not set" },
      { label: "Photos", value: "0 uploaded" },
      { label: "Metrics", value: "Not entered" },
    ];

    return (
      <div className="space-y-6">
        <div className="border border-white/[0.07]">
          {summaryItems.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: i < summaryItems.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span className="text-[10px] tracking-[0.14em] uppercase text-white/30">
                {item.label}
              </span>
              <span className="text-[12px] text-white/50">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            disabled
            className="w-full btn-primary justify-center opacity-35 cursor-not-allowed"
            title="Report generation will be available in the next release"
          >
            Generate Report
            <CheckCircle2 size={13} strokeWidth={1.5} />
          </button>
          <p className="text-center text-[9px] tracking-[0.14em] uppercase text-white/20">
            Report generation coming in next release — UI preview only
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main wizard page ──────────────────────────────────────────
export default function ReportsPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = (target: number) => {
    if (target < 0 || target >= STEPS.length) return;
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const currentStep = STEPS[step];
  const StepIcon = currentStep.icon;

  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col">

      {/* ── Top nav bar ───────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-white/[0.05]">
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors group"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.18em] uppercase">Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-white/10" />

          <span className="text-[10px] tracking-[0.18em] uppercase text-white/50">
            Reports
          </span>

          <div className="h-4 w-px bg-white/10" />

          <span className="text-[10px] tracking-[0.18em] uppercase text-white/25">
            New Report
          </span>

          {/* Right — step counter */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[9px] tracking-[0.18em] uppercase text-white/25">
              Step {step + 1} / {STEPS.length}
            </span>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    width: i === step ? "20px" : "6px",
                    height: "3px",
                    background: i === step
                      ? "rgba(255,255,255,0.7)"
                      : i < step
                        ? "rgba(255,255,255,0.25)"
                        : "rgba(255,255,255,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────── */}
      <div className="flex flex-1 max-w-[1440px] mx-auto w-full px-8 md:px-16 pt-24 pb-32 gap-10 xl:gap-16">

        {/* ── Left: Step navigator (sticky) ─────────────────── */}
        <aside
          className="hidden lg:block shrink-0 sticky"
          style={{ width: "220px", top: "88px", alignSelf: "flex-start" }}
        >
          <p className="field-label mb-5">Steps</p>
          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const SIcon = s.icon;
              const isActive = i === step;
              const isDone = i < step;

              return (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200 text-left group"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    borderLeft: isActive ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                  }}
                >
                  <div
                    className="w-6 h-6 flex items-center justify-center shrink-0"
                    style={{
                      background: isDone
                        ? "rgba(255,255,255,0.08)"
                        : isActive
                          ? "rgba(255,255,255,0.06)"
                          : "transparent",
                      border: `1px solid ${isDone ? "rgba(255,255,255,0.18)" : isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {isDone ? (
                      <Check size={10} strokeWidth={2.5} className="text-white/60" />
                    ) : (
                      <SIcon
                        size={10}
                        strokeWidth={1.5}
                        style={{ color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-medium leading-none truncate"
                      style={{ color: isActive ? "rgba(255,255,255,0.85)" : isDone ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.22)" }}
                    >
                      {s.title}
                    </p>
                    {isActive && (
                      <p className="text-[9px] text-white/25 mt-1 leading-none truncate">
                        {s.subtitle}
                      </p>
                    )}
                  </div>

                  <span
                    className="font-bebas text-[13px] shrink-0 tracking-wider"
                    style={{ color: isActive ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)" }}
                  >
                    {s.number}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right: Step card ──────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col">

          {/* Step card */}
          <div className="relative w-full max-w-[640px]" style={{ minHeight: "520px" }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="module-card module-card-active w-full"
              >
                {/* Card header */}
                <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
                  <div className="flex items-start gap-4 mb-5">
                    {/* Step icon */}
                    <div
                      className="w-10 h-10 flex items-center justify-center shrink-0 border border-white/[0.1]"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <StepIcon size={16} strokeWidth={1.2} className="text-white/60" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bebas text-[11px] tracking-[0.28em] text-white/25">
                          {currentStep.number}
                        </span>
                        <div className="h-px w-4 bg-white/10" />
                        <span className="text-[9px] tracking-[0.18em] uppercase text-white/25">
                          of {STEPS.length}
                        </span>
                      </div>
                      <h1
                        className="font-bebas tracking-wide leading-none"
                        style={{ fontSize: "clamp(28px, 3vw, 38px)" }}
                      >
                        {currentStep.title}
                      </h1>
                      <p className="text-[10px] tracking-[0.14em] uppercase text-white/30 mt-1.5">
                        {currentStep.subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="text-[12px] text-white/38 leading-relaxed">
                    {currentStep.description}
                  </p>
                </div>

                {/* Card body — step content */}
                <div className="px-8 py-7">
                  <StepContent stepIndex={step} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Fixed bottom navigation ───────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/[0.06]"
      >
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 h-16 flex items-center justify-between">

          {/* Back */}
          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase transition-all duration-200"
            style={{
              color: step === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.40)",
              cursor: step === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Back
          </button>

          {/* Step dots (mobile) */}
          <div className="flex gap-1.5 lg:hidden">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? "16px" : "5px",
                  height: "5px",
                  background: i === step
                    ? "rgba(255,255,255,0.6)"
                    : i < step
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.07)",
                }}
              />
            ))}
          </div>

          {/* Step label (desktop) */}
          <span className="hidden lg:block text-[10px] tracking-[0.18em] uppercase text-white/20">
            {step + 1} / {STEPS.length} — {currentStep.title}
          </span>

          {/* Continue / Finish */}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => goTo(step + 1)}
              className="btn-primary gap-2"
            >
              Continue
              <ArrowRight size={12} strokeWidth={2} />
            </button>
          ) : (
            <Link href="/" className="btn-primary gap-2">
              Back to Hub
              <ArrowRight size={12} strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
