// Arena, Bots: the 1v1 rules against one or two bots, offline.
//
// A bot is a Dummy figure with a weapon and a small mind: it walks toward the
// middle of the arena until it sees you, then toward you, strafing, keeping a
// few metres back, and fires its weapon at you. Its tier (src/config/bots.json:
// easy, normal, hard, elite) is more than its aim: how fast it reacts, how far
// behind a moving target its aim lags, an aim error that starts wide and
// settles while it keeps you in view, where on the body it aims, whether it
// dodges when shot, hears shots, throws a frag at someone camping or hiding,
// breaks line of sight to heal and peeks back, and crouches while it fires. It cannot jump, climb or slide: it walks up steps and
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
import botsCfg from "../config/bots.json";
import throwCfg from "../config/throwables.json";
import { asDifficulty } from "./stats";
import { Throwables, blastDamage, throwCode } from "./throwables";
import { HEALTH_MAX, ROUNDS_TO_WIN, SHIELD_MAX, ZONE_CAPTURE, ZONE_DELAY, type DuelHud, type LocalState, type MatchLike, type Remote, type Spawn } from "./duel";

const COUNTDOWN = 3;
const ROUND_END = 3;
const MATCH_END = 7;
const wallClock = (): number => performance.now() / 1000;

export type BotTier = "easy" | "normal" | "hard" | "elite";
export const BOT_TIERS: BotTier[] = ["easy", "normal", "hard", "elite"];
export interface Difficulty {
  name: BotTier;
  /** m/s on foot */
  speed: number;
  /** seconds from seeing you to the first shot */
  reaction: number;
  /** how far behind a moving target the aim runs, s (the aim re-settling on its interval) */
  aimLag: number;
  /** the aim error, degrees: where it starts on a new target, the fraction of the extra left after 1 s, where it settles */
  errStart: number;
  errDecay: number;
  errFloor: number;
  /** where on the body it aims, m above the feet (1.1 the chest, 1.5 the neck) */
  aimHeight: number;
  /** how much of the weapon's fire rate it uses */
  fireScale: number;
  /** how close it tries to get, m */
  keep: number;
  /** strafe: how much of its speed, and how often it turns, rad/s */
  strafe: number;
  strafeRate: number;
  /** chances: to dodge when hurt, to hear a shot in earshot */
  dodge: number;
  hearing: number;
  /** a frag at a target standing still in view this long, s (null: no grenades) */
  grenadeAfter: number | null;
  /** it heals after this long with nobody in its sights, s */
  healAfter: number;
  /** breaks line of sight to heal, then peeks back */
  cover: boolean;
  /** the chance, every so often while firing, to crouch (or stand back up) */
  crouchPeek: number;
  /** comes back round a corner already aimed where it last saw you */
  preAim: boolean;
  /** uses a JOLT to dodge (when the match has abilities on) */
  jolt: boolean;
}
export const DIFFICULTY: Record<BotTier, Difficulty> = Object.fromEntries(
  BOT_TIERS.map((t) => [t, { name: t, ...(botsCfg.tiers[t] as Omit<Difficulty, "name">) }])
) as Record<BotTier, Difficulty>;
/** a lobby's setting as one bot's tier: "mixed" draws one by the config's weights */
export function tierFor(d: BotDifficulty, rng: () => number = Math.random): BotTier {
  const k = asDifficulty(d);
  if (k !== "mixed") return k;
  const w = botsCfg.mixed as Record<BotTier, number>;
  let r = rng() * BOT_TIERS.reduce((s, t) => s + w[t], 0);
  for (const t of BOT_TIERS) {
    r -= w[t];
    if (r <= 0) return t;
  }
  return "normal";
}
/** the aim error, degrees, `t` seconds into keeping a target */
export function aimError(d: Difficulty, t: number): number {
  return d.errFloor + (d.errStart - d.errFloor) * Math.pow(d.errDecay, Math.max(0, t));
}
const GRENADE = botsCfg.grenade;
/** a crouched bot's eye, m */
const CROUCH_EYE = 0.95;
const COVER = botsCfg.cover;
const HEAR = botsCfg.hear;
/** is there a clear line between two chests (`eye`: the looker's eye height, lower crouched) */
function lineOfSight(a: THREE.Vector3, b: THREE.Vector3, eye = 1.4): boolean {
  const from = a.clone().setY(a.y + eye);
  const to = b.clone().setY(b.y + 1.2);
  const d = to.clone().sub(from);
  const len = d.length();
  if (len < 1e-3) return true;
  return solidHit(from, d.divideScalar(len), len) >= len;
}
/** a frag's launch from `from` to land at `to` in about `flight` seconds (the throw's own gravity) */
export function lobVelocity(from: THREE.Vector3, to: THREE.Vector3, flight: number): THREE.Vector3 {
  const g = throwCfg.gravity;
  const t = Math.max(0.3, flight);
  return new THREE.Vector3((to.x - from.x) / t, (to.y - from.y + 0.5 * g * t * t) / t, (to.z - from.z) / t);
}
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
  /** the goal comes first (the ring closing on it): no hunting, no going to look at a shot */
  urgent?: boolean;
  canShoot: boolean;
}

/** a shot a bot fired that may have hit an enemy: for the match to apply */
export interface BotShot {
  from: THREE.Vector3;
  dir: THREE.Vector3;
  damage: number;
  /** its gun, for the recap and the killcam ("melee" for a knife) */
  weapon: string;
  /** a knife: it lands on whoever is within reach, no bullet */
  melee?: boolean;
}

/** a bot's knife reaches this far, m, and swings this often, s (the player's melee) */
const BOT_MELEE_RANGE = 1.8;
const BOT_MELEE_EVERY = 0.9;

export class Bot {
  readonly dummy: Dummy;
  readonly remote: Remote;
  weapon: ResolvedWeapon;
  /** Gun Run's last level: no gun, it closes in and swings a knife for this much */
  knife: number | null = null;
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
  /** where its aim is, lagging the target by the tier's aimLag */
  private aimPoint = new THREE.Vector3();
  private aimSet = false;
  /** the last place and time it saw its target, and who */
  lastSeen: { pos: THREE.Vector3; at: number; id: number } | null = null;
  /** the target standing still: since when, and where */
  private stillSince = 0;
  private stillAt = new THREE.Vector3();
  /** a shot it heard: go and look */
  heard: { pos: THREE.Vector3; until: number } | null = null;
  /** a dodge: the strafe reversed and harder, until then */
  private dodgeUntil = -Infinity;
  private strafeSign = 1;
  /** crouched while it fires, and when it next thinks about it */
  crouching = false;
  private crouchNext = 0;
  /** a spot out of the target's sight to heal behind, and until when it keeps to it */
  cover: { spot: THREE.Vector3; crouch: boolean; via: THREE.Vector3 | null; until: number; best: number; bestAt: number } | null = null;
  private coverTryAt = 0;
  /** headway: where it last got somewhere, and since when; a detour out of a pocket and until when */
  private headwayAt = new THREE.Vector3();
  private headwaySince = 0;
  private detour = new THREE.Vector2();
  private detourUntil = -Infinity;
  /** frags left, when it may throw the next, and one thrown this frame (for the match) */
  frags: number = GRENADE.count;
  private nextThrowAt = 0;
  private thrown: { kind: "frag"; from: THREE.Vector3; vel: THREE.Vector3 } | null = null;
  /** the mode allows grenades (Gun Run does not) */
  grenadesAllowed = true;
  /** JOLT or TRIAGE when the match has abilities on (abilities.ts) */
  ability: AbilityId | null = null;
  private joltLeft = 0;
  /** JOLT's charges (the player's rules: two, one back every 4 s) and when the next is back */
  private joltCharges: number = JOLT.charges;
  private joltRechargeAt = Infinity;
  private joltLastAt = -Infinity;
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
    readonly diff: Difficulty,
    public spawn: Spawn,
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
      downed: false,
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
    this.joltCharges = JOLT.charges;
    this.joltRechargeAt = Infinity;
    this.joltLastAt = -Infinity;
    this.lastHurtAt = -Infinity;
    this.lastTargetAt = -Infinity;
    this.healing = null;
    this.kit = { cell: items.bots.cell, syringe: items.bots.syringe };
    this.prevVital = this.dummy.health + this.dummy.shield;
    this.aimSet = false;
    this.lastSeen = null;
    this.heard = null;
    this.cover = null;
    this.crouching = false;
    this.dodgeUntil = -Infinity;
    this.frags = GRENADE.count;
    this.nextThrowAt = 0;
    this.thrown = null;
  }

  /** someone it was after went down: no hunting them, no frag at where they were */
  forget(id: number): void {
    if (this.lastSeen?.id === id) this.lastSeen = null;
  }

  /** a frag it threw this frame, once (the match shows it, sends it, and the blast is the match's) */
  takeThrow(): { kind: "frag"; from: THREE.Vector3; vel: THREE.Vector3 } | null {
    const t = this.thrown;
    this.thrown = null;
    return t;
  }

  /** a shot went off at `pos`: in earshot, by the tier's chance, it goes to look */
  hear(pos: THREE.Vector3, now: number, rng: () => number = Math.random, range: number = HEAR.range): void {
    if (!this.alive || this.dropping) return;
    if (this.pos.distanceTo(pos) > range) return;
    if (rng() >= this.diff.hearing) return;
    this.heard = { pos: pos.clone().setY(this.groundAt(pos.x, pos.z)), until: now + HEAR.memory };
  }

  /** can it walk straight to `p` (nothing that blocks a body on the way, every half metre) */
  private clearWalk(p: THREE.Vector3, from: { x: number; z: number } = this.pos): boolean {
    const dx = p.x - from.x;
    const dz = p.z - from.z;
    const n = Math.ceil(Math.hypot(dx, dz) / 0.5);
    for (let i = 1; i <= n; i++) if (this.blocked(from.x + (dx * i) / n, from.z + (dz * i) / n)) return false;
    return true;
  }

  /**
   * Somewhere near, out of `threat`'s sight: a spot hidden standing (behind
   * a wall) or, second best, hidden crouched (behind low cover, where it
   * heals crouched, as players do). It must be reachable: straight, or by one
   * turn at a clear point 3 m off (round the end of a crate). For a heal.
   */
  private findCover(threat: THREE.Vector3): { spot: THREE.Vector3; crouch: boolean; via: THREE.Vector3 | null } | null {
    let best: { spot: THREE.Vector3; crouch: boolean; via: THREE.Vector3 | null } | null = null;
    let bestD = Infinity;
    // the turning points: clear, and clear to walk to
    const vias: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const w = new THREE.Vector3(this.pos.x + Math.cos(a) * 3, this.pos.y, this.pos.z + Math.sin(a) * 3);
      if (!this.blocked(w.x, w.z) && this.clearWalk(w)) vias.push(w);
    }
    for (let i = 0; i < COVER.samples; i++) {
      const a = (i / COVER.samples) * Math.PI * 2 + this.strafePhase;
      for (const r of [COVER.search * 0.35, COVER.search * 0.7, COVER.search, COVER.search * 1.4]) {
        const p = new THREE.Vector3(this.pos.x + Math.cos(a) * r, this.pos.y, this.pos.z + Math.sin(a) * r);
        if (this.blocked(p.x, p.z)) continue;
        p.y = this.groundAt(p.x, p.z);
        // hidden first (the cheap test), then a way there
        const standing = !lineOfSight(p, threat);
        const crouched = standing || !lineOfSight(p, threat, CROUCH_EYE);
        if (!crouched) continue;
        let via: THREE.Vector3 | null = null;
        if (!this.clearWalk(p)) {
          via = vias.find((w) => this.clearWalk(p, w)) ?? null;
          if (!via) continue;
        }
        // not toward the threat; standing cover before crouched; a straight way before a turn
        const toward = (p.x - this.pos.x) * (threat.x - this.pos.x) + (p.z - this.pos.z) * (threat.z - this.pos.z);
        const d = this.pos.distanceTo(p) + (toward > 0 ? 4 : 0) + (standing ? 0 : 3) + (via ? 2 : 0);
        if (d < bestD) {
          bestD = d;
          best = { spot: p, crouch: !standing, via };
        }
      }
    }
    return best;
  }

  /** a different gun (Gun Run's next level): its figure's too */
  setWeapon(id: string): void {
    if (id === this.weapon.id) return;
    this.weapon = resolveWeapon(id, 2);
    this.remote.avatarWeapon = id;
    this.dummy.setGun(id);
    this.dummy.setGunVisible(this.knife === null);
  }

  /** Gun Run's knife: the gun goes away and it fights hand to hand */
  setKnife(damage: number | null): void {
    this.knife = damage;
    this.dummy.setGunVisible(damage === null);
  }

  /** back in at another spot (a respawn in the modes) */
  respawnAt(s: Spawn): void {
    this.spawn = s;
    this.reset();
    this.dummy.setGunVisible(this.knife === null);
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
    // out of sight behind cover it starts at once; otherwise after its tier's quiet spell
    if (!this.cover && now - this.lastTargetAt < this.diff.healAfter) return;
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
    // crouched (behind low cover) it looks from lower down
    const from = this.pos.clone().setY(this.pos.y + (this.crouching ? CROUCH_EYE : 1.4));
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
    const tier = this.diff;
    // (a glance lost for under half a second is the same sighting: the reaction does not start over)
    if (sees && !this.sawLast && now - this.lastTargetAt > 0.5) {
      // a new sighting: the reaction starts; an elite bot back round a corner where it lost you is already aimed
      const back = tier.preAim && this.lastSeen && now - this.lastSeen.at < 3 && this.lastSeen.pos.distanceTo(target) < 3.5;
      this.seenAt = back ? now - tier.reaction * 0.75 : now;
      if (!back || !this.aimSet) {
        this.aimPoint.copy(target).setY(target.y + tier.aimHeight);
        this.aimSet = true;
      }
    }
    this.sawLast = sees;
    if (sees) {
      this.lastTargetAt = now;
      if (!this.lastSeen || this.lastSeen.pos.distanceTo(target) > 1.5 || this.lastSeen.id !== sense.targetId) {
        this.stillSince = now;
        this.stillAt.copy(target);
      }
      if (this.stillAt.distanceTo(target) > 1.5) {
        this.stillSince = now;
        this.stillAt.copy(target);
      }
      this.lastSeen = { pos: target.clone(), at: now, id: sense.targetId };
      this.heard = null;
    }
    if (this.lastSeen && now - this.lastSeen.at > GRENADE.forgetAfter) this.lastSeen = null;
    if (this.heard && now > this.heard.until) this.heard = null;
    // hurt this frame (any source: bullets, the ring): a JOLT bot dodges, and by its tier it reverses its strafe
    const vital = this.dummy.health + this.dummy.shield;
    const hurt = vital < this.prevVital - 1e-6;
    if (hurt) {
      this.lastHurtAt = now;
      if (now > this.dodgeUntil && Math.random() < tier.dodge) {
        this.strafeSign = -this.strafeSign;
        this.dodgeUntil = now + botsCfg.dodgeTime;
      }
    }
    this.prevVital = vital;
    // low, with cover on: away out of sight to heal, then back to peek
    const hurtFrac = vital / Math.max(1, HEALTH_MAX + this.dummy.shieldMax);
    if (tier.cover && !this.cover && sees && target && now >= this.coverTryAt && hurtFrac < COVER.below && (this.kit.cell > 0 || this.kit.syringe > 0)) {
      // (nothing found: look again in a moment, from wherever the strafe has taken it)
      this.coverTryAt = now + 0.5;
      const found = this.findCover(target);
      if (found) this.cover = { spot: found.spot, crouch: found.crouch, via: found.via, until: now + 7, best: Infinity, bestAt: now };
    }
    // no nearer to it for a second while still in view: that way is blocked; look again next time
    if (this.cover && sees) {
      const leg = this.cover.via ?? this.cover.spot;
      const d = Math.hypot(leg.x - this.pos.x, leg.z - this.pos.z) + (this.cover.via ? 100 : 0);
      if (d < this.cover.best - 0.3) {
        this.cover.best = d;
        this.cover.bestAt = now;
      } else if (now - this.cover.bestAt > 1) this.cover = null;
    }
    if (this.cover && (now > this.cover.until || (!this.healing && hurtFrac >= 0.95) || (this.kit.cell <= 0 && this.kit.syringe <= 0))) this.cover = null;
    this.stepHeal(now, sees);
    while (this.joltCharges < JOLT.charges && now >= this.joltRechargeAt) {
      this.joltCharges++;
      this.joltRechargeAt = this.joltCharges < JOLT.charges ? this.joltRechargeAt + JOLT.recharge : Infinity;
    }
    if (this.ability === "jolt" && tier.jolt && this.joltLeft <= 0 && target && this.joltCharges > 0 && now - this.joltLastAt >= JOLT.gap && now - this.lastHurtAt < BOT_ABILITY.joltWhenHitWithin) {
      const tx = target.x - this.pos.x;
      const tz = target.z - this.pos.z;
      const tl = Math.hypot(tx, tz) || 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.joltDir.set((-tz / tl) * side, (tx / tl) * side);
      this.joltLeft = JOLT.duration;
      this.joltCharges--;
      if (!Number.isFinite(this.joltRechargeAt)) this.joltRechargeAt = now + JOLT.recharge;
      this.joltLastAt = now;
      this.dummy.jolt();
      this.joltFrom.copy(this.pos);
    }

    // where to go: cover when it is healing behind it; at the target if seen
    // (keeping a distance); where it last saw one (a hunt), or a shot it heard;
    // else the match's goal
    const hunting = !sees && this.lastSeen && tier.name !== "easy" ? this.lastSeen.pos : null;
    if (this.cover?.via && Math.hypot(this.cover.via.x - this.pos.x, this.cover.via.z - this.pos.z) < 0.8) this.cover.via = null;
    const goal = this.cover ? (this.cover.via ?? this.cover.spot) : (target ?? (sense.urgent ? sense.goal : (hunting ?? this.heard?.pos ?? sense.goal)));
    const toGoal = goal ? new THREE.Vector2(goal.x - this.pos.x, goal.z - this.pos.z) : new THREE.Vector2();
    const dist = toGoal.length();
    let want = new THREE.Vector2();
    if (dist > 1e-3) want.copy(toGoal).divideScalar(dist);
    if (sees && !this.cover && target) {
      // strafe across the line of sight, hold the distance; a dodge reverses it and runs it harder
      const toT = new THREE.Vector2(target.x - this.pos.x, target.z - this.pos.z);
      const td = toT.length();
      if (td > 1e-3) want.copy(toT).divideScalar(td);
      const side = new THREE.Vector2(-want.y, want.x);
      const strafe = now < this.dodgeUntil ? this.strafeSign : Math.sin(now * tier.strafeRate + this.strafePhase) * this.strafeSign;
      const keep = this.knife !== null ? 0.9 : tier.keep;
      const advance = td > keep + 1 ? 1 : td < keep - 1 ? -0.6 : 0;
      want = want.multiplyScalar(advance).addScaledVector(side, strafe * tier.strafe);
      if (want.length() > 1e-3) want.normalize();
    } else if (dist < (this.cover ? 0.6 : 1.5) || (this.cover && !sees)) want.set(0, 0);
    // a crouch now and then while it fires (by tier), never while it walks to cover or heals
    if (sees && target && !this.cover && !this.healing && tier.crouchPeek > 0) {
      // only a crouch that still sees the target (not one that ducks behind low cover mid-fight)
      const seesLow = lineOfSight(this.pos, target, CROUCH_EYE);
      if (now >= this.crouchNext) {
        this.crouchNext = now + 0.4 + Math.random() * 0.4;
        if (Math.random() < tier.crouchPeek) this.crouching = !this.crouching && seesLow;
      }
      if (this.crouching && !seesLow) this.crouching = false;
    } else this.crouching = !!this.cover && this.cover.crouch && Math.hypot(this.cover.spot.x - this.pos.x, this.cover.spot.z - this.pos.z) < 1.5;
    if (this.joltLeft > 0) {
      this.stepJolt(dt);
      want.set(0, 0);
    }
    // a wall in the way: slide along it, and remember which way for a moment.
    // Wedged (a pocket between boxes where both slides are blocked too): no
    // headway for 0.7 s and it takes the free way nearest the one it wants,
    // backing out if it must, for 0.8 s.
    if (want.length() > 1e-3) {
      if (now < this.detourUntil) want.copy(this.detour);
      else if (this.pos.distanceTo(this.headwayAt) > 0.1) {
        this.headwayAt.copy(this.pos);
        this.headwaySince = now;
      } else if (now - this.headwaySince > 0.7) {
        const base = Math.atan2(want.y, want.x);
        for (const turn of [0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
          const d = new THREE.Vector2(Math.cos(base + turn), Math.sin(base + turn));
          if (!this.blocked(this.pos.x + d.x * 0.5, this.pos.z + d.y * 0.5)) {
            this.detour.copy(d);
            this.detourUntil = now + 0.8;
            want.copy(d);
            break;
          }
        }
        this.headwaySince = now;
      }
      const step = this.diff.speed * dt * (this.healing ? HEAL_WALK : 1) * (this.crouching ? 0.6 : 1);
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
    // face the target when seen; an elite bot hunting keeps facing where it lost you; else the way it walks
    const faceAt = target ?? (tier.preAim && hunting ? hunting : null);
    const faceX = faceAt ? faceAt.x - this.pos.x : want.x;
    const faceZ = faceAt ? faceAt.z - this.pos.z : want.y;
    if (Math.abs(faceX) + Math.abs(faceZ) > 1e-3) {
      const wantYaw = Math.atan2(faceX, faceZ);
      const cur = this.dummy.group.rotation.y;
      let diff = wantYaw - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.dummy.group.rotation.y = cur + diff * Math.min(1, dt * 10);
    }
    this.dummy.group.position.copy(this.pos);
    // the figure runs when it moves and looks at what it aims at; the legs go the
    // way it walks (a strafe, a backpedal) while the body stays on the target;
    // it aims down its sights at a target in sight, and a heal takes its hands
    const moving = want.length() > 1e-3;
    const aimPitch = target ? (Math.atan2(target.y + 1.15 - (this.pos.y + 1.35), Math.max(1e-3, Math.hypot(target.x - this.pos.x, target.z - this.pos.z))) * 180) / Math.PI : 0;
    const ry = this.dummy.group.rotation.y;
    const fwdX = Math.sin(ry);
    const fwdZ = Math.cos(ry);
    const moveDir = moving ? Math.atan2(want.x * -fwdZ + want.y * fwdX, want.x * fwdX + want.y * fwdZ) : 0;
    this.dummy.setPose({
      speed: moving ? this.diff.speed * (this.healing ? HEAL_WALK : 1) * (this.crouching ? 0.6 : 1) : 0,
      stance: this.crouching ? "crouch" : "stand",
      pitch: aimPitch,
      moveDir,
      ads: target && this.knife === null && !this.healing ? 0.85 : 0,
      act: this.healing ? "heal" : null,
      healItem: this.healing?.item,
    });
    this.dummy.update(now, dt);

    // its aim follows the target, late by the tier's lag
    if (target) {
      const want3 = target.clone().setY(target.y + tier.aimHeight);
      if (!this.aimSet) {
        this.aimPoint.copy(want3);
        this.aimSet = true;
      }
      this.aimPoint.lerp(want3, Math.min(1, dt / Math.max(1e-3, tier.aimLag)));
    }
    // a frag: at where a target was hiding, or at one that has stood still in view too long
    if (tier.grenadeAfter !== null && this.grenadesAllowed && this.frags > 0 && now >= this.nextThrowAt && this.lastSeen && !this.healing && !this.cover && sense.canShoot && this.knife === null) {
      const hidden = !sees && now - this.lastSeen.at > GRENADE.hiddenAfter;
      const camping = sees && now - this.stillSince > tier.grenadeAfter;
      const at = this.lastSeen.pos;
      const d = Math.hypot(at.x - this.pos.x, at.z - this.pos.z);
      if ((hidden || camping) && d >= GRENADE.minRange && d <= GRENADE.maxRange) {
        const from = this.pos.clone().setY(this.pos.y + 1.6);
        this.thrown = { kind: "frag", from, vel: lobVelocity(from, at, GRENADE.flight * (0.7 + d / 40)) };
        this.frags--;
        this.nextThrowAt = now + GRENADE.cooldown;
        this.stillSince = now;
        this.dummy.kick();
      }
    }

    // shooting: after the reaction time, at the weapon's rate, with an aim
    // error that starts wide and settles while it keeps the target
    const shots: BotShot[] = [];
    if (this.knife !== null) {
      // the knife: a swing whenever the target is within reach
      if (target && sense.canShoot && !this.healing && now - this.seenAt >= this.diff.reaction && now >= this.nextShotAt && Math.hypot(target.x - this.pos.x, target.z - this.pos.z) <= BOT_MELEE_RANGE) {
        this.nextShotAt = now + BOT_MELEE_EVERY;
        const from = this.pos.clone().setY(this.pos.y + 1.35);
        const dir = target.clone().setY(target.y + 1.15).sub(from).normalize();
        shots.push({ from, dir, damage: this.knife, weapon: "melee", melee: true });
      }
      return shots;
    }
    if (target && sense.canShoot && !this.healing && now - this.seenAt >= this.diff.reaction && now >= this.nextShotAt) {
      const interval = Math.max(this.weapon.shotInterval, this.weapon.semiAuto ? 0.25 : 0) / this.diff.fireScale;
      this.nextShotAt = now + interval;
      if (now >= this.nextErrAt) {
        this.nextErrAt = now + 0.25;
        const e = aimError(tier, now - this.seenAt);
        const a = Math.random() * Math.PI * 2;
        const r = e * Math.sqrt(Math.random());
        this.aimErr.set(Math.cos(a) * r, Math.sin(a) * r);
      }
      const from = this.pos.clone().setY(this.pos.y + (this.crouching ? 1.0 : 1.35));
      const dir = this.aimPoint.clone().sub(from).normalize();
      // the error: rotate about the vertical and a side axis
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (this.aimErr.x * Math.PI) / 180).applyAxisAngle(side, (this.aimErr.y * Math.PI) / 180).normalize();
      for (let p = 0; p < this.weapon.pellets; p++) {
        const pd = dir.clone();
        if (this.weapon.pellets > 1) {
          pd.applyAxisAngle(new THREE.Vector3(0, 1, 0), ((Math.random() * 2 - 1) * 2 * Math.PI) / 180).applyAxisAngle(side, ((Math.random() * 2 - 1) * 2 * Math.PI) / 180);
        }
        this.projectiles.fire(from, pd, this.weapon, true);
        if (p === 0) this.dummy.kick();
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
  onRemoteFx: ((k: string, from: number, a?: THREE.Vector3, b?: THREE.Vector3, n?: number) => void) | null = null;
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
      const b = new Bot(i, scene, projectiles, DIFFICULTY[tierFor(difficulty)], ARENA_BOT_SPAWNS[i]);
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

  localShot(origin?: THREE.Vector3): void {
    this.shots++;
    // the bots in earshot may come to look
    if (origin) for (const b of this.bots) b.hear(origin, wallClock());
  }

  /** where you stood last frame (a bot's frag works out its damage against it) */
  private lastFeet = new THREE.Vector3();

  /** a bot's frag went off: you, in reach and in its sight, take its damage */
  botBlast(owner: number, at: THREE.Vector3, kind: "frag" | "arcstar"): void {
    const b = this.bots.find((x) => x.remote.id === owner);
    if (!b || !this.alive || this.phase !== "fight") return;
    const chest = this.lastFeet.clone().setY(this.lastFeet.y + 1.1);
    const dmg = blastDamage(kind, chest.distanceTo(at));
    if (dmg <= 0 || !Throwables.inSight(at, chest)) return;
    this.lastHitBy = b;
    this.takeHit(dmg, b, kind, Math.round(b.pos.distanceTo(this.lastFeet) * 10) / 10);
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
      for (const b of this.bots) b.forget(0);
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
    this.lastFeet.copy(feet);
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
      // a frag: its flight is drawn by the page, which hands the blast back (botBlast)
      const th = b.takeThrow();
      if (th) this.onRemoteFx?.("throw", b.remote.id, th.from, th.vel, throwCode(th.kind));
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
      s.push({ at: now, x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0, ads: 0, act: null });
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
