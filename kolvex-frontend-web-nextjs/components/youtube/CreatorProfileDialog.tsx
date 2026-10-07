"use client";

import { useState } from "react";
import { ExternalLink, Loader2, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { getYouTubeCreatorProfile, type YouTubeCreatorSummary } from "@/lib/youtubeOpinionsApi";

export default function CreatorProfileDialog({ creator, onLoaded }: {
  creator: YouTubeCreatorSummary;
  onLoaded?: (profile: YouTubeCreatorSummary) => void;
}) {
  const { locale } = useTranslation();
  const zh = locale === "zh";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<YouTubeCreatorSummary | null>(null);
  const [error, setError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const current = profile || creator;
  const title = current.channel_title || creator.channel_id;

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const result = await getYouTubeCreatorProfile(creator.channel_id);
      setProfile(result);
      setAvatarFailed(false);
      onLoaded?.(result);
    } catch {
      setError(zh ? "暂时无法获取最新频道资料，当前展示已有资料。" : "Latest channel details are unavailable. Showing existing details.");
    } finally { setLoading(false); }
  }

  function formatCount(value?: number | null) {
    return value === null || value === undefined ? (zh ? "未提供" : "Not available") : new Intl.NumberFormat(zh ? "zh-CN" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }

  const statistics = [
    [zh ? "订阅者" : "Subscribers", current.hidden_subscriber_count ? (zh ? "未公开" : "Not public") : formatCount(current.subscriber_count)],
    [zh ? "公开视频" : "Public videos", formatCount(current.video_count)],
    [zh ? "总观看量" : "Total views", formatCount(current.view_count)],
    [zh ? "已导入观点" : "Imported opinions", formatCount(current.total_opinions)],
  ];

  return <>
    <button type="button" onClick={() => { setOpen(true); if (!profile && !loading) void loadProfile(); }} aria-haspopup="dialog" aria-label={`${title}: ${zh ? "查看频道资料" : "View channel profile"}`} title={zh ? "查看频道资料" : "View channel profile"} className="flex max-w-full items-center gap-1.5 text-left text-sm font-medium hover:text-primary">
      <span className="truncate">{title}</span><UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{current.channel_handle || (zh ? "YouTube 公开频道资料" : "Public YouTube channel profile")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-medium">
              {title.slice(0, 1).toUpperCase()}
              {current.channel_avatar_url?.startsWith("https://") && !avatarFailed && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.channel_avatar_url} alt={title} onError={() => setAvatarFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0"><p className="break-words text-sm font-medium">{title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{current.channel_handle || creator.channel_id}</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline">{current.profile_source === "youtube" ? (zh ? "来源：YouTube" : "Source: YouTube") : (zh ? "来源：导入资料" : "Source: imported data")}</Badge>
            {current.channel_url && /^https:\/\/www\.youtube\.com\//.test(current.channel_url) && <a href={current.channel_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary">{zh ? "打开 YouTube 频道" : "Open YouTube channel"}<ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
          {loading && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{zh ? "正在获取频道资料…" : "Loading channel details…"}</div>}
          {(error || (profile && profile.profile_status !== "available")) && <p role="status" className="text-sm text-muted-foreground">{error || (zh ? "最新频道资料暂不可用，以下展示已导入的资料。" : "Latest channel details are unavailable. Showing imported data.")}</p>}
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-border py-5 sm:grid-cols-4">
            {statistics.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-medium tabular-nums">{value}</p></div>)}
          </div>
          <div className="space-y-2"><h3 className="text-sm font-medium">{zh ? "频道简介" : "About the channel"}</h3><p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{current.description || (zh ? "暂无频道简介" : "No channel description available.")}</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {current.country && <span>{zh ? "地区" : "Country"}: {current.country}</span>}
            {current.channel_published_at && Number.isFinite(Date.parse(current.channel_published_at)) && <span>{zh ? "频道创建于" : "Channel created"}: {new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(current.channel_published_at))}</span>}
          </div>
          <div className="flex flex-wrap gap-2">{current.top_tickers.map(stock => <Badge variant="secondary" key={stock.ticker}>{stock.ticker}</Badge>)}</div>
          {current.profile_source === "youtube" && <p className="text-xs text-muted-foreground">{zh ? "订阅数按 YouTube 公开口径展示，可能经过取整。" : "Subscriber counts follow YouTube's public, rounded figures."}</p>}
          <div className="flex justify-end"><Button variant="outline" size="sm" onClick={loadProfile} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{zh ? "刷新资料" : "Refresh profile"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
