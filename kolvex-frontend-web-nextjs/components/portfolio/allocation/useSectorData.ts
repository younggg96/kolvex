"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import type { SnapTradePosition } from "@/lib/supabase/database.types";
import type {
  SectorData,
  PositionInfo,
  AggregatedPosition,
  SortKey,
  SortDirection,
} from "./types";
import { getSectorColor } from "./constants";
import { parseOptionSymbol, getUnderlyingSymbol } from "./utils";

interface UseSectorDataOptions {
  holdings: SnapTradePosition[];
  sortKey: SortKey;
  sortDir: SortDirection;
  // Optional: use cached sector data from parent (avoids duplicate fetches)
  cachedSectorMap?: Map<string, string>;
}

interface UseSectorDataResult {
  sectorData: SectorData[];
  totalValue: number;
  loading: boolean;
  // Symbols that need sector data
  requiredSymbols: string[];
}

export function useSectorData({
  holdings,
  sortKey,
  sortDir,
  cachedSectorMap,
}: UseSectorDataOptions): UseSectorDataResult {
  const [localSectorMap, setLocalSectorMap] = useState<Map<string, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  // Get unique symbols from holdings
  const requiredSymbols = useMemo(() => {
    const symbols = new Set<string>();
    holdings.forEach((pos) => {
      if (pos.is_hidden) return;
      const sym = getUnderlyingSymbol(
        pos.symbol,
        pos.underlying_symbol,
        pos.position_type === "option"
      );
      if (sym) symbols.add(sym.trim().toUpperCase());
    });
    return Array.from(symbols);
  }, [holdings]);

  // Create a stable key for symbols to prevent infinite loops
  const symbolsKey = useMemo(
    () => requiredSymbols.sort().join(","),
    [requiredSymbols]
  );

  // Use cached map if provided, otherwise use local map
  const sectorMap = cachedSectorMap || localSectorMap;

  // Check if we're using parent's cached data
  const usingParentCache = !!cachedSectorMap;

  // Fetch sectors when holdings change - only if not using parent cache
  useEffect(() => {
    // If using parent's cached data, skip fetching - parent handles it
    if (usingParentCache) {
      setLoading(false);
      return;
    }

    if (requiredSymbols.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const newMap = new Map<string, string>();
      const batchSize = 5;

      for (let i = 0; i < requiredSymbols.length; i += batchSize) {
        if (cancelled) return;
        const batch = requiredSymbols.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (normalizedSymbol) => {
            try {
              const res = await fetch(
                `/api/stocks?action=overview&symbol=${normalizedSymbol}`
              );
              if (res.ok) {
                const data = await res.json();
                if (data.company?.sector) {
                  newMap.set(normalizedSymbol, data.company.sector);
                }
              }
            } catch (error) {
              console.error(
                `Failed to fetch sector for ${normalizedSymbol}:`,
                error
              );
            }
          })
        );
      }

      if (!cancelled) {
        setLocalSectorMap(newMap);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // Use symbolsKey for stable dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, usingParentCache]);

  // Process holdings into sector allocation data with aggregation to avoid duplicates
  const sectorData = useMemo(() => {
    // First, deduplicate holdings by id to handle any API-level duplicates
    const seenIds = new Set<string>();
    const deduplicatedHoldings = holdings.filter((pos) => {
      if (seenIds.has(pos.id)) {
        return false;
      }
      seenIds.add(pos.id);
      return true;
    });

    const sectors: Record<
      string,
      {
        name: string;
        value: number;
        invested: number;
        gain: number;
        gainPercent: number;
        count: number;
        color: string;
        // Use a Map to aggregate positions by displaySymbol
        positionMap: Map<string, AggregatedPosition>;
      }
    > = {};

    deduplicatedHoldings.forEach((pos) => {
      if (pos.is_hidden) return;

      const isOption = pos.position_type === "option";
      const marketValue =
        pos.market_value ?? (pos.price ?? 0) * pos.units * (isOption ? 100 : 1);
      const costBasis =
        (pos.average_purchase_price ?? 0) * pos.units * (isOption ? 1 : 1);
      const gain = pos.open_pnl ?? marketValue - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

      // Determine sector - use underlying symbol for options
      // Normalize the symbol to ensure consistent aggregation (trim whitespace, uppercase)
      const rawDisplaySymbol = getUnderlyingSymbol(
        pos.symbol,
        pos.underlying_symbol,
        isOption
      );
      const displaySymbol = rawDisplaySymbol.trim().toUpperCase();
      let sector = sectorMap.get(displaySymbol) || "Other";

      // Check if it's an ETF/Fund (simple heuristic)
      if (
        pos.security_name?.toLowerCase().includes("etf") ||
        pos.security_name?.toLowerCase().includes("fund") ||
        pos.security_name?.toLowerCase().includes("index")
      ) {
        sector = "Funds";
      }

      if (!sectors[sector]) {
        sectors[sector] = {
          name: sector,
          value: 0,
          invested: 0,
          gain: 0,
          gainPercent: 0,
          count: 0,
          color: getSectorColor(sector, Object.keys(sectors).length),
          positionMap: new Map(),
        };
      }

      sectors[sector].value += marketValue;
      sectors[sector].invested += costBasis;
      sectors[sector].gain += gain;
      sectors[sector].count += 1;

      // Parse option info if applicable
      const optionInfo = isOption ? parseOptionSymbol(pos.symbol) : null;

      // Create position info
      const positionInfo: PositionInfo = {
        symbol: pos.symbol,
        displaySymbol,
        securityName: pos.security_name,
        value: marketValue,
        invested: costBasis,
        gain,
        gainPercent,
        isOption,
        optionType: optionInfo?.type,
        positionDirection: pos.units >= 0 ? "long" : "short",
        units: pos.units,
        price: pos.price ?? 0,
      };

      // Aggregate by displaySymbol to avoid duplicates
      const existingAgg = sectors[sector].positionMap.get(displaySymbol);
      if (existingAgg) {
        existingAgg.value += marketValue;
        existingAgg.invested += costBasis;
        existingAgg.gain += gain;
        existingAgg.subPositions.push(positionInfo);
        existingAgg.hasOptions = existingAgg.hasOptions || isOption;
        existingAgg.hasEquity = existingAgg.hasEquity || !isOption;
      } else {
        sectors[sector].positionMap.set(displaySymbol, {
          displaySymbol,
          securityName: pos.security_name,
          value: marketValue,
          invested: costBasis,
          gain,
          gainPercent,
          subPositions: [positionInfo],
          hasOptions: isOption,
          hasEquity: !isOption,
        });
      }
    });

    // Convert positionMap to positions array and calculate gain percent
    const result: SectorData[] = Object.values(sectors).map((sector) => {
      const positions = Array.from(sector.positionMap.values()).map((agg) => ({
        ...agg,
        gainPercent: agg.invested > 0 ? (agg.gain / agg.invested) * 100 : 0,
      }));

      // Sort positions within sector by value descending
      positions.sort((a, b) => b.value - a.value);

      return {
        name: sector.name,
        value: sector.value,
        invested: sector.invested,
        gain: sector.gain,
        gainPercent:
          sector.invested > 0 ? (sector.gain / sector.invested) * 100 : 0,
        count: positions.length, // Count unique symbols, not individual positions
        color: sector.color,
        positions,
      };
    });

    // Sort sectors by the selected key
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case "value":
          aVal = a.value;
          bVal = b.value;
          break;
        case "gain":
          aVal = a.gainPercent;
          bVal = b.gainPercent;
          break;
        case "allocation":
        default:
          aVal = a.value;
          bVal = b.value;
          break;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [holdings, sectorMap, sortKey, sortDir]);

  // Calculate total value
  const totalValue = useMemo(
    () => sectorData.reduce((acc, s) => acc + s.value, 0),
    [sectorData]
  );

  return { sectorData, totalValue, loading, requiredSymbols };
}
