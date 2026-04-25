import { TelemetrySeries } from "@/types/api";

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function TelemetryHud({ series }: { series: TelemetrySeries[] }) {
  const cards = series.map((item) => {
    const speeds = item.points.map((point) => point.speed);
    const throttle = item.points.map((point) => point.throttle);
    const brakes = item.points.map((point) => point.brake);

    return {
      driver: item.driver,
      team: item.team,
      speed: Math.max(...speeds, 0),
      throttle: average(throttle),
      brake: Math.max(...brakes, 0),
    };
  });

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
