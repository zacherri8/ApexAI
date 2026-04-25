"use client";

import { useEffect, useMemo, useState } from "react";

import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { StatsCard } from "@/components/stats-card";
import { TelemetryChart } from "@/components/telemetry-chart";
import { TelemetryHud } from "@/components/telemetry-hud";
import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { getSeasonCalendar, getTelemetry, getWeekendContext } from "@/services/api";
import { SeasonCalendarResponse, TelemetryResponse, WeekendContextResponse } from "@/types/api";

const defaultSession = {
  year: new Date().getFullYear(),
  grandPrix: "Silverstone",
  session: "Q",
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [weekendContext, setWeekendContext] = useState<WeekendContextResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(defaultSession);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setCalendar(null);
    setWeekendContext(null);
    setTelemetry(null);
    setSelectedDrivers([]);
    setError("");

    async function loadMetadata() {
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
          setError(loadError instanceof Error ? loadError.message : "Failed to load metadata.");
        }
      }
    }

    loadMetadata().catch(console.error);
    return () => {
      active = false;
    };
  }, [session.year, token]);

  useEffect(() => {
    if (!token || !session.grandPrix) {
      return;
    }

    let active = true;
    async function loadWeekendContext() {
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

    loadWeekendContext().catch(console.error);
    return () => {
      active = false;
    };
  }, [session, token]);

  useEffect(() => {
    if (!selectedDrivers.length || !token || !session.grandPrix) {
      return;
    }

    let active = true;
    async function loadTelemetry() {
      setLoading(true);
      setError("");
      try {
        const response = await getTelemetry(selectedDrivers, session, token ?? undefined);
        if (active) {
          setTelemetry(response);
        }
      } catch (loadError) {
        if (active) {
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
  }, [selectedDrivers, session, token]);

  const peakSpeed = useMemo(() => {
    return Math.max(
      ...(telemetry?.series.flatMap((series) => series.points.map((point) => point.speed)) ?? [0]),
    ).toFixed(0);
  }, [telemetry]);

  const averageThrottle = useMemo(() => {
    const points = telemetry?.series.flatMap((series) => series.points) ?? [];
    if (!points.length) {
      return "0.0";
    }
    return (points.reduce((sum, point) => sum + point.throttle, 0) / points.length).toFixed(1);
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

  function toggleDriver(driver: string) {
    setSelectedDrivers((current) =>
      current.includes(driver)
        ? current.filter((item) => item !== driver)
        : current.length >= 4
          ? current
          : [...current, driver],
    );
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <div className="f1-orb f1-orb-red right-12 top-10 h-24 w-24" />
        <p className="f1-kicker">Telemetry Analysis</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">F1 Telemetry Analysis</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
          A cinematic telemetry workspace with custom HUD cards, animated meters, and a headline race board built for instant speed-reading.
        </p>
        <div className="mt-5">
          <DataSourcePanel race={session.grandPrix} season={weekendContext?.season ?? calendar?.season ?? session.year} session={session.session} source={weekendContext?.source ?? calendar?.source} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="reveal-up delay-1"><StatsCard label="Selected Drivers" value={String(selectedDrivers.length)} accent="#f5f5f5" /></div>
        <div className="reveal-up delay-2"><StatsCard label="Peak Speed" value={`${peakSpeed} km/h`} accent="#e10600" /></div>
        <div className="reveal-up delay-3"><StatsCard label="Avg Throttle" value={`${averageThrottle}%`} accent="#d0d0d0" /></div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(weekendContext?.insights ?? []).slice(0, 3).map((insight, index) => (
          <div key={insight} className={`reveal-up delay-${Math.min(index + 1, 3)}`}>
            <StatusPanel title={`Race Insight 0${index + 1}`} message={insight} />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="reveal-up delay-2">
          <SectionCard title="Telemetry Filters" subtitle="Pick the session context and drivers for the headline comparison.">
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
                  {(weekendContext?.available_sessions ?? calendar?.available_sessions ?? ["Q", "R", "FP1", "FP2"]).map((sessionCode) => (
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
              {filteredDrivers.map((driver) => (
                <label
                  key={driver.id}
                  className={`rounded-2xl border p-4 text-sm transition ${
                    selectedDrivers.includes(driver.name)
                      ? "border-red-600/50 bg-red-600/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-zinc-300"
                  }`}
                >
                  <input
                    checked={selectedDrivers.includes(driver.name)}
                    className="mr-3"
                    type="checkbox"
                    onChange={() => toggleDriver(driver.name)}
                  />
                  {driver.name}
                  <span className="block pl-6 text-xs text-zinc-500">{driver.team}</span>
                </label>
              ))}
            </div>
            {!filteredDrivers.length ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                No drivers match that search yet.
              </div>
            ) : null}
          </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="warp-line flex flex-wrap items-center gap-3 border-b border-white/10 pb-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            <span>{session.grandPrix} Grand Prix</span>
            <span>{session.year}</span>
            <span>{session.session}</span>
            <span>{selectedDrivers.join(" vs ")}</span>
          </div>
          <div className="mt-4 space-y-4">
            {loading ? <StatusPanel message="Loading telemetry traces..." title="Loading" /> : null}
            {weekendContext?.summary ? <StatusPanel message={weekendContext.summary} title="FastF1 Session" /> : null}
            {weekendContext?.notice ? <StatusPanel message={weekendContext.notice} title="Notice" tone="warning" /> : null}
            {telemetry?.notice ? <StatusPanel message={telemetry.notice} title="Telemetry" tone="warning" /> : null}
            {error ? <StatusPanel message={error} title="Error" tone="error" /> : null}
            <TelemetryHud series={telemetry?.series ?? []} />
            <TelemetryChart series={telemetry?.series ?? []} metric="speed" />
            <TelemetryChart series={telemetry?.series ?? []} metric="throttle" />
            <TelemetryChart series={telemetry?.series ?? []} metric="brake" />
          </div>
        </section>
      </div>
    </Shell>
  );
}
