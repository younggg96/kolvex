"use client";

import React, { useState, useCallback } from "react";
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
        className: "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10",
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

function RiskMeter({ level }: { level: string }) {
    const config = RISK_CONFIG[level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Gauge className="w-4 h-4" />
                    <span>Risk Level</span>
                </div>
                <span className={cn("text-sm font-semibold", config.textColor)}>{config.label}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", config.color)}
                    style={{ width: config.width }}
                />
            </div>
        </div>
    );
}

function DiversificationGauge({ score }: { score: number }) {
    const getColor = (s: number) => {
        if (s >= 70) return { ring: "text-green-500", text: "text-green-600 dark:text-green-400" };
        if (s >= 40) return { ring: "text-amber-500", text: "text-amber-600 dark:text-amber-400" };
        return { ring: "text-red-500", text: "text-red-600 dark:text-red-400" };
    };
    const colors = getColor(score);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score / 100) * circumference;

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
                    <span>Diversification</span>
                </div>
                <p className={cn("text-sm font-semibold", colors.text)}>
                    {score >= 70 ? "Well Diversified" : score >= 40 ? "Moderate" : "Concentrated"}
                </p>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-card-dark">
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

function StockAnalysisItem({ stock }: { stock: StockAnalysis }) {
    return (
        <AccordionItem value={stock.symbol} className="border border-gray-200 dark:border-white/10 rounded-lg mb-2 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Points</p>
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
                    <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-white/10">
                        {stock.current_weight !== undefined && stock.current_weight !== null && (
                            <div className="text-xs">
                                <span className="text-muted-foreground">Weight: </span>
                                <span className="font-semibold">{stock.current_weight.toFixed(1)}%</span>
                            </div>
                        )}
                        <div className="text-xs">
                            <span className="text-muted-foreground">Confidence: </span>
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

function OverallAnalysisSection({ analysis }: { analysis: OverallAnalysis }) {
    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Metrics Grid - Bento Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard icon={Gauge} label="Risk Assessment">
                    <RiskMeter level={analysis.risk_level} />
                </MetricCard>
                <MetricCard icon={PieChart} label="Portfolio Health">
                    <DiversificationGauge score={analysis.diversification_score} />
                </MetricCard>
            </div>

            {/* Portfolio Style */}
            {analysis.portfolio_style && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <span className="text-sm text-muted-foreground">Portfolio Style:</span>
                    <span className="text-sm font-semibold capitalize">{analysis.portfolio_style}</span>
                </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.strengths && analysis.strengths.length > 0 && (
                    <div className="p-4 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Strengths</span>
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
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Areas to Improve</span>
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
    { key: "rebalancing", title: "Rebalancing", icon: Target, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
    { key: "risk_management", title: "Risk Management", icon: Shield, color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10" },
    { key: "opportunities", title: "Opportunities", icon: Lightbulb, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
    { key: "tax_considerations", title: "Tax Tips", icon: Info, color: "text-teal-500 dark:text-teal-400", bg: "bg-teal-500/10" },
] as const;

function SuggestionsSection({ suggestions }: { suggestions: PortfolioAnalysisResponse["portfolio_suggestions"] }) {
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
                        className="p-4 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-card-dark"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className={cn("p-1.5 rounded-md", section.bg)}>
                                <Icon className={cn("w-4 h-4", section.color)} />
                            </div>
                            <span className="font-semibold text-sm">{section.title}</span>
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

function EmptyAnalysisState({ onAnalyze, loading }: { onAnalyze: () => void; loading: boolean }) {
    return (
        <div className="text-center py-10">
            <h3 className="text-lg font-semibold mb-2">AI-Powered Portfolio Analysis</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Get personalized insights, risk assessment, and actionable recommendations powered by financial AI.
            </p>
            <Button onClick={onAnalyze} disabled={loading} size="sm" className="gap-2">
                <Zap className="w-4 h-4" />
                {loading ? "Analyzing..." : "Start Analysis"}
            </Button>
        </div>
    );
}

// ============================================================
// Error State
// ============================================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-semibold mb-1">Analysis Failed</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
            <Button variant="outline" onClick={onRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
            </Button>
        </div>
    );
}

// ============================================================
// Main Component
// ============================================================

export function PortfolioAIAnalysis({ className }: PortfolioAIAnalysisProps) {
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
                        <CardTitle className="text-lg">AI Portfolio Analysis</CardTitle>
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
                            {loading ? "Analyzing..." : "Refresh"}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {/* Initial Empty State */}
                {!analysis && !loading && !error && (
                    <EmptyAnalysisState onAnalyze={handleAnalyze} loading={loading} />
                )}

                {/* Loading State */}
                {loading && !analysis && <AnalysisLoadingState />}

                {/* Error State */}
                {error && !loading && <ErrorState error={error} onRetry={handleAnalyze} />}

                {/* Analysis Results */}
                {analysis && !loading && (
                    <div className="space-y-6">
                        {/* Overall Analysis */}
                        <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                Portfolio Overview
                            </h3>
                            <OverallAnalysisSection analysis={analysis.overall_analysis} />
                        </section>

                        {/* Stock Analysis */}
                        {analysis.stock_analyses && analysis.stock_analyses.length > 0 && (
                            <section>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    Stock Analysis
                                    <Badge variant="default" className="ml-1">
                                        {analysis.stock_analyses.length}
                                    </Badge>
                                </h3>
                                <Accordion type="multiple" defaultValue={analysis.stock_analyses.slice(0, 2).map(s => s.symbol)}>
                                    {displayedStocks.map((stock) => (
                                        <StockAnalysisItem key={stock.symbol} stock={stock} />
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
                                        {showAllStocks ? "Show Less" : `Show ${hiddenCount} More`}
                                    </Button>
                                )}
                            </section>
                        )}

                        {/* Suggestions */}
                        <section>
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                Recommendations
                            </h3>
                            <SuggestionsSection suggestions={analysis.portfolio_suggestions} />
                        </section>

                        {/* Footer */}
                        <footer className="pt-4 border-t border-gray-200 dark:border-white/10">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    {analysis.positions_analyzed} positions analyzed • Model: {analysis.model}
                                </span>
                                <span>{new Date(analysis.analyzed_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
                                Disclaimer: AI analysis is for informational purposes only. Not financial advice. Consult a qualified advisor.
                            </p>
                        </footer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default PortfolioAIAnalysis;
