// The game's sound (Web Audio): built here from oscillators and filtered
// noise, with recorded CC0 samples layered in where a recording carries
// what synthesis cannot (Kenney's packs, fetched by tools/fetch-sounds.ts into
// public/audio/kenney: footsteps, landings and body falls, a punch, the
// magazine and bolt, a frag's crunch, the menu's clicks). The guns are all
// synthesis. Without the files every sound is the synthesis alone.
//
// The engine:
//   - A listener on the camera; sounds from somewhere go through a panner
//     (HRTF, so left, right, front and behind read), fade with distance, lose
//     their top end with distance (air absorption), and past 25 m arrive late
//     by the speed of sound, so a far shot's flash comes before its crack.
//   - A generated reverb (decaying noise as the impulse): more of it indoors
//     (the range, the arenas), little outdoors (Outskirts).
//   - Three volumes (Settings): master, effects, and the hit sounds.
//   - A voice cap, so a squad fight with a dozen bots never stacks hundreds
//     of nodes.
//   - Loops (the slide scrape, the zipline, the drop's wind, a heal's hum, the
//     heartbeat) are started and stopped by name and follow a level.
//
// Guns are voiced by class (src/config/audio.json): a thump that drops in
// pitch, a band of noise for the body, a crack at the front, a tail into the
// reverb; energy guns add a zap. Footsteps by surface: concrete, metal, dirt.
import cfg from "../config/audio.json";

type Vec = { x: number; y: number; z: number };
export type Surface = "concrete" | "metal" | "dirt";
export type HitTier = "white" | "blue" | "purple" | "red" | "health" | "head";
type GunClass = keyof typeof cfg.classes;

interface Loop {
  src: AudioScheduledSourceNode[];
  gain: GainNode;
  params: Record<string, AudioParam>;
}

const LS = "range.audio.v1";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private hitBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private voices = 0;
  private loops = new Map<string, Loop>();
  private lis: Vec = { x: 0, y: 0, z: 0 };
  private space: "indoor" | "outdoor" = "indoor";
  /** 0..1 each; Settings */
  volumes = { master: 0.8, effects: 1, hits: 1 };
  /** sounds played (tests) */
  played = 0;
  /** the recorded samples by name, every take of each (loaded once the audio starts) */
  private samples = new Map<string, AudioBuffer[]>();
  private samplesAsked = false;
  /** samples layered in (tests) */
  samplesPlayed = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) {
        const v = JSON.parse(raw) as Partial<Record<keyof GameAudio["volumes"], unknown>>;
        for (const k of ["master", "effects", "hits"] as const) {
          const n = Number(v[k]);
          if (Number.isFinite(n) && n >= 0 && n <= 1) this.volumes[k] = n;
        }
      }
    } catch {
      /* ignore */
    }
  }

  setVolumes(v: Partial<GameAudio["volumes"]>): void {
    Object.assign(this.volumes, v);
    try {
      localStorage.setItem(LS, JSON.stringify(this.volumes));
    } catch {
      /* ignore */
    }
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.fxBus || !this.hitBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0.5 * this.volumes.master, t, 0.02);
    this.fxBus.gain.setTargetAtTime(this.volumes.effects, t, 0.02);
    this.hitBus.gain.setTargetAtTime(this.volumes.hits, t, 0.02);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        const ctx = new AudioContext();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 10;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.18;
        comp.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.connect(comp);
        this.fxBus = ctx.createGain();
        this.fxBus.connect(this.master);
        this.hitBus = ctx.createGain();
        this.hitBus.connect(this.master);
        // the reverb: a convolver on a decaying stereo noise burst
        const rev = ctx.createConvolver();
        rev.buffer = this.impulse(ctx, cfg.reverb.seconds);
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = this.space === "indoor" ? cfg.reverb.indoor : cfg.reverb.outdoor;
        this.reverbSend.connect(rev);
        rev.connect(this.master);
        this.white = this.noiseBuffer(ctx, 2);
        this.loadSamples(ctx);
        const l = ctx.listener;
        if (l.positionX) {
          l.positionX.value = 0;
          l.positionY.value = 0;
          l.positionZ.value = 0;
        }
        this.applyVolumes();
      } catch {
        this.ctx = null;
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** the recorded samples (public/audio/kenney/index.json lists them); missing, the synthesis plays alone */
  private loadSamples(ctx: AudioContext): void {
    if (this.samplesAsked) return;
    this.samplesAsked = true;
    void fetch("audio/kenney/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (index: Record<string, string[]> | null) => {
        if (!index || typeof index !== "object") return;
        for (const [name, files] of Object.entries(index)) {
          if (!Array.isArray(files)) continue;
          const takes: AudioBuffer[] = [];
          for (const f of files) {
            try {
              const data = await (await fetch(`audio/kenney/${f}`)).arrayBuffer();
              takes.push(await ctx.decodeAudioData(data));
            } catch {
              /* a take that will not decode is skipped */
            }
          }
          if (takes.length) this.samples.set(name, takes);
        }
      })
      .catch(() => undefined);
  }

  /** how many recorded sounds are loaded (tests) */
  get sampleCount(): number {
    return this.samples.size;
  }

  /** a take of a recorded sound into `dest` at `t`, a little varied in pitch; false when there is none */
  private sample(dest: AudioNode, t: number, name: string, level: number, rate = 1): boolean {
    const takes = this.samples.get(name);
    const ctx = this.ctx;
    if (!takes?.length || !ctx) return false;
    const src = ctx.createBufferSource();
    src.buffer = takes[Math.floor(Math.random() * takes.length)];
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(g).connect(dest);
    src.start(t);
    this.samplesPlayed++;
    return true;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections as a few spikes, then a smooth decay
        const early = i < ctx.sampleRate * 0.06 && Math.random() < 0.004 ? 1 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, 3) + early * 0.6) * 0.6;
      }
    }
    return buf;
  }

  /** Create or resume the AudioContext from a user gesture. Makes no sound. */
  unlock(): void {
    this.ensure();
  }

  /** indoors (the range, the arenas) or outdoors (the battle royale): how much reverb */
  setSpace(kind: "indoor" | "outdoor"): void {
    this.space = kind;
    if (this.ctx && this.reverbSend) this.reverbSend.gain.setTargetAtTime(kind === "indoor" ? cfg.reverb.indoor : cfg.reverb.outdoor, this.ctx.currentTime, 0.2);
  }

  /** the camera, every frame: where the ears are and which way they face */
  setListener(pos: Vec, fwd: Vec, up: Vec): void {
    this.lis = { x: pos.x, y: pos.y, z: pos.z };
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t);
      l.forwardY.setValueAtTime(fwd.y, t);
      l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    } else {
      (l as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(pos.x, pos.y, pos.z);
    }
  }

  /**
   * A voice: where its nodes plug in and when it starts. From somewhere
   * (`at`): a panner, the distance low-pass, and a start delayed by the
   * distance past 25 m; from you (no `at`): straight to the bus. Null when it
   * is too far, or the voice cap is reached, or there is no audio.
   */
  private voice(at: Vec | null, length: number, bus: "fx" | "hit" = "fx", priority = 1, reverb = 1): { input: AudioNode; t: number; dist: number } | null {
    const ctx = this.ensure();
    if (!ctx || !this.fxBus || !this.hitBus || !this.reverbSend) return null;
    if (this.voices >= cfg.maxVoices && priority < 2) return null;
    const dist = at ? Math.hypot(at.x - this.lis.x, at.y - this.lis.y, at.z - this.lis.z) : 0;
    if (dist > cfg.maxDistance) return null;
    const out = bus === "hit" ? this.hitBus : this.fxBus;
    const input = ctx.createGain();
    let t = ctx.currentTime;
    if (at) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = Math.max(650, 18000 * Math.exp(-dist / cfg.airAbsorb));
      const pan = ctx.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 3;
      pan.rolloffFactor = 1.1;
      pan.maxDistance = cfg.maxDistance;
      if (pan.positionX) {
        pan.positionX.value = at.x;
        pan.positionY.value = at.y;
        pan.positionZ.value = at.z;
      } else (pan as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(at.x, at.y, at.z);
      input.connect(lp).connect(pan).connect(out);
      // far away there is more room than sound: more of it goes to the reverb
      const send = ctx.createGain();
      send.gain.value = reverb * Math.min(1.6, 0.6 + dist / 60);
      pan.connect(send).connect(this.reverbSend);
      if (dist > cfg.delayFrom) t += dist / cfg.speedOfSound;
    } else {
      input.connect(out);
      const send = ctx.createGain();
      send.gain.value = reverb * 0.6;
      input.connect(send).connect(this.reverbSend);
    }
    this.voices++;
    this.played++;
    setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
      input.disconnect();
    }, (t - ctx.currentTime + length + 0.3) * 1000);
    return { input, t, dist };
  }

  // ------------------------------------------------------------ building blocks

  /** a burst of filtered noise into `dest` at `t` */
  private noise(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, level: number, attack = 0.002, freqEnd?: number): void {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.white;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + 0.02);
  }

  /** a tone that glides from f0 to f1 and dies away */
  private tone(dest: AudioNode, t: number, dur: number, type: OscillatorType, f0: number, f1: number, level: number, attack = 0.003): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ guns

  /** the class a gun is voiced as */
  gunClass(id: string): GunClass {
    const c = (cfg.guns as Record<string, string>)[id];
    return (c && c in cfg.classes ? c : "rifle") as GunClass;
  }

  /**
   * A gunshot: yours (no `at`), or someone's at `at` (a player, a bot). The
   * far ones arrive late and dull, the near ones crack.
   */
  gun(id: string, at: Vec | null = null, level = 1): void {
    const k = cfg.classes[this.gunClass(id)];
    const v = this.voice(at, k.tail + 0.2, "fx", at ? 1 : 2);
    if (!v) return;
    const L = k.level * level;
    const jitter = 0.94 + Math.random() * 0.12;
    // the crack: a very short bright burst
    this.noise(v.input, v.t, k.crack, "highpass", 3200 * jitter, 0.7, 0.55 * L, 0.0008);
    // the body: a band of noise with the class's colour
    this.noise(v.input, v.t, k.thumpTime * 1.4, "bandpass", k.band * jitter, k.bandQ, 0.8 * L, 0.001);
    // the thump: a falling sine, felt more than heard
    this.tone(v.input, v.t, k.thumpTime, "sine", k.thump * jitter, k.thumpEnd, 0.9 * L, 0.001);
    // the tail, low and long, most of it into the reverb
    this.noise(v.input, v.t + 0.01, k.tail, "lowpass", 900 * jitter, 0.5, 0.18 * L, 0.01, 200);
    if (cfg.energy.includes(id)) this.tone(v.input, v.t, 0.09, "sawtooth", 1900 * jitter, 380, 0.16 * L, 0.001);
  }

  /** a grenade going off: a frag's deep boom, an arc star's crackling snap */
  blast(kind: "frag" | "arcstar", at: Vec): void {
    const v = this.voice(at, 1.6, "fx", 2, 1.4);
    if (!v) return;
    if (kind === "frag") {
      this.sample(v.input, v.t, "explosion", 0.9, 0.85);
      this.noise(v.input, v.t, 0.05, "highpass", 2400, 0.7, 0.9, 0.0008);
      this.tone(v.input, v.t, 0.5, "sine", 90, 28, 1.3, 0.002);
      this.noise(v.input, v.t, 0.45, "lowpass", 1200, 0.6, 1.0, 0.003, 120);
      this.noise(v.input, v.t + 0.02, 1.3, "lowpass", 500, 0.5, 0.35, 0.02, 80);
    } else {
      this.noise(v.input, v.t, 0.04, "highpass", 5200, 0.9, 0.8, 0.0006);
      this.tone(v.input, v.t, 0.25, "sawtooth", 1400, 180, 0.35, 0.001);
      for (let i = 0; i < 5; i++) this.noise(v.input, v.t + 0.03 + i * 0.05, 0.05, "bandpass", 3600 - i * 300, 4, 0.35, 0.001);
      this.tone(v.input, v.t, 0.35, "sine", 70, 40, 0.7, 0.002);
    }
  }

  /** a thrown thing: a frag's bounce, an arc star's stick, thermite catching */
  throwNoise(kind: "bounce" | "stick" | "fire" | "pin", at: Vec | null): void {
    const v = this.voice(at, kind === "fire" ? 1.2 : 0.25, "fx", 1, 0.4);
    if (!v) return;
    if (kind === "bounce") this.tone(v.input, v.t, 0.06, "triangle", 620, 420, 0.25, 0.001);
    else if (kind === "stick") {
      this.tone(v.input, v.t, 0.05, "square", 1800, 1600, 0.12, 0.001);
      this.noise(v.input, v.t, 0.4, "bandpass", 4200, 6, 0.12, 0.01);
    } else if (kind === "pin") {
      this.tone(v.input, v.t, 0.03, "square", 2600, 2400, 0.1, 0.0008);
      this.tone(v.input, v.t + 0.08, 0.05, "triangle", 900, 700, 0.12, 0.001);
    } else {
      this.noise(v.input, v.t, 1.1, "lowpass", 1600, 0.5, 0.6, 0.02, 300);
      this.noise(v.input, v.t, 0.08, "highpass", 3000, 0.7, 0.35, 0.001);
    }
  }

  /** the old call: a gunshot with a pitch and a volume, for anything not yet named */
  shot(pitch = 1, volume = 1): void {
    const v = this.voice(null, 0.4, "fx", 2);
    if (!v) return;
    this.noise(v.input, v.t, 0.08, "bandpass", 1400 * pitch, 0.7, 0.9 * volume);
    this.tone(v.input, v.t, 0.1, "sine", 140 * pitch, 50, 0.7 * volume);
  }

  /** a round passing close by: a sharp snap and a short whizz */
  whiz(at: Vec): void {
    const v = this.voice(at, 0.2, "fx", 1, 0.2);
    if (!v) return;
    this.noise(v.input, v.t, 0.03, "highpass", 5000, 0.8, 0.5, 0.0005);
    this.noise(v.input, v.t + 0.005, 0.12, "bandpass", 2600, 3, 0.25, 0.01, 1400);
  }

  dry(): void {
    const v = this.voice(null, 0.1, "fx", 2, 0);
    if (!v) return;
    this.tone(v.input, v.t, 0.03, "square", 900, 900, 0.12);
    this.noise(v.input, v.t, 0.02, "highpass", 4000, 1, 0.1);
  }

  /** a part of a reload: the magazine out, in, or the bolt */
  reloadStep(kind: "out" | "in" | "bolt"): void {
    const v = this.voice(null, 0.2, "fx", 2, 0.3);
    if (!v) return;
    // the recorded click of metal and polymer under the synthesis
    this.sample(v.input, v.t, kind === "out" ? "mag_out" : kind === "in" ? "mag_in" : "bolt", 0.35, kind === "bolt" ? 1.2 : 1.4);
    if (kind === "out") {
      this.noise(v.input, v.t, 0.05, "bandpass", 1600, 2, 0.25);
      this.noise(v.input, v.t + 0.03, 0.12, "bandpass", 700, 1.5, 0.12, 0.01);
    } else if (kind === "in") {
      this.noise(v.input, v.t, 0.04, "bandpass", 2400, 2.5, 0.35, 0.001);
      this.tone(v.input, v.t, 0.05, "triangle", 420, 300, 0.2, 0.001);
    } else {
      this.noise(v.input, v.t, 0.03, "bandpass", 3000, 3, 0.3, 0.001);
      this.noise(v.input, v.t + 0.09, 0.04, "bandpass", 2200, 3, 0.35, 0.001);
    }
  }

  /** the old reload click (the heal-done chime uses its own now) */
  reload(): void {
    this.reloadStep("in");
  }

  /** a weapon swap or holster: cloth and a click */
  swap(): void {
    const v = this.voice(null, 0.25, "fx", 1, 0.2);
    if (!v) return;
    this.noise(v.input, v.t, 0.18, "bandpass", 900, 0.8, 0.12, 0.03);
    this.noise(v.input, v.t + 0.12, 0.03, "bandpass", 2600, 3, 0.2, 0.001);
  }

  /** a charge building (HAVOC, Charge Rifle): a rising whine over `dur` */
  charge(dur: number): void {
    const v = this.voice(null, dur + 0.05, "fx", 2, 0.2);
    if (!v) return;
    this.tone(v.input, v.t, dur, "sawtooth", 300, 1600, 0.08, dur * 0.8);
  }

  /** the L-STAR's overheat: a hiss and a falling tone */
  overheat(): void {
    const v = this.voice(null, 1.2, "fx", 2, 0.3);
    if (!v) return;
    this.noise(v.input, v.t, 1.1, "highpass", 3000, 0.5, 0.25, 0.02);
    this.tone(v.input, v.t, 0.6, "square", 700, 180, 0.08);
  }

  // ------------------------------------------------------------ hits

  /** a hit marker's sound, pitched by what it hit: the shield's colour, bare health, a head */
  hitTier(tier: HitTier): void {
    const v = this.voice(null, 0.15, "hit", 2, 0);
    if (!v) return;
    const f = { white: 1100, blue: 1250, purple: 1420, red: 1600, health: 820, head: 1900 }[tier];
    if (tier === "health") {
      this.tone(v.input, v.t, 0.06, "triangle", f, f * 0.7, 0.3);
      this.noise(v.input, v.t, 0.04, "bandpass", 700, 1.5, 0.2);
    } else if (tier === "head") {
      this.tone(v.input, v.t, 0.08, "square", f, f, 0.18);
      this.tone(v.input, v.t + 0.012, 0.07, "sine", 2600, 2600, 0.2);
    } else {
      this.tone(v.input, v.t, 0.05, "square", f, f, 0.16);
      this.tone(v.input, v.t, 0.05, "sine", f * 2, f * 2, 0.06);
    }
  }
  hit(): void {
    this.hitTier("white");
  }
  headshot(): void {
    this.hitTier("head");
  }
  /** a shield breaking: glass and a falling shimmer */
  shieldBreak(): void {
    const v = this.voice(null, 0.5, "hit", 2, 0.2);
    if (!v) return;
    for (const f of [1760, 2350, 3150]) this.tone(v.input, v.t, 0.35, "sine", f, f * 0.8, 0.09);
    this.noise(v.input, v.t, 0.3, "highpass", 4500, 0.7, 0.22, 0.002, 2500);
  }
  /** a knock: a low descending stinger */
  knock(): void {
    const v = this.voice(null, 0.6, "hit", 2, 0.3);
    if (!v) return;
    this.tone(v.input, v.t, 0.25, "triangle", 520, 390, 0.25);
    this.tone(v.input, v.t + 0.12, 0.35, "triangle", 390, 260, 0.25);
  }
  /** you were hit: a dull body thud, a crackle on your shield */
  hurt(onShield: boolean): void {
    const v = this.voice(null, 0.25, "fx", 2, 0.1);
    if (!v) return;
    this.tone(v.input, v.t, 0.12, "sine", 110, 50, 0.5);
    if (onShield) this.noise(v.input, v.t, 0.12, "bandpass", 3400, 2, 0.2, 0.001);
    else this.noise(v.input, v.t, 0.1, "lowpass", 500, 0.7, 0.35);
  }

  // ------------------------------------------------------------ movement

  /** a footstep: yours (no `at`) or someone's; quieter crouched, louder sprinting */
  footstep(surface: Surface, at: Vec | null = null, loud = 1): void {
    // (long enough for the recorded steps, the grass ones about 0.8 s)
    const v = this.voice(at, 0.85, "fx", at ? 0 : 1, 0.3);
    if (!v) return;
    const j = 0.9 + Math.random() * 0.2;
    // halved on the owner's ear (2026-09-15): steps were louder than the room
    const L = (at ? cfg.footsteps.othersLevel : cfg.footsteps.ownLevel) * loud;
    // a recorded step (concrete, or grass for dirt; metal is the concrete step pitched up under the ring)
    this.sample(v.input, v.t, surface === "dirt" ? "step_grass" : "step_concrete", 1.1 * L, surface === "metal" ? 1.25 : 1);
    if (surface === "metal") {
      this.noise(v.input, v.t, 0.05, "bandpass", 2400 * j, 1.2, 0.35 * L);
      this.tone(v.input, v.t, 0.14, "sine", 880 * j, 860 * j, 0.1 * L);
      this.tone(v.input, v.t, 0.1, "sine", 1340 * j, 1320 * j, 0.06 * L);
    } else if (surface === "dirt") {
      this.noise(v.input, v.t, 0.08, "lowpass", 900 * j, 0.8, 0.5 * L, 0.004);
      this.noise(v.input, v.t + 0.015, 0.05, "bandpass", 2200 * j, 1, 0.12 * L);
    } else {
      this.noise(v.input, v.t, 0.05, "bandpass", 1700 * j, 1, 0.4 * L);
      this.tone(v.input, v.t, 0.05, "sine", 95 * j, 60, 0.25 * L);
    }
  }

  jump(): void {
    const v = this.voice(null, 0.2, "fx", 1, 0.2);
    if (!v) return;
    this.noise(v.input, v.t, 0.15, "bandpass", 700, 0.7, 0.12, 0.02, 1400);
  }

  /** a landing, by how hard: a thud and grit */
  land(impact01: number, surface: Surface): void {
    const v = this.voice(null, 0.3, "fx", 1, 0.3);
    if (!v) return;
    const k = Math.max(0.2, Math.min(1, impact01));
    this.sample(v.input, v.t, "land", 0.7 * k, 0.9);
    this.tone(v.input, v.t, 0.12 + 0.1 * k, "sine", 120, 45, 0.5 * k);
    this.noise(v.input, v.t, 0.08 + 0.06 * k, surface === "dirt" ? "lowpass" : "bandpass", surface === "metal" ? 2000 : 1100, 0.8, 0.35 * k);
    if (surface === "metal") this.tone(v.input, v.t, 0.25, "sine", 640, 620, 0.08 * k);
  }

  /** a melee landing: a punch */
  punch(at: Vec | null = null): void {
    const v = this.voice(at, 0.3, "fx", 2, 0.2);
    if (!v) return;
    if (!this.sample(v.input, v.t, "punch", 0.8)) this.tone(v.input, v.t, 0.1, "sine", 140, 60, 0.4);
    this.noise(v.input, v.t, 0.05, "lowpass", 900, 0.7, 0.2);
  }

  /** a figure going down: a body hitting the floor where it fell */
  bodyFall(at: Vec): void {
    const v = this.voice(at, 0.5, "fx", 1, 0.4);
    if (!v) return;
    if (!this.sample(v.input, v.t, "bodyfall", 0.9, 0.85)) this.tone(v.input, v.t, 0.2, "sine", 90, 40, 0.35);
  }

  /** a dropped gun landing on the floor */
  clatter(at: Vec): void {
    const v = this.voice(at, 0.4, "fx", 0, 0.3);
    if (!v) return;
    if (!this.sample(v.input, v.t, "clatter", 0.6, 0.8)) this.tone(v.input, v.t, 0.12, "triangle", 900, 700, 0.1);
  }

  /**
   * A door swinging, closing or being kicked. This is the one Apex sound a
   * player listens FOR rather than at: a door two rooms away is most of how
   * you know someone is in the building with you, so it carries further than
   * its loudness suggests and it is never synthesised, because synthesis
   * cannot do a hinge.
   */
  door(at: Vec, kind: "open" | "close" | "kick"): void {
    const v = this.voice(at, kind === "kick" ? 0.9 : 0.55, "fx", 0, kind === "kick" ? 0.7 : 0.45);
    if (!v) return;
    const name = kind === "open" ? "door_open" : kind === "close" ? "door_close" : "door_kick";
    if (!this.sample(v.input, v.t, name, kind === "kick" ? 1 : 0.7)) {
      this.tone(v.input, v.t, kind === "kick" ? 0.22 : 0.14, "triangle", kind === "kick" ? 160 : 420, 90, 0.3);
    }
  }

  /** a supply bin's lid, the same tell as a door but shorter */
  bin(at: Vec, open: boolean): void {
    const v = this.voice(at, 0.5, "fx", 0, 0.4);
    if (!v) return;
    if (!this.sample(v.input, v.t, open ? "bin_open" : "bin_close", 0.7)) this.tone(v.input, v.t, 0.12, "square", 300, 180, 0.18);
  }

  /** an item going into the pack: the player's own, so it is not placed in the world */
  pickup(): void {
    const v = this.voice(null, 0.25, "fx", 1, 0);
    if (!v) return;
    if (!this.sample(v.input, v.t, "pickup", 0.4)) this.tone(v.input, v.t, 0.05, "triangle", 900, 1400, 0.09);
  }

  /** a respawn beacon working, and a squad mate's banner going in */
  beacon(at: Vec): void {
    const v = this.voice(at, 0.7, "fx", 0, 0.5);
    if (!v) return;
    if (!this.sample(v.input, v.t, "beacon", 0.6)) this.tone(v.input, v.t, 0.5, "sine", 220, 660, 0.2);
  }

  /**
   * The drop's horn: a care package or a loadout pod on its way in. It is
   * deliberately the loudest thing on the map and it does not attenuate the
   * way an impact does, because everyone is meant to hear it and decide.
   */
  horn(at: Vec | null): void {
    const v = this.voice(at, 1, "fx", 1, 1);
    if (!v) return;
    if (!this.sample(v.input, v.t, "horn", 1)) this.tone(v.input, v.t, 1.2, "sawtooth", 110, 80, 0.35);
  }

  /** a ping landing: short, dry, and the same for everyone in the squad */
  pingTick(): void {
    const v = this.voice(null, 0.2, "fx", 1, 0);
    if (!v) return;
    if (!this.sample(v.input, v.t, "ping", 0.5)) this.tone(v.input, v.t, 0.05, "square", 1500, 1100, 0.08);
  }

  /** stepping onto a zipline: the hook taking the line */
  zipOn(at: Vec): void {
    const v = this.voice(at, 0.5, "fx", 0, 0.35);
    if (!v) return;
    if (!this.sample(v.input, v.t, "zip_ride", 0.5, 1.15)) this.tone(v.input, v.t, 0.25, "sawtooth", 500, 900, 0.14);
  }

  /** the menu: a click, a confirmation, an error */
  ui(kind: "click" | "confirm" | "error"): void {
    const v = this.voice(null, 0.4, "fx", 1, 0);
    if (!v) return;
    if (!this.sample(v.input, v.t, kind, kind === "click" ? 0.35 : 0.5)) this.tone(v.input, v.t, 0.04, "triangle", kind === "error" ? 300 : 1200, kind === "error" ? 240 : 1200, 0.08);
  }

  climbTap(): void {
    const v = this.voice(null, 0.1, "fx", 1, 0.2);
    if (!v) return;
    this.noise(v.input, v.t, 0.04, "bandpass", 1300 + Math.random() * 400, 1.2, 0.2);
  }

  mantle(): void {
    const v = this.voice(null, 0.3, "fx", 1, 0.2);
    if (!v) return;
    this.noise(v.input, v.t, 0.05, "bandpass", 1200, 1.2, 0.3);
    this.noise(v.input, v.t + 0.05, 0.22, "bandpass", 600, 0.7, 0.15, 0.03, 1100);
  }

  /** a JOLT: a rising rush of air; `volume` below 1 for someone else's */
  jolt(volume = 1): void {
    const v = this.voice(null, 0.35, "fx", 2, 0.3);
    if (!v) return;
    this.noise(v.input, v.t, 0.28, "bandpass", 500, 1.2, 0.7 * Math.max(0.03, Math.min(1, volume)), 0.04, 2600);
  }

  /** someone else's JOLT, from where it went */
  joltAt(at: Vec): void {
    const v = this.voice(at, 0.35, "fx", 1, 0.3);
    if (!v) return;
    this.noise(v.input, v.t, 0.28, "bandpass", 500, 1.2, 0.8, 0.04, 2600);
  }

  // ------------------------------------------------------------ loops

  /**
   * A loop by name: on with a level (0..1), off with 0. The slide's scrape,
   * the zipline's whine, the drop's wind, a heal's hum, the heartbeat.
   */
  loop(name: "slide" | "zip" | "wind" | "heal" | "heart", level: number, pitch = 1): void {
    const ctx = this.ctx;
    const on = level > 0.001;
    let l = this.loops.get(name);
    if (!on) {
      if (l && ctx) {
        l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        const dead = l;
        this.loops.delete(name);
        setTimeout(() => {
          for (const s of dead.src) {
            try {
              s.stop();
            } catch {
              /* stopped */
            }
          }
          dead.gain.disconnect();
        }, 400);
      }
      return;
    }
    if (!ctx || !this.fxBus) {
      if (!this.ensure()) return;
    }
    const c = this.ctx!;
    if (!l) {
      l = this.makeLoop(c, name);
      this.loops.set(name, l);
    }
    const t = c.currentTime;
    l.gain.gain.setTargetAtTime(level, t, 0.06);
    if (l.params.freq) l.params.freq.setTargetAtTime(this.loopFreq(name) * pitch, t, 0.08);
  }

  private loopFreq(name: string): number {
    return name === "slide" ? 1100 : name === "zip" ? 620 : name === "wind" ? 700 : name === "heal" ? 330 : 60;
  }

  private makeLoop(ctx: AudioContext, name: string): Loop {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.fxBus!);
    const src: AudioScheduledSourceNode[] = [];
    const params: Record<string, AudioParam> = {};
    if (name === "heart") {
      // two thumps a beat, 1.1 beats a second: an LFO gating a low sine
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 55;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const beat = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
      const d = beat.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / ctx.sampleRate;
        d[i] = Math.exp(-Math.pow((t - 0.05) / 0.035, 2)) + 0.7 * Math.exp(-Math.pow((t - 0.28) / 0.035, 2));
      }
      const env = ctx.createBufferSource();
      env.buffer = beat;
      env.loop = true;
      env.connect(gate.gain);
      o.connect(gate).connect(gain);
      o.start();
      env.start();
      src.push(o, env);
      params.freq = o.frequency;
      return { src, gain, params };
    }
    if (name === "heal") {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 330;
      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = 495;
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;
      o.connect(gain);
      o2.connect(g2).connect(gain);
      o.start();
      o2.start();
      src.push(o, o2);
      params.freq = o.frequency;
      return { src, gain, params };
    }
    // noise loops: slide, zip, wind (the zip adds a whine)
    const n = ctx.createBufferSource();
    n.buffer = this.white;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = name === "wind" ? "lowpass" : "bandpass";
    f.frequency.value = this.loopFreq(name);
    f.Q.value = name === "slide" ? 0.9 : name === "zip" ? 4 : 0.6;
    n.connect(f).connect(gain);
    n.start();
    src.push(n);
    params.freq = f.frequency;
    if (name === "zip") {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 900;
      const og = ctx.createGain();
      og.gain.value = 0.05;
      o.connect(og).connect(gain);
      o.start();
      src.push(o);
    }
    return { src, gain, params };
  }

  /** everything looping off (the menu, a match's end) */
  stopLoops(): void {
    for (const name of [...this.loops.keys()]) this.loop(name as "slide", 0);
  }

  // ------------------------------------------------------------ heals, ring, match

  healDone(): void {
    const v = this.voice(null, 0.4, "fx", 2, 0.3);
    if (!v) return;
    this.tone(v.input, v.t, 0.18, "sine", 880, 880, 0.2);
    this.tone(v.input, v.t + 0.08, 0.25, "sine", 1320, 1320, 0.18);
  }

  /** a Deathbox Respawn under way: a hum rising over its 7 s, heard a long way off */
  beamHum(at: Vec, seconds: number): (() => void) | null {
    const v = this.voice(at, seconds + 0.4, "fx", 2, 1.2);
    if (!v) return null;
    this.tone(v.input, v.t, seconds, "sine", 110, 220, 0.22, 0.4);
    this.tone(v.input, v.t, seconds, "triangle", 165, 330, 0.1, 0.4);
    for (let i = 0; i < Math.floor(seconds); i++) this.tone(v.input, v.t + i + 0.5, 0.12, "sine", 660 + i * 40, 660 + i * 40, 0.08, 0.01);
    // stopped early (the hold given up): fade it out
    const g = v.input as GainNode;
    return () => {
      if (this.ctx) g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    };
  }

  /** the ring starts to close: a long low horn */
  ringHorn(): void {
    const v = this.voice(null, 2, "fx", 2, 0.6);
    if (!v) return;
    this.tone(v.input, v.t, 1.6, "sawtooth", 110, 104, 0.12, 0.35);
    this.tone(v.input, v.t, 1.6, "sawtooth", 165, 156, 0.08, 0.35);
    this.noise(v.input, v.t, 1.4, "lowpass", 400, 0.5, 0.06, 0.3);
  }

  /** a ring damage tick on you: a buzz */
  ringTick(): void {
    const v = this.voice(null, 0.3, "fx", 2, 0.1);
    if (!v) return;
    this.tone(v.input, v.t, 0.22, "square", 140, 120, 0.12);
    this.noise(v.input, v.t, 0.2, "bandpass", 2500, 2, 0.08);
  }

  /** the countdown: a beep each second, a higher one for the fight */
  countdown(final: boolean): void {
    const v = this.voice(null, 0.5, "fx", 2, 0.2);
    if (!v) return;
    if (final) this.tone(v.input, v.t, 0.45, "square", 1320, 1320, 0.1, 0.005);
    else this.tone(v.input, v.t, 0.12, "square", 880, 880, 0.08);
  }

  /** a round or a match decided: up for a win, down for a loss; the champion gets a chord */
  stinger(kind: "won" | "lost" | "champion"): void {
    const v = this.voice(null, 1.4, "fx", 2, 0.5);
    if (!v) return;
    const notes = kind === "won" ? [523, 659, 784] : kind === "lost" ? [440, 370, 294] : [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(v.input, v.t + i * 0.11, kind === "champion" ? 1.1 : 0.4, "triangle", f, f, 0.14));
  }

  /** the drop begins, or anything else worth a whoosh */
  whoosh(): void {
    const v = this.voice(null, 0.6, "fx", 1, 0.3);
    if (!v) return;
    this.noise(v.input, v.t, 0.5, "bandpass", 300, 0.8, 0.3, 0.1, 1800);
  }

  /** active voices (tests) */
  get voiceCount(): number {
    return this.voices;
  }
}
