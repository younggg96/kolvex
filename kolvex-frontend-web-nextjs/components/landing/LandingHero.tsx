"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { LandingParallax } from "./LandingScrollEffects";
import LandingStockBrief from "./LandingStockBrief";

export default function LandingHero() {
  const c = useCopy();
  return <section className="landing-hero" aria-labelledby="landing-title">
    <div className="landing-width">
      <LandingParallax className="simple-intro" distance={-28} hero>
        <h1 id="landing-title">{c("Your stocks.", "你关注的股票，")}<span>{c("In perspective.", "一眼看懂。")}</span></h1>
        <p>{c("News, market voices and AI research. In one place.", "新闻、博主观点、AI 研究，一处看清。")}</p>
        <Button asChild size="lg" className="landing-primary"><Link href="/auth">{c("Get started", "开始使用")}<ArrowUpRight size={18} aria-hidden /></Link></Button>
      </LandingParallax>
      <div id="product" className="simple-product">
        <LandingParallax distance={48} hero><LandingStockBrief /></LandingParallax>
      </div>
    </div>
  </section>;
}
