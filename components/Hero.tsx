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
        className="flex flex-col items-center text-center gap-3"
      >
        {/* Centered wordmark + TEN logo inline */}
        <div className="flex items-center justify-center gap-5">
          <h1
            className="font-bebas tracking-[0.12em] leading-none select-none"
            style={{
              fontSize: "clamp(52px, 6vw, 88px)",
              color: "var(--text-1)",
            }}
          >
            Document Studio
          </h1>
          {/* TEN logo — same visual height as the text */}
          <Image
            src="/ten-logo.png"
            alt="TEN"
            width={160}
            height={56}
            className="object-contain select-none"
            style={{
              height: "clamp(36px, 4.2vw, 62px)",
              width: "auto",
              filter: "brightness(0)",
              opacity: 0.85,
            }}
            priority
          />
        </div>

        {/* Subtitle */}
        <div className="flex items-center gap-3 mt-1">
          <div className="w-5 h-px" style={{ background: "var(--border-mid)" }} />
          <span
            className="text-[10px] tracking-[0.28em] uppercase font-medium"
            style={{ color: "var(--text-3)" }}
          >
            The Exotics Network
          </span>
          <div className="w-5 h-px" style={{ background: "var(--border-mid)" }} />
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
