import { TelemetryDriverMetrics } from "@/types/api";

export function TelemetryHud({ metrics }: { metrics: TelemetryDriverMetrics[] }) {
  const cards = metrics.map((item) => ({
    driver: item.driver,
    team: item.team,
    color: item.color,
    speed: item.top_speed,
    throttle: item.average_throttle,
    brake: item.brake_pct,
    lap: item.fastest_lap_seconds,
    compound: item.compound,
    drs: item.drs_pct,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map((card, index) => (
        <article key={card.driver} className="f1-panel mesh-card overflow-hidden rounded-[26px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-zinc-500">{card.team}</p>
              <h3 className="f1-title mt-3 text-2xl">{card.driver}</h3>
            </div>
            <div className={`radar-ring ${index % 2 === 0 ? "ring-red" : "ring-cyan"}`}>
              <span>{Math.round(card.speed)}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">Lap</p>
              <p className="mt-2 text-lg font-semibold text-white">{card.lap ? `${card.lap.toFixed(3)}s` : "--"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">Compound</p>
              <p className="mt-2 text-lg font-semibold text-white">{card.compound ?? "--"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">DRS</p>
              <p className="mt-2 text-lg font-semibold text-white">{card.drs != null ? `${card.drs.toFixed(0)}%` : "--"}</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {[
              ["Speed", card.speed, 340],
              ["Throttle", card.throttle, 100],
              ["Brake", card.brake, 100],
            ].map(([label, value, max]) => {
              const pct = Math.max(6, Math.min(100, (Number(value) / Number(max)) * 100));
              return (
                <div key={String(label)}>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-zinc-500">
                    <span>{label}</span>
                    <span>{Math.round(Number(value))}</span>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
