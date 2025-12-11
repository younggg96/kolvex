import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function StockCard({
  symbol,
  name,
  price,
  change,
  changePercent,
}: StockCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 p-6 border border-slate-200 dark:border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {symbol}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
        </div>
        {isPositive ? (
          <TrendingUp className="w-6 h-6 text-green-500" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-500" />
        )}
      </div>

      <div className="mb-3">
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          ${price.toFixed(2)}
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <span
          className={cn(
            "px-3 py-1 rounded-full text-sm font-semibold",
            isPositive
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          )}
        >
          {isPositive ? "+" : ""}
          {change.toFixed(2)}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            isPositive
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          ({isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
