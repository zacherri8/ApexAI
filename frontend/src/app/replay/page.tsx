"use client";

import { RaceReplay } from "@/components/replay/RaceReplay";
import { Shell } from "@/components/shell";

export default function ReplayPage() {
  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <p className="f1-kicker">Race Replay Engine</p>
        <h2 className="f1-title mt-5 text-4xl sm:text-5xl">Live Replay Canvas</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
          A web-native rebuild of the FastF1 replay idea: processed driver positions, time-based interpolation, Canvas rendering, and playback controls.
        </p>
      </section>

      <div className="mt-6">
        <RaceReplay />
      </div>
    </Shell>
  );
}
