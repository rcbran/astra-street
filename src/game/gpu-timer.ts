interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}
/** Sparse, asynchronous GPU queries. Unavailable results stay null; no gl.finish/readback stalls. */
export class GpuTimer {
  private extension: TimerExtension | null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  private frame = 0;
  private samples: number[] = [];
  constructor(private gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension(
      'EXT_disjoint_timer_query_webgl2',
    ) as TimerExtension | null;
  }
  get milliseconds(): number | null {
    if (!this.samples.length) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  }
  begin() {
    if (!this.extension) return;
    this.poll();
    if (this.frame++ % 8 !== 0 || this.pending.length >= 4) return;
    this.active = this.gl.createQuery();
    if (this.active)
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, this.active);
  }
  end() {
    if (!this.active || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }
  private poll() {
    if (!this.extension) return;
    const disjoint = this.gl.getParameter(this.extension.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const query = this.pending[0];
      if (
        !disjoint &&
        !this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)
      )
        break;
      if (!disjoint) {
        this.samples.push(
          Number(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT)) / 1e6,
        );
        if (this.samples.length > 45) this.samples.shift();
      }
      this.gl.deleteQuery(query);
      this.pending.shift();
    }
    if (disjoint) this.samples = [];
  }
  dispose() {
    if (this.active && this.extension)
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    if (this.active) this.gl.deleteQuery(this.active);
    this.pending.forEach((q) => this.gl.deleteQuery(q));
    this.pending = [];
    this.active = null;
  }
}
