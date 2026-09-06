import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Track, CIRCUITS } from './tracks';
import { loadRoadTextures } from './materials';
import { buildWorld, type World } from './world';
import { loadTreeAssets, type TreeAssets } from './world/tree-assets';
import {
  createCar,
  loadCarAsset,
  updateCar,
  disposeCarAsset,
  type CarVisual,
} from './vehicle';
import { Input, type ControlInput } from './input';
import { GpuTimer } from './gpu-timer';
import { RaceAudio } from './audio';
import { RaceCamera } from './camera';
import { ScenePresentation } from './scene-presentation';
import { bindEnvironmentLighting } from './environment-lighting';
import { TireSpray } from './tire-spray';
import { TireMarks } from './tire-marks';
import {
  RaceSession,
  createDriver,
  gearForSpeed,
  engineRevs,
  type DriverState,
} from './race-session';
import {
  FrameScheduler,
  FrameMetrics,
  ResolutionBudget,
  frameTarget,
} from './render-loop';
import {
  INITIAL_TELEMETRY,
  DEFAULT_SETTINGS,
  type RaceOptions,
  type Telemetry,
  type Settings,
  type Phase,
} from './types';

const EMPTY_INPUT: ControlInput = {
  steer: 0,
  throttle: 0,
  brake: 0,
  boost: false,
  handbrake: false,
};
const STEP = 1 / 120;
/** Composition root: owns browser resources and connects the independent racing systems. */
export class RacingEngine {
  readonly renderer: THREE.WebGLRenderer;
  private gpuTimer: GpuTimer;
  private readonly presentation: ScenePresentation;
  readonly scene = new THREE.Scene();
  readonly input = new Input();
  readonly audio = new RaceAudio();
  private readonly cameraRig = new RaceCamera();
  private readonly scheduler = new FrameScheduler();
  private readonly metrics = new FrameMetrics();
  private readonly budget = new ResolutionBudget();
  settings: Settings = { ...DEFAULT_SETTINGS };
  options: RaceOptions = {
    circuit: 'riviera',
    weather: 'sunset',
    mode: 'race',
  };
  phase: Phase = 'loading';
  telemetry: Telemetry = { ...INITIAL_TELEMETRY };
  track = new Track(CIRCUITS[0]);
  private session: RaceSession | null = null;
  private menuDriver = createDriver(-45, 0);
  private world: World | null = null;
  private spray: TireSpray | null = null;
  private tireMarks: TireMarks | null = null;
  private asset: THREE.Group | null = null;
  private treeAssets: TreeAssets | null = null;
  private surfaces: Awaited<ReturnType<typeof loadRoadTextures>> | null = null;
  private environment: THREE.WebGLRenderTarget | null = null;
  private playerVisual: CarVisual | null = null;
  private opponentVisuals: CarVisual[] = [];
  private observer: ResizeObserver;
  private resolutionQuery: MediaQueryList | null = null;
  private onVisibility: () => void;
  private loadingToken = 0;
  private disposed = false;
  private animation = 0;
  private accumulator = 0;
  private simTime = 0;
  private menuTime = 0;
  private hudAt = 0;
  private currentRatio = 1;
  private deviceRatio = 1;
  private controls: ControlInput = { ...EMPTY_INPUT };
  private resumePhase: Phase = 'racing';
  private starting = false;
  get camera() {
    return this.cameraRig.camera;
  }
  get player(): DriverState {
    return this.session?.player ?? this.menuDriver;
  }
  get opponents(): DriverState[] {
    return this.session?.opponents ?? [];
  }
  constructor(
    private container: HTMLElement,
    private onTelemetry: (state: Telemetry) => void,
    private onError: (message: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
      stencil: false,
    });
    this.gpuTimer = new GpuTimer(
      this.renderer.getContext() as WebGL2RenderingContext,
    );
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.presentation = new ScenePresentation(this.renderer);
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', '3D racing circuit');
    Object.assign(canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
    });
    container.appendChild(canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.input.onAction = (action) => this.action(action);
    this.onVisibility = () => {
      if (document.hidden) {
        this.pause();
        this.input.clear();
        this.metrics.reset(performance.now());
      }
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.pause();
      this.onError(
        'The graphics context was interrupted. Reload to get back on track.',
      );
    });
    this.onPixelDensityChange();
    void this.initialize();
  }
  // Moving between displays can change DPR without changing the CSS size,
  // which does not notify ResizeObserver. Re-arm for each new display density.
  private onPixelDensityChange = () => {
    this.resolutionQuery?.removeEventListener(
      'change',
      this.onPixelDensityChange,
    );
    this.resolutionQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    this.resolutionQuery.addEventListener('change', this.onPixelDensityChange);
    this.resize();
  };
  private async initialize() {
    try {
      const [surfaces, asset, hdr, treeAssets] = await Promise.all([
        loadRoadTextures(),
        loadCarAsset(),
        new HDRLoader().loadAsync('/assets/textures/environment.hdr'),
        loadTreeAssets(),
      ]);
      if (this.disposed) {
        Object.values(surfaces).forEach((t) => t.dispose());
        disposeCarAsset(asset);
        hdr.dispose();
        treeAssets.dispose();
        return;
      }
      this.surfaces = surfaces;
      this.asset = asset;
      this.treeAssets = treeAssets;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromEquirectangular(hdr);
      this.scene.environment = this.environment.texture;
      hdr.dispose();
      pmrem.dispose();
      await this.configure(this.options);
      if (this.disposed) return;
      const now = performance.now();
      this.scheduler.reset(now);
      this.metrics.reset(now);
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      if (!this.disposed)
        this.onError(
          `Could not load the circuit. ${error instanceof Error ? error.message : 'Reload to try again.'}`,
        );
    }
  }
  async configure(options: RaceOptions) {
    this.options = { ...options };
    if (!this.surfaces || !this.asset || !this.treeAssets) return;
    const token = ++this.loadingToken;
    this.phase = 'loading';
    this.emit();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    if (this.disposed || token !== this.loadingToken) return;
    this.world?.root.removeFromParent();
    this.world?.dispose();
    this.spray?.dispose();
    this.tireMarks?.dispose();
    this.tireMarks = new TireMarks();
    this.scene.add(this.tireMarks.mesh);
    this.spray = new TireSpray(options.weather === 'rain');
    if (this.spray) this.scene.add(this.spray.points);
    this.removeCars();
    this.session = null;
    this.track = new Track(CIRCUITS.find((c) => c.id === options.circuit)!);
    this.world = buildWorld(
      this.track,
      options.weather,
      this.surfaces,
      this.treeAssets,
      this.environment!.texture,
    );
    this.scene.add(this.world.root);
    const wet = options.weather === 'rain';
    this.scene.fog = new THREE.FogExp2(
      wet ? 0x344653 : options.weather === 'sunset' ? 0xd3b391 : 0xa9c6d2,
      wet ? 0.00138 : 0.00024,
    );
    this.scene.environmentIntensity = wet
      ? 0.24
      : options.weather === 'sunset'
        ? 0.75
        : 1;
    this.scene.environmentRotation.set(0, 1.5, 0);
    this.renderer.toneMappingExposure = wet ? 0.9 : 1.03;
    this.menuDriver = createDriver(-45, 0);
    this.playerVisual = createCar(this.asset, this.menuDriver.color, true);
    this.scene.add(this.playerVisual.group);
    this.phase = 'menu';
    this.menuTime = 0;
    this.accumulator = 0;
    this.input.enabled = false;
    this.controls = { ...EMPTY_INPUT };
    this.cameraRig.reset();
    this.applyQuality();
    this.draw(0);
    this.bindSceneEnvironment();
    this.renderer.compile(this.scene, this.camera);
    this.presentation.render(this.scene, this.camera, this.settings.quality);
    this.emit();
  }
  private removeCars() {
    this.playerVisual?.dispose();
    this.playerVisual = null;
    this.opponentVisuals.forEach((v) => v.dispose());
    this.opponentVisuals = [];
  }
  private bindSceneEnvironment() {
    if (this.environment)
      bindEnvironmentLighting(
        this.scene,
        this.environment.texture,
        this.scene.environmentRotation,
        this.scene.environmentIntensity,
      );
  }
  updateSettings(settings: Settings) {
    const qualityChanged = settings.quality !== this.settings.quality,
      cameraChanged = settings.camera !== this.settings.camera;
    this.settings = { ...settings };
    this.audio.setEnabled(settings.sound);
    try {
      localStorage.setItem('astra-settings-v1', JSON.stringify(settings));
    } catch {}
    if (qualityChanged) this.applyQuality();
    if (cameraChanged) this.cameraRig.reset();
    this.emit();
  }
  private applyQuality() {
    this.budget.reset();
    this.resize();
    if (this.world) {
      const size = this.settings.quality === 'eco' ? 1024 : 4096;
      this.world.sun.shadow.mapSize.set(size, size);
      this.world.sun.shadow.map?.dispose();
      this.world.sun.shadow.map = null;
      this.world.sun.castShadow = this.settings.quality !== 'eco';
    }
  }
  private resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    this.deviceRatio = window.devicePixelRatio;
    this.currentRatio = this.budget.pixelRatio(
      width,
      height,
      this.deviceRatio,
      this.settings.quality,
    );
    this.renderer.setPixelRatio(this.currentRatio);
    this.renderer.setSize(width, height, false);
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.presentation.resize(buffer.x, buffer.y);
    this.cameraRig.resize(width / height);
  }
  async start() {
    if (!this.asset || !this.world || this.phase === 'loading' || this.starting)
      return;
    this.starting = true;
    await this.audio.start().catch(() => {});
    this.starting = false;
    if (this.disposed) return;
    this.audio.setEnabled(this.settings.sound);
    this.removeCars();
    let best = 0;
    try {
      best = Number(localStorage.getItem(this.recordKey()) ?? 0);
    } catch {}
    this.session = new RaceSession(
      this.track,
      { ...this.options },
      Number.isFinite(best) ? best : 0,
    );
    this.session.onCount = (count) => this.audio.beep(count <= 0);
    this.session.onBestLap = (time) => {
      try {
        localStorage.setItem(this.recordKey(), String(time));
      } catch {}
    };
    this.playerVisual = createCar(this.asset, this.player.color, true);
    this.scene.add(this.playerVisual.group);
    this.opponentVisuals = this.opponents.map((driver) => {
      const visual = createCar(this.asset!, driver.color);
      this.scene.add(visual.group);
      return visual;
    });
    this.bindSceneEnvironment();
    this.phase = 'countdown';
    this.accumulator = 0;
    this.controls = { ...EMPTY_INPUT };
    this.input.clear();
    this.input.enabled = true;
    this.cameraRig.reset();
    this.metrics.reset(performance.now());
    this.draw(0);
    this.emit();
  }
  private recordKey() {
    return `astra-street-best-v1:${this.options.circuit}:${this.options.weather}`;
  }
  pause() {
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.resumePhase = this.phase;
      this.phase = 'paused';
      this.accumulator = 0;
      this.input.clear();
      this.silence();
      this.emit();
    }
  }
  resume() {
    if (this.phase === 'paused') {
      this.phase = this.resumePhase;
      this.accumulator = 0;
      this.scheduler.reset(performance.now());
      this.metrics.reset(performance.now());
      this.input.clear();
      void this.audio.start().catch(() => {});
      this.emit();
    }
  }
  menu() {
    this.silence();
    void this.configure(this.options);
  }
  resetCar() {
    this.session?.resetCar();
    this.cameraRig.reset();
  }
  action(action: string) {
    if (action === 'blur') {
      this.pause();
      return;
    }
    if (document.querySelector('[role="dialog"]')) return;
    if (action === 'pause') {
      if (this.phase === 'paused') this.resume();
      else this.pause();
    } else if (action === 'reset' && this.phase === 'racing') this.resetCar();
    else if (action === 'camera') {
      this.updateSettings({
        ...this.settings,
        camera: this.settings.camera === 'chase' ? 'cockpit' : 'chase',
      });
    } else if (action === 'enter') {
      if (this.phase === 'menu' || this.phase === 'finished') void this.start();
      else if (this.phase === 'paused') this.resume();
    } else if (action === 'mute') {
      this.updateSettings({ ...this.settings, sound: !this.settings.sound });
    }
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    this.animation = requestAnimationFrame(this.frame);
    if (document.hidden) {
      this.scheduler.reset(now);
      return;
    }
    const tick = this.scheduler.tick(now, frameTarget(this.phase));
    if (!tick) return;
    // Rapid DPR round-trips can coalesce matchMedia change events back to the
    // original match. A scalar check also covers that case without layout work.
    if (window.devicePixelRatio !== this.deviceRatio)
      this.onPixelDensityChange();
    this.controls = this.input.read();
    this.simTime += tick.delta;
    if (
      this.session &&
      (this.phase === 'countdown' || this.phase === 'racing')
    ) {
      this.accumulator += tick.delta;
      while (this.accumulator >= STEP && this.session.phase !== 'finished') {
        this.session.step(STEP, this.controls, this.settings);
        this.accumulator -= STEP;
      }
      this.phase = this.session.phase;
      if (this.phase === 'finished') {
        this.accumulator = 0;
        this.input.enabled = false;
      }
    } else if (this.phase === 'menu') this.menuTime += tick.delta;
    this.audio.update(
      this.player.speed,
      this.phase === 'countdown' ? 0.5 : engineRevs(this.player.speed),
      this.controls.throttle,
      (Math.abs(this.player.steer) * this.player.speed) / 75,
      this.phase === 'racing' || this.phase === 'countdown',
    );
    this.draw(tick.delta);
    const start = performance.now();
    this.renderer.info.reset();
    this.gpuTimer.begin();
    this.presentation.render(this.scene, this.camera, this.settings.quality);
    this.gpuTimer.end();
    const submitTime = performance.now() - start;
    const sample = this.metrics.record(now, tick.interval, submitTime, {
      phase: this.phase,
      time: this.simTime,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pixelRatio: this.currentRatio,
    });
    if (sample && this.budget.adapt(sample, this.settings.quality))
      this.resize();
    if (now - this.hudAt > 100) {
      this.hudAt = now;
      this.emit();
    }
  };
  private draw(dt: number) {
    const wet = this.options.weather === 'rain',
      cockpit = this.phase !== 'menu' && this.settings.camera === 'cockpit';
    if (this.playerVisual)
      updateCar(
        this.playerVisual,
        this.player,
        this.track,
        dt,
        this.simTime,
        wet,
        Math.max(this.controls.brake, this.controls.handbrake ? 1 : 0),
        this.controls.throttle,
        cockpit,
      );
    if (this.playerVisual)
      this.playerVisual.nitro.visible =
        this.phase === 'racing' && !!this.session?.boosted;
    this.opponentVisuals.forEach((visual, i) =>
      updateCar(visual, this.opponents[i], this.track, dt, this.simTime, wet),
    );
    if (this.phase === 'racing') {
      this.spray?.update(
        dt,
        [this.player, ...this.opponents],
        this.track,
        this.renderer.domElement.height,
      );
      this.tireMarks?.update(
        dt,
        this.player,
        this.track,
        !!this.session?.score.drifting,
      );
    }
    this.cameraRig.update(
      dt,
      this.player,
      this.track,
      this.phase,
      this.settings,
      this.menuTime,
      this.session?.boosted ?? false,
    );
    if (this.playerVisual)
      this.world?.update(
        dt,
        this.playerVisual.group.position,
        this.simTime,
        this.camera.position,
        this.settings.quality,
      );
  }
  private silence() {
    this.audio.update(0, 0, 0, 0, false);
  }
  finishTimeTrial() {
    if (this.options.mode === 'time-trial' && this.phase === 'racing') {
      this.session?.finish();
      this.phase = 'finished';
      this.accumulator = 0;
      this.input.enabled = false;
      this.silence();
      this.emit();
    }
  }
  private emit() {
    const s = this.session,
      p = this.player,
      stats = this.metrics.latest,
      opponents = [...this.opponents].sort((a, b) => b.distance - a.distance);
    this.telemetry = {
      ...INITIAL_TELEMETRY,
      phase: this.phase,
      speed: Math.round(p.speed * 3.6),
      gear: gearForSpeed(p.speed),
      rpm: engineRevs(p.speed),
      lap: Math.min(
        (s?.completedLaps ?? 0) + 1,
        this.options.mode === 'race' ? 2 : 99,
      ),
      laps: this.options.mode === 'race' ? 2 : 0,
      lapTime: s
        ? this.phase === 'finished'
          ? s.lastLap
          : Math.max(0, s.raceTime - s.lapStart)
        : 0,
      lastLap: s?.lastLap ?? 0,
      bestLap: s?.bestLap ?? 0,
      raceTime: s?.raceTime ?? 0,
      position: s?.position ?? 1,
      racers: this.options.mode === 'race' ? 8 : 1,
      boost: s?.battery ?? 100,
      boosting: s?.boosted ?? false,
      score: s?.score.total ?? 0,
      chain: Math.floor(s?.score.chain ?? 0),
      multiplier: s?.score.multiplier ?? 1,
      drifting: s?.score.drifting ?? false,
      progress: (((p.distance / this.track.length) % 1) + 1) % 1,
      fps: stats ? Math.round(stats.fps) : 0,
      frameMs: stats?.frameP95 ?? 0,
      renderMs: stats?.renderP95 ?? 0,
      gpuMs: this.gpuTimer.milliseconds,
      pixelRatio: this.currentRatio,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      countdown: Math.ceil(s?.countdown ?? 4),
      offTrack: s?.offTrack ?? false,
      brake: this.controls.brake,
      throttle: this.controls.throttle,
      opponents: opponents.map((d, i) => ({
        progress: (((d.distance / this.track.length) % 1) + 1) % 1,
        color: d.color,
        name: d.name,
        position: i + 1,
      })),
      quality: this.settings.quality,
      finishedPosition: s?.finishedPosition ?? 0,
      newBest: s?.newBest ?? false,
      message: s?.score.message ?? '',
    };
    this.onTelemetry(this.telemetry);
  }
  diagnostics() {
    return {
      telemetry: this.telemetry,
      settings: this.settings,
      options: this.options,
      trackLength: this.track.length,
      position: {
        distance: this.player.distance,
        offset: this.player.offset,
        headingError: this.player.headingError,
      },
      history: this.metrics.history.slice(),
      renderer: {
        memory: { ...this.renderer.info.memory },
        render: { ...this.renderer.info.render },
        size: this.renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),
        cssSize: [this.container.clientWidth, this.container.clientHeight],
        devicePixelRatio: window.devicePixelRatio,
        pixelRatio: this.renderer.getPixelRatio(),
        programs: this.renderer.info.programs?.length,
      },
      carLoaded: !!this.asset,
      gpuMs: this.gpuTimer.milliseconds,
    };
  }
  debugDrive(enabled: boolean) {
    this.input.touch =
      enabled && this.session
        ? this.session.benchmarkInput(this.settings)
        : { ...EMPTY_INPUT };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadingToken++;
    cancelAnimationFrame(this.animation);
    this.observer.disconnect();
    this.resolutionQuery?.removeEventListener(
      'change',
      this.onPixelDensityChange,
    );
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.dispose();
    this.audio.dispose();
    this.removeCars();
    this.world?.dispose();
    this.spray?.dispose();
    this.tireMarks?.dispose();
    this.environment?.dispose();
    if (this.surfaces) Object.values(this.surfaces).forEach((t) => t.dispose());
    if (this.asset) disposeCarAsset(this.asset);
    this.treeAssets?.dispose();
    this.gpuTimer.dispose();
    this.presentation.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
