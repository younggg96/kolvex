"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  LineChart,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import LandingMarketScene from "./LandingMarketScene";
import { landingEase } from "./LandingMotion";

export default function LandingHero() {
  const c = useCopy();
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const features = [
    {
      icon: AudioLines,
      label: t("landing.nav.creatorResearch"),
      href: "/dashboard/youtube-opinions",
    },
    {
      icon: LineChart,
      label: c("Market context", "市场行情"),
      href: "/dashboard",
    },
    {
      icon: Sparkles,
      label: t("sidebar.tradingAnalysis"),
      href: "/dashboard/ai-research",
    },
    {
      icon: Wallet,
      label: c("Your holdings", "我的持仓"),
      href: "/dashboard/portfolio",
    },
  ];
  return (
    <section ref={hero} className="landing-hero">
      <div className="landing-width landing-hero-grid">
        <div className="landing-hero-copy">
          <motion.p
            className="landing-eyebrow"
            initial={false}
            animate={reduce ? undefined : { opacity: [0, 1], y: [12, 0] }}
            transition={{ duration: 0.7 }}
          >
            {c("YOUR STOCK RESEARCH, CONNECTED", "连接观点、研究与持仓")}
          </motion.p>
          <h1 className="landing-headline">
            <motion.span
              initial={false}
              animate={reduce ? undefined : { opacity: [0, 1], y: [35, 0] }}
              transition={{ duration: 0.85, ease: landingEase }}
            >
              {c("Less noise.", "让观点汇聚，")}
            </motion.span>
            <motion.span
              className="landing-headline-accent"
              initial={false}
              animate={reduce ? undefined : { opacity: [0, 1], y: [35, 0] }}
              transition={{ duration: 0.85, delay: 0.12, ease: landingEase }}
            >
              {c("More perspective.", "让判断清晰。")}
            </motion.span>
          </h1>
          <motion.div
            initial={false}
            animate={reduce ? undefined : { opacity: [0, 1], y: [20, 0] }}
            transition={{ duration: 0.85, delay: 0.25, ease: landingEase }}
          >
            <p className="landing-hero-description">
              {c(
                "Creator opinions, market context and AI research. See how it all connects to the stocks you own.",
                "博主观点、市场行情与 AI 研究，在一处看清你关注的股票。",
              )}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="landing-primary">
                <Link href="/auth">
                  {t("landing.workspaceHero.openWorkspace")}
                  <ArrowUpRight className="ml-3 h-4 w-4" />
                </Link>
              </Button>
              <Link href="#decision-preview" className="landing-text-link">
                {c("Explore the workspace", "看看它如何工作")}
                <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
        <motion.div className="min-w-0" style={{ y: reduce ? 0 : sceneY }}>
          <LandingMarketScene />
        </motion.div>
      </div>
      <nav
        className="landing-width landing-feature-nav"
        aria-label={c("Explore Kolvex features", "了解 Kolvex 功能")}
      >
        {features.map(({ icon: Icon, label, href }) => (
          <Link href={href} key={href}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
            <ArrowUpRight
              size={16}
              className="feature-nav-arrow"
              aria-hidden="true"
            />
          </Link>
        ))}
      </nav>
    </section>
  );
}
