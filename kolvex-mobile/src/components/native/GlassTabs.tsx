// Native Liquid Glass tabs exist on iOS only; other platforms keep the React Native track.
export type GlassTabsProps = {
  values: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  stretch?: boolean;
  disabled?: boolean;
  /** The widest the track may grow before it scrolls; defaults to the page width. */
  maxWidth?: number;
};
export const glassTabsAvailable = false;
export default function GlassTabs(_props: GlassTabsProps) {
  return null;
}
