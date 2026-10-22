"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import Waves from "./react-bits/Waves";
import { useTranslation, type Locale } from "@/lib/i18n";

const motionPreference = "(prefers-reduced-motion: reduce)";
function subscribeToMotionPreference(callback: () => void) {
  const query = window.matchMedia(motionPreference);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
// The server snapshot keeps the heading and control identical during hydration.
function useHeroReducedMotion() {
  return useSyncExternalStore(subscribeToMotionPreference,
    () => window.matchMedia(motionPreference).matches, () => false);
}

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
  const reduce = useHeroReducedMotion();
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
  const secondText = reduce ? phrases[0][1] : second.slice(0, Math.max(0, length - first.length)).join("");
  const caret = <span className="typewriter-caret">|</span>;
  return (
    <h1 ref={heading} id="landing-title" aria-label={phrases[0].join(locale === "en" ? " " : "")}>
      <span aria-hidden="true">
        <span className="hero-title-line">{firstText}{!reduce && length <= first.length ? caret : null}</span>
        <span className="hero-title-line hero-title-accent">{secondText}{!reduce && length > first.length ? caret : null}</span>
      </span>
    </h1>
  );
}

export default function LandingHero() {
  const c = useCopy();
  const reduce = useHeroReducedMotion();
  const { locale } = useTranslation();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18 });
  const springY = useSpring(y, { stiffness: 180, damping: 18 });

  return (
    <section id="product" className="landing-hero" aria-labelledby="landing-title" data-hero-paused={reduce}>
      <div className="landing-width kinetic-hero">
        <div className="hero-copy">
          <TypewriterHeadline key={locale} locale={locale} />
          <p>{c("News, market voices and AI research. In one place.", "新闻、博主观点、AI 研究，一处看清。")}</p>
          <div className="hero-actions">
            <motion.div
              className="hero-magnet"
              style={reduce ? undefined : { x: springX, y: springY }}
              onPointerMove={(event) => {
                if (reduce || event.pointerType !== "mouse") return;
                const bounds = event.currentTarget.getBoundingClientRect();
                x.set((event.clientX - bounds.left - bounds.width / 2) * 0.15);
                y.set((event.clientY - bounds.top - bounds.height / 2) * 0.2);
              }}
              onPointerLeave={() => { x.set(0); y.set(0); }}
              onBlur={() => { x.set(0); y.set(0); }}
            >
              <Button asChild size="lg" className="landing-primary hero-primary">
                <Link href="/auth">{c("Get started", "开始使用")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
              </Button>
            </motion.div>
            <Link href="/research" className="hero-explore">{c("Explore research", "探索研究")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-signal-field" aria-hidden="true">
            <Waves
              lineColor="#00a904" accentColor="#00c805" spacing={9} lineWidth={1}
              rotation={-38} amplitude={85} scale={0.7} twist={1.5} speed={0.55}
              mouseRadius={160} mouseStrength={1.8} fade={0.65} opacity={0.8}
              paused={reduce} mouseInteraction={!reduce} clickRipple={!reduce} dpr={1.5}
            />
          </div>
          <div className="hero-art-caption">
            <span>{c("Find the signal in the noise.", "让信息，汇成判断。")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
