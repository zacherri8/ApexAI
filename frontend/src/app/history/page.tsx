"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { Shell } from "@/components/shell";
import { StatsCard } from "@/components/stats-card";
import { StatusPanel } from "@/components/status-panel";
import { getHistory, getMetadata } from "@/services/api";
import { MetadataResponse, SavedActivity } from "@/types/api";

const toneMap: Record<string, string> = {
  strategy: "border-red-500/25 bg-red-600/10",
  report: "border-cyan-400/20 bg-cyan-400/10",
  prediction: "border-emerald-400/20 bg-emerald-400/10",
  chat: "border-fuchsia-400/20 bg-fuchsia-400/10",
};

function formatJson(payload: string) {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export default function HistoryPage() {
  const { token } = useAuth();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [activities, setActivities] = useState<SavedActivity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    getMetadata(token ?? undefined, season)
      .then(setMetadata)
      .catch((loadError: Error) => setError(loadError.message));

    getHistory(token ?? undefined)
      .then((response) => setActivities(response.activities))
      .catch((loadError: Error) => setError(loadError.message));
  }, [season, token]);

  const grouped = useMemo(() => {
    return {
      strategy: activities.filter((item) => item.activity_type === "strategy"),
      report: activities.filter((item) => item.activity_type === "report"),
      prediction: activities.filter((item) => item.activity_type === "prediction"),
      chat: activities.filter((item) => item.activity_type === "chat"),
    };
  }, [activities]);

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <p className="f1-kicker">Activity History</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">Saved Race Intelligence</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          Review every saved strategy call, prediction, and race report generated inside your workspace.
        </p>
        <div className="mt-5">
          <DataSourcePanel
            race={metadata?.featured_race_context.race_name ?? undefined}
            season={metadata?.season ?? season}
            session="R"
            source={metadata?.source}
          />
        </div>
      </section>

      <div className="mt-4 max-w-xs">
        <input
          className="f1-input rounded-2xl px-4 py-3"
          type="number"
          value={season}
          onChange={(event) => setSeason(Number(event.target.value))}
        />
      </div>

      {error ? (
        <div className="mt-6">
          <StatusPanel title="Error" message={error} tone="error" />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="reveal-up delay-1">
          <StatsCard label="Saved Strategy" value={String(grouped.strategy.length)} accent="#ff5f56" />
        </div>
        <div className="reveal-up delay-2">
          <StatsCard label="Saved Predictions" value={String(grouped.prediction.length)} accent="#5eead4" />
        </div>
        <div className="reveal-up delay-3">
          <StatsCard label="Saved Reports" value={String(grouped.report.length)} accent="#67e8f9" />
        </div>
        <div className="reveal-up delay-3">
          <StatsCard label="Saved Chats" value={String(grouped.chat.length)} accent="#f0abfc" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {(["strategy", "prediction", "report", "chat"] as const).map((type, index) => (
          <section key={type} className={`f1-panel reveal-up delay-${Math.min(index + 1, 3)} rounded-[30px] p-5 sm:p-6`}>
            <div className="warp-line border-b border-white/10 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{type} history</p>
            </div>
            <div className="mt-4 space-y-4">
              {grouped[type].length ? (
                grouped[type].map((activity) => (
                  <details
                    key={activity.id}
                    className={`group rounded-[24px] border ${toneMap[type]} border-white/10`}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{activity.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{activity.summary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-3 text-[0.68rem] uppercase tracking-[0.24em] text-zinc-400 group-open:text-white">
                          Open
                        </p>
                      </div>
                    </summary>
                    <div className="border-t border-white/10 px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Type</p>
                          <p className="mt-3 text-sm text-white">{activity.activity_type}</p>
                        </div>
                        <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Created</p>
                          <p className="mt-3 text-sm text-white">{new Date(activity.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-[20px] border border-white/10 bg-black/30 p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500">Stored Payload</p>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-300">
                          {formatJson(activity.payload)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <StatusPanel
                  title="No Saved Items"
                  message={`Generate a ${type} to have it automatically appear in your history.`}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
