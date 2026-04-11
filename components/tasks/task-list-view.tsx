"use client";

import type { BucketWithTasksHydrated } from "@/lib/task-ui-types";
import PriorityPill from "./priority-pill";
import ProgressPill from "./progress-pill";
import AssigneeStack from "./assignee-stack";
import DueDate from "./due-date";
import { CheckSquare } from "lucide-react";

interface TaskListViewProps {
  buckets: BucketWithTasksHydrated[];
  onTaskClick: (taskId: string) => void;
}

export default function TaskListView({
  buckets,
  onTaskClick,
}: TaskListViewProps) {
  const nonEmpty = buckets.filter((b) => b.tasks.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <div
        className="module-card p-12 text-center"
        style={{ color: "var(--text-3)", fontSize: "13px" }}
      >
        No tasks yet. Create a task to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {nonEmpty.map((bucket) => (
        <section key={bucket.id}>
          {/* Bucket header */}
          <div className="flex items-center gap-2.5 mb-3">
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: bucket.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-1)",
              }}
            >
              {bucket.name}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-3)" }}>
              {bucket.tasks.length}
            </span>
          </div>

          {/* Task rows */}
          <div
            className="module-card overflow-hidden"
            style={{ borderRadius: "12px" }}
          >
            {bucket.tasks.map((ht, i) => {
              const t = ht.task;
              return (
                <div
                  key={t.id}
                  onClick={() => onTaskClick(t.id)}
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors duration-100"
                  style={{
                    borderBottom:
                      i < bucket.tasks.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {/* Name */}
                  <p
                    className="flex-1 min-w-0 truncate"
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color:
                        t.progress === "done"
                          ? "var(--text-3)"
                          : "var(--text-1)",
                      textDecoration:
                        t.progress === "done" ? "line-through" : "none",
                    }}
                  >
                    {t.name}
                  </p>

                  {/* Event */}
                  <span
                    className="hidden md:block truncate max-w-[120px]"
                    style={{ fontSize: "10px", color: "var(--text-3)" }}
                  >
                    {ht.event.name}
                  </span>

                  {/* Priority */}
                  <div className="hidden sm:block">
                    <PriorityPill priority={t.priority} />
                  </div>

                  {/* Progress */}
                  <ProgressPill progress={t.progress} />

                  {/* Due date */}
                  <div className="hidden lg:block min-w-[70px]">
                    <DueDate date={t.dueDate} />
                  </div>

                  {/* Checklist */}
                  {ht.checklistTotal > 0 && (
                    <span
                      className="hidden md:inline-flex items-center gap-1"
                      style={{
                        fontSize: "10px",
                        color:
                          ht.checklistDone === ht.checklistTotal
                            ? "rgba(34,197,94,0.8)"
                            : "var(--text-3)",
                      }}
                    >
                      <CheckSquare size={10} strokeWidth={1.5} />
                      {ht.checklistDone}/{ht.checklistTotal}
                    </span>
                  )}

                  {/* Assignees */}
                  <AssigneeStack assignees={ht.assignees} max={2} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
