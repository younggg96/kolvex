"use client";

import React from "react";
import { ChevronRight, Briefcase, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/common/EmptyState";
import { EquityPositionsTable } from "./EquityPositionsTable";
import { OptionPositionsTable } from "./OptionPositionsTable";
import { useTranslation } from "@/lib/i18n";
import type { PortfolioPosition, EquitySortKey, OptionSortKey } from "./types";
import type { PrivacySettings } from "@/lib/supabase/database.types";

interface PortfolioAccount {
  id: string;
  account_name?: string;
  account_number?: string;
  brokerage_name?: string;
  source?: string;
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
  onToggleVisibility: (e: React.MouseEvent, positionId: string, currentlyHidden: boolean) => void;
  // Owner-only: ask to remove this account
  onRemove?: () => void;
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
  onRemove,
}: AccountCardProps) {
  const { t } = useTranslation();
  const equityPositions =
    account.portfolio_positions?.filter((p) => p.position_type !== "option") || [];
  const optionPositions =
    account.portfolio_positions?.filter((p) => p.position_type === "option") || [];
  const accountPositions = account.portfolio_positions?.length || 0;

  const badges = (
    <>
      {account.source === "manual" && (
        <Badge variant="outline" className="whitespace-nowrap text-xs">
          {t("portfolio.manualImport.badge")}
        </Badge>
      )}
      <Badge variant="default" className="whitespace-nowrap text-xs">
        {t("portfolio.holdings.positions", { count: String(accountPositions) })}
      </Badge>
      {optionPositions.length > 0 && (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-primary/30 text-xs text-primary"
        >
          {t("portfolio.holdings.options", { count: String(optionPositions.length) })}
        </Badge>
      )}
    </>
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <ListCard className="overflow-hidden !p-0 sm:!p-0">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none transition-colors hover:bg-foreground/[0.06] py-2.5 px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-semibold">
                    {account.account_name || t("portfolio.holdings.brokerageAccount")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {account.account_number
                      ? `•••• ${account.account_number.slice(-4)}`
                      : account.source === "manual"
                        ? account.brokerage_name
                        : account.id.slice(0, 8)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">{badges}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-2 sm:flex">{badges}</span>
                {isOwner && onRemove && (
                  <Button
                    type="button"
                    variant="toolbar"
                    size="toolbar"
                    aria-label={t("portfolio.holdings.removeAccount")}
                    title={t("portfolio.holdings.removeAccount")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!px-0 !pb-0 !pt-0 border-t border-border">
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
              <EmptyState icon={Briefcase} title={t("portfolio.holdings.noPositions")} />
            )}
          </CardContent>
        </CollapsibleContent>
      </ListCard>
    </Collapsible>
  );
}
