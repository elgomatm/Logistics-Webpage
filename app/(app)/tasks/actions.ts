"use server";

import { revalidatePath } from "next/cache";
import { eq, and, asc, inArray, sql, max } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tasks,
  taskBuckets,
  taskAssignees,
  taskChecklistItems,
  timeEntries,
  activityLog,
  events,
  type NewTask,
  type TaskProgress,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import { generateId } from "@/lib/utils";
import {
  BUCKET_POSITION_STEP,
  TASK_POSITION_STEP,
} from "@/lib/task-defaults";
import { DEFAULT_BUCKET_COLOR } from "@/lib/task-parameters";
import type { TaskInput } from "@/lib/task-types";

// ── Types ───────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : { data: T }))
  | { ok: false; error: string };

// ── Helpers ─────────────────────────────────────────────────────

function revalidateTaskSurfaces(eventSlug?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/board");
  revalidatePath("/dashboard");
  if (eventSlug) {
    revalidatePath(`/events/${eventSlug}`);
    revalidatePath(`/events/${eventSlug}/tasks`);
  }
}

async function slugForEventId(eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return row?.slug ?? null;
}

async function loadTaskShell(taskId: string) {
  const [row] = await db
    .select({
      id: tasks.id,
      eventId: tasks.eventId,
      bucketId: tasks.bucketId,
      startedAt: tasks.startedAt,
      completedAt: tasks.completedAt,
      name: tasks.name,
      position: tasks.position,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  return row ?? null;
}

function nextPosition(currentMax: number | null, step: number): number {
  if (currentMax === null || !Number.isFinite(currentMax)) return step;
  return currentMax + step;
}

// ── Buckets ─────────────────────────────────────────────────────

export async function createBucket(
  name: string,
  color?: string,
): Promise<ActionResult<{ bucketId: string }>> {
  const session = await requirePermission("tasks.create");

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bucket name is required" };
  if (trimmed.length > 60) return { ok: false, error: "Bucket name too long" };

  const [{ maxPos } = { maxPos: null }] = await db
    .select({ maxPos: max(taskBuckets.position) })
    .from(taskBuckets);

  const bucketId = generateId();
  await db.insert(taskBuckets).values({
    id: bucketId,
    name: trimmed,
    color: color || DEFAULT_BUCKET_COLOR,
    position: nextPosition(maxPos, BUCKET_POSITION_STEP),
  });

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task_bucket",
    entityId: bucketId,
    action: "bucket_created",
    metadata: { name: trimmed },
  });

  revalidateTaskSurfaces();
  return { ok: true, data: { bucketId } };
}

export async function updateBucket(
  bucketId: string,
  input: { name?: string; color?: string },
): Promise<ActionResult> {
  await requirePermission("tasks.create");

  const patch: Partial<{ name: string; color: string; updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return { ok: false, error: "Bucket name is required" };
    if (trimmed.length > 60)
      return { ok: false, error: "Bucket name too long" };
    patch.name = trimmed;
  }
  if (input.color !== undefined) patch.color = input.color;

  const [updated] = await db
    .update(taskBuckets)
    .set(patch)
    .where(eq(taskBuckets.id, bucketId))
    .returning({ id: taskBuckets.id });

  if (!updated) return { ok: false, error: "Bucket not found" };

  revalidateTaskSurfaces();
  return { ok: true };
}

export async function reorderBuckets(
  orderedIds: string[],
): Promise<ActionResult> {
  await requirePermission("tasks.create");

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(taskBuckets)
      .set({
        position: (i + 1) * BUCKET_POSITION_STEP,
        updatedAt: new Date(),
      })
      .where(eq(taskBuckets.id, orderedIds[i]));
  }

  revalidateTaskSurfaces();
  return { ok: true };
}

export async function deleteBucket(
  bucketId: string,
  destinationBucketId: string | null,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.create");

  const allBuckets = await db
    .select({ id: taskBuckets.id })
    .from(taskBuckets);

  if (allBuckets.length <= 1) {
    return {
      ok: false,
      error: "At least one bucket must exist. Create another first.",
    };
  }

  const [target] = await db
    .select({ id: taskBuckets.id, name: taskBuckets.name })
    .from(taskBuckets)
    .where(eq(taskBuckets.id, bucketId))
    .limit(1);
  if (!target) return { ok: false, error: "Bucket not found" };

  const [{ taskCount }] = await db
    .select({ taskCount: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.bucketId, bucketId), sql`${tasks.archivedAt} IS NULL`));

  if (taskCount > 0) {
    if (!destinationBucketId) {
      return {
        ok: false,
        error: `This bucket has ${taskCount} task${taskCount === 1 ? "" : "s"}. Pick a destination bucket first.`,
      };
    }
    if (destinationBucketId === bucketId) {
      return {
        ok: false,
        error: "Destination bucket cannot be the bucket you're deleting",
      };
    }
    const [dest] = await db
      .select({ id: taskBuckets.id })
      .from(taskBuckets)
      .where(eq(taskBuckets.id, destinationBucketId))
      .limit(1);
    if (!dest) return { ok: false, error: "Destination bucket not found" };
  }

  if (taskCount > 0 && destinationBucketId) {
    const [{ maxPos } = { maxPos: null }] = await db
      .select({ maxPos: max(tasks.position) })
      .from(tasks)
      .where(eq(tasks.bucketId, destinationBucketId));

    const movingTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.bucketId, bucketId))
      .orderBy(asc(tasks.position));

    let cursor = nextPosition(maxPos, TASK_POSITION_STEP);
    for (const t of movingTasks) {
      await db
        .update(tasks)
        .set({
          bucketId: destinationBucketId,
          position: cursor,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, t.id));
      cursor += TASK_POSITION_STEP;
    }
  }

  await db.delete(taskBuckets).where(eq(taskBuckets.id, bucketId));

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task_bucket",
    entityId: bucketId,
    action: "bucket_deleted",
    metadata: {
      name: target.name,
      movedTaskCount: taskCount,
      destinationBucketId,
    },
  });

  revalidateTaskSurfaces();
  return { ok: true };
}

// ── Tasks ───────────────────────────────────────────────────────

function validateTaskInput(input: Partial<TaskInput>): string | null {
  if (input.eventId !== undefined && !input.eventId) return "Pick an event";
  if (input.name !== undefined && !input.name.trim()) return "Task name is required";
  if (input.name !== undefined && input.name.trim().length > 200) return "Task name is too long";
  if (
    input.plannedStartDate &&
    input.dueDate &&
    input.dueDate < input.plannedStartDate
  ) {
    return "Due date must be on or after planned start date";
  }
  if (input.estimatedSeconds != null && input.estimatedSeconds < 0) {
    return "Estimated time cannot be negative";
  }
  return null;
}

export async function createTask(
  input: TaskInput,
): Promise<ActionResult<{ taskId: string }>> {
  const session = await requirePermission("tasks.create");

  const error = validateTaskInput(input);
  if (error) return { ok: false, error };

  const [event] = await db
    .select({ id: events.id, slug: events.slug })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1);
  if (!event) return { ok: false, error: "Event not found" };

  const [bucket] = await db
    .select({ id: taskBuckets.id })
    .from(taskBuckets)
    .where(eq(taskBuckets.id, input.bucketId))
    .limit(1);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [{ maxPos } = { maxPos: null }] = await db
    .select({ maxPos: max(tasks.position) })
    .from(tasks)
    .where(eq(tasks.bucketId, input.bucketId));

  const taskId = generateId();
  const newTask: NewTask = {
    id: taskId,
    eventId: event.id,
    bucketId: input.bucketId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    progress: input.progress,
    priority: input.priority,
    reviewerId: input.reviewerId,
    plannedStartDate: input.plannedStartDate,
    dueDate: input.dueDate,
    estimatedSeconds: input.estimatedSeconds,
    position: nextPosition(maxPos, TASK_POSITION_STEP),
    createdBy: session.user!.id as string,
  };

  await db.insert(tasks).values(newTask);
  if (input.assigneeIds.length > 0) {
    await db.insert(taskAssignees).values(
      input.assigneeIds.map((uid) => ({
        taskId,
        userId: uid,
      })),
    );
  }

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task",
    entityId: taskId,
    action: "task_created",
    metadata: { eventId: event.id, name: newTask.name },
  });

  revalidateTaskSurfaces(event.slug);
  return { ok: true, data: { taskId } };
}

export async function updateTask(
  taskId: string,
  input: Partial<TaskInput>,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.create");

  const error = validateTaskInput(input);
  if (error) return { ok: false, error };

  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!existing) return { ok: false, error: "Task not found" };

  let nextEventId = existing.eventId;
  if (input.eventId && input.eventId !== existing.eventId) {
    const [nextEvent] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, input.eventId))
      .limit(1);
    if (!nextEvent) return { ok: false, error: "Event not found" };
    nextEventId = nextEvent.id;
  }

  let position = existing.position;
  if (input.bucketId && input.bucketId !== existing.bucketId) {
    const [bucket] = await db
      .select({ id: taskBuckets.id })
      .from(taskBuckets)
      .where(eq(taskBuckets.id, input.bucketId))
      .limit(1);
    if (!bucket) return { ok: false, error: "Bucket not found" };

    const [{ maxPos } = { maxPos: null }] = await db
      .select({ maxPos: max(tasks.position) })
      .from(tasks)
      .where(eq(tasks.bucketId, input.bucketId));
    position = nextPosition(maxPos, TASK_POSITION_STEP);
  }

  const now = new Date();
  let startedAt = existing.startedAt;
  let completedAt = existing.completedAt;
  const effectiveProgress = input.progress ?? existing.progress;
  if (effectiveProgress === "in_progress" && !startedAt) startedAt = now;
  if (effectiveProgress === "done" && !completedAt) completedAt = now;
  if (effectiveProgress !== "done" && completedAt) completedAt = null;

  // Build update payload from provided fields only
  const updateData: Record<string, unknown> = { updatedAt: now };
  if (input.eventId !== undefined) updateData.eventId = nextEventId;
  if (input.bucketId !== undefined) { updateData.bucketId = input.bucketId; updateData.position = position; }
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.description !== undefined) updateData.description = input.description?.trim() || null;
  if (input.progress !== undefined) updateData.progress = input.progress;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.reviewerId !== undefined) updateData.reviewerId = input.reviewerId;
  if (input.plannedStartDate !== undefined) updateData.plannedStartDate = input.plannedStartDate;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
  if (input.estimatedSeconds !== undefined) updateData.estimatedSeconds = input.estimatedSeconds;
  updateData.startedAt = startedAt;
  updateData.completedAt = completedAt;

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

  if (input.assigneeIds !== undefined) {
    const current = await db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));
    const currentIds = new Set(current.map((r) => r.userId));
    const nextIds = new Set(input.assigneeIds);

    const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
    const toAdd = [...nextIds].filter((id) => !currentIds.has(id));

    if (toRemove.length > 0) {
      await db
        .delete(taskAssignees)
        .where(
          and(
            eq(taskAssignees.taskId, taskId),
            inArray(taskAssignees.userId, toRemove),
          ),
        );
    }
    if (toAdd.length > 0) {
      await db
        .insert(taskAssignees)
        .values(toAdd.map((uid) => ({ taskId, userId: uid })));
    }
  }

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task",
    entityId: taskId,
    action: "task_updated",
    metadata: { eventId: nextEventId },
  });

  const oldSlug = await slugForEventId(existing.eventId);
  revalidateTaskSurfaces(oldSlug);
  if (nextEventId !== existing.eventId) {
    const newSlug = await slugForEventId(nextEventId);
    revalidateTaskSurfaces(newSlug);
  }
  return { ok: true };
}

export async function moveTask(
  taskId: string,
  toBucketId: string,
  position: number,
): Promise<ActionResult> {
  await requirePermission("tasks.create");

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  const [bucket] = await db
    .select({ id: taskBuckets.id })
    .from(taskBuckets)
    .where(eq(taskBuckets.id, toBucketId))
    .limit(1);
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await db
    .update(tasks)
    .set({
      bucketId: toBucketId,
      position,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function setTaskProgress(
  taskId: string,
  progress: TaskProgress,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.work");

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  const now = new Date();
  const startedAt =
    progress === "in_progress" && !shell.startedAt ? now : shell.startedAt;
  const completedAt =
    progress === "done" ? shell.completedAt ?? now : null;

  await db
    .update(tasks)
    .set({ progress, startedAt, completedAt, updatedAt: now })
    .where(eq(tasks.id, taskId));

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task",
    entityId: taskId,
    action: "task_progress_changed",
    metadata: { progress },
  });

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function archiveTask(
  taskId: string,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.create");

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  await db
    .update(tasks)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task",
    entityId: taskId,
    action: "task_archived",
    metadata: { name: shell.name },
  });

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function deleteTask(
  taskId: string,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.create");

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  // Delete related records first
  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId));
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  await db.delete(timeEntries).where(eq(timeEntries.taskId, taskId));
  await db.delete(tasks).where(eq(tasks.id, taskId));

  await db.insert(activityLog).values({
    id: generateId(),
    userId: session.user!.id as string,
    entityType: "task",
    entityId: taskId,
    action: "task_deleted",
    metadata: { name: shell.name },
  });

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function unarchiveTask(
  taskId: string,
): Promise<ActionResult> {
  await requirePermission("tasks.create");

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  await db
    .update(tasks)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

// ── Checklist Items ─────────────────────────────────────────────

export async function addChecklistItem(
  taskId: string,
  label: string,
): Promise<ActionResult<{ itemId: string }>> {
  await requirePermission("tasks.work");

  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Item label is required" };
  if (trimmed.length > 200)
    return { ok: false, error: "Item label is too long" };

  const shell = await loadTaskShell(taskId);
  if (!shell) return { ok: false, error: "Task not found" };

  const [{ maxPos } = { maxPos: null }] = await db
    .select({ maxPos: max(taskChecklistItems.position) })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId));

  const itemId = generateId();
  await db.insert(taskChecklistItems).values({
    id: itemId,
    taskId,
    label: trimmed,
    position: nextPosition(maxPos, TASK_POSITION_STEP),
  });

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true, data: { itemId } };
}

export async function toggleChecklistItem(
  itemId: string,
): Promise<ActionResult> {
  const session = await requirePermission("tasks.work");

  const [item] = await db
    .select({
      id: taskChecklistItems.id,
      isDone: taskChecklistItems.isDone,
      taskId: taskChecklistItems.taskId,
    })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Item not found" };

  const shell = await loadTaskShell(item.taskId);
  if (!shell) return { ok: false, error: "Item not found" };

  const nextDone = !item.isDone;
  await db
    .update(taskChecklistItems)
    .set({
      isDone: nextDone,
      doneAt: nextDone ? new Date() : null,
      doneByUserId: nextDone ? session.user!.id as string : null,
    })
    .where(eq(taskChecklistItems.id, itemId));

  const slug = await slugForEventId(shell.eventId);
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function updateChecklistItem(
  itemId: string,
  label: string,
): Promise<ActionResult> {
  await requirePermission("tasks.work");

  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Item label is required" };
  if (trimmed.length > 200)
    return { ok: false, error: "Item label is too long" };

  const [item] = await db
    .select({ taskId: taskChecklistItems.taskId })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(taskChecklistItems)
    .set({ label: trimmed })
    .where(eq(taskChecklistItems.id, itemId));

  const shell = await loadTaskShell(item.taskId);
  const slug = shell ? await slugForEventId(shell.eventId) : null;
  revalidateTaskSurfaces(slug);
  return { ok: true };
}

export async function deleteChecklistItem(
  itemId: string,
): Promise<ActionResult> {
  await requirePermission("tasks.work");

  const [item] = await db
    .select({ taskId: taskChecklistItems.taskId })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .delete(taskChecklistItems)
    .where(eq(taskChecklistItems.id, itemId));

  const shell = await loadTaskShell(item.taskId);
  const slug = shell ? await slugForEventId(shell.eventId) : null;
  revalidateTaskSurfaces(slug);
  return { ok: true };
}
