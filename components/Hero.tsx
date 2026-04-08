"use client";

import { motion } from "framer-motion";

export default function WorkspaceHeader() {
  return (
    <section className="relative pt-28 pb-12 px-6 md:px-14 max-w-[1360px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        {/* Left — Title */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-px" style={{ background: "var(--border-mid)" }} />
            <span className="text-[10px] tracking-[0.28em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
              The Exotics Network
            </span>
          </div>

          <h1
            className="font-bebas leading-none tracking-wide"
            style={{ fontSize: "clamp(44px, 6.5vw, 80px)", color: "var(--text-1)" }}
          >
            Document Studio
          </h1>

          <p className="mt-3 text-[13px] tracking-wide max-w-md leading-relaxed" style={{ color: "var(--text-2)" }}>
            Official document management for TEN. Select a module below.
          </p>
        </div>

        {/* Right — Meta */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-[9px] tracking-[0.22em] uppercase mb-1" style={{ color: "var(--text-3)" }}>
              Platform
            </div>
            <div className="text-[11px] font-medium tracking-wide" style={{ color: "var(--text-2)" }}>
              v0.1 — Pre-release
            </div>
          </div>
          <div className="h-8 w-px hidden md:block" style={{ background: "var(--border)" }} />
          <div className="text-right">
            <div className="text-[9px] tracking-[0.22em] uppercase mb-1" style={{ color: "var(--text-3)" }}>
              Active Modules
            </div>
            <div className="font-bebas text-2xl tracking-widest" style={{ color: "var(--champagne)" }}>
              1 / 3
            </div>
          </div>
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
        className="rule mt-8 origin-left"
      />
    </section>
  );
}
