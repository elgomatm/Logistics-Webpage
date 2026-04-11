import { eq, and, isNull, lte, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, taskAssignees, events } from "@/lib/db/schema";

export interface DashboardData {
  myOpenTasks: number;
  dueSoon: number;
  overdue: number;
  eventReadiness: {
    eventId: string;
    eventName: string;
    slug: string;
    totalTasks: number;
    doneTasks: number;
  }[];
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const now = new Date();
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // My assigned, non-archived, non-done tasks
  const myTaskIds = await db
    .select({ taskId: taskAssignees.taskId })
    .from(taskAssignees)
    .where(eq(taskAssignees.userId, userId));

  const myIds = myTaskIds.map((r) => r.taskId);

  let myOpenTasks = 0;
  let dueSoon = 0;
  let overdue = 0;

  if (myIds.length > 0) {
    const { inArray } = await import("drizzle-orm");

    const myTasks = await db
      .select({
        id: tasks.id,
        progress: tasks.progress,
        dueDate: tasks.dueDate,
        archivedAt: tasks.archivedAt,
      })
      .from(tasks)
      .where(and(inArray(tasks.id, myIds), isNull(tasks.archivedAt)));

    for (const t of myTasks) {
      if (t.progress === "done") continue;
      myOpenTasks++;
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (due < now) overdue++;
        else if (due <= threeDaysOut) dueSoon++;
      }
    }
  }

  // Event readiness: per-event task counts
  const eventRows = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      slug: events.slug,
      totalTasks: sql<number>`count(${tasks.id})::int`,
      doneTasks: sql<number>`count(case when ${tasks.progress} = 'done' then 1 end)::int`,
    })
    .from(events)
    .leftJoin(
      tasks,
      and(eq(tasks.eventId, events.id), isNull(tasks.archivedAt)),
    )
    .where(
      and(
        eq(events.status, "planning"),
      ),
    )
    .groupBy(events.id, events.name, events.slug)
    .limit(6);

  return {
    myOpenTasks,
    dueSoon,
    overdue,
    eventReadiness: eventRows.map((r) => ({
      eventId: r.eventId,
      eventName: r.eventName,
      slug: r.slug,
      totalTasks: r.totalTasks ?? 0,
      doneTasks: r.doneTasks ?? 0,
    })),
  };
}
