"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { DataSourcePanel } from "@/components/data-source-panel";
import { SectionCard } from "@/components/section-card";
import { Shell } from "@/components/shell";
import { StatusPanel } from "@/components/status-panel";
import { askChatbot, getMetadata } from "@/services/api";
import { ChatResponse, MetadataResponse } from "@/types/api";

const suggestedQuestions = [
  "When should a team consider an undercut?",
  "How does tyre degradation affect strategy calls?",
  "Why is Silverstone sensitive to tyre temperature management?",
];

export default function ChatbotPage() {
  const { token } = useAuth();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [question, setQuestion] = useState(suggestedQuestions[0]);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setMetadata(null);
    setResponse(null);
    setError("");

    getMetadata(token ?? undefined, season)
      .then((result) => {
        if (active) {
          setMetadata(result);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await askChatbot(question, token ?? undefined, season);
      setResponse(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to query chatbot.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="f1-orb f1-orb-cyan right-12 top-10 h-24 w-24" />
        <p className="f1-kicker">RAG Assistant</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">F1 Knowledge Chatbot</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
          A centered knowledge console with prompt chips, dramatic spacing, and a focused conversational frame instead of a generic utility layout.
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

      <div className="mt-6">
        <section className="f1-panel mesh-card reveal-up delay-2 rounded-[32px] px-6 py-8 sm:px-8">
          <div className="scan-panel mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-[#111111] px-5 py-8 sm:px-8">
            <div className="text-center">
              <p className="f1-title text-4xl">F1</p>
              <p className="mt-2 text-zinc-400">Formula 1 AI Chatbot</p>
            </div>
            <div className="mx-auto mt-6 max-w-2xl">
              <label className="text-sm text-zinc-300">
                Season
                <input
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  type="number"
                  value={season}
                  onChange={(event) => setSeason(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {suggestedQuestions
                .concat(
                  metadata?.featured_race_context
                    ? `Who won ${metadata.featured_race_context.race_name}?`
                    : "Who has the most world titles?",
                )
                .map((item) => (
                <button
                  key={item}
                  className="f1-chip rounded-2xl px-4 py-4 text-left text-sm text-zinc-300"
                  type="button"
                  onClick={() => setQuestion(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <form className="mx-auto mt-8 max-w-2xl" onSubmit={onSubmit}>
              <textarea
                className="f1-input min-h-28 rounded-[24px] px-4 py-4"
                name="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Press Enter to send / Shift+Enter for new line</p>
                <button className="rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" disabled={loading} type="submit">
                  {loading ? "Thinking..." : "Ask"}
                </button>
              </div>
            </form>
            <div className="mx-auto mt-8 max-w-2xl">
              {error ? <StatusPanel title="Error" message={error} tone="error" /> : null}
              {response ? (
                <div className="space-y-4">
                  <StatusPanel title="Answer" message={response.answer} tone="success" />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
