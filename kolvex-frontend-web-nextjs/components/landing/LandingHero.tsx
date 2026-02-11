"use client";

import React, { useEffect, useRef, useState } from "react";
import TypewriterText from "@/components/common/TypewriterText";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Play,
  TrendingUp,
  BarChart3,
  Users,
  Zap,
  Shield,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Floating orb component for background
const FloatingOrb = ({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) => (
  <div
    className={`absolute rounded-full blur-3xl opacity-30 animate-float ${className}`}
    style={{ animationDelay: `${delay}s` }}
  />
);

// Animated grid lines
const GridLines = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg className="absolute w-full h-full opacity-[0.03] dark:opacity-[0.05]">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
);

// Floating particles
const Particles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: Math.random() * 10 + 15,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/40 animate-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: "-10%",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// Dashboard preview mockup
const DashboardPreview = () => {
  const { t } = useTranslation();
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-8 md:mt-16 perspective-1000 px-2 sm:px-0">
      {/* Main dashboard frame */}
      <div className="relative transform rotateX-3 transition-transform duration-700 hover:rotateX-0">
        {/* Glow effect behind */}
        <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl opacity-20" />

        {/* Dashboard container */}
        <div className="relative backdrop-blur-xl rounded-xl md:rounded-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden shadow-xl md:shadow-2xl shadow-primary/10">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-3 bg-gray-100/80 dark:bg-black/40 border-b border-gray-200/50 dark:border-white/5">
            <div className="flex gap-1 md:gap-1.5">
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-400" />
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-2 md:px-4 py-0.5 md:py-1 bg-white/50 dark:bg-white/5 rounded-md md:rounded-lg text-[10px] md:text-xs text-gray-500 dark:text-white/40 font-mono">
                kolvex.app/dashboard
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-3 md:p-6 space-y-3 md:space-y-4">
            {/* Top metrics row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              {[
                {
                  label: t("landing.hero.preview.portfolioValue"),
                  value: "$1,274,320",
                  change: "+12.4%",
                  icon: TrendingUp,
                },
                {
                  label: t("landing.hero.preview.kolsTracked"),
                  value: "247",
                  change: "+18",
                  icon: Users,
                },
                {
                  label: t("landing.hero.preview.aiSignals"),
                  value: "1,842",
                  change: "Active",
                  icon: Zap,
                },
                {
                  label: t("landing.hero.preview.sentimentScore"),
                  value: "78.5",
                  change: "Bullish",
                  icon: BarChart3,
                },
              ].map((metric, i) => (
                <div
                  key={i}
                  className="p-2 md:p-4 bg-white/50 dark:bg-white/5 rounded-lg md:rounded-xl border border-gray-200/50 dark:border-white/5 animate-fade-in"
                  style={{ animationDelay: `${0.1 * i + 0.5}s` }}
                >
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <metric.icon
                      size={12}
                      className="text-primary opacity-70 md:w-4 md:h-4"
                    />
                    <span className="text-[10px] md:text-xs text-primary font-semibold">
                      {metric.change}
                    </span>
                  </div>
                  <div className="text-sm md:text-lg font-bold text-gray-900 dark:text-white truncate">
                    {metric.value}
                  </div>
                  <div className="text-[10px] md:text-xs text-gray-500 dark:text-white/50 truncate">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="h-20 md:h-32 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg md:rounded-xl border border-primary/10 flex items-end justify-around px-2 md:px-4 pb-2 md:pb-4">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
                <div
                  key={i}
                  className="w-2 md:w-4 bg-gradient-to-t from-primary/60 to-primary rounded-t animate-grow"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${0.05 * i + 0.8}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Reflection effect */}
        <div className="absolute -bottom-12 md:-bottom-20 left-0 right-0 h-12 md:h-20 bg-gradient-to-b from-white/20 dark:from-white/5 to-transparent blur-sm transform scale-y-[-1] opacity-30" />
      </div>
    </div>
  );
};

// Trust badges
const TrustBadges = () => {
  const { t } = useTranslation();
  const badges = [
    { icon: Shield, label: t("landing.hero.trustBadges.security") },
    { icon: Zap, label: t("landing.hero.trustBadges.realTime") },
    { icon: Users, label: t("landing.hero.trustBadges.investors") },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-6 mt-6 md:mt-12 animate-fade-in-up">
      {badges.map((badge, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-full bg-white/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 text-xs md:text-sm text-gray-600 dark:text-white/60"
          style={{ animationDelay: `${0.1 * i + 0.6}s` }}
        >
          <badge.icon size={12} className="text-primary md:w-3.5 md:h-3.5" />
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function LandingHero() {
  const { t } = useTranslation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16 md:pt-20 pb-16 md:pb-32"
    >
      {/* Floating particles */}
      <Particles />

      {/* Content */}
      <div className="container px-4 mx-auto relative z-10">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] md:text-xs font-bold mb-4 md:mb-8 animate-fade-in backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-primary"></span>
            </span>
            {t("landing.hero.badge")}
          </div>

          {/* Main headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-7xl font-black tracking-tight mb-4 md:mb-8 min-h-[2.4em] md:min-h-[1.2em]">
            <span className="block bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent pb-1 md:pb-2">
              {t("landing.hero.headline")}
            </span>
            <span className="block relative">
              <span className="text-primary animate-gradient-x">
                <TypewriterText
                  phrases={[
                    "Social Intelligence",
                    "AI-Powered Analysis",
                    "Real-Time Signals",
                    "Smart Money Tracking",
                  ]}
                  typingSpeed={90}
                  deletingSpeed={35}
                  delayBetweenPhrases={2500}
                />
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-6 md:mb-12 max-w-3xl leading-relaxed animate-fade-in-up px-2">
            {t("landing.hero.subheadline")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-4 md:mb-8 animate-fade-in-up w-full sm:w-auto px-4 sm:px-0">
            <Link href="/auth" className="w-full sm:w-auto">
              <Button
                size="md"
                className="w-full sm:w-auto px-6 md:px-10 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl md:rounded-2xl shadow-xl shadow-primary/25 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30"
              >
                {t("landing.hero.startFreeTrial")}
                <ArrowRight
                  size={16}
                  className="ml-2 group-hover:translate-x-1 transition-transform md:w-[18px] md:h-[18px]"
                />
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <TrustBadges />
        </div>

        {/* Dashboard preview */}
        <DashboardPreview />
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-32 bg-gradient-to-t from-white dark:from-gray-950 to-transparent pointer-events-none" />
    </section>
  );
}
