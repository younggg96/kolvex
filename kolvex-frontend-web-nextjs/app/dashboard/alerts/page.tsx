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
import { useTranslation } from "@/lib/i18n";

const alertsTabs = [
  { value: "rules", icon: Bell, labelKey: "alerts.tabs.rules" },
  { value: "channels", icon: MessageSquare, labelKey: "alerts.tabs.channels" },
  { value: "history", icon: History, labelKey: "alerts.tabs.history" },
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
  const { t } = useTranslation();
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
      toast.error(t("alerts.rules.enterSymbol"));
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

      toast.success(t("alerts.rules.ruleCreated", { symbol: newRule.symbol.toUpperCase() }));
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
      toast.error(error.message || t("alerts.rules.createFailed"));
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await toggleAlertRule(rule.id);
      toast.success(
        rule.is_active
          ? t("alerts.rules.disabledAlerts", { symbol: rule.symbol })
          : t("alerts.rules.enabledAlerts", { symbol: rule.symbol })
      );
      loadRules();
    } catch (error) {
      toast.error(t("alerts.rules.toggleFailed"));
    }
  };

  const handleDeleteRule = async (rule: AlertRule) => {
    try {
      await deleteAlertRule(rule.id);
      toast.success(t("alerts.rules.deletedRule", { symbol: rule.symbol }));
      loadRules();
    } catch (error) {
      toast.error(t("alerts.rules.deleteFailed"));
    }
  };

  const handleCreateChannel = async () => {
    try {
      await createNotificationChannel(newChannel);
      toast.success(t("alerts.channels.channelAdded", { channel: channelLabels[newChannel.channel_type] }));
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
      toast.error(error.message || t("alerts.channels.channelCreateFailed"));
    }
  };

  const handleTestChannel = async (channel: NotificationChannel) => {
    try {
      const result = await testNotificationChannel(channel.id);
      if (result.success) {
        toast.success(t("alerts.channels.testSent"));
        loadChannels();
      } else {
        toast.error(t("alerts.channels.testFailed", { message: result.message }));
      }
    } catch (error) {
      toast.error(t("alerts.channels.testSendFailed"));
    }
  };

  const handleDeleteChannel = async (channel: NotificationChannel) => {
    try {
      await deleteNotificationChannel(channel.id);
      toast.success(t("alerts.channels.channelDeleted", { channel: channelLabels[channel.channel_type as NotificationChannelType] }));
      loadChannels();
    } catch (error) {
      toast.error(t("alerts.channels.channelDeleteFailed"));
    }
  };

  const tabOptions = alertsTabs.map((tab) => ({
    value: tab.value,
    label: t(tab.labelKey),
    icon: <tab.icon className="w-4 h-4" />,
  }));

  return (
    <DashboardLayout title={t("alerts.title")}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 min-w-0">
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("alerts.stats.activeRules")}</div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.active_rules}
                </div>
              </div>
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("alerts.stats.alertsCount")}</div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.total_alerts}
                </div>
              </div>
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("alerts.stats.avgPerDay")}</div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.avg_alerts_per_day}
                </div>
              </div>
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("alerts.stats.topStock")}</div>
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
                className="!w-fit border border-border rounded-lg"
              />

              <div className="flex-1 min-w-0">
                {/* Alert Rules Tab */}
                <TabsContent value="rules" className="mt-0">
                  <SectionCard
                    title={t("alerts.rules.title")}
                    useSectionHeader
                    sectionHeaderIcon={Bell}
                    sectionHeaderSubtitle={t("alerts.rules.subtitle")}
                    sectionHeaderAction={
                      <Button
                        size="sm"
                        onClick={() => setShowCreateRule(true)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        {t("alerts.rules.addRule")}
                      </Button>
                    }
                  >
                    <div className="px-4 pb-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : rules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">{t("alerts.rules.noRules")}</p>
                          <p className="text-xs mt-1">
                            {t("alerts.rules.noRulesHint")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {rules.map((rule) => (
                            <div
                              key={rule.id}
                              className={`p-3 rounded-lg border ${rule.is_active
                                ? "bg-card border-border"
                                : "bg-muted border-border opacity-60"
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
                                    <div className="font-medium text-foreground">
                                      {rule.symbol}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
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
                                          className="w-5 h-5 rounded bg-muted flex items-center justify-center"
                                          title={channelLabels[ch as NotificationChannelType]}
                                        >
                                          <Icon className="w-3 h-3 text-muted-foreground" />
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
                                    {t("alerts.rules.preMarket")}
                                  </Badge>
                                )}
                                {rule.regular_hours_enabled && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {t("alerts.rules.regular")}
                                  </Badge>
                                )}
                                {rule.afterhours_enabled && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {t("alerts.rules.afterHours")}
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
                    title={t("alerts.channels.title")}
                    useSectionHeader
                    sectionHeaderIcon={MessageSquare}
                    sectionHeaderSubtitle={t("alerts.channels.subtitle")}
                    sectionHeaderAction={
                      <Button
                        size="sm"
                        onClick={() => setShowCreateChannel(true)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        {t("alerts.channels.addChannel")}
                      </Button>
                    }
                  >
                    <div className="px-4 pb-4">
                      {channels.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">{t("alerts.channels.noChannels")}</p>
                          <p className="text-xs mt-1">
                            {t("alerts.channels.noChannelsHint")}
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
                                className="p-3 rounded-lg bg-card border border-border"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-foreground">
                                        {channelLabels[channel.channel_type as NotificationChannelType]}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {channel.is_verified ? (
                                          <span className="text-green-500 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {t("common.verified")}
                                          </span>
                                        ) : (
                                          <span className="text-amber-500 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {t("common.notVerified")}
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
                                      {t("common.test")}
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
                    title={t("alerts.history.title")}
                    useSectionHeader
                    sectionHeaderIcon={History}
                    sectionHeaderSubtitle={t("alerts.history.subtitle")}
                  >
                    <div className="px-4 pb-4">
                      {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">{t("alerts.history.noAlerts")}</p>
                          <p className="text-xs mt-1">
                            {t("alerts.history.noAlertsHint")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {history.map((alert) => (
                            <div
                              key={alert.id}
                              className="p-3 rounded-lg bg-card border border-border"
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
                                    <div className="font-medium text-foreground">
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
                                    <div className="text-xs text-muted-foreground">
                                      ${alert.triggered_price.toFixed(2)} •{" "}
                                      {new Date(alert.triggered_at).toLocaleString()}
                                    </div>
                                    {alert.ai_summary && (
                                      <p className="text-xs mt-1 text-muted-foreground">
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
                <DialogTitle>{t("alerts.rules.createTitle")}</DialogTitle>
                <DialogDescription>
                  {t("alerts.rules.createDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("alerts.rules.stockSymbol")}</Label>
                  <Input
                    placeholder={t("alerts.rules.stockSymbolPlaceholder")}
                    value={newRule.symbol}
                    onChange={(e) =>
                      setNewRule({ ...newRule, symbol: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t("alerts.rules.dailyChange")}</Label>
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
                    <Label className="text-xs">{t("alerts.rules.spikeChange")}</Label>
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
                  <Label className="text-xs">{t("alerts.rules.marketSessions")}</Label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.premarket_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, premarket_enabled: checked })
                        }
                      />
                      {t("alerts.rules.preMarket")}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.regular_hours_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, regular_hours_enabled: checked })
                        }
                      />
                      {t("alerts.rules.regular")}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={newRule.afterhours_enabled}
                        onCheckedChange={(checked) =>
                          setNewRule({ ...newRule, afterhours_enabled: checked })
                        }
                      />
                      {t("alerts.rules.afterHours")}
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("alerts.rules.aiAnalysis")}</Label>
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
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateRule}>{t("alerts.rules.createRule")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Channel Dialog */}
          <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("alerts.channels.createTitle")}</DialogTitle>
                <DialogDescription>
                  {t("alerts.channels.createDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("alerts.channels.channelType")}</Label>
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
                    <Label>{t("alerts.channels.webhookUrl")}</Label>
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
                      <Label>{t("alerts.channels.botToken")}</Label>
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
                      <Label>{t("alerts.channels.chatId")}</Label>
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
                    <Label>{t("alerts.channels.webhookUrl")}</Label>
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
                    <Label>{t("alerts.channels.phoneNumber")}</Label>
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
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateChannel}>{t("alerts.channels.addChannelBtn")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
