"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import SectionCard from "@/components/SectionCard";

interface ReportEvent { name: string; year: string; count: number; files?: string[] }
interface ReportsData { total: number; events: ReportEvent[]; synced: boolean; source?: string; }

const POLL_INTERVAL = 45_000;

export default function LogisticsPage() {
  const [reportsData, setReportsData] = useState<ReportsData>({ total: 0, events: [], synced: false });
  const [reportsLoading, setReportsLoading] = useState(true);

  const fetchReportsCount = useCallback(async () => {
    try {
      const res = await fetch("/api/reports-count", { cache: "no-store" });
      if (res.ok) setReportsData(await res.json());
    } catch { /* silent */ } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportsCount();
    const interval = setInterval(fetchReportsCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchReportsCount]);

  return (
    <div style={{ marginLeft: "-32px", marginRight: "-32px" }}>
      {/* ── Hero title — TEN logo + Document Studio ─────────────── */}
      <section className="relative pt-6 pb-8 px-6">
        <div className="flex flex-col items-center text-center anim-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-center" style={{ gap: "clamp(18px, 2vw, 30px)" }}>
            <Image
              src="/ten-logo.png"
              alt="TEN"
              width={160}
              height={56}
              className="object-contain select-none shrink-0"
              style={{
                height: "clamp(30px, 3.5vw, 50px)",
                width: "auto",
                filter: "brightness(0) invert(1)",
                opacity: 0.85,
                transform: "translateY(-3px)",
              }}
              priority
            />
            <h1
              className="font-bebas tracking-[0.12em] leading-none select-none"
              style={{ fontSize: "clamp(42px, 5vw, 72px)", color: "var(--text-1)" }}
            >
              Document Studio
            </h1>
          </div>
        </div>

        {/* Tapered divider */}
        <div
          className="rule-tapered mt-6 anim-fade-in"
          style={{ animationDelay: "0.3s" }}
        />
      </section>

      {/* ── Module cards grid ──────────────────────────────────── */}
      <section className="px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
            stat={(() => {
              const yr = String(new Date().getFullYear());
              if (reportsLoading) return { value: "—", label: `reports — ${yr}`, loading: true };
              if (!reportsData.synced) return { value: "—", label: "reports this year" };
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
            previewFit="contain"
            previewImages={[
              "/guide-covers/cover-1.jpg",
              "/guide-covers/cover-2.png",
              "/guide-covers/cover-3.png",
            ]}
          />

          <SectionCard
            index={2}
            id="emails"
            number="03"
            title="EMAILS & WORKFLOWS"
            subtitle="Automated Outreach"
            description="Build and send partner outreach, follow-ups, and event announcements. Automate sequences, personalise at scale, and track opens and replies — all from inside Document Studio."
            tags={["Partner Emails", "Templates", "Sequences", "Automations"]}
            status="planned"
            statusLabel="Planned"
            ctaLabel="Coming Soon"
            previewImages={[
              "/email-covers/cover-1.jpg",
              "/email-covers/cover-2.jpg",
              "/email-covers/cover-3.jpg",
            ]}
          />
        </div>

        {/* Bottom meta row */}
        <div className="mt-8 flex items-center justify-between">
          <span
            className="text-[9px] tracking-[0.22em] uppercase"
            style={{ color: "var(--text-3)" }}
          >
            1 active — 2 planned
          </span>
          <div className="flex items-center gap-2">
            {reportsData.synced && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--champagne)" }}
              />
            )}
            <span
              className="text-[9px] tracking-[0.22em] uppercase"
              style={{ color: "var(--text-3)" }}
            >
              {reportsData.synced
                ? `OneDrive synced · ${reportsData.source}`
                : "TEN Document Studio v0.1"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
