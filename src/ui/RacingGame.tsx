'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RacingEngine } from '../game/engine';
import {
  INITIAL_TELEMETRY,
  DEFAULT_SETTINGS,
  type Settings,
  type RaceOptions,
} from '../game/types';
import { RaceMenu } from './RaceMenu';
import { RaceHUD } from './RaceHUD';
import { GameSettings } from './GameSettings';
import { SessionOverlay } from './SessionOverlay';
import { TouchControls } from './TouchControls';
import { normalizeSettings } from '../game/settings';

declare global {
  interface Window {
    __ASTRA__?: RacingEngine;
  }
}
export function RacingGame() {
  const canvasRef = useRef<HTMLDivElement>(null),
    engineRef = useRef<RacingEngine | null>(null);
  const [data, setData] = useState(INITIAL_TELEMETRY),
    [error, setError] = useState('');
  const [options, setOptions] = useState<RaceOptions>({
    circuit: 'riviera',
    weather: 'sunset',
    mode: 'race',
  });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS),
    [settingsOpen, setSettingsOpen] = useState(false),
    [showMetrics, setShowMetrics] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let instance: RacingEngine | null = null;
    import('../game/engine')
      .then(({ RacingEngine }) => {
        if (cancelled || !canvasRef.current) return;
        try {
          instance = new RacingEngine(
            canvasRef.current,
            (s) => {
              setData({ ...s });
              if (instance)
                setSettings((current) =>
                  JSON.stringify(current) === JSON.stringify(instance!.settings)
                    ? current
                    : { ...instance!.settings },
                );
            },
            setError,
          );
          try {
            const saved = JSON.parse(
              localStorage.getItem('astra-settings-v1') ?? '{}',
            );
            const restored = normalizeSettings(saved);
            instance.settings = restored;
            setSettings(restored);
          } catch {}
          engineRef.current = instance;
          if (new URLSearchParams(location.search).has('debug'))
            window.__ASTRA__ = instance;
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : 'WebGL2 is required to run this game.',
          );
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      instance?.dispose();
      engineRef.current = null;
      delete window.__ASTRA__;
    };
  }, []);
  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    engineRef.current?.updateSettings(s);
    try {
      localStorage.setItem('astra-settings-v1', JSON.stringify(s));
    } catch {}
  }, []);
  const changeOptions = (o: RaceOptions) => {
    setOptions(o);
    const engine = engineRef.current;
    if (engine) {
      if (
        o.circuit !== engine.options.circuit ||
        o.weather !== engine.options.weather
      )
        void engine.configure(o);
      else engine.options = { ...o };
    }
  };
  const openSettings = () => {
    engineRef.current?.pause();
    setSettingsOpen(true);
  };
  const playing = ['racing', 'countdown', 'paused', 'finished'].includes(
    data.phase,
  );
  const start = () => {
    (document.activeElement as HTMLElement)?.blur();
    void engineRef.current?.start();
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <main
      className={`game-shell ${playing ? 'is-racing' : 'in-menu'} weather-${options.weather}`}
    >
      <div ref={canvasRef} className="game-canvas" />
      <div className="game-vignette" />
      {!playing && <div className="menu-shade" />}
      <header className="game-header">
        <div className="brand">
          <svg width="37" height="30" viewBox="0 0 37 30" aria-hidden="true">
            <path
              d="M0 29 17 1h9L11 29Z M16 29l7-12h6l8 12Z"
              fill="currentColor"
            />
          </svg>
          <span>
            ASTRA<small>S T R E E T</small>
          </span>
        </div>
        {!playing && (
          <span className="header-edition">
            S9 / 01 <i /> AFTER HOURS
          </span>
        )}
        <div className="header-controls">
          <Button
            className="fps-badge"
            variant="ghost"
            onClick={() => setShowMetrics((v) => !v)}
            aria-label="Toggle performance metrics"
          >
            <i />
            {data.fps ? `${data.fps} FPS` : '60 FPS TARGET'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={settings.sound ? 'Mute sound' : 'Enable sound'}
            title="Sound · M"
            onClick={() =>
              updateSettings({ ...settings, sound: !settings.sound })
            }
          >
            {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fullscreen"
            title="Fullscreen"
            onClick={fullscreen}
          >
            <Maximize size={17} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            title="Settings"
            onClick={openSettings}
          >
            <SlidersHorizontal size={17} />
          </Button>
        </div>
      </header>
      {!playing && (
        <RaceMenu
          options={options}
          onChange={changeOptions}
          onStart={start}
          loading={data.phase === 'loading'}
        />
      )}
      {playing && (
        <RaceHUD
          data={data}
          options={options}
          onPause={() => engineRef.current?.pause()}
          onCamera={() => engineRef.current?.action('camera')}
          onFinish={() => engineRef.current?.finishTimeTrial()}
        />
      )}
      {!playing && (
        <footer className="menu-footer">
          <div>
            <kbd>W A S D</kbd>
            <span>DRIVE</span>
            <kbd>SHIFT</kbd>
            <span>NITRO</span>
            <kbd>SPACE</kbd>
            <span>DRIFT</span>
          </div>
          <span>
            AUTOMATIC GEARS <i /> CHASE THE RUSH
          </span>
        </footer>
      )}
      {showMetrics && (
        <aside className="metrics-panel">
          <b>RENDER TELEMETRY</b>
          <span>
            {data.fps} FPS · {data.frameMs.toFixed(1)} ms p95
          </span>
          <span>CPU submit {data.renderMs.toFixed(1)} ms p95</span>
          <span>
            GPU{' '}
            {data.gpuMs === null
              ? 'unavailable'
              : `${data.gpuMs.toFixed(1)} ms p95`}
          </span>
          <span>
            {data.drawCalls} draws · {(data.triangles / 1000).toFixed(0)}k
            triangles
          </span>
          <span>
            {settings.quality} · {data.pixelRatio.toFixed(2)}× pixels
          </span>
          <small>{playing ? '60 Hz racing cap' : '30 Hz menu cap'}</small>
        </aside>
      )}
      {(data.phase === 'racing' || data.phase === 'countdown') && (
        <TouchControls
          onInput={(key, value) => {
            if (engineRef.current)
              Object.assign(engineRef.current.input.touch, { [key]: value });
          }}
        />
      )}
      <SessionOverlay
        data={settingsOpen ? { ...data, phase: 'menu' } : data}
        onResume={() => engineRef.current?.resume()}
        onRestart={start}
        onMenu={() => engineRef.current?.menu()}
        onSettings={openSettings}
      />
      <GameSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSettings}
      />
      {error && (
        <div className="error-screen" role="alert">
          <strong>We hit a red flag.</strong>
          <p>{error}</p>
          <Button className="start-race" onClick={() => location.reload()}>
            RELOAD CIRCUIT
          </Button>
        </div>
      )}
      {data.phase === 'loading' && !error && (
        <output className="loading-track">
          <i />
          <span>PREPARING THE GRID</span>
        </output>
      )}
    </main>
  );
}
