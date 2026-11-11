import type { ReactElement } from "react";

/** iOS only: Android and web have no system tab bar to minimize. */
export default function TabScrollMarker({
  children,
}: {
  children: ReactElement;
}) {
  return children;
}
