"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Landmark,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const STEPS = [
  { icon: Landmark, detailsCount: 3 },
  { icon: RefreshCw, detailsCount: 3 },
  { icon: ShieldAlert, detailsCount: 3 },
  { icon: BrainCircuit, detailsCount: 3 },
];

export default function LandingHowItWorks() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.12 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="relative overflow-hidden bg-muted/30 py-16 md:py-24"
    >
      <div className="container relative z-10 mx-auto px-4">
        <div
          className={`mx-auto mb-10 max-w-3xl text-center transition-all duration-700 md:mb-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t("landing.howItWorks.badge")}
          </div>
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {t("landing.howItWorks.title")}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("landing.howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === index;

            return (
              <button
                key={index}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`relative h-full rounded-lg border p-5 text-left transition-all duration-500 md:p-6 ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/25"
                } ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${index * 80}ms` }}
                aria-pressed={isActive}
              >
                <span
                  className={`absolute right-5 top-5 text-sm font-semibold ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  0{index + 1}
                </span>
                <span
                  className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon size={22} />
                </span>
                <h3 className="mb-2 text-lg font-bold text-foreground">
                  {t(`landing.howItWorks.steps.${index}.title`)}
                </h3>
                <p className="min-h-[60px] text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.howItWorks.steps.${index}.description`)}
                </p>
                <div
                  className={`mt-4 space-y-2 overflow-hidden transition-all duration-300 ${
                    isActive ? "max-h-36 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {Array.from({ length: step.detailsCount }).map((_, detailIndex) => (
                    <span
                      key={detailIndex}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle2
                        size={14}
                        className="flex-shrink-0 text-primary"
                      />
                      {t(
                        `landing.howItWorks.steps.${index}.details.${detailIndex}`
                      )}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
