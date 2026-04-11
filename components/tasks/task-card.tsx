"use client";

import type { HydratedTask } from "@/lib/task-ui-types";
import PriorityPill from "./priority-pill";
import ProgressPill from "./progress-pill";
import AssigneeStack from "./assignee-stack";
import DueDate from "./due-date";
import { CheckSquare } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskCardProps {
  task: HydratedTask;
  onClick?: () => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const t = task.task;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: t.id, data: { type: "task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging || isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="module-card p-4 cursor-pointer"
      role="button"
      tabIndex={0}
    >
      {/* Top row: priority + progress */}
      <div className="flex items-center gap-2 mb-2.5">
        <PriorityPill priority={t.priority} />
        <ProgressPill progress={t.progress} />
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--text-1)",
          lineHeight: 1.4,
          marginBottom: "8px",
        }}
      >
        {t.name}
      </p>

      {/* Event badge */}
      <p
        style={{
          fontSize: "10px",
          color: "var(--text-3)",
          marginBottom: "8px",
        }}
      >
        {task.event.name}
      </p>

      {/* Bottom row: due date, checklist, assignees */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <DueDate date={t.dueDate} />
          {task.checklistTotal > 0 && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                fontSize: "10px",
                color:
                  task.checklistDone === task.checklistTotal
                    ? "rgba(34,197,94,0.8)"
                    : "var(--text-3)",
              }}
            >
              <CheckSquare size={10} strokeWidth={1.5} />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}
        </div>
        <AssigneeStack assignees={task.assignees} />
      </div>
    </div>
  );
}
