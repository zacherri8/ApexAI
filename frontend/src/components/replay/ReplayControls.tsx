import { ReplaySpeed } from "@/types/replay";

const speedOptions: ReplaySpeed[] = [0.5, 1, 2, 4];

type ReplayControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: ReplaySpeed;
  onPlayPause: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
};

function formatReplayTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ReplayControls({
  isPlaying,
  currentTime,
  duration,
  speed,
  onPlayPause,
  onRestart,
  onSeek,
  onSpeedChange,
}: ReplayControlsProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/50 p-4 shadow-[0_18px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-red-500"
            onClick={onPlayPause}
            type="button"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-200 transition hover:border-red-500/60 hover:bg-red-600/10"
            onClick={onRestart}
            type="button"
          >
            Restart
          </button>
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            {formatReplayTime(currentTime)} / {formatReplayTime(duration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {speedOptions.map((option) => (
            <button
              key={option}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                speed === option
                  ? "border-red-500/70 bg-red-600/20 text-white"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-red-500/50 hover:text-white"
              }`}
              onClick={() => onSpeedChange(option)}
              type="button"
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <input
        aria-label="Replay timeline"
        className="mt-5 h-2 w-full cursor-pointer accent-red-600"
        max={duration}
        min={0}
        onChange={(event) => onSeek(Number(event.target.value))}
        step={250}
        type="range"
        value={currentTime}
      />
    </div>
  );
}
