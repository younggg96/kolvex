import { useState, useCallback, useMemo } from "react";
import type { SnapTradePosition, EquitySortKey, OptionSortKey } from "../types";

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
          case "units":
            aVal = a.units || 0;
            bVal = b.units || 0;
            break;
          case "value":
            aVal = (a.price || 0) * a.units * 100;
            bVal = (b.price || 0) * b.units * 100;
            break;
          case "pnl":
            const aCost = (a.average_purchase_price || 0) * a.units;
            const bCost = (b.average_purchase_price || 0) * b.units;
            aVal = (a.price || 0) * a.units * 100 - aCost;
            bVal = (b.price || 0) * b.units * 100 - bCost;
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

