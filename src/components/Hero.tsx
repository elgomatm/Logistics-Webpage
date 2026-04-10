"use client"
import tenLogo from "../assets/ten-logo-white.png"

export default function WorkspaceHeader() {
  return (
    <section className="relative pt-24 pb-10 px-6 md:px-14 max-w-[1360px] mx-auto" style={{ overflow: 'visible' }}>

      {/* ── Navbar glow — FIRST in DOM so it sits BEHIND the title content ────── */}
      {/* Extends 64px upward into the fixed navbar bar, radiates downward */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top:        '-64px',
          left:       '50%',
          transform:  'translateX(-50%)',
          width:      '160%',
          height:     '580px',
          background: [
            // Tight bright shaft — the "hot core" coming from the navbar center
            'radial-gradient(ellipse 28% 38% at 50% 0%, rgba(220,28,28,0.90) 0%, rgba(204,28,28,0.46) 24%, transparent 52%)',
            // Mid halo bloom
            'radial-gradient(ellipse 62% 62% at 50% 0%, rgba(204,28,28,0.42) 0%, rgba(180,20,20,0.15) 42%, transparent 66%)',
            // Wide ambient falloff
            'radial-gradient(ellipse 95% 80% at 50% 0%, rgba(170,14,14,0.18) 0%, transparent 68%)',
          ].join(', '),
        }}
      />

      {/* Thin bright line at y=0 of the section — the underside of the navbar bar */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top:        '-64px',
          left:       '50%',
          transform:  'translateX(-50%)',
          width:      '70%',
          height:     '2px',
          background: 'radial-gradient(ellipse 65% 100% at 50% 0%, rgba(230,30,30,0.95) 0%, transparent 100%)',
        }}
      />

      {/* ── Title row — rendered AFTER glow so it paints on top ─────────────── */}
      <div className="relative flex flex-col items-center text-center anim-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-center" style={{ gap: 'clamp(22px, 2.4vw, 36px)' }}>
          {/* TEN logo — brightness(0) invert(1) forces white regardless of PNG color */}
          <img
            src={tenLogo}
            alt="TEN"
            draggable={false}
            className="object-contain select-none shrink-0"
            style={{
              height:    'clamp(35px, 4.18vw, 61px)',
              width:     'auto',
              opacity:   0.95,
              transform: 'translateY(-5px)',
              filter:    'brightness(0) invert(1)',
            }}
          />
          <h1
            className="font-bebas tracking-[0.12em] leading-none select-none"
            style={{ fontSize: 'clamp(52px, 6vw, 88px)', color: 'var(--text-1)' }}
          >
            Document Studio
          </h1>
        </div>
      </div>

      {/* Tapered divider */}
      <div
        className="rule-tapered mt-8 anim-fade-in"
        style={{ animationDelay: '0.3s' }}
      />
    </section>
  )
}
