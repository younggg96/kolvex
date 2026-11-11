import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTheme } from "../../../lib/theme";

// No anchor: pages open from the ··· sheet, so none sits on top of a More page.

const SHEET_ROOTS = [
  "watchlist",
  "briefs",
  "news",
  "research",
  "workspaces",
  "settings",
  "superinvestors",
  "congress-trades",
  "options-activity",
  "paper-trading",
  "admin",
  // Detail pages that draw their own back link in the page header.
  "brief/[id]",
  "workspace/[id]",
] as const;

export default function MoreLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: Platform.OS === "ios",
        headerTintColor: t.text,
        headerTitle: "",
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: t.background },
      }}
    >
      <Stack.Screen name="more" options={{ headerShown: false }} />
      {/* Destinations of the ··· sheet: each opens as a page of its own, with no back button. */}
      {SHEET_ROOTS.map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
    </Stack>
  );
}
