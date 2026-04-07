"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero() {
  const scrollToReports = () => {
    document.getElementById("reports")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden grid-bg">
      {/* Ambient glow layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary glow — warm orange, bottom-left */}
        <div
          className="absolute rounded-full animate-drift-slow"
          style={{
            width: "700px",
            height: "700px",
            background:
              "radial-gradient(circle, rgba(224, 85, 53, 0.07) 0%, transparent 65%)",
            bottom: "-15%",
            left: "-8%",
            filter: "blur(60px)",
          }}
        />
        {/* Secondary glow — faint gold, top-right */}
        <div
          className="absolute rounded-full animate-drift-slow-r"
          style={{
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(201, 168, 76, 0.04) 0%, transparent 65%)",
            top: "-10%",
            right: "-5%",
            filter: "blur(80px)",
          }}
        />
        {/* Center deep glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: "1000px",
            height: "400px",
            background:
              "radial-gradient(ellipse, rgba(224, 85, 53, 0.025) 0%, transparent 70%)",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1440px] mx-auto w-full px-8 md:px-16 pt-28 pb-20">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center gap-4 mb-12"
        >
          <div className="accent-line" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-medium">
            The Exotics Network — Platform v0.1
          </span>
        </motion.div>

        {/* Main title */}
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.h1
            variants={item}
            className="font-bebas leading-none tracking-wide"
            style={{ fontSize: "clamp(72px, 14vw, 200px)" }}
          >
            <span className="block text-white">DOCUMENT</span>
            <span className="block relative">
              {/* Ghost outline text behind */}
              <span
                className="absolute inset-0 font-bebas leading-none select-none"
                style={{
                  WebkitTextStroke: "1px rgba(255,255,255,0.06)",
                  color: "transparent",
                  fontSize: "inherit",
                }}
                aria-hidden
              >
                STUDIO
              </span>
              <span className="relative text-white">STUDIO</span>
            </span>
          </motion.h1>

          {/* Divider */}
          <motion.div variants={item} className="mt-8 mb-10 flex items-center gap-6">
            <div className="hr max-w-[80px]" />
            <p className="text-[13px] tracking-[0.08em] text-white/35 uppercase font-medium">
              Build · Polish · Deliver
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            variants={item}
            className="text-white/50 text-base leading-relaxed max-w-[480px] mb-10"
          >
            One command center for all official TEN documents — event reports,
            partner guides, and automated communications. Everything your team
            needs to move faster.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={item} className="flex flex-wrap items-center gap-4">
            <button onClick={scrollToReports} className="btn-primary group">
              <span>Enter Reports</span>
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
            <button className="btn-secondary">
              <span>View Roadmap</span>
            </button>
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-20 pt-8 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl"
        >
          {[
            { value: "3", label: "Core Modules" },
            { value: "01", label: "Active — Reports" },
            { value: "27", label: "Slides Automated" },
            { value: "∞", label: "Events. One Tool." },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-bebas text-3xl text-white/80 tracking-wide mb-1">
                {stat.value}
              </div>
              <div className="text-[10px] text-white/25 tracking-[0.16em] uppercase">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.6 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 cursor-pointer"
        onClick={scrollToReports}
      >
        <span className="text-[9px] tracking-[0.3em] text-white/20 uppercase">
          Scroll
        </span>
        <div className="scroll-line" />
        <ChevronDown size={12} className="text-white/20 animate-bounce" />
      </motion.div>

      {/* Corner decoration */}
      <div className="absolute bottom-0 right-0 pointer-events-none opacity-[0.03]">
        <div
          className="font-bebas text-white leading-none select-none"
          style={{ fontSize: "30vw" }}
        >
          TEN
        </div>
      </div>
    </section>
  );
}
