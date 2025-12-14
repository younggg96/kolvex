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
} from "lucide-react";
import type { SnapTradeHoldings } from "@/lib/supabase/database.types";
import PrivacySettingsDialog from "./PrivacySettingsDialog";

export interface PortfolioHeaderActionsProps {
  syncing: boolean;
  onSync: () => void;
  holdings: SnapTradeHoldings | null;
  onTogglePublic: (isPublic: boolean) => void;
  onCopyShareLink: () => void;
  copied: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

/**
 * Standalone Header Actions component for Portfolio
 * Can be used in DashboardLayout's headerActions prop
 */
export function PortfolioHeaderActions({
  syncing,
  onSync,
  holdings,
  onTogglePublic,
  onCopyShareLink,
  copied,
  onConnect,
  onDisconnect,
}: PortfolioHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline opacity-60">
        {holdings?.last_synced_at
          ? `Updated ${new Date(holdings.last_synced_at).toLocaleTimeString()}`
          : "Not synced"}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={syncing}
        className="gap-1.5"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Sync</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onConnect}>
            <Link2 className="mr-2 h-4 w-4" />
            Add Another Broker
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDisconnect}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href="/community">
        <Button variant="outline" size="sm" className="gap-1.5 group">
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Community</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </Link>
    </div>
  );
}

