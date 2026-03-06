"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Calendar,
  LinkIcon,
  Zap,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { StatCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  OptionsChainTable,
  UnusualActivityTable,
  OptionsAIAssistant,
  OptionsAIHistory,
} from "@/components/options-flow";
import {
  getOptionsOverview,
  getOptionsChain,
  liveScanSymbol,
  type OptionsOverview,
  type OptionsChainData,
  type UnusualActivityItem,
} from "@/lib/optionsFlowApi";
import { useTranslation } from "@/lib/i18n";

export default function OptionsFlowSymbolPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const symbol = (params.symbol as string)?.toUpperCase() || "";

  // Tab state
  const [activeTab, setActiveTab] = useState("chain");

  // Options chain state
  const [overview, setOverview] = useState<OptionsOverview | null>(null);
  const [chainData, setChainData] = useState<OptionsChainData | null>(null);
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [chainLoading, setChainLoading] = useState(true);

  // Unusual activity state
  const [unusualData, setUnusualData] = useState<UnusualActivityItem[]>([]);
  const [scanning, setScanning] = useState(false);

  // Load options overview (expirations list + nearest chain)
  const loadOverview = useCallback(async () => {
    if (!symbol) return;
    setChainLoading(true);
    try {
      const data = await getOptionsOverview(symbol);
      setOverview(data);

      if (data.options_chain) {
        setChainData({
          symbol: data.symbol,
          expiration: data.options_chain.expiration,
          calls: data.options_chain.calls,
          puts: data.options_chain.puts,
        });
        setSelectedExpiration(data.options_chain.expiration);
      }

      if (data.expirations.length > 0 && !selectedExpiration) {
        setSelectedExpiration(data.expirations[0]);
      }
    } catch (error) {
      console.error("Failed to load options overview:", error);
    } finally {
      setChainLoading(false);
    }
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chain for a specific expiration
  const loadChain = useCallback(
    async (expiration: string) => {
      if (!symbol || !expiration) return;
      setChainLoading(true);
      try {
        const data = await getOptionsChain(symbol, expiration);
        setChainData(data);
      } catch (error) {
        console.error("Failed to load options chain:", error);
      } finally {
        setChainLoading(false);
      }
    },
    [symbol]
  );

  // Scan for unusual activity
  const loadUnusual = useCallback(async () => {
    if (!symbol) return;
    setScanning(true);
    try {
      const result = await liveScanSymbol(symbol, 6);
      setUnusualData(result.data);
    } catch (error) {
      console.error("Failed to scan unusual activity:", error);
    } finally {
      setScanning(false);
    }
  }, [symbol]);

  // Initial load
  useEffect(() => {
    loadOverview();
    loadUnusual();
  }, [loadOverview, loadUnusual]);

  // Handle expiration change
  const handleExpirationChange = (exp: string) => {
    setSelectedExpiration(exp);
    loadChain(exp);
  };

  // Build set of unusual contract symbols for highlighting
  const { unusualContracts, unusualMap } = useMemo(() => {
    const contractSet = new Set<string>();
    const contractMap = new Map<string, UnusualActivityItem>();
    for (const item of unusualData) {
      if (item.contract_symbol) {
        contractSet.add(item.contract_symbol);
        contractMap.set(item.contract_symbol, item);
      }
    }
    return { unusualContracts: contractSet, unusualMap: contractMap };
  }, [unusualData]);

  // Stats from unusual data
  const totalUnusual = unusualData.length;
  const callUnusual = unusualData.filter((d) => d.option_type === "call").length;
  const putUnusual = unusualData.filter((d) => d.option_type === "put").length;
  const totalPremium = unusualData.reduce((sum, d) => sum + (d.premium || 0), 0);

  const formatPremium = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000
        ? `$${(v / 1_000).toFixed(1)}K`
        : `$${v.toFixed(0)}`;

  return (
    <DashboardLayout
      title={`${symbol} ${t("optionsFlow.chainTitle")}`}
      headerClassName="lg:hidden"
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        <div className="relative p-4 min-w-0 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/options-flow")}
              className="h-9 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{symbol}</h1>
              <p className="text-xs text-muted-foreground">
                {t("optionsFlow.chainSubtitle")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadOverview();
                loadUnusual();
              }}
              disabled={chainLoading || scanning}
              className="h-9 gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${chainLoading || scanning ? "animate-spin" : ""
                  }`}
              />
              {t("optionsFlow.refresh")}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={t("optionsFlow.statsUnusual")}
              value={scanning ? null : totalUnusual}
              icon={Activity}
              loading={scanning}
              subtitle={
                totalUnusual > 0
                  ? `${callUnusual} calls / ${putUnusual} puts`
                  : undefined
              }
            />
            <StatCard
              label={t("optionsFlow.statsPremium")}
              value={scanning ? null : formatPremium(totalPremium)}
              loading={scanning}
            />
            <StatCard
              label={t("optionsFlow.statsExpirations")}
              value={overview ? overview.expirations.length : null}
              icon={Calendar}
              loading={chainLoading && !overview}
            />
            <StatCard
              label={t("optionsFlow.statsContracts")}
              value={
                chainData
                  ? (chainData.calls.length + chainData.puts.length)
                  : null
              }
              loading={chainLoading}
              subtitle={
                chainData
                  ? `${chainData.calls.length}C / ${chainData.puts.length}P`
                  : undefined
              }
            />
          </div>

          {/* Expiration Selector */}
          {overview && overview.expirations.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                {t("optionsFlow.expiration")}:
              </span>
              <div className="flex gap-1.5">
                {overview.expirations.map((exp) => (
                  <button
                    key={exp}
                    onClick={() => handleExpirationChange(exp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${selectedExpiration === exp
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                      }`}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab Switcher */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <SwitchTab
              value={activeTab}
              onValueChange={setActiveTab}
              options={[
                {
                  value: "chain",
                  label: t("optionsFlow.tabChain"),
                  icon: <LinkIcon className="h-3.5 w-3.5" />,
                },
                {
                  value: "unusual",
                  label: `${t("optionsFlow.tabUnusual")}${unusualData.length > 0 ? ` (${unusualData.length})` : ""}`,
                  icon: <Zap className="h-3.5 w-3.5" />,
                },
                {
                  value: "ai",
                  label: t("optionsFlow.ai.title"),
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                },
              ]}
              size="md"
              variant="pills"
              className="!w-fit"
            />

            {/* Options Chain Tab */}
            <TabsContent value="chain" className="mt-3">
              <OptionsChainTable
                calls={chainData?.calls || []}
                puts={chainData?.puts || []}
                unusualContracts={unusualContracts}
                unusualMap={unusualMap}
                loading={chainLoading}
              />
            </TabsContent>

            {/* Unusual Activity Tab */}
            <TabsContent value="unusual" className="mt-3">
              <UnusualActivityTable data={unusualData} loading={scanning} useCollapsile={false} />
            </TabsContent>

            {/* AI Assistant Tab */}
            <TabsContent value="ai" className="mt-3 space-y-4">
              <OptionsAIAssistant data={unusualData} symbol={symbol} />
              <OptionsAIHistory symbol={symbol} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
