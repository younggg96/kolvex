"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";

export default function LandingCTA() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  // Animated background effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };

    const createParticle = () => ({
      x: Math.random() * canvas.offsetWidth,
      y: canvas.offsetHeight + 10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 1 - 0.5,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.2,
    });

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Add new particles
      if (particles.length < 50 && Math.random() > 0.95) {
        particles.push(createParticle());
      }

      // Update and draw particles
      particles = particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity *= 0.995;

        if (p.y < 0 || p.opacity < 0.01) return false;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 200, 5, ${p.opacity})`;
        ctx.fill();

        return true;
      });

      animationId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 lg:py-32 relative overflow-hidden"
    >
      <div className="container px-4 mx-auto relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Main CTA Card */}
          <div
            className={`relative rounded-2xl md:rounded-[2rem] lg:rounded-[3rem] overflow-hidden transition-all duration-1000 ${
              isVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-12 scale-95"
            }`}
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-grid bg-background-light dark:bg-background-dark" />

            {/* Content */}
            <div className="relative z-10 px-4 py-10 sm:px-6 sm:py-12 md:px-12 md:py-16 lg:px-16 lg:py-24 text-center">
              {/* Headline */}
              <h2
                className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 dark:text-white mb-3 md:mb-6 tracking-tight leading-[1.1] transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                Ready to invest with
                <br />
                <span className="text-primary">AI-powered intelligence?</span>
              </h2>

              {/* Description */}
              <p
                className={`text-xs sm:text-sm md:text-base text-gray-600 dark:text-white/70 mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed transition-all duration-700 px-2 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                Join thousands of investors who are already using social
                intelligence to make better trading decisions. Start free, no
                credit card required.
              </p>

              {/* CTA Buttons */}
              <div
                className={`flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center mb-6 md:mb-12 transition-all duration-700 w-full px-2 sm:px-0 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "400ms" }}
              >
                <Link href="/auth" className="w-full sm:w-auto">
                  <Button
                    size="md"
                    className="w-full sm:w-auto px-6 md:px-12 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl shadow-primary/30 group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(0,200,5,0.5)]"
                  >
                    Get Started Free
                    <ArrowRight
                      size={16}
                      className="ml-2 group-hover:translate-x-1 transition-transform md:w-5 md:h-5"
                    />
                  </Button>
                </Link>
                <Link href="/contact" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full sm:w-auto text-gray-600 dark:text-white"
                  >
                    Contact Us
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div
                className={`flex flex-wrap justify-center gap-3 md:gap-6 text-gray-600 dark:text-white/50 text-xs md:text-sm transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "500ms" }}
              >
                <div
                  className={`flex items-center gap-1.5 md:gap-2 transition-all duration-500 ${
                    isVisible
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-4"
                  }`}
                  style={{ transitionDelay: "600ms" }}
                >
                  <Shield size={14} className="text-primary md:w-4 md:h-4" />
                  <span>Bank-level security</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 md:gap-2 transition-all duration-500 ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: "700ms" }}
                >
                  <Clock size={14} className="text-primary md:w-4 md:h-4" />
                  <span>Setup in 30 seconds</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 md:gap-2 transition-all duration-500 ${
                    isVisible
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-4"
                  }`}
                  style={{ transitionDelay: "800ms" }}
                >
                  <Zap size={14} className="text-primary md:w-4 md:h-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Decorative corners with animation - hidden on mobile for cleaner look */}
            <div
              className={`absolute top-3 left-3 md:top-6 md:left-6 w-8 h-8 md:w-16 md:h-16 border-l-2 border-t-2 border-primary/30 rounded-tl-xl md:rounded-tl-3xl transition-all duration-700 hidden sm:block ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
              }`}
              style={{ transitionDelay: "400ms", transformOrigin: "top left" }}
            />
            <div
              className={`absolute top-3 right-3 md:top-6 md:right-6 w-8 h-8 md:w-16 md:h-16 border-r-2 border-t-2 border-primary/30 rounded-tr-xl md:rounded-tr-3xl transition-all duration-700 hidden sm:block ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
              }`}
              style={{ transitionDelay: "500ms", transformOrigin: "top right" }}
            />
            <div
              className={`absolute bottom-3 left-3 md:bottom-6 md:left-6 w-8 h-8 md:w-16 md:h-16 border-l-2 border-b-2 border-primary/30 rounded-bl-xl md:rounded-bl-3xl transition-all duration-700 hidden sm:block ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
              }`}
              style={{
                transitionDelay: "600ms",
                transformOrigin: "bottom left",
              }}
            />
            <div
              className={`absolute bottom-3 right-3 md:bottom-6 md:right-6 w-8 h-8 md:w-16 md:h-16 border-r-2 border-b-2 border-primary/30 rounded-br-xl md:rounded-br-3xl transition-all duration-700 hidden sm:block ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
              }`}
              style={{
                transitionDelay: "700ms",
                transformOrigin: "bottom right",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
