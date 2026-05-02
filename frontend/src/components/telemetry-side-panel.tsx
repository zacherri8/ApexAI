"use client";

import {
  TelemetryCornerBreakdown,
  TelemetryDriverMetrics,
  TelemetryLapOption,
  TelemetryMicroSector,
  TelemetryPerformanceSummary,
} from "@/types/api";

function formatSeconds(value?: number | null) {
  return typeof value === "number" ? `${value.toFixed(3)}s` : "--";
}

function idealLap(metrics: TelemetryDriverMetrics[]) {
  const s1 = Math.min(...metrics.map((metric) => metric.sector_1_seconds ?? Number.POSITIVE_INFINITY));
  const s2 = Math.min(...metrics.map((metric) => metric.sector_2_seconds ?? Number.POSITIVE_INFINITY));
  const s3 = Math.min(...metrics.map((metric) => metric.sector_3_seconds ?? Number.POSITIVE_INFINITY));
  if (![s1, s2, s3].every(Number.isFinite)) {
    return null;
  }
  return s1 + s2 + s3;
}

function deltaValue(metrics: TelemetryDriverMetrics[]) {
  const laps = metrics
    .map((metric) => metric.fastest_lap_seconds)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  if (laps.length < 2) {
    return null;
  }
  return laps[1] - laps[0];
}

function summarizeLapOptions(lapOptions: TelemetryLapOption[] = []) {
  const grouped = new Map<string, number>();
  lapOptions.forEach((option) => {
    grouped.set(option.driver, (grouped.get(option.driver) ?? 0) + 1);
  });
  return Array.from(grouped.entries());
}

function topMicroSectors(microSectors: TelemetryMicroSector[] = []) {
  const grouped = new Map<number, TelemetryMicroSector[]>();
  microSectors.forEach((sector) => {
    grouped.set(sector.segment, [...(grouped.get(sector.segment) ?? []), sector]);
  });

  return Array.from(grouped.entries())
    .slice(0, 6)
    .map(([segment, sectors]) => {
      const sorted = [...sectors].sort((a, b) => a.delta_to_best - b.delta_to_best);
      return {
        segment,
        type: sectors[0]?.corner_type ?? "Mixed",
        leader: sorted[0]?.driver ?? "--",
        gap: sorted[1] ? sorted[1].delta_to_best.toFixed(3) : "0.000",
      };
    });
}

function renderDriverDeltaMap(map: Record<string, number>) {
  return Object.entries(map)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([driver, value]) => (
      <div key={driver} className="flex items-center justify-between text-xs text-zinc-300">
        <span>{driver}</span>
        <span>{value.toFixed(3)}s</span>
      </div>
    ));
}

export function TelemetrySidePanel({
  metrics,
  lapOptions = [],
  microSectors = [],
  cornerBreakdown = [],
  performance = [],
}: {
  metrics: TelemetryDriverMetrics[];
  lapOptions?: TelemetryLapOption[];
  microSectors?: TelemetryMicroSector[];
  cornerBreakdown?: TelemetryCornerBreakdown[];
  performance?: TelemetryPerformanceSummary[];
}) {
  const ideal = idealLap(metrics);
  const delta = deltaValue(metrics);
  const leader = metrics
    .filter((metric) => typeof metric.fastest_lap_seconds === "number")
    .sort((a, b) => (a.fastest_lap_seconds ?? Infinity) - (b.fastest_lap_seconds ?? Infinity))[0];
  const lapGroups = summarizeLapOptions(lapOptions);
  const bestMicroSectors = topMicroSectors(microSectors);

  return (
    <aside className="space-y-4">
      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Performance Snapshot</p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-white">
            <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-fuchsia-200">Ideal Lap</span>
            <span className="mt-2 block text-2xl font-semibold">{ideal ? `${ideal.toFixed(3)}s` : "--"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
              <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Lap Delta</span>
              <span className="mt-2 block text-xl font-semibold">{delta != null ? `${delta.toFixed(3)}s` : "--"}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
              <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Reference Lap</span>
              <span className="mt-2 block text-xl font-semibold">
                {leader ? `${leader.driver} L${leader.lap_number ?? "--"}` : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Selected Laps</p>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => (
            <div key={metric.driver} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{metric.driver}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  L{metric.lap_number ?? "--"} • {metric.compound ?? "N/A"}
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                Best traced lap {formatSeconds(metric.fastest_lap_seconds)} with {lapGroups.find(([driver]) => driver === metric.driver)?.[1] ?? 0} lap choices loaded
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Sector & Micro-Sector Analysis</p>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => (
            <div key={metric.driver} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
              <div className="font-medium text-white">{metric.driver}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-300">
                <span>S1 {formatSeconds(metric.sector_1_seconds)}</span>
                <span>S2 {formatSeconds(metric.sector_2_seconds)}</span>
                <span>S3 {formatSeconds(metric.sector_3_seconds)}</span>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Micro-sector leaders</div>
            <div className="mt-3 space-y-2">
              {bestMicroSectors.map((sector) => (
                <div key={sector.segment} className="flex items-center justify-between text-xs text-zinc-300">
                  <span>
                    MS{sector.segment} • {sector.type}
                  </span>
                  <span>
                    {sector.leader} • +{sector.gap}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Corner Loss Breakdown</p>
        <div className="mt-4 space-y-3">
          {cornerBreakdown.slice(0, 4).map((corner) => (
            <div key={corner.corner} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{corner.corner}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">{corner.corner_type}</span>
              </div>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Entry</div>
                  <div className="mt-1 space-y-1">{renderDriverDeltaMap(corner.entry_delta)}</div>
                </div>
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Apex</div>
                  <div className="mt-1 space-y-1">{renderDriverDeltaMap(corner.apex_delta)}</div>
                </div>
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Exit</div>
                  <div className="mt-1 space-y-1">{renderDriverDeltaMap(corner.exit_delta)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Smart Analytics</p>
        <div className="mt-4 space-y-3 text-sm text-zinc-200">
          {performance.map((item) => (
            <div key={item.driver} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">{item.driver}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">{item.consistency_score.toFixed(1)} / 100</span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">{item.summary}</div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300">
                <div>Brake style: {item.braking_style}</div>
                <div>Throttle style: {item.throttle_style}</div>
                <div>Corner profile: {item.corner_profile}</div>
                {item.mistakes.length ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100">
                    {item.mistakes.join(" • ")}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                    No strong error signature detected on the selected lap set.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
