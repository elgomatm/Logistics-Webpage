"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SectionCard from "@/components/SectionCard";
import Footer from "@/components/Footer";
import LoginSuccessAnimation from "@/components/LoginSuccessAnimation";

interface ReportEvent { name: string; year: string; count: number; files?: string[] }
interface ReportsData { total: number; events: ReportEvent[]; synced: boolean; source?: string; }

const POLL_INTERVAL = 45_000;

export default function Home() {
  const [reportsData, setReportsData] = useState<ReportsData>({ total: 0, events: [], synced: false });

  const fetchReportsCount = useCallback(async () => {
    try {
      const res = await fetch("/api/reports-count", { cache: "no-store" });
      if (res.ok) setReportsData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchReportsCount();
    const interval = setInterval(fetchReportsCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchReportsCount]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <LoginSuccessAnimation />

      {/* ── Champagne ambient glow — top center ───────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(201,169,110,0.13) 0%, transparent 65%)",
            "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(201,169,110,0.07) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10">
        <Navbar />
        <Hero />

        {/* ─── Module Grid ─────────────────────────────────────── */}
        <section className="px-6 md:px-14 pb-20 max-w-[1360px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            <SectionCard
              index={0} id="reports" number="01" title="REPORTS"
              subtitle="Partner Documents"
              description="Generate official TEN event reports for partners — automatically. Pull metrics from Meta Business Suite, populate attendance data, inject partner details, and export a polished, ready-to-send report in minutes."
              tags={["Event Reports", "Metrics", "Auto-Populate", "PDF Export"]}
              status="active" statusLabel="In Development"
              ctaLabel="Open Reports" href="/reports"
              stat={(() => {
                if (!reportsData.synced) return { value: "—", label: "reports this year" };
                const yr = String(new Date().getFullYear());
                const yearCount = reportsData.events
                  .filter((e) => e.year === yr)
                  .reduce((s, e) => s + e.count, 0);
                const displayCount = yearCount > 0 ? yearCount : reportsData.total;
                return { value: displayCount, label: `reports — ${yr}` };
              })()}
              previewImages={[
                "/report-covers/cover-1.jpg",
                "/report-covers/cover-2.jpg",
                "/report-covers/cover-3.jpg",
              ]}
            />

            <SectionCard
              index={1} id="guides" number="02" title="GUIDES"
              subtitle="Partner & Venue Handbooks"
              description="Build comprehensive partner guides and venue handbooks with ease. Standardize layouts, auto-fill venue details, and produce print-ready documents that represent TEN at the highest level."
              tags={["Venue Guides", "Partner Handbooks", "Templates", "Brand-Consistent"]}
              status="planned" statusLabel="Planned" ctaLabel="Coming Soon"
            />

            <SectionCard
              index={2} id="emails" number="03" title="EMAILS"
              subtitle="Partner Communications"
              description="Automate post-event partner communications. Draft, personalize, and send official TEN emails — with attached reports, curated stats, and branded messaging — from a single interface."
              tags={["Automated Emails", "Partner Outreach", "Report Delivery", "Personalized"]}
              status="planned" statusLabel="Planned" ctaLabel="Coming Soon"
            />
          </div>

          {/* Bottom meta row */}
          <div className="mt-8 flex items-center justify-between">
            <span className="text-[9px] tracking-[0.22em] uppercase" style={{ color: "var(--text-3)" }}>
              1 active — 2 planned
            </span>
            <div className="flex items-center gap-2">
              {reportsData.synced && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--champagne)" }} />
              )}
              <span className="text-[9px] tracking-[0.22em] uppercase" style={{ color: "var(--text-3)" }}>
                {reportsData.synced ? `OneDrive synced · ${reportsData.source}` : "TEN Document Studio v0.1"}
              </span>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
