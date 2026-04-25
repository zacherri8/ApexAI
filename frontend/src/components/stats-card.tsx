export function StatsCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="f1-panel rounded-[24px] p-5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">{label}</p>
      <p className="mt-4 text-3xl font-black uppercase tracking-[-0.04em]" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
