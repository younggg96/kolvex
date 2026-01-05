"use client";

import { useRouter } from "next/navigation";
import CompanyLogo from "@/components/ui/company-logo";
import { cn } from "@/lib/utils";

interface StockInfoProps {
  ticker: string;
  companyName?: string;
}

/**
 * 股票信息组件 (Logo + 名称)
 * 点击跳转到股票详情页
 */
export function StockInfo({ ticker, companyName }: StockInfoProps) {
  const router = useRouter();

  return (
    <div
      className={cn("flex items-center gap-2.5 cursor-pointer")}
      onClick={() => router.push(`/dashboard/stock/${ticker}`)}
    >
      <CompanyLogo symbol={ticker} name={companyName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {ticker}
        </div>
        {companyName && (
          <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[80px]">
            {companyName}
          </div>
        )}
      </div>
    </div>
  );
}

