/**
 * CarSchematics — blueprint-style hypercar line drawings that sit
 * behind the module cards. Two cars, white strokes, very low opacity.
 *
 * Car 1: Koenigsegg Jesko-ish  (angular, enormous rear wing, left side)
 * Car 2: Pagani Huayra-ish     (organic curves, quad exhausts, right side)
 */
export default function CarSchematics() {
  const s = "rgba(255,255,255,0.068)"; // primary stroke
  const sm = "rgba(255,255,255,0.042)"; // medium stroke
  const sf = "rgba(255,255,255,0.026)"; // faint stroke
  const sx = "rgba(255,255,255,0.014)"; // extra faint

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      {/* ── Blueprint grid ─────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `linear-gradient(${sx} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${sx} 1px, transparent 1px)`,
          ].join(", "),
          backgroundSize: "60px 60px",
        }}
      />

      {/* Slightly larger accent grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `linear-gradient(rgba(255,255,255,0.008) 1px, transparent 1px)`,
            `linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)`,
          ].join(", "),
          backgroundSize: "240px 240px",
        }}
      />

      {/* ── Car 1: Koenigsegg Jesko-ish ──────────────────────────
          Side view facing right. Ground at y=265.
          Front wheel: cx=155, cy=213, r=52.
          Rear wheel:  cx=745, cy=213, r=52.
          Viewbox: 980 × 295.
          Positioned: bottom-left, large, partially crops off edge.
      ────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{ bottom: "-28px", left: "-55px", width: "1080px" }}
      >
        <svg
          viewBox="0 0 980 295"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          fill="none"
        >
          {/* Ground line */}
          <line x1="0" y1="265" x2="980" y2="265" stroke={sf} strokeWidth="1" />

          {/* ── Main body outline ── */}
          <path
            d={`
              M 15,263
              L 24,238
              L 60,202
              L 98,178
              Q 128,163 155,162
              Q 184,163 215,178
              L 258,157
              L 294,122
              L 352,108
              L 428,99
              L 462,92
              L 488,66
              L 524,44
              L 572,38
              L 618,51
              L 644,71
              L 655,28
              L 702,20
              L 750,20
              L 769,37
              L 751,52
              L 660,73
              L 681,91
              L 672,178
              Q 708,163 745,162
              Q 780,163 812,178
              L 848,196
              L 886,218
              L 944,250
              L 944,263
              Z
            `}
            stroke={s}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* ── Wing solid fill (very faint) ── */}
          <path
            d="M 655,28 L 702,20 L 750,20 L 769,37 L 751,52 L 660,73 Z"
            fill="rgba(255,255,255,0.018)"
            stroke={sm}
            strokeWidth="1"
          />

          {/* ── Windscreen glass ── */}
          <path
            d="M 488,66 L 524,44 L 572,38 L 618,51 L 644,71 Z"
            fill="rgba(255,255,255,0.012)"
            stroke={sf}
            strokeWidth="0.8"
          />

          {/* ── Door cut line ── */}
          <path
            d="M 460,92 L 490,66 L 570,78 L 560,95"
            stroke={sf}
            strokeWidth="0.8"
            strokeDasharray="4,3"
          />

          {/* ── Rear air intake ── */}
          <path
            d="M 636,70 L 654,60 L 676,65 L 666,78 Z"
            fill="rgba(255,255,255,0.015)"
            stroke={sf}
            strokeWidth="0.8"
          />

          {/* ── Front wheel ── */}
          <circle cx="155" cy="213" r="52" stroke={s} strokeWidth="1.5" />
          <circle cx="155" cy="213" r="34" stroke={sm} strokeWidth="1" />
          <circle cx="155" cy="213" r="4" stroke={sm} fill="rgba(255,255,255,0.05)" strokeWidth="0.8" />
          {/* Spokes */}
          <line x1="155" y1="161" x2="155" y2="265" stroke={sf} strokeWidth="0.8" />
          <line x1="103" y1="213" x2="207" y2="213" stroke={sf} strokeWidth="0.8" />
          <line x1="118" y1="176" x2="192" y2="250" stroke={sf} strokeWidth="0.6" />
          <line x1="118" y1="250" x2="192" y2="176" stroke={sf} strokeWidth="0.6" />

          {/* ── Rear wheel ── */}
          <circle cx="745" cy="213" r="52" stroke={s} strokeWidth="1.5" />
          <circle cx="745" cy="213" r="34" stroke={sm} strokeWidth="1" />
          <circle cx="745" cy="213" r="4" stroke={sm} fill="rgba(255,255,255,0.05)" strokeWidth="0.8" />
          <line x1="745" y1="161" x2="745" y2="265" stroke={sf} strokeWidth="0.8" />
          <line x1="693" y1="213" x2="797" y2="213" stroke={sf} strokeWidth="0.8" />
          <line x1="708" y1="176" x2="782" y2="250" stroke={sf} strokeWidth="0.6" />
          <line x1="708" y1="250" x2="782" y2="176" stroke={sf} strokeWidth="0.6" />

          {/* ── Technical annotations ── */}
          {/* Vehicle centerline (dashed) */}
          <line
            x1="50" y1="188" x2="920" y2="188"
            stroke={sx} strokeWidth="0.7" strokeDasharray="12,6"
          />

          {/* Wheelbase dimension */}
          <line x1="155" y1="278" x2="745" y2="278" stroke={sf} strokeWidth="0.8" />
          <line x1="155" y1="273" x2="155" y2="283" stroke={sf} strokeWidth="0.8" />
          <line x1="745" y1="273" x2="745" y2="283" stroke={sf} strokeWidth="0.8" />

          {/* Overall length */}
          <line x1="15" y1="288" x2="944" y2="288" stroke={sx} strokeWidth="0.6" />
          <line x1="15" y1="283" x2="15" y2="293" stroke={sx} strokeWidth="0.6" />
          <line x1="944" y1="283" x2="944" y2="293" stroke={sx} strokeWidth="0.6" />

          {/* Roof height annotation */}
          <line x1="956" y1="38" x2="956" y2="265" stroke={sx} strokeWidth="0.6" />
          <line x1="951" y1="38" x2="961" y2="38" stroke={sx} strokeWidth="0.6" />
          <line x1="951" y1="265" x2="961" y2="265" stroke={sx} strokeWidth="0.6" />

          {/* Corner registration marks (blueprint style) */}
          <g stroke={sx} strokeWidth="0.7">
            <line x1="0" y1="12" x2="22" y2="12" /><line x1="12" y1="0" x2="12" y2="22" />
            <line x1="958" y1="12" x2="980" y2="12" /><line x1="968" y1="0" x2="968" y2="22" />
          </g>
        </svg>
      </div>

      {/* ── Car 2: Pagani Huayra-ish ──────────────────────────────
          More organic curves. Ground at y=222.
          Front wheel: cx=128, cy=178, r=44.
          Rear wheel:  cx=644, cy=178, r=44.
          Viewbox: 840 × 245.
          Positioned: bottom-right, smaller, lower opacity.
      ────────────────────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{ bottom: "10px", right: "-45px", width: "680px", opacity: 0.72 }}
      >
        <svg
          viewBox="0 0 840 245"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          fill="none"
        >
          {/* Ground line */}
          <line x1="0" y1="222" x2="840" y2="222" stroke={sf} strokeWidth="1" />

          {/* ── Main body (more organic curves) ── */}
          <path
            d={`
              M 10,220
              L 20,196
              L 52,168
              L 84,150
              C 106,140 118,137 128,136
              C 138,137 150,140 172,150
              L 212,142
              L 246,114
              L 294,104
              L 378,98
              L 414,94
              C 440,86 460,72 478,60
              C 498,48 524,42 552,40
              C 578,40 600,46 618,59
              L 634,74
              L 628,54
              C 646,46 664,44 674,54
              L 680,68
              L 650,76
              L 648,100
              L 600,150
              C 622,140 634,137 644,136
              C 654,137 666,140 688,150
              L 718,162
              L 748,182
              L 792,210
              L 828,220
              L 828,222
              L 10,222
              Z
            `}
            stroke={s}
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* ── Windscreen (organic curved shape) ── */}
          <path
            d="M 478,60 C 498,48 524,42 552,40 C 578,40 600,46 618,59 L 634,74 L 618,78 C 600,68 578,64 552,65 C 524,65 502,70 488,78 Z"
            fill="rgba(255,255,255,0.014)"
            stroke={sf}
            strokeWidth="0.8"
          />

          {/* ── Roof panel ── */}
          <path
            d="M 488,78 C 502,70 524,65 552,65 C 578,64 600,68 618,78 L 634,74 L 650,76 L 648,100 L 600,150 L 560,130 C 540,120 520,118 500,120 L 468,130 L 450,100 Z"
            fill="rgba(255,255,255,0.01)"
            stroke={sf}
            strokeWidth="0.8"
          />

          {/* ── Rear fin/small wing ── */}
          <path
            d="M 628,54 C 646,46 664,44 674,54 L 680,68 L 650,76 L 628,54 Z"
            fill="rgba(255,255,255,0.016)"
            stroke={sm}
            strokeWidth="0.9"
          />

          {/* ── Front wheel ── */}
          <circle cx="128" cy="178" r="44" stroke={s} strokeWidth="1.4" />
          <circle cx="128" cy="178" r="28" stroke={sm} strokeWidth="0.9" />
          <circle cx="128" cy="178" r="3.5" stroke={sm} fill="rgba(255,255,255,0.05)" strokeWidth="0.7" />
          <line x1="128" y1="134" x2="128" y2="222" stroke={sf} strokeWidth="0.7" />
          <line x1="84" y1="178" x2="172" y2="178" stroke={sf} strokeWidth="0.7" />
          <line x1="97" y1="147" x2="159" y2="209" stroke={sf} strokeWidth="0.55" />
          <line x1="97" y1="209" x2="159" y2="147" stroke={sf} strokeWidth="0.55" />

          {/* ── Rear wheel ── */}
          <circle cx="644" cy="178" r="44" stroke={s} strokeWidth="1.4" />
          <circle cx="644" cy="178" r="28" stroke={sm} strokeWidth="0.9" />
          <circle cx="644" cy="178" r="3.5" stroke={sm} fill="rgba(255,255,255,0.05)" strokeWidth="0.7" />
          <line x1="644" y1="134" x2="644" y2="222" stroke={sf} strokeWidth="0.7" />
          <line x1="600" y1="178" x2="688" y2="178" stroke={sf} strokeWidth="0.7" />
          <line x1="613" y1="147" x2="675" y2="209" stroke={sf} strokeWidth="0.55" />
          <line x1="613" y1="209" x2="675" y2="147" stroke={sf} strokeWidth="0.55" />

          {/* ── Pagani signature: quad exhausts ── */}
          <circle cx="800" cy="196" r="4.5" stroke={sm} strokeWidth="0.9" />
          <circle cx="812" cy="196" r="4.5" stroke={sm} strokeWidth="0.9" />
          <circle cx="800" cy="208" r="4.5" stroke={sm} strokeWidth="0.9" />
          <circle cx="812" cy="208" r="4.5" stroke={sm} strokeWidth="0.9" />

          {/* ── Centerline ── */}
          <line
            x1="30" y1="155" x2="810" y2="155"
            stroke={sx} strokeWidth="0.6" strokeDasharray="10,5"
          />

          {/* Wheelbase dimension */}
          <line x1="128" y1="232" x2="644" y2="232" stroke={sf} strokeWidth="0.7" />
          <line x1="128" y1="228" x2="128" y2="236" stroke={sf} strokeWidth="0.7" />
          <line x1="644" y1="228" x2="644" y2="236" stroke={sf} strokeWidth="0.7" />
        </svg>
      </div>
    </div>
  );
}
