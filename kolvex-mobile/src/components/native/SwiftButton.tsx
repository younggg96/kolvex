import type { PropsWithChildren } from "react";
export type SwiftButtonProps = PropsWithChildren<{
  onPress: () => void;
  selected: boolean;
  disabled: boolean;
  label?: string;
}>;
export const swiftButtonsAvailable = false;
export default function SwiftButton(_props: SwiftButtonProps) {
  return null;
}
