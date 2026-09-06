import { Pause, Video, Flag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackMap } from './TrackMap';
import { CIRCUITS } from '../game/tracks';
import { formatTime, type Telemetry, type RaceOptions } from '../game/types';
export function RaceHUD({
  data,
  options,
  onPause,
  onCamera,
  onFinish,
}: {
  data: Telemetry;
  options: RaceOptions;
  onPause: () => void;
  onCamera: () => void;
  onFinish: () => void;
}) {
  const circuit = CIRCUITS.find((c) => c.id === options.circuit)!;
  return (
    <div className="race-hud">
      <div className="race-standing">
        <div className="position-readout">
          <span className="eyebrow">POSITION</span>
          <strong>
            {String(data.position).padStart(2, '0')}
            <small>/ {String(data.racers).padStart(2, '0')}</small>
          </strong>
        </div>
      </div>
      <div className={`street-score ${data.drifting ? 'is-drifting' : ''}`}>
        <span className="eyebrow">STREET SCORE</span>
        <strong>{data.score.toLocaleString('en-US')}</strong>
        <div className="score-chain">
          <span>
            {data.chain
              ? `+${data.chain.toLocaleString('en-US')}`
              : 'LINK YOUR DRIFTS'}
          </span>
          <b>×{data.multiplier}</b>
        </div>
        <small>
          {data.drifting
            ? 'DRIFTING'
            : data.chain
              ? 'HOLD IT CLEAN TO BANK'
              : 'SPACE + STEER TO DRIFT'}
        </small>
      </div>
      {data.message && !data.offTrack && (
        <output className="score-event" aria-live="polite">
          {data.message}
        </output>
      )}
      <div className="lap-readout">
        <span className="eyebrow">
          {options.mode === 'race' ? 'LAP' : 'TIME TRIAL'}
        </span>
        <strong>
          {String(data.lap).padStart(2, '0')}
          <span>
            {data.laps ? ` / ${String(data.laps).padStart(2, '0')}` : ' ∞'}
          </span>
        </strong>
      </div>
      <div className="timing-panel">
        <div>
          <span>CURRENT LAP</span>
          <b>{formatTime(data.lapTime)}</b>
        </div>
        <div>
          <span>BEST LAP</span>
          <b className={data.newBest ? 'best-time' : ''}>
            {formatTime(data.bestLap)}
          </b>
        </div>
        <div>
          <span>LAST LAP</span>
          <b>{formatTime(data.lastLap)}</b>
        </div>
      </div>
      <div className="race-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change camera"
          title="Camera · C"
          onClick={onCamera}
        >
          <Video size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Pause race"
          title="Pause · Esc"
          onClick={onPause}
        >
          <Pause size={18} />
        </Button>
        {options.mode === 'time-trial' && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Finish time trial"
            title="Finish session"
            onClick={onFinish}
          >
            <Flag size={18} />
          </Button>
        )}
      </div>
      <div className="mini-map">
        <TrackMap circuit={options.circuit} telemetry={data} />
        <span>{circuit.name.toUpperCase()}</span>
      </div>
      <div className={`speedometer ${data.boosting ? 'boosting' : ''}`}>
        <div className="rpm-lights">
          {Array.from({ length: 15 }, (_, i) => (
            <i
              key={i}
              className={data.rpm > i / 15 ? 'on' : ''}
              style={
                {
                  '--rpm-color':
                    i < 7 ? '#a5e3a1' : i < 11 ? '#f2ca5d' : '#fc6950',
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="speed-readout">
          <div className="gear">
            <span>GEAR</span>
            <b>{data.gear}</b>
          </div>
          <strong>{String(data.speed).padStart(3, '0')}</strong>
          <span className="speed-unit">KM/H</span>
        </div>
        <div className="pedal-bars">
          <div className="brake">
            <i style={{ width: `${data.brake * 100}%` }} />
          </div>
          <div className="throttle">
            <i style={{ width: `${data.throttle * 100}%` }} />
          </div>
        </div>
        <div className="boost-readout">
          <Zap size={13} />
          <span>NITRO</span>
          <div>
            <i style={{ width: `${data.boost}%` }} />
          </div>
          <b>{Math.round(data.boost)}%</b>
          <kbd>SHIFT</kbd>
        </div>
      </div>
      {data.phase === 'countdown' && (
        <output className="starting-lights" aria-live="polite">
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <i
                key={i}
                className={5 - Math.max(0, data.countdown) >= i ? 'lit' : ''}
              />
            ))}
          </div>
          <span>
            HOLD <kbd>W</kbd> TO LAUNCH
          </span>
        </output>
      )}
      {data.offTrack && data.phase === 'racing' && (
        <div className="race-notice">
          OFF TRACK <span>Ease back onto the circuit · R to reset</span>
        </div>
      )}
      <div className="race-bottom-hint">
        <kbd>WASD</kbd> DRIVE <span>·</span> <kbd>SPACE</kbd> DRIFT{' '}
        <span>·</span> <kbd>SHIFT</kbd> NITRO <span>·</span> <kbd>C</kbd> CAMERA
      </div>
    </div>
  );
}
