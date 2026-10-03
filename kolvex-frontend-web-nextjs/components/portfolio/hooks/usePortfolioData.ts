import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getConnectionStatus,
  getMyHoldings,
  getPublicHoldings,
  togglePublicSharing,
  togglePositionVisibility,
  getShareUrl,
} from "@/lib/portfolioApi";
import {
  createPlaidLinkToken,
  disconnectPlaid,
  exchangePlaidPublicToken,
  getPlaidInvestmentTransactions,
  getPlaidStatus,
  syncPlaidInvestments,
  type PlaidConnectionStatus,
  type PlaidInvestmentTransaction,
  type PlaidTransactionsResponse,
} from "@/lib/plaidApi";
import type {
  PortfolioConnectionStatus,
  PortfolioHoldings,
} from "../types";

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (
          publicToken: string,
          metadata: {
            institution?: { name?: string | null; institution_id?: string | null };
            accounts?: Array<{
              id: string;
              name?: string | null;
              mask?: string | null;
              type?: string | null;
              subtype?: string | null;
            }>;
          },
        ) => void;
        onExit?: (error: unknown) => void;
      }) => { open: () => void };
    };
  }
}

interface UsePortfolioDataOptions {
  userId?: string;
  isOwner: boolean;
}

const PORTFOLIO_CACHE_TTL_MS = 5 * 60 * 1000;
const PORTFOLIO_CACHE_PREFIX = "kolvex:portfolio";
const PLAID_LINK_SCRIPT_ID = "plaid-link-script";

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

interface PortfolioRootCache {
  status: PortfolioConnectionStatus | null;
  plaidStatus: PlaidConnectionStatus | null;
  holdings: PortfolioHoldings | null;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function getCacheKey(scope: string, parts: Array<string | number | undefined | null>) {
  return [PORTFOLIO_CACHE_PREFIX, scope, ...parts.map((part) => part ?? "all")].join(":");
}

function readCache<T>(key: string): T | null {
  const memoryEntry = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memoryEntry && Date.now() - memoryEntry.timestamp < PORTFOLIO_CACHE_TTL_MS) {
    return memoryEntry.data;
  }
  if (memoryEntry) memoryCache.delete(key);

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - parsed.timestamp > PORTFOLIO_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  const entry: CacheEnvelope<T> = { timestamp: Date.now(), data };
  memoryCache.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable in private browsing or quota pressure.
  }
}

function clearPortfolioCache(userId?: string) {
  const scope = `${PORTFOLIO_CACHE_PREFIX}:`;
  const userNeedle = userId ? `:${userId}:` : "";
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(scope) && (!userId || key.includes(userNeedle))) {
      memoryCache.delete(key);
    }
  }
  if (typeof window === "undefined") return;
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(scope) && (!userId || key.includes(userNeedle))) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

function loadPlaidLinkScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Plaid Link is only available in the browser"));
  }
  if (window.Plaid) return Promise.resolve();

  const existing = document.getElementById(PLAID_LINK_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Plaid Link")), {
        once: true,
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = PLAID_LINK_SCRIPT_ID;
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Plaid Link"));
    document.head.appendChild(script);
  });
}

export function usePortfolioData({ userId, isOwner }: UsePortfolioDataOptions) {
  const [status, setStatus] = useState<PortfolioConnectionStatus | null>(null);
  const [plaidStatus, setPlaidStatus] = useState<PlaidConnectionStatus | null>(null);
  const [transactions, setTransactions] = useState<PlaidInvestmentTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionsHasMore, setTransactionsHasMore] = useState(false);
  const [transactionSymbolFilter, setTransactionSymbolFilter] =
    useState<string | undefined>(undefined);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [holdings, setHoldings] = useState<PortfolioHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const transactionsPageSize = 100;
  const cacheUserId = userId || "me";

  const loadTransactions = useCallback(
    async (reset = false, offsetOverride = 0, forceRefresh = false) => {
      setLoadingTransactions(true);
      const offset = reset ? 0 : offsetOverride;
      const transactionsCacheKey = getCacheKey("plaid-transactions", [
        cacheUserId,
        transactionSymbolFilter,
        transactionsPageSize,
        offset,
      ]);
      try {
        const cached = !forceRefresh
          ? readCache<PlaidTransactionsResponse>(transactionsCacheKey)
          : null;
        const result =
          cached ||
          (await getPlaidInvestmentTransactions(
            transactionsPageSize,
            offset,
            transactionSymbolFilter,
          ));
        if (!cached) writeCache(transactionsCacheKey, result);
        setTransactions((prev) =>
          reset ? result.transactions : [...prev, ...result.transactions],
        );
        setTransactionsTotal(result.total);
        setTransactionsHasMore(result.has_more);
      } catch (error) {
        console.warn("Failed to load Plaid investment transactions:", error);
      } finally {
        setLoadingTransactions(false);
      }
    },
    [cacheUserId, transactionSymbolFilter],
  );

  const handleLoadMoreTransactions = useCallback(async () => {
    await loadTransactions(false, transactions.length);
  }, [loadTransactions, transactions.length]);

  const handleTransactionSymbolFilterChange = useCallback(
    async (symbol?: string) => {
      const normalizedSymbol = symbol?.trim().toUpperCase() || undefined;
      setTransactionSymbolFilter(normalizedSymbol);
      setTransactions([]);
      setTransactionsTotal(0);
      setTransactionsHasMore(false);
      setLoadingTransactions(true);
      const transactionsCacheKey = getCacheKey("plaid-transactions", [
        cacheUserId,
        normalizedSymbol,
        transactionsPageSize,
        0,
      ]);
      try {
        const cached = readCache<PlaidTransactionsResponse>(transactionsCacheKey);
        const result =
          cached ||
          (await getPlaidInvestmentTransactions(
            transactionsPageSize,
            0,
            normalizedSymbol,
          ));
        if (!cached) writeCache(transactionsCacheKey, result);
        setTransactions(result.transactions);
        setTransactionsTotal(result.total);
        setTransactionsHasMore(result.has_more);
      } catch (error) {
        console.warn("Failed to change Plaid transaction symbol filter:", error);
      } finally {
        setLoadingTransactions(false);
      }
    },
    [cacheUserId],
  );

  const loadData = useCallback(async (forceRefresh = false) => {
    const rootCacheKey = getCacheKey("root", [cacheUserId, isOwner ? "owner" : "public"]);
    const cachedRoot = forceRefresh ? null : readCache<PortfolioRootCache>(rootCacheKey);
    if (cachedRoot) {
      setStatus(cachedRoot.status);
      setHoldings(cachedRoot.holdings);
      setPlaidStatus(cachedRoot.plaidStatus);
      setLoading(false);
      if (isOwner && cachedRoot.plaidStatus?.is_connected) {
        await loadTransactions(true, 0, forceRefresh);
      }
      return;
    }

    setLoading(true);
    try {
      if (isOwner) {
        const [statusData, holdingsData, plaidData] = await Promise.all([
          getConnectionStatus(),
          getMyHoldings(),
          getPlaidStatus().catch(() => null),
        ]);
        const mergedStatus = plaidData?.is_connected
          ? {
              ...statusData,
              is_registered: true,
              is_connected: true,
              accounts_count: Math.max(
                statusData.accounts_count || 0,
                plaidData.accounts_count || 0,
              ),
              last_synced_at: plaidData.last_synced_at || statusData.last_synced_at,
            }
          : statusData;
        const mergedHoldings = {
          ...holdingsData,
          is_connected: holdingsData?.is_connected || Boolean(plaidData?.is_connected),
          last_synced_at: plaidData?.last_synced_at || holdingsData?.last_synced_at,
        };
        setStatus(mergedStatus);
        setHoldings(mergedHoldings);
        setPlaidStatus(plaidData);
        writeCache<PortfolioRootCache>(rootCacheKey, {
          status: mergedStatus,
          holdings: mergedHoldings,
          plaidStatus: plaidData,
        });
        if (plaidData?.is_connected) {
          await loadTransactions(true, 0, forceRefresh);
        }
      } else if (userId) {
        const publicHoldings = await getPublicHoldings(userId);
        if (publicHoldings) {
          const publicStatus = {
            is_registered: true,
            is_connected: true,
            is_public: true,
            accounts_count: publicHoldings.accounts.length,
          };
          const publicHoldingsView = {
            accounts: publicHoldings.accounts,
            last_synced_at: publicHoldings.last_synced_at,
            is_connected: true,
            is_public: true,
            total_value: publicHoldings.total_value ?? undefined,
            privacy_settings: publicHoldings.privacy_settings,
            hidden_positions_count: publicHoldings.hidden_positions_count,
          };
          setHoldings(publicHoldingsView);
          setStatus(publicStatus);
          writeCache<PortfolioRootCache>(rootCacheKey, {
            status: publicStatus,
            holdings: publicHoldingsView,
            plaidStatus: null,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [cacheUserId, isOwner, userId, loadTransactions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnectPlaid = useCallback(async () => {
    setConnecting(true);
    try {
      await loadPlaidLinkScript();
      const { link_token } = await createPlaidLinkToken();
      if (!window.Plaid) throw new Error("Plaid Link failed to initialize");

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          try {
            await exchangePlaidPublicToken({
              public_token: publicToken,
              institution: metadata.institution,
              accounts: metadata.accounts,
            });
            toast.info("Syncing Plaid investment holdings...");
            await syncPlaidInvestments();
            clearPortfolioCache(cacheUserId);
            await loadData(true);
            toast.success("Plaid Investments connected");
          } catch (error: any) {
            toast.error(error?.message || "Failed to finish Plaid connection");
          } finally {
            setConnecting(false);
          }
        },
        onExit: (error) => {
          if (error) console.warn("Plaid Link exited with error:", error);
          setConnecting(false);
        },
      });

      handler.open();
    } catch (error: any) {
      toast.error(error?.message || "Failed to open Plaid Link");
      setConnecting(false);
    }
  }, [cacheUserId, loadData]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPlaidInvestments();
      clearPortfolioCache(cacheUserId);
      await loadData(true);
      toast.success("Plaid investment data refreshed");
    } catch (error: any) {
      toast.error(error.message || "Refresh failed");
    } finally {
      setSyncing(false);
    }
  }, [cacheUserId, loadData]);

  const handleSyncTransactions = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPlaidInvestments();
      clearPortfolioCache(cacheUserId);
      await loadData(true);
      await loadTransactions(true, 0, true);
      toast.success("Plaid investment transactions synced");
    } catch (error: any) {
      toast.error(error.message || "Plaid sync failed");
    } finally {
      setSyncing(false);
    }
  }, [cacheUserId, loadData, loadTransactions]);

  const handleTogglePublic = useCallback(async (isPublic: boolean) => {
    try {
      await togglePublicSharing(isPublic);
      setHoldings((prev) => (prev ? { ...prev, is_public: isPublic } : null));
      clearPortfolioCache(cacheUserId);
      toast.success(
        isPublic ? "Portfolio is now public" : "Portfolio is now private",
      );
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  }, [cacheUserId]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectPlaid();
      clearPortfolioCache(cacheUserId);
      setStatus(null);
      setPlaidStatus(null);
      setHoldings(null);
      setTransactions([]);
      setTransactionsTotal(0);
      setTransactionsHasMore(false);
      toast.success("Plaid Investments disconnected");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
      return false;
    } finally {
      setDisconnecting(false);
    }
  }, [cacheUserId]);

  const handleCopyShareLink = useCallback(async () => {
    if (!userId) return;
    const url = getShareUrl(userId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }, [userId]);

  const handleTogglePositionVisibility = useCallback(
    async (
      e: React.MouseEvent,
      positionId: string,
      currentlyHidden: boolean,
    ) => {
      e.stopPropagation();
      try {
        await togglePositionVisibility(positionId, !currentlyHidden);
        setHoldings((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            accounts: prev.accounts.map((account) => ({
              ...account,
              portfolio_positions: account.portfolio_positions?.map((pos) =>
                pos.id === positionId
                  ? { ...pos, is_hidden: !currentlyHidden }
                  : pos,
              ),
            })),
          };
        });
        clearPortfolioCache(cacheUserId);
        toast.success(
          currentlyHidden
            ? "Position now visible"
            : "Position hidden from public",
        );
      } catch (error: any) {
        toast.error(error.message || "Failed to update visibility");
      }
    },
    [cacheUserId],
  );

  return {
    status,
    holdings,
    plaidStatus,
    transactions,
    transactionsTotal,
    transactionsHasMore,
    transactionSymbolFilter,
    loadingTransactions,
    loading,
    syncing,
    connecting,
    disconnecting,
    copied,
    loadData,
    handleConnectPlaid,
    loadTransactions,
    handleLoadMoreTransactions,
    handleTransactionSymbolFilterChange,
    handleSyncTransactions,
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  };
}
