export function CompareSpectrum({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  max,
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  max: number;
}) {
  const leftWidth = Math.max(8, Math.min(100, (leftValue / max) * 100));
  const rightWidth = Math.max(8, Math.min(100, (rightValue / max) * 100));

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-zinc-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="mt-4 grid gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
            <span>{leftValue.toFixed(1)}</span>
            <span>Left</span>
          </div>
          <div className="meter-track">
            <div className="meter-fill meter-fill-red" style={{ width: `${leftWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
            <span>{rightValue.toFixed(1)}</span>
            <span>Right</span>
          </div>
          <div className="meter-track">
            <div className="meter-fill meter-fill-cyan" style={{ width: `${rightWidth}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
