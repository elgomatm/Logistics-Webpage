"use client";

import { useState, useCallback } from "react";
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
import TaskCard from "./task-card";
import { moveTask } from "@/app/(app)/tasks/actions";
import type { BucketWithTasksHydrated, HydratedTask } from "@/lib/task-ui-types";

interface KanbanBoardProps {
  buckets: BucketWithTasksHydrated[];
  onTaskClick: (taskId: string) => void;
}

function BucketColumn({
  bucket,
  onTaskClick,
}: {
  bucket: BucketWithTasksHydrated;
  onTaskClick: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id });

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      style={{ minHeight: "200px" }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 px-3 py-3 mb-3"
        style={{
          borderBottom: `2px solid ${bucket.color}`,
        }}
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
          {bucket.tasks.length}
        </span>
      </div>

      {/* Sortable area */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-3 flex-1 rounded-lg p-1 transition-colors duration-150"
        style={{
          background: isOver ? "rgba(var(--champ-rgb), 0.04)" : "transparent",
          minHeight: "100px",
        }}
      >
        <SortableContext
          items={bucket.tasks.map((t) => t.task.id)}
          strategy={verticalListSortingStrategy}
        >
          {bucket.tasks.map((ht) => (
            <TaskCard
              key={ht.task.id}
              task={ht}
              onClick={() => onTaskClick(ht.task.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function KanbanBoard({ buckets, onTaskClick }: KanbanBoardProps) {
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

    // Determine target bucket
    let targetBucketId: string;
    const overResult = findTask(overId);
    if (overResult) {
      targetBucketId = overResult.bucketId;
    } else {
      // Dropped on the bucket itself
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find current bucket
    const found = findTask(activeId);
    if (!found) return;

    // Determine target bucket and position
    let targetBucketId: string;
    const overResult = findTask(overId);
    if (overResult) {
      targetBucketId = overResult.bucketId;
    } else {
      targetBucketId = overId;
    }

    // Calculate position
    const targetBucket = localBuckets.find((b) => b.id === targetBucketId);
    const tasksInTarget = targetBucket?.tasks ?? [];
    const overIndex = tasksInTarget.findIndex((ht) => ht.task.id === overId);
    const position =
      overIndex >= 0 ? (overIndex + 1) * 100 : (tasksInTarget.length + 1) * 100;

    // Server action
    await moveTask(activeId, targetBucketId, position);
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
