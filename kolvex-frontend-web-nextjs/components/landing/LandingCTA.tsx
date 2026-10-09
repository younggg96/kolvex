"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { LandingReveal } from "./LandingMotion";

export default function LandingCTA() {
  const c = useCopy();
  return (
    <section className="landing-closing">
      <LandingReveal className="landing-width">
        <div className="landing-closing-panel">
          <div>
            <h2>
              {c(
                "See your stocks\nin a new light.",
                "换个视角，\n看你关注的股票。",
              )}
            </h2>
            <p>
              {c(
                "Your next research session starts here.",
                "下一次股票研究，从这里开始。",
              )}
            </p>
          </div>
          <Button asChild size="lg" className="landing-primary">
            <Link href="/auth">
              {c("Open Kolvex", "打开 Kolvex")}
              <ArrowUpRight className="ml-3 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </LandingReveal>
    </section>
  );
}
