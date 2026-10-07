"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Plus,
  Loader2,
  Trash2,
  Clock,
  Settings,
  Globe,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  startAnalysis,
  getAnalysisHistory,
  deleteAnalysis,
  type TradingAnalysis,
  type StartAnalysisParams,
} from "@/lib/tradingAnalysisApi";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import {
  MODEL_CONFIGS,
  PROVIDER_NAME_TO_ID,
} from "@/components/chat/ChatInput";
import type { AIModelConfig } from "@/components/chat/types";
import { DecisionBadge, StatusBadge } from "@/components/trading-analysis/badges";
import { HistorySkeleton } from "@/components/trading-analysis/skeletons";
import CompanyLogo from "@/components/ui/company-logo";

// ==================== Helpers ====================

const ANALYST_KEYS = ["market", "social", "news", "fundamentals"] as const;

const PROVIDER_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PROVIDER_NAME_TO_ID).map(([name, id]) => [id, name])
);

function modelsForProvider(providerId: string): AIModelConfig[] {
  const displayName = PROVIDER_ID_TO_NAME[providerId];
  if (!displayName) return [];
  return MODEL_CONFIGS.filter((m) => m.provider === displayName);
}

function getDefaultDeepModel(providerId: string): string {
  const models = modelsForProvider(providerId);
  return models.find((m) => m.isPro)?.id || models[0]?.id || "";
}

function getDefaultQuickModel(providerId: string): string {
  const models = modelsForProvider(providerId);
  return (
    models.find((m) => !m.isPro)?.id || models[models.length - 1]?.id || ""
  );
}

// ==================== Page ====================

export default function TradingAnalysisPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { availableProviders, loading: providersLoading } =
    useAvailableProviders();

  const [history, setHistory] = useState<TradingAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [ticker, setTicker] = useState("");
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [provider, setProvider] = useState("");
  const [deepModel, setDeepModel] = useState("");
  const [quickModel, setQuickModel] = useState("");
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>([
    "market",
    "social",
    "news",
    "fundamentals",
  ]);
  const [debateRounds, setDebateRounds] = useState("1");

  const analystLabels: Record<string, string> = {
    market: t("tradingAnalysis.analystMarket"),
    social: t("tradingAnalysis.analystSocial"),
    news: t("tradingAnalysis.analystNews"),
    fundamentals: t("tradingAnalysis.analystFundamentals"),
  };

  const hasAnyProvider =
    availableProviders && availableProviders.length > 0;
  const allProviders = Object.entries(PROVIDER_NAME_TO_ID).map(
    ([displayName, id]) => ({
      id,
      displayName,
      available: availableProviders?.includes(id) ?? false,
    })
  );
  const providerModels = modelsForProvider(provider);
  const isProviderAvailable =
    !availableProviders || availableProviders.includes(provider);

  useEffect(() => {
    if (!provider && availableProviders && availableProviders.length > 0) {
      const firstId = availableProviders[0];
      setProvider(firstId);
      setDeepModel(getDefaultDeepModel(firstId));
      setQuickModel(getDefaultQuickModel(firstId));
    }
  }, [availableProviders, provider]);

  const handleProviderChange = (id: string) => {
    setProvider(id);
    setDeepModel(getDefaultDeepModel(id));
    setQuickModel(getDefaultQuickModel(id));
  };

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAnalysisHistory({ limit: 20 });
      setHistory(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleAnalyst = (id: string) => {
    setSelectedAnalysts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    if (!ticker.trim()) {
      toast.error(t("tradingAnalysis.enterTicker"));
      return;
    }
    if (!provider) {
      toast.error(t("tradingAnalysis.configureApiKey"));
      return;
    }
    if (selectedAnalysts.length === 0) {
      toast.error(t("tradingAnalysis.selectAnalyst"));
      return;
    }

    setSubmitting(true);
    try {
      const params: StartAnalysisParams = {
        ticker: ticker.trim().toUpperCase(),
        trade_date: tradeDate,
        provider,
        deep_think_model: deepModel,
        quick_think_model: quickModel,
        selected_analysts: selectedAnalysts,
        max_debate_rounds: parseInt(debateRounds),
        max_risk_discuss_rounds: parseInt(debateRounds),
      };

      const record = await startAnalysis(params);
      setDialogOpen(false);
      toast.success(
        t("tradingAnalysis.analysisStarted", { ticker: record.ticker })
      );
      router.push(`/dashboard/trading-analysis/${record.id}`);
    } catch (e: any) {
      toast.error(e.message || t("tradingAnalysis.startFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnalysis(id);
      toast.success(t("tradingAnalysis.deleted"));
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || t("tradingAnalysis.deleteFailed"));
    }
  };

  return (
    <DashboardLayout
      title={t("tradingAnalysis.title")}
      headerActions={
        <>
          <Button variant="ghost" size="icon" onClick={loadHistory} aria-label={t("tradingAnalysis.refresh")} className="h-9 w-9">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/trading-analysis/explore")}
            className="gap-1.5"
          >
            <Globe className="h-4 w-4" />
            {t("tradingAnalysis.explore.title")}
          </Button>
        </>
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[28px] font-bold leading-tight md:text-[32px]">
                  {t("tradingAnalysis.title")}
                </h2>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                  {t("tradingAnalysis.heroDescription")}
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t("tradingAnalysis.newAnalysis")}
              </Button>
            </div>

            {/* ── New Analysis Dialog ── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("tradingAnalysis.newAnalysis")}</DialogTitle>
                  <DialogDescription>
                    {t("tradingAnalysis.heroDescription")}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.tickerSymbol")}
                      </label>
                      <Input
                        placeholder={t("tradingAnalysis.tickerPlaceholder")}
                        value={ticker}
                        onChange={(e) =>
                          setTicker(e.target.value.toUpperCase())
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.analysisDate")}
                      </label>
                      <Input
                        type="date"
                        value={tradeDate}
                        onChange={(e) => setTradeDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.llmProvider")}
                      </label>
                      {providersLoading ? (
                        <div className="flex h-10 items-center rounded-xl bg-muted px-4 text-sm text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          {t("common.loading")}
                        </div>
                      ) : hasAnyProvider ? (
                        <Select
                          value={provider}
                          onValueChange={handleProviderChange}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "tradingAnalysis.selectProvider"
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">
                                {t("tradingAnalysis.available")}
                              </SelectLabel>
                              {allProviders
                                .filter((p) => p.available)
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.displayName}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                            {allProviders.some((p) => !p.available) && (
                              <>
                                <SelectSeparator />
                                <SelectGroup>
                                  <SelectLabel className="text-xs text-muted-foreground">
                                    {t("tradingAnalysis.needApiKey")}
                                  </SelectLabel>
                                  {allProviders
                                    .filter((p) => !p.available)
                                    .map((p) => (
                                      <SelectItem
                                        key={p.id}
                                        value={p.id}
                                        disabled
                                      >
                                        {p.displayName}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Link
                          href="/dashboard/settings?tab=api-keys"
                          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-4 text-[13px] font-semibold text-positive transition-colors duration-150 hover:bg-muted"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          {t("tradingAnalysis.addApiKey")}
                        </Link>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.debateRounds")}
                      </label>
                      <Select
                        value={debateRounds}
                        onValueChange={setDebateRounds}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {t(
                                n === 1
                                  ? "tradingAnalysis.roundCount"
                                  : "tradingAnalysis.roundsCount",
                                { count: String(n) }
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.deepThinkModel")}
                      </label>
                      <Select
                        value={deepModel}
                        onValueChange={setDeepModel}
                        disabled={
                          !provider ||
                          !isProviderAvailable ||
                          providerModels.length === 0
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("tradingAnalysis.selectModel")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {providerModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="flex items-center gap-2">
                                {m.name}
                                {m.isPro && (
                                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    Pro
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("tradingAnalysis.quickThinkModel")}
                      </label>
                      <Select
                        value={quickModel}
                        onValueChange={setQuickModel}
                        disabled={
                          !provider ||
                          !isProviderAvailable ||
                          providerModels.length === 0
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("tradingAnalysis.selectModel")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {providerModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="flex items-center gap-2">
                                {m.name}
                                {m.isPro && (
                                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    Pro
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("tradingAnalysis.analysts")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ANALYST_KEYS.map((id) => {
                        const isActive = selectedAnalysts.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleAnalyst(id)}
                            aria-pressed={isActive}
                            className={cn(
                              "h-9 rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isActive
                                ? "bg-foreground text-background"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {analystLabels[id]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleStart}
                    disabled={submitting || !ticker.trim() || !provider}
                    className="gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {submitting
                      ? t("tradingAnalysis.starting")
                      : t("tradingAnalysis.startAnalysis")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ── History ── */}
            <section aria-labelledby="analysis-history" className="animate-fade-in-up">
              <h3 id="analysis-history" className="border-b border-border pb-3 text-[17px] font-semibold text-foreground">
                {t("tradingAnalysis.history")}
                {total > 0 && (
                  <span className="figure ml-2 text-sm font-normal text-muted-foreground">
                    {total}
                  </span>
                )}
              </h3>

              {loading ? (
                <HistorySkeleton />
              ) : history.length === 0 ? (
                <div className="flex flex-col items-start gap-3 py-12">
                  <p className="text-[15px] text-muted-foreground">
                    {t("tradingAnalysis.noHistory")}
                  </p>
                  <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t("tradingAnalysis.newAnalysis")}
                  </Button>
                </div>
              ) : (
                <TooltipProvider>
                  <ul className="divide-y divide-border">
                    {history.map((item) => (
                      <li key={item.id} className="group relative flex items-center gap-3 py-3.5 sm:gap-4">
                        <CompanyLogo symbol={item.ticker} size="md" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/trading-analysis/${item.id}`}
                            className="text-[15px] font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-primary"
                          >
                            {item.ticker}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="figure">{item.trade_date}</span>
                            {item.duration_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t("tradingAnalysis.durationSeconds", {
                                  seconds: String(Math.round(item.duration_seconds)),
                                })}
                              </span>
                            )}
                            {item.llm_provider && (
                              <span className="capitalize">{item.llm_provider}</span>
                            )}
                            {item.is_published && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {t("tradingAnalysis.publishedLabel")}
                              </span>
                            )}
                          </div>
                          {item.error_message && (
                            <p className="mt-1 truncate text-xs text-negative">
                              {item.error_message}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.status !== "completed" && <StatusBadge status={item.status} t={t} />}
                          <DecisionBadge decision={item.final_decision} t={t} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                aria-label={`${t("common.delete")} ${item.ticker}`}
                                className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-negative/10 hover:text-negative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">{t("common.delete")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TooltipProvider>
              )}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
