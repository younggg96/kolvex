import { Stack } from "expo-router";
import { useTheme } from "../../../lib/theme";

export default function SearchLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTitle: "",
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: t.text,
        contentStyle: { backgroundColor: t.background },
      }}
    />
  );
}
