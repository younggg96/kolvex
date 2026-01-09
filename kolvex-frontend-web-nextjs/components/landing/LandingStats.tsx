"use client";

import React, { useEffect, useState, useRef } from "react";
import { TrendingUp, Users, Zap, Globe } from "lucide-react";

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
  icon: React.ElementType;
  description: string;
}

const STATS: StatItem[] = [
  {
    label: "KOLs Tracked",
    value: 2500,
    suffix: "+",
    icon: Users,
    description: "Influential voices monitored",
  },
  {
    label: "AI Signals Daily",
    value: 50000,
    suffix: "+",
    icon: Zap,
    description: "Real-time market insights",
  },
  {
    label: "Accuracy Rate",
    value: 94,
    suffix: "%",
    icon: TrendingUp,
    description: "Sentiment prediction accuracy",
  },
  {
    label: "Data Sources",
    value: 15,
    suffix: "+",
    icon: Globe,
    description: "Platforms & exchanges",
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
      className={`group relative p-8 rounded-3xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200/50 dark:border-white/10 transition-all duration-500 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
          <stat.icon className="w-7 h-7 text-primary" />
        </div>
        {/* Decorative dot */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/30 group-hover:bg-primary group-hover:scale-125 transition-all duration-300" />
      </div>

      {/* Value */}
      <div className="relative mb-2">
        <span className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white tabular-nums">
          {stat.prefix}
          {formatNumber(count)}
          <span className="text-primary">{stat.suffix}</span>
        </span>
      </div>

      {/* Label */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
        {stat.label}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-white/50">
        {stat.description}
      </p>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export default function LandingStats() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[150px] opacity-30" />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center my-16">
          <h2 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
            Trusted by <span className="text-primary">thousands</span> of
            investors
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Our platform processes millions of data points daily to deliver
            actionable insights.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat, index) => (
            <StatCard key={index} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
