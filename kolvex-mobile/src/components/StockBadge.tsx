import { router } from "expo-router";
import { Pressable } from "react-native";
import { isSymbolShape, normalizeSymbol } from "../lib/stockMentions";
import { CompanyLogo } from "./CompanyLogo";
import { Copy, Glass, phone } from "./UI";

export function StockBadge({ symbol }: { symbol: string }) {
  const ticker = normalizeSymbol(symbol);
  const content = (
    <Glass
      clear
      style={{
        borderRadius: phone(24),
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: phone(44),
        padding: 4,
        paddingRight: 12,
      }}
    >
      <CompanyLogo symbol={ticker} size={phone(32)} />
      <Copy size={14} bold localize={false}>
        {ticker}
      </Copy>
    </Glass>
  );
  if (!isSymbolShape(ticker)) return content;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={ticker}
      onPress={() =>
        router.push({ pathname: "/stock/[symbol]", params: { symbol: ticker } })
      }
      hitSlop={3}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {content}
    </Pressable>
  );
}
