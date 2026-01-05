"use client";

import { useRouter } from "next/navigation";
import { TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn, proxyImageUrl } from "@/lib/utils";
import { getSentimentRingColor } from "./utils";
import type { StockRowAuthor } from "./types";

interface TopAuthorsCellProps {
  authors: StockRowAuthor[];
  showHoverCard?: boolean;
}

/**
 * Top Authors 单元格组件
 * 显示 KOL 头像列表，支持 HoverCard 展示详情
 */
export function TopAuthorsCell({
  authors,
  showHoverCard = true,
}: TopAuthorsCellProps) {
  const router = useRouter();

  if (!authors || authors.length === 0) {
    return (
      <TableCell className="w-[120px]">
        <div className="flex justify-center">
          <span className="text-xs text-gray-400">-</span>
        </div>
      </TableCell>
    );
  }

  const avatarList = (
    <div className="flex items-center justify-center -space-x-2">
      {authors.slice(0, 4).map((author, idx) => (
        <div
          key={idx}
          className={cn(
            "relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
            getSentimentRingColor(author.sentiment)
          )}
          title={
            !showHoverCard
              ? `${author.displayName || author.username}: ${
                  author.tweetCount
                } tweets`
              : undefined
          }
        >
          <Avatar className="w-6 h-6">
            <AvatarImage
              src={proxyImageUrl(author.avatarUrl || "")}
              alt={author.username || ""}
            />
            <AvatarFallback className="text-[8px] bg-gray-200 dark:bg-gray-700">
              {author.username?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
      {authors.length > 4 && (
        <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium">
          +{authors.length - 4}
        </div>
      )}
    </div>
  );

  if (!showHoverCard) {
    return (
      <TableCell className="w-[120px] hidden md:table-cell">
        {avatarList}
      </TableCell>
    );
  }

  return (
    <TableCell className="w-[120px]">
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer">{avatarList}</div>
        </HoverCardTrigger>
        <HoverCardContent className="w-56 p-2" side="top" align="center">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              {authors.length} KOL{authors.length > 1 ? "s" : ""} discussing
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {authors.map((author, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => {
                    if (author.platform) {
                      router.push(
                        `/dashboard/kol/${author.username}?platform=${author.platform}`
                      );
                    }
                  }}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage
                      src={proxyImageUrl(author.avatarUrl || "")}
                      alt={author.username || ""}
                    />
                    <AvatarFallback className="text-[9px] bg-gray-200 dark:bg-gray-700">
                      {author.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {author.displayName || author.username}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      {author.tweetCount} post{author.tweetCount > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </TableCell>
  );
}
