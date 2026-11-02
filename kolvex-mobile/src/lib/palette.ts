// Native adapter of kolvex-frontend-web-nextjs/app/globals.css.
// Keep semantic roles distinct; tests/theme-parity.test.ts checks the source contract.
export const palette = {
  light: {
    dark: false,
    background: "#FAFAF9",
    surface: "#FFFFFF",
    text: "#000000",
    secondary: "#5C5F63",
    border: "#E4E3DF",
    brand: "#00C805",
    accent: "#008503",
    tint: "#EBEBE8",
    negative: "#D63A00",
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
