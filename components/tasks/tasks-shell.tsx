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
import { createTask, createBucket } from "@/app/(app)/tasks/actions";

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
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [showBucketInput, setShowBucketInput] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");

  // For list view "New Task" button (board uses per-bucket buttons)
  const [creatingTask, setCreatingTask] = useState(false);
  const [showNewTaskPicker, setShowNewTaskPicker] = useState(false);

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

  const handleCreateBucket = async () => {
    const name = newBucketName.trim();
    if (!name || creatingBucket) return;
    setCreatingBucket(true);
    try {
      await createBucket(name);
      setNewBucketName("");
      setShowBucketInput(false);
      router.refresh();
    } finally {
      setCreatingBucket(false);
    }
  };

  const handleCreateTask = async (eventId: string) => {
    if (creatingTask || buckets.length === 0) return;
    setCreatingTask(true);
    setShowNewTaskPicker(false);
    try {
      const result = await createTask({
        name: "New Task",
        eventId,
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
      setCreatingTask(false);
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

        <div className="relative">
          {view === "board" ? (
            /* Board view: New Bucket button */
            <>
              {showBucketInput ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input-field"
                    style={{ fontSize: "12px", padding: "8px 14px", width: "180px" }}
                    placeholder="Bucket name..."
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateBucket();
                      }
                      if (e.key === "Escape") {
                        setShowBucketInput(false);
                        setNewBucketName("");
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleCreateBucket}
                    disabled={creatingBucket || !newBucketName.trim()}
                    className="btn-primary"
                    style={{ padding: "8px 14px", fontSize: "12px" }}
                  >
                    {creatingBucket ? "..." : "Add"}
                  </button>
                  <button
                    onClick={() => { setShowBucketInput(false); setNewBucketName(""); }}
                    className="btn-ghost"
                    style={{ padding: "8px 12px", fontSize: "12px" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBucketInput(true)}
                  className="btn-primary"
                  style={{ padding: "10px 20px", fontSize: "12px" }}
                >
                  <Plus size={14} strokeWidth={2} />
                  New Bucket
                </button>
              )}
            </>
          ) : (
            /* List view: New Task button (same as before) */
            <>
              <button
                onClick={() => {
                  if (events.length === 1) {
                    handleCreateTask(events[0].id);
                  } else {
                    setShowNewTaskPicker(!showNewTaskPicker);
                  }
                }}
                disabled={creatingTask || events.length === 0}
                className="btn-primary"
                style={{ padding: "10px 20px", fontSize: "12px" }}
              >
                <Plus size={14} strokeWidth={2} />
                {creatingTask ? "Creating..." : "New Task"}
              </button>
              {showNewTaskPicker && events.length > 1 && (
                <div
                  className="absolute top-full right-0 mt-2 rounded-xl overflow-hidden z-50"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-mid)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    minWidth: "220px",
                  }}
                >
                  <p
                    className="px-3 py-2"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      color: "var(--text-3)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    Select Event
                  </p>
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleCreateTask(ev.id)}
                      className="flex items-center w-full px-3 py-2.5 text-left transition-colors duration-100"
                      style={{ fontSize: "12px", color: "var(--text-2)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(var(--champ-rgb), 0.06)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {ev.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* View */}
      {view === "board" ? (
        <KanbanBoard buckets={buckets} events={events} onTaskClick={handleTaskClick} />
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
