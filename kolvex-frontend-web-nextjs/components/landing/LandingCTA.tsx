"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";

export default function LandingCTA() {
  const c = useCopy();
  return (
    <section className="landing-closing">
      <div className="landing-width landing-closing-panel">
        <h2>
          {c("Ready when you are.", "从你的自选股开始。")}
        </h2>
        <div>
          <Button asChild size="lg" className="landing-primary">
            <Link href="/auth">
              {c("Start using Kolvex", "开始使用 Kolvex")}
              <ArrowUpRight size={17} aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
      <p className="landing-width landing-disclaimer">
        {c(
          "Kolvex provides information and research, not investment advice. Market data may be delayed. Investing involves risk.",
          "Kolvex 提供信息与研究，不构成投资建议。市场数据可能存在延迟，投资涉及风险。",
        )}
      </p>
    </section>
  );
}
