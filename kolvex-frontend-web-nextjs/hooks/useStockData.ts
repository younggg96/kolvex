"use client";

import { useState, useEffect } from "react";
import { StockQuote, ChartData, StockOverview } from "@/lib/stockApi";

export function useStockQuote(symbol: string, refreshInterval?: number) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/stocks?action=quote&symbol=${symbol}`
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const quote = await response.json();
        setData(quote);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch stock data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [symbol, refreshInterval]);

  return { data, loading, error };
}

export function useMultipleQuotes(symbols: string[], refreshInterval?: number) {
  const [data, setData] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbols.length) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/stocks?action=multiple&symbols=${symbols.join(",")}`
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const quotes = await response.json();
        setData(quotes);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch stock data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [symbols.join(","), refreshInterval]);

  return { data, loading, error };
}

export function useChartData(symbol: string, interval: string = "5min") {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/stocks?action=chart&symbol=${symbol}&interval=${interval}`
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const chartData = await response.json();
        setData(chartData);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch chart data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, interval]);

  return { data, loading, error };
}

export function useStockOverview(symbol: string, refreshInterval?: number) {
  const [data, setData] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/stocks?action=overview&symbol=${symbol}`
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const overview = await response.json();
        setData(overview);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch stock overview"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (refreshInterval) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [symbol, refreshInterval]);

  return { data, loading, error };
}
