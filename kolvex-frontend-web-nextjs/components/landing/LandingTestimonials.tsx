"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

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
      className={`flex-shrink-0 w-[400px] p-6 rounded-3xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/50 dark:border-white/10 transition-all duration-700 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 ${
        isAnimated
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-8 scale-95"
      }`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {/* Quote icon */}
      <div
        className={`mb-4 transition-all duration-500 ${
          isAnimated ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
        }`}
        style={{ transitionDelay: `${index * 50 + 100}ms` }}
      >
        <Quote size={24} className="text-primary/30" />
      </div>

      {/* Content */}
      <p
        className={`text-gray-700 dark:text-gray-300 mb-6 leading-relaxed transition-all duration-500 ${
          isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: `${index * 50 + 150}ms` }}
      >
        &ldquo;{testimonial.content}&rdquo;
      </p>

      {/* Footer */}
      <div
        className={`flex items-center justify-between transition-all duration-500 ${
          isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionDelay: `${index * 50 + 200}ms` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl">
            {testimonial.avatar}
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white">
              {testimonial.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {testimonial.role}
            </div>
          </div>
        </div>

        {/* Returns badge */}
        {testimonial.returns && (
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
            {testimonial.returns}
          </div>
        )}
      </div>

      {/* Rating */}
      <div
        className={`flex gap-0.5 mt-4 transition-all duration-500 ${
          isAnimated ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDelay: `${index * 50 + 250}ms` }}
      >
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className="text-yellow-400 fill-yellow-400"
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
      className={`text-center transition-all duration-700 ${
        isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="text-3xl font-black text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {label}
      </div>
    </div>
  );
}

export default function LandingTestimonials() {
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
    <section ref={sectionRef} className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 dark:from-gray-900/30 via-transparent to-transparent" />

      <div className="container px-4 mx-auto relative z-10">
        {/* Section header */}
        <div
          ref={headerRef}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12"
        >
          <div>
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6 transition-all duration-700 ${
                headerVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              }`}
            >
              <Star size={12} className="fill-primary" />
              TESTIMONIALS
            </div>
            <h2
              className={`text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4 transition-all duration-700 ${
                headerVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              Loved by <span className="text-primary">5,000+ investors</span>
            </h2>
            <p
              className={`text-lg text-gray-600 dark:text-gray-400 max-w-xl transition-all duration-700 ${
                headerVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              See what our community is saying about their experience with
              Kolvex.
            </p>
          </div>

          {/* Navigation buttons */}
          <div
            className={`flex gap-2 transition-all duration-700 ${
              headerVisible
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
              className={`rounded-xl flex items-center justify-center transition-all ${
                canScrollLeft
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                  : "border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed"
              }`}
            >
              <ChevronLeft size={20} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className={`rounded-xl flex items-center justify-center transition-all ${
                canScrollRight
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                  : "border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed"
              }`}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>

        {/* Testimonials carousel */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
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
          className="mt-16 pt-12 border-t border-gray-200/50 dark:border-white/10"
        >
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
            <TrustIndicator
              value={
                <>
                  4.9<span className="text-primary">/5</span>
                </>
              }
              label="Average Rating"
              index={0}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-12 bg-gray-200 dark:bg-white/10 hidden lg:block transition-all duration-500 ${
                trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
              }`}
              style={{ transitionDelay: "100ms" }}
            />
            <TrustIndicator
              value={
                <>
                  5,000<span className="text-primary">+</span>
                </>
              }
              label="Active Users"
              index={1}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-12 bg-gray-200 dark:bg-white/10 hidden lg:block transition-all duration-500 ${
                trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
              }`}
              style={{ transitionDelay: "200ms" }}
            />
            <TrustIndicator
              value={
                <>
                  $2.4<span className="text-primary">B</span>
                </>
              }
              label="Portfolio Tracked"
              index={2}
              isVisible={trustVisible}
            />
            <div
              className={`w-px h-12 bg-gray-200 dark:bg-white/10 hidden lg:block transition-all duration-500 ${
                trustVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
              }`}
              style={{ transitionDelay: "300ms" }}
            />
            <TrustIndicator
              value={
                <>
                  94<span className="text-primary">%</span>
                </>
              }
              label="Would Recommend"
              index={3}
              isVisible={trustVisible}
            />
          </div>
        </div>
      </div>

      {/* Star pop animation */}
      <style jsx>{`
        @keyframes star-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.3);
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
