"use client";

import { formatTokens, type TokenUsage } from "@/lib/tokenUsage";
import { cn } from "@/lib/utils";
import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { visibleQuestion } from "./pageEvidence";
import { RevenueEvidenceCard } from "./RevenueEvidenceCard";
import { QuoteEvidenceGroup } from "./QuoteEvidenceCard";
import { WebSourcesButton, WebSourcesPanel, useWebSourcesPanel } from "./WebSources";
import { AnswerCheckNote } from "./AnswerCheckNote";
import { DataGapNote } from "./DataGapNote";
import { ShareButton } from "@/components/share/ShareButton";
import { SelectionShare } from "@/components/share/SelectionShare";
import { isSavedMessageId, type ShareCard } from "@/lib/contentShare";
import type { ChatBubbleProps } from "./types";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";
import { RICH_MARKDOWN_COMPONENTS } from "@/components/markdown/rich-markdown";
import { richRemarkPlugins, richUrlTransform, stripEmoji } from "@/lib/markdown/prose";

const CHAT_PROSE_CLASSES = cn(
  "prose prose-sm dark:prose-invert w-full min-w-0 max-w-none break-words text-[0.9375rem] leading-7 text-foreground/90",
  "prose-headings:mt-7 prose-headings:mb-3 prose-headings:font-semibold prose-headings:leading-snug prose-headings:tracking-tight prose-headings:text-foreground",
  "prose-h1:text-xl prose-h2:text-[1.0625rem] prose-h3:text-base prose-h4:text-[0.9375rem]",
  "prose-p:my-3 prose-p:text-[0.9375rem] prose-p:leading-7",
  "prose-ul:my-3 prose-ul:pl-5 prose-ol:my-3 prose-ol:pl-5 prose-li:my-1.5 prose-li:text-[0.9375rem] prose-li:leading-7 marker:font-medium marker:text-muted-foreground [&_li>p]:my-1",
  "prose-strong:text-foreground prose-strong:font-semibold prose-em:text-foreground/90",
  "prose-hr:my-7 prose-hr:border-border",
  "prose-a:text-foreground prose-a:decoration-border prose-a:underline-offset-4 hover:prose-a:decoration-foreground",
  "prose-code:text-[0.8125rem] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-2xl prose-pre:text-[0.8125rem] prose-pre:overflow-x-auto",
  "prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:border-l prose-blockquote:border-l-border prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg [&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
);

export function ChatBubble({
  role,
  content,
  isStreaming,
  timestamp,
  isFirst,
  onRetry,
  modelName,
  symbols,
  quoteEvidence,
  revenueEvidence,
  answerCheck,
  tokenUsage,
  webSources,
  messageId,
  question: askedQuestion,
}: ChatBubbleProps) {
  const { t } = useTranslation();
  const remarkPlugins = richRemarkPlugins(symbols);
  const [copied, setCopied] = useState(false);
  const sourcesPanel = useWebSourcesPanel();
  const isUser = role === "user";
  const question = isUser ? visibleQuestion(content) : content;
  // Assistant text is a report: emoji come from the model, not from this design.
  const displayContent = isUser ? content : stripEmoji(content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareable = !isUser && !isStreaming && isSavedMessageId(messageId);
  const asked = askedQuestion ? visibleQuestion(askedQuestion) : "";
  const sharePreview: ShareCard | undefined = shareable
    ? {
        v: 1,
        title: asked,
        summary: "",
        tickers: [],
        data: { question: asked, answer: displayContent, excerpt: false },
      }
    : undefined;

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return new Intl.DateTimeFormat(t("common.intlLocale"), {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end animate-fade-in">
        <div className="max-w-[88%] md:max-w-[70%]">
          <div
            className="glass-card rounded-3xl border border-foreground/10 bg-card-glass px-4 py-2.5 text-foreground"
            aria-label={t("chat.userName")}
          >
            <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">{question}</p>
          </div>
          {timestamp && (
            <p className="mt-1 px-1 text-right text-[0.6875rem] text-muted-foreground">
              {formatTime(timestamp)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group flex w-full justify-start animate-fade-in">
      <div className="w-full min-w-0 max-w-[45rem]">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t("chat.assistantName")}</span>
          {modelName && <span>{modelName}</span>}
          {timestamp && <span>{formatTime(timestamp)}</span>}
          {!isStreaming && tokenUsage && <ReplyTokens usage={tokenUsage} />}
        </div>

        <div className="text-foreground">
          <MaybeSelectionShare messageId={shareable ? messageId : undefined} question={asked}>
            <div className={CHAT_PROSE_CLASSES}>
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                urlTransform={richUrlTransform}
                components={RICH_MARKDOWN_COMPONENTS}
              >
                {displayContent}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex ml-0.5 align-middle">
                  <span className="h-[1.125rem] w-[0.1875rem] animate-pulse rounded-sm bg-foreground" />
                </span>
              )}
            </div>
          </MaybeSelectionShare>
        </div>

        {!isStreaming && answerCheck?.data_gaps && <DataGapNote gaps={answerCheck.data_gaps} />}

        {!!(quoteEvidence?.length || revenueEvidence?.length) && (
          <div className="mt-4 grid max-w-md gap-2">
            {answerCheck && <AnswerCheckNote check={answerCheck} />}
            {!!quoteEvidence?.length && <QuoteEvidenceGroup quotes={quoteEvidence} />}
            {revenueEvidence?.map((revenue) => (
              <RevenueEvidenceCard
                key={`${revenue.symbol}:${revenue.period_kind}:${revenue.period_end}`}
                revenue={revenue}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        {!isStreaming && content && (
          <div className="mt-2 flex flex-wrap items-center gap-1 px-0.5">
            <div
              className={cn(
                "flex items-center gap-1",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150",
              )}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  "text-xs text-muted-foreground",
                  "hover:bg-foreground/[0.06] hover:text-foreground",
                  "transition-colors duration-150",
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-positive" />
                    <span className="text-positive">{t("chat.actions.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("chat.actions.copy")}</span>
                  </>
                )}
              </Button>

              {shareable && (
                <ShareButton
                  target={{ kind: "chat", sourceId: messageId! }}
                  preview={sharePreview}
                  className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                />
              )}

              {onRetry && (
                <Button variant="ghost" size="xs" onClick={onRetry}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t("chat.actions.retry")}</span>
                </Button>
              )}
            </div>

            {!!webSources?.length && (
              <WebSourcesButton
                sources={webSources}
                open={sourcesPanel.open}
                onToggle={sourcesPanel.toggle}
              />
            )}
          </div>
        )}

        {sourcesPanel.open && !!webSources?.length && (
          <WebSourcesPanel sources={webSources} onClose={sourcesPanel.close} />
        )}
      </div>
    </div>
  );
}

/** Real token counts for this answer's turn; cached input is in the hover text. */
function ReplyTokens({ usage }: { usage: TokenUsage }) {
  const { t } = useTranslation();
  const locale = t("common.intlLocale");
  const values = {
    input: formatTokens(usage.input_tokens, locale),
    output: formatTokens(usage.output_tokens, locale),
    cached: formatTokens(usage.cached_input_tokens, locale),
  };
  return (
    <span className="tabular-nums" title={t("chat.tokens.replyDetail", values)}>
      {t(usage.incomplete ? "chat.tokens.replyAtLeast" : "chat.tokens.reply", values)}
    </span>
  );
}

function MaybeSelectionShare({
  messageId,
  question,
  children,
}: {
  messageId?: string;
  question: string;
  children: React.ReactNode;
}) {
  if (!messageId) return <>{children}</>;
  return (
    <SelectionShare messageId={messageId} question={question}>
      {children}
    </SelectionShare>
  );
}
