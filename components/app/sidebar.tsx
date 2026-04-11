"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  KanbanSquare,
  List,
  CalendarDays,
  FileText,
  BookOpen,
  Settings,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Logistics", href: "/logistics", icon: Boxes },
    ],
  },
  {
    heading: "Tasks",
    items: [
      { label: "Board", href: "/tasks/board", icon: KanbanSquare },
      { label: "List", href: "/tasks", icon: List },
    ],
  },
  {
    heading: "Events",
    items: [
      { label: "All Events", href: "/events", icon: CalendarDays },
    ],
  },
  {
    heading: "Documents",
    items: [
      { label: "Reports", href: "/reports", icon: FileText },
      { label: "Guides", href: "/guides", icon: BookOpen },
    ],
  },
  {
    items: [
      { label: "Settings", href: "/settings/users", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-16 left-0 bottom-0 w-[220px] overflow-y-auto z-30"
      style={{
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <nav className="py-4 px-3 flex flex-col gap-1">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p
                className="px-3 pt-5 pb-1.5"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  color: "var(--text-3)",
                }}
              >
                {section.heading}
              </p>
            )}
            {!section.heading && si > 0 && (
              <div
                className="my-2 mx-3"
                style={{ height: "1px", background: "var(--border)" }}
              />
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/logistics" &&
                  pathname.startsWith(item.href + "/"));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150"
                  style={{
                    fontSize: "13px",
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--champagne)" : "var(--text-2)",
                    background: isActive
                      ? "rgba(var(--champ-rgb), 0.06)"
                      : "transparent",
                  }}
                >
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{
                      color: isActive ? "var(--champagne)" : "var(--text-3)",
                      flexShrink: 0,
                    }}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
