import type { MouseEvent } from "react";
import type { TopAuthor } from "@/lib/trackedStockApi";
import { Star, Loader2 } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import MiniSparkline from "@/components/stock/MiniSparkline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

export type StockRowProps = {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
  sparklineData: number[];
  mentionCount: number;
  topAuthors: TopAuthor[];
  isUntracking: boolean;
  onUntrack: (e: MouseEvent) => void;
  onClick: () => void;
};

export function StockRow(props: StockRowProps) {
  const {
    symbol,
    companyName,
    price,
    changePercent,
    sparklineData,
    topAuthors,
    isUntracking,
    onUntrack,
    onClick,
  } = props;

  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <CompanyLogo symbol={symbol} name={companyName} size="sm" />
          <div className="min-w-0 cursor-pointer" onClick={onClick}>
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {symbol}
            </div>
            {companyName && (
              <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[100px]">
                {companyName}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3">
        ${price.toFixed(2)}
      </TableCell>

      <TableCell className="text-xs text-right font-semibold py-3">
        <span
          className={changePercent >= 0 ? "text-green-500" : "text-red-500"}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </TableCell>

      <TableCell className="py-3 hidden sm:table-cell">
        <div className="flex justify-center">
          <MiniSparkline
            data={sparklineData}
            width={60}
            height={20}
            strokeWidth={1.2}
          />
        </div>
      </TableCell>

      <TableCell className="py-3 hidden md:table-cell">
        <div className="flex flex-col items-center gap-1">
          {topAuthors.length > 0 && (
            <div className="flex -space-x-2">
              {topAuthors.slice(0, 4).map((author, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
                    getSentimentRingColor(author.sentiment)
                  )}
                  title={`${author.display_name || author.username}: ${
                    author.tweet_count
                  } tweets`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={author.avatar_url || ""}
                      alt={author.username}
                    />
                    <AvatarFallback className="text-[8px] bg-gray-200 dark:bg-gray-700">
                      {author.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ))}
              {topAuthors.length > 4 && (
                <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium">
                  +{topAuthors.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-yellow-400 hover:text-yellow-500"
          onClick={onUntrack}
          disabled={isUntracking}
        >
          {isUntracking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className="h-4 w-4 fill-current" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}
