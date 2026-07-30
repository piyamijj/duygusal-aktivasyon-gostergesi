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
        sans: ["var(--font-quicksand)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        sage: {
          50: "#f4f7f5",
          100: "#e5ece8",
          200: "#cbdad1",
          300: "#a3bfb1",
          400: "#769d8b",
          500: "#58816f",
          600: "#436656",
          700: "#375246",
          800: "#2e433a",
          900: "#273831",
          950: "#14201b",
        },
        calm: {
          bg: "#f7f9f8",
          card: "#ffffff",
          text: "#2c3e35",
          accent: "#58816f",
          low: "#436656",
          medium: "#d97706",
          high: "#b91c1c",
        }
      },
      animation: {
        "heartbeat-pulse": "heartbeat 1.5s ease-in-out infinite",
        "breathe": "breathe 6s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "14%": { transform: "scale(1.12)" },
          "28%": { transform: "scale(1)" },
          "42%": { transform: "scale(1.12)" },
          "70%": { transform: "scale(1)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.08)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;