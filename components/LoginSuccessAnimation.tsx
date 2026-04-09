"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Welcome-back splash — 100% CSS keyframe animations.
 * No Framer Motion, no JS per frame, no layout jank.
 * GPU compositor handles every transition.
 */
export default function LoginSuccessAnimation() {
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<"hidden" | "show" | "exit">("hidden");

  useEffect(() => {
    if (status !== "authenticated") return;
    const key = "ten_login_welcomed";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    setPhase("show");

    // Begin CSS exit animation at 3.1 s
    const exitTimer = setTimeout(() => setPhase("exit"), 3100);
    // Fully unmount after exit animation finishes (0.55 s)
    const hideTimer = setTimeout(() => setPhase("hidden"), 3700);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [status]);

  if (phase === "hidden") return null;

  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div className={`ten-welcome${phase === "exit" ? " exiting" : ""}`}>
      {/* Dark overlay — fades out via CSS */}
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
