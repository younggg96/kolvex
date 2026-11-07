import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { quote } from "../lib/api";
import { number, percent } from "../lib/models";
import { useResource } from "../lib/useResource";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { Copy, Failure, Glass, PendingValue, Skeleton, styles } from "./UI";

export function QuoteRow({
  symbol,
  revision = 0,
  compact = false,
}: {
  symbol: string;
  revision?: number;
  compact?: boolean;
}) {
  const t = useTheme();
  const text = useText();
  const resource = useResource(`${symbol}:${revision}`, (signal) =>
    quote(symbol, signal),
  );
  const q = resource.data;
  const pending = resource.loading && !q;
  const color = (q?.change_percent ?? 0) < 0 ? t.negative : t.accent;
  return (
    <Glass style={compact ? { width: 172 } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text(`查看 ${symbol} 股票详情`)}
        onPress={() => router.push(`/stock/${encodeURIComponent(symbol)}`)}
        style={({ pressed }) => ({
          padding: 16,
          gap: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Copy size={compact ? 14 : 18} bold>
              {symbol}
            </Copy>
            {!q?.name && resource.loading ? (
              <Skeleton width="60%" height={12} />
            ) : (
              <Copy size={12} muted>
                {q?.name ?? "报价不可用"}
              </Copy>
            )}
          </View>
          {!compact && (
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              {pending ? (
                <>
                  <PendingValue />
                  <PendingValue />
                </>
              ) : (
                <>
                  <Copy bold>{number(q?.current_price)}</Copy>
                  <Copy size={14} color={color}>
                    {percent(q?.change_percent)}
                  </Copy>
                </>
              )}
            </View>
          )}
        </View>
        {compact && pending && (
          <>
            <PendingValue height={30} />
            <PendingValue />
          </>
        )}
        {compact && !pending && (
          <>
            <Copy size={24} bold>
              {number(q?.current_price)}
            </Copy>
            <Copy size={14} color={color}>
              {percent(q?.change_percent)}
            </Copy>
          </>
        )}
      </Pressable>
      {!!resource.error && (
        <View style={{ padding: 16, paddingTop: 0 }}>
          <Failure message={resource.error} retry={resource.refresh} />
        </View>
      )}
    </Glass>
  );
}
