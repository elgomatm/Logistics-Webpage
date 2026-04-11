"use client";

import Link from "next/link";
import UserMenu from "./user-menu";

export default function AppNavbar() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav anim-fade-in">
        <div className="relative max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left: Logo / wordmark */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <span
              className="font-bebas text-[22px] tracking-[0.12em] leading-none"
              style={{ color: "var(--champagne)" }}
            >
              TEN
            </span>
            <span
              className="text-[11px] tracking-[0.18em] uppercase font-semibold leading-none hidden sm:block"
              style={{ color: "var(--text-2)" }}
            >
              Operations
            </span>
          </Link>

          {/* Center label */}
          <span
            className="absolute left-1/2 -translate-x-1/2 text-[9px] tracking-[0.28em] uppercase font-medium hidden md:block pointer-events-none select-none"
            style={{ color: "var(--text-3)" }}
          >
            The Exotics Network
          </span>

          {/* Right: User menu */}
          <UserMenu />
        </div>
      </nav>

      {/* Subtle champagne underline */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          top: "63px",
          left: 0,
          right: 0,
          height: "2px",
          zIndex: 49,
          background:
            "radial-gradient(ellipse 55% 100% at 50% 0%, rgba(var(--champ-rgb),0.4) 0%, transparent 100%)",
        }}
      />
    </>
  );
}
