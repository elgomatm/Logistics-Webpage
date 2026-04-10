"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Page, User } from '../App'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (!b) return '0 B'
  const gb = b / 1_073_741_824
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = b / 1_048_576
  if (mb >= 1) return `${mb.toFixed(0)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d    = new Date(iso)
  const now  = new Date(); now.setHours(0,0,0,0)
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0)   return `${Math.abs(diff)}d overdue`
  if (diff < 7)   return `${diff}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

function priorityScore(t: PlannerTask): number {
  if (t.percentComplete === 100) return 9999
  if (!t.dueDate) return 500
  return (new Date(t.dueDate).getTime() - Date.now()) / 86_400_000
}

type FilterPerson = 'all' | 'malik' | 'andre' | 'adonis'

// ── Quick card ────────────────────────────────────────────────────────────────

function QuickCard({ icon, title, subtitle, accent = 'rgba(204,28,28,0.7)', onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; accent?: string; onClick: () => void
}) {
  return (
    <motion.button onClick={onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(204,28,28,0.3)'; e.currentTarget.style.background = 'rgba(204,28,28,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      <div style={{ color: accent, marginBottom: '10px' }}>{icon}</div>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginBottom: '3px' }}>{title}</p>
      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>
    </motion.button>
  )
}

// ── Checklist item row ────────────────────────────────────────────────────────

function ChecklistRow({ item, taskId, onToggle }: { item: ChecklistItem; taskId: string; onToggle: (taskId: string, itemId: string, checked: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0 5px 24px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <button onClick={() => onToggle(taskId, item.id, !item.isChecked)}
        style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, cursor: 'pointer', border: item.isChecked ? '1.5px solid rgba(204,28,28,0.5)' : '1.5px solid rgba(255,255,255,0.15)', background: item.isChecked ? 'rgba(204,28,28,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.isChecked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="rgba(204,28,28,0.9)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>
      <span style={{ fontSize: '11px', color: item.isChecked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)', textDecoration: item.isChecked ? 'line-through' : 'none' }}>{item.title}</span>
    </div>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onToggleChecklist, compact = false }: {
  task: PlannerTask; onToggle: (t: PlannerTask) => void
  onToggleChecklist: (taskId: string, itemId: string, checked: boolean) => void; compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const done    = task.percentComplete === 100
  const overdue = !done && isOverdue(task.dueDate)
  const hasSubs = task.checklist.length > 0
  const subsDone = task.checklist.filter(c => c.isChecked).length

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: done ? 0.45 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: compact ? '8px 0' : '10px 12px' }}>
        {/* Checkbox */}
        <button onClick={() => onToggle(task)}
          style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, marginTop: '1px', cursor: 'pointer', border: done ? '1.5px solid rgba(204,28,28,0.5)' : '1.5px solid rgba(255,255,255,0.2)', background: done ? 'rgba(204,28,28,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="rgba(204,28,28,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {task.percentComplete === 50 && !done && <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,180,0,0.7)' }}/>}
        </button>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '12px', color: done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', textDecoration: done ? 'line-through' : 'none', marginBottom: '3px', lineHeight: 1.4 }}>{task.title}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {task.assignees.length > 0 && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>{task.assignees.join(', ')}</span>}
            {task.dueDate && <span style={{ fontSize: '10px', color: overdue ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.32)', fontWeight: overdue ? 600 : 400 }}>· {fmtDate(task.dueDate)}</span>}
            {hasSubs && <span style={{ fontSize: '10px', color: subsDone === task.checklist.length ? 'rgba(50,205,50,0.7)' : 'rgba(255,255,255,0.28)' }}>· {subsDone}/{task.checklist.length} subtasks</span>}
          </div>
        </div>

        {/* Expand subtasks toggle */}
        {hasSubs && (
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '2px 4px', fontSize: '11px', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ›
          </button>
        )}
      </div>

      {/* Subtasks */}
      <AnimatePresence>
        {expanded && hasSubs && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
            {task.checklist.map(item => (
              <ChecklistRow key={item.id} item={item} taskId={task.id} onToggle={onToggleChecklist} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Event tile ────────────────────────────────────────────────────────────────

function EventCard({ category, tasks, onClick }: {
  category: PlannerCategory; tasks: PlannerTask[]; isSelected?: boolean; onClick: () => void
}) {
  const total   = tasks.length
  const done    = tasks.filter(t => t.percentComplete === 100).length
  const open    = tasks.filter(t => t.percentComplete < 100).length
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter(t => t.percentComplete < 100 && isOverdue(t.dueDate)).length
  const color   = pct === 100 ? 'rgba(50,205,50,0.85)' : overdue > 0 ? 'rgba(255,90,90,0.9)' : 'rgba(204,28,28,0.8)'

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      style={{
        width: '100%', textAlign: 'left', padding: '20px', borderRadius: '14px',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(204,28,28,0.35)'; e.currentTarget.style.background = 'rgba(204,28,28,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      {/* Top row: name + overdue badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>{category.name}</span>
        {overdue > 0 && (
          <span style={{ fontSize: '10px', color: 'rgba(255,80,80,0.95)', fontWeight: 700, background: 'rgba(255,60,60,0.12)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: '20px', padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {overdue} overdue
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: '4px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', marginBottom: '10px' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', borderRadius: '3px', background: color }}
        />
      </div>

      {/* Bottom row: stats + pct */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>{done}/{total} done · {open} open</span>
        <span style={{ fontSize: '18px', fontFamily: '"Bebas Neue", sans-serif', color, letterSpacing: '0.06em', lineHeight: 1 }}>{pct}%</span>
      </div>

      {/* Arrow hint */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: 'rgba(204,28,28,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>View Tasks</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="rgba(204,28,28,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </motion.button>
  )
}

// ── Add task modal ────────────────────────────────────────────────────────────

function AddTaskModal({ plans, buckets, categories, defaultCategoryKey, onClose, onAdd }: {
  plans: PlannerPlan[]; buckets: PlannerBucket[]; categories: PlannerCategory[]
  defaultCategoryKey?: string; onClose: () => void
  onAdd: (planId: string, bucketId: string, title: string, categoryKeys: string[]) => void
}) {
  const [title,      setTitle]      = useState('')
  const [planId,     setPlanId]     = useState(plans[0]?.id || '')
  const [bucketId,   setBucketId]   = useState('')
  const [categoryKey, setCategoryKey] = useState(defaultCategoryKey || categories[0]?.key || '')

  const filteredBuckets = buckets.filter(b => b.planId === planId)
  useEffect(() => { setBucketId(filteredBuckets[0]?.id || '') }, [planId])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '440px', maxWidth: '95vw' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>Add Task</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Task Title', el: <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onAdd(planId, bucketId, title.trim(), categoryKey ? [categoryKey] : []); onClose() } }} placeholder="What needs to be done?" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} /> },
            { label: 'Event', el: <select value={categoryKey} onChange={e => setCategoryKey(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: '12px', outline: 'none' }}>
              <option value="">— No event —</option>
              {categories.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select> },
            { label: 'Plan', el: <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: '12px', outline: 'none' }}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select> },
            { label: 'Bucket', el: <select value={bucketId} onChange={e => setBucketId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', fontSize: '12px', outline: 'none' }}>
              {filteredBuckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select> },
          ].map(({ label, el }) => (
            <div key={label}>
              <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>{label}</label>
              {el}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          <button disabled={!title.trim() || !planId} onClick={() => { if (title.trim()) { onAdd(planId, bucketId, title.trim(), categoryKey ? [categoryKey] : []); onClose() } }}
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '12px', background: title.trim() ? '#cc1c1c' : 'rgba(204,28,28,0.3)', border: 'none', color: title.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: title.trim() ? 'pointer' : 'default' }}>
            Add Task
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Full Team Planner modal ───────────────────────────────────────────────────

function FullPlannerModal({ onClose }: { onClose: () => void }) {
  const [data,        setData]        = useState<FullPlannerSyncResult | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string>('all')

  useEffect(() => {
    // Try cache first, then live sync
    window.electronAPI.plannerGetCacheFull().then(cached => {
      if (cached.syncedAt) { setData(cached); setLoading(false) }
    }).catch(() => {})

    setSyncing(true)
    window.electronAPI.plannerSyncFull().then(d => {
      setData(d); setLoading(false); setSyncing(false)
    }).catch(() => { setLoading(false); setSyncing(false) })
  }, [])

  // Tasks grouped by category key, optionally filtered by member
  const filteredTasks = useMemo(() => {
    const all = data?.tasks || []
    if (memberFilter === 'all') return all
    return all.filter(t => t.assignees.some(a => a.toLowerCase().includes(memberFilter.toLowerCase())))
  }, [data, memberFilter])

  const tasksByCategory = useMemo(() => {
    const map: Record<string, PlannerTask[]> = {}
    for (const t of filteredTasks) {
      if (t.appliedCategories.length === 0) {
        if (!map['__none__']) map['__none__'] = []
        map['__none__'].push(t)
      } else {
        for (const cat of t.appliedCategories) {
          if (!map[cat]) map[cat] = []
          map[cat].push(t)
        }
      }
    }
    return map
  }, [filteredTasks])

  const activeCategories = useMemo(() => {
    const namedMap: Record<string, string> = {}
    for (const c of (data?.categories || [])) namedMap[c.key] = c.name
    const usedKeys = Object.keys(tasksByCategory).filter(k => k !== '__none__')
    const cats: PlannerCategory[] = usedKeys
      .filter(k => (tasksByCategory[k] || []).length > 0)
      .map(k => ({ key: k, name: namedMap[k] || `Label ${k.replace('category', '')}` }))
      .sort((a, b) => a.key.localeCompare(b.key))
    if ((tasksByCategory['__none__'] || []).length > 0) cats.push({ key: '__none__', name: 'Uncategorized' })
    return cats
  }, [data, tasksByCategory])

  const selectedCatTasks = useMemo(() => {
    if (!selectedCat) return []
    return (tasksByCategory[selectedCat] || []).sort((a, b) => priorityScore(a) - priorityScore(b))
  }, [selectedCat, tasksByCategory])

  const selectedCatObj = activeCategories.find(c => c.key === selectedCat)
  const members = data?.members || []

  // Toggle task completion (reuses same IPC as logistics planner)
  const handleToggleTask = useCallback(async (task: PlannerTask) => {
    const newPct = task.percentComplete === 100 ? 0 : 100
    setData(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, percentComplete: newPct } : t) } : prev)
    await window.electronAPI.plannerUpdateTask({ taskId: task.id, percentComplete: newPct })
  }, [])

  const handleToggleChecklist = useCallback(async (taskId: string, itemId: string, checked: boolean) => {
    setData(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, isChecked: checked } : c) } : t)
    } : prev)
    await window.electronAPI.plannerUpdateChecklist({ taskId, checklistItemId: itemId, isChecked: checked })
  }, [])

  const overallPct = useMemo(() => {
    const all = data?.tasks || []
    if (!all.length) return 0
    return Math.round(all.filter(t => t.percentComplete === 100).length / all.length * 100)
  }, [data])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '28px 28px 0', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '26px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>Full Team Planner</h2>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '0.04em' }}>
              All plans · All team members {data?.syncedAt ? `· Synced ${fmtTime(data.syncedAt)}` : ''}
            </p>
          </div>
          {syncing && <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(204,28,28,0.7)', animation: 'pulse 1.4s ease-in-out infinite' }}/>SYNCING</div>}
          {/* Overall completion */}
          {(data?.tasks?.length || 0) > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '28px', letterSpacing: '0.06em', color: overallPct === 100 ? 'rgba(50,205,50,0.9)' : 'rgba(255,90,90,1)', lineHeight: 1 }}>{overallPct}%</span>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{data!.tasks.filter(t => t.percentComplete === 100).length} / {data!.tasks.length} tasks</p>
            </div>
          )}
        </div>

        {/* Person filter chips */}
        {members.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', flexShrink: 0 }}>
            {(['all', ...members] as string[]).map(m => (
              <button key={m}
                onClick={() => setMemberFilter(m)}
                style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '11px', letterSpacing: '0.05em', border: memberFilter === m ? '1px solid rgba(180,180,255,0.6)' : '1px solid rgba(255,255,255,0.1)', background: memberFilter === m ? 'rgba(180,180,255,0.1)' : 'transparent', color: memberFilter === m ? 'rgba(200,200,255,1)' : 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                {m === 'all' ? 'All Members' : m.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden', paddingBottom: '28px' }}>
          <AnimatePresence mode="wait">
            {!selectedCat ? (

              /* Event tiles grid */
              <motion.div key="fp-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
                {loading ? (
                  <p style={{ textAlign: 'center', padding: '60px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>Loading all plans…</p>
                ) : activeCategories.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '60px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>No events found</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {activeCategories.map(cat => (
                      <EventCard key={cat.key} category={cat} tasks={tasksByCategory[cat.key] || []} onClick={() => setSelectedCat(cat.key)} />
                    ))}
                  </div>
                )}
              </motion.div>

            ) : (

              /* Task detail */
              <motion.div key={`fp-tasks-${selectedCat}`} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.2 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Sub-header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
                  <button onClick={() => setSelectedCat(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    All Events
                  </button>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>/</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', flex: 1 }}>{selectedCatObj?.name}</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{selectedCatTasks.length} tasks</span>
                </div>
                {/* Scrollable task list */}
                <div style={{ flex: 1, overflowY: 'auto', borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {selectedCatTasks.length === 0 ? (
                    <p style={{ padding: '36px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>No tasks match this filter</p>
                  ) : (
                    <div style={{ padding: '4px 8px 8px' }}>
                      {selectedCatTasks.map(task => (
                        <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onToggleChecklist={handleToggleChecklist} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ── OneDrive modal ────────────────────────────────────────────────────────────

function OneDriveModal({ summary, onClose }: { summary: OneDriveSyncResult | null; onClose: () => void }) {
  const [details, setDetails] = useState<OneDriveDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.onedriveGetDetails().then(d => { setDetails(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const used = details?.used || summary?.used || 0
  const total = details?.total || summary?.total || 0
  const pct = total > 0 ? Math.round((used / total) * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', width: '680px', maxWidth: '95vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>OneDrive Analytics</p>
            {details?.syncedAt && <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Synced {fmtTime(details.syncedAt)}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Loading analytics…</div>
          ) : (
            <>
              {/* Storage gauge */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '28px', fontFamily: '"Bebas Neue", sans-serif', color: 'rgba(100,180,255,0.95)', letterSpacing: '0.06em', lineHeight: 1 }}>{fmtBytes(used)}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>of {fmtBytes(total)} used · {fmtBytes(details?.remaining || 0)} free</p>
                  </div>
                  <span style={{ fontSize: '22px', fontFamily: '"Bebas Neue", sans-serif', color: pct > 80 ? 'rgba(255,90,90,0.9)' : 'rgba(100,180,255,0.7)', letterSpacing: '0.06em' }}>{pct}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
                    style={{ height: '100%', borderRadius: '3px', background: pct > 80 ? 'rgba(255,90,90,0.7)' : 'rgba(100,180,255,0.65)' }} />
                </div>
                {(details?.deleted || 0) > 0 && (
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>{fmtBytes(details!.deleted)} in recycle bin</p>
                )}
              </div>

              {/* Two-column: folders + file types */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Folders */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Folders by Size</p>
                  {(details?.folders || []).slice(0, 8).map((f, i) => {
                    const fpct = total > 0 ? (f.size / total) * 100 : 0
                    return (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{fmtBytes(f.size)}</span>
                        </div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                          <div style={{ height: '100%', borderRadius: '1px', background: 'rgba(100,180,255,0.5)', width: `${Math.min(fpct * 5, 100)}%` }} />
                        </div>
                        {(f.childCount || 0) > 0 && <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{f.childCount} items</p>}
                      </div>
                    )
                  })}
                </div>

                {/* File types */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>By File Type</p>
                  {(details?.fileTypes || []).length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>No root-level files detected</p>
                  ) : (details?.fileTypes || []).map((ft, i) => {
                    const ftpct = used > 0 ? (ft.size / used) * 100 : 0
                    const colors = ['rgba(100,180,255,0.6)', 'rgba(204,28,28,0.6)', 'rgba(50,205,50,0.6)', 'rgba(255,180,0,0.6)', 'rgba(200,100,255,0.6)', 'rgba(255,120,50,0.6)']
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: colors[i % colors.length], flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', flex: 1 }}>{ft.name}</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{fmtBytes(ft.size)}</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', minWidth: '30px', textAlign: 'right' }}>{ftpct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent files */}
              {(details?.recentFiles || []).length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Recently Modified</p>
                  {(details?.recentFiles || []).map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>{f.name}</p>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>{f.folder} · {fmtBytes(f.size)}</p>
                      </div>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginLeft: '12px' }}>{fmtDateTime(f.lastModified)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Main HomePage ─────────────────────────────────────────────────────────────

export default function HomePage({ user, onNavigate }: { user: User | null; onNavigate: (page: Page) => void }) {
  const [planner,     setPlanner]     = useState<PlannerSyncResult | null>(null)
  const [onedrive,    setOnedrive]    = useState<OneDriveSyncResult | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [filter,      setFilter]      = useState<FilterPerson>('all')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showOD,      setShowOD]      = useState(false)
  const [showFull,    setShowFull]    = useState(false)

  // Bootstrap
  useEffect(() => {
    Promise.all([window.electronAPI.plannerGetCache(), window.electronAPI.onedriveGetCache()])
      .then(([p, o]) => { if (p.syncedAt) setPlanner(p); if (o.syncedAt) setOnedrive(o); setLoading(false) })
      .catch(() => setLoading(false))

    setSyncing(true)
    Promise.all([window.electronAPI.plannerSync(), window.electronAPI.onedriveSync()])
      .then(([p, o]) => { setPlanner(p); setOnedrive(o); setSyncing(false) })
      .catch(() => setSyncing(false))

    window.electronAPI.onSyncUpdated(data => {
      if (data.planner)  setPlanner(data.planner)
      if (data.onedrive) setOnedrive(data.onedrive)
    })
    return () => window.electronAPI.removeAllListeners('sync:updated')
  }, [])

  // Filtered tasks by person
  const filteredTasks = useMemo(() => {
    const tasks = planner?.tasks || []
    if (filter === 'all') return tasks
    return tasks.filter(t => t.assignees.some(a => a.toLowerCase().includes(filter)))
  }, [planner, filter])

  // Tasks grouped by category key
  const tasksByCategory = useMemo(() => {
    const map: Record<string, PlannerTask[]> = {}
    for (const t of filteredTasks) {
      if (t.appliedCategories.length === 0) {
        if (!map['__none__']) map['__none__'] = []
        map['__none__'].push(t)
      } else {
        for (const cat of t.appliedCategories) {
          if (!map[cat]) map[cat] = []
          map[cat].push(t)
        }
      }
    }
    return map
  }, [filteredTasks])

  // Active categories — built from named plan categories + any category keys used in tasks
  // (fallback ensures labels show even if categoryDescriptions didn't come back from API)
  const activeCategories = useMemo(() => {
    // Build a name map from whatever the plan returned
    const namedMap: Record<string, string> = {}
    for (const c of (planner?.categories || [])) namedMap[c.key] = c.name

    // Collect every category key actually referenced by tasks
    const usedKeys = Object.keys(tasksByCategory).filter(k => k !== '__none__')

    const active: PlannerCategory[] = usedKeys
      .filter(k => (tasksByCategory[k] || []).length > 0)
      .map(k => ({
        key:  k,
        // Use named label if available; fall back to "Label 1", "Label 2", etc.
        name: namedMap[k] || `Label ${k.replace('category', '')}`,
      }))
      // Sort by category key so the order is stable
      .sort((a, b) => a.key.localeCompare(b.key))

    // Add uncategorized bucket if any tasks have no labels at all
    if ((tasksByCategory['__none__'] || []).length > 0) {
      active.push({ key: '__none__', name: 'Uncategorized' })
    }
    return active
  }, [planner, tasksByCategory])

  // Priority tasks for logged-in user
  const priorityTasks = useMemo(() => {
    const name = user?.name?.toLowerCase() || ''
    const me   = ['malik','andre','adonis'].find(n => name.includes(n)) || null
    const base = (planner?.tasks || []).filter(t => t.percentComplete < 100)
    const mine = me ? base.filter(t => t.assignees.some(a => a.toLowerCase().includes(me))) : base
    return [...mine].sort((a, b) => priorityScore(a) - priorityScore(b)).slice(0, 8)
  }, [planner, user])

  const selectedCatTasks = useMemo(() => {
    if (!selectedCat) return []
    return (tasksByCategory[selectedCat] || []).sort((a, b) => priorityScore(a) - priorityScore(b))
  }, [selectedCat, tasksByCategory])

  const selectedCatObj = activeCategories.find(c => c.key === selectedCat)

  const overallPct = useMemo(() => {
    const all = planner?.tasks || []
    if (!all.length) return 0
    return Math.round(all.filter(t => t.percentComplete === 100).length / all.length * 100)
  }, [planner])

  // Toggle task
  const handleToggleTask = useCallback(async (task: PlannerTask) => {
    const newPct = task.percentComplete === 100 ? 0 : 100
    setPlanner(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, percentComplete: newPct } : t) } : prev)
    await window.electronAPI.plannerUpdateTask({ taskId: task.id, percentComplete: newPct })
  }, [])

  // Toggle checklist item
  const handleToggleChecklist = useCallback(async (taskId: string, itemId: string, checked: boolean) => {
    setPlanner(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? {
        ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, isChecked: checked } : c)
      } : t)
    } : prev)
    await window.electronAPI.plannerUpdateChecklist({ taskId, checklistItemId: itemId, isChecked: checked })
  }, [])

  // Add task
  const handleAddTask = useCallback(async (planId: string, bucketId: string, title: string, categoryKeys: string[]) => {
    await window.electronAPI.plannerAddTask({ planId, bucketId, title, categoryKeys })
    window.electronAPI.plannerSync().then(setPlanner).catch(() => {})
  }, [])

  const odPct = onedrive && onedrive.total > 0 ? Math.round((onedrive.used / onedrive.total) * 100) : 0

  const doRefresh = () => {
    setSyncing(true)
    Promise.all([window.electronAPI.plannerSync(), window.electronAPI.onedriveSync()])
      .then(([p, o]) => { setPlanner(p); setOnedrive(o); setSyncing(false) })
      .catch(() => setSyncing(false))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>

      {/* Ambient glow */}
      <div aria-hidden style={{ position: 'absolute', top: '-64px', left: '50%', transform: 'translateX(-50%)', width: '160%', height: '520px', pointerEvents: 'none', zIndex: 0, background: ['radial-gradient(ellipse 28% 38% at 50% 0%, rgba(220,28,28,0.88) 0%, rgba(204,28,28,0.44) 24%, transparent 52%)', 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(204,28,28,0.38) 0%, rgba(180,20,20,0.14) 42%, transparent 66%)', 'radial-gradient(ellipse 90% 75% at 50% 0%, rgba(170,14,14,0.16) 0%, transparent 68%)'].join(', ') }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1360px', margin: '0 auto', padding: '88px 24px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '36px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>Dashboard</h1>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', marginTop: '4px' }}>
              {user?.name?.split(' ')[0] ? `Welcome back, ${user.name.split(' ')[0]}` : 'The Exotics Network'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {syncing && <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(204,28,28,0.7)', animation: 'pulse 1.4s ease-in-out infinite' }}/>SYNCING</div>}
            {!syncing && planner?.syncedAt && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>Synced {fmtTime(planner.syncedAt)}</span>}
            <button onClick={doRefresh} disabled={syncing} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: syncing ? 'default' : 'pointer' }}>Refresh</button>
          </div>
        </div>

        {/* Quick cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          <QuickCard icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h16M8 5V3M14 5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 13h4M7 16h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>} title="Teams Planner" subtitle="View active tasks" onClick={() => document.getElementById('planner-section')?.scrollIntoView({ behavior: 'smooth' })} />
          <QuickCard icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 6h14M4 11h10M4 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>} title="Full Team Plan" subtitle="Open Teams Planner" accent="rgba(180,180,255,0.7)" onClick={() => setShowFull(true)} />
          <QuickCard icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>} title="Document Studio" subtitle="Reports, Guides & Emails" accent="rgba(255,200,100,0.8)" onClick={() => onNavigate('logistics')} />
          <QuickCard icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="11" rx="8" ry="5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 11c0 2.76 3.58 5 8 5s8-2.24 8-5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 6v10M7 7.5v7M15 7.5v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>} title="OneDrive" subtitle="Storage & file analytics" accent="rgba(100,180,255,0.8)" onClick={() => setShowOD(true)} />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

          {/* LEFT: Planner */}
          <div id="planner-section">

            {/* Filter bar + add */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all','malik','andre','adonis'] as FilterPerson[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: filter === f ? 600 : 400, border: filter === f ? '1px solid rgba(220,30,30,0.7)' : '1px solid rgba(255,255,255,0.1)', background: filter === f ? 'rgba(204,28,28,0.12)' : 'transparent', color: filter === f ? 'rgba(255,90,90,1)' : 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em' }}>{filteredTasks.filter(t => t.percentComplete < 100).length} open</span>
                <button onClick={() => setShowAdd(true)}
                  style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, background: '#cc1c1c', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Add Task
                </button>
              </div>
            </div>

            {/* Overall completion */}
            {(planner?.tasks?.length || 0) > 0 && (
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Overall Completion</span>
                  <span style={{ fontSize: '18px', fontFamily: '"Bebas Neue", sans-serif', color: overallPct === 100 ? 'rgba(50,205,50,0.9)' : 'rgba(255,90,90,1)', letterSpacing: '0.06em' }}>{overallPct}%</span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
                    style={{ height: '100%', borderRadius: '2px', background: overallPct === 100 ? 'rgba(50,205,50,0.7)' : '#cc1c1c' }} />
                </div>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginTop: '5px' }}>{planner?.tasks.filter(t => t.percentComplete === 100).length} of {planner?.tasks.length} tasks · across {activeCategories.length} events</p>
              </div>
            )}

            {/* Events grid ↔ task drill-down */}
            <AnimatePresence mode="wait">
              {!selectedCat ? (

                /* ── Event tiles grid ── */
                <motion.div
                  key="event-grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {loading ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', padding: '40px', textAlign: 'center' }}>Loading events…</p>
                  ) : activeCategories.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', padding: '40px', textAlign: 'center' }}>No events found — sync Planner to load events</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                      {activeCategories.map(cat => (
                        <EventCard
                          key={cat.key}
                          category={cat}
                          tasks={tasksByCategory[cat.key] || []}
                          onClick={() => setSelectedCat(cat.key)}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>

              ) : (

                /* ── Task detail view ── */
                <motion.div
                  key={`tasks-${selectedCat}`}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Header bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <button
                      onClick={() => setSelectedCat(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      All Events
                    </button>

                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>/</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedCatObj?.name}
                    </span>

                    <button
                      onClick={() => setShowAdd(true)}
                      style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, background: '#cc1c1c', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Add Task
                    </button>
                  </div>

                  {/* Task list */}
                  <div style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', maxHeight: '520px', overflowY: 'auto' }}>
                    {selectedCatTasks.length === 0 ? (
                      <p style={{ padding: '36px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>No tasks for this event yet</p>
                    ) : (
                      <div style={{ padding: '4px 8px 8px' }}>
                        {selectedCatTasks.map(task => (
                          <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onToggleChecklist={handleToggleChecklist} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>

              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Priorities + OneDrive summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Priorities */}
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Priorities</p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Most pressing for you today</p>
                </div>
                {priorityTasks.some(t => isOverdue(t.dueDate)) && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,60,60,0.9)', boxShadow: '0 0 8px rgba(255,60,60,0.5)' }}/>}
              </div>
              <div style={{ padding: '4px 8px 8px' }}>
                {loading ? <p style={{ padding: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>Loading…</p>
                  : priorityTasks.length === 0 ? <p style={{ padding: '18px', fontSize: '11px', color: 'rgba(50,205,50,0.7)', textAlign: 'center' }}>✓ All caught up</p>
                  : priorityTasks.map(task => (
                    <TaskRow key={task.id} task={task} onToggle={handleToggleTask} onToggleChecklist={handleToggleChecklist} compact />
                  ))}
              </div>
            </div>

            {/* OneDrive summary */}
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>OneDrive</p>
                <button onClick={() => setShowOD(true)}
                  style={{ fontSize: '10px', color: 'rgba(100,180,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Full Analytics →
                </button>
              </div>
              <div style={{ padding: '16px' }}>
                {!onedrive?.syncedAt ? <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '8px 0' }}>Syncing…</p> : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                      <div>
                        <p style={{ fontSize: '18px', fontFamily: '"Bebas Neue", sans-serif', color: 'rgba(100,180,255,0.9)', letterSpacing: '0.06em', lineHeight: 1 }}>{fmtBytes(onedrive.used)}</p>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>of {fmtBytes(onedrive.total)}</p>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: odPct > 80 ? 'rgba(255,90,90,0.9)' : 'rgba(100,180,255,0.7)' }}>{odPct}%</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${odPct}%` }} transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
                        style={{ height: '100%', borderRadius: '2px', background: odPct > 80 ? 'rgba(255,90,90,0.6)' : 'rgba(100,180,255,0.55)' }} />
                    </div>
                    {onedrive.topFolders.slice(0, 4).map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{f.name}</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{fmtBytes(f.size)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && planner && (
          <AddTaskModal key="add" plans={planner.plans} buckets={planner.buckets} categories={planner.categories}
            defaultCategoryKey={selectedCat && selectedCat !== '__none__' ? selectedCat : undefined}
            onClose={() => setShowAdd(false)} onAdd={handleAddTask} />
        )}
        {showOD && (
          <OneDriveModal key="od" summary={onedrive} onClose={() => setShowOD(false)} />
        )}
        {showFull && (
          <FullPlannerModal key="full" onClose={() => setShowFull(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
