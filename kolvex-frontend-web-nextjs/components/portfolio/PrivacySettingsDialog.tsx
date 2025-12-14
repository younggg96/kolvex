"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Shield, ChevronDown } from "lucide-react";
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
import { getPrivacySettings, updatePrivacySettings } from "@/lib/snaptradeApi";
import type { PrivacySettings } from "@/lib/supabase/database.types";

interface PrivacySettingItem {
  key: keyof PrivacySettings;
  label: string;
  category: "summary" | "position";
}

const PRIVACY_SETTINGS: PrivacySettingItem[] = [
  // Summary settings
  { key: "show_total_value", label: "Total Value", category: "summary" },
  { key: "show_total_pnl", label: "Total P&L", category: "summary" },
  { key: "show_pnl_percent", label: "P&L %", category: "summary" },
  { key: "show_positions_count", label: "Positions", category: "summary" },
  { key: "show_accounts_count", label: "Accounts", category: "summary" },
  // Position settings
  { key: "show_shares", label: "Shares", category: "position" },
  { key: "show_position_value", label: "Value", category: "position" },
  { key: "show_position_pnl", label: "P&L", category: "position" },
  { key: "show_position_weight", label: "Weight", category: "position" },
  { key: "show_position_price", label: "Price", category: "position" },
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
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [positionOpen, setPositionOpen] = useState(true);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getPrivacySettings();
      setSettings(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof PrivacySettings, value: boolean) => {
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
      updates[key] = value;
    });

    setSettings((prev) => (prev ? { ...prev, ...updates } : null));

    setSaving(true);
    try {
      await updatePrivacySettings(updates);
    } catch (error: unknown) {
      // Revert
      const revertUpdates: Partial<PrivacySettings> = {};
      keys.forEach((key) => {
        revertUpdates[key] = !value;
      });
      setSettings((prev) => (prev ? { ...prev, ...revertUpdates } : null));
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
            <div className="space-y-2">
              {items.map((item) => (
                <SettingRow key={item.key} item={item} />
              ))}
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
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
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

            <p className="text-xs text-muted-foreground text-center">
              Hidden fields show "—" in your public profile
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
