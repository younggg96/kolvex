"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Users, BarChart3, Bell, Shield, LineChart, Brain } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Feature {
  id: string;
  translationKey: string;
  icon: React.ElementType;
  accentColor: string;
}

const FEATURES: Feature[] = [
  {
    id: "kol-tracking",
    translationKey: "kolTracking",
    icon: Users,
    accentColor: "oklch(55% 0.18 250)",
  },
  {
    id: "ai-analysis",
    translationKey: "aiAnalysis",
    icon: Brain,
    accentColor: "oklch(55% 0.18 145)",
  },
  {
    id: "alerts",
    translationKey: "alerts",
    icon: Bell,
    accentColor: "oklch(65% 0.16 75)",
  },
  {
    id: "sentiment",
    translationKey: "sentiment",
    icon: BarChart3,
    accentColor: "oklch(55% 0.18 290)",
  },
  {
    id: "portfolio",
    translationKey: "portfolio",
    icon: LineChart,
    accentColor: "oklch(60% 0.16 165)",
  },
  {
    id: "filtering",
    translationKey: "filtering",
    icon: Shield,
    accentColor: "oklch(55% 0.18 25)",
  },
];

function FeatureCard({
  feature,
  index,
  isVisible,
}: {
  feature: Feature;
  index: number;
  isVisible: boolean;
}) {
  const { t } = useTranslation();
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setIsAnimated(true), index * 80);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`group relative rounded-2xl border border-border bg-card p-5 md:p-7 transition-all duration-500 hover:border-border/80 ${
        isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{
        transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
        transitionDelay: `${index * 60}ms`,
      }}
    >
      {/* Icon — small, functional, left-aligned (not large centered) */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105"
        style={{
          backgroundColor: `color-mix(in oklch, ${feature.accentColor} 12%, transparent)`,
        }}
      >
        <feature.icon
          className="w-4.5 h-4.5"
          style={{ color: feature.accentColor }}
        />
      </div>

      {/* Title */}
      <h3 className="text-base md:text-lg font-bold text-foreground mb-2 leading-tight">
        {t(`landing.features.${feature.translationKey}.title`)}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t(`landing.features.${feature.translationKey}.description`)}
      </p>
    </div>
  );
}

export default function LandingFeatures() {
  const [isVisible, setIsVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === headerRef.current) setHeaderVisible(true);
            else if (entry.target === sectionRef.current) setIsVisible(true);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (headerRef.current) observer.observe(headerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="py-20 md:py-28 lg:py-36 relative"
    >
      <div className="container px-4 mx-auto">
        {/* Section Header — left-aligned for editorial feel */}
        <div
          ref={headerRef}
          className="max-w-2xl mb-12 md:mb-16"
        >
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight leading-[1.15] transition-all duration-700 ${
              headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
          >
            {t("landing.features.title")}{" "}
            <span className="text-primary">{t("landing.features.titleHighlight")}</span>
          </h2>

          <p
            className={`text-base md:text-lg text-muted-foreground leading-relaxed transition-all duration-700 ${
              headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "100ms",
            }}
          >
            {t("landing.features.subtitle")}
          </p>
        </div>

        {/* Feature Grid — varied layout for visual interest */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
