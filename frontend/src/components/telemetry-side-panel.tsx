"use client";

import {
  TelemetryBenchmarkRanking,
  TelemetryCacheMetadata,
  TelemetryCornerBreakdown,
  TelemetryDriverMetrics,
  TelemetryLapOption,
  TelemetryMicroSector,
  TelemetryPairDelta,
  TelemetryPerformanceSummary,
  TelemetrySeries,
} from "@/types/api";

function formatSeconds(value?: number | null) {
  return typeof value === "number" ? `${value.toFixed(3)}s` : "--";
}

function formatSignedSeconds(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(3)}s`;
}

function formatMeters(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}m` : "--";
}

function formatRank(value?: number | null) {
  return typeof value === "number" ? `P${value}` : "--";
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

function summarizeLapSetConsistency(
  entry: ReturnType<typeof sameDriverLapSets>[number],
  performance: TelemetryPerformanceSummary[],
) {
  const lapTimes = entry.laps
    .map((lap) => lap.fastest_lap_seconds)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const consistencyScores = entry.laps
    .map((lap) => performance.find((item) => item.series_key === lap.series_key)?.consistency_score)
    .filter((value): value is number => typeof value === "number");

  const spread = lapTimes.length > 1 ? lapTimes[lapTimes.length - 1] - lapTimes[0] : null;
  const averageLap =
    lapTimes.length ? lapTimes.reduce((sum, value) => sum + value, 0) / lapTimes.length : null;
  const bestConsistency = consistencyScores.length ? Math.max(...consistencyScores) : null;

  return { spread, averageLap, bestConsistency };
}

function cornerDisplayName(corner: Pick<TelemetryCornerBreakdown, "corner" | "corner_label">) {
  return corner.corner_label || corner.corner;
}

function buildLapBenchmarkRanking(
  metrics: TelemetryDriverMetrics[],
  performance: TelemetryPerformanceSummary[],
  cornerBreakdown: TelemetryCornerBreakdown[],
  benchmarkRankings: TelemetryBenchmarkRanking[],
) {
  const metricsByKey = new Map(metrics.map((metric) => [metric.series_key, metric]));
  if (benchmarkRankings.length) {
    return benchmarkRankings
      .map((ranking) => {
        const metric = metricsByKey.get(ranking.series_key);
        if (!metric) {
          return null;
        }
        return {
          metric,
          rank: ranking.overall_rank,
          deltaToBest: ranking.lap_delta_to_best,
          mainLossCorner: ranking.main_loss_corner,
          mainLossSeconds: ranking.main_loss_seconds,
          coachingFocus: performance.find((item) => item.series_key === ranking.series_key)?.coaching_focus,
          benchmarkSummary: ranking.summary,
          brakingRank: ranking.braking_rank,
          apexRank: ranking.apex_rank,
          exitRank: ranking.exit_rank,
          straightLineRank: ranking.straight_line_rank,
          consistencyRank: ranking.consistency_rank,
          backendOwned: true,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  const performanceByKey = new Map(performance.map((item) => [item.series_key, item]));
  const timedMetrics = metrics
    .filter((metric) => typeof metric.fastest_lap_seconds === "number")
    .sort((left, right) => (left.fastest_lap_seconds ?? Infinity) - (right.fastest_lap_seconds ?? Infinity));
  const bestLap = timedMetrics[0]?.fastest_lap_seconds ?? null;

  return timedMetrics.map((metric, index) => {
    const cornerTotals = cornerBreakdown.map((corner) => ({
      corner,
      total:
        (corner.entry_delta[metric.label] ?? 0) +
        (corner.apex_delta[metric.label] ?? 0) +
        (corner.exit_delta[metric.label] ?? 0),
    }));
    const biggestDeficit = [...cornerTotals].sort((left, right) => right.total - left.total)[0];
    const bestCorner = [...cornerTotals].sort((left, right) => left.total - right.total)[0];
    const performanceItem = performanceByKey.get(metric.series_key);

    return {
      metric,
      rank: performanceItem?.lap_rank ?? index + 1,
      deltaToBest:
        performanceItem?.delta_to_best_seconds ??
        (bestLap != null && metric.fastest_lap_seconds != null ? metric.fastest_lap_seconds - bestLap : null),
      biggestDeficit: biggestDeficit?.total > 0.02 ? biggestDeficit : null,
      bestCorner: bestCorner && bestCorner.total <= 0.01 ? bestCorner : null,
      coachingFocus: performanceItem?.coaching_focus,
      benchmarkSummary: performanceItem?.benchmark_summary,
      backendOwned: false,
    };
  });
}

function buildDeltaPairReview(
  metrics: TelemetryDriverMetrics[],
  cornerBreakdown: TelemetryCornerBreakdown[],
  referenceKey?: string | null,
  comparisonKey?: string | null,
  focusedCorner?: string | null,
  pairDeltas: TelemetryPairDelta[] = [],
) {
  const reference = metrics.find((metric) => metric.series_key === referenceKey);
  const comparison = metrics.find((metric) => metric.series_key === comparisonKey);
  if (!reference || !comparison) {
    return null;
  }
  const backendPair = pairDeltas.find(
    (pair) =>
      pair.reference_series_key === reference.series_key &&
      pair.comparison_series_key === comparison.series_key,
  );

  if (backendPair) {
    const pairCornerRows = backendPair.corner_deltas
      .map((corner) => ({
        corner: corner.corner,
        cornerType: corner.corner_type,
        total: corner.total_delta,
        entry: corner.entry_delta,
        apex: corner.apex_delta,
        exit: corner.exit_delta,
        label: corner.corner_label || corner.corner,
        hint: null,
        brakingDelta: corner.braking_point_delta ?? 0,
        throttleDelta: corner.throttle_pickup_delta ?? 0,
      }))
      .filter((corner) => Number.isFinite(corner.total));
    const strongestGain = [...pairCornerRows].sort((left, right) => left.total - right.total)[0] ?? null;
    const largestLoss = [...pairCornerRows].sort((left, right) => right.total - left.total)[0] ?? null;
    const focusCornerRow =
      pairCornerRows.find((corner) => corner.corner === focusedCorner) ?? strongestGain ?? largestLoss ?? null;

    return {
      reference,
      comparison,
      lapGap: backendPair.lap_delta ?? null,
      strongestGain,
      largestLoss,
      focusCornerRow,
      summary: backendPair.summary,
      backendOwned: true,
    };
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
      const total =
        comparisonEntry + comparisonApex + comparisonExit - (referenceEntry + referenceApex + referenceExit);

      return {
        corner: corner.corner,
        cornerType: corner.corner_type,
        total,
        entry: comparisonEntry - referenceEntry,
        apex: comparisonApex - referenceApex,
        exit: comparisonExit - referenceExit,
        label: cornerDisplayName(corner),
        hint: corner.corner_hint,
        brakingDelta:
          (corner.braking_points[comparison.label] ?? 0) - (corner.braking_points[reference.label] ?? 0),
        throttleDelta:
          (corner.throttle_pickups[comparison.label] ?? 0) -
          (corner.throttle_pickups[reference.label] ?? 0),
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
    summary: null,
    backendOwned: false,
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

function nearestPointAtDistance(series: TelemetrySeries, distance: number) {
  if (!series.points.length) {
    return null;
  }
  return series.points.reduce((closest, point) => {
    if (!closest) {
      return point;
    }
    return Math.abs(point.distance - distance) < Math.abs(closest.distance - distance) ? point : closest;
  }, series.points[0]);
}

function interpretationGuide(
  hasWindow: boolean,
  focusedCorner?: string | null,
  hoveredDistance?: number | null,
  hasDeltaPair?: boolean,
) {
  return [
    hasWindow
      ? `The workspace is zoomed into a distance slice${focusedCorner ? ` around ${focusedCorner}` : ""}. Compare braking, minimum speed, and throttle pickup inside this narrower window before trusting whole-lap averages.`
      : "Start with the full-lap view to spot broad patterns, then zoom into the corners where the delta line swings most sharply.",
    hoveredDistance != null
      ? `Use the live cursor at ${Math.round(hoveredDistance)}m to read every signal at the exact same track point across all selected traces.`
      : "Hover any chart to inspect the same distance point across speed, throttle, brake, steering, gear, RPM, and delta at once.",
    hasDeltaPair
      ? "Treat the selected delta pair as the coaching view: negative delta means the comparison trace is faster than the reference, while positive delta means it is losing time."
      : "Choose two traces in the Delta Pair controls to turn the workspace from a display into a coaching tool.",
  ];
}

export function TelemetrySidePanel({
  metrics,
  lapOptions = [],
  microSectors = [],
  cornerBreakdown = [],
  performance = [],
  benchmarkRankings = [],
  pairDeltas = [],
  cacheMetadata,
  unavailableReason,
  referenceKey,
  comparisonKey,
  focusedCorner,
  hoveredDistance,
  series = [],
  hasWindow = false,
}: {
  metrics: TelemetryDriverMetrics[];
  lapOptions?: TelemetryLapOption[];
  microSectors?: TelemetryMicroSector[];
  cornerBreakdown?: TelemetryCornerBreakdown[];
  performance?: TelemetryPerformanceSummary[];
  benchmarkRankings?: TelemetryBenchmarkRanking[];
  pairDeltas?: TelemetryPairDelta[];
  cacheMetadata?: TelemetryCacheMetadata | null;
  unavailableReason?: string | null;
  referenceKey?: string | null;
  comparisonKey?: string | null;
  focusedCorner?: string | null;
  hoveredDistance?: number | null;
  series?: TelemetrySeries[];
  hasWindow?: boolean;
}) {
  const ideal = idealLap(metrics);
  const delta = deltaValue(metrics);
  const leader = metrics
    .filter((metric) => typeof metric.fastest_lap_seconds === "number")
    .sort((left, right) => (left.fastest_lap_seconds ?? Infinity) - (right.fastest_lap_seconds ?? Infinity))[0];
  const lapGroups = summarizeLapOptions(lapOptions);
  const bestMicroSectors = topMicroSectors(microSectors);
  const driverLapSets = sameDriverLapSets(metrics);
  const deltaPairReview = buildDeltaPairReview(
    metrics,
    cornerBreakdown,
    referenceKey,
    comparisonKey,
    focusedCorner,
    pairDeltas,
  );
  const liveReadout =
    hoveredDistance != null
      ? series
          .map((trace) => ({
            trace,
            point: nearestPointAtDistance(trace, hoveredDistance),
          }))
          .filter((item) => item.point)
      : [];
  const readingGuide = interpretationGuide(
    hasWindow,
    focusedCorner,
    hoveredDistance,
    Boolean(deltaPairReview),
  );
  const lapBenchmarkRanking = buildLapBenchmarkRanking(metrics, performance, cornerBreakdown, benchmarkRankings);
  const lowConfidenceCorners = cornerBreakdown.filter(
    (corner) => corner.segmentation_quality === "low" || (corner.confidence_score ?? 100) < 55,
  );

  return (
    <aside className="space-y-4">
      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          How To Read This Workspace
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This rail explains what each telemetry block means in race-engineering terms, so users can
          move from raw traces to an actual conclusion.
        </p>
        <div className="mt-4 space-y-3">
          {readingGuide.map((line, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Performance Snapshot
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Use this block to anchor the session. Ideal lap shows the theoretical best lap from the best
          sector combination, while lap delta and reference lap show the raw pace gap before you drill
          into the traces.
        </p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-white">
            <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-fuchsia-200">Ideal Lap</span>
            <span className="mt-2 block text-2xl font-semibold">
              {ideal ? `${ideal.toFixed(3)}s` : "--"}
            </span>
            <span className="mt-2 block text-xs leading-5 text-fuchsia-100/80">
              A lower ideal lap means the selected traces contain more untapped time if the best sectors
              can be combined into one complete lap.
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
              <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Lap Delta</span>
              <span className="mt-2 block text-xl font-semibold">
                {delta != null ? `+${delta.toFixed(3)}s` : "--"}
              </span>
              <span className="mt-2 block text-xs leading-5 text-zinc-400">
                This is the top-line gap between the two fastest selected traces. Use it to decide whether
                a corner-level difference is meaningful or just noise.
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
              <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Reference Lap</span>
              <span className="mt-2 block text-xl font-semibold">{leader ? leader.label : "--"}</span>
              <span className="mt-2 block text-xs leading-5 text-zinc-400">
                The reference lap is the pace anchor. Other traces should be read as either matching it,
                beating it, or giving time away to it.
              </span>
            </div>
          </div>
        </div>
      </div>

      {lapBenchmarkRanking.length ? (
        <div className="f1-panel rounded-[28px] p-4 sm:p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Lap Benchmark Ranking
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This ranks only the selected traces, so it behaves like a benchmark table for the laps currently
            on screen. Use the corner note to jump straight from ranking to the reason behind the gap.
          </p>
          <div className="mt-4 space-y-3">
            {lapBenchmarkRanking.map((row) => (
              <div key={row.metric.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      P{row.rank} {row.metric.label}
                    </div>
                    <div className="mt-1 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
                      {formatSeconds(row.metric.fastest_lap_seconds)} /{" "}
                      {row.deltaToBest != null ? `${formatSignedSeconds(row.deltaToBest)} to best` : "gap unavailable"}
                    </div>
                  </div>
                  <div className="text-right text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
                    {row.metric.compound ?? "N/A"}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-400">
                  <div>{row.benchmarkSummary ?? "Benchmark summary unavailable for this trace."}</div>
                  <div>
                    {"mainLossCorner" in row && row.mainLossCorner
                      ? `Main loss: ${row.mainLossCorner} (${formatSignedSeconds(row.mainLossSeconds)}).`
                      : "biggestDeficit" in row && row.biggestDeficit
                        ? `Main loss: ${cornerDisplayName(row.biggestDeficit.corner)} (${formatSignedSeconds(
                            row.biggestDeficit.total,
                          )}).`
                        : "bestCorner" in row && row.bestCorner
                          ? `Best matched corner: ${cornerDisplayName(row.bestCorner.corner)}.`
                          : "Corner losses are evenly spread across the selected trace."}
                  </div>
                  {"brakingRank" in row ? (
                    <div className="grid gap-1 text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500 sm:grid-cols-2">
                      <span>Brake {formatRank(row.brakingRank)}</span>
                      <span>Apex {formatRank(row.apexRank)}</span>
                      <span>Exit {formatRank(row.exitRank)}</span>
                      <span>Straight {formatRank(row.straightLineRank)}</span>
                      <span className="sm:col-span-2">Consistency {formatRank(row.consistencyRank)}</span>
                    </div>
                  ) : null}
                  {row.coachingFocus ? <div>Coaching cue: {row.coachingFocus}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">Selected Laps</p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Each selected lap becomes its own trace. Overlay sets let you compare different drivers or
          multiple laps from the same driver without losing track of which exact lap is on screen.
        </p>
        <div className="mt-4 space-y-3">
          {metrics.map((metric) => (
            <div key={metric.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{metric.label}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {metric.compound ?? "N/A"} / {metric.team}
                </span>
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">
                Best traced lap {formatSeconds(metric.fastest_lap_seconds)} with{" "}
                {lapGroups.get(metric.driver) ?? 0} lap choices loaded. Use compound, lap time, and team
                context before making a direct pace judgment.
              </div>
            </div>
          ))}
        </div>
      </div>

      {hoveredDistance != null && liveReadout.length ? (
        <div className="f1-panel rounded-[28px] p-4 sm:p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Live Cursor Readout
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This readout answers the most useful question in telemetry: what are all cars doing at the same
            point on track right now?
          </p>
          <div className="mt-2 text-xs text-zinc-400">Distance {Math.round(hoveredDistance)}m</div>
          <div className="mt-4 space-y-3">
            {liveReadout.map(({ trace, point }) => (
              <div key={trace.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
                <div className="text-sm font-medium text-white">{trace.label}</div>
                <div className="mt-2 text-xs leading-5 text-zinc-400">
                  Compare brake release, throttle pickup, steering angle, and minimum speed together here to
                  understand why one line is faster than another.
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300">
                  <span>Speed: {point ? `${point.speed.toFixed(1)} km/h` : "--"}</span>
                  <span>Throttle: {point ? `${point.throttle.toFixed(1)}%` : "--"}</span>
                  <span>Brake: {point ? `${point.brake.toFixed(1)}%` : "--"}</span>
                  <span>Gear: {point ? `G${Math.round(point.gear)}` : "--"}</span>
                  <span>RPM: {point?.rpm != null ? Math.round(point.rpm).toString() : "--"}</span>
                  <span>Steering: {point?.steering != null ? `${point.steering.toFixed(1)} deg` : "--"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {driverLapSets.length ? (
        <div className="f1-panel rounded-[28px] p-4 sm:p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Same-Driver Lap Set Review
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            These summaries are for consistency checks. Small spread means the driver repeated the same
            lap shape well; larger spread usually points to tyre drop-off, traffic, or execution errors.
          </p>
          <div className="mt-4 space-y-3">
            {driverLapSets.map((entry) => {
              const best = entry.laps[0];
              const slowest = entry.laps.at(-1);
              const setSummary = summarizeLapSetConsistency(entry, performance);
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
                  <div className="mt-2 text-xs leading-5 text-zinc-400">
                    Best {best ? best.label : "--"} vs slowest {slowest ? slowest.label : "--"}
                    {gap != null ? `, gap ${gap.toFixed(3)}s.` : "."} Read this block as a repeatability
                    test rather than a one-lap pace battle.
                  </div>
                  <div className="mt-2 grid gap-2 text-[0.68rem] text-zinc-400 sm:grid-cols-2">
                    <span>
                      Average lap: {setSummary.averageLap != null ? `${setSummary.averageLap.toFixed(3)}s` : "--"}
                    </span>
                    <span>Set spread: {setSummary.spread != null ? `${setSummary.spread.toFixed(3)}s` : "--"}</span>
                    <span className="sm:col-span-2">
                      Best consistency:{" "}
                      {setSummary.bestConsistency != null
                        ? `${setSummary.bestConsistency.toFixed(1)} / 100`
                        : "--"}
                    </span>
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
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Delta Pair Review
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            This is the coaching view. Read it as the answer to "why is one lap faster?" not just "which lap
            is faster?"
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="text-sm font-medium text-white">
                {deltaPairReview.comparison.label} vs {deltaPairReview.reference.label}
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">
                {deltaPairReview.lapGap != null
                  ? `Selected lap gap: ${deltaPairReview.lapGap > 0 ? "+" : ""}${deltaPairReview.lapGap.toFixed(3)}s against the reference trace. Negative gap means the comparison trace is faster overall.`
                  : "Lap gap unavailable for the selected traces."}
                {deltaPairReview.summary ? ` ${deltaPairReview.summary}` : ""}
              </div>
              {deltaPairReview.backendOwned ? (
                <div className="mt-2 text-[0.62rem] uppercase tracking-[0.18em] text-zinc-500">
                  Backend pair-delta contract
                </div>
              ) : null}
            </div>
            {deltaPairReview.strongestGain ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs leading-5 text-emerald-100">
                Strongest gain: {deltaPairReview.comparison.driver} looks best at{" "}
                {deltaPairReview.strongestGain.label} ({deltaPairReview.strongestGain.cornerType}) with{" "}
                {deltaPairReview.strongestGain.total.toFixed(3)}s relative swing. This is the corner to study
                first when searching for free lap time.
              </div>
            ) : null}
            {deltaPairReview.largestLoss ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-100">
                Largest loss: {deltaPairReview.comparison.driver} gives away the most at{" "}
                {deltaPairReview.largestLoss.label} ({deltaPairReview.largestLoss.cornerType}) with{" "}
                {formatSignedSeconds(deltaPairReview.largestLoss.total)}. This is where the comparison trace is
                most at risk.
              </div>
            ) : null}
            {deltaPairReview.focusCornerRow ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">
                  {focusedCorner ? `Focused Corner: ${focusedCorner}` : "Priority Corner"}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {deltaPairReview.focusCornerRow.label}
                </div>
                <div className="mt-2 text-xs leading-5 text-zinc-400">
                  {deltaPairReview.focusCornerRow.hint
                    ? `${deltaPairReview.focusCornerRow.hint}. `
                    : ""}
                  Entry reflects initial braking and rotation, apex reflects minimum-speed behavior, and exit
                  reflects traction and throttle pickup quality.
                </div>
                <div className="mt-3 grid gap-2 text-xs text-zinc-300">
                  <div>Entry delta: {formatSignedSeconds(deltaPairReview.focusCornerRow.entry)}</div>
                  <div>Apex delta: {formatSignedSeconds(deltaPairReview.focusCornerRow.apex)}</div>
                  <div>Exit delta: {formatSignedSeconds(deltaPairReview.focusCornerRow.exit)}</div>
                  <div>Brake point shift: {formatMeters(deltaPairReview.focusCornerRow.brakingDelta)}</div>
                  <div>Throttle pickup shift: {formatMeters(deltaPairReview.focusCornerRow.throttleDelta)}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Sector And Micro-Sector Analysis
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Sectors tell you where the lap moved in broad chunks. Micro-sectors narrow that down into smaller
          slices so you can isolate whether the gain came on corner entry, a direction change, or the exit run.
        </p>
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
            <div className="mt-2 text-xs leading-5 text-zinc-400">
              These are the smallest parts of the lap where one trace leads the group. Use them to identify the
              exact zones driving the delta chart.
            </div>
            <div className="mt-3 space-y-2">
              {bestMicroSectors.map((sector) => (
                <div key={sector.segment} className="flex items-center justify-between text-xs text-zinc-300">
                  <span>
                    MS{sector.segment} / {sector.type}
                  </span>
                  <span>
                    {sector.leader} / +{sector.gap}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Corner Loss Breakdown
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Entry is where the car comes off the brake and commits to turn-in. Apex is the minimum-speed center
          of the corner. Exit is where the lap either starts making time again or keeps losing it.
        </p>
        <div className="mt-4 space-y-3">
          {cornerBreakdown.slice(0, 4).map((corner) => (
            <div key={corner.corner} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{cornerDisplayName(corner)}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {corner.corner_type} / {corner.segmentation_quality ?? "unchecked"}
                </span>
              </div>
              {corner.corner_hint ? (
                <div className="mt-2 text-xs leading-5 text-zinc-500">{corner.corner_hint}</div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-zinc-500">
                <span>Confidence {corner.confidence_score != null ? `${corner.confidence_score.toFixed(1)}%` : "--"}</span>
                {corner.official_corner_name ? <span>Official: {corner.official_corner_name}</span> : null}
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
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Telemetry Data Quality
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Backend diagnostics explain how much trust to place in the computed corner model and whether the
          response came from a cached FastF1 telemetry bundle.
        </p>
        <div className="mt-4 grid gap-3 text-xs text-zinc-300">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>Cache: {cacheMetadata?.cache_hit ? "hit" : "fresh or unavailable"}</div>
            <div className="mt-1 text-zinc-500">Series: {cacheMetadata?.series_count ?? metrics.length}</div>
            {cacheMetadata?.generated_at ? (
              <div className="mt-1 text-zinc-500">Generated: {new Date(cacheMetadata.generated_at).toLocaleString()}</div>
            ) : null}
            {cacheMetadata?.cache_key ? <div className="mt-1 break-all text-zinc-500">Key: {cacheMetadata.cache_key}</div> : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>Unavailable reason: {unavailableReason ?? cacheMetadata?.unavailable_reason ?? "none"}</div>
            <div className="mt-1 text-zinc-500">
              Low-confidence corners: {lowConfidenceCorners.length ? lowConfidenceCorners.map(cornerDisplayName).join(", ") : "none"}
            </div>
          </div>
          {cacheMetadata?.diagnostics?.length ? (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-yellow-100">
              {cacheMetadata.diagnostics.slice(0, 3).join(" / ")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="f1-panel rounded-[28px] p-4 sm:p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Smart Analytics
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          These summaries are derived from FastF1 telemetry, not copied verbatim from the feed. Treat them as
          analyst heuristics that help you notice patterns faster, then confirm them against the traces.
        </p>
        <div className="mt-4 space-y-3 text-sm text-zinc-200">
          {performance.map((item) => (
            <div key={item.series_key} className="rounded-2xl border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">{item.label}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {item.consistency_score.toFixed(1)} / 100
                </span>
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">{item.summary}</div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300">
                {item.benchmark_summary ? <div>Benchmark: {item.benchmark_summary}</div> : null}
                {item.coaching_focus ? <div>Coaching focus: {item.coaching_focus}</div> : null}
                <div>Brake style: {item.braking_style}</div>
                <div>Throttle style: {item.throttle_style}</div>
                <div>Corner profile: {item.corner_profile}</div>
                {item.mistakes.length ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100">
                    {item.mistakes.join(" / ")}
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
