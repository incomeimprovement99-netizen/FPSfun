// The intro card: what the page opens on, and what plays as you drop into a
// match. Black screen, green rain falling at its own speed in every column,
// the game's name smashed in over it, then a shot through the middle: a bullet
// hole, the glass cracking out to the edges, and the pane falling away in
// shards into whatever is behind it.
//
// It is one 2D canvas over everything (index.html #intro), not WebGL: the
// world's renderer is busy with the world, and a title card is lines and
// letters. It costs nothing once it is done, because it takes itself off the
// page.
//
// Three things it must never do: hold up the game (the match starts underneath
// it and it is only ever a picture), take a click (the canvas takes no pointer
// events, and any key or click skips it), or play at all for someone who has
// asked their machine for less movement (`prefers-reduced-motion` gets a plain
// fade with no shake and no falling glass).
//
// The numbers are in src/config/intro.json. The shapes are worked out from a
// seed, so the same seed draws the same crack: that is what lets the checks and
// the snapshots see the picture the player sees.
import INTRO_CFG from "../config/intro.json";

export type IntroKind = "boot" | "match";

/** the moments an intro turns on, seconds from its start */
export interface Beats {
  /** the rain starts (always 0: it is the backdrop) */
  rain: number;
  /** the name smashes in */
  title: number;
  /** the shot: the flash, the kick, and the crack running out from the hole */
  shot: number;
  /** after a beat of quiet, one shotgun blast puts a spread of holes through the pane */
  blast: number;
  /** the pane lets go and the shards start to fall */
  out: number;
  /** the card is gone */
  end: number;
}

/**
 * The beats of one intro. Asking for less movement shortens the whole thing
 * and moves the shot in, because the fall it was leading to is not played.
 */
export function introBeats(kind: IntroKind, reduced = false): Beats {
  const b = kind === "match" ? INTRO_CFG.match : INTRO_CFG.boot;
  if (!reduced) return { ...b };
  // a plain fade: the crack still draws (it is the point of the card), the
  // flash, the kick and the falling glass do not
  const end = INTRO_CFG.reduced.end;
  return {
    rain: 0,
    title: b.title * 0.5,
    shot: end * 0.4,
    // no blast either: one crack, and the card goes
    blast: end,
    out: end * 0.75,
    end,
  };
}

/** a little random with a seed, so a crack drawn twice is the same crack */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** one crack running out from the hole: the points it passes through, in order */
export interface Ray {
  points: Array<{ x: number; y: number }>;
  /** how far along the pane's half-diagonal it reaches, 0 to 1 */
  reach: number;
}

/** the whole break: the rays out of the hole, the rings between them, and the shards they cut the pane into */
export interface Crack {
  rays: Ray[];
  /** each ring is one point on each ray, at the same fraction of its length: the glass between the cracks */
  rings: Array<Array<{ x: number; y: number }>>;
  /** the pane cut into pieces, each a fan from the hole out between two rays */
  shards: Array<{
    points: Array<{ x: number; y: number }>;
    spin: number;
    drift: number;
    mid: { x: number; y: number };
    away: { x: number; y: number };
  }>;
  hole: { x: number; y: number; r: number };
}

/**
 * The break a shot through (`cx`, `cy`) makes in a pane `w` by `h`. Every ray
 * leaves the hole at its own angle, wanders as it goes (glass does not crack
 * straight) and stops somewhere past the edge, so no two cracks end together.
 * Deterministic in `seed`.
 */
export function crackPlan(
  w: number,
  h: number,
  seed: number,
  cx = w / 2,
  cy = h / 2,
  rayCount = INTRO_CFG.crack.rays,
  ringCount = INTRO_CFG.crack.rings,
  reachScale = 1,
  holeR = INTRO_CFG.crack.hole,
): Crack {
  const cfg = INTRO_CFG.crack;
  const rnd = seeded(seed);
  const reachOut = Math.hypot(w, h);
  const rays: Ray[] = [];
  const turn = (Math.PI * 2) / rayCount;
  for (let i = 0; i < rayCount; i++) {
    // spaced round the hole but never evenly: an even star reads as a cartoon
    let a = i * turn + (rnd() - 0.5) * turn * 0.8;
    const reach = (0.75 + rnd() * 0.45) * reachScale;
    const steps = 5;
    const points: Array<{ x: number; y: number }> = [
      { x: cx + Math.cos(a) * holeR, y: cy + Math.sin(a) * holeR },
    ];
    for (let s = 1; s <= steps; s++) {
      a += (rnd() - 0.5) * cfg.wander;
      const d = holeR + (reachOut * reach * s) / steps;
      points.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d });
    }
    rays.push({ points, reach });
  }
  // the rings: the same fraction along every ray, joined up. Glass breaks in
  // these as much as in the rays, and without them the middle is a starburst.
  const rings: Array<Array<{ x: number; y: number }>> = [];
  for (let r = 1; r <= ringCount; r++) {
    const at = (r / (ringCount + 1)) * 0.8;
    rings.push(
      rays.map((ray) => {
        const f = at * (ray.points.length - 1);
        const i = Math.min(ray.points.length - 2, Math.floor(f));
        const k = f - i;
        return {
          x: ray.points[i].x + (ray.points[i + 1].x - ray.points[i].x) * k,
          y: ray.points[i].y + (ray.points[i + 1].y - ray.points[i].y) * k,
        };
      }),
    );
  }
  // a shard is the fan between one ray and the next, from the hole outwards:
  // the pieces that let go when the pane does
  const shards = rays.map((ray, i) => {
    const next = rays[(i + 1) % rays.length];
    const rnd2 = seeded(seed + 977 * (i + 1));
    const points = [
      { x: cx, y: cy },
      ...ray.points,
      ...[...next.points].reverse(),
    ];
    // its own middle, to turn about, and the way out of the hole, to be thrown
    const mid = points.reduce(
      (a, p) => ({
        x: a.x + p.x / points.length,
        y: a.y + p.y / points.length,
      }),
      { x: 0, y: 0 },
    );
    const len = Math.max(1, Math.hypot(mid.x - cx, mid.y - cy));
    return {
      points,
      mid,
      away: { x: (mid.x - cx) / len, y: (mid.y - cy) / len },
      spin: (rnd2() - 0.5) * 2.2,
      drift: (rnd2() - 0.5) * 160,
    };
  });
  return { rays, rings, shards, hole: { x: cx, y: cy, r: holeR } };
}

/** one pellet of the blast: where it went through, and the break it made */
export interface Pellet {
  x: number;
  y: number;
  crack: Crack;
}

/**
 * The shotgun blast: a spread of pellets through the pane, all in the same
 * instant, each with a small break of its own around it, so the first shot's
 * long cracks stay the break that carries the glass. Deterministic in `seed`,
 * like everything else on the card.
 */
export function blastPlan(w: number, h: number, seed: number): Pellet[] {
  const cfg = INTRO_CFG.blast;
  const rnd = seeded(seed ^ 0x5f3a);
  const out: Pellet[] = [];
  for (let i = 0; i < cfg.pellets; i++) {
    // Round the middle rather than square to the screen: a shot pattern, not a
    // grid. `keepOut` is what keeps the pattern off the name in the centre,
    // where the rifle round's own hole already is, and it is what makes the
    // blast read as a spread rather than a second shot at the same spot.
    const a = i * 2.399963 + rnd() * 0.9;
    const r = cfg.keepOut + (1 - cfg.keepOut) * Math.sqrt(rnd());
    const x = w / 2 + Math.cos(a) * r * w * 0.5 * cfg.spread;
    const y = h / 2 + Math.sin(a) * r * h * 0.5 * cfg.spread;
    out.push({ x, y, crack: crackPlan(w, h, seed + 5701 * (i + 1), x, y, cfg.rays, cfg.rings, cfg.reach, cfg.hole) });
  }
  return out;
}

/** one column of the rain: where it is, how fast it falls, and the glyphs in it */
export interface RainColumn {
  x: number;
  /** glyphs a second */
  speed: number;
  /** where its head starts, in glyphs above the top */
  start: number;
  /** how long its lit tail is, in glyphs */
  tail: number;
}

/**
 * The rain over a pane `w` wide: one column every `column` pixels, each with
 * its own speed between `slow` and `fast` and its own head start, so nothing
 * ever falls in step. Deterministic in `seed`.
 */
export function rainColumns(w: number, h: number, seed: number): RainColumn[] {
  const cfg = INTRO_CFG.rain;
  const rnd = seeded(seed);
  const n = Math.max(1, Math.ceil(w / cfg.column));
  const rows = Math.ceil(h / cfg.glyph);
  const cols: RainColumn[] = [];
  for (let i = 0; i < n; i++) {
    cols.push({
      x: i * cfg.column,
      speed: cfg.slow + rnd() * (cfg.fast - cfg.slow),
      // already somewhere down the screen when the card opens: rain that has
      // to fall from the top first gives a card that opens on nothing
      start: rnd() * rows,
      tail: 6 + Math.floor(rnd() * 18),
    });
  }
  return cols;
}

/** 0 to 1, fast out of the gate and slow into the stop: what a smash lands like */
function easeOut(k: number): number {
  const x = Math.min(1, Math.max(0, k));
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

const GLYPHS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ<>[]{}/\\|=+*#%&$@";

/**
 * The card itself. One is made at boot and kept: `play` runs a card and
 * settles when it is done (or when it is skipped), and nothing about it holds
 * up whatever asked for it.
 */
export class Intro {
  /** the card that is playing, if one is */
  kind: IntroKind | null = null;
  /** seconds into the card */
  at = 0;
  beats: Beats = introBeats("boot");
  /** every card that has been played (the checks count them) */
  played = 0;
  /**
   * The moment of the shot, for whoever owns the sound: the card itself makes
   * no noise (src/game/audio.ts belongs to the game, not to a title screen),
   * and on the page's first seconds a browser will not play any sound anyway
   * until something has been clicked.
   */
  onShot: (() => void) | null = null;
  /**
   * The card is about to play, a second or so before the shot: whoever owns
   * the sound gets it ready here. The first noise a page makes costs about
   * fifty milliseconds to build its graph, and the frame that cost fell on was
   * the frame of the shot, the one frame of the card that has to land.
   */
  onWarm: (() => void) | null = null;
  /**
   * Whether the world is in, and how much of it is, from whoever is loading it
   * (src/ui/loading.ts). The card is the loading screen now: it holds on the
   * rain and the name until this says yes, and draws the fraction as the line
   * under the name, so the wait is the animation instead of a bar under it.
   */
  ready: (() => boolean) | null = null;
  progress: (() => number) | null = null;
  private shotSaid = false;
  /** the words on the card now: the big line, the one under it, and the small one over it (a mode's card) */
  private words: { mark: string; sub: string; over: string } = { mark: INTRO_CFG.text.mark, sub: INTRO_CFG.text.sub, over: "" };
  /** the blast's own sound: a 12 gauge, not a second rifle round (falls back to onShot) */
  onBlast?: () => void;
  /** held at one moment, for a picture (tools/snap.ts) */
  private frozen: number | null = null;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly say: HTMLElement | null;
  private cols: RainColumn[] = [];
  private crack: Crack | null = null;
  private pellets: Pellet[] = [];
  /** the blast has been heard (once, not once a pellet) */
  private blastSaid = false;
  /** seconds this card has held on the rain waiting for the world to come in */
  waited = 0;
  private glyphs: string[][] = [];
  private glyphAt = 0;
  private startedAt = 0;
  private raf = 0;
  private done: (() => void) | null = null;
  private readonly seed: number;
  /** the pane as it stood the moment the glass let go, so the shards carry the picture down with them */
  private pane: HTMLCanvasElement | null = null;
  /** a canvas of the same size, made ready when the card starts: allocating one at the break cost a 49 ms frame */
  private spare: HTMLCanvasElement | null = null;

  constructor(seed = 20260920) {
    this.seed = seed;
    this.canvas = document.getElementById("intro") as HTMLCanvasElement | null;
    this.ctx = this.canvas?.getContext("2d") ?? null;
    this.say = document.getElementById("introSay");
  }

  /** someone has asked their machine for less movement */
  get reduced(): boolean {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  /**
   * Play a card. It settles when the card is done; a caller that does not care
   * simply does not wait, which is what the match start does: the match is
   * already running underneath.
   */
  play(kind: IntroKind, words?: { name: string; sub: string }): Promise<void> {
    if (this.kind) this.stop();
    // a mode's card: its name big and its line under it, the game's name small over them
    this.words = words ? { mark: words.name, sub: words.sub, over: INTRO_CFG.text.mark } : { mark: INTRO_CFG.text.mark, sub: INTRO_CFG.text.sub, over: "" };
    if (!this.canvas || !this.ctx) return Promise.resolve();
    this.kind = kind;
    this.beats = introBeats(kind, this.reduced);
    this.at = 0;
    this.played++;
    this.shotSaid = false;
    this.blastSaid = false;
    this.waited = 0;
    this.startedAt = performance.now();
    this.size();
    try {
      this.onWarm?.();
    } catch {
      /* a title card is never the thing that breaks the page */
    }
    // and the same for the letters: a font this size is rasterised the first
    // time it is drawn, which was a frame of its own on the beat the name lands
    this.warmTitle();
    this.canvas.hidden = false;
    // the name, for anyone who is listening rather than looking
    if (this.say)
      this.say.textContent = this.words.over ? `${this.words.over}. ${this.words.mark}: ${this.words.sub}` : `${this.words.mark}: ${this.words.sub}`;
    return new Promise<void>((resolve) => {
      this.done = resolve;
      this.frame();
    });
  }

  /** any key, any click: the rest of the card is not worth anyone's time twice */
  skip(): void {
    if (this.kind) this.stop();
  }

  /** hold the card at one moment and draw it there (tools/snap.ts, so a picture is the same picture every time) */
  freeze(seconds: number): void {
    this.frozen = seconds;
    if (!this.kind) {
      this.kind = "boot";
      this.beats = introBeats("boot");
      this.size();
      if (this.canvas) this.canvas.hidden = false;
    }
    // the shards carry the pane as it stood, so a picture of them needs the
    // moment before as well: draw it first, then the moment asked for
    if (seconds >= this.beats.out) {
      this.at = this.beats.out - 0.001;
      this.draw();
    }
    this.at = seconds;
    this.draw();
  }

  /** what the checks and the tools ask (tools/e2e.ts) */
  state(): {
    kind: IntroKind | null;
    at: number;
    beats: Beats;
    played: number;
    reduced: boolean;
    shown: boolean;
    waited: number;
  } {
    return {
      kind: this.kind,
      at: this.at,
      beats: this.beats,
      played: this.played,
      reduced: this.reduced,
      shown: !!this.canvas && !this.canvas.hidden,
      waited: this.waited,
    };
  }

  private stop(): void {
    this.kind = null;
    this.frozen = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.canvas) this.canvas.hidden = true;
    if (this.say) this.say.textContent = "";
    this.pane = null;
    const done = this.done;
    this.done = null;
    done?.();
  }

  /** the canvas in device pixels, and the rain and the crack laid out for this size */
  private size(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (!this.spare) this.spare = document.createElement("canvas");
    this.spare.width = w;
    this.spare.height = h;
    this.cols = rainColumns(w, h, this.seed);
    this.crack = crackPlan(w, h, this.seed);
    this.pellets = blastPlan(w, h, this.seed);
    this.glyphs = this.cols.map((_, i) => [GLYPHS[i % GLYPHS.length], GLYPHS[(i * 7 + 3) % GLYPHS.length], GLYPHS[(i * 13 + 5) % GLYPHS.length]]);
    this.glyphAt = -1;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, w, h);
  }

  private frame = (): void => {
    if (!this.kind) return;
    if (this.frozen === null) {
      this.at = (performance.now() - this.startedAt) / 1000;
      // The card covers loading rather than following it: at the moment of the
      // shot it holds, rain still falling and the name still up, until the
      // world is in. `waitMost` is the outside of that, because a card that
      // never fires is worse than one that fires early.
      const waitOn = this.kind === "boot" && this.ready !== null && !this.ready() && this.waited < INTRO_CFG.wait.waitMost;
      if (waitOn && this.at > this.beats.shot) {
        const held = this.at - this.beats.shot;
        this.waited += held;
        this.startedAt += held * 1000;
        this.at = this.beats.shot;
      }
    }
    this.draw();
    if (this.at >= this.beats.end) {
      this.stop();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const c = this.canvas;
    const ctx = this.ctx;
    if (!c || !ctx || !this.crack) return;
    const { width: w, height: h } = c;
    const t = this.at;
    const b = this.beats;
    const cfg = INTRO_CFG;
    let shake = this.reduced
      ? 0
      : Math.max(0, 1 - (t - b.shot) / 0.3) *
        (t >= b.shot ? cfg.crack.shake : 0);
    // and the shotgun kicks it again, once and hard
    if (!this.reduced && t >= b.blast) {
      shake = Math.max(shake, Math.max(0, 1 - (t - b.blast) / 0.22) * cfg.blast.kick);
    }
    const rnd = seeded(Math.floor(t * 120) + 7);

    // once the glass lets go, what falls is the picture as it stood: the pane
    // is kept the moment before, and the canvas is cleared so the game shows
    // through the gaps the shards leave
    if (t >= b.out) {
      if (!this.pane) this.pane = this.snapshot();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      this.drawShards(ctx, (t - b.out) / Math.max(0.001, b.end - b.out));
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shake > 0)
      ctx.setTransform(
        1,
        0,
        0,
        1,
        (rnd() - 0.5) * shake,
        (rnd() - 0.5) * shake,
      );

    // the rain, drawn over what is already there so every head leaves a tail
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - cfg.rain.trail})`;
    ctx.fillRect(-shake, -shake, w + shake * 2, h + shake * 2);
    this.drawRain(ctx, t, h);

    this.drawFurniture(ctx, w, h, t);

    // the name, smashed in and held
    if (t >= b.title) this.drawTitle(ctx, t - b.title, w, h);

    // the shotgun: one flash, one kick, and every pellet through the glass in
    // the same instant. A string of single rounds read as a strobe; a blast
    // reads as a shotgun, which is what the card is about.
    if (t >= b.blast && !this.reduced) {
      if (!this.blastSaid && this.frozen === null) {
        this.blastSaid = true;
        try {
          (this.onBlast ?? this.onShot)?.();
        } catch {
          /* a title card is never the thing that breaks the page */
        }
      }
      const since = t - b.blast;
      if (since < cfg.blast.flash) {
        ctx.fillStyle = `rgba(255, 255, 255, ${cfg.blast.flashAlpha * (1 - since / cfg.blast.flash)})`;
        ctx.fillRect(0, 0, w, h);
      }
      const grown = Math.min(1, since / (INTRO_CFG.crack.spread * 0.7));
      for (const p of this.pellets) this.drawCrack(ctx, grown, p.crack);
    }

    // the shot: a flash that goes at once, then the crack running out
    if (t >= b.shot) {
      if (!this.shotSaid && this.frozen === null) {
        this.shotSaid = true;
        try {
          this.onShot?.();
        } catch {
          /* a title card is never the thing that breaks the page */
        }
      }
      const since = t - b.shot;
      if (!this.reduced && since < 0.14) {
        ctx.fillStyle = `rgba(255, 255, 255, ${cfg.crack.flash * (1 - since / 0.14)})`;
        ctx.fillRect(0, 0, w, h);
      }
      this.drawCrack(ctx, Math.min(1, since / cfg.crack.spread));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawRain(ctx: CanvasRenderingContext2D, t: number, h: number): void {
    const cfg = INTRO_CFG.rain;
    const rows = Math.ceil(h / cfg.glyph) + 2;
    // the characters turn over as they fall, all of them together: a glyph
    // that never changes reads as a dotted line rather than rain
    if (t - this.glyphAt > cfg.swap) {
      this.glyphAt = t;
      const rnd = seeded(Math.floor(t / cfg.swap) + 31);
      this.glyphs = this.cols.map((_, i) => {
        const out: string[] = [];
        for (let r = 0; r < 3; r++)
          out.push(GLYPHS[Math.floor(rnd() * GLYPHS.length) % GLYPHS.length]);
        return out.length ? out : [GLYPHS[i % GLYPHS.length]];
      });
    }
    ctx.font = `${cfg.glyph}px "Consolas", "Courier New", monospace`;
    ctx.textBaseline = "top";
    this.cols.forEach((col, i) => {
      // round and round: a head that falls off the bottom comes back at the top
      const span = rows + col.tail;
      const row =
        Math.floor((((col.start + t * col.speed) % span) + span) % span) -
        col.tail;
      const set = this.glyphs[i] ?? [GLYPHS[i % GLYPHS.length]];
      // the head is nearly white, the couple behind it green: the tail itself
      // is whatever the fading fill above has left of earlier heads
      for (let k = 0; k < 3; k++) {
        const r = row - k;
        if (r < 0 || r > rows) continue;
        ctx.fillStyle = k === 0 ? cfg.head : cfg.dim;
        ctx.globalAlpha = k === 0 ? 1 : 0.55 - k * 0.15;
        ctx.fillText(set[k] ?? set[0] ?? GLYPHS[(i + k) % GLYPHS.length], col.x, r * cfg.glyph);
      }
      ctx.globalAlpha = 1;
    });
  }

  /**
   * What makes it a screen rather than a page: the scan lines of a display
   * that is not quite clean, the corner brackets a game puts round its own
   * picture, and the dark at the edges that keeps the eye in the middle.
   */
  private drawFurniture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
  ): void {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    // one brighter line sweeping down, the way a screen refreshes
    const sweep = ((t * 0.55) % 1) * h;
    ctx.fillStyle = "rgba(120, 255, 170, 0.05)";
    ctx.fillRect(0, sweep, w, Math.max(2, h * 0.02));
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72,
    );
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // the brackets: a corner of a frame at each corner, as a game's own UI draws them
    const m = Math.round(Math.min(w, h) * 0.045);
    const len = Math.round(Math.min(w, h) * 0.07);
    ctx.strokeStyle = "rgba(55, 224, 122, 0.55)";
    ctx.lineWidth = Math.max(1.5, Math.round(Math.min(w, h) * 0.0035));
    for (const [cx, cy, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * len, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTitle(
    ctx: CanvasRenderingContext2D,
    since: number,
    w: number,
    h: number,
  ): void {
    const txt = this.words;
    // it lands in a fifth of a second, from far too big, and settles
    const k = easeOut(since / 0.2);
    const scale = this.reduced ? 1 : 2.6 - 1.6 * k;
    const alpha = Math.min(1, since / (this.reduced ? 0.35 : 0.08));
    // A mode's name can be longer than the game's (TEAM DEATHMATCH): the big
    // line is sized down to fit nine tenths of the width rather than run off it.
    let mark = Math.round(Math.min(w * 0.115, h * 0.2));
    ctx.font = `700 ${mark}px "Rajdhani", "Segoe UI", sans-serif`;
    const across = ctx.measureText(txt.mark).width * 1.04;
    if (across > w * 0.9) mark = Math.floor((mark * w * 0.9) / across);
    const sub = Math.round(mark * 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${mark}px "Rajdhani", "Segoe UI", sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(mark * 0.04)}px`;
    } catch {
      /* an older canvas has no letter spacing: the card reads without it */
    }
    // the same word three times, a hair apart in two colours: a screen that is
    // not quite holding its signal, which is the look the whole card is after
    const off = this.reduced ? 0 : Math.max(0, 1 - k) * 14 + 2;
    ctx.fillStyle = "rgba(0, 255, 130, 0.55)";
    ctx.fillText(txt.mark, -off, -mark * 0.28);
    ctx.fillStyle = "rgba(0, 200, 255, 0.45)";
    ctx.fillText(txt.mark, off, -mark * 0.28);
    ctx.fillStyle = "#f2fff6";
    ctx.fillText(txt.mark, 0, -mark * 0.28);
    ctx.font = `700 ${sub}px "Rajdhani", "Segoe UI", sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(sub * 0.42)}px`;
    } catch {
      /* as above */
    }
    ctx.fillStyle = "#37e07a";
    ctx.fillText(txt.sub, 0, mark * 0.42);
    // a mode's card: the game's own name, small, over the mode's
    if (txt.over) {
      ctx.fillStyle = "rgba(242, 255, 246, 0.8)";
      ctx.fillText(txt.over, 0, -mark * 0.98);
    }
    // The line under it is drawn out from the middle as the name lands, and it
    // is the loading bar as well: the card stands in for the loading screen,
    // so how much of the world is in shows here, as a brighter length over the
    // dim full width. Nothing else on the card says it, and nothing needs to.
    const full = mark * 2.1 * k;
    const line = Math.max(1, Math.round(mark * 0.018));
    ctx.fillStyle = "rgba(55, 224, 122, 0.28)";
    ctx.fillRect(-full / 2, mark * 0.72, full, line);
    const got = this.progress ? Math.min(1, Math.max(0, this.progress())) : 1;
    ctx.fillStyle = "rgba(55, 224, 122, 0.9)";
    ctx.fillRect(-full / 2, mark * 0.72, full * got, line);
    ctx.restore();
  }

  private drawCrack(
    ctx: CanvasRenderingContext2D,
    k: number,
    which?: Crack,
  ): void {
    const cr = which ?? this.crack;
    if (!cr) return;
    const grown = easeOut(k);
    ctx.save();
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle =
        pass === 0 ? "rgba(120, 255, 170, 0.22)" : "rgba(210, 255, 225, 0.9)";
      ctx.lineWidth = pass === 0 ? 7 : 2.2;
      for (const ray of cr.rays) {
        ctx.beginPath();
        ctx.moveTo(ray.points[0].x, ray.points[0].y);
        // the crack runs out from the hole rather than appearing whole
        const upto = 1 + grown * (ray.points.length - 1);
        for (let i = 1; i < ray.points.length; i++) {
          if (i > upto) {
            const prev = ray.points[i - 1];
            const p = ray.points[i];
            const f = Math.max(0, upto - (i - 1));
            ctx.lineTo(
              prev.x + (p.x - prev.x) * f,
              prev.y + (p.y - prev.y) * f,
            );
            break;
          }
          ctx.lineTo(ray.points[i].x, ray.points[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(180, 255, 210, 0.5)";
    for (let r = 0; r < cr.rings.length; r++) {
      // the rings come in behind the rays that carry them
      if (grown < 0.3 + r * 0.2) continue;
      const ring = cr.rings[r];
      ctx.beginPath();
      ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    }
    // the hole itself: dark, with the glass ground white around its lip
    const g = ctx.createRadialGradient(
      cr.hole.x,
      cr.hole.y,
      1,
      cr.hole.x,
      cr.hole.y,
      cr.hole.r * 2.4,
    );
    g.addColorStop(0, "rgba(0, 0, 0, 0.95)");
    g.addColorStop(0.55, "rgba(230, 255, 240, 0.75)");
    g.addColorStop(1, "rgba(120, 255, 170, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(
      cr.hole.x,
      cr.hole.y,
      cr.hole.r * 2.4 * Math.max(0.35, grown),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  /** the name drawn once where nobody sees it, so the font is ready for the beat it lands on */
  private warmTitle(): void {
    const c = this.spare;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.globalAlpha = 0.01;
    for (const since of [0, 0.06, 0.2]) this.drawTitle(ctx, since, c.width, c.height);
    ctx.restore();
    ctx.clearRect(0, 0, c.width, c.height);
  }

  /** the pane as it stands now, kept so the shards can carry it down */
  private snapshot(): HTMLCanvasElement | null {
    const c = this.canvas;
    const copy = this.spare;
    if (!c || !copy) return null;
    copy.getContext("2d")?.drawImage(c, 0, 0);
    return copy;
  }

  private drawShards(ctx: CanvasRenderingContext2D, k01: number): void {
    const cr = this.crack;
    const pane = this.pane;
    if (!cr || !pane) return;
    const k = Math.min(1, Math.max(0, k01));
    // a plain fade for anyone who asked for less movement
    if (this.reduced) {
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(pane, 0, 0);
      ctx.globalAlpha = 1;
      return;
    }
    const fall = k * k * pane.height * 1.3;
    for (const shard of cr.shards) {
      ctx.save();
      // the glass holds its picture while it breaks and only goes at the end:
      // a piece that fades as it leaves reads as a dissolve, not a shatter
      ctx.globalAlpha = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45);
      // thrown out of the hole, turning about its own middle, and falling
      ctx.translate(
        shard.away.x * k * pane.width * 0.11 + shard.drift * k * k,
        shard.away.y * k * pane.height * 0.09 + fall,
      );
      ctx.translate(shard.mid.x, shard.mid.y);
      ctx.rotate(shard.spin * k * 0.5);
      ctx.translate(-shard.mid.x, -shard.mid.y);
      ctx.beginPath();
      shard.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(pane, 0, 0);
      ctx.restore();
    }
  }
}
