import { CIRCUITS, Track } from '../game/tracks';
import type { CircuitId } from '../game/types';
interface MapPoint {
  x: number;
  y: number;
}
interface MapLayout {
  path: string;
  points: MapPoint[];
}
export const CIRCUIT_MAPS: Record<CircuitId, MapLayout> = Object.fromEntries(
  CIRCUITS.map((circuit) => {
    const track = new Track(circuit),
      xs = track.frames.map((f) => f.x),
      zs = track.frames.map((f) => f.z);
    const x = Math.min(...xs),
      z = Math.min(...zs),
      scale = 170 / Math.max(Math.max(...xs) - x, Math.max(...zs) - z);
    return [
      circuit.id,
      {
        path: track.mapPath,
        points: track.frames.map((f) => ({
          x: (f.x - x) * scale + 15,
          y: (f.z - z) * scale + 15,
        })),
      },
    ];
  }),
) as Record<CircuitId, MapLayout>;
export function mapPoint(map: MapLayout, progress: number): MapPoint {
  const index = (((progress % 1) + 1) % 1) * (map.points.length - 1),
    a = map.points[Math.floor(index)],
    b = map.points[Math.floor(index) + 1],
    fraction = index - Math.floor(index);
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
}
