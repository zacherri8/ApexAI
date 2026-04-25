"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { getMetadata, getReport } from "@/services/api";
import { MetadataResponse, ReportResponse } from "@/types/api";

export default function ReportPage() {
  const { token } = useAuth();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [raceName, setRaceName] = useState("British Grand Prix");
  const [winningDriver, setWinningDriver] = useState("Lando Norris");
  const [podium, setPodium] = useState("Lando Norris, Max Verstappen, Charles Leclerc");
  const [headlineEvents, setHeadlineEvents] = useState("Late safety car, strategic undercut battle");
  const [weather, setWeather] = useState("Cool and breezy");
  const [keyStat, setKeyStat] = useState("Average tyre stint delta of 1.8 seconds");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setMetadata(null);
    setReport(null);
    setError("");

    getMetadata(token ?? undefined, season)
      .then((response) => {
        if (active) {
          setMetadata(response);
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
  }, [season, token]);

  const driverLookup = useMemo(() => {
    return new Map((metadata?.drivers ?? []).map((driver) => [driver.id, driver.name]));
  }, [metadata]);

  const latestRace = useMemo(() => {
    const latestRaceId = metadata?.results[0]?.race_id;
    return (metadata?.races ?? []).find((race) => race.id === latestRaceId) ?? metadata?.races[0] ?? null;
  }, [metadata]);

  const latestResultNames = useMemo(() => {
    const results = (metadata?.results ?? []).slice().sort((a, b) => a.position - b.position).slice(0, 3);
    return results.map((result) => driverLookup.get(result.driver_id) ?? "Unknown Driver");
  }, [driverLookup, metadata]);

  useEffect(() => {
    if (!latestRace) {
      return;
    }

    const context = metadata?.featured_race_context;
    setRaceName(context?.race_name ?? `${latestRace.track} Grand Prix`);
    if (context) {
      setWinningDriver(context.winner);
      setPodium(context.podium.join(", "));
      setHeadlineEvents(context.headline_events.join(", "));
      setWeather(context.weather);
      setKeyStat(context.key_stat);
    } else if (latestResultNames.length) {
      setWinningDriver(latestResultNames[0]);
      setPodium(latestResultNames.join(", "));
    }
  }, [latestRace, latestResultNames, metadata]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await getReport({
        race_name: raceName,
        winning_driver: winningDriver,
        podium: podium
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        headline_events: headlineEvents
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        weather,
        key_stat: keyStat,
      }, token ?? undefined);
      setReport(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <p className="f1-kicker">Debrief Engine</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">F1 Race Report Tool</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          A debrief workspace with a headline band, podium summary blocks, and a post-race desk feel built for rapid storytelling.
        </p>
        <div className="mt-5">
          <DataSourcePanel race={latestRace?.track ?? undefined} season={metadata?.season ?? season} session="R" source={metadata?.source} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="reveal-up delay-2">
        <SectionCard title="Report Inputs" subtitle="Use the current season race context as a base or type your own race narrative.">
          <form className="space-y-4" onSubmit={onSubmit}>
            <input
              className="f1-input rounded-2xl px-4 py-3"
              type="number"
              value={season}
              onChange={(event) => setSeason(Number(event.target.value))}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={raceName}
              name="race_name"
              onChange={(event) => setRaceName(event.target.value)}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={winningDriver}
              name="winning_driver"
              onChange={(event) => setWinningDriver(event.target.value)}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={podium}
              name="podium"
              onChange={(event) => setPodium(event.target.value)}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={headlineEvents}
              name="headline_events"
              onChange={(event) => setHeadlineEvents(event.target.value)}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={weather}
              name="weather"
              onChange={(event) => setWeather(event.target.value)}
            />
            <input
              className="f1-input rounded-2xl px-4 py-3"
              value={keyStat}
              name="key_stat"
              onChange={(event) => setKeyStat(event.target.value)}
            />
            <button className="rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" disabled={loading} type="submit">
              {loading ? "Generating..." : "Generate Report"}
            </button>
          </form>
        </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="rounded-[20px] bg-accent px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white">
            {latestRace?.track ?? "Grand Prix"} Debrief Desk
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(latestResultNames.length ? latestResultNames : ["P1", "P2", "P3"]).map((name, index) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">P{index + 1}</p>
                <p className="mt-3 text-sm text-white">{name}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(metadata?.featured_race_context.insights ?? []).slice(0, 3).map((insight) => (
              <div key={insight} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                {insight}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Weather</p>
              <p className="mt-3 text-sm text-white">{weather}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-2">
              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Key Stat</p>
              <p className="mt-3 text-sm text-white">{keyStat}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[24px] border border-white/10 bg-[#121212] p-4">
            {error ? <StatusPanel title="Error" message={error} tone="error" /> : null}
            {report ? (
              <div className="space-y-4">
                <StatusPanel title="Summary" message={report.summary} tone="success" />
                <div className="grid gap-3 md:grid-cols-2">
                  {report.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <StatusPanel title="Ready" message="Feed in the race context to generate a report." />
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
