import { View, type ViewProps } from "react-native";
/** Mirrors the iOS glass variants; other platforms have no native glass. */
export type SwiftGlassVariant = "clear" | "regular";
export default function SwiftGlass({
  variant: _variant,
  ...props
}: ViewProps & { variant?: SwiftGlassVariant }) {
  return <View {...props} />;
}
