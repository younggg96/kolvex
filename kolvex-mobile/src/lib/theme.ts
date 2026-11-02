import { useColorScheme } from "react-native";
import { palette } from "./palette";
export { palette } from "./palette";
export function useTheme() {
  return palette[useColorScheme() === "dark" ? "dark" : "light"];
}
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
