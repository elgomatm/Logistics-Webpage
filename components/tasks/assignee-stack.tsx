import type { TaskUserRef } from "@/lib/task-ui-types";

export default function AssigneeStack({
  assignees,
  max = 3,
}: {
  assignees: TaskUserRef[];
  max?: number;
}) {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => {
        const initials = u.name
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <div
            key={u.id}
            title={u.name}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: u.avatarColor ?? "rgba(var(--champ-rgb), 0.15)",
              border: "2px solid var(--surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              fontWeight: 600,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "var(--border-mid)",
            border: "2px solid var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "9px",
            fontWeight: 500,
            color: "var(--text-2)",
            flexShrink: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
