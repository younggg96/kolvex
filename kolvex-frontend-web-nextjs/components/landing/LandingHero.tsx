"use client";

import React, { useEffect, useRef, useState } from "react";
import TypewriterText from "@/components/common/TypewriterText";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Zap,
  Users,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

function TrustBadges() {
  const { t } = useTranslation();
  const badges = [
    { icon: Shield, label: t("landing.hero.trustBadges.security") },
    { icon: Zap, label: t("landing.hero.trustBadges.realTime") },
    { icon: Users, label: t("landing.hero.trustBadges.investors") },
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-10 md:mt-14">
      {badges.map((badge, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <badge.icon className="w-4 h-4 text-primary" />
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function LandingHero() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[90vh] flex items-center overflow-hidden pt-20 pb-16 md:pt-24 md:pb-24"
    >
      <div className="container px-4 mx-auto relative z-10">
        <div className="max-w-4xl">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-semibold mb-8 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            {t("landing.hero.badge")}
          </div>

          {/* Headline — left-aligned, no gradient text */}
          <h1
            className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "80ms",
            }}
          >
            <span className="block text-foreground">
              {t("landing.hero.headline")}
            </span>
            <span className="block text-primary mt-1">
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
          </h1>

          {/* Subheadline */}
          <p
            className={`text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-10 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "160ms",
            }}
          >
            {t("landing.hero.subheadline")}
          </p>

          {/* CTA */}
          <div
            className={`flex flex-col sm:flex-row gap-3 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "240ms",
            }}
          >
            <Link href="/auth">
              <Button
                size="lg"
                className="font-semibold group"
              >
                {t("landing.hero.startFreeTrial")}
                <ArrowRight
                  size={16}
                  className="ml-2 group-hover:translate-x-0.5 transition-transform duration-200"
                />
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "360ms",
            }}
          >
            <TrustBadges />
          </div>
        </div>
      </div>

      {/* Subtle gradient — not neon, warm tinted */}
      <div
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 70% 40%, oklch(55% 0.15 145 / 0.06), transparent 70%)",
        }}
      />
    </section>
  );
}
