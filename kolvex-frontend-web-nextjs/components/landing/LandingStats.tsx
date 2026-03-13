"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "@/lib/i18n";

interface StatItem {
  labelKey: string;
  value: number;
  suffix: string;
  prefix?: string;
  descriptionKey: string;
}

const STATS: StatItem[] = [
  {
    labelKey: "landing.stats.kolsTracked",
    value: 2500,
    suffix: "+",
    descriptionKey: "landing.stats.kolsTrackedDesc",
  },
  {
    labelKey: "landing.stats.aiSignals",
    value: 50000,
    suffix: "+",
    descriptionKey: "landing.stats.aiSignalsDesc",
  },
  {
    labelKey: "landing.stats.accuracy",
    value: 94,
    suffix: "%",
    descriptionKey: "landing.stats.accuracyDesc",
  },
  {
    labelKey: "landing.stats.dataSources",
    value: 15,
    suffix: "+",
    descriptionKey: "landing.stats.dataSourcesDesc",
  },
];

function useCountUp(end: number, duration: number = 2000, start: number = 0) {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * (end - start) + start));

      if (progress < 1) window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  }, [isVisible, end, duration, start]);

  return { count, ref, isVisible };
}

function StatCard({ stat, index }: { stat: StatItem; index: number }) {
  const { t } = useTranslation();
  const { count, ref, isVisible } = useCountUp(stat.value);

  const formatNumber = (num: number) => {
    return num >= 1000 ? num.toLocaleString() : num.toString();
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-600 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{
        transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* Value — large, prominent, tabular nums for alignment */}
      <div className="mb-1">
        <span className="text-3xl md:text-4xl font-extrabold text-foreground tabular-nums">
          {stat.prefix}
          {formatNumber(count)}
          <span className="text-primary">{stat.suffix}</span>
        </span>
      </div>

      {/* Label */}
      <h3 className="text-sm font-semibold text-foreground mb-0.5">
        {t(stat.labelKey)}
      </h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t(stat.descriptionKey)}
      </p>
    </div>
  );
}

export default function LandingStats() {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24 relative border-y border-border">
      <div className="container px-4 mx-auto">
        {/* Section header */}
        <div className="max-w-2xl mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
            {t("landing.stats.title")}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {t("landing.stats.subtitle")}
          </p>
        </div>

        {/* Stats — clean horizontal layout, no cards wrapping */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {STATS.map((stat, index) => (
            <StatCard key={index} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
