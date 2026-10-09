"use client";

import { useState } from "react";
import { ExternalLink, Loader2, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "./CreatorAvatar";
import { useTranslation } from "@/lib/i18n";
import { getYouTubeCreatorProfile, type YouTubeCreatorSummary } from "@/lib/youtubeOpinionsApi";

export default function CreatorProfileDialog({ creator, onLoaded, compact = false }: {
  creator: YouTubeCreatorSummary;
  onLoaded?: (profile: YouTubeCreatorSummary) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const intlLocale = t("common.intlLocale");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<YouTubeCreatorSummary | null>(null);
  const [error, setError] = useState("");
  const current = profile || creator;
  const title = current.channel_title || creator.channel_id;

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const result = await getYouTubeCreatorProfile(creator.channel_id);
      setProfile(result);
      onLoaded?.(result);
    } catch {
      setError(t("youtubeOpinions.profile.unavailableExisting"));
    } finally { setLoading(false); }
  }

  function formatCount(value?: number | null) {
    return value === null || value === undefined ? t("youtubeOpinions.profile.notAvailable") : new Intl.NumberFormat(intlLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }

  const statistics = [
    [t("youtubeOpinions.profile.subscribers"), current.hidden_subscriber_count ? t("youtubeOpinions.profile.notPublic") : formatCount(current.subscriber_count)],
    [t("youtubeOpinions.profile.publicVideos"), formatCount(current.video_count)],
    [t("youtubeOpinions.profile.totalViews"), formatCount(current.view_count)],
    [t("youtubeOpinions.profile.importedOpinions"), formatCount(current.total_opinions)],
  ];

  return <>
    <button type="button" onClick={() => { setOpen(true); if (!profile && !loading) void loadProfile(); }} aria-haspopup="dialog" aria-label={`${title}: ${t("youtubeOpinions.profile.viewProfile")}`} title={t("youtubeOpinions.profile.viewProfile")} className={`flex max-w-full items-center gap-1.5 text-left text-sm font-medium hover:text-primary ${compact ? "h-11 w-11 shrink-0 justify-center" : ""}`}>
      {!compact && <span className="truncate">{title}</span>}<UserRound className={compact ? "h-5 w-5 text-muted-foreground" : "h-3.5 w-3.5 shrink-0 text-muted-foreground"} />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{current.channel_handle || t("youtubeOpinions.profile.publicProfile")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-5">
          <div className="flex items-center gap-4">
            <CreatorAvatar name={title} avatarUrl={current.channel_avatar_url?.startsWith("https://") ? current.channel_avatar_url : null} size="xl" />
            <div className="min-w-0"><p className="break-words text-sm font-medium">{title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{current.channel_handle || creator.channel_id}</p></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline">{current.profile_source === "youtube" ? t("youtubeOpinions.profile.sourceYoutube") : t("youtubeOpinions.profile.sourceImported")}</Badge>
            {current.channel_url && /^https:\/\/www\.youtube\.com\//.test(current.channel_url) && <a href={current.channel_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary">{t("youtubeOpinions.profile.openChannel")}<ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
          {loading && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("youtubeOpinions.profile.loading")}</div>}
          {(error || (profile && profile.profile_status !== "available")) && <p role="status" className="text-sm text-muted-foreground">{error || t("youtubeOpinions.profile.unavailableImported")}</p>}
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 border-y border-border py-5 sm:grid-cols-4">
            {statistics.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-medium tabular-nums">{value}</p></div>)}
          </div>
          <div className="space-y-2"><h3 className="text-sm font-medium">{t("youtubeOpinions.profile.about")}</h3><p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{current.description || t("youtubeOpinions.profile.noDescription")}</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {current.country && <span>{t("youtubeOpinions.profile.country")}: {current.country}</span>}
            {current.channel_published_at && Number.isFinite(Date.parse(current.channel_published_at)) && <span>{t("youtubeOpinions.profile.created")}: {new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(current.channel_published_at))}</span>}
          </div>
          <div className="flex flex-wrap gap-2">{current.top_tickers.map(stock => <Badge variant="secondary" key={stock.ticker} className="gap-2"><span aria-hidden="true"><CompanyLogo symbol={stock.ticker} size="xs" /></span>{stock.ticker}</Badge>)}</div>
          {current.profile_source === "youtube" && <p className="text-xs text-muted-foreground">{t("youtubeOpinions.profile.subscriberNote")}</p>}
          <div className="flex justify-end"><Button variant="outline" size="sm" onClick={loadProfile} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("youtubeOpinions.profile.refresh")}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
