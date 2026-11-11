// The Web's CompanyLogo: the FMP image for a ticker on a white circle, or its initials.
import { useState } from "react";
import { Image, View } from "react-native";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";

const FMP_IMAGE_BASE_URL = "https://financialmodelingprep.com/image-stock";
/** FMP file name for a symbol, or null for indexes, futures and FX. */
function fmpLogoKey(symbol: string): string | null {
  if (!symbol || /[\^=/\s]/.test(symbol)) return null;
  const crypto = symbol.match(/^([A-Z0-9]+)-USD$/);
  if (crypto) return `${crypto[1]}USD`;
  return symbol.replace(/\./g, "-");
}

export function CompanyLogo({
  symbol,
  size = 32,
}: {
  symbol: string;
  size?: number;
}) {
  const t = useTheme();
  const key = fmpLogoKey(symbol.toUpperCase());
  const [failed, setFailed] = useState(false);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: key && !failed ? "#FFFFFF" : t.wash,
        padding: size / 8,
      }}
    >
      {key && !failed ? (
        <Image
          source={{ uri: `${FMP_IMAGE_BASE_URL}/${key}.png` }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Copy size={11} bold localize={false}>
          {symbol.replace(/^\^/, "").slice(0, 3)}
        </Copy>
      )}
    </View>
  );
}
