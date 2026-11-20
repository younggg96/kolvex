"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketStockHref } from "@/lib/stockLinks";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { richRemarkPlugins, richUrlTransform, stripEmoji } from "@/lib/markdown/prose";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CompanyLogo from "@/components/ui/company-logo";
import { describeStrength, toneText } from "@/components/youtube/strength";
import {
  SHARE_KIND_LABELS,
  shareSourceUrl,
  type ContentShare,
  type ShareCard,
} from "@/lib/contentShare";

const PROSE =
  "prose prose-sm dark:prose-invert max-w-none break-words text-[0.9375rem] leading-7 text-foreground/90 prose-headings:text-foreground prose-headings:font-semibold prose-strong:text-foreground prose-a:text-foreground prose-a:underline-offset-4 prose-p:my-2.5 prose-li:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function Markdown({ children }: { children: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={richRemarkPlugins()} urlTransform={richUrlTransform}>
        {stripEmoji(children)}
      </ReactMarkdown>
    </div>
  );
}

function Tickers({ tickers }: { tickers: string[] }) {
  if (!tickers.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {tickers.slice(0, 6).map((ticker) => (
        <Link
          key={ticker}
          href={marketStockHref(ticker)}
          className="figure inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-semibold hover:bg-muted"
        >
          <span aria-hidden="true">
            <CompanyLogo symbol={ticker} size="xs" />
          </span>
          {ticker}
        </Link>
      ))}
    </span>
  );
}

function Points({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function KindBody({ share }: { share: Pick<ContentShare, "kind" | "card"> }) {
  const c = useCopy();
  const { locale, t } = useTranslation();
  const zh = locale === "zh";
  const data = share.card.data || {};
  switch (share.kind) {
    case "chat": {
      const question = str(data.question);
      const answer = str(data.answer);
      return (
        <div className="space-y-4">
          {question && (
            <p className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-3xl border border-foreground/10 bg-muted/60 px-4 py-2.5 text-[0.9375rem] leading-relaxed">
              {question}
            </p>
          )}
          {data.excerpt ? (
            <blockquote className="whitespace-pre-wrap border-l-2 border-positive/60 pl-4 text-[0.9375rem] leading-7">
              {stripEmoji(answer)}
            </blockquote>
          ) : (
            <Markdown>{answer}</Markdown>
          )}
        </div>
      );
    }
    case "opinion": {
      const sentiment = str(data.sentiment);
      const strength = describeStrength(
        typeof data.direction_score === "number" ? data.direction_score : null,
        { t },
      );
      const sentimentLabel: Record<string, string> = {
        bullish: c("Bullish", "看多"),
        bearish: c("Bearish", "看空"),
        neutral: c("Neutral", "中性"),
        mixed: c("Mixed", "分歧"),
      };
      return (
        <div className="space-y-4">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="figure text-lg font-semibold">{str(data.ticker)}</span>
            {str(data.company_name) && (
              <span className="text-sm text-muted-foreground">{str(data.company_name)}</span>
            )}
            <span className={cn("text-sm font-medium", toneText[strength.tone])}>
              {strength.available ? strength.label : sentimentLabel[sentiment] || sentiment}
            </span>
          </p>
          {str(data.summary) && <p className="text-[0.9375rem] leading-7">{str(data.summary)}</p>}
          {str(data.thesis) && str(data.thesis) !== str(data.summary) && (
            <p className="text-sm leading-6 text-muted-foreground">{str(data.thesis)}</p>
          )}
          <Points title={c("Key points", "要点")} items={list(data.key_points)} />
          <Points title={c("Risks", "风险")} items={list(data.risks)} />
        </div>
      );
    }
    case "x_post": {
      const summary = (data.ai_summary as Record<string, string> | null)?.[zh ? "zh" : "en"];
      const image = str(data.image_url);
      return (
        <div className="space-y-4">
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-7">{str(data.text)}</p>
          {list(data.quoted_texts).map((quote, index) => (
            <blockquote
              key={index}
              className="whitespace-pre-wrap rounded-2xl border border-border px-4 py-3 text-sm leading-6 text-muted-foreground"
            >
              {quote}
            </blockquote>
          ))}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              className="max-h-96 w-full rounded-2xl border border-border object-cover"
            />
          )}
          {summary && (
            <div className="rounded-2xl bg-muted/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">{c("AI summary", "AI 摘要")}</p>
              <p className="mt-1 text-sm leading-6">{summary}</p>
            </div>
          )}
        </div>
      );
    }
    case "person_update": {
      const image = str(data.image_url);
      return (
        <div className="space-y-3">
          <p className="text-lg font-semibold leading-snug">{share.card.title}</p>
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-7">{str(data.summary)}</p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={str(data.image_alt)}
              loading="lazy"
              className="max-h-96 w-full rounded-2xl border border-border object-cover"
            />
          )}
        </div>
      );
    }
    case "options_candidate": {
      const call = data.type === "call";
      const confidence: Record<string, string> = {
        low: c("Low confidence", "低置信度"),
        medium: c("Medium confidence", "中置信度"),
        high: c("High confidence", "高置信度"),
      };
      const reasons: [string, string][] = [
        [c("Why this direction", "方向理由"), str(zh ? data.thesis_zh : data.thesis_en)],
        [c("Key risks", "关键风险"), str(zh ? data.risk_zh : data.risk_en)],
        [
          c("No longer holds if", "失效条件"),
          str(zh ? data.invalidation_zh : data.invalidation_en),
        ],
      ];
      return (
        <div className="space-y-4">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="figure text-lg font-semibold">
              {str(data.underlying)} ${String(data.strike ?? "")}
            </span>
            <span className={cn("text-sm font-medium", call ? "text-positive" : "text-negative")}>
              {call ? c("Call · upside", "Call · 看涨") : c("Put · downside", "Put · 看跌")}
            </span>
            <span className="figure text-xs text-muted-foreground">
              {c("Expires", "到期")} {str(data.expiration)}
            </span>
            {str(data.confidence) && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {confidence[str(data.confidence)]}
              </span>
            )}
          </p>
          <dl className="space-y-3">
            {reasons
              .filter(([, text]) => text)
              .map(([label, text]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm leading-6">{text}</dd>
                </div>
              ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {c(
              "AI-picked contracts to research, not orders. Premium traded has no buy/sell side.",
              "AI 挑选的研究候选，不是下单指令；成交额不代表买卖方向。",
            )}
          </p>
        </div>
      );
    }
    case "research":
      return (
        <div className="space-y-3">
          {str(data.final_decision) && (
            <p className="text-sm">
              <span className="text-muted-foreground">{c("Conclusion", "结论")}：</span>
              <span className="font-semibold">{str(data.final_decision)}</span>
            </p>
          )}
          <Markdown>{str(data.plan)}</Markdown>
        </div>
      );
  }
}

function SourceLink({ card, kind }: { card: ShareCard; kind: ContentShare["kind"] }) {
  const c = useCopy();
  const url = shareSourceUrl(card, "");
  if (!url) return null;
  const label =
    card.source?.platform === "youtube"
      ? c("Watch the source video", "查看原视频")
      : card.source?.platform === "x"
        ? c("Open the original post", "查看原帖")
        : kind === "research"
          ? c("Read the full report", "阅读完整报告")
          : c("Open the source", "查看原始来源");
  const internal = url.startsWith("/");
  const className =
    "inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";
  return internal ? (
    <Link href={url} className={className}>
      {label}
    </Link>
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/** What a recipient sees: one consistent card for every kind of content. */
export function SharedCard({
  share,
  className,
}: {
  share: Pick<ContentShare, "kind" | "card">;
  className?: string;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const { card, kind } = share;
  const author = card.author;
  const authorName = locale === "en" && author?.name_en ? author.name_en : author?.name || "";
  const date = card.published_at
    ? formatOpinionDate(card.published_at, locale === "zh" ? "zh-CN" : "en-US")
    : "";
  const kindLabel = c(...SHARE_KIND_LABELS[kind]);
  return (
    <article
      className={cn(
        "glass-card min-w-0 rounded-3xl border border-foreground/10 bg-card-glass p-5 md:p-6",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {author?.name ? (
            <CreatorAvatar name={authorName} avatarUrl={author.avatar_url} size="md" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {author?.path ? (
                <Link href={author.path} className="underline-offset-4 hover:underline">
                  {authorName}
                </Link>
              ) : (
                authorName || kindLabel
              )}
              {author?.handle && (
                <span className="ml-1.5 font-normal text-muted-foreground">@{author.handle}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {[author?.name ? kindLabel : "", date].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {kind !== "opinion" && kind !== "options_candidate" && <Tickers tickers={card.tickers} />}
      </header>
      <div className="mt-5">
        <KindBody share={share} />
      </div>
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <SourceLink card={card} kind={kind} />
        {(kind === "chat" || kind === "research" || kind === "options_candidate") && (
          <span className="text-xs text-muted-foreground">
            {c("AI-generated · not investment advice", "AI 生成 · 不构成投资建议")}
          </span>
        )}
      </footer>
    </article>
  );
}
