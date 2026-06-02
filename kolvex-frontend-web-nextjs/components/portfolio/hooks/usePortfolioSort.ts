import { useState, useCallback, useMemo } from "react";
import type { SnapTradePosition, EquitySortKey, OptionSortKey } from "../types";

const OPTION_CONTRACT_MULTIPLIER = 100;

function normalizeOptionCost(rawAveragePrice: number, currentPremium: number) {
  if (!Number.isFinite(rawAveragePrice) || rawAveragePrice <= 0) {
    return { premiumPerShare: 0, costPerContract: 0 };
  }

  const looksLikeContractCost =
    rawAveragePrice > 50 ||
    (currentPremium > 0 && rawAveragePrice > currentPremium * 10);
  const premiumPerShare = looksLikeContractCost
    ? rawAveragePrice / OPTION_CONTRACT_MULTIPLIER
    : rawAveragePrice;

  return {
    premiumPerShare,
    costPerContract: premiumPerShare * OPTION_CONTRACT_MULTIPLIER,
  };
}

function getOptionMetrics(position: SnapTradePosition) {
  const signedContracts = Number(position.units || 0);
  const contracts = Math.abs(signedContracts);
  const currentPremium = Math.abs(Number(position.price || 0));
  const { premiumPerShare, costPerContract } = normalizeOptionCost(
    Math.abs(Number(position.average_purchase_price || 0)),
    currentPremium
  );
  const marketValue = currentPremium * contracts * OPTION_CONTRACT_MULTIPLIER;
  const totalCost = costPerContract * contracts;
  const isShort =
    signedContracts < 0 || (!signedContracts && (position.weight_percent || 0) < 0);
  const pnl = isShort ? totalCost - marketValue : marketValue - totalCost;
  const pnlPerShare =
    contracts > 0 ? pnl / (contracts * OPTION_CONTRACT_MULTIPLIER) : 0;

  return {
    contracts,
    marketValue,
    totalCost,
    pnl,
    pnlPerShare,
    costPerContract,
    premiumPerShare,
  };
}

export function useEquitySort() {
  const [sortKey, setSortKey] = useState<EquitySortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback(
    (key: EquitySortKey) => {
      if (sortKey === key) {
        // Same key clicked: desc -> asc -> clear
        if (sortDir === "desc") {
          setSortDir("asc");
        } else {
          // Currently asc, third click clears sorting
          setSortKey(null);
          setSortDir("desc");
        }
      } else {
        // New key: start with desc
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey, sortDir]
  );

  const sortPositions = useCallback(
    (positions: SnapTradePosition[]) => {
      if (!sortKey) return positions;
      return [...positions].sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;
        switch (sortKey) {
          case "symbol":
            aVal = a.symbol || "";
            bVal = b.symbol || "";
            break;
          case "price":
            aVal = a.price || 0;
            bVal = b.price || 0;
            break;
          case "cost":
            aVal = a.average_purchase_price || 0;
            bVal = b.average_purchase_price || 0;
            break;
          case "units":
            aVal = a.units || 0;
            bVal = b.units || 0;
            break;
          case "value":
            aVal = (a.price || 0) * a.units;
            bVal = (b.price || 0) * b.units;
            break;
          case "pnl":
            aVal = a.open_pnl || 0;
            bVal = b.open_pnl || 0;
            break;
          case "pnl_per_share":
            aVal = (a.price || 0) - (a.average_purchase_price || 0);
            bVal = (b.price || 0) - (b.average_purchase_price || 0);
            break;
          case "weight":
            aVal = a.weight_percent || 0;
            bVal = b.weight_percent || 0;
            break;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortDir === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    },
    [sortKey, sortDir]
  );

  return { sortKey, sortDir, handleSort, sortPositions };
}

export function useOptionSort() {
  const [sortKey, setSortKey] = useState<OptionSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback(
    (key: OptionSortKey) => {
      if (sortKey === key) {
        // Same key clicked: desc -> asc -> clear
        if (sortDir === "desc") {
          setSortDir("asc");
        } else {
          // Currently asc, third click clears sorting
          setSortKey(null);
          setSortDir("desc");
        }
      } else {
        // New key: start with desc
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey, sortDir]
  );

  const sortPositions = useCallback(
    (positions: SnapTradePosition[]) => {
      if (!sortKey) return positions;
      return [...positions].sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;
        switch (sortKey) {
          case "symbol":
            aVal = a.underlying_symbol || a.symbol || "";
            bVal = b.underlying_symbol || b.symbol || "";
            break;
          case "expiration_date":
            // Sort by expiration date (earliest first for asc)
            aVal = a.expiration_date ? new Date(a.expiration_date).getTime() : 0;
            bVal = b.expiration_date ? new Date(b.expiration_date).getTime() : 0;
            break;
          case "strike":
            aVal = a.strike_price || 0;
            bVal = b.strike_price || 0;
            break;
          case "price":
            aVal = a.price || 0;
            bVal = b.price || 0;
            break;
          case "cost":
            aVal = getOptionMetrics(a).costPerContract;
            bVal = getOptionMetrics(b).costPerContract;
            break;
          case "units":
            aVal = getOptionMetrics(a).contracts;
            bVal = getOptionMetrics(b).contracts;
            break;
          case "value":
            aVal = getOptionMetrics(a).marketValue;
            bVal = getOptionMetrics(b).marketValue;
            break;
          case "pnl":
            aVal = getOptionMetrics(a).pnl;
            bVal = getOptionMetrics(b).pnl;
            break;
          case "pnl_per_share":
            aVal = getOptionMetrics(a).pnlPerShare;
            bVal = getOptionMetrics(b).pnlPerShare;
            break;
          case "weight":
            aVal = a.weight_percent || 0;
            bVal = b.weight_percent || 0;
            break;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortDir === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    },
    [sortKey, sortDir]
  );

  return { sortKey, sortDir, handleSort, sortPositions };
}
