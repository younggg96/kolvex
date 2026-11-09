"use client";

import { useEffect } from "react";

/** iOS zooms the page when a field under 16px takes focus, and field text is 14px on touch devices.
 *  iOS still allows pinch zoom with this limit set; Android would not, so it applies to iOS only. */
export default function IosInputZoomGuard() {
  useEffect(() => {
    // iPadOS Safari identifies as a Mac by default; only touch points tell them apart.
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!isIos) return;
    const viewport = document.querySelector('meta[name="viewport"]');
    viewport?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
  }, []);
  return null;
}
