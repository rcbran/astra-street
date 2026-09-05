import type { CircuitId, Telemetry } from '../game/types';
import { CIRCUIT_MAPS, mapPoint } from './map-data';
export function TrackMap({
  circuit,
  telemetry,
  className = '',
}: {
  circuit: CircuitId;
  telemetry?: Telemetry;
  className?: string;
}) {
  const map = CIRCUIT_MAPS[circuit],
    player = mapPoint(map, telemetry?.progress ?? 0);
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      aria-label={`${circuit} circuit map`}
    >
      <title>{`${circuit} circuit map`}</title>
      <path
        d={map.path}
        stroke="currentColor"
        strokeWidth={telemetry ? 5 : 4}
        strokeLinejoin="round"
        opacity=".2"
      />
      <path
        d={map.path}
        stroke="currentColor"
        strokeWidth={telemetry ? 2 : 1.8}
        strokeLinejoin="round"
        opacity=".8"
      />
      {telemetry?.opponents.map((opponent, index) => {
        const point = mapPoint(map, opponent.progress);
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={opponent.color}
          />
        );
      })}
      <circle
        cx={player.x}
        cy={player.y}
        r={telemetry ? 5 : 3}
        fill="#f2593c"
        stroke={telemetry ? '#fff' : 'none'}
        strokeWidth="1.5"
      />
    </svg>
  );
}
