// The range's own tooling, the parts Apex's Firing Range has and the parts it
// does not (docs/GAP_ANALYSIS.md, "Range and practice tooling"):
//
//   DummyBehaviour  the range dummies strafe, crouch-strafe or move at random
//                   (Apex's dummy panel), at a speed
//   RangeCombat     "shoot back": the nearest dummies that can see you fire
//                   at you with a bot's aim, and you have a shield and health
//                   in the range that come back two seconds after you drop
//   SprayWall       a wall 20 m from a floor mark: your hits drawn on it, and
//                   next to them where the gun puts a magazine with no
//                   compensation, from the game's own recoil model
//   FlickDrill      "Blink": thirty figures one at a time at random spots in a
//                   60 degree cone, 5 to 30 m out; time, hits, accuracy, a best
import * as THREE from "three";
import { Dummy } from "./dummy";
import { solidHit, type ProjectileSystem } from "./projectile";
import { DIFFICULTY, aimError, tierFor, hitsBody } from "./bots";
import { WeaponState } from "./weapon-state";
import type { ResolvedWeapon } from "./weapons";
import type { BotDifficulty } from "./stats";
import cfg from "../config/rangetools.json";

// ---------------------------------------------------------------- moving dummies

export type DummyMode = "stand" | "strafe" | "crouch" | "random";
export const DUMMY_MODES: DummyMode[] = ["stand", "strafe", "crouch", "random"];
export const DUMMY_MODE_NAME: Record<DummyMode, string> = { stand: "STANDING", strafe: "STRAFING", crouch: "STRAFE AND CROUCH", random: "RANDOM" };

interface Mover {
  home: THREE.Vector3;
  off: number;
  vel: number;
  until: number;
  crouch: boolean;
  crouchUntil: number;
}

export class DummyBehaviour {
  mode: DummyMode = "stand";
  /** slow 0.6, normal 1, fast 1.4 */
  speed = 1;
  private movers = new Map<Dummy, Mover>();

  constructor(dummies: Dummy[]) {
    // the rail dummies already move; the rest get a home to move about
    for (const d of dummies) if (!d.rail) this.movers.set(d, { home: d.group.position.clone(), off: 0, vel: 0, until: 0, crouch: false, crouchUntil: 0 });
  }

  update(now: number, dt: number): void {
    const top = cfg.dummies.strafeSpeed * this.speed;
    for (const [d, m] of this.movers) {
      if (d.knocked) continue;
      if (this.mode === "stand") {
        m.off -= m.off * Math.min(1, dt * 6);
        m.vel = 0;
        m.crouch = false;
      } else {
        if (now >= m.until || Math.abs(m.off) > cfg.dummies.range) {
          const random = this.mode === "random";
          // back toward home when out at the edge, else the other way, or (random) any
          const dir = Math.abs(m.off) > cfg.dummies.range ? -Math.sign(m.off) : m.vel === 0 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(m.vel);
          m.vel = random && Math.random() < 0.25 ? 0 : dir * top * (random ? 0.5 + Math.random() * 0.5 : 1);
          m.until = now + (random ? 0.15 + Math.random() * 0.7 : cfg.dummies.flipMin + Math.random() * (cfg.dummies.flipMax - cfg.dummies.flipMin));
        }
        if ((this.mode === "crouch" || this.mode === "random") && now >= m.crouchUntil) {
          m.crouch = this.mode === "crouch" ? !m.crouch : Math.random() < 0.35;
          m.crouchUntil = now + (this.mode === "crouch" ? 0.7 + Math.random() * 0.4 : 0.3 + Math.random() * 0.9);
        } else if (this.mode === "strafe") m.crouch = false;
        m.off += m.vel * dt;
      }
      d.group.position.x = m.home.x + m.off;
      d.setPose({ speed: Math.abs(m.vel), stance: m.crouch ? "crouch" : "stand", pitch: 0 });
    }
  }

  /** everyone home, standing */
  reset(): void {
    for (const [d, m] of this.movers) {
      m.off = 0;
      m.vel = 0;
      m.crouch = false;
      d.group.position.x = m.home.x;
      d.setPose({ speed: 0, stance: "stand", pitch: 0 });
    }
  }
}

// ---------------------------------------------------------------- shoot back

export class RangeCombat {
  level: "off" | BotDifficulty = "off";
  shield = 75;
  health = 100;
  readonly shieldMax = 75;
  alive = true;
  private downUntil = 0;
  private seenAt = new Map<Dummy, number>();
  private nextShot = new Map<Dummy, number>();
  private err = new Map<Dummy, { x: number; y: number; at: number }>();
  onHurt: ((amount: number, from: THREE.Vector3) => void) | null = null;
  onDown: (() => void) | null = null;
  onUp: (() => void) | null = null;

  get on(): boolean {
    return this.level !== "off";
  }

  refill(): void {
    this.shield = this.shieldMax;
    this.health = 100;
    this.alive = true;
  }

  private takeHit(amount: number, from: THREE.Vector3, now: number): void {
    if (!this.alive) return;
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health = Math.max(0, this.health - (amount - toShield));
    this.onHurt?.(amount, from);
    if (this.health <= 0) {
      this.alive = false;
      this.downUntil = now + cfg.combat.downSeconds;
      this.onDown?.();
    }
  }

  /** the nearest dummies that can see you fire, with a bot's aim at the level set */
  update(now: number, dummies: Dummy[], feet: THREE.Vector3, projectiles: ProjectileSystem, weapon: ResolvedWeapon): void {
    if (!this.on) return;
    if (!this.alive) {
      if (now >= this.downUntil) {
        this.refill();
        this.onUp?.();
      }
      return;
    }
    const diff = DIFFICULTY[tierFor(this.level as BotDifficulty)];
    const chest = feet.clone().setY(feet.y + 1.2);
    const shooters = dummies
      .filter((d) => d.group.visible && !d.knocked && d.group.position.distanceTo(feet) < cfg.combat.range)
      .map((d) => ({ d, dist: d.group.position.distanceTo(feet) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, cfg.combat.shooters);
    for (const { d } of shooters) {
      const from = d.group.position.clone().setY(d.group.position.y + 1.35);
      const toYou = chest.clone().sub(from);
      const len = toYou.length();
      const sees = solidHit(from, toYou.clone().divideScalar(len), len) >= len;
      if (!sees) {
        this.seenAt.delete(d);
        continue;
      }
      if (!this.seenAt.has(d)) this.seenAt.set(d, now);
      if (now - (this.seenAt.get(d) ?? now) < diff.reaction || now < (this.nextShot.get(d) ?? 0)) continue;
      this.nextShot.set(d, now + weapon.shotInterval / diff.fireScale);
      let e = this.err.get(d);
      // the bots' aim error: wide on a new sighting, settling as the dummy keeps you in view
      const spread = aimError(diff, now - (this.seenAt.get(d) ?? now));
      if (!e || now - e.at > 0.25) this.err.set(d, (e = { x: (Math.random() * 2 - 1) * spread, y: (Math.random() * 2 - 1) * spread, at: now }));
      const dir = toYou.normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (e.x * Math.PI) / 180).applyAxisAngle(side, (e.y * Math.PI) / 180).normalize();
      projectiles.fire(from, dir, weapon, true);
      if (hitsBody(from, dir, feet)) this.takeHit(weapon.damage.near, from, now);
    }
  }
}

// ---------------------------------------------------------------- the spray wall

export const SPRAY = cfg.sprayWall;

/** one shot of a gun's pattern: where it goes, and how far it wanders from one magazine to the next */
export interface SprayPattern {
  pitch: number;
  yaw: number;
  /** degrees the pattern itself moves between magazines, on top of the cone */
  spread: number;
}

export class SprayWall {
  readonly group = new THREE.Group();
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;
  private lastHitAt = -Infinity;
  private refs = new Map<string, SprayPattern[]>();
  /** hits drawn since the last clear (tests) */
  marks = 0;
  /**
   * Every mark since the last clear, in board coordinates, with the reference
   * pattern the board drew beside them (tools/e2e.ts). The wall's whole job is
   * to show where a magazine goes against where the gun would send it, and
   * that is a claim about two sets of numbers: nothing else in the game can
   * check that what it draws is where the rounds actually went.
   */
  shown: { hits: Array<{ u: number; v: number }>; want: Array<{ u: number; v: number }>; cone: number; band: number[] } = { hits: [], want: [], cone: 0, band: [] };

  constructor(scene: THREE.Scene) {
    const W = SPRAY.width;
    const H = SPRAY.height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = Math.round((640 * H) / W);
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    // on the right-hand wall, facing -x: its left edge (canvas x = 0) is at -z, your left as you face it
    board.rotation.y = -Math.PI / 2;
    board.position.set(SPRAY.x - 0.02, SPRAY.y, SPRAY.z);
    this.group.add(board);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd23c }));
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = Math.PI / 2;
    mark.position.set(SPRAY.x - SPRAY.distance, 0.015, SPRAY.z);
    this.group.add(mark);
    scene.add(this.group);
    this.clear();
  }

  /** the board's canvas coordinates (0..1) for a point on the wall, or null off it */
  private uv(p: THREE.Vector3): { u: number; v: number } | null {
    if (Math.abs(p.x - SPRAY.x) > 0.3) return null;
    const u = (p.z - (SPRAY.z - SPRAY.width / 2)) / SPRAY.width;
    const v = 1 - (p.y - (SPRAY.y - SPRAY.height / 2)) / SPRAY.height;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
  }

  clear(): void {
    const c = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.fillStyle = "#1b1f24";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.08)";
    c.lineWidth = 1;
    // a grid, a line every 25 cm
    for (let i = 1; i < SPRAY.width * 4; i++) {
      c.beginPath();
      c.moveTo((i / (SPRAY.width * 4)) * w, 0);
      c.lineTo((i / (SPRAY.width * 4)) * w, h);
      c.stroke();
    }
    for (let i = 1; i < SPRAY.height * 4; i++) {
      c.beginPath();
      c.moveTo(0, (i / (SPRAY.height * 4)) * h);
      c.lineTo(w, (i / (SPRAY.height * 4)) * h);
      c.stroke();
    }
    c.fillStyle = "#9aa4ad";
    c.font = "bold 18px Segoe UI, sans-serif";
    c.fillText("SPRAY WALL  ·  20 m from the yellow mark  ·  white: your hits  ·  gold: the gun with no compensation, its rings the spread  ·  Y clears", 12, 24);
    this.tex.needsUpdate = true;
    this.marks = 0;
    this.shown = { hits: [], want: [], cone: 0, band: [] };
  }

  /**
   * Where the gun sends a magazine if you do not pull against it: its rounds'
   * angles from the first, from a WeaponState held on the trigger (aimed in)
   * for a whole magazine. Cached per gun as fitted.
   */
  reference(w: ResolvedWeapon, ads = true): SprayPattern[] {
    const key = `${w.id}|${w.magLevel}|${w.clipSize}|${w.shotInterval}|${ads ? "ads" : "hip"}`;
    const hit = this.refs.get(key);
    if (hit) return hit;
    // The gun fired a dozen times over, each with its own dice. A single run
    // would be one of the patterns the gun can draw rather than the pattern it
    // draws, and standing at the mark you would be asked to land your rounds
    // on somebody else's dice. So: the average of the runs is the path, and
    // how far they wandered from it is the width of the band round it.
    const RUNS = 12;
    const runs: Array<Array<{ pitch: number; yaw: number }>> = [];
    for (let run = 0; run < RUNS; run++) {
      const st = new WeaponState(w);
      const out: Array<{ pitch: number; yaw: number }> = [];
      let perm = { p: 0, y: 0 };
      let t = 50;
      const dt = 1 / 144;
      // aim in first, then hold
      for (let i = 0; i < 90; i++) st.update(dt, (t += dt), false, ads, "stand", "still", false, false, () => 0.5);
      let r = 0.37 + run * 0.061;
      const rnd = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
      for (let i = 0; i < 144 * 12 && out.length < w.clipSize; i++) {
        for (const s of st.update(dt, (t += dt), true, ads, "stand", "still", false, false, rnd)) {
          out.push({ pitch: perm.p + s.kick.preSoftPitchUp, yaw: perm.y + s.kick.preSoftYawLeft });
          perm = { p: perm.p + s.kick.permPitchUp, y: perm.y + s.kick.permYawLeft };
        }
      }
      runs.push(out);
    }
    const shots = Math.min(...runs.map((r) => r.length));
    const band: SprayPattern[] = [];
    for (let i = 0; i < shots; i++) {
      const pitch = runs.reduce((a, r) => a + r[i].pitch, 0) / RUNS;
      const yaw = runs.reduce((a, r) => a + r[i].yaw, 0) / RUNS;
      const spread = Math.max(...runs.map((r) => Math.hypot(r[i].pitch - pitch, r[i].yaw - yaw)));
      band.push({ pitch, yaw, spread });
    }
    this.refs.set(key, band);
    return band;
  }

  /**
   * A round landed at `p`: on the board, a mark; the first of a string (none
   * for 1.2 s) also draws the gun's own pattern from there. `dist` is how far
   * the shot flew.
   */
  /**
   * A round into the board. `ads` is whether you were aiming when it left,
   * because the pattern the board draws beside your marks has to be the
   * pattern of the way you are actually firing: drawn aimed while you spray
   * from the hip, the line is a line your rounds can never follow, and
   * standing at the mark trying to learn the gun you would conclude the gun
   * was lying to you. Which is what the owner saw.
   */
  hit(p: THREE.Vector3, w: ResolvedWeapon, now: number, dist: number, ads = true): boolean {
    const at = this.uv(p);
    if (!at) return false;
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (now - this.lastHitAt > SPRAY.stringGap) {
      // the pattern from this first hit: an angle is dist * tan(angle) metres on the wall
      const pxPerM = W / SPRAY.width;
      // and how far a round can be off that path: the gun's own cone, plus
      // how far the pattern itself wanders from one magazine to the next. A
      // dot you are asked to land on is a promise the gun cannot keep; a band
      // you are asked to stay inside is one it can.
      const cone = ads ? w.spread.standAds : w.spread.standHip;
      const conePx = Math.tan(((cone / 2) * Math.PI) / 180) * dist * pxPerM;
      this.shown.cone = conePx / W;
      c.fillStyle = "rgba(255,210,60,0.85)";
      let prev: { x: number; y: number } | null = null;
      this.shown = { hits: [], want: [], cone: this.shown.cone, band: [] };
      for (const r of this.reference(w)) {
        const x = at.u * W - Math.tan((r.yaw * Math.PI) / 180) * dist * pxPerM;
        const y = at.v * H - Math.tan((r.pitch * Math.PI) / 180) * dist * pxPerM;
        this.shown.want.push({ u: x / W, v: y / H });
        if (prev) {
          c.strokeStyle = "rgba(255,210,60,0.35)";
          c.beginPath();
          c.moveTo(prev.x, prev.y);
          c.lineTo(x, y);
          c.stroke();
        }
        const bandPx = conePx + Math.tan(((r.spread * Math.PI) / 180)) * dist * pxPerM;
        if (bandPx > 2) {
          // an outline rather than a fill: twenty filled circles over each
          // other are a smear, and what is wanted is the edge of the corridor
          c.strokeStyle = "rgba(255,210,60,0.13)";
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(x, y, bandPx, 0, Math.PI * 2);
          c.stroke();
        }
        this.shown.band.push(bandPx / W);
        c.fillStyle = "rgba(255,210,60,0.85)";
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fill();
        prev = { x, y };
      }
    }
    this.lastHitAt = now;
    this.shown.hits.push({ u: at.u, v: at.v });
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(at.u * W, at.v * H, 4, 0, Math.PI * 2);
    c.fill();
    this.tex.needsUpdate = true;
    this.marks++;
    return true;
  }
}

// ---------------------------------------------------------------- the flick drill

export interface DrillHud {
  state: "countdown" | "running" | "done";
  left: number;
  done: number;
  total: number;
  time: number;
  shots: number;
  hits: number;
  best: number | null;
  newBest: boolean;
}

const LS_DRILL = "range.drill.blink";

export class FlickDrill {
  state: "idle" | "countdown" | "running" | "done" = "idle";
  readonly target: Dummy;
  readonly total = cfg.drill.targets;
  private startAt = 0;
  private endAt = 0;
  private doneAt = 0;
  done = 0;
  shots = 0;
  hits = 0;
  best: number | null = null;
  private newBest = false;
  onFinish: ((time: number, accuracy: number) => void) | null = null;

  constructor(scene: THREE.Scene, projectiles: ProjectileSystem) {
    this.target = new Dummy(cfg.drill.padX, cfg.drill.padZ - 10, 0, { oneHit: true, respawn: false });
    this.target.group.name = "drill:target";
    this.target.hide();
    scene.add(this.target.group);
    projectiles.addDummy(this.target);
    try {
      const b = Number(localStorage.getItem(LS_DRILL));
      if (Number.isFinite(b) && b > 0) this.best = b;
    } catch {
      /* ignore */
    }
    // the pad you start it from
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cfg.drill.padX, 0.016, cfg.drill.padZ);
    scene.add(pad);
  }

  /** standing on the pad, the drill not running: the prompt shows */
  onPad(p: THREE.Vector3): boolean {
    return Math.hypot(p.x - cfg.drill.padX, p.z - cfg.drill.padZ) < 0.9 && p.y < 0.3;
  }

  start(now: number): void {
    this.state = "countdown";
    this.startAt = now + 3;
    this.done = 0;
    this.shots = 0;
    this.hits = 0;
    this.newBest = false;
    this.target.hide();
  }

  stop(): void {
    this.state = "idle";
    this.target.hide();
  }

  /** the clock waits (the menu is open): every time it keeps moves on by `dt` */
  hold(dt: number): void {
    if (this.state === "idle") return;
    this.startAt += dt;
    this.endAt += dt;
    this.doneAt += dt;
  }

  /** the next figure: a random spot in a 60 degree cone ahead of the pad, 5 to 30 m out */
  private next(): void {
    const a = ((Math.random() * 2 - 1) * cfg.drill.coneDeg * 0.5 * Math.PI) / 180;
    const d = cfg.drill.minDist + Math.random() * (cfg.drill.maxDist - cfg.drill.minDist);
    const x = Math.max(-30, Math.min(30, cfg.drill.padX + Math.sin(a) * d));
    const z = cfg.drill.padZ - Math.cos(a) * d;
    this.target.group.position.set(x, 0, z);
    this.target.group.rotation.y = 0;
    this.target.popUp();
  }

  /** your shots while it runs (per pellet, as the range's accuracy counts) */
  onShot(n: number): void {
    if (this.state === "running") this.shots += n;
  }

  /** a hit on the drill's figure: the next comes at once; the last stops the clock */
  onHit(d: Dummy, now: number): boolean {
    if (d !== this.target || this.state !== "running") return false;
    this.hits++;
    this.done++;
    if (this.done >= this.total) {
      this.state = "done";
      this.endAt = now;
      this.doneAt = now;
      const time = this.endAt - this.startAt;
      if (this.best === null || time < this.best) {
        this.best = time;
        this.newBest = true;
        try {
          localStorage.setItem(LS_DRILL, String(time));
        } catch {
          /* ignore */
        }
      }
      this.target.hide();
      this.onFinish?.(time, this.shots ? this.hits / this.shots : 0);
    } else this.next();
    return true;
  }

  update(now: number): void {
    if (this.state === "countdown" && now >= this.startAt) {
      this.state = "running";
      this.next();
    }
    if (this.state === "done" && now - this.doneAt > 8) this.state = "idle";
  }

  hud(now: number): DrillHud | null {
    if (this.state === "idle") return null;
    return {
      state: this.state,
      left: Math.max(0, this.startAt - now),
      done: this.done,
      total: this.total,
      time: this.state === "running" ? now - this.startAt : this.state === "done" ? this.endAt - this.startAt : 0,
      shots: this.shots,
      hits: this.hits,
      best: this.best,
      newBest: this.newBest,
    };
  }
}
