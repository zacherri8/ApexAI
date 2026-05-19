"use client";

import { useRef } from "react";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TelemetrySeries } from "@/types/api";

type MetricKey = "speed" | "throttle" | "brake";
type ExtendedMetricKey = MetricKey | "gear" | "rpm" | "steering";

const metricDescriptions: Record<ExtendedMetricKey, string> = {
  speed: "Read minimum speed at the apex, then look at how quickly the car rebuilds speed on exit.",
  throttle:
    "Earlier full throttle usually means a stronger exit, but only if the trace stays smooth and the car does not need extra correction.",
  brake:
    "Use this trace to compare braking commitment and release. A shorter brake phase is only better if apex speed and exit still hold up.",
  steering:
    "This estimated steering load comes from FastF1 position curvature. Smoother traces usually mean fewer mid-corner corrections.",
  gear: "Gear traces show where the driver commits to acceleration and how the lap is managed through slower corners.",
  rpm: "RPM helps confirm whether acceleration is being carried cleanly and whether the car stays loaded on power.",
};

function extractActiveDistance(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const state = payload as {
    activeLabel?: number | string;
    activePayload?: Array<{ payload?: { distance?: number } }>;
  };
  if (typeof state.activeLabel === "number") {
    return state.activeLabel;
  }
  if (typeof state.activeLabel === "string") {
    const parsed = Number(state.activeLabel);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const payloadDistance = state.activePayload?.[0]?.payload?.distance;
  return typeof payloadDistance === "number" ? payloadDistance : null;
}

export function TelemetryChart({
  series,
  metric,
  syncId = "telemetry-sync",
  distanceWindow,
  onSelectWindow,
  onResetWindow,
  hoveredDistance,
  onHoverDistance,
}: {
  series: TelemetrySeries[];
  metric: ExtendedMetricKey;
  syncId?: string;
  distanceWindow?: { start: number; end: number } | null;
  onSelectWindow?: (start: number, end: number) => void;
  onResetWindow?: () => void;
  hoveredDistance?: number | null;
  onHoverDistance?: (distance: number | null) => void;
}) {
  const dragStartRef = useRef<number | null>(null);
  const mergedRows =
    series[0]?.points.map((point, index) => {
      const row: Record<string, string | number> = { distance: point.distance };
      series.forEach((driverSeries) => {
        row[driverSeries.series_key] = driverSeries.points[index]?.[metric] ?? 0;
      });
      return row;
    }) ?? [];
  const merged = distanceWindow
    ? mergedRows.filter(
        (row) =>
          typeof row.distance === "number" &&
          row.distance >= distanceWindow.start &&
          row.distance <= distanceWindow.end,
      )
    : mergedRows;

  function handleMouseDown(state: unknown) {
    const distance = extractActiveDistance(state);
    if (distance == null) {
      return;
    }
    dragStartRef.current = distance;
  }

  function handleMouseUp(state: unknown) {
    const endDistance = extractActiveDistance(state);
    const startDistance = dragStartRef.current;
    dragStartRef.current = null;
    if (startDistance == null || endDistance == null || !onSelectWindow) {
      return;
    }
    if (Math.abs(endDistance - startDistance) < 40) {
      return;
    }
    onSelectWindow(Math.min(startDistance, endDistance), Math.max(startDistance, endDistance));
  }

  function handleMouseMove(state: unknown) {
    const distance = extractActiveDistance(state);
    if (distance == null || !onHoverDistance) {
      return;
    }
    onHoverDistance(distance);
  }

  return (
    <div
      className="f1-panel h-[360px] rounded-[28px] p-4 sm:p-5"
      onDoubleClick={onResetWindow}
      onMouseLeave={() => onHoverDistance?.(null)}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          {metric} Trace
        </p>
        <p className="text-xs text-zinc-500">
          {metric === "steering"
            ? "Estimated steering load derived from FastF1 position curvature"
            : "FastF1 distance-sampled selected-lap trace"}
        </p>
      </div>
      <p className="mb-3 text-sm leading-6 text-zinc-400">{metricDescriptions[metric]}</p>
      <p className="mb-3 text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
        Drag on the chart to focus a distance slice. Double-click to reset.
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={merged}
          syncId={syncId}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
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
                return [`${Number(value).toFixed(1)} deg`, "steering (estimated)"];
              }
              return [`${Number(value).toFixed(1)}%`, metric];
            }}
            labelFormatter={(value) => `Distance ${Math.round(Number(value))}m`}
          />
          <Legend />
          {hoveredDistance != null ? (
            <ReferenceLine x={hoveredDistance} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
          ) : null}
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
