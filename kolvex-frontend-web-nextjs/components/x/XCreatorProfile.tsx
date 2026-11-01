"use client";

import { ExternalLink, MapPin, Link2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "@/lib/i18n";
import type { XCreator } from "@/lib/xContentApi";
import XTranslatedText from "./XTranslatedText";

export function CreatorAvatar({ creator, username, large = false }: { creator?: XCreator | null; username: string; large?: boolean }) {
  return <Avatar className={large ? "h-16 w-16" : "h-10 w-10"}>
    <AvatarImage src={creator?.avatar_url || undefined} alt="" referrerPolicy="no-referrer" className="object-cover" />
    <AvatarFallback className="text-sm font-semibold" aria-hidden="true">{(creator?.display_name || username).slice(0, 2).toUpperCase()}</AvatarFallback>
  </Avatar>;
}

export default function XCreatorProfile({ creator }: { creator: XCreator }) {
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => locale === "zh" ? zh : en;
  const number = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");
  const website = creator.website?.startsWith("https://") ? creator.website : null;
  return <section className="space-y-4 border-b border-border pb-6" aria-label={c("Creator profile", "博主资料")}>
    <div className="flex items-center gap-4">
      <CreatorAvatar creator={creator} username={creator.username} large />
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-xl font-semibold">{creator.display_name}</h2>
        <a href={`https://x.com/${creator.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none ">@{creator.username}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
      </div>
    </div>
    {creator.bio && <XTranslatedText text={creator.bio} compact />}
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
      {creator.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{creator.location}</span>}
      {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 break-all rounded-sm hover:text-foreground hover:underline focus-visible:outline-none "><Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />{website.replace(/^https:\/\//, "").replace(/\/$/, "")}</a>}
    </div>
    {(creator.followers_count != null || creator.following_count != null) && <dl className="flex flex-wrap gap-5 text-sm">
      {creator.followers_count != null && <div className="flex gap-1.5"><dd className="font-semibold tabular-nums">{number.format(creator.followers_count)}</dd><dt className="text-muted-foreground">{c("followers", "关注者")}</dt></div>}
      {creator.following_count != null && <div className="flex gap-1.5"><dd className="font-semibold tabular-nums">{number.format(creator.following_count)}</dd><dt className="text-muted-foreground">{c("following", "正在关注")}</dt></div>}
    </dl>}
  </section>;
}
