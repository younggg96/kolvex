"use client";

import React from "react";
import { ChevronRight, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/common/EmptyState";
import { EquityPositionsTable } from "./EquityPositionsTable";
import { OptionPositionsTable } from "./OptionPositionsTable";
import { useTranslation } from "@/lib/i18n";
import type {
  PortfolioPosition,
  EquitySortKey,
  OptionSortKey,
} from "./types";
import type { PrivacySettings } from "@/lib/supabase/database.types";

interface PortfolioAccount {
  id: string;
  account_name?: string;
  account_number?: string;
  brokerage_name?: string;
  portfolio_positions?: PortfolioPosition[];
}

interface AccountCardProps {
  account: PortfolioAccount;
  isExpanded: boolean;
  onToggle: () => void;
  isOwner: boolean;
  isPublic: boolean;
  privacySettings?: PrivacySettings;
  // Equity sorting
  equitySortKey: EquitySortKey | null;
  equitySortDir: "asc" | "desc";
  onEquitySort: (key: EquitySortKey) => void;
  sortEquityPositions: (positions: PortfolioPosition[]) => PortfolioPosition[];
  // Option sorting
  optionSortKey: OptionSortKey | null;
  optionSortDir: "asc" | "desc";
  onOptionSort: (key: OptionSortKey) => void;
  sortOptionPositions: (positions: PortfolioPosition[]) => PortfolioPosition[];
  // Sparkline data
  sparklineDataMap: Map<string, number[]>;
  // Visibility toggle
  onToggleVisibility: (
    e: React.MouseEvent,
    positionId: string,
    currentlyHidden: boolean
  ) => void;
}

export function AccountCard({
  account,
  isExpanded,
  onToggle,
  isOwner,
  isPublic,
  privacySettings,
  equitySortKey,
  equitySortDir,
  onEquitySort,
  sortEquityPositions,
  optionSortKey,
  optionSortDir,
  onOptionSort,
  sortOptionPositions,
  sparklineDataMap,
  onToggleVisibility,
}: AccountCardProps) {
  const { t } = useTranslation();
  const equityPositions =
    account.portfolio_positions?.filter((p) => p.position_type !== "option") ||
    [];
  const optionPositions =
    account.portfolio_positions?.filter((p) => p.position_type === "option") ||
    [];
  const accountPositions = account.portfolio_positions?.length || 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-primary/10 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {account.account_name || t("portfolio.holdings.brokerageAccount")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {account.account_number
                      ? `•••• ${account.account_number.slice(-4)}`
                      : account.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  {t("portfolio.holdings.positions", { count: String(accountPositions) })}
                </Badge>
                {optionPositions.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs border-primary/30 text-primary"
                  >
                    {t("portfolio.holdings.options", { count: String(optionPositions.length) })}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!p-0 border-t border-border">
            {/* Equities */}
            <EquityPositionsTable
              positions={sortEquityPositions(equityPositions)}
              isOwner={isOwner}
              isPublic={isPublic}
              privacySettings={privacySettings}
              sortKey={equitySortKey}
              sortDir={equitySortDir}
              onSort={onEquitySort}
              sparklineDataMap={sparklineDataMap}
              onToggleVisibility={onToggleVisibility}
            />

            {/* Options */}
            {optionPositions.length > 0 && (
              <OptionPositionsTable
                positions={sortOptionPositions(optionPositions)}
                isOwner={isOwner}
                isPublic={isPublic}
                privacySettings={privacySettings}
                sortKey={optionSortKey}
                sortDir={optionSortDir}
                onSort={onOptionSort}
                sparklineDataMap={sparklineDataMap}
                onToggleVisibility={onToggleVisibility}
              />
            )}

            {/* Empty */}
            {accountPositions === 0 && (
              <EmptyState
                icon={Briefcase}
                title={t("portfolio.holdings.noPositions")}
                description={t("portfolio.holdings.noPositionsDesc")}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

