import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bebas: ['"Bebas Neue"', "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        accent: "#ffffff",
        "accent-dim": "rgba(255, 255, 255, 0.08)",
        surface: "rgba(255, 255, 255, 0.025)",
        "surface-hover": "rgba(255, 255, 255, 0.045)",
        border: "rgba(255, 255, 255, 0.07)",
        "border-bright": "rgba(255, 255, 255, 0.14)",
        gold: "#C9A96E",
        "gold-dim": "rgba(201, 169, 110, 0.12)",
        "gold-glow": "rgba(201, 169, 110, 0.07)",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "64px 64px",
      },
      animation: {
        "drift-slow": "drift 18s ease-in-out infinite alternate",
        "drift-slow-r": "drift-r 22s ease-in-out infinite alternate",
        "fade-up": "fadeUp 0.7s ease-out forwards",
        "scan": "scan 8s linear infinite",
      },
      keyframes: {
        drift: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "100%": { transform: "translate(40px, -30px) scale(1.08)" },
        },
        "drift-r": {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "100%": { transform: "translate(-50px, 30px) scale(1.12)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
