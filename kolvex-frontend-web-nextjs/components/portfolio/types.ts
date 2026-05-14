import type {
  SnapTradeConnectionStatus,
  SnapTradeHoldings,
  SnapTradePosition,
  PrivacySettings,
} from "@/lib/supabase/database.types";

// Re-export PortfolioHeaderActionsProps from its source
export type { PortfolioHeaderActionsProps } from "./PortfolioHeaderActions";

// Sort key types
export type EquitySortKey =
  | "symbol"
  | "price"
  | "cost"
  | "units"
  | "value"
  | "pnl"
  | "pnl_per_share"
  | "weight";

export type OptionSortKey =
  | "symbol"
  | "expiration_date"
  | "strike"
  | "price"
  | "units"
  | "value"
  | "pnl"
  | "pnl_per_share"
  | "weight";

// Import for use in this file
import type { PortfolioHeaderActionsProps } from "./PortfolioHeaderActions";

// Props interfaces
export interface PortfolioHoldingsProps {
  userId?: string;
  isOwner?: boolean;
  onHeaderActionsReady?: (props: PortfolioHeaderActionsProps | null) => void;
}

export interface ConnectionStateProps {
  onConnect: () => Promise<void>;
  onConnectRobinhood: (credentials: {
    username: string;
    password: string;
    totp_secret?: string;
    challenge_code?: string;
  }) => Promise<void>;
  onResetRobinhoodAuth: () => Promise<void>;
  connecting: boolean;
  resettingRobinhoodAuth: boolean;
}

export interface InitialSyncStateProps {
  onSync: () => Promise<void>;
  syncing: boolean;
}

export interface EquityPositionsTableProps {
  positions: SnapTradePosition[];
  isOwner: boolean;
  isPublic: boolean;
  privacySettings?: PrivacySettings;
  sortKey: EquitySortKey | null;
  sortDir: "asc" | "desc";
  onSort: (key: EquitySortKey) => void;
  sparklineDataMap: Map<string, number[]>;
  onToggleVisibility: (
    e: React.MouseEvent,
    positionId: string,
    currentlyHidden: boolean
  ) => void;
}

export interface OptionPositionsTableProps {
  positions: SnapTradePosition[];
  isOwner: boolean;
  isPublic: boolean;
  privacySettings?: PrivacySettings;
  sortKey: OptionSortKey | null;
  sortDir: "asc" | "desc";
  onSort: (key: OptionSortKey) => void;
  sparklineDataMap: Map<string, number[]>;
  onToggleVisibility: (
    e: React.MouseEvent,
    positionId: string,
    currentlyHidden: boolean
  ) => void;
}

export interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect: () => Promise<void>;
  disconnecting: boolean;
}

// Re-export database types for convenience
export type { SnapTradeConnectionStatus, SnapTradeHoldings, SnapTradePosition };
