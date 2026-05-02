"use client";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TelemetrySeries } from "@/types/api";

type MetricKey = "speed" | "throttle" | "brake";
type ExtendedMetricKey = MetricKey | "gear" | "rpm" | "steering";

export function TelemetryChart({
  series,
  metric,
  syncId = "telemetry-sync",
}: {
  series: TelemetrySeries[];
  metric: ExtendedMetricKey;
  syncId?: string;
}) {
  const merged =
    series[0]?.points.map((point, index) => {
      const row: Record<string, string | number> = { distance: point.distance };
      series.forEach((driverSeries) => {
        row[driverSeries.series_key] = driverSeries.points[index]?.[metric] ?? 0;
      });
      return row;
    }) ?? [];

  return (
    <div className="f1-panel h-[360px] rounded-[28px] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">{metric} Trace</p>
        <p className="text-xs text-zinc-500">
          {metric === "steering"
            ? "Estimated steering load derived from FastF1 position curvature"
            : "FastF1 distance-sampled selected-lap trace"}
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={merged} syncId={syncId}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="distance" stroke="#6b7280" tickFormatter={(value) => `${Math.round(Number(value))}m`} />
          <YAxis stroke="#6b7280" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f0f0f",
              border: "1px solid rgba(225, 6, 0, 0.35)",
              borderRadius: "16px",
              color: "#f5f5f5",
            }}
            labelStyle={{ color: "#a3a3a3" }}
            formatter={(value: number) => {
              if (metric === "speed") {
                return [`${Number(value).toFixed(1)} km/h`, metric];
              }
              if (metric === "rpm") {
                return [`${Math.round(Number(value))} rpm`, metric];
              }
              if (metric === "gear") {
                return [`G${Math.round(Number(value))}`, metric];
              }
              if (metric === "steering") {
                return [`${Number(value).toFixed(1)}°`, "steering (estimated)"];
              }
              return [`${Number(value).toFixed(1)}%`, metric];
            }}
            labelFormatter={(value) => `Distance ${Math.round(Number(value))}m`}
          />
          <Legend />
          {series.map((driverSeries) =>
            metric === "brake" ? (
              <Area
                key={driverSeries.series_key}
                type="monotone"
                dataKey={driverSeries.series_key}
                name={driverSeries.label}
                stroke={driverSeries.color}
                fill={driverSeries.color}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ) : (
              <Line
                key={driverSeries.series_key}
                type={metric === "gear" ? "stepAfter" : "monotone"}
                dataKey={driverSeries.series_key}
                name={driverSeries.label}
                stroke={driverSeries.color}
                strokeWidth={2.5}
                dot={false}
              />
            ),
          )}
          <Brush
            dataKey="distance"
            height={24}
            stroke="#a855f7"
            travellerWidth={12}
            fill="rgba(168,85,247,0.14)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
