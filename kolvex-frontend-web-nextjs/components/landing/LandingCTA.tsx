"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export default function LandingCTA() {
  const { locale } = useTranslation();
  return <section className="bg-card py-12 md:py-16"><div className="landing-width flex flex-col justify-between gap-6 md:flex-row md:items-center">
    <h2 className="max-w-xl text-2xl font-bold">{locale === "zh" ? "从下一次投资研究开始。" : "Make room for better investment research."}</h2>
    <Button asChild size="lg"><Link href="/auth">{locale === "zh" ? "打开 Kolvex" : "Open Kolvex"}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
  </div></section>;
}
