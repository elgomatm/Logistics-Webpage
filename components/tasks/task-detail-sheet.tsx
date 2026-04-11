"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import type { HydratedTaskDetail, TaskUserRef, EventOption, TaskChecklistItemRef } from "@/lib/task-ui-types";
import type { TaskPriority, TaskProgress } from "@/lib/db/schema";
import UserPicker from "./user-picker";
import {
  updateTask,
  setTaskProgress,
  deleteTask,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/app/(app)/tasks/actions";

interface TaskDetailSheetProps {
  task: HydratedTaskDetail;
  users: TaskUserRef[];
  events: EventOption[];
  onClose: () => void;
}

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const PROGRESSES: TaskProgress[] = ["not_started", "in_progress", "needs_review", "done"];

// Fire-and-forget: update local state instantly, server call in background
function fireAndForget(fn: () => Promise<unknown>) {
  fn().catch((err) => console.error("[task-detail] background save failed:", err));
}

export default function TaskDetailSheet({
  task,
  users,
  events,
  onClose,
}: TaskDetailSheetProps) {
  const router = useRouter();
  const t = task.task;

  // ── Local optimistic state ──────────────────────────────────
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(t.priority);
  const [progress, setProgress] = useState<TaskProgress>(t.progress);
  const [dueDate, setDueDate] = useState(t.dueDate ?? "");
  const [eventId, setEventId] = useState(t.eventId);
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((a) => a.id));
  const [reviewerId, setReviewerId] = useState(task.reviewer?.id ?? null);
  const [checklist, setChecklist] = useState<TaskChecklistItemRef[]>(task.checklist);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save for text fields
  const debounceSave = useCallback(
    (updates: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fireAndForget(() => updateTask(t.id, updates));
      }, 600);
    },
    [t.id],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Handlers (all optimistic) ───────────────────────────────
  const handleNameChange = (val: string) => {
    setName(val);
    debounceSave({ name: val });
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    debounceSave({ description: val });
  };

  const handlePriorityChange = (val: TaskPriority) => {
    setPriority(val);
    fireAndForget(() => updateTask(t.id, { priority: val }));
  };

  const handleProgressChange = (val: TaskProgress) => {
    setProgress(val);
    fireAndForget(() => setTaskProgress(t.id, val));
  };

  const handleDueDateChange = (val: string) => {
    setDueDate(val);
    debounceSave({ dueDate: val || null });
  };

  const handleEventChange = (val: string) => {
    setEventId(val);
    fireAndForget(() => updateTask(t.id, { eventId: val }));
  };

  const handleAssigneesChange = (ids: string[]) => {
    setAssigneeIds(ids);
    fireAndForget(() => updateTask(t.id, { assigneeIds: ids }));
  };

  const handleReviewerChange = (ids: string[]) => {
    const rid = ids[0] ?? null;
    setReviewerId(rid);
    fireAndForget(() => updateTask(t.id, { reviewerId: rid }));
  };

  const handleToggleChecklist = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, isDone: !c.isDone } : c)),
    );
    fireAndForget(() => toggleChecklistItem(itemId));
  };

  const handleDeleteChecklist = (itemId: string) => {
    setChecklist((prev) => prev.filter((c) => c.id !== itemId));
    fireAndForget(() => deleteChecklistItem(itemId));
  };

  const handleAddChecklist = () => {
    const label = newChecklistLabel.trim();
    if (!label) return;
    // Optimistic: add a placeholder locally
    const tempId = `temp-${Date.now()}`;
    setChecklist((prev) => [
      ...prev,
      { id: tempId, label, isDone: false, position: prev.length, doneByUserId: null, doneAt: null },
    ]);
    setNewChecklistLabel("");
    fireAndForget(() => addChecklistItem(t.id, label));
  };

  const handleDelete = async () => {
    await deleteTask(t.id);
    onClose();
    router.refresh();
  };

  const doneCount = checklist.filter((c) => c.isDone).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto"
        style={{
          width: "min(520px, 90vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "var(--text-3)",
            }}
          >
            Task Detail
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Name */}
          <input
            className="input-field"
            style={{ fontSize: "16px", fontWeight: 500 }}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Task name"
          />

          {/* Progress buttons */}
          <div>
            <label className="field-label">Progress</label>
            <div className="flex gap-2 flex-wrap">
              {PROGRESSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProgressChange(p)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    border:
                      p === progress
                        ? "1px solid rgba(var(--champ-rgb), 0.4)"
                        : "1px solid var(--border)",
                    background:
                      p === progress
                        ? "rgba(var(--champ-rgb), 0.06)"
                        : "transparent",
                    color:
                      p === progress ? "var(--champagne)" : "var(--text-3)",
                  }}
                >
                  {p.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="field-label">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePriorityChange(p)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: "pointer",
                    border:
                      p === priority
                        ? "1px solid rgba(var(--champ-rgb), 0.4)"
                        : "1px solid var(--border)",
                    background:
                      p === priority
                        ? "rgba(var(--champ-rgb), 0.06)"
                        : "transparent",
                    color:
                      p === priority ? "var(--champagne)" : "var(--text-3)",
                    textTransform: "capitalize",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="field-label">Due Date</label>
            <input
              type="date"
              className="input-field"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="field-label">Description</label>
            <textarea
              className="input-field"
              rows={4}
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Add a description..."
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Event */}
          <div>
            <label className="field-label">Event</label>
            <select
              className="input-field"
              value={eventId}
              onChange={(e) => handleEventChange(e.target.value)}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignees */}
          <UserPicker
            label="Assignees"
            users={users}
            selectedIds={assigneeIds}
            onChange={handleAssigneesChange}
            multi
          />

          {/* Reviewer */}
          <UserPicker
            label="Reviewer"
            users={users}
            selectedIds={reviewerId ? [reviewerId] : []}
            onChange={handleReviewerChange}
            multi={false}
          />

          {/* Checklist */}
          <div>
            <label className="field-label">
              Checklist ({doneCount}/{checklist.length})
            </label>

            <div className="flex flex-col gap-1 mb-3">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 py-1.5 group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "4px",
                      flexShrink: 0,
                      cursor: "pointer",
                      border: item.isDone
                        ? "1.5px solid rgba(var(--champ-rgb), 0.5)"
                        : "1.5px solid var(--border-mid)",
                      background: item.isDone
                        ? "rgba(var(--champ-rgb), 0.1)"
                        : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.isDone && (
                      <Check
                        size={10}
                        strokeWidth={2.5}
                        style={{ color: "var(--champagne)" }}
                      />
                    )}
                  </button>
                  <span
                    style={{
                      fontSize: "13px",
                      color: item.isDone ? "var(--text-3)" : "var(--text-1)",
                      textDecoration: item.isDone ? "line-through" : "none",
                      flex: 1,
                    }}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-3)",
                      padding: "2px",
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add checklist item */}
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Add item..."
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                style={{ fontSize: "12px", padding: "8px 12px" }}
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-2)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Meta info */}
          <div
            className="pt-4 mt-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p style={{ fontSize: "10px", color: "var(--text-3)" }}>
              Created by {task.createdByName ?? "Unknown"}
              {task.createdAt &&
                ` on ${new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
            </p>
          </div>

          {/* Delete */}
          <div className="pt-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-[11px] tracking-[0.06em] transition-colors duration-150"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-3)",
                  padding: "6px 0",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <Trash2 size={13} strokeWidth={1.5} />
                Delete task
              </button>
            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <AlertTriangle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "var(--text-2)", flex: 1 }}>
                  Delete this task permanently?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] px-3 py-1.5 rounded-md"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-3)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-[11px] px-3 py-1.5 rounded-md"
                  style={{
                    background: "#ef4444",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
