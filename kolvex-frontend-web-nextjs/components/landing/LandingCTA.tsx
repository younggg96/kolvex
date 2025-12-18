"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, Zap, Shield } from "lucide-react";

export default function LandingCTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 -z-10" />

      <div className="container px-4 mx-auto relative z-10">
        <div className="max-w-5xl mx-auto relative">
          {/* Floating decorative elements - Enhanced animations */}
          <div className="absolute -top-12 -left-12 w-28 h-28 border-2 border-primary/30 rounded-2xl animate-float-rotate hidden lg:block" />
          <div className="absolute -bottom-16 -right-16 w-36 h-36 border-2 border-primary/40 rounded-full animate-float-scale hidden lg:block" />
          <div className="absolute top-1/3 -left-20 w-20 h-20 bg-primary/15 rounded-xl animate-float-drift hidden lg:block" />
          <div className="absolute top-1/4 -right-14 w-16 h-16 border border-primary/20 rounded-lg animate-float-spin hidden lg:block" />
          <div className="absolute bottom-1/4 -left-10 w-12 h-12 bg-primary/10 rounded-full animate-pulse-scale hidden lg:block" />

          {/* Main CTA Card - Transparent with Green Accents */}
          <div className="p-10 md:p-16 rounded-[2.5rem] bg-card-light/50 dark:bg-card-dark/30 backdrop-blur-md text-center relative overflow-hidden shadow-2xl border border-primary/30 animate-fade-in-up">
            {/* Green accent glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-primary/30 blur-[100px] -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/15 blur-[120px] translate-y-1/2 translate-x-1/4" />
            <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/10 blur-[80px] -translate-x-1/2" />

            {/* Inner decorative patterns */}
            <div className="absolute inset-0 bg-grid opacity-10" />

            {/* Animated stock line */}
            <div className="absolute bottom-0 left-0 right-0 h-32 opacity-40 overflow-hidden">
              <svg
                className="w-full h-full"
                viewBox="0 0 1200 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,80 Q100,60 200,70 T400,50 T600,60 T800,30 T1000,40 T1200,20"
                  fill="none"
                  stroke="#00C805"
                  strokeWidth="2"
                  strokeDasharray="1200"
                  strokeDashoffset="1200"
                  className="animate-dash"
                />
              </svg>
            </div>

            <div className="relative z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold mb-8 animate-bounce-subtle">
                <Sparkles size={14} />
                JOIN 5,000+ SMART INVESTORS
              </div>

              {/* Headline with staggered animation */}
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
                <span className="block animate-slide-up text-foreground">
                  Ready to invest
                </span>
                <span className="block animate-slide-up [animation-delay:100ms] text-primary">
                  with intelligence?
                </span>
              </h2>

              <p className="text-lg md:text-xl text-foreground/70 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in [animation-delay:300ms]">
                Stop guessing. Start knowing. Get AI-powered insights, track
                influential voices, and make data-driven investment decisions.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center gap-6 mb-10 animate-fade-in [animation-delay:400ms]">
                <div className="flex items-center gap-2 text-foreground/60 text-sm">
                  <Shield size={16} className="text-primary" />
                  <span>Bank-level Security</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/60 text-sm">
                  <TrendingUp size={16} className="text-primary" />
                  <span>Real-time Data</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/60 text-sm">
                  <Zap size={16} className="text-primary" />
                  <span>Instant Setup</span>
                </div>
              </div>

              {/* CTA Button */}
              <div className="flex justify-center items-center animate-fade-in [animation-delay:500ms]">
                <Link href="/auth" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-16 px-12 text-lg font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/30 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/40"
                  >
                    Create Your Free Account
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              <p className="mt-6 text-sm text-foreground/40 animate-fade-in [animation-delay:600ms]">
                No credit card required • Setup in 30 seconds
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-rotate {
          0%,
          100% {
            transform: translateY(0) rotate(12deg) scale(1);
          }
          25% {
            transform: translateY(-25px) rotate(18deg) scale(1.05);
          }
          50% {
            transform: translateY(-40px) rotate(12deg) scale(1);
          }
          75% {
            transform: translateY(-20px) rotate(6deg) scale(0.95);
          }
        }
        @keyframes float-scale {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          33% {
            transform: translateY(-35px) scale(1.1);
          }
          66% {
            transform: translateY(-50px) scale(0.9);
          }
        }
        @keyframes float-drift {
          0%,
          100% {
            transform: translate(0, 0) rotate(-6deg);
          }
          25% {
            transform: translate(15px, -30px) rotate(0deg);
          }
          50% {
            transform: translate(0, -45px) rotate(6deg);
          }
          75% {
            transform: translate(-10px, -20px) rotate(-3deg);
          }
        }
        @keyframes float-spin {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) rotate(180deg);
          }
        }
        @keyframes pulse-scale {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.3);
            opacity: 1;
          }
        }
        @keyframes bounce-subtle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .animate-float-rotate {
          animation: float-rotate 6s ease-in-out infinite;
        }
        .animate-float-scale {
          animation: float-scale 7s ease-in-out infinite;
        }
        .animate-float-drift {
          animation: float-drift 8s ease-in-out infinite;
        }
        .animate-float-spin {
          animation: float-spin 10s ease-in-out infinite;
        }
        .animate-pulse-scale {
          animation: pulse-scale 3s ease-in-out infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
