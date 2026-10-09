"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import { AudioLines, Sparkles, Wallet, Pause, Play } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { landingEase } from "./LandingMotion";

// Illustrative series only. No network quotes or investment claims are implied.
const series = {
  NVDA: {
    name: "NVIDIA",
    values: [36, 42, 38, 49, 46, 57, 51, 62, 59, 70, 67, 78, 73, 85, 79, 91],
  },
  MSFT: {
    name: "Microsoft",
    values: [30, 36, 32, 40, 45, 42, 49, 46, 58, 55, 63, 60, 70, 67, 74, 81],
  },
  TSLA: {
    name: "Tesla",
    values: [58, 65, 51, 61, 42, 48, 37, 51, 45, 60, 54, 72, 61, 76, 68, 84],
  },
};
type Symbol = keyof typeof series;

export default function LandingMarketScene() {
  const c = useCopy();
  const reduce = useReducedMotion();
  const [ticker, setTicker] = useState<Symbol>("NVDA");
  const [paused, setPaused] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 90, damping: 22 });
  const rotateY = useSpring(x, { stiffness: 90, damping: 22 });
  const values = series[ticker].values;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${30 + i * 32} ${260 - v * 2.1}`)
    .join(" ");
  const moving = !reduce && !paused;

  return (
    <div
      ref={scene}
      className="landing-market-scene"
      data-paused={!moving}
      onPointerMove={(event) => {
        if (!moving || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        x.set(((event.clientX - box.left) / box.width - 0.5) * 9);
        y.set(-((event.clientY - box.top) / box.height - 0.5) * 9);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <div className="signal-orbit signal-orbit-outer" aria-hidden="true" />
      <div className="signal-orbit signal-orbit-inner" aria-hidden="true" />
      <motion.div
        className="signal-chart"
        style={{ rotateX: moving ? rotateX : 0, rotateY: moving ? rotateY : 0 }}
        initial={false}
        animate={reduce ? undefined : { opacity: [0, 1], y: [25, 0] }}
        transition={{ duration: 1, ease: landingEase }}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <span className="font-mono text-xs text-muted-foreground">
              {c("A STOCK. THE WHOLE PICTURE.", "一只股票，多维视角。")}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={ticker}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <p className="mt-3 text-4xl font-bold tracking-tighter">
                  {ticker}
                  <span className="ml-3 text-sm font-normal tracking-normal text-muted-foreground">
                    {series[ticker].name}
                  </span>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <button
            type="button"
            className="scene-pause"
            aria-pressed={paused}
            aria-label={
              paused
                ? c("Play ambient animation", "播放背景动画")
                : c("Pause ambient animation", "暂停背景动画")
            }
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
        <svg
          viewBox="0 0 560 300"
          className="signal-price-chart"
          role="img"
          aria-label={c(
            `${ticker} illustrative price trend`,
            `${ticker} 示例价格走势`,
          )}
        >
          <defs>
            <linearGradient id="hero-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="text-border" stroke="currentColor">
            {[80, 150, 220].map((v) => (
              <line
                key={v}
                x1="30"
                y1={v}
                x2="535"
                y2={v}
                strokeDasharray="3 6"
              />
            ))}
          </g>
          <motion.path
            key={`${ticker}-fill`}
            d={`${path} L 510 285 L 30 285 Z`}
            fill="url(#hero-chart-fill)"
            initial={false}
            animate={{ opacity: moving ? [0, 1] : 1 }}
            transition={{ duration: 1.4 }}
          />
          {values.map((value, i) => (
            <motion.g
              key={`${ticker}-${i}`}
              initial={false}
              animate={
                moving ? { opacity: [0, 1], y: [18, 0] } : { opacity: 1, y: 0 }
              }
              transition={{ delay: i * 0.035, duration: 0.6 }}
            >
              <line
                x1={30 + i * 32}
                x2={30 + i * 32}
                y1={270 - value * 2.1}
                y2={240 - value * 2.1}
                stroke="currentColor"
                strokeOpacity="0.25"
              />
              <rect
                x={25 + i * 32}
                y={252 - value * 2.1}
                width="10"
                height="13"
                rx="2"
                fill="currentColor"
                fillOpacity="0.2"
              />
            </motion.g>
          ))}
          <motion.path
            key={ticker}
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={moving ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: landingEase }}
          />
          <motion.g
            initial={false}
            animate={
              moving
                ? {
                    x: values.map((_, i) => 30 + i * 32),
                    y: values.map((v) => 260 - v * 2.1),
                    opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                  }
                : { x: 510, y: 260 - values[15] * 2.1, opacity: 0 }
            }
            transition={
              moving
                ? {
                    duration: 5,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                    ease: "linear",
                  }
                : { duration: 0 }
            }
            aria-hidden="true"
          >
            <circle r="11" fill="currentColor" fillOpacity="0.12" />
            <circle r="4" fill="currentColor" />
          </motion.g>
          <circle
            cx="510"
            cy={260 - values[15] * 2.1}
            r="5"
            fill="currentColor"
          />
        </svg>
        <div
          className="flex gap-2 px-6 pb-5"
          role="group"
          aria-label={c("Choose an example stock", "选择示例股票")}
        >
          {(Object.keys(series) as Symbol[]).map((symbol) => (
            <button
              type="button"
              key={symbol}
              aria-pressed={ticker === symbol}
              onClick={() => setTicker(symbol)}
              className="signal-ticker"
            >
              {symbol}
            </button>
          ))}
        </div>
      </motion.div>
      <div className="signal-note signal-note-creators">
        <AudioLines size={20} aria-hidden="true" />
        <div>
          <span>{c("Creator opinions", "博主观点")}</span>
          <p>{c("Every view has a source.", "每个观点，都有出处。")}</p>
        </div>
      </div>
      <div className="signal-note signal-note-research">
        <Sparkles size={20} aria-hidden="true" />
        <div>
          <span>{c("AI research", "AI 研究")}</span>
          <p>{c("See the reasoning.", "看结论，也看依据。")}</p>
        </div>
      </div>
      <div className="signal-note signal-note-holdings">
        <Wallet size={18} aria-hidden="true" />
        <span>{c("Connected to your holdings", "与你的持仓关联")}</span>
      </div>
      <p className="signal-caption">
        {c("Illustrative data, not live quotes", "示例数据，非实时行情")}
      </p>
    </div>
  );
}
