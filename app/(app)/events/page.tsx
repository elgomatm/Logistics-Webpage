import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import Link from "next/link";
import { Plus, CalendarDays, MapPin } from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  planning: { bg: "rgba(59,130,246,0.08)", color: "rgba(37,99,235,0.9)" },
  active: { bg: "rgba(34,197,94,0.08)", color: "rgba(21,128,61,0.9)" },
  completed: { bg: "rgba(0,0,0,0.04)", color: "var(--text-3)" },
  cancelled: { bg: "rgba(239,68,68,0.06)", color: "rgba(200,40,40,0.7)" },
};

export default async function EventsPage() {
  await requirePermission("events.view");

  const allEvents = await db
    .select()
    .from(events)
    .orderBy(asc(events.startDate));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="font-bebas tracking-wide leading-none"
          style={{
            fontSize: "clamp(28px, 2.5vw, 38px)",
            color: "var(--text-1)",
          }}
        >
          Events
        </h1>
        <Link
          href="/events/new"
          className="btn-primary"
          style={{ padding: "10px 20px", fontSize: "12px" }}
        >
          <Plus size={14} strokeWidth={2} />
          New Event
        </Link>
      </div>

      {allEvents.length === 0 ? (
        <div
          className="module-card p-12 text-center"
          style={{ color: "var(--text-3)", fontSize: "13px" }}
        >
          No events yet. Create your first event to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allEvents.map((ev) => {
            const status = STATUS_STYLES[ev.status] ?? STATUS_STYLES.planning;
            const start = new Date(ev.startDate);
            const end = new Date(ev.endDate);
            const dateStr = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

            return (
              <Link
                key={ev.id}
                href={`/events/${ev.slug}`}
                className="module-card p-5 block transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "var(--text-1)",
                      lineHeight: 1.3,
                    }}
                  >
                    {ev.name}
                  </h3>
                  <span
                    className="shrink-0 rounded-full"
                    style={{
                      padding: "2px 8px",
                      fontSize: "9px",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      background: status.bg,
                      color: status.color,
                    }}
                  >
                    {ev.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span
                    className="flex items-center gap-1.5"
                    style={{ fontSize: "11px", color: "var(--text-3)" }}
                  >
                    <CalendarDays size={12} strokeWidth={1.5} />
                    {dateStr}
                  </span>
                  {ev.venueName && (
                    <span
                      className="flex items-center gap-1.5"
                      style={{ fontSize: "11px", color: "var(--text-3)" }}
                    >
                      <MapPin size={12} strokeWidth={1.5} />
                      {ev.venueName}
                      {ev.venueCity ? `, ${ev.venueCity}` : ""}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
