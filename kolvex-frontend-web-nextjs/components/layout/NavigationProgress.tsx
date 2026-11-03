"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const INITIAL_PROGRESS = 12;
const MAX_TRICKLE_PROGRESS = 90;
const TRICKLE_INTERVAL_MS = 300;
const FINISH_DURATION_MS = 350;
/** A clicked link can cancel its own navigation, which leaves no location change to wait for. */
const NAVIGATION_TIMEOUT_MS = 15_000;

let pendingRoutes = 0;
const listeners = new Set<() => void>();

function subscribeToPendingRoutes(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updatePendingRoutes(delta: number) {
  pendingRoutes += delta;
  listeners.forEach((listener) => listener());
}

/** Rendered by a route's loading UI so the bar keeps running until the page replaces it. */
export function RouteLoadingSignal() {
  useEffect(() => {
    updatePendingRoutes(1);
    return () => updatePendingRoutes(-1);
  }, []);
  return null;
}

function currentDocumentLocation() {
  return `${window.location.pathname}${window.location.search}`;
}

function NavigationProgressBar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const committedLocation = useRef("");
  const routePending = useSyncExternalStore(
    subscribeToPendingRoutes,
    () => pendingRoutes > 0,
    () => false,
  );
  const loading = navigating || routePending;

  useEffect(() => {
    committedLocation.current = currentDocumentLocation();
    setNavigating(false);
  }, [pathname, search]);

  // The router only updates the URL once a route commits, so a slow navigation
  // has to be detected from the click or history event that started it.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (`${url.pathname}${url.search}` === committedLocation.current) return;
      setNavigating(true);
    };
    const handlePopState = () => {
      if (currentDocumentLocation() !== committedLocation.current) setNavigating(true);
    };
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const timeout = window.setTimeout(() => setNavigating(false), NAVIGATION_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [navigating]);

  useEffect(() => {
    if (loading) {
      setProgress((value) => (value === 0 || value === 100 ? INITIAL_PROGRESS : value));
      const interval = window.setInterval(() => {
        setProgress((value) => value + (MAX_TRICKLE_PROGRESS - value) * 0.12);
      }, TRICKLE_INTERVAL_MS);
      return () => window.clearInterval(interval);
    }
    setProgress((value) => (value === 0 ? 0 : 100));
    const timeout = window.setTimeout(() => setProgress(0), FINISH_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  return (
    <div
      aria-hidden="true"
      data-navigation-progress={progress}
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[9999] h-[3px]"
    >
      <div
        style={{ transform: `scaleX(${progress / 100})` }}
        className={cn(
          "h-full origin-left bg-primary motion-reduce:transition-none",
          progress === 0 && "opacity-0 transition-none",
          progress > 0 && progress < 100 && "opacity-100 transition-transform duration-300 ease-out",
          progress === 100 && "opacity-0 transition-[transform,opacity] delay-[0ms,200ms] duration-200 ease-out",
        )}
      />
    </div>
  );
}

/** Top-of-page bar for route changes; useSearchParams needs its own Suspense boundary. */
export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
