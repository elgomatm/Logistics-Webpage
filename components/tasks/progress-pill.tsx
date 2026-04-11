import type { TaskProgress } from "@/lib/db/schema";

const STYLES: Record<TaskProgress, { bg: string; color: string }> = {
  not_started: {
    bg: "rgba(0,0,0,0.04)",
    color: "var(--text-3)",
  },
  in_progress: {
    bg: "rgba(59,130,246,0.08)",
    color: "rgba(37,99,235,0.9)",
  },
  needs_review: {
    bg: "rgba(168,85,247,0.08)",
    color: "rgba(147,51,234,0.9)",
  },
  done: {
    bg: "rgba(34,197,94,0.08)",
    color: "rgba(21,128,61,0.9)",
  },
};

const LABELS: Record<TaskProgress, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  needs_review: "Needs Review",
  done: "Done",
};

export default function ProgressPill({
  progress,
}: {
  progress: TaskProgress;
}) {
  const s = STYLES[progress];
  return (
    <span
      className="inline-flex items-center rounded-full"
      style={{
        padding: "2px 8px",
        fontSize: "9px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
      }}
    >
      {LABELS[progress]}
    </span>
  );
}
