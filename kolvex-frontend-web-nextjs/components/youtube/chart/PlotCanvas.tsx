"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GraphGeometry } from "./PriceGraph";

/** Turns a CSS colour that may use our tokens (`rgb(var(--chart-up) / 0.5)`) into a canvas colour. */
export type CanvasColor = (css: string) => string;

export type CanvasPainter = (
  ctx: CanvasRenderingContext2D,
  geometry: GraphGeometry,
  color: CanvasColor,
) => void;

const VAR = /var\(--([\w-]+)\)/g;

function colorResolver(): CanvasColor {
  const style = getComputedStyle(document.documentElement);
  const cache = new Map<string, string>();
  const token = (name: string): string => {
    const raw = style.getPropertyValue(`--${name}`).trim();
    // Tokens can alias other tokens (`--chart-up: var(--market-up)`).
    return raw.replace(VAR, (_, inner: string) => token(inner));
  };
  return (css) => {
    let resolved = cache.get(css);
    if (resolved === undefined) {
      resolved = css.replace(VAR, (_, name: string) => token(name));
      cache.set(css, resolved);
    }
    return resolved;
  };
}

/** Repaints when the theme flips (class / data-theme on <html>), which never re-renders React. */
function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return version;
}

/**
 * The advanced chart's bitmap layer: grid, session shading, volume and candles. Thousands of
 * SVG nodes re-diffed by React on every zoom frame are what made pan / zoom stutter; one canvas
 * repaint per frame costs about a millisecond. It sits under the SVG layer, which keeps the
 * indicator lines, tags and drawings (things people point at) as real elements.
 */
export default function PlotCanvas({
  geometry,
  width,
  height,
  gridPrices,
  gridTimes,
  paint,
}: {
  geometry: GraphGeometry;
  width: number;
  height: number;
  /** Horizontal grid rules (prices) and vertical rules (x pixels), clipped to the plot. */
  gridPrices: number[];
  gridTimes: number[];
  paint: CanvasPainter;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeVersion();
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    const update = () => setRatio(Math.min(window.devicePixelRatio || 1, 3));
    update();
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  // Paints after every render: the painter closes over the latest bars, view and settings.
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const color = colorResolver();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, geometry.plotWidth, geometry.plotHeight);
    ctx.clip();
    ctx.strokeStyle = color("rgb(var(--foreground) / 0.075)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const price of gridPrices) {
      const y = Math.round(geometry.yOf(price)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(geometry.plotWidth, y);
    }
    for (const x of gridTimes) {
      const px = Math.round(x) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, geometry.plotHeight);
    }
    ctx.stroke();
    paint(ctx, geometry, color);
    ctx.restore();
  });

  return (
    <canvas
      ref={ref}
      data-theme-version={theme}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ width, height }}
    />
  );
}
