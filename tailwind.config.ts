import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FFFFFF",
          surface: "#F8FAFC",
          card: "#FFFFFF",
          "card-hover": "#F1F5F9",
          border: "#E2E8F0",
          "border-light": "#CBD5E1",
          primary: "#00BCD4",
          "primary-dark": "#0097A7",
          secondary: "#1976D2",
          accent: "#00BCD4",
          text: "#0F172A",
          body: "#334155",
          dim: "#64748B",
          muted: "#94A3B8",
          light: "#CBD5E1",
        },
        status: {
          new: "#00BCD4",
          contacted: "#2196F3",
          qualified: "#0097A7",
          "site-visit": "#F59E0B",
          negotiation: "#7C4DFF",
          won: "#16A34A",
          lost: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "soft": "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        "card": "0 4px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.05)",
        "elevated": "0 10px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)",
        "glow": "0 0 30px rgba(0,188,212,0.15)",
        "glow-strong": "0 0 40px rgba(0,188,212,0.25)",
        "glow-blue": "0 0 30px rgba(25,118,210,0.15)",
        "inner-soft": "inset 0 2px 4px rgba(0,0,0,0.06)",
      },
      animation: {
        "fade-in": "fade-in 0.6s ease-out",
        "slide-up": "slide-up 0.6s ease-out",
        "slide-in-right": "slide-in-right 0.35s ease-out",
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "shimmer": "shimmer 2s linear infinite",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,188,212,0.08)" },
          "50%": { boxShadow: "0 0 30px rgba(0,188,212,0.18)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
