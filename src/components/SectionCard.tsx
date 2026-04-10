"use client"

import { useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'
import type { Page } from '../App'

interface StatBlock { value: number | string; label: string; loading?: boolean; }

interface ModuleCardProps {
  id:           string
  number:       string
  title:        string
  subtitle:     string
  description:  string
  tags:         string[]
  status:       'active' | 'planned'
  statusLabel:  string
  ctaLabel?:    string
  /** Used for active cards that navigate to a page */
  targetPage?:  Page
  /** Callback CTA — for non-page actions */
  onCta?:       () => void
  index:        number
  stat?:        StatBlock
  previewImages?:  string[]
  previewFit?:     'cover' | 'contain'
}

export default function SectionCard({
  id, number, title, subtitle, description,
  tags, status, statusLabel,
  ctaLabel = 'Open Module', targetPage, onCta,
  index, stat, previewImages, previewFit = 'cover',
}: ModuleCardProps) {
  const isActive = status === 'active'
  const cardRef  = useRef<HTMLDivElement>(null)
  const glowRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number>(0)
  const [hovered, setHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return
    cancelAnimationFrame(rafRef.current)
    const cx = e.clientX, cy = e.clientY
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current || !glowRef.current) return
      const rect = cardRef.current.getBoundingClientRect()
      const x = ((cx - rect.left) / rect.width  * 100).toFixed(1) + '%'
      const y = ((cy - rect.top)  / rect.height * 100).toFixed(1) + '%'
      glowRef.current.style.background =
        `radial-gradient(circle at ${x} ${y}, rgba(204,28,28,0.20) 0%, rgba(204,28,28,0.05) 40%, transparent 65%)`
    })
  }, [isActive])

  const handleMouseEnter = useCallback(() => setHovered(true), [])
  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    if (glowRef.current) glowRef.current.style.background = 'transparent'
  }, [])

  return (
    <motion.div
      id={id}
      ref={cardRef}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`module-card ${isActive ? 'module-card-active' : ''} flex flex-col h-full relative overflow-hidden`}
    >
      {isActive && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 rounded-[16px] z-10"
          style={{ transition: 'opacity 0.25s ease', opacity: hovered ? 1 : 0 }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="font-bebas text-[52px] leading-none tracking-widest select-none"
            style={{
              color: 'var(--champagne)',
              display: 'inline-block',
              transition: 'transform 0.2s ease',
              transform: hovered && isActive ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(0)',
            }}
          >
            {number}
          </span>
          {isActive
            ? <span className="badge-active mt-1 shrink-0">{statusLabel}</span>
            : <span className="badge-planned mt-1 shrink-0">{statusLabel}</span>}
        </div>

        <h2
          className="font-bebas tracking-wide leading-none"
          style={{
            fontSize: 'clamp(28px, 2.4vw, 38px)',
            color: isActive ? 'var(--text-1)' : 'var(--text-3)',
            WebkitTextStroke: isActive ? '0.4px currentColor' : '0px',
          }}
        >
          {title}
        </h2>

        <p className="text-[9px] tracking-[0.22em] uppercase mt-1.5"
          style={{ color: isActive ? 'var(--text-2)' : 'var(--text-3)' }}>
          {subtitle}
        </p>

        {stat && isActive && (
          <div
            className="mt-3 flex items-baseline gap-2"
            style={{ transform: hovered ? 'translateX(2px)' : 'translateX(0)', transition: 'transform 0.2s ease' }}
          >
            {stat.loading ? (
              <span
                style={{
                  display: 'inline-block', width: 28, height: 28, flexShrink: 0,
                  borderRadius: '50%',
                  border: '2.5px solid rgba(204,28,28,0.22)',
                  borderTopColor: 'var(--champagne)',
                  animation: 'spin 0.9s linear infinite',
                }}
              />
            ) : (
              <span className="font-bebas text-[36px] leading-none tracking-wider" style={{ color: 'var(--champagne)' }}>
                {stat.value}
              </span>
            )}
            <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: 'var(--text-3)' }}>
              {stat.label}
            </span>
          </div>
        )}
      </div>

      {/* ── Preview images ─────────────────────────────────────── */}
      {previewImages && previewImages.length > 0 && (
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            height: '220px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.015), rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {previewImages.map((src, i) => {
            const total   = previewImages.length
            const mid     = (total - 1) / 2
            const depth   = Math.abs(i - mid)
            const offsetX = (i - mid) * 76
            const offsetY = depth === 0 ? -8 : 4
            const scale   = 1 - depth * 0.04
            return (
              <div
                key={src}
                className="absolute"
                style={{
                  transform: `translateX(${offsetX}px) translateY(${offsetY}px) scale(${scale})`,
                  zIndex: total - depth,
                  width: previewFit === 'contain' ? '110px' : '152px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  boxShadow: `0 ${4 + depth * 4}px ${16 + depth * 12}px rgba(0,0,0,${0.18 + depth * 0.08})`,
                }}
              >
                <img
                  src={src}
                  alt=""
                  loading="eager"
                  style={{ width: '100%', height: '190px', objectFit: previewFit, display: 'block' }}
                />
              </div>
            )
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
                borderColor: isActive ? 'var(--border-mid)' : 'var(--border)',
                color: isActive ? 'var(--text-2)' : 'var(--text-3)',
                background: isActive ? 'rgba(0,0,0,0.03)' : 'transparent',
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {isActive ? (
          <button onClick={onCta} className="btn-primary w-full justify-center group">
            {ctaLabel}
            <ArrowRight size={11} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
          </button>
        ) : (
          <button disabled className="btn-ghost w-full justify-center">
            <Lock size={10} strokeWidth={1.5} />
            {ctaLabel}
          </button>
        )}
      </div>
    </motion.div>
  )
}
