import { MathUtils } from 'three';
import { Track, clamp } from './tracks';
import type { ControlInput } from './input';
import type { RaceOptions, Settings } from './types';
import { SPEED_TRAPS, StreetScore } from './street-score';

export interface DriverState {
  distance: number;
  offset: number;
  speed: number;
  headingError: number;
  steer: number;
  slipAngle: number;
  name: string;
  color: string;
  pace: number;
}
export const OPPONENTS = [
  ['F. MOREAU', '#dae1d8'],
  ['K. TANAKA', '#dfac29'],
  ['L. WEBER', '#388888'],
  ['M. SANTOS', '#4169a6'],
  ['E. ROSSI', '#91bd52'],
  ['J. PARK', '#917bb7'],
  ['A. COLE', '#d87934'],
] as const;
export const createDriver = (
  distance: number,
  offset: number,
  name = 'YOU',
  color = '#0cb0bd',
  pace = 1,
): DriverState => ({
  distance,
  offset,
  name,
  color,
  pace,
  speed: 0,
  headingError: 0,
  steer: 0,
  slipAngle: 0,
});
export const gearForSpeed = (speed: number) =>
  clamp(Math.floor((speed * 3.6) / 43) + 1, 1, 8);
export const engineRevs = (speed: number) =>
  clamp(0.32 + (speed * 3.6 - (gearForSpeed(speed) - 1) * 43) / 62, 0, 1);
/** Signed physical separation. Standings use unwrapped distance instead. */
export const trackGap = (a: number, b: number, length: number) =>
  ((((a - b + length / 2) % length) + length) % length) - length / 2;

/** Deterministic racing rules and arcade dynamics. No renderer, DOM or audio ownership. */
export class RaceSession {
  private contact = false;
  readonly score = new StreetScore();
  private passGaps = new Map<DriverState, number>();
  player: DriverState;
  opponents: DriverState[] = [];
  phase: 'countdown' | 'racing' | 'finished' = 'countdown';
  countdown = 3.8;
  raceTime = 0;
  lapStart = 0;
  completedLaps = 0;
  lastLap = 0;
  bestLap = 0;
  battery = 100;
  boosted = false;
  newBest = false;
  finishedPosition = 0;
  onCount: (count: number) => void = () => {};
  onBestLap: (time: number) => void = () => {};
  private lastCount = 4;
  constructor(
    readonly track: Track,
    readonly options: RaceOptions,
    bestLap = 0,
  ) {
    this.bestLap = bestLap;
    this.player = createDriver(
      options.mode === 'race' ? -45 : -12,
      options.mode === 'race' ? 2.7 : 0,
    );
    if (options.mode === 'race')
      this.opponents = OPPONENTS.map(([name, color], i) =>
        createDriver(
          -8 - i * 5,
          (i % 2 ? 1 : -1) * 2.7,
          name,
          color,
          0.85 + i * 0.014,
        ),
      );
  }
  get position() {
    return (
      1 + this.opponents.filter((d) => d.distance > this.player.distance).length
    );
  }
  get offTrack() {
    return Math.abs(this.player.offset) > this.track.circuit.width / 2 - 0.5;
  }
  resetCar() {
    Object.assign(this.player, {
      offset: 0,
      headingError: 0,
      steer: 0,
      slipAngle: 0,
      speed: Math.min(this.player.speed, 18),
    });
    this.score.breakChain();
  }
  finish() {
    if (this.phase === 'finished') return;
    this.finishedPosition = this.position;
    this.phase = 'finished';
    this.boosted = false;
    this.score.bank();
  }
  step(dt: number, controls: ControlInput, settings: Settings) {
    if (this.phase === 'finished') return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const count = Math.ceil(this.countdown);
      if (count !== this.lastCount) {
        this.onCount(count);
        this.lastCount = count;
      }
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.raceTime = 0;
        this.lapStart = 0;
      }
      return;
    }
    this.raceTime += dt;
    this.contact = false;
    this.advancePlayer(dt, controls, settings);
    if (this.finishedPosition > 0) return;
    this.advanceOpponents(dt);
    this.score.update(
      dt,
      this.player.speed,
      this.contact ? 0 : this.player.slipAngle,
      this.offTrack,
    );
  }
  private advancePlayer(
    dt: number,
    controls: ControlInput,
    settings: Settings,
  ) {
    const p = this.player,
      frame = this.track.sample(p.distance),
      wet = this.options.weather === 'rain';
    p.steer = MathUtils.damp(p.steer, controls.steer, 6.5, dt);
    this.boosted =
      controls.boost &&
      this.battery > 1 &&
      controls.throttle > 0.1 &&
      p.speed > 12 &&
      !controls.handbrake &&
      !this.offTrack;
    this.battery = clamp(
      this.battery + (this.boosted ? -22 : controls.brake > 0.1 ? 11 : 5) * dt,
      0,
      100,
    );
    let acceleration =
      controls.throttle * (17.8 - p.speed * 0.044) +
      (this.boosted ? 9.5 : 0) -
      controls.brake * (wet ? 27 : 35) -
      (controls.handbrake ? 9 : 0) -
      1 -
      p.speed * p.speed * 0.00176;
    if (this.offTrack) acceleration -= p.speed * 0.42;
    if (!controls.throttle && !controls.brake) acceleration -= p.speed * 0.018;
    p.speed = clamp(p.speed + acceleration * dt, 0, this.boosted ? 96 : 86);
    const grip = wet ? 0.81 : 1,
      assistance = settings.assists ? 0.87 : 0;
    const sliding = controls.handbrake && p.speed > 12;
    p.slipAngle = MathUtils.damp(
      p.slipAngle,
      sliding ? p.steer * (wet ? 0.72 : 0.62) : 0,
      sliding ? 5 : 2.7,
      dt,
    );
    const steeringRate =
      p.steer * (0.36 + 22 / (p.speed + 36)) * grip * Math.min(1, p.speed / 7);
    p.headingError +=
      (steeringRate -
        frame.curvature * p.speed * (1 - assistance) -
        p.headingError * (sliding ? 1.2 : settings.assists ? 2.6 : 1.3)) *
      dt;
    if (settings.assists && Math.abs(controls.steer) < 0.05)
      p.headingError -= clamp(p.offset * 0.0045, -0.028, 0.028) * dt;
    p.headingError = clamp(p.headingError, -0.6, 0.6);
    p.offset += Math.sin(p.headingError) * p.speed * dt;
    const barrier = this.track.circuit.width / 2 + 5.55;
    if (Math.abs(p.offset) > barrier) {
      p.offset = Math.sign(p.offset) * barrier;
      p.headingError *= -0.3;
      p.speed *= 0.86;
      p.slipAngle *= -0.25;
      this.contact = true;
      this.score.breakChain();
    }
    const previousDistance = p.distance;
    p.distance += p.speed * Math.cos(p.headingError) * dt;
    for (const fraction of SPEED_TRAPS) {
      const gate =
        (Math.floor(Math.max(0, previousDistance) / this.track.length) +
          fraction) *
        this.track.length;
      if (previousDistance < gate && p.distance >= gate && p.speed * 3.6 >= 120)
        this.score.award(
          `SPEED CHECK ${Math.round(p.speed * 3.6)} KM/H`,
          Math.round(p.speed * 3.6),
        );
    }
    if (previousDistance < 0 && p.distance >= 0) this.lapStart = this.raceTime;
    this.checkLap();
  }
  private checkLap() {
    const crossed = Math.floor(
      Math.max(0, this.player.distance) / this.track.length,
    );
    if (crossed <= this.completedLaps) return;
    this.lastLap = this.raceTime - this.lapStart;
    this.lapStart = this.raceTime;
    this.completedLaps = crossed;
    if (!this.bestLap || this.lastLap < this.bestLap) {
      this.bestLap = this.lastLap;
      this.newBest = true;
      this.onBestLap(this.lastLap);
    }
    if (this.options.mode === 'race' && crossed >= 2) this.finish();
  }
  private advanceOpponents(dt: number) {
    const p = this.player,
      wet = this.options.weather === 'rain',
      length = this.track.length;
    for (let i = 0; i < this.opponents.length; i++) {
      const ai = this.opponents[i],
        frame = this.track.sample(ai.distance),
        ahead = this.track.sample(ai.distance + 45);
      const curvature = Math.max(
        Math.abs(frame.curvature),
        Math.abs(ahead.curvature),
      );
      const target =
        clamp(Math.sqrt((wet ? 24 : 30) / Math.max(curvature, 0.002)), 27, 78) *
        ai.pace;
      ai.speed = MathUtils.damp(
        ai.speed,
        target,
        ai.speed < target ? 0.42 : 1.6,
        dt,
      );
      let lane = Math.sin(ai.distance * 0.003 + i * 1.7) * 2.6;
      if (Math.abs(trackGap(ai.distance, p.distance, length)) < 18)
        lane = MathUtils.lerp(lane, p.offset > 0 ? -3.2 : 3.2, 0.8);
      for (const other of this.opponents) {
        if (ai === other) continue;
        const gap = trackGap(other.distance, ai.distance, length);
        if (gap > 0 && gap < 9 && Math.abs(other.offset - ai.offset) < 1.7) {
          ai.speed = Math.min(ai.speed, other.speed);
          lane = clamp(other.offset + (i % 2 ? 2.4 : -2.4), -4.4, 4.4);
        }
      }
      ai.offset = MathUtils.damp(ai.offset, lane, 1, dt);
      ai.distance += ai.speed * dt;
      const gap = trackGap(ai.distance, p.distance, length);
      const previousGap = this.passGaps.get(ai);
      const lateral = Math.abs(ai.offset - p.offset);
      if (
        previousGap !== undefined &&
        previousGap > 0 &&
        previousGap < 3 &&
        gap <= 0 &&
        gap > -3 &&
        lateral > 1.95 &&
        lateral < 3.5 &&
        p.speed > 18
      )
        this.score.award('NEAR MISS', 150);
      this.passGaps.set(ai, gap);
      if (
        Math.abs(trackGap(ai.distance, p.distance, length)) < 4.2 &&
        Math.abs(ai.offset - p.offset) < 1.95
      ) {
        p.speed = Math.min(p.speed, Math.max(8, ai.speed * 0.91));
        p.offset += Math.sign(p.offset - ai.offset || 1) * dt * 3;
        this.contact = true;
        this.score.breakChain();
      }
    }
  }
  /** Repeatable driving input used by browser benchmarks, never enabled by normal gameplay. */
  benchmarkInput(settings: Settings): ControlInput {
    const p = this.player,
      f = this.track.sample(p.distance),
      ahead = this.track.sample(p.distance + 50);
    const target = clamp(
      Math.sqrt(
        24 / Math.max(Math.abs(f.curvature), Math.abs(ahead.curvature), 0.002),
      ),
      32,
      82,
    );
    const denominator =
      (0.36 + 22 / (p.speed + 36)) *
      (this.options.weather === 'rain' ? 0.81 : 1);
    return {
      steer: clamp(
        (f.curvature * p.speed * (settings.assists ? 0.13 : 1) -
          p.offset * 0.06 -
          p.headingError * 1.8) /
          denominator,
        -1,
        1,
      ),
      throttle: p.speed < target ? 1 : 0.15,
      brake: p.speed > target + 2 ? 0.4 : 0,
      boost: false,
      handbrake: false,
    };
  }
}
