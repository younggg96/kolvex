"use client";
import Link from "next/link";
import { Bookmark, ExternalLink, CandlestickChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { NEWS_CATEGORIES, articleCategories, isFocusHeadline, type FeedArticle } from "@/lib/newsFeed";

export default function NewsDetail({ article, saved, onSave }: { article: FeedArticle; saved: boolean; onSave: () => void }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const categories = articleCategories(article);
  return <div className="space-y-6 p-5">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>FinancialJuice · RSS</span>
      <Button variant="ghost" size="sm" aria-pressed={saved} onClick={onSave}><Bookmark className="mr-1.5 h-4 w-4" fill={saved ? "currentColor" : "none"} />{saved ? c("Saved", "已收藏") : c("Save", "收藏")}</Button>
    </div>
    <div>
      <h3 className="text-lg font-semibold leading-relaxed">{article.title}</h3>
      <p className="mt-3 text-xs text-muted-foreground">{article.publish_time ? new Date(article.publish_time * 1000).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : c("Publication time unavailable", "发布时间未知")}</p>
    </div>
    {categories.length > 0 && <div>
      <p className="mb-2 text-xs text-muted-foreground">{c("Kolvex keyword categories", "Kolvex 关键词分类")}</p>
      <div className="flex flex-wrap gap-2">{categories.map(id => { const category = NEWS_CATEGORIES.find(v => v.id === id)!; return <span key={id} className="rounded border border-border px-2 py-1 text-xs">{c(category.en, category.zh)}</span>; })}</div>
    </div>}
    {isFocusHeadline(article) && <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">{c("Matched the focus keyword screen. This is not a source importance rating or a prediction of price direction.", "命中重点关键词规则，不代表来源的重要性评级，也不预测价格方向。")}</p>}
    <div className="border-t border-border pt-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium"><CandlestickChart className="h-4 w-4" />{c("Related symbols", "相关标的")}</h4>
      {article.symbols.length ? <div className="flex flex-wrap gap-2">{article.symbols.map(symbol => <Button key={symbol} asChild variant="outline" size="sm"><Link href={`/dashboard/market/${encodeURIComponent(symbol)}`}>{symbol} ↗</Link></Button>)}</div> : <p className="text-sm text-muted-foreground">{c("No explicit $TICKER in this headline.", "标题中没有明确的 $股票代码。")}</p>}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{c("RSS provides the headline and source link. Open the original for any additional context. The source may be delayed.", "RSS 提供标题和原文链接，更多背景请查看原文。来源可能存在延迟。")}</p>
    <Button asChild className="w-full"><a href={article.link} target="_blank" rel="noopener noreferrer">{c("Read on FinancialJuice", "查看 FinancialJuice 原文")}<ExternalLink className="ml-2 h-4 w-4" /><span className="sr-only">{c("New tab", "新标签页")}</span></a></Button>
  </div>;
}
