"use client";

import { useRef } from "react";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TelemetrySeries } from "@/types/api";

function extractActiveDistance(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const state = payload as { activeLabel?: number | string; activePayload?: Array<{ payload?: { distance?: number } }> };
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

function buildDeltaData(
  reference: TelemetrySeries | undefined,
  comparison: TelemetrySeries | undefined,
  distanceWindow?: { start: number; end: number } | null,
) {
  if (!reference || !comparison) {
    return [];
  }

  const rows = reference.points.map((point, index) => {
    const ref = reference.points[index];
    const comp = comparison.points[index] ?? comparison.points[comparison.points.length - 1];

    return {
      distance: point.distance,
      delta: Number(((comp?.time ?? 0) - (ref?.time ?? 0)).toFixed(4)),
    };
  });

  return distanceWindow
    ? rows.filter((row) => row.distance >= distanceWindow.start && row.distance <= distanceWindow.end)
    : rows;
}

export function TelemetryDeltaChart({
  series,
  referenceKey,
  comparisonKey,
  distanceWindow,
  onSelectWindow,
  onResetWindow,
  hoveredDistance,
  onHoverDistance,
}: {
  series: TelemetrySeries[];
  referenceKey?: string | null;
  comparisonKey?: string | null;
  distanceWindow?: { start: number; end: number } | null;
  onSelectWindow?: (start: number, end: number) => void;
  onResetWindow?: () => void;
  hoveredDistance?: number | null;
  onHoverDistance?: (distance: number | null) => void;
}) {
  const dragStartRef = useRef<number | null>(null);
  const reference = series.find((item) => item.series_key === referenceKey) ?? series[0];
  const comparison =
    series.find((item) => item.series_key === comparisonKey && item.series_key !== reference?.series_key) ??
    series.find((item) => item.series_key !== reference?.series_key);
  const data = buildDeltaData(reference, comparison, distanceWindow);

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

  if (!reference || !comparison || !data.length) {
    return null;
  }

  return (
    <div
      className="f1-panel h-[280px] rounded-[28px] p-4 sm:p-5"
      onDoubleClick={onResetWindow}
      onMouseLeave={() => onHoverDistance?.(null)}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Delta Trace</p>
          <p className="mt-2 text-xs text-zinc-500">
            {comparison.label} vs {reference.label}
          </p>
        </div>
        <p className="text-xs text-zinc-500">Distance-synced lap-time gain and loss against the selected reference</p>
      </div>
      <p className="mb-3 text-sm leading-6 text-zinc-400">
        Read the delta trace as the final timing verdict. When the line drops, the comparison lap is gaining
        against the reference. When it rises, the comparison lap is giving time back.
      </p>
      <p className="mb-3 text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
        Drag to focus a delta window. Double-click to reset.
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          syncId="telemetry-sync"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="distance" stroke="#6b7280" tickFormatter={(value) => `${Math.round(Number(value))}m`} />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `${Number(value).toFixed(2)}s`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f0f0f",
              border: "1px solid rgba(168, 85, 247, 0.35)",
              borderRadius: "16px",
              color: "#f5f5f5",
            }}
            formatter={(value: number) => [`${Number(value).toFixed(3)}s`, "delta"]}
            labelFormatter={(value) => `Distance ${Math.round(Number(value))}m`}
          />
          {hoveredDistance != null ? (
            <ReferenceLine x={hoveredDistance} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
          ) : null}
          <Line type="monotone" dataKey="delta" stroke="#c084fc" strokeWidth={2.5} dot={false} />
          <Brush
            dataKey="distance"
            height={24}
            stroke="#a855f7"
            travellerWidth={12}
            fill="rgba(168,85,247,0.14)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
