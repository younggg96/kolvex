"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useLandingReducedMotion } from "./useLandingReducedMotion";
import { useTranslation, type Locale } from "@/lib/i18n";
import { motionSpring } from "@/lib/motion/spring";

const headlines = {
  zh: [
    ["你关注的股票，", "一眼看懂。"],
    ["市场里的声音，", "有据可循。"],
    ["纷繁的市场，", "看清脉络。"],
    ["深入每份研究，", "看见风险。"],
    ["把信息串起来，", "让判断更清晰。"],
  ],
  en: [
    ["Your stocks.", "In perspective."],
    ["Every opinion.", "Back to source."],
    ["More signals.", "Less noise."],
    ["Go deeper.", "See the risks."],
    ["Stay curious.", "Stay informed."],
  ],
} as const;

function TypewriterHeadline({ locale }: { locale: Locale }) {
  const reduce = useLandingReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const inView = useInView(heading, { amount: 0.1 });
  const phrases = headlines[locale];
  const [index, setIndex] = useState(0);
  // Initial HTML contains a complete headline; the first cycle starts after a pause.
  const [length, setLength] = useState(() => Array.from(phrases[0].join("")).length);
  const [deleting, setDeleting] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const lines = phrases[index];
  const first = Array.from(lines[0]);
  const second = Array.from(lines[1]);
  const total = first.length + second.length;

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (reduce || !inView || !tabVisible) return;
    const delay = deleting ? (length === 0 ? 300 : 32) : length === total ? 2400 : 85;
    const timer = window.setTimeout(() => {
      if (deleting && length === 0) {
        setIndex((current) => (current + 1) % phrases.length);
        setDeleting(false);
      } else if (!deleting && length === total) {
        setDeleting(true);
      } else {
        setLength((current) => current + (deleting ? -1 : 1));
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [reduce, inView, tabVisible, deleting, length, total, phrases.length]);

  const firstText = reduce ? phrases[0][0] : first.slice(0, length).join("");
  const secondText = reduce
    ? phrases[0][1]
    : second.slice(0, Math.max(0, length - first.length)).join("");
  const caret = (
    <span className="ml-[.04em] font-light text-[rgb(var(--primary-hover))] dark:text-positive motion-safe:animate-typewriter-blink">
      |
    </span>
  );
  return (
    <h1
      ref={heading}
      id="landing-title"
      className="text-[length:clamp(2.75rem,5.1vw,4.5rem)] font-semibold leading-[1.2] tracking-[-.055em] md:max-[1001px]:text-[length:clamp(2.5rem,5.2vw,3.375rem)] min-[641px]:max-md:text-[length:clamp(2.5rem,5.4vw,3.875rem)] max-[641px]:text-[length:clamp(2.25rem,6.6vw,3.375rem)]"
      aria-label={phrases[0].join(locale === "en" ? " " : "")}
    >
      <span aria-hidden="true">
        <span className="block min-h-[1.2em] whitespace-nowrap [&>span]:inline-block">
          {firstText}
          {!reduce && length <= first.length ? caret : null}
        </span>
        <span className="block min-h-[1.2em] whitespace-nowrap text-[rgb(var(--primary-hover))] dark:text-positive [&>span]:inline-block">
          {secondText}
          {!reduce && length > first.length ? caret : null}
        </span>
      </span>
    </h1>
  );
}

export default function LandingHero() {
  const c = useCopy();
  const reduce = useLandingReducedMotion();
  const { locale } = useTranslation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, motionSpring(0.47));
  const springY = useSpring(y, motionSpring(0.47));

  return (
    <section
      id="product"
      className="relative isolate scroll-mt-6 overflow-clip"
      aria-labelledby="landing-title"
      data-hero-paused={reduce}
    >
      <div className="landing-width grid min-h-[42.5rem] grid-cols-1 items-center justify-items-center pb-[7.5rem] pt-[6.25rem] md:max-[1001px]:min-h-[38.75rem] md:max-[1001px]:pb-[6.875rem] md:max-[1001px]:pt-[5.5rem] max-md:min-h-[35rem] max-md:pb-[6.25rem] max-md:pt-[4.5rem]">
        <div className="relative z-[1] w-full py-3 text-center max-md:pb-0 dark:before:pointer-events-none dark:before:absolute dark:before:-inset-x-24 dark:before:-inset-y-16 dark:before:z-[-1] dark:before:bg-[radial-gradient(closest-side,rgb(3_8_5/.78)_0%,rgb(3_8_5/.55)_60%,rgb(3_8_5/0)_100%)] dark:before:content-['']">
          <TypewriterHeadline key={locale} locale={locale} />
          <p className="mx-auto mb-7 mt-6 text-base leading-[1.8] text-muted-foreground dark:text-foreground/80 md:max-[1001px]:max-w-[28ch] md:max-[1001px]:text-sm min-[641px]:max-md:mb-[1.625rem] min-[641px]:max-md:mt-[1.375rem] min-[641px]:max-md:text-sm max-[641px]:mb-[1.625rem] max-[641px]:mt-[1.375rem] max-[641px]:max-w-[28ch] max-[641px]:text-sm">
            {c(
              "News, market voices and AI research. In one place.",
              "新闻、博主观点、AI 研究，一处看清。",
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-5 max-[641px]:gap-x-6 max-[641px]:gap-y-4">
            <motion.div
              className="inline-flex"
              style={reduce ? undefined : { x: springX, y: springY }}
              onPointerMove={(event) => {
                if (reduce || event.pointerType !== "mouse") return;
                const bounds = event.currentTarget.getBoundingClientRect();
                x.set((event.clientX - bounds.left - bounds.width / 2) * 0.15);
                y.set((event.clientY - bounds.top - bounds.height / 2) * 0.2);
              }}
              onPointerLeave={() => {
                x.set(0);
                y.set(0);
              }}
              onBlur={() => {
                x.set(0);
                y.set(0);
              }}
            >
              <Button
                asChild
                size="lg"
                className="min-h-12 !gap-6 !px-[1.625rem] !text-sm relative overflow-hidden after:pointer-events-none after:absolute after:-inset-x-[20%] after:-inset-y-[70%] after:-translate-x-full after:bg-[linear-gradient(110deg,transparent_40%,rgb(255_255_255/.33)_50%,transparent_60%)] after:content-[''] hover:after:translate-x-full hover:after:[transition:transform_700ms_var(--spring)]"
              >
                <Link href="/auth">
                  {c("Get started", "开始使用")}
                  <ArrowUpRight size="1.125rem" aria-hidden="true" />
                </Link>
              </Button>
            </motion.div>
            <Link
              href="/research"
              className="inline-flex min-h-12 items-center gap-2.5 rounded-full px-[1.375rem] text-[0.8125rem] bg-[var(--landing-glass-fill)] shadow-[var(--glass-drop),var(--glass-edge)] backdrop-blur-[24px] hover:bg-[var(--landing-glass-fill-hover)] hover:text-[rgb(var(--primary-hover))] dark:hover:text-positive [&:hover_svg]:-translate-y-[3px] [&:hover_svg]:translate-x-[3px] [&_svg]:[transition:transform_220ms_var(--spring)]"
            >
              {c("Explore research", "探索研究")}
              <ArrowUpRight size="1rem" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 min-w-0">
          <div className="absolute inset-x-5 bottom-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-xs text-muted-foreground max-md:px-0">
            <span className="inline-flex min-h-8 items-center rounded-full px-3.5 text-foreground/[.78] bg-[var(--landing-glass-fill)] shadow-[var(--glass-drop),var(--glass-edge)] backdrop-blur-[24px]">
              {c("Find the signal in the noise.", "让信息，汇成判断。")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
