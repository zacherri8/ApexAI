"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TelemetrySeries } from "@/types/api";

function buildDeltaData(series: TelemetrySeries[]) {
  const [reference, comparison] = series;
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

  return rows;
}

export function TelemetryDeltaChart({ series }: { series: TelemetrySeries[] }) {
  const data = buildDeltaData(series);
  if (series.length < 2 || !data.length) {
    return null;
  }

  return (
    <div className="f1-panel h-[280px] rounded-[28px] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Delta Trace</p>
        <p className="text-xs text-zinc-500">Distance-synced lap-time gain and loss against the reference lap</p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} syncId="telemetry-sync">
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
