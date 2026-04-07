"use client";

import { motion } from "framer-motion";

export default function WorkspaceHeader() {
  return (
    <section className="relative pt-32 pb-16 px-8 md:px-16 max-w-[1440px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-8"
      >
        {/* Left — Title block */}
        <div>
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-5 h-px bg-white/20" />
            <span className="text-[10px] tracking-[0.28em] uppercase text-white/25 font-medium">
              The Exotics Network
            </span>
          </div>

          <h1
            className="font-bebas leading-none tracking-wide text-white"
            style={{ fontSize: "clamp(48px, 7vw, 88px)" }}
          >
            Document Studio
          </h1>

          <p className="mt-4 text-[13px] text-white/35 tracking-wide max-w-md leading-relaxed">
            Official document management for TEN. Select a module below.
          </p>
        </div>

        {/* Right — Meta info */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-[9px] tracking-[0.22em] uppercase text-white/18 mb-1">
              Platform
            </div>
            <div className="text-[11px] text-white/35 font-medium tracking-wide">
              v0.1 — Pre-release
            </div>
          </div>
          <div className="h-8 w-px bg-white/[0.07] hidden md:block" />
          <div className="text-right">
            <div className="text-[9px] tracking-[0.22em] uppercase text-white/18 mb-1">
              Active Modules
            </div>
            <div className="font-bebas text-2xl text-white/70 tracking-widest">
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
        className="rule mt-10 origin-left"
      />
    </section>
  );
}
