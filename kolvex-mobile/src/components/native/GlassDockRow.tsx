// The dock's tab row in SwiftUI exists on iOS only; other platforms keep React Native buttons.
export type GlassDockItem = {
  key: string;
  label: string;
  /** SF Symbol name. */
  symbol: string;
  highlighted: boolean;
  selected?: boolean;
  expanded?: boolean;
};
export type GlassDockRowProps = {
  items: GlassDockItem[];
  onPress: (key: string) => void;
};
export const glassDockAvailable = false;
export default function GlassDockRow(_props: GlassDockRowProps) {
  return null;
}
