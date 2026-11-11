// Points the iOS tab bar at a screen's main scroll view. Each tab screen draws a
// Backdrop before its ScrollView, so UIKit's own lookup misses it and the bar never
// minimizes on scroll; the marker registers the ScrollView with the tab directly.
import type { ReactElement } from "react";
import { ScrollViewMarker } from "react-native-screens/experimental";

export default function TabScrollMarker({
  children,
}: {
  children: ReactElement;
}) {
  return <ScrollViewMarker style={{ flex: 1 }}>{children}</ScrollViewMarker>;
}
