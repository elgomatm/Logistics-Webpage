"use client"

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
// window.electronAPI global type is declared in src/types/electron.d.ts

interface ProgressMessage {
  partner?: string
  pct?:     number
  step?:    string
  overall?: number
  done?:    boolean
  error?:   string
  outputPath?: string
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PartnerEntry {
  name:         string
  logo_path:    string | null   // absolute FS path to partner logo PNG
  include_guests: boolean       // whether to include guest slides in this report
}

interface MetaPost {
  name: string; date: string; views: string; reach: string;
  likes: string; shares: string; comments: string; saves: string;
}
interface Testimonial { quote: string; attribution: string; }
interface GuestRow    { full_name: string; email: string; exotic_car: string; }

// ── Gallery types ─────────────────────────────────────────────────────────────

interface PhotoCrop {
  file:  File
  url:   string   // object URL for preview
  path:  string   // real filesystem path (via electronAPI.getPathForFile)
  posX:  number   // 0–100 focal point X
  posY:  number   // 0–100 focal point Y
  zoom:  number   // 1.0 = cover fit, 2.0 = 2× zoom, max 4.0
}
interface GallerySlide {
  title:  string
  photos: (PhotoCrop | null)[]  // always 7 elements
}
const makeEmptySlide = (): GallerySlide => ({
  title: '', photos: Array(7).fill(null) as null[],
})

// Slot layout from slideLayout3.xml (% of slide dims, portrait 8.5×11)
const PHOTO_SLOTS = [
  { l: 6.793,  t: 17.045, w: 42.824, h: 18.091 }, // L1
  { l: 6.793,  t: 35.510, w: 42.824, h: 18.091 }, // L2
  { l: 6.793,  t: 53.975, w: 42.824, h: 18.091 }, // L3
  { l: 6.793,  t: 72.439, w: 42.824, h: 18.091 }, // L4
  { l: 50.196, t: 17.045, w: 42.941, h: 24.182 }, // R1
  { l: 50.196, t: 41.606, w: 42.941, h: 24.364 }, // R2
  { l: 50.196, t: 66.348, w: 42.941, h: 24.182 }, // R3
] as const

interface WizardState {
  event_name:   string
  event_abbrev: string   // e.g. "LSS 2026" — used in slide footers
  partners:     PartnerEntry[]
  intro_body: string
  overview_text: string; retention_text: string
  stat_guests: string; stat_cars: string; stat_car_value: string; stat_content_units: string
  campaign_subtitle: string; campaign_description: string
  total_views: string; total_reach: string; total_likes: string
  total_shares: string; total_comments: string; total_saves: string
  posts: MetaPost[]
  testimonials:         Testimonial[]
  testimonials_bg_path: string | null
  gallery_slides: GallerySlide[]
  photo_album_url: string; photo_album_label: string; social_content_count: string
  pixieset_url: string
  guests: GuestRow[]
}

const EMPTY_TESTIMONIALS: Testimonial[] = Array(5).fill(null).map(() => ({ quote: '', attribution: '' }))

const makePartnerRow = (): PartnerEntry => ({ name: '', logo_path: null, include_guests: true })
const makePost       = (): MetaPost => ({ name: '', date: '', views: '', reach: '', likes: '', shares: '', comments: '', saves: '' })
const makeGuest      = (): GuestRow => ({ full_name: '', email: '', exotic_car: '' })

const INITIAL: WizardState = {
  event_name:   '',
  event_abbrev: '',
  partners:     [makePartnerRow()],
  intro_body: '',
  overview_text: '', retention_text: '',
  stat_guests: '', stat_cars: '', stat_car_value: '', stat_content_units: '',
  campaign_subtitle: '', campaign_description: '',
  total_views: '', total_reach: '', total_likes: '',
  total_shares: '', total_comments: '', total_saves: '',
  posts: [makePost()],
  testimonials: EMPTY_TESTIMONIALS,
  testimonials_bg_path: null,
  gallery_slides: [makeEmptySlide(), makeEmptySlide(), makeEmptySlide()],
  photo_album_url: '', photo_album_label: '', social_content_count: '',
  pixieset_url: '',
  guests: [makeGuest()],
}

const STEPS = [
  'Event & Partners', 'Introduction', 'Overview & Stats',
  'Digital Campaign',  'Testimonials',  'Gallery',
  'Content',           'Guest Data',
]

// ── Electron asset paths (strings instead of File objects) ───────────────────

interface AssetPaths {
  template:       string | null
  cover:          string | null
  title_png:      string | null
  master_header:  string | null   // full-width header image that appears on every slide (slide master)
}

// ── Build manifest ────────────────────────────────────────────────────────────

function buildManifest(
  s: WizardState,
  partner: PartnerEntry,
  galleryPaths: Record<string, string> = {},
): object {
  const gallery_slides = s.gallery_slides.map((slide, si) => ({
    title: slide.title,
    photos: slide.photos.map((photo, pi) => {
      if (!photo) return null
      const key  = `gallery_${si}_${pi}`
      const path = galleryPaths[key] ?? ''
      return { path, pos_x: photo.posX, pos_y: photo.posY, zoom: photo.zoom ?? 1.0 }
    }),
  }))

  return {
    event_name:         s.event_name.trim(),
    event_abbrev:       s.event_abbrev.trim(),
    partner_name:       partner.name.trim(),
    partner_logo_path:  partner.logo_path ?? null,
    include_guests:     partner.include_guests,
    intro_body:         s.intro_body.trim(),
    overview_text:      s.overview_text.trim(),
    retention_text:     s.retention_text.trim(),
    stats: {
      guests:        s.stat_guests.trim()        || '~500',
      cars:          s.stat_cars.trim()          || '70',
      car_value:     s.stat_car_value.trim()     || '~$25M',
      content_units: s.stat_content_units.trim() || '~100',
    },
    campaign_subtitle:    s.campaign_subtitle.trim(),
    campaign_description: s.campaign_description.trim(),
    meta_headline: {
      total_views:    s.total_views.trim(),
      total_reach:    s.total_reach.trim(),
      total_likes:    s.total_likes.trim(),
      total_shares:   s.total_shares.trim(),
      total_comments: s.total_comments.trim(),
      total_saves:    s.total_saves.trim(),
    },
    meta_posts:           s.posts.filter(p => p.name.trim()),
    testimonials:         s.testimonials.filter(t => t.quote.trim()),
    testimonials_bg_path: s.testimonials_bg_path ?? null,
    gallery_slides,
    photo_album_url:      s.photo_album_url.trim(),
    photo_album_label:    s.photo_album_label.trim(),
    social_content_count: s.social_content_count.trim() || '0',
    pixieset_url:         s.pixieset_url.trim(),
    guests:               partner.include_guests ? s.guests.filter(g => g.full_name.trim()) : [],
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.5)] mb-1">
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`input-field text-sm ${className}`}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="input-field text-sm resize-y font-mono"
    />
  )
}

// ── ElectronFileDropZone ──────────────────────────────────────────────────────
// Uses native OS file dialog instead of browser <input type="file">

function ElectronFileDropZone({
  label, accept, hint, filePath, onFilePath,
}: {
  label:      string
  accept:     { name: string; extensions: string[] }[]
  hint:       string
  filePath:   string | null
  onFilePath: (p: string) => void
}) {
  const [dragging, setDragging] = useState(false)

  const handleBrowse = async () => {
    const result = await window.electronAPI.openFile({
      filters:    accept,
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths[0]) {
      onFilePath(result.filePaths[0])
    }
  }

  // OS drag-and-drop — works in Electron even without <input type="file">
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fsPath = window.electronAPI?.getPathForFile
      ? window.electronAPI.getPathForFile(file)
      : (file as unknown as { path?: string }).path || ''
    if (fsPath) onFilePath(fsPath)
  }, [onFilePath])

  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null

  return (
    <div>
      <Label>{label}</Label>
      <div
        onClick={handleBrowse}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-4 py-5 cursor-pointer transition-colors
          ${dragging
            ? 'border-[rgba(204,28,28,0.7)] bg-[rgba(204,28,28,0.08)]'
            : filePath
              ? 'border-[rgba(204,28,28,0.4)] bg-[rgba(204,28,28,0.05)]'
              : 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.25)]'
          }`}
      >
        {filePath ? (
          <>
            <span className="text-[rgba(204,28,28,0.9)] text-sm font-medium truncate max-w-full px-2">
              ✓ {fileName}
            </span>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">
              click to replace
            </span>
          </>
        ) : (
          <>
            <span className="upload-zone-label">
              Drop file here or <span className="text-[rgba(204,28,28,0.8)] underline cursor-pointer">browse</span>
            </span>
            <span className="upload-zone-hint">{hint}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Step panels ───────────────────────────────────────────────────────────────

function PartnerTable({
  partners, onChange,
}: {
  partners: PartnerEntry[]
  onChange: (p: PartnerEntry[]) => void
}) {
  const update = (i: number, patch: Partial<PartnerEntry>) => {
    const next = partners.map((p, idx) => idx === i ? { ...p, ...patch } : p)
    onChange(next)
  }
  const addRow    = () => onChange([...partners, makePartnerRow()])
  const removeRow = (i: number) => {
    if (partners.length <= 1) return
    onChange(partners.filter((_, idx) => idx !== i))
  }

  const pickLogo = async (i: number) => {
    const result = await window.electronAPI.openFile({
      filters:    [{ name: 'Images', extensions: ['png','jpg','jpeg'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths[0]) {
      update(i, { logo_path: result.filePaths[0] })
    }
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid gap-2 text-[9px] uppercase tracking-[0.15em] text-[var(--text-3)] px-1"
        style={{ gridTemplateColumns: '1fr 160px 90px 28px' }}>
        <span>Partner Name</span>
        <span>Logo (PNG)</span>
        <span className="text-center">Guest Data?</span>
        <span />
      </div>

      {partners.map((p, i) => (
        <div key={i} className="grid gap-2 items-center"
          style={{ gridTemplateColumns: '1fr 160px 90px 28px' }}>
          {/* Name */}
          <input
            value={p.name}
            onChange={e => update(i, { name: e.target.value })}
            placeholder="e.g. COTA"
            className="input-field text-sm"
          />

          {/* Logo upload */}
          <button
            onClick={() => pickLogo(i)}
            className="h-[40px] rounded-lg border border-dashed text-[10px] text-center
              transition-colors truncate px-2"
            style={{
              borderColor: p.logo_path ? 'rgba(204,28,28,0.4)' : 'rgba(255,255,255,0.12)',
              background:  p.logo_path ? 'rgba(204,28,28,0.05)' : '#1a1a1a',
              color:       p.logo_path ? 'rgba(204,28,28,0.85)' : 'var(--text-3)',
            }}
            title={p.logo_path ?? 'Click to upload logo'}
          >
            {p.logo_path ? `✓ ${p.logo_path.split(/[\\/]/).pop()}` : 'Upload logo…'}
          </button>

          {/* Guest data toggle */}
          <button
            onClick={() => update(i, { include_guests: !p.include_guests })}
            className="h-[40px] rounded-lg text-[11px] font-medium tracking-wide transition-colors"
            style={{
              background:  p.include_guests ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
              border:      p.include_guests ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
              color:       p.include_guests ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.3)',
            }}
          >
            {p.include_guests ? 'Yes' : 'No'}
          </button>

          {/* Remove */}
          <button
            onClick={() => removeRow(i)}
            disabled={partners.length <= 1}
            className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-3)]
              hover:text-red-400 hover:bg-[rgba(255,60,60,0.08)] transition-colors
              disabled:opacity-20 disabled:cursor-not-allowed"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="mt-1 text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-lg
          border border-[rgba(255,255,255,0.1)] text-[var(--text-3)]
          hover:text-[var(--text-1)] hover:border-[rgba(255,255,255,0.2)] transition-colors"
      >
        + Add Partner
      </button>
      <p className="text-[11px] text-[var(--text-3)]">
        Each row generates a separate tailored report. "Guest Data?" controls whether guest slides are included.
      </p>
    </div>
  )
}

// ── HeaderSlot ─────────────────────────────────────────────────────────────────
// Combined upload + drag-to-reposition + scroll-to-zoom for the slide master
// header image.  Aspect ratio matches the actual header band (85% wide × 17.4%
// tall of the slide).  Empty state: dashed placeholder.  Filled: draggable +
// zoomable image with a × clear button.

function HeaderSlot({
  filePath, onFilePath, onClear,
  posX, posY, zoom,
  onMove, onZoom,
}: {
  filePath:   string | null
  onFilePath: (p: string) => void
  onClear:    () => void
  posX:  number
  posY:  number
  zoom:  number
  onMove: (dx: number, dy: number, rect: DOMRect) => void
  onZoom: (delta: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const dragRef      = useRef<{ x: number; y: number } | null>(null)
  const onMoveRef    = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove }, [onMove])
  const pendingPos   = useRef<{ x: number; y: number } | null>(null)
  const rafRef       = useRef<number | null>(null)

  // Blob URL for in-app preview (gallery-style, avoids broken local-file:// protocol)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  // Revoke blob URL when filePath is cleared externally
  useEffect(() => {
    if (!filePath && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps
  // Cleanup on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      pendingPos.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (!dragRef.current || !containerRef.current || !pendingPos.current) return
        const dx = pendingPos.current.x - dragRef.current.x
        const dy = pendingPos.current.y - dragRef.current.y
        dragRef.current = { x: pendingPos.current.x, y: pendingPos.current.y }
        pendingPos.current = null
        onMoveRef.current(dx, dy, containerRef.current.getBoundingClientRect())
      })
    }
    const handleUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup',   handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup',   handleUp)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const fsPath = window.electronAPI?.getPathForFile
      ? window.electronAPI.getPathForFile(f)
      : (f as unknown as { path?: string }).path || ''
    if (fsPath) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(f))
      onFilePath(fsPath)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f || !f.type.startsWith('image/')) return
    const fsPath = window.electronAPI?.getPathForFile
      ? window.electronAPI.getPathForFile(f)
      : (f as unknown as { path?: string }).path || ''
    if (fsPath) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(f))
      onFilePath(fsPath)
    }
  }

  const hasSrc = !!(filePath && previewUrl)
  const imgSrc = previewUrl

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="w-full rounded overflow-hidden border border-[var(--border)] relative select-none"
        style={{
          paddingBottom: `${(17.4 / 85) * 100}%`,
          cursor: hasSrc ? 'grab' : 'pointer',
        }}
        onClick={() => { if (!hasSrc) inputRef.current?.click() }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onMouseDown={e => {
          if (!hasSrc) return
          e.preventDefault()
          dragRef.current = { x: e.clientX, y: e.clientY }
          document.body.style.cursor = 'grabbing'
          document.body.style.userSelect = 'none'
        }}
        onWheel={e => {
          if (!hasSrc) return
          e.preventDefault()
          e.stopPropagation()
          onZoom(e.deltaY < 0 ? 0.12 : -0.12)
        }}
      >
        {hasSrc ? (
          <>
            <img
              src={imgSrc}
              alt="Master header preview"
              draggable={false}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                objectFit: 'cover',
                objectPosition: `${posX}% ${posY}%`,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                transformOrigin: `${posX}% ${posY}%`,
              }}
            />
            {/* Clear button */}
            <button
              className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)]
                text-white text-[10px] flex items-center justify-center
                hover:bg-[rgba(255,60,60,0.85)] transition-colors"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onClear() }}
            >×</button>
            {/* Hint */}
            <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none">
              <span
                className="px-1.5 py-0.5 rounded-full"
                style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', background: 'rgba(0,0,0,0.45)' }}
              >
                drag · scroll ±
              </span>
            </div>
          </>
        ) : (
          // Empty placeholder — click or drop to upload
          <div className="absolute inset-0 flex flex-col items-center justify-center
            border-2 border-dashed border-[var(--border)] rounded
            hover:border-[rgba(204,28,28,0.4)] hover:bg-[rgba(204,28,28,0.03)] transition-colors">
            <span className="text-[var(--text-3)] text-lg mb-0.5">+</span>
            <span className="text-[9px] text-[var(--text-3)]">Master header photo</span>
            <span className="text-[8px] text-[var(--text-3)] opacity-60 mt-0.5">click or drop image</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-[10px] text-[var(--text-3)]">
        Full-width banner at the top of every slide
        {' '}<strong style={{ color: 'var(--text-1)' }}>(Picture 3 in slide master)</strong>
      </p>
    </div>
  )
}

function Step1({
  s, set, assets, setAssetPath,
  masterHeaderFocus, setMasterHeaderFocus,
  masterHeaderZoom,  setMasterHeaderZoom,
}: {
  s:            WizardState
  set:          (k: keyof WizardState, v: unknown) => void
  assets:       AssetPaths
  setAssetPath: (k: keyof AssetPaths, p: string) => void
  masterHeaderFocus:    { x: number; y: number }
  setMasterHeaderFocus: (f: { x: number; y: number }) => void
  masterHeaderZoom:     number
  setMasterHeaderZoom:  (z: number) => void
}) {
  // Stable ref pattern — focus updates without re-attaching the drag listener
  const focusRef = useRef(masterHeaderFocus)
  useEffect(() => { focusRef.current = masterHeaderFocus }, [masterHeaderFocus])

  const moveFocal = useCallback((dx: number, dy: number, rect: DOMRect) => {
    const cur = focusRef.current
    setMasterHeaderFocus({
      x: Math.max(0, Math.min(100, cur.x - (dx / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, cur.y - (dy / rect.height) * 100)),
    })
  }, [setMasterHeaderFocus])

  const zoomFocal = useCallback((delta: number) => {
    setMasterHeaderZoom(Math.max(1.0, Math.min(4.0, masterHeaderZoom + delta)))
  }, [masterHeaderZoom, setMasterHeaderZoom])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-[11px] text-[var(--text-3)] leading-relaxed">
          Choose the <strong style={{ color: 'var(--text-1)' }}>previous event's report</strong> as your base template,
          then provide the new event's cover photo and title PNG.
        </p>

        <ElectronFileDropZone
          label="Previous Event Report (PPTX) *"
          accept={[{ name: 'PowerPoint', extensions: ['pptx'] }]}
          hint="The last completed TEN event report — used as the structural base"
          filePath={assets.template}
          onFilePath={p => setAssetPath('template', p)}
        />

        <div className="grid grid-cols-2 gap-4">
          <ElectronFileDropZone
            label="Cover Photo"
            accept={[{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }]}
            hint="Full-bleed background for slide 1"
            filePath={assets.cover}
            onFilePath={p => setAssetPath('cover', p)}
          />
          <ElectronFileDropZone
            label="Event Title PNG"
            accept={[{ name: 'PNG', extensions: ['png'] }]}
            hint="Transparent PNG — styled event name overlay"
            filePath={assets.title_png}
            onFilePath={p => setAssetPath('title_png', p)}
          />
        </div>

        {/* Master header — combined upload + reposition + zoom in one box */}
        <HeaderSlot
          filePath={assets.master_header}
          onFilePath={p => setAssetPath('master_header', p)}
          onClear={() => {
            setAssetPath('master_header', '')
            setMasterHeaderFocus({ x: 50, y: 50 })
            setMasterHeaderZoom(1.0)
          }}
          posX={masterHeaderFocus.x}
          posY={masterHeaderFocus.y}
          zoom={masterHeaderZoom}
          onMove={moveFocal}
          onZoom={zoomFocal}
        />
      </div>

      <hr className="border-[var(--border)]" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Event Name</Label>
          <Input value={s.event_name} onChange={v => set('event_name', v)}
            placeholder="e.g. Lone Star Supercars 2026" />
        </div>
        <div>
          <Label>Event Abbreviation</Label>
          <Input value={s.event_abbrev} onChange={v => set('event_abbrev', v)}
            placeholder="e.g. LSS 2026" />
          <p className="text-[10px] text-[var(--text-3)] mt-1">Used in slide footers</p>
        </div>
      </div>

      <div>
        <Label>Partners</Label>
        <PartnerTable
          partners={s.partners}
          onChange={p => set('partners', p)}
        />
      </div>
    </div>
  )
}

function Step2({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Introduction Letter Body</Label>
        <p className="text-[11px] text-[var(--text-3)] mb-2">
          Separate paragraphs with a blank line. The "TO THE [PARTNER] TEAM," salutation is auto-generated.
        </p>
        <Textarea rows={14} value={s.intro_body} onChange={v => set('intro_body', v)}
          placeholder={'There\'s something special about an event...\n\nBut what stayed with us most wasn\'t the cars...'} />
      </div>
    </div>
  )
}

function Step3({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Guests (~500)</Label>
          <Input value={s.stat_guests} onChange={v => set('stat_guests', v)} placeholder="~500" /></div>
        <div><Label>Exotic Cars</Label>
          <Input value={s.stat_cars} onChange={v => set('stat_cars', v)} placeholder="70" /></div>
        <div><Label>Est. Car Value</Label>
          <Input value={s.stat_car_value} onChange={v => set('stat_car_value', v)} placeholder="~$25M" /></div>
        <div><Label>Content Units</Label>
          <Input value={s.stat_content_units} onChange={v => set('stat_content_units', v)} placeholder="~100" /></div>
      </div>
      <div>
        <Label>Overview Paragraph</Label>
        <Textarea rows={5} value={s.overview_text} onChange={v => set('overview_text', v)}
          placeholder="Lone Star Supercars 2026 showed us exactly what TEN looks like…" />
      </div>
      <div>
        <Label>Attendee Retention Analytics Paragraph</Label>
        <Textarea rows={5} value={s.retention_text} onChange={v => set('retention_text', v)}
          placeholder="Lone Star Supercars 2026 brought together one of the strongest Texas crowds…" />
      </div>
    </div>
  )
}

const POST_COLS: { key: keyof MetaPost; label: string; placeholder: string; width: string }[] = [
  { key: 'name',     label: 'Post Name',  placeholder: 'LSS 2026 Reel', width: '2fr' },
  { key: 'date',     label: 'Date',       placeholder: 'Mar 14',        width: '80px' },
  { key: 'views',    label: 'Views',      placeholder: '8.2M',          width: '70px' },
  { key: 'reach',    label: 'Reach',      placeholder: '620K',          width: '70px' },
  { key: 'likes',    label: 'Likes',      placeholder: '41K',           width: '70px' },
  { key: 'shares',   label: 'Shares',     placeholder: '12K',           width: '70px' },
  { key: 'comments', label: 'Comments',   placeholder: '890',           width: '70px' },
  { key: 'saves',    label: 'Saves',      placeholder: '3.4K',          width: '70px' },
]

function PostsTable({ posts, onChange }: { posts: MetaPost[]; onChange: (p: MetaPost[]) => void }) {
  const update = (i: number, k: keyof MetaPost, v: string) => {
    const next = posts.map((p, idx) => idx === i ? { ...p, [k]: v } : p)
    onChange(next)
  }
  const addRow    = () => onChange([...posts, makePost()])
  const removeRow = (i: number) => {
    if (posts.length <= 1) return
    onChange(posts.filter((_, idx) => idx !== i))
  }

  const gridCols = POST_COLS.map(c => c.width).join(' ') + ' 28px'

  return (
    <div className="space-y-1.5 overflow-x-auto">
      {/* Header */}
      <div className="grid gap-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--text-3)] px-1 min-w-[700px]"
        style={{ gridTemplateColumns: gridCols }}>
        {POST_COLS.map(c => <span key={c.key}>{c.label}</span>)}
        <span />
      </div>
      {/* Rows */}
      {posts.map((p, i) => (
        <div key={i} className="grid gap-1.5 items-center min-w-[700px]"
          style={{ gridTemplateColumns: gridCols }}>
          {POST_COLS.map(c => (
            <input
              key={c.key}
              value={p[c.key]}
              onChange={e => update(i, c.key, e.target.value)}
              placeholder={c.placeholder}
              className="input-field text-xs py-1.5 px-2"
            />
          ))}
          <button
            onClick={() => removeRow(i)}
            disabled={posts.length <= 1}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-3)]
              hover:text-red-400 hover:bg-[rgba(255,60,60,0.08)] transition-colors
              disabled:opacity-20 disabled:cursor-not-allowed"
          >×</button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-lg mt-1
          border border-[rgba(255,255,255,0.1)] text-[var(--text-3)]
          hover:text-[var(--text-1)] hover:border-[rgba(255,255,255,0.2)] transition-colors"
      >+ Add Post</button>
      <p className="text-[11px] text-[var(--text-3)]">Up to 98 posts (7 slides × 14 rows).</p>
    </div>
  )
}

function Step4({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Campaign Headline</Label>
        <Input value={s.campaign_subtitle} onChange={v => set('campaign_subtitle', v)}
          placeholder="TEN'S LARGEST DIGITAL CAMPAIGN YET" />
      </div>
      <div>
        <Label>Campaign Description</Label>
        <Textarea rows={3} value={s.campaign_description} onChange={v => set('campaign_description', v)}
          placeholder="The following analytics represent the aggregate metrics…" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['total_views','total_reach','total_likes','total_shares','total_comments','total_saves'] as const).map(k => (
          <div key={k}>
            <Label>{k.replace('total_','').replace('_',' ')}</Label>
            <Input value={s[k]} onChange={v => set(k, v)} placeholder="57.6M+" />
          </div>
        ))}
      </div>
      <div>
        <Label>Post Table</Label>
        <PostsTable posts={s.posts} onChange={p => set('posts', p)} />
      </div>
    </div>
  )
}

function Step5({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  const updateT = (i: number, field: keyof Testimonial, val: string) => {
    const t = [...s.testimonials]
    t[i] = { ...t[i], [field]: val }
    set('testimonials', t)
  }
  return (
    <div className="space-y-6">
      <p className="text-[11px] text-[var(--text-3)]">
        5 frosted-glass bars top → bottom. Unused bars are hidden automatically.
        The same background photo is used for all bars — crop adjustments are reflected across the whole slide.
      </p>

      <ElectronFileDropZone
        label="Testimonials Slide Background Photo"
        accept={[{ name: 'Images', extensions: ['jpg','jpeg','png'] }]}
        hint="This photo fills the entire slide behind the frosted-glass bars"
        filePath={s.testimonials_bg_path}
        onFilePath={p => set('testimonials_bg_path', p)}
      />

      {s.testimonials.map((t, i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg p-4 space-y-3 bg-[var(--surface)]">
          <p className="text-xs text-[rgba(204,28,28,0.8)] font-bebas tracking-widest">Bar {i + 1}</p>
          <div>
            <Label>Quote</Label>
            <Textarea rows={3} value={t.quote} onChange={v => updateT(i, 'quote', v)}
              placeholder="Such an amazing day and event! Honored we were a part of it!!" />
          </div>
          <div>
            <Label>Attribution</Label>
            <Input value={t.attribution} onChange={v => updateT(i, 'attribution', v)}
              placeholder="– Preston Wall (President, Frontline Heroes Outdoors)" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── PhotoSlot ─────────────────────────────────────────────────────────────────

function PhotoSlot({
  photo, onAssign, onClear, onMove, onZoom, slotIndex,
}: {
  photo:     PhotoCrop | null
  onAssign:  (f: File) => void
  onClear:   () => void
  onMove:    (dx: number, dy: number, rect: DOMRect) => void
  onZoom:    (delta: number) => void
  slotIndex: number
}) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const slotRef    = useRef<HTMLDivElement>(null)
  const dragRef    = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  // Keep a stable ref to the latest onMove so we never need to re-attach listeners
  const onMoveRef   = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove }, [onMove])

  // Pending mouse position + RAF handle — used to throttle updates to one per frame
  const pendingPos = useRef<{ x: number; y: number } | null>(null)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      // Record latest absolute position; only schedule one RAF per frame
      pendingPos.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (!dragRef.current || !slotRef.current || !pendingPos.current) return
        const dx = pendingPos.current.x - dragRef.current.x
        const dy = pendingPos.current.y - dragRef.current.y
        dragRef.current = { x: pendingPos.current.x, y: pendingPos.current.y }
        pendingPos.current = null
        onMoveRef.current(dx, dy, slotRef.current.getBoundingClientRect())
      })
    }
    const handleUp = () => {
      dragRef.current = null
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup',  handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup',  handleUp)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, []) // empty — attach once, never re-attach

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) onAssign(f)
  }, [onAssign])

  const startDrag = (e: React.MouseEvent) => {
    if (!photo) return
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY }
    isDragging.current = true
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      ref={slotRef}
      className="absolute overflow-hidden"
      style={{
        left:   `${PHOTO_SLOTS[slotIndex].l}%`,
        top:    `${PHOTO_SLOTS[slotIndex].t}%`,
        width:  `${PHOTO_SLOTS[slotIndex].w}%`,
        height: `${PHOTO_SLOTS[slotIndex].h}%`,
        cursor: photo ? 'grab' : 'pointer',
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => { if (!photo) inputRef.current?.click() }}
      onMouseDown={startDrag}
      onWheel={e => {
        if (!photo) return
        e.preventDefault()
        e.stopPropagation()
        onZoom(e.deltaY < 0 ? 0.12 : -0.12)
      }}
    >
      {/* Hidden file input — gallery photos keep <input type="file"> for drag-and-drop UX */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onAssign(f)
          e.target.value = ''
        }}
      />

      {photo ? (
        <>
          <img
            src={photo.url}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              objectFit: 'cover',
              objectPosition: `${photo.posX}% ${photo.posY}%`,
              transform: photo.zoom !== 1 ? `scale(${photo.zoom})` : undefined,
              transformOrigin: `${photo.posX}% ${photo.posY}%`,
            }}
          />
          <button
            className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)]
              text-white text-[10px] flex items-center justify-center
              hover:bg-[rgba(255,60,60,0.85)] transition-colors"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClear() }}
          >
            ×
          </button>
          <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-[8px] text-[rgba(255,255,255,0.5)] bg-[rgba(0,0,0,0.4)] px-1.5 py-0.5 rounded-full">
              drag · scroll ±
            </span>
          </div>
        </>
      ) : (
        // Empty slot — dark styling so it's visible against the white slide background
        <div className="w-full h-full flex flex-col items-center justify-center
          border-2 border-dashed border-[rgba(0,0,0,0.22)]
          bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.09)] transition-colors">
          <span className="text-[rgba(0,0,0,0.35)] text-xl mb-1">+</span>
          <span className="text-[8px] text-[rgba(0,0,0,0.3)] text-center px-1">drop or click</span>
        </div>
      )}
    </div>
  )
}

// ── GalleryStep ───────────────────────────────────────────────────────────────

function GalleryStep({ slides, onChange }: { slides: GallerySlide[]; onChange: (s: GallerySlide[]) => void }) {
  const [activeTab, setActiveTab] = useState(0)

  // Keep a ref so movePhoto always reads the latest slides without being recreated on every change
  const slidesRef = useRef(slides)
  useEffect(() => { slidesRef.current = slides }, [slides])

  useEffect(() => {
    return () => {
      slidesRef.current.forEach(s => s.photos.forEach(p => { if (p) URL.revokeObjectURL(p.url) }))
    }
  }, [])

  const updateSlide = (si: number, patch: Partial<GallerySlide>) => {
    onChange(slides.map((s, i) => i === si ? { ...s, ...patch } : s))
  }

  const assignPhoto = (si: number, pi: number, file: File) => {
    const slides_ = [...slides]
    const old = slides_[si].photos[pi]
    if (old) URL.revokeObjectURL(old.url)
    const photos = [...slides_[si].photos] as (PhotoCrop | null)[]

    // Get real filesystem path for Python — Electron exposes webUtils.getPathForFile
    const fsPath = window.electronAPI?.getPathForFile
      ? window.electronAPI.getPathForFile(file)
      : (file as unknown as { path?: string }).path || ''

    photos[pi] = { file, url: URL.createObjectURL(file), path: fsPath, posX: 50, posY: 50, zoom: 1.0 }
    updateSlide(si, { photos })
  }

  const clearPhoto = (si: number, pi: number) => {
    const photos = [...slides[si].photos] as (PhotoCrop | null)[]
    if (photos[pi]) URL.revokeObjectURL(photos[pi]!.url)
    photos[pi] = null
    updateSlide(si, { photos })
  }

  // Read from slidesRef so these callbacks are never recreated when slides change —
  // preventing PhotoSlot from re-registering its document listeners on every drag tick
  const movePhoto = useCallback((si: number, pi: number, dx: number, dy: number, rect: DOMRect) => {
    const current = slidesRef.current
    const photo = current[si].photos[pi]
    if (!photo) return
    const photos = [...current[si].photos] as (PhotoCrop | null)[]
    photos[pi] = {
      ...photo,
      posX: Math.max(0, Math.min(100, photo.posX - (dx / rect.width)  * 100)),
      posY: Math.max(0, Math.min(100, photo.posY - (dy / rect.height) * 100)),
    }
    onChange(current.map((s, i) => i === si ? { ...s, photos } : s))
  }, [onChange])

  const zoomPhoto = useCallback((si: number, pi: number, delta: number) => {
    const current = slidesRef.current
    const photo = current[si].photos[pi]
    if (!photo) return
    const photos = [...current[si].photos] as (PhotoCrop | null)[]
    photos[pi] = { ...photo, zoom: Math.max(1.0, Math.min(4.0, (photo.zoom ?? 1.0) + delta)) }
    onChange(current.map((s, i) => i === si ? { ...s, photos } : s))
  }, [onChange])

  const addSlide = () => {
    if (slides.length >= 3) return
    onChange([...slides, makeEmptySlide()])
    setActiveTab(slides.length)
  }
  const removeSlide = (si: number) => {
    if (slides.length <= 1) return
    slides[si].photos.forEach(p => { if (p) URL.revokeObjectURL(p.url) })
    const next = slides.filter((_, i) => i !== si)
    onChange(next)
    setActiveTab(Math.min(activeTab, next.length - 1))
  }

  const slide = slides[activeTab] ?? slides[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-3 py-1 rounded text-[11px] tracking-wider uppercase transition-all ${
              i === activeTab
                ? 'bg-[rgba(204,28,28,0.2)] text-[rgba(204,28,28,0.9)] border border-[rgba(204,28,28,0.4)]'
                : 'text-[var(--text-3)] hover:text-[var(--text-1)] border border-transparent'
            }`}>
            Slide {i + 1}
          </button>
        ))}
        {slides.length < 3 && (
          <button onClick={addSlide}
            className="px-2.5 py-1 rounded text-[11px] text-[rgba(204,28,28,0.6)]
              border border-[rgba(204,28,28,0.2)] hover:border-[rgba(204,28,28,0.5)]
              hover:text-[rgba(204,28,28,0.9)] transition-all">
            + Add Slide
          </button>
        )}
        {slides.length > 1 && (
          <button onClick={() => removeSlide(activeTab)}
            className="ml-auto px-2.5 py-1 rounded text-[10px] text-red-400
              border border-red-200 hover:border-red-400 hover:text-red-600 transition-all">
            Remove Slide {activeTab + 1}
          </button>
        )}
      </div>

      <div>
        <Label>Gallery Slide {activeTab + 1} Title</Label>
        <Input value={slide.title} onChange={v => updateSlide(activeTab, { title: v })}
          placeholder="e.g. The Starting Grid" />
        <p className="text-[10px] text-[var(--text-3)] mt-1">Font will auto-shrink in the PPTX if text is too long.</p>
      </div>

      <div className="rounded-lg overflow-hidden border border-[var(--border-mid)]">
        <div className="relative w-full bg-white" style={{ paddingBottom: `${(10_058_400 / 7_772_400) * 100}%` }}>
          <div className="absolute inset-0">
            {Array.from({ length: 7 }, (_, pi) => (
              <PhotoSlot
                key={pi}
                slotIndex={pi}
                photo={slide.photos[pi]}
                onAssign={f => assignPhoto(activeTab, pi, f)}
                onClear={() => clearPhoto(activeTab, pi)}
                onMove={(dx, dy, rect) => movePhoto(activeTab, pi, dx, dy, rect)}
                onZoom={delta => zoomPhoto(activeTab, pi, delta)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[rgba(255,255,255,0.2)]">
        Slot positions match the PPTX layout exactly. Drag a photo within its slot to reposition the crop.
      </p>
    </div>
  )
}

function Step7({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Photo Album URL — Google Drive folder link</Label>
        <Input value={s.photo_album_url} onChange={v => set('photo_album_url', v)}
          placeholder="https://drive.google.com/drive/folders/…" />
        <p className="text-[11px] text-[var(--text-3)] mt-1">
          This is the hyperlink on the big button: "{s.photo_album_label || 'Event Photo Album'}"
        </p>
      </div>
      <div>
        <Label>Photo Album Button Label</Label>
        <Input value={s.photo_album_label} onChange={v => set('photo_album_label', v)}
          placeholder="Lone Star Supercars 2026 Event Photo Album" />
      </div>
      <div>
        <Label>Pixieset URL — "Click here to view all units" link</Label>
        <Input value={s.pixieset_url} onChange={v => set('pixieset_url', v)}
          placeholder="https://ten.pixieset.com/lone-star-supercars-2026/" />
        <p className="text-[11px] text-[var(--text-3)] mt-1">
          Links the "Please click here to view all units" text in the social media section.
        </p>
      </div>
      <div>
        <Label>Social Media Content Count</Label>
        <Input value={s.social_content_count} onChange={v => set('social_content_count', v)} placeholder="120" />
      </div>
    </div>
  )
}

const GUEST_COLS: { key: keyof GuestRow; label: string; placeholder: string; width: string }[] = [
  { key: 'full_name',  label: 'Full Name',   placeholder: 'John Smith',              width: '1.5fr' },
  { key: 'email',      label: 'Email',        placeholder: 'john@example.com',        width: '1.5fr' },
  { key: 'exotic_car', label: 'Exotic Car',   placeholder: 'Lamborghini Huracán',     width: '1fr'   },
]

function GuestTable({ guests, onChange }: { guests: GuestRow[]; onChange: (g: GuestRow[]) => void }) {
  const update = (i: number, k: keyof GuestRow, v: string) => {
    onChange(guests.map((g, idx) => idx === i ? { ...g, [k]: v } : g))
  }
  const addRow    = () => onChange([...guests, makeGuest()])
  const removeRow = (i: number) => {
    if (guests.length <= 1) return
    onChange(guests.filter((_, idx) => idx !== i))
  }

  const gridCols = GUEST_COLS.map(c => c.width).join(' ') + ' 28px'

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="grid gap-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--text-3)] px-1"
        style={{ gridTemplateColumns: gridCols }}>
        {GUEST_COLS.map(c => <span key={c.key}>{c.label}</span>)}
        <span />
      </div>
      {/* Rows */}
      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
        {guests.map((g, i) => (
          <div key={i} className="grid gap-1.5 items-center"
            style={{ gridTemplateColumns: gridCols }}>
            {GUEST_COLS.map(c => (
              <input
                key={c.key}
                value={g[c.key]}
                onChange={e => update(i, c.key, e.target.value)}
                placeholder={c.placeholder}
                className="input-field text-xs py-1.5 px-2"
              />
            ))}
            <button
              onClick={() => removeRow(i)}
              disabled={guests.length <= 1}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-3)]
                hover:text-red-400 hover:bg-[rgba(255,60,60,0.08)] transition-colors
                disabled:opacity-20 disabled:cursor-not-allowed"
            >×</button>
          </div>
        ))}
      </div>
      <button
        onClick={addRow}
        className="text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-lg mt-1
          border border-[rgba(255,255,255,0.1)] text-[var(--text-3)]
          hover:text-[var(--text-1)] hover:border-[rgba(255,255,255,0.2)] transition-colors"
      >+ Add Guest</button>
      <p className="text-[11px] text-[var(--text-3)]">Up to 105 guests (7 pages × 15 rows).</p>
    </div>
  )
}

function Step8({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <Label>Guest List</Label>
      <GuestTable guests={s.guests} onChange={g => set('guests', g)} />
    </div>
  )
}

// ── Progress overlay ──────────────────────────────────────────────────────────

function ProgressOverlay({
  partners, progress, overall, done, outputPath, error, onClose,
}: {
  partners:   string[]
  progress:   Record<string, { pct: number; step: string }>
  overall:    number
  done:       boolean
  outputPath: string
  error:      string
  onClose:    () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.85)]">
      <div className="w-full max-w-lg bg-[#111] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 space-y-6">
        <h2 className="font-bebas tracking-widest text-2xl text-[rgba(204,28,28,0.9)]">
          Generating Reports
        </h2>

        {/* Overall progress */}
        <div>
          <div className="flex justify-between text-xs text-[rgba(255,255,255,0.4)] mb-1">
            <span>Overall</span><span>{overall}%</span>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
            <div className="h-full bg-[rgba(204,28,28,0.8)] rounded-full transition-all duration-300"
              style={{ width: `${overall}%` }} />
          </div>
        </div>

        {/* Per-partner progress */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {partners.map(p => {
            const info = progress[p] ?? { pct: 0, step: 'Waiting…' }
            return (
              <div key={p}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-white truncate max-w-[70%]">{p}</span>
                  <span className="text-[rgba(255,255,255,0.4)]">{info.pct}%</span>
                </div>
                <div className="h-1 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
                  <div className="h-full bg-[rgba(204,28,28,0.5)] rounded-full transition-all duration-300"
                    style={{ width: `${info.pct}%` }} />
                </div>
                <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5 truncate">{info.step}</p>
              </div>
            )
          })}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-[rgba(255,0,0,0.08)] rounded p-3">{error}</p>
        )}

        {done && !error && (
          <div className="space-y-3">
            <p className="text-[rgba(204,28,28,0.9)] text-sm">All reports generated!</p>
            <div className="p-3 rounded-lg bg-[rgba(204,28,28,0.08)] border border-[rgba(204,28,28,0.2)]">
              <p className="text-[10px] text-[rgba(255,255,255,0.4)] mb-1">Saved to:</p>
              <p className="text-[rgba(204,28,28,0.8)] text-xs font-mono break-all">{outputPath}</p>
            </div>
          </div>
        )}

        {(done || error) && (
          <button onClick={onClose}
            className="text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
            Close
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function ReportWizard() {
  const [step,  setStep]  = useState(0)
  const [state, setState] = useState<WizardState>(INITIAL)

  // ── Electron asset paths (local filesystem paths instead of File objects) ──
  const [assets, setAssets] = useState<AssetPaths>({
    template: null, cover: null, title_png: null, master_header: null,
  })
  const [masterHeaderFocus, setMasterHeaderFocus] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const [masterHeaderZoom,  setMasterHeaderZoom]  = useState<number>(1.0)

  const [generating,       setGenerating]       = useState(false)
  const [partnerProgress,  setPartnerProgress]  = useState<Record<string, { pct: number; step: string }>>({})
  const [overall,          setOverall]          = useState(0)
  const [done,             setDone]             = useState(false)
  const [outputPath,       setOutputPath]       = useState('')
  const [genError,         setGenError]         = useState('')

  const set         = (k: keyof WizardState, v: unknown) => setState(prev => ({ ...prev, [k]: v }))
  const setAssetPath = (k: keyof AssetPaths, p: string)  => setAssets(prev => ({ ...prev, [k]: p }))

  const partners    = state.partners.filter(p => p.name.trim())
  const partnerNames = partners.map(p => p.name.trim())
  const canGenerate  = !!(state.event_name.trim() && partners.length > 0 && assets.template)

  async function generate() {
    if (!canGenerate) return
    setGenerating(true)
    setDone(false)
    setOutputPath('')
    setGenError('')
    setOverall(0)

    // ── Step A: Ask where to save the ZIP ────────────────────────────────────
    const saveResult = await window.electronAPI.saveFile({
      defaultPath: `${state.event_name.trim() || 'Reports'} - Partner Reports.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (saveResult.canceled || !saveResult.filePath) {
      setGenerating(false)
      return
    }

    // ── Step B: Build gallery paths map ──────────────────────────────────────
    const galleryPhotoPaths: Record<string, string> = {}
    state.gallery_slides.forEach((slide, si) => {
      slide.photos.forEach((photo, pi) => {
        if (photo?.path) galleryPhotoPaths[`gallery_${si}_${pi}`] = photo.path
      })
    })

    // ── Step C: Wire up progress listener ────────────────────────────────────
    window.electronAPI.removeAllListeners('generate:progress')

    const init: Record<string, { pct: number; step: string }> = {}
    partnerNames.forEach(p => { init[p] = { pct: 0, step: 'Queued…' } })
    setPartnerProgress(init)

    window.electronAPI.onProgress((msg) => {
      if (msg.partner && msg.pct !== undefined) {
        setPartnerProgress(prev => ({
          ...prev,
          [msg.partner!]: { pct: msg.pct!, step: msg.step ?? '' },
        }))
      }
      if (msg.overall !== undefined) setOverall(msg.overall)
      if (msg.done)         setDone(true)
      if (msg.outputPath)   setOutputPath(msg.outputPath)
      if (msg.error)        setGenError(msg.error)
    })

    // ── Step D: Kick off generation ───────────────────────────────────────────
    // Build per-partner manifests and pass the full partner objects to main process
    const partnerObjects = partners.map(p => ({
      name:          p.name.trim(),
      logo_path:     p.logo_path ?? null,
      include_guests: p.include_guests,
    }))
    const eventBase = buildManifest(state, partners[0], galleryPhotoPaths) as Record<string, unknown>
    delete (eventBase as Record<string, unknown>).partner_name
    delete (eventBase as Record<string, unknown>).partner_logo_path
    delete (eventBase as Record<string, unknown>).include_guests
    delete (eventBase as Record<string, unknown>).guests

    try {
      const result = await window.electronAPI.startGenerate({
        eventBase,
        partners: partnerObjects as unknown as string[],
        templatePath:     assets.template!,
        coverPath:        assets.cover         ?? null,
        titlePngPath:     assets.title_png     ?? null,
        masterHeaderPath:   assets.master_header ?? null,
        masterHeaderFocusX: assets.master_header ? masterHeaderFocus.x / 100 : null,
        masterHeaderFocusY: assets.master_header ? masterHeaderFocus.y / 100 : null,
        masterHeaderZoom:   assets.master_header ? masterHeaderZoom          : null,
        outputPath:         saveResult.filePath,
      })
      setDone(true)
      setOutputPath(result.outputPath)
      setOverall(100)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setGenError(msg)
    }
  }

  const stepComponents = [
    <Step1 key={0} s={state} set={set} assets={assets} setAssetPath={setAssetPath}
           masterHeaderFocus={masterHeaderFocus} setMasterHeaderFocus={setMasterHeaderFocus}
           masterHeaderZoom={masterHeaderZoom}   setMasterHeaderZoom={setMasterHeaderZoom} />,
    <Step2 key={1} s={state} set={set} />,
    <Step3 key={2} s={state} set={set} />,
    <Step4 key={3} s={state} set={set} />,
    <Step5 key={4} s={state} set={set} />,
    <GalleryStep key={5} slides={state.gallery_slides} onChange={slides => set('gallery_slides', slides)} />,
    <Step7 key={6} s={state} set={set} />,
    <Step8 key={7} s={state} set={set} />,
  ]

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)', overflow: 'visible' }}>
      {/* Navbar glow — behind the Report Generator title */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top:        '0px',
          left:       '50%',
          transform:  'translateX(-50%)',
          width:      '160%',
          height:     '480px',
          background: [
            'radial-gradient(ellipse 30% 38% at 50% 0%, rgba(220,28,28,0.88) 0%, rgba(204,28,28,0.42) 24%, transparent 52%)',
            'radial-gradient(ellipse 65% 62% at 50% 0%, rgba(204,28,28,0.38) 0%, rgba(180,20,20,0.12) 42%, transparent 66%)',
            'radial-gradient(ellipse 100% 78% at 50% 0%, rgba(170,14,14,0.16) 0%, transparent 68%)',
          ].join(', '),
          zIndex: 0,
        }}
      />

      {generating && (
        <ProgressOverlay
          partners={partnerNames}
          progress={partnerProgress}
          overall={overall}
          done={done}
          outputPath={outputPath}
          error={genError}
          onClose={() => setGenerating(false)}
        />
      )}

      <div className="relative max-w-2xl mx-auto px-6 pt-28 pb-20" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="mb-10">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[rgba(204,28,28,0.7)] mb-2">New Report</p>
          <h1 className="font-bebas text-5xl tracking-wide" style={{ color: 'var(--text-1)' }}>
            Report Generator
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-8 flex-wrap">
          {STEPS.map((label, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase transition-all ${
                i === step
                  ? 'text-[rgba(255,90,90,1)] border border-[rgba(220,30,30,0.7)]'
                  : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
              }`}>
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="module-card rounded-2xl p-7 mb-6">
          <h2 className="font-bebas text-2xl tracking-widest text-[rgba(204,28,28,0.8)] mb-6">
            Step {step + 1} — {STEPS[step]}
          </h2>
          {stepComponents[step]}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-lg text-sm border border-[var(--border-mid)]
              text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[rgba(255,255,255,0.25)]
              transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="px-5 py-2.5 rounded-lg text-sm
                bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)]
                text-[var(--text-1)] hover:bg-[rgba(255,255,255,0.13)] transition-colors"
            >
              Next →
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {!assets.template && (
                <p className="text-[11px] text-red-500">← Upload the template PPTX on Step 1 to generate</p>
              )}
              <button
                onClick={generate}
                disabled={!canGenerate || generating}
                className="px-8 py-2.5 rounded-lg text-sm font-medium transition-colors
                  bg-[rgba(204,28,28,0.15)] border border-[rgba(204,28,28,0.5)]
                  text-[rgba(204,28,28,0.9)] hover:bg-[rgba(204,28,28,0.25)]
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {generating
                  ? 'Generating…'
                  : `Generate ${partnerNames.length > 1 ? `${partnerNames.length} Reports` : 'Report'} →`
                }
              </button>
            </div>
          )}
        </div>

        {/* Summary card */}
        {partnerNames.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-[var(--border)]
            bg-[var(--surface)] text-xs text-[var(--text-3)] space-y-1">
            <p><span className="font-medium text-[var(--text-2)]">Event:</span> {state.event_name || '—'}</p>
            <p><span className="font-medium text-[var(--text-2)]">Partners:</span> {partnerNames.join(', ')}</p>
            <p><span className="font-medium text-[var(--text-2)]">Posts:</span> {state.posts.filter(p => p.name.trim()).length}</p>
            <p><span className="font-medium text-[var(--text-2)]">Guests:</span> {state.guests.filter(g => g.full_name.trim()).length}</p>
            {assets.template && (
              <p className="truncate">
                <span className="font-medium text-[var(--text-2)]">Template:</span>{' '}
                {assets.template.split(/[\\/]/).pop()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
