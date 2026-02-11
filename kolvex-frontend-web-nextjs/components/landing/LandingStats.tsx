"use client";

import React, { useEffect, useState, useRef } from "react";
import { TrendingUp, Users, Zap, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface StatItem {
  labelKey: string;
  value: number;
  suffix: string;
  prefix?: string;
  icon: React.ElementType;
  descriptionKey: string;
}

const STATS: StatItem[] = [
  {
    labelKey: "landing.stats.kolsTracked",
    value: 2500,
    suffix: "+",
    icon: Users,
    descriptionKey: "landing.stats.kolsTrackedDesc",
  },
  {
    labelKey: "landing.stats.aiSignals",
    value: 50000,
    suffix: "+",
    icon: Zap,
    descriptionKey: "landing.stats.aiSignalsDesc",
  },
  {
    labelKey: "landing.stats.accuracy",
    value: 94,
    suffix: "%",
    icon: TrendingUp,
    descriptionKey: "landing.stats.accuracyDesc",
  },
  {
    labelKey: "landing.stats.dataSources",
    value: 15,
    suffix: "+",
    icon: Globe,
    descriptionKey: "landing.stats.dataSourcesDesc",
  },
];

// Animated counter hook
function useCountUp(end: number, duration: number = 2000, start: number = 0) {
  const [count, setCount] = useState(start);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

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

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [isVisible, end, duration, start]);

  return { count, ref, isVisible };
}

function StatCard({ stat, index }: { stat: StatItem; index: number }) {
  const { t } = useTranslation();
  const { count, ref, isVisible } = useCountUp(stat.value);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return num.toLocaleString();
    }
    return num.toString();
  };

  return (
    <div
      ref={ref}
      className={`group relative p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-3xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200/50 dark:border-white/10 transition-all duration-500 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Icon */}
      <div className="relative mb-3 md:mb-6">
        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
          <stat.icon className="w-5 h-5 md:w-7 md:h-7 text-primary" />
        </div>
        {/* Decorative dot */}
        <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/30 group-hover:bg-primary group-hover:scale-125 transition-all duration-300" />
      </div>

      {/* Value */}
      <div className="relative mb-1 md:mb-2">
        <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tabular-nums">
          {stat.prefix}
          {formatNumber(count)}
          <span className="text-primary">{stat.suffix}</span>
        </span>
      </div>

      {/* Label */}
      <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-0.5 md:mb-1">
        {t(stat.labelKey)}
      </h3>

      {/* Description */}
      <p className="text-xs md:text-sm text-gray-500 dark:text-white/50">
        {t(stat.descriptionKey)}
      </p>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function LandingStats() {
  const { t } = useTranslation();
  return (
    <section className="py-12 md:py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[800px] h-[200px] md:h-[400px] bg-primary/10 rounded-full blur-[100px] md:blur-[150px] opacity-30" />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center my-8 md:my-16">
          <h2 className="text-xl sm:text-2xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 md:mb-4 tracking-tight">
            {t("landing.stats.title")}
          </h2>
          <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-2">
            {t("landing.stats.subtitle")}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {STATS.map((stat, index) => (
            <StatCard key={index} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
