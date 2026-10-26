"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const directoryPaths = new Set(["/research", "/creators", "/stocks"]);
const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Progressive enhancement: server HTML stays visible without JavaScript. */
export function ReadingMotion() {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    if (!directoryPaths.has(pathname)) return;
    const root = document.getElementById("public-content");
    if (!root) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reading-reveal]"));
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;

    function reveal(item: HTMLElement, delay = 0) {
      item.removeAttribute("data-reading-pending");
      if (preference.matches || typeof item.animate !== "function") return;
      const animation = item.animate([
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 500, delay, easing, fill: "backwards" });
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    }

    function showAll() {
      observer?.disconnect();
      items.forEach((item) => item.removeAttribute("data-reading-pending"));
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    }

    if (!preference.matches && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
          reveal(entry.target as HTMLElement, Math.min(index, 3) * 50);
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: "0px 0px -16px 0px" });

      // Read geometry together before writing attributes to avoid layout thrashing.
      const positions = items.map((item) => item.getBoundingClientRect());
      let visibleIndex = 0;
      items.forEach((item, index) => {
        const rect = positions[index];
        if (rect.bottom <= 0) return;
        if (rect.top < window.innerHeight - 16) {
          reveal(item, Math.min(visibleIndex++, 4) * 40);
        } else {
          item.setAttribute("data-reading-pending", "");
          observer?.observe(item);
        }
      });
    }

    // Keyboard navigation and find-in-page must never land on hidden content.
    function onFocus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      const item = event.target.closest<HTMLElement>("[data-reading-pending]");
      if (item) {
        item.removeAttribute("data-reading-pending");
        observer?.unobserve(item);
      }
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    }
    function onPreferenceChange() {
      if (preference.matches) showAll();
    }
    root.addEventListener("focusin", onFocus);
    preference.addEventListener("change", onPreferenceChange);
    window.addEventListener("beforeprint", showAll);

    return () => {
      showAll();
      root.removeEventListener("focusin", onFocus);
      preference.removeEventListener("change", onPreferenceChange);
      window.removeEventListener("beforeprint", showAll);
    };
  }, [pathname, query]);

  return null;
}
