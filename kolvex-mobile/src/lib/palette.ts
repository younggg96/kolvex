// Native adapter of kolvex-frontend-web-nextjs/app/globals.css.
// Keep semantic roles distinct; tests/theme-parity.test.ts checks the source contract.
export const palette = {
  light: {
    dark: false,
    background: "#F7FAF6",
    surface: "#FFFFFF",
    text: "#0F172A",
    secondary: "#64748B",
    // Muted text on tint fills (Web --muted-on-tint); secondary alone misses AA there.
    secondaryOnTint: "#475569",
    border: "#E2EAE1",
    brand: "#16A34A",
    accent: "#166534",
    // Neutral fill: Web --muted. Web --secondary became a green selection wash in light mode.
    tint: "#F3F8F2",
    negative: "#B42332",
    chartUp: "#16A34A",
    chartDown: "#E5484D",
    // Glass tokens from the Web's globals.css (--glass-rim, --card-glass, bg-foreground/x).
    rim: "rgba(15,23,42,0.1)",
    card: "#FFFFFF",
    wash: "rgba(15,23,42,0.08)",
    washStrong: "rgba(15,23,42,0.14)",
    field: "rgba(15,23,42,0.06)",
    onBrand: "#000000",
  },
  dark: {
    dark: true,
    background: "#000000",
    surface: "#0E0F10",
    text: "#FFFFFF",
    secondary: "#9BA0A6",
    secondaryOnTint: "#9BA0A6",
    border: "#282A2D",
    brand: "#00C805",
    accent: "#00C805",
    tint: "#1E2022",
    negative: "#FF5000",
    chartUp: "#00C807",
    chartDown: "#FF5100",
    rim: "rgba(255,255,255,0.13)",
    card: "rgba(0,0,0,0.4)",
    wash: "rgba(255,255,255,0.08)",
    washStrong: "rgba(255,255,255,0.14)",
    field: "rgba(255,255,255,0.06)",
    onBrand: "#000000",
  },
} as const;
