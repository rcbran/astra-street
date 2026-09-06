import type { Phase, Quality } from './types';
export const RACING_FPS = 30;
export function frameTarget(phase: Phase) {
  return phase === 'paused' || phase === 'finished' ? 20 : RACING_FPS;
}
export interface FrameSample {
  fps: number;
  frameP95: number;
  renderP95: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  phase: Phase;
  time: number;
}
export interface FrameTick {
  delta: number;
  interval: number;
}
/** Keeps a render deadline independent of the display refresh and simulation clock. */
export class FrameScheduler {
  private nextFrame = 0;
  private lastFrame = 0;
  private targetFps = 0;
  reset(now: number) {
    this.nextFrame = now;
    this.lastFrame = now;
    this.targetFps = 0;
  }
  tick(now: number, fps: number): FrameTick | null {
    if (fps !== this.targetFps) {
      this.targetFps = fps;
      this.nextFrame = now;
    }
    if (now + 1 < this.nextFrame) return null;
    const interval = 1000 / fps;
    const elapsed = this.lastFrame ? now - this.lastFrame : interval;
    // Retain remainder: resetting the deadline to `now` quantizes 144 Hz to 48 FPS.
    this.nextFrame +=
      Math.max(1, Math.floor((now - this.nextFrame) / interval) + 1) * interval;
    this.lastFrame = now;
    return {
      delta: Math.min(0.1, Math.max(0, elapsed) / 1000),
      interval: elapsed,
    };
  }
}
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ] ?? 0;
export class FrameMetrics {
  history: FrameSample[] = [];
  latest: FrameSample | null = null;
  private from = 0;
  private intervals: number[] = [];
  private submitTimes: number[] = [];
  reset(now: number) {
    this.from = now;
    this.intervals = [];
    this.submitTimes = [];
  }
  record(
    now: number,
    interval: number,
    submit: number,
    details: Omit<FrameSample, 'fps' | 'frameP95' | 'renderP95'>,
  ): FrameSample | null {
    if (!this.from) this.from = now;
    this.intervals.push(interval);
    this.submitTimes.push(submit);
    if (now - this.from < 1000) return null;
    const sample = {
      ...details,
      fps: (this.intervals.length * 1000) / (now - this.from),
      frameP95: percentile(this.intervals, 0.95),
      renderP95: percentile(this.submitTimes, 0.95),
    };
    this.history.push(sample);
    if (this.history.length > 600) this.history.shift();
    this.latest = sample;
    this.reset(now);
    return sample;
  }
}
export class ResolutionBudget {
  scale = 1;
  private slow = 0;
  private fast = 0;
  reset() {
    this.scale = 1;
    this.slow = 0;
    this.fast = 0;
  }
  pixelRatio(
    width: number,
    height: number,
    deviceRatio: number,
    quality: Quality,
  ) {
    const pixels =
      quality === 'eco'
        ? 1280 * 720
        : quality === 'ultra'
          ? 2560 * 1440
          : 1920 * 1080;
    return (
      Math.min(
        deviceRatio,
        quality === 'ultra' ? 2 : 1.5,
        Math.sqrt(pixels / (width * height)),
      ) * this.scale
    );
  }
  adapt(sample: FrameSample, quality: Quality): boolean {
    if (sample.phase !== 'racing' || quality === 'ultra') return false;
    // The visual budget targets 30 FPS. A healthy capped sample must never
    // trigger the old 60 FPS controller's permanent resolution reduction.
    this.slow = sample.fps < 25 ? this.slow + 1 : Math.max(0, this.slow - 1);
    this.fast = sample.fps > 29 && sample.renderP95 < 18 ? this.fast + 1 : 0;
    if (this.slow >= 3 && this.scale > 0.7) {
      this.scale = Math.max(0.7, this.scale - 0.08);
      this.slow = 0;
      return true;
    }
    if (this.fast >= 15 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.04);
      this.fast = 0;
      return true;
    }
    return false;
  }
}
