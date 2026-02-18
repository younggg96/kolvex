"use client";

import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OptionContract, UnusualActivityItem } from "@/lib/optionsFlowApi";

interface OptionsChainTableProps {
  calls: OptionContract[];
  puts: OptionContract[];
  unusualContracts: Set<string>;
  unusualMap: Map<string, UnusualActivityItem>;
  loading?: boolean;
}

function formatNum(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return val.toLocaleString();
}

function formatPrice(val: number | null | undefined): string {
  if (val == null || isNaN(val) || val === 0) return "—";
  return val.toFixed(2);
}

function formatIV(val: number | null | undefined): string {
  if (val == null || isNaN(val) || val === 0) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function formatChange(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}`;
}

function ContractRow({
  contract,
  isUnusual,
  unusualItem,
}: {
  contract: OptionContract;
  isUnusual: boolean;
  unusualItem?: UnusualActivityItem;
}) {
  return (
    <TableRow
      className={`text-xs transition-colors ${isUnusual ? "bg-primary/5 dark:bg-primary/5" : "hover:bg-muted/50"
        }`}
    >
      <TableCell className="text-right font-mono py-1.5 font-medium">
        {formatPrice(contract.strike)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5">
        {formatPrice(contract.last_price)}
      </TableCell>
      <TableCell
        className={`text-right font-mono py-1.5 ${contract.change > 0
          ? "text-green-600 dark:text-green-500"
          : contract.change < 0
            ? "text-red-600 dark:text-red-500"
            : "text-muted-foreground"
          }`}
      >
        {formatChange(contract.change)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5 text-muted-foreground">
        {formatPrice(contract.bid)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5 text-muted-foreground">
        {formatPrice(contract.ask)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5 font-medium">
        {formatNum(contract.volume)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5 text-muted-foreground">
        {formatNum(contract.open_interest)}
      </TableCell>
      <TableCell className="text-right font-mono py-1.5 text-muted-foreground">
        {formatIV(contract.implied_volatility)}
      </TableCell>
      <TableCell className="py-1.5 text-center">
        {isUnusual && unusualItem && (
          <Badge size="xxs" variant="secondary">
            {unusualItem.signal_strength}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

const TABLE_HEADERS = (
  <TableRow>
    <TableHead className="text-right text-[11px] w-[80px]">Strike</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">Last</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">Chg</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">Bid</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">Ask</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">Vol</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">OI</TableHead>
    <TableHead className="text-right text-[11px] w-[70px]">IV</TableHead>
    <TableHead className="text-[11px] w-[40px] text-center"></TableHead>
  </TableRow>
);

function ChainCard({
  label,
  contracts,
  prefix,
  unusualContracts,
  unusualMap,
  defaultOpen = false,
}: {
  label: string;
  contracts: OptionContract[];
  prefix: string;
  unusualContracts: Set<string>;
  unusualMap: Map<string, UnusualActivityItem>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalVol = contracts.reduce((s, c) => s + (c.volume || 0), 0);
  const totalOI = contracts.reduce((s, c) => s + (c.open_interest || 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              />
              <span className="font-semibold text-sm">{label}</span>
              <Badge variant="default" className="text-[10px] tabular-nums">
                {contracts.length} contracts
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span>Vol {totalVol.toLocaleString()}</span>
                <span>/</span>
                <span>OI {totalOI.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="!p-0 border-t dark:border-border-dark">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>{TABLE_HEADERS}</TableHeader>
                <TableBody>
                  {contracts.map((c, i) => {
                    const sym =
                      c.contract_symbol || `${prefix}-${c.strike}-${i}`;
                    return (
                      <ContractRow
                        key={sym}
                        contract={c}
                        isUnusual={unusualContracts.has(sym)}
                        unusualItem={unusualMap.get(sym)}
                      />
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

export function OptionsChainTable({
  calls,
  puts,
  unusualContracts,
  unusualMap,
  loading,
}: OptionsChainTableProps) {
  if (loading) {
    return (
      <div className="px-3 space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (calls.length === 0 && puts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No options data available for this expiration
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {calls.length > 0 && (
        <ChainCard
          label="Calls"
          contracts={calls}
          prefix="call"
          unusualContracts={unusualContracts}
          unusualMap={unusualMap}
          defaultOpen
        />
      )}
      {puts.length > 0 && (
        <ChainCard
          label="Puts"
          contracts={puts}
          prefix="put"
          unusualContracts={unusualContracts}
          unusualMap={unusualMap}
          defaultOpen
        />
      )}
    </div>
  );
}
