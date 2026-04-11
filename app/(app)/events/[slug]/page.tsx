import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import { loadTasksForView } from "@/lib/tasks-loader";
import TasksShell from "@/components/tasks/tasks-shell";
import Link from "next/link";
import { CalendarDays, MapPin, Pencil } from "lucide-react";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  await requirePermission("events.view");
  const { slug } = await params;
  const sp = await searchParams;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) notFound();

  const data = await loadTasksForView({
    eventId: event.id,
    selectedTaskId: sp.task,
  });

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const dateStr = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div>
      {/* Event header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="font-bebas tracking-wide leading-none mb-2"
            style={{
              fontSize: "clamp(28px, 2.5vw, 38px)",
              color: "var(--text-1)",
            }}
          >
            {event.name}
          </h1>
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-1.5"
              style={{ fontSize: "12px", color: "var(--text-3)" }}
            >
              <CalendarDays size={13} strokeWidth={1.5} />
              {dateStr}
            </span>
            {event.venueName && (
              <span
                className="flex items-center gap-1.5"
                style={{ fontSize: "12px", color: "var(--text-3)" }}
              >
                <MapPin size={13} strokeWidth={1.5} />
                {event.venueName}
                {event.venueCity ? `, ${event.venueCity}` : ""}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/events/${slug}/edit`}
          className="flex items-center gap-1.5"
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            fontSize: "12px",
            color: "var(--text-2)",
          }}
        >
          <Pencil size={12} />
          Edit
        </Link>
      </div>

      {/* Event-scoped task view */}
      <TasksShell
        view="list"
        buckets={data.buckets}
        users={data.users}
        events={data.events}
        selectedTask={data.selectedTask}
      />
    </div>
  );
}
