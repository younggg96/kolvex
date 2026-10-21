"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

/** Scroll values stay outside React state; layout remains in normal flow. */
export function LandingParallax({
  children,
  className = "",
  distance = 48,
  hero = false,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  hero?: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const { scrollYProgress } = useScroll({
    target,
    offset: hero ? ["start start", "end start"] : ["start end", "end start"],
  });
  const amplitude = distance * (mobile ? 0.3 : 1);
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    hero ? [0, -amplitude] : [amplitude, -amplitude],
  );
  return (
    <motion.div
      ref={target}
      className={`landing-parallax ${className}`}
      style={reduce ? undefined : { y }}
    >
      {children}
    </motion.div>
  );
}

/** One bounded reveal per content group, with readable HTML as the fallback. */
export default function LandingScrollEffects() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !("IntersectionObserver" in window)) return;
    const animations = new Set<Animation>();
    const page = document.querySelector(".landing-page");
    if (!page) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          // Focused controls must never be moved by an entrance animation.
          if (entry.target.contains(document.activeElement)) continue;
          const items = entry.target.matches(".curated-stocks")
            ? Array.from(entry.target.children)
            : [entry.target];
          items.forEach((element, index) => {
            const animation = element.animate(
              [
                {
                  opacity: 0.45,
                  transform: "translateY(28px)",
                  clipPath: "inset(0 0 6% 0)",
                },
                {
                  opacity: 1,
                  transform: "translateY(0)",
                  clipPath: "inset(0 0 0 0)",
                },
              ],
              {
                duration: 750,
                delay: index * 75,
                easing: "cubic-bezier(.16,1,.3,1)",
              },
            );
            animations.add(animation);
            animation.onfinish = () => animations.delete(animation);
          });
        }
      },
      { threshold: 0.16 },
    );
    page
      .querySelectorAll(
        ".landing-section-heading, .curated-stocks, .portfolio-copy, .source-ledger, .landing-closing-panel",
      )
      .forEach((element) => observer.observe(element));
    const finishOnFocus = () =>
      animations.forEach((animation) => animation.finish());
    const visibility = () =>
      animations.forEach((animation) => {
        if (document.hidden) animation.pause();
        else animation.play();
      });
    page.addEventListener("focusin", finishOnFocus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      page.removeEventListener("focusin", finishOnFocus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reduce]);
  return null;
}
