"use client";

import { useMemo } from "react";
import CompanyLogo from "./CompanyLogo";
import { useRouter } from "next/navigation";
import { EarningsEvent } from "@/lib/earningsApi";

interface EarningsEventListProps {
  events: EarningsEvent[];
  timeType: "bmo" | "amc";
  onEventClick?: () => void;
  compact?: boolean;
  fullWidth?: boolean;
}

interface ThemeConfig {
  title: string;
  bgColor: string;
  borderColor: string;
  hoverBorderColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  logoBorder: string;
  hoverTextColor: string;
  dataBorder: string;
  dotColor: string;
}

const themeConfigs: Record<"bmo" | "amc", ThemeConfig> = {
  bmo: {
    title: "Pre-market",
    bgColor: "bg-slate-50 dark:bg-slate-900/20",
    borderColor: "border-slate-300 dark:border-slate-700",
    hoverBorderColor: "hover:border-slate-400 dark:hover:border-slate-600",
    textColor: "text-slate-700 dark:text-slate-300",
    badgeBg: "bg-slate-100 dark:bg-slate-900/40",
    badgeText: "text-slate-700 dark:text-slate-300",
    logoBorder: "border-slate-300 dark:border-slate-700",
    hoverTextColor:
      "group-hover:text-slate-600 dark:group-hover:text-slate-400",
    dataBorder: "border-slate-300 dark:border-slate-700",
    dotColor: "bg-slate-600 dark:bg-slate-400",
  },
  amc: {
    title: "After hours",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    hoverBorderColor: "hover:border-amber-400 dark:hover:border-amber-600",
    textColor: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    logoBorder: "border-amber-200 dark:border-amber-700",
    hoverTextColor:
      "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    dataBorder: "border-amber-200 dark:border-amber-700",
    dotColor: "bg-amber-600 dark:bg-amber-400",
  },
};

export default function EarningsEventList({
  events,
  timeType,
  onEventClick,
  compact = false,
  fullWidth = false,
}: EarningsEventListProps) {
  const router = useRouter();
  const theme = themeConfigs[timeType];

  // 按 Revenue 从大到小排序
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const revenueA = a.revenueEstimate || 0;
      const revenueB = b.revenueEstimate || 0;
      return revenueB - revenueA; // 从大到小
    });
  }, [events]);

  if (events.length === 0) return null;

  const handleEventClick = (symbol: string) => {
    router.push(`/dashboard/stock/${symbol}`);
    onEventClick?.();
  };

  return (
    <div className={fullWidth ? "w-full" : "w-full lg:w-1/2"}>
      <div
        className={`flex items-center ${compact ? "gap-1.5" : "gap-2"} ${
          compact ? "mb-2" : "mb-3"
        }`}
      >
        <div
          className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${
            theme.dotColor
          }`}
        ></div>
        <h3
          className={`${compact ? "text-xs" : "text-base"} font-bold ${
            theme.textColor
          }`}
        >
          {theme.title} ({sortedEvents.length})
        </h3>
      </div>
      <div className={compact ? "space-y-3" : "space-y-1.5"}>
        {sortedEvents.map((event, index) => (
          <div
            key={index}
            className={`group ${theme.bgColor} rounded-md ${
              compact ? "p-1.5" : "p-2.5"
            } border ${theme.borderColor} ${
              theme.hoverBorderColor
            } hover:shadow-md transition-all cursor-pointer`}
            onClick={() => handleEventClick(event.symbol)}
          >
            <div
              className={`flex items-start justify-between ${
                compact ? "gap-1.5" : "gap-3"
              }`}
            >
              {/* 左侧：公司信息 */}
              <div
                className={`flex items-start ${
                  compact ? "gap-1" : "gap-2"
                } flex-1`}
              >
                <div
                  className={`w-12 h-12 p-2 bg-white rounded-md flex items-center justify-center flex-shrink-0 border ${theme.logoBorder} overflow-hidden`}
                >
                  <CompanyLogo
                    logoUrl={event.logo || ""}
                    symbol={event.symbol}
                    name={event.companyName}
                    size="lg"
                    shape="rounded"
                    border="light"
                    borderColor={timeType === "bmo" ? "primary" : "orange"}
                    textColor={theme.textColor}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`flex items-center ${
                      compact ? "gap-0.5" : "gap-1.5"
                    } mb-0.5`}
                  >
                    <span
                      className={`${
                        compact ? "text-xs" : "text-base"
                      } font-bold text-gray-900 dark:text-white ${
                        theme.hoverTextColor
                      } transition-colors`}
                    >
                      {event.symbol}
                    </span>
                    <span
                      className={`${
                        compact ? "text-[9px] px-1" : "text-xs px-2"
                      } py-0.5 ${theme.badgeBg} rounded-full ${
                        theme.badgeText
                      } font-semibold`}
                    >
                      {theme.title}
                    </span>
                  </div>
                  <p
                    className={`${
                      compact ? "text-[11px]" : "text-sm"
                    } text-gray-700 dark:text-white/80 mb-0.5 truncate`}
                  >
                    {event.companyName}
                  </p>
                  <div
                    className={`flex items-center ${
                      compact ? "gap-0.5" : "gap-1.5"
                    } ${
                      compact ? "text-[9px]" : "text-xs"
                    } text-gray-500 dark:text-white/50`}
                  >
                    {event.sector && (
                      <span
                        className={`${
                          compact ? "px-1" : "px-2"
                        } py-0.5 bg-gray-100 dark:bg-white/10 rounded`}
                      >
                        {event.sector}
                      </span>
                    )}
                    {event.quarter && event.year && (
                      <span
                        className={`${
                          compact ? "px-1" : "px-2"
                        } py-0.5 bg-primary/10 rounded text-primary font-semibold`}
                      >
                        Q{event.quarter} {event.year}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧：财务数据 */}
              <div
                className={`flex ${
                  compact ? "gap-0.5" : "gap-2"
                } flex-shrink-0`}
              >
                {event.epsEstimate !== null &&
                  event.epsEstimate !== undefined && (
                    <div
                      className={`text-right rounded ${
                        compact ? "p-1 min-w-[50px]" : "p-2.5 min-w-[80px]"
                      } border ${theme.dataBorder}`}
                    >
                      <div
                        className={`${
                          compact ? "text-[8px]" : "text-[10px]"
                        } text-gray-500 dark:text-white/50 mb-0.5`}
                      >
                        EPS Est.
                      </div>
                      <div
                        className={`${
                          compact ? "text-[11px]" : "text-sm"
                        } font-bold text-gray-900 dark:text-white`}
                      >
                        ${event.epsEstimate.toFixed(2)}
                      </div>
                      {event.epsActual !== null &&
                        event.epsActual !== undefined && (
                          <div
                            className={`${
                              compact ? "text-[9px]" : "text-xs"
                            } font-semibold mt-0.5 ${
                              event.epsActual >= event.epsEstimate
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            Act: ${event.epsActual.toFixed(2)}
                          </div>
                        )}
                    </div>
                  )}
                {event.revenueEstimate && (
                  <div
                    className={`text-right rounded ${
                      compact ? "p-1 min-w-[50px]" : "p-2.5 min-w-[80px]"
                    } border ${theme.dataBorder}`}
                  >
                    <div
                      className={`${
                        compact ? "text-[8px]" : "text-[10px]"
                      } text-gray-500 dark:text-white/50 mb-0.5`}
                    >
                      Revenue Est.
                    </div>
                    <div
                      className={`${
                        compact ? "text-[11px]" : "text-sm"
                      } font-bold text-gray-900 dark:text-white`}
                    >
                      ${(event.revenueEstimate / 1e9).toFixed(1)}B
                    </div>
                    {event.revenueActual && (
                      <div
                        className={`${
                          compact ? "text-[9px]" : "text-xs"
                        } font-semibold mt-0.5 ${
                          event.revenueActual >= event.revenueEstimate
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        Act: ${(event.revenueActual / 1e9).toFixed(1)}B
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
