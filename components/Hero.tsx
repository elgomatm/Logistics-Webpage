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
        className="flex flex-col items-center text-center"
      >
        {/* TEN logo (left) + Document Studio title — bottom-aligned */}
        <div className="flex items-end justify-center gap-5">
          <Image
            src="/ten-logo.png"
            alt="TEN"
            width={160}
            height={56}
            className="object-contain select-none"
            style={{
              height: "clamp(28px, 3.2vw, 50px)",
              width: "auto",
              filter: "brightness(0)",
              opacity: 0.82,
              /* nudge up slightly so it sits on the text cap-height, not descender */
              marginBottom: "clamp(6px, 0.9vw, 14px)",
            }}
            priority
          />
          <h1
            className="font-bebas tracking-[0.12em] leading-none select-none"
            style={{
              fontSize: "clamp(52px, 6vw, 88px)",
              color: "var(--text-1)",
            }}
          >
            Document Studio
          </h1>
        </div>
      </motion.div>

      {/* Divider — tapered, slightly thicker in center */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
        className="rule-tapered mt-8 origin-left"
      />
    </section>
  );
}
