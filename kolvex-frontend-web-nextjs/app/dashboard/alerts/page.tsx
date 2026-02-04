"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Plus,
  Settings,
  History,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  Power,
  TestTube,
  Send,
  Loader2,
  MessageSquare,
  Mail,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getNotificationChannels,
  createNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
  getAlertHistory,
  getAlertStats,
  type AlertRule,
  type NotificationChannel,
  type AlertHistory,
  type AlertStats,
  type NotificationChannelType,
} from "@/lib/stockAlertApi";

const alertsTabs = [
  { value: "rules", icon: Bell, label: "Alert Rules" },
  { value: "channels", icon: MessageSquare, label: "Notification Channels" },
  { value: "history", icon: History, label: "Alert History" },
];

const channelIcons: Record<NotificationChannelType, any> = {
  email: Mail,
  discord: Bot,
  telegram: Send,
  wechat: MessageSquare,
  whatsapp: MessageSquare,
};

const channelLabels: Record<NotificationChannelType, string> = {
  email: "Email",
  discord: "Discord",
  telegram: "Telegram",
  wechat: "WeChat",
  whatsapp: "WhatsApp",
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("rules");
  const [isLoading, setIsLoading] = useState(true);

  // Data state
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);

  // Dialog state
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Form state
  const [newRule, setNewRule] = useState({
    symbol: "",
    daily_change_threshold: 5,
    spike_change_threshold: 3,
    premarket_enabled: true,
    regular_hours_enabled: true,
    afterhours_enabled: true,
    channels: ["email"] as NotificationChannelType[],
    ai_analysis_enabled: true,
    cooldown_minutes: 30,
  });

  const [newChannel, setNewChannel] = useState({
    channel_type: "discord" as NotificationChannelType,
    discord_webhook_url: "",
    telegram_bot_token: "",
    telegram_chat_id: "",
    wechat_webhook_url: "",
    whatsapp_phone_number: "",
  });

  // Load data
  const loadRules = useCallback(async () => {
    try {
      const data = await getAlertRules();
      setRules(data.rules);
    } catch (error) {
      console.error("Failed to load rules:", error);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const data = await getNotificationChannels();
      setChannels(data.channels);
    } catch (error) {
      console.error("Failed to load channels:", error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getAlertHistory({ days: 7, limit: 50 });
      setHistory(data.history);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getAlertStats(30);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadRules(), loadChannels(), loadHistory(), loadStats()]);
      setIsLoading(false);
    };
    loadAll();
  }, [loadRules, loadChannels, loadHistory, loadStats]);

  // Handlers
  const handleCreateRule = async () => {
    if (!newRule.symbol.trim()) {
      toast.error("Please enter a stock symbol");
      return;
    }

    try {
      await createAlertRule({
        symbol: newRule.symbol.toUpperCase(),
        daily_change_threshold: newRule.daily_change_threshold,
        spike_change_threshold: newRule.spike_change_threshold,
        premarket_enabled: newRule.premarket_enabled,
        regular_hours_enabled: newRule.regular_hours_enabled,
        afterhours_enabled: newRule.afterhours_enabled,
        channels: newRule.channels,
        ai_analysis_enabled: newRule.ai_analysis_enabled,
        cooldown_minutes: newRule.cooldown_minutes,
      });

      toast.success(`Alert rule created for ${newRule.symbol.toUpperCase()}`);
      setShowCreateRule(false);
      setNewRule({
        symbol: "",
        daily_change_threshold: 5,
        spike_change_threshold: 3,
        premarket_enabled: true,
        regular_hours_enabled: true,
        afterhours_enabled: true,
        channels: ["email"],
        ai_analysis_enabled: true,
        cooldown_minutes: 30,
      });
      loadRules();
    } catch (error: any) {
      toast.error(error.message || "Failed to create alert rule");
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await toggleAlertRule(rule.id);
      toast.success(
        rule.is_active
          ? `Disabled alerts for ${rule.symbol}`
          : `Enabled alerts for ${rule.symbol}`
      );
      loadRules();
    } catch (error) {
      toast.error("Failed to toggle alert rule");
    }
  };

  const handleDeleteRule = async (rule: AlertRule) => {
    try {
      await deleteAlertRule(rule.id);
      toast.success(`Deleted alert rule for ${rule.symbol}`);
      loadRules();
    } catch (error) {
      toast.error("Failed to delete alert rule");
    }
  };

  const handleCreateChannel = async () => {
    try {
      await createNotificationChannel(newChannel);
      toast.success(`${channelLabels[newChannel.channel_type]} channel added`);
      setShowCreateChannel(false);
      setNewChannel({
        channel_type: "discord",
        discord_webhook_url: "",
        telegram_bot_token: "",
        telegram_chat_id: "",
        wechat_webhook_url: "",
        whatsapp_phone_number: "",
      });
      loadChannels();
    } catch (error: any) {
      toast.error(error.message || "Failed to create channel");
    }
  };

  const handleTestChannel = async (channel: NotificationChannel) => {
    try {
      const result = await testNotificationChannel(channel.id);
      if (result.success) {
        toast.success("Test message sent successfully!");
        loadChannels();
      } else {
        toast.error("Test failed: " + result.message);
      }
    } catch (error) {
      toast.error("Failed to send test message");
    }
  };

  const handleDeleteChannel = async (channel: NotificationChannel) => {
    try {
      await deleteNotificationChannel(channel.id);
      toast.success(`Deleted ${channelLabels[channel.channel_type as NotificationChannelType]} channel`);
      loadChannels();
    } catch (error) {
      toast.error("Failed to delete channel");
    }
  };

  const tabOptions = alertsTabs.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <tab.icon className="w-4 h-4" />,
  }));

  return (
    <DashboardLayout title="Stock Alerts">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 min-w-0">
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Active Rules</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.active_rules}
                </div>
              </div>
              <div className="bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Alerts (30d)</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_alerts}
                </div>
              </div>
              <div className="bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Avg/Day</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.avg_alerts_per_day}
                </div>
              </div>
              <div className="bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-white/10 p-3">
                <div className="text-xs text-gray-500 dark:text-white/50">Top Stock</div>
                <div className="text-2xl font-bold text-primary">
                  {stats.top_symbols[0]?.symbol || "-"}
                </div>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-2">
              <SwitchTab
                value={activeTab}
                onValueChange={setActiveTab}
                options={tabOptions}
                size="md"
                variant="pills"
                className="!w-fit border border-gray-200 dark:border-white/10 rounded-lg"
              />

              <div className="flex-1 min-w-0">
                {/* Alert Rules Tab */}
                <TabsContent value="rules" className="mt-0">
                  <SectionCard
                    title="Alert Rules"
                    useSectionHeader
                    sectionHeaderIcon={Bell}
                    sectionHeaderSubtitle="Configure price alerts for your watched stocks"
                    sectionHeaderAction={
                      <Button
                        size="sm"
                        onClick={() => setShowCreateRule(true)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        Add Rule
                      </Button>
                    }
                  >
                    <div className="px-4 pb-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : rules.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-white/50">
                          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No alert rules configured</p>
                          <p className="text-xs mt-1">
                            Add a rule to start monitoring stock prices
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {rules.map((rule) => (
                            <div
                              key={rule.id}
                              className={`p-3 rounded-lg border ${rule.is_active
                                ? "bg-white dark:bg-card-dark border-gray-200 dark:border-white/10"
                                : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/5 opacity-60"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <span className="text-sm font-bold text-primary">
                                      {rule.symbol.slice(0, 2)}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {rule.symbol}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-white/50">
                                      ±{rule.daily_change_threshold}% daily, ±
                                      {rule.spike_change_threshold}% spike
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {rule.ai_analysis_enabled && (
                                    <Badge variant="outline" className="text-[10px]">
                                      AI
                                    </Badge>
                                  )}
                                  <div className="flex gap-1">
                                    {rule.channels.map((ch) => {
                                      const Icon = channelIcons[ch as NotificationChannelType];
                                      return (
                                        <div
                                          key={ch}
                                          className="w-5 h-5 rounded bg-gray-100 dark:bg-white/10 flex items-center justify-center"
                                          title={channelLabels[ch as NotificationChannelType]}
                                        >
                                          <Icon className="w-3 h-3 text-gray-600 dark:text-white/60" />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleRule(rule)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Power
                                      className={`w-3.5 h-3.5 ${rule.is_active
                                        ? "text-green-500"
                                        : "text-gray-400"
                                        }`}
                                    />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRule(rule)}
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {rule.premarket_enabled && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Pre-market
                                  </Badge>
                                )}
                                {rule.regular_hours_enabled && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Regular
                                  </Badge>
                                )}
                                {rule.afterhours_enabled && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    After-hours
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </TabsContent>

                {/* Notification Channels Tab */}
                <TabsContent value="channels" className="mt-0">
                  <SectionCard
                    title="Notification Channels"
                    useSectionHeader
                    sectionHeaderIcon={MessageSquare}
                    sectionHeaderSubtitle="Configure where you receive alert notifications"
                    sectionHeaderAction={
                      <Button
                        size="sm"
                        onClick={() => setShowCreateChannel(true)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        Add Channel
                      </Button>
                    }
                  >
                    <div className="px-4 pb-4">
                      {channels.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-white/50">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No notification channels configured</p>
                          <p className="text-xs mt-1">
                            Add Discord, Telegram, or other channels
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {channels.map((channel) => {
                            const Icon =
                              channelIcons[channel.channel_type as NotificationChannelType] ||
                              MessageSquare;
                            return (
                              <div
                                key={channel.id}
                                className="p-3 rounded-lg bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {channelLabels[channel.channel_type as NotificationChannelType]}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-white/50">
                                        {channel.is_verified ? (
                                          <span className="text-green-500 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Verified
                                          </span>
                                        ) : (
                                          <span className="text-amber-500 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            Not verified
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleTestChannel(channel)}
                                      className="h-7 text-xs gap-1"
                                    >
                                      <TestTube className="w-3 h-3" />
                                      Test
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteChannel(channel)}
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </TabsContent>

                {/* Alert History Tab */}
                <TabsContent value="history" className="mt-0">
                  <SectionCard
                    title="Alert History"
                    useSectionHeader
                    sectionHeaderIcon={History}
                    sectionHeaderSubtitle="Recent price alerts that were triggered"
                  >
                    <div className="px-4 pb-4">
                      {history.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-white/50">
                          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No alerts triggered yet</p>
                          <p className="text-xs mt-1">
                            Alerts will appear here when triggered
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {history.map((alert) => (
                            <div
                              key={alert.id}
                              className="p-3 rounded-lg bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${alert.change_percent >= 0
                                      ? "bg-green-100 dark:bg-green-500/20"
                                      : "bg-red-100 dark:bg-red-500/20"
                                      }`}
                                  >
                                    {alert.change_percent >= 0 ? (
                                      <TrendingUp className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <TrendingDown className="w-4 h-4 text-red-600" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {alert.symbol}{" "}
                                      <span
                                        className={
                                          alert.change_percent >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }
                                      >
                                        {alert.change_percent >= 0 ? "+" : ""}
                                        {alert.change_percent.toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-white/50">
                                      ${alert.triggered_price.toFixed(2)} •{" "}
                                      {new Date(alert.triggered_at).toLocaleString()}
                                    </div>
                                    {alert.ai_summary && (
                                      <p className="text-xs mt-1 text-gray-600 dark:text-white/60">
                                        {alert.ai_summary}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {alert.risk_level && (
                                    <Badge
                                      variant={
                                        alert.risk_level === "高"
                                          ? "destructive"
                                          : alert.risk_level === "中"
                                            ? "secondary"
                                            : "outline"
                                      }
                                      className="text-[10px]"
                                    >
                                      {alert.risk_level}
                                    </Badge>
                                  )}
                                  <div className="flex gap-1">
                                    {alert.channels_sent.map((ch) => {
                                      const Icon = channelIcons[ch as NotificationChannelType];
                                      return Icon ? (
                                        <CheckCircle2
                                          key={ch}
                                          className="w-3 h-3 text-green-500"
                                          aria-label={`Sent to ${ch}`}
                                        />
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </TabsContent>
              </div>
            </div>
          </Tabs>

          {/* Create Rule Dialog */}
          <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Alert Rule</DialogTitle>
                <DialogDescription>
                  Set up price alerts for a stock symbol
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Stock Symbol</Label>
                  <Input
                    placeholder="e.g., AAPL, TSLA"
                    value={newRule.symbol}
                    onChange={(e) =>
                      setNewRule({ ...newRule, symbol: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Daily Change %</Label>
                    <Input
                      type="number"
                      value={newRule.daily_change_threshold}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          daily_change_threshold: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Spike Change %</Label>
                    <Input
                      type="number"
                      value={newRule.spike_change_threshold}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          spike_change_threshold: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Market Sessions</Label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.premarket_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, premarket_enabled: checked })
                        }
                      />
                      Pre-market
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.regular_hours_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, regular_hours_enabled: checked })
                        }
                      />
                      Regular
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.afterhours_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, afterhours_enabled: checked })
                        }
                      />
                      After-hours
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">AI Analysis</Label>
                  <Switch
                    checked={newRule.ai_analysis_enabled}
                    onCheckedChange={(checked) =>
                      setNewRule({ ...newRule, ai_analysis_enabled: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateRule(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRule}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Channel Dialog */}
          <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Notification Channel</DialogTitle>
                <DialogDescription>
                  Configure a new notification channel for alerts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel Type</Label>
                  <Select
                    value={newChannel.channel_type}
                    onValueChange={(value) =>
                      setNewChannel({
                        ...newChannel,
                        channel_type: value as NotificationChannelType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discord">Discord</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="wechat">WeChat</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newChannel.channel_type === "discord" && (
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      placeholder="https://discord.com/api/webhooks/..."
                      value={newChannel.discord_webhook_url}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          discord_webhook_url: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                {newChannel.channel_type === "telegram" && (
                  <>
                    <div className="space-y-2">
                      <Label>Bot Token</Label>
                      <Input
                        placeholder="123456789:ABC..."
                        value={newChannel.telegram_bot_token}
                        onChange={(e) =>
                          setNewChannel({
                            ...newChannel,
                            telegram_bot_token: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Chat ID</Label>
                      <Input
                        placeholder="123456789"
                        value={newChannel.telegram_chat_id}
                        onChange={(e) =>
                          setNewChannel({
                            ...newChannel,
                            telegram_chat_id: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {newChannel.channel_type === "wechat" && (
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                      value={newChannel.wechat_webhook_url}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          wechat_webhook_url: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                {newChannel.channel_type === "whatsapp" && (
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      placeholder="+14155552671"
                      value={newChannel.whatsapp_phone_number}
                      onChange={(e) =>
                        setNewChannel({
                          ...newChannel,
                          whatsapp_phone_number: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateChannel(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateChannel}>Add Channel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
