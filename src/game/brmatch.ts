// Battle royale against bots: you (and up to two friends) drop onto
// OUTSKIRTS (br.ts), the ring closes (ring.ts), the last squad standing wins.
//
// Built on the 1v1's Duel: the same links, figures, hits, downs and feed. The
// host runs the bots and the ring and sends the bots as ordinary state
// packets with ids from 100 up, so a friend's game draws a bot the way it
// draws any other player, and a friend's bullets reach a bot as a hit
// message the host applies. Alone, it is the same class with no links.
//
// The bots share the arena bots' brain (bots.ts): walk toward a goal, fight
// what they see, keep a distance, strafe. Here the goal comes from a graph of
// the map's nodes: a bot picks a node, walks to it, picks a linked one, and
// while the ring is closing it heads for the ring's centre instead. Bots
// fight each other as well as the squad.
//
// One life, no rounds: you drop, you fight, the squad wins when every bot is
// down, and the card says where you placed when the last of you goes down.
// Damage from the ring is the ring's; damage from a bot's shot is tested
// against a capsule at the target's feet, yours, a friend's or another bot's.
//
// The match rules that are not the ring's live in src/config/br.json:
//
//   the squad size   solo, duos or trios. It decides whether a knock is a
//                    down or an elimination, how long the bleed-out is, how
//                    many squads the lobby holds, and how the bots are
//                    grouped, so a solo match is a lobby of singles rather
//                    than a trio match with two gaps in it.
//   care packages    called before they arrive, marked where they will land,
//                    trailing smoke under a canopy, and lit and pinged for a
//                    while after the thump so there is a window to fight over
//                    one. Bots go for them too.
//   loadout crates   the drop that hands you the loadout you built on the
//                    Loadouts tab. One serves the whole lobby: each player
//                    claims their own guns out of it once. Nothing about it
//                    goes over the wire, because every browser works out the
//                    same spot from the match seed and the ring it can see.
//   Storm Surge      the ring is the only pressure and it only hurts you
//                    outside it, so hiding used to win ties. In the late
//                    rounds, when more are alive than the phase allows,
//                    whoever has dealt the least damage starts taking it.
import * as THREE from "three";
import squadCfg from "../config/squad.json";
import brCfg from "../config/br.json";
import { Throwables, blastDamage, throwCode } from "./throwables";
import { lockedHopupFor, optionsFor, SLOTS, type Attachments } from "./attachments";
import { weaponMods, weaponName } from "./weapons";
import { savedLoadout, type LoadoutDef } from "./loadouts";
import { Bot, BOT_NAMES, BOT_WEAPONS, DIFFICULTY, hitsBody, tierFor, type BotSense } from "./bots";
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { Ring, RING_PHASES, RING_TICK, type Circle } from "./ring";
import { BR_CENTER, BR_HALF, type BrMap, type Poi } from "./br";
import { Duel, HEALTH_MAX, SHIELD_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";
import type { ActorState } from "./killcam";
import { HEAL_CODES } from "./recap";
import { LootField, LOOT, seeded, type LootItem, type LootKind, type Rarity } from "./loot";
import { ammoTypeOf } from "./ammo";

/** how high the drop starts */
export const DROP_HEIGHT = 90;

/** solo, duos or trios: one row of src/config/br.json's teams */
export interface TeamMode {
  id: string;
  /** how many share a squad */
  size: number;
  label: string;
  /** the bot counts the lobby offers in this size (1 + each is a whole number of squads) */
  bots: readonly number[];
  defaultBots: number;
  /** what the bleed-out clock is multiplied by (0 = no downs at all) */
  bleed: number;
}

export const TEAMS: readonly TeamMode[] = brCfg.teams;

/** the size a lobby or a welcome packet names, and the default when it names none we know */
export function teamFor(id: string | null | undefined): TeamMode {
  return TEAMS.find((t) => t.id === id) ?? TEAMS.find((t) => t.id === brCfg.defaultTeam) ?? TEAMS[TEAMS.length - 1];
}

/** where the lobby's squad size is kept in this browser (the menu writes it, a match alone reads it) */
const TEAM_KEY = "range.br.team";

export function savedTeamId(): string {
  try {
    return teamFor(localStorage.getItem(TEAM_KEY)).id;
  } catch {
    return teamFor(null).id;
  }
}

export function saveTeamId(id: string): void {
  try {
    localStorage.setItem(TEAM_KEY, teamFor(id).id);
  } catch {
    /* ignore */
  }
}

/** how many squads a lobby of this many players makes, rounded up for a part-full one */
export function lobbySquads(players: number, size: number): number {
  return Math.ceil(Math.max(1, players) / Math.max(1, size));
}

/**
 * How many may still be alive in this ring phase before Storm Surge starts.
 * Infinity in the early rounds, and never below br.json's minAlive, so the
 * surge cannot go after a lobby that is already down to one fight.
 */
export function surgeAllowed(phase: number, total: number): number {
  const s = brCfg.surge;
  if (phase < s.fromPhase) return Infinity;
  const frac = s.alive[Math.min(phase, s.alive.length - 1)];
  if (frac >= 1) return Infinity;
  return Math.max(s.minAlive, Math.ceil(total * frac));
}

/**
 * Who the surge takes a tick out of: everyone below the line when the living
 * are ranked by the damage they have dealt, least first, minus anyone who has
 * dealt damage inside br.json's grace. The rule is aimed at hiding, so losing
 * a fight you are actually in must not be what kills you.
 */
export function surgeVictims(rows: ReadonlyArray<{ id: number; dealt: number; at: number }>, allowed: number, now: number): number[] {
  if (rows.length <= allowed) return [];
  // least damage first; ties go to the higher id so the order never wobbles
  const order = [...rows].sort((a, b) => a.dealt - b.dealt || b.id - a.id);
  return order
    .slice(0, rows.length - Math.max(0, allowed))
    .filter((r) => now - r.at >= brCfg.surge.grace)
    .map((r) => r.id);
}

/** what one surge tick costs, a step higher every br.json stepEvery seconds it stays live */
export function surgeDamage(liveFor: number): number {
  const d = brCfg.surge.damage;
  return d[Math.max(0, Math.min(d.length - 1, Math.floor(liveFor / brCfg.surge.stepEvery)))];
}

/**
 * Where a loadout crate comes down for a ring phase: a point well inside the
 * circle that phase closes to, drawn from the match seed on its own stream.
 *
 * Every browser has the seed (the welcome carries it) and sees the same next
 * circle in the ring packet, so all of them work out the same spot and the
 * crate needs no message of its own.
 */
export function loadoutPodAt(seed: number, phase: number, c: Circle): { x: number; z: number } {
  const rnd = seeded((seed ^ Math.imul(0x9e3779b9, phase + 1)) >>> 0);
  // the first draw off an LCG seeded this way still tracks the seed, so spend it
  rnd();
  const a = rnd() * Math.PI * 2;
  const r = Math.sqrt(rnd()) * c.r * brCfg.loadoutPod.inset;
  return { x: c.cx + Math.cos(a) * r, z: c.cz + Math.sin(a) * r };
}

/** the card stays this long before the menu comes back (the killcam and the recap play in it) */
const END_HOLD = 14;
/** bot states go out this often (the humans' own go at 30 Hz) */
const BOT_SEND_HZ = 15;
const wallClock = (): number => performance.now() / 1000;

export interface BrHud {
  alive: number;
  total: number;
  kills: number;
  /** while dropping: the POI you are dropping onto, and the map is shown */
  dropping: boolean;
  poi: string;
  ring: {
    phase: number;
    phases: number;
    closing: boolean;
    timeLeft: number;
    current: Circle;
    next: Circle;
    /** you are outside the live ring */
    outside: boolean;
    damage: number;
  };
  /** where you finished once it is over (1 = the win) */
  placement: number | null;
  survived: number;
  pois: Array<{ name: string; x: number; z: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** how many share a squad (1 solo, 2 duos, 3 trios), and how many squads are still up */
  team: number;
  squads: number;
  /** jump towers, respawn beacons, care packages, for the maps */
  towers: Array<{ x: number; z: number }>;
  beacons: Array<{ x: number; z: number }>;
  /** `loadout` is a loadout crate rather than a care package; `hot` is still worth contesting */
  pods: Array<{ x: number; z: number; landed: boolean; loadout: boolean; hot: boolean }>;
  /** the squad mates, for the maps: where, their name, down or out */
  mates: Array<{ x: number; z: number; name: string; downed: boolean; alive: boolean }>;
  /** Storm Surge, null until the late rounds put it in play (the host's: it owns the ranking) */
  surge: { live: boolean; startsIn: number; damage: number; safe: boolean; below: number } | null;
  /** standing in a loadout crate: how far through the claim you are, 0 to 1 */
  crate: number | null;
}

interface BrBot {
  bot: Bot;
  node: number;
  goal: number;
  /** when it has its gun (it lands with nothing when there is loot, and searches) */
  armedAt: number;
  landed: boolean;
  /** its gun and shield are out */
  armedShown?: boolean;
  /** which bot squad it belongs to: its own in solo, one of a pair or a three otherwise */
  team: number;
}

/** a care package or a loadout crate: called, on its way down, or landed */
interface Pod {
  id: number;
  kind: "supply" | "loadout";
  at: THREE.Vector3;
  landsAt: number;
  /** seconds of the drop you can see it falling: before that it is called but not yet in the sky */
  fallFor: number;
  /** lit, pinged and worth fighting over until this moment */
  hotUntil: number;
  obj: THREE.Group;
  canopy: THREE.Object3D;
  beam: THREE.Mesh;
  /** the smoke it leaves behind it, in world space so it stays where it was made */
  trail: THREE.Group;
  nextPuff: number;
  dust: THREE.Mesh | null;
  landed: boolean;
  /** a loadout crate: the players who have taken their own loadout out of it */
  claimed: Set<number>;
}

/** one puff of the falling pod's smoke; shared, because every pod draws dozens */
const PUFF_GEO = new THREE.SphereGeometry(brCfg.pod.trail.radius, 8, 6);

const BR_BOUNDS_WORLD = { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF };
const RARITIES = ["common", "rare", "epic", "legendary"];
const KINDS = ["weapon", "ammo", "heal", "attach", "hopup", "helmet", "banner", "box", "grenade"];

/** a loot item from another browser, checked field by field */
function wireItem(x: unknown): LootItem | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  if (typeof o.kind !== "string" || !KINDS.includes(o.kind) || typeof o.id !== "string" || o.id.length > 40) return null;
  const n = typeof o.n === "number" && Number.isFinite(o.n) ? Math.max(0, Math.min(500, Math.floor(o.n))) : 1;
  const rarity = typeof o.rarity === "string" && RARITIES.includes(o.rarity) ? (o.rarity as Rarity) : "common";
  const it: LootItem = { kind: o.kind as LootKind, id: o.id, n, rarity };
  if (typeof o.mag === "number" && Number.isFinite(o.mag)) it.mag = Math.max(0, Math.min(4, Math.floor(o.mag)));
  if (o.attach && typeof o.attach === "object") {
    const a: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(o.attach as Record<string, unknown>)) if (typeof v === "string" && v.length < 40) a[k] = v;
    it.attach = a;
  }
  if (typeof o.owner === "number") it.owner = o.owner;
  if (typeof o.ownerName === "string") it.ownerName = o.ownerName.replace(/[\p{Cc}<>&"'`]/gu, "").slice(0, 16);
  if (typeof o.pod === "number" && Number.isFinite(o.pod)) it.pod = Math.floor(o.pod);
  if (typeof o.hop === "number" && Number.isFinite(o.hop)) it.hop = Math.max(0, Math.min(10000, o.hop));
  return it;
}

/** the ring as a guest sees it: what the host last sent */
interface RingView {
  phase: number;
  state: "waiting" | "closing" | "closed";
  timeLeft: number;
  current: Circle;
  next: Circle;
}

export class BrMatch extends Duel {
  private bots: BrBot[] = [];
  /** the host's ring; a guest mirrors it in `view` */
  private readonly ring: Ring | null;
  private view: RingView;
  private guestTick = 0;
  private aliveSeen: number;
  private readonly startedAt: number;
  private placement: number | null = null;
  private endAt = Infinity;
  private botSendNext = 0;
  private ringSendNext = 0;
  private brOver = false;
  readonly poi: Poi;
  /** the tests: the bots hold their fire (they still move and see) */
  holdFire = false;
  readonly difficulty: BotDifficulty;
  readonly botCount: number;
  /** solo, duos or trios (src/config/br.json): the whole lobby plays the same one */
  readonly team: TeamMode;
  /** the match seed: the floor's loot, and the loadout crates every browser works out for itself */
  private readonly seed: number;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    private readonly map: BrMap,
    difficulty: BotDifficulty,
    botCount: number,
    opts: { players: number; myId: number; link: Link | null; guestId?: number; poi?: string; abilities?: boolean; seed?: number; start?: "loot" | "loadout"; team?: string },
    rng: () => number = Math.random
  ) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "br", abilities: opts.abilities ?? true });
    this.difficulty = difficulty;
    this.botCount = Math.max(1, Math.min(BOT_NAMES.length, botCount));
    // The squad size is the host's for everyone: a guest that ran its own
    // would revive in a lobby where nobody else believes in revives. Alone
    // there is no host and no welcome packet, so the lobby row's own choice
    // is read here instead.
    this.team = teamFor(opts.team ?? (opts.players <= 1 ? savedTeamId() : undefined));
    this.seed = opts.seed ?? 1;
    // the squad drops on one place: the host's pick, told to the guests
    this.poi = (opts.poi && map.pois.find((p) => p.id === opts.poi)) || map.pois[Math.floor(rng() * map.pois.length)];
    const now = wallClock();
    this.startedAt = now;
    this.aliveSeen = this.botCount + this.players;
    const start = { cx: BR_CENTER.x, cz: BR_CENTER.z, r: BR_HALF * 1.35 };
    // the floor's loot, from the host's seed (the welcome carries it), unless the squad lands with its loadouts
    this.startLoot = opts.start !== "loadout";
    if (this.startLoot) {
      this.lootField = new LootField(scene);
      this.lootField.generate(this.seed, map.pois.map((p) => ({ x: p.x, z: p.z })), BR_BOUNDS_WORLD);
    }
    if (this.role === "host") {
      // The bots take the OTHER places: where the squad drops is the squad's.
      // Landing beside three of them with no gun was the whole of a match.
      const others = map.pois.filter((p) => p !== this.poi).sort(() => rng() - 0.5);
      const order = others.length ? others : [this.poi];
      const apart = squadCfg.drop.apart;
      for (let i = 0; i < this.botCount; i++) {
        // A bot squad lands together: the place and the drop point belong to
        // the squad, not to the bot, so trios arrive as three and a solo
        // lobby still spreads one bot per place the way it always did.
        const squad = Math.floor(i / this.team.size);
        const poi = order[squad % order.length];
        const drop = poi.drops[squad % poi.drops.length];
        // spread round the drop point, further out the more of them share it
        const ring = Math.floor(squad / (order.length * poi.drops.length));
        const a = rng() * Math.PI * 2;
        const r = apart * (0.5 + ring);
        const spawn = { x: drop.x + Math.cos(a) * r, z: drop.z + Math.sin(a) * r, yaw: rng() * 360 };
        // each its own tier: "mixed" draws one per bot
        const bot = new Bot(i, scene, projectiles, DIFFICULTY[tierFor(difficulty, rng)], spawn, Duel.BOT_ID + i, BOT_WEAPONS[i % BOT_WEAPONS.length], BOT_NAMES[i % BOT_NAMES.length]);
        // with loot on it lands with nothing and searches first
        if (this.startLoot) bot.dummy.setGunVisible(false);
        bot.setAbilities(this.abilities, rng);
        // a bot's JOLT: drawn here and sent to the squad
        bot.onJolt = (a, b) => {
          this.onRemoteFx?.("jolt", bot.remote.id, a, b);
          this.broadcast({ t: "fx", from: bot.remote.id, k: "jolt", a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] });
        };
        // a bot's finished heal: the recap's "healed recently", here and on the squad's screens
        bot.onHealed = (item) => {
          this.onHealSeen?.(bot.remote.id, item);
          this.broadcast({ t: "fx", from: bot.remote.id, k: "heal", n: HEAL_CODES.indexOf(item) });
        };
        const node = this.nearestNode(spawn.x, spawn.z);
        this.bots.push({ bot, node, goal: node, armedAt: Infinity, landed: false, team: squad });
      }
      this.ring = new Ring(start, rng);
      this.view = { phase: 0, state: "waiting", timeLeft: RING_PHASES[0].wait, current: { ...this.ring.current }, next: { ...this.ring.next } };
    } else {
      this.ring = null;
      this.view = { phase: 0, state: "waiting", timeLeft: RING_PHASES[0].wait, current: start, next: start };
    }
  }

  /** a Deathbox Respawn's beam and hum: "high risk", heard twice as far as a shot */
  hearBeam(at: THREE.Vector3): void {
    if (this.role !== "host") return;
    const now = wallClock();
    for (const b of this.bots) b.bot.hear(at, now, Math.random, 140);
  }

  /** a shot here or a guest's: the bots in earshot may come to look */
  protected override heardShot(at: THREE.Vector3): void {
    if (this.role !== "host") return;
    const now = wallClock();
    for (const b of this.bots) b.bot.hear(at, now);
  }

  /**
   * A bot's frag went off (the host's page drew its flight): everyone in reach
   * and in its sight takes the damage, the squad as from the bot's bullets,
   * other bots on their figures.
   */
  botBlast(owner: number, at: THREE.Vector3, kind: "frag" | "arcstar"): void {
    if (this.role !== "host" || this.phase !== "fight") return;
    const thrower = this.bots.find((x) => x.bot.remote.id === owner);
    if (!thrower) return;
    const now = wallClock();
    const hurts = (feet: THREE.Vector3): number => {
      const chest = feet.clone().setY(feet.y + 1.1);
      const dmg = blastDamage(kind, chest.distanceTo(at));
      return dmg > 0 && Throwables.inSight(at, chest) ? dmg : 0;
    };
    // the squad: this player, and the guests by their last state
    if (this.alive && this.lastLocal) {
      const f = new THREE.Vector3(this.lastLocal.x, this.lastLocal.y, this.lastLocal.z);
      const d = hurts(f);
      if (d > 0) {
        this.noteDamage(owner, d);
        this.hurt(d, owner, kind, Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10);
      }
    }
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive) continue;
      const s = r.samples[r.samples.length - 1];
      if (!s) continue;
      const f = new THREE.Vector3(s.x, s.y, s.z);
      const d = hurts(f);
      if (d <= 0) continue;
      this.noteDamage(owner, d);
      const dist = Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10;
      this.links.get(r.id)?.send({ t: "hit", to: r.id, amount: d, head: false, from: owner, w: kind, d: dist });
      const toShield = Math.min(r.shield, d);
      r.shield -= toShield;
      r.health = Math.max(0, r.health - (d - toShield));
    }
    // the other bots, its own squad excepted: a frag that knocked the two it
    // landed with turned every bot trio into a suicide pact
    for (const o of this.bots) {
      if (o === thrower || o.team === thrower.team || !o.bot.alive || o.bot.dropping) continue;
      const d = hurts(o.bot.pos);
      if (d <= 0) continue;
      this.noteDamage(owner, d);
      o.bot.dummy.hit(now, "body", d, 1, 1, o.bot.pos.clone().setY(o.bot.pos.y + 1.2));
      o.bot.remote.health = o.bot.dummy.health;
      o.bot.remote.shield = o.bot.dummy.shield;
      if (o.bot.dummy.knocked) this.botDown(o, owner);
    }
  }

  /** a Deathbox Respawn under way (during onRespawn): the box's spot, height included */
  get boxRespawnAt(): THREE.Vector3 | null {
    return this.respawnOnBox && this.respawnPoint ? this.respawnPoint.clone() : null;
  }

  /** your drop spot: one per squad member at the squad's place */
  override get spawn(): Spawn {
    if (this.respawnPoint) return { x: this.respawnPoint.x, z: this.respawnPoint.z, yaw: 0 };
    const d = this.poi.drops[this.id % this.poi.drops.length];
    return { x: d.x, z: d.z, yaw: 0 };
  }

  override get avatars(): Dummy[] {
    return [...super.avatars, ...this.bots.map((b) => b.bot.dummy)];
  }

  override remoteOf(d: Dummy): Remote | null {
    return this.bots.find((b) => b.bot.dummy === d)?.bot.remote ?? super.remoteOf(d);
  }

  /** everyone still up, humans and bots (the host's count; a guest's is what the host sent) */
  get aliveCount(): number {
    if (this.role !== "host") return this.aliveSeen;
    let n = this.alive ? 1 : 0;
    for (const r of this.remotes.values()) if (r.alive) n++;
    for (const b of this.bots) if (b.bot.alive) n++;
    return n;
  }
  /** the squad still standing: up and not down (all of it down is the squad out) */
  private get humansAlive(): number {
    let n = this.alive && !this.downed ? 1 : 0;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive && !r.downed) n++;
    return n;
  }
  /** squads still in it: this one, and every bot squad with someone up (in solo everyone is their own) */
  private get squadsAlive(): number {
    const teams = new Set<number>();
    for (const b of this.bots) if (b.bot.alive) teams.add(b.team);
    const mine = this.team.size === 1 ? this.humansAlive : this.humansAlive > 0 ? 1 : 0;
    return teams.size + mine;
  }

  // ------------------------------------------------------------ loot

  /** the floor's loot, death boxes and care packages (null when the squad landed with its loadouts) */
  lootField: LootField | null = null;
  readonly startLoot: boolean;
  /** the item you asked for is yours (the host's own, or the host said so) */
  onLootTaken: ((item: LootItem) => void) | null = null;
  private pods: Pod[] = [];
  private podCount = 0;
  private podSeq = 0;
  private podPhases = new Set<number>();
  /** the ring phases whose loadout crate has been called (on every browser, not just the host's) */
  private cratePhases = new Set<number>();
  /** standing in a loadout crate: which one, and since when */
  private crateHold: { id: number; since: number } | null = null;
  private crateProgress: number | null = null;
  /**
   * Your loadout crate is yours: your saved loadout's two guns, kitted. The
   * match cannot put a gun in your hands itself (main.ts owns the kit), so it
   * hands them over here. With nothing listening and nobody else in the
   * match, the crate spills them at your feet instead and the ordinary loot
   * prompt does the rest.
   */
  onLoadoutDrop: ((guns: LootItem[], def: LoadoutDef) => void) | null = null;

  /** take an item: the host's own at once, a guest's asked of the host (first come, first served) */
  takeLoot(key: number): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      const it = f.remove(key);
      if (!it) return;
      this.onLootTaken?.(it);
      this.broadcast({ t: "loot", op: "gone", key, by: this.id });
    } else if (f.drops.has(key)) this.hostLink?.send({ t: "loot", op: "take", key });
  }

  /** put an item down (a swapped gun, a death box's contents): the host keys it and tells the squad */
  dropLoot(item: LootItem, at: THREE.Vector3): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      const key = f.add(item, at);
      this.broadcast({ t: "loot", op: "add", key, item, at: [at.x, at.y, at.z] });
    } else this.hostLink?.send({ t: "loot", op: "drop", item, at: [at.x, at.y, at.z] });
  }

  /** a death box at `at`: the box itself and its items spread round it */
  dropBox(items: LootItem[], at: THREE.Vector3): void {
    this.dropLoot({ kind: "box", id: "box", n: 1, rarity: "common" }, at);
    items.forEach((it, i) => {
      const a = (i / Math.max(1, items.length)) * Math.PI * 2;
      this.dropLoot(it, at.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9)));
    });
  }

  /**
   * A care package or a loadout crate is called: `lands` seconds from now,
   * counting br.json's announce ahead of the fall itself.
   *
   * The arrival is the event, not the contents. It is named and pinged the
   * moment it is called, so everyone has time to start moving; it appears
   * high under a canopy and trails smoke down; it thumps into a ring of dust;
   * and it stays lit and marked for br.json's contest seconds afterwards,
   * which is the window the fight over it happens in.
   */
  private addPod(at: THREE.Vector3, lands: number, kind: Pod["kind"] = "supply"): void {
    const cfg = brCfg.pod;
    const crate = kind === "loadout";
    const tint = crate ? 0xffc12e : 0x3fa7e8;
    const obj = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x3a4250, emissive: tint, emissiveIntensity: 0.35, roughness: 0.5 }));
    shell.position.y = 0.9;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 160, 8, 1, true), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 80;
    // the canopy that carries it down, cut loose the moment it lands
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(cfg.canopy.radius, cfg.canopy.height, 12, 1, true), new THREE.MeshStandardMaterial({ color: crate ? 0xd8a63a : 0xdde3ea, emissive: tint, emissiveIntensity: 0.12, roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.y = 1.8 + cfg.canopy.height * 0.5;
    obj.add(shell, beam, canopy);
    obj.position.set(at.x, cfg.height, at.z);
    obj.visible = false;
    this.scene.add(obj);
    // the smoke hangs where it was made, so it cannot be a child of the pod
    const trail = new THREE.Group();
    this.scene.add(trail);
    const fallFor = Math.min(lands, LOOT.podFall);
    this.pods.push({ id: ++this.podSeq, kind, at: at.clone(), landsAt: wallClock() + lands, fallFor, hotUntil: Infinity, obj, canopy, beam, trail, nextPuff: 0, dust: null, landed: false, claimed: new Set() });
    const where = this.placeNear(at);
    this.onNotice?.(crate ? `LOADOUT CRATE INBOUND  ·  ${where}` : `CARE PACKAGE INBOUND  ·  ${where}`);
    // the compass and both maps get it through the ping path the squad already has
    this.onMark?.("go", this.id, at.clone(), crate ? "LOADOUT CRATE" : "CARE PACKAGE", -1);
    // the horn, for the page that owns the audio: 0 called, 1 landed, 2 a crate called
    this.onRemoteFx?.("pod", this.id, at.clone(), undefined, crate ? 2 : 0);
  }

  /** the name of the place a point is nearest, for a notice that says where to go */
  private placeNear(at: THREE.Vector3): string {
    let best = this.map.pois[0];
    let bd = Infinity;
    for (const p of this.map.pois) {
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best.name.toUpperCase();
  }

  /** the host: what a care package holds (a care-package gun at gold, and the best of the rest) */
  private podItems(): LootItem[] {
    const gun = LOOT.carePackage[Math.floor(Math.random() * LOOT.carePackage.length)];
    // a care-package gun comes with its hop-up unlocked
    const hop = lockedHopupFor(gun);
    const out: LootItem[] = [{ kind: "weapon", id: gun, n: 1, rarity: "legendary", mag: 4, ...(hop ? { attach: { hopup: hop } } : {}) }];
    const extras: LootItem[] = [
      { kind: "helmet", id: "gold", n: 1, rarity: "legendary" },
      { kind: "heal", id: "phoenix", n: 1, rarity: "legendary" },
      { kind: "heal", id: "battery", n: 2, rarity: "epic" },
    ];
    while (out.length < LOOT.carePackageContents) out.push(extras.splice(Math.floor(Math.random() * extras.length), 1)[0]);
    // its number: each of the squad who loots from it gets the package's EVO once (Apex pays the squad)
    const n = ++this.podCount;
    return out.map((it) => ({ ...it, pod: n }));
  }

  /** the pods: called, falling under smoke, then landing (the host lays out a package's items) */
  private updatePods(now: number): void {
    const cfg = brCfg.pod;
    for (const p of this.pods) {
      if (!p.landed) {
        const left = p.landsAt - now;
        // before the fall it is called but not yet in the sky: only the
        // notice and the ping exist, which is the warning the item asked for
        p.obj.visible = left <= p.fallFor;
        const t = Math.max(0, Math.min(1, 1 - left / p.fallFor));
        p.obj.position.y = cfg.height * (1 - t) + p.at.y * t;
        if (p.obj.visible && now >= p.nextPuff) {
          p.nextPuff = now + cfg.trail.every;
          const puff = new THREE.Mesh(PUFF_GEO, new THREE.MeshBasicMaterial({ color: 0xcdd4dc, transparent: true, opacity: 0.5, depthWrite: false }));
          puff.position.set(p.at.x + (Math.random() - 0.5) * 0.7, p.obj.position.y + 0.6, p.at.z + (Math.random() - 0.5) * 0.7);
          puff.userData.born = now;
          p.trail.add(puff);
        }
        if (left <= 0) {
          p.landed = true;
          p.obj.position.y = p.at.y;
          p.canopy.visible = false;
          p.hotUntil = now + cfg.contest;
          // the dust it throws up, and the thump for whoever is near enough to hear it
          const dust = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 28), new THREE.MeshBasicMaterial({ color: 0xc9bda6, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
          dust.rotation.x = -Math.PI / 2;
          dust.position.set(p.at.x, p.at.y + 0.06, p.at.z);
          dust.userData.born = now;
          this.scene.add(dust);
          p.dust = dust;
          this.onRemoteFx?.("pod", this.id, p.at.clone(), undefined, 1);
          this.onNotice?.(`${p.kind === "loadout" ? "LOADOUT CRATE" : "CARE PACKAGE"} DOWN  ·  ${this.placeNear(p.at)}`);
          if (p.kind === "supply" && this.role === "host") this.podItems().forEach((it, i) => this.dropLoot(it, p.at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.3, 0, Math.sin(i * 2.1) * 1.3))));
        }
      }
      // the smoke: each puff swells and fades where it was left
      for (const puff of [...p.trail.children] as THREE.Mesh[]) {
        const age = (now - (puff.userData.born as number)) / cfg.trail.life;
        if (age >= 1) {
          puff.removeFromParent();
          (puff.material as THREE.Material).dispose();
          continue;
        }
        const s = 1 + age * cfg.trail.grow;
        puff.scale.set(s, s, s);
        (puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - age);
      }
      if (p.dust) {
        const age = (now - (p.dust.userData.born as number)) / cfg.dust.time;
        if (age >= 1) {
          p.dust.removeFromParent();
          p.dust.geometry.dispose();
          (p.dust.material as THREE.Material).dispose();
          p.dust = null;
        } else {
          const s = 0.5 + age * cfg.dust.radius;
          p.dust.scale.set(s, s, s);
          (p.dust.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - age);
        }
      }
      // the beam burns while it is worth contesting, then drops to a marker
      (p.beam.material as THREE.MeshBasicMaterial).opacity = now < p.hotUntil ? 0.25 : 0.08;
    }
  }

  /**
   * The loadout crate (item 24): called into the ring as br.json's phases
   * start closing, once per phase, on every browser at once.
   *
   * Nothing about it goes over the wire. The host and the guests share the
   * match seed and see the same circle in the ring packet, so all of them
   * work the same spot out, and the claim below is each player's own anyway.
   */
  private maybeCrate(): void {
    if (this.phase !== "fight") return;
    const v = this.view;
    if (v.state !== "closing" || this.cratePhases.has(v.phase) || !brCfg.loadoutPod.phases.includes(v.phase)) return;
    this.cratePhases.add(v.phase);
    const spot = loadoutPodAt(this.seed, v.phase, v.next);
    this.addPod(new THREE.Vector3(spot.x, 0, spot.z), brCfg.pod.announce + LOOT.podFall, "loadout");
  }

  /**
   * Standing in a landed loadout crate: hold still for br.json's claim time
   * and it hands you the loadout you built on the Loadouts tab. One crate
   * serves the lobby, a claim each, so a squad mate taking theirs first costs
   * you nothing.
   */
  private updateCrateClaim(now: number, local: LocalState): void {
    const claim = brCfg.loadoutPod.claim;
    let on: Pod | null = null;
    if (this.alive && !this.downed && this.phase === "fight") {
      for (const p of this.pods) {
        if (p.kind !== "loadout" || !p.landed || p.claimed.has(this.id)) continue;
        if (Math.hypot(local.x - p.at.x, local.z - p.at.z) <= claim.reach && Math.abs(local.y - p.at.y) < 3) {
          on = p;
          break;
        }
      }
    }
    if (!on) {
      this.crateHold = null;
      this.crateProgress = null;
      return;
    }
    if (!this.crateHold || this.crateHold.id !== on.id) {
      this.crateHold = { id: on.id, since: now };
      this.onNotice?.("LOADOUT CRATE  ·  STAY ON IT");
    }
    const t = (now - this.crateHold.since) / claim.time;
    this.crateProgress = Math.min(1, t);
    if (t < 1) return;
    this.crateHold = null;
    this.crateProgress = null;
    on.claimed.add(this.id);
    const def = savedLoadout();
    const guns = this.loadoutGuns(def);
    this.onNotice?.(`${def.name.toUpperCase()}  ·  ${weaponName(def.slot1).toUpperCase()} + ${weaponName(def.slot2).toUpperCase()}`);
    if (this.onLoadoutDrop) this.onLoadoutDrop(guns, def);
    else if (this.lootField && !this.links.size && !this.hostLink) {
      // alone, with nothing listening: the crate pops them out at your feet
      guns.forEach((g, i) => this.dropLoot(g, on!.at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.1, 0, Math.sin(i * 2.1) * 1.1))));
    }
  }

  /**
   * Your loadout's two guns as the crate hands them over: fitted from the
   * same preference list the Hot Zone's kitted gun uses (loot.json's
   * kitted.prefer), because a second list of preferences would drift from the
   * first, and wearing a magazine of br.json's tier.
   */
  private loadoutGuns(def: LoadoutDef): LootItem[] {
    const cfg = brCfg.loadoutPod;
    return [def.slot1, def.slot2].map((id) => {
      const mods = weaponMods(id);
      const attach: Attachments = {};
      for (const slot of SLOTS) {
        const fits = optionsFor(slot, mods, id).filter((o) => o.mod !== null);
        if (!fits.length) continue;
        const prefer = (LOOT.kitted.prefer as Record<string, string[]>)[slot] ?? [];
        attach[slot] = prefer.find((m) => fits.some((o) => o.mod === m)) ?? fits[fits.length - 1].mod;
      }
      return { kind: "weapon", id, n: 1, rarity: cfg.rarity as Rarity, mag: cfg.mag, attach };
    });
  }

  /** the map's towers, beacons and pads (brplay.ts) */
  get mapInfo(): { towers: Array<{ x: number; z: number }>; beacons: Array<{ x: number; z: number }>; pads: Array<{ x: number; z: number; dx: number; dz: number }> } {
    return this.map;
  }

  /** a downed squad mate within reach, to revive */
  downedMateNear(p: THREE.Vector3, reach: number): { id: number; name: string } | null {
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive || !r.downed) continue;
      const g = r.avatar.group.position;
      if (Math.hypot(g.x - p.x, g.z - p.z) <= reach && Math.abs(g.y - p.y) < 1.5) return { id: r.id, name: r.name };
    }
    return null;
  }

  /** where care packages and loadout crates are and will land, for the maps */
  get podSpots(): Array<{ x: number; z: number; landed: boolean; loadout: boolean; hot: boolean }> {
    const now = wallClock();
    return this.pods.map((p) => ({ x: p.at.x, z: p.at.z, landed: p.landed, loadout: p.kind === "loadout", hot: now < p.hotUntil }));
  }
  get ringState(): RingView {
    return this.view;
  }

  /** the nearest package worth walking to from here: falling, or landed and still hot */
  private podToContest(from: THREE.Vector3): THREE.Vector3 | null {
    const now = wallClock();
    let best: Pod | null = null;
    let bd = brCfg.podLure;
    for (const p of this.pods) {
      if (now >= p.hotUntil) continue;
      const d = Math.hypot(p.at.x - from.x, p.at.z - from.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ? new THREE.Vector3(best.at.x, 0, best.at.z) : null;
  }

  private nearestNode(x: number, z: number): number {
    let best = 0;
    let bd = Infinity;
    this.map.nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // ------------------------------------------------------------ the fight

  /** the host's own bullet hit a bot (its dummy took the damage already); a guest's goes to the host as a hit message */
  override localHit(r: Remote, amount: number, head: boolean, weapon = "", dist: number | null = null): void {
    const b = this.bots.find((x) => x.bot.remote === r);
    if (!b) {
      super.localHit(r, amount, head, weapon, dist);
      return;
    }
    if (this.phase !== "fight" || !r.alive) return;
    this.hits++;
    this.damage += amount;
    this.noteDamage(this.id, amount);
    r.health = b.bot.dummy.health;
    r.shield = b.bot.dummy.shield;
    if (b.bot.dummy.knocked) this.botDown(b, this.id);
  }

  /** the host: a guest's hit on a bot */
  protected override onHitOther(to: number, amount: number, head: boolean, from: number): boolean {
    const b = this.bots.find((x) => x.bot.remote.id === to);
    if (!b) return false;
    if (this.phase !== "fight" || !b.bot.alive) return true;
    const bot = b.bot;
    this.noteDamage(from, amount);
    bot.dummy.hit(wallClock(), head ? "head" : "body", amount, 1, 1, bot.pos.clone().setY(bot.pos.y + 1.2));
    bot.remote.health = bot.dummy.health;
    bot.remote.shield = bot.dummy.shield;
    if (bot.dummy.knocked) this.botDown(b, from);
    return true;
  }

  /** a bot went down, knocked by `by` (a human id, a bot id, or -1 for the ring) */
  private botDown(b: BrBot, by: number): void {
    const r = b.bot.remote;
    if (!r.alive) return;
    r.alive = false;
    const mine = by === this.id;
    if (mine) this.kills++;
    // its death box: its gun (if it had found it), two stacks of its ammo, a couple of heals
    if (this.lootField && this.role === "host") {
      const w = r.avatarWeapon;
      const items: LootItem[] = [];
      if (b.armedAt <= wallClock()) items.push({ kind: "weapon", id: w, n: 1, rarity: "rare" });
      const type = ammoTypeOf(w);
      if (type !== "energy") items.push({ kind: "ammo", id: type, n: LOOT.deathBox.stacks * (type === "sniper" ? 28 : type === "shotgun" ? 20 : 60), rarity: "common" });
      items.push({ kind: "heal", id: "cell", n: LOOT.deathBox.cells, rarity: "common" });
      items.push({ kind: "heal", id: "syringe", n: LOOT.deathBox.syringes, rarity: "common" });
      this.dropBox(items, b.bot.pos.clone());
    }
    const who = by === -1 ? "THE RING" : by === this.id ? this.myName || "YOU" : (this.remotes.get(by)?.name ?? this.bots.find((x) => x.bot.remote.id === by)?.bot.remote.name ?? "SOMEONE");
    this.onFeed?.(`${who} knocked ${r.name}`, mine, !mine);
    for (const o of this.bots) o.bot.forget(r.id);
    this.broadcast({ t: "down", from: r.id, by });
    this.onKnockSeen?.(r.id, by);
    const left = this.aliveCount;
    this.onNotice?.(mine ? `${r.name} DOWN  ·  ${left} LEFT` : `${left} LEFT`);
    if (this.bots.every((x) => !x.bot.alive) && this.humansAlive > 0) this.endBr(true);
  }

  // ------------------------------------------------------------ Storm Surge

  /** who has dealt how much damage, and when they last dealt any: the surge ranks on it */
  private dealt = new Map<number, { total: number; at: number }>();
  /** when the first surge tick lands, and when the surge went live (Infinity for neither) */
  private surgeAt = Infinity;
  private surgeSince = Infinity;
  private surgeStep = -1;
  private surgeSafe = true;
  private surgeBelow = 0;

  /** damage dealt by a human or a bot, for the ranking (the host sees everyone's: it runs the bots and the guests' hits come to it) */
  private noteDamage(by: number, amount: number): void {
    if (by < 0 || !(amount > 0)) return;
    const row = this.dealt.get(by) ?? { total: 0, at: -Infinity };
    row.total += amount;
    row.at = wallClock();
    this.dealt.set(by, row);
  }

  /** everyone who can still be surged, with their damage: the living, downed players excepted */
  private surgeRows(): Array<{ id: number; dealt: number; at: number }> {
    const row = (id: number) => {
      const d = this.dealt.get(id);
      return { id, dealt: d?.total ?? 0, at: d?.at ?? -Infinity };
    };
    const out: Array<{ id: number; dealt: number; at: number }> = [];
    if (this.alive && !this.downed) out.push(row(this.id));
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive && !r.downed) out.push(row(r.id));
    for (const b of this.bots) if (b.bot.alive && !b.bot.dropping) out.push(row(b.bot.remote.id));
    return out;
  }

  /**
   * Storm Surge (item 34): the late rounds stop paying for hiding.
   *
   * When more are alive than the phase allows, everyone is ranked by the
   * damage they have dealt and the ones below the line take a tick wherever
   * they stand. It is warned first and it cancels if enough die during the
   * countdown, so it is a reason to go and fight rather than a punishment
   * that arrives with no notice.
   */
  private updateSurge(now: number, tick: boolean): void {
    const ring = this.ring;
    if (!ring) return;
    const allowed = surgeAllowed(ring.phase, this.botCount + this.players);
    if (this.phase !== "fight" || this.aliveCount <= allowed) {
      if (this.surgeSince < Infinity) this.onNotice?.("STORM SURGE OVER");
      this.surgeAt = Infinity;
      this.surgeSince = Infinity;
      this.surgeStep = -1;
      this.surgeSafe = true;
      this.surgeBelow = 0;
      return;
    }
    if (this.surgeAt === Infinity) {
      this.surgeAt = now + brCfg.surge.warn;
      this.onNotice?.(`STORM SURGE IN ${brCfg.surge.warn}  ·  DEAL DAMAGE OR TAKE IT`);
    }
    const victims = new Set(surgeVictims(this.surgeRows(), allowed, now));
    this.surgeBelow = victims.size;
    this.surgeSafe = !victims.has(this.id);
    if (now < this.surgeAt) return;
    if (this.surgeSince === Infinity) this.surgeSince = now;
    const amount = surgeDamage(now - this.surgeSince);
    const step = brCfg.surge.damage.indexOf(amount);
    if (step !== this.surgeStep) {
      this.surgeStep = step;
      this.onNotice?.(`STORM SURGE  ·  ${amount} EVERY ${RING_TICK} S IF YOU HIDE`);
    }
    if (!tick || !victims.size) return;
    // the surge is the ring's kind of damage: it comes from nobody (-1)
    if (victims.has(this.id) && this.alive) this.hurt(amount, -1);
    // A squad mate below the line is ranked but not yet hurt. The host cannot
    // send this one: a hit message carries a sender, every sender that is not
    // a squad mate builds a figure for them on the other browser, and a squad
    // mate's hits are ignored in a battle royale. It wants one flag on the
    // ring packet (net/link.ts) that a guest hurts itself by, next to the one
    // it already uses for standing outside the circle.
    for (const b of this.bots) {
      if (!victims.has(b.bot.remote.id) || !b.bot.alive || b.bot.dropping) continue;
      b.bot.dummy.hit(now, "body", amount, 1, 1, b.bot.pos);
      b.bot.remote.health = b.bot.dummy.health;
      b.bot.remote.shield = b.bot.dummy.shield;
      if (b.bot.dummy.knocked) this.botDown(b, -1);
    }
  }

  // ------------------------------------------------------------ the squad

  /** solo: there is nobody to pick you up, so a knock is an elimination */
  protected override squadUp(): boolean {
    return this.team.size > 1 && super.squadUp();
  }

  /** a squad mate gone (left, or silent): with nobody of the squad still up, it is over */
  protected override playerGone(id: number, notice: string): void {
    super.playerGone(id, notice);
    if (this.role === "host" && !this.brOver && this.phase === "fight" && this.humansAlive === 0) this.endBr(false);
  }

  /** the match ends for this side: once the result is in, say the result (the host's goodbye follows it) */
  protected override finish(reason: string): void {
    const p = this.placement;
    super.finish(this.brOver && p ? (p === 1 ? "The squad won the battle royale." : `You placed #${p} of ${this.botCount + this.players}.`) : reason);
  }

  /** a human went down (any side, this player included): the host decides whether the squad is out */
  protected override onSomeoneDown(_id: number, _by: number): void {
    for (const o of this.bots) o.bot.forget(_id);
    // A duo has less time on the floor than a trio: only one person can ever
    // be coming. Duel owns the bleed-out clock and has already started it by
    // the time this runs, so the size cuts what it set rather than running a
    // second clock beside it.
    if (_id === this.id && this.team.bleed > 0 && this.team.bleed < 1) {
      const now = wallClock();
      this.bleedUntil = now + (this.bleedUntil - now) * this.team.bleed;
    }
    if (this.role === "host" && this.humansAlive === 0) this.endBr(false);
  }

  /** the remote's name for the feed, bots included on the host */
  protected nameOf(id: number): string | undefined {
    return this.remotes.get(id)?.name ?? this.bots.find((b) => b.bot.remote.id === id)?.bot.remote.name;
  }

  /** the host: the squad's result, sent to everyone */
  private endBr(won: boolean): void {
    if (this.brOver) return;
    const placement = won ? 1 : this.bots.filter((b) => b.bot.alive).length + 1;
    this.broadcast({ t: "brend", won, placement });
    this.finishBr(won, placement);
  }

  private finishBr(won: boolean, placement: number): void {
    if (this.brOver) return;
    this.brOver = true;
    this.placement = won ? 1 : Math.max(2, placement);
    this.phase = "matchEnd";
    this.endAt = wallClock() + END_HOLD;
    this.summarise();
  }

  protected override summarise(): void {
    if (this.summarised) return;
    this.summarised = true;
    const now = wallClock();
    const won = this.placement === 1;
    this.lastSummary = {
      won,
      roundsWon: won ? 1 : 0,
      roundsLost: won ? 0 : 1,
      kills: this.kills,
      deaths: this.alive ? 0 : 1,
      damage: this.damage,
      shots: this.shots,
      hits: this.hits,
      placement: this.placement ?? this.botCount + this.players,
      players: this.botCount + this.players,
      survived: now - this.startedAt,
    };
    this.onMatchEnd?.(this.lastSummary);
  }

  /** damage to this player from a bot or the ring (takeHit tells the squad, and the host, when it was the last of us) */
  private hurt(amount: number, from: number, weapon = "", dist: number | null = null): void {
    this.takeHit(amount, from, false, weapon, dist);
  }

  // ------------------------------------------------------------ per frame

  /** a guest: the ring and the end, from the host */
  protected override onExtra(m: NetMsg, from: number): void {
    if (m.t === "loot") {
      const f = this.lootField;
      if (!f) return;
      const key = typeof m.key === "number" && Number.isFinite(m.key) ? m.key : -1;
      const at = Array.isArray(m.at) && m.at.length === 3 && m.at.every((v) => typeof v === "number" && Number.isFinite(v)) ? new THREE.Vector3(...m.at) : null;
      if (this.role === "host") {
        if (m.op === "take" && f.drops.has(key)) {
          f.remove(key);
          this.broadcast({ t: "loot", op: "gone", key, by: from });
        } else if (m.op === "drop" && at) {
          const it = wireItem(m.item);
          if (it) this.dropLoot(it, at);
        }
      } else if (m.op === "gone") {
        const it = f.remove(key);
        if (it && m.by === this.id) this.onLootTaken?.(it);
      } else if (m.op === "add" && at) {
        const it = wireItem(m.item);
        if (it) f.add(it, at, key);
      }
      return;
    }
    if (m.t === "pod") {
      if (this.role !== "host" && Array.isArray(m.at) && m.at.length === 3 && typeof m.lands === "number") this.addPod(new THREE.Vector3(...(m.at as [number, number, number])), Math.max(0, Math.min(30, m.lands)));
      return;
    }
    if (m.t === "ring") {
      this.view = {
        phase: m.ph,
        state: m.st === 1 ? "closing" : m.st === 2 ? "closed" : "waiting",
        timeLeft: m.left,
        current: { cx: m.cur[0], cz: m.cur[1], r: m.cur[2] },
        next: { cx: m.next[0], cz: m.next[1], r: m.next[2] },
      };
      this.aliveSeen = m.alive;
    } else if (m.t === "brend") this.finishBr(m.won, m.placement);
  }

  override update(local: LocalState): void {
    this.lastLocal = local;
    const frameDt = Math.max(0, Math.min(0.1, wallClock() - this.lastClock));
    super.update(local);
    if (this.ended) return;
    const now = wallClock();
    if (this.phase === "matchEnd" && now >= this.endAt) {
      this.leave();
      return;
    }
    // the crates are everyone's to work out and everyone's to claim, so both
    // run here rather than in the host-only tick below
    this.maybeCrate();
    this.updatePods(now);
    this.updateCrateClaim(now, local);
    this.lootField?.update(new THREE.Vector3(local.x, local.y + 1.6, local.z), now);
    // the ring wall, from the host's ring or the mirrored one
    const cur = this.view.current;
    const wall = this.map.ringWall;
    wall.position.set(cur.cx - BR_CENTER.x, 60, cur.cz - BR_CENTER.z);
    wall.scale.set(Math.max(0.01, cur.r), 1, Math.max(0.01, cur.r));
    // a guest hurts itself outside the mirrored ring, on its own tick
    if (this.role === "guest" && this.phase === "fight") {
      this.guestTick += frameDt;
      if (this.guestTick >= RING_TICK) {
        this.guestTick -= RING_TICK;
        if (this.alive && Math.hypot(local.x - cur.cx, local.z - cur.cz) > cur.r) this.hurt(RING_PHASES[Math.min(this.view.phase, RING_PHASES.length - 1)].damage, -1);
      }
    }
    for (const b of this.bots) {
      const s = b.bot.remote.samples;
      s.length = 0;
      s.push({ at: now, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0, ads: 0, act: null });
    }
  }

  /** when the drop began: the landing is only a landing once it has been in the air */
  private dropAt = Infinity;
  protected override respawn(): void {
    super.respawn();
    this.dropAt = wallClock();
  }

  /** the host: the ring, the bots, and what goes out about them */
  protected override tick(now: number, dt: number, local: LocalState): void {
    const ring = this.ring;
    if (!ring || this.brOver) return;
    // the lobby (someone still on the menu): the ring, the care packages and the bots wait for the drop
    if (this.phase === "waiting") return;
    // the drop ends for the host when it lands: the fight is on from then
    if (this.phase === "countdown" && local.stance !== "air" && now - this.dropAt > 1) {
      this.enter("fight", now, 0);
      this.onNotice?.(`LANDED  ·  LAST ${this.team.size === 1 ? "ONE" : "SQUAD"} STANDING WINS`);
    }
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    // the bots that have landed search, then have their gun and a shield of some tier
    for (const b of this.bots) {
      if (!b.landed && b.bot.alive && !b.bot.dropping) {
        b.landed = true;
        // nobody shoots for a moment after a landing, loot or loadouts
        b.armedAt = now + squadCfg.drop.grace + (this.startLoot ? LOOT.botSearch[b.bot.diff.name] * (0.7 + Math.random() * 0.6) : 0);
      }
      if (b.landed && b.armedAt <= now && !b.armedShown && b.bot.alive) {
        // found its gun and a shield of some tier (its health is what it is)
        b.armedShown = true;
        if (this.startLoot) {
          const hp = b.bot.dummy.health;
          b.bot.dummy.setTier((1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3);
          b.bot.dummy.health = hp;
        }
        b.bot.dummy.setGunVisible(true);
        b.bot.remote.shieldMax = b.bot.dummy.shieldMax;
        b.bot.remote.shield = b.bot.dummy.shield;
      }
    }
    // a care package inside the next ring as rounds 2, 3 and 4 close; the
    // squad is told the whole warning, announce and fall, so every screen
    // counts the same arrival down
    if (this.lootField && ring.state === "closing" && ring.phase >= 1 && ring.phase <= 3 && !this.podPhases.has(ring.phase)) {
      this.podPhases.add(ring.phase);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * ring.next.r * 0.6;
      const at = new THREE.Vector3(ring.next.cx + Math.cos(a) * r, 0, ring.next.cz + Math.sin(a) * r);
      const warning = brCfg.pod.announce + LOOT.podFall;
      this.addPod(at, warning);
      this.broadcast({ t: "pod", at: [at.x, at.y, at.z], lands: warning });
    }
    // the ring: a tick hurts everyone outside it (the guests hurt themselves)
    const tick = ring.update(dt);
    this.view = { phase: ring.phase, state: ring.state, timeLeft: Math.max(0, ring.timeLeft), current: { ...ring.current }, next: { ...ring.next } };
    if (tick && this.phase === "fight") {
      if (this.alive && ring.outside(local.x, local.z)) this.hurt(ring.damage, -1);
      for (const b of this.bots) {
        if (!b.bot.alive || b.bot.dropping) continue;
        if (ring.outside(b.bot.pos.x, b.bot.pos.z)) {
          b.bot.dummy.hit(now, "body", ring.damage, 1, 1, b.bot.pos);
          b.bot.remote.health = b.bot.dummy.health;
          b.bot.remote.shield = b.bot.dummy.shield;
          if (b.bot.dummy.knocked) this.botDown(b, -1);
        }
      }
    }
    this.updateSurge(now, tick);
    if (now >= this.ringSendNext) {
      this.ringSendNext = now + 0.5;
      this.broadcast({
        t: "ring",
        ph: ring.phase,
        st: ring.state === "closing" ? 1 : ring.state === "closed" ? 2 : 0,
        left: Math.max(0, ring.timeLeft),
        cur: [ring.current.cx, ring.current.cz, ring.current.r],
        next: [ring.next.cx, ring.next.cz, ring.next.r],
        alive: this.aliveCount,
      });
    }

    // the humans a bot can go after: the host, and the guests where they last were
    const humans: Array<{ id: number; feet: THREE.Vector3 }> = [];
    if (this.alive) humans.push({ id: this.id, feet });
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive) continue;
      const last = r.samples[r.samples.length - 1];
      if (last) humans.push({ id: r.id, feet: new THREE.Vector3(last.x, last.y, last.z) });
    }

    // the bots: sense, walk the graph, fight; their shots are tested here
    for (const b of this.bots) {
      const bot = b.bot;
      const wasAlive = bot.alive;
      const sense = bot.alive && !bot.dropping ? this.sense(b, humans) : { target: null, targetId: -1, goal: null, canShoot: false };
      // still searching: it walks the map and does not shoot
      if (b.armedAt > now) sense.canShoot = false;
      const shots = bot.update(now, dt, sense);
      if (wasAlive && !bot.alive && bot.remote.alive) this.botDown(b, this.id);
      // a frag: drawn here and on the squad's screens; the blast comes back through botBlast
      const th = bot.takeThrow();
      if (th) {
        this.onRemoteFx?.("throw", bot.remote.id, th.from, th.vel, throwCode(th.kind));
        this.broadcast({ t: "fx", from: bot.remote.id, k: "throw", a: [th.from.x, th.from.y, th.from.z], b: [th.vel.x, th.vel.y, th.vel.z], n: throwCode(th.kind) });
      }
      // its own heals show on its plate
      if (bot.alive) {
        bot.remote.health = bot.dummy.health;
        bot.remote.shield = bot.dummy.shield;
      }
      if (!shots.length || this.phase !== "fight") continue;
      if (shots.length && feet.distanceTo(shots[0].from) < 80) this.onRemoteShot?.(shots[0].from);
      // every round for the killcam; one tracer a trigger pull to the squad (a shotgun's pellets are one message)
      for (const s of shots) this.onShotFired?.(bot.remote.id, s.from, s.dir, s.weapon);
      if (this.links.size) this.broadcast({ t: "shot", from: bot.remote.id, o: [shots[0].from.x, shots[0].from.y, shots[0].from.z], d: [shots[0].dir.x, shots[0].dir.y, shots[0].dir.z], w: shots[0].weapon });
      if (sense.targetId < Duel.BOT_ID) {
        const human = humans.find((h) => h.id === sense.targetId);
        if (!human) continue;
        let dealt = 0;
        for (const s of shots) if (hitsBody(s.from, s.dir, human.feet)) dealt += s.damage;
        if (dealt <= 0) continue;
        this.noteDamage(bot.remote.id, dealt);
        const dist = Math.round(bot.pos.distanceTo(human.feet) * 10) / 10;
        if (human.id === this.id) this.hurt(dealt, bot.remote.id, shots[0].weapon, dist);
        else {
          // a guest takes it from the hit message; the figure here is predicted lower
          this.links.get(human.id)?.send({ t: "hit", to: human.id, amount: dealt, head: false, from: bot.remote.id, w: shots[0].weapon, d: dist });
          const r = this.remotes.get(human.id);
          if (r) {
            const toShield = Math.min(r.shield, dealt);
            r.shield -= toShield;
            r.health = Math.max(0, r.health - (dealt - toShield));
          }
        }
      } else {
        const other = this.bots.find((x) => x.bot.remote.id === sense.targetId);
        if (!other || !other.bot.alive) continue;
        for (const s of shots) {
          if (!hitsBody(s.from, s.dir, other.bot.pos)) continue;
          this.noteDamage(bot.remote.id, s.damage);
          other.bot.dummy.hit(now, "body", s.damage, 1, 1, other.bot.pos.clone().setY(other.bot.pos.y + 1.2));
          other.bot.remote.health = other.bot.dummy.health;
          other.bot.remote.shield = other.bot.dummy.shield;
          if (other.bot.dummy.knocked) {
            this.botDown(other, bot.remote.id);
            break;
          }
        }
      }
    }

    // the bots, to the guests, as state packets
    if (this.links.size && now >= this.botSendNext) {
      this.botSendNext = now + 1 / BOT_SEND_HZ;
      for (const b of this.bots) {
        const bot = b.bot;
        const yaw = ((bot.dummy.group.rotation.y - Math.PI) * 180) / Math.PI;
        this.broadcast({
          t: "s",
          from: bot.remote.id,
          x: bot.pos.x,
          y: bot.pos.y,
          z: bot.pos.z,
          yaw,
          pitch: 0,
          crouch: bot.crouching,
          w: b.armedAt <= now ? bot.remote.avatarWeapon : "",
          hp: bot.dummy.health,
          sh: bot.dummy.shield,
          alive: bot.alive,
          op: bot.remote.avatarOp,
          name: bot.remote.name,
          ready: true,
          st: bot.dropping ? 3 : bot.crouching ? 1 : 0,
          sp: bot.alive && !bot.dropping ? Math.round(bot.diff.speed * 10) : 0,
        });
      }
    }
  }

  /** what a bot can see and where it should go */
  private sense(b: BrBot, humans: Array<{ id: number; feet: THREE.Vector3 }>): BotSense {
    const bot = b.bot;
    // the nearest enemy in sight: a human, or another bot
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    let best = Infinity;
    if (this.phase === "fight") {
      for (const h of humans) {
        const d = bot.pos.distanceTo(h.feet);
        if (d < best && bot.sees(h.feet)) {
          best = d;
          target = h.feet;
          targetId = h.id;
        }
      }
    }
    for (const o of this.bots) {
      // its own squad is not a target: in duos and trios the bots land in
      // twos and threes, and they used to shoot each other on the way down
      if (o === b || o.team === b.team || !o.bot.alive || o.bot.dropping) continue;
      const d = bot.pos.distanceTo(o.bot.pos);
      if (d < best && bot.sees(o.bot.pos)) {
        best = d;
        target = o.bot.pos;
        targetId = o.bot.remote.id;
      }
    }
    // the walk: to the next ring's centre when outside it (or when it is
    // closing and this node will be left out), else along the graph
    const nodes = this.map.nodes;
    const ring = this.ring!;
    const outsideNext = Math.hypot(bot.pos.x - ring.next.cx, bot.pos.z - ring.next.cz) > ring.next.r - 4;
    const hurry = outsideNext && (ring.state === "closing" || ring.timeLeft < 25 || ring.outside(bot.pos.x, bot.pos.z));
    let goal: THREE.Vector3 | null;
    // a package coming down near it is worth more than the next node: without
    // this nobody contests one but the squad, and a package nobody contests
    // is a free gold gun rather than an event
    const pod = this.podToContest(bot.pos);
    if (hurry) {
      goal = new THREE.Vector3(ring.next.cx, 0, ring.next.cz);
    } else if (pod) {
      goal = pod;
    } else {
      const here = nodes[b.goal];
      if (Math.hypot(here.x - bot.pos.x, here.z - bot.pos.z) < 3) {
        // arrived: a linked node inside the next ring, at random
        b.node = b.goal;
        const options = here.links.filter((i) => Math.hypot(nodes[i].x - ring.next.cx, nodes[i].z - ring.next.cz) <= ring.next.r + 20);
        const pick = options.length ? options[Math.floor(Math.random() * options.length)] : here.links[Math.floor(Math.random() * here.links.length)];
        b.goal = pick ?? b.goal;
      }
      const g = nodes[b.goal];
      goal = new THREE.Vector3(g.x, 0, g.z);
    }
    return { target, targetId, goal, canShoot: this.phase === "fight" && !this.holdFire, urgent: hurry };
  }

  // ------------------------------------------------------------ the HUD

  override hud(): DuelHud {
    const base = super.hud();
    const now = wallClock();
    const v = this.view;
    const local = this.lastLocal;
    const br: BrHud = {
      alive: this.aliveCount,
      total: this.botCount + this.players,
      kills: this.kills,
      dropping: this.phase === "countdown",
      poi: this.poi.name,
      ring: {
        phase: Math.min(v.phase + 1, RING_PHASES.length),
        phases: RING_PHASES.length,
        closing: v.state === "closing",
        timeLeft: v.timeLeft,
        current: { ...v.current },
        next: { ...v.next },
        outside: local ? Math.hypot(local.x - v.current.cx, local.z - v.current.cz) > v.current.r : false,
        damage: RING_PHASES[Math.min(v.phase, RING_PHASES.length - 1)].damage,
      },
      placement: this.phase === "matchEnd" ? this.placement : null,
      survived: now - this.startedAt,
      pois: this.map.pois.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      bounds: { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF },
      team: this.team.size,
      squads: this.squadsAlive,
      towers: this.map.towers,
      beacons: this.map.beacons,
      pods: this.podSpots,
      // solo: there is no squad, so the squad panel has nothing to collapse to
      mates:
        this.team.size === 1
          ? []
          : [...this.remotes.values()]
              .filter((r) => r.id < Duel.BOT_ID && r.samples.length)
              .map((r) => {
                const s = r.samples[r.samples.length - 1];
                return { x: s.x, z: s.z, name: r.name, downed: r.downed, alive: r.alive };
              }),
      surge:
        this.surgeAt === Infinity
          ? null
          : {
              live: this.surgeSince < Infinity,
              startsIn: Math.max(0, this.surgeAt - now),
              damage: surgeDamage(this.surgeSince < Infinity ? now - this.surgeSince : 0),
              safe: this.surgeSafe,
              below: this.surgeBelow,
            },
      crate: this.crateProgress,
    };
    return {
      ...base,
      you: this.kills,
      them: 0,
      left: this.phase === "matchEnd" ? Math.max(0, this.endAt - now) : 0,
      youWonMatch: this.phase === "matchEnd" ? this.placement === 1 : null,
      // the squad, humans only
      players: base.players.filter((p, i) => i === 0 || [...this.remotes.values()].find((r) => r.name === p.name && r.id < Duel.BOT_ID)),
      summary: this.phase === "matchEnd" && this.lastSummary ? { ...this.lastSummary, streak: this.streak } : null,
      br,
    };
  }

  private lastLocal: LocalState | null = null;

  /** the humans (Duel's), and on the host the bots it runs: the killcam's recording */
  override actorStates(): ActorState[] {
    const out = super.actorStates();
    for (const b of this.bots) {
      const bot = b.bot;
      const p = bot.dummy.currentPose;
      out.push({ id: bot.remote.id, name: bot.remote.name, x: bot.pos.x, y: bot.pos.y, z: bot.pos.z, yaw: ((bot.dummy.group.rotation.y - Math.PI) * 180) / Math.PI, pitch: p.pitch, stance: p.stance, speed: p.speed, weapon: bot.remote.avatarWeapon, op: bot.remote.avatarOp, alive: bot.alive });
    }
    return out;
  }

  override vitalsFor(id: number): { shield: number; health: number } | null {
    const b = this.bots.find((x) => x.bot.remote.id === id);
    return b ? { shield: b.bot.dummy.shield, health: b.bot.dummy.health } : super.vitalsFor(id);
  }

  /** out with others still up: a squad mate first, else the nearest bot */
  override spectateTarget(): Dummy | null {
    if (this.alive || this.phase !== "fight") return null;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive && r.samples.length) return r.avatar;
    let best: Dummy | null = null;
    let bd = Infinity;
    const me = this.lastLocal;
    for (const a of this.avatars) {
      if (a.knocked || !a.group.visible || !me) continue;
      const d = Math.hypot(a.group.position.x - me.x, a.group.position.z - me.z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  override leave(): void {
    if (this.ended) return;
    const placed = this.placement;
    for (const l of this.links.values()) l.close();
    this.hostLink?.close();
    this.dispose();
    this.finish(placed === 1 ? "The squad won the battle royale." : placed ? `You placed #${placed} of ${this.botCount + this.players}.` : "You left the battle royale.");
  }

  override dispose(): void {
    for (const b of this.bots) b.bot.dispose();
    this.bots = [];
    this.lootField?.dispose();
    for (const p of this.pods) {
      p.obj.removeFromParent();
      p.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      // the smoke and the dust are the scene's, not the pod's, so that they
      // stay where they were made while the pod goes on falling. Only their
      // materials are theirs: the puffs share one geometry with every pod.
      p.trail.removeFromParent();
      for (const puff of p.trail.children as THREE.Mesh[]) (puff.material as THREE.Material).dispose();
      if (p.dust) {
        p.dust.removeFromParent();
        p.dust.geometry.dispose();
        (p.dust.material as THREE.Material).dispose();
      }
    }
    this.pods = [];
    this.map.ringWall.scale.set(0.01, 1, 0.01);
    super.dispose();
  }
}

export { HEALTH_MAX, SHIELD_MAX };
