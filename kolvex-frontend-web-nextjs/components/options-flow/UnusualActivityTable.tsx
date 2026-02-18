"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, TrendingUp, ExternalLink } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { useTranslation } from "@/lib/i18n";
import type { UnusualActivityItem } from "@/lib/optionsFlowApi";
import { cn } from "@/lib/utils";

interface UnusualActivityTableProps {
  data: UnusualActivityItem[];
  loading?: boolean;
  useCollapsile?: boolean;
  contentClassName?: string;
}

interface SymbolGroup {
  symbol: string;
  companyName: string;
  stockPrice: number;
  items: UnusualActivityItem[];
  totalPremium: number;
  callCount: number;
  putCount: number;
  maxStrength: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

const SIGNAL_I18N_KEYS: Record<string, string> = {
  high_vol_oi: "optionsFlow.signalVolOi",
  large_premium: "optionsFlow.signalPremium",
  high_volume: "optionsFlow.signalVolume",
  extreme_vol_oi: "optionsFlow.signalExtreme",
  whale_trade: "optionsFlow.signalWhale",
};

function StrengthBars({ strength }: { strength: number }) {
  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-sm ${i <= strength
            ? "bg-primary dark:bg-primary h-3"
            : "bg-border dark:bg-border-dark h-2"
            }`}
        />
      ))}
    </div>
  );
}

function SymbolGroupCard({ group, useCollapsile = true }: { group: SymbolGroup, useCollapsile?: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  if (!useCollapsile) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <CompanyLogo
              symbol={group.symbol}
              name={group.companyName || group.symbol}
              size="sm"
              shape="rounded"
              border="light"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{group.symbol}</span>
                {group.stockPrice > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    ${group.stockPrice.toFixed(2)}
                  </span>
                )}
              </div>
              {group.companyName && (
                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {group.companyName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StrengthBars strength={group.maxStrength} />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{group.callCount}C</span>
              <span>/</span>
              <span>{group.putCount}P</span>
            </div>
            <Badge variant="default" className="text-[10px] tabular-nums">
              {group.items.length} signals
            </Badge>
            <span className="text-xs font-medium font-mono min-w-[70px] text-right">
              {formatCurrency(group.totalPremium)}
            </span>
            <Link
              href={`/dashboard/options-flow/${group.symbol}`}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <CardContent className="!p-0 border-t dark:border-border-dark">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center text-[11px]">Signal</TableHead>
                  <TableHead className="w-[50px] text-center text-[11px]">Type</TableHead>
                  <TableHead className="w-[80px] text-right text-[11px]">Strike</TableHead>
                  <TableHead className="w-[90px] text-center text-[11px]">Exp</TableHead>
                  <TableHead className="w-[70px] text-right text-[11px]">Vol</TableHead>
                  <TableHead className="w-[70px] text-right text-[11px]">OI</TableHead>
                  <TableHead className="w-[70px] text-right text-[11px]">Vol/OI</TableHead>
                  <TableHead className="w-[70px] text-right text-[11px]">Price</TableHead>
                  <TableHead className="w-[90px] text-right text-[11px]">Premium</TableHead>
                  <TableHead className="w-[60px] text-right text-[11px]">IV</TableHead>
                  <TableHead className="w-[120px] text-[11px]">Signals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item, idx) => {
                  const isCall = item.option_type === "call";
                  return (
                    <TableRow
                      key={`${item.contract_symbol}-${idx}`}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="text-center">
                        <StrengthBars strength={item.signal_strength} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`text-[10px] font-medium ${isCall
                            ? "text-green-600 dark:text-green-500"
                            : "text-red-600 dark:text-red-500"
                            }`}
                        >
                          {isCall ? "CALL" : "PUT"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ${item.strike.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {item.expiration}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {formatNumber(item.volume)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatNumber(item.open_interest)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {item.vol_oi_ratio > 0 ? `${item.vol_oi_ratio}x` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ${item.last_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {formatCurrency(item.premium)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {(item.implied_volatility * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.signal_types.map((sig) => (
                            <Badge key={sig} size="xxs" variant="secondary">
                              {SIGNAL_I18N_KEYS[sig] ? t(SIGNAL_I18N_KEYS[sig]) : sig}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""
                  }`}
              />
              <CompanyLogo
                symbol={group.symbol}
                name={group.companyName || group.symbol}
                size="sm"
                shape="rounded"
                border="light"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{group.symbol}</span>
                  {group.stockPrice > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">
                      ${group.stockPrice.toFixed(2)}
                    </span>
                  )}
                </div>
                {group.companyName && (
                  <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                    {group.companyName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StrengthBars strength={group.maxStrength} />
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span>{group.callCount}C</span>
                <span>/</span>
                <span>{group.putCount}P</span>
              </div>
              <Badge variant="default" className="text-[10px] tabular-nums">
                {group.items.length} signals
              </Badge>
              <span className="text-xs font-medium font-mono min-w-[70px] text-right">
                {formatCurrency(group.totalPremium)}
              </span>
              <Link
                href={`/dashboard/options-flow/${group.symbol}`}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="!p-0 border-t dark:border-border-dark">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] text-center text-[11px]">Signal</TableHead>
                    <TableHead className="w-[50px] text-center text-[11px]">Type</TableHead>
                    <TableHead className="w-[80px] text-right text-[11px]">Strike</TableHead>
                    <TableHead className="w-[90px] text-center text-[11px]">Exp</TableHead>
                    <TableHead className="w-[70px] text-right text-[11px]">Vol</TableHead>
                    <TableHead className="w-[70px] text-right text-[11px]">OI</TableHead>
                    <TableHead className="w-[70px] text-right text-[11px]">Vol/OI</TableHead>
                    <TableHead className="w-[70px] text-right text-[11px]">Price</TableHead>
                    <TableHead className="w-[90px] text-right text-[11px]">Premium</TableHead>
                    <TableHead className="w-[60px] text-right text-[11px]">IV</TableHead>
                    <TableHead className="w-[120px] text-[11px]">Signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item, idx) => {
                    const isCall = item.option_type === "call";
                    return (
                      <TableRow
                        key={`${item.contract_symbol}-${idx}`}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="text-center">
                          <StrengthBars strength={item.signal_strength} />
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`text-[10px] font-medium ${isCall
                              ? "text-green-600 dark:text-green-500"
                              : "text-red-600 dark:text-red-500"
                              }`}
                          >
                            {isCall ? "CALL" : "PUT"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${item.strike.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.expiration}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {formatNumber(item.volume)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatNumber(item.open_interest)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {item.vol_oi_ratio > 0 ? `${item.vol_oi_ratio}x` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${item.last_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {formatCurrency(item.premium)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {(item.implied_volatility * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.signal_types.map((sig) => (
                              <Badge key={sig} size="xxs" variant="secondary">
                                {SIGNAL_I18N_KEYS[sig] ? t(SIGNAL_I18N_KEYS[sig]) : sig}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function UnusualActivityTable({
  data,
  loading,
  useCollapsile = true,
  contentClassName,
}: UnusualActivityTableProps) {
  // Group data by symbol
  const groups = useMemo(() => {
    const map = new Map<string, SymbolGroup>();

    for (const item of data) {
      let group = map.get(item.symbol);
      if (!group) {
        group = {
          symbol: item.symbol,
          companyName: item.company_name || "",
          stockPrice: item.stock_price || 0,
          items: [],
          totalPremium: 0,
          callCount: 0,
          putCount: 0,
          maxStrength: 0,
        };
        map.set(item.symbol, group);
      }
      group.items.push(item);
      group.totalPremium += item.premium || 0;
      if (item.option_type === "call") group.callCount++;
      else group.putCount++;
      if (item.signal_strength > group.maxStrength)
        group.maxStrength = item.signal_strength;
      if (item.stock_price > 0) group.stockPrice = item.stock_price;
      if (item.company_name) group.companyName = item.company_name;
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalPremium - a.totalPremium
    );
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No unusual options activity found</p>
        <p className="text-xs mt-1 opacity-60">
          Try adjusting filters or scanning different symbols
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", contentClassName)}>
      {groups.map((group) => (
        <SymbolGroupCard key={group.symbol} group={group} useCollapsile={useCollapsile} />
      ))}
    </div>
  );
}
