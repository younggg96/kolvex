"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Eye } from "lucide-react";
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
import PostMedia from "@/components/post/PostMedia";
import AIAnalysis from "@/components/common/AIAnalysis";
import { BaseContentProps } from "./types";
import { Button } from "@/components/ui/button";

export default function PostContent({
  url,
  fullText,
  mediaItems,
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
        {/* Tags */}
        {aiTags && aiTags.length > 0 && <Tags tags={aiTags} />}

        {/* Tweet Text */}
        <div className="text-sm">{onFormatText(content)}</div>

        {/* Media Images/Videos */}
        {mediaItems && mediaItems.length > 0 && (
          <PostMedia mediaItems={mediaItems} />
        )}

        {/* AI Analysis (Summary & Trading Signal) */}
        <AIAnalysis
          summary={aiSummary}
          tradingSignal={aiTradingSignal}
          model={aiModel}
          analyzedAt={aiAnalyzedAt}
        />
      </div>
    </>
  );
}
