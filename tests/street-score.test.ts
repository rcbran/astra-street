import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CIRCUITS, Track } from '../src/game/tracks';
import { RaceSession } from '../src/game/race-session';
import { StreetScore, SPEED_TRAPS } from '../src/game/street-score';
import { DEFAULT_SETTINGS } from '../src/game/types';

const track = new Track(CIRCUITS[0]);
const neutral = {
  throttle: 0,
  brake: 0,
  steer: 0,
  boost: false,
  handbrake: false,
};
const dt = 1 / 120;
const race = () => {
  const s = new RaceSession(track, {
    circuit: 'riviera',
    weather: 'clear',
    mode: 'time-trial',
  });
  s.phase = 'racing';
  s.player.distance = 80;
  s.player.speed = 32;
  return s;
};

test('handbrake creates a recoverable slide, ordinary steering does not score a drift', () => {
  const drift = race(),
    grip = race();
  for (let i = 0; i < 70; i++) {
    drift.step(
      dt,
      { ...neutral, throttle: 1, steer: 0.65, handbrake: true },
      DEFAULT_SETTINGS,
    );
    grip.step(dt, { ...neutral, throttle: 1, steer: 0.65 }, DEFAULT_SETTINGS);
  }
  assert.ok(drift.player.slipAngle > 0.25);
  assert.ok(drift.score.chain > 40);
  assert.equal(grip.player.slipAngle, 0);
  assert.equal(grip.score.chain, 0);
  for (let i = 0; i < 480; i++)
    drift.step(dt, drift.benchmarkInput(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  assert.ok(Math.abs(drift.player.slipAngle) < 0.001);
  assert.ok(drift.score.total > 40);
  assert.equal(drift.score.chain, 0);
});

test('clean chains bank with their multiplier, contact loses unbanked points', () => {
  const score = new StreetScore();
  score.award('NEAR MISS', 600);
  assert.equal(score.total, 0);
  assert.equal(score.multiplier, 2);
  for (let i = 0; i < 241; i++) score.update(dt, 40, 0, false);
  assert.equal(score.total, 1200);
  score.award('NEAR MISS', 150);
  score.breakChain();
  score.bank();
  assert.equal(score.total, 1200);
  assert.equal(score.chain, 0);
  assert.equal(score.multiplier, 1);
});

test('speed checks score only a forward gate crossing above threshold', () => {
  const s = race();
  s.player.distance = track.length * SPEED_TRAPS[0] - 0.2;
  s.player.speed = 45;
  s.step(dt, neutral, DEFAULT_SETTINGS);
  const points = s.score.chain;
  assert.ok(points >= 160);
  for (let i = 0; i < 40; i++) s.step(dt, neutral, DEFAULT_SETTINGS);
  assert.equal(s.score.chain, points);
  const slow = race();
  slow.player.distance = track.length * SPEED_TRAPS[0] - 0.02;
  slow.player.speed = 15;
  slow.step(dt, neutral, DEFAULT_SETTINGS);
  assert.equal(slow.score.chain, 0);
});

test('finishing banks once and freezes score; reset drops the current chain', () => {
  const s = race();
  s.score.award('NEAR MISS', 150);
  s.resetCar();
  assert.equal(s.score.chain, 0);
  s.score.award('NEAR MISS', 150);
  s.finish();
  assert.equal(s.score.total, 150);
  for (let i = 0; i < 200; i++)
    s.step(
      dt,
      { ...neutral, throttle: 1, steer: 1, handbrake: true },
      DEFAULT_SETTINGS,
    );
  s.finish();
  assert.equal(s.score.total, 150);
});

test('a close overtake awards once and body contact breaks the chain', () => {
  const s = new RaceSession(track, {
    circuit: 'riviera',
    weather: 'clear',
    mode: 'race',
  });
  s.phase = 'racing';
  s.opponents = s.opponents.slice(0, 1);
  Object.assign(s.player, { distance: 89.5, offset: 2.2, speed: 55 });
  Object.assign(s.opponents[0], { distance: 91, offset: 0, speed: 30 });
  for (let i = 0; i < 45; i++) s.step(dt, neutral, DEFAULT_SETTINGS);
  assert.equal(s.score.chain, 150);
  Object.assign(s.opponents[0], {
    distance: s.player.distance + 1,
    offset: s.player.offset,
    speed: 30,
  });
  s.step(dt, neutral, DEFAULT_SETTINGS);
  assert.equal(s.score.chain, 0);
});
