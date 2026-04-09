"use client";

import Image from "next/image";

export default function WorkspaceHeader() {
  return (
    <section className="relative pt-24 pb-10 px-6 md:px-14 max-w-[1360px] mx-auto">

      {/* Title row — CSS fade-up, no Framer */}
      <div className="flex flex-col items-center text-center anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-center" style={{ gap: "clamp(10px, 1.2vw, 17px)" }}>
          {/* TEN logo */}
          <Image
            src="/ten-logo.png"
            alt="TEN"
            width={160}
            height={56}
            className="object-contain select-none shrink-0"
            style={{
              height: "clamp(32px, 3.97vw, 58px)",
              width:  "auto",
              filter:  "brightness(0)",
              opacity: 0.85,
              transform: "translateY(-3px)",
            }}
            priority
          />
          <h1
            className="font-bebas tracking-[0.12em] leading-none select-none"
            style={{ fontSize: "clamp(52px, 6vw, 88px)", color: "var(--text-1)" }}
          >
            Document Studio
          </h1>
        </div>
      </div>

      {/* Tapered divider — CSS fade-in with slight delay */}
      <div
        className="rule-tapered mt-8 anim-fade-in"
        style={{ animationDelay: "0.3s" }}
      />
    </section>
  );
}
