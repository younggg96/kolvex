import { PixelRatio, Pressable, ScrollView, View } from "react-native";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";
export type TableColumn = {
  key: string;
  label: string;
  note?: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
};
export type TableRow =
  | { group: string }
  | { key: string; label: string; strong?: boolean; cells: string[] };
const isGroup = (row: TableRow): row is { group: string } => "group" in row;
// The label column stays in place while periods or companies scroll beneath it; both
// sides share a font-scaled row height so rows stay aligned under Dynamic Type.
export function DataTable({
  columns,
  rows,
  corner,
  label,
  labelWidth = 136,
  columnWidth = 120,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  corner: string;
  label: string;
  labelWidth?: number;
  columnWidth?: number;
}) {
  const t = useTheme();
  const text = useText();
  const scale = Math.max(1, PixelRatio.getFontScale());
  const rowHeight = Math.round(48 * scale);
  const headerHeight = Math.round(60 * scale);
  const groupHeight = Math.round(32 * scale);
  const heightOf = (row: TableRow) => (isGroup(row) ? groupHeight : rowHeight);
  const edge = { borderBottomWidth: 1, borderColor: t.border };
  return (
    <View
      accessibilityLabel={text(label)}
      style={{
        flexDirection: "row",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: labelWidth,
          borderRightWidth: 1,
          borderColor: t.border,
        }}
      >
        <View
          style={[
            edge,
            {
              height: headerHeight,
              paddingHorizontal: 12,
              justifyContent: "center",
              backgroundColor: t.tint,
            },
          ]}
        >
          <Copy size={12} muted>
            {corner}
          </Copy>
        </View>
        {rows.map((row, index) =>
          isGroup(row) ? (
            <View
              key={`group-${row.group}`}
              style={[
                edge,
                {
                  height: groupHeight,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                  backgroundColor: t.tint,
                },
              ]}
            >
              <Copy size={12} bold lines={1}>
                {row.group}
              </Copy>
            </View>
          ) : (
            <View
              key={row.key}
              style={[
                index < rows.length - 1 ? edge : null,
                {
                  height: rowHeight,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                },
              ]}
            >
              <Copy size={13} bold={row.strong} lines={2}>
                {row.label}
              </Copy>
            </View>
          ),
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
        <View>
          <View style={{ flexDirection: "row" }}>
            {columns.map((column) => {
              const body = (
                <>
                  <Copy
                    size={12}
                    bold
                    lines={1}
                    color={column.onPress ? t.accent : t.text}
                    localize={false}
                  >
                    {column.label}
                  </Copy>
                  {!!column.note && (
                    <Copy size={11} muted lines={1} localize={false}>
                      {column.note}
                    </Copy>
                  )}
                  {column.accessory}
                </>
              );
              const style = [
                edge,
                {
                  width: columnWidth,
                  height: headerHeight,
                  paddingHorizontal: 12,
                  justifyContent: "center" as const,
                  alignItems: "flex-end" as const,
                  backgroundColor: t.tint,
                },
              ];
              return column.onPress ? (
                <Pressable
                  key={column.key}
                  accessibilityRole="link"
                  accessibilityLabel={column.label}
                  onPress={column.onPress}
                  style={style}
                >
                  {body}
                </Pressable>
              ) : (
                <View key={column.key} style={style}>
                  {body}
                </View>
              );
            })}
          </View>
          {rows.map((row, index) => (
            <View
              key={isGroup(row) ? `group-${row.group}` : row.key}
              style={[
                index < rows.length - 1 || isGroup(row) ? edge : null,
                {
                  flexDirection: "row",
                  height: heightOf(row),
                  backgroundColor: isGroup(row) ? t.tint : undefined,
                },
              ]}
            >
              {!isGroup(row) &&
                row.cells.map((cell, cellIndex) => (
                  <View
                    key={columns[cellIndex]?.key ?? cellIndex}
                    style={{
                      width: columnWidth,
                      paddingHorizontal: 12,
                      justifyContent: "center",
                      alignItems: "flex-end",
                    }}
                  >
                    <Copy size={13} lines={1} localize={false}>
                      {cell}
                    </Copy>
                  </View>
                ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
