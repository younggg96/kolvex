"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  History,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getOptionsAIHistory } from "@/lib/optionsFlowApi";
import {
  type OptionsAIAnalysisRecord,
  isPlaceholderDescription,
} from "@/lib/optionsAiTypes";

const PAGE_SIZE = 10;

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

const PROFILE_ICONS: Record<string, React.ReactNode> = {
  conservative: <Shield className="h-3 w-3" />,
  aggressive: <TrendingUp className="h-3 w-3" />,
  hedging: <AlertTriangle className="h-3 w-3" />,
};

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: "text-green-600 dark:text-green-500" },
  bearish: { icon: TrendingDown, color: "text-red-600 dark:text-red-500" },
  neutral: { icon: Minus, color: "text-amber-600 dark:text-amber-500" },
} as const;

const CONFIDENCE_STYLES = {
  high: "bg-green-500/10 text-green-500",
  medium: "bg-amber-500/10 text-amber-500",
  low: "bg-red-500/10 text-red-500",
} as const;

// ==================== History Card ====================

function HistoryCard({
  record,
  t,
}: {
  record: OptionsAIAnalysisRecord;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ai = record.ai_response;
  const rec = ai?.recommendation;
  const ctx = ai?.market_context;
  const rm = ai?.risk_management;

  if (!rec) return null;

  const isCall = rec.option_type === "call";
  const ivRaw = rec.implied_volatility ?? 0;
  const ivDisplay = ivRaw > 1 ? ivRaw.toFixed(1) : (ivRaw * 100).toFixed(1);

  const profileLabels: Record<string, string> = {
    conservative: t("optionsFlow.ai.conservative"),
    aggressive: t("optionsFlow.ai.aggressive"),
    hedging: t("optionsFlow.ai.hedging"),
  };

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
            <Avatar className="h-7 w-7">
              <AvatarImage src={record.user_avatar ?? undefined} />
              <AvatarFallback className="text-[10px]">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-bold",
                    isCall
                      ? "text-green-600 dark:text-green-500"
                      : "text-red-600 dark:text-red-500"
                  )}
                >
                  {rec.symbol} {isCall ? "CALL" : "PUT"} $
                  {(rec.strike ?? 0).toFixed(0)}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 px-1.5 gap-0.5"
                >
                  {PROFILE_ICONS[record.risk_profile]}
                  {profileLabels[record.risk_profile] ?? record.risk_profile}
                </Badge>
                {rec.confidence && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px] h-4 px-1.5",
                      CONFIDENCE_STYLES[rec.confidence]
                    )}
                  >
                    {t(`optionsFlow.ai.${rec.confidence}`)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                <span>{record.user_name ?? "Anonymous"}</span>
                <span>·</span>
                <span>{getTimeAgo(record.created_at)}</span>
                <span>·</span>
                <span className="font-mono">
                  {record.input_summary?.signal_count ?? 0}{" "}
                  {t("optionsFlow.ai.signals")}
                </span>
              </div>
            </div>

            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                open && "rotate-90"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!p-0">
            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-4">
              {[
                {
                  label: t("optionsFlow.ai.strike"),
                  value: `$${(rec.strike ?? 0).toFixed(2)}`,
                },
                {
                  label: t("optionsFlow.ai.expiration"),
                  value: rec.expiration ?? "—",
                },
                {
                  label: t("optionsFlow.ai.price"),
                  value: `$${(rec.last_price ?? 0).toFixed(2)}`,
                },
                {
                  label: t("optionsFlow.ai.iv"),
                  value: `${ivDisplay}%`,
                },
              ].map((s, idx) => (
                <div
                  key={s.label}
                  className={cn(
                    "py-2.5 px-3 text-center",
                    idx > 0 &&
                      "border-l border-border"
                  )}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="text-xs font-mono font-semibold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Signal explanation */}
            <Separator />
            <div className="px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {rec.signal_explanation}
              </p>
            </div>

            {/* Observations */}
            {ctx &&
              Array.isArray(ctx.key_observations) &&
              ctx.key_observations.length > 0 && (
                <>
                  <Separator />
                  <div className="px-4 py-2.5 space-y-1">
                    {ctx.key_observations.map((obs: string, i: number) => (
                      <p
                        key={i}
                        className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5"
                      >
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
                <div className="px-4 py-2.5 space-y-1.5">
                  {slItems.map((s, i) => (
                    <p
                      key={`sl-${i}`}
                      className="text-[11px] text-red-600/70 dark:text-red-500/60"
                    >
                      {s!.description}
                    </p>
                  ))}
                  {tpItems.map((tp, i) => (
                    <p
                      key={`tp-${i}`}
                      className="text-[11px] text-green-600/70 dark:text-green-500/60"
                    >
                      +{tp.target_percent}% — {tp.description}
                    </p>
                  ))}
                  {rm?.position_size_suggestion &&
                    !isPlaceholderDescription(rm.position_size_suggestion) && (
                    <p className="text-[11px] text-primary/60">
                      {rm.position_size_suggestion}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ==================== Main History Component ====================

interface OptionsAIHistoryProps {
  symbol?: string;
  className?: string;
}

export function OptionsAIHistory({ symbol, className }: OptionsAIHistoryProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<OptionsAIAnalysisRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await getOptionsAIHistory({
          symbol: symbol ?? undefined,
          limit: PAGE_SIZE,
          offset,
        });
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [symbol]
  );

  useEffect(() => {
    loadData(0, false);
  }, [loadData]);

  const hasMore = items.length < total;

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {t("optionsFlow.ai.noHistory")}
        </p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          {t("optionsFlow.ai.noHistoryHint")}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((record) => (
        <HistoryCard key={record.id} record={record} t={t} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(items.length, true)}
            disabled={loadingMore}
            className="h-8 gap-1.5 text-xs"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loadingMore ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
