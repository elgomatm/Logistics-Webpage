"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
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
  { id: 2, name: "Porsche Austin",       initials: "PA",  selected: false },
  { id: 3, name: "Ferrari of Austin",    initials: "FA",  selected: false },
  { id: 4, name: "McLaren Dallas",       initials: "MD",  selected: false },
];

// ─── Slide transition variants ────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
  }),
};

// ─── Event report type ────────────────────────────────────────
interface EventReport { name: string; year: string; files: string[] }

// ─── Individual step content ───────────────────────────────────

function StepContent({ stepIndex }: { stepIndex: number }) {
  const [partners, setPartners] = useState(MOCK_PARTNERS);
  const [addingPartner, setAddingPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [eventGroups, setEventGroups] = useState<EventReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports-count")
      .then((r) => r.json())
      .then((data) => {
        if (data?.events?.length) {
          setEventGroups(
            data.events.map((e: EventReport) => ({
              name: e.name,
              year: e.year,
              files: e.files ?? [],
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, []);

  const coverInputRef  = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);

  const handleCoverImage  = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) setCoverPreview(URL.createObjectURL(f)); };
  const handleHeaderImage = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) setHeaderPreview(URL.createObjectURL(f)); };
  const handlePhotos      = (e: React.ChangeEvent<HTMLInputElement>) => { setPhotoCount(e.target.files?.length ?? 0); };

  const togglePartner = (id: number) => setPartners((p) => p.map((pt) => (pt.id === id ? { ...pt, selected: !pt.selected } : pt)));

  const addNewPartner = () => {
    if (!newPartnerName.trim()) return;
    const initials = newPartnerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3);
    setPartners((p) => [...p, { id: Date.now(), name: newPartnerName.trim(), initials, selected: true }]);
    setNewPartnerName("");
    setAddingPartner(false);
  };

  // ── Step 01 — Clone & Setup ──
  if (stepIndex === 0) {
    const hasGroups = eventGroups.some((g) => g.files.length > 0);
    return (
      <div className="space-y-6">
        <div className="step-row">
          <label className="field-label">Template Report</label>
          <div className="relative">
            <select
              className="input-field pr-10 w-full"
              disabled={reportsLoading && !hasGroups}
            >
              {reportsLoading && !hasGroups ? (
                <option value="">Loading reports from OneDrive…</option>
              ) : !hasGroups ? (
                <option value="">No reports found — sign in to connect OneDrive</option>
              ) : (
                <>
                  <option value="">Choose a report to clone…</option>
                  {eventGroups.map((group) =>
                    group.files.length > 0 ? (
                      <optgroup key={`${group.year}::${group.name}`} label={`${group.name} (${group.year})`}>
                        {group.files.map((file) => (
                          <option key={file} value={file}>{file}</option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </>
              )}
            </select>
          </div>
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-3)" }}>
            Reports are grouped by event. The selected file will be duplicated — your original is never modified.
          </p>
        </div>

        <div className="step-row">
          <label className="field-label">New Event Name</label>
          <input type="text" className="input-field" placeholder="e.g. COTA Supercars Invitational 2026" />
        </div>

        <div className="step-row">
          <label className="field-label">Save Location</label>
          <div className="flex gap-2">
            <input type="text" className="input-field flex-1" readOnly placeholder="/OneDrive/TEN/Events/2026/…" />
            <button className="btn-primary px-4 gap-2 shrink-0">
              <FolderOpen size={13} strokeWidth={1.5} />
              Browse
            </button>
          </div>
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-3)" }}>
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
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverImage} />
          {coverPreview ? (
            <div className="relative w-full aspect-[3/2] overflow-hidden rounded-lg border border-black/[0.1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
              <button
                onClick={() => setCoverPreview(null)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <div className="upload-zone" onClick={() => coverInputRef.current?.click()}>
              <Upload size={20} strokeWidth={1} style={{ color: "var(--text-3)" }} />
              <span className="upload-zone-label">Click to upload cover image</span>
              <span className="upload-zone-hint">JPG, PNG, WEBP — recommended 1920 × 2560px</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="step-row">
            <label className="field-label">Cover Title</label>
            <input type="text" className="input-field" placeholder="e.g. LONE STAR SUPERCARS" />
          </div>
          <div className="step-row">
            <label className="field-label">Cover Subtitle / Date Line</label>
            <input type="text" className="input-field" placeholder="e.g. Circuit of The Americas — April 2026" />
          </div>
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
          <div className="overflow-y-auto border border-black/[0.08] rounded-xl" style={{ maxHeight: "280px" }}>
            {partners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => togglePartner(partner.id)}
                className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                style={{
                  background: partner.selected ? "rgba(122,80,16,0.05)" : "transparent",
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0 rounded-lg border"
                  style={{ borderColor: partner.selected ? "var(--champagne)" : "rgba(0,0,0,0.12)" }}
                >
                  <span
                    className="font-bebas text-[11px] tracking-widest"
                    style={{ color: partner.selected ? "var(--champagne)" : "var(--text-3)" }}
                  >
                    {partner.initials}
                  </span>
                </div>
                <span className="text-[13px] flex-1 font-medium" style={{ color: partner.selected ? "var(--text-1)" : "var(--text-3)" }}>
                  {partner.name}
                </span>
                <div
                  className="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all"
                  style={{
                    borderColor: partner.selected ? "var(--champagne)" : "rgba(0,0,0,0.2)",
                    background: partner.selected ? "rgba(122,80,16,0.1)" : "transparent",
                  }}
                >
                  {partner.selected && <Check size={11} strokeWidth={2.5} style={{ color: "var(--champagne)" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-black/[0.08] rounded-xl overflow-hidden">
          {!addingPartner ? (
            <button
              onClick={() => setAddingPartner(true)}
              className="w-full flex items-center gap-3 px-5 py-4 text-[11px] tracking-[0.14em] uppercase transition-all"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Plus size={12} strokeWidth={2} />
              Add New Partner
            </button>
          ) : (
            <div className="p-5 space-y-4">
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
                <Upload size={14} strokeWidth={1.5} style={{ color: "var(--text-3)" }} />
                <span className="upload-zone-label" style={{ fontSize: "9px" }}>Upload partner logo</span>
              </div>
              <div className="flex gap-2">
                <button onClick={addNewPartner} className="btn-primary flex-1 justify-center py-2.5 text-[10px]">Add Partner</button>
                <button
                  onClick={() => { setAddingPartner(false); setNewPartnerName(""); }}
                  className="btn-ghost px-4 py-2.5 text-[10px]"
                  style={{ cursor: "pointer" }}
                >Cancel</button>
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
          <p className="text-[11px] mb-4 leading-relaxed" style={{ color: "var(--text-3)" }}>
            This image spans the full header of every slide in the report. Upload a landscape photo, then drag to reposition within the crop frame.
          </p>
          <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeaderImage} />
          {headerPreview ? (
            <div className="space-y-3">
              <div className="relative w-full overflow-hidden rounded-lg border border-black/[0.1]" style={{ aspectRatio: "16 / 4" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headerPreview} alt="Header preview" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
                    <Move size={11} strokeWidth={1.5} className="text-white/60" />
                    <span className="text-[9px] tracking-widest uppercase text-white/60">Drag to reposition</span>
                  </div>
                </div>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
                    backgroundSize: "33.33% 50%",
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Crop area — 16 : 4 — full slide width</p>
                <button
                  onClick={() => setHeaderPreview(null)}
                  className="text-[9px] tracking-[0.14em] uppercase transition-colors"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
                >Replace</button>
              </div>
            </div>
          ) : (
            <div
              className="upload-zone"
              style={{ aspectRatio: "16 / 4", padding: "0" }}
              onClick={() => headerInputRef.current?.click()}
            >
              <ImagePlus size={22} strokeWidth={1} style={{ color: "var(--text-3)" }} />
              <span className="upload-zone-label">Click to upload header image</span>
              <span className="upload-zone-hint">Landscape — minimum 1920px wide</span>
            </div>
          )}
        </div>

        <div className="border border-black/[0.07] rounded-xl p-5 space-y-3">
          <p className="field-label">Slide Preview</p>
          <div className="w-full border border-black/[0.07] rounded-lg" style={{ aspectRatio: "210 / 297", maxHeight: "200px", position: "relative", overflow: "hidden" }}>
            <div
              className="absolute inset-x-0 top-0"
              style={{
                height: "22%",
                background: headerPreview ? `url(${headerPreview}) center/cover` : "rgba(0,0,0,0.04)",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            />
            <div className="absolute inset-x-4" style={{ top: "28%", height: "4px", background: "rgba(0,0,0,0.06)" }} />
            <div className="absolute inset-x-4 space-y-1.5" style={{ top: "38%" }}>
              {[80, 60, 40, 40].map((w, i) => (
                <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: "rgba(0,0,0,0.05)" }} />
              ))}
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-[7px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
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
        <div className="grid grid-cols-2 gap-5">
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
      { label: "Total Reach",       placeholder: "e.g. 128,400", hint: "Meta unique accounts reached" },
      { label: "Total Impressions", placeholder: "e.g. 312,000", hint: "Total times content was displayed" },
      { label: "Story Impressions", placeholder: "e.g. 58,200",  hint: "Instagram / Facebook stories only" },
      { label: "Engagement",        placeholder: "e.g. 4,870",   hint: "Likes, comments, shares, saves" },
      { label: "Profile Visits",    placeholder: "e.g. 1,640",   hint: "Accounts that visited the profile" },
      { label: "Website Clicks",    placeholder: "e.g. 320",     hint: "Link clicks to website or bio" },
    ];
    return (
      <div className="space-y-5">
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Pull these figures from <span style={{ color: "var(--text-2)" }}>Meta Business Suite → Insights</span> for the event window.
        </p>
        <div className="grid grid-cols-2 gap-5">
          {metricFields.map((field) => (
            <div key={field.label} className="step-row">
              <label className="field-label">{field.label}</label>
              <input type="text" className="input-field" placeholder={field.placeholder} />
              <p className="text-[9px] mt-1.5" style={{ color: "var(--text-3)" }}>{field.hint}</p>
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
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
        <div className="step-row">
          <label className="field-label">
            Event Photos — {photoCount > 0 ? `${photoCount} uploaded` : "none uploaded yet"}
          </label>
          <div className="upload-zone" onClick={() => photoInputRef.current?.click()}>
            <GalleryHorizontal size={22} strokeWidth={1} style={{ color: "var(--text-3)" }} />
            <span className="upload-zone-label">Click to upload event photos</span>
            <span className="upload-zone-hint">Select multiple — JPG, PNG, WEBP</span>
          </div>
        </div>

        {photoCount > 0 ? (
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: Math.min(photoCount, 8) }).map((_, i) => (
              <div
                key={i}
                className="relative border border-black/[0.08] rounded-lg flex items-center justify-center"
                style={{ aspectRatio: "1", background: "rgba(0,0,0,0.03)" }}
              >
                <span className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
                  Photo {i + 1}
                </span>
                <div className="absolute top-1.5 right-1.5">
                  <ScanLine size={9} strokeWidth={1.5} style={{ color: "var(--text-3)" }} />
                </div>
              </div>
            ))}
            {photoCount > 8 && (
              <div
                className="flex items-center justify-center border border-black/[0.06] rounded-lg"
                style={{ aspectRatio: "1", background: "rgba(0,0,0,0.02)" }}
              >
                <span className="text-[10px]" style={{ color: "var(--text-3)" }}>+{photoCount - 8} more</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5 opacity-30 pointer-events-none select-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-black/[0.06] rounded-lg" style={{ aspectRatio: "1", background: "rgba(0,0,0,0.02)" }} />
            ))}
          </div>
        )}

        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          After uploading, you'll be able to reorder and crop each photo individually. Photos are laid out across the gallery slides automatically.
        </p>
      </div>
    );
  }

  // ── Step 08 — Review & Export ──
  if (stepIndex === 7) {
    const summaryItems = [
      { label: "Event",        value: "Not set" },
      { label: "Template",     value: "Not selected" },
      { label: "Partners",     value: "1 selected" },
      { label: "Cover Image",  value: "Not uploaded" },
      { label: "Header Image", value: "Not uploaded" },
      { label: "Event Date",   value: "Not set" },
      { label: "Venue",        value: "Not set" },
      { label: "Photos",       value: "0 uploaded" },
      { label: "Metrics",      value: "Not entered" },
    ];
    return (
      <div className="space-y-6">
        <div className="border border-black/[0.08] rounded-xl overflow-hidden">
          {summaryItems.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: i < summaryItems.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
            >
              <span className="text-[10px] tracking-[0.14em] uppercase" style={{ color: "var(--text-3)" }}>
                {item.label}
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>
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
          <p className="text-center text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--text-3)" }}>
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
  const [step, setStep]           = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = (target: number) => {
    if (target < 0 || target >= STEPS.length) return;
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const currentStep = STEPS[step];
  const StepIcon    = currentStep.icon;
  const progress    = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* ── Ambient glow ─────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 80% 45% at 50% -5%, rgba(201,169,110,0.11) 0%, transparent 65%)",
            "radial-gradient(ellipse 50% 30% at 50% 0%, rgba(201,169,110,0.06) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      {/* ── Top nav bar ───────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 h-14 flex items-center gap-4">

          {/* TEN wordmark */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <span className="font-bebas text-[20px] tracking-[0.18em] leading-none" style={{ color: "var(--text-1)" }}>
              TEN
            </span>
            <div className="h-4 w-px" style={{ background: "var(--border-mid)" }} />
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 transition-colors"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.18em] uppercase">Dashboard</span>
          </Link>

          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          <span className="text-[10px] tracking-[0.18em] uppercase font-medium" style={{ color: "var(--text-1)" }}>
            New Report
          </span>

          {/* Progress bar (right) */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[9px] tracking-[0.18em] uppercase hidden sm:block" style={{ color: "var(--text-3)" }}>
              {step + 1} / {STEPS.length}
            </span>
            <div
              className="hidden sm:block rounded-full overflow-hidden"
              style={{ width: "80px", height: "2px", background: "rgba(0,0,0,0.08)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--champagne)" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Page body ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full pt-24 pb-32 px-6">

        {/* ── Horizontal step rail ──────────────────────────── */}
        <div className="w-full max-w-[860px] mb-10">
          <div className="flex items-start gap-0">
            {STEPS.map((s, i) => {
              const SIcon   = s.icon;
              const isActive = i === step;
              const isDone   = i < step;
              return (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="flex-1 flex flex-col items-center gap-2 group"
                  style={{ cursor: "pointer" }}
                >
                  {/* Line + node */}
                  <div className="w-full flex items-center">
                    {/* Left connector */}
                    <div
                      className="flex-1 transition-all duration-500"
                      style={{
                        height: "1px",
                        background: i === 0
                          ? "transparent"
                          : isDone || isActive
                            ? "rgba(122,80,16,0.4)"
                            : "rgba(0,0,0,0.1)",
                      }}
                    />
                    {/* Node */}
                    <motion.div
                      animate={{
                        scale: isActive ? 1.15 : 1,
                        background: isDone
                          ? "rgba(122,80,16,0.12)"
                          : isActive
                            ? "rgba(122,80,16,0.1)"
                            : "rgba(0,0,0,0.04)",
                        borderColor: isDone
                          ? "rgba(122,80,16,0.5)"
                          : isActive
                            ? "var(--champagne)"
                            : "rgba(0,0,0,0.12)",
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center shrink-0"
                    >
                      {isDone ? (
                        <Check size={11} strokeWidth={2.5} style={{ color: "var(--champagne)" }} />
                      ) : (
                        <SIcon
                          size={12}
                          strokeWidth={1.5}
                          style={{ color: isActive ? "var(--champagne)" : "var(--text-3)" }}
                        />
                      )}
                    </motion.div>
                    {/* Right connector */}
                    <div
                      className="flex-1 transition-all duration-500"
                      style={{
                        height: "1px",
                        background: i === STEPS.length - 1
                          ? "transparent"
                          : isDone
                            ? "rgba(122,80,16,0.4)"
                            : "rgba(0,0,0,0.1)",
                      }}
                    />
                  </div>
                  {/* Label — only show active + adjacent on small screens */}
                  <span
                    className="text-[8px] tracking-[0.16em] uppercase text-center leading-tight transition-colors duration-200 hidden sm:block"
                    style={{
                      color: isActive ? "var(--text-1)" : isDone ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.2)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Wizard card ───────────────────────────────────── */}
        <div className="w-full max-w-[860px]" style={{ minHeight: "500px", position: "relative" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="module-card module-card-active w-full"
              style={{ background: "var(--surface)" }}
            >
              {/* ── Card header ──────────────────────────────── */}
              <div
                className="px-10 pt-9 pb-7 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: "linear-gradient(to bottom, rgba(201,169,110,0.04), transparent)",
                }}
              >
                <div className="flex items-start gap-5">
                  {/* Icon block */}
                  <div
                    className="w-12 h-12 flex items-center justify-center shrink-0 rounded-xl border"
                    style={{
                      background: "rgba(122,80,16,0.07)",
                      borderColor: "rgba(122,80,16,0.22)",
                      boxShadow: "0 4px 14px rgba(122,80,16,0.12)",
                    }}
                  >
                    <StepIcon size={18} strokeWidth={1.2} style={{ color: "var(--champagne)" }} />
                  </div>

                  {/* Title block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span
                        className="font-bebas text-[11px] tracking-[0.32em] leading-none"
                        style={{ color: "var(--champagne)", opacity: 0.8 }}
                      >
                        {currentStep.number}
                      </span>
                      <div className="h-px w-5" style={{ background: "rgba(122,80,16,0.25)" }} />
                      <span className="text-[9px] tracking-[0.22em] uppercase" style={{ color: "var(--text-3)" }}>
                        of {STEPS.length} steps
                      </span>
                    </div>
                    <h1
                      className="font-bebas tracking-wide leading-none mb-1.5"
                      style={{ fontSize: "clamp(28px, 3.5vw, 38px)", color: "var(--text-1)" }}
                    >
                      {currentStep.title}
                    </h1>
                    <p
                      className="text-[11px] tracking-[0.08em] leading-relaxed max-w-[520px]"
                      style={{ color: "var(--text-3)" }}
                    >
                      {currentStep.description}
                    </p>
                  </div>

                  {/* Step fraction (top right) */}
                  <div
                    className="shrink-0 px-3 py-1.5 rounded-full border text-[9px] tracking-[0.18em] uppercase font-medium hidden md:flex items-center"
                    style={{
                      borderColor: "rgba(122,80,16,0.22)",
                      color: "var(--champagne)",
                      background: "rgba(122,80,16,0.05)",
                    }}
                  >
                    {step + 1} / {STEPS.length}
                  </div>
                </div>
              </div>

              {/* ── Card body ────────────────────────────────── */}
              <div className="px-10 py-8">
                <StepContent stepIndex={step} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Fixed bottom navigation ───────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-[1440px] mx-auto px-8 md:px-16 h-16 flex items-center justify-between">

          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase transition-all duration-200"
            style={{
              color: step === 0 ? "rgba(0,0,0,0.2)" : "var(--text-2)",
              cursor: step === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Back
          </button>

          {/* Center — step label */}
          <span className="text-[10px] tracking-[0.18em] uppercase hidden lg:block" style={{ color: "var(--text-3)" }}>
            {currentStep.title} — {currentStep.subtitle}
          </span>

          {/* Mobile dots */}
          <div className="flex gap-1.5 lg:hidden">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? "16px" : "5px",
                  height: "5px",
                  background: i === step
                    ? "var(--champagne)"
                    : i < step
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(0,0,0,0.08)",
                }}
              />
            ))}
          </div>

          {/* Continue / Finish */}
          {step < STEPS.length - 1 ? (
            <button onClick={() => goTo(step + 1)} className="btn-primary gap-2">
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
