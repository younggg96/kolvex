"use client";

import React from "react";
import TypewriterText from "@/components/common/TypewriterText";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="container px-4 mx-auto pb-24 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            KOLVEX AI IS NOW LIVE
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 text-gray-900 dark:text-white min-h-[1.2em]">
            <TypewriterText
              phrases={[
                "Track Social Media KOLs",
                "AI-Powered Analysis",
                "Monitor Retail Sentiment",
                "Follow the Smart Money",
              ]}
              typingSpeed={80}
              deletingSpeed={40}
              delayBetweenPhrases={2500}
            />
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-white/80 mb-10 max-w-2xl animate-fade-in-up">
            Kolvex combines AI intelligence with real-time social signals to
            give you an edge in the markets. Track influencers, analyze
            sentiment, and find hidden opportunities before they go viral.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-fade-in-up delay-200">
            <Link href="/auth">
              <Button
                size="lg"
                className="h-14 px-8 text-base font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20"
              >
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
