"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { landingNavigation } from "./landingNavigation";
export default function LandingIntelligence() {
  const c = useCopy();
  return <section id="features" className="landing-width simple-features" aria-label={c("Explore Kolvex", "探索 Kolvex")}>
    {landingNavigation.map(item => <Link key={item.href} href={item.href}><h2>{c(item.label[0], item.label[1])}<ArrowUpRight size={22} aria-hidden /></h2><p>{c(item.description[0], item.description[1])}</p></Link>)}
  </section>;
}
