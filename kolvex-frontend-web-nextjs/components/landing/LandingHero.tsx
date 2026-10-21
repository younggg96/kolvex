"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { LandingParallax } from "./LandingScrollEffects";
import LandingStockBrief from "./LandingStockBrief";

export default function LandingHero() {
  const c = useCopy();
  return (
    <section
      className="landing-hero landing-hero-focus"
      aria-labelledby="landing-title"
    >
      <div className="landing-width">
        <div className="focus-intro">
          <LandingParallax className="focus-headline" distance={-28} hero>
            <h1 id="landing-title">
              {c("The market is loud.", "市场很吵。")}
              <span>{c("Your view is clear.", "重点，很清晰。")}</span>
            </h1>
          </LandingParallax>
          <div className="focus-proposition">
            <p>
              {c(
                "Kolvex connects the news, creator opinions and research around your stocks. Get the context before you have to ask.",
                "Kolvex 围绕你关注的股票，把新闻、博主观点与研究连起来。有用的背景，先于你的提问。",
              )}
            </p>
            <div className="landing-actions">
              <Button asChild size="lg" className="landing-primary">
                <Link href="/auth">
                  {c("Start using Kolvex", "开始使用 Kolvex")}
                  <ArrowUpRight size={17} aria-hidden />
                </Link>
              </Button>
              <a href="#product" className="landing-text-link">
                {c("Explore the product", "了解产品")}
                <ArrowRight size={16} aria-hidden />
              </a>
            </div>
          </div>
        </div>
        <LandingParallax className="focus-stage" distance={64} hero>
          <LandingStockBrief />
        </LandingParallax>
        <p className="focus-hero-caption">
          <span>
            {c("One stock. Every perspective.", "一只股票，连接多重视角。")}
          </span>
          <span>
            {c(
              "The context comes first. No prompt required.",
              "先看背景，不必先提问。",
            )}
          </span>
        </p>
      </div>
    </section>
  );
}
