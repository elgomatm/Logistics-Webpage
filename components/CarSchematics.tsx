"use client";

/**
 * CarSchematics — real hypercar blueprint photography blended into
 * the dark background using mix-blend-mode: screen (black = transparent).
 */
export default function CarSchematics() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      {/* ── Subtle blueprint grid ─────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "60px 60px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.006) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.006) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "240px 240px",
        }}
      />

      {/* ── Blueprint 1 — bottom left ─────────────────────────── */}
      {/* mix-blend-mode: screen makes the black background vanish,
          leaving only the white technical lines glowing */}
      <div
        className="absolute"
        style={{
          bottom: "-40px",
          left: "-60px",
          width: "820px",
          opacity: 0.28,
          mixBlendMode: "screen",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blueprint-1.jpg"
          alt=""
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* ── Blueprint 2 — bottom right ────────────────────────── */}
      <div
        className="absolute"
        style={{
          bottom: "-30px",
          right: "-80px",
          width: "700px",
          opacity: 0.22,
          mixBlendMode: "screen",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/blueprint-2.jpg"
          alt=""
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      {/* ── Edge vignette — fades images into the background ──── */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse at 50% 110%, transparent 40%, #060606 80%)",
            "linear-gradient(to right, #060606 0%, transparent 18%, transparent 82%, #060606 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
