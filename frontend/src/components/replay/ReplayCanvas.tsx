"use client";

import { useEffect, useRef } from "react";

import { getReplaySnapshot } from "@/services/replayEngine";
import { ReplayDataset, ReplaySnapshot } from "@/types/replay";

type ReplayCanvasProps = {
  dataset: ReplayDataset;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  onFrame?: (snapshot: ReplaySnapshot) => void;
};

function resolveCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  return { width, height, dpr };
}

function drawTrack(
  context: CanvasRenderingContext2D,
  dataset: ReplayDataset,
  width: number,
  height: number,
): void {
  const padding = 52;
  const points = dataset.track.points.map((point) => ({
    x: padding + point.x * (width - padding * 2),
    y: padding + point.y * (height - padding * 2),
  }));

  if (!points.length) {
    context.fillStyle = "rgba(255,255,255,0.72)";
    context.font = "700 20px sans-serif";
    context.fillText("No FastF1 position telemetry available for this selection", padding, height / 2);
    return;
  }

  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 22;
  context.stroke();
  context.strokeStyle = "rgba(225,6,0,0.82)";
  context.lineWidth = 3;
  context.stroke();

  context.beginPath();
  context.arc(points[0].x, points[0].y, 6, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
}

function drawCars(
  context: CanvasRenderingContext2D,
  dataset: ReplayDataset,
  snapshot: ReplaySnapshot,
  width: number,
  height: number,
): void {
  const padding = 52;
  const driversById = new Map(dataset.drivers.map((driver) => [driver.id, driver]));
  const carCount = dataset.drivers.length;
  const radius = carCount > 18 ? 8 : carCount > 12 ? 10 : 12;
  const labelLimit = carCount > 16 ? 8 : carCount > 10 ? 12 : carCount;
  const labeledDrivers = new Set(
    [...snapshot.positions]
      .sort((left, right) => left.position - right.position)
      .slice(0, labelLimit)
      .map((position) => position.driverId),
  );

  snapshot.positions.forEach((position) => {
    const driver = driversById.get(position.driverId);
    if (!driver) {
      return;
    }

    const x = padding + position.x * (width - padding * 2);
    const y = padding + position.y * (height - padding * 2);

    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(0,0,0,0.88)";
    context.fill();
    context.lineWidth = Math.max(2, radius / 3);
    context.strokeStyle = driver.color;
    context.stroke();

    context.beginPath();
    context.arc(x, y, Math.max(3, radius / 3), 0, Math.PI * 2);
    context.fillStyle = driver.color;
    context.fill();

    if (labeledDrivers.has(driver.id)) {
      context.font = "700 11px sans-serif";
      context.fillStyle = "#ffffff";
      context.fillText(driver.code, x + radius + 6, y + 4);
    }
  });
}

function drawHud(
  context: CanvasRenderingContext2D,
  dataset: ReplayDataset,
  snapshot: ReplaySnapshot,
  width: number,
): void {
  context.fillStyle = "rgba(0,0,0,0.62)";
  context.fillRect(18, 18, Math.min(width - 36, 520), 54);
  context.fillStyle = "#e10600";
  context.fillRect(18, 18, Math.min(width - 36, 520) * snapshot.progress, 3);
  context.font = "700 12px sans-serif";
  context.fillStyle = "#ffffff";
  context.fillText(dataset.eventName.toUpperCase(), 34, 44);
  context.font = "500 11px sans-serif";
  context.fillStyle = "rgba(255,255,255,0.62)";
  context.fillText(`Replay time ${(snapshot.timestamp / 1000).toFixed(1)}s`, 34, 62);
}

function renderReplayFrame(canvas: HTMLCanvasElement, dataset: ReplayDataset, timestamp: number): ReplaySnapshot | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const { width, height, dpr } = resolveCanvasSize(canvas);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#080808");
  gradient.addColorStop(0.5, "#111318");
  gradient.addColorStop(1, "#220909");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255,255,255,0.045)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const snapshot = getReplaySnapshot(dataset, timestamp);
  drawTrack(context, dataset, width, height);
  drawCars(context, dataset, snapshot, width, height);
  drawHud(context, dataset, snapshot, width);
  return snapshot;
}

export function ReplayCanvas({ dataset, currentTime, isPlaying, speed, onFrame }: ReplayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const datasetRef = useRef(dataset);
  const currentTimeRef = useRef(currentTime);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const onFrameRef = useRef(onFrame);
  const lastFrameTimeRef = useRef(0);
  const lastReportTimeRef = useRef(0);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    lastFrameTimeRef.current = 0;
  }, [currentTime]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    lastFrameTimeRef.current = 0;
  }, [isPlaying]);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let frameId = 0;
    const render = (now: number) => {
      if (isPlayingRef.current) {
        if (lastFrameTimeRef.current) {
          const elapsed = now - lastFrameTimeRef.current;
          currentTimeRef.current = Math.min(
            currentTimeRef.current + elapsed * speedRef.current,
            datasetRef.current.durationMs,
          );
        }
        lastFrameTimeRef.current = now;
      }

      const snapshot = renderReplayFrame(canvas, datasetRef.current, currentTimeRef.current);
      if (snapshot) {
        const shouldReport = !isPlayingRef.current || now - lastReportTimeRef.current > 120;
        if (shouldReport) {
          lastReportTimeRef.current = now;
          onFrameRef.current?.(snapshot);
        }
      }
      if (isPlayingRef.current && currentTimeRef.current < datasetRef.current.durationMs) {
        frameId = requestAnimationFrame(render);
      }
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isPlaying) {
      return;
    }
    const snapshot = renderReplayFrame(canvas, dataset, currentTime);
    if (snapshot) {
      onFrameRef.current?.(snapshot);
    }
  }, [currentTime, dataset, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[520px] w-full rounded-[30px] border border-red-500/20 bg-black shadow-[0_30px_120px_rgba(225,6,0,0.12)]"
    />
  );
}
