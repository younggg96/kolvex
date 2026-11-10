import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { MODEL_CONFIGS, providerId } from "../lib/aiModels";
import { apiRequest } from "../lib/http";
import {
  aiFundamentals,
  type AiFundamentalsResult,
  type DimensionKey,
  type Rating,
} from "../lib/stockExtrasApi";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { Filters } from "./Content";
import { Button, Copy, Failure, Glass, Section } from "./UI";

const DIMENSIONS: Record<DimensionKey, string> = {
  profitability: "盈利能力",
  growth: "成长性",
  financial_health: "财务健康",
  cash_flow: "现金流质量",
  valuation: "估值水平",
  shareholder_returns: "股东回报",
  risk_performance: "风险与表现",
};
const RATINGS: Record<Rating, string> = {
  strong: "优秀",
  solid: "良好",
  mixed: "中性",
  weak: "偏弱",
  insufficient_data: "数据不足",
};
const ERRORS: Record<string, string> = {
  ai_not_configured: "请先为所选模型配置 API Key。",
  ai_key_rejected: "服务商拒绝了这个 API Key，请到设置中检查。",
  ai_rate_limited: "短时间内 AI 分析次数过多，请几分钟后再试。",
  fundamentals_unavailable: "该股票的基本面数据不足，暂时无法分析。",
  ai_fundamentals_invalid: "模型返回的分析不完整，请重试或换一个模型。",
  ai_analysis_timeout: "模型响应超时，请重试或换一个更快的模型。",
  Unauthorized: "请登录后使用 AI 分析。",
};
// The last result survives tab switches while the app stays open; nothing is stored on disk.
const results = new Map<string, AiFundamentalsResult>();

/** The reader's own model interprets the overview figures. Runs only on an explicit press. */
export function AiFundamentals({ symbol }: { symbol: string }) {
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const cacheKey = `${user}:${symbol}:${locale}`;
  // A new stock, account or language starts from that key's own last result.
  return <Analysis key={cacheKey} symbol={symbol} cacheKey={cacheKey} />;
}
function Analysis({ symbol, cacheKey }: { symbol: string; cacheKey: string }) {
  const t = useTheme();
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const providers = useResource(`providers:${user}`, (signal) =>
    apiRequest<{ available_providers: string[] }>(
      "/user-api-keys/available-providers",
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const eligible = MODEL_CONFIGS.filter((item) =>
    providers.data?.available_providers.includes(providerId[item.provider]),
  );
  const [chosen, setChosen] = useState("");
  const model = eligible.some((item) => item.id === chosen)
    ? chosen
    : (eligible[0]?.id ?? "");
  const [result, setResult] = useState(() => results.get(cacheKey) ?? null);
  const [request, setRequest] = useState<{ pending: boolean; error?: string }>({
    pending: false,
  });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = () => {
    if (!model) return;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setRequest({ pending: true });
    aiFundamentals(
      symbol,
      { model, locale, regenerate: Boolean(result) },
      user,
      next.signal,
    )
      .then((data) => {
        if (next.signal.aborted) return;
        results.set(cacheKey, data);
        setResult(data);
        setRequest({ pending: false });
      })
      .catch((failure) => {
        if (!next.signal.aborted)
          setRequest({
            pending: false,
            error:
              failure instanceof Error ? failure.message : "ai_unavailable",
          });
      });
  };
  const dot = (rating: Rating) =>
    rating === "strong" || rating === "solid"
      ? t.accent
      : rating === "weak"
        ? t.negative
        : t.secondary;
  const lists: [string, string[], string][] = result
    ? (
        [
          ["优势", result.strengths, t.accent],
          ["风险与隐忧", result.concerns, t.negative],
          ["后续关注", result.watch_items, t.secondary],
        ] as [string, string[], string][]
      ).filter(([, items]) => items.length)
    : [];
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <Section title="AI 基本面分析" />
      {!providers.loading && !eligible.length ? (
        <>
          <Copy size={14} muted>
            还没有配置 API Key。
          </Copy>
          <Button onPress={() => router.push("/preferences")}>
            前往设置添加
          </Button>
        </>
      ) : (
        <>
          <Filters
            values={eligible.map((item) => [item.id, item.name] as const)}
            value={model}
            onChange={setChosen}
            disabled={request.pending}
          />
          <Button disabled={!model || request.pending} onPress={run}>
            {request.pending
              ? "分析中…"
              : result
                ? "重新分析（将调用模型）"
                : "开始分析（将调用模型）"}
          </Button>
        </>
      )}
      {request.pending && (
        <Copy size={12} muted>
          通常一分钟内完成；本次调用使用你的 API Key 计费。
        </Copy>
      )}
      {!!request.error && (
        <Failure
          message={ERRORS[request.error] ?? "AI 分析暂时不可用，请稍后重试。"}
        />
      )}
      {result && (
        <View style={{ gap: 16, opacity: request.pending ? 0.5 : 1 }}>
          <Copy size={15} selectable>
            {result.summary}
          </Copy>
          {result.dimensions.map((row) => (
            <View
              key={row.key}
              style={{
                gap: 6,
                padding: 12,
                borderRadius: 16,
                backgroundColor: t.tint,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Copy size={14} bold>
                  {DIMENSIONS[row.key] ?? row.key}
                </Copy>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: dot(row.rating),
                    }}
                  />
                  <Copy size={12} muted>
                    {RATINGS[row.rating] ?? row.rating}
                  </Copy>
                </View>
              </View>
              <Copy size={14} selectable>
                {row.headline}
              </Copy>
              {row.evidence.map((item, index) => (
                <Copy key={index} size={12} muted selectable>
                  · {item}
                </Copy>
              ))}
            </View>
          ))}
          {lists.map(([title, items, color]) => (
            <View key={title} style={{ gap: 6 }}>
              <Copy size={14} bold>
                {title}
              </Copy>
              {items.map((item, index) => (
                <View key={index} style={{ flexDirection: "row", gap: 8 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      marginTop: 8,
                      backgroundColor: color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Copy size={14} muted selectable>
                      {item}
                    </Copy>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Copy size={12} muted localize={false}>
            {MODEL_CONFIGS.find((item) => item.id === result.model_id)?.name ??
              result.model_id}
            {" · "}
            {new Date(result.generated_at).toLocaleString(
              locale === "en" ? "en-US" : "zh-CN",
            )}
          </Copy>
          <Copy size={12} muted>
            AI 可能误读数据，请对照下方指标核实。不构成投资建议。
          </Copy>
        </View>
      )}
    </Glass>
  );
}
