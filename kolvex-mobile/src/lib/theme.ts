import { useColorScheme } from "react-native";
export const palette = {
  light: {
    background: "#F4F6F5",
    surface: "#FFFFFF",
    text: "#14251D",
    secondary: "#64736A",
    border: "#DFE6E1",
    accent: "#007D35",
    tint: "#E6F4EA",
    negative: "#C44127",
  },
  dark: {
    background: "#0B100E",
    surface: "#151E19",
    text: "#F2F8F4",
    secondary: "#A0B1A6",
    border: "#2A3A30",
    accent: "#5AE88D",
    tint: "#173724",
    negative: "#FF987F",
  },
};
export function useTheme() {
  return palette[useColorScheme() === "dark" ? "dark" : "light"];
}
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
