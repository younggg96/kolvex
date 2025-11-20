"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const mockData = [
  { time: "09:30", value: 420 },
  { time: "10:00", value: 425 },
  { time: "10:30", value: 422 },
  { time: "11:00", value: 430 },
  { time: "11:30", value: 435 },
  { time: "12:00", value: 432 },
  { time: "12:30", value: 438 },
  { time: "13:00", value: 441 },
  { time: "13:30", value: 445 },
  { time: "14:00", value: 448 },
  { time: "14:30", value: 452 },
  { time: "15:00", value: 455 },
  { time: "15:30", value: 458 },
  { time: "16:00", value: 462 },
];

export default function StockChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={mockData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: "12px" }} />
        <YAxis
          stroke="#64748b"
          style={{ fontSize: "12px" }}
          domain={["dataMin - 5", "dataMax + 5"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "none",
            borderRadius: "8px",
            color: "#f1f5f9",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
