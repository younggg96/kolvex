"use client";

import {
  createContext, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";

export const landingEase = [0.16, 1, 0.3, 1] as const;
const MotionContext = createContext({
  paused: false,
  disabled: false,
  setPaused: (_paused: boolean) => {},
});
export const useLandingMotion = () => useContext(MotionContext);

// Already-visible HTML is the fallback. Only small, bounded compositions animate;
// no scroll listener, layout measurements or permanently promoted layers needed.
const entranceGroups = [
  { selector: "header .landing-width > *", distance: -8, duration: 450 },
  { selector: ".signal-note", distance: 14, duration: 650 },
  { selector: ".signal-caption", distance: 0, duration: 400 },
  { selector: ".landing-feature-nav > a", distance: 10, duration: 450 },
  { selector: ".preview-toolbar > *, .dossier-sidebar > *", distance: 8, duration: 450 },
  { selector: ".workflow-item", distance: 8, duration: 450 },
  { selector: ".workflow-brand", distance: 0, duration: 450 },
  { selector: ".landing-closing-panel h2, .landing-closing-panel p, .landing-closing-panel > a", distance: 12, duration: 600 },
  { selector: "footer .landing-width > span, footer nav > *", distance: 6, duration: 400 },
];

export function LandingMotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(new WeakSet<Element>());
  const disabled = paused || !!reduce;

  useEffect(() => {
    const page = root.current;
    if (!page || disabled || !("IntersectionObserver" in window)) return;
    const animations = new Set<Animation>();
    const specs = new Map<Element, { distance: number; duration: number; delay: number }>();
    for (const group of entranceGroups) {
      page.querySelectorAll(group.selector).forEach((element, index) => {
        specs.set(element, { ...group, delay: Math.min(index * 65, 195) });
      });
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.current.has(entry.target)) continue;
        seen.current.add(entry.target);
        observer.unobserve(entry.target);
        const spec = specs.get(entry.target)!;
        const animation = entry.target.animate(
          [{ opacity: 0.55, transform: `translateY(${spec.distance}px)` },
           { opacity: 1, transform: "translateY(0)" }],
          { duration: spec.duration, delay: spec.delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0.12 });
    specs.forEach((_, element) => {
      if (!seen.current.has(element)) observer.observe(element);
    });
    const visibility = () => {
      animations.forEach((animation) => {
        if (document.hidden) animation.pause();
        else animation.play();
      });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [disabled]);

  return (
    <MotionContext.Provider value={{ paused, disabled, setPaused }}>
      <div ref={root} className="landing-page" data-motion-paused={disabled}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function LandingReveal({
  children, className, delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  const { disabled } = useLandingMotion();
  const frame = className?.includes("frame") || className?.includes("diagram");
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={disabled ? { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" } : frame
        ? { clipPath: ["inset(0% 0% 8% 0%)", "inset(0% 0% 0% 0%)"], opacity: [0.65, 1] }
        : { opacity: [0.55, 1], y: [16, 0] }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: disabled ? 0 : 0.6, delay: disabled ? 0 : delay, ease: landingEase }}
    >{children}</motion.div>
  );
}
