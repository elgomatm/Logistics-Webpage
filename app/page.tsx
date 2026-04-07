"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SectionCard from "@/components/SectionCard";
import Footer from "@/components/Footer";

interface ReportEvent {
  name: string;
  count: number;
}

interface ReportsData {
  total: number;
  events: ReportEvent[];
  synced: boolean;
}

const POLL_INTERVAL = 45_000; // 45 seconds

export default function Home() {
  const [reportsData, setReportsData] = useState<ReportsData>({
    total: 0,
    events: [],
    synced: false,
  });

  const fetchReportsCount = useCallback(async () => {
    try {
      const res = await fetch("/api/reports-count", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReportsData(data);
      }
    } catch {
      // Silently fail — count stays at last known value
    }
  }, []);

  useEffect(() => {
    fetchReportsCount();
    const interval = setInterval(fetchReportsCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchReportsCount]);

  const statLabel = reportsData.synced
    ? `reports generated — ${new Date().getFullYear()}`
    : "reports this year";

  return (
    <main className="bg-[#060606] min-h-screen text-white">
      <Navbar />

      {/* ─── Workspace Header ──────────────────── */}
      <Hero />

      {/* ─── Module Grid ───────────────────────── */}
      <section className="px-8 md:px-16 pb-24 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* Reports */}
          <SectionCard
            index={0}
            id="reports"
            number="01"
            title="REPORTS"
            subtitle="Partner Documents"
            description="Generate official TEN event reports for partners — automatically. Pull metrics from Meta Business Suite, populate attendance data, inject partner details, and export a polished, ready-to-send report in minutes."
            tags={["Event Reports", "Metrics", "Auto-Populate", "PDF Export"]}
            status="active"
            statusLabel="In Development"
            ctaLabel="Open Reports"
            href="/reports"
            stat={{
              value: reportsData.total,
              label: statLabel,
            }}
          />

          {/* Guides */}
          <SectionCard
            index={1}
            id="guides"
            number="02"
            title="GUIDES"
            subtitle="Partner & Venue Handbooks"
            description="Build comprehensive partner guides and venue handbooks with ease. Standardize layouts, auto-fill venue details, and produce print-ready documents that represent TEN at the highest level."
            tags={["Venue Guides", "Partner Handbooks", "Templates", "Brand-Consistent"]}
            status="planned"
            statusLabel="Planned"
            ctaLabel="Coming Soon"
          />

          {/* Emails */}
          <SectionCard
            index={2}
            id="emails"
            number="03"
            title="EMAILS"
            subtitle="Partner Communications"
            description="Automate post-event partner communications. Draft, personalize, and send official TEN emails — with attached reports, curated stats, and branded messaging — from a single interface."
            tags={["Automated Emails", "Partner Outreach", "Report Delivery", "Personalized"]}
            status="planned"
            statusLabel="Planned"
            ctaLabel="Coming Soon"
          />
        </div>

        {/* Bottom meta row */}
        <div className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-px bg-white/10" />
            <span className="text-[9px] tracking-[0.22em] uppercase text-white/20">
              1 active — 2 planned
            </span>
          </div>
          <div className="flex items-center gap-2">
            {reportsData.synced && (
              <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
            )}
            <span className="text-[9px] tracking-[0.22em] uppercase text-white/20">
              {reportsData.synced ? "OneDrive synced" : "TEN Document Studio v0.1"}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────── */}
      <Footer />
    </main>
  );
}
