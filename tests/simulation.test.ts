import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { RaceSession, trackGap } from '../src/game/race-session';
import { RaceCamera } from '../src/game/camera';
import { CIRCUITS, Track } from '../src/game/tracks';
import { DEFAULT_SETTINGS } from '../src/game/types';
import { normalizeSettings } from '../src/game/settings';
import {
  FrameScheduler,
  frameTarget,
  ResolutionBudget,
  type FrameSample,
} from '../src/game/render-loop';

const dt = 1 / 120;
const neutral = {
  steer: 0,
  throttle: 0,
  brake: 0,
  boost: false,
  handbrake: false,
};
const tracks = CIRCUITS.map((c) => new Track(c));
const session = (mode: 'race' | 'time-trial' = 'time-trial') =>
  new RaceSession(tracks[0], { circuit: 'riviera', weather: 'clear', mode });

for (const hz of [60, 75, 90, 120, 144, 165]) {
  test(`30 FPS limiter preserves deadlines on a ${hz} Hz display`, () => {
    const scheduler = new FrameScheduler();
    scheduler.reset(1000);
    let rendered = 0;
    for (let i = 0; i < hz * 10; i++)
      if (scheduler.tick(1000 + (i * 1000) / hz, frameTarget('racing')))
        rendered++;
    assert.ok(Math.abs(rendered - 300) <= 1, `${rendered} frames`);
  });
}

test('pixel budgets retain detail at 30 FPS, reduce sustained misses and recover slowly', () => {
  const budget = new ResolutionBudget();
  for (const [quality, limit] of [
    ['eco', 1280 * 720],
    ['balanced', 1920 * 1080],
    ['ultra', 2560 * 1440],
  ] as const) {
    const ratio = budget.pixelRatio(1728, 1117, 2, quality);
    assert.ok(1728 * 1117 * ratio ** 2 <= limit + 1);
  }
  const sample = { phase: 'racing', fps: 30, renderP95: 3 } as FrameSample;
  for (let i = 0; i < 20; i++)
    assert.equal(budget.adapt(sample, 'balanced'), false);
  assert.equal(budget.scale, 1);
  for (let i = 0; i < 3; i++) budget.adapt({ ...sample, fps: 23 }, 'balanced');
  assert.ok(budget.scale < 1);
  const reduced = budget.scale;
  for (let i = 0; i < 14; i++) budget.adapt(sample, 'balanced');
  assert.equal(budget.scale, reduced);
  assert.equal(budget.adapt(sample, 'balanced'), true);
  assert.ok(budget.scale > reduced);
  assert.equal(frameTarget('countdown'), 30);
  assert.equal(frameTarget('menu'), 30);
  assert.equal(frameTarget('paused'), 20);
});

for (const track of tracks) {
  test(`${track.circuit.name} is continuous through negative and multi-lap distances`, () => {
    assert.ok(track.length > 2500);
    for (const distance of [-55, 0, 123, track.length - 1]) {
      const a = track.sample(distance),
        b = track.sample(distance + track.length * 3);
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-7);
      assert.ok(Math.abs(a.tx * a.nx + a.tz * a.nz) < 1e-10);
    }
  });
  test(`${track.circuit.name} completes a two-lap race and freezes the result`, () => {
    const race = new RaceSession(track, {
      circuit: track.circuit.id,
      weather: track.circuit.defaultWeather,
      mode: 'race',
    });
    let bestEvents = 0;
    race.onBestLap = () => bestEvents++;
    for (let i = 0; i < 120 * 240 && race.phase !== 'finished'; i++)
      race.step(dt, race.benchmarkInput(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
    assert.equal(race.phase, 'finished');
    assert.equal(race.completedLaps, 2);
    assert.ok(race.bestLap > 20 && race.bestLap < 120);
    assert.ok(bestEvents >= 1);
    const before = JSON.stringify({
      player: race.player,
      opponents: race.opponents,
      raceTime: race.raceTime,
    });
    for (let i = 0; i < 120; i++)
      race.step(dt, { ...neutral, throttle: 1 }, DEFAULT_SETTINGS);
    assert.equal(
      JSON.stringify({
        player: race.player,
        opponents: race.opponents,
        raceTime: race.raceTime,
      }),
      before,
    );
  });
}

test('countdown, throttle, braking, boost, steering and recovery affect driving', () => {
  const race = session();
  const start = race.player.distance;
  for (let i = 0; i < 120; i++)
    race.step(dt, { ...neutral, throttle: 1 }, DEFAULT_SETTINGS);
  assert.equal(race.player.distance, start);
  race.phase = 'racing';
  for (let i = 0; i < 600; i++)
    race.step(dt, { ...neutral, throttle: 1 }, DEFAULT_SETTINGS);
  assert.ok(race.player.speed > 45);
  const speed = race.player.speed;
  for (let i = 0; i < 60; i++)
    race.step(dt, { ...neutral, throttle: 1, boost: true }, DEFAULT_SETTINGS);
  assert.ok(race.battery < 95 && race.player.speed > speed);
  const faster = race.player.speed;
  for (let i = 0; i < 120; i++)
    race.step(dt, { ...neutral, brake: 1 }, DEFAULT_SETTINGS);
  assert.ok(race.player.speed < faster - 20);
  for (let i = 0; i < 120; i++)
    race.step(dt, { ...neutral, throttle: 1, steer: 1 }, DEFAULT_SETTINGS);
  assert.ok(race.player.offset < -1);
  race.player.offset = tracks[0].circuit.width;
  assert.equal(race.offTrack, true);
  race.resetCar();
  assert.equal(race.offTrack, false);
  assert.equal(race.player.headingError, 0);
  assert.ok(race.player.speed <= 18);
});

test('time trial has no opponents and can run beyond two laps', () => {
  const race = session();
  race.phase = 'racing';
  race.player.distance = tracks[0].length * 3;
  race.step(dt, neutral, DEFAULT_SETTINGS);
  assert.equal(race.phase, 'racing');
  assert.equal(race.opponents.length, 0);
  race.finish();
  assert.equal(race.finishedPosition, 1);
});

test('cars remain physically adjacent across the finish line and across lap counts', () => {
  assert.equal(trackGap(2, 998, 1000), 4);
  assert.equal(trackGap(2998, 2, 1000), -4);
});

test('the bonnet camera remains attached at high speed', () => {
  const race = session(),
    rig = new RaceCamera();
  const settings = { ...DEFAULT_SETTINGS, camera: 'cockpit' as const };
  for (let i = 0; i < 100; i++) {
    race.player.distance += 90 / 60;
    rig.update(1 / 60, race.player, tracks[0], 'racing', settings, 0, false);
    const f = tracks[0].sample(race.player.distance);
    const expected = {
      x: f.x + f.nx * race.player.offset + f.tx * 0.9,
      y: f.y + 0.04 + 0.98,
      z: f.z + f.nz * race.player.offset + f.tz * 0.9,
    };
    assert.ok(
      Math.hypot(
        rig.camera.position.x - expected.x,
        rig.camera.position.y - expected.y,
        rig.camera.position.z - expected.z,
      ) < 1e-6,
    );
  }
});

test('invalid persisted settings cannot escape the supported values', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(
    normalizeSettings({
      quality: 'max',
      camera: {},
      sound: 'false',
      assists: null,
    }),
    DEFAULT_SETTINGS,
  );
  assert.equal(
    normalizeSettings({ quality: 'eco', sound: false }).sound,
    false,
  );
});

test('chase-camera distance does not grow with speed on a straight', () => {
  const race = session(),
    rig = new RaceCamera();
  race.player.distance = 80;
  race.player.speed = 80;
  for (let i = 0; i < 90; i++) {
    race.player.distance += 80 / 60;
    rig.update(
      1 / 60,
      race.player,
      tracks[0],
      'racing',
      DEFAULT_SETTINGS,
      0,
      false,
    );
    const f = tracks[0].sample(race.player.distance);
    assert.ok(
      Math.hypot(rig.camera.position.x - f.x, rig.camera.position.z - f.z) < 26,
    );
  }
});

test('right and left input move toward their corresponding side of the chase view', () => {
  for (const steer of [-1, 1]) {
    const race = session();
    race.phase = 'racing';
    Object.assign(race.player, {
      distance: 90,
      speed: 35,
      offset: 0,
      headingError: 0,
    });
    const rig = new RaceCamera();
    rig.update(
      dt,
      race.player,
      tracks[0],
      'racing',
      DEFAULT_SETTINGS,
      0,
      false,
    );
    const screenRight = new Vector3(1, 0, 0).applyQuaternion(
      rig.camera.quaternion,
    );
    for (let i = 0; i < 48; i++)
      race.step(dt, { ...neutral, steer, throttle: 1 }, DEFAULT_SETTINGS);
    const frame = tracks[0].sample(race.player.distance);
    const lateral = new Vector3(
      frame.nx * race.player.offset,
      0,
      frame.nz * race.player.offset,
    );
    assert.ok(
      lateral.dot(screenRight) * steer > 0.3,
      `steer ${steer} must match visible direction`,
    );
  }
});
