"use client";

/* ─── Reports Preview ───────────────────────────────────────────────────
   A fake document builder UI mockup
──────────────────────────────────────────────────────────────────────── */
export function ReportsPreview() {
  return (
    <div className="w-full space-y-4 font-sans">
      {/* Mock toolbar */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
        <div className="preview-block h-6 w-24 rounded-sm opacity-60" />
        <div className="preview-block h-6 w-16 rounded-sm opacity-40" />
        <div className="preview-block h-6 w-20 rounded-sm opacity-40" />
        <div className="ml-auto preview-block h-6 w-28 rounded-sm opacity-60" style={{ background: "rgba(224, 85, 53, 0.2)" }} />
      </div>

      {/* Mock report fields */}
      <div className="space-y-3">
        {/* Event name field */}
        <div>
          <div className="text-[9px] tracking-[0.2em] text-white/20 uppercase mb-1.5">
            Event Name
          </div>
          <div className="h-8 border border-white/[0.06] flex items-center px-3">
            <span className="text-[11px] text-white/40">Lone Star Supercars 2026</span>
          </div>
        </div>

        {/* Partner field */}
        <div>
          <div className="text-[9px] tracking-[0.2em] text-white/20 uppercase mb-1.5">
            Partner
          </div>
          <div className="h-8 border border-white/[0.06] flex items-center px-3">
            <span className="text-[11px] text-white/40">COTA</span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Views", value: "57.6M+" },
            { label: "Likes", value: "4.36M+" },
            { label: "Reach", value: "3.64M+" },
          ].map((m) => (
            <div key={m.label} className="border border-white/[0.05] p-2.5 text-center">
              <div className="text-[11px] text-white/50 font-medium mb-0.5">
                {m.value}
              </div>
              <div className="text-[8px] text-white/20 tracking-widest uppercase">
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="pt-2 space-y-2">
          <div className="flex justify-between">
            <span className="text-[9px] text-white/20 tracking-widest uppercase">
              Generation Progress
            </span>
            <span className="text-[9px] text-white/30">—</span>
          </div>
          <div className="h-px bg-white/[0.06] relative overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full"
              style={{
                width: "0%",
                background: "#E05535",
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="pt-3 flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-white/15" />
        <span className="text-[9px] text-white/15 tracking-widest uppercase">
          Ready — 27 slides
        </span>
      </div>
    </div>
  );
}

/* ─── Guides Preview ────────────────────────────────────────────────────
   A fake guide/document page mockup
──────────────────────────────────────────────────────────────────────── */
export function GuidesPreview() {
  return (
    <div className="w-full space-y-4 font-sans">
      {/* Mock page layout */}
      <div className="border border-white/[0.06] p-4 space-y-3">
        {/* Header area */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
          <div className="space-y-1.5">
            <div className="preview-block h-3 w-32" />
            <div className="preview-block h-2 w-20 opacity-50" />
          </div>
          <div
            className="h-8 w-8 border border-white/[0.06] flex items-center justify-center"
          >
            <div className="w-3 h-3 border border-white/20" />
          </div>
        </div>

        {/* Content blocks */}
        <div className="space-y-2">
          <div className="preview-block h-2 w-full" />
          <div className="preview-block h-2 w-4/5 opacity-60" />
          <div className="preview-block h-2 w-full opacity-80" />
          <div className="preview-block h-2 w-3/5 opacity-50" />
        </div>

        {/* Image placeholder */}
        <div className="h-16 border border-dashed border-white/[0.06] flex items-center justify-center">
          <span className="text-[9px] text-white/15 tracking-widest uppercase">
            Cover Image
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1.5">
            <div className="preview-block h-2 w-full opacity-70" />
            <div className="preview-block h-2 w-4/5 opacity-50" />
            <div className="preview-block h-2 w-full opacity-60" />
          </div>
          <div className="space-y-1.5">
            <div className="preview-block h-2 w-3/4 opacity-60" />
            <div className="preview-block h-2 w-full opacity-70" />
            <div className="preview-block h-2 w-4/5 opacity-50" />
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-white/15" />
        <span className="text-[9px] text-white/15 tracking-widest uppercase">
          Coming soon
        </span>
      </div>
    </div>
  );
}

/* ─── Emails Preview ────────────────────────────────────────────────────
   A fake email composer mockup
──────────────────────────────────────────────────────────────────────── */
export function EmailsPreview() {
  return (
    <div className="w-full space-y-4 font-sans">
      {/* Email composer */}
      <div className="border border-white/[0.06] overflow-hidden">
        {/* Address bar */}
        {[
          { label: "To", value: "partner@cota.com" },
          { label: "Subject", value: "Lone Star Supercars 2026 — Event Report" },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05]"
          >
            <span className="text-[9px] text-white/20 tracking-widest uppercase w-12 shrink-0">
              {row.label}
            </span>
            <span className="text-[11px] text-white/35">{row.value}</span>
          </div>
        ))}

        {/* Body */}
        <div className="p-4 space-y-2 min-h-[100px]">
          <div className="preview-block h-2 w-full opacity-70" />
          <div className="preview-block h-2 w-4/5 opacity-50" />
          <div className="preview-block h-2 w-full opacity-60" />
          <div className="preview-block h-2 w-2/3 opacity-40" />
          <div className="h-3" />
          <div className="preview-block h-2 w-3/5 opacity-50" />
          <div className="preview-block h-2 w-4/5 opacity-40" />
        </div>

        {/* Attachment */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.05] bg-white/[0.01]">
          <div className="w-4 h-5 border border-white/10 flex items-center justify-center">
            <div className="w-2 h-1.5 border-t border-white/20" />
          </div>
          <span className="text-[9px] text-white/20 tracking-wide">
            COTA_EventReport_2026.pdf
          </span>
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-white/15" />
        <span className="text-[9px] text-white/15 tracking-widest uppercase">
          Coming soon
        </span>
      </div>
    </div>
  );
}
