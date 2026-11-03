// Native adapter of kolvex-frontend-web-nextjs/app/globals.css.
// Keep semantic roles distinct; tests/theme-parity.test.ts checks the source contract.
export const palette = {
  light: {
    dark: false,
    background: "#EBECE9",
    surface: "#F4F5F2",
    text: "#252925",
    secondary: "#5B615A",
    border: "#CFD4CC",
    brand: "#00C805",
    accent: "#007103",
    tint: "#DADDD7",
    negative: "#B4310D",
    chartUp: "#00C807",
    chartDown: "#FF5100",
  },
  dark: {
    dark: true,
    background: "#000000",
    surface: "#0E0F10",
    text: "#FFFFFF",
    secondary: "#9BA0A6",
    border: "#282A2D",
    brand: "#00C805",
    accent: "#00C805",
    tint: "#1E2022",
    negative: "#FF5000",
    chartUp: "#00C807",
    chartDown: "#FF5100",
  },
} as const;
