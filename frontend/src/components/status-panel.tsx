export function StatusPanel({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "error" | "success" | "warning";
}) {
  const toneClass =
    tone === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
      : tone === "success"
        ? "border-red-600/40 bg-red-600/10 text-zinc-100"
        : "border-white/10 bg-white/[0.03] text-zinc-200";

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] opacity-80">{title}</p>
      <p className="mt-3 text-sm leading-6">{message}</p>
    </div>
  );
}
