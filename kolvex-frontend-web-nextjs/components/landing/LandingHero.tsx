"use client";

import React from "react";
import TypewriterText from "@/components/common/TypewriterText";
import EmailSignup from "@/components/user/EmailSignup";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingHero() {
  return (
    <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      <div className="container px-4 mx-auto relative z-10">
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

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/4 right-0 -translate-x-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Abstract Stock Pattern */}
      <div className="absolute bottom-0 left-0 right-0 h-64 -z-10 opacity-20 dark:opacity-10 overflow-hidden pointer-events-none">
        <svg
          className="w-full h-full"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0,150 L50,140 L100,160 L150,130 L200,145 L250,100 L300,120 L350,80 L400,110 L450,70 L500,90 L550,50 L600,85 L650,40 L700,75 L750,30 L800,60 L850,20 L900,55 L950,15 L1000,45 L1050,10 L1100,40 L1150,5 L1200,35"
            fill="none"
            stroke="#00C805"
            strokeWidth="3"
            strokeDasharray="1200"
            strokeDashoffset="1200"
            className="animate-dash"
          />
        </svg>
      </div>
    </section>
  );
}
