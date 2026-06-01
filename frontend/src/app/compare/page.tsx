"use client";

import { useEffect, useMemo, useState } from "react";

import { CompareSpectrum } from "@/components/compare-spectrum";
import { DataSourcePanel } from "@/components/data-source-panel";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { getSeasonCalendar, getTelemetry, getWeekendContext } from "@/services/api";
import {
  SeasonCalendarResponse,
  TelemetryBenchmarkRanking,
  TelemetryDriverMetrics,
  TelemetryLapOption,
  TelemetryPairDelta,
  TelemetryResponse,
  WeekendContextResponse,
} from "@/types/api";

const defaultSession = {
  year: new Date().getFullYear(),
  grandPrix: "",
  session: "Q",
};

function formatSeconds(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(3)}s` : "--";
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

function normalizeLapSelections(
  current: Record<string, number[]>,
  selectedDrivers: string[],
  options: TelemetryLapOption[],
) {
  const next: Record<string, number[]> = {};
  selectedDrivers.forEach((driver) => {
    const driverOptions = options.filter((option) => option.driver === driver);
    const selected = current[driver]?.find((lapNumber) =>
      driverOptions.some((option) => option.lap_number === lapNumber),
    );
    const fallback = driverOptions.find((option) => option.is_best) ?? driverOptions[0];
    if (selected) {
      next[driver] = [selected];
    } else if (fallback) {
      next[driver] = [fallback.lap_number];
    }
  });
  return next;
}

function areLapSelectionsEqual(left: Record<string, number[]>, right: Record<string, number[]>) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key]?.[0] === right[key]?.[0])
  );
}

function rankingFor(metric: TelemetryDriverMetrics | undefined, rankings: TelemetryBenchmarkRanking[]) {
  return metric ? rankings.find((ranking) => ranking.series_key === metric.series_key) : undefined;
}

function pairFor(
  left: TelemetryDriverMetrics | undefined,
  right: TelemetryDriverMetrics | undefined,
  pairs: TelemetryPairDelta[],
) {
  if (!left || !right) {
    return undefined;
  }
  return pairs.find(
    (pair) => pair.reference_series_key === left.series_key && pair.comparison_series_key === right.series_key,
  );
}

function pairVerdict(pair: TelemetryPairDelta | undefined, left: TelemetryDriverMetrics | undefined, right: TelemetryDriverMetrics | undefined) {
  if (!left || !right) {
    return "Select two drivers and laps to generate a FastF1-backed comparison verdict.";
  }
  if (!pair || pair.lap_delta == null) {
    return `${left.label} and ${right.label} are loaded, but the backend does not have enough complete lap timing to produce a lap-delta verdict.`;
  }
  if (pair.lap_delta < -0.001) {
    return `${right.label} is faster than ${left.label} by ${Math.abs(pair.lap_delta).toFixed(3)}s on the selected laps.`;
  }
  if (pair.lap_delta > 0.001) {
    return `${left.label} is faster than ${right.label} by ${pair.lap_delta.toFixed(3)}s on the selected laps.`;
  }
  return `${left.label} and ${right.label} are effectively matched on the selected laps.`;
}

function bestAndWorstCorners(pair: TelemetryPairDelta | undefined) {
  const sorted = [...(pair?.corner_deltas ?? [])].sort((left, right) => left.total_delta - right.total_delta);
  return {
    gain: sorted[0],
    loss: sorted.at(-1),
  };
}

function buildDebrief(
  session: typeof defaultSession,
  left: TelemetryDriverMetrics | undefined,
  right: TelemetryDriverMetrics | undefined,
  pair: TelemetryPairDelta | undefined,
  leftRanking: TelemetryBenchmarkRanking | undefined,
  rightRanking: TelemetryBenchmarkRanking | undefined,
  data: TelemetryResponse | null,
) {
  if (!left || !right) {
    return "";
  }
  const corners = bestAndWorstCorners(pair);
  return [
    `${session.grandPrix} ${session.year} ${session.session} driver comparison`,
    `${left.label}: ${formatSeconds(left.fastest_lap_seconds)}, ${left.compound ?? "compound unavailable"}, top speed ${left.top_speed.toFixed(1)} km/h`,
    `${right.label}: ${formatSeconds(right.fastest_lap_seconds)}, ${right.compound ?? "compound unavailable"}, top speed ${right.top_speed.toFixed(1)} km/h`,
    pair ? pair.summary : pairVerdict(pair, left, right),
    leftRanking ? `${left.label} ranks ${formatRank(leftRanking.overall_rank)} overall, braking ${formatRank(leftRanking.braking_rank)}, apex ${formatRank(leftRanking.apex_rank)}, exit ${formatRank(leftRanking.exit_rank)}.` : null,
    rightRanking ? `${right.label} ranks ${formatRank(rightRanking.overall_rank)} overall, braking ${formatRank(rightRanking.braking_rank)}, apex ${formatRank(rightRanking.apex_rank)}, exit ${formatRank(rightRanking.exit_rank)}.` : null,
    corners.gain ? `Strongest relative gain for comparison trace: ${corners.gain.corner_label ?? corners.gain.corner} (${formatSignedSeconds(corners.gain.total_delta)}).` : null,
    corners.loss ? `Largest relative loss for comparison trace: ${corners.loss.corner_label ?? corners.loss.corner} (${formatSignedSeconds(corners.loss.total_delta)}).` : null,
    `Data quality: ${data?.cache_metadata?.series_count ?? 0} trace(s), cache ${data?.cache_metadata?.cache_hit ? "hit" : "fresh"}, unavailable reason ${data?.unavailable_reason ?? "none"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ComparePage() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [weekendContext, setWeekendContext] = useState<WeekendContextResponse | null>(null);
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [lapSelections, setLapSelections] = useState<Record<string, number[]>>({});
  const [driverSearch, setDriverSearch] = useState(["", ""]);
  const [session, setSession] = useState(defaultSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setCalendar(null);
    setWeekendContext(null);
    setData(null);
    setError("");

    getSeasonCalendar(session.year, token ?? undefined)
      .then((response) => {
        if (!active) {
          return;
        }
        setCalendar(response);
        setSession((current) => ({
          ...current,
          grandPrix: response.races[0]?.track ?? current.grandPrix,
          session: response.available_sessions.includes(current.session)
            ? current.session
            : response.available_sessions[0] ?? current.session,
        }));
      })
      .catch((loadError: Error) => {
        if (active) {
          setError(loadError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [session.year, token]);

  useEffect(() => {
    if (!token || !session.grandPrix) {
      return;
    }

    let active = true;
    setWeekendContext(null);
    setData(null);
    setLapSelections({});
    setError("");

    getWeekendContext(session, token ?? undefined)
      .then((response) => {
        if (!active) {
          return;
        }
        setWeekendContext(response);
        setSelectedDrivers((current) => {
          const available = response.drivers.map((driver) => driver.name);
          return current.length === 2 && current.every((driver) => available.includes(driver))
            ? current
            : available.slice(0, 2);
        });
      })
      .catch((loadError: Error) => {
        if (active) {
          setError(loadError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [session.grandPrix, session.session, session.year, token]);

  const telemetryRequestKey = useMemo(
    () =>
      JSON.stringify({
        session,
        drivers: selectedDrivers,
        laps: selectedDrivers.map((driver) => `${driver}:${lapSelections[driver]?.[0] ?? "best"}`),
      }),
    [lapSelections, selectedDrivers, session],
  );

  useEffect(() => {
    if (!token || !session.grandPrix || selectedDrivers.length !== 2) {
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    const currentLapSelections = selectedDrivers.reduce<Record<string, number[]>>((output, driver) => {
      if (lapSelections[driver]?.length) {
        output[driver] = lapSelections[driver];
      }
      return output;
    }, {});

    getTelemetry(selectedDrivers, { ...session, lapSelections: currentLapSelections }, token ?? undefined)
      .then((response) => {
        if (!active) {
          return;
        }
        setData(response);
        setLapSelections((current) => {
          const normalized = normalizeLapSelections(current, selectedDrivers, response.lap_options ?? []);
          return areLapSelectionsEqual(current, normalized) ? current : normalized;
        });
      })
      .catch((loadError: Error) => {
        if (active) {
          setData(null);
          setError(loadError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [telemetryRequestKey, token]);

  const comparison = data?.metrics ?? [];
  const left = comparison.find((metric) => metric.driver === selectedDrivers[0]) ?? comparison[0];
  const right = comparison.find((metric) => metric.driver === selectedDrivers[1]) ?? comparison.find((metric) => metric.series_key !== left?.series_key);
  const leftRanking = rankingFor(left, data?.benchmark_rankings ?? []);
  const rightRanking = rankingFor(right, data?.benchmark_rankings ?? []);
  const leftToRightPair = pairFor(left, right, data?.pair_deltas ?? []);
  const rightToLeftPair = pairFor(right, left, data?.pair_deltas ?? []);
  const corners = bestAndWorstCorners(leftToRightPair);
  const debrief = buildDebrief(session, left, right, leftToRightPair, leftRanking, rightRanking, data);

  const driverOptions = useMemo(() => {
    return [0, 1].map((index) => {
      const query = driverSearch[index]?.trim().toLowerCase() ?? "";
      const drivers = weekendContext?.drivers ?? [];
      const filtered = query
        ? drivers.filter(
            (driver) =>
              driver.name.toLowerCase().includes(query) ||
              driver.team.toLowerCase().includes(query),
          )
        : drivers;
      const otherDriver = selectedDrivers[index === 0 ? 1 : 0];
      return filtered.filter((driver) => driver.name !== otherDriver);
    });
  }, [driverSearch, selectedDrivers, weekendContext?.drivers]);

  function updateDriver(index: number, driver: string) {
    setSelectedDrivers((current) => {
      const next = [...current];
      next[index] = driver;
      return next.slice(0, 2);
    });
    setLapSelections((current) => {
      const next = { ...current };
      delete next[driver];
      return next;
    });
  }

  function updateDriverSearch(index: number, value: string) {
    setDriverSearch((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function updateLap(driver: string, lapNumber: number) {
    setLapSelections((current) => ({ ...current, [driver]: [lapNumber] }));
  }

  async function copyDebrief() {
    if (debrief) {
      await navigator.clipboard?.writeText(debrief);
    }
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <p className="f1-kicker">Driver Comparison</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">Driver Compare</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
          Compare two selected FastF1 lap traces with lap choice, sector deltas, corner losses, driving-style
          ranks, and a readable engineering verdict.
        </p>
        <div className="mt-5">
          <DataSourcePanel
            race={session.grandPrix}
            season={weekendContext?.season ?? calendar?.season ?? session.year}
            session={session.session}
            source={data?.source ?? weekendContext?.source ?? calendar?.source}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.78fr,1.22fr]">
        <div className="space-y-6 reveal-up delay-2">
          <SectionCard title="Comparison Setup" subtitle="Choose the session, two drivers, and the exact lap to compare for each side.">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm text-zinc-300">
                  Season
                  <input
                    className="f1-input mt-2 rounded-2xl px-4 py-3"
                    type="number"
                    value={session.year}
                    onChange={(event) => setSession((current) => ({ ...current, year: Number(event.target.value) }))}
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  Grand Prix
                  <select
                    className="f1-input mt-2 rounded-2xl px-4 py-3"
                    value={session.grandPrix}
                    onChange={(event) => setSession((current) => ({ ...current, grandPrix: event.target.value }))}
                  >
                    {(calendar?.races ?? []).map((race) => (
                      <option key={race.id} value={race.track}>
                        {race.track} - {race.date}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-zinc-300">
                  Session
                  <select
                    className="f1-input mt-2 rounded-2xl px-4 py-3"
                    value={session.session}
                    onChange={(event) => setSession((current) => ({ ...current, session: event.target.value }))}
                  >
                    {(weekendContext?.available_sessions ?? calendar?.available_sessions ?? []).map((sessionCode) => (
                      <option key={sessionCode} value={sessionCode}>
                        {sessionCode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1].map((index) => {
                  const selectedDriver = selectedDrivers[index] ?? "";
                  const driverLapOptions = (data?.lap_options ?? []).filter((option) => option.driver === selectedDriver);
                  return (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <label className="text-sm text-zinc-300">
                        Driver {index + 1}
                        <input
                          className="f1-input mt-2 rounded-2xl px-4 py-3"
                          type="text"
                          placeholder="Search by driver or team"
                          value={driverSearch[index]}
                          onChange={(event) => updateDriverSearch(index, event.target.value)}
                        />
                        <select
                          className="f1-input mt-2 rounded-2xl px-4 py-3"
                          value={selectedDriver}
                          onChange={(event) => updateDriver(index, event.target.value)}
                        >
                          {driverOptions[index].map((driver) => (
                            <option key={driver.id} value={driver.name}>
                              {driver.name} - {driver.team}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-4">
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Lap Selection
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {driverLapOptions.map((option) => {
                            const isSelected = lapSelections[selectedDriver]?.[0] === option.lap_number;
                            return (
                              <button
                                key={`${option.driver}-${option.lap_number}`}
                                className={`rounded-full border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition ${
                                  isSelected
                                    ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white"
                                    : "border-white/10 bg-white/5 text-zinc-400"
                                }`}
                                onClick={() => updateLap(selectedDriver, option.lap_number)}
                                type="button"
                              >
                                L{option.lap_number} / {option.lap_time_seconds.toFixed(3)}s
                              </button>
                            );
                          })}
                        </div>
                        {!driverLapOptions.length ? (
                          <p className="mt-2 text-xs text-zinc-500">Lap options load after telemetry is available.</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {loading ? <div className="mt-5"><StatusPanel title="Loading" message="Loading FastF1 telemetry comparison..." /></div> : null}
            {error ? <div className="mt-5"><StatusPanel title="Error" message={error} tone="error" /></div> : null}
            {weekendContext?.notice ? <div className="mt-5"><StatusPanel title="Notice" message={weekendContext.notice} tone="warning" /></div> : null}
            {data?.notice ? <div className="mt-5"><StatusPanel title="Telemetry" message={data.notice} tone="warning" /></div> : null}
          </SectionCard>

          <SectionCard title="Data Quality" subtitle="FastF1 availability and cache state for this comparison.">
            <div className="grid gap-3 text-sm text-zinc-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Cache {data?.cache_metadata?.cache_hit ? "hit" : "fresh or unavailable"} / {data?.cache_metadata?.series_count ?? 0} trace(s)
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                Unavailable reason: {data?.unavailable_reason ?? data?.cache_metadata?.unavailable_reason ?? "none"}
              </div>
              {data?.cache_metadata?.diagnostics?.length ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100">
                  {data.cache_metadata.diagnostics.slice(0, 3).join(" / ")}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Comparison Verdict
            </p>
            <p className="mt-3 text-lg leading-8 text-white">{pairVerdict(leftToRightPair, left, right)}</p>
            {leftToRightPair?.summary ? (
              <p className="mt-2 text-sm leading-6 text-zinc-400">{leftToRightPair.summary}</p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[left, right].map((metric, index) =>
              metric ? (
                <article key={metric.series_key} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">{metric.team}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{metric.label}</h3>
                  <div className={`radar-ring mt-5 ${index === 0 ? "ring-red" : "ring-cyan"}`}>
                    <span>{Math.round(metric.top_speed)}</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Lap</span>
                      {formatSeconds(metric.fastest_lap_seconds)}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Compound</span>
                      {metric.compound ?? "--"}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Throttle</span>
                      {metric.average_throttle.toFixed(1)}%
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Brake Time</span>
                      {metric.brake_pct.toFixed(1)}%
                    </div>
                  </div>
                </article>
              ) : null,
            )}
          </div>

          {left && right ? (
            <div className="mt-5 grid gap-4">
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.top_speed} rightValue={right.top_speed} max={340} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.average_throttle} rightValue={right.average_throttle} max={100} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.brake_pct} rightValue={right.brake_pct} max={100} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.gear_changes} rightValue={right.gear_changes} max={40} />
            </div>
          ) : null}

          {left && right ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">Sector Delta</p>
                <div className="mt-3 grid gap-2 text-sm text-zinc-300">
                  {[
                    ["S1", left.sector_1_seconds, right.sector_1_seconds],
                    ["S2", left.sector_2_seconds, right.sector_2_seconds],
                    ["S3", left.sector_3_seconds, right.sector_3_seconds],
                  ].map(([label, leftValue, rightValue]) => {
                    const delta =
                      typeof leftValue === "number" && typeof rightValue === "number" ? rightValue - leftValue : null;
                    return (
                      <div key={label as string} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2">
                        <span>{label}</span>
                        <span>{formatSeconds(leftValue as number | null)} vs {formatSeconds(rightValue as number | null)}</span>
                        <span>{formatSignedSeconds(delta)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">Backend Ranks</p>
                <div className="mt-3 grid gap-2 text-sm text-zinc-300">
                  {[
                    [left.label, leftRanking],
                    [right.label, rightRanking],
                  ].map(([label, ranking]) => (
                    <div key={label as string} className="rounded-2xl border border-white/10 px-3 py-2">
                      <div className="font-medium text-white">{label as string}</div>
                      <div className="mt-2 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                        <span>Overall {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.overall_rank)}</span>
                        <span>Brake {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.braking_rank)}</span>
                        <span>Apex {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.apex_rank)}</span>
                        <span>Exit {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.exit_rank)}</span>
                        <span>Straight {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.straight_line_rank)}</span>
                        <span>Consistency {formatRank((ranking as TelemetryBenchmarkRanking | undefined)?.consistency_rank)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {leftToRightPair ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Corner Gain And Loss
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {corners.gain ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    <div className="font-medium">Strongest comparison gain</div>
                    <div className="mt-2">{corners.gain.corner_label ?? corners.gain.corner}</div>
                    <div className="mt-2 text-xs">
                      Total {formatSignedSeconds(corners.gain.total_delta)} / Entry {formatSignedSeconds(corners.gain.entry_delta)} / Apex {formatSignedSeconds(corners.gain.apex_delta)} / Exit {formatSignedSeconds(corners.gain.exit_delta)}
                    </div>
                  </div>
                ) : null}
                {corners.loss ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    <div className="font-medium">Largest comparison loss</div>
                    <div className="mt-2">{corners.loss.corner_label ?? corners.loss.corner}</div>
                    <div className="mt-2 text-xs">
                      Total {formatSignedSeconds(corners.loss.total_delta)} / Brake shift {formatMeters(corners.loss.braking_point_delta)} / Throttle shift {formatMeters(corners.loss.throttle_pickup_delta)}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 text-xs text-zinc-300">
                {leftToRightPair.corner_deltas.slice(0, 6).map((corner) => (
                  <div key={corner.corner} className="grid gap-2 rounded-2xl border border-white/10 px-3 py-2 md:grid-cols-[1fr,repeat(4,auto)]">
                    <span className="font-medium text-white">{corner.corner_label ?? corner.corner}</span>
                    <span>Total {formatSignedSeconds(corner.total_delta)}</span>
                    <span>Entry {formatSignedSeconds(corner.entry_delta)}</span>
                    <span>Apex {formatSignedSeconds(corner.apex_delta)}</span>
                    <span>Exit {formatSignedSeconds(corner.exit_delta)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                Comparison Debrief
              </p>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition hover:border-white/20"
                onClick={copyDebrief}
                type="button"
              >
                Copy Debrief
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
              {debrief || "Load two FastF1 telemetry traces to generate a comparison debrief."}
            </pre>
          </div>
        </section>
      </div>
    </Shell>
  );
}
