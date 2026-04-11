import type { TaskPriority } from "@/lib/db/schema";

const STYLES: Record<TaskPriority, { bg: string; color: string; dot: string }> =
  {
    low: {
      bg: "rgba(59,130,246,0.08)",
      color: "rgba(59,130,246,0.8)",
      dot: "#3b82f6",
    },
    medium: {
      bg: "rgba(234,179,8,0.08)",
      color: "rgba(161,121,0,0.9)",
      dot: "#eab308",
    },
    high: {
      bg: "rgba(249,115,22,0.08)",
      color: "rgba(194,80,8,0.9)",
      dot: "#f97316",
    },
    urgent: {
      bg: "rgba(239,68,68,0.08)",
      color: "rgba(200,40,40,0.9)",
      dot: "#ef4444",
    },
  };

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export default function PriorityPill({
  priority,
}: {
  priority: TaskPriority;
}) {
  const s = STYLES[priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
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
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {LABELS[priority]}
    </span>
  );
}
