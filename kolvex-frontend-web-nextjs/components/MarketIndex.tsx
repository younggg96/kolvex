import { TrendingUp, TrendingDown } from "lucide-react";
import MiniSparkline from "./MiniSparkline";

interface MarketIndexProps {
  name: string;
  value: string;
  change: number;
  changePercent: number;
  chartData?: number[];
}

export default function MarketIndex({
  name,
  value,
  change,
  changePercent,
  chartData,
}: MarketIndexProps) {
  const isPositive = change >= 0;

  return (
    <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-border-light dark:border-border-dark transition-all duration-200 hover:shadow-md hover:scale-[1.02] dark:hover:bg-card-dark/90 cursor-pointer">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-semibold tracking-wider uppercase mb-1">
            {name}
          </h3>
          <p className="text-gray-900 dark:text-white text-lg font-bold truncate">
            {value}
          </p>
        </div>
        {chartData && chartData.length > 0 && (
          <div className="flex-shrink-0 mt-1">
            <MiniSparkline
              data={chartData}
              width={80}
              height={32}
              strokeWidth={2}
              color={isPositive ? "#00C805" : "#ef4444"}
            />
          </div>
        )}
      </div>
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          isPositive
            ? "bg-primary/10 text-primary"
            : "bg-red-500/10 text-red-500"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>
          {isPositive ? "+" : ""}
          {change.toFixed(2)}
        </span>
        <span className="opacity-80">
          ({isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
