"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /** Animation variant - 'fade' for subtle, 'scale' for more pronounced */
  variant?: "fade" | "scale";
}

/**
 * Simple page transition wrapper that applies enter animations
 * Wrap your page content with this component for smooth transitions
 */
export function PageTransition({
  children,
  className,
  variant = "fade",
}: PageTransitionProps) {
  return (
    <div
      className={cn(
        variant === "fade" ? "animate-page-enter" : "animate-page-scale-in",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StaggeredContentProps {
  children: ReactNode;
  className?: string;
  /** Delay index (1-5) for staggered animations */
  index?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Content wrapper for staggered reveal animations
 * Use with sibling elements for a cascading reveal effect
 */
export function StaggeredContent({
  children,
  className,
  index = 1,
}: StaggeredContentProps) {
  return (
    <div
      className={cn(
        "animate-content-stagger",
        `stagger-${index}`,
        className
      )}
    >
      {children}
    </div>
  );
}

export default PageTransition;

