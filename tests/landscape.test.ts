import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CIRCUITS, Track } from '../src/game/tracks';
import { Landscape } from '../src/game/world/landscape';

test('sculpted terrain keeps every route and its paved runoff unobstructed', () => {
  for (const circuit of CIRCUITS) {
    const track = new Track(circuit),
      terrain = new Landscape(track);
    for (let i = 0; i < 512; i++) {
      const f = track.sample((i / 512) * track.length);
      for (const offset of [-circuit.width / 2 - 4, 0, circuit.width / 2 + 4]) {
        assert.ok(
          terrain.height(f.x + f.nx * offset, f.z + f.nz * offset) < -0.1,
          `${circuit.id} terrain enters paved corridor at ${i}`,
        );
      }
    }
    assert.ok(Math.max(...terrain.heights) > 180);
    if (terrain.coastal)
      assert.ok(terrain.height(550, 0) < -1.1, 'ocean remains exposed');
  }
});
