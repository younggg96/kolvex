"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function LandingCTA() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-28 lg:py-36 relative"
    >
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground mb-4 md:mb-6 tracking-tight leading-[1.15] transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "100ms",
            }}
          >
            {t("landing.cta.title")}
            <br />
            <span className="text-primary">{t("landing.cta.titleHighlight")}</span>
          </h2>

          {/* Description */}
          <p
            className={`text-base md:text-lg text-muted-foreground mb-8 md:mb-12 max-w-xl mx-auto leading-relaxed transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "200ms",
            }}
          >
            {t("landing.cta.subtitle")}
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row gap-3 justify-center items-center mb-10 md:mb-14 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "300ms",
            }}
          >
            <Link href="/auth">
              <Button size="lg" className="font-semibold group">
                {t("landing.cta.getStarted")}
                <ArrowRight
                  size={16}
                  className="ml-2 group-hover:translate-x-0.5 transition-transform duration-200"
                />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                {t("landing.cta.contactUs")}
              </Button>
            </Link>
          </div>

          {/* Trust indicators — clean, no decoration */}
          <div
            className={`flex flex-wrap justify-center gap-6 text-muted-foreground text-sm transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              transitionDelay: "400ms",
            }}
          >
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-primary" />
              <span>{t("landing.cta.trust.security")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-primary" />
              <span>{t("landing.cta.trust.setup")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-primary" />
              <span>{t("landing.cta.trust.cancel")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
