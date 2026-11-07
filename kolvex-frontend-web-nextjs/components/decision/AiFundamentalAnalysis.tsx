"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import { MODEL_CONFIGS, PROVIDER_NAME_TO_ID } from "@/lib/aiModels";
import { useTranslation } from "@/lib/i18n";
import { useCopy } from "./shared";

type DimensionKey = "profitability" | "growth" | "financial_health" | "cash_flow" | "valuation" | "shareholder_returns" | "risk_performance";
type Rating = "strong" | "solid" | "mixed" | "weak" | "insufficient_data";
export interface AiFundamentalsResult {
  symbol: string;
  model_id: string;
  locale: string;
  generated_at: string;
  summary: string;
  dimensions: { key: DimensionKey; rating: Rating; headline: string; evidence: string[] }[];
  strengths: string[];
  concerns: string[];
  watch_items: string[];
  data_as_of?: string | null;
  price_at_generation?: number | null;
  cached?: boolean;
}

async function generateAiFundamentals(symbol: string, body: { model: string; locale: string; regenerate: boolean }, signal: AbortSignal): Promise<AiFundamentalsResult> {
  const response = await fetch(`/api/market/ai-fundamentals/${encodeURIComponent(symbol)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "ai_unavailable");
  return data;
}

// The last result survives tab switches within this browser session.
const storageKey = (symbol: string, locale: string) => `kolvex:ai-fundamentals:${symbol.toUpperCase()}:${locale}`;
function readStored(symbol: string, locale: string): AiFundamentalsResult | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(symbol, locale)) || "null");
    return value && Array.isArray(value.dimensions) ? value : null;
  } catch {
    return null;
  }
}
function writeStored(symbol: string, locale: string, value: AiFundamentalsResult) {
  try {
    sessionStorage.setItem(storageKey(symbol, locale), JSON.stringify(value));
  } catch {
    /* Storage unavailable; the result still shows for this view. */
  }
}

const ratingTone: Record<Rating, string> = {
  strong: "bg-positive",
  solid: "bg-positive/60",
  mixed: "bg-muted-foreground/60",
  weak: "bg-negative",
  insufficient_data: "bg-muted-foreground/30",
};

export default function AiFundamentalAnalysis({ symbol }: { symbol: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const { availableProviders, loading: providersLoading, refresh: refreshProviders } = useAvailableProviders();
  const eligibleModels = MODEL_CONFIGS.filter((item) => availableProviders?.includes(PROVIDER_NAME_TO_ID[item.provider]));
  const [chosenModel, setChosenModel] = useState("");
  const aiModel = eligibleModels.some((item) => item.id === chosenModel) ? chosenModel : eligibleModels[0]?.id ?? "";
  const [result, setResult] = useState<AiFundamentalsResult | null>(null);
  const [request, setRequest] = useState<{ pending: boolean; error?: string }>({ pending: false });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    setRequest({ pending: false });
    setResult(readStored(symbol, locale));
  }, [symbol, locale]);
  useEffect(() => () => controller.current?.abort(), []);

  const run = () => {
    if (!aiModel) return;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setRequest({ pending: true });
    generateAiFundamentals(symbol, { model: aiModel, locale, regenerate: Boolean(result) }, next.signal)
      .then((data) => {
        if (next.signal.aborted) return;
        setResult(data);
        writeStored(symbol, locale, data);
        setRequest({ pending: false });
      })
      .catch((failure) => {
        if (!next.signal.aborted) setRequest({ pending: false, error: failure instanceof Error ? failure.message : "ai_unavailable" });
      });
  };

  const dimensionNames: Record<DimensionKey, string> = {
    profitability: c("Profitability", "盈利能力"),
    growth: c("Growth", "成长性"),
    financial_health: c("Financial health", "财务健康"),
    cash_flow: c("Cash flow quality", "现金流质量"),
    valuation: c("Valuation", "估值水平"),
    shareholder_returns: c("Shareholder returns", "股东回报"),
    risk_performance: c("Risk & performance", "风险与表现"),
  };
  const ratingNames: Record<Rating, string> = {
    strong: c("Strong", "优秀"),
    solid: c("Solid", "良好"),
    mixed: c("Mixed", "中性"),
    weak: c("Weak", "偏弱"),
    insufficient_data: c("Insufficient data", "数据不足"),
  };
  const errors: Record<string, string> = {
    ai_not_configured: c("Add an API key for the selected model first.", "请先为所选模型配置 API Key。"),
    ai_key_rejected: c("The provider rejected this API key. Check it in Settings.", "服务商拒绝了这个 API Key，请到设置中检查。"),
    ai_rate_limited: c("Too many AI analyses in a short time. Try again in a few minutes.", "短时间内 AI 分析次数过多，请几分钟后再试。"),
    fundamentals_unavailable: c("Not enough fundamental data is available for this stock.", "该股票的基本面数据不足，暂时无法分析。"),
    ai_fundamentals_invalid: c("The model returned an incomplete analysis. Try again or choose another model.", "模型返回的分析不完整，请重试或换一个模型。"),
    ai_analysis_timeout: c("The model took too long. Try again or choose a faster model.", "模型响应超时，请重试或换一个更快的模型。"),
    Unauthorized: c("Sign in to use AI analysis.", "请登录后使用 AI 分析。"),
  };
  const modelName = (id: string) => MODEL_CONFIGS.find((item) => item.id === id)?.name ?? id;
  const lists = result
    ? [
        { title: c("Strengths", "优势"), items: result.strengths, tone: "bg-positive" },
        { title: c("Concerns", "风险与隐忧"), items: result.concerns, tone: "bg-negative" },
        { title: c("Watch next", "后续关注"), items: result.watch_items, tone: "bg-muted-foreground/60" },
      ].filter((list) => list.items.length)
    : [];

  return (
    <section aria-labelledby="ai-fundamentals-title" className="rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 id="ai-fundamentals-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {c("AI fundamental analysis", "AI 基本面分析")}
            <InfoTip label={c("About AI fundamental analysis", "关于 AI 基本面分析")}>{c(
              "Your selected model reads the figures on this page and assesses profitability, growth, balance sheet, cash flow, valuation, shareholder returns, and risk and performance.",
              "由你选择的模型读取本页指标，从盈利、成长、资产负债、现金流、估值、股东回报与风险表现七个维度解读。",
            )}</InfoTip>
          </h2>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={aiModel}
            onValueChange={setChosenModel}
            onOpenChange={(open) => { if (open) void refreshProviders(); }}
            disabled={providersLoading || request.pending}
          >
            <SelectTrigger className="h-9 w-full min-w-0 sm:w-56" aria-label={c("Select an AI model", "选择 AI 模型")}>
              <SelectValue placeholder={c("Select a model", "选择模型")} />
            </SelectTrigger>
            <SelectContent>
              {MODEL_CONFIGS.map((item) => (
                <SelectItem key={item.id} value={item.id} disabled={!availableProviders?.includes(PROVIDER_NAME_TO_ID[item.provider])}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9" disabled={!aiModel || request.pending} onClick={run}>
            {request.pending ? c("Analyzing…", "分析中…") : result ? c("Regenerate", "重新分析") : c("Run analysis", "开始分析")}
          </Button>
        </div>
      </div>

      {!providersLoading && !eligibleModels.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          {c("No API key configured yet.", "还没有配置 API Key。")}{" "}
          <Link href="/dashboard/settings?tab=api-keys" className="underline underline-offset-4">
            {c("Add one in Settings", "前往设置添加")}
          </Link>
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground empty:hidden">
        {request.pending
          ? c("This usually takes under a minute. Your API key pays for the request.", "通常一分钟内完成；本次调用使用你的 API Key 计费。")
          : request.error
            ? (errors[request.error] ?? c("AI analysis is unavailable right now. Try again shortly.", "AI 分析暂时不可用，请稍后重试。"))
            : null}
      </p>

      {result && (
        <div className={`mt-4 space-y-5 transition-opacity ${request.pending ? "opacity-50" : ""}`}>
          <p className="max-w-4xl text-sm leading-7">{result.summary}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.dimensions.map((row) => (
              <div key={row.key} className="min-w-0 rounded-2xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{dimensionNames[row.key] ?? row.key}</h3>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${ratingTone[row.rating] ?? ratingTone.mixed}`} />
                    {ratingNames[row.rating] ?? row.rating}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6">{row.headline}</p>
                {row.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                    {row.evidence.map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {lists.length > 0 && (
            <div className="grid gap-5 md:grid-cols-3">
              {lists.map((list) => (
                <div key={list.title} className="min-w-0">
                  <h3 className="text-sm font-medium">{list.title}</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                    {list.items.map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span aria-hidden="true" className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${list.tone}`} />
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {modelName(result.model_id)} · {c("Generated", "生成于")}{" "}
            <time dateTime={result.generated_at}>{new Date(result.generated_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</time>
            {" · "}
            {c(
              "AI can misread figures; verify against the metrics below. Not investment advice.",
              "AI 可能误读数据，请对照下方指标核实。不构成投资建议。",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
