"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Users, BarChart3, Bell, Shield, LineChart, Brain } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Feature {
  id: string;
  translationKey: string;
  icon: React.ElementType;
  accentColor: string;
  lightAccentBg: string;
  stats?: { labelKey: string; value: string }[];
}

const FEATURES: Feature[] = [
  {
    id: "kol-tracking",
    translationKey: "kolTracking",
    icon: Users,
    accentColor: "#3B82F6",
    lightAccentBg: "bg-blue-50 dark:bg-blue-500/10",
    stats: [
      { labelKey: "kolsTracked", value: "2,500+" },
      { labelKey: "platforms", value: "15+" },
      { labelKey: "updatesDay", value: "50K+" },
    ],
  },
  {
    id: "ai-analysis",
    translationKey: "aiAnalysis",
    icon: Brain,
    accentColor: "#00C805",
    lightAccentBg: "bg-emerald-50 dark:bg-primary/10",
    stats: [
      { labelKey: "accuracy", value: "94%" },
      { labelKey: "models", value: "12+" },
      { labelKey: "signalsDay", value: "10K+" },
    ],
  },
  {
    id: "alerts",
    translationKey: "alerts",
    icon: Bell,
    accentColor: "#F59E0B",
    lightAccentBg: "bg-amber-50 dark:bg-amber-500/10",
    stats: [
      { labelKey: "latency", value: "<1s" },
      { labelKey: "channels", value: "5+" },
      { labelKey: "customRules", value: "∞" },
    ],
  },
  {
    id: "sentiment",
    translationKey: "sentiment",
    icon: BarChart3,
    accentColor: "#8B5CF6",
    lightAccentBg: "bg-violet-50 dark:bg-violet-500/10",
    stats: [
      { labelKey: "stocks", value: "10K+" },
      { labelKey: "sources", value: "100+" },
      { labelKey: "refresh", value: "Real-time" },
    ],
  },
  {
    id: "portfolio",
    translationKey: "portfolio",
    icon: LineChart,
    accentColor: "#10B981",
    lightAccentBg: "bg-teal-50 dark:bg-teal-500/10",
    stats: [
      { labelKey: "brokers", value: "50+" },
      { labelKey: "security", value: "Bank-grade" },
      { labelKey: "sync", value: "Auto" },
    ],
  },
  {
    id: "filtering",
    translationKey: "filtering",
    icon: Shield,
    accentColor: "#EF4444",
    lightAccentBg: "bg-red-50 dark:bg-red-500/10",
    stats: [
      { labelKey: "botDetection", value: "99.9%" },
      { labelKey: "spamBlocked", value: "10M+" },
      { labelKey: "falsePositives", value: "<0.1%" },
    ],
  },
];

// Feature Card Component with animation
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
      // Stagger animation based on index
      const timer = setTimeout(() => {
        setIsAnimated(true);
      }, index * 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`group relative rounded-3xl transition-all duration-700 hover:-translate-y-1 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      style={{
        transitionDelay: `${index * 50}ms`,
      }}
    >
      {/* Card Background - Light & Dark modes */}
      <div className="absolute inset-0 bg-grid opacity-50 rounded-3xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 group-hover:border-gray-300 dark:group-hover:border-white/20 shadow-sm dark:shadow-none group-hover:shadow-lg dark:group-hover:shadow-none transition-all duration-500" />

      {/* Accent Glow - Only visible on hover */}
      <div
        className="absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${feature.accentColor}15, transparent 70%)`,
        }}
      />

      {/* Corner Accent */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{ background: feature.accentColor }}
      />

      {/* Content */}
      <div className="relative h-full p-4 md:p-6 lg:p-8 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 md:mb-5">
          {/* Icon with pulse animation on load */}
          <div
            className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${feature.lightAccentBg
              } ${isAnimated ? "scale-100" : "scale-75"}`}
            style={{
              transitionDelay: `${index * 50 + 200}ms`,
            }}
          >
            <feature.icon
              className={`w-5 h-5 md:w-7 md:h-7 transition-all duration-500 ${isAnimated ? "opacity-100" : "opacity-0"
                }`}
              style={{
                color: feature.accentColor,
                transitionDelay: `${index * 50 + 300}ms`,
              }}
            />
          </div>

          {/* Feature number with fade */}
          <span
            className={`text-2xl md:text-4xl font-black text-black dark:text-white/[0.05] transition-all duration-500 group-hover:text-gray-200 dark:group-hover:text-white/[0.08] ${isAnimated ? "opacity-100" : "opacity-0"
              }`}
            style={{ transitionDelay: `${index * 50 + 100}ms` }}
          >
            0{index + 1}
          </span>
        </div>

        {/* Title with slide-up */}
        <h3
          className={`text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3 transition-all duration-500 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          style={{ transitionDelay: `${index * 50 + 150}ms` }}
        >
          {t(`landing.features.${feature.translationKey}.title`)}
        </h3>

        {/* Description with slide-up */}
        <p
          className={`text-gray-600 dark:text-white/60 text-xs md:text-sm lg:text-base leading-relaxed mb-4 md:mb-6 flex-grow transition-all duration-500 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          style={{ transitionDelay: `${index * 50 + 200}ms` }}
        >
          {t(`landing.features.${feature.translationKey}.description`)}
        </p>

        {/* Stats Row with staggered animation */}
        {feature.stats && (
          <div className="grid grid-cols-3 gap-1.5 md:gap-2 mt-auto">
            {feature.stats.map((stat, i) => (
              <div
                key={i}
                className={`text-center p-2 md:p-3 rounded-lg md:rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 group-hover:border-gray-200 dark:group-hover:border-white/10 transition-all duration-500 ${isAnimated
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
                  }`}
                style={{ transitionDelay: `${index * 50 + 250 + i * 50}ms` }}
              >
                <div
                  className="text-sm md:text-base font-bold mb-0.5"
                  style={{ color: feature.accentColor }}
                >
                  {stat.value}
                </div>
                <div className="text-gray-500 dark:text-white/40 text-[9px] md:text-[10px] lg:text-xs tracking-wider">
                  {t(`landing.features.${feature.translationKey}.stats.${stat.labelKey}`)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingFeatures() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === headerRef.current) {
              setHeaderVisible(true);
            } else if (entry.target === sectionRef.current) {
              setIsVisible(true);
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (headerRef.current) observer.observe(headerRef.current);

    return () => observer.disconnect();
  }, []);

  // Mouse tracking for spotlight effect
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (section) {
      section.addEventListener("mousemove", handleMouseMove);
      return () => section.removeEventListener("mousemove", handleMouseMove);
    }
  }, [handleMouseMove]);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="py-16 md:py-24 lg:py-32 relative overflow-hidden"
    >
      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section Header with animation */}
        <div
          ref={headerRef}
          className="text-center max-w-4xl mx-auto mb-10 md:mb-16 lg:mb-20"
        >
          {/* Headline */}
          <h2
            className={`text-xl sm:text-2xl md:text-4xl font-black text-gray-900 dark:text-white mb-4 md:mb-6 tracking-tight leading-[1.15] transition-all duration-700 ${headerVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
              }`}
          >
            {t("landing.features.title")}
            <br />
            <span className="relative inline-block mt-1">
              <span className="text-primary">{t("landing.features.titleHighlight")}</span>
              {/* Underline decoration with draw animation */}
              <svg
                className={`absolute -bottom-1 left-0 w-full h-2 transition-opacity duration-500 ${headerVisible ? "opacity-100" : "opacity-0"
                  }`}
                viewBox="0 0 300 8"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 5C50 2 100 2 150 4C200 6 250 3 298 5"
                  stroke="url(#underline-gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={headerVisible ? "animate-draw-line" : ""}
                  style={{
                    strokeDasharray: 300,
                    strokeDashoffset: headerVisible ? 0 : 300,
                    transition: "stroke-dashoffset 1s ease-out 0.3s",
                  }}
                />
                <defs>
                  <linearGradient
                    id="underline-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#00C805" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#00C805" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#00C805" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h2>

          {/* Description */}
          <p
            className={`text-sm md:text-base lg:text-lg text-gray-600 dark:text-white/50 leading-relaxed max-w-2xl mx-auto transition-all duration-700 delay-200 px-2 ${headerVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
              }`}
          >
            {t("landing.features.subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
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
