// The Web keeps display and model-key settings inside the settings page's tabs.
import { Redirect } from "expo-router";

export default function Preferences() {
  return <Redirect href="/settings?tab=preferences" />;
}
