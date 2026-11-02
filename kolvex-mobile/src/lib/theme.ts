import { useColorScheme } from "react-native";
import { usePreferences } from "../state/Preferences";
import { palette } from "./palette";
export { palette } from "./palette";
export function useTheme() {
  const system = useColorScheme();
  const { theme } = usePreferences();
  return palette[
    theme === "DARK" || (theme === "SYSTEM" && system === "dark")
      ? "dark"
      : "light"
  ];
}
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
