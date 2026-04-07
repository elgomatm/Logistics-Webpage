"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

interface StatBlock {
  value: number | string;
  label: string;
}

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
  id,
  number,
  title,
  subtitle,
  description,
  tags,
  status,
  statusLabel,
  ctaLabel = "Open Module",
  href,
  onCta,
  index,
  stat,
}: ModuleCardProps) {
  const isActive = status === "active";

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.65,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.1,
      }}
      className={`module-card ${isActive ? "module-card-active" : ""} flex flex-col h-full`}
    >
      {/* Card header */}
      <div className="px-7 pt-7 pb-6 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Module number — large ghosted */}
          <span
            className="font-bebas text-[52px] leading-none tracking-widest select-none"
            style={{ color: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)" }}
          >
            {number}
          </span>

          {/* Status badge */}
          {isActive ? (
            <span className="badge-active mt-2 shrink-0">{statusLabel}</span>
          ) : (
            <span className="badge-planned mt-2 shrink-0">{statusLabel}</span>
          )}
        </div>

        {/* Title */}
        <h2
          className="font-bebas tracking-wide leading-none"
          style={{
            fontSize: "clamp(32px, 2.8vw, 44px)",
            color: isActive ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.22)",
          }}
        >
          {title}
        </h2>

        {/* Subtitle */}
        <p
          className="text-[9px] tracking-[0.22em] uppercase mt-2"
          style={{ color: isActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)" }}
        >
          {subtitle}
        </p>

        {/* Live stat (optional) */}
        {stat && isActive && (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-bebas text-[36px] leading-none text-white/80 tracking-wider">
              {stat.value}
            </span>
            <span className="text-[9px] tracking-[0.18em] uppercase text-white/25">
              {stat.label}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-7 py-6 flex-1 flex flex-col justify-between gap-7">
        {/* Description */}
        <p
          className="text-[13px] leading-[1.75]"
          style={{ color: isActive ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.16)" }}
        >
          {description}
        </p>

        <div className="space-y-5">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="tag"
                style={{
                  borderColor: isActive ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                  color: isActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA — link or button */}
          {isActive ? (
            href ? (
              <Link
                href={href}
                className="btn-primary w-full justify-center group"
              >
                {ctaLabel}
                <ArrowRight
                  size={12}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : (
              <button
                onClick={onCta}
                className="btn-primary w-full justify-center group"
              >
                {ctaLabel}
                <ArrowRight
                  size={12}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
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
