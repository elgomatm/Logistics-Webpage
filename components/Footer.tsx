"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="relative py-10 overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="max-w-[1360px] mx-auto px-6 md:px-14">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

          {/* Branding */}
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 flex items-center justify-center rounded"
              style={{ border: "1px solid var(--border-mid)" }}
            >
              <span className="font-bebas text-sm tracking-wider leading-none" style={{ color: "var(--champagne)" }}>
                TEN
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] tracking-widest uppercase" style={{ color: "var(--text-2)" }}>
                Document Studio
              </div>
              <div className="text-[9px] tracking-wider" style={{ color: "var(--text-3)" }}>
                © {new Date().getFullYear()} The Exotics Network. All rights reserved.
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-8">
            {["Reports", "Guides", "Emails"].map((label) => (
              <button
                key={label}
                onClick={() => document.getElementById(label.toLowerCase())?.scrollIntoView({ behavior: "smooth" })}
                className="text-[10px] tracking-[0.18em] uppercase transition-colors duration-200"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--champagne)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>v0.1.0 — Pre-release</span>
          <span className="text-[9px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Built for TEN</span>
        </div>
      </div>
    </footer>
  );
}
