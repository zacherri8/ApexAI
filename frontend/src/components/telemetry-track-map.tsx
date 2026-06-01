"use client";

import { TelemetryTrackMap } from "@/types/api";

function hoverPoint(trackMap: TelemetryTrackMap, distance: number) {
  if (!trackMap.points.length) {
    return null;
  }
  return trackMap.points.reduce((closest, point) => {
    if (!closest) {
      return point;
    }
    return Math.abs(point.distance - distance) < Math.abs(closest.distance - distance) ? point : closest;
  }, trackMap.points[0]);
}

function buildTrackPath(trackMap: TelemetryTrackMap) {
  if (!trackMap.points.length) {
    return "";
  }
  return trackMap.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function confidenceFill(confidence?: number | null) {
  if (confidence == null) {
    return "#f5f5f5";
  }
  if (confidence >= 78) {
    return "#22c55e";
  }
  if (confidence >= 55) {
    return "#facc15";
  }
  return "#f97316";
}

export function TelemetryTrackMapPanel({
  trackMap,
  focusedCorner,
  hoveredDistance,
  onFocusCorner,
}: {
  trackMap: TelemetryTrackMap;
  focusedCorner?: string | null;
  hoveredDistance?: number | null;
  onFocusCorner?: (corner: string) => void;
}) {
  const path = buildTrackPath(trackMap);
  const hoverMarker = hoveredDistance != null ? hoverPoint(trackMap, hoveredDistance) : null;

  return (
    <div className="f1-panel rounded-[28px] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Track Navigator
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Click a corner marker to focus that part of the lap. Hover any telemetry chart to move the live
            track marker and connect the data back to a physical place on circuit.
          </p>
        </div>
      </div>
      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
        {path ? (
          <svg viewBox="0 0 100 100" className="aspect-square w-full overflow-visible">
            <path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={path}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trackMap.corners.map((corner) => (
              <g key={corner.corner} className="cursor-pointer" onClick={() => onFocusCorner?.(corner.corner)}>
                <title>{corner.corner_hint || corner.corner_label || corner.corner}</title>
                <circle
                  cx={corner.x}
                  cy={corner.y}
                  r={focusedCorner === corner.corner ? 3.6 : 2.6}
                  fill={focusedCorner === corner.corner ? "#e10600" : confidenceFill(corner.confidence_score)}
                />
                <text
                  x={corner.x + 2.4}
                  y={corner.y - 2.4}
                  fill={focusedCorner === corner.corner ? "#ffffff" : "#a1a1aa"}
                  fontSize="4.4"
                  fontWeight="700"
                >
                  {corner.corner}
                </text>
              </g>
            ))}
            {hoverMarker ? (
              <>
                <circle cx={hoverMarker.x} cy={hoverMarker.y} r={3.8} fill="rgba(168,85,247,0.22)" />
                <circle cx={hoverMarker.x} cy={hoverMarker.y} r={1.8} fill="#c084fc" />
              </>
            ) : null}
          </svg>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-zinc-500">
            Track map unavailable for the selected lap.
          </div>
        )}
      </div>
      {trackMap.corners.length ? (
        <div className="mt-3 grid gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500 sm:grid-cols-3">
          <span>Green high confidence</span>
          <span>Yellow medium</span>
          <span>Orange low</span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {trackMap.corners.slice(0, 10).map((corner) => (
          <button
            key={corner.corner}
            className={`rounded-full border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition ${
              focusedCorner === corner.corner
                ? "border-red-500/70 bg-red-500/15 text-white"
                : "border-white/10 bg-white/5 text-zinc-400"
            }`}
            onClick={() => onFocusCorner?.(corner.corner)}
            type="button"
            title={corner.corner_hint || corner.corner_label || corner.corner}
          >
            {`${corner.corner_label || corner.corner} / ${corner.confidence_score != null ? `${corner.confidence_score.toFixed(0)}%` : corner.corner_type}`}
          </button>
        ))}
      </div>
    </div>
  );
}
