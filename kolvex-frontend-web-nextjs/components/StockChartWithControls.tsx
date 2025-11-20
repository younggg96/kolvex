"use client";

import { useEffect, useRef, useState } from "react";
import { useStockQuote, useChartData } from "@/hooks/useStockData";

const timeframes = ["1D", "1W", "1M", "1Y", "ALL"];

interface StockChartWithControlsProps {
  symbol?: string;
}

export default function StockChartWithControls({
  symbol = "AAPL",
}: StockChartWithControlsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [activeTimeframe, setActiveTimeframe] = useState("1D");

  // Fetch real stock data
  const { data: stockQuote, loading: quoteLoading } = useStockQuote(
    symbol,
    30000
  );
  const { data: chartData, loading: chartLoading } = useChartData(
    symbol,
    "5min"
  );

  useEffect(() => {
    if (typeof window !== "undefined" && canvasRef.current) {
      // Dynamically import Chart.js
      import("chart.js/auto").then((ChartModule) => {
        const Chart = ChartModule.default;

        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        // Use real chart data if available, otherwise use defaults
        const labels =
          chartData.length > 0
            ? chartData.map((d) => d.time)
            : [
                "9:00 AM",
                "10:00 AM",
                "11:00 AM",
                "12:00 PM",
                "1:00 PM",
                "2:00 PM",
                "3:00 PM",
                "4:00 PM",
              ];

        const data =
          chartData.length > 0
            ? chartData.map((d) => d.value)
            : [168.2, 169.5, 170.1, 169.8, 171.2, 172.5, 172.0, 173.1];

        chartRef.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "AAPL Price",
                data: data,
                borderColor: "#53d22d",
                backgroundColor: "rgba(83, 210, 45, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointBackgroundColor: "#53d22d",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                mode: "index",
                intersect: false,
                backgroundColor: "#161A16",
                titleFont: { size: 12, weight: "bold" },
                bodyFont: { size: 10 },
                padding: 10,
                cornerRadius: 6,
                caretSize: 0,
                boxPadding: 3,
              },
            },
            scales: {
              x: {
                grid: {
                  display: false,
                  drawOnChartArea: false,
                },
                ticks: {
                  color: "rgba(255, 255, 255, 0.4)",
                  font: {
                    size: 9,
                  },
                },
              },
              y: {
                grid: {
                  color: "rgba(255, 255, 255, 0.05)",
                  drawOnChartArea: true,
                },
                ticks: {
                  color: "rgba(255, 255, 255, 0.4)",
                  font: {
                    size: 9,
                  },
                  callback: function (value) {
                    return "$" + value;
                  },
                },
              },
            },
          },
        });
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [activeTimeframe, chartData, stockQuote]);

  return (
    <div className="bg-card-dark p-4 rounded-xl border border-border-dark/50">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-[16px] font-semibold">{symbol}</h2>
          <p className="text-white/50 text-[10px] mt-0.5">
            {stockQuote?.name || "Loading..."}
            {stockQuote && (
              <span
                className={`ml-2 ${
                  stockQuote.changePercent >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                ${stockQuote.price.toFixed(2)} (
                {stockQuote.changePercent >= 0 ? "+" : ""}
                {stockQuote.changePercent.toFixed(2)}%)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all duration-200 ${
                activeTimeframe === tf
                  ? "bg-primary/15 text-primary"
                  : "text-white/40 hover:bg-white/5 hover:text-white/60"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
