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
    .sort((left, right) => left - right);
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
  return grouped;
}

function topMicroSectors(microSectors: TelemetryMicroSector[] = []) {
  const grouped = new Map<number, TelemetryMicroSector[]>();
  microSectors.forEach((sector) => {
    grouped.set(sector.segment, [...(grouped.get(sector.segment) ?? []), sector]);
  });

  return Array.from(grouped.entries())
    .slice(0, 6)
    .map(([segment, sectors]) => {
      const sorted = [...sectors].sort((left, right) => left.delta_to_best - right.delta_to_best);
      return {
        segment,
        type: sectors[0]?.corner_type ?? "Mixed",
        leader: sorted[0]?.label ?? "--",
        gap: sorted[1] ? sorted[1].delta_to_best.toFixed(3) : "0.000",
      };
    });
}

function sameDriverLapSets(metrics: TelemetryDriverMetrics[]) {
  const grouped = new Map<string, TelemetryDriverMetrics[]>();
  metrics.forEach((metric) => {
    grouped.set(metric.driver, [...(grouped.get(metric.driver) ?? []), metric]);
  });
  return Array.from(grouped.entries())
    .map(([driver, laps]) => ({
      driver,
      laps: [...laps].sort(
        (left, right) =>
          (left.fastest_lap_seconds ?? Number.POSITIVE_INFINITY) -
          (right.fastest_lap_seconds ?? Number.POSITIVE_INFINITY),
      ),
    }))
    .filter((entry) => entry.laps.length > 1);
}

function buildDeltaPairReview(
  metrics: TelemetryDriverMetrics[],
  cornerBreakdown: TelemetryCornerBreakdown[],
  referenceKey?: string | null,
  comparisonKey?: string | null,
  focusedCorner?: string | null,
) {
  const reference = metrics.find((metric) => metric.series_key === referenceKey);
  const comparison = metrics.find((metric) => metric.series_key === comparisonKey);
  if (!reference || !comparison) {
    return null;
  }

  const lapGap =
    reference.fastest_lap_seconds != null && comparison.fastest_lap_seconds != null
      ? comparison.fastest_lap_seconds - reference.fastest_lap_seconds
      : null;

  const pairCornerRows = cornerBreakdown
    .map((corner) => {
      const referenceEntry = corner.entry_delta[reference.label] ?? 0;
      const comparisonEntry = corner.entry_delta[comparison.label] ?? 0;
      const referenceApex = corner.apex_delta[reference.label] ?? 0;
      const comparisonApex = corner.apex_delta[comparison.label] ?? 0;
      const referenceExit = corner.exit_delta[reference.label] ?? 0;
      const comparisonExit = corner.exit_delta[comparison.label] ?? 0;
      const total = comparisonEntry + comparisonApex + comparisonExit - (referenceEntry + referenceApex + referenceExit);

      return {
        corner: corner.corner,
        corner_type: corner.corner_type,
        total,
        entry: comparisonEntry - referenceEntry,
        apex: comparisonApex - referenceApex,
        exit: comparisonExit - referenceExit,
        brakingDelta: (corner.braking_points[comparison.label] ?? 0) - (corner.braking_points[reference.label] ?? 0),
        throttleDelta:
          (corner.throttle_pickups[comparison.label] ?? 0) - (corner.throttle_pickups[reference.label] ?? 0),
      };
    })
    .filter((corner) => Number.isFinite(corner.total));

  const strongestGain = [...pairCornerRows].sort((left, right) => left.total - right.total)[0] ?? null;
  const largestLoss = [...pairCornerRows].sort((left, right) => right.total - left.total)[0] ?? null;
  const focusCornerRow =
    pairCornerRows.find((corner) => corner.corner === focusedCorner) ?? strongestGain ?? largestLoss ?? null;

  return {
    reference,
    comparison,
    lapGap,
    strongestGain,
    largestLoss,
    focusCornerRow,
  };
}

function renderDriverDeltaMap(map: Record<string, number>) {
  return Object.entries(map)
    .sort(([, left], [, right]) => left - right)
    .slice(0, 3)
    .map(([label, value]) => (
      <div key={label} className="flex items-center justify-between text-xs text-zinc-300">
        <span>{label}</span>
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
  referenceKey,
  comparisonKey,
  focusedCorner,
}: {
  metrics: TelemetryDriverMetrics[];
  lapOptions?: TelemetryLapOption[];
  microSectors?: TelemetryMicroSector[];
  cornerBreakdown?: TelemetryCornerBreakdown[];
  performance?: TelemetryPerformanceSummary[];
  referenceKey?: string | null;
  comparisonKey?: string | null;
  focusedCorner?: string | null;
}) {
  const ideal = idealLap(metrics);
  const delta = deltaValue(metrics);
  const leader = metrics
    .filter((metric) => typeof metric.fastest_lap_seconds === "number")
    .sort((left, right) => (left.fastest_lap_seconds ?? Infinity) - (right.fastest_lap_seconds ?? Infinity))[0];
  const lapGroups = summarizeLapOptions(lapOptions);
  const bestMicroSectors = topMicroSectors(microSectors);
  const driverLapSets = sameDriverLapSets(metrics);
  const deltaPairReview = buildDeltaPairReview(metrics, cornerBreakdown, referenceKey, comparisonKey, focusedCorner);

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
              <span className="mt-2 block text-xl font-semibold">{delta != null ? `+${delta.toFixed(3)}s` : "--"}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
              <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Reference Lap</span>
              <span className="mt-2 block text-xl font-semibold">{leader ? leader.label : "--"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Selected Laps</p>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => (
            <div key={metric.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{metric.label}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {metric.compound ?? "N/A"} • {metric.team}
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                Best traced lap {formatSeconds(metric.fastest_lap_seconds)} with {lapGroups.get(metric.driver) ?? 0} lap choices loaded
              </div>
            </div>
          ))}
        </div>
      </div>

      {driverLapSets.length ? (
        <div className="f1-panel rounded-[28px] p-4 sm:p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Same-Driver Lap Set Review</p>
          <div className="mt-4 space-y-3">
            {driverLapSets.map((entry) => {
              const best = entry.laps[0];
              const slowest = entry.laps.at(-1);
              const gap =
                best?.fastest_lap_seconds != null && slowest?.fastest_lap_seconds != null
                  ? slowest.fastest_lap_seconds - best.fastest_lap_seconds
                  : null;
              return (
                <div key={entry.driver} className="rounded-2xl border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{entry.driver}</span>
                    <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      {entry.laps.length} overlays
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Best {best ? best.label : "--"} vs slowest {slowest ? slowest.label : "--"}
                    {gap != null ? ` • gap ${gap.toFixed(3)}s` : ""}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.laps.map((lap) => (
                      <span
                        key={lap.series_key}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-zinc-300"
                      >
                        {lap.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {deltaPairReview ? (
        <div className="f1-panel rounded-[28px] p-4 sm:p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Delta Pair Review</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="text-sm font-medium text-white">
                {deltaPairReview.comparison.label} vs {deltaPairReview.reference.label}
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {deltaPairReview.lapGap != null
                  ? `Selected lap gap: ${deltaPairReview.lapGap > 0 ? "+" : ""}${deltaPairReview.lapGap.toFixed(3)}s against the reference trace.`
                  : "Lap gap unavailable for the selected traces."}
              </div>
            </div>
            {deltaPairReview.strongestGain ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
                Strongest gain: {deltaPairReview.comparison.driver} looks best at {deltaPairReview.strongestGain.corner} ({deltaPairReview.strongestGain.corner_type}) with {deltaPairReview.strongestGain.total.toFixed(3)}s relative swing.
              </div>
            ) : null}
            {deltaPairReview.largestLoss ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                Largest loss: {deltaPairReview.comparison.driver} gives away the most at {deltaPairReview.largestLoss.corner} ({deltaPairReview.largestLoss.corner_type}) with +{deltaPairReview.largestLoss.total.toFixed(3)}s.
              </div>
            ) : null}
            {deltaPairReview.focusCornerRow ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">
                  {focusedCorner ? `Focused Corner: ${focusedCorner}` : "Priority Corner"}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-zinc-300">
                  <div>Entry delta: {deltaPairReview.focusCornerRow.entry.toFixed(3)}s</div>
                  <div>Apex delta: {deltaPairReview.focusCornerRow.apex.toFixed(3)}s</div>
                  <div>Exit delta: {deltaPairReview.focusCornerRow.exit.toFixed(3)}s</div>
                  <div>Brake point shift: {deltaPairReview.focusCornerRow.brakingDelta.toFixed(1)}m</div>
                  <div>Throttle pickup shift: {deltaPairReview.focusCornerRow.throttleDelta.toFixed(1)}m</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Sector & Micro-Sector Analysis</p>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => (
            <div key={metric.series_key} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
              <div className="font-medium text-white">{metric.label}</div>
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
            <div key={item.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">{item.label}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {item.consistency_score.toFixed(1)} / 100
                </span>
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
