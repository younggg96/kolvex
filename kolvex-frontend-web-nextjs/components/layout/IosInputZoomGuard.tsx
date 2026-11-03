"use client";

import { useEffect } from "react";

/** iOS zooms the page when a field under 16px takes focus, and phone text is smaller than that.
 *  iOS still allows pinch zoom with this limit set, so it applies to iOS only. */
export default function IosInputZoomGuard() {
  useEffect(() => {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIos) return;
    const viewport = document.querySelector('meta[name="viewport"]');
    viewport?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
  }, []);
  return null;
}
