export function DataSourcePanel({
  source,
  season,
  race,
  session,
}: {
  source?: string;
  season?: number;
  race?: string;
  session?: string;
}) {
  return (
    <div className="f1-panel rounded-[24px] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-300">
          Source: {source ?? "loading"}
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-300">
          Season: {season ?? "--"}
        </div>
        {race ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-300">
            Race: {race}
          </div>
        ) : null}
        {session ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-300">
            Session: {session}
          </div>
        ) : null}
      </div>
    </div>
  );
}
