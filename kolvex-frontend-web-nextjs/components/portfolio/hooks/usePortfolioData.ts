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
  connectRobinhood as connectRobinhoodBroker,
  disconnectRobinhood,
  getRobinhoodOptionOrders,
  getRobinhoodOrders,
  getRobinhoodStatus,
  resetRobinhoodAuth,
  syncRobinhood,
  waitForRobinhoodSync,
  type RobinhoodOrder,
  type RobinhoodOptionOrder,
  type RobinhoodStatus,
} from "@/lib/robinhoodApi";
import {
  connectIbkr,
  disconnectIbkr,
  getIbkrHoldings,
  getIbkrOrders,
  getIbkrStatus,
  syncIbkr,
  type IBKRStatus,
} from "@/lib/ibkrApi";
import type {
  PortfolioConnectionStatus,
  PortfolioHoldings,
} from "../types";

interface UsePortfolioDataOptions {
  userId?: string;
  isOwner: boolean;
}

const PORTFOLIO_CACHE_TTL_MS = 5 * 60 * 1000;
const PORTFOLIO_CACHE_PREFIX = "kolvex:portfolio";

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

interface PortfolioRootCache {
  status: PortfolioConnectionStatus | null;
  robinhoodStatus: RobinhoodStatus | null;
  ibkrStatus: IBKRStatus | null;
  holdings: PortfolioHoldings | null;
}

type RobinhoodOrdersPayload = Awaited<ReturnType<typeof getRobinhoodOrders>>;
type RobinhoodOptionOrdersPayload = Awaited<ReturnType<typeof getRobinhoodOptionOrders>>;

function transactionTime(order: RobinhoodOrder | RobinhoodOptionOrder) {
  return new Date(order.executed_time || order.created_time || 0).getTime();
}

async function getCombinedStockOrders(
  limit: number,
  offset: number,
  symbol: string | undefined,
  status: string
): Promise<RobinhoodOrdersPayload> {
  const [robinhood, ibkr] = await Promise.all([
    getRobinhoodOrders(limit, offset, symbol, status),
    status === "filled" || status === "all"
      ? getIbkrOrders("stocks", limit, offset, symbol).catch(() => null)
      : Promise.resolve(null),
  ]);
  const ibkrOrders = (ibkr?.orders || []) as RobinhoodOrder[];
  return {
    ...robinhood,
    orders: [...robinhood.orders, ...ibkrOrders].sort(
      (a, b) => transactionTime(b) - transactionTime(a)
    ),
    total: robinhood.total + (ibkr?.total || 0),
    has_more: robinhood.has_more || Boolean(ibkr?.has_more),
  };
}

async function getCombinedOptionOrders(
  limit: number,
  offset: number,
  symbol: string | undefined,
  status: string
): Promise<RobinhoodOptionOrdersPayload> {
  const [robinhood, ibkr] = await Promise.all([
    getRobinhoodOptionOrders(limit, offset, symbol, status),
    status === "filled" || status === "all"
      ? getIbkrOrders("options", limit, offset, symbol).catch(() => null)
      : Promise.resolve(null),
  ]);
  const ibkrOrders = (ibkr?.orders || []) as RobinhoodOptionOrder[];
  return {
    ...robinhood,
    orders: [...robinhood.orders, ...ibkrOrders].sort(
      (a, b) => transactionTime(b) - transactionTime(a)
    ),
    total: robinhood.total + (ibkr?.total || 0),
    has_more: robinhood.has_more || Boolean(ibkr?.has_more),
  };
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

export function usePortfolioData({ userId, isOwner }: UsePortfolioDataOptions) {
  const [status, setStatus] = useState<PortfolioConnectionStatus | null>(null);
  const [robinhoodStatus, setRobinhoodStatus] =
    useState<RobinhoodStatus | null>(null);
  const [ibkrStatus, setIbkrStatus] = useState<IBKRStatus | null>(null);
  const [robinhoodOrders, setRobinhoodOrders] = useState<RobinhoodOrder[]>([]);
  const [robinhoodOptionOrders, setRobinhoodOptionOrders] = useState<
    RobinhoodOptionOrder[]
  >([]);
  const [robinhoodOptionOrdersTotal, setRobinhoodOptionOrdersTotal] = useState(0);
  const [robinhoodOptionOrdersHasMore, setRobinhoodOptionOrdersHasMore] =
    useState(false);
  const [robinhoodOptionOrdersError, setRobinhoodOptionOrdersError] =
    useState<string | null>(null);
  const [robinhoodOrdersTotal, setRobinhoodOrdersTotal] = useState(0);
  const [robinhoodOrdersHasMore, setRobinhoodOrdersHasMore] = useState(false);
  const [robinhoodWashSaleRisks, setRobinhoodWashSaleRisks] = useState<
    Awaited<ReturnType<typeof getRobinhoodOrders>>["wash_sale_risk_symbols"]
  >([]);
  const [robinhoodOrderStatusFilter, setRobinhoodOrderStatusFilter] =
    useState("filled");
  const [robinhoodOrderSymbolFilter, setRobinhoodOrderSymbolFilter] =
    useState<string | undefined>(undefined);
  const [loadingRobinhoodOrders, setLoadingRobinhoodOrders] = useState(false);
  const [loadingRobinhoodOptionOrders, setLoadingRobinhoodOptionOrders] =
    useState(false);
  const [holdings, setHoldings] = useState<PortfolioHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [resettingRobinhoodAuth, setResettingRobinhoodAuth] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const robinhoodOrdersPageSize = 100;
  const cacheUserId = userId || "me";

  const loadRobinhoodOrders = useCallback(
    async (reset = false, offsetOverride = 0, forceRefresh = false) => {
      setLoadingRobinhoodOrders(true);
      const offset = reset ? 0 : offsetOverride;
      const ordersCacheKey = getCacheKey("robinhood-orders", [
        cacheUserId,
        robinhoodOrderStatusFilter,
        robinhoodOrderSymbolFilter,
        robinhoodOrdersPageSize,
        offset,
      ]);
      try {
        const cached = !forceRefresh
          ? readCache<RobinhoodOrdersPayload>(ordersCacheKey)
          : null;
        const result =
          cached ||
          (await getCombinedStockOrders(
            robinhoodOrdersPageSize,
            offset,
            robinhoodOrderSymbolFilter,
            robinhoodOrderStatusFilter
          ));
        if (!cached) writeCache(ordersCacheKey, result);
        setRobinhoodOrders((prev) =>
          reset ? result.orders : [...prev, ...result.orders]
        );
        setRobinhoodOrdersTotal(result.total);
        setRobinhoodOrdersHasMore(result.has_more);
        setRobinhoodWashSaleRisks(result.wash_sale_risk_symbols || []);
      } catch (error) {
        console.warn("Failed to load Robinhood orders:", error);
      } finally {
        setLoadingRobinhoodOrders(false);
      }
    },
    [cacheUserId, robinhoodOrderStatusFilter, robinhoodOrderSymbolFilter]
  );

  const handleLoadMoreRobinhoodOrders = useCallback(async () => {
    await loadRobinhoodOrders(false, robinhoodOrders.length);
  }, [loadRobinhoodOrders, robinhoodOrders.length]);

  const loadRobinhoodOptionOrders = useCallback(
    async (
      reset = false,
      offsetOverride = 0,
      forceRefresh = false,
      filters?: { symbol?: string; status?: string }
    ) => {
      setLoadingRobinhoodOptionOrders(true);
      const offset = reset ? 0 : offsetOverride;
      const symbol = filters?.symbol ?? robinhoodOrderSymbolFilter;
      const status = filters?.status ?? robinhoodOrderStatusFilter;
      const ordersCacheKey = getCacheKey("robinhood-option-orders", [
        cacheUserId,
        status,
        symbol,
        robinhoodOrdersPageSize,
        offset,
      ]);
      try {
        const cached = !forceRefresh
          ? readCache<RobinhoodOptionOrdersPayload>(ordersCacheKey)
          : null;
        const result =
          cached ||
          (await getCombinedOptionOrders(
            robinhoodOrdersPageSize,
            offset,
            symbol,
            status
          ));
        if (!cached) writeCache(ordersCacheKey, result);
        setRobinhoodOptionOrders((prev) =>
          reset ? result.orders : [...prev, ...result.orders]
        );
        setRobinhoodOptionOrdersTotal(result.total);
        setRobinhoodOptionOrdersHasMore(result.has_more);
        setRobinhoodOptionOrdersError(null);
      } catch (error: any) {
        const message = error?.message || "Failed to load Robinhood option orders";
        setRobinhoodOptionOrdersError(message);
        if (!message.includes("migration has not been applied")) {
          console.warn("Failed to load Robinhood option orders:", error);
        }
      } finally {
        setLoadingRobinhoodOptionOrders(false);
      }
    },
    [cacheUserId, robinhoodOrderStatusFilter, robinhoodOrderSymbolFilter]
  );

  const handleLoadMoreRobinhoodOptionOrders = useCallback(async () => {
    await loadRobinhoodOptionOrders(false, robinhoodOptionOrders.length);
  }, [loadRobinhoodOptionOrders, robinhoodOptionOrders.length]);

  const handleRobinhoodOrderStatusFilterChange = useCallback(
    async (statusFilter: string) => {
      setRobinhoodOrderStatusFilter(statusFilter);
      setRobinhoodOrders([]);
      setRobinhoodOrdersTotal(0);
      setRobinhoodOrdersHasMore(false);
      setLoadingRobinhoodOrders(true);
      const ordersCacheKey = getCacheKey("robinhood-orders", [
        cacheUserId,
        statusFilter,
        robinhoodOrderSymbolFilter,
        robinhoodOrdersPageSize,
        0,
      ]);
      try {
        const cached = readCache<RobinhoodOrdersPayload>(ordersCacheKey);
        const result =
          cached ||
          (await getCombinedStockOrders(
            robinhoodOrdersPageSize,
            0,
            robinhoodOrderSymbolFilter,
            statusFilter
          ));
        if (!cached) writeCache(ordersCacheKey, result);
        setRobinhoodOrders(result.orders);
        setRobinhoodOrdersTotal(result.total);
        setRobinhoodOrdersHasMore(result.has_more);
        setRobinhoodWashSaleRisks(result.wash_sale_risk_symbols || []);
        void loadRobinhoodOptionOrders(true, 0, false, {
          symbol: robinhoodOrderSymbolFilter,
          status: statusFilter,
        });
      } catch (error) {
        console.warn("Failed to change Robinhood order status filter:", error);
      } finally {
        setLoadingRobinhoodOrders(false);
      }
    },
    [cacheUserId, loadRobinhoodOptionOrders, robinhoodOrderSymbolFilter]
  );

  const handleRobinhoodOrderSymbolFilterChange = useCallback(
    async (symbol?: string) => {
      const normalizedSymbol = symbol?.trim().toUpperCase() || undefined;
      setRobinhoodOrderSymbolFilter(normalizedSymbol);
      setRobinhoodOrders([]);
      setRobinhoodOrdersTotal(0);
      setRobinhoodOrdersHasMore(false);
      setLoadingRobinhoodOrders(true);
      const ordersCacheKey = getCacheKey("robinhood-orders", [
        cacheUserId,
        robinhoodOrderStatusFilter,
        normalizedSymbol,
        robinhoodOrdersPageSize,
        0,
      ]);
      try {
        const cached = readCache<RobinhoodOrdersPayload>(ordersCacheKey);
        const result =
          cached ||
          (await getCombinedStockOrders(
            robinhoodOrdersPageSize,
            0,
            normalizedSymbol,
            robinhoodOrderStatusFilter
          ));
        if (!cached) writeCache(ordersCacheKey, result);
        setRobinhoodOrders(result.orders);
        setRobinhoodOrdersTotal(result.total);
        setRobinhoodOrdersHasMore(result.has_more);
        setRobinhoodWashSaleRisks(result.wash_sale_risk_symbols || []);
        void loadRobinhoodOptionOrders(true, 0, false, {
          symbol: normalizedSymbol,
          status: robinhoodOrderStatusFilter,
        });
      } catch (error) {
        console.warn("Failed to change Robinhood order symbol filter:", error);
      } finally {
        setLoadingRobinhoodOrders(false);
      }
    },
    [cacheUserId, loadRobinhoodOptionOrders, robinhoodOrderStatusFilter]
  );

  // Load connection status and holdings data
  const loadData = useCallback(async (forceRefresh = false) => {
    const rootCacheKey = getCacheKey("root", [cacheUserId, isOwner ? "owner" : "public"]);
    const cachedRoot = forceRefresh ? null : readCache<PortfolioRootCache>(rootCacheKey);
    if (cachedRoot) {
      setStatus(cachedRoot.status);
      setHoldings(cachedRoot.holdings);
      setRobinhoodStatus(cachedRoot.robinhoodStatus);
      setIbkrStatus(cachedRoot.ibkrStatus);
      setLoading(false);
      await loadRobinhoodOrders(true, 0, forceRefresh);
      await loadRobinhoodOptionOrders(true, 0, forceRefresh);
      return;
    }

    setLoading(true);
    try {
      if (isOwner) {
        const [statusData, holdingsData, robinhoodData, ibkrData, ibkrHoldings] = await Promise.all([
            getConnectionStatus(),
            getMyHoldings(),
            getRobinhoodStatus().catch(() => null),
            getIbkrStatus().catch(() => null),
            getIbkrHoldings().catch(() => null),
          ]);
        const mergedAccounts = [
          ...(holdingsData?.accounts || []),
          ...(ibkrHoldings?.accounts || []),
        ];
        const mergedStatus = ibkrData?.is_connected
          ? {
              ...statusData,
              is_registered: true,
              is_connected: true,
              accounts_count: mergedAccounts.length,
              last_synced_at:
                ibkrData.last_synced_at || statusData.last_synced_at,
            }
          : statusData;
        const mergedHoldings = {
          ...holdingsData,
          is_connected:
            holdingsData?.is_connected || Boolean(ibkrData?.is_connected),
          last_synced_at:
            ibkrData?.last_synced_at || holdingsData?.last_synced_at,
          accounts: mergedAccounts,
        };
        setStatus(mergedStatus);
        setHoldings(mergedHoldings);
        setRobinhoodStatus(robinhoodData);
        setIbkrStatus(ibkrData);
        writeCache<PortfolioRootCache>(rootCacheKey, {
          status: mergedStatus,
          holdings: mergedHoldings,
          robinhoodStatus: robinhoodData,
          ibkrStatus: ibkrData,
        });
        await loadRobinhoodOrders(true, 0, forceRefresh);
        await loadRobinhoodOptionOrders(true, 0, forceRefresh);
      } else if (userId) {
        // Load public holdings for other users
        const publicHoldings = await getPublicHoldings(userId);
        if (publicHoldings) {
          // Convert public holdings to PortfolioHoldings format
          setHoldings({
            accounts: publicHoldings.accounts,
            last_synced_at: publicHoldings.last_synced_at,
            is_connected: true,
            is_public: true,
            total_value: publicHoldings.total_value ?? undefined,
            privacy_settings: publicHoldings.privacy_settings,
            hidden_positions_count: publicHoldings.hidden_positions_count,
          });
          // Set status as connected for public view
          setStatus({
            is_registered: true,
            is_connected: true,
            is_public: true,
            accounts_count: publicHoldings.accounts.length,
          });
          writeCache<PortfolioRootCache>(rootCacheKey, {
            status: {
              is_registered: true,
              is_connected: true,
              is_public: true,
              accounts_count: publicHoldings.accounts.length,
            },
            holdings: {
              accounts: publicHoldings.accounts,
              last_synced_at: publicHoldings.last_synced_at,
              is_connected: true,
              is_public: true,
              total_value: publicHoldings.total_value ?? undefined,
              privacy_settings: publicHoldings.privacy_settings,
              hidden_positions_count: publicHoldings.hidden_positions_count,
            },
            robinhoodStatus: null,
            ibkrStatus: null,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [cacheUserId, isOwner, userId, loadRobinhoodOrders, loadRobinhoodOptionOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = useCallback(async () => {
    toast.info("Choose Robinhood or Interactive Brokers to connect.");
  }, []);

  const handleConnectIbkr = useCallback(
    async (credentials: { flex_token: string; flex_query_id: string }) => {
      setConnecting(true);
      try {
        await connectIbkr(credentials);
        clearPortfolioCache(cacheUserId);
        await loadData(true);
        toast.success("Interactive Brokers connected and synced");
      } catch (error: any) {
        toast.error(error?.message || "Failed to connect Interactive Brokers");
      } finally {
        setConnecting(false);
      }
    },
    [cacheUserId, loadData]
  );

  const handleConnectRobinhood = useCallback(
    async (credentials: {
      username: string;
      password: string;
      totp_secret?: string;
      challenge_code?: string;
    }) => {
      setConnecting(true);

      // Total wall-clock cap on the auto-resume polling (Robinhood's
      // verification workflow itself expires after ~5 min anyway).
      const maxTotalMs = 3 * 60 * 1000;
      const startedAt = Date.now();

      const showApprovalToast = (message?: string | null) => {
        toast.info(
          message ||
            "Tap \"Yes, it's me\" on the Robinhood app — we'll detect it automatically.",
          { id: "robinhood-approval", duration: 4000 }
        );
      };

      const finishConnectedSync = async () => {
        toast.info("Syncing your Robinhood positions and orders...", {
          id: "robinhood-approval",
          duration: 4000,
        });
        try {
          await waitForRobinhoodSync();
        } catch (syncError: any) {
          toast.error(
            syncError?.message ||
              "Robinhood is connected but the background sync failed. Try again later.",
            { id: "robinhood-approval" }
          );
          await loadData();
          return;
        }
        clearPortfolioCache(cacheUserId);
        await loadData(true);
        toast.success("Robinhood connected and synced", {
          id: "robinhood-approval",
        });
      };

      try {
        while (true) {
          let result: Awaited<ReturnType<typeof connectRobinhoodBroker>> | null =
            null;
          let connectError: unknown = null;
          try {
            result = await connectRobinhoodBroker(credentials);
          } catch (error) {
            connectError = error;
          }

          // /connect can fail mid-flight (Vercel/network timeout while the
          // backend is still polling Robinhood). The backend keeps running
          // and may have actually finished the sync, so always re-check
          // /status before declaring failure.
          if (!result) {
            try {
              const status = await getRobinhoodStatus();
              if (status.is_connected) {
                await finishConnectedSync();
                return;
              }
            } catch {
              // ignore - fall through to error handling below
            }
            throw connectError;
          }

          if (result.setup_required) {
            toast.error(
              result.message ||
                "Robinhood database setup is missing. Apply the Supabase migration and try again.",
              { id: "robinhood-approval" }
            );
            return;
          }

          if (result.approval_required) {
            showApprovalToast(result.message);
            if (Date.now() - startedAt >= maxTotalMs) {
              toast.error(
                "Still waiting on Robinhood device approval. Tap \"Yes, it's me\" and click Connect Robinhood again.",
                { id: "robinhood-approval" }
              );
              return;
            }
            // Resume the same workflow on the next loop iteration. The backend
            // will reuse the existing push (no new mobile notification) and
            // poll for ~25s before returning.
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }

          // Login + token persistence succeeded. The actual data fetch is
          // running in the background to dodge the Vercel proxy timeout.
          await finishConnectedSync();
          return;
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to connect Robinhood", {
          id: "robinhood-approval",
        });
      } finally {
        setConnecting(false);
      }
    },
    [cacheUserId, loadData]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      let syncedDirectBroker = false;
      if (robinhoodStatus?.is_connected) {
        // /sync schedules a background task and returns immediately; we then
        // poll /status until it finishes so the UI stays in "Syncing..." mode.
        await syncRobinhood();
        await waitForRobinhoodSync();
        syncedDirectBroker = true;
      }
      if (ibkrStatus?.is_connected) {
        await syncIbkr();
        syncedDirectBroker = true;
      }
      if (!syncedDirectBroker) throw new Error("Connect a broker before syncing");
      clearPortfolioCache(cacheUserId);
      await loadData(true);
      toast.success("Data refreshed successfully");
    } catch (error: any) {
      toast.error(error.message || "Refresh failed");
    } finally {
      setSyncing(false);
    }
  }, [cacheUserId, ibkrStatus?.is_connected, loadData, robinhoodStatus?.is_connected]);

  const handleSyncRobinhoodTransactions = useCallback(async () => {
    setSyncing(true);
    try {
      if (robinhoodStatus?.is_connected) {
        await syncRobinhood();
        await waitForRobinhoodSync();
      }
      if (ibkrStatus?.is_connected) {
        await syncIbkr();
      }
      clearPortfolioCache(cacheUserId);
      await loadData(true);
      toast.success("Broker transactions synced");
    } catch (error: any) {
      toast.error(error.message || "Robinhood sync failed");
    } finally {
      setSyncing(false);
    }
  }, [
    cacheUserId,
    ibkrStatus?.is_connected,
    loadData,
    robinhoodStatus?.is_connected,
  ]);

  const handleResetRobinhoodAuth = useCallback(async () => {
    setResettingRobinhoodAuth(true);
    try {
      await resetRobinhoodAuth();
      clearPortfolioCache(cacheUserId);
      setRobinhoodStatus(null);
      toast.success("Robinhood login state reset. Click Connect Robinhood again.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset Robinhood login state");
    } finally {
      setResettingRobinhoodAuth(false);
    }
  }, [cacheUserId]);

  const handleTogglePublic = useCallback(async (isPublic: boolean) => {
    try {
      await togglePublicSharing(isPublic);
      setHoldings((prev) => (prev ? { ...prev, is_public: isPublic } : null));
      clearPortfolioCache(cacheUserId);
      toast.success(
        isPublic ? "Portfolio is now public" : "Portfolio is now private"
      );
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  }, [cacheUserId]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      if (robinhoodStatus?.is_connected) {
        await disconnectRobinhood();
      } else if (ibkrStatus?.is_connected) {
        await disconnectIbkr();
      } else throw new Error("No connected broker found");
      clearPortfolioCache(cacheUserId);
      setStatus(null);
      setRobinhoodStatus(null);
      setIbkrStatus(null);
      setHoldings(null);
      setRobinhoodOrders([]);
      setRobinhoodOptionOrders([]);
      setRobinhoodOptionOrdersError(null);
      setRobinhoodOrdersTotal(0);
      setRobinhoodOptionOrdersTotal(0);
      setRobinhoodOrdersHasMore(false);
      setRobinhoodOptionOrdersHasMore(false);
      setRobinhoodWashSaleRisks([]);
      toast.success("Broker disconnected");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
      return false;
    } finally {
      setDisconnecting(false);
    }
  }, [cacheUserId, ibkrStatus?.is_connected, robinhoodStatus?.is_connected]);

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
      currentlyHidden: boolean
    ) => {
      e.stopPropagation();
      try {
        await togglePositionVisibility(positionId, !currentlyHidden);
        // Update local state
        setHoldings((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            accounts: prev.accounts.map((account) => ({
              ...account,
              portfolio_positions: account.portfolio_positions?.map((pos) =>
                pos.id === positionId
                  ? { ...pos, is_hidden: !currentlyHidden }
                  : pos
              ),
            })),
          };
        });
        clearPortfolioCache(cacheUserId);
        toast.success(
          currentlyHidden
            ? "Position now visible"
            : "Position hidden from public"
        );
      } catch (error: any) {
        toast.error(error.message || "Failed to update visibility");
      }
    },
    [cacheUserId]
  );

  return {
    status,
    holdings,
    robinhoodOrders,
    robinhoodOptionOrders,
    robinhoodOrdersTotal,
    robinhoodOptionOrdersTotal,
    robinhoodOrdersHasMore,
    robinhoodOptionOrdersHasMore,
    robinhoodOptionOrdersError,
    robinhoodWashSaleRisks,
    robinhoodOrderStatusFilter,
    robinhoodOrderSymbolFilter,
    loadingRobinhoodOrders,
    loadingRobinhoodOptionOrders,
    loading,
    syncing,
    connecting,
    resettingRobinhoodAuth,
    disconnecting,
    copied,
    loadData,
    handleConnect,
    handleConnectIbkr,
    handleConnectRobinhood,
    handleResetRobinhoodAuth,
    loadRobinhoodOrders,
    loadRobinhoodOptionOrders,
    handleLoadMoreRobinhoodOrders,
    handleLoadMoreRobinhoodOptionOrders,
    handleRobinhoodOrderStatusFilterChange,
    handleRobinhoodOrderSymbolFilterChange,
    handleSyncRobinhoodTransactions,
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  };
}
