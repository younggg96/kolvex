"use client";

import React, { useState, useEffect } from "react";
import { XhsPost } from "@/lib/xhsApi";
import XhsPostHeader from "./XhsPostHeader";
import XhsContent from "./XhsContent";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface XhsPostFeedListProps {
  posts: XhsPost[];
  formatDate?: (dateString: string) => string;
  formatText?: (text: string) => React.ReactNode;
}

export default function XhsPostFeedList({
  posts,
  formatDate,
  formatText,
}: XhsPostFeedListProps) {
  const [mounted, setMounted] = useState(false);
  // 跟踪哪些"非股市相关"的帖子被手动展开了
  const [expandedNonStockPosts, setExpandedNonStockPosts] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // 检查帖子是否与股市相关
  const isStockRelated = (post: XhsPost): boolean => {
    return post.ai_is_stock_related === true;
  };

  // 切换非股市相关帖子的展开状态
  const toggleNonStockPost = (postId: number) => {
    setExpandedNonStockPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const defaultFormatDate = (dateString: string) => {
    if (!mounted) {
      return new Date(dateString).toLocaleDateString();
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}秒前`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}小时前`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  const defaultFormatText = (text: string) => {
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith("$") && word.length > 1) {
        const ticker = word
          .slice(1)
          .replace(/[.,!?;:'")\]]+$/, "")
          .toUpperCase();
        return (
          <Link
            key={index}
            href={`/dashboard/stock/${ticker}`}
            className="text-rose-500 hover:text-rose-400 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {word}
          </Link>
        );
      }
      if (word.startsWith("#")) {
        return (
          <span key={index} className="text-rose-500">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const onFormatDate = formatDate || defaultFormatDate;
  const onFormatText = formatText || defaultFormatText;

  // 渲染折叠的非股市相关帖子提示
  const renderCollapsedNonStockPost = (post: XhsPost) => {
    return (
      <div className="py-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => toggleNonStockPost(post.id)}
          className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">
              This post is unrelated to stocks. Click to view
            </span>
          </div>
        </Button>
      </div>
    );
  };

  return (
    <>
      {posts.map((post, index) => {
        const stockRelated = isStockRelated(post);
        const isExpanded = expandedNonStockPosts.has(post.id);
        const shouldCollapse = !stockRelated && !isExpanded;

        return (
          <div key={post.id}>
            {shouldCollapse ? (
              // 折叠状态：只显示头部和提示
              <>
                <XhsPostHeader
                  authorName={post.author_name || ""}
                  authorId={post.author_id || ""}
                  createdAt={
                    post.scraped_at ||
                    post.created_at ||
                    new Date().toISOString()
                  }
                  authorAvatar={post.author_avatar || undefined}
                  onFormatDate={onFormatDate}
                  initialTracked={false}
                />
                {renderCollapsedNonStockPost(post)}
              </>
            ) : (
              // 正常显示或已展开状态
              <>
                <XhsPostHeader
                  authorName={post.author_name || ""}
                  authorId={post.author_id || ""}
                  createdAt={
                    post.scraped_at ||
                    post.created_at ||
                    new Date().toISOString()
                  }
                  authorAvatar={post.author_avatar || undefined}
                  onFormatDate={onFormatDate}
                  initialTracked={false}
                />
                {/* 如果是展开的非股市相关帖子，显示收起按钮 */}
                {!stockRelated && isExpanded && (
                  <div className="py-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleNonStockPost(post.id)}
                      className="w-fit h-6 gap-1.5 text-amber-600/80 hover:bg-amber-50 dark:text-amber-500/80 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 font-normal"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs">
                        This post is unrelated to stocks. Click to hide
                      </span>
                    </Button>
                  </div>
                )}
                <XhsContent post={post} onFormatText={onFormatText} />
              </>
            )}
            {index < posts.length - 1 && <Separator className="my-2" />}
          </div>
        );
      })}
    </>
  );
}
