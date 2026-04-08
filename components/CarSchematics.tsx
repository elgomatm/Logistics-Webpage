"use client";

/**
 * CarSchematics — real blueprint photography pinned to the left and right
 * flanks of the page. Each image is masked so it fully fades before reaching
 * the center content area, keeping text perfectly readable while the edges
 * feel dramatic and car-themed.
 *
 * No CSS grid — one visual system only.
 */
export default function CarSchematics() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      {/* ── LEFT blueprint ────────────────────────────────────────
          Anchored bottom-left. Fades to nothing by 55% from the left,
          so it never reaches the center column.
      ──────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{
          bottom: 0,
          left: 0,
          width: "54vw",
          maxWidth: "860px",
          // screen blend: black in photo = transparent, only white lines show
          mixBlendMode: "screen",
          opacity: 0.38,
          // Mask: fully visible on far left, gone by 72% across
          WebkitMaskImage:
            "linear-gradient(to right, black 0%, black 28%, transparent 72%)",
          maskImage:
            "linear-gradient(to right, black 0%, black 28%, transparent 72%)",
          // Also fade the bottom edge slightly
          WebkitMaskComposite: "source-in",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blueprint-1.jpg"
          alt=""
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* ── RIGHT blueprint ───────────────────────────────────────
          Anchored bottom-right. Fades to nothing by 55% from the right.
      ──────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{
          bottom: 0,
          right: 0,
          width: "54vw",
          maxWidth: "860px",
          mixBlendMode: "screen",
          opacity: 0.32,
          WebkitMaskImage:
            "linear-gradient(to left, black 0%, black 28%, transparent 72%)",
          maskImage:
            "linear-gradient(to left, black 0%, black 28%, transparent 72%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blueprint-2.jpg"
          alt=""
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* ── Bottom fade — grounds both images into the page ───── */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "35%",
          background:
            "linear-gradient(to top, #060606 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
