"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatsCard } from "@/components/stats-card";
import { StatusPanel } from "@/components/status-panel";
import { TelemetryChart } from "@/components/telemetry-chart";
import { TelemetryDeltaChart } from "@/components/telemetry-delta-chart";
import { TelemetryHud } from "@/components/telemetry-hud";
import { TelemetrySidePanel } from "@/components/telemetry-side-panel";
import { getSeasonCalendar, getTelemetry, getWeekendContext } from "@/services/api";
import { SeasonCalendarResponse, TelemetryLapOption, TelemetryResponse, WeekendContextResponse } from "@/types/api";

const defaultSession = {
  year: new Date().getFullYear(),
  grandPrix: "Silverstone",
  session: "Q",
};

const defaultSignals = {
  speed: true,
  throttle: true,
  brake: true,
  steering: false,
  gear: true,
  rpm: true,
  delta: true,
};

function normalizeLapSelections(
  current: Record<string, number[]>,
  selectedDrivers: string[],
  options: TelemetryLapOption[],
) {
  const next: Record<string, number[]> = {};
  selectedDrivers.forEach((driver) => {
    const driverOptions = options.filter((option) => option.driver === driver);
    const currentLaps = Array.from(new Set(current[driver] ?? [])).filter((lapNumber) =>
      driverOptions.some((option) => option.lap_number === lapNumber),
    );
    if (currentLaps.length) {
      next[driver] = currentLaps.slice(0, 3).sort((left, right) => left - right);
      return;
    }
    const bestLap = driverOptions.find((option) => option.is_best) ?? driverOptions[0];
    if (bestLap) {
      next[driver] = [bestLap.lap_number];
    }
  });
  return next;
}

function areLapSelectionsEqual(left: Record<string, number[]>, right: Record<string, number[]>) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key, index) => {
    if (key !== rightKeys[index]) {
      return false;
    }
    const leftLaps = [...(left[key] ?? [])].sort((lapA, lapB) => lapA - lapB);
    const rightLaps = [...(right[key] ?? [])].sort((lapA, lapB) => lapA - lapB);
    return (
      leftLaps.length === rightLaps.length &&
      leftLaps.every((lapNumber, lapIndex) => lapNumber === rightLaps[lapIndex])
    );
  });
}

function countSelectedLapOverlays(lapSelections: Record<string, number[]>, selectedDrivers: string[]) {
  return selectedDrivers.reduce((sum, driver) => sum + (lapSelections[driver]?.length ?? 0), 0);
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [weekendContext, setWeekendContext] = useState<WeekendContextResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [lapSelections, setLapSelections] = useState<Record<string, number[]>>({});
  const [driverSearch, setDriverSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(defaultSession);
  const [visibleSignals, setVisibleSignals] = useState<Record<string, boolean>>(defaultSignals);
  const telemetrySelectionKey = useMemo(
    () =>
      JSON.stringify({
        year: session.year,
        grandPrix: session.grandPrix,
        session: session.session,
        drivers: [...selectedDrivers].sort(),
        laps: Object.entries(lapSelections)
          .filter(([driver]) => selectedDrivers.includes(driver))
          .flatMap(([driver, laps]) => (laps ?? []).map((lapNumber) => `${driver}:${lapNumber}`))
          .sort(),
      }),
    [lapSelections, selectedDrivers, session.grandPrix, session.session, session.year],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setCalendar(null);
    setWeekendContext(null);
    setTelemetry(null);
    setSelectedDrivers([]);
    setLapSelections({});
    setError("");

    async function loadCalendar() {
      try {
        const response = await getSeasonCalendar(session.year, token ?? undefined);
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
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load season calendar.");
        }
      }
    }

    loadCalendar().catch(console.error);
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
    setTelemetry(null);
    setLapSelections({});
    setError("");

    async function loadWeekend() {
      try {
        const response = await getWeekendContext(session, token ?? undefined);
        if (!active) {
          return;
        }
        setWeekendContext(response);
        setSelectedDrivers((current) => {
          const available = response.drivers.map((driver) => driver.name);
          if (current.length && current.every((driver) => available.includes(driver))) {
            return current;
          }
          return available.slice(0, 2);
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load weekend context.");
        }
      }
    }

    loadWeekend().catch(console.error);
    return () => {
      active = false;
    };
  }, [session.grandPrix, session.session, session.year, token]);

  useEffect(() => {
    if (!token || !session.grandPrix || !selectedDrivers.length) {
      setLoading(false);
      setTelemetry(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    async function loadTelemetry() {
      try {
        const currentLapSelections: Record<string, number[]> = {};
        selectedDrivers.forEach((driver) => {
          if (lapSelections[driver]?.length) {
            currentLapSelections[driver] = lapSelections[driver];
          }
        });

        const response = await getTelemetry(
          selectedDrivers,
          { ...session, lapSelections: currentLapSelections },
          token ?? undefined,
        );

        if (!active) {
          return;
        }

        setTelemetry(response);
        setLapSelections((current) => {
          const normalized = normalizeLapSelections(current, selectedDrivers, response.lap_options ?? []);
          return areLapSelectionsEqual(current, normalized) ? current : normalized;
        });
      } catch (loadError) {
        if (active) {
          setTelemetry(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to load telemetry.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTelemetry().catch(console.error);
    return () => {
      active = false;
    };
  }, [telemetrySelectionKey, token]);

  const peakSpeed = useMemo(
    () => {
      const values = telemetry?.metrics?.map((metric) => metric.top_speed) ?? [];
      if (!values.length) {
        return "--";
      }
      return Math.max(...values).toFixed(0);
    },
    [telemetry],
  );

  const averageThrottle = useMemo(() => {
    const metrics = telemetry?.metrics ?? [];
    if (!metrics.length) {
      return "0.0";
    }
    return (
      metrics.reduce((sum, metric) => sum + metric.average_throttle, 0) / metrics.length
    ).toFixed(1);
  }, [telemetry]);

  const fastestLap = useMemo(() => {
    const laps = (telemetry?.metrics ?? [])
      .map((metric) => metric.fastest_lap_seconds)
      .filter((value): value is number => typeof value === "number");
    if (!laps.length) {
      return "--";
    }
    return `${Math.min(...laps).toFixed(3)}s`;
  }, [telemetry]);

  const averageDrs = useMemo(() => {
    const drsValues = (telemetry?.metrics ?? [])
      .map((metric) => metric.drs_pct)
      .filter((value): value is number => typeof value === "number");
    if (!drsValues.length) {
      return "--";
    }
    return `${(drsValues.reduce((sum, value) => sum + value, 0) / drsValues.length).toFixed(0)}%`;
  }, [telemetry]);

  const averageBrake = useMemo(() => {
    const metrics = telemetry?.metrics ?? [];
    if (!metrics.length) {
      return "0%";
    }
    return `${(metrics.reduce((sum, metric) => sum + metric.brake_pct, 0) / metrics.length).toFixed(0)}%`;
  }, [telemetry]);

  const filteredDrivers = useMemo(() => {
    const query = driverSearch.trim().toLowerCase();
    const drivers = weekendContext?.drivers ?? [];
    if (!query) {
      return drivers;
    }
    return drivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(query) ||
        driver.team.toLowerCase().includes(query),
    );
  }, [driverSearch, weekendContext?.drivers]);

  const telemetryInsights = useMemo(() => {
    if (telemetry?.insights?.length) {
      return telemetry.insights;
    }
    return weekendContext?.insights ?? [];
  }, [telemetry?.insights, weekendContext?.insights]);

  function toggleDriver(driver: string) {
    setSelectedDrivers((current) =>
      current.includes(driver)
        ? current.filter((item) => item !== driver)
        : current.length >= 4
          ? current
          : [...current, driver],
    );
    setLapSelections((current) => {
      const next = { ...current };
      delete next[driver];
      return next;
    });
  }

  function toggleLap(driver: string, lapNumber: number) {
    setLapSelections((current) => {
      const currentLaps = current[driver] ?? [];
      if (currentLaps.includes(lapNumber)) {
        if (currentLaps.length === 1) {
          return current;
        }
        return {
          ...current,
          [driver]: currentLaps.filter((value) => value !== lapNumber),
        };
      }

      return {
        ...current,
        [driver]: [...currentLaps, lapNumber]
          .slice(-3)
          .sort((left, right) => left - right),
      };
    });
  }

  function toggleSignal(signal: string) {
    setVisibleSignals((current) => ({
      ...current,
      [signal]: !current[signal],
    }));
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <div className="f1-orb f1-orb-red right-12 top-10 h-24 w-24" />
        <p className="f1-kicker">Telemetry Analysis</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">F1 Telemetry Analysis</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
          A distance-based telemetry desk with lap overlays, sector intelligence, steering estimation, and corner-by-corner loss analysis pulled from FastF1 session data.
        </p>
        <div className="mt-5">
          <DataSourcePanel
            race={session.grandPrix}
            season={weekendContext?.season ?? calendar?.season ?? session.year}
            session={session.session}
            source={telemetry?.source ?? weekendContext?.source ?? calendar?.source}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="reveal-up delay-1">
          <StatsCard
            label="Selected Traces"
            value={String(countSelectedLapOverlays(lapSelections, selectedDrivers) || selectedDrivers.length)}
            accent="#f5f5f5"
          />
        </div>
        <div className="reveal-up delay-2">
          <StatsCard label="Peak Speed" value={peakSpeed === "--" ? "--" : `${peakSpeed} km/h`} accent="#e10600" />
        </div>
        <div className="reveal-up delay-3">
          <StatsCard label="Avg Throttle" value={`${averageThrottle}%`} accent="#d0d0d0" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="reveal-up delay-1">
          <StatsCard label="Fastest Lap" value={fastestLap} accent="#f5f5f5" />
        </div>
        <div className="reveal-up delay-2">
          <StatsCard label="Avg DRS Usage" value={averageDrs} accent="#64c4ff" />
        </div>
        <div className="reveal-up delay-3">
          <StatsCard label="Brake Time" value={averageBrake} accent="#00d2be" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {telemetryInsights.slice(0, 4).map((insight, index) => (
          <div key={insight} className={`reveal-up delay-${Math.min(index + 1, 3)}`}>
            <StatusPanel title={`Race Insight 0${index + 1}`} message={insight} />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr,1.18fr]">
        <div className="reveal-up delay-2">
          <SectionCard title="Telemetry Filters" subtitle="Pick the weekend, select the drivers, then choose the exact laps you want to inspect.">
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
                  {(weekendContext?.available_sessions ?? calendar?.available_sessions ?? ["Q", "R"]).map((sessionCode) => (
                    <option key={sessionCode} value={sessionCode}>
                      {sessionCode}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2 text-sm text-zinc-300">
                Search Drivers
                <input
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  type="text"
                  placeholder="Search by driver or team"
                  value={driverSearch}
                  onChange={(event) => setDriverSearch(event.target.value)}
                />
              </label>

              {filteredDrivers.map((driver) => {
                const driverLapOptions = (telemetry?.lap_options ?? []).filter((option) => option.driver === driver.name);
                return (
                  <div
                    key={driver.id}
                    className={`rounded-2xl border p-4 text-sm transition ${
                      selectedDrivers.includes(driver.name)
                        ? "border-red-600/50 bg-red-600/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-zinc-300"
                    }`}
                  >
                    <label className="block cursor-pointer">
                      <input
                        checked={selectedDrivers.includes(driver.name)}
                        className="mr-3"
                        type="checkbox"
                        onChange={() => toggleDriver(driver.name)}
                      />
                      {driver.name}
                      <span className="block pl-6 text-xs text-zinc-500">{driver.team}</span>
                    </label>
                    {selectedDrivers.includes(driver.name) ? (
                      <div className="mt-3 pl-6">
                        <label className="text-[0.62rem] uppercase tracking-[0.2em] text-zinc-500">
                          Overlay Laps (up to 3)
                          <div className="mt-2 flex flex-wrap gap-2">
                            {driverLapOptions.map((option) => {
                              const isSelected = (lapSelections[driver.name] ?? []).includes(option.lap_number);
                              return (
                                <button
                                  key={`${option.driver}-${option.lap_number}`}
                                  className={`rounded-full border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition ${
                                    isSelected
                                      ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-white"
                                      : "border-white/10 bg-white/5 text-zinc-400"
                                  }`}
                                  onClick={() => toggleLap(driver.name, option.lap_number)}
                                  type="button"
                                >
                                  L{option.lap_number} • {option.lap_time_seconds.toFixed(3)}s{option.is_best ? " • Best" : ""}
                                </button>
                              );
                            })}
                          </div>
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!filteredDrivers.length ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                No drivers match that search yet.
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">Toggle Graphs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["speed", "Speed"],
                  ["throttle", "Throttle"],
                  ["brake", "Brake"],
                  ["steering", "Steering"],
                  ["gear", "Gear"],
                  ["rpm", "RPM"],
                  ["delta", "Delta"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      visibleSignals[key]
                        ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-white"
                        : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                    onClick={() => toggleSignal(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr,360px]">
          <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
            <div className="warp-line flex flex-wrap items-center gap-3 border-b border-white/10 pb-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              <span>{session.grandPrix}</span>
              <span>{session.year}</span>
              <span>{session.session}</span>
              <span>{telemetry?.series?.map((item) => item.label).join(" vs ") || selectedDrivers.join(" vs ") || "Choose drivers"}</span>
            </div>
            <div className="mt-4 space-y-4">
              {loading ? <StatusPanel message="Loading telemetry traces, lap options, and corner breakdowns..." title="Loading" /> : null}
              {weekendContext?.summary ? <StatusPanel message={weekendContext.summary} title="FastF1 Session" /> : null}
              {telemetry?.session_summary ? <StatusPanel message={telemetry.session_summary} title="Telemetry Readout" /> : null}
              {telemetry?.weather ? <StatusPanel message={telemetry.weather} title="Weather" /> : null}
              {weekendContext?.notice ? <StatusPanel message={weekendContext.notice} title="Notice" tone="warning" /> : null}
              {telemetry?.notice ? <StatusPanel message={telemetry.notice} title="Telemetry" tone="warning" /> : null}
              {error ? <StatusPanel message={error} title="Error" tone="error" /> : null}

              <TelemetryHud metrics={telemetry?.metrics ?? []} />
              {visibleSignals.speed ? <TelemetryChart series={telemetry?.series ?? []} metric="speed" /> : null}
              {visibleSignals.throttle ? <TelemetryChart series={telemetry?.series ?? []} metric="throttle" /> : null}
              {visibleSignals.brake ? <TelemetryChart series={telemetry?.series ?? []} metric="brake" /> : null}
              {visibleSignals.steering ? <TelemetryChart series={telemetry?.series ?? []} metric="steering" /> : null}
              {visibleSignals.gear ? <TelemetryChart series={telemetry?.series ?? []} metric="gear" /> : null}
              {visibleSignals.rpm ? <TelemetryChart series={telemetry?.series ?? []} metric="rpm" /> : null}
              {visibleSignals.delta ? <TelemetryDeltaChart series={telemetry?.series ?? []} /> : null}
            </div>
          </section>

          <div className="reveal-up delay-3">
            <TelemetrySidePanel
              metrics={telemetry?.metrics ?? []}
              lapOptions={telemetry?.lap_options ?? []}
              microSectors={telemetry?.micro_sectors ?? []}
              cornerBreakdown={telemetry?.corner_breakdown ?? []}
              performance={telemetry?.performance ?? []}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
