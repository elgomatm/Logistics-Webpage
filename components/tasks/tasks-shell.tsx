"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type {
  BucketWithTasksHydrated,
  HydratedTaskDetail,
  TaskUserRef,
  EventOption,
} from "@/lib/task-ui-types";
import TaskDetailSheet from "./task-detail-sheet";
import KanbanBoard from "./kanban-board";
import TaskListView from "./task-list-view";
import { createTask } from "@/app/(app)/tasks/actions";

interface TasksShellProps {
  view: "board" | "list";
  buckets: BucketWithTasksHydrated[];
  users: TaskUserRef[];
  events: EventOption[];
  selectedTask: HydratedTaskDetail | null;
}

export default function TasksShell({
  view,
  buckets,
  users,
  events,
  selectedTask,
}: TasksShellProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleTaskClick = useCallback(
    (taskId: string) => {
      const base = view === "board" ? "/tasks/board" : "/tasks";
      router.push(`${base}?task=${taskId}`, { scroll: false });
    },
    [router, view],
  );

  const handleClose = useCallback(() => {
    const base = view === "board" ? "/tasks/board" : "/tasks";
    router.push(base, { scroll: false });
  }, [router, view]);

  const handleCreate = async () => {
    if (creating || buckets.length === 0 || events.length === 0) return;
    setCreating(true);
    try {
      const result = await createTask({
        name: "New Task",
        eventId: events[0].id,
        bucketId: buckets[0].id,
        priority: "medium",
        progress: "not_started",
        description: null,
        reviewerId: null,
        plannedStartDate: null,
        dueDate: null,
        estimatedSeconds: null,
        assigneeIds: [],
      });
      if (result?.ok && result.data?.taskId) {
        const base = view === "board" ? "/tasks/board" : "/tasks";
        router.push(`${base}?task=${result.data.taskId}`, { scroll: false });
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1
            className="font-bebas tracking-wide leading-none"
            style={{
              fontSize: "clamp(28px, 2.5vw, 38px)",
              color: "var(--text-1)",
            }}
          >
            Tasks
          </h1>
          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <a
              href="/tasks"
              className="px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase"
              style={{
                background:
                  view === "list"
                    ? "rgba(var(--champ-rgb), 0.06)"
                    : "transparent",
                color:
                  view === "list" ? "var(--champagne)" : "var(--text-3)",
              }}
            >
              List
            </a>
            <a
              href="/tasks/board"
              className="px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase"
              style={{
                background:
                  view === "board"
                    ? "rgba(var(--champ-rgb), 0.06)"
                    : "transparent",
                color:
                  view === "board" ? "var(--champagne)" : "var(--text-3)",
                borderLeft: "1px solid var(--border)",
              }}
            >
              Board
            </a>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary"
          style={{ padding: "10px 20px", fontSize: "12px" }}
        >
          <Plus size={14} strokeWidth={2} />
          New Task
        </button>
      </div>

      {/* View */}
      {view === "board" ? (
        <KanbanBoard buckets={buckets} onTaskClick={handleTaskClick} />
      ) : (
        <TaskListView buckets={buckets} onTaskClick={handleTaskClick} />
      )}

      {/* Detail sheet */}
      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          users={users}
          events={events}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
