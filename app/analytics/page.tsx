"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { HardDrive, FolderOpen, FileType, BarChart3, RefreshCw, TrendingUp, Database, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface QuotaInfo {
  used: number; remaining: number; total: number;
  usedFormatted: string; remainingFormatted: string; totalFormatted: string;
  usedPercent: number;
}
interface EventFolder { name: string; year: string; size: number; fileCount: number; formattedSize: string; }
interface TopFolder   { name: string; size: number; childCount: number; formattedSize: string; }
interface FileType    { ext: string; count: number; bytes: number; formattedSize: string; }
interface AnalyticsData {
  personalQuota: QuotaInfo | null;
  tenDrive: { name: string; driveType: string; quota: QuotaInfo | null } | null;
  eventFolders: EventFolder[];
  topPersonalFolders: TopFolder[];
  fileTypeBreakdown: FileType[];
  year: string;
}

// ── Storage ring component ─────────────────────────────────────
function StorageRing({ percent, label, used, total }: { percent: number; label: string; used: string; total: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
          <circle
            cx="66" cy="66" r={r} fill="none"
            stroke="var(--champagne)" strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 66 66)"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bebas text-[30px] leading-none tracking-wider" style={{ color: "var(--champagne)" }}>
            {percent}%
          </span>
          <span className="text-[8px] tracking-[0.18em] uppercase mt-0.5" style={{ color: "var(--text-3)" }}>used</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold tracking-wide" style={{ color: "var(--text-1)" }}>{label}</div>
        <div className="text-[9px] tracking-[0.12em] mt-0.5" style={{ color: "var(--text-3)" }}>{used} of {total}</div>
      </div>
    </div>
  );
}

// ── Bar row component ──────────────────────────────────────────
function BarRow({ label, value, maxValue, secondary, accent = false }: {
  label: string; value: number; maxValue: number; secondary: string; accent?: boolean;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-medium truncate pr-3" style={{ color: "var(--text-1)" }}>{label}</span>
          <span className="text-[11px] shrink-0 font-mono" style={{ color: accent ? "var(--champagne)" : "var(--text-2)" }}>
            {secondary}
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{ background: accent ? "var(--champagne)" : "rgba(0,0,0,0.25)" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="module-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(var(--champ-rgb),0.1)", border: "1px solid rgba(var(--champ-rgb),0.18)" }}>
          <Icon size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
        </div>
        <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>{label}</span>
      </div>
      <div>
        <div className="font-bebas text-[32px] leading-none tracking-wider" style={{ color: "var(--text-1)" }}>{value}</div>
        {sub && <div className="text-[9px] tracking-[0.12em] mt-1" style={{ color: "var(--text-3)" }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "rgba(0,0,0,0.07)" }}
    />
  );
}

// ── FILE TYPE ICON COLORS ──────────────────────────────────────
const EXT_COLOR: Record<string, string> = {
  ".pptx": "#D83B37", ".pdf": "#FF3B30", ".docx": "#2B7CD3",
  ".xlsx": "#217346", ".jpg": "#FF9500",  ".png": "#AF52DE", ".mp4": "#FF2D55",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onedrive-analytics", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const maxEventSize = data?.eventFolders?.[0]?.size ?? 1;
  const maxFolderSize = data?.topPersonalFolders?.[0]?.size ?? 1;
  const maxFileBytes = data?.fileTypeBreakdown?.[0]?.bytes ?? 1;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(201,169,110,0.13) 0%, transparent 65%)",
            "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(201,169,110,0.07) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10">
        <Navbar />

        <div className="pt-28 pb-20 px-6 md:px-14 max-w-[1360px] mx-auto">

          {/* ── Page header ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
          >
            <div>
              <h1 className="font-bebas tracking-[0.12em] leading-none" style={{ fontSize: "clamp(42px,5vw,72px)", color: "var(--text-1)" }}>
                OneDrive Analytics
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-5 h-px" style={{ background: "var(--border-mid)" }} />
                <span className="text-[10px] tracking-[0.28em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                  Storage Intelligence — {data?.year ?? new Date().getFullYear()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-[9px] tracking-[0.16em] uppercase" style={{ color: "var(--text-3)" }}>
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] tracking-[0.14em] uppercase font-semibold transition-all"
                style={{
                  background: "var(--text-1)", color: "#fff",
                  opacity: refreshing || loading ? 0.5 : 1,
                }}
              >
                <RefreshCw size={11} strokeWidth={2} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="rule mb-10 origin-left"
          />

          {/* ── Error state ── */}
          {error && (
            <div className="module-card p-6 mb-8 flex items-center gap-4" style={{ borderColor: "rgba(220,38,38,0.2)" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#ef4444" }} />
              <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{error}</p>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
              </div>
            </div>
          )}

          {/* ── Main content ── */}
          {!loading && data && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >

                {/* ── Row 1: summary stat cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Database}    label="TEN Documents" value={`${data.eventFolders.length} Events`} sub={`${data.year} active folders`} />
                  <StatCard icon={FileType}    label="PPTX Reports"  value={`${data.fileTypeBreakdown.find(f=>f.ext===".pptx")?.count ?? "—"}`} sub="presentation files" />
                  <StatCard icon={TrendingUp}  label="Total Files"   value={data.fileTypeBreakdown.reduce((s,f)=>s+f.count,0).toString()} sub="indexed across TEN" />
                  <StatCard icon={BarChart3}   label="Storage"       value={data.tenDrive?.quota?.usedFormatted ?? data.personalQuota?.usedFormatted ?? "—"} sub="used on TEN drive" />
                </div>

                {/* ── Row 2: storage rings + event folders ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Personal quota ring */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="module-card p-6 flex flex-col gap-5"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
                      <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                        Personal OneDrive
                      </span>
                    </div>
                    <div className="flex justify-center py-2">
                      {data.personalQuota
                        ? <StorageRing percent={data.personalQuota.usedPercent} label="Personal Drive"
                            used={data.personalQuota.usedFormatted} total={data.personalQuota.totalFormatted} />
                        : <div className="text-[11px]" style={{ color: "var(--text-3)" }}>No quota data</div>}
                    </div>
                    {data.personalQuota && (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Used",      val: data.personalQuota.usedFormatted },
                          { label: "Available", val: data.personalQuota.remainingFormatted },
                        ].map(({ label, val }) => (
                          <div key={label} className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
                            <div className="text-[8px] tracking-[0.18em] uppercase mb-1" style={{ color: "var(--text-3)" }}>{label}</div>
                            <div className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* TEN Drive ring */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="module-card p-6 flex flex-col gap-5"
                  >
                    <div className="flex items-center gap-2">
                      <Database size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
                      <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                        TEN Shared Drive
                      </span>
                    </div>
                    <div className="flex justify-center py-2">
                      {data.tenDrive?.quota
                        ? <StorageRing percent={data.tenDrive.quota.usedPercent} label={data.tenDrive.name ?? "TEN Drive"}
                            used={data.tenDrive.quota.usedFormatted} total={data.tenDrive.quota.totalFormatted} />
                        : <div className="text-center py-6">
                            <div className="text-[11px] mb-1" style={{ color: "var(--text-2)" }}>Drive quota unavailable</div>
                            <div className="text-[9px]" style={{ color: "var(--text-3)" }}>Admin permission required</div>
                          </div>}
                    </div>
                    {data.tenDrive?.quota && (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Used",      val: data.tenDrive.quota.usedFormatted },
                          { label: "Available", val: data.tenDrive.quota.remainingFormatted },
                        ].map(({ label, val }) => (
                          <div key={label} className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
                            <div className="text-[8px] tracking-[0.18em] uppercase mb-1" style={{ color: "var(--text-3)" }}>{label}</div>
                            <div className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* File type breakdown */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="module-card p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <FileType size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
                      <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                        File Types
                      </span>
                    </div>
                    {data.fileTypeBreakdown.length === 0
                      ? <div className="text-[11px] mt-4" style={{ color: "var(--text-3)" }}>No file data available</div>
                      : <div className="flex flex-col gap-3 mt-1">
                          {data.fileTypeBreakdown.map((ft) => (
                            <div key={ft.ext} className="flex items-center gap-3">
                              <div
                                className="text-[9px] font-mono font-bold px-2 py-0.5 rounded shrink-0"
                                style={{ background: `${EXT_COLOR[ft.ext] ?? "#666"}20`, color: EXT_COLOR[ft.ext] ?? "#666" }}
                              >
                                {ft.ext}
                              </div>
                              <div className="flex-1">
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.07)" }}>
                                  <motion.div
                                    className="h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((ft.bytes / maxFileBytes) * 100, 100)}%` }}
                                    transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                                    style={{ background: EXT_COLOR[ft.ext] ?? "#666" }}
                                  />
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[10px] font-semibold" style={{ color: "var(--text-1)" }}>{ft.count}</div>
                                <div className="text-[8px]" style={{ color: "var(--text-3)" }}>{ft.formattedSize}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                    }
                  </motion.div>
                </div>

                {/* ── Row 3: Event folders + personal top folders ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* TEN Event folders */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="module-card p-6"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
                        <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                          TEN Events — {data.year}
                        </span>
                      </div>
                      <span className="text-[9px] tracking-[0.16em] uppercase px-2 py-1 rounded-full"
                        style={{ background: "rgba(var(--champ-rgb),0.08)", color: "var(--champagne)", border: "1px solid rgba(var(--champ-rgb),0.2)" }}>
                        {data.eventFolders.length} events
                      </span>
                    </div>
                    {data.eventFolders.length === 0
                      ? <div className="text-[11px] py-4" style={{ color: "var(--text-3)" }}>No event folders found for {data.year}</div>
                      : <div className="space-y-0">
                          {data.eventFolders.map((ef, i) => (
                            <BarRow
                              key={ef.name}
                              label={ef.name}
                              value={ef.size}
                              maxValue={maxEventSize}
                              secondary={ef.formattedSize}
                              accent={i === 0}
                            />
                          ))}
                        </div>
                    }
                  </motion.div>

                  {/* Personal top folders */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="module-card p-6"
                  >
                    <div className="flex items-center gap-2 mb-5">
                      <HardDrive size={13} strokeWidth={1.5} style={{ color: "var(--champagne)" }} />
                      <span className="text-[9px] tracking-[0.22em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
                        Personal Drive — Top Folders
                      </span>
                    </div>
                    {data.topPersonalFolders.length === 0
                      ? <div className="text-[11px] py-4" style={{ color: "var(--text-3)" }}>No folder data</div>
                      : <div className="space-y-0">
                          {data.topPersonalFolders.slice(0, 8).map((f, i) => (
                            <BarRow
                              key={f.name}
                              label={f.name}
                              value={f.size}
                              maxValue={maxFolderSize}
                              secondary={f.formattedSize}
                              accent={i === 0}
                            />
                          ))}
                        </div>
                    }
                  </motion.div>
                </div>

              </motion.div>
            </AnimatePresence>
          )}

        </div>
        <Footer />
      </div>
    </main>
  );
}
