"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaPost {
  name: string; date: string; views: string; reach: string;
  likes: string; shares: string; comments: string; saves: string;
}
interface Testimonial { quote: string; attribution: string; }
interface GallerySection { title: string; photos: string[]; }
interface GuestRow { full_name: string; email: string; exotic_car: string; }

interface WizardState {
  // Step 1 — Identity
  event_name: string;
  partners: string;           // newline-separated list for batch

  // Step 2 — Intro
  intro_body: string;

  // Step 3 — Overview
  overview_text: string;
  retention_text: string;
  stat_guests: string;
  stat_cars: string;
  stat_car_value: string;
  stat_content_units: string;

  // Step 4 — Digital Campaign
  campaign_subtitle: string;
  campaign_description: string;
  total_views: string; total_reach: string; total_likes: string;
  total_shares: string; total_comments: string; total_saves: string;
  posts_csv: string;          // raw CSV pasted by user

  // Step 5 — Testimonials
  testimonials: Testimonial[];

  // Step 6 — Gallery (not file upload in MVP — paths typed/pasted)
  gallery_sections: GallerySection[];

  // Step 7 — Content Creation
  photo_album_url: string;
  photo_album_label: string;
  social_content_count: string;

  // Step 8 — Guest Data
  guests_csv: string;         // raw CSV: full_name,email,exotic_car
}

const EMPTY_TESTIMONIALS: Testimonial[] = Array(5).fill(null).map(() => ({
  quote: "", attribution: "",
}));

const EMPTY_GALLERY: GallerySection[] = [
  { title: "The Starting Grid", photos: [] },
  { title: "The Rally", photos: [] },
  { title: "The Main Event", photos: [] },
];

const INITIAL: WizardState = {
  event_name: "", partners: "",
  intro_body: "",
  overview_text: "", retention_text: "",
  stat_guests: "", stat_cars: "", stat_car_value: "", stat_content_units: "",
  campaign_subtitle: "", campaign_description: "",
  total_views: "", total_reach: "", total_likes: "",
  total_shares: "", total_comments: "", total_saves: "",
  posts_csv: "",
  testimonials: EMPTY_TESTIMONIALS,
  gallery_sections: EMPTY_GALLERY,
  photo_album_url: "", photo_album_label: "", social_content_count: "",
  guests_csv: "",
};

const STEPS = [
  "Event & Partners",
  "Introduction",
  "Overview & Stats",
  "Digital Campaign",
  "Testimonials",
  "Gallery",
  "Content",
  "Guest Data",
];

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsvRows(csv: string, keys: string[]): Record<string, string>[] {
  return csv
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      // Simple CSV: split on comma, respect quoted fields
      const cols: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of l) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      const row: Record<string, string> = {};
      keys.forEach((k, i) => { row[k] = cols[i] ?? ""; });
      return row;
    });
}

// ── Build manifest ────────────────────────────────────────────────────────────

function buildManifest(s: WizardState, partnerName: string): object {
  const posts = parseCsvRows(s.posts_csv,
    ["name", "date", "views", "reach", "likes", "shares", "comments", "saves"]);

  const guests = parseCsvRows(s.guests_csv, ["full_name", "email", "exotic_car"]);

  return {
    event_name:   s.event_name.trim(),
    partner_name: partnerName.trim(),
    intro_body:   s.intro_body.trim(),
    overview_text:   s.overview_text.trim(),
    retention_text:  s.retention_text.trim(),
    stats: {
      guests:        s.stat_guests.trim()        || "~500",
      cars:          s.stat_cars.trim()          || "70",
      car_value:     s.stat_car_value.trim()     || "~$25M",
      content_units: s.stat_content_units.trim() || "~100",
    },
    campaign_subtitle:   s.campaign_subtitle.trim(),
    campaign_description: s.campaign_description.trim(),
    meta_headline: {
      total_views:    s.total_views.trim(),
      total_reach:    s.total_reach.trim(),
      total_likes:    s.total_likes.trim(),
      total_shares:   s.total_shares.trim(),
      total_comments: s.total_comments.trim(),
      total_saves:    s.total_saves.trim(),
    },
    meta_posts: posts,
    testimonials: s.testimonials.filter(t => t.quote.trim()),
    gallery_sections: s.gallery_sections.map(g => ({
      title:  g.title,
      photos: g.photos.filter(p => p.trim()),
    })),
    photo_album_url:      s.photo_album_url.trim(),
    photo_album_label:    s.photo_album_label.trim(),
    social_content_count: s.social_content_count.trim() || "0",
    guests,
  };
}

// ── Asset types ───────────────────────────────────────────────────────────────

interface AssetFiles {
  template:  File | null;   // previous event PPTX
  cover:     File | null;   // new cover background photo
  title_png: File | null;   // event title PNG overlay
}

interface AssetPaths {
  template:  string;
  cover:     string;
  title_png: string;
  session_id: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.5)] mb-1">
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]
        rounded px-3 py-2 text-sm text-white placeholder-[rgba(255,255,255,0.25)]
        focus:outline-none focus:border-[rgba(201,169,110,0.6)] transition-colors ${className}`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]
        rounded px-3 py-2 text-sm text-white placeholder-[rgba(255,255,255,0.25)]
        focus:outline-none focus:border-[rgba(201,169,110,0.6)] transition-colors resize-y font-mono"
    />
  );
}

function FileDropZone({
  label,
  accept,
  hint,
  file,
  onFile,
}: {
  label: string;
  accept: string;
  hint: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div>
      <Label>{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-4 py-5 cursor-pointer transition-colors
          ${dragging
            ? "border-[rgba(201,169,110,0.7)] bg-[rgba(201,169,110,0.08)]"
            : file
              ? "border-[rgba(201,169,110,0.4)] bg-[rgba(201,169,110,0.05)]"
              : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.25)]"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        {file ? (
          <>
            <span className="text-[rgba(201,169,110,0.9)] text-sm font-medium truncate max-w-full px-2">
              ✓ {file.name}
            </span>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
              {(file.size / 1024 / 1024).toFixed(1)} MB — click to replace
            </span>
          </>
        ) : (
          <>
            <span className="text-[rgba(255,255,255,0.5)] text-sm">
              Drop file here or <span className="text-[rgba(201,169,110,0.8)] underline">browse</span>
            </span>
            <span className="text-[10px] text-[rgba(255,255,255,0.25)]">{hint}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step panels ───────────────────────────────────────────────────────────────

function Step1({
  s, set, assets, setAsset,
}: {
  s: WizardState;
  set: (k: keyof WizardState, v: unknown) => void;
  assets: AssetFiles;
  setAsset: (k: keyof AssetFiles, f: File) => void;
}) {
  return (
    <div className="space-y-6">
      {/* ── File assets ── */}
      <div className="space-y-4">
        <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed">
          Upload the <strong className="text-white">previous event's report</strong> as your base template,
          then provide the new event's cover photo and title PNG. These are applied to the cover slide before
          all other content is replaced.
        </p>

        <FileDropZone
          label="Previous Event Report (PPTX) *"
          accept=".pptx"
          hint="The last completed TEN event report — used as the structural base"
          file={assets.template}
          onFile={f => setAsset("template", f)}
        />

        <div className="grid grid-cols-2 gap-4">
          <FileDropZone
            label="Cover Photo"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            hint="Full-bleed background for slide 1"
            file={assets.cover}
            onFile={f => setAsset("cover", f)}
          />
          <FileDropZone
            label="Event Title PNG"
            accept=".png"
            hint="Transparent PNG — styled event name overlay"
            file={assets.title_png}
            onFile={f => setAsset("title_png", f)}
          />
        </div>
      </div>

      <hr className="border-[rgba(255,255,255,0.07)]" />

      {/* ── Event identity ── */}
      <div>
        <Label>Event Name</Label>
        <Input value={s.event_name} onChange={v => set("event_name", v)}
          placeholder="e.g. Lone Star Supercars 2026" />
      </div>
      <div>
        <Label>Partner Name(s) — one per line for batch generation</Label>
        <Textarea rows={5} value={s.partners} onChange={v => set("partners", v)}
          placeholder={"COTA\nDouble R Ranch\nFrontline Heroes Outdoors"} />
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-1">
          Each line generates a separate tailored report. All share the same event data below.
        </p>
      </div>
    </div>
  );
}

function Step2({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Introduction Letter Body</Label>
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mb-2">
          Separate paragraphs with a blank line. The "TO THE [PARTNER] TEAM," salutation is auto-generated.
        </p>
        <Textarea rows={14} value={s.intro_body} onChange={v => set("intro_body", v)}
          placeholder={"There's something special about an event...\n\nBut what stayed with us most wasn't the cars..."} />
      </div>
    </div>
  );
}

function Step3({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Guests (~500)</Label>
          <Input value={s.stat_guests} onChange={v => set("stat_guests", v)} placeholder="~500" /></div>
        <div><Label>Exotic Cars</Label>
          <Input value={s.stat_cars} onChange={v => set("stat_cars", v)} placeholder="70" /></div>
        <div><Label>Est. Car Value</Label>
          <Input value={s.stat_car_value} onChange={v => set("stat_car_value", v)} placeholder="~$25M" /></div>
        <div><Label>Content Units</Label>
          <Input value={s.stat_content_units} onChange={v => set("stat_content_units", v)} placeholder="~100" /></div>
      </div>
      <div>
        <Label>Overview Paragraph</Label>
        <Textarea rows={5} value={s.overview_text} onChange={v => set("overview_text", v)}
          placeholder="Lone Star Supercars 2026 showed us exactly what TEN looks like…" />
      </div>
      <div>
        <Label>Attendee Retention Analytics Paragraph</Label>
        <Textarea rows={5} value={s.retention_text} onChange={v => set("retention_text", v)}
          placeholder="Lone Star Supercars 2026 brought together one of the strongest Texas crowds…" />
      </div>
    </div>
  );
}

function Step4({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Campaign Headline</Label>
        <Input value={s.campaign_subtitle} onChange={v => set("campaign_subtitle", v)}
          placeholder="TEN'S LARGEST DIGITAL CAMPAIGN YET" />
      </div>
      <div>
        <Label>Campaign Description</Label>
        <Textarea rows={3} value={s.campaign_description} onChange={v => set("campaign_description", v)}
          placeholder="The following analytics represent the aggregate metrics…" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["total_views","total_reach","total_likes","total_shares","total_comments","total_saves"] as const).map(k => (
          <div key={k}>
            <Label>{k.replace("total_","").replace("_"," ")}</Label>
            <Input value={s[k]} onChange={v => set(k, v)} placeholder="57.6M+" />
          </div>
        ))}
      </div>
      <div>
        <Label>Post Table — CSV (name, date, views, reach, likes, shares, comments, saves)</Label>
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mb-2">
          One post per line. No header row. Up to 98 posts (7 pages × 14 rows).
        </p>
        <Textarea rows={10} value={s.posts_csv} onChange={v => set("posts_csv", v)}
          placeholder={"Lone Star Supercars 2026 Reel, Mar 14, 8200000, 620000, 41000, 12000, 890, 3400\nTEN Texas Convoy Highlights, Mar 15, 3100000, …"} />
      </div>
    </div>
  );
}

function Step5({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  const updateT = (i: number, field: keyof Testimonial, val: string) => {
    const t = [...s.testimonials];
    t[i] = { ...t[i], [field]: val };
    set("testimonials", t);
  };
  return (
    <div className="space-y-6">
      <p className="text-[11px] text-[rgba(255,255,255,0.4)]">
        5 frosted-glass bars top → bottom. Unused bars are hidden automatically.
      </p>
      {s.testimonials.map((t, i) => (
        <div key={i} className="border border-[rgba(255,255,255,0.08)] rounded-lg p-4 space-y-3">
          <p className="text-xs text-[rgba(201,169,110,0.8)] font-bebas tracking-widest">
            Bar {i + 1}
          </p>
          <div>
            <Label>Quote</Label>
            <Textarea rows={3} value={t.quote} onChange={v => updateT(i, "quote", v)}
              placeholder="Such an amazing day and event! Honored we were a part of it!!" />
          </div>
          <div>
            <Label>Attribution</Label>
            <Input value={t.attribution} onChange={v => updateT(i, "attribution", v)}
              placeholder="– Preston Wall (President, Frontline Heroes Outdoors)" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Step6({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  const updateSection = (i: number, field: keyof GallerySection, val: unknown) => {
    const gs = [...s.gallery_sections];
    gs[i] = { ...gs[i], [field]: val };
    set("gallery_sections", gs);
  };
  return (
    <div className="space-y-6">
      <p className="text-[11px] text-[rgba(255,255,255,0.4)]">
        3 gallery sections (2 slides each for sections 1-2, 3 slides for section 3).
        Enter absolute file paths to your photos — one per line.
      </p>
      {s.gallery_sections.map((g, i) => (
        <div key={i} className="border border-[rgba(255,255,255,0.08)] rounded-lg p-4 space-y-3">
          <div>
            <Label>Section {i + 1} Title</Label>
            <Input value={g.title} onChange={v => updateSection(i, "title", v)}
              placeholder={["The Starting Grid","The Rally","The Main Event"][i]} />
          </div>
          <div>
            <Label>Photo Paths (one per line, max {i < 2 ? 16 : 21})</Label>
            <Textarea rows={6}
              value={g.photos.join("\n")}
              onChange={v => updateSection(i, "photos", v.split("\n"))}
              placeholder={"/Users/you/Photos/event/grid-01.jpg\n/Users/you/Photos/event/grid-02.jpg"} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Step7({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Photo Album URL</Label>
        <Input value={s.photo_album_url} onChange={v => set("photo_album_url", v)}
          placeholder="https://drive.google.com/drive/folders/…" />
      </div>
      <div>
        <Label>Photo Album Button Label</Label>
        <Input value={s.photo_album_label} onChange={v => set("photo_album_label", v)}
          placeholder="Lone Star Supercars 2026 Event Photo Album" />
      </div>
      <div>
        <Label>Social Media Content Count</Label>
        <Input value={s.social_content_count} onChange={v => set("social_content_count", v)}
          placeholder="120" />
      </div>
    </div>
  );
}

function Step8({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Guest List — CSV (full_name, email, exotic_car)</Label>
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] mb-2">
          No header row. Up to 105 guests (7 pages × 15 rows). Paste from spreadsheet.
        </p>
        <Textarea rows={14} value={s.guests_csv} onChange={v => set("guests_csv", v)}
          placeholder={"John Smith, john@example.com, Lamborghini Huracán\nJane Doe, jane@example.com, Ferrari 488"} />
      </div>
    </div>
  );
}

// ── Progress overlay ──────────────────────────────────────────────────────────

function ProgressOverlay({
  partners,
  progress,
  overall,
  done,
  downloadUrl,
  error,
  onClose,
}: {
  partners: string[];
  progress: Record<string, { pct: number; step: string }>;
  overall: number;
  done: boolean;
  downloadUrl: string;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.85)]">
      <div className="w-full max-w-lg bg-[#111] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 space-y-6">
        <h2 className="font-bebas tracking-widest text-2xl text-[rgba(201,169,110,0.9)]">
          Generating Reports
        </h2>

        {/* Overall bar */}
        <div>
          <div className="flex justify-between text-xs text-[rgba(255,255,255,0.4)] mb-1">
            <span>Overall</span><span>{overall}%</span>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[rgba(201,169,110,0.8)] rounded-full transition-all duration-300"
              style={{ width: `${overall}%` }}
            />
          </div>
        </div>

        {/* Per-partner progress */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {partners.map(p => {
            const info = progress[p] ?? { pct: 0, step: "Waiting…" };
            return (
              <div key={p}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-white truncate max-w-[70%]">{p}</span>
                  <span className="text-[rgba(255,255,255,0.4)]">{info.pct}%</span>
                </div>
                <div className="h-1 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[rgba(201,169,110,0.5)] rounded-full transition-all duration-300"
                    style={{ width: `${info.pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5 truncate">{info.step}</p>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-[rgba(255,0,0,0.08)] rounded p-3">{error}</p>
        )}

        {done && !error && (
          <div className="space-y-3">
            <p className="text-[rgba(201,169,110,0.9)] text-sm">All reports generated!</p>
            <a
              href={downloadUrl}
              className="block w-full text-center py-3 rounded-lg bg-[rgba(201,169,110,0.15)]
                border border-[rgba(201,169,110,0.4)] text-[rgba(201,169,110,0.9)] text-sm
                hover:bg-[rgba(201,169,110,0.25)] transition-colors"
            >
              Download ZIP
            </a>
          </div>
        )}

        {(done || error) && (
          <button
            onClick={onClose}
            className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function ReportWizard() {
  const [step, setStep]   = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);

  // ── Asset files (held in component state — uploaded just before generation)
  const [assets, setAssets] = useState<AssetFiles>({
    template: null, cover: null, title_png: null,
  });
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError]   = useState("");

  const [generating, setGenerating] = useState(false);
  const [partnerProgress, setPartnerProgress] = useState<Record<string, { pct: number; step: string }>>({});
  const [overall, setOverall]         = useState(0);
  const [done, setDone]               = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [genError, setGenError]       = useState("");

  const set = (k: keyof WizardState, v: unknown) =>
    setState(prev => ({ ...prev, [k]: v }));

  const setAsset = (k: keyof AssetFiles, f: File) =>
    setAssets(prev => ({ ...prev, [k]: f }));

  const partners = state.partners
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const canGenerate = state.event_name.trim() && partners.length > 0 && !!assets.template;

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setDone(false);
    setDownloadUrl("");
    setGenError("");
    setOverall(0);
    setUploadError("");

    // ── Step A: Upload asset files ──────────────────────────────────────────
    let assetPaths: Partial<AssetPaths> = {};
    setUploadStatus("uploading");

    try {
      const form = new FormData();
      form.append("template",  assets.template!);
      if (assets.cover)     form.append("cover",     assets.cover);
      if (assets.title_png) form.append("title_png", assets.title_png);

      const upRes = await fetch("/api/upload-assets", { method: "POST", body: form });
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      assetPaths = await upRes.json();
      setUploadStatus("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadError(msg);
      setUploadStatus("error");
      setGenerating(false);
      return;
    }

    // ── Step B: Kick off batch generation ───────────────────────────────────
    const init: Record<string, { pct: number; step: string }> = {};
    partners.forEach(p => { init[p] = { pct: 0, step: "Queued…" }; });
    setPartnerProgress(init);

    const body = {
      event_base:    buildManifest(state, "__placeholder__"),
      partners:      partners.map(name => ({ name })),
      template_path: assetPaths.template,
      cover_path:    assetPaths.cover    ?? null,
      title_png_path: assetPaths.title_png ?? null,
    };
    // Remove partner_name from event_base (it's set per-partner by the API)
    delete (body.event_base as Record<string, unknown>).partner_name;

    const res = await fetch("/api/batch-generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    const reader = res.body!.getReader();
    const dec    = new TextDecoder();
    let buf      = "";

    while (true) {
      const { done: rd, value } = await reader.read();
      if (rd) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.startsWith("data:")) continue;
        try {
          const evt = JSON.parse(part.slice("data:".length).trim());
          if (evt.overall !== undefined)  setOverall(evt.overall);
          if (evt.partner && evt.pct !== undefined) {
            setPartnerProgress(prev => ({
              ...prev,
              [evt.partner]: { pct: evt.pct, step: evt.step ?? "" },
            }));
          }
          if (evt.done) { setDone(true); setDownloadUrl(evt.file); }
          if (evt.error) setGenError(evt.error);
        } catch {}
      }
    }
  }

  const stepComponents = [
    <Step1 key={0} s={state} set={set} assets={assets} setAsset={setAsset} />,
    <Step2 key={1} s={state} set={set} />,
    <Step3 key={2} s={state} set={set} />,
    <Step4 key={3} s={state} set={set} />,
    <Step5 key={4} s={state} set={set} />,
    <Step6 key={5} s={state} set={set} />,
    <Step7 key={6} s={state} set={set} />,
    <Step8 key={7} s={state} set={set} />,
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {generating && (
        <ProgressOverlay
          partners={partners}
          progress={partnerProgress}
          overall={overall}
          done={done}
          downloadUrl={downloadUrl}
          error={genError}
          onClose={() => setGenerating(false)}
        />
      )}

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[rgba(201,169,110,0.7)] mb-2">
            New Report
          </p>
          <h1 className="font-bebas text-5xl tracking-wide" style={{ color: "var(--text-1)" }}>
            Report Generator
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-8 flex-wrap">
          {STEPS.map((label, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${
                i === step
                  ? "bg-[rgba(201,169,110,0.2)] text-[rgba(201,169,110,0.9)] border border-[rgba(201,169,110,0.4)]"
                  : "text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)]"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)]
          rounded-2xl p-7 mb-6">
          <h2 className="font-bebas text-2xl tracking-widest text-[rgba(201,169,110,0.8)] mb-6">
            Step {step + 1} — {STEPS[step]}
          </h2>
          {stepComponents[step]}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-lg text-sm border border-[rgba(255,255,255,0.1)]
              text-[rgba(255,255,255,0.5)] hover:text-white hover:border-[rgba(255,255,255,0.3)]
              transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="px-5 py-2.5 rounded-lg text-sm bg-[rgba(255,255,255,0.07)]
                border border-[rgba(255,255,255,0.15)] text-white
                hover:bg-[rgba(255,255,255,0.12)] transition-colors"
            >
              Next →
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {!assets.template && (
                <p className="text-[11px] text-[rgba(255,120,120,0.8)]">
                  ← Upload the template PPTX on Step 1 to generate
                </p>
              )}
              {uploadStatus === "uploading" && (
                <p className="text-[11px] text-[rgba(201,169,110,0.7)]">Uploading assets…</p>
              )}
              {uploadError && (
                <p className="text-[11px] text-red-400">{uploadError}</p>
              )}
              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="px-8 py-2.5 rounded-lg text-sm font-medium transition-colors
                  bg-[rgba(201,169,110,0.15)] border border-[rgba(201,169,110,0.5)]
                  text-[rgba(201,169,110,0.9)] hover:bg-[rgba(201,169,110,0.25)]
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {generating
                  ? uploadStatus === "uploading" ? "Uploading…" : "Generating…"
                  : `Generate ${partners.length > 1 ? `${partners.length} Reports` : "Report"} →`
                }
              </button>
            </div>
          )}
        </div>

        {/* Summary card */}
        {partners.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-[rgba(255,255,255,0.06)]
            bg-[rgba(255,255,255,0.02)] text-xs text-[rgba(255,255,255,0.35)] space-y-1">
            <p><span className="text-[rgba(255,255,255,0.5)]">Event:</span> {state.event_name || "—"}</p>
            <p><span className="text-[rgba(255,255,255,0.5)]">Partners:</span> {partners.join(", ")}</p>
            <p><span className="text-[rgba(255,255,255,0.5)]">Posts:</span> {state.posts_csv.split("\n").filter(Boolean).length}</p>
            <p><span className="text-[rgba(255,255,255,0.5)]">Guests:</span> {state.guests_csv.split("\n").filter(Boolean).length}</p>
          </div>
        )}
      </div>
    </div>
  );
}
