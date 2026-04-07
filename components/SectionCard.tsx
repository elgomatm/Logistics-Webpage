"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";

type Tag = string;

interface SectionCardProps {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  tags: Tag[];
  status: "active" | "planned";
  statusLabel: string;
  accentColor: string;
  accentColorDim: string;
  preview: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  flip?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export default function SectionCard({
  id,
  number,
  title,
  subtitle,
  description,
  tags,
  status,
  statusLabel,
  accentColor,
  accentColorDim,
  preview,
  ctaLabel = "Open Module",
  onCta,
  flip = false,
}: SectionCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id={id}
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Section ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: "600px",
            height: "600px",
            background: `radial-gradient(circle, ${accentColorDim} 0%, transparent 70%)`,
            top: "50%",
            left: flip ? "70%" : "30%",
            transform: "translate(-50%, -50%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* Section number watermark */}
      <div
        className="absolute pointer-events-none select-none font-bebas leading-none"
        style={{
          fontSize: "clamp(180px, 22vw, 320px)",
          color: "transparent",
          WebkitTextStroke: "1px rgba(255,255,255,0.025)",
          top: "50%",
          right: flip ? "auto" : "-2%",
          left: flip ? "-2%" : "auto",
          transform: "translateY(-50%)",
        }}
        aria-hidden
      >
        {number}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1440px] mx-auto w-full px-8 md:px-16 py-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
            flip ? "lg:[direction:rtl]" : ""
          }`}
        >
          {/* Left — Text content */}
          <div className={flip ? "[direction:ltr]" : ""}>
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
              <span
                className="font-bebas text-5xl tracking-wider leading-none"
                style={{ color: accentColor, opacity: 0.6 }}
              >
                {number}
              </span>
              <div className="h-px flex-1 max-w-[40px]" style={{ background: accentColor, opacity: 0.4 }} />
              <span className="text-[10px] tracking-[0.25em] text-white/25 uppercase font-medium">
                {subtitle}
              </span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="font-bebas leading-none tracking-wide mb-6"
              style={{ fontSize: "clamp(52px, 8vw, 100px)" }}
            >
              {title}
            </motion.h2>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mb-7">
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="text-white/45 text-[15px] leading-relaxed mb-10 max-w-[420px]"
            >
              {description}
            </motion.p>

            <motion.div variants={fadeUp} className="flex items-center gap-6 flex-wrap">
              {/* Status badge */}
              {status === "active" ? (
                <span className="badge-active">{statusLabel}</span>
              ) : (
                <span className="badge-planned">{statusLabel}</span>
              )}

              {/* CTA */}
              {status === "active" ? (
                <button
                  onClick={onCta}
                  className="btn-primary group"
                  style={{ background: accentColor }}
                >
                  <span>{ctaLabel}</span>
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              ) : (
                <button className="btn-secondary opacity-50 cursor-not-allowed" disabled>
                  <Lock size={12} />
                  <span>{ctaLabel}</span>
                </button>
              )}
            </motion.div>
          </div>

          {/* Right — Preview panel */}
          <motion.div
            variants={fadeUp}
            className={flip ? "[direction:ltr]" : ""}
          >
            <div
              className="glass relative overflow-hidden"
              style={{
                borderColor: `rgba(255,255,255,0.07)`,
                boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset`,
              }}
            >
              {/* Panel header bar */}
              <div
                className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-1.5"
                    style={{ background: accentColor }}
                  />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-medium">
                    {title} — Preview
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white/[0.06]" />
                  <div className="w-2 h-2 rounded-full bg-white/[0.06]" />
                  <div className="w-2 h-2 rounded-full bg-white/[0.06]" />
                </div>
              </div>

              {/* Panel content */}
              <div className="p-6 min-h-[320px] flex items-center justify-center">
                {preview}
              </div>

              {/* Accent corner stripe */}
              <div
                className="absolute top-0 left-0 w-[3px] h-full opacity-60"
                style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom divider */}
      <div className="absolute bottom-0 left-8 right-8 md:left-16 md:right-16 hr" />
    </section>
  );
}
