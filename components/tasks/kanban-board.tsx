"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, Plus } from "lucide-react";
import TaskCard from "./task-card";
import { moveTask, createTask } from "@/app/(app)/tasks/actions";
import type { BucketWithTasksHydrated, HydratedTask, EventOption } from "@/lib/task-ui-types";

interface KanbanBoardProps {
  buckets: BucketWithTasksHydrated[];
  events: EventOption[];
  onTaskClick: (taskId: string) => void;
}

function BucketColumn({
  bucket,
  events,
  onTaskClick,
}: {
  bucket: BucketWithTasksHydrated;
  events: EventOption[];
  onTaskClick: (taskId: string) => void;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id });
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);

  const activeTasks = bucket.tasks.filter((ht) => ht.task.progress !== "done");
  const doneTasks = bucket.tasks.filter((ht) => ht.task.progress === "done");

  const handleAddTask = async (eventId: string) => {
    if (creating) return;
    setCreating(true);
    setShowEventPicker(false);
    try {
      const result = await createTask({
        name: "New Task",
        eventId,
        bucketId: bucket.id,
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
        router.push(`/tasks/board?task=${result.data.taskId}`, { scroll: false });
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      style={{ minHeight: "200px" }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 px-3 py-3"
        style={{ borderBottom: `2px solid ${bucket.color}` }}
      >
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
        <span
          style={{
            fontSize: "10px",
            color: "var(--text-3)",
            marginLeft: "auto",
          }}
        >
          {activeTasks.length}
        </span>
      </div>

      {/* Add Task button */}
      <div className="relative px-1 py-2">
        <button
          type="button"
          disabled={creating || events.length === 0}
          onClick={() => {
            if (events.length === 1) {
              handleAddTask(events[0].id);
            } else {
              setShowEventPicker(!showEventPicker);
            }
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg transition-colors duration-150"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--text-3)",
            background: "transparent",
            border: "1px dashed var(--border-mid)",
            cursor: creating ? "wait" : "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(var(--champ-rgb), 0.4)";
            e.currentTarget.style.color = "var(--champagne)";
            e.currentTarget.style.background = "rgba(var(--champ-rgb), 0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-mid)";
            e.currentTarget.style.color = "var(--text-3)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Plus size={13} strokeWidth={2} />
          {creating ? "Adding..." : "Add Task"}
        </button>

        {/* Event picker dropdown */}
        {showEventPicker && events.length > 1 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-mid)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
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
                type="button"
                onClick={() => handleAddTask(ev.id)}
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
      </div>

      {/* Active tasks (sortable) */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-3 flex-1 rounded-lg p-1 transition-colors duration-150"
        style={{
          background: isOver ? "rgba(var(--champ-rgb), 0.04)" : "transparent",
          minHeight: "60px",
        }}
      >
        <SortableContext
          items={activeTasks.map((t) => t.task.id)}
          strategy={verticalListSortingStrategy}
        >
          {activeTasks.map((ht) => (
            <TaskCard
              key={ht.task.id}
              task={ht}
              onClick={() => onTaskClick(ht.task.id)}
            />
          ))}
        </SortableContext>
      </div>

      {/* Collapsed completed tasks */}
      {doneTasks.length > 0 && (
        <div className="mt-2 px-1">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="flex items-center gap-2 w-full py-2 px-2 rounded-md transition-colors duration-100"
            style={{ color: "var(--text-3)", fontSize: "10px", letterSpacing: "0.1em" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              style={{
                transform: showDone ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s ease",
              }}
            />
            <span className="uppercase font-medium">
              {doneTasks.length} completed
            </span>
          </button>

          {showDone && (
            <div className="flex flex-col gap-3 mt-1" style={{ opacity: 0.45 }}>
              {doneTasks.map((ht) => (
                <TaskCard
                  key={ht.task.id}
                  task={ht}
                  onClick={() => onTaskClick(ht.task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({ buckets, events, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<HydratedTask | null>(null);
  const [localBuckets, setLocalBuckets] = useState(buckets);

  // Reset local buckets when server data changes
  if (buckets !== localBuckets && !activeTask) {
    setLocalBuckets(buckets);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const findTask = useCallback(
    (taskId: string): { task: HydratedTask; bucketId: string } | null => {
      for (const b of localBuckets) {
        const t = b.tasks.find((ht) => ht.task.id === taskId);
        if (t) return { task: t, bucketId: b.id };
      }
      return null;
    },
    [localBuckets],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const found = findTask(event.active.id as string);
    if (found) setActiveTask(found.task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeResult = findTask(activeId);
    if (!activeResult) return;

    let targetBucketId: string;
    const overResult = findTask(overId);
    if (overResult) {
      targetBucketId = overResult.bucketId;
    } else {
      targetBucketId = overId;
    }

    if (activeResult.bucketId === targetBucketId) return;

    // Optimistic move
    setLocalBuckets((prev) => {
      const next = prev.map((b) => ({
        ...b,
        tasks: b.tasks.filter((ht) => ht.task.id !== activeId),
      }));
      const targetBucket = next.find((b) => b.id === targetBucketId);
      if (targetBucket) {
        targetBucket.tasks.push({
          ...activeResult.task,
          task: { ...activeResult.task.task, bucketId: targetBucketId },
        });
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const found = findTask(activeId);
    if (!found) return;

    let targetBucketId: string;
    const overResult = findTask(overId);
    if (overResult) {
      targetBucketId = overResult.bucketId;
    } else {
      targetBucketId = overId;
    }

    const targetBucket = localBuckets.find((b) => b.id === targetBucketId);
    const tasksInTarget = targetBucket?.tasks ?? [];
    const overIndex = tasksInTarget.findIndex((ht) => ht.task.id === overId);
    const position =
      overIndex >= 0 ? (overIndex + 1) * 100 : (tasksInTarget.length + 1) * 100;

    // Fire and forget — don't block UI
    moveTask(activeId, targetBucketId, position).catch(console.error);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 overflow-x-auto pb-4">
        {localBuckets.map((bucket) => (
          <BucketColumn
            key={bucket.id}
            bucket={bucket}
            events={events}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 opacity-90">
            <TaskCard task={activeTask} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
