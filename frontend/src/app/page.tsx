import Link from "next/link";

import { FeaturePoster } from "@/components/feature-poster";
import { Shell } from "@/components/shell";
import { StatsCard } from "@/components/stats-card";

export default function HomePage() {
  return (
    <Shell requiresAuth={false}>
      <section className="page-frame aurora-frame reveal-up rounded-[34px] px-6 py-10 sm:px-8 sm:py-12">
        <video
          autoPlay
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          loop
          muted
          playsInline
        >
          <source src="/videos/abstract-f1.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.28)_48%,rgba(5,5,5,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,5,5,0.18),rgba(5,5,5,0.78))]" />
        <div className="f1-orb f1-orb-red left-10 top-12 h-24 w-24" />
        <div className="f1-orb f1-orb-cyan right-14 top-16 h-20 w-20" />
        <div className="relative z-10">
          <p className="f1-kicker">ApexAI Interface System</p>
          <h2 className="f1-title mt-6 max-w-5xl text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
            FUTURISTIC F1 TOOLS BUILT FOR SPEED, STORYTELLING, AND RACE CONTROL
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
            The interface now leans into a sharper original direction: kinetic light fields, carbon-black control surfaces,
            motorsport red signal accents, and high-drama feature modules that feel like next-generation pit-wall software.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link className="holo-button rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.2em] text-white" href="/dashboard">
              Launch Platform
            </Link>
            <Link className="nav-pill rounded-full border border-white/10 bg-white/5 px-6 py-3 font-bold uppercase tracking-[0.2em]" href="/chatbot">
              Open Chatbot
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="reveal-up delay-1"><StatsCard label="Visual Direction" value="Dark Broadcast" accent="#f5f5f5" /></div>
        <div className="reveal-up delay-2"><StatsCard label="Signature Accent" value="Ferrari Red" accent="#e10600" /></div>
        <div className="reveal-up delay-3"><StatsCard label="Design Intent" value="Future Race OS" accent="#c9c9c9" /></div>
      </section>

      <section className="mt-8 grid gap-6">
        <FeaturePoster
          badge="01 / 05"
          description="An interactive telemetry dashboard for visualizing and comparing lap traces inside a broadcast-grade race analysis surface."
          eyebrow="Telemetry"
          href="/dashboard"
          title="F1 Telemetry Analysis"
        >
          <div className="rounded-[26px] border border-white/10 bg-[#0b0b0b] p-4">
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-zinc-500">
              <span>Japanese GP</span>
              <span>2025</span>
              <span>Qualifying</span>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="scan-panel h-24 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent),#101010] p-3">
                <div className="h-full rounded-xl bg-[linear-gradient(180deg,transparent_0%,transparent_30%,rgba(255,255,255,0.08)_31%,transparent_32%,transparent_60%,rgba(255,255,255,0.08)_61%,transparent_62%),linear-gradient(90deg,rgba(225,6,0,0.95),rgba(225,6,0,0.2)),linear-gradient(90deg,rgba(255,255,255,0.8),rgba(255,255,255,0.15))] bg-[length:100%_100%,70%_2px,55%_2px] bg-[position:0_0,0_30%,0_64%] bg-no-repeat" />
              </div>
              <div className="h-16 rounded-2xl border border-white/10 bg-[#101010] p-3">
                <div className="h-full rounded-xl bg-[linear-gradient(90deg,rgba(225,6,0,0.85),rgba(225,6,0,0.25)),linear-gradient(90deg,rgba(255,255,255,0.85),rgba(255,255,255,0.2))] bg-[length:78%_2px,60%_2px] bg-[position:0_35%,0_70%] bg-no-repeat" />
              </div>
              <div className="h-16 rounded-2xl border border-white/10 bg-[#101010] p-3">
                <div className="h-full rounded-xl bg-[linear-gradient(90deg,rgba(225,6,0,0.9),rgba(225,6,0,0.15)),linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0.18))] bg-[length:65%_2px,72%_2px] bg-[position:0_32%,0_68%] bg-no-repeat" />
              </div>
            </div>
          </div>
        </FeaturePoster>

        <div className="grid gap-6 xl:grid-cols-2">
          <FeaturePoster
            badge="02 / 05"
          description="LLM-powered race engineering with live-call energy, status strips, degradation cues, and decision surfaces built for fast reads."
            eyebrow="Strategy"
            href="/engineer"
            title="AI Race Engineer"
          >
            <div className="rounded-[26px] border border-white/10 bg-[#0b0b0b] p-4">
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-4 rounded-2xl border border-white/10 bg-[#121212] px-4 py-3 text-xs uppercase tracking-[0.22em] text-zinc-500">
                  <span>L37 / 45</span>
                  <span>P3</span>
                  <span>Soft +14 laps</span>
                  <span>31.4 kg</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-4 text-sm text-zinc-300">
                  "Box this lap. Front wing damage sits within limits, but tyre drop-off is approaching the cliff edge."
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-28 rounded-2xl border border-white/10 bg-[#121212] p-3" />
                  <div className="h-28 rounded-2xl border border-white/10 bg-[#121212] p-3" />
                </div>
              </div>
            </div>
          </FeaturePoster>

          <FeaturePoster
            badge="03 / 05"
          description="Automated debrief generation framed like a race newsroom dashboard with a headline band, podium blocks, and high-priority summaries."
            eyebrow="Reporting"
            href="/report"
            title="F1 Race Report Tool"
          >
            <div className="rounded-[26px] border border-white/10 bg-[#0b0b0b] p-4">
              <div className="rounded-2xl bg-accent px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white">
                Chinese Grand Prix 2026
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-3 text-center text-xs uppercase tracking-[0.2em] text-zinc-400">P1</div>
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-3 text-center text-xs uppercase tracking-[0.2em] text-zinc-400">P2</div>
                <div className="rounded-2xl border border-white/10 bg-[#121212] p-3 text-center text-xs uppercase tracking-[0.2em] text-zinc-400">P3</div>
              </div>
              <div className="mt-3 h-40 rounded-2xl border border-white/10 bg-[#121212]" />
            </div>
          </FeaturePoster>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <FeaturePoster
            badge="04 / 05"
          description="Race result projection laid out like a compact standings board with clear rank ordering and high-clarity model framing."
            eyebrow="Prediction"
            href="/predictor"
            title="F1 Race Result Predictor"
          >
            <div className="rounded-[26px] border border-white/10 bg-[#0b0b0b] p-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-emerald-200">
                Model ready / trained across 3 seasons
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#121212]">
                {["P1 Norris", "P2 Piastri", "P3 Verstappen", "P4 Leclerc", "P5 Russell"].map((line) => (
                  <div key={line} className="flex items-center justify-between border-b border-white/5 px-4 py-3 text-sm last:border-b-0">
                    <span>{line}</span>
                    <span className="text-zinc-500">Projected</span>
                  </div>
                ))}
              </div>
            </div>
          </FeaturePoster>

          <FeaturePoster
            badge="05 / 05"
          description="Centered chatbot panel with curated prompts, a focused input rail, and a dark knowledge-console feel."
            eyebrow="Knowledge"
            href="/chatbot"
            title="F1 Knowledge Chatbot"
          >
            <div className="rounded-[26px] border border-white/10 bg-[#0b0b0b] p-6">
              <div className="mx-auto max-w-lg rounded-[24px] border border-white/10 bg-[#121212] px-6 py-8 text-center">
                <p className="f1-title text-3xl">F1</p>
                <p className="mt-2 text-sm text-zinc-400">Formula 1 AI Chatbot</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["Who has the most titles?", "Who is Hamilton's teammate?", "When did Norris first win?", "How many races has Antonelli won?"].map((q) => (
                    <div key={q} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-xs text-zinc-400">
                      {q}
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-zinc-500">
                  Ask anything about Formula One...
                </div>
              </div>
            </div>
          </FeaturePoster>
        </div>
      </section>
    </Shell>
  );
}
