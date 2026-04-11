import type { TaskProgress, TaskPriority } from "./db/schema";

// ── Progress ────────────────────────────────────────────────────

export const TASK_PROGRESS_LABELS: Record<TaskProgress, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_review: "Needs review",
  done: "Done",
};

export const TASK_PROGRESS_STYLES: Record<TaskProgress, string> = {
  not_started: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  needs_review: "bg-purple-100 text-purple-800 border-purple-200",
  done: "bg-green-100 text-green-800 border-green-200",
};

export const TASK_PROGRESS_ORDER: TaskProgress[] = [
  "not_started",
  "in_progress",
  "needs_review",
  "done",
];

// ── Priority ────────────────────────────────────────────────────

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-sky-100 text-sky-700 border-sky-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
};

export const TASK_PRIORITY_DOTS: Record<TaskPriority, string> = {
  low: "#94a3b8",
  medium: "#0ea5e9",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ── Bucket colors ───────────────────────────────────────────────

export const BUCKET_COLOR_PALETTE: Array<{ name: string; hex: string }> = [
  { name: "Slate", hex: "#64748b" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Green", hex: "#22c55e" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Pink", hex: "#ec4899" },
];

export const DEFAULT_BUCKET_COLOR = "#64748b";
