import { requireSession } from "@/lib/session";
import { loadDashboard } from "@/lib/tasks-dashboard-loader";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireSession();
  const user = session.user!;
  const data = await loadDashboard(user.id as string);
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Page heading */}
      <h1
        className="font-bebas tracking-wide leading-none mb-1"
        style={{ fontSize: "clamp(32px, 3vw, 44px)", color: "var(--text-1)" }}
      >
        Welcome back, {firstName}
      </h1>
      <p
        className="mb-8"
        style={{
          fontSize: "13px",
          color: "var(--text-3)",
          letterSpacing: "0.02em",
        }}
      >
        Here&apos;s your overview for today.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={<ClipboardList size={18} />}
          label="My Open Tasks"
          value={data.myOpenTasks}
          href="/tasks?assignee=me"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Due Soon"
          value={data.dueSoon}
          accent={data.dueSoon > 0 ? "rgba(234,179,8,0.8)" : undefined}
          href="/tasks"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Overdue"
          value={data.overdue}
          accent={data.overdue > 0 ? "rgba(239,68,68,0.8)" : undefined}
          href="/tasks"
        />
        <StatCard
          icon={<BarChart3 size={18} />}
          label="Active Events"
          value={data.eventReadiness.length}
          href="/events"
        />
      </div>

      {/* Event Readiness */}
      <section>
        <h2
          className="font-bebas tracking-wide mb-4"
          style={{ fontSize: "24px", color: "var(--text-1)" }}
        >
          Event Readiness
        </h2>

        {data.eventReadiness.length === 0 ? (
          <div
            className="module-card p-8 text-center"
            style={{ color: "var(--text-3)", fontSize: "13px" }}
          >
            No events in planning. Create an event to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.eventReadiness.map((ev) => {
              const pct =
                ev.totalTasks > 0
                  ? Math.round((ev.doneTasks / ev.totalTasks) * 100)
                  : 0;
              return (
                <Link
                  key={ev.eventId}
                  href={`/events/${ev.slug}`}
                  className="module-card p-5 block transition-colors"
                >
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--text-1)",
                      marginBottom: "8px",
                    }}
                  >
                    {ev.eventName}
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: "var(--champagne)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "var(--text-2)",
                        minWidth: "32px",
                        textAlign: "right",
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "var(--text-3)",
                      marginTop: "6px",
                    }}
                  >
                    {ev.doneTasks} / {ev.totalTasks} tasks done
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
  href: string;
}) {
  return (
    <Link href={href} className="module-card p-5 block transition-colors">
      <div
        className="mb-3"
        style={{ color: accent ?? "var(--champagne)" }}
      >
        {icon}
      </div>
      <p
        className="font-bebas tracking-wide leading-none"
        style={{
          fontSize: "36px",
          color: accent ?? "var(--text-1)",
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "9px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 500,
          color: "var(--text-3)",
          marginTop: "4px",
        }}
      >
        {label}
      </p>
    </Link>
  );
}
