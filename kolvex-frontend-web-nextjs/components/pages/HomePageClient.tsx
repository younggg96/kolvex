"use client";

import React, { useEffect } from "react";
import BaseLayout from "@/components/layout/BaseLayout";
import LandingHero from "@/components/landing/LandingHero";
import LandingStockTicker from "@/components/landing/LandingStockTicker";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingCTA from "@/components/landing/LandingCTA";

export default function HomePageClient() {
  // Smooth scroll implementation for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.hash && anchor.origin === window.location.origin) {
        e.preventDefault();
        const element = document.querySelector(anchor.hash);
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  return (
    <BaseLayout>
      <div className="flex flex-col w-full">
        {/* Hero Section - Main attention grabber */}
        <LandingHero />

        {/* Stock Ticker - Social proof & real-time data */}
        <LandingStockTicker />

        {/* How It Works - Reduce friction */}
        <LandingHowItWorks />

        {/* CTA Section - Convert visitors */}
        <LandingCTA />
      </div>
    </BaseLayout>
  );
}
