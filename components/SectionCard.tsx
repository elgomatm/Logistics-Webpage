"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

interface StatBlock { value: number | string; label: string; }

interface ModuleCardProps {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  status: "active" | "planned";
  statusLabel: string;
  ctaLabel?: string;
  href?: string;
  onCta?: () => void;
  index: number;
  stat?: StatBlock;
}

export default function SectionCard({
  id, number, title, subtitle, description, tags,
  status, statusLabel, ctaLabel = "Open Module",
  href, onCta, index, stat,
}: ModuleCardProps) {
  const isActive = status === "active";

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      className={`module-card ${isActive ? "module-card-active" : ""} flex flex-col h-full`}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="font-bebas text-[44px] leading-none tracking-widest select-none"
            style={{ color: isActive ? "rgba(201,169,110,0.18)" : "rgba(0,0,0,0.05)" }}
          >
            {number}
          </span>
          {isActive
            ? <span className="badge-active mt-1 shrink-0">{statusLabel}</span>
            : <span className="badge-planned mt-1 shrink-0">{statusLabel}</span>}
        </div>

        <h2
          className="leading-none"
          style={{
            fontSize: "clamp(26px, 2.2vw, 34px)",
            fontFamily: "var(--font-inter)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: isActive ? "var(--text-1)" : "var(--text-3)",
          }}
        >
          {title}
        </h2>

        <p className="text-[9px] tracking-[0.22em] uppercase mt-1.5"
          style={{ color: isActive ? "var(--text-2)" : "var(--text-3)" }}>
          {subtitle}
        </p>

        {/* Live stat */}
        {stat && isActive && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-bebas text-[32px] leading-none tracking-wider" style={{ color: "var(--champagne)" }}>
              {stat.value}
            </span>
            <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: "var(--text-3)" }}>
              {stat.label}
            </span>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="px-6 py-5 flex-1 flex flex-col justify-between gap-5">
        <p className="text-[12.5px] leading-[1.7]" style={{ color: isActive ? "var(--text-2)" : "var(--text-3)" }}>
          {description}
        </p>

        <div className="space-y-4">
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="tag"
                style={{
                  borderColor: isActive ? "var(--border-mid)" : "var(--border)",
                  color: isActive ? "var(--text-2)" : "var(--text-3)",
                  background: isActive ? "rgba(0,0,0,0.03)" : "transparent",
                }}>
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          {isActive ? (
            href ? (
              <Link href={href} className="btn-primary w-full justify-center group">
                {ctaLabel}
                <ArrowRight size={11} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <button onClick={onCta} className="btn-primary w-full justify-center group">
                {ctaLabel}
                <ArrowRight size={11} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          ) : (
            <button disabled className="btn-ghost w-full justify-center">
              <Lock size={10} strokeWidth={1.5} />
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
