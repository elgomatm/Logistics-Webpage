"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] py-12 overflow-hidden">
      {/* Faint ambient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(255, 255, 255, 0.015) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-[1440px] mx-auto px-8 md:px-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Left — Branding */}
          <div className="flex items-center gap-4">
            <div className="w-7 h-7 border border-accent/50 flex items-center justify-center">
              <span className="font-bebas text-accent text-sm tracking-wider leading-none">
                TEN
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] text-white/50 tracking-widest uppercase">
                Document Studio
              </div>
              <div className="text-[9px] text-white/20 tracking-wider">
                © {new Date().getFullYear()} The Exotics Network. All rights reserved.
              </div>
            </div>
          </div>

          {/* Right — Links */}
          <div className="flex items-center gap-8">
            {["Reports", "Guides", "Emails"].map((label) => (
              <button
                key={label}
                onClick={() =>
                  document
                    .getElementById(label.toLowerCase())
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-[10px] tracking-[0.18em] uppercase text-white/25 hover:text-white/50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Version line */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[9px] text-white/15 tracking-widest uppercase">
            v0.1.0 — Pre-release
          </span>
          <span className="text-[9px] text-white/15 tracking-widest uppercase">
            Built for TEN
          </span>
        </div>
      </div>
    </footer>
  );
}
