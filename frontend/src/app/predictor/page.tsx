"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { getMetadata, getPrediction } from "@/services/api";
import { MetadataResponse, PredictionResponse, PredictorDriver } from "@/types/api";

export default function PredictorPage() {
  const { token } = useAuth();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [drivers, setDrivers] = useState<PredictorDriver[]>([]);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [raceName, setRaceName] = useState("Silverstone Grand Prix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    async function initialize() {
      try {
        const response = await getMetadata(token ?? undefined, season);
        setMetadata(response);
        setRaceName(`${response.races[0]?.track ?? "Grand Prix"} Grand Prix`);
        setDrivers(
          response.drivers.map((driver, index) => ({
            name: driver.name,
            team: driver.team,
            qualifying_position: index + 1,
            momentum_score: 90 - index * 3,
            tyre_management: 88 - index * 2,
            reliability: 92 - index * 2,
          })),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load driver data.");
      }
    }

    initialize().catch(console.error);
  }, [season, token]);

  function updateDriver(index: number, field: keyof PredictorDriver, value: string) {
    setDrivers((current) =>
      current.map((driver, driverIndex) =>
        driverIndex === index
          ? {
              ...driver,
              [field]:
                field === "name" || field === "team"
                  ? value
                  : Number(value),
            }
          : driver,
      ),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await getPrediction(raceName, drivers, token ?? undefined);
      setPrediction(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to run race prediction.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <p className="f1-kicker">Predictive Modeling</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">F1 Race Result Predictor</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          A compact prediction workspace with bold race-header framing and a standings board built for instant readout.
        </p>
        <div className="mt-5">
          <DataSourcePanel race={metadata?.races[0]?.track ?? undefined} season={metadata?.season ?? season} session="R" source={metadata?.source} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="reveal-up delay-2">
        <SectionCard title="Prediction Inputs" subtitle="Edit the race model factors before running the predictor.">
          <form onSubmit={onSubmit}>
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
            <div className="mt-4 space-y-4">
              {drivers.map((driver, index) => (
                <div key={driver.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{driver.name}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input className="f1-input rounded-2xl px-4 py-3" type="number" value={driver.qualifying_position} onChange={(event) => updateDriver(index, "qualifying_position", event.target.value)} />
                    <input className="f1-input rounded-2xl px-4 py-3" type="number" value={driver.momentum_score} onChange={(event) => updateDriver(index, "momentum_score", event.target.value)} />
                    <input className="f1-input rounded-2xl px-4 py-3" type="number" value={driver.tyre_management} onChange={(event) => updateDriver(index, "tyre_management", event.target.value)} />
                    <input className="f1-input rounded-2xl px-4 py-3" type="number" value={driver.reliability} onChange={(event) => updateDriver(index, "reliability", event.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-5 rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" disabled={loading} type="submit">
              {loading ? "Predicting..." : "Run Prediction"}
            </button>
          </form>
        </SectionCard>
        </div>

        <section className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[30px] p-5 sm:p-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-emerald-200">
            Model ready • trained across three seasons
          </div>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#121212]">
            <div className="grid grid-cols-[0.7fr,2fr,1.5fr,1fr] border-b border-white/10 px-4 py-3 text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">
              <span>Pos</span>
              <span>Driver</span>
              <span>Team</span>
              <span>Score</span>
            </div>
            {error ? <div className="p-4"><StatusPanel title="Error" message={error} tone="error" /></div> : null}
            {(prediction?.predicted_order ?? []).length ? (
              prediction?.predicted_order.map((entry) => (
                <div key={entry.position} className="grid grid-cols-[0.7fr,2fr,1.5fr,1fr] border-b border-white/5 px-4 py-3 text-sm last:border-b-0">
                  <span className="text-red-500">P{entry.position}</span>
                  <span className="text-white">{entry.driver}</span>
                  <span className="text-zinc-500">{entry.team}</span>
                  <span className="text-zinc-300">{entry.score}</span>
                </div>
              ))
            ) : (
              <div className="p-4">
                <StatusPanel title="Ready" message="Run the prediction after adjusting the input factors to see the projected order." />
              </div>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
