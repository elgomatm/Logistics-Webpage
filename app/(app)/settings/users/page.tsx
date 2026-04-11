import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/session";
import { asc } from "drizzle-orm";

export default async function UsersSettingsPage() {
  await requirePermission("users.view");

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarColor: users.avatarColor,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));

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
          Team Members
        </h1>
      </div>

      <div className="module-card overflow-hidden" style={{ borderRadius: "12px" }}>
        {/* Table header */}
        <div
          className="grid gap-4 px-5 py-3"
          style={{
            gridTemplateColumns: "1fr 1fr 100px 80px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {["Name", "Email", "Role", "Status"].map((h) => (
            <span
              key={h}
              style={{
                fontSize: "9px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "var(--text-3)",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {allUsers.map((u, i) => {
          const initials = u.name
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={u.id}
              className="grid gap-4 px-5 py-3 items-center"
              style={{
                gridTemplateColumns: "1fr 1fr 100px 80px",
                borderBottom:
                  i < allUsers.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: u.avatarColor ?? "rgba(var(--champ-rgb), 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-1)",
                  }}
                >
                  {u.name}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {u.email}
              </span>
              <span
                className="rounded-full text-center"
                style={{
                  padding: "2px 8px",
                  fontSize: "9px",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  background: "rgba(var(--champ-rgb), 0.06)",
                  color: "var(--champagne)",
                }}
              >
                {u.role}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: u.active
                    ? "rgba(34,197,94,0.8)"
                    : "rgba(239,68,68,0.7)",
                }}
              >
                {u.active ? "Active" : "Inactive"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
