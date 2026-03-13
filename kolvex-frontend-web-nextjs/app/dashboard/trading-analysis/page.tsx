"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Play,
  Plus,
  Loader2,
  Trash2,
  Clock,
  TrendingUp,
  Calendar,
  Bot,
  Settings,
  Globe,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { HeroSection } from "@/components/ui/hero-section";
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
          <Button variant="ghost" size="xs" onClick={loadHistory}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            {t("tradingAnalysis.refresh")}
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => router.push("/dashboard/trading-analysis/explore")}
            className="gap-1"
          >
            <Globe className="w-3.5 h-3.5" />
            {t("tradingAnalysis.explore.title")}
          </Button>
          <Button size="xs" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t("tradingAnalysis.newAnalysis")}
          </Button>
        </>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        <div className="relative">
          <HeroSection
            title={t("tradingAnalysis.title")}
            description={t("tradingAnalysis.heroDescription")}
            features={[
              {
                icon: Activity,
                label: t("tradingAnalysis.heroFeatures.multiAgent"),
              },
              {
                icon: Bot,
                label: t("tradingAnalysis.heroFeatures.debate"),
              },
              {
                icon: TrendingUp,
                label: t("tradingAnalysis.heroFeatures.risk"),
              },
            ]}
          />

          <div className="p-4 space-y-6">
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
                        <div className="flex items-center h-10 px-4 text-sm text-muted-foreground border border-border bg-muted rounded-lg">
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
                              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
                                  <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
                          className="flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-medium text-primary border border-dashed border-primary/30 dark:border-primary/40 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
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
                                  <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
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
                                  <span className="px-1 py-0.5 text-[9px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
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
                            onClick={() => toggleAnalyst(id)}
                            className={cn(
                              "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                              isActive
                                ? "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:border-primary/40 shadow-sm"
                                : "bg-muted text-muted-foreground border-border hover:border-border"
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
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("tradingAnalysis.history")}
                  {total > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      ({total})
                    </span>
                  )}
                </h2>
              </div>

              {loading ? (
                <HistorySkeleton />
              ) : history.length === 0 ? (
                <div className="bg-card border border-border rounded-lg text-center py-16">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {t("tradingAnalysis.noHistory")}
                  </p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {history.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          router.push(
                            `/dashboard/trading-analysis/${item.id}`
                          )
                        }
                        className={cn(
                          "group bg-card border border-border rounded-lg p-4 cursor-pointer",
                          "hover:border-primary/30 dark:hover:border-primary/20 transition-all duration-200 hover:shadow-sm",
                          "animate-fade-in-up",
                          idx < 6 && `stagger-${Math.min(idx + 1, 5)}`
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <CompanyLogo symbol={item.ticker} size="md" />
                            <div className="min-w-0">
                              <span className="text-lg font-bold text-foreground">
                                {item.ticker}
                              </span>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <StatusBadge status={item.status} t={t} />
                                <DecisionBadge
                                  decision={item.final_decision}
                                  t={t}
                                />
                                {item.is_published && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                  <Globe className="w-2.5 h-2.5" />
                                  {t("tradingAnalysis.publishedLabel")}
                                </span>
                              )}
                              </div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(item.id);
                                }}
                                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">
                                {t("common.delete")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.trade_date}
                          </span>
                          {item.duration_seconds && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {t("tradingAnalysis.durationSeconds", {
                                seconds: String(
                                  Math.round(item.duration_seconds)
                                ),
                              })}
                            </span>
                          )}
                          {item.llm_provider && (
                            <span className="capitalize px-1.5 py-0.5 rounded bg-muted text-[10px]">
                              {item.llm_provider}
                            </span>
                          )}
                        </div>

                        {item.error_message && (
                          <p className="mt-2 text-xs text-red-500 truncate">
                            {item.error_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
