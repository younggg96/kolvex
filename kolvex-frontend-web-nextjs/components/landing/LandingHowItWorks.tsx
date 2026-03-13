"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  UserPlus,
  Target,
  Brain,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Create Your Account",
    description:
      "Sign up in seconds with email or social login. No credit card required.",
    icon: UserPlus,
    details: [
      "Free forever tier available",
      "Connect social accounts",
      "Set up in 30 seconds",
    ],
  },
  {
    number: 2,
    title: "Select Your KOLs",
    description:
      "Choose from 2,500+ influential investors and analysts to track.",
    icon: Target,
    details: [
      "Curated expert lists",
      "Custom watchlists",
      "Multi-platform coverage",
    ],
  },
  {
    number: 3,
    title: "Get AI Insights",
    description:
      "Our AI analyzes posts, extracts sentiment, and identifies signals.",
    icon: Brain,
    details: ["Real-time processing", "94% accuracy rate", "Actionable alerts"],
  },
  {
    number: 4,
    title: "Make Better Decisions",
    description:
      "Use social intelligence to time your entries and exits perfectly.",
    icon: TrendingUp,
    details: [
      "Data-driven trades",
      "Reduced emotional bias",
      "Consistent returns",
    ],
  },
];

function StepCard({
  step,
  index,
  isActive,
  onActivate,
  isVisible,
}: {
  step: Step;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  isVisible: boolean;
}) {
  const { t } = useTranslation();
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsAnimated(true);
      }, index * 150);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-700 ${
        isActive
          ? "scale-[1.02] md:scale-105 z-10"
          : "hover:scale-[1.01] md:hover:scale-102"
      } ${
        isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      onClick={onActivate}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {/* Connector line */}
      {index < STEPS.length - 1 && (
        <div
          className={`hidden lg:block absolute top-1/2 -right-12 w-20 h-0.5 -translate-y-1/2 px-4 transition-all duration-500 ${
            isAnimated ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
          }`}
          style={{
            transitionDelay: `${index * 150 + 300}ms`,
            transformOrigin: "left",
          }}
        >
          <div className="w-full h-full bg-gradient-to-r from-primary/30 to-primary/10" />
          <ArrowRight
            size={16}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-primary/40"
          />
        </div>
      )}

      {/* Card */}
      <div
        className={`relative p-4 md:p-6 lg:p-8 rounded-2xl border transition-all duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] ${
          isActive
            ? "bg-primary/5 border-primary/30"
            : "bg-card border-border"
        }`}
      >
        {/* Step number badge */}
        <div
          className={`absolute -top-3 md:-top-4 left-4 md:left-8 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          } ${isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {step.number}
        </div>

        {/* Icon */}
        <div
          className={`w-10 h-10 md:w-14 lg:w-16 md:h-14 lg:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-6 transition-all duration-500 ${
            isActive
              ? "bg-primary text-white"
              : "bg-primary/10 text-primary group-hover:bg-primary/20"
          } ${isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          style={{ transitionDelay: `${index * 150 + 100}ms` }}
        >
          <step.icon size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7" />
        </div>

        {/* Title */}
        <h3
          className={`text-base md:text-lg lg:text-xl font-bold text-foreground mb-1.5 md:mb-3 transition-all duration-500 ${
            isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${index * 150 + 150}ms` }}
        >
          {t(`landing.howItWorks.steps.${index}.title`)}
        </h3>

        {/* Description */}
        <p
          className={`text-xs md:text-sm lg:text-base text-muted-foreground mb-2 md:mb-4 leading-relaxed transition-all duration-500 ${
            isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {t(`landing.howItWorks.steps.${index}.description`)}
        </p>

        {/* Details (shown when active) */}
        <div
          className={`space-y-1.5 md:space-y-2 overflow-hidden transition-all duration-500 ${
            isActive ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {step.details.map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground"
            >
              <CheckCircle2
                size={12}
                className="text-primary flex-shrink-0 md:w-3.5 md:h-3.5"
              />
              <span>{t(`landing.howItWorks.steps.${index}.details.${i}`)}</span>
            </div>
          ))}
        </div>

        {/* Active indicator dot */}
        <div
          className={`absolute bottom-3 right-3 md:bottom-4 md:right-4 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] ${
            isActive
              ? "bg-primary scale-100"
              : "bg-muted-foreground/30 scale-75"
          }`}
        />
      </div>
    </div>
  );
}

export default function LandingHowItWorks() {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  // Auto-cycle through steps
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === headerRef.current) {
              setHeaderVisible(true);
            }
            if (entry.target === sectionRef.current) {
              setIsVisible(true);
            }
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (headerRef.current) observer.observe(headerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28 lg:py-36 relative overflow-hidden bg-muted/30"
    >

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div
          ref={headerRef}
          className="text-center max-w-3xl mx-auto mb-10 md:mb-16 lg:mb-20"
        >
          <div
            className={`inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold mb-4 md:mb-6 transition-all duration-700 ${
              headerVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-4 scale-95"
            }`}
          >
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary" />
            {t("landing.howItWorks.badge")}
          </div>
          <h2
            className={`text-xl sm:text-2xl md:text-4xl font-extrabold text-foreground mb-3 md:mb-6 tracking-tight transition-all duration-700 ${
              headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            {t("landing.howItWorks.title")}
          </h2>
          <p
            className={`text-sm md:text-lg text-muted-foreground leading-relaxed transition-all duration-700 px-2 ${
              headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {t("landing.howItWorks.subtitle")}
          </p>
        </div>

        {/* Progress indicator */}
        <div
          className={`flex justify-center gap-1.5 md:gap-2 mb-6 md:mb-12 transition-all duration-700 ${
            headerVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`h-1 md:h-1.5 rounded-full transition-all duration-300 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] ${
                i === activeStep
                  ? "w-6 md:w-8 bg-primary"
                  : "w-1 md:w-1.5 bg-muted-foreground/20 hover:bg-primary/40"
              }`}
            />
          ))}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 lg:gap-6">
          {STEPS.map((step, index) => (
            <StepCard
              key={index}
              step={step}
              index={index}
              isActive={index === activeStep}
              onActivate={() => setActiveStep(index)}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
