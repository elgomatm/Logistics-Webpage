"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function WorkspaceHeader() {
  return (
    <section className="relative pt-24 pb-10 px-6 md:px-14 max-w-[1360px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        {/* Left — Logo block */}
        <div>
          {/* TEN logo — inverted to black for light background */}
          <div className="mb-3 select-none" style={{ width: "clamp(180px, 22vw, 300px)" }}>
            <Image
              src="/ten-logo.png"
              alt="The Exotics Network"
              width={1000}
              height={349}
              priority
              style={{
                width: "100%",
                height: "auto",
                filter: "invert(1)",
                opacity: 0.88,
              }}
            />
          </div>

          {/* Eyebrow — sits right under the logo */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-px" style={{ background: "var(--border-mid)" }} />
            <span className="text-[10px] tracking-[0.28em] uppercase font-medium" style={{ color: "var(--text-3)" }}>
              The Exotics Network
            </span>
          </div>
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
