import { clamp } from './tracks';
export class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode[] = [];
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wind: GainNode | null = null;
  private tire: GainNode | null = null;
  enabled = true;
  async start() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(ctx.destination);
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.ratio.value = 5;
      compressor.connect(this.master);
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1800;
      this.filter.Q.value = 0.7;
      this.filter.connect(compressor);
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.filter);
      for (const detune of [-9, 0, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 85;
        o.detune.value = detune;
        o.connect(this.gain);
        o.start();
        this.engine.push(o);
      }
      const size = ctx.sampleRate * 2,
        b = ctx.createBuffer(1, size, ctx.sampleRate),
        data = b.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < size; i++) {
        prev = (prev + (Math.random() * 2 - 1) * 0.03) / 1.03;
        data[i] = prev * 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = b;
      noise.loop = true;
      this.wind = ctx.createGain();
      this.wind.gain.value = 0;
      noise.connect(this.wind);
      this.wind.connect(compressor);
      noise.start();
      const squeal = ctx.createOscillator();
      squeal.type = 'sine';
      squeal.frequency.value = 670;
      this.tire = ctx.createGain();
      this.tire.gain.value = 0;
      squeal.connect(this.tire);
      this.tire.connect(compressor);
      squeal.start();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        value ? 0.22 : 0,
        this.ctx.currentTime,
        0.05,
      );
  }
  update(
    speed: number,
    rpm: number,
    throttle: number,
    slip: number,
    racing: boolean,
  ) {
    if (!this.ctx || !this.gain) return;
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(
      racing ? 0.012 + throttle * 0.024 : 0,
      t,
      0.035,
    );
    for (let i = 0; i < this.engine.length; i++)
      this.engine[i].frequency.setTargetAtTime(
        65 + rpm * 190 + i * 2,
        t,
        0.045,
      );
    this.filter!.frequency.setTargetAtTime(700 + rpm * 2600, t, 0.04);
    this.wind!.gain.setTargetAtTime(racing ? (speed / 95) * 0.16 : 0, t, 0.2);
    this.tire!.gain.setTargetAtTime(
      racing ? clamp(slip - 0.55, 0, 0.45) * 0.09 : 0,
      t,
      0.06,
    );
  }
  beep(high = false) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.frequency.value = high ? 960 : 640;
    g.gain.setValueAtTime(0.16, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + 0.17);
  }
  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
