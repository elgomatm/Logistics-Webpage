"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
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
  previewImages?: string[];
}

export default function SectionCard({
  id, number, title, subtitle,
  tags, status, statusLabel,
  ctaLabel = "Open Module", href, onCta,
  index, stat, previewImages,
}: ModuleCardProps) {
  const isActive = status === "active";
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Mouse-tracking tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });
  const glowX   = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glowY   = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setHovered(false);
  };

  return (
    <motion.div
      id={id}
      ref={cardRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
      style={{
        rotateX: isActive ? rotateX : 0,
        rotateY: isActive ? rotateY : 0,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      whileHover={isActive ? { y: -6 } : {}}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`module-card ${isActive ? "module-card-active" : ""} flex flex-col h-full relative overflow-hidden`}
    >
      {/* Specular highlight that follows mouse */}
      {isActive && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[16px] z-10"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([x, y]) =>
                `radial-gradient(circle at ${x} ${y}, rgba(201,169,110,0.10) 0%, transparent 55%)`
            ),
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Number — bold champagne gold */}
          <motion.span
            className="font-bebas text-[52px] leading-none tracking-widest select-none"
            style={{ color: isActive ? "var(--champagne)" : "rgba(0,0,0,0.08)" }}
            animate={hovered && isActive ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {number}
          </motion.span>
          {isActive
            ? <span className="badge-active mt-1 shrink-0">{statusLabel}</span>
            : <span className="badge-planned mt-1 shrink-0">{statusLabel}</span>}
        </div>

        <h2
          className="font-bebas tracking-wide leading-none"
          style={{
            fontSize: "clamp(28px, 2.4vw, 38px)",
            color: isActive ? "var(--text-1)" : "var(--text-3)",
            WebkitTextStroke: isActive ? "0.4px currentColor" : "0px",
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
          <motion.div
            className="mt-3 flex items-baseline gap-2"
            animate={hovered ? { x: 2 } : { x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="font-bebas text-[36px] leading-none tracking-wider" style={{ color: "var(--champagne)" }}>
              {stat.value}
            </span>
            <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: "var(--text-3)" }}>
              {stat.label}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Stacked preview images ────────────────────────────── */}
      {previewImages && previewImages.length > 0 && (
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            height: "220px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.015), rgba(0,0,0,0.04))",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {previewImages.map((src, i) => {
            const total = previewImages.length;
            const mid = (total - 1) / 2;
            const offset = (i - mid) * 76;
            const depth = Math.abs(i - mid);
            const zIndex = total - depth;
            const scale = 1 - depth * 0.04;
            const verticalOffset = depth * 6;

            return (
              <motion.div
                key={src}
                className="absolute"
                animate={
                  hovered
                    ? { x: offset + (i - mid) * 8, y: verticalOffset - 4, scale: scale + 0.02 }
                    : { x: offset, y: verticalOffset, scale }
                }
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: depth * 0.04 }}
                style={{
                  zIndex,
                  width: "152px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  boxShadow: `0 ${4 + depth * 4}px ${16 + depth * 12}px rgba(0,0,0,${0.14 + depth * 0.06})`,
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Footer / CTA ──────────────────────────────────────── */}
      <div className="px-6 py-5 flex flex-col gap-4 mt-auto">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="tag"
              style={{
                borderColor: isActive ? "var(--border-mid)" : "var(--border)",
                color: isActive ? "var(--text-2)" : "var(--text-3)",
                background: isActive ? "rgba(0,0,0,0.03)" : "transparent",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        {isActive ? (
          href ? (
            <Link href={href} className="btn-primary w-full justify-center group">
              {ctaLabel}
              <ArrowRight size={11} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <button onClick={onCta} className="btn-primary w-full justify-center group">
              {ctaLabel}
              <ArrowRight size={11} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
            </button>
          )
        ) : (
          <button disabled className="btn-ghost w-full justify-center">
            <Lock size={10} strokeWidth={1.5} />
            {ctaLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
