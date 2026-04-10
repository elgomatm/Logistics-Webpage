"use client"

import type { Page } from '../App'
import Hero from './Hero'
import SectionCard from './SectionCard'
import Footer from './Footer'

interface LogisticsPageProps {
  onNavigate: (page: Page) => void
}

export default function LogisticsPage({ onNavigate }: LogisticsPageProps) {
  return (
    <div style={{ position: 'relative' }}>
      <Hero />

      {/* Module grid */}
      <section className="px-6 md:px-14 pb-20 max-w-[1360px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          <SectionCard
            index={0} id="reports" number="01" title="REPORTS"
            subtitle="Partner Documents"
            description="Generate official TEN event reports for partners — automatically. Pull metrics from Meta Business Suite, populate attendance data, inject partner details, and export a polished, ready-to-send report in minutes."
            tags={['Event Reports', 'Metrics', 'Auto-Populate', 'PPTX Export']}
            status="active" statusLabel="Active"
            ctaLabel="Open Reports"
            onCta={() => onNavigate('reports')}
            previewImages={[
              './report-covers/cover-1.jpg',
              './report-covers/cover-2.jpg',
              './report-covers/cover-3.jpg',
            ]}
          />

          <SectionCard
            index={1} id="guides" number="02" title="GUIDES"
            subtitle="Partner & Venue Handbooks"
            description="Build branded partner guides from scratch — no template upload required. Populate schedules, venue details, rules, and personalised intro letters, then export polished handbooks for every partner in one run."
            tags={['Venue Guides', 'Partner Handbooks', 'No Template', 'Brand-Consistent']}
            status="active" statusLabel="Active"
            ctaLabel="Open Guides"
            onCta={() => onNavigate('guides')}
            previewFit="contain"
            previewImages={[
              './guide-covers/cover-1.jpg',
              './guide-covers/cover-2.png',
              './guide-covers/cover-3.png',
            ]}
          />

          <SectionCard
            index={2} id="emails" number="03" title="EMAILS & WORKFLOWS"
            subtitle="Automated Outreach"
            description="Build and send partner outreach, follow-ups, and event announcements. Automate sequences, personalise at scale, and track opens and replies — all from inside Document Studio."
            tags={['Partner Emails', 'Templates', 'Sequences', 'Automations']}
            status="planned" statusLabel="Planned"
            ctaLabel="Coming Soon"
            previewImages={[
              './email-covers/cover-1.jpg',
              './email-covers/cover-2.jpg',
              './email-covers/cover-3.jpg',
            ]}
          />

        </div>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-[9px] tracking-[0.22em] uppercase" style={{ color: 'var(--text-3)' }}>
            2 active — 1 planned
          </span>
          <span className="text-[9px] tracking-[0.22em] uppercase" style={{ color: 'var(--text-3)' }}>
            TEN Document Studio v1.0
          </span>
        </div>
      </section>

      <Footer />
    </div>
  )
}
