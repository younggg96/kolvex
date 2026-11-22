"use client";

import Link from "next/link";
import { Activity, Landmark, ScrollText, UserRound } from "lucide-react";
import { cleanAssetName } from "@/components/congress/CongressTrades";
import { useSessionLabel } from "@/components/options-activity/sections";
import { PersonUpdateAvatar } from "@/components/person-updates/PersonUpdateAvatar";
import {
  InvestorAvatar,
  superinvestorHref,
  useInvestorByline,
} from "@/components/superinvestors/shared";
import CompanyLogo from "@/components/ui/company-logo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ListCard,
  ListRow,
  ListRows,
  ListToolbar,
  listCompactRowClass,
} from "@/components/ui/list-card";
import type { InstitutionManager } from "@/lib/freeResearch";
import { formatPremium, type ActivityRun } from "@/lib/optionsActivity";
import { isFedOfficial, personAvatar, type PersonUpdate } from "@/lib/personUpdates";
import type { SearchHistoryItem } from "@/lib/searchHistory";
import { marketStockHref } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";
import { DiscoverySection, PartialError, SourceState } from "./SearchDiscoveryParts";
import {
  OPTIONS_ACTIVITY_HREF,
  congressTradesHref,
  optionsTickersByPremium,
  personUpdatesHref,
  useLatestCongressTrades,
  type CongressTrade,
  type Resource,
} from "./SearchSources";
import { useCopy, useDayLabel } from "./shared";

type Remember = (item: SearchHistoryItem) => void;

export const FLOW_ROW_COUNT = 6;
const MANAGER_COUNT = 8;
const iconClass = "h-4 w-4 text-muted-foreground";
const rowClass = cn(listCompactRowClass, "min-h-12 w-full gap-2 px-1 lg:gap-3 lg:px-2");
const managerListClass = "grid grid-cols-2 gap-x-3 max-[360px]:grid-cols-1";

/** Placeholder rows: round leading mark, two text lines, optional trailing value. */
function RowsSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <ul className={cn("min-w-0", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={cn(rowClass, "hover:bg-transparent")}>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={cn("h-4 rounded-md", i % 2 ? "w-20" : "w-28")} />
            <Skeleton className="h-3 w-24 rounded-md" />
          </span>
          <Skeleton className="h-3 w-12 rounded-md" />
        </li>
      ))}
    </ul>
  );
}

export function SuperinvestorPicks({
  resource,
  onRemember,
}: {
  resource: Resource<{ managers: InstitutionManager[] }>;
  onRemember: Remember;
}) {
  const c = useCopy();
  const byline = useInvestorByline();
  const managers = (resource.data?.managers ?? []).slice(0, MANAGER_COUNT);
  return (
    <DiscoverySection
      id="search-superinvestors"
      title={c("Superinvestors", "超级投资者")}
      icon={<Landmark aria-hidden className={iconClass} />}
      href="/dashboard/superinvestors"
      linkLabel={c("View all superinvestors", "查看全部超级投资者")}
    >
      <ListCard>
        {managers.length ? (
          <ListRows className={managerListClass}>
            {managers.map((manager) => {
              const item = {
                title: manager.name,
                detail: byline(manager.id, false, manager.profile) || "13F",
                href: superinvestorHref(manager.id),
              };
              return (
                <ListRow key={manager.id} className="pr-0">
                  <Link
                    href={item.href}
                    title={`${item.title} ${item.detail}`}
                    onClick={() => onRemember(item)}
                    className={rowClass}
                  >
                    <InvestorAvatar id={manager.id} name={manager.name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-[0.6875rem] text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </ListRow>
              );
            })}
          </ListRows>
        ) : (
          <SourceState
            {...resource}
            retry={resource.refresh}
            className="lg:min-h-72"
            skeleton={<RowsSkeleton count={MANAGER_COUNT} className={managerListClass} />}
          />
        )}
        {managers.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      </ListCard>
    </DiscoverySection>
  );
}

/** Buy / sell in words and colour, so the direction never rests on colour alone. */
export function useTradeSide() {
  const c = useCopy();
  const labels: Record<CongressTrade["direction"], string> = {
    buy: c("Buy", "买入"),
    sell: c("Sell", "卖出"),
    exchange: c("Exchange", "交换"),
    other: c("Other", "其他"),
  };
  return (trade: CongressTrade) => ({
    label: labels[trade.direction],
    className:
      trade.direction === "buy"
        ? "text-positive"
        : trade.direction === "sell"
          ? "text-negative"
          : "text-muted-foreground",
  });
}

export function tradeAsset(trade: CongressTrade) {
  return trade.ticker || (trade.asset_name ? cleanAssetName(trade.asset_name) : "");
}

export function CongressPicks({ onRemember }: { onRemember: Remember }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const side = useTradeSide();
  const resource = useLatestCongressTrades(FLOW_ROW_COUNT);
  const trades = resource.data?.trades ?? [];
  return (
    <DiscoverySection
      id="search-congress"
      title={c("Congress trades", "国会议员交易")}
      icon={<ScrollText aria-hidden className={iconClass} />}
      href="/dashboard/congress-trades"
      linkLabel={c("View all congress trades", "查看全部国会议员交易")}
    >
      <ListCard>
        {trades.length ? (
          <ListRows>
            {trades.map((trade) => {
              const direction = side(trade);
              const asset = tradeAsset(trade);
              const item = {
                title: trade.member_name,
                detail: c("Congress trades", "国会议员交易"),
                href: congressTradesHref({ member: trade.member_name }),
              };
              return (
                <ListRow key={trade.id} className="pr-0">
                  <Link href={item.href} onClick={() => onRemember(item)} className={rowClass}>
                    <span aria-hidden>
                      <CompanyLogo
                        symbol={trade.ticker || "?"}
                        name={asset}
                        size="sm"
                        className="max-lg:max-h-6 max-lg:max-w-6 max-lg:!p-0.5"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {trade.member_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        <span className={cn("font-medium", direction.className)}>
                          {direction.label}
                        </span>{" "}
                        {asset}
                        {trade.amount_range ? ` · ${trade.amount_range}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <time dateTime={trade.filed_date}>{dayLabel(trade.filed_date)}</time>
                    </span>
                  </Link>
                </ListRow>
              );
            })}
          </ListRows>
        ) : (
          <SourceState
            {...resource}
            retry={resource.refresh}
            className="lg:min-h-72"
            skeleton={<RowsSkeleton count={FLOW_ROW_COUNT} />}
          />
        )}
        {trades.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      </ListCard>
    </DiscoverySection>
  );
}

export function OptionsActivityPicks({
  resource,
  onRemember,
}: {
  resource: Resource<ActivityRun>;
  onRemember: Remember;
}) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const sessionLabel = useSessionLabel();
  const run = resource.data;
  const tickers = optionsTickersByPremium(run).slice(0, FLOW_ROW_COUNT);
  return (
    <DiscoverySection
      id="search-options-activity"
      title={c("Options activity", "期权异动")}
      icon={<Activity aria-hidden className={iconClass} />}
      href={OPTIONS_ACTIVITY_HREF}
      linkLabel={c("View options activity", "查看期权异动")}
    >
      <ListCard className="flex flex-col">
        {run && tickers.length > 0 && (
          <ListToolbar className="mb-1 min-h-0 px-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {dayLabel(run.trade_date)} · {sessionLabel(run.session)} ·{" "}
              {c("By net premium", "按净权利金")}
            </span>
          </ListToolbar>
        )}
        {tickers.length ? (
          <ListRows>
            {tickers.map((ticker) => (
              <ListRow key={ticker.symbol} className="pr-0">
                <Link
                  href={marketStockHref(ticker.symbol)}
                  onClick={() =>
                    onRemember({
                      title: ticker.symbol,
                      detail: c("Options activity", "期权异动"),
                      href: marketStockHref(ticker.symbol),
                    })
                  }
                  className={rowClass}
                >
                  <span aria-hidden>
                    <CompanyLogo
                      symbol={ticker.symbol}
                      size="sm"
                      className="max-lg:max-h-6 max-lg:max-w-6 max-lg:!p-0.5"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{ticker.symbol}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {c("Calls", "看涨")} {formatPremium(ticker.call_premium)} ·{" "}
                      {c("Puts", "看跌")} {formatPremium(ticker.put_premium)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      ticker.net_premium > 0
                        ? "text-positive"
                        : ticker.net_premium < 0
                          ? "text-negative"
                          : "text-muted-foreground",
                    )}
                    title={c("Net premium", "净权利金")}
                  >
                    {formatPremium(ticker.net_premium, true)}
                  </span>
                </Link>
              </ListRow>
            ))}
          </ListRows>
        ) : (
          <SourceState
            {...resource}
            retry={resource.refresh}
            className="lg:min-h-72"
            skeleton={<RowsSkeleton count={FLOW_ROW_COUNT} />}
          />
        )}
        {tickers.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      </ListCard>
    </DiscoverySection>
  );
}

export function usePersonLabel() {
  const c = useCopy();
  return (item: PersonUpdate) => c(item.person, item.person_cn || item.person);
}

export function PersonUpdatePicks({
  resource,
  onRemember,
}: {
  resource: Resource<{ items: PersonUpdate[] }>;
  onRemember: Remember;
}) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const personLabel = usePersonLabel();
  const items = (resource.data?.items ?? []).slice(0, FLOW_ROW_COUNT);
  return (
    <DiscoverySection
      id="search-person-updates"
      title={c("Updates", "动态")}
      icon={<UserRound aria-hidden className={iconClass} />}
      href="/dashboard/person-updates"
      linkLabel={c("View all updates", "查看全部动态")}
    >
      <ListCard>
        {items.length ? (
          <ListRows>
            {items.map((update) => {
              const name = personLabel(update);
              const item = {
                title: name,
                detail: c("Updates", "动态"),
                href: personUpdatesHref(update.person),
              };
              return (
                <ListRow key={update.id} className="pr-0">
                  <Link
                    href={item.href}
                    title={update.title}
                    onClick={() => onRemember(item)}
                    className={rowClass}
                  >
                    <PersonUpdateAvatar
                      label={name}
                      src={personAvatar(update)}
                      fedOfficial={isFedOfficial(update)}
                      className="h-8 w-8 shrink-0 max-lg:h-6 max-lg:w-6"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {update.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <time dateTime={update.published_at}>{dayLabel(update.published_at)}</time>
                    </span>
                  </Link>
                </ListRow>
              );
            })}
          </ListRows>
        ) : (
          <SourceState
            {...resource}
            retry={resource.refresh}
            className="lg:min-h-72"
            skeleton={<RowsSkeleton count={FLOW_ROW_COUNT} />}
          />
        )}
        {items.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      </ListCard>
    </DiscoverySection>
  );
}
