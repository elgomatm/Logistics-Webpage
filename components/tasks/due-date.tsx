import { Calendar } from "lucide-react";

export default function DueDate({ date }: { date: string | null }) {
  if (!date) return null;

  const d = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);

  let label: string;
  let color: string;

  if (diff < 0) {
    label = diff === -1 ? "Yesterday" : `${Math.abs(diff)}d overdue`;
    color = "rgba(239,68,68,0.85)";
  } else if (diff === 0) {
    label = "Today";
    color = "rgba(234,179,8,0.85)";
  } else if (diff === 1) {
    label = "Tomorrow";
    color = "rgba(234,179,8,0.7)";
  } else if (diff <= 3) {
    label = `${diff}d`;
    color = "rgba(234,179,8,0.6)";
  } else {
    label = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    color = "var(--text-3)";
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ fontSize: "10px", color }}
    >
      <Calendar size={10} strokeWidth={1.5} />
      {label}
    </span>
  );
}
