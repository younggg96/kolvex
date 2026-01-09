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
        isActive ? "scale-105 z-10" : "hover:scale-102"
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
        className={`relative p-8 rounded-3xl border transition-all duration-500 ${
          isActive
            ? "bg-primary/10 border-primary/40 shadow-2xl shadow-primary/20"
            : "bg-white/60 dark:bg-white/[0.03] border-gray-200/50 dark:border-white/10"
        }`}
      >
        {/* Step number badge */}
        <div
          className={`absolute -top-4 left-8 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
            isActive
              ? "bg-primary text-white scale-110"
              : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/60"
          } ${isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {step.number}
        </div>

        {/* Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
            isActive
              ? "bg-primary text-white"
              : "bg-primary/10 text-primary group-hover:bg-primary/20"
          } ${isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          style={{ transitionDelay: `${index * 150 + 100}ms` }}
        >
          <step.icon size={28} />
        </div>

        {/* Title */}
        <h3
          className={`text-xl font-bold text-gray-900 dark:text-white mb-3 transition-all duration-500 ${
            isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${index * 150 + 150}ms` }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          className={`text-gray-600 dark:text-gray-400 mb-4 leading-relaxed transition-all duration-500 ${
            isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${index * 150 + 200}ms` }}
        >
          {step.description}
        </p>

        {/* Details (shown when active) */}
        <div
          className={`space-y-2 overflow-hidden transition-all duration-500 ${
            isActive ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {step.details.map((detail, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
            >
              <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
              <span>{detail}</span>
            </div>
          ))}
        </div>

        {/* Active indicator dot */}
        <div
          className={`absolute bottom-4 right-4 w-2 h-2 rounded-full transition-all duration-300 ${
            isActive
              ? "bg-primary scale-100 animate-pulse"
              : "bg-gray-300 dark:bg-white/20 scale-75"
          }`}
        />
      </div>
    </div>
  );
}

export default function LandingHowItWorks() {
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
      className="py-32 relative overflow-hidden bg-gradient-to-b from-transparent via-gray-50/50 dark:via-gray-900/30 to-transparent"
    >
      {/* Background decorations */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[150px] -translate-y-1/2 -translate-x-1/2" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-20">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6 transition-all duration-700 ${
              headerVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-4 scale-95"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            HOW IT WORKS
          </div>
          <h2
            className={`text-2xl md:text-4xl font-black text-gray-900 dark:text-white mb-6 tracking-tight transition-all duration-700 ${
              headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            Start in <span className="text-primary">4 simple steps</span>
          </h2>
          <p
            className={`text-lg text-gray-600 dark:text-gray-400 leading-relaxed transition-all duration-700 ${
              headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            From signup to your first AI-powered insight in under 2 minutes. No
            complex setup, no learning curve.
          </p>
        </div>

        {/* Progress indicator */}
        <div
          className={`flex justify-center gap-2 mb-12 transition-all duration-700 ${
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
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeStep
                  ? "w-8 bg-primary"
                  : "w-1.5 bg-gray-300 dark:bg-white/20 hover:bg-primary/50"
              }`}
            />
          ))}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
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
