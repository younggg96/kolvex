"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ArrowUpRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";

const prices = [
  184, 186, 182, 185, 189, 187, 192, 190, 194, 191, 196, 198, 195, 199, 197,
  201,
];
export default function LandingPreview() {
  const c = useCopy();
  const [step, setStep] = useState(0);
  const steps = [
    c("Research", "研究"),
    c("Validate", "验证"),
    c("Analysis", "分析"),
    c("Updates", "动态"),
  ];
  return (
    <div id="decision-preview" className="landing-width pb-12 md:pb-16">
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-xl shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4 md:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              N
            </span>
            <div>
              <p className="font-semibold">
                NVDA{" "}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  NVIDIA
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {c("Stock overview", "股票信息总览")}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {c(
              "Illustrative example · not live market data",
              "示例数据 · 非实时行情",
            )}
          </p>
        </div>
        <div
          className="flex overflow-x-auto border-b border-border px-5 md:px-7"
          role="tablist"
          aria-label={c("Stock information preview", "股票信息预览")}
        >
          {steps.map((label, index) => (
            <button
              key={label}
              role="tab"
              id={`preview-tab-${index}`}
              aria-selected={step === index}
              aria-controls="preview-panel"
              onClick={() => setStep(index)}
              className={`min-w-[100px] border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${step === index ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r md:p-7">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">$201.00</p>
                <p className="mt-1 text-xs text-primary">
                  +7.8% {c("over the example period", "示例区间涨幅")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {c("Your position", "我的持仓")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  75 {c("shares", "股")}
                </p>
                <p className="text-xs text-muted-foreground">$15,075</p>
              </div>
            </div>
            <svg
              viewBox="0 0 580 235"
              role="img"
              aria-label={c(
                "Illustrative NVDA candlestick chart with AI reference levels",
                "NVDA 示例K线，包含入场、失效和目标价位",
              )}
              className="mt-7 w-full"
            >
              <g stroke="currentColor" className="text-border">
                {[30, 80, 130, 180].map((y) => (
                  <line key={y} x1="0" x2="520" y1={y} y2={y} />
                ))}
              </g>
              {prices.map((close, i) => {
                const open = i === 0 ? 181 : prices[i - 1];
                const y = (p: number) => 205 - (p - 175) * 6;
                const up = close >= open;
                return (
                  <g
                    key={i}
                    stroke={up ? "#00c805" : "#ef6464"}
                    fill={up ? "#00c805" : "#ef6464"}
                  >
                    <line
                      x1={18 + i * 31}
                      x2={18 + i * 31}
                      y1={y(Math.max(open, close) + 2)}
                      y2={y(Math.min(open, close) - 2)}
                    />
                    <rect
                      x={11 + i * 31}
                      y={y(Math.max(open, close))}
                      width="14"
                      height={Math.max(Math.abs(open - close) * 6, 3)}
                      rx="1"
                    />
                  </g>
                );
              })}
              <g
                fontSize="11"
                fill="currentColor"
                className="text-muted-foreground"
              >
                <text x="538" y="30">
                  $205
                </text>
                <text x="538" y="86">
                  $195
                </text>
                <text x="538" y="150">
                  $185
                </text>
                <text x="0" y="232">
                  {c("Two weeks ago", "两周前")}
                </text>
                <text x="440" y="232">
                  {c("Today", "今天")}
                </text>
              </g>
              <g strokeDasharray="4 4">
                <line x1="0" x2="520" y1="25" y2="25" stroke="#00c805" />
                <line x1="0" x2="520" y1="139" y2="139" stroke="#3295ec" />
                <line x1="0" x2="520" y1="181" y2="181" stroke="#ef6464" />
              </g>
            </svg>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">{c("Entry", "入场")}</p>
                <p className="mt-1 font-medium">$185–188</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {c("Invalidation", "失效价")}
                </p>
                <p className="mt-1 font-medium">$179</p>
              </div>
              <div>
                <p className="text-muted-foreground">{c("Target", "目标")}</p>
                <p className="mt-1 font-medium">$205</p>
              </div>
            </div>
          </div>
          <div
            id="preview-panel"
            role="tabpanel"
            aria-labelledby={`preview-tab-${step}`}
            className="p-5 md:p-7"
          >
            {step === 0 && (
              <>
                <h3 className="text-lg font-semibold">
                  {c("What is happening?", "发生了什么？")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {c(
                    "Creator opinions, market context and your position. One view of the stock you're researching.",
                    "创作者观点、市场环境与自己的持仓，在同一处理解你关注的股票。",
                  )}
                </p>
                <div className="mt-7 space-y-5">
                  {[
                    [
                      c("Creators", "创作者"),
                      c("Strongly bullish", "强烈看多"),
                    ],
                    [
                      c("AI technical", "AI 技术面"),
                      c("Pullback structure", "回调结构"),
                    ],
                    [
                      c("Key risk", "核心风险"),
                      c("$179 support", "$179 支撑位"),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 border-b border-border pb-3 text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h3 className="text-lg font-semibold">
                  {c("Why does it matter?", "这意味着什么？")}
                </h3>
                <ul className="mt-6 space-y-5 text-sm">
                  {[
                    c("Higher highs and higher lows", "更高的高点与低点"),
                    c(
                      "Price above EMA20 / EMA50",
                      "价格位于 EMA20 / EMA50 上方",
                    ),
                    c("6 bullish creator views", "6 位创作者看多"),
                    c("Valuation remains a risk", "估值仍是风险"),
                  ].map((text) => (
                    <li key={text} className="flex gap-3">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {text}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs leading-5 text-muted-foreground">
                  {c(
                    "Evidence to weigh, with reasons you can inspect.",
                    "查看分析依据，了解观点背后的理由。",
                  )}
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <BookOpen className="h-6 w-6 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">
                  {c("AI research summary", "AI 研究摘要")}
                </h3>
                <p className="mt-4 text-sm leading-6">
                  {c(
                    "AI infrastructure demand remains strong. The analysis highlights support on a pullback and valuation risk.",
                    "AI 基础设施需求持续强劲。分析关注回调支撑是否稳固，以及估值风险。",
                  )}
                </p>
                <p className="mt-5 text-xs text-muted-foreground">
                  {c("Bullish · 1–3 months", "看多 · 1–3个月")}
                </p>
                <Button asChild className="mt-7">
                  <Link href="/dashboard/market/NVDA">
                    {c("Read stock analysis", "查看股票分析")}
                  </Link>
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="text-lg font-semibold">
                  {c("What changed recently?", "最近有什么变化？")}
                </h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {c(
                    "Two weeks later: new creator opinions shift the overall view.",
                    "两周后，新的博主观点使整体倾向发生了变化。",
                  )}
                </p>
                <div className="mt-6 space-y-4 text-sm">
                  <p>
                    {c("Creators: Bullish → Neutral", "创作者：看多 → 中性")}
                  </p>
                  <p>
                    {c("Price: $186 → $201", "价格：$186 → $201")}
                  </p>
                  <p>
                    {c(
                      "See the latest opinions and source videos.",
                      "直接查看最新观点和原始视频。",
                    )}
                  </p>
                </div>
                <Button asChild variant="outline" className="mt-7">
                  <Link href="/dashboard/journal">
                    {c("View updates", "查看变化动态")}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
