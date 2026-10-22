"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
export default function LandingIntelligence() {
  const c = useCopy();
  const links = [
    { href: "/creators", title: c("Follow the voices.", "追踪观点"), detail: c("With links to the source.", "观点可追溯，原文可查看。") },
    { href: "/research", title: c("Go deeper.", "深入研究"), detail: c("The thesis, evidence and risks.", "结论、依据、风险，一起看。") },
    { href: "/auth", title: c("Make it yours.", "关联持仓"), detail: c("Connect your portfolio with Plaid.", "通过 Plaid 连接投资组合。") },
  ];
  return <section id="features" className="landing-width simple-features" aria-label={c("Explore Kolvex", "探索 Kolvex")}>
    {links.map(item => <Link key={item.href} href={item.href}><h2>{item.title}<ArrowUpRight size={22} aria-hidden /></h2><p>{item.detail}</p></Link>)}
  </section>;
}
