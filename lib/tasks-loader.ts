import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  tasks,
  taskBuckets,
  taskAssignees,
  taskChecklistItems,
  users,
} from "@/lib/db/schema";
import type {
  BucketWithTasksHydrated,
  ChecklistItemCompact,
  HydratedTask,
  HydratedTaskDetail,
  TaskChecklistItemRef,
  TaskEventRef,
  TaskUserRef,
  EventOption,
} from "@/lib/task-ui-types";

export interface LoadTasksOptions {
  eventId?: string;
  selectedTaskId?: string | null;
}

export interface TasksLoaderResult {
  buckets: BucketWithTasksHydrated[];
  users: TaskUserRef[];
  events: EventOption[];
  selectedTask: HydratedTaskDetail | null;
}

export async function loadTasksForView(
  options: LoadTasksOptions = {},
): Promise<TasksLoaderResult> {
  const { eventId, selectedTaskId } = options;

  const bucketRows = await db
    .select()
    .from(taskBuckets)
    .orderBy(asc(taskBuckets.position));

  const activeClauses = [isNull(tasks.archivedAt)];
  if (eventId) activeClauses.push(eq(tasks.eventId, eventId));

  const taskRows = await db
    .select({
      task: tasks,
      eventSlug: events.slug,
      eventName: events.name,
      eventStatus: events.status,
    })
    .from(tasks)
    .leftJoin(events, eq(tasks.eventId, events.id))
    .where(and(...activeClauses))
    .orderBy(asc(tasks.bucketId), asc(tasks.position));

  const taskIds = taskRows.map((r) => r.task.id);

  const assigneeRows = taskIds.length
    ? await db
        .select({
          taskId: taskAssignees.taskId,
          userId: taskAssignees.userId,
        })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, taskIds))
    : [];

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarColor: users.avatarColor,
      active: users.active,
    })
    .from(users);
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const pickerUsers: TaskUserRef[] = userRows
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatarColor }));

  const allChecklistItems = taskIds.length
    ? await db
        .select({
          id: taskChecklistItems.id,
          taskId: taskChecklistItems.taskId,
          label: taskChecklistItems.label,
          isDone: taskChecklistItems.isDone,
          position: taskChecklistItems.position,
          doneByUserId: taskChecklistItems.doneByUserId,
          doneAt: taskChecklistItems.doneAt,
        })
        .from(taskChecklistItems)
        .where(inArray(taskChecklistItems.taskId, taskIds))
        .orderBy(asc(taskChecklistItems.position))
    : [];

  const checklistByTask = new Map<
    string,
    { items: ChecklistItemCompact[]; done: number; total: number }
  >();
  for (const ci of allChecklistItems) {
    let entry = checklistByTask.get(ci.taskId);
    if (!entry) {
      entry = { items: [], done: 0, total: 0 };
      checklistByTask.set(ci.taskId, entry);
    }
    entry.items.push({ id: ci.id, label: ci.label, isDone: ci.isDone });
    entry.total += 1;
    if (ci.isDone) entry.done += 1;
  }

  const eventOptionRows = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      startDate: events.startDate,
      endDate: events.endDate,
    })
    .from(events)
    .orderBy(asc(events.startDate));

  const assigneesByTask = new Map<string, TaskUserRef[]>();
  for (const row of assigneeRows) {
    const u = userMap.get(row.userId);
    if (!u) continue;
    if (!assigneesByTask.has(row.taskId)) {
      assigneesByTask.set(row.taskId, []);
    }
    assigneesByTask.get(row.taskId)!.push({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
    });
  }

  const hydratedTasks: HydratedTask[] = taskRows.map((row) => {
    const t = row.task;
    const reviewerUser = t.reviewerId ? userMap.get(t.reviewerId) : null;
    const cl = checklistByTask.get(t.id) ?? { items: [], done: 0, total: 0 };
    const eventRef: TaskEventRef = {
      id: t.eventId,
      name: row.eventName ?? "Unknown event",
      slug: row.eventSlug ?? "",
      status: row.eventStatus ?? "planning",
    };
    return {
      task: t,
      assignees: assigneesByTask.get(t.id) ?? [],
      reviewer: reviewerUser
        ? {
            id: reviewerUser.id,
            name: reviewerUser.name,
            avatarColor: reviewerUser.avatarColor,
          }
        : null,
      checklistDone: cl.done,
      checklistTotal: cl.total,
      checklistItems: cl.items,
      event: eventRef,
    };
  });

  const tasksByBucket = new Map<string, HydratedTask[]>();
  for (const ht of hydratedTasks) {
    if (!tasksByBucket.has(ht.task.bucketId)) {
      tasksByBucket.set(ht.task.bucketId, []);
    }
    tasksByBucket.get(ht.task.bucketId)!.push(ht);
  }

  const bucketsHydrated: BucketWithTasksHydrated[] = bucketRows.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    position: b.position,
    tasks: tasksByBucket.get(b.id) ?? [],
  }));

  let selectedTask: HydratedTaskDetail | null = null;
  if (selectedTaskId) {
    const hit = hydratedTasks.find((h) => h.task.id === selectedTaskId);
    if (hit) {
      const fullItems = allChecklistItems.filter(
        (ci) => ci.taskId === selectedTaskId,
      );
      const checklist: TaskChecklistItemRef[] = fullItems.map((ci) => ({
        id: ci.id,
        label: ci.label,
        isDone: ci.isDone,
        position: ci.position,
        doneByUserId: ci.doneByUserId,
        doneAt: ci.doneAt,
      }));

      const creator = hit.task.createdBy
        ? await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, hit.task.createdBy))
            .limit(1)
        : [];

      selectedTask = {
        ...hit,
        checklist,
        createdByName: creator[0]?.name ?? null,
        createdAt: hit.task.createdAt,
        updatedAt: hit.task.updatedAt,
        startedAt: hit.task.startedAt,
        completedAt: hit.task.completedAt,
        estimatedSeconds: hit.task.estimatedSeconds,
        totalSecondsLogged: hit.task.totalSecondsLogged,
      };
    }
  }

  return {
    buckets: bucketsHydrated,
    users: pickerUsers,
    events: eventOptionRows,
    selectedTask,
  };
}
