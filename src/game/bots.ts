// Arena, Bots: the 1v1 rules against one or two bots, offline.
//
// A bot is a Dummy figure with a weapon and a small mind: it walks toward the
// middle of the arena until it sees you, then toward you, strafing, keeping a
// few metres back, and fires its weapon at you with an aim error that depends
// on the difficulty. It cannot jump, climb or slide: it walks up steps and
// off edges, and walls it meets it slides along. Its bullets are tracers with
// a hit test against your body; yours hit it like any dummy. When the circle
// is live and it has no target it goes and stands in the circle.
//
// The rounds are the 1v1's: countdown, fight, last standing or the circle,
// first to 3. Two bots do not shoot each other: they are both after you.
import * as THREE from "three";
import { Dummy } from "./dummy";
import { RANGE_SOLIDS } from "./range";
import { solidHit, type ProjectileSystem } from "./projectile";
import { resolveWeapon, type ResolvedWeapon } from "./weapons";
import { OPERATORS } from "./operators";
import { ARENA_BOT_SPAWNS, ARENA_CENTER, ARENA_SPAWNS, ZONE_RADIUS } from "./arena";
import { HU, MOVE } from "./movement";
import type { RoundPhase } from "../net/link";
import type { MatchSummary, BotDifficulty } from "./stats";
import { ABILITY_IDS, BOT_ABILITY, JOLT, TRIAGE, type AbilityId } from "./abilities";
import type { ActorState } from "./killcam";
import items from "../config/items.json";
import { HEALTH_MAX, ROUNDS_TO_WIN, SHIELD_MAX, ZONE_CAPTURE, ZONE_DELAY, type DuelHud, type LocalState, type MatchLike, type Remote, type Spawn } from "./duel";

const COUNTDOWN = 3;
const ROUND_END = 3;
const MATCH_END = 7;
const wallClock = (): number => performance.now() / 1000;

interface Difficulty {
  /** m/s on foot */
  speed: number;
  /** seconds from seeing you to the first shot */
  reaction: number;
  /** aim error, degrees, half cone */
  spread: number;
  /** how much of the weapon's fire rate it uses */
  fireScale: number;
  /** how close it tries to get, m */
  keep: number;
}
export const DIFFICULTY: Record<BotDifficulty, Difficulty> = {
  easy: { speed: 4.2, reaction: 0.9, spread: 6, fireScale: 0.45, keep: 8 },
  normal: { speed: 5.4, reaction: 0.5, spread: 3.2, fireScale: 0.7, keep: 6 },
  hard: { speed: 6.6, reaction: 0.22, spread: 1.6, fireScale: 1.0, keep: 5 },
};
/** what bots carry, one per bot in order */
export const BOT_WEAPONS = ["rspn101", "r97", "vinson", "wingman", "hemlok", "energy_ar", "lmg", "energy_shotgun", "volt_smg", "car", "g2", "sentinel"];
export const BOT_NAMES = ["BOT ASH", "BOT VOLT", "BOT GRIM", "BOT NOVA", "BOT FLUX", "BOT STEEL", "BOT NEON", "BOT SOLAR", "BOT RAPID", "BOT SWIFT", "BOT ONYX", "BOT DUNE"];
const RADIUS = MOVE.radius;
/** a bot healing walks at this fraction of its speed (ours) */
const HEAL_WALK = 0.45;
/** a drop from the sky: terminal speed, m/s */
export const DROP_SPEED = 22;

/** what a bot knows this frame; the match works it out from its own rules */
export interface BotSense {
  /** the nearest enemy it can see, feet position, or null */
  target: THREE.Vector3 | null;
  /** who that is, for the credit and the feed */
  targetId: number;
  /** where to walk with no target in sight (null: stay) */
  goal: THREE.Vector3 | null;
  canShoot: boolean;
}

/** a shot a bot fired that may have hit an enemy: for the match to apply */
export interface BotShot {
  from: THREE.Vector3;
  dir: THREE.Vector3;
  damage: number;
  /** its gun, for the recap and the killcam */
  weapon: string;
}

export class Bot {
  readonly dummy: Dummy;
  readonly remote: Remote;
  readonly weapon: ResolvedWeapon;
  pos = new THREE.Vector3();
  yaw = 0;
  /** falling in from the sky at the start of a battle royale */
  dropping = false;
  private seenAt = -Infinity;
  private sawLast = false;
  private nextShotAt = 0;
  private slideDir = 0;
  private slideUntil = 0;
  private strafePhase = Math.random() * 10;
  private aimErr = new THREE.Vector2();
  private nextErrAt = 0;
  /** JOLT or TRIAGE when the match has abilities on (abilities.ts) */
  ability: AbilityId | null = null;
  private joltLeft = 0;
  private joltReadyAt = 0;
  private readonly joltDir = new THREE.Vector2();
  private readonly joltFrom = new THREE.Vector3();
  /** the last time its shield or health went down, and what they were */
  private lastHurtAt = -Infinity;
  private prevVital = 0;
  /** the last time it had someone in its sights */
  private lastTargetAt = -Infinity;
  /** a heal in progress: bots heal when they have had nobody to shoot for a while */
  healing: { item: "cell" | "syringe"; startedAt: number } | null = null;
  private kit = { cell: items.bots.cell, syringe: items.bots.syringe };
  /** a JOLT went from a to b: the match draws it (and sends it) */
  onJolt: ((a: THREE.Vector3, b: THREE.Vector3) => void) | null = null;
  /** a heal finished, for the death recap */
  onHealed: ((item: "cell" | "syringe") => void) | null = null;

  constructor(
    readonly index: number,
    scene: THREE.Scene,
    private projectiles: ProjectileSystem,
    private diff: Difficulty,
    readonly spawn: Spawn,
    /** the remote id (1 and 2 in the arena; 100 up in a battle royale) */
    id = index + 1,
    weaponId?: string,
    name?: string
  ) {
    const wid = weaponId ?? BOT_WEAPONS[index % BOT_WEAPONS.length];
    this.weapon = resolveWeapon(wid, 2);
    const skin = OPERATORS[(index + 1) % OPERATORS.length];
    this.dummy = new Dummy(spawn.x, spawn.z, 0, { armed: wid, respawn: false, skin, rig: true, noBase: true });
    this.dummy.setTier(2);
    this.dummy.group.name = `bot:${index}`;
    scene.add(this.dummy.group);
    projectiles.addDummy(this.dummy);
    this.remote = {
      id,
      name: name ?? BOT_NAMES[index % BOT_NAMES.length],
      avatar: this.dummy,
      avatarWeapon: wid,
      avatarOp: skin.id,
      avatars: new Map([[`${wid}|${skin.id}`, this.dummy]]),
      samples: [],
      health: HEALTH_MAX,
      shield: SHIELD_MAX,
      shieldMax: SHIELD_MAX,
      alive: true,
      ready: true,
      lastHeard: 0,
      link: { role: "guest", send: () => undefined, close: () => undefined, onMessage: null, onClose: null },
    };
    this.reset();
  }

  reset(): void {
    this.dummy.reset();
    this.dummy.setTier(2);
    this.dummy.setThreat(0);
    this.remote.health = HEALTH_MAX;
    this.remote.shield = SHIELD_MAX;
    this.remote.alive = true;
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.yaw = this.spawn.yaw;
    this.dummy.group.position.copy(this.pos);
    this.dummy.group.rotation.set(0, this.yaw * (Math.PI / 180) + Math.PI, 0);
    this.seenAt = -Infinity;
    this.sawLast = false;
    this.dropping = false;
    this.joltLeft = 0;
    this.joltReadyAt = 0;
    this.lastHurtAt = -Infinity;
    this.lastTargetAt = -Infinity;
    this.healing = null;
    this.kit = { cell: items.bots.cell, syringe: items.bots.syringe };
    this.prevVital = this.dummy.health + this.dummy.shield;
  }

  /** a random ability when the match has them on; none otherwise */
  setAbilities(on: boolean, rng: () => number = Math.random): void {
    this.ability = on ? ABILITY_IDS[Math.floor(rng() * ABILITY_IDS.length)] : null;
  }

  /** the heal it is doing, if its time is up: applied; a target in sight cancels it */
  private stepHeal(now: number, hasTarget: boolean): void {
    const d = this.dummy;
    if (hasTarget) {
      this.healing = null;
      return;
    }
    const scale = this.ability === "triage" ? TRIAGE.healSpeed : 1;
    if (this.healing) {
      const it = items.heals[this.healing.item];
      if (now - this.healing.startedAt >= it.time / scale) {
        d.shield = Math.min(d.shieldMax, d.shield + it.shield);
        d.health = Math.min(HEALTH_MAX, d.health + it.health);
        this.kit[this.healing.item]--;
        this.onHealed?.(this.healing.item);
        this.healing = null;
        this.prevVital = d.health + d.shield;
      }
      return;
    }
    if (now - this.lastTargetAt < BOT_ABILITY.healAfter) return;
    if (d.shield < d.shieldMax && this.kit.cell > 0) this.healing = { item: "cell", startedAt: now };
    else if (d.health < HEALTH_MAX && this.kit.syringe > 0) this.healing = { item: "syringe", startedAt: now };
  }

  /** a JOLT in progress: across its line of fire at the dash speed, stopped by walls */
  private stepJolt(dt: number): void {
    const use = Math.min(dt, this.joltLeft);
    let left = (JOLT.distance / JOLT.duration) * use;
    // in steps no longer than a quarter metre, so a thin wall stops it
    while (left > 1e-6) {
      const step = Math.min(0.25, left);
      left -= step;
      const nx = this.pos.x + this.joltDir.x * step;
      const nz = this.pos.z + this.joltDir.y * step;
      if (this.blocked(nx, nz)) break;
      this.pos.x = nx;
      this.pos.z = nz;
      this.pos.y = this.groundAt(this.pos.x, this.pos.z);
    }
    this.joltLeft -= dt;
    if (this.joltLeft <= 0) {
      this.joltLeft = 0;
      this.onJolt?.(this.joltFrom.clone(), this.pos.clone());
    }
  }

  /** start `height` metres up and fall in at the drop speed; no shooting until it lands */
  dropFrom(height: number): void {
    this.pos.y = height;
    this.dropping = true;
    this.dummy.group.position.copy(this.pos);
  }

  get alive(): boolean {
    return !this.dummy.knocked;
  }

  /** its feet, for the others' aim and the ring */
  get feet(): THREE.Vector3 {
    return this.pos;
  }

  /** the ground under the feet, stepping up onto anything within reach */
  private groundAt(x: number, z: number): number {
    let best = 0;
    for (const s of RANGE_SOLIDS) {
      if (x + RADIUS > s.minX && x - RADIUS < s.maxX && z + RADIUS > s.minZ && z - RADIUS < s.maxZ) {
        if (s.top <= this.pos.y + MOVE.stepHeight + 1e-4 && s.top > best) best = s.top;
      }
    }
    return best;
  }

  /** would the body overlap a wall at this spot */
  private blocked(x: number, z: number): boolean {
    for (const s of RANGE_SOLIDS) {
      if (x + RADIUS > s.minX && x - RADIUS < s.maxX && z + RADIUS > s.minZ && z - RADIUS < s.maxZ) {
        if (s.top > this.pos.y + MOVE.stepHeight + 1e-4 && s.base < this.pos.y + MOVE.standHeight - 1e-4) return true;
      }
    }
    return false;
  }

  /** can it see this spot (someone's feet): within 60 m, nothing solid between chest heights */
  sees(target: THREE.Vector3): boolean {
    const from = this.pos.clone().setY(this.pos.y + 1.4);
    const to = target.clone().setY(target.y + 1.2);
    const d = to.clone().sub(from);
    const len = d.length();
    if (len > 60) return false;
    return solidHit(from, d.divideScalar(len), len) >= len;
  }

  /**
   * One frame: move, look, shoot at what the match says it senses. Returns
   * the shots it fired this frame, for the match to test against whoever it
   * was shooting at.
   */
  update(now: number, dt: number, sense: BotSense): BotShot[] {
    if (!this.alive) {
      this.dummy.update(now, dt);
      return [];
    }
    if (this.dropping) {
      // straight down at the drop speed until the ground, or a roof, is under the feet
      this.pos.y -= DROP_SPEED * dt;
      const ground = this.groundAt(this.pos.x, this.pos.z);
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        this.dropping = false;
      }
      this.dummy.group.position.copy(this.pos);
      this.dummy.setPose({ speed: 0, stance: "air", pitch: -30 });
      this.dummy.update(now, dt);
      return [];
    }
    const target = sense.target;
    const sees = target !== null;
    if (sees && !this.sawLast) this.seenAt = now;
    this.sawLast = sees;
    if (sees) this.lastTargetAt = now;
    // hurt this frame (any source: bullets, the ring): a JOLT bot dodges
    const vital = this.dummy.health + this.dummy.shield;
    if (vital < this.prevVital - 1e-6) this.lastHurtAt = now;
    this.prevVital = vital;
    this.stepHeal(now, sees);
    if (this.ability === "jolt" && this.joltLeft <= 0 && target && now >= this.joltReadyAt && now - this.lastHurtAt < BOT_ABILITY.joltWhenHitWithin) {
      const tx = target.x - this.pos.x;
      const tz = target.z - this.pos.z;
      const tl = Math.hypot(tx, tz) || 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.joltDir.set((-tz / tl) * side, (tx / tl) * side);
      this.joltLeft = JOLT.duration;
      this.joltReadyAt = now + JOLT.cooldown;
      this.joltFrom.copy(this.pos);
    }

    // where to go: at the target if seen (keeping a distance), else the goal
    const goal = target ?? sense.goal;
    const toGoal = goal ? new THREE.Vector2(goal.x - this.pos.x, goal.z - this.pos.z) : new THREE.Vector2();
    const dist = toGoal.length();
    let want = new THREE.Vector2();
    if (dist > 1e-3) want.copy(toGoal).divideScalar(dist);
    if (sees) {
      // strafe across the line of sight, hold the distance
      const side = new THREE.Vector2(-want.y, want.x);
      const strafe = Math.sin(now * 1.7 + this.strafePhase);
      const advance = dist > this.diff.keep + 1 ? 1 : dist < this.diff.keep - 1 ? -0.6 : 0;
      want = want.multiplyScalar(advance).addScaledVector(side, strafe * 0.9);
      if (want.length() > 1e-3) want.normalize();
    } else if (dist < 1.5) want.set(0, 0);
    if (this.joltLeft > 0) {
      this.stepJolt(dt);
      want.set(0, 0);
    }
    // a wall in the way: slide along it, and remember which way for a moment
    if (want.length() > 1e-3) {
      const step = this.diff.speed * dt * (this.healing ? HEAL_WALK : 1);
      let nx = this.pos.x + want.x * step;
      let nz = this.pos.z + want.y * step;
      if (this.blocked(nx, nz)) {
        if (now > this.slideUntil) {
          this.slideDir = Math.random() < 0.5 ? 1 : -1;
          this.slideUntil = now + 0.6;
        }
        const along = new THREE.Vector2(-want.y * this.slideDir, want.x * this.slideDir);
        nx = this.pos.x + along.x * step;
        nz = this.pos.z + along.y * step;
        if (this.blocked(nx, nz)) {
          this.slideDir = -this.slideDir;
          nx = this.pos.x - along.x * step;
          nz = this.pos.z - along.y * step;
        }
      }
      if (!this.blocked(nx, nz)) {
        this.pos.x = nx;
        this.pos.z = nz;
      }
      this.pos.y = this.groundAt(this.pos.x, this.pos.z);
    }
    // face the target when seen, else the way it walks
    const faceX = target ? target.x - this.pos.x : want.x;
    const faceZ = target ? target.z - this.pos.z : want.y;
    if (Math.abs(faceX) + Math.abs(faceZ) > 1e-3) {
      const wantYaw = Math.atan2(faceX, faceZ);
      const cur = this.dummy.group.rotation.y;
      let diff = wantYaw - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.dummy.group.rotation.y = cur + diff * Math.min(1, dt * 10);
    }
    this.dummy.group.position.copy(this.pos);
    // the figure runs when it moves and looks at what it aims at
    const moving = want.length() > 1e-3;
    const aimPitch = target ? (Math.atan2(target.y + 1.15 - (this.pos.y + 1.35), Math.max(1e-3, Math.hypot(target.x - this.pos.x, target.z - this.pos.z))) * 180) / Math.PI : 0;
    this.dummy.setPose({ speed: moving ? this.diff.speed * (this.healing ? HEAL_WALK : 1) : 0, stance: "stand", pitch: aimPitch });
    this.dummy.update(now, dt);

    // shooting: after the reaction time, at the weapon's rate, with an aim
    // error that wanders every quarter second
    const shots: BotShot[] = [];
    if (target && sense.canShoot && !this.healing && now - this.seenAt >= this.diff.reaction && now >= this.nextShotAt) {
      const interval = Math.max(this.weapon.shotInterval, this.weapon.semiAuto ? 0.25 : 0) / this.diff.fireScale;
      this.nextShotAt = now + interval;
      if (now >= this.nextErrAt) {
        this.nextErrAt = now + 0.25;
        this.aimErr.set((Math.random() * 2 - 1) * this.diff.spread, (Math.random() * 2 - 1) * this.diff.spread);
      }
      const from = this.pos.clone().setY(this.pos.y + 1.35);
      const aimAt = target.clone().setY(target.y + 1.15);
      const dir = aimAt.sub(from).normalize();
      // the error: rotate about the vertical and a side axis
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (this.aimErr.x * Math.PI) / 180).applyAxisAngle(side, (this.aimErr.y * Math.PI) / 180).normalize();
      for (let p = 0; p < this.weapon.pellets; p++) {
        const pd = dir.clone();
        if (this.weapon.pellets > 1) {
          pd.applyAxisAngle(new THREE.Vector3(0, 1, 0), ((Math.random() * 2 - 1) * 2 * Math.PI) / 180).applyAxisAngle(side, ((Math.random() * 2 - 1) * 2 * Math.PI) / 180);
        }
        this.projectiles.fire(from, pd, this.weapon, true);
        shots.push({ from, dir: pd, damage: this.weapon.damage.near, weapon: this.weapon.id });
      }
    }
    return shots;
  }

  dispose(): void {
    this.projectiles.removeDummy(this.dummy);
    this.dummy.dispose();
  }
}

/** does a ray from `from` along `dir` cross a body (a capsule 0.3 to 1.7 m up, 0.45 m wide) at `feet` before a wall */
export function hitsBody(from: THREE.Vector3, dir: THREE.Vector3, feet: THREE.Vector3): boolean {
  const a = feet.clone().setY(feet.y + 0.3);
  const b = feet.clone().setY(feet.y + 1.7);
  // closest approach between the ray and the segment ab
  const seg = b.clone().sub(a);
  const w0 = from.clone().sub(a);
  const aa = dir.dot(dir);
  const bb = dir.dot(seg);
  const cc = seg.dot(seg);
  const dd = dir.dot(w0);
  const ee = seg.dot(w0);
  const den = aa * cc - bb * bb;
  let s: number;
  let t: number;
  if (den < 1e-9) {
    s = 0;
    t = Math.max(0, Math.min(1, ee / cc));
  } else {
    s = (bb * ee - cc * dd) / den;
    t = (aa * ee - bb * dd) / den;
    t = Math.max(0, Math.min(1, t));
    s = -(dd - bb * t) / aa;
  }
  if (s < 0) return false;
  const pRay = from.clone().addScaledVector(dir, s);
  const pSeg = a.clone().addScaledVector(seg, t);
  if (pRay.distanceTo(pSeg) > 0.45) return false;
  return solidHit(from, dir, s) >= s;
}

export class BotMatch implements MatchLike {
  readonly kind = "bots" as const;
  readonly players: number;
  phase: RoundPhase = "countdown";
  round = 1;
  health = HEALTH_MAX;
  shield = SHIELD_MAX;
  shieldMax = SHIELD_MAX;
  alive = true;
  private bots: Bot[] = [];
  private scores: number[];
  private lastWinner = -1;
  private phaseEndsAt: number;
  private fightStartedAt = 0;
  private zoneLive = false;
  private zoneStartsIn = ZONE_DELAY;
  private caps: number[];
  private lastClock: number;
  private ended = false;
  private kills = 0;
  private deaths = 0;
  private damage = 0;
  private shots = 0;
  private hits = 0;
  private myName = "";
  readonly spawn: Spawn = ARENA_SPAWNS.host;
  onRespawn: (() => void) | null = null;
  onHurt: ((amount: number) => void) | null = null;
  onRemoteShot: ((origin: THREE.Vector3) => void) | null = null;
  onEnd: ((reason: string) => void) | null = null;
  onNotice: ((text: string) => void) | null = null;
  onMatchEnd: ((s: MatchSummary) => void) | null = null;
  onFeed: ((text: string, mine: boolean, neutral?: boolean) => void) | null = null;
  streak = 0;
  private lastSummary: MatchSummary | null = null;
  onRemoteFx: ((k: string, from: number, a?: THREE.Vector3, b?: THREE.Vector3) => void) | null = null;
  onDamaged: ((from: number, amount: number, head: boolean, weapon: string, dist: number | null) => void) | null = null;
  onEliminated: ((by: number) => void) | null = null;
  onShotFired: ((id: number, o: THREE.Vector3, d: THREE.Vector3, weapon: string) => void) | null = null;
  onHealSeen: ((id: number, item: string) => void) | null = null;
  /** you are always player 0 against the bots */
  readonly id = 0;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    readonly difficulty: BotDifficulty,
    count: number,
    /** JOLT and TRIAGE on: you pick one, each bot takes one at random */
    readonly abilities = false
  ) {
    const n = Math.max(1, Math.min(2, count));
    this.players = n + 1;
    for (let i = 0; i < n; i++) {
      const b = new Bot(i, scene, projectiles, DIFFICULTY[difficulty], ARENA_BOT_SPAWNS[i]);
      b.setAbilities(abilities);
      b.onJolt = (a, to) => this.onRemoteFx?.("jolt", b.remote.id, a, to);
      b.onHealed = (item) => this.onHealSeen?.(b.remote.id, item);
      this.bots.push(b);
    }
    this.scores = new Array(this.players).fill(0);
    this.caps = new Array(this.players).fill(0);
    const now = wallClock();
    this.lastClock = now;
    this.phaseEndsAt = now + COUNTDOWN;
  }

  get canFire(): boolean {
    return this.phase === "fight" && this.alive;
  }
  get avatars(): Dummy[] {
    return this.bots.map((b) => b.dummy);
  }
  remoteOf(d: Dummy): Remote | null {
    return this.bots.find((b) => b.dummy === d)?.remote ?? null;
  }

  localShot(): void {
    this.shots++;
  }

  /** nobody to tell: the bots are here */
  localFx(): void {}

  /** one of your bullets hit a bot: it is a dummy, so its own hit() already took the damage */
  localHit(r: Remote, amount: number): void {
    if (this.phase !== "fight") return;
    const bot = this.bots.find((b) => b.remote === r);
    if (!bot) return;
    this.hits++;
    this.damage += amount;
    r.health = bot.dummy.health;
    r.shield = bot.dummy.shield;
    if (bot.dummy.knocked && r.alive) {
      r.alive = false;
      this.kills++;
      this.onNotice?.(`${r.name} DOWN`);
      this.onFeed?.(`${this.myName || "YOU"} knocked ${r.name}`, true);
      this.checkRound(wallClock());
    }
  }

  private enter(phase: RoundPhase, now: number, seconds: number): void {
    const wasEnd = this.phase === "roundEnd" || this.phase === "matchEnd";
    this.phase = phase;
    this.phaseEndsAt = now + seconds;
    if (phase === "countdown" || phase === "fight") {
      this.caps.fill(0);
      this.zoneLive = false;
      this.zoneStartsIn = ZONE_DELAY;
    }
    if (phase === "fight") this.fightStartedAt = now;
    if (phase === "countdown" && wasEnd) this.respawn();
    if (phase === "matchEnd") {
      const mine = this.scores[0];
      const others = this.scores.slice(1).reduce((a, b) => a + b, 0);
      this.lastSummary = { won: mine >= ROUNDS_TO_WIN, roundsWon: mine, roundsLost: others, kills: this.kills, deaths: this.deaths, damage: this.damage, shots: this.shots, hits: this.hits };
      this.onMatchEnd?.(this.lastSummary);
      this.kills = this.deaths = this.damage = this.shots = this.hits = 0;
    }
  }

  private respawn(): void {
    this.health = HEALTH_MAX;
    this.shield = this.shieldMax;
    this.alive = true;
    for (const b of this.bots) b.reset();
    this.onRespawn?.();
  }

  private scoreRound(winner: number, now: number): void {
    if (this.phase !== "fight") return;
    if (winner >= 0) this.scores[winner]++;
    this.lastWinner = winner;
    const over = this.scores.some((s) => s >= ROUNDS_TO_WIN);
    this.enter(over ? "matchEnd" : "roundEnd", now, over ? MATCH_END : ROUND_END);
  }

  /** you down: the bots take it; every bot down: yours */
  private checkRound(now: number): void {
    if (this.phase !== "fight") return;
    if (!this.alive) {
      // the round goes to the bot that knocked you (else the first still up)
      const up = (this.lastHitBy?.alive ? this.lastHitBy : null) ?? this.bots.find((b) => b.alive);
      this.scoreRound(up ? up.index + 1 : -1, now);
    } else if (this.bots.every((b) => !b.alive)) this.scoreRound(0, now);
  }

  private lastHitBy: Bot | null = null;

  private takeHit(amount: number, from: Bot | null = null, weapon = "", dist: number | null = null): void {
    if (!this.alive || this.phase !== "fight") return;
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health = Math.max(0, this.health - (amount - toShield));
    this.onHurt?.(amount);
    if (from) this.onDamaged?.(from.remote.id, amount, false, weapon, dist);
    if (this.health <= 0) {
      this.alive = false;
      this.deaths++;
      const by = this.lastHitBy ?? this.bots.find((b) => b.alive) ?? null;
      this.onEliminated?.(by ? by.remote.id : -1);
      this.onFeed?.(`${by?.remote.name ?? "A BOT"} knocked ${this.myName || "YOU"}`, false);
      this.checkRound(wallClock());
    }
  }

  update(local: LocalState): void {
    const now = wallClock();
    const dt = Math.max(0, Math.min(0.1, now - this.lastClock));
    this.lastClock = now;
    this.myName = local.name;
    if (this.ended) return;
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    const center = ARENA_CENTER;

    if (this.phase === "fight") {
      const since = now - this.fightStartedAt;
      this.zoneStartsIn = Math.max(0, ZONE_DELAY - since);
      this.zoneLive = since >= ZONE_DELAY;
      if (this.zoneLive) {
        const inZone = (x: number, y: number, z: number) => Math.hypot(x - center.x, z - center.z) <= ZONE_RADIUS && y < 1.5;
        const inside: number[] = [];
        if (this.alive && inZone(local.x, local.y, local.z)) inside.push(0);
        for (const b of this.bots) if (b.alive && inZone(b.pos.x, b.pos.y, b.pos.z)) inside.push(b.index + 1);
        if (inside.length === 1) {
          this.caps[inside[0]] += dt;
          if (this.caps[inside[0]] >= ZONE_CAPTURE) this.scoreRound(inside[0], now);
        }
      }
    }
    if (now >= this.phaseEndsAt) {
      if (this.phase === "countdown") {
        this.enter("fight", now, 0);
        this.onNotice?.("FIGHT");
      } else if (this.phase === "roundEnd") {
        this.round++;
        this.enter("countdown", now, COUNTDOWN);
      } else if (this.phase === "matchEnd") {
        this.scores.fill(0);
        this.round = 1;
        this.enter("countdown", now, COUNTDOWN);
      }
    }

    // the bots think and shoot; a hit on you lands at once, with the bot's gun and distance for the recap
    for (const b of this.bots) {
      const before = b.alive;
      const sees = this.alive && b.alive && !b.dropping && b.sees(feet);
      const shots = b.update(now, dt, { target: sees ? feet : null, targetId: 0, goal: center, canShoot: this.phase === "fight" });
      let d = 0;
      for (const s of shots) {
        this.onShotFired?.(b.remote.id, s.from, s.dir, s.weapon);
        if (hitsBody(s.from, s.dir, feet)) d += s.damage;
      }
      if (d > 0) {
        this.lastHitBy = b;
        this.takeHit(d, b, shots[0].weapon, b.pos.distanceTo(feet));
      }
      if (before && !b.alive) {
        // knocked by something that did not go through localHit (a melee)
        b.remote.alive = false;
        this.kills++;
        this.onFeed?.(`${this.myName || "YOU"} knocked ${b.remote.name}`, true);
        this.checkRound(now);
      }
    }
    for (const b of this.bots) {
      // its own heals show on its plate
      if (b.alive) {
        b.remote.health = b.dummy.health;
        b.remote.shield = b.dummy.shield;
      }
      const s = b.remote.samples;
      s.length = 0;
      s.push({ at: now, x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0 });
    }
  }

  hud(): DuelHud {
    const now = wallClock();
    const mine = this.scores[0];
    const theirs = Math.max(0, ...this.scores.slice(1));
    const decided = this.phase === "roundEnd" || this.phase === "matchEnd";
    return {
      you: mine,
      them: theirs,
      round: this.round,
      phase: this.phase,
      left: Math.max(0, this.phaseEndsAt - now),
      ping: null,
      youWonRound: decided ? this.lastWinner === 0 : null,
      youWonMatch: this.phase === "matchEnd" ? mine >= ROUNDS_TO_WIN : null,
      zone: {
        live: this.phase === "fight" && this.zoneLive,
        startsIn: this.phase === "fight" ? this.zoneStartsIn : ZONE_DELAY,
        you: this.caps[0],
        them: Math.max(0, ...this.caps.slice(1)),
        need: ZONE_CAPTURE,
      },
      players: [{ name: this.myName || "YOU", score: mine, alive: this.alive, you: true }, ...this.bots.map((b) => ({ name: b.remote.name, score: this.scores[b.index + 1], alive: b.alive, you: false }))],
      waiting: null,
      summary: this.phase === "matchEnd" && this.lastSummary ? { ...this.lastSummary, streak: this.streak } : null,
    };
  }

  /** the bots as they stand: the killcam's recording */
  actorStates(): ActorState[] {
    return this.bots.map((b) => {
      const p = b.dummy.currentPose;
      return { id: b.remote.id, name: b.remote.name, x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: ((b.dummy.group.rotation.y - Math.PI) * 180) / Math.PI, pitch: p.pitch, stance: p.stance, speed: p.speed, weapon: b.remote.avatarWeapon, op: b.remote.avatarOp, alive: b.alive };
    });
  }

  nameFor(id: number): string {
    if (id === 0) return this.myName || "YOU";
    return this.bots.find((b) => b.remote.id === id)?.remote.name ?? "A BOT";
  }

  vitalsFor(id: number): { shield: number; health: number } | null {
    const b = this.bots.find((x) => x.remote.id === id);
    return b ? { shield: b.dummy.shield, health: b.dummy.health } : null;
  }

  /** against bots there is nobody to watch: the round ends when you go down */
  spectateTarget(): Dummy | null {
    return null;
  }

  leave(): void {
    this.dispose();
    if (!this.ended) {
      this.ended = true;
      this.onEnd?.("You left the bot match.");
    }
  }

  dispose(): void {
    for (const b of this.bots) b.dispose();
    this.bots = [];
  }
}

void HU;
