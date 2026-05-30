"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "kolvex:dashboard-sw-cleaned";

export default function DashboardServiceWorkerGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const cleanup = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) return;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(
            cacheNames
              .filter((name) => /workbox|precache|runtime|next-pwa/i.test(name))
              .map((name) => window.caches.delete(name))
          );
        }

        if (
          !cancelled &&
          navigator.serviceWorker.controller &&
          window.sessionStorage.getItem(RELOAD_FLAG) !== "1"
        ) {
          window.sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
        }
      } catch (error) {
        console.warn("Failed to clean dashboard service worker:", error);
      }
    };

    void cleanup();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
