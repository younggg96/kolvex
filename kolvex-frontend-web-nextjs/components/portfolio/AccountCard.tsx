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
import type {
  SnapTradePosition,
  EquitySortKey,
  OptionSortKey,
} from "./types";

interface SnapTradeAccount {
  id: string;
  account_name?: string;
  account_number?: string;
  brokerage_name?: string;
  snaptrade_positions?: SnapTradePosition[];
}

interface AccountCardProps {
  account: SnapTradeAccount;
  isExpanded: boolean;
  onToggle: () => void;
  isOwner: boolean;
  isPublic: boolean;
  // Equity sorting
  equitySortKey: EquitySortKey | null;
  equitySortDir: "asc" | "desc";
  onEquitySort: (key: EquitySortKey) => void;
  sortEquityPositions: (positions: SnapTradePosition[]) => SnapTradePosition[];
  // Option sorting
  optionSortKey: OptionSortKey | null;
  optionSortDir: "asc" | "desc";
  onOptionSort: (key: OptionSortKey) => void;
  sortOptionPositions: (positions: SnapTradePosition[]) => SnapTradePosition[];
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
  const equityPositions =
    account.snaptrade_positions?.filter((p) => p.position_type !== "option") ||
    [];
  const optionPositions =
    account.snaptrade_positions?.filter((p) => p.position_type === "option") ||
    [];
  const accountPositions = account.snaptrade_positions?.length || 0;

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
                    {account.account_name || "Brokerage Account"}
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
                  {accountPositions} positions
                </Badge>
                {optionPositions.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs border-primary/30 text-primary"
                  >
                    {optionPositions.length} options
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!p-0 border-t dark:border-border-dark">
            {/* Equities */}
            <EquityPositionsTable
              positions={sortEquityPositions(equityPositions)}
              isOwner={isOwner}
              isPublic={isPublic}
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
                title="No Positions"
                description="This account has no active positions"
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

