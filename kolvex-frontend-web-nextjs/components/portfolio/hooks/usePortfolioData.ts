import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getConnectionStatus,
  getConnectionPortalUrl,
  syncAccounts,
  syncPositions,
  getMyHoldings,
  getPublicHoldings,
  togglePublicSharing,
  disconnectSnapTrade,
  togglePositionVisibility,
  getShareUrl,
} from "@/lib/snaptradeApi";
import {
  connectRobinhood as connectRobinhoodBroker,
  disconnectRobinhood,
  getRobinhoodStatus,
  syncRobinhood,
  type RobinhoodStatus,
} from "@/lib/robinhoodApi";
import type {
  SnapTradeConnectionStatus,
  SnapTradeHoldings,
} from "../types";

interface UsePortfolioDataOptions {
  userId?: string;
  isOwner: boolean;
}

export function usePortfolioData({ userId, isOwner }: UsePortfolioDataOptions) {
  const [status, setStatus] = useState<SnapTradeConnectionStatus | null>(null);
  const [robinhoodStatus, setRobinhoodStatus] =
    useState<RobinhoodStatus | null>(null);
  const [holdings, setHoldings] = useState<SnapTradeHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load connection status and holdings data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isOwner) {
        const [statusData, holdingsData, robinhoodData] = await Promise.all([
          getConnectionStatus(),
          getMyHoldings(),
          getRobinhoodStatus().catch(() => null),
        ]);
        setStatus(statusData);
        setHoldings(holdingsData);
        setRobinhoodStatus(robinhoodData);
      } else if (userId) {
        // Load public holdings for other users
        const publicHoldings = await getPublicHoldings(userId);
        if (publicHoldings) {
          // Convert public holdings to SnapTradeHoldings format
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
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [isOwner, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/dashboard/portfolio?connected=true`;
      const url = await getConnectionPortalUrl(redirectUri);
      window.open(url, "_blank", "width=800,height=600");
      toast.info("Please complete the broker connection in the new window");
    } catch (error: any) {
      toast.error(error.message || "Failed to get connection link");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleConnectRobinhood = useCallback(
    async (credentials: {
      username: string;
      password: string;
      totp_secret?: string;
    }) => {
      setConnecting(true);
      try {
        await connectRobinhoodBroker(credentials);
        await loadData();
        toast.success("Robinhood connected and synced");
      } catch (error: any) {
        toast.error(error.message || "Failed to connect Robinhood");
      } finally {
        setConnecting(false);
      }
    },
    [loadData]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      if (robinhoodStatus?.is_connected) {
        await syncRobinhood();
      } else {
        await syncAccounts();
        await syncPositions();
      }
      await loadData();
      toast.success("Data refreshed successfully");
    } catch (error: any) {
      toast.error(error.message || "Refresh failed");
    } finally {
      setSyncing(false);
    }
  }, [loadData, robinhoodStatus?.is_connected]);

  const handleTogglePublic = useCallback(async (isPublic: boolean) => {
    try {
      await togglePublicSharing(isPublic);
      setHoldings((prev) => (prev ? { ...prev, is_public: isPublic } : null));
      toast.success(
        isPublic ? "Portfolio is now public" : "Portfolio is now private"
      );
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      if (robinhoodStatus?.is_connected) {
        await disconnectRobinhood();
      } else {
        await disconnectSnapTrade();
      }
      setStatus(null);
      setRobinhoodStatus(null);
      setHoldings(null);
      toast.success("Broker disconnected");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
      return false;
    } finally {
      setDisconnecting(false);
    }
  }, [robinhoodStatus?.is_connected]);

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
              snaptrade_positions: account.snaptrade_positions?.map((pos) =>
                pos.id === positionId
                  ? { ...pos, is_hidden: !currentlyHidden }
                  : pos
              ),
            })),
          };
        });
        toast.success(
          currentlyHidden
            ? "Position now visible"
            : "Position hidden from public"
        );
      } catch (error: any) {
        toast.error(error.message || "Failed to update visibility");
      }
    },
    []
  );

  return {
    status,
    holdings,
    loading,
    syncing,
    connecting,
    disconnecting,
    copied,
    loadData,
    handleConnect,
    handleConnectRobinhood,
    handleSync,
    handleTogglePublic,
    handleDisconnect,
    handleCopyShareLink,
    handleTogglePositionVisibility,
  };
}
