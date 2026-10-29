"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import ImageContent from "./BriefImage";
import { useTranslation } from "@/lib/i18n";
import { localizedBrief, type BriefSection, type DailyBrief } from "@/lib/dailyBriefs";

function Markdown({ children }: { children: string }) {
  return <div className="space-y-3 break-words text-[15px] leading-7 [&_a]:underline [&_ul]:list-inside [&_ul]:list-disc"><ReactMarkdown skipHtml allowedElements={["p", "strong", "em", "ul", "ol", "li", "br", "a", "blockquote"]} components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a> }}>{children}</ReactMarkdown></div>;
}
function DetailsList({ items }: { items: { name: string; detail: string }[] }) {
  return <ul className="space-y-3">{items.map((item, i) => <li key={i}><p className="font-medium">{item.name}</p><Markdown>{item.detail}</Markdown></li>)}</ul>;
}
function SectionBody({ section }: { section: BriefSection }) {
  const { t } = useTranslation();
  const paragraphs = Array.isArray(section.narrative) ? section.narrative : [section.narrative];
  return <div className="space-y-6">
    {[...paragraphs, ...section.paragraphs].filter(Boolean).map((text, i) => <Markdown key={i}>{text}</Markdown>)}
    {["market_recap", "premarket", "intraday", "postmarket"].includes(section.section_id) && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{section.indices.map((index, i) => <dl key={i} className="rounded-xl border border-border p-4">
        <dt className="font-medium">{index.name}</dt>
        {index.close !== null && <dd className="figure mt-2 text-2xl font-semibold">{index.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>}
        {index.change_pct !== null && <dd className={`figure mt-1 text-sm ${index.change_pct > 0 ? "text-positive" : index.change_pct < 0 ? "text-negative" : "text-muted-foreground"}`}>{index.change_pct > 0 ? "+" : ""}{index.change_pct.toFixed(2)}%</dd>}
        {index.prev_close !== null && <dd className="mt-1 text-xs text-muted-foreground">{t("briefs.previousClose")} {index.prev_close.toLocaleString("en-US")}</dd>}
        {index.note && <dd className="mt-2 text-xs text-muted-foreground">{index.note}</dd>}
      </dl>)}</div>
      <div className="grid gap-6 sm:grid-cols-2">{section.movers_up.length > 0 && <div><h3 className="mb-3 font-semibold text-positive">{t("briefs.gainers")}</h3><DetailsList items={section.movers_up} /></div>}{section.movers_down.length > 0 && <div><h3 className="mb-3 font-semibold text-negative">{t("briefs.losers")}</h3><DetailsList items={section.movers_down} /></div>}</div>
      {section.commodities.length > 0 && <div className="flex flex-wrap gap-2">{section.commodities.map((item, i) => <p key={i} className="rounded-xl bg-muted px-3 py-2 text-sm leading-6"><strong>{item.name}</strong> {item.detail}</p>)}</div>}
    </>}
    {section.items.map((item, i) => <article key={i} className="space-y-5 rounded-xl border border-border p-4 sm:p-6">
      {item.image && <ImageContent key={item.image.url} image={item.image} />}
      <div className="space-y-3">{item.kicker && <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium">{item.kicker}</span>}{item.time_pt && <p className="text-sm text-muted-foreground">{item.time_pt} PT</p>}<h3 className="text-xl font-semibold leading-8">{item.title}</h3>{item.summary && <Markdown>{item.summary}</Markdown>}{item.detail && <Markdown>{item.detail}</Markdown>}</div>
      {item.checklist.length > 0 && <ul className="space-y-2">{item.checklist.map((line, j) => <li key={j} className="flex gap-2 text-sm leading-6"><span aria-hidden="true">□</span>{line}</li>)}</ul>}
      {item.key_stats.length > 0 && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{item.key_stats.map((stat, j) => <div key={j} className="min-w-0 rounded-xl bg-muted p-3"><dt className="text-xs text-muted-foreground">{stat.label}</dt><dd className="figure mt-1 break-words text-lg font-semibold">{stat.value}</dd></div>)}</dl>}
      {item.impact && <div className="grid gap-3 sm:grid-cols-2">{([['short_term', 'shortTerm'], ['positioning', 'positioning'], ['long_term', 'longTerm'], ['price_range', 'priceRange']] as const).map(([key, title]) => item.impact?.[key] ? <details key={key} open={key === "short_term" || key === "positioning"} className="rounded-xl bg-muted p-4"><summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2">{t(`briefs.${title}`)}</summary><div className="mt-3"><Markdown>{item.impact[key]}</Markdown></div></details> : null)}</div>}
      <div className="flex flex-wrap gap-3 text-xs">{item.sources.map((source, j) => <a key={j} href={source.url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">{source.name} <span className="text-muted-foreground">{new URL(source.url).hostname}</span></a>)}</div>
      <div className="flex flex-wrap gap-2">{item.related_tickers.map((ticker, j) => /^[A-Za-z^][A-Za-z0-9.^=-]{0,14}$/.test(ticker) ? <Link key={j} href={`/dashboard/market/${encodeURIComponent(ticker.toUpperCase())}`} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2">{ticker}</Link> : <span key={j} className="text-xs">{ticker}</span>)}</div>
    </article>)}
    {section.takeaway && <blockquote className="border-l-2 border-primary pl-5 text-xl font-semibold leading-9">{section.takeaway}</blockquote>}
    {section.strategy_line && <div className="rounded-xl bg-positive/10 p-4"><Markdown>{section.strategy_line}</Markdown></div>}
    {section.events.length > 0 && <ol className="space-y-6 border-l border-border pl-5">{section.events.map((event, i) => <li key={i}><p className="text-xs text-muted-foreground">{event.date_label}</p><h3 className="my-2 font-semibold">{event.title}</h3><Markdown>{event.detail}</Markdown></li>)}</ol>}
  </div>;
}
export default function BriefContent({ document: original }: { document: DailyBrief }) {
  const { t, locale } = useTranslation();
  const document = localizedBrief(original, locale);
  const { brief } = document;
  return <article lang={(document.language ?? "zh") === "zh" ? "zh-CN" : "en"} className="mx-auto max-w-[1080px] space-y-10 break-words">
    <header className="space-y-4">
      {brief.hero_image && <ImageContent key={brief.hero_image.url} image={brief.hero_image} />}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{brief.date}</span><span>{t(brief.market_status === "weekend" ? "briefs.weekend" : "briefs.tradingDay")}</span><span>{t(`briefs.${brief.type}`)}</span></div>
      <p className="text-sm font-medium">{brief.title}</p><h1 className="text-2xl font-semibold leading-tight sm:text-[32px]">{brief.headline}</h1><p className="text-sm leading-6 text-muted-foreground">{brief.subtitle}</p>
      <p className="text-xs text-muted-foreground">{t("briefs.generatedAt")} {brief.generated_at_pt}</p>
    </header>
    {[...document.sections].sort((a, b) => a.order - b.order).map(section => <section key={section.section_id} className="space-y-5 border-t border-border pt-6"><div><h2 className="text-xl font-semibold">{section.title}</h2>{section.subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.subtitle}</p>}</div><SectionBody section={section} /></section>)}
    {document.disclaimer && <footer className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">{document.disclaimer}</footer>}
  </article>;
}
