"use client";

import React from "react";
import {
  Users,
  BarChart3,
  Bell,
  Zap,
  Shield,
  Cpu,
  LineChart,
  Target,
} from "lucide-react";

const FEATURES = [
  {
    title: "KOL Tracking",
    description:
      "Monitor top financial influencers across Twitter, Reddit, and more. See what the smart money is talking about in real-time.",
    icon: Users,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "AI Analysis",
    description:
      "Our proprietary AI models analyze thousands of posts to extract sentiment, identifying bullish and bearish signals before they trend.",
    icon: Cpu,
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Sentiment Scoring",
    description:
      "Real-time retail sentiment scores for thousands of stocks. Compare social buzz with price action for better decision making.",
    icon: BarChart3,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    title: "Instant Alerts",
    description:
      "Get notified the moment a tracked KOL hits a mention or when sentiment hits critical levels. Never miss a move.",
    icon: Bell,
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    title: "Visual Portfolio",
    description:
      "Connect your brokerage via SnapTrade to see your actual positions overlaid with social intelligence and AI insights.",
    icon: LineChart,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    title: "Smart Filtering",
    description:
      "Filter out the noise. Our system automatically detects bots and spam, focusing only on high-signal content from verified sources.",
    icon: Shield,
    color: "bg-red-500/10 text-red-500",
  },
];

export default function LandingFeatures() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Section Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/10 blur-[120px] pointer-events-none opacity-50" />

      <div className="container px-4 mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20 animate-fade-in-up">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-foreground tracking-tight">
            Everything you need to{" "}
            <span className="text-primary relative inline-block">
              master the markets
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-primary/30 rounded-full blur-[2px]" />
            </span>
          </h2>
          <p className="text-lg text-foreground/70 leading-relaxed">
            Kolvex provides a comprehensive suite of tools designed for the
            modern investor who wants to stay ahead of the social media curve.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, idx) => (
            <div
              key={idx}
              className="group p-8 rounded-2xl bg-white dark:bg-transparent border border-border-light dark:border-primary/20 hover:border-primary/40 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Corner Accents - Financial Terminal Style */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Data Signal Background */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

              {/* Feature Number */}
              <div className="absolute top-4 right-6 font-mono text-[10px] text-primary/40 group-hover:text-primary transition-colors">
                0{idx + 1}
              </div>

              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-500 ${feature.color} group-hover:shadow-[0_0_20px_rgba(0,200,5,0.2)]`}
              >
                <feature.icon size={24} className="group-hover:animate-pulse" />
              </div>

              <h3 className="text-xl font-bold mb-4 text-foreground tracking-tight flex items-center gap-2 group-hover:text-primary transition-colors">
                {feature.title}
                <div className="w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 animate-pulse" />
              </h3>
              <p className="text-sm text-foreground/60 leading-relaxed transition-colors group-hover:text-foreground/80">
                {feature.description}
              </p>

              {/* Tactical Underline */}
              <div className="mt-6 w-full h-px bg-gradient-to-r from-primary/20 via-primary/5 to-transparent origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
