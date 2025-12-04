"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ContentWithModal from "../ContentWithModal";
import ExpandableText from "../ExpandableText";
import AIAnalysis from "../AIAnalysis";
import Tags from "../Tags";
import TranslateButton, { useTranslation } from "../TranslateButton";
import { RedditContentProps } from "./types";

export default function RedditContent({
  title,
  fullText,
  url,
  id,
  mediaUrls,
  aiSummary,
  aiAnalysis,
  aiTags,
  sentiment,
  onFormatText,
  subreddit,
  score,
  permalink,
  topComments = [],
}: RedditContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = aiSummary || "";

  // Translation state for post text
  const postTextTranslation = useTranslation(fullText);

  // Translation state for comments - store the display text for each comment
  const [commentDisplayTexts, setCommentDisplayTexts] = useState<
    Record<string, string>
  >({});

  // Track if all comments are translated
  const [areCommentsTranslated, setAreCommentsTranslated] = useState(false);
  const [isTranslatingComments, setIsTranslatingComments] = useState(false);

  // Batch translate all comments
  const translateAllComments = async () => {
    // Toggle back to original
    if (areCommentsTranslated) {
      const originalTexts: Record<string, string> = {};
      topComments.slice(0, 3).forEach((comment) => {
        originalTexts[comment.comment_id] = comment.body;
      });
      setCommentDisplayTexts(originalTexts);
      setAreCommentsTranslated(false);
      return;
    }

    setIsTranslatingComments(true);

    try {
      const translations: Record<string, string> = {};

      // Translate all comments in parallel
      await Promise.all(
        topComments.slice(0, 3).map(async (comment) => {
          try {
            const response = await fetch(
              `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(
                comment.body
              )}`
            );
            const data = await response.json();
            const translated = data[0].map((item: any[]) => item[0]).join("");
            translations[comment.comment_id] = translated;
          } catch (error) {
            console.error(
              "Translation failed for comment:",
              comment.comment_id
            );
            translations[comment.comment_id] = "翻译失败";
          }
        })
      );

      setCommentDisplayTexts(translations);
      setAreCommentsTranslated(true);
    } catch (error) {
      console.error("Batch translation failed:", error);
    } finally {
      setIsTranslatingComments(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!mounted) {
      // Return a static format during SSR to prevent hydration mismatch
      return new Date(timestamp * 1000).toLocaleDateString();
    }

    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
  };

  const getEmbedUrl = () => {
    const redditUrl = url.replace(
      /^https?:\/\/(www\.)?reddit\.com/,
      "https://embed.reddit.com"
    );
    // Ensure theme is either 'light' or 'dark', default to 'dark'
    const embedTheme = theme === "light" ? "light" : "dark";
    return `${redditUrl}?theme=${embedTheme}`;
  };

  return (
    <>
      <div className="space-y-2 mb-1">
        {/* Summary */}
        <ContentWithModal
          onOpenModal={() => setIsModalOpen(true)}
          ariaLabel="Open post in modal"
        >
          {summary}
        </ContentWithModal>

        {/* Tags */}
        <Tags tags={aiTags || []} />

        {/* Post Text - Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem
            value="post-text"
            className="border rounded-lg bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
          >
            <AccordionTrigger className="p-2 hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 text-primary mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h4 className="font-semibold text-xs text-gray-900 dark:text-white">
                    Post: {title}
                  </h4>
                </div>
                <TranslateButton
                  text={fullText}
                  onTranslate={() => postTextTranslation.translate()}
                  className="mr-2"
                />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-2">
              <ContentWithModal
                onOpenModal={() => setIsModalOpen(true)}
                ariaLabel="Open post in modal"
              >
                <ExpandableText
                  text={postTextTranslation.currentText}
                  maxWords={80}
                  onFormatText={onFormatText}
                />
              </ContentWithModal>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Reddit Comments - Accordion */}
        {topComments && topComments.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="comments"
              className="border rounded-lg bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
            >
              <AccordionTrigger className="p-2 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <svg
                      className="w-3 h-3 text-primary mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white">
                      Top Reddit Comments ({topComments.length})
                    </h4>
                  </div>
                  <div
                    onClick={(e) => {
                      if (!isTranslatingComments) {
                        e.stopPropagation();
                        translateAllComments();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        !isTranslatingComments &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        translateAllComments();
                      }
                    }}
                    role="button"
                    tabIndex={isTranslatingComments ? -1 : 0}
                    aria-label={areCommentsTranslated ? "显示原文" : "翻译全部"}
                    className={`flex items-center gap-1 text-xs transition-colors mr-2 cursor-pointer ${
                      areCommentsTranslated
                        ? "text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:text-primary"
                    } ${
                      isTranslatingComments
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    title={areCommentsTranslated ? "显示原文" : "翻译全部"}
                  >
                    <svg
                      className={`w-3 h-3 ${
                        isTranslatingComments ? "animate-pulse" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                      />
                    </svg>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <div className="space-y-2">
                  {topComments.slice(0, 3).map((comment) => {
                    const displayText =
                      commentDisplayTexts[comment.comment_id] || comment.body;

                    return (
                      <div
                        key={comment.comment_id}
                        className="rounded bg-white dark:bg-white/5 p-2 border border-gray-200 dark:border-white/10"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900 dark:text-white">
                              u/{comment.author}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimeAgo(comment.created_utc)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-3 h-3 text-red-800"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                              </svg>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {comment.score}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {displayText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* AI Analysis */}
        <AIAnalysis aiAnalysis={aiAnalysis} sentiment={sentiment} />
      </div>

      {/* Reddit Embed Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[600px] w-[95vw] h-fit max-h-[90vh] overflow-hidden !p-0 bg-white dark:bg-card-dark rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">
              Post Details
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-2 h-fit max-h-[calc(90vh-80px)] bg-white dark:bg-card-dark rounded-2xl">
            {mounted && (
              <iframe
                key={theme}
                src={getEmbedUrl()}
                width="100%"
                height={600}
                frameBorder="0"
                className="bg-white dark:bg-card-dark"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            )}
          </div>
          <DialogFooter className="px-6 pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              View on Reddit
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
