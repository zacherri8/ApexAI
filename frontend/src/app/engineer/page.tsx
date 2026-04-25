"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { getSeasonCalendar, getStrategy, getWeekendContext } from "@/services/api";
import { SeasonCalendarResponse, StrategyResponse, WeekendContextResponse } from "@/types/api";

const defaultWeekend = {
  year: new Date().getFullYear(),
  grandPrix: "Silverstone",
  session: "R",
};

export default function EngineerPage() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [weekendContext, setWeekendContext] = useState<WeekendContextResponse | null>(null);
  const [result, setResult] = useState<StrategyResponse | null>(null);
  const [weekend, setWeekend] = useState(defaultWeekend);
  const [driver, setDriver] = useState("Lando Norris");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    setCalendar(null);
    setWeekendContext(null);
    getSeasonCalendar(weekend.year, token ?? undefined)
      .then((response) => {
        setCalendar(response);
        setWeekend((current) => ({
          ...current,
          grandPrix: response.races[0]?.track ?? current.grandPrix,
          session: response.available_sessions.includes(current.session)
            ? current.session
            : response.available_sessions[0] ?? current.session,
        }));
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [token, weekend.year]);

  useEffect(() => {
    if (!token || !weekend.grandPrix) {
      return;
    }

    getWeekendContext(weekend, token ?? undefined)
      .then((response) => {
        setWeekendContext(response);
        setDriver((current) =>
          response.drivers.some((item) => item.name === current)
            ? current
            : response.drivers[0]?.name ?? current,
        );
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [token, weekend]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await getStrategy({
        driver: String(formData.get("driver")),
        lap: Number(formData.get("lap")),
        position: Number(formData.get("position")),
        tyre_compound: String(formData.get("tyre_compound")),
        tyre_age: Number(formData.get("tyre_age")),
        fuel_load: Number(formData.get("fuel_load")),
        weather: String(formData.get("weather")),
        year: weekend.year,
        grand_prix: weekend.grandPrix,
        session: weekend.session,
      }, token ?? undefined);
      setResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to generate strategy.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <p className="f1-kicker">Pit Wall Intelligence</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">AI Race Engineer</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          A darker strategy console with a race-status strip and a recommendation area that reads like live pit wall comms.
        </p>
        <div className="mt-5">
          <DataSourcePanel
            race={weekend.grandPrix}
            season={weekendContext?.season ?? calendar?.season ?? weekend.year}
            session={weekend.session}
            source={weekendContext?.source ?? calendar?.source}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="reveal-up delay-2">
        <SectionCard title="Race State Input" subtitle="Model the current stint and ask the strategy service for a call.">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm text-zinc-300">
                Season
                <input
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  type="number"
                  value={weekend.year}
                  onChange={(event) => setWeekend((current) => ({ ...current, year: Number(event.target.value) }))}
                />
              </label>
              <label className="text-sm text-zinc-300">
                Grand Prix
                <select
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  value={weekend.grandPrix}
                  onChange={(event) => setWeekend((current) => ({ ...current, grandPrix: event.target.value }))}
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
                  value={weekend.session}
                  onChange={(event) => setWeekend((current) => ({ ...current, session: event.target.value }))}
                >
                  {(weekendContext?.available_sessions ?? calendar?.available_sessions ?? ["Q", "R", "FP1", "FP2"]).map((sessionCode) => (
                    <option key={sessionCode} value={sessionCode}>
                      {sessionCode}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <select
              className="f1-input rounded-2xl px-4 py-3"
              name="driver"
              value={driver}
              onChange={(event) => setDriver(event.target.value)}
            >
              {(weekendContext?.drivers ?? []).map((driver) => (
                <option key={driver.id} value={driver.name}>
                  {driver.name} - {driver.team}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="f1-input rounded-2xl px-4 py-3" defaultValue="22" name="lap" type="number" />
              <input className="f1-input rounded-2xl px-4 py-3" defaultValue="3" name="position" type="number" />
              <select className="f1-input rounded-2xl px-4 py-3" defaultValue="Medium" name="tyre_compound">
                <option value="Soft">Soft</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Intermediate">Intermediate</option>
              </select>
              <input className="f1-input rounded-2xl px-4 py-3" defaultValue="16" name="tyre_age" type="number" />
              <input className="f1-input rounded-2xl px-4 py-3" defaultValue="42" name="fuel_load" type="number" />
              <input className="f1-input rounded-2xl px-4 py-3" defaultValue="Dry and warm" name="weather" />
            </div>
            <button className="rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" disabled={loading} type="submit">
              {loading ? "Generating..." : "Generate Strategy"}
            </button>
          </form>
        </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-5">
            {[`${weekend.session} / ${weekend.year}`, weekend.grandPrix, driver, "Medium +16", "31.4 kg"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border border-white/10 bg-[#121212] p-4">
            {weekendContext?.summary ? <StatusPanel title="FastF1 Session" message={weekendContext.summary} /> : null}
            {weekendContext?.notice ? <StatusPanel title="Notice" message={weekendContext.notice} tone="warning" /> : null}
            {error ? <StatusPanel title="Error" message={error} tone="error" /> : null}
            {result ? (
              <div className="space-y-4 text-sm text-zinc-300">
                <StatusPanel title="Primary Call" message={result.recommendation} tone="success" />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Pit Window</p>
                    <p className="mt-3 text-sm">{result.pit_window}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Tyre Advice</p>
                    <p className="mt-3 text-sm">{result.tyre_advice}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Push Mode</p>
                    <p className="mt-3 text-sm">{result.push_mode}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.rationale.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <StatusPanel
                title="Ready"
                message="Submit a race state to receive a strategy recommendation tailored to stint age, position, and weather."
              />
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
