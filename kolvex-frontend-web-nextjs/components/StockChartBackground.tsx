"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface CandleStick {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  isGreen: boolean;
}

export default function StockChartBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, systemTheme } = useTheme();
  const animationFrameRef = useRef<number>();
  const candlesRef = useRef<CandleStick[]>([]);
  const offsetRef = useRef(0);
  const trendRef = useRef(0);
  const priceRangeRef = useRef({ min: 0, max: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Determine current theme
    const currentTheme = theme === "system" ? systemTheme : theme;
    const isDark = currentTheme === "dark";

    // Theme colors
    const bgColor = isDark ? "#0a0e0f" : "#f7f8fa";
    const lineColor = isDark ? "rgba(0, 200, 5, 0.1)" : "rgba(0, 200, 5, 0.15)";
    const greenColor = isDark
      ? "rgba(0, 200, 5, 0.25)"
      : "rgba(0, 200, 5, 0.2)";
    const redColor = isDark
      ? "rgba(239, 68, 68, 0.25)"
      : "rgba(239, 68, 68, 0.2)";
    const wickColor = isDark
      ? "rgba(100, 116, 139, 0.3)"
      : "rgba(100, 116, 139, 0.25)";

    // Initialize candles
    const candleWidth = 12;
    const candleGap = 8;
    const candleSpacing = candleWidth + candleGap;
    const numCandles = Math.ceil(canvas.width / candleSpacing) + 5;

    // Generate initial candles
    if (candlesRef.current.length === 0) {
      let lastClose = 200 + Math.random() * 100;
      trendRef.current = (Math.random() - 0.5) * 0.1;

      for (let i = 0; i < numCandles; i++) {
        const volatility = 0.05;
        const trendChange = (Math.random() - 0.5) * 0.02;
        trendRef.current += trendChange;
        trendRef.current = Math.max(-0.08, Math.min(0.08, trendRef.current));

        const open = lastClose;
        const closeChange =
          open * (volatility * (Math.random() - 0.5) + trendRef.current);
        const close = open + closeChange;

        const high =
          Math.max(open, close) + Math.abs(closeChange) * Math.random() * 2;
        const low =
          Math.min(open, close) - Math.abs(closeChange) * Math.random() * 2;

        const isGreen = close >= open;

        candlesRef.current.push({
          x: -i * candleSpacing, // Start from left (negative positions)
          open,
          close,
          high,
          low,
          isGreen,
        });

        lastClose = close;
      }

      // Reverse so oldest candles are on the left
      candlesRef.current.reverse();

      // Initialize price range
      const allPrices = candlesRef.current.flatMap((c) => [c.high, c.low]);
      priceRangeRef.current = {
        min: Math.min(...allPrices),
        max: Math.max(...allPrices),
      };
    }

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Move candles right (from left to right)
      offsetRef.current += 0.8;

      // Add new candle when needed (on the left side)
      if (offsetRef.current >= candleSpacing) {
        offsetRef.current = 0;

        const firstCandle = candlesRef.current[0];
        const volatility = 0.05;

        // Add dynamic trend changes
        const trendChange = (Math.random() - 0.5) * 0.02;
        trendRef.current += trendChange;
        // Keep trend bounded
        trendRef.current = Math.max(-0.08, Math.min(0.08, trendRef.current));

        const open = firstCandle.close;
        const closeChange =
          open * (volatility * (Math.random() - 0.5) + trendRef.current);
        const close = open + closeChange;

        const high =
          Math.max(open, close) + Math.abs(closeChange) * Math.random() * 2;
        const low =
          Math.min(open, close) - Math.abs(closeChange) * Math.random() * 2;

        const isGreen = close >= open;

        // Add new candle at the beginning (left side)
        candlesRef.current.unshift({
          x: candlesRef.current[0].x - candleSpacing,
          open,
          close,
          high,
          low,
          isGreen,
        });

        // Remove old candles from the end
        if (candlesRef.current.length > numCandles) {
          candlesRef.current.pop();
        }
      }

      // Smooth price range calculation to avoid jumps
      const allPrices = candlesRef.current.flatMap((c) => [c.high, c.low]);
      const currentMin = Math.min(...allPrices);
      const currentMax = Math.max(...allPrices);

      // Smoothly interpolate price range
      const smoothing = 0.95;
      priceRangeRef.current.min =
        priceRangeRef.current.min * smoothing + currentMin * (1 - smoothing);
      priceRangeRef.current.max =
        priceRangeRef.current.max * smoothing + currentMax * (1 - smoothing);

      const priceRange = priceRangeRef.current.max - priceRangeRef.current.min;
      const padding = priceRange * 0.15;

      const scaleY = (price: number) => {
        const normalized =
          (price - (priceRangeRef.current.min - padding)) /
          (priceRange + 2 * padding);
        return (
          canvas.height - normalized * canvas.height * 0.8 - canvas.height * 0.1
        );
      };

      // Draw horizontal grid lines
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      const numGridLines = 8;
      for (let i = 0; i <= numGridLines; i++) {
        const y = (canvas.height / numGridLines) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw vertical grid lines
      const numVerticalLines = Math.ceil(canvas.width / 60);
      for (let i = 0; i <= numVerticalLines; i++) {
        const x = (canvas.width / numVerticalLines) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw candles
      candlesRef.current.forEach((candle) => {
        const x = candle.x + offsetRef.current;

        // Skip if out of view
        if (x < -candleSpacing || x > canvas.width + candleSpacing) return;

        const openY = scaleY(candle.open);
        const closeY = scaleY(candle.close);
        const highY = scaleY(candle.high);
        const lowY = scaleY(candle.low);

        const candleColor = candle.isGreen ? greenColor : redColor;

        // Draw wick
        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Draw body
        ctx.fillStyle = candleColor;
        const bodyHeight = Math.abs(closeY - openY);
        const bodyY = Math.min(openY, closeY);

        // Add subtle glow effect
        if (candle.isGreen) {
          ctx.shadowColor = "rgba(0, 200, 5, 0.3)";
          ctx.shadowBlur = 4;
        } else {
          ctx.shadowColor = "rgba(239, 68, 68, 0.3)";
          ctx.shadowBlur = 4;
        }

        ctx.fillRect(x, bodyY, candleWidth, Math.max(bodyHeight, 2));

        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // Draw border for body
        ctx.strokeStyle = candle.isGreen
          ? "rgba(0, 200, 5, 0.4)"
          : "rgba(239, 68, 68, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, bodyY, candleWidth, Math.max(bodyHeight, 2));
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [theme, systemTheme]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
