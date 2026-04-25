"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TelemetrySeries } from "@/types/api";

type MetricKey = "speed" | "throttle" | "brake";

const lineColors = ["#e10600", "#f5f5f5", "#6ea8ff", "#ff9f43"];

export function TelemetryChart({
  series,
  metric,
}: {
  series: TelemetrySeries[];
  metric: MetricKey;
}) {
  const merged = series[0]?.points.map((point, index) => {
    const row: Record<string, string | number> = { distance: point.distance };
    series.forEach((driverSeries) => {
      row[driverSeries.driver] = driverSeries.points[index]?.[metric] ?? 0;
    });
    return row;
  }) ?? [];

  return (
    <div className="f1-panel h-[360px] rounded-[28px] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">{metric} Trace</p>
        <p className="text-xs text-zinc-500">Distance vs driver delta</p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="distance" stroke="#6b7280" />
          <YAxis stroke="#6b7280" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f0f0f",
              border: "1px solid rgba(225, 6, 0, 0.35)",
              borderRadius: "16px",
              color: "#f5f5f5",
            }}
            labelStyle={{ color: "#a3a3a3" }}
          />
          <Legend />
          {series.map((driverSeries, index) => (
            <Line
              key={driverSeries.driver}
              type="monotone"
              dataKey={driverSeries.driver}
              stroke={lineColors[index % lineColors.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
