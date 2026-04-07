"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SectionCard from "@/components/SectionCard";
import Footer from "@/components/Footer";

const modules = [
  {
    id: "reports",
    number: "01",
    title: "REPORTS",
    subtitle: "Partner Documents",
    description:
      "Generate official TEN event reports for partners — automatically. Pull metrics from Meta Business Suite, populate attendance data, inject partner details, and export a polished, ready-to-send report in minutes.",
    tags: ["Event Reports", "Metrics", "Auto-Populate", "PDF Export"],
    status: "active" as const,
    statusLabel: "In Development",
    ctaLabel: "Open Reports",
    onCta: () => alert("Reports module — coming soon!"),
  },
  {
    id: "guides",
    number: "02",
    title: "GUIDES",
    subtitle: "Partner & Venue Handbooks",
    description:
      "Build comprehensive partner guides and venue handbooks with ease. Standardize layouts, auto-fill venue details, and produce print-ready documents that represent TEN at the highest level.",
    tags: ["Venue Guides", "Partner Handbooks", "Templates", "Brand-Consistent"],
    status: "planned" as const,
    statusLabel: "Planned",
    ctaLabel: "Coming Soon",
  },
  {
    id: "emails",
    number: "03",
    title: "EMAILS",
    subtitle: "Partner Communications",
    description:
      "Automate post-event partner communications. Draft, personalize, and send official TEN emails — with attached reports, curated stats, and branded messaging — from a single interface.",
    tags: ["Automated Emails", "Partner Outreach", "Report Delivery", "Personalized"],
    status: "planned" as const,
    statusLabel: "Planned",
    ctaLabel: "Coming Soon",
  },
];

export default function Home() {
  return (
    <main className="bg-[#060606] min-h-screen text-white">
      <Navbar />

      {/* ─── Workspace Header ──────────────────── */}
      <Hero />

      {/* ─── Module Grid ───────────────────────── */}
      <section className="px-8 md:px-16 pb-24 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {modules.map((mod, i) => (
            <SectionCard
              key={mod.id}
              index={i}
              id={mod.id}
              number={mod.number}
              title={mod.title}
              subtitle={mod.subtitle}
              description={mod.description}
              tags={mod.tags}
              status={mod.status}
              statusLabel={mod.statusLabel}
              ctaLabel={mod.ctaLabel}
              onCta={mod.onCta}
            />
          ))}
        </div>

        {/* Bottom meta row */}
        <div className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-px bg-white/10" />
            <span className="text-[9px] tracking-[0.22em] uppercase text-white/18">
              1 active — 2 planned
            </span>
          </div>
          <span className="text-[9px] tracking-[0.22em] uppercase text-white/18">
            TEN Document Studio v0.1
          </span>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────── */}
      <Footer />
    </main>
  );
}
