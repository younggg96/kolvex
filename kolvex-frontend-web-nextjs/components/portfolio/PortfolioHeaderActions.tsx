"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw,
  Link2,
  Copy,
  Check,
  LogOut,
  Globe,
  Lock,
  Settings2,
  Users,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SnapTradeHoldings } from "@/lib/supabase/database.types";
import PrivacySettingsDialog from "./PrivacySettingsDialog";
import { cn } from "@/lib/utils";

export type DownloadFormat = "csv" | "json";

export interface PortfolioHeaderActionsProps {
  syncing: boolean;
  onSync: () => void;
  holdings: SnapTradeHoldings | null;
  onTogglePublic: (isPublic: boolean) => void;
  onCopyShareLink: () => void;
  copied: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDownload: (format: DownloadFormat) => void;
  size?: "sm" | "xs";
}

/**
 * Standalone Header Actions component for Portfolio
 * Can be used in DashboardLayout's headerActions prop
 */
export function PortfolioHeaderActions({
  syncing,
  onSync,
  holdings,
  size = "sm",
  onTogglePublic,
  onCopyShareLink,
  copied,
  onConnect,
  onDisconnect,
  onDownload,
}: PortfolioHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline opacity-60">
        {holdings?.last_synced_at
          ? `Updated ${formatDistanceToNow(new Date(holdings.last_synced_at), { addSuffix: true })}`
          : "Not synced yet"}
      </span>

      <Button
        variant="outline"
        size={size}
        onClick={onSync}
        disabled={syncing}
        className="gap-1.5"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        <span className={cn("hidden sm:inline", size === "xs" && "text-xs")}>
          Refresh
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            <span
              className={cn("hidden sm:inline", size === "xs" && "text-xs")}
            >
              Settings
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 space-y-2">
          <div className="px-2 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                {holdings?.is_public ? (
                  <Globe className="h-4 w-4 text-green-500" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span>Public Profile</span>
              </div>
              <Switch
                checked={holdings?.is_public || false}
                onCheckedChange={onTogglePublic}
                size="sm"
              />
            </div>
          </div>
          {holdings?.is_public && (
            <>
              <DropdownMenuItem onClick={onCopyShareLink}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy Share Link
              </DropdownMenuItem>
              <PrivacySettingsDialog
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Privacy Settings
                  </DropdownMenuItem>
                }
              />
            </>
          )}
          <DropdownMenuItem onClick={onConnect}>
            <Link2 className="mr-2 h-4 w-4" />
            Add Another Broker
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Download Options */}
          <DropdownMenuItem onClick={() => onDownload("csv")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload("json")}>
            <FileJson className="mr-2 h-4 w-4" />
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="!text-red-500 focus:!text-red-500"
            onClick={onDisconnect}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href="/community">
        <Button variant="outline" size={size} className="gap-1.5 group">
          <Users className="w-3.5 h-3.5" />
          <span className={cn("hidden sm:inline", size === "xs" && "text-xs")}>
            {size === "xs" ? "View" : "Community"}
          </span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </Link>
    </div>
  );
}
