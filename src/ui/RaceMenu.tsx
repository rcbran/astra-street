import {
  ArrowUpRight,
  ChevronRight,
  CloudRain,
  Sun,
  Sunset,
  Flag,
  Timer,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CIRCUITS, Track } from '../game/tracks';
import type { RaceOptions, Weather } from '../game/types';
import { TrackMap } from './TrackMap';
const lengths = new Map(
  CIRCUITS.map((c) => [c.id, (new Track(c).length / 1000).toFixed(2)]),
);
const WEATHER_OPTIONS = [
  { value: 'sunset' as Weather, label: 'Golden hour', Icon: Sunset },
  { value: 'clear' as Weather, label: 'Clear sky', Icon: Sun },
  { value: 'rain' as Weather, label: 'Wet night', Icon: CloudRain },
];
export function RaceMenu({
  options,
  onChange,
  onStart,
  loading,
}: {
  options: RaceOptions;
  onChange: (options: RaceOptions) => void;
  onStart: () => void;
  loading: boolean;
}) {
  const circuit = CIRCUITS.find((c) => c.id === options.circuit)!;
  return (
    <div className="race-menu">
      <div className="session-heading">
        <span className="eyebrow">
          <span className="live-dot" /> STREET RACING
        </span>
        <h1>
          CHASE THE
          <br />
          <span>RUSH.</span>
        </h1>
        <p>
          Link the corners. Build your score.
          <br />
          Space to drift. Shift for nitro.
        </p>
      </div>
      <section className="session-panel" aria-label="Race setup">
        <div className="panel-heading">
          <span className="eyebrow">01 / SELECT SESSION</span>
          <Flag size={16} />
        </div>
        <Tabs
          value={options.mode}
          onValueChange={(v) =>
            onChange({ ...options, mode: v as RaceOptions['mode'] })
          }
        >
          <TabsList className="mode-tabs">
            <TabsTrigger value="race">
              <Flag size={14} />
              Quick race
            </TabsTrigger>
            <TabsTrigger value="time-trial">
              <Timer size={14} />
              Time trial
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="circuit-heading">
          <span className="eyebrow">CHOOSE YOUR ROUTE</span>
          <span>03</span>
        </div>
        <RadioGroup
          value={options.circuit}
          onValueChange={(v) => {
            const c = CIRCUITS.find((c) => c.id === v)!;
            onChange({ ...options, circuit: c.id, weather: c.defaultWeather });
          }}
          className="circuit-list"
          aria-label="Circuit"
        >
          {CIRCUITS.map((c, i) => (
            <label
              className={`circuit-option ${c.id === options.circuit ? 'selected' : ''}`}
              key={c.id}
            >
              <RadioGroupItem
                value={c.id}
                className="sr-only"
                aria-label={c.name}
              />
              <div className="circuit-number">0{i + 1}</div>
              <div className="circuit-label">
                <strong>{c.name}</strong>
                <span>{c.country}</span>
              </div>
              <TrackMap circuit={c.id} className="circuit-preview" />
              <ChevronRight size={16} className="circuit-chevron" />
            </label>
          ))}
        </RadioGroup>
        <div className="weather-heading">
          <span className="eyebrow">CONDITIONS</span>
          <span>
            {options.weather === 'rain'
              ? '18°C'
              : options.weather === 'sunset'
                ? '24°C'
                : '22°C'}
          </span>
        </div>
        <RadioGroup
          value={options.weather}
          onValueChange={(v) => onChange({ ...options, weather: v as Weather })}
          className="weather-options"
          aria-label="Weather"
        >
          {WEATHER_OPTIONS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`weather-option ${options.weather === value ? 'selected' : ''}`}
              title={label}
            >
              <RadioGroupItem
                value={value}
                className="sr-only"
                aria-label={label}
              />
              <Icon size={18} />
              <span>{label}</span>
            </label>
          ))}
        </RadioGroup>
        <div className="session-meta">
          <span>
            {lengths.get(circuit.id)} <small>KM</small>
          </span>
          <i />
          <span>{options.mode === 'race' ? '2 LAPS' : 'FREE RUN'}</span>
          <i />
          <span>{options.mode === 'race' ? '8 DRIVERS' : 'JUST YOU'}</span>
        </div>
        <Button className="start-race" onClick={onStart} disabled={loading}>
          {loading ? 'PREPARING CIRCUIT' : 'GO RACING'}
          <ArrowUpRight size={24} />
        </Button>
        <div className="enter-hint">
          <kbd>↵</kbd> or press Enter to race
        </div>
      </section>
      <div className="location-tag">
        <MapPin size={15} />
        <span>
          {circuit.name.toUpperCase()}
          <small>{circuit.country}</small>
        </span>
        <span className="location-line" />
        <span className="local-time">
          {options.weather === 'rain'
            ? '21:08'
            : options.weather === 'sunset'
              ? '18:42'
              : '13:24'}{' '}
          <small>LOCAL</small>
        </span>
      </div>
      <div className="car-name">
        <span className="eyebrow">YOUR MACHINE</span>
        <strong>S9</strong>
        <span>ASTRA / TWIN TURBO</span>
      </div>
    </div>
  );
}
