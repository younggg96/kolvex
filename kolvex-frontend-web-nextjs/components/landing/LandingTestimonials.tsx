"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "@/lib/i18n";

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  returns?: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Michael Chen",
    role: "Retail Investor",
    avatar: "🧑‍💼",
    content:
      "Kolvex changed how I approach the market. The KOL tracking feature alone saved me from multiple bad trades. Being able to see what influential investors are saying in real-time is invaluable.",
    rating: 5,
    returns: "+47% YTD",
  },
  {
    name: "Sarah Williams",
    role: "Day Trader",
    avatar: "👩‍💻",
    content:
      "The AI sentiment analysis is incredibly accurate. I've tested it against my own analysis for 3 months and it outperformed consistently. The instant alerts are a game-changer for momentum plays.",
    rating: 5,
    returns: "+89% YTD",
  },
  {
    name: "David Park",
    role: "Portfolio Manager",
    avatar: "👨‍💼",
    content:
      "We use Kolvex to supplement our quantitative models. The social intelligence data has become an essential input for our sentiment-based strategies. Excellent API and data quality.",
    rating: 5,
  },
  {
    name: "Emma Rodriguez",
    role: "Swing Trader",
    avatar: "👩‍🎓",
    content:
      "Finally, a platform that makes social media analysis accessible. The smart filtering removes all the noise, and I only see high-quality signals from verified sources.",
    rating: 5,
    returns: "+32% YTD",
  },
  {
    name: "James Liu",
    role: "Crypto Investor",
    avatar: "🧑‍🚀",
    content:
      "The cross-platform coverage is what sold me. Having Twitter, Reddit, and Discord signals all in one dashboard with AI analysis is exactly what I needed for crypto trading.",
    rating: 5,
    returns: "+156% YTD",
  },
  {
    name: "Lisa Thompson",
    role: "Long-term Investor",
    avatar: "👩‍🔬",
    content:
      "Even as a buy-and-hold investor, Kolvex helps me time my entries better. The sentiment scoring gives me confidence when adding to positions during market fear.",
    rating: 5,
  },
];

function TestimonialCard({
  testimonial,
  index,
  isVisible,
}: {
  testimonial: Testimonial;
  index: number;
  isVisible: boolean;
}) {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsAnimated(true);
      }, index * 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`flex-shrink-0 w-[280px] sm:w-[320px] md:w-[400px] p-4 md:p-6 rounded-2xl bg-card border border-border transition-all duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] hover:border-primary/25 ${isAnimated
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-6"
        }`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {/* Quote icon */}
      <div
        className={`mb-2 md:mb-4 transition-all duration-500 ${isAnimated ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          }`}
        style={{ transitionDelay: `${index * 50 + 100}ms` }}
      >
        <Quote size={18} className="text-primary/30 md:w-6 md:h-6" />
      </div>

      {/* Content */}
      <p
        className={`text-xs md:text-sm lg:text-base text-black-700 dark:text-black-300 mb-4 md:mb-6 leading-relaxed transition-all duration-500 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        style={{ transitionDelay: `${index * 50 + 150}ms` }}
      >
        &ldquo;{testimonial.content}&rdquo;
      </p>

      {/* Footer */}
      <div
        className={`flex items-center justify-between gap-2 transition-all duration-500 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        style={{ transitionDelay: `${index * 50 + 200}ms` }}
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-lg md:text-2xl flex-shrink-0">
            {testimonial.avatar}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm md:text-base text-black-900 dark:text-white truncate">
              {testimonial.name}
            </div>
            <div className="text-xs md:text-sm text-black-500 dark:text-black-400 truncate">
              {testimonial.role}
            </div>
          </div>
        </div>

        {/* Returns badge */}
        {testimonial.returns && (
          <div className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold whitespace-nowrap flex-shrink-0">
            {testimonial.returns}
          </div>
        )}
      </div>

      {/* Rating */}
      <div
        className={`flex gap-0.5 mt-3 md:mt-4 transition-all duration-500 ${isAnimated ? "opacity-100" : "opacity-0"
          }`}
        style={{ transitionDelay: `${index * 50 + 250}ms` }}
      >
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star
            key={i}
            size={12}
            className="text-yellow-400 fill-yellow-400 md:w-3.5 md:h-3.5"
            style={{
              animation: isAnimated
                ? `star-pop 0.3s ease-out ${i * 50}ms both`
                : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TrustIndicator({
  value,
  label,
  index,
  isVisible,
}: {
  value: React.ReactNode;
  label: string;
  index: number;
  isVisible: boolean;
}) {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsAnimated(true);
      }, index * 100 + 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, index]);

  return (
    <div
      className={`text-center transition-all duration-700 ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="text-xl sm:text-2xl md:text-3xl font-black text-black-900 dark:text-white">
        {value}
      </div>
      <div className="text-xs md:text-sm text-black-500 dark:text-black-400 mt-0.5 md:mt-1">
        {label}
      </div>
    </div>
  );
}

export default function LandingTestimonials() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [trustVisible, setTrustVisible] = useState(false);
  const trustRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener("scroll", checkScroll);
      return () => ref.removeEventListener("scroll", checkScroll);
    }
  }, []);

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
            if (entry.target === trustRef.current) {
              setTrustVisible(true);
            }
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (headerRef.current) observer.observe(headerRef.current);
    if (trustRef.current) observer.observe(trustRef.current);

    return () => observer.disconnect();
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 420;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 lg:py-32 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-muted/20" />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div
          ref={headerRef}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 md:gap-8 mb-6 md:mb-12"
        >
          <div>
            <div
              className={`inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-bold mb-3 md:mb-6 transition-all duration-700 ${headerVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-4 scale-95"
                }`}
            >
              <Star size={10} className="fill-primary md:w-3 md:h-3" />
              {t("landing.testimonials.badge")}
            </div>
            <h2
              className={`text-xl sm:text-2xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2 md:mb-4 transition-all duration-700 ${headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "100ms" }}
            >
              {t("landing.testimonials.title")}
            </h2>
            <p
              className={`text-sm md:text-lg text-muted-foreground max-w-xl transition-all duration-700 ${headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "200ms" }}
            >
              {t("landing.testimonials.subtitle")}
            </p>
          </div>

          {/* Navigation buttons */}
          <div
            className={`flex gap-2 transition-all duration-700 ${headerVisible
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-8"
              }`}
            style={{ transitionDelay: "300ms" }}
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all ${canScrollLeft
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                : "border-black-200 dark:border-white/10 text-black-400 dark:text-white/30 cursor-not-allowed"
                }`}
            >
              <ChevronLeft size={16} className="md:w-5 md:h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all ${canScrollRight
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                : "border-black-200 dark:border-white/10 text-black-400 dark:text-white/30 cursor-not-allowed"
                }`}
            >
              <ChevronRight size={16} className="md:w-5 md:h-5" />
            </Button>
          </div>
        </div>

        {/* Testimonials carousel */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
        >
          {TESTIMONIALS.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              testimonial={testimonial}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Trust indicators */}
        <div
          ref={trustRef}
          className="mt-8 md:mt-16 pt-6 md:pt-12 border-t border-border"
        >
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center items-center gap-4 md:gap-8 lg:gap-16">
            <TrustIndicator
              value={
                <>
                  4.9<span className="text-primary">/5</span>
                </>
              }
              label={t("landing.testimonials.trust.averageRating")}
              index={0}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-8 md:h-12 bg-black-200 dark:bg-white/10 hidden md:block transition-all duration-500 ${trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                }`}
              style={{ transitionDelay: "100ms" }}
            />
            <TrustIndicator
              value={
                <>
                  5,000<span className="text-primary">+</span>
                </>
              }
              label={t("landing.testimonials.trust.activeUsers")}
              index={1}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-8 md:h-12 bg-black-200 dark:bg-white/10 hidden lg:block transition-all duration-500 ${trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                }`}
              style={{ transitionDelay: "200ms" }}
            />
            <TrustIndicator
              value={
                <>
                  $2.4<span className="text-primary">B</span>
                </>
              }
              label={t("landing.testimonials.trust.portfolioTracked")}
              index={2}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-8 md:h-12 bg-black-200 dark:bg-white/10 hidden lg:block transition-all duration-500 ${trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                }`}
              style={{ transitionDelay: "300ms" }}
            />
            <TrustIndicator
              value={
                <>
                  94<span className="text-primary">%</span>
                </>
              }
              label={t("landing.testimonials.trust.wouldRecommend")}
              index={3}
              isVisible={trustVisible}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes star-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
