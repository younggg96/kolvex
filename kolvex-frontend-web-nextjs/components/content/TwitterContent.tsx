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
import ContentWithModal from "../ContentWithModal";
import AIAnalysis from "../AIAnalysis";
import Tags from "../Tags";
import PostActions from "../PostActions";
import { TwitterContentProps } from "./types";

export default function TwitterContent({
  url,
  id,
  fullText,
  aiSummary,
  aiAnalysis,
  aiTags,
  sentiment,
  onFormatText,
  likesCount,
  userLiked,
  userFavorited,
  totalLikes,
  totalFavorites,
}: TwitterContentProps) {
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

  const content = fullText || aiSummary || "";

  return (
    <>
      <div className="space-y-2 mb-1">
        {/* Tweet Text */}
        <ContentWithModal
          onOpenModal={() => setIsModalOpen(true)}
          ariaLabel="Open tweet in modal"
        >
          {onFormatText ? onFormatText(content) : content}
        </ContentWithModal>

        {/* Tags */}
        <Tags tags={aiTags || []} />

        {/* AI Analysis */}
        <AIAnalysis aiAnalysis={aiAnalysis} sentiment={sentiment} postId={id} />
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
