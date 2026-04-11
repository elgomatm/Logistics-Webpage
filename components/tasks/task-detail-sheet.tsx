"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import type { HydratedTaskDetail, TaskUserRef, EventOption } from "@/lib/task-ui-types";
import type { TaskPriority, TaskProgress } from "@/lib/db/schema";
import PriorityPill from "./priority-pill";
import ProgressPill from "./progress-pill";
import AssigneeStack from "./assignee-stack";
import {
  updateTask,
  setTaskProgress,
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

export default function TaskDetailSheet({
  task,
  users,
  events,
  onClose,
}: TaskDetailSheetProps) {
  const t = task.task;
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(t.priority);
  const [progress, setProgress] = useState<TaskProgress>(t.progress);
  const [dueDate, setDueDate] = useState(t.dueDate ?? "");
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save with 800ms debounce
  const debounceSave = useCallback(
    (updates: Partial<{ name: string; description: string | null; dueDate: string | null }>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        await updateTask(t.id, updates);
      }, 800);
    },
    [t.id],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    debounceSave({ name: val });
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    debounceSave({ description: val });
  };

  const handlePriorityChange = async (val: TaskPriority) => {
    setPriority(val);
    await updateTask(t.id, { priority: val });
  };

  const handleProgressChange = async (val: TaskProgress) => {
    setProgress(val);
    await setTaskProgress(t.id, val);
  };

  const handleDueDateChange = (val: string) => {
    setDueDate(val);
    debounceSave({ dueDate: val || null });
  };

  const handleAddChecklist = async () => {
    const label = newChecklistLabel.trim();
    if (!label) return;
    setNewChecklistLabel("");
    await addChecklistItem(t.id, label);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.2)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto"
        style={{
          width: "min(520px, 90vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
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

          {/* Assignees */}
          <div>
            <label className="field-label">Assignees</label>
            <AssigneeStack assignees={task.assignees} />
          </div>

          {/* Checklist */}
          <div>
            <label className="field-label">
              Checklist ({task.checklist.filter((c) => c.isDone).length}/
              {task.checklist.length})
            </label>

            <div className="flex flex-col gap-1 mb-3">
              {task.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 py-1.5 group"
                >
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
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
                    onClick={() => deleteChecklistItem(item.id)}
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
                  if (e.key === "Enter") handleAddChecklist();
                }}
                style={{ fontSize: "12px", padding: "8px 12px" }}
              />
              <button
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
            <p
              style={{ fontSize: "10px", color: "var(--text-3)" }}
            >
              Created by {task.createdByName ?? "Unknown"}
              {task.createdAt &&
                ` on ${new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
