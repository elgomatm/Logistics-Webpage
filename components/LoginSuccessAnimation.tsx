"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useSession } from "next-auth/react";

// useLayoutEffect on client (fires before paint), useEffect on server (SSR no-op)
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Welcome-back splash.
 *
 * Anti-FOUC pattern:
 *   1. Inline <script> in layout.tsx sets data-welcome="1" on <html> before first paint.
 *   2. CSS rule covers the page with solid #090909 from frame 0 — user never sees
 *      the page flash in before the overlay.
 *   3. useLayoutEffect (client, before repaint) removes data-welcome and mounts
 *      this component's own overlay atomically — no gap, no flash.
 *   4. Decorative elements (rings, logo, text) animate in via CSS keyframes.
 *   5. Whole wrapper fades out at 3.1 s, unmounts at 3.7 s.
 */
export default function LoginSuccessAnimation() {
  const { data: session } = useSession();
  const [phase, setPhase] = useState<"hidden" | "show" | "exit">("hidden");

  useIsomorphicLayoutEffect(() => {
    // Always remove the inline-script blocker — component takes over (or reveals page)
    document.documentElement.removeAttribute("data-welcome");

    const key = "ten_login_welcomed";
    if (sessionStorage.getItem(key)) return; // already shown this session
    sessionStorage.setItem(key, "1");

    setPhase("show");

    const exitTimer = setTimeout(() => setPhase("exit"), 3100);
    const hideTimer = setTimeout(() => setPhase("hidden"), 3700);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div className={`ten-welcome${phase === "exit" ? " exiting" : ""}`}>
      {/* Solid dark overlay — matches body::before so handoff is seamless */}
      <div className="ten-welcome__overlay" />

      <div className="ten-welcome__content">
        {/* Expanding rings */}
        <div className="ten-welcome__ring ten-welcome__ring--a" />
        <div className="ten-welcome__ring ten-welcome__ring--b" />

        {/* TEN wordmark */}
        <div className="ten-welcome__logo">TEN</div>

        {/* Welcome line */}
        <p className="ten-welcome__text">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </p>

        {/* Gold rule */}
        <div className="ten-welcome__rule" />
      </div>
    </div>
  );
}
