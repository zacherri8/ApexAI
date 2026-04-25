"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ReplayCanvas } from "@/components/replay/ReplayCanvas";
import { ReplayControls } from "@/components/replay/ReplayControls";
import { getSeasonCalendar, getSeasons } from "@/services/api";
import { loadReplayDataset } from "@/services/telemetryService";
import { SeasonCalendarResponse } from "@/types/api";
import { ReplayDataset, ReplaySnapshot, ReplaySpeed } from "@/types/replay";

export function RaceReplay({ initialDataset }: { initialDataset?: ReplayDataset }) {
  const { token } = useAuth();
  const [dataset, setDataset] = useState<ReplayDataset | null>(initialDataset ?? null);
  const [calendar, setCalendar] = useState<SeasonCalendarResponse | null>(null);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [snapshot, setSnapshot] = useState<ReplaySnapshot | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [grandPrix, setGrandPrix] = useState("");
  const [session, setSession] = useState("R");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const calendarRequestRef = useRef(0);
  const replayRequestRef = useRef(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    getSeasons(token)
      .then(setSeasons)
      .catch(() => setSeasons(Array.from({ length: new Date().getFullYear() - 1949 }, (_, index) => new Date().getFullYear() - index)));
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const requestId = ++calendarRequestRef.current;
    setMetadataLoading(true);
    setCalendar(null);
    setDataset(null);
    setSnapshot(null);
    setCurrentTime(0);
    setIsPlaying(false);
    getSeasonCalendar(year, token)
      .then((response) => {
        if (requestId !== calendarRequestRef.current) {
          return;
        }
        const completedRaces = response.races.filter((race) => {
          if (!race.date) {
            return false;
          }
          const raceDate = new Date(`${race.date}T00:00:00`);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return !Number.isNaN(raceDate.getTime()) && raceDate <= today;
        });
        setCalendar(response);
        setGrandPrix((current) => {
          if (current && completedRaces.some((race) => race.track === current)) {
            return current;
          }
          const nextRace = completedRaces[0]?.track ?? "";
          if (!nextRace) {
            setDataset(null);
          }
          return nextRace;
        });
        setSession((current) =>
          response.available_sessions.includes(current)
            ? current
            : response.available_sessions[0] ?? "R",
        );
      })
      .catch(() => {
        if (requestId !== calendarRequestRef.current) {
          return;
        }
        setCalendar({
          season: year,
          source: "fastf1-unavailable",
          available_sessions: ["FP1", "FP2", "FP3", "Q", "R"],
          races: [],
          notice: `FastF1 could not load the ${year} season schedule in the current environment.`,
        });
        setGrandPrix("");
        setDataset(null);
      })
      .finally(() => {
        if (requestId === calendarRequestRef.current) {
          setMetadataLoading(false);
        }
      });
  }, [initialDataset, token, year]);

  useEffect(() => {
    if (initialDataset) {
      return;
    }
    if (!grandPrix) {
      return;
    }

    const requestId = ++replayRequestRef.current;
    setLoading(true);
    setDataset(null);
    setSnapshot(null);
    setCurrentTime(0);
    setIsPlaying(false);
    loadReplayDataset(token ?? undefined, { year, grandPrix, session })
      .then((loadedDataset) => {
        if (requestId !== replayRequestRef.current) {
          return;
        }
        setDataset(loadedDataset);
      })
      .catch(console.error)
      .finally(() => {
        if (requestId === replayRequestRef.current) {
          setLoading(false);
        }
      });
  }, [grandPrix, initialDataset, session, token, year]);

  useEffect(() => {
    if (!dataset) {
      return;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, [dataset]);

  const leader = useMemo(() => {
    if (!snapshot || !dataset) {
      return null;
    }
    const leadingPosition = [...snapshot.positions].sort((left, right) => left.position - right.position)[0];
    return dataset.drivers.find((driver) => driver.id === leadingPosition?.driverId) ?? null;
  }, [dataset, snapshot]);

  const replayableRaces = useMemo(() => {
    if (!calendar) {
      return [];
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return calendar.races.filter((race) => {
      if (!race.date) {
        return false;
      }
      const raceDate = new Date(`${race.date}T00:00:00`);
      return !Number.isNaN(raceDate.getTime()) && raceDate <= today;
    });
  }, [calendar]);

  const sessionOptions = calendar?.available_sessions.length
    ? calendar.available_sessions
    : ["FP1", "FP2", "FP3", "Q", "R"];

  const selectedRaceDate = replayableRaces.find((race) => race.track === grandPrix)?.date;
  const waitingMessage = metadataLoading
    ? `Loading the ${year} FastF1 season calendar...`
    : calendar?.source === "fastf1-unavailable"
    ? calendar.notice ?? `FastF1 could not load the ${year} season schedule in the current environment.`
    : replayableRaces.length === 0
    ? `No completed Grand Prix sessions are available to replay for ${year} yet.`
    : loading
    ? `Loading ${grandPrix} ${year} ${session} replay telemetry from FastF1...`
    : "Select a completed Grand Prix session to load replay telemetry.";

  if (!dataset) {
    return (
      <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-zinc-300">
        <p className="f1-kicker">Race Replay</p>
        <h2 className="f1-title mt-4 text-3xl">Waiting for FastF1 data</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-zinc-300">
            Season
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {(seasons.length ? seasons : [year]).map((seasonOption) => (
                <option key={seasonOption} value={seasonOption}>
                  {seasonOption}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Grand Prix
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={grandPrix}
              onChange={(event) => setGrandPrix(event.target.value)}
              disabled={metadataLoading || !replayableRaces.length}
            >
              {replayableRaces.length ? (
                replayableRaces.map((race) => (
                  <option key={`${race.id}-${race.track}`} value={race.track}>
                    {race.track} - {race.date}
                  </option>
                ))
              ) : (
                <option value="">{waitingMessage}</option>
              )}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Session
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={session}
              onChange={(event) => setSession(event.target.value)}
            >
              {sessionOptions.map((sessionCode) => (
                <option key={sessionCode} value={sessionCode}>
                  {sessionCode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
          {waitingMessage}
        </p>
      </div>
    );
  }

  function seek(time: number) {
    setCurrentTime(time);
  }

  function restart() {
    setCurrentTime(0);
    setIsPlaying(false);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="f1-kicker">Race Replay</p>
            <h2 className="f1-title mt-3 text-3xl sm:text-4xl">{dataset.eventName}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              FastF1-backed replay: timestamped driver positions, normalized XY coordinates, interpolation, and a requestAnimationFrame Canvas loop.
            </p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-600/10 px-4 py-3 text-sm text-zinc-200">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-red-300">Leader</span>
            {leader ? `${leader.name} - ${leader.team}` : "Awaiting telemetry"}
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-zinc-300">
            Season
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {(seasons.length ? seasons : [year]).map((seasonOption) => (
                <option key={seasonOption} value={seasonOption}>
                  {seasonOption}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Grand Prix
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={grandPrix}
              onChange={(event) => setGrandPrix(event.target.value)}
              disabled={metadataLoading || !replayableRaces.length}
            >
              {replayableRaces.map((race) => (
                <option key={`${race.id}-${race.track}`} value={race.track}>
                  {race.track} - {race.date}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Session
            <select
              className="f1-input mt-2 rounded-2xl px-4 py-3"
              value={session}
              onChange={(event) => setSession(event.target.value)}
            >
              {sessionOptions.map((sessionCode) => (
                <option key={sessionCode} value={sessionCode}>
                  {sessionCode}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Calendar Source</span>
            {calendar?.source ?? "loading"}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Replay Source</span>
            {dataset.source}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Telemetry</span>
            {dataset.telemetryAvailable ? "FastF1 position data" : "FastF1 unavailable"}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Drivers Loaded</span>
            {dataset.drivers.length}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Selected Race Date</span>
            {selectedRaceDate ?? "Unavailable"}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <span className="block text-[0.65rem] uppercase tracking-[0.28em] text-zinc-500">Replay Length</span>
            {(dataset.durationMs / 1000).toFixed(0)}s
          </div>
        </div>

        {loading ? (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-600/10 px-4 py-3 text-sm text-red-100">
            Loading FastF1 replay data. First load can take a while while the session is cached locally.
          </div>
        ) : null}
        {dataset.notice ? (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {dataset.notice}
          </div>
        ) : null}

        <ReplayCanvas
          currentTime={currentTime}
          dataset={dataset}
          isPlaying={isPlaying}
          onFrame={(nextSnapshot) => {
            setSnapshot(nextSnapshot);
            setCurrentTime(nextSnapshot.timestamp);
            if (nextSnapshot.timestamp >= dataset.durationMs) {
              setIsPlaying(false);
            }
          }}
          speed={speed}
        />
      </div>

      <ReplayControls
        currentTime={currentTime}
        duration={dataset.durationMs}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((value) => !value)}
        onRestart={restart}
        onSeek={seek}
        onSpeedChange={setSpeed}
        speed={speed}
      />
    </section>
  );
}
