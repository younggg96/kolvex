"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Eye,
  EyeOff,
  Shield,
  ChevronDown,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getPrivacySettings,
  updatePrivacySettings,
  getMyHoldings,
} from "@/lib/snaptradeApi";
import type {
  PrivacySettings,
  SnapTradeAccount,
} from "@/lib/supabase/database.types";

type BooleanSettingKey = Exclude<keyof PrivacySettings, "hidden_accounts">;

interface PrivacySettingItem {
  key: BooleanSettingKey;
  label: string;
  category: "summary" | "position";
}

const PRIVACY_SETTINGS: PrivacySettingItem[] = [
  // Summary settings
  { key: "show_total_value", label: "Total Value", category: "summary" },
  { key: "show_total_pnl", label: "Total P&L", category: "summary" },
  { key: "show_pnl_percent", label: "P&L %", category: "summary" },
  { key: "show_positions_count", label: "Positions", category: "summary" },
  // Position settings
  { key: "show_shares", label: "Shares", category: "position" },
  { key: "show_position_value", label: "Value", category: "position" },
  { key: "show_position_pnl", label: "P&L", category: "position" },
  { key: "show_position_weight", label: "Weight", category: "position" },
  { key: "show_position_cost", label: "Cost", category: "position" },
];

interface PrivacySettingsDialogProps {
  trigger?: React.ReactNode;
}

export default function PrivacySettingsDialog({
  trigger,
}: PrivacySettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [accounts, setAccounts] = useState<SnapTradeAccount[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [positionOpen, setPositionOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(true);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, holdingsData] = await Promise.all([
        getPrivacySettings(),
        getMyHoldings(),
      ]);
      setSettings(settingsData);
      setAccounts(holdingsData?.accounts || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: BooleanSettingKey, value: boolean) => {
    if (!settings) return;

    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));

    setSaving(true);
    try {
      await updatePrivacySettings({ [key]: value });
    } catch (error: unknown) {
      setSettings((prev) => (prev ? { ...prev, [key]: !value } : null));
      const message =
        error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccount = async (accountId: string, hide: boolean) => {
    if (!settings) return;

    const currentHidden = settings.hidden_accounts || [];
    const newHidden = hide
      ? [...currentHidden, accountId]
      : currentHidden.filter((id) => id !== accountId);

    setSettings((prev) =>
      prev ? { ...prev, hidden_accounts: newHidden } : null
    );

    setSaving(true);
    try {
      await updatePrivacySettings({ hidden_accounts: newHidden });
    } catch (error: unknown) {
      setSettings((prev) =>
        prev ? { ...prev, hidden_accounts: currentHidden } : null
      );
      const message =
        error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = async (
    category: "summary" | "position",
    value: boolean
  ) => {
    if (!settings) return;

    const keys = PRIVACY_SETTINGS.filter((s) => s.category === category).map(
      (s) => s.key
    );
    const updates: Partial<PrivacySettings> = {};
    keys.forEach((key) => {
      (updates as any)[key] = value;
    });

    setSettings((prev) => (prev ? { ...prev, ...updates } : null));

    setSaving(true);
    try {
      await updatePrivacySettings(updates);
    } catch (error: unknown) {
      // Revert
      const revertUpdates: Partial<PrivacySettings> = {};
      keys.forEach((key) => {
        (revertUpdates as any)[key] = !value;
      });
      setSettings((prev) => (prev ? { ...prev, ...revertUpdates } : null));
      const message =
        error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAllAccounts = async (show: boolean) => {
    if (!settings) return;

    const newHidden = show ? [] : accounts.map((a) => a.id);

    setSettings((prev) =>
      prev ? { ...prev, hidden_accounts: newHidden } : null
    );

    setSaving(true);
    try {
      await updatePrivacySettings({ hidden_accounts: newHidden });
    } catch (error: unknown) {
      setSettings((prev) =>
        prev ? { ...prev, hidden_accounts: settings.hidden_accounts } : null
      );
      const message =
        error instanceof Error ? error.message : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const summarySettings = PRIVACY_SETTINGS.filter(
    (s) => s.category === "summary"
  );
  const positionSettings = PRIVACY_SETTINGS.filter(
    (s) => s.category === "position"
  );

  const summaryVisibleCount = settings
    ? summarySettings.filter((s) => settings[s.key]).length
    : 0;
  const positionVisibleCount = settings
    ? positionSettings.filter((s) => settings[s.key]).length
    : 0;

  const hiddenAccountIds = new Set(settings?.hidden_accounts || []);
  const visibleAccountsCount = accounts.length - hiddenAccountIds.size;

  const SettingRow = ({ item }: { item: PrivacySettingItem }) => {
    if (!settings) return null;
    const isVisible = settings[item.key];

    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isVisible ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
          <span
            className={`text-xs transition-colors ${
              isVisible ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {item.label}
          </span>
        </div>
        <Switch
          checked={isVisible}
          onCheckedChange={(checked) => handleToggle(item.key, checked)}
          disabled={saving}
          className="scale-90"
        />
      </div>
    );
  };

  const AccountRow = ({ account }: { account: SnapTradeAccount }) => {
    const isHidden = hiddenAccountIds.has(account.id);
    const positionsCount = account.snaptrade_positions?.length || 0;

    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group">
        <div className="flex items-center gap-2.5">
          <Building2
            className={`w-4 h-4 transition-colors ${
              isHidden ? "text-muted-foreground/30" : "text-primary"
            }`}
          />
          <div>
            <span
              className={`text-xs transition-colors ${
                isHidden ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {account.account_name || "Brokerage Account"}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {positionsCount} positions
            </p>
          </div>
        </div>
        <Switch
          checked={!isHidden}
          onCheckedChange={(checked) =>
            handleToggleAccount(account.id, !checked)
          }
          disabled={saving}
          className="scale-90"
        />
      </div>
    );
  };

  const CategorySection = ({
    title,
    items,
    isOpen,
    onOpenChange,
    visibleCount,
    category,
  }: {
    title: string;
    items: PrivacySettingItem[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    visibleCount: number;
    category: "summary" | "position";
  }) => {
    const allVisible = visibleCount === items.length;

    return (
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <div className="overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs text-muted-foreground">
                  {visibleCount}/{items.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAll(category, !allVisible);
                  }}
                  disabled={saving}
                >
                  {allVisible ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Hide All
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Show All
                    </>
                  )}
                </Button>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 mt-2">
              {items.map((item) => (
                <SettingRow key={item.key} item={item} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  const AccountsSection = () => {
    const allVisible = visibleAccountsCount === accounts.length;

    return (
      <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen}>
        <div className="overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Accounts</span>
                <span className="text-xs text-muted-foreground">
                  {visibleAccountsCount}/{accounts.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAllAccounts(!allVisible);
                  }}
                  disabled={saving}
                >
                  {allVisible ? (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Hide All
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Show All
                    </>
                  )}
                </Button>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    accountsOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 mt-2">
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No accounts connected
                </p>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Shield className="w-4 h-4" />
            Privacy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader className="!border-0">
          <DialogTitle>Privacy Settings</DialogTitle>
          <DialogDescription>
            Control what information is visible in your public profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <CategorySection
              title="Portfolio Summary"
              items={summarySettings}
              isOpen={summaryOpen}
              onOpenChange={setSummaryOpen}
              visibleCount={summaryVisibleCount}
              category="summary"
            />

            <CategorySection
              title="Position Details"
              items={positionSettings}
              isOpen={positionOpen}
              onOpenChange={setPositionOpen}
              visibleCount={positionVisibleCount}
              category="position"
            />

            <AccountsSection />

            <p className="text-xs text-muted-foreground text-center pt-2">
              Hidden fields show "***" and hidden accounts are not displayed
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
