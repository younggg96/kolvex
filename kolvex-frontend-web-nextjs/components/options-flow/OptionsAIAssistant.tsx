"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Clock,
  User,
  Check,
  Lock,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { UnusualActivityItem } from "@/lib/optionsFlowApi";
import { analyzeOptionsAI, getOptionsAIHistory } from "@/lib/optionsFlowApi";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import {
  MODEL_CONFIGS,
  getFirstAvailableModelId,
  PROVIDER_NAME_TO_ID,
} from "@/components/chat/ChatInput";
import type { AIModel } from "@/components/chat/types";
import {
  type RiskProfile,
  type OptionsAIAnalysisRecord,
  isPlaceholderDescription,
} from "@/lib/optionsAiTypes";

// ==================== Helpers ====================

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: "text-green-600 dark:text-green-500", bg: "bg-green-500/10" },
  bearish: { icon: TrendingDown, color: "text-red-600 dark:text-red-500", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-500/10" },
} as const;

const CONFIDENCE_STYLES = {
  high: "bg-green-500/10 text-green-500",
  medium: "bg-amber-500/10 text-amber-500",
  low: "bg-red-500/10 text-red-500",
} as const;

// ==================== Compact Result Card ====================

function CompactResultCard({
  record,
  t,
  defaultOpen = false,
}: {
  record: OptionsAIAnalysisRecord;
  t: (key: string) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ai = record.ai_response;
  const rec = ai?.recommendation;
  const rm = ai?.risk_management;
  const ctx = ai?.market_context;

  if (!rec) return null;

  const isCall = rec.option_type === "call";
  const ivRaw = rec.implied_volatility ?? 0;
  const ivDisplay = ivRaw > 1 ? ivRaw.toFixed(1) : (ivRaw * 100).toFixed(1);
  const sentiment = ctx?.overall_sentiment;
  const SentimentIcon = sentiment ? SENTIMENT_CONFIG[sentiment]?.icon : null;

  const sl = rm?.stop_loss;
  const slItems = [sl?.price_based, sl?.premium_based, sl?.time_based].filter(
    (s) => s?.description && !isPlaceholderDescription(s.description)
  );
  const tpItems = (Array.isArray(rm?.take_profit) ? rm.take_profit : []).filter(
    (tp) => tp?.description && !isPlaceholderDescription(tp.description)
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div
              className={cn(
                "flex items-center justify-center h-8 w-8 rounded-lg text-xs font-bold shrink-0",
                isCall
                  ? "bg-green-500/10 text-green-600 dark:text-green-500"
                  : "bg-red-500/10 text-red-600 dark:text-red-500"
              )}
            >
              {isCall ? "C" : "P"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{rec.symbol}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ${(rec.strike ?? 0).toFixed(0)} {rec.expiration ?? ""}
                </span>
                {SentimentIcon && (
                  <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", SENTIMENT_CONFIG[sentiment!].color)}>
                    <SentimentIcon className="h-3 w-3" />
                    {t(`optionsFlow.ai.${sentiment}`)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {rec.signal_explanation}
              </p>
            </div>

            <Badge
              variant="secondary"
              className={cn("text-[9px] font-semibold", CONFIDENCE_STYLES[rec.confidence ?? "medium"])}
            >
              {t(`optionsFlow.ai.${rec.confidence ?? "medium"}`)}
            </Badge>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-90"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!p-0">
            <Separator />

            {/* Stats row */}
            <div className="grid grid-cols-4">
              {[
                { label: t("optionsFlow.ai.strike"), value: `$${(rec.strike ?? 0).toFixed(2)}` },
                { label: t("optionsFlow.ai.expiration"), value: rec.expiration ?? "—" },
                { label: t("optionsFlow.ai.price"), value: `$${(rec.last_price ?? 0).toFixed(2)}` },
                { label: t("optionsFlow.ai.iv"), value: `${ivDisplay}%` },
              ].map((s, idx) => (
                <div
                  key={s.label}
                  className={cn(
                    "py-2.5 px-3 text-center",
                    idx > 0 && "border-l border-border-light dark:border-border-dark"
                  )}
                >
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-xs font-mono font-semibold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Market context */}
            {ctx && Array.isArray(ctx.key_observations) && ctx.key_observations.length > 0 && (
              <>
                <Separator />
                <div className="px-4 py-2.5 space-y-1">
                  {ctx.key_observations.map((obs: string, i: number) => (
                    <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-[5px] h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                      {obs}
                    </p>
                  ))}
                </div>
              </>
            )}

            {/* Risk management */}
            {(slItems.length > 0 || tpItems.length > 0) && (
              <>
                <Separator />
                <div className="px-4 py-2.5 space-y-2">
                  {slItems.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 dark:text-red-500 uppercase tracking-wider mb-1">
                        {t("optionsFlow.ai.stopLoss")}
                      </p>
                      {slItems.map((s, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">
                          {s!.description}
                        </p>
                      ))}
                    </div>
                  )}
                  {tpItems.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider mb-1">
                        {t("optionsFlow.ai.takeProfit")}
                      </p>
                      {tpItems.map((tp, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground">
                          +{tp.target_percent}% — {tp.description}
                        </p>
                      ))}
                    </div>
                  )}
                  {rm?.position_size_suggestion &&
                    !isPlaceholderDescription(rm.position_size_suggestion) && (
                    <p className="text-[11px] text-primary/70">{rm.position_size_suggestion}</p>
                  )}
                </div>
              </>
            )}

            {/* Disclaimer */}
            <Separator />
            <div className="px-4 py-2">
              <p className="text-[10px] text-muted-foreground/50">
                {ai?.disclaimer || t("optionsFlow.ai.disclaimer")}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ==================== History Preview Item ====================

function HistoryItem({
  record,
  t,
}: {
  record: OptionsAIAnalysisRecord;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const rec = record.ai_response?.recommendation;
  if (!rec) return null;

  const isCall = rec.option_type === "call";
  const timeAgo = getTimeAgo(record.created_at);

  const profileLabels: Record<string, string> = {
    conservative: t("optionsFlow.ai.conservative"),
    aggressive: t("optionsFlow.ai.aggressive"),
    hedging: t("optionsFlow.ai.hedging"),
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <Avatar className="h-6 w-6">
              <AvatarImage src={record.user_avatar ?? undefined} />
              <AvatarFallback className="text-[10px]">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    isCall
                      ? "text-green-600 dark:text-green-500"
                      : "text-red-600 dark:text-red-500"
                  )}
                >
                  {rec.symbol} {isCall ? "C" : "P"} ${(rec.strike ?? 0).toFixed(0)}
                </span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {profileLabels[record.risk_profile] ?? record.risk_profile}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {record.user_name ?? "Anonymous"} · {timeAgo}
              </p>
            </div>

            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                open && "rotate-90"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <div className="px-3 py-2.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {rec.signal_explanation}
            </p>
            {Array.isArray(record.ai_response?.market_context?.key_observations) &&
              record.ai_response.market_context.key_observations.map(
                (obs: string, i: number) => (
                  <p key={i} className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
                    <span className="mt-[5px] h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                    {obs}
                  </p>
                )
              )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ==================== Main Component ====================

interface OptionsAIAssistantProps {
  data: UnusualActivityItem[];
  symbol?: string;
  className?: string;
}

export function OptionsAIAssistant({
  data,
  symbol,
  className,
}: OptionsAIAssistantProps) {
  const { t, locale } = useTranslation();
  const { availableProviders } = useAvailableProviders();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("conservative");
  const [model, setModel] = useState<AIModel | null>(null);
  const [currentResult, setCurrentResult] =
    useState<OptionsAIAnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<OptionsAIAnalysisRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Same pattern as Chat: when providers load, default to first available
  useEffect(() => {
    const first = getFirstAvailableModelId(availableProviders);
    if (first) setModel(first);
  }, [availableProviders]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    getOptionsAIHistory({ symbol: symbol ?? undefined, limit: 5, offset: 0 })
      .then((res) => {
        if (!cancelled) setHistory(res.data);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, currentResult]);

  const profileOptions = [
    {
      value: "conservative" as const,
      label: t("optionsFlow.ai.conservative"),
      icon: <Shield className="h-3.5 w-3.5" />,
    },
    {
      value: "aggressive" as const,
      label: t("optionsFlow.ai.aggressive"),
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    },
    {
      value: "hedging" as const,
      label: t("optionsFlow.ai.hedging"),
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    },
  ];

  const handleAnalyze = useCallback(async () => {
    if (!data.length || !model) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeOptionsAI({
        options_data: data,
        risk_profile: riskProfile,
        locale,
        model,
      });
      setCurrentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [data, riskProfile, locale, model]);

  const hasData = data.length > 0;

  // Same pattern as Chat: check if model's provider is available
  const isModelAvailable = (config: { provider: string }) => {
    if (!availableProviders) return true;
    const backendId = PROVIDER_NAME_TO_ID[config.provider];
    return backendId ? availableProviders.includes(backendId) : false;
  };
  const hasAnyModel =
    !availableProviders || MODEL_CONFIGS.some((m) => isModelAvailable(m));
  const currentModelConfig = MODEL_CONFIGS.find((m) => m.id === model);
  const isCurrentModelAvailable = currentModelConfig
    ? isModelAvailable(currentModelConfig)
    : false;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <SwitchTab
              value={riskProfile}
              onValueChange={(v) => setRiskProfile(v as RiskProfile)}
              options={profileOptions}
              size="sm"
              variant="pills"
              className="!w-fit"
            />
          </div>

          <Button
          size="xs"
          onClick={handleAnalyze}
          disabled={loading || !hasData || !model || !hasAnyModel}
          className="h-8 gap-1.5 text-xs shrink-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading
            ? t("optionsFlow.ai.analyzing")
            : t("optionsFlow.ai.analyze")}
        </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground shrink-0">
            {t("optionsFlow.ai.model")}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  "data-[state=open]:ring-0 data-[state=open]:outline-none",
                  !hasAnyModel
                    ? "text-muted-foreground"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50 border !border-border-light/50 dark:!border-border-dark/50"
                )}
              >
                {hasAnyModel ? (
                  <Sparkles className="w-3.5 h-3.5 text-primary/70" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="hidden sm:inline text-xs truncate max-w-[140px]">
                  {!hasAnyModel
                    ? t("chat.input.addApiKey")
                    : isCurrentModelAvailable
                      ? currentModelConfig?.name
                      : t("chat.input.selectModel")}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              className="w-52 max-h-72 overflow-y-auto"
            >
              {!hasAnyModel && (
                <div className="px-3 py-3 text-center">
                  <Lock className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {t("chat.input.apiKeyRequiredDesc")}
                  </p>
                  <Link
                    href="/dashboard/settings?tab=api-keys"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    <Settings className="w-3 h-3" />
                    {t("chat.input.settingsApiKeys")}
                  </Link>
                </div>
              )}
              {MODEL_CONFIGS.map((m) => {
                const available = isModelAvailable(m);
                return (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => available && setModel(m.id as AIModel)}
                    disabled={!available}
                    className={cn(
                      "flex items-center gap-2",
                      available ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                      model === m.id && available && "bg-accent"
                    )}
                  >
                    {available ? (
                      <Check
                        className={cn(
                          "w-3 h-3 flex-shrink-0 text-primary",
                          model === m.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    ) : (
                      <Lock className="w-3 h-3 flex-shrink-0 text-muted-foreground/50" />
                    )}
                    <span
                      className={cn(
                        "text-xs flex-1",
                        !available
                          ? "text-muted-foreground/50"
                          : model === m.id
                            ? "text-primary"
                            : "text-muted-foreground"
                      )}
                    >
                      {m.name}
                    </span>
                    {m.isPro && available && (
                      <span className="ml-auto px-1 py-0.5 text-[9px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Pro
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Current result */}
      {(loading || error || currentResult) && (
        <CardContent className="!px-4 !pb-4 !pt-0 space-y-2">
          {loading && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </Card>
          )}

          {error && !loading && (
            <Card className="overflow-hidden border-red-500/20">
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-red-500 font-medium">
                  {t("optionsFlow.ai.error")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {error}
                </p>
              </div>
            </Card>
          )}

          {currentResult && !loading && (
            <CompactResultCard
              record={currentResult}
              t={t}
              defaultOpen
            />
          )}
        </CardContent>
      )}

      {/* Recent history */}
      {(history.length > 0 || historyLoading) && (
        <>
          <Separator />
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("optionsFlow.ai.recentAnalyses")}
              </h4>
            </div>

            {historyLoading ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.map((record) => (
                  <HistoryItem key={record.id} record={record} t={t} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasData &&
        !loading &&
        !currentResult &&
        history.length === 0 &&
        !historyLoading && (
          <CardContent className="!pb-6 !pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              {t("optionsFlow.ai.noData")}
            </p>
          </CardContent>
        )}
    </Card>
  );
}
