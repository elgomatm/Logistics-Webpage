"use client"

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence }        from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProgressMessage {
  partner?:    string
  pct?:        number
  step?:       string
  overall?:    number
  done?:       boolean
  outputPath?: string
  error?:      string
}

interface ScheduleItem {
  time:     string
  activity: string
}

interface EmergencyContact {
  name:  string
  phone: string
}

interface GuidePartner {
  name:       string
  logo_path:  string | null
  intro_body: string
}

interface WizardState {
  // Step 1 – Event & Partners
  event_name:   string
  event_abbrev: string
  partners:     GuidePartner[]

  // Step 2 – Cover & Branding
  cover_photo_path: string | null
  ten_logo_path:    string | null

  // Step 3 – Day 1 Schedule
  day1_title:   string
  day1_opening: string
  day1_items:   ScheduleItem[]
  day1_bg_path: string | null

  // Step 4 – Venue / Reception
  venue_title:         string
  venue_location_name: string
  venue_arrival_text:  string
  venue_directions:    string
  venue_bg_path:       string | null

  // Step 5 – Day 2 Schedule
  day2_title:    string
  day2_opening:  string
  day2_items:    ScheduleItem[]
  day2_bg_path:  string | null
  rally_bg_path: string | null

  // Step 6 – Race Day & POI
  include_poi_slide:   boolean
  poi_title:           string
  poi_access_times:    string
  poi_bg_path:         string | null
  race_title:          string
  race_schedule_title: string
  race_items:          ScheduleItem[]
  race_bg_path:        string | null

  // Step 7 – Hotel & Rules
  hotel_title:       string
  hotel_bg_path:     string | null
  rules_general:     string
  rules_convoy:      string
  rules_vehicle:     string
  rules_emergency:   string
  emergency_contacts: EmergencyContact[]
  rules_bg_path:     string | null
  closing_bg_path:   string | null
}

const makePartner    = (): GuidePartner    => ({ name: '', logo_path: null, intro_body: '' })
const makeItem       = (): ScheduleItem    => ({ time: '', activity: '' })
const makeContact    = (): EmergencyContact => ({ name: '', phone: '' })

const INITIAL: WizardState = {
  event_name: '', event_abbrev: '',
  partners:   [makePartner()],
  cover_photo_path: null, ten_logo_path: null,
  day1_title: 'Day 1\nItinerary', day1_opening: '',
  day1_items: [makeItem(), makeItem(), makeItem()], day1_bg_path: null,
  venue_title: 'Welcome\nReception :', venue_location_name: '',
  venue_arrival_text: '', venue_directions: '', venue_bg_path: null,
  day2_title: 'Day 2\nItinerary', day2_opening: '',
  day2_items: [makeItem(), makeItem(), makeItem()], day2_bg_path: null,
  rally_bg_path: null,
  include_poi_slide: true, poi_title: 'Day 2\nCOTA POINTS OF\nINTEREST',
  poi_access_times: '', poi_bg_path: null,
  race_title: 'Day 2\nRace Day', race_schedule_title: '',
  race_items: [makeItem(), makeItem(), makeItem()], race_bg_path: null,
  hotel_title: '', hotel_bg_path: null,
  rules_general: '', rules_convoy: '', rules_vehicle: '', rules_emergency: '',
  emergency_contacts: [makeContact(), makeContact()],
  rules_bg_path: null, closing_bg_path: null,
}

const STEPS = [
  'Event & Partners',
  'Cover & Branding',
  'Day 1 Schedule',
  'Venue / Reception',
  'Day 2 Schedule',
  'Race Day & POI',
  'Hotel & Rules',
  'Generate',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

// Shared styled input / textarea
const inputCls = "w-full rounded-md px-3 py-2 text-sm bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-white placeholder:text-[rgba(255,255,255,0.3)] focus:outline-none focus:border-[rgba(255,255,255,0.35)] transition-colors"
const labelCls = "block text-[10px] tracking-[0.15em] uppercase text-[rgba(255,255,255,0.5)] mb-1.5"

function Inp({ label, value, onChange, placeholder = '', multiline = false, rows = 3 }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {multiline
        ? <textarea className={inputCls} rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input   className={inputCls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}

function FilePick({ label, value, onChange, accept = 'image/*' }:
  { label: string; value: string | null; onChange: (path: string | null) => void; accept?: string }) {

  const handleClick = async () => {
    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      onChange(result.filePaths[0])
    }
  }

  const filename = value ? value.split(/[\\/]/).pop() : null

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          className="px-3 py-2 text-xs rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)] hover:border-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
        >
          {value ? 'Change…' : 'Choose File…'}
        </button>
        {filename && (
          <span className="text-xs text-[rgba(255,255,255,0.5)] truncate max-w-[200px]">{filename}</span>
        )}
        {value && (
          <button onClick={() => onChange(null)} className="text-xs text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors">✕</button>
        )}
      </div>
    </div>
  )
}

// Schedule items editor
function ScheduleEditor({ items, onChange }:
  { items: ScheduleItem[]; onChange: (items: ScheduleItem[]) => void }) {
  const update = (i: number, key: keyof ScheduleItem, val: string) => {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it)
    onChange(next)
  }
  const add    = () => onChange([...items, makeItem()])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            className={`${inputCls} w-36 shrink-0`}
            value={it.time} onChange={e => update(i, 'time', e.target.value)}
            placeholder="9:00 AM"
          />
          <input
            className={`${inputCls} flex-1`}
            value={it.activity} onChange={e => update(i, 'activity', e.target.value)}
            placeholder="Activity description"
          />
          <button onClick={() => remove(i)}
            className="mt-2 text-[rgba(255,255,255,0.3)] hover:text-red-400 text-xs transition-colors">
            ✕
          </button>
        </div>
      ))}
      <button onClick={add}
        className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
        + Add row
      </button>
    </div>
  )
}

// ── Step 1: Event & Partners ────────────────────────────────────────────────────

function Step1({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  const updatePartner = (i: number, key: keyof GuidePartner, val: unknown) => {
    const next = s.partners.map((p, idx) => idx === i ? { ...p, [key]: val } : p)
    set('partners', next)
  }

  const pickLogo = async (i: number) => {
    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths.length > 0)
      updatePartner(i, 'logo_path', result.filePaths[0])
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <Inp label="Event Name" value={s.event_name} onChange={v => set('event_name', v)}
          placeholder="The Texas Grand Tour 2026" />
        <Inp label="Event Abbreviation (footer)" value={s.event_abbrev}
          onChange={v => set('event_abbrev', v)} placeholder="TGT 2026" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls}>Partners</label>
          <button onClick={() => set('partners', [...s.partners, makePartner()])}
            className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
            + Add Partner
          </button>
        </div>

        <div className="space-y-6">
          {s.partners.map((p, i) => (
            <div key={i} className="rounded-lg border border-[rgba(255,255,255,0.08)] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(255,255,255,0.4)] tracking-widest uppercase">Partner {i + 1}</span>
                {s.partners.length > 1 && (
                  <button onClick={() => set('partners', s.partners.filter((_, idx) => idx !== i))}
                    className="text-xs text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors">✕ Remove</button>
                )}
              </div>

              <Inp label="Partner Name" value={p.name}
                onChange={v => updatePartner(i, 'name', v)} placeholder="COTA" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Partner Logo</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => pickLogo(i)}
                      className="px-3 py-2 text-xs rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)] hover:border-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
                      {p.logo_path ? 'Change…' : 'Choose…'}
                    </button>
                    {p.logo_path && (
                      <>
                        <span className="text-xs text-[rgba(255,255,255,0.4)] truncate max-w-[120px]">
                          {p.logo_path.split(/[\\/]/).pop()}
                        </span>
                        <button onClick={() => updatePartner(i, 'logo_path', null)}
                          className="text-xs text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors">✕</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Intro Letter Body</label>
                <textarea
                  className={inputCls} rows={6} value={p.intro_body}
                  onChange={e => updatePartner(i, 'intro_body', e.target.value)}
                  placeholder={`To The ${p.name || 'Partner'} Team,\n\nWrite the personalised welcome letter here…\n\n— Your Family at The Exotics Network`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Cover & Branding ───────────────────────────────────────────────────

function Step2({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-[rgba(255,255,255,0.5)]">
        Set the event-wide cover photo and the TEN logo that appears on every slide's footer.
        These are shared across all partner guides. Partner-specific covers can be added later.
      </p>
      <FilePick label="Cover Background Photo" value={s.cover_photo_path}
        onChange={v => set('cover_photo_path', v)} />
      <FilePick label="TEN Logo (footer)" value={s.ten_logo_path}
        onChange={v => set('ten_logo_path', v)} />
      <div>
        <label className={labelCls}>Intro Slide Background (optional — defaults to cover photo)</label>
        <FilePick label="" value={s.day1_bg_path}
          onChange={v => set('day1_bg_path', v)} />
      </div>
    </div>
  )
}

// ── Step 3: Day 1 Schedule ─────────────────────────────────────────────────────

function Step3({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Inp label="Slide Title (use \\n for line break)" value={s.day1_title}
          onChange={v => set('day1_title', v)} placeholder="Day 1\nItinerary" />
        <FilePick label="Slide Background" value={s.day1_bg_path}
          onChange={v => set('day1_bg_path', v)} />
      </div>
      <Inp label="Opening Line" value={s.day1_opening}
        onChange={v => set('day1_opening', v)}
        placeholder="Please arrive at Lakeline Mall NO LATER than 9:00 AM." />
      <div>
        <label className={labelCls}>Schedule Items (Time | Activity)</label>
        <ScheduleEditor items={s.day1_items}
          onChange={items => set('day1_items', items)} />
      </div>
    </div>
  )
}

// ── Step 4: Venue / Reception ──────────────────────────────────────────────────

function Step4({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Inp label="Slide Title" value={s.venue_title}
          onChange={v => set('venue_title', v)} placeholder="Welcome\nReception :" />
        <FilePick label="Slide Background" value={s.venue_bg_path}
          onChange={v => set('venue_bg_path', v)} />
      </div>
      <Inp label="Location / Arrival Header" value={s.venue_location_name}
        onChange={v => set('venue_location_name', v)}
        placeholder="T11 COTA CAR CONDOS ARRIVAL:" />
      <Inp label="Main Arrival Instructions" value={s.venue_arrival_text}
        onChange={v => set('venue_arrival_text', v)} multiline rows={5}
        placeholder="The entrance is and will be the ONLY point of entry to the reception…" />
      <Inp label="Directions (optional)" value={s.venue_directions}
        onChange={v => set('venue_directions', v)} multiline rows={3}
        placeholder="If You Are Coming From:\nElroy Rd: Turn South onto Circuit of the Americas Blvd…" />
    </div>
  )
}

// ── Step 5: Day 2 Schedule ─────────────────────────────────────────────────────

function Step5({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Inp label="Slide Title" value={s.day2_title}
          onChange={v => set('day2_title', v)} placeholder="Day 2\nItinerary" />
        <FilePick label="Day 2 Itinerary Background" value={s.day2_bg_path}
          onChange={v => set('day2_bg_path', v)} />
      </div>
      <Inp label="Opening Line" value={s.day2_opening}
        onChange={v => set('day2_opening', v)}
        placeholder="Please arrive at Lakeline Mall NO LATER than 9:00 AM." />
      <div>
        <label className={labelCls}>Schedule Items (Time | Activity)</label>
        <ScheduleEditor items={s.day2_items}
          onChange={items => set('day2_items', items)} />
      </div>
      <FilePick label="Rally Slide Background" value={s.rally_bg_path}
        onChange={v => set('rally_bg_path', v)} />
    </div>
  )
}

// ── Step 6: Race Day & POI ─────────────────────────────────────────────────────

function Step6({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  return (
    <div className="space-y-8">
      {/* Points of Interest */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <label className={labelCls}>Points of Interest Slide</label>
          <button
            onClick={() => set('include_poi_slide', !s.include_poi_slide)}
            className={`relative w-10 h-5 rounded-full transition-colors ${s.include_poi_slide ? 'bg-[#cc1c1c]' : 'bg-[rgba(255,255,255,0.12)]'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${s.include_poi_slide ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-xs text-[rgba(255,255,255,0.4)]">{s.include_poi_slide ? 'Included' : 'Skipped'}</span>
        </div>
        {s.include_poi_slide && (
          <div className="space-y-4 pl-4 border-l border-[rgba(255,255,255,0.08)]">
            <div className="grid grid-cols-2 gap-4">
              <Inp label="Slide Title" value={s.poi_title}
                onChange={v => set('poi_title', v)} placeholder="Day 2\nCOTA POINTS OF\nINTEREST" />
              <FilePick label="Slide Background" value={s.poi_bg_path}
                onChange={v => set('poi_bg_path', v)} />
            </div>
            <Inp label="Access Times / Notes" value={s.poi_access_times}
              onChange={v => set('poi_access_times', v)} multiline rows={3}
              placeholder="PIT LANE WALK: 11:45 AM – 12:15 PM&#10;&#10;TEN LOUNGE ACCESS: 11:30 AM – 3:30 PM" />
          </div>
        )}
      </div>

      {/* Race Day */}
      <div>
        <label className={labelCls}>Race Day Slide</label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Inp label="Slide Title" value={s.race_title}
            onChange={v => set('race_title', v)} placeholder="Day 2\nRace Day" />
          <FilePick label="Slide Background" value={s.race_bg_path}
            onChange={v => set('race_bg_path', v)} />
        </div>
        <Inp label="Schedule Header" value={s.race_schedule_title}
          onChange={v => set('race_schedule_title', v)}
          placeholder="GT WORLD CHALLENGE AMERICA SCHEDULE:" />
        <div className="mt-4">
          <label className={labelCls}>Race Schedule Items</label>
          <ScheduleEditor items={s.race_items}
            onChange={items => set('race_items', items)} />
        </div>
      </div>
    </div>
  )
}

// ── Step 7: Hotel & Rules ──────────────────────────────────────────────────────

function Step7({ s, set }: { s: WizardState; set: (k: keyof WizardState, v: unknown) => void }) {
  const updateContact = (i: number, key: keyof EmergencyContact, val: string) => {
    const next = s.emergency_contacts.map((c, idx) => idx === i ? { ...c, [key]: val } : c)
    set('emergency_contacts', next)
  }

  return (
    <div className="space-y-8">
      {/* Hotel */}
      <div>
        <label className={labelCls}>Hotel Slide</label>
        <div className="grid grid-cols-2 gap-4">
          <Inp label="Hotel Title" value={s.hotel_title}
            onChange={v => set('hotel_title', v)} placeholder="Fairmont\nAustin :" />
          <FilePick label="Slide Background" value={s.hotel_bg_path}
            onChange={v => set('hotel_bg_path', v)} />
        </div>
      </div>

      {/* Rules */}
      <div>
        <label className={labelCls}>Rules & Safety</label>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FilePick label="Slide Background" value={s.rules_bg_path}
            onChange={v => set('rules_bg_path', v)} />
          <FilePick label="Closing Slide Background" value={s.closing_bg_path}
            onChange={v => set('closing_bg_path', v)} />
        </div>
        <div className="space-y-4">
          <Inp label="General Protocols" value={s.rules_general}
            onChange={v => set('rules_general', v)} multiline rows={4}
            placeholder="Always obey all traffic laws…" />
          <Inp label="Convoy Etiquette" value={s.rules_convoy}
            onChange={v => set('rules_convoy', v)} multiline rows={3}
            placeholder="Maintain a safe following distance…" />
          <Inp label="Vehicle Preparedness" value={s.rules_vehicle}
            onChange={v => set('rules_vehicle', v)} multiline rows={3}
            placeholder="Ensure your vehicle is in proper working condition…" />
          <Inp label="Emergency Procedures" value={s.rules_emergency}
            onChange={v => set('rules_emergency', v)} multiline rows={2}
            placeholder="In case of an emergency, immediately contact…" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Emergency Contacts</label>
              <button onClick={() => set('emergency_contacts', [...s.emergency_contacts, makeContact()])}
                className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
                + Add
              </button>
            </div>
            {s.emergency_contacts.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className={`${inputCls} flex-1`} value={c.name}
                  onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Name" />
                <input className={`${inputCls} w-48`} value={c.phone}
                  onChange={e => updateContact(i, 'phone', e.target.value)} placeholder="+1 (555) 000-0000" />
                <button onClick={() => set('emergency_contacts', s.emergency_contacts.filter((_, idx) => idx !== i))}
                  className="text-xs text-[rgba(255,255,255,0.3)] hover:text-red-400 transition-colors">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 8: Generate ──────────────────────────────────────────────────────────

function Step8({ partners, progress }: {
  partners:  string[]
  progress:  Record<string, { pct: number; step: string }>
}) {
  return (
    <div className="space-y-4">
      {partners.map(p => {
        const info = progress[p] ?? { pct: 0, step: 'Queued…' }
        return (
          <div key={p} className="rounded-lg border border-[rgba(255,255,255,0.08)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white font-medium">{p}</span>
              <span className="text-xs text-[rgba(255,255,255,0.4)]">{info.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
              <motion.div
                className="h-full bg-[#cc1c1c] rounded-full"
                style={{ width: `${info.pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-1 truncate">{info.step}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Wizard ─────────────────────────────────────────────────────────────────

export default function GuideWizard() {
  const [step,  setStep]  = useState(0)
  const [state, setState] = useState<WizardState>(INITIAL)
  const set = useCallback((k: keyof WizardState, v: unknown) =>
    setState(prev => ({ ...prev, [k]: v })), [])

  const [generating, setGenerating]         = useState(false)
  const [generated,  setGenerated]          = useState(false)
  const [outputPath, setOutputPath]         = useState<string | null>(null)
  const [overallPct, setOverallPct]         = useState(0)
  const [partnerProg, setPartnerProg]       = useState<Record<string, { pct: number; step: string }>>({})
  const [error, setError]                   = useState<string | null>(null)

  const startGenerate = async () => {
    const partnerNames = state.partners.map(p => p.name).filter(Boolean)
    if (partnerNames.length === 0) {
      setError('Please add at least one partner.')
      return
    }

    // Ask where to save
    const save = await window.electronAPI.saveFile({
      defaultPath: `${state.event_name || 'Guide'} – Partner Guides.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (save.canceled || !save.filePath) return

    setError(null)
    setGenerating(true)
    setGenerated(false)
    setOverallPct(0)

    const init: Record<string, { pct: number; step: string }> = {}
    partnerNames.forEach(p => { init[p] = { pct: 0, step: 'Queued…' } })
    setPartnerProg(init)

    // Wire up progress listener
    window.electronAPI.onGuideProgress((msg: ProgressMessage) => {
      if (msg.overall !== undefined) setOverallPct(msg.overall)
      if (msg.partner && msg.pct !== undefined) {
        setPartnerProg(prev => ({
          ...prev,
          [msg.partner!]: { pct: msg.pct!, step: msg.step ?? '' },
        }))
      }
      if (msg.done)  { setGenerated(true);  setGenerating(false); setOutputPath(msg.outputPath ?? null) }
      if (msg.error) { setError(msg.error); setGenerating(false) }
    })

    // Build manifest
    const manifest: GuideManifestPayload = {
      event_name:          state.event_name,
      event_abbrev:        state.event_abbrev,
      partners:            state.partners.map(p => ({
        name:       p.name,
        logo_path:  p.logo_path,
        intro_body: p.intro_body,
      })),
      cover_photo_path:    state.cover_photo_path,
      day1_title:          state.day1_title,
      day1_opening:        state.day1_opening,
      day1_items:          state.day1_items.filter(i => i.time || i.activity),
      day1_bg_path:        state.day1_bg_path,
      venue_title:         state.venue_title,
      venue_location_name: state.venue_location_name,
      venue_arrival_text:  state.venue_arrival_text,
      venue_directions:    state.venue_directions,
      venue_bg_path:       state.venue_bg_path,
      day2_title:          state.day2_title,
      day2_opening:        state.day2_opening,
      day2_items:          state.day2_items.filter(i => i.time || i.activity),
      day2_bg_path:        state.day2_bg_path,
      rally_bg_path:       state.rally_bg_path,
      include_poi_slide:   state.include_poi_slide,
      poi_title:           state.poi_title,
      poi_access_times:    state.poi_access_times,
      poi_bg_path:         state.poi_bg_path,
      race_title:          state.race_title,
      race_schedule_title: state.race_schedule_title,
      race_items:          state.race_items.filter(i => i.time || i.activity),
      race_bg_path:        state.race_bg_path,
      hotel_title:         state.hotel_title,
      hotel_bg_path:       state.hotel_bg_path,
      rules_general:       state.rules_general,
      rules_convoy:        state.rules_convoy,
      rules_vehicle:       state.rules_vehicle,
      rules_emergency:     state.rules_emergency,
      emergency_contacts:  state.emergency_contacts.filter(c => c.name || c.phone),
      rules_bg_path:       state.rules_bg_path,
      closing_bg_path:     state.closing_bg_path,
    }

    try {
      await window.electronAPI.startGuideGenerate({
        manifest,
        tenLogoPath: state.ten_logo_path,
        outputPath:  save.filePath,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGenerating(false)
    } finally {
      window.electronAPI.removeAllListeners('generate:guide:progress')
    }
  }

  // Step panels
  const stepComponents = [
    <Step1 key={0} s={state} set={set} />,
    <Step2 key={1} s={state} set={set} />,
    <Step3 key={2} s={state} set={set} />,
    <Step4 key={3} s={state} set={set} />,
    <Step5 key={4} s={state} set={set} />,
    <Step6 key={5} s={state} set={set} />,
    <Step7 key={6} s={state} set={set} />,
    <Step8 key={7}
      partners={state.partners.map(p => p.name).filter(Boolean)}
      progress={partnerProg}
    />,
  ]

  const isLastStep  = step === STEPS.length - 1
  const isFirstStep = step === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen px-6 md:px-14 py-10 max-w-[1100px] mx-auto"
    >
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] tracking-[0.25em] uppercase text-[rgba(255,255,255,0.35)] mb-1">02 — GUIDES</p>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Partner Guide Generator</h1>
        <p className="text-sm text-[rgba(255,255,255,0.4)] mt-1">
          Build branded partner handbooks from scratch — no template upload required.
        </p>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-8">
        {/* Step nav */}
        <div className="space-y-1">
          {STEPS.map((label, i) => (
            <button key={i}
              onClick={() => !generating && setStep(i)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-all ${
                i === step
                  ? 'bg-[rgba(255,255,255,0.09)] text-white'
                  : 'text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)]'
              }`}
            >
              <span className="text-[rgba(255,255,255,0.25)] mr-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-6">
          <div className="mb-6">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(255,255,255,0.35)]">
              Step {step + 1} — {STEPS[step]}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {stepComponents[step]}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Success */}
          {generated && outputPath && (
            <div className="mt-6 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              ✓ Guides saved to {outputPath.split(/[\\/]/).pop()}
            </div>
          )}

          {/* Overall progress bar (while generating) */}
          {generating && (
            <div className="mt-6">
              <div className="flex justify-between text-xs text-[rgba(255,255,255,0.4)] mb-1">
                <span>Generating…</span>
                <span>{overallPct}%</span>
              </div>
              <div className="h-1 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                <motion.div className="h-full bg-[#cc1c1c] rounded-full"
                  style={{ width: `${overallPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={isFirstStep || generating}
              className="px-4 py-2 rounded-md text-sm text-[rgba(255,255,255,0.5)] hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Back
            </button>

            {isLastStep ? (
              <button
                onClick={startGenerate}
                disabled={generating}
                className="px-6 py-2.5 rounded-md text-sm font-medium bg-[#cc1c1c] hover:bg-[#b51818] text-white disabled:opacity-50 transition-colors"
              >
                {generating ? `Generating… ${overallPct}%` : generated ? 'Regenerate' : 'Generate Guides'}
              </button>
            ) : (
              <button
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                className="px-5 py-2 rounded-md text-sm font-medium bg-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.14)] text-white transition-colors"
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
