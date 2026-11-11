import { View, type ViewStyle } from "react-native";
import { Glass, Skeleton, styles } from "./UI";

/**
 * Skeleton vocabulary built from the same primitives the screens use (Glass cards,
 * Copy lines, 44pt buttons), so a placeholder occupies the space of what replaces it.
 */

/** One Copy line: the box is the text's line height (size × 1.45), the bar sits inside it. */
export type Line = {
  size?: number;
  width?: ViewStyle["width"];
  lines?: number;
};

export function TextLine({ size = 16, width = "100%" }: Line) {
  return (
    <View style={{ height: size * 1.45, justifyContent: "center" }}>
      <Skeleton width={width} height={Math.round(size * 0.8)} radius={6} />
    </View>
  );
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.flatMap((line, i) =>
        Array.from({ length: line.lines ?? 1 }, (_, j) => (
          <TextLine
            key={`${i}-${j}`}
            size={line.size}
            width={j === (line.lines ?? 1) - 1 ? line.width : "100%"}
          />
        )),
      )}
    </>
  );
}

/** A 44pt pill button, as `Button` renders. */
export function ButtonSkeleton({
  width = 120,
}: {
  width?: ViewStyle["width"];
}) {
  return <Skeleton width={width} height={44} radius={24} />;
}

/**
 * `count` Glass cards, each with the given Copy lines and optional trailing buttons.
 * Defaults match the common card: padding 20, gap 12.
 */
export function CardsSkeleton({
  count = 3,
  lines,
  buttons = 0,
  padding = 20,
  gap = 12,
  chartHeight,
}: {
  count?: number;
  lines: Line[];
  buttons?: number;
  padding?: number;
  gap?: number;
  /** Cards that end in a chart (macro indicators, opinion distribution). */
  chartHeight?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Glass key={i} style={{ padding, gap }}>
          <Lines
            lines={lines.map((line, k) =>
              k === 0 && line.width === undefined
                ? { ...line, width: i % 2 ? "55%" : "70%" }
                : line,
            )}
          />
          {chartHeight !== undefined && <ChartSkeleton height={chartHeight} />}
          {buttons > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: buttons }, (_, b) => (
                <ButtonSkeleton key={b} width={b ? 96 : 120} />
              ))}
            </View>
          )}
        </Glass>
      ))}
    </>
  );
}

/** Long-form text (reports, chat answers): a heading and paragraphs. */
export function ArticleSkeleton({ paragraphs = 3 }: { paragraphs?: number }) {
  return (
    <View style={{ gap: 16 }}>
      <TextLine size={24} width="70%" />
      {Array.from({ length: paragraphs }, (_, i) => (
        <View key={i} style={{ gap: 0 }}>
          <Lines
            lines={[{ size: 16, lines: 4, width: i % 2 ? "45%" : "65%" }]}
          />
        </View>
      ))}
    </View>
  );
}

/** A chart area of the given height inside its card. */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return <Skeleton height={height} radius={16} />;
}

/** QuoteRow: symbol + company on the start side, price + change on the end side. */
export function QuoteRowsSkeleton({
  count = 5,
  withButton = false,
}: {
  count?: number;
  withButton?: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Glass>
            <View style={{ padding: 16 }}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <TextLine size={18} width={64} />
                  <TextLine size={12} width={i % 2 ? "45%" : "60%"} />
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <TextLine size={16} width={64} />
                  <TextLine size={14} width={48} />
                </View>
              </View>
            </View>
          </Glass>
          {withButton && <ButtonSkeleton width="100%" />}
        </View>
      ))}
    </>
  );
}

/** Search result rows: title + detail, hairline-separated. */
export function ResultRowsSkeleton({
  count = 4,
  trailing = false,
}: {
  count?: number;
  trailing?: boolean;
}) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <TextLine size={16} width={i % 2 ? "50%" : "65%"} />
            <TextLine size={14} width="30%" />
          </View>
          {trailing && <Skeleton width={44} height={44} radius={22} />}
        </View>
      ))}
    </View>
  );
}

/** Labelled form fields followed by a submit button. */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <View style={{ gap: 16 }}>
      {Array.from({ length: fields }, (_, i) => (
        <View key={i} style={{ gap: 8 }}>
          <TextLine size={14} width={80} />
          <Skeleton height={48} radius={16} />
        </View>
      ))}
      <ButtonSkeleton width="100%" />
    </View>
  );
}

/** A horizontal row of Filters / Chip pills. */
export function ChipsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={i ? 64 : 80} height={36} radius={18} />
      ))}
    </View>
  );
}

/** A wrapping row of 44pt buttons (date pickers, action bars). */
export function ButtonsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <ButtonSkeleton key={i} width={i % 3 ? 88 : 112} />
      ))}
    </View>
  );
}

/** A chart inside its Glass card (padding 12), as the K-line screen renders. */
export function ChartCardSkeleton({ height = 260 }: { height?: number }) {
  return (
    <Glass style={{ padding: 12, gap: 12 }}>
      <ChartSkeleton height={height} />
    </Glass>
  );
}
