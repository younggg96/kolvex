"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ContentWithModal from "../ContentWithModal";
import ExpandableText from "../ExpandableText";
import AIAnalysis from "../AIAnalysis";
import Tags from "../Tags";
import { RednoteContentProps } from "./types";

export default function RednoteContent({
  fullText,
  url,
  id,
  aiSummary,
  aiAnalysis,
  aiTags,
  sentiment,
  onFormatText,
}: RednoteContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const summary = aiSummary || "";

  return (
    <>
      <div className="space-y-2 mb-1">
        {/* Summary */}
        <div className="text-xs text-gray-600 dark:text-white/60">
          Summary: {summary}
        </div>

        {/* Note Content */}
        <ContentWithModal
          onOpenModal={() => setIsModalOpen(true)}
          ariaLabel="Open note in modal"
        >
          <ExpandableText
            text={fullText}
            maxWords={80}
            onFormatText={onFormatText}
          />
        </ContentWithModal>

        {/* Tags */}
        <Tags tags={aiTags || []} />

        {/* AI Analysis */}
        <AIAnalysis aiAnalysis={aiAnalysis} sentiment={sentiment} />
      </div>

      {/* Rednote Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[600px] w-[95vw] max-h-[90vh] overflow-hidden p-0 bg-white dark:bg-card-dark rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">
              小红书笔记详情
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-6 max-h-[calc(90vh-80px)] bg-white dark:bg-card-dark rounded-2xl">
            {/* 小红书没有 embed，显示提示信息 */}
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                小红书暂不支持嵌入预览，请点击下方链接访问原文
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                访问小红书原文
              </a>
            </div>
          </div>
          <DialogFooter className="px-6 pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              View on 小红书
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
