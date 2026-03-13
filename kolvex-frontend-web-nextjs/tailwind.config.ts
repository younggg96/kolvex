import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: "#00C805",
        "primary-foreground": "rgb(var(--primary-foreground) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "secondary-foreground": "rgb(var(--secondary-foreground) / <alpha-value>)",
        destructive: "rgb(var(--destructive) / <alpha-value>)",
        "destructive-foreground": "rgb(var(--destructive-foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        /* Legacy aliases — both map to the same CSS var so dark: prefix is redundant */
        "background-light": "rgb(var(--background) / <alpha-value>)",
        "background-dark": "rgb(var(--background) / <alpha-value>)",
        "card-light": "rgb(var(--card) / <alpha-value>)",
        "card-dark": "rgb(var(--card) / <alpha-value>)",
        "border-light": "rgb(var(--border) / <alpha-value>)",
        "border-dark": "rgb(var(--border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "sans-serif"],
        display: ["var(--font-manrope)", "Manrope", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Sheet slide animations
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-to-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-to-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-out-to-top": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-100%)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-out-to-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.33%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-in-from-right": "slide-in-from-right 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-out-to-right": "slide-out-to-right 0.22s cubic-bezier(0.5, 0, 0.75, 0)",
        "slide-in-from-left": "slide-in-from-left 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-out-to-left": "slide-out-to-left 0.22s cubic-bezier(0.5, 0, 0.75, 0)",
        "slide-in-from-top": "slide-in-from-top 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-out-to-top": "slide-out-to-top 0.22s cubic-bezier(0.5, 0, 0.75, 0)",
        "slide-in-from-bottom": "slide-in-from-bottom 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-out-to-bottom": "slide-out-to-bottom 0.22s cubic-bezier(0.5, 0, 0.75, 0)",
        "fade-in": "fade-in 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
        "fade-out": "fade-out 0.15s cubic-bezier(0.5, 0, 0.75, 0)",
        ticker: "ticker 40s linear infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
