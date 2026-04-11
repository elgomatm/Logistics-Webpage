"use client";

import { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!session?.user) return null;

  const user = session.user;
  const displayName = user.name?.split(" ")[0] ?? "";
  const initials = user.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 group"
        aria-label="User menu"
      >
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: `rgba(var(--champ-rgb), 0.10)`,
            border: `1px solid rgba(var(--champ-rgb), 0.25)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-bebas)",
            fontSize: "13px",
            letterSpacing: "0.05em",
            color: "var(--champagne)",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <span
          className="text-[11px] tracking-[0.08em] font-medium hidden sm:block"
          style={{ color: "var(--text-2)" }}
        >
          {displayName}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden
          style={{
            color: "var(--text-3)",
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: "200px",
            background: "var(--surface)",
            border: "1px solid var(--border-mid)",
            borderRadius: "12px",
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.12)",
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "14px 16px 12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-1)",
                marginBottom: "2px",
              }}
            >
              {user.name}
            </p>
            <p
              style={{
                fontSize: "10px",
                color: "var(--text-3)",
                letterSpacing: "0.03em",
              }}
            >
              {user.email}
            </p>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full text-left transition-colors duration-150"
            style={{
              padding: "10px 16px",
              fontSize: "12px",
              color: "var(--text-2)",
              letterSpacing: "0.03em",
            }}
          >
            <User size={14} strokeWidth={1.5} />
            Profile
          </Link>

          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            className="flex items-center gap-2.5 w-full text-left transition-colors duration-150"
            style={{
              padding: "10px 16px",
              fontSize: "12px",
              color: "var(--text-2)",
              letterSpacing: "0.03em",
              borderTop: "1px solid var(--border)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <LogOut size={14} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
