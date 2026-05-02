"use client";

import { useEffect, useMemo, useState } from "react";

import { CompareSpectrum } from "@/components/compare-spectrum";
import { DataSourcePanel } from "@/components/data-source-panel";
import { useAuth } from "@/components/auth-provider";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { getSeasonCalendar, getTelemetry, getWeekendContext } from "@/services/api";
import { SeasonCalendarResponse, TelemetryResponse, WeekendContextResponse } from "@/types/api";

const defaultSession = {
  year: new Date().getFullYear(),
  grandPrix: "Silverstone",
  session: "Q",
};

export default function ComparePage() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [weekendContext, setWeekendContext] = useState<WeekendContextResponse | null>(null);
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(["Max Verstappen", "Lando Norris"]);
  const [driverSearch, setDriverSearch] = useState(["", ""]);
  const [session, setSession] = useState(defaultSession);
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
    getWeekendContext(session, token ?? undefined)
      .then((response) => {
        if (!active) {
          return;
        }
        setWeekendContext(response);
        setSelectedDrivers((current) => {
          const available = response.drivers.map((driver) => driver.name);
          return current.every((driver) => available.includes(driver)) ? current : available.slice(0, 2);
        });
      })
      .catch((loadError: Error) => {
        if (active) {
          setError(loadError.message);
        }
      });

    getTelemetry(selectedDrivers, session, token ?? undefined)
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((loadError: Error) => {
        if (active) {
          setError(loadError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedDrivers, session, token]);

  const comparison = useMemo(() => {
    return data?.metrics ?? [];
  }, [data]);

  const driverOptions = useMemo(() => {
    return [0, 1].map((index) => {
      const query = driverSearch[index]?.trim().toLowerCase() ?? "";
      const drivers = weekendContext?.drivers ?? [];
      if (!query) {
        return drivers;
      }
      return drivers.filter(
        (driver) =>
          driver.name.toLowerCase().includes(query) ||
          driver.team.toLowerCase().includes(query),
      );
    });
  }, [driverSearch, weekendContext?.drivers]);

  function updateDriver(index: number, driver: string) {
    setSelectedDrivers((current) => current.map((item, itemIndex) => (itemIndex === index ? driver : item)));
  }

  function updateDriverSearch(index: number, value: string) {
    setDriverSearch((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  const left = comparison[0];
  const right = comparison[1];

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <p className="f1-kicker">Driver Comparison</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">Driver Compare</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          Built as a duel board with animated spectrum meters so the comparison lands instantly instead of reading like a static stat sheet.
        </p>
        <div className="mt-5">
          <DataSourcePanel
            race={session.grandPrix}
            season={weekendContext?.season ?? calendar?.season ?? session.year}
            session={session.session}
            source={weekendContext?.source ?? calendar?.source}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
        <div className="reveal-up delay-2">
          <SectionCard title="Comparison Setup" subtitle="Choose the two drivers you want to benchmark.">
            <div className="mb-4 grid gap-4 md:grid-cols-3">
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
                  {(weekendContext?.available_sessions ?? calendar?.available_sessions ?? ["Q", "R", "FP1", "FP2"]).map((sessionCode) => (
                    <option key={sessionCode} value={sessionCode}>
                      {sessionCode}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((index) => (
                <label key={index} className="text-sm text-zinc-300">
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
                    value={selectedDrivers[index]}
                    onChange={(event) => updateDriver(index, event.target.value)}
                  >
                    {driverOptions[index].map((driver) => (
                      <option key={driver.id} value={driver.name}>
                        {driver.name} - {driver.team}
                      </option>
                    ))}
                  </select>
                  {!driverOptions[index].length ? (
                    <span className="mt-2 block text-xs text-zinc-500">
                      No drivers match that search yet.
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
            {error ? <div className="mt-5"><StatusPanel title="Error" message={error} tone="error" /></div> : null}
            {weekendContext?.notice ? <div className="mt-5"><StatusPanel title="Notice" message={weekendContext.notice} tone="warning" /></div> : null}
            {data?.notice ? <div className="mt-5"><StatusPanel title="Telemetry" message={data.notice} tone="warning" /></div> : null}
            {data?.session_summary ? <div className="mt-5"><StatusPanel title="Telemetry Readout" message={data.session_summary} /></div> : null}
          </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {comparison.map((series, index) => (
              <article key={series.driver} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">{series.team}</p>
                <h3 className="f1-title mt-4 text-3xl">{series.driver}</h3>
                <div className={`radar-ring mt-6 ${index === 0 ? "ring-red" : "ring-cyan"}`}>
                  <span>{Math.round(series.top_speed)}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                    <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Lap</span>
                    {series.fastest_lap_seconds ? `${series.fastest_lap_seconds.toFixed(3)}s` : "--"}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
                    <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">Compound</span>
                    {series.compound ?? "--"}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {left && right ? (
            <div className="mt-5 grid gap-4">
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.top_speed} rightValue={right.top_speed} max={340} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.average_throttle} rightValue={right.average_throttle} max={100} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.brake_pct} rightValue={right.brake_pct} max={100} />
              <CompareSpectrum leftLabel={left.driver} rightLabel={right.driver} leftValue={left.gear_changes} rightValue={right.gear_changes} max={40} />
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
