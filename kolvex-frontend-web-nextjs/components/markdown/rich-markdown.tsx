"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import Link from "next/link";
import CompanyLogo from "@/components/ui/company-logo";
import { useCopy } from "@/components/decision/shared";
import { marketStockUrl } from "@/lib/stockLinks";
import { symbolFromStockLink } from "@/lib/markdown/stockMentions";
import { parseChartSpec, type ChartSpec } from "@/lib/markdown/prose";
import { cn } from "@/lib/utils";

/**
 * Assistant output is read like a report, not a message: emoji are stripped (a model
 * still emits them), tables get a real table treatment, and a ```chart block becomes
 * a chart instead of a wall of JSON. Prose styling is excluded with `not-prose` so
 * these components own their own type scale.
 */

type Tone = "positive" | "negative" | "warning" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  positive: "bg-positive",
  negative: "bg-negative",
  warning: "bg-warning",
  muted: "bg-muted-foreground/60",
};

/** Direction words keep their colour; the word itself carries the meaning. */
const TONES: Array<[RegExp, Tone]> = [
  [/(分歧|混合|谨慎|观望|mixed|caution)/i, "warning"],
  [/(看空|偏空|看淡|卖出|回调|风险|bearish|sell)/i, "negative"],
  [/(看多|偏多|看好|买入|推荐|bullish|buy)/i, "positive"],
  [/(中性|neutral)/i, "muted"],
];

function toneOf(text: string): Tone | null {
  const short = text.trim();
  if (!short || short.length > 24) return null;
  for (const [pattern, tone] of TONES) if (pattern.test(short)) return tone;
  return null;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as { props?: { children?: ReactNode } })) {
    return textOf((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

const NUMERIC = /^[-+]?[$€£¥]?\s*\d[\d,.]*\s*(%|x|×|bps)?\s*(b|m|k|bn|tn|万亿|亿|万)?$/i;

function isNumericCell(text: string) {
  const value = text.trim();
  return value.length > 0 && value.length <= 16 && NUMERIC.test(value) && /\d/.test(value);
}

type Align = "left" | "center" | "right";

const ALIGN_CLASS: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };

/** How a whole column behaves, decided once from everything it holds. */
type ColumnLayout = { numeric: boolean; wraps: boolean; minWidth?: string };

function Th({ children, align, column }: { children?: ReactNode; align?: Align; column?: ColumnLayout }) {
  return (
    <th
      scope="col"
      style={column?.minWidth ? { minWidth: column.minWidth } : undefined}
      className={cn(
        "border-b border-foreground/10 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground",
        !column?.wraps && "whitespace-nowrap",
        ALIGN_CLASS[align || "left"],
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, align, column }: { children?: ReactNode; align?: Align; column?: ColumnLayout }) {
  const tone = toneOf(textOf(children));
  const resolved: Align = align || "left";
  return (
    <td
      style={column?.minWidth ? { minWidth: column.minWidth } : undefined}
      className={cn(
        "px-3.5 py-2.5 align-top text-[0.8125rem] leading-6 text-foreground",
        column?.wraps && !column.numeric ? "[overflow-wrap:anywhere]" : "whitespace-nowrap",
        ALIGN_CLASS[resolved],
        resolved === "right" && "figure",
      )}
    >
      {tone ? (
        <span className="inline-flex items-start gap-1.5">
          <span className={cn("mt-[0.5625rem] h-1.5 w-1.5 shrink-0 rounded-full", TONE_CLASS[tone])} aria-hidden="true" />
          <span className="min-w-0">{children}</span>
        </span>
      ) : (
        children
      )}
    </td>
  );
}

type CellElement = ReactElement<{ children?: ReactNode; align?: Align | null; column?: ColumnLayout }>;

/** Rows split by section, so the header row never decides which columns hold numbers. */
function tableRows(node: ReactNode): { header: CellElement[][]; body: CellElement[][] } {
  const header: CellElement[][] = [];
  const body: CellElement[][] = [];
  const visit = (child: ReactNode, inHead: boolean) => {
    if (Array.isArray(child)) return child.forEach((entry) => visit(entry, inHead));
    if (!isValidElement(child)) return;
    const element = child as CellElement;
    const type = element.type;
    if (type === "tr") {
      (inHead ? header : body).push(Children.toArray(element.props.children).filter(isValidElement) as CellElement[]);
      return;
    }
    if (type === "thead") return visit(element.props.children, true);
    if (type === "tbody" || type === "tfoot") return visit(element.props.children, false);
    if (type !== "table") visit(element.props.children, inHead);
  };
  visit(node, false);
  return { header, body };
}

/** Text length in em: a CJK glyph fills the em box, Latin text runs about half of it. */
function textUnits(text: string) {
  let units = 0;
  for (const glyph of text.trim()) units += /[⺀-鿿豈-﫿＀-｠]/.test(glyph) ? 1 : 0.55;
  return units;
}

/** Anything this short stays on one line; a table of labels should not wrap at all. */
const ONE_LINE_UNITS = 8;
const WRAPPED_UNITS = { min: 8, max: 18 };
const LINES = { header: 2, body: 3 };
const BODY_EM_REM = 0.8125;
const CELL_PADDING_REM = 1.75;

/**
 * CJK text can break after any glyph, so an auto-layout table will happily crush a
 * sentence to one glyph per line while a neighbour keeps its full width. Columns that
 * must wrap get a floor sized to their longest text; the table scrolls past that.
 */
function columnLayouts(header: CellElement[][], body: CellElement[][]): ColumnLayout[] {
  const longest = (rows: CellElement[][], column: number) =>
    rows.reduce((peak, cells) => Math.max(peak, textUnits(textOf(cells[column]?.props.children))), 0);
  const count = Math.max(0, ...[...header, ...body].map((cells) => cells.length));

  return Array.from({ length: count }, (_, column) => {
    const values = body
      .map((cells) => textOf(cells[column]?.props.children).trim())
      .filter((value) => value && value !== "—" && value !== "-");
    const numeric = values.length > 0 && values.every(isNumericCell);
    const headerUnits = longest(header, column);
    const bodyUnits = longest(body, column);
    if (Math.max(headerUnits, bodyUnits) <= ONE_LINE_UNITS) return { numeric, wraps: false };
    const units = Math.min(WRAPPED_UNITS.max, Math.max(WRAPPED_UNITS.min, headerUnits / LINES.header, bodyUnits / LINES.body));
    return { numeric, wraps: true, minWidth: `${(units * BODY_EM_REM + CELL_PADDING_REM).toFixed(2)}rem` };
  });
}

function applyColumns(node: ReactNode, columns: ColumnLayout[]): ReactNode {
  if (Array.isArray(node)) return node.map((child) => applyColumns(child, columns));
  if (!isValidElement(node)) return node;
  const element = node as CellElement;
  if (element.type === Th || element.type === Td) return node; // the row pass below owns these
  const { children } = element.props;
  if (children === undefined) return node;
  if (element.type === "tr") {
    const cells = Children.toArray(children).map((cell, index) => {
      if (!isValidElement(cell)) return cell;
      const column = columns[index];
      return cloneElement(cell as CellElement, column?.numeric ? { column, align: "right" } : { column });
    });
    return cloneElement(element, undefined, cells);
  }
  return cloneElement(element, undefined, applyColumns(children, columns));
}

/** A markdown table: hairline rules, one layout per column, scrolls only when the columns need it. */
export function DataTable({ children, label, className }: { children?: ReactNode; label?: string; className?: string }) {
  const c = useCopy();
  // React Markdown hands us the cells before they render, so a column can be sized and
  // aligned as a whole rather than cell by cell.
  const { header, body } = tableRows(children);
  const columns = columnLayouts(header, body);
  return (
    <div
      role="region"
      aria-label={label || c("Data table", "数据表")}
      tabIndex={0}
      className={cn(
        "not-prose my-4 w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-left",
          "[&_thead]:bg-foreground/[0.05] [&_tbody>tr+tr]:border-t [&_tbody>tr+tr]:border-foreground/[0.06] [&_tbody>tr:hover]:bg-foreground/[0.04]",
        )}
      >
        {applyColumns(children, columns)}
      </table>
    </div>
  );
}

function formatValue(value: number, unit?: string) {
  const magnitude = Math.abs(value);
  const text = magnitude >= 1000 ? value.toFixed(0) : Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${text}${unit || ""}`;
}

/** Ranked values as horizontal bars; negative values hang left of the zero line. */
function BarChart({ spec }: { spec: ChartSpec }) {
  const c = useCopy();
  const peak = Math.max(...spec.items.map((item) => Math.abs(item.value)), 1);
  const diverging = spec.items.some((item) => item.value < 0);
  const ordered = [...spec.items].sort((a, b) => b.value - a.value);

  return (
    <figure
      className="not-prose my-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3.5"
      aria-label={spec.title ? `${spec.title} ${c("chart", "图表")}` : c("Chart", "图表")}
    >
      {(spec.title || spec.unit) && (
        <figcaption className="mb-2.5 flex items-baseline justify-between gap-3">
          {spec.title && <span className="text-sm font-semibold text-foreground">{spec.title}</span>}
          {spec.unit && <span className="text-xs text-muted-foreground">{spec.unit}</span>}
        </figcaption>
      )}
      <ul className="space-y-1.5">
        {ordered.map((item, index) => {
          const share = (Math.abs(item.value) / peak) * 100;
          const positive = item.value >= 0;
          return (
            <li key={`${item.label}-${index}`} className="grid grid-cols-[minmax(3.5rem,5.5rem)_1fr_auto] items-center gap-2.5">
              <span className="truncate text-xs text-muted-foreground">{item.label}</span>
              <span className={cn("relative h-2 rounded-full bg-foreground/[0.07]", diverging && "overflow-visible")}>
                {diverging && <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/20" aria-hidden="true" />}
                <span
                  className={cn("absolute inset-y-0 rounded-full transition-[width] duration-500 ease-spring motion-reduce:transition-none", positive ? "bg-positive/80" : "bg-negative/80")}
                  style={
                    diverging
                      ? positive
                        ? { left: "50%", width: `${share / 2}%` }
                        : { right: "50%", width: `${share / 2}%` }
                      : { left: 0, width: `${share}%` }
                  }
                />
              </span>
              <span className={cn("figure w-14 text-right text-xs", positive ? "text-foreground" : "text-negative")}>
                {formatValue(item.value, spec.unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** A series over time: one polyline, the value range written at both ends. */
function LineChart({ spec }: { spec: ChartSpec }) {
  const values = spec.items.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${28 - ((value - min) / range) * 26}`)
    .join(" ");

  return (
    <figure className="not-prose my-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3.5">
      {(spec.title || spec.unit) && (
        <figcaption className="mb-2 flex items-baseline justify-between gap-3">
          {spec.title && <span className="text-sm font-semibold text-foreground">{spec.title}</span>}
          {spec.unit && <span className="text-xs text-muted-foreground">{spec.unit}</span>}
        </figcaption>
      )}
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-16 w-full text-positive" role="img" aria-label={spec.title || "Line chart"}>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
        <span>{spec.items[0]?.label}</span>
        <span className="figure">
          {formatValue(min, spec.unit)} – {formatValue(max, spec.unit)}
        </span>
        <span>{spec.items[spec.items.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

/** `chart` fenced blocks render as charts; other code keeps the default treatment. */
function Pre({ children }: { children?: ReactNode }) {
  const first = Array.isArray(children) ? children[0] : children;
  const props = (first as { props?: { className?: string; children?: ReactNode } } | undefined)?.props;
  const language = /language-([\w-]+)/.exec(props?.className || "")?.[1];
  if (language === "chart") {
    const spec = parseChartSpec(textOf(props?.children).trim());
    if (spec) return spec.type === "line" ? <LineChart spec={spec} /> : <BarChart spec={spec} />;
  }
  return <pre>{children}</pre>;
}

/** Components shared by every place assistant text is rendered as markdown. */
/**
 * A ticker as a company: logo plus the symbol, linked to its quotes page. Tickers
 * arrive already validated by the remark plugin, so this only decides the look.
 */
export function StockMention({ symbol }: { symbol: string }) {
  const target = marketStockUrl(symbol);
  const content = (
    <>
      <span aria-hidden="true"><CompanyLogo symbol={symbol} size="xs" /></span>
      <span className="figure text-[0.9375rem] font-semibold">{symbol}</span>
    </>
  );
  if (!target) return <span className="inline-flex items-center gap-1.5">{content}</span>;
  return (
    <Link
      href={target}
      title={symbol}
      className="inline-flex items-center gap-1.5 rounded-full align-middle text-foreground hover:opacity-80"
    >
      {content}
    </Link>
  );
}

/** Links to a stock's quotes page; every other link is left exactly as written. */
function Anchor({ href, children }: { href?: string; children?: ReactNode }) {
  const symbol = symbolFromStockLink(href);
  if (symbol) return <StockMention symbol={symbol} />;
  return <a href={href}>{children}</a>;
}

export const RICH_MARKDOWN_COMPONENTS: Components = {
  table: ({ children }) => <DataTable>{children}</DataTable>,
  // `align` arrives from the markdown column rule (`| ---: |`); keep it, the cell needs it.
  th: ({ children, ...rest }) => {
    const { align, column } = rest as { align?: Align; column?: ColumnLayout };
    return <Th align={align} column={column}>{children}</Th>;
  },
  td: ({ children, ...rest }) => {
    const { align, column } = rest as { align?: Align; column?: ColumnLayout };
    return <Td align={align} column={column}>{children}</Td>;
  },
  pre: ({ children }) => <Pre>{children}</Pre>,
  a: ({ href, children }) => <Anchor href={href}>{children}</Anchor>,
};
