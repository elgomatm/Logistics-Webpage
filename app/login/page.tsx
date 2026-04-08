"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#060606] flex flex-col items-center justify-center relative overflow-hidden">

      {/* ── Blueprint grid background ─────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Ambient center glow ───────────────────────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "800px",
          height: "500px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.025) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* ── Login card ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center w-full max-w-[420px] px-8"
      >
        {/* TEN Logo — mix-blend-mode:screen makes black transparent */}
        <div className="mb-8 w-48 select-none">
          <Image
            src="/ten-logo.png"
            alt="The Exotics Network"
            width={480}
            height={206}
            priority
            style={{ mixBlendMode: "screen", width: "100%", height: "auto" }}
          />
        </div>

        {/* App name + tagline */}
        <div className="text-center mb-10 space-y-3">
          <h1
            className="font-bebas tracking-[0.18em] leading-none text-white/90"
            style={{ fontSize: "clamp(28px, 5vw, 38px)" }}
          >
            Document Studio
          </h1>
          <p className="text-[11px] tracking-[0.2em] uppercase text-white/30">
            The Exotics Network — Internal Platform
          </p>
        </div>

        {/* Login card surface */}
        <div
          className="w-full border border-white/[0.08] p-8 space-y-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="space-y-1.5">
            <p className="text-[13px] text-white/60 leading-relaxed">
              Sign in with your TEN Microsoft account to access reports, guides, and automations.
            </p>
            <p className="text-[10px] text-white/25 leading-relaxed">
              Your session will be remembered for 30 days.
            </p>
          </div>

          {/* Microsoft sign-in button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-5 transition-all duration-300"
            style={{
              background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)",
              color: "#060606",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {/* Microsoft logo mark */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 21 21"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: loading ? 0.4 : 1 }}
            >
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span
              className="text-[12px] tracking-[0.14em] uppercase font-semibold"
              style={{ color: loading ? "rgba(255,255,255,0.4)" : "#060606" }}
            >
              {loading ? "Redirecting…" : "Sign in with Microsoft"}
            </span>
          </button>

          {/* Loading bar */}
          {loading && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-px bg-white/25 origin-left"
            />
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/18">
              Secured by Microsoft
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <p className="text-[9px] text-white/18 text-center leading-relaxed">
            Access is restricted to TEN organization accounts.
            Contact your administrator if you need access.
          </p>
        </div>

        {/* Footer label */}
        <p className="mt-8 text-[8px] tracking-[0.22em] uppercase text-white/15">
          © {new Date().getFullYear()} The Exotics Network
        </p>
      </motion.div>
    </div>
  );
}
