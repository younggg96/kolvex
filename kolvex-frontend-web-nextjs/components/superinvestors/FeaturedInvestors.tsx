"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { SecLink, useFreeResearch } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  FEATURED_INSTITUTIONS,
  PELOSI_TRADES_PATH,
  featuredHoldings,
  houseDisclosureUrl,
  pelosiDisclosures,
  stockReturnPath,
  type PelosiDisclosure,
} from "@/lib/featuredInvestors";
import {
  INSTITUTIONS_KEY,
  institutionKey,
  type Institution,
  type InstitutionManager,
} from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import { PortfolioReturnChart, SpotlightStatus, StockReturnChart } from "./InvestorReturnChart";
import { InvestorAvatar, superinvestorHref } from "./shared";

const PELOSI = "pelosi";

export default function FeaturedInvestors() {
  const c = useCopy();
  const [selected, setSelected] = useState(String(FEATURED_INSTITUTIONS[0].cik));
  const list = useFreeResearch<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY);
  const manager = list.data?.managers.find(({ cik }) => String(cik) === selected);
  const choices = [
    ...FEATURED_INSTITUTIONS.map(({ cik, en, zh }) => ({ id: String(cik), label: c(en, zh) })),
    { id: PELOSI, label: c("Pelosi", "佩洛西") },
  ];

  return (
    <section aria-labelledby="featured-investors-heading" className="mb-8 space-y-4 md:mb-10">
      <h2 id="featured-investors-heading" className="text-xl font-semibold">
        {c("Featured investors", "明星投资者")}
      </h2>
      <div
        role="group"
        aria-label={c("Choose an investor", "选择明星投资者")}
        className="flex flex-wrap gap-2"
      >
        {choices.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            size="chip"
            variant="chip"
            selected={id === selected}
            className="min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-pressed={id === selected}
            onClick={() => setSelected(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card className="min-w-0 p-4 md:p-6">
        {selected === PELOSI ? (
          <PelosiSpotlight />
        ) : manager ? (
          <InstitutionSpotlight key={manager.id} manager={manager} />
        ) : list.loading || list.error ? (
          <SpotlightStatus
            loading={list.loading}
            text={
              list.loading
                ? c("Loading investor directory…", "正在加载机构名单…")
                : c("Investor directory could not be loaded.", "机构名单加载失败。")
            }
            retry={list.refresh}
          />
        ) : (
          <SpotlightStatus
            text={c(
              "This institution’s filings are unavailable in the directory.",
              "名单中暂无这家机构的申报。",
            )}
          />
        )}
      </Card>
    </section>
  );
}

function SpotlightHeader({
  title,
  detail,
  action,
  children,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {children}
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{title}</h3>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function InstitutionSpotlight({ manager }: { manager: InstitutionManager }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState<"stock" | "portfolio">("stock");
  const resource = useFreeResearch<Institution>(institutionKey(manager.id));
  const data = resource.error ? undefined : resource.data;
  const rows = data?.filing ? featuredHoldings(data.holdings) : [];
  const chartable = rows.filter((row) => stockReturnPath(row.ticker));
  const active = chartable.find((row) => row.cusip === selected) ?? chartable[0];
  const ticker = active?.ticker;
  const path = stockReturnPath(ticker);
  const filing = data?.filing;

  return (
    <div className="space-y-4">
      <SpotlightHeader
        title={c(manager.name, manager.profile?.zhName ?? manager.name)}
        detail={
          filing
            ? c(`13F as of ${f.date(filing.period)}`, `13F 持仓截至 ${f.date(filing.period)}`)
            : undefined
        }
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={superinvestorHref(manager.id)}>
              {c("Full filing holdings", "查看全部持仓")}{" "}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      >
        <InvestorAvatar id={manager.id} name={manager.name} />
      </SpotlightHeader>
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">
              {c("Top 5 disclosed holdings", "前五大披露持仓")}
            </h4>
            {filing && (
              <span className="text-xs text-muted-foreground">
                <SecLink href={filing.source_url}>{c("SEC filing", "SEC 原文")}</SecLink>
              </span>
            )}
          </div>
          {resource.loading || resource.error ? (
            <SpotlightStatus
              loading={resource.loading}
              text={
                resource.loading
                  ? c("Loading holdings…", "正在加载持仓…")
                  : c("Holdings could not be loaded.", "持仓加载失败。")
              }
              retry={resource.refresh}
            />
          ) : rows.length ? (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.cusip}>
                  <HoldingRow
                    active={mode === "stock" && row.cusip === active?.cusip}
                    select={
                      stockReturnPath(row.ticker)
                        ? () => {
                            setSelected(row.cusip);
                            setMode("stock");
                          }
                        : undefined
                    }
                  >
                    <span className="min-w-0">
                      <span className="figure block text-sm font-medium">
                        {row.ticker ?? row.cusip}
                      </span>
                      <span className="block break-words text-xs text-muted-foreground">
                        {row.issuer}
                      </span>
                    </span>
                    <span className="figure shrink-0 text-right text-sm font-semibold">
                      {f.percent(row.weight)}
                      <span
                        className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-muted"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-primary/60"
                          style={{ width: `${row.weight * 100}%` }}
                        />
                      </span>
                    </span>
                  </HoldingRow>
                </li>
              ))}
            </ul>
          ) : (
            <SpotlightStatus
              text={c("No stock positions in the available filing.", "当前申报暂无股票持仓数据。")}
            />
          )}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {c(
              "Weights use all reported share positions excluding options, including ETFs.",
              "占比以该份 13F 中非期权的股份类持仓总市值为基准，含 ETF。",
            )}
          </p>
        </div>
        <div className="min-w-0 space-y-3 md:border-l md:border-border md:pl-5">
          <SegmentedControl
            size="sm"
            label={c("Return type", "收益类型")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "stock", label: c("Stock", "个股") },
              { value: "portfolio", label: c("13F model", "13F 模拟组合") },
            ]}
          />
          {mode === "portfolio" ? (
            <PortfolioReturnChart manager={manager.id} />
          ) : data && !resource.loading ? (
            <StockReturnChart stock={ticker && path ? { ticker, path } : undefined} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HoldingRow({
  active,
  select,
  children,
}: {
  active: boolean;
  select?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left",
    select &&
      "hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
    active && "bg-muted",
  );
  return select ? (
    <button type="button" className={className} aria-pressed={active} onClick={select}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

function PelosiSpotlight() {
  const c = useCopy();
  const f = useFinancialFormat();
  const resource = useFreeResearch<{ trades: PelosiDisclosure[] }>(`/api${PELOSI_TRADES_PATH}`);
  const [selected, setSelected] = useState<number>();
  const rows = resource.data && !resource.error ? pelosiDisclosures(resource.data.trades) : [];
  const chartable = rows.filter((row) => stockReturnPath(row.ticker));
  const active = chartable.find((row) => row.id === selected) ?? chartable[0];
  const ticker = active?.ticker;
  const path = stockReturnPath(ticker);
  const directions = {
    buy: c("Buy", "买入"),
    sell: c("Sell", "卖出"),
    exchange: c("Exchange", "交换"),
    other: c("Other", "其他"),
  };
  return (
    <div className="space-y-4">
      <SpotlightHeader
        title={c("Nancy Pelosi", "南希·佩洛西")}
        detail={c("U.S. House transaction disclosures", "美国众议院交易披露")}
      />
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold">{c("Recent disclosed trades", "近期披露交易")}</h4>
          {resource.loading || resource.error ? (
            <SpotlightStatus
              loading={resource.loading}
              text={
                resource.loading
                  ? c("Loading disclosures…", "正在加载交易披露…")
                  : c("Disclosures could not be loaded.", "交易披露加载失败。")
              }
              retry={resource.refresh}
            />
          ) : rows.length ? (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const source = houseDisclosureUrl(row.source_url);
                return (
                  <li key={row.id} className="flex items-center gap-2">
                    <HoldingRow
                      active={row.id === active?.id}
                      select={stockReturnPath(row.ticker) ? () => setSelected(row.id) : undefined}
                    >
                      <span className="min-w-0">
                        <span className="figure block text-sm font-medium">
                          {row.ticker || "—"} · {directions[row.direction]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {f.date(row.trade_date)}
                        </span>
                      </span>
                      <span className="figure text-right text-xs">{row.amount_range ?? "—"}</span>
                    </HoldingRow>
                    {source && (
                      <a
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        aria-label={c(
                          `Filing dated ${f.date(row.filed_date)}`,
                          `${f.date(row.filed_date)} 的申报原文`,
                        )}
                      >
                        {c("Filing", "原文")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <SpotlightStatus
              text={c("No matching House disclosures are available.", "暂无可用的众议院交易披露。")}
            />
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {c(
              "Amounts are disclosed in ranges. Portfolio weights and trade returns are unavailable.",
              "披露仅提供交易金额区间，无法计算持仓占比或交易收益。",
            )}
          </p>
        </div>
        <div className="min-w-0 md:border-l md:border-border md:pl-5">
          {resource.data && !resource.loading && !resource.error && (
            <StockReturnChart stock={ticker && path ? { ticker, path } : undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
