"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export const landingEase = [0.16, 1, 0.3, 1] as const;

export function LandingReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduce ? undefined : { opacity: [0.45, 1], y: [24, 0] }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.75, delay, ease: landingEase }}
    >
      {children}
    </motion.div>
  );
}
