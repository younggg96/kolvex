"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";

export default function LandingCTA() {
  const c = useCopy();
  return (
    <section className="bg-muted pb-6 pt-14 max-[641px]:pt-9">
      <div className="landing-width landing-closing-panel flex items-center justify-between gap-6 max-[641px]:flex-col max-[641px]:items-start">
        <h2 className="text-[length:clamp(1.75rem,3.5vw,2.75rem)] font-medium leading-[1.3] tracking-[-.03em]">
          {c("Ready when you are.", "从你的自选股开始。")}
        </h2>
        <div>
          <Button asChild size="lg" className="min-h-12 !gap-6 !px-[1.625rem] !text-sm">
            <Link href="/auth">
              {c("Start using Kolvex", "开始使用 Kolvex")}
              <ArrowUpRight size="1.0625rem" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      <p className="landing-width pt-10 text-[0.625rem] leading-[1.8] text-muted-foreground max-[641px]:pt-7">
        {c(
          "Kolvex provides information and research, not investment advice. Market data may be delayed. Investing involves risk.",
          "Kolvex 提供信息与研究，不构成投资建议。市场数据可能存在延迟，投资涉及风险。",
        )}
      </p>
    </section>
  );
}
