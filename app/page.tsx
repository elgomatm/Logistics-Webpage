"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SectionCard from "@/components/SectionCard";
import Footer from "@/components/Footer";
import {
  ReportsPreview,
  GuidesPreview,
  EmailsPreview,
} from "@/components/Previews";

export default function Home() {
  return (
    <main className="bg-[#040404] min-h-screen text-white">
      <Navbar />

      {/* ─── Hero ──────────────────────────────── */}
      <Hero />

      {/* ─── Reports ───────────────────────────── */}
      <SectionCard
        id="reports"
        number="01"
        title="REPORTS"
        subtitle="Partner Documents"
        description="Generate official TEN event reports for partners — automatically. Pull metrics from Meta Business Suite, populate attendance data, inject partner details, and export a polished, ready-to-send report in minutes."
        tags={["Event Reports", "Metrics", "Auto-Populate", "PDF Export"]}
        status="active"
        statusLabel="In Development"
        accentColor="#E05535"
        accentColorDim="rgba(224, 85, 53, 0.08)"
        preview={<ReportsPreview />}
        ctaLabel="Open Reports"
        onCta={() => alert("Reports module — coming soon!")}
        flip={false}
      />

      {/* ─── Guides ────────────────────────────── */}
      <SectionCard
        id="guides"
        number="02"
        title="GUIDES"
        subtitle="Partner & Venue Handbooks"
        description="Build comprehensive partner guides and venue handbooks with ease. Standardize layouts, auto-fill venue details, and produce print-ready documents that represent TEN at the highest level."
        tags={["Venue Guides", "Partner Handbooks", "Templates", "Brand-Consistent"]}
        status="planned"
        statusLabel="Planned"
        accentColor="#7C9EBD"
        accentColorDim="rgba(124, 158, 189, 0.07)"
        preview={<GuidesPreview />}
        ctaLabel="Coming Soon"
        flip={true}
      />

      {/* ─── Emails ────────────────────────────── */}
      <SectionCard
        id="emails"
        number="03"
        title="EMAILS"
        subtitle="Partner Communications"
        description="Automate post-event partner communications. Draft, personalize, and send official TEN emails — with attached reports, curated stats, and branded messaging — from a single interface."
        tags={["Automated Emails", "Partner Outreach", "Report Delivery", "Personalized"]}
        status="planned"
        statusLabel="Planned"
        accentColor="#A68BD4"
        accentColorDim="rgba(166, 139, 212, 0.07)"
        preview={<EmailsPreview />}
        ctaLabel="Coming Soon"
        flip={false}
      />

      {/* ─── Footer ────────────────────────────── */}
      <Footer />
    </main>
  );
}
