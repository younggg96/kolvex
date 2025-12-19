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
import Tags from "@/components/common/Tags";
import SentimentBadge from "@/components/common/SentimentBadge";
import TweetMedia from "@/components/tweet/TweetMedia";
import AIAnalysis from "@/components/common/AIAnalysis";
import { BaseContentProps } from "./types";

export default function TwitterContent({
  url,
  fullText,
  mediaUrls,
  aiSummary,
  aiTradingSignal,
  aiTags,
  aiModel,
  aiAnalyzedAt,
  sentiment,
  onFormatText,
}: BaseContentProps & { fullText: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [iframeHeight, setIframeHeight] = useState<number>(500);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for iframe resize messages from Twitter
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === "https://platform.twitter.com") {
        try {
          const data = JSON.parse(event.data);
          if (data.height) {
            setIframeHeight(data.height);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Use fullText as the main content, falling back to summary if empty (though fullText should usually be present)
  const content = fullText || aiSummary || "";

  return (
    <>
      <div className="space-y-2 mb-1">
        {/* Tags and Sentiment */}
        <div className="flex items-center justify-between gap-2 flex-wrap my-2">
          {aiTags && aiTags.length > 0 && <Tags tags={aiTags} />}
          <SentimentBadge sentiment={sentiment} />
        </div>

        {/* Tweet Text */}
        <div className="text-sm">{onFormatText(content)}</div>

        {/* Media Images/Videos */}
        {mediaUrls && mediaUrls.length > 0 && (
          <TweetMedia mediaUrls={mediaUrls} />
        )}

        {/* AI Analysis (Summary & Trading Signal) */}
        <AIAnalysis
          summary={aiSummary}
          tradingSignal={aiTradingSignal}
          model={aiModel}
          analyzedAt={aiAnalyzedAt}
        />
      </div>

      {/* Twitter Embed Modal */}
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
                src={`https://platform.twitter.com/embed/Tweet.html?id=${url
                  .split("/")
                  .pop()}&theme=${theme === "light" ? "light" : "dark"}`}
                width="100%"
                height={iframeHeight}
                frameBorder="0"
                className="rounded-xl"
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
              View on X
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
