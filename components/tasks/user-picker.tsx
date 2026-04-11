"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import type { TaskUserRef } from "@/lib/task-ui-types";

interface UserPickerProps {
  label: string;
  users: TaskUserRef[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
}

export default function UserPicker({
  label,
  users,
  selectedIds,
  onChange,
  multi = true,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = users.filter((u) => selectedIds.includes(u.id));
  const available = users.filter((u) => !selectedIds.includes(u.id));

  const toggle = (userId: string) => {
    if (multi) {
      if (selectedIds.includes(userId)) {
        onChange(selectedIds.filter((id) => id !== userId));
      } else {
        onChange([...selectedIds, userId]);
      }
    } else {
      onChange(selectedIds.includes(userId) ? [] : [userId]);
      setOpen(false);
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <label className="field-label">{label}</label>

      {/* Selected chips + dropdown trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
        className="w-full flex items-center flex-wrap gap-1.5 min-h-[40px] px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150"
        style={{
          background: "#1a1a1a",
          border: open
            ? "1px solid rgba(var(--champ-rgb), 0.6)"
            : "1px solid var(--border-mid)",
        }}
      >
        {selected.length === 0 && (
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
            {multi ? "Select team members..." : "Select person..."}
          </span>
        )}
        {selected.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{
              fontSize: "10px",
              fontWeight: 500,
              background: "rgba(var(--champ-rgb), 0.12)",
              color: "var(--champagne)",
              border: "1px solid rgba(var(--champ-rgb), 0.25)",
            }}
          >
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: u.avatarColor ?? "var(--champagne)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "7px",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initials(u.name)}
            </span>
            {u.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(u.id);
              }}
              className="ml-0.5"
              style={{ color: "var(--text-3)" }}
            >
              <X size={10} strokeWidth={2} />
            </button>
          </span>
        ))}
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className="ml-auto"
          style={{
            color: "var(--text-3)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.15s ease",
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-mid)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {available.length === 0 && selected.length === users.length && (
            <p
              className="px-3 py-2"
              style={{ fontSize: "11px", color: "var(--text-3)" }}
            >
              {users.length === 0 ? "No team members" : "Everyone selected"}
            </p>
          )}
          {users.map((u) => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors duration-100"
                style={{
                  fontSize: "12px",
                  color: isSelected ? "var(--champagne)" : "var(--text-2)",
                  background: isSelected
                    ? "rgba(var(--champ-rgb), 0.08)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: u.avatarColor ?? "var(--champagne)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "8px",
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initials(u.name)}
                </span>
                {u.name}
                {isSelected && (
                  <span className="ml-auto text-[9px]" style={{ color: "var(--champagne)" }}>
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
