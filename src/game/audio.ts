// Synthesised sounds (own): shot, hit tick, headshot tick, shield break, reload.
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Create/resume the AudioContext from a user gesture. Makes no sound. */
  unlock(): void {
    this.ensure();
  }

  /** a gunshot; `volume` below 1 for a distant one (the other player's) */
  shot(pitch = 1, volume = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const v = Math.max(0.02, Math.min(1, volume));
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer(ctx, 0.09);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400 * pitch;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9 * v, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.7 * v, t);
    og.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }

  private tick(freq: number, dur: number, vol: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  hit(): void {
    this.tick(1250, 0.05, 0.25);
  }
  headshot(): void {
    this.tick(1900, 0.07, 0.3);
    this.tick(2500, 0.05, 0.15);
  }
  shieldBreak(): void {
    this.tick(700, 0.16, 0.3);
    this.tick(1050, 0.22, 0.25);
  }
  knock(): void {
    this.tick(420, 0.2, 0.3);
  }
  reload(): void {
    this.tick(300, 0.04, 0.2);
  }
  dry(): void {
    this.tick(900, 0.03, 0.15);
  }
}
