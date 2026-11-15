"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { landingNavigation } from "./landingNavigation";
export default function LandingIntelligence() {
  const c = useCopy();
  return (
    <section
      id="features"
      className="simple-features mx-auto grid w-[min(920px,calc(100%-96px))] scroll-mt-11 grid-cols-3 gap-4 pb-8 pt-6 max-[1001px]:w-[calc(100%-48px)] max-[641px]:w-[calc(100%-40px)] max-[641px]:grid-cols-1 max-[641px]:gap-2.5 max-[641px]:pb-6 max-[641px]:pt-3"
      aria-label={c("Explore Kolvex", "探索 Kolvex")}
    >
      {landingNavigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group block min-h-11 rounded-[1.25rem] px-5 pb-5 pt-[1.125rem] bg-[var(--landing-glass-fill)] shadow-[var(--glass-drop),var(--glass-edge)] backdrop-blur-[24px] hover:bg-[var(--landing-glass-fill-hover)] max-[641px]:px-[1.125rem] max-[641px]:py-4 motion-safe:[transition:background-color_180ms_var(--spring),transform_220ms_var(--spring)] motion-safe:hover:-translate-y-0.5"
        >
          <h2 className="flex items-center justify-between gap-3.5 text-base font-medium tracking-[-.025em] group-hover:text-[rgb(var(--primary-hover))] dark:group-hover:text-positive">
            {c(item.label[0], item.label[1])}
            <ArrowUpRight
              size="1rem"
              aria-hidden
              className="group-hover:-translate-y-[3px] group-hover:translate-x-[3px] motion-safe:[transition:transform_200ms_var(--spring)]"
            />
          </h2>
          <p className="mt-1.5 text-xs leading-[1.7] text-foreground/[.72]">
            {c(item.description[0], item.description[1])}
          </p>
        </Link>
      ))}
    </section>
  );
}
