"use client";

import React, { useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Shield,
    Target,
    ChevronDown,
    Lightbulb,
    BarChart3,
    RefreshCw,
    Zap,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Info,
    Gauge,
    PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
    analyzePortfolio,
    type PortfolioAnalysisResponse,
    type StockAnalysis,
    type OverallAnalysis,
} from "@/lib/snaptradeApi";

// ============================================================
// Types
// ============================================================

type TFunction = (key: string, params?: Record<string, string>) => string;

interface PortfolioAIAnalysisProps {
    className?: string;
}

// ============================================================
// Sentiment & Recommendation Config
// ============================================================

const SENTIMENT_CONFIG = {
    bullish: {
        icon: TrendingUp,
        label: "Bullish",
        className: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20",
    },
    bearish: {
        icon: TrendingDown,
        label: "Bearish",
        className: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20",
    },
    neutral: {
        icon: MinusCircle,
        label: "Neutral",
        className: "bg-muted text-gray-600 dark:text-gray-400 border-border",
    },
} as const;

const RECOMMENDATION_CONFIG = {
    strong_buy: { label: "Strong Buy", icon: CheckCircle2, className: "bg-green-600 text-white" },
    buy: { label: "Buy", icon: TrendingUp, className: "bg-green-500/20 text-green-600 dark:text-green-400" },
    buy_more: { label: "Buy More", icon: TrendingUp, className: "bg-green-500/20 text-green-600 dark:text-green-400" },
    hold: { label: "Hold", icon: MinusCircle, className: "bg-amber-500/20 text-amber-600 dark:text-amber-400" },
    reduce: { label: "Reduce", icon: TrendingDown, className: "bg-orange-500/20 text-orange-600 dark:text-orange-400" },
    sell: { label: "Sell", icon: XCircle, className: "bg-red-500/20 text-red-600 dark:text-red-400" },
} as const;

const RISK_CONFIG = {
    low: { label: "Low Risk", color: "bg-green-500", width: "33%", textColor: "text-green-600 dark:text-green-400" },
    medium: { label: "Medium Risk", color: "bg-amber-500", width: "66%", textColor: "text-amber-600 dark:text-amber-400" },
    high: { label: "High Risk", color: "bg-red-500", width: "100%", textColor: "text-red-600 dark:text-red-400" },
} as const;

// ============================================================
// Sub-Components
// ============================================================

function SentimentBadge({ sentiment }: { sentiment: string }) {
    const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.neutral;
    const Icon = config.icon;

    return (
        <Badge variant="outline" size="sm" className={cn("gap-1 font-medium", config.className)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
    const config = RECOMMENDATION_CONFIG[recommendation as keyof typeof RECOMMENDATION_CONFIG] || RECOMMENDATION_CONFIG.hold;
    const Icon = config.icon;

    return (
        <Badge size="sm" className={cn("gap-1 font-semibold border-0", config.className)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
}

function RiskMeter({ level, t }: { level: string; t: TFunction }) {
    const config = RISK_CONFIG[level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
    const labelKey = level === "low" ? "portfolio.ai.lowRisk" : level === "high" ? "portfolio.ai.highRisk" : "portfolio.ai.mediumRisk";
    const label = t(labelKey);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="w-4 h-4" />
                    <span>{t("portfolio.ai.riskLevel")}</span>
                </div>
                <span className={cn("text-sm font-semibold", config.textColor)}>{label}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", config.color)}
                    style={{ width: config.width }}
                />
            </div>
        </div>
    );
}

function DiversificationGauge({ score, t }: { score: number; t: TFunction }) {
    const getColor = (s: number) => {
        if (s >= 70) return { ring: "text-green-500", text: "text-green-600 dark:text-green-400" };
        if (s >= 40) return { ring: "text-amber-500", text: "text-amber-600 dark:text-amber-400" };
        return { ring: "text-red-500", text: "text-red-600 dark:text-red-400" };
    };
    const colors = getColor(score);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const statusLabel = score >= 70 ? t("portfolio.ai.wellDiversified") : score >= 40 ? t("portfolio.ai.moderate") : t("portfolio.ai.concentrated");

    return (
        <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-gray-200 dark:text-white/10"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className={cn("transition-all duration-700 ease-out", colors.ring)}
                    />
                </svg>
                <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold", colors.text)}>
                    {score}
                </span>
            </div>
            <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PieChart className="w-4 h-4" />
                    <span>{t("portfolio.ai.diversification")}</span>
                </div>
                <p className={cn("text-sm font-semibold", colors.text)}>
                    {statusLabel}
                </p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
            </div>
            {children}
        </div>
    );
}

// ============================================================
// Stock Analysis Accordion Item
// ============================================================

function StockAnalysisItem({ stock, t }: { stock: StockAnalysis; t: TFunction }) {
    return (
        <AccordionItem value={stock.symbol} className="border border-border rounded-lg mb-2 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted transition-colors">
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                            {stock.symbol.slice(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{stock.symbol}</span>
                            <SentimentBadge sentiment={stock.sentiment} />
                        </div>
                        {stock.name && (
                            <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                        )}
                    </div>
                    <RecommendationBadge recommendation={stock.recommendation} />
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 pt-2">
                    {/* Analysis Text */}
                    {stock.analysis && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{stock.analysis}</p>
                    )}

                    {/* Key Points */}
                    {stock.key_points && stock.key_points.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("portfolio.ai.keyPoints")}</p>
                            <ul className="space-y-1.5">
                                {stock.key_points.map((point, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Metrics */}
                    <div className="flex items-center gap-4 pt-2 border-t border-border">
                        {stock.current_weight !== undefined && stock.current_weight !== null && (
                            <div className="text-xs">
                                <span className="text-muted-foreground">{t("portfolio.ai.weight")} </span>
                                <span className="font-semibold">{stock.current_weight.toFixed(1)}%</span>
                            </div>
                        )}
                        <div className="text-xs">
                            <span className="text-muted-foreground">{t("portfolio.ai.confidence")} </span>
                            <span className="font-semibold">{(stock.confidence * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

// ============================================================
// Overall Analysis Section
// ============================================================

function OverallAnalysisSection({ analysis, t }: { analysis: OverallAnalysis; t: TFunction }) {
    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Metrics Grid - Bento Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard icon={Gauge} label={t("portfolio.ai.riskAssessment")}>
                    <RiskMeter level={analysis.risk_level} t={t} />
                </MetricCard>
                <MetricCard icon={PieChart} label={t("portfolio.ai.portfolioHealth")}>
                    <DiversificationGauge score={analysis.diversification_score} t={t} />
                </MetricCard>
            </div>

            {/* Portfolio Style */}
            {analysis.portfolio_style && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted border border-border">
                    <span className="text-sm text-muted-foreground">{t("portfolio.ai.portfolioStyle")}</span>
                    <span className="text-sm font-semibold capitalize">{analysis.portfolio_style}</span>
                </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.strengths && analysis.strengths.length > 0 && (
                    <div className="p-4 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">{t("portfolio.ai.strengths")}</span>
                        </div>
                        <ul className="space-y-1.5">
                            {analysis.strengths.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300/80">
                                    <span className="w-1 h-1 rounded-full bg-green-500 mt-2 shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                    <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t("portfolio.ai.areasToImprove")}</span>
                        </div>
                        <ul className="space-y-1.5">
                            {analysis.weaknesses.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300/80">
                                    <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Suggestions Section
// ============================================================

const SUGGESTION_SECTIONS = [
    { key: "rebalancing", titleKey: "portfolio.ai.rebalancing", icon: Target, color: "text-gery-500 dark:text-blue-400", bg: "bg-blue-500/10" },
    { key: "risk_management", titleKey: "portfolio.ai.riskManagement", icon: Shield, color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10" },
    { key: "opportunities", titleKey: "portfolio.ai.opportunities", icon: Lightbulb, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
    { key: "tax_considerations", titleKey: "portfolio.ai.taxTips", icon: Info, color: "text-teal-500 dark:text-teal-400", bg: "bg-teal-500/10" },
] as const;

function SuggestionsSection({ suggestions, t }: { suggestions: PortfolioAnalysisResponse["portfolio_suggestions"]; t: TFunction }) {
    if (!suggestions) return null;

    const activeSections = SUGGESTION_SECTIONS.filter((s) => {
        const items = suggestions[s.key as keyof typeof suggestions];
        return items && items.length > 0;
    });

    if (activeSections.length === 0) return null;

    return (
        <div className="space-y-2">
            {activeSections.map((section) => {
                const Icon = section.icon;
                const items = suggestions[section.key as keyof typeof suggestions] ?? [];

                return (
                    <div
                        key={section.key}
                        className="p-4 rounded-lg border border-border bg-card"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className={cn("p-1.5 rounded-md", section.bg)}>
                                <Icon className={cn("w-4 h-4", section.color)} />
                            </div>
                            <span className="font-semibold text-sm">{t(section.titleKey)}</span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                            {items.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <span className="w-1 h-1 rounded-full bg-current mt-2 shrink-0 opacity-50" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================
// Loading State
// ============================================================

function AnalysisLoadingState() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-24 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
            </div>
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
        </div>
    );
}

// ============================================================
// Empty State
// ============================================================

function EmptyAnalysisState({ onAnalyze, loading, t }: { onAnalyze: () => void; loading: boolean; t: TFunction }) {
    return (
        <div className="text-center py-10">
            <h3 className="text-lg font-semibold mb-2">{t("portfolio.ai.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                {t("portfolio.ai.emptyDescription")}
            </p>
            <Button onClick={onAnalyze} disabled={loading} size="sm" className="gap-2">
                <Zap className="w-4 h-4" />
                {loading ? t("portfolio.ai.analyzing") : t("portfolio.ai.startAnalysis")}
            </Button>
        </div>
    );
}

// ============================================================
// Error State
// ============================================================

function ErrorState({ error, onRetry, t }: { error: string; onRetry: () => void; t: TFunction }) {
    return (
        <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-semibold mb-1">{t("portfolio.ai.analysisFailed")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
            <Button variant="outline" onClick={onRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {t("portfolio.ai.tryAgain")}
            </Button>
        </div>
    );
}

// ============================================================
// Main Component
// ============================================================

export function PortfolioAIAnalysis({ className }: PortfolioAIAnalysisProps) {
    const { t } = useTranslation();
    const [analysis, setAnalysis] = useState<PortfolioAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAllStocks, setShowAllStocks] = useState(false);

    const handleAnalyze = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await analyzePortfolio();
            setAnalysis(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to analyze portfolio");
        } finally {
            setLoading(false);
        }
    }, []);

    const displayedStocks = showAllStocks
        ? analysis?.stock_analyses || []
        : (analysis?.stock_analyses || []).slice(0, 5);

    const hasMoreStocks = (analysis?.stock_analyses?.length || 0) > 5;
    const hiddenCount = (analysis?.stock_analyses?.length || 0) - 5;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">{t("portfolio.ai.title")}</CardTitle>
                    </div>
                    {analysis && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            {loading ? t("portfolio.ai.analyzing") : t("portfolio.ai.refresh")}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {/* Initial Empty State */}
                {!analysis && !loading && !error && (
                    <EmptyAnalysisState onAnalyze={handleAnalyze} loading={loading} t={t} />
                )}

                {/* Loading State */}
                {loading && !analysis && <AnalysisLoadingState />}

                {/* Error State */}
                {error && !loading && <ErrorState error={error} onRetry={handleAnalyze} t={t} />}

                {/* Analysis Results */}
                {analysis && !loading && (
                    <div className="space-y-6">
                        {/* Overall Analysis */}
                        <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                {t("portfolio.ai.portfolioOverview")}
                            </h3>
                            <OverallAnalysisSection analysis={analysis.overall_analysis} t={t} />
                        </section>

                        {/* Stock Analysis */}
                        {analysis.stock_analyses && analysis.stock_analyses.length > 0 && (
                            <section>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    {t("portfolio.ai.stockAnalysis")}
                                    <Badge variant="default" className="ml-1">
                                        {analysis.stock_analyses.length}
                                    </Badge>
                                </h3>
                                <Accordion type="multiple" defaultValue={analysis.stock_analyses.slice(0, 2).map(s => s.symbol)}>
                                    {displayedStocks.map((stock) => (
                                        <StockAnalysisItem key={stock.symbol} stock={stock} t={t} />
                                    ))}
                                </Accordion>
                                {hasMoreStocks && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full mt-2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowAllStocks(!showAllStocks)}
                                    >
                                        <ChevronDown className={cn("w-4 h-4 mr-1 transition-transform", showAllStocks && "rotate-180")} />
                                        {showAllStocks ? t("portfolio.ai.showLess") : t("portfolio.ai.showMore", { count: String(hiddenCount) })}
                                    </Button>
                                )}
                            </section>
                        )}

                        {/* Suggestions */}
                        <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                {t("portfolio.ai.recommendations")}
                            </h3>
                            <SuggestionsSection suggestions={analysis.portfolio_suggestions} t={t} />
                        </section>

                        {/* Footer */}
                        <footer className="pt-4 border-t border-border">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    {t("portfolio.ai.positionsAnalyzed", { count: String(analysis.positions_analyzed) })} • Model: {analysis.model}
                                </span>
                                <span>{new Date(analysis.analyzed_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
                                {t("portfolio.ai.disclaimer")}
                            </p>
                        </footer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default PortfolioAIAnalysis;
