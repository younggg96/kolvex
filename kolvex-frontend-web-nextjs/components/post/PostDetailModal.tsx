"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  postUrl: string;
  postPermalink?: string;
}

export default function PostDetailModal({
  isOpen,
  onClose,
  postUrl,
  postPermalink,
}: PostDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [iframeHeight, setIframeHeight] = useState(500);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract tweet ID from URL
  const getTweetId = (url: string) => {
    return url.split("/").pop() || "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] w-[95vw] h-fit max-h-[90vh] overflow-hidden !p-0 bg-white dark:bg-card-dark rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-gray-900 dark:text-white">
            Post Details
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto p-2 h-fit max-h-[calc(90vh-80px)] bg-white dark:bg-card-dark rounded-2xl">
          {mounted && postUrl && (
            <iframe
              key={theme}
              src={`https://platform.twitter.com/embed/Tweet.html?id=${getTweetId(
                postUrl
              )}&theme=${theme === "light" ? "light" : "dark"}`}
              width="100%"
              height={iframeHeight}
              frameBorder="0"
              className="rounded-xl"
            />
          )}
        </div>
        <DialogFooter className="px-6 pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={postPermalink || postUrl}
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
  );
}

