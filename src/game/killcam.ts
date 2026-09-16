// The killcam: the last seconds before you were eliminated, replayed from the
// eyes of whoever did it.
//
// A Recorder runs through every match, 30 times a second: where every figure
// was (you included), which way it faced and looked, its stance, speed, gun
// and skin, and every round anyone fired. It keeps the last 8 s.
//
// On an elimination the Killcam plays that recording back 4 s behind real
// time (so it can show the second after the kill as well): ghost figures in
// the scene posed from it, the live ones hidden for the frame, the camera at
// the killer's eye following their aim, their rounds fired again as tracers
// when the replay reaches them. It plays the 4 s before the kill and 1 s
// after; a key, or the next round's fight, ends it.
import * as THREE from "three";
import { Dummy, type FigureStance } from "./dummy";
import { operatorById } from "./operators";
import { resolveWeapon, type ResolvedWeapon } from "./weapons";
import type { ProjectileSystem } from "./projectile";
import cfg from "../config/killcam.json";

/** one figure at one moment */
export interface ActorState {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  /** degrees, the player convention: 0 looks down -z, positive turns left */
  yaw: number;
  /** degrees, up positive */
  pitch: number;
  stance: FigureStance;
  speed: number;
  weapon: string;
  op: string;
  alive: boolean;
  /** how far into the sights, 0..1: the killcam holds the gun as they held it */
  ads?: number;
}

interface Frame {
  t: number;
  actors: ActorState[];
}

interface ShotEvent {
  t: number;
  id: number;
  o: THREE.Vector3;
  d: THREE.Vector3;
  weapon: string;
}

export const KILLCAM = cfg;

export class Recorder {
  frames: Frame[] = [];
  shots: ShotEvent[] = [];
  private nextAt = 0;

  /** a frame, if one is due (30 a second) */
  sample(t: number, actors: () => ActorState[]): void {
    if (t < this.nextAt) return;
    this.nextAt = t + 1 / cfg.recordHz;
    this.frames.push({ t, actors: actors() });
    this.trim(t);
  }

  shot(t: number, id: number, o: THREE.Vector3, d: THREE.Vector3, weapon: string): void {
    this.shots.push({ t, id, o: o.clone(), d: d.clone(), weapon });
    this.trim(t);
  }

  private trim(t: number): void {
    const keep = t - cfg.keepSeconds;
    while (this.frames.length && this.frames[0].t < keep) this.frames.shift();
    while (this.shots.length && this.shots[0].t < keep) this.shots.shift();
  }

  clear(): void {
    this.frames = [];
    this.shots = [];
    this.nextAt = 0;
  }

  /** seconds held (tests) */
  get span(): number {
    return this.frames.length ? this.frames[this.frames.length - 1].t - this.frames[0].t : 0;
  }

  /** has this id been seen in the last `seconds` before `t` */
  saw(id: number, t: number, seconds: number): boolean {
    return this.frames.some((f) => f.t >= t - seconds && f.actors.some((a) => a.id === id));
  }
}

const DEG = Math.PI / 180;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  d = ((((d + 180) % 360) + 360) % 360) - 180;
  return a + d * k;
};

/** the eye above the feet for a stance (near enough for a camera) */
const eyeHeight = (st: FigureStance): number => (st === "crouch" || st === "slide" ? 1.05 : 1.6);

export class Killcam {
  active = false;
  /** who, with what, for the HUD */
  killerName = "";
  killerWeapon = "";
  killerId = -1;
  private rec: Recorder | null = null;
  private startT = 0;
  private endT = 0;
  /** replay time = real time minus this */
  private lag = 0;
  /** shots up to this time have been re-fired */
  private firedTo = 0;
  /** replay time now */
  t = 0;
  private ghosts = new Map<number, Dummy>();
  private ghostKey = new Map<number, string>();
  private weapons = new Map<string, ResolvedWeapon>();
  /** the killer fired this frame: the gun in view kicks */
  firedThisFrame = false;

  constructor(
    private scene: THREE.Scene,
    private projectiles: ProjectileSystem
  ) {}

  /**
   * Start on an elimination at time `killT` (the recorder's clock) by
   * `killerId`. Returns false when there is nothing to show (the ring, or no
   * recording of them).
   */
  start(rec: Recorder, killT: number, killerId: number, killerName: string): boolean {
    this.stop();
    if (killerId < 0 || !rec.saw(killerId, killT, cfg.before + 0.5)) return false;
    this.rec = rec;
    const first = rec.frames[0]?.t ?? killT;
    this.startT = Math.max(first, killT - cfg.before);
    this.endT = killT + cfg.after;
    this.lag = killT - this.startT;
    this.t = this.startT;
    this.firedTo = this.startT;
    this.killerId = killerId;
    this.killerName = killerName;
    this.killerWeapon = this.actorAt(this.startT, killerId)?.weapon ?? "";
    this.active = true;
    return true;
  }

  /** how far through, 0..1 */
  get progress(): number {
    return this.active ? Math.max(0, Math.min(1, (this.t - this.startT) / Math.max(1e-3, this.endT - this.startT))) : 0;
  }

  /** seconds left */
  get left(): number {
    return this.active ? Math.max(0, this.endT - this.t) : 0;
  }

  /** an actor's state at time t, interpolated between the frames around it */
  private actorAt(t: number, id: number): ActorState | null {
    const f = this.rec?.frames ?? [];
    if (!f.length) return null;
    let i = 0;
    while (i < f.length - 1 && f[i + 1].t <= t) i++;
    const a = f[i].actors.find((x) => x.id === id);
    const nb = f[Math.min(f.length - 1, i + 1)];
    const b = nb.actors.find((x) => x.id === id) ?? a;
    if (!a || !b) return a ?? b ?? null;
    const span = nb.t - f[i].t;
    const k = span > 1e-6 ? Math.max(0, Math.min(1, (t - f[i].t) / span)) : 0;
    return {
      ...a,
      x: lerp(a.x, b.x, k),
      y: lerp(a.y, b.y, k),
      z: lerp(a.z, b.z, k),
      yaw: lerpAngle(a.yaw, b.yaw, k),
      pitch: lerp(a.pitch, b.pitch, k),
      speed: lerp(a.speed, b.speed, k),
      ads: lerp(a.ads ?? 0, b.ads ?? 0, k),
      stance: k < 0.5 ? a.stance : b.stance,
      alive: k < 0.5 ? a.alive : b.alive,
    };
  }

  private weapon(id: string): ResolvedWeapon {
    let w = this.weapons.get(id);
    if (!w) {
      try {
        w = resolveWeapon(id, 0);
      } catch {
        w = resolveWeapon("rspn101", 0);
      }
      this.weapons.set(id, w);
    }
    return w;
  }

  /** a ghost for this actor, rebuilt when its gun or skin changes */
  private ghost(a: ActorState): Dummy {
    const key = `${a.weapon}|${a.op}`;
    let g = this.ghosts.get(a.id);
    if (!g || this.ghostKey.get(a.id) !== key) {
      g?.dispose();
      g = new Dummy(0, 0, 0, { armed: a.weapon || undefined, respawn: false, skin: operatorById(a.op), rig: true, noBase: true });
      g.group.name = `killcam:${a.id}`;
      this.scene.add(g.group);
      this.ghosts.set(a.id, g);
      this.ghostKey.set(a.id, key);
    }
    return g;
  }

  /**
   * One frame of the replay: advance, pose the ghosts, re-fire the rounds now
   * due. Returns false once it has run out.
   */
  update(realNow: number, dt: number): boolean {
    if (!this.active || !this.rec) return false;
    this.t = realNow - this.lag;
    if (this.t >= this.endT) {
      this.stop();
      return false;
    }
    const ids = new Set<number>();
    for (const f of this.rec.frames) if (f.t >= this.startT - 0.2 && f.t <= this.endT + 0.2) for (const a of f.actors) ids.add(a.id);
    for (const id of ids) {
      const a = this.actorAt(this.t, id);
      if (!a) continue;
      const g = this.ghost(a);
      g.group.visible = true;
      g.group.position.set(a.x, a.y, a.z);
      if (!a.alive) g.fallDown();
      else if (g.knocked) g.reset();
      if (!g.knocked) g.group.rotation.y = a.yaw * DEG + Math.PI;
      g.setPose({ speed: a.speed, stance: a.stance, pitch: a.pitch, ads: a.ads ?? 0 });
      g.update(this.t, dt);
      // the killer's own figure would sit on the camera
      if (id === this.killerId) g.group.visible = false;
    }
    this.firedThisFrame = false;
    for (const s of this.rec.shots) {
      if (s.t <= this.firedTo || s.t > this.t) continue;
      this.projectiles.fire(s.o.clone(), s.d.clone(), this.weapon(s.weapon), true);
      if (s.id === this.killerId) this.firedThisFrame = true;
    }
    this.firedTo = this.t;
    return true;
  }

  /** how far into the sights the killer was, this frame of the replay (0..1) */
  killerAds = 0;

  /** the camera: at the killer's eye, looking where they looked */
  pose(camera: THREE.PerspectiveCamera): void {
    const k = this.actorAt(this.t, this.killerId);
    if (!k) return;
    camera.position.set(k.x, k.y + eyeHeight(k.stance), k.z);
    camera.quaternion.setFromEuler(new THREE.Euler(k.pitch * DEG, k.yaw * DEG, 0, "YXZ"));
    this.killerWeapon = k.weapon;
    this.killerAds = k.ads ?? 0;
  }

  /** the ghosts, to hide the live figures behind them for the frame */
  get ghostCount(): number {
    return this.ghosts.size;
  }

  stop(): void {
    this.active = false;
    for (const g of this.ghosts.values()) g.dispose();
    this.ghosts.clear();
    this.ghostKey.clear();
    this.rec = null;
  }
}
