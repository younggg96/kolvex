import { View } from "react-native";
import type { XPostAnalysis } from "../lib/contentTypes";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { Copy } from "./UI";

export function XPostAnalysisNote({
  analysis,
}: {
  analysis?: XPostAnalysis | null;
}) {
  const { locale } = usePreferences();
  const t = useTheme();
  if (analysis?.status !== "complete") return null;

  return (
    <View style={{ gap: 4 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Copy muted bold size={12}>
          AI 摘要
        </Copy>
        {analysis.stock_relevance !== "related" && (
          <View
            style={{
              borderColor: t.border,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Copy bold size={12}>
              {analysis.stock_relevance === "low"
                ? "股票相关性低"
                : "股票相关性不明确"}
            </Copy>
          </View>
        )}
      </View>
      <Copy muted size={14} localize={false}>
        {locale === "en" ? analysis.summary_en : analysis.summary_zh}
      </Copy>
    </View>
  );
}
