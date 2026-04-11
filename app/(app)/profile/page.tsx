import { requireSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await requireSession();
  const user = session.user!;

  const initials = user.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div>
      <h1
        className="font-bebas tracking-wide leading-none mb-6"
        style={{ fontSize: "clamp(28px, 2.5vw, 38px)", color: "var(--text-1)" }}
      >
        Profile
      </h1>

      <div className="module-card p-6 max-w-[500px] flex items-start gap-5">
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: user.avatarColor ?? "rgba(var(--champ-rgb), 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-bebas)",
            fontSize: "22px",
            letterSpacing: "0.05em",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="field-label">Name</label>
            <p style={{ fontSize: "14px", color: "var(--text-1)" }}>
              {user.name}
            </p>
          </div>
          <div>
            <label className="field-label">Email</label>
            <p style={{ fontSize: "14px", color: "var(--text-1)" }}>
              {user.email}
            </p>
          </div>
          <div>
            <label className="field-label">Role</label>
            <span
              className="rounded-full inline-block"
              style={{
                padding: "2px 10px",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: "rgba(var(--champ-rgb), 0.06)",
                color: "var(--champagne)",
              }}
            >
              {user.role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
