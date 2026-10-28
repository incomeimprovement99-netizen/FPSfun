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
//   the squad size   solo, duos or trios, the host's for everyone (the
//                    welcome carries it). It decides who is on your side and
//                    how the bots are grouped, so a solo match is a lobby of
//                    singles rather than a trio match with gaps in it. The
//                    humans are always one side whatever the size: it is
//                    the bots that come in squads.
//   care packages    called before they arrive, marked where they will land,
//                    trailing smoke under a canopy, and lit and pinged for a
//                    while after the thump so there is a window to fight over
//                    one. Bots go for them too.
//   the dropship     the match starts on a ship flying a line across the
//                    map (dropship.ts); you jump when you like, a squad
//                    follows its jumpmaster, and the bots leave it as it
//                    passes their places and glide down onto them.
//   the Gulag        under the battle royale's own rules, a first death
//                    goes to a 1v1 in an arena against a bot of your own
//                    (gulag.ts): win and you drop back in, lose and you are
//                    out. The host only hears you are in it, so your squad
//                    is not out and its bots leave you be.
//
// The legacy game's loadout crates, Ring Consoles, Storm Surge and keycard
// vault went in Milestone 524: SpeedKills ran none of them.
import { decayPlan, decayRounds, sectorPhases, captureOpens, sectorIdAt, SECTOR_RECTS, centreOf, type DecayPlan, type SectorPhase } from "./decay";
import { paidProp } from "./paidgun";
import decayCfg from "../config/decay.json";
import { PROFILE } from "./game";
import type { Seen } from "./reveal";
import moveCfg from "../config/movement.json";
import { MOVE } from "./movement";
import { ZIPLINES } from "./traversal";
import type { Doors } from "./doors";
import doorsCfg from "../config/doors.json";
import { senderStamp } from "../net/state";
import * as THREE from "three";
import squadCfg from "../config/squad.json";
import brCfg from "../config/br.json";
import { Bot, BODY_TOP, BOT_NAMES, MOST_BOTS, botName, BOT_WEAPONS, CROUCH_TOP, DIFFICULTY, hitsBody, rocketBurst, tierFor, type BotSense, type SightCue, WIRE_TIERS, type BotKit, type BotTier, type BurstHurts } from "./bots";
import botsCfg from "../config/bots.json";
import { solidsIn } from "./solidgrid";
import { floorAt } from "./floors";
/**
 * The nearest point to (x, z) where a body stands clear of every box at body
 * height: walls, rock, crates. Floor slabs and roofs are not in the way. The
 * rings stop at 40 m, which no place on the map needs, and the spot asked for
 * comes back if nothing clear is found rather than no spot at all.
 */
/**
 * Over a hole in the street: the metro's floor under it (floors.ts) and no street's slab over that, a stairwell's
 * opening, a body's width round it. A spot there would put a pod or a landing in the air over the stair.
 */
function overHole(px: number, pz: number): boolean {
  const pad = 0.7;
  for (const [ox, oz] of [
    [0, 0],
    [-pad, -pad],
    [pad, -pad],
    [-pad, pad],
    [pad, pad],
  ]) {
    const x = px + ox;
    const z = pz + oz;
    if (floorAt(x, z) < -0.05 && !solidsIn(x, x, z, z).some((s) => Math.abs(s.top) < 0.05 && x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ)) return true;
  }
  return false;
}

function clearGround(x: number, z: number): { x: number; z: number } {
  const pad = 0.7;
  const blocked = (px: number, pz: number): boolean =>
    overHole(px, pz) || solidsIn(px - pad, px + pad, pz - pad, pz + pad).some((s) => s.base < 1.8 && s.top > 0.56 && px > s.minX - pad && px < s.maxX + pad && pz > s.minZ - pad && pz < s.maxZ + pad);
  if (!blocked(x, z)) return { x, z };
  for (let r = 1; r <= 40; r += 1) {
    for (let k = 0; k < 16; k++) {
      const px = x + Math.cos((k / 16) * Math.PI * 2) * r;
      const pz = z + Math.sin((k / 16) * Math.PI * 2) * r;
      if (!blocked(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/**
 * The nearest point to (x, z) that is clear at body height AND open to the
 * sky: somewhere a body coming down from the ship can land. clearGround lets
 * a spot sit under a roof, which is right for someone who walks there and
 * wrong for someone who falls there, since they land on the roof instead.
 */
function openGround(x: number, z: number): { x: number; z: number } {
  const pad = 0.7;
  // (the boxes near, from the solid grid: up to 640 tries a landing over all of the Neon map's 79,000 boxes was a third of
  // a second of the battle royale's start, 2026-10-04; the same boxes, as the test is the same)
  const covered = (px: number, pz: number): boolean => overHole(px, pz) || solidsIn(px - pad, px + pad, pz - pad, pz + pad).some((s) => s.top > 0.56 && px > s.minX - pad && px < s.maxX + pad && pz > s.minZ - pad && pz < s.maxZ + pad);
  if (!covered(x, z)) return { x, z };
  for (let r = 1; r <= 40; r += 1) {
    for (let k = 0; k < 16; k++) {
      const px = x + Math.cos((k / 16) * Math.PI * 2) * r;
      const pz = z + Math.sin((k / 16) * Math.PI * 2) * r;
      if (!covered(px, pz)) return { x: px, z: pz };
    }
  }
  return clearGround(x, z);
}

/** a bot goes only for loot within this height of its feet (src/config/bots.json loot.floor) */
const BOT_LOOT_FLOOR = botsCfg.loot.floor;
import { actCode, airborne, type Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { navTree, reachedFrom, type NavTree } from "./navgraph";
import { DISTRICT_HOLDS, ROOF_ROUTES, SPIRE_TOP } from "./world";
import { Ring, RING_ATTRACTORS, RING_PHASES, RING_TICK, ringPace, type Circle, type RingPhase } from "./ring";
import { GULAG, Gulag, gulagFor, type GulagEvent } from "./gulag";
import { arenaMap } from "./arena";

/** a bot squad's key in the capture zone's reckoning, apart from the players' sides */
const CAPTURE_BOT = 100;

/** the Gulag's bot, apart from the match's (theirs start at Duel.BOT_ID) */
const GULAG_BOT_ID = 990;
import { BR_BOUNDS, BR_CENTER, BR_HALF, BR_X, BR_Z, type BrMap, type Poi } from "./br";
import { SHIP, ShipRun, buildShip, shipLine, type ShipLine } from "./dropship";

/** the ring's own stream off the match seed, so the loot field's and the ship's draws do not shift it */
const RING_SALT = 0x2545f491;
import { Duel, HEALTH_MAX, SHIELD_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";
import type { ActorState } from "./killcam";
import brmapCfg from "../config/brmap.json";
/** bot squads acting as squads (bots.json squads) */
const SQUADS = botsCfg.squads;
import { LootField, LOOT, deathDropOf, seeded, speedkillsPackage, type LootItem, type LootKind, type Rarity } from "./loot";
import { causeName, EDGE_ID } from "./causes";
import { EDGE } from "./edge";
import { LIFE_WIRE } from "./squadview";

/** how high the drop starts */
export const DROP_HEIGHT = 90;

/** solo, duos or trios: one row of src/config/br.json's teams */
export interface TeamMode {
  id: string;
  /** how many share a squad */
  size: number;
  label: string;
  /** the bot counts the lobby offers in this size, each a whole number of bot squads */
  bots: readonly number[];
  defaultBots: number;
}

// SpeedKills' own sizes: up to 30 in a match
export const TEAMS: readonly TeamMode[] = PROFILE.match.teams ? PROFILE.match.teams : brCfg.teams;

/** the size a lobby or a welcome packet names, and the default when it names none we know */
export function teamFor(id: string | null | undefined): TeamMode {
  return TEAMS.find((t) => t.id === id) ?? TEAMS.find((t) => t.id === brCfg.defaultTeam) ?? TEAMS[TEAMS.length - 1];
}

/**
 * where the lobby's squad size is kept in this browser (the menu writes it, a match alone reads it); SpeedKills' own
 * key from when the legacy game kept another, so nobody loses their choice
 */
const TEAM_KEY = "range.br.team.sk";

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

/**
 * How many squads this many bots make at a size, a part-full last one
 * counted. The humans are a squad of their own on top of these: nothing fills
 * their empty seats, which is why the lobby row only offers whole ones.
 */
export function botSquads(bots: number, size: number): number {
  return Math.ceil(Math.max(0, bots) / Math.max(1, size));
}

/** every squad in a match at its start: the bots', and the humans' (in solo each human is their own) */
export function squadsInMatch(bots: number, size: number, humans: number, split = false): number {
  return botSquads(bots, size) + humanSides(size, humans, split);
}

/** how many sides the humans make: each their own in solo, squads of the size when split, else one */
export function humanSides(size: number, humans: number, split: boolean): number {
  const n = Math.max(1, humans);
  return size === 1 ? n : split ? Math.ceil(n / size) : 1;
}

/** a human's side by id (ids are handed out in join order): their own in solo, their squad of the size when split, else all one */
export function sideOfHuman(id: number, size: number, split: boolean): number {
  return size === 1 ? id : split ? Math.floor(id / size) : 0;
}

/**
 * A pod's ping carries an id of its own, below every player's and the
 * ring's -1. The ping path keeps one ping per sender, so a package pinged as
 * this player replaced their own ping, and a crate called on the same frame
 * as a package replaced the package's.
 */
const POD_MARK = -1000;

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
  /**
   * The hot zone: the place this match kitted out (loot.ts pickHotZone). It
   * was drawn from the seed and filled with built guns from the first match
   * the loot field existed, and nothing ever showed it, so it was a secret the
   * game kept from everyone in it. The map draws it and the drop says its name.
   */
  hot: { name: string; x: number; z: number; radius: number } | null;
  /** where you finished once it is over (1 = the win) */
  placement: number | null;
  survived: number;
  pois: Array<{ name: string; x: number; z: number }>;
  /** the small sites between the places, named smaller on the map */
  sites: Array<{ name: string; x: number; z: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** how many share a squad (1 solo, 2 duos, 3 trios), how many squads are still up, and how many there were: the card's placement is out of those */
  team: number;
  squads: number;
  squadsTotal: number;
  /** jump towers, care packages, for the maps */
  towers: Array<{ x: number; z: number }>;
  /** the care packages; `hot` is still worth contesting */
  pods: Array<{ x: number; z: number; landed: boolean; hot: boolean }>;
  /** the squad mates, for the maps: where, their name, down or out */
  mates: Array<{ id: number; x: number; z: number; name: string; alive: boolean }>;
  /** the Gulag, while you are in it or on your way: the phase, its clock, your opponent, and the flag's two counts in overtime */
  gulag: { phase: string; clock: number; opponent: string; capMe: number; capThem: number; capture: number } | null;
}

/** the heir's snapshot of a battle royale (BrMatch.snapshotMode); times are seconds from when it was made, null for never */
interface BrSnap {
  b: Array<{
    i: number;
    t: number;
    tm: number;
    sl: number;
    n: number;
    g: number;
    ar: number | null;
    as: boolean;
    al: boolean;
    k: BotKit;
    dt: [number, number];
  }>;
  ps: number;
  pp: number[];
  pl: Array<[number, number]>;
  nk: number;
}

/** a snapshot as it came over the wire: its well formed parts only, or null (PeerJS packs an absent value as null) */
function readBrSnap(v: unknown): BrSnap | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  const numOrNull = (x: unknown): x is number | null => x === null || x === undefined || num(x);
  const b = (Array.isArray(o.b) ? o.b : []).filter((r): r is BrSnap["b"][number] => {
    if (!r || typeof r !== "object") return false;
    const x = r as Record<string, unknown>;
    const k = x.k as Record<string, unknown> | null;
    return num(x.i) && x.i >= 0 && x.i < 64 && num(x.t) && num(x.tm) && num(x.sl) && num(x.n) && num(x.g) && numOrNull(x.ar) && typeof x.as === "boolean" && typeof x.al === "boolean"
      && !!k && typeof k === "object" && (k.gunId === null || typeof k.gunId === "string") && num(k.gun) && num(k.armor)
      && Array.isArray(x.dt) && x.dt.length === 2 && x.dt.every(num);
  }).map((r) => ({ ...r, ar: r.ar ?? null }));
  const pairs = (Array.isArray(o.pl) ? o.pl : []).filter((r): r is [number, number] => Array.isArray(r) && r.length === 2 && r.every(num));
  return {
    b,
    ps: num(o.ps) ? o.ps : 0,
    pp: (Array.isArray(o.pp) ? o.pp : []).filter(num),
    pl: pairs,
    nk: num(o.nk) ? o.nk : 1,
  };
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
  /** its place in its squad: the second and third leave the ship a moment after the first */
  slot: number;
  /** where it lands: its place, open to the sky */
  dropTo: { x: number; z: number };
  /** when it leaves the ship (performance.now() seconds) */
  jumpAt: number;
  /** where it came down (the tests: a glide lands on its place) */
  landedAt?: { x: number; z: number };
  /** the route's next step is a rope to here (br.ts node ropes): the bot rides rather than walks it */
  ropeTo?: { x: number; z: number } | null;
  /** the care packages it has been to once they were down (podToContest): contested, and not walked back to */
  podsDone?: Set<number>;
  /** SpeedKills: taking the high ground, a low tower's roof node, and holding it until (bots.json skRoofs) */
  climb?: { roof: number; holdUntil: number | null } | null;
}

/** a care package: called, on its way down, or landed */
interface Pod {
  id: number;
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
}

/** one puff of the falling pod's smoke; shared, because every pod draws dozens */
const PUFF_GEO = new THREE.SphereGeometry(brCfg.pod.trail.radius, 8, 6);

const BR_BOUNDS_WORLD = { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF };
const RARITIES = ["common", "rare", "epic", "legendary"];
// every kind loot.ts can make (a kind left out here is thrown away when it comes over the wire); typed, so a kind
// loot.ts no longer makes is an error here rather than a name nobody checks
const KINDS: readonly LootKind[] = ["weapon", "echo", "hack"];

/** a loot item from another browser, checked field by field */
function wireItem(x: unknown): LootItem | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  if (typeof o.kind !== "string" || !(KINDS as readonly string[]).includes(o.kind) || typeof o.id !== "string" || o.id.length > 40) return null;
  const n = typeof o.n === "number" && Number.isFinite(o.n) ? Math.max(0, Math.min(500, Math.floor(o.n))) : 1;
  const rarity = typeof o.rarity === "string" && RARITIES.includes(o.rarity) ? (o.rarity as Rarity) : "common";
  const it: LootItem = { kind: o.kind as LootKind, id: o.id, n, rarity };
  if (typeof o.owner === "number") it.owner = o.owner;
  if (typeof o.ownerName === "string") it.ownerName = o.ownerName.replace(/[\p{Cc}<>&"'`]/gu, "").slice(0, 16);
  // SpeedKills: a gun's fusion level
  if (typeof o.fusion === "number" && Number.isFinite(o.fusion)) it.fusion = Math.max(0, Math.min(5, Math.floor(o.fusion)));
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
  private ring: Ring | null;
  private view: RingView;
  /** SpeedKills' decay (decay.ts): the final sector and the waves, from the seed */
  decay: DecayPlan | null = null;
  /** the final sector's circle, where every round closes to and the bots run */
  private decayCircle: Circle | null = null;
  /** the capture zone: which squad is in it alone (a human side, or 100 + a bot squad; -1 none), their seconds held, and whether it is open */
  capture: { holder: number; held: number; open: boolean; progress: Map<number, number> } = { holder: -1, held: 0, open: false, progress: new Map() };

  /** SpeedKills: the restores this player has had this match (two at most) */
  restores = 0;
  /** SpeedKills: squad mates with no restores left: their boxes are not offered */
  readonly noRestores = new Set<number>();

  /**
   * SpeedKills: this player is a ghost: out, with a squad mate still up, not
   * in the Gulag, and a restore left (PROFILE.life). A ghost moves, pings and
   * sees; it does not shoot, pick up or use hacks, and enemies do not see it.
   * The mate is squadUp's, one of your own side: any human still up counted
   * before, so in solo with a friend, or with friends split into squads, a
   * player out with only an opponent standing was left a ghost nobody could
   * restore, instead of out and watching.
   */
  get ghost(): boolean {
    return !!this.decay && !this.alive && !this.gulag && this.phase === "fight" && this.restores < PROFILE.life.ghostRevives && this.squadUp();
  }

  /**
   * SpeedKills' restore rule, for the squad mate holding interact at a
   * ghost's echo (where it fell): the full restore takes reviveSeconds, and
   * fills at a third of the pace (awaySlowdown) while the ghost is further
   * than followRadius from the one restoring it: stay with your teammate to
   * be restored faster.
   */
  ghostNear(owner: number, from: THREE.Vector3): { near: boolean; rate: number; need: number } {
    const L = PROFILE.life;
    const r = this.remotes.get(owner);
    const last = r?.samples[r.samples.length - 1];
    const near = !!last && Math.hypot(last.x - from.x, last.z - from.z) <= L.followRadius && Math.abs(last.y - from.y) <= L.followRadius;
    return { near, rate: near ? 1 : 1 / L.awaySlowdown, need: L.reviveSeconds };
  }

  /** where every sector stands, from the ring as this page has it */
  sectorStates(): Record<string, { phase: SectorPhase; k: number }> {
    if (!this.decay) return {};
    return sectorPhases(this.decay, this.view, (p) => this.phases[Math.min(p, this.phases.length - 1)]);
  }

  /** a spot the decay has reached (world space): a decaying or decayed sector; the legacy game's ring otherwise */
  lostAt(x: number, z: number): boolean {
    if (!this.decay) return false;
    // past the city's edge (SpeedKills' band, edge.ts) it is the sector beside you: the band has no decay of its own
    const id = sectorIdAt(Math.max(-BR_HALF, Math.min(BR_HALF, x - BR_X)), Math.max(-BR_HALF, Math.min(BR_HALF, z - BR_Z)));
    if (!id) return true;
    const st = this.sectorStates()[id];
    return st.phase === "decaying" || st.phase === "gone";
  }

  /** SpeedKills: past the city's edge too long (edge.ts): the laser's kill, through any shield or ARMOR, never a knock */
  outOfBounds(): void {
    if (!this.alive || this.phase !== "fight") return;
    this.shield = 0;
    this.health = 0;
    this.lastHitMelee = false;
    this.eliminate(EDGE_ID, "knocked");
  }

  /** the capture zone's middle and reach (world space), or null before it opens or in the legacy game */
  captureZone(): { x: number; z: number; r: number } | null {
    if (!this.decay || !this.decayCircle || !captureOpens(this.decay, this.view.phase)) return null;
    return { x: this.decayCircle.cx, z: this.decayCircle.cz, r: decayCfg.capture.radius };
  }
  private guestTick = 0;
  private aliveSeen: number;
  private readonly startedAt: number;
  private placement: number | null = null;
  /** when this player's match ended (finishBr): the end card's time survived stops there, not at the menu (Milestone 708) */
  private finishedAt: number | null = null;
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
  /** friends in squads of the size against each other (the host's choice, in the welcome), not one side */
  readonly split: boolean;
  /** every squad at the start, the humans' included: what a placement is out of */
  squadsTotal: number;
  /** a guest: the squads still up, as the host's ring packet last said (a guest runs no bots to count) */
  private squadsSeen: number;
  /** the match seed: the loot, the ring, the ship and the hour are all drawn from it */
  readonly seed: number;
  /** the dropship's line, from the seed and the squad's place (null: the drop goes straight onto the place, which the tests ask for) */
  readonly shipLine: ShipLine | null;
  /** this browser's flight along the line, from the start of its drop */
  ship: ShipRun | null = null;
  private shipModel: { group: THREE.Group; setDoors(open: boolean): void } | null = null;
  /** the ship is handed to main once, at the start of the drop */
  private boardingTaken = false;
  private botsLaunched = false;
  /** the ring's rounds as this match runs them */
  readonly phases: readonly RingPhase[];
  /** the Gulag, from your death to your way back or out (gulag.ts); null when you are not in it */
  gulag: Gulag | null = null;
  /** your opponent in it: a bot of your own that nobody else sees */
  gulagBot: Bot | null = null;
  /** one trip a match */
  private gulagUsed = false;
  /** the Gulag is on in this match (only the tests of the plain death turn it off) */
  private readonly gulagOn: boolean;
  /** the host: players in the Gulag or on their way to it (their side is not out, and the match's bots leave them be) */
  private gulagIds = new Set<number>();
  /** the overtime flag in the room's middle */
  private gulagFlag: THREE.Group | null = null;
  /** for main, once each: the room's spawn to put you in, and the guns you fought with, handed back as you drop in again */
  private gulagEntry: { x: number; z: number; yaw: number; guns: [string, string] } | null = null;
  private gulagKit: [string, string] | null = null;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    private readonly map: BrMap,
    difficulty: BotDifficulty,
    botCount: number,
    opts: { players: number; myId: number; link: Link | null; guestId?: number; poi?: string; seed?: number; start?: "loot" | "loadout"; team?: string; ship?: boolean; pace?: string; gulag?: boolean; split?: boolean },
    rng: () => number = Math.random
  ) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "br" });
    this.difficulty = difficulty;
    this.botCount = Math.max(1, Math.min(MOST_BOTS, botCount));
    // The squad size is the host's for everyone: a guest that ran its own
    // would revive in a lobby where nobody else believes in revives. Alone
    // there is no host and no welcome packet, so the lobby row's own choice
    // is read here instead.
    this.team = teamFor(opts.team ?? (opts.players <= 1 ? savedTeamId() : undefined));
    this.split = opts.split === true && this.team.size > 1;
    this.squadsTotal = squadsInMatch(this.botCount, this.team.size, this.players, this.split);
    this.squadsSeen = this.squadsTotal;
    this.seed = opts.seed ?? 1;
    const area = { cx: BR_CENTER.x, cz: BR_CENTER.z, r: BR_HALF * 1.35 };
    this.area = area;
    // every door shut, as a match starts
    map.doors.reset();
    // the squad drops on one place: the host's pick, told to the guests
    const poi = (opts.poi && map.pois.find((p) => p.id === opts.poi)) || map.pois[Math.floor(rng() * map.pois.length)];
    this.poi = poi;
    // the ship's line passes over it, and every browser draws the same one
    // SpeedKills' ship always passes the Spire, near enough to glide onto its crown (the owner, 2026-09-27: "the drop
    // ship should always go over the middle district ... we should be always able to land at the top middle building")
    const beside = SPIRE_TOP.y > 0 ? PROFILE.ship?.centre : undefined;
    this.shipLine = opts.ship === false ? null : beside ? shipLine(this.seed, SPIRE_TOP, BR_BOUNDS, beside) : shipLine(this.seed, this.poi, BR_BOUNDS);
    const now = wallClock();
    this.startedAt = now;
    this.aliveSeen = this.botCount + this.players;
    const start = area;
    // the tests of the plain death switch it off; a real match always has it
    this.gulagOn = opts.gulag !== false;
    // the ring's clock at the lobby's own pace: how long a match should be
    this.phases = ringPace(RING_PHASES, opts.pace ?? "normal");
    // SpeedKills: the decay's waves are the rounds, and every round closes to the final sector's middle. At the lobby's
    // pace too: the Ring box under Adjust settings, and the pace on the loading card, changed nothing here when the
    // waves were taken as they stood (found 2026-10-05, when the e2e moved onto SpeedKills)
    this.decay = decayPlan(this.seed);
    this.phases = decayRounds(opts.pace ?? "normal");
    // (the sectors as the map in play has them, decay.ts SECTOR_RECTS: a sector's own middle and reach where it names them)
    const f = SECTOR_RECTS.find((s) => s.id === this.decay!.final)!;
    const mid = centreOf(f.id);
    this.decayCircle = { cx: BR_X + mid.x, cz: BR_Z + mid.z, r: f.reach ?? Math.min(f.maxX - f.minX, f.maxZ - f.minZ) / 2 };
    map.ringWall.visible = false;
    // The floor's loot, from the host's seed (the welcome carries it). The start decides only what you land
    // holding: SpeedKills' floor has its loot either way, since fusing and changing guns is looting (the
    // owner could not loot, fuse or swap a gun after landing with a loadout).
    this.startLoot = opts.start !== "loadout";
    this.lootField = new LootField(scene);
    this.lootField.generate(
      this.seed,
      map.pois.map((p) => ({ x: p.x, z: p.z, id: p.id, radius: p.radius })),
      BR_BOUNDS_WORLD,
      map.sites.map((s) => ({ x: s.x, z: s.z, id: s.id, radius: s.radius ?? brmapCfg.siteRadius, y: s.y, tier: s.tier }))
    );
    if (this.role === "host") {
      // The bots take the OTHER places: where the squad drops is the squad's.
      // Landing beside three of them with no gun was the whole of a match.
      const others = map.pois.filter((p) => p !== this.poi && this.inArea(p)).sort(() => rng() - 0.5);
      let order = others.length ? others : [this.poi];
      // SpeedKills: the centre is the hottest drop, and the bots go there the
      // most (the owner): every other bot squad drops on the Spire, the rest
      // spread over the other sectors
      const spire = map.pois.find((p) => p.id === "c");
      const rest = order.filter((p) => p !== spire);
      if (spire) order = rest.length ? rest.flatMap((p) => [spire, p]) : [spire];
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
        // A ring round a drop point can cross a building or the ridge's rock,
        // and a bot put down inside a box is boxed in for the whole match: a
        // probe found one standing in the East Ridge's first step for 40 s,
        // unarmed. The spot is walked out to the nearest clear ground.
        const clear = clearGround(drop.x + Math.cos(a) * r, drop.z + Math.sin(a) * r);
        const spawn = { x: clear.x, z: clear.z, yaw: rng() * 360 };
        // each its own tier: "mixed" draws one per bot
        const bot = this.makeBot(i, tierFor(difficulty, rng), spawn);
        const node = this.nearestNode(spawn.x, spawn.z);
        // it comes down from the sky, so it lands somewhere with no roof over it
        const dropTo = openGround(spawn.x, spawn.z);
        this.bots.push({ bot, node, goal: node, armedAt: Infinity, landed: false, team: squad, slot: i % this.team.size, dropTo, jumpAt: Infinity });
      }
      this.ring = new Ring(start, seeded((this.seed ^ RING_SALT) >>> 0), RING_ATTRACTORS, this.phases, this.decayCircle ?? undefined);
      this.view = { phase: 0, state: "waiting", timeLeft: this.phases[0].wait, current: { ...this.ring.current }, next: { ...this.ring.next } };
    } else {
      this.ring = null;
      this.view = { phase: 0, state: "waiting", timeLeft: this.phases[0].wait, current: start, next: start };
    }
  }

  /** one of the match's bots: the host's, at the start, or the heir's, in place of the figure it saw (host migration) */
  private makeBot(i: number, tier: BotTier, spawn: Spawn, name = botName(i)): Bot {
    const scene = this.scene;
    const projectiles = this.projectiles;
    const bot = new Bot(i, scene, projectiles, DIFFICULTY[tier], spawn, Duel.BOT_ID + i, BOT_WEAPONS[i % BOT_WEAPONS.length], name);
    bot.onRocket = (at, travelled, w) => this.botBurst(bot.remote.id, rocketBurst(w, at, travelled), w.id);
    // Its eyes are the battle royale's. A bot nobody tells keeps the arena's
    // 55 to 70 m, which was right for a 40 m room and blind on a map
    // 440 m across (bots.ts sightRange, src/config/bots.json sight).
    bot.sightMode = "br";
    // SpeedKills: the map's bots keep to the city; only a player strays past its edge (edge.ts)
    bot.fence = BR_BOUNDS;
    // With a loot start it lands with nothing and LOOTS for its kit, rather
    // than waiting out a timer and being handed one: a bot that landed
    // somewhere rich is really better armed than one that landed in a field.
    // It holds its fire until it has found a gun (bot.holdingFire). The start,
    // not the floor, decides it: a SpeedKills loadout start has loot on its
    // floor and still lands its bots armed.
    if (this.startLoot) {
      bot.dummy.setGunVisible(false);
      const field = this.lootField;
      if (field) {
        bot.lootSource = {
          // Only what is on the bot's own floor. A bot cannot jump or
          // climb, so an item on the floor above can be a metre away across
          // the ground and still out of reach for ever: it stood under one,
          // gave it up, picked the next one up there, and never moved.
          near: (at, r) => [...field.drops.values()].filter((d) => d.item.kind !== "echo" && Math.abs(d.pos.y - at.y) <= BOT_LOOT_FLOOR && d.pos.distanceTo(at) <= r),
          take: (key) => {
            const it = field.remove(key);
            // the squad's fields drop an item only on this message, so
            // without it a bot's pickups would stay on every other screen;
            // and the heir hears of it soon, or a takeover loses the item
            if (it) {
              this.broadcast({ t: "loot", op: "gone", key, by: bot.remote.id });
              this.heirSoon();
            }
            return it;
          },
        };
      }
    }
    // a bot's JOLT: drawn here and sent to the squad
    bot.onJolt = (a, b) => {
      this.onRemoteFx?.("jolt", bot.remote.id, a, b);
      this.broadcast({ t: "fx", from: bot.remote.id, k: "jolt", a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] });
    };
    // its HEAL, drawn here and sent to the squad, as a player's (Milestone 702)
    bot.onHeal = (at) => {
      this.onRemoteFx?.("sk", bot.remote.id, at, undefined, 3);
      this.broadcast({ t: "fx", from: bot.remote.id, k: "sk", a: [at.x, at.y, at.z], n: 3 });
    };
    return bot;
  }

  /** the round the ring is on (0-based; the host's, or what its last packet said) */
  private get ringPhase(): number {
    return this.view.phase;
  }

  /** a restore's beam and hum: "high risk", heard twice as far as a shot */
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

  /** a bot has a gun in its hands: past the landing grace, and with loot on, one it has actually found */
  private botArmed(b: { bot: Bot; armedAt: number }, now: number): boolean {
    if (b.armedAt > now) return false;
    return !this.startLoot || b.bot.lootKit.gunId !== null;
  }

  /** a bot's burst (its frag's, its rocket's): everyone it reaches but its own squad takes what `hurts` says, from gun `w` */
  botBurst(owner: number, hurts: BurstHurts, w: string): void {
    if (this.role !== "host" || this.phase !== "fight") return;
    const thrower = this.bots.find((x) => x.bot.remote.id === owner);
    if (!thrower) return;
    const now = wallClock();
    // the squad: this player, and the guests by their last state
    if (this.alive && this.lastLocal) {
      const f = new THREE.Vector3(this.lastLocal.x, this.lastLocal.y, this.lastLocal.z);
      const d = hurts(f, this.lastLocal.crouch);
      if (d > 0) {
        this.hurt(d, owner, w, Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10);
      }
    }
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive) continue;
      const s = r.samples[r.samples.length - 1];
      if (!s) continue;
      const f = new THREE.Vector3(s.x, s.y, s.z);
      const d = hurts(f, s.stance === "crouch" || s.stance === "slide");
      if (d <= 0) continue;
      const dist = Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10;
      this.links.get(r.id)?.send({ t: "hit", to: r.id, amount: d, head: false, from: owner, w, d: dist });
      const toShield = Math.min(r.shield, d);
      r.shield -= toShield;
      r.health = Math.max(0, r.health - (d - toShield));
    }
    // the other bots, its own squad excepted: a frag that killed the two it
    // landed with turned every bot trio into a suicide pact
    for (const o of this.bots) {
      if (o === thrower || o.team === thrower.team || !o.bot.alive || o.bot.dropping) continue;
      const d = hurts(o.bot.pos, false);
      if (d <= 0) continue;
      o.bot.dummy.hit(now, "body", d, 1, 1, o.bot.pos.clone().setY(o.bot.pos.y + 1.2));
      o.bot.remote.health = o.bot.dummy.health;
      o.bot.remote.shield = o.bot.dummy.shield;
      if (o.bot.dummy.knocked) this.botDown(o, owner);
    }
  }

  /** a restore under way (during onRespawn): the echo's spot, height included */
  get echoRespawnAt(): THREE.Vector3 | null {
    return this.respawnOnEcho && this.respawnPoint ? this.respawnPoint.clone() : null;
  }

  /** your drop spot: one per squad member at the squad's place */
  override get spawn(): Spawn {
    if (this.respawnPoint) return { x: this.respawnPoint.x, z: this.respawnPoint.z, yaw: 0 };
    const d = this.poi.drops[this.id % this.poi.drops.length];
    return { x: d.x, z: d.z, yaw: 0 };
  }

  override get avatars(): Dummy[] {
    return [...super.avatars, ...this.bots.map((b) => b.bot.dummy), ...(this.gulagBot ? [this.gulagBot.dummy] : [])];
  }

  /** the bots this page runs (a squad's): a SCOUT's scan finds them as it finds a player */
  protected override ownFigures(): Seen[] {
    return this.bots.filter((b) => b.bot.alive && !b.bot.dropping && !b.bot.aboard).map((b) => ({ id: b.bot.remote.id, name: b.bot.remote.name, at: b.bot.pos, avatar: b.bot.dummy }));
  }

  override remoteOf(d: Dummy): Remote | null {
    if (this.gulagBot && d === this.gulagBot.dummy) return this.gulagBot.remote;
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
  /** the squad still standing (one in the Gulag is not, here) */
  private get humansAlive(): number {
    let n = this.alive && !this.gulag ? 1 : 0;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && this.standing(r)) n++;
    return n;
  }
  /** the bot squads with someone still up (the host's: it runs the bots) */
  private get botSquadsAlive(): number {
    const teams = new Set<number>();
    for (const b of this.bots) if (b.bot.alive) teams.add(b.team);
    return teams.size;
  }
  /** squads still in it: the humans', and every bot squad with someone up (in solo everyone is their own); a guest has the host's count */
  private get squadsAlive(): number {
    if (this.role !== "host") return this.squadsSeen;
    // the humans' sides with someone up: each their own in solo, each squad when split, else one
    const up = new Set<number>();
    if (this.alive) up.add(this.sideOf(this.id));
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive) up.add(this.sideOf(r.id));
    const mine = up.size;
    return this.botSquadsAlive + mine;
  }

  // ------------------------------------------------------------ loot

  /** the floor's loot, echoes and care packages */
  lootField: LootField | null = null;
  /** true: you land with nothing (the bots land unarmed and loot); false: you land with your loadout and the bots with their guns */
  readonly startLoot: boolean;
  /** the item you asked for is yours (the host's own, or the host said so) */
  onLootTaken: ((item: LootItem) => void) | null = null;
  private pods: Pod[] = [];
  private podSeq = 0;
  private podPhases = new Set<number>();
  /** when the host next counts the centre's loot for a restock (speedkills.json loot.restock), game seconds */
  private restockAt = 0;

  /** take an item: the host's own at once, a guest's asked of the host (first come, first served) */
  takeLoot(key: number): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      const it = f.remove(key);
      if (!it) return;
      this.onLootTaken?.(it);
      this.broadcast({ t: "loot", op: "gone", key, by: this.id });
    } else if (f.drops.has(key)) this.toHost({ t: "loot", op: "take", key });
  }

  /** put an item down (a swapped gun, what someone had when they died): the host keys it and tells the squad */
  dropLoot(item: LootItem, at: THREE.Vector3): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      const key = f.add(item, at);
      this.broadcast({ t: "loot", op: "add", key, item, at: [at.x, at.y, at.z] });
    } else this.toHost({ t: "loot", op: "drop", item, at: [at.x, at.y, at.z] });
  }

  /**
   * What someone had, loose on the floor where they died, spread round the spot, and a squad mate's echo on the spot
   * itself for their restore. There are no death boxes (the owner, 2026-10-04): the box was a marker the items lay round.
   */
  dropDeath(items: LootItem[], at: THREE.Vector3): void {
    // (each on the floor under its spot: the highest top there at or under it, or the ground. A player killed in the air,
    // falling from the drop or mid-jump, left it all hanging where they died, the echo out of a mate's reach below it)
    const floored = (p: THREE.Vector3): THREE.Vector3 => {
      let y = floorAt(p.x, p.z);
      for (const s of solidsIn(p.x, p.x, p.z, p.z)) if (s.minX <= p.x && s.maxX >= p.x && s.minZ <= p.z && s.maxZ >= p.z && s.top <= p.y + 0.05 && s.top > y) y = s.top;
      return new THREE.Vector3(p.x, Math.min(p.y, y), p.z);
    };
    items.forEach((it, i) => {
      if (it.kind === "echo") return void this.dropLoot(it, floored(at));
      const a = (i / Math.max(1, items.length)) * Math.PI * 2;
      this.dropLoot(it, floored(at.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9))));
    });
  }

  /** keys this page asked to take only to clear them away (discardLoot): into nobody's pack when the host says so */
  private discarding = new Set<number>();
  /**
   * An item off the floor and into nobody's pack: what a restore clears from where its player died, the guns it
   * gives back from the player's own record and the echo (main.ts). Taken as an item is, each gun would have gone on
   * top of the same gun given back, and in SpeedKills a gun taken onto the same gun fuses it a level.
   */
  discardLoot(key: number): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      if (f.remove(key)) this.broadcast({ t: "loot", op: "gone", key, by: this.id });
    } else if (f.drops.has(key)) {
      this.discarding.add(key);
      this.toHost({ t: "loot", op: "take", key });
    }
  }

  /**
   * A care package is called: `lands` seconds from now,
   * counting br.json's announce ahead of the fall itself.
   *
   * The arrival is the event, not the contents. It is named and pinged the
   * moment it is called, so everyone has time to start moving; it appears
   * high under a canopy and trails smoke down; it thumps into a ring of dust;
   * and it stays lit and marked for br.json's contest seconds afterwards,
   * which is the window the fight over it happens in.
   */
  private addPod(at: THREE.Vector3, lands: number): void {
    const cfg = brCfg.pod;
    const tint = 0x3fa7e8;
    const obj = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x3a4250, emissive: tint, emissiveIntensity: 0.35, roughness: 0.5 }));
    shell.position.y = 0.9;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 160, 8, 1, true), new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 80;
    // the canopy that carries it down, cut loose the moment it lands
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(cfg.canopy.radius, cfg.canopy.height, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xdde3ea, emissive: tint, emissiveIntensity: 0.12, roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.y = 1.8 + cfg.canopy.height * 0.5;
    // SpeedKills: the pack's weapon case when it is in (paidgun.ts); our cylinder otherwise
    const bought = paidProp("carepackage");
    obj.add(bought ?? shell, beam, canopy);
    obj.position.set(at.x, cfg.height, at.z);
    obj.visible = false;
    this.scene.add(obj);
    // the smoke hangs where it was made, so it cannot be a child of the pod
    const trail = new THREE.Group();
    this.scene.add(trail);
    const fallFor = Math.min(lands, LOOT.podFall);
    const id = ++this.podSeq;
    this.pods.push({ id, at: at.clone(), landsAt: wallClock() + lands, fallFor, hotUntil: Infinity, obj, canopy, beam, trail, nextPuff: 0, dust: null, landed: false });
    const where = this.placeNear(at);
    this.onNotice?.(`CARE PACKAGE INBOUND  ·  ${where}`);
    // the compass and the world get it through the ping path the squad
    // already has, under the pod's own id so it sits beside your pings
    this.onMark?.("go", POD_MARK - id, at.clone(), "CARE PACKAGE", -1);
    // the horn, for the page that owns the audio: 0 called, 1 landed
    this.onRemoteFx?.("pod", this.id, at.clone(), undefined, 0);
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

  /** the host: what a care package holds, SpeedKills' own guns and hack cores fused past what its floor gives (speedkills.json loot.carePackage) */
  private podItems(): LootItem[] {
    return speedkillsPackage(Math.random);
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
          const dust = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 28), new THREE.MeshBasicMaterial({ color: 0xc9bda6, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
          dust.rotation.x = -Math.PI / 2;
          dust.position.set(p.at.x, p.at.y + 0.06, p.at.z);
          dust.userData.born = now;
          this.scene.add(dust);
          p.dust = dust;
          // One still coming down when the match ends lands in silence and
          // empty: the card is up, and a notice or a gold gun on the floor
          // behind it is a match that has not stopped.
          if (!this.brOver) {
            this.onRemoteFx?.("pod", this.id, p.at.clone(), undefined, 1);
            this.onNotice?.(`CARE PACKAGE DOWN  ·  ${this.placeNear(p.at)}`);
            if (this.role === "host") this.podItems().forEach((it, i) => this.dropLoot(it, p.at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.3, 0, Math.sin(i * 2.1) * 1.3))));
          }
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

  /** the map's towers and pads (brplay.ts) */
  /** the map's doors (doors.ts) */
  get doors(): Doors {
    return this.map.doors;
  }

  /** a guest: doors it asked about lately, and when: the ring packet's word on those waits for the host's answer */
  private doorAsked = new Map<number, number>();

  /**
   * Open or shut door `i`: the host does it and tells everyone; a guest shows
   * it at once and asks the host, whose answer (or the next ring packet) puts
   * it right if the host said no.
   */
  useDoor(i: number, open: boolean): void {
    const doors = this.map.doors;
    if (!doors.list[i] || this.phase === "matchEnd") return;
    if (this.role === "host") {
      this.hostDoor(i, open);
      return;
    }
    this.toHost({ t: "door", i, open });
    this.doorAsked.set(i, wallClock());
    const me = this.lastLocal;
    if (open || !me || doors.canClose(i, [me])) doors.set(i, open);
  }

  /** a melee swing into shut door `i`: the host counts it; a friend's page asks, and hears the kick at once */
  kickDoor(i: number): void {
    const doors = this.map.doors;
    const d = doors.list[i];
    if (!d || d.open || d.broken || this.phase !== "fight") return;
    if (this.role === "host") this.hostKick(i);
    else {
      this.toHost({ t: "door", i, open: false, k: 1 });
      doors.kickHeard(i);
    }
  }

  /** the host: a kick counted, and everyone told (the break carries the door's new state) */
  private hostKick(i: number): void {
    const r = this.map.doors.kick(i);
    if (r === "break") this.broadcast({ t: "door", i, open: true, b: 1 });
    else if (r === "kick") this.broadcast({ t: "door", i, open: false, k: 1 });
  }

  /** the host: a door opened or shut for everyone; a door is not shut on anybody standing in it. True if it is as asked */
  private hostDoor(i: number, open: boolean): boolean {
    const doors = this.map.doors;
    if (!open && !doors.canClose(i, this.bodies())) return false;
    if (doors.set(i, open)) this.broadcast({ t: "door", i, open });
    return true;
  }

  /** everyone's feet as the host knows them: this player, the guests' last states, the bots */
  private bodies(): Array<{ x: number; y: number; z: number }> {
    const out: Array<{ x: number; y: number; z: number }> = [];
    if (this.lastLocal && this.alive) out.push(this.lastLocal);
    for (const r of this.remotes.values()) {
      const s = r.samples[r.samples.length - 1];
      if (r.id < Duel.BOT_ID && r.alive && s) out.push(s);
    }
    for (const b of this.bots) if (b.bot.alive) out.push(b.bot.pos);
    return out;
  }

  get mapInfo(): { towers: Array<{ x: number; z: number; y: number }>; pads: BrMap["pads"] } {
    return this.map;
  }

  /** where care packages are and will land, for the maps */
  get podSpots(): Array<{ x: number; z: number; landed: boolean; hot: boolean }> {
    const now = wallClock();
    return this.pods.map((p) => ({ x: p.at.x, z: p.at.z, landed: p.landed, hot: now < p.hotUntil }));
  }
  get ringState(): RingView {
    return this.view;
  }

  /**
   * The nearest package worth walking to from here, falling or landed and still hot, and where to stand for it: a few
   * metres off on this side (br.json podStand), never on it. Stood on the crate itself, two bots of two squads spent
   * its whole contest inside it, each blind to the other half a metre away (a hunt, 2026-09-30). Once it is down and
   * the bot is there, it has been contested: the bot's own looting and fighting take over (`b.podsDone`).
   */
  private podToContest(from: THREE.Vector3, b?: BrBot): THREE.Vector3 | null {
    const now = wallClock();
    let best: Pod | null = null;
    let bd = brCfg.podLure;
    for (const p of this.pods) {
      if (now >= p.hotUntil || b?.podsDone?.has(p.id)) continue;
      const d = Math.hypot(p.at.x - from.x, p.at.z - from.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return null;
    const stand = brCfg.podStand;
    if (b && best.landed && bd <= stand + 1) {
      (b.podsDone ??= new Set()).add(best.id);
      return null;
    }
    const away = bd > 1e-3 ? stand / bd : 0;
    return new THREE.Vector3(best.at.x + (from.x - best.at.x) * away, 0, best.at.z + (from.z - best.at.z) * away);
  }

  /**
   * The node a bot at (x, z) takes as where it is: the nearest. Coming down from the sky (no `y`), never one inside a
   * hall (GraphNode hall). Given its height `y` (landed, or lost), one on its own floor and joined to others wherever
   * there is one: by (x, z) alone a bot down in the court took the deck 18 m over it, and stood under it for good,
   * since it stops a metre and a half off a node's (x, z) and arrives only on the node's floor (a hunt, 2026-09-30:
   * four of 28 bots stood still for the rest of the match); and on a node with no links it had nowhere to go.
   */
  private nearestNode(x: number, z: number, y?: number): number {
    let best = 0;
    let bd = Infinity;
    const floor = botsCfg.unstick.floor;
    this.map.nodes.forEach((n, i) => {
      if (n.hall && y === undefined) return;
      let d = Math.hypot(n.x - x, n.z - z);
      if (y !== undefined) {
        // (a node with no height is on whatever the bot stands on)
        if (Math.abs((n.y ?? y) - y) >= floor) d += 1000;
        if (!n.links.length && !n.pad) d += 500;
      }
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** since when each bot has stood under its node or over it (unstick) */
  private underSince = new Map<BrBot, number>();
  /**
   * A bot standing under the node it walks to, or over it (a deck, a bridge, the court's floor 7 m down): it stops a
   * metre and a half off the node's (x, z) and arrives only on the node's floor, so it stood there for good. After
   * bots.json unstick.under seconds of that it takes the nearest node on its own floor, and walks on from there.
   * Not a planned step it takes another way (a pad's throw, a rope), nor while it is in the air.
   */
  private unstick(b: BrBot, now: number): void {
    const bot = b.bot;
    const nodes = this.map.nodes;
    const g = nodes[b.goal];
    const here = nodes[b.node];
    const U = botsCfg.unstick;
    const planned = !!here && (here.pad?.to === b.goal || !!here.ropes?.includes(b.goal));
    const under = !!g && g.y !== undefined && !planned && !bot.travel && !bot.dropping && Math.hypot(g.x - bot.pos.x, g.z - bot.pos.z) < U.reach && Math.abs(g.y - bot.pos.y) >= U.floor;
    if (!under) {
      this.underSince.delete(b);
      return;
    }
    const since = this.underSince.get(b) ?? now;
    this.underSince.set(b, since);
    if (now - since < U.under) return;
    this.underSince.delete(b);
    b.node = b.goal = this.nearestNode(bot.pos.x, bot.pos.z, bot.pos.y);
    b.climb = null;
  }

  // ------------------------------------------------------------ the fight

  /** the host's own bullet hit a bot (its dummy took the damage already); a guest's goes to the host as a hit message */
  override localHit(r: Remote, amount: number, head: boolean, weapon = "", dist: number | null = null): void {
    if (this.gulagBot && r === this.gulagBot.remote) {
      if (!this.gulag?.live) return;
      this.hits++;
      this.damage += amount;
      r.health = this.gulagBot.dummy.health;
      r.shield = this.gulagBot.dummy.shield;
      return;
    }
    const b = this.bots.find((x) => x.bot.remote === r);
    if (!b) {
      super.localHit(r, amount, head, weapon, dist);
      return;
    }
    if (this.phase !== "fight" || !r.alive) return;
    this.hits++;
    this.damage += amount;
    r.health = b.bot.dummy.health;
    r.shield = b.bot.dummy.shield;
    if (b.bot.dummy.knocked) this.botDown(b, this.id, weapon, head);
  }

  /** the host: a guest's hit on a bot */
  protected override onHitOther(to: number, amount: number, head: boolean, from: number, weapon = ""): boolean {
    const b = this.bots.find((x) => x.bot.remote.id === to);
    if (!b) return false;
    if (this.phase !== "fight" || !b.bot.alive) return true;
    const bot = b.bot;
    bot.dummy.hit(wallClock(), head ? "head" : "body", amount, 1, 1, bot.pos.clone().setY(bot.pos.y + 1.2));
    bot.remote.health = bot.dummy.health;
    bot.remote.shield = bot.dummy.shield;
    if (bot.dummy.knocked) this.botDown(b, from, weapon, head);
    return true;
  }

  /** a name for the feed: whoever `by` is (a human, a bot, or -1 for the ring) */
  private whoDid(by: number): string {
    return causeName(by) ?? (by === this.id ? this.myName || "YOU" : (this.remotes.get(by)?.name ?? this.bots.find((x) => x.bot.remote.id === by)?.bot.remote.name ?? "SOMEONE"));
  }

  /**
   * The traversal, taken as a player passing by would take it. A bot that
   * steps onto a launch pad is thrown by it; a bot out of a fight standing at
   * a zipline's end, when the rope's far end is nearer where it is going (by
   * rideGain metres), rides it. Before this every rope and pad was scenery
   * to the bots, and a bot wanting the other side of the map walked it.
   */
  private botTraversal(b: BrBot, sense: BotSense, planned?: { x: number; z: number } | null): void {
    const bot = b.bot;
    if (bot.travel) return;
    // A squad goes as one: its first bot takes a pad or a rope where it will,
    // and the others only toward it (a follower thrown down the road away from
    // its squad split it, and the squads' test caught it).
    const lead = this.team.size > 1 ? this.bots.filter((o) => o.team === b.team && o.bot.alive && !o.bot.dropping).reduce<BrBot | null>((a, o) => (!a || o.slot < a.slot ? o : a), null) : null;
    const follower = !!lead && lead !== b;
    const P = squadCfg.pad;
    for (const p of this.map.pads) {
      // (a jump pad up onto a podium is a player's: the bots keep to the road's)
      // on the pad's own floor: a bot in the metro under a crossing's pad is not on it
      if (p.up !== undefined || Math.hypot(bot.pos.x - p.x, bot.pos.z - p.z) > P.reach || Math.abs(bot.pos.y - (p.y ?? 0)) > 0.6) continue;
      // a follower: only where the pad throws it toward its lead
      if (follower && lead && (lead.bot.pos.x - bot.pos.x) * p.dx + (lead.bot.pos.z - bot.pos.z) * p.dz < SQUADS.follow) continue;
      bot.fling(new THREE.Vector3(p.dx * P.speed, P.up, p.dz * P.speed));
      return;
    }
    // the route's next step is a jump pad's throw (city.ts, a node's `pad`): stood on the pad, it is thrown
    if (!bot.travel && !bot.dropping) {
      const here = this.map.nodes[b.node];
      if (here?.pad && here.pad.to === b.goal && Math.hypot(bot.pos.x - here.x, bot.pos.z - here.z) < 1.5 && Math.abs(bot.pos.y - (here.y ?? 0)) < 0.6) {
        bot.jumpPad(here.pad);
        return;
      }
    }
    // the route's next step is a rope's other end: ride it, whichever way the
    // ring happens to lie (the graph chose this step for the distance it saves)
    if (planned && !bot.travel) {
      for (const z of ZIPLINES) {
        for (const [end, far] of [
          [z.a, z.b],
          [z.b, z.a],
        ] as const) {
          if (Math.hypot(far.x - planned.x, far.z - planned.z) > SQUADS.ropeReach + 8) continue;
          if (Math.hypot(bot.pos.x - end.x, bot.pos.z - end.z) > SQUADS.ropeReach) continue;
          const feet = end.y - 2.13;
          if (bot.pos.y < feet - 1.4 || bot.pos.y > feet + 0.6) continue;
          bot.ride(end, far, moveCfg.ziplineSpeed * 0.0254);
          return;
        }
      }
    }
    // a jump tower (the balloon) when there is a long way to go: up and gliding
    // for the goal, as a player rides one. Not while it has someone to fight.
    if (!sense.target && sense.goal && !bot.travel && !bot.dropping && bot.pos.y < 1.2 && bot.pos.y > -0.5) {
      const far = Math.hypot(sense.goal.x - bot.pos.x, sense.goal.z - bot.pos.z);
      if (far >= SQUADS.towerGain) {
        for (const t of this.map.towers) {
          if (Math.hypot(bot.pos.x - t.x, bot.pos.z - t.z) > squadCfg.towerReach + 1.4) continue;
          // a follower only takes one its lead is beyond, so a squad stays together
          if (follower && lead && Math.hypot(lead.bot.pos.x - t.x, lead.bot.pos.z - t.z) < SQUADS.follow) continue;
          bot.leaveShip(new THREE.Vector3(t.x, (t.y ?? 0) + DROP_HEIGHT * 0.75, t.z), { x: sense.goal.x, z: sense.goal.z });
          this.onRemoteFx?.("tower", bot.remote.id, new THREE.Vector3(t.x, t.y ?? 0, t.z));
          return;
        }
      }
    }
    if (sense.target || !sense.goal) return;
    // a rope is a choice: a lead takes one only with its squad about it
    if (lead === b && this.bots.some((o) => o !== b && o.team === b.team && o.bot.alive && !o.bot.dropping && o.bot.pos.distanceTo(bot.pos) > SQUADS.follow)) return;
    // a follower heads for its lead
    const goal = follower && lead ? lead.bot.pos : sense.goal;
    const here = Math.hypot(goal.x - bot.pos.x, goal.z - bot.pos.z);
    for (const z of ZIPLINES) {
      for (const [end, far] of [
        [z.a, z.b],
        [z.b, z.a],
      ] as const) {
        // at this end: under the rope's end, on the floor it is hung over
        if (Math.hypot(bot.pos.x - end.x, bot.pos.z - end.z) > SQUADS.ropeReach) continue;
        const feet = end.y - 2.13;
        if (bot.pos.y < feet - 1.4 || bot.pos.y > feet + 0.6) continue;
        if (Math.hypot(goal.x - far.x, goal.z - far.z) + SQUADS.rideGain > here) continue;
        bot.ride(end, far, moveCfg.ziplineSpeed * 0.0254);
        return;
      }
    }
  }

  /** a bot out, by `by` (a human id, a bot id, or -1 for the ring): at zero health it is out, there being no knocks */
  private botDown(b: BrBot, by: number, weapon = "", head = false): void {
    const r = b.bot.remote;
    if (!r.alive) return;
    r.alive = false;
    const mine = by === this.id;
    if (mine) this.kills++;
    // what it had looted (loot.ts deathDropOf), or its gun and the basics, loose where it fell
    if (this.lootField && this.role === "host") {
      const armed = this.botArmed(b, wallClock());
      const kit = b.bot.lootKit;
      const items = deathDropOf(kit.gunId ? kit : null, armed ? r.avatarWeapon : null);
      this.dropDeath(items, b.bot.pos.clone());
    }
    const who = this.whoDid(by);
    // the end of it: the feed says eliminated, with the gun when there was one (Milestone 701)
    this.onFeed?.(`${who} eliminated ${r.name}`, mine, !mine, { killer: who, victim: r.name, weapon: weapon || undefined, head });
    for (const o of this.bots) o.bot.forget(r.id);
    this.broadcast({ t: "down", from: r.id, by, w: weapon || undefined, hd: head ? 1 : undefined });
    this.onKnockSeen?.(r.id, by);
    const left = this.aliveCount;
    // the last of a bot squad: the squad is wiped (duos and trios; in solo every death is one)
    const wiped = this.team.size > 1 && !this.bots.some((o) => o.team === b.team && o.bot.alive);
    if (wiped) {
      this.onNotice?.(`SQUAD WIPED  ·  ${this.squadsAlive} SQUADS LEFT`);
      this.onWiped?.();
    }
    else this.onNotice?.(mine ? `${r.name} DOWN  ·  ${left} LEFT` : `${left} LEFT`);
    if (this.manySides) this.judgeSides();
    // (someone of yours in the Gulag counts: the last bot down while your only survivor fought there gave no win, and
    // the Gulag's winner dropped into an empty city, Milestone 726)
    else if (this.bots.every((x) => !x.bot.alive) && (this.humansAlive > 0 || this.gulagIds.size > 0)) this.endBr(true);
  }

  /** where a won Gulag drops you back: 8 m or more from a squad mate who is up, else anywhere well inside the ring, on open ground */
  private dropBackSpot(near: THREE.Vector3 | null): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    let x: number;
    let z: number;
    if (near) {
      const r = 8 + Math.random() * Math.max(0, GULAG.landSpread - 8);
      x = near.x + Math.cos(a) * r;
      z = near.z + Math.sin(a) * r;
    } else {
      // SpeedKills: in the final sector, which never decays (Milestone 733: the ring's first round is the whole map, and
      // with no mate up a won Gulag dropped you anywhere in it, a wave's sector warned or decaying among them)
      const c = this.decay && this.decayCircle ? this.decayCircle : this.view.current;
      const r = Math.sqrt(Math.random()) * c.r * 0.6;
      x = c.cx + Math.cos(a) * r;
      z = c.cz + Math.sin(a) * r;
    }
    x = Math.max(BR_CENTER.x - BR_HALF + 5, Math.min(BR_CENTER.x + BR_HALF - 5, x));
    z = Math.max(BR_CENTER.z - BR_HALF + 5, Math.min(BR_CENTER.z + BR_HALF - 5, z));
    return openGround(x, z);
  }


  /** out (shot down, or the Gulag lost): the Gulag decided here, before the squad's end is judged */
  protected override eliminate(from: number, how: "knocked" | "finished"): void {
    if (!this.alive) return;
    // A death in the Gulag is the end of a trip the match has already counted:
    // the first death went out, dropped its box and made its feed line. So
    // nothing goes out again but the Gulag's own note (leaveGulag): no second
    // "down", no second box in the Gulag's room, and the feed names whoever
    // won it (it named the Gulag's bot by its id, PLAYER 991). Plan section
    // 12, item 3.
    if (this.gulag !== null && this.gulag.phase !== "wait") {
      this.gulag.lost(wallClock());
      this.diedInGulag = true;
      this.alive = false;
      this.onFeed?.(`${this.gulagBot?.remote.name ?? "THE GULAG"} won the Gulag against ${this.myName || "YOU"}`, false);
      this.onEliminated?.(from);
      this.leaveGulag(false);
      return;
    }
    // a first death, early, goes to the Gulag; decided before the squad is judged, so it is not out meanwhile
    if (this.gulagOn && this.phase === "fight" && gulagFor(this.ringPhase, this.gulagUsed) && (from !== EDGE_ID || EDGE.gulag)) {
      this.gulag = new Gulag(wallClock());
      this.gulagUsed = true;
      this.noteGulag(this.id, 1);
    }
    super.eliminate(from, how);
  }

  /**
   * Where you are in the match's lives, for your squad's panel (squadview.ts):
   * on the way to the Gulag or in it, a ghost waiting for a restore, or out.
   * Up says nothing.
   */
  protected override lifeWire(): number | undefined {
    if (this.gulag) return LIFE_WIRE.gulag;
    if (this.alive || this.phase !== "fight") return undefined;
    if (this.ghost) return LIFE_WIRE.ghost;
    return LIFE_WIRE.out;
  }

  /** a squad mate in the Gulag, as their "gulag" effect said (the host keeps the count for the squad's end) */
  inGulag(id: number): boolean {
    return this.gulagIds.has(id);
  }

  /** out, or up in the Gulag's room: a squad mate's restore at your echo brings you back from either */
  protected override canBeRespawned(): boolean {
    return !this.alive || this.gulag !== null;
  }

  /** this player's last death was a Gulag lost: out, with the echo of the first death the only one (main.ts onEliminated) */
  diedInGulag = false;

  /**
   * A squad mate brought you back (at your echo) while you were on
   * your way to the Gulag or in it: that is your way back, and the trip is over.
   */
  protected override respawnHere(at: THREE.Vector3, echo = false): void {
    // SpeedKills: a ghost has two restores a match; after them a death is final
    if (this.decay && !this.gulag) {
      if (this.restores >= PROFILE.life.ghostRevives) return;
      this.restores++;
      if (this.restores >= PROFILE.life.ghostRevives) this.localFx("sk", undefined, undefined, 9);
    }
    if (this.gulag) {
      this.gulag = null;
      this.gulagBot?.dispose();
      this.gulagBot = null;
      this.showFlag(false);
      this.noteGulag(this.id, 2);
      this.alive = false;
    }
    super.respawnHere(at, echo);
  }

  /** the side is out: nobody of it up, nobody of it in the Gulag */
  private get sideOut(): boolean {
    return this.humansAlive === 0 && this.gulagIds.size === 0;
  }

  /** someone of the side went to the Gulag (1), came back from it (2) or lost it (0): the host keeps count, and yours is told to everyone */
  private noteGulag(id: number, n: number): void {
    if (n === 1) this.gulagIds.add(id);
    else this.gulagIds.delete(id);
    // A squad mate's loss is them out now (Milestone 726): their state packets from the Gulag's fight said up, and the
    // one saying down comes after this note, which judged the squad with them still standing and nothing judged it
    // again. A duo whose host was out and whose guest lost the Gulag sat on, nobody up, till a bot squad took the zone.
    const r = id !== this.id ? this.remotes.get(id) : undefined;
    if (n === 0 && r) r.alive = false;
    if (id === this.id) this.localFx("gulag", undefined, undefined, n);
    // a loss, yours or a squad mate's: the squad is judged again now that nobody of it is in there
    if (this.manySides) this.judgeSides();
    else if (n === 0 && this.role === "host" && !this.brOver && this.phase === "fight" && this.sideOut) this.endBr(false);
  }

  /** a squad mate's Gulag, heard (their "gulag" effect) */
  hearGulag(from: number, n: number): void {
    if (n === 0 || n === 1 || n === 2) this.noteGulag(from, n);
  }

  /** main, once: the room's spawn and the guns, the moment you go in */
  takeGulagEntry(): { x: number; z: number; yaw: number; guns: [string, string] } | null {
    const e = this.gulagEntry;
    this.gulagEntry = null;
    return e;
  }

  /** main, once: the guns you won with, as you drop back in */
  takeGulagKit(): [string, string] | null {
    const k = this.gulagKit;
    this.gulagKit = null;
    return k;
  }

  /**
   * The Gulag, every frame, on this browser only: the clock, your way in, the
   * bot's fight and its shots on you, the flag in overtime, and the end.
   */
  private gulagFrame(now: number, dt: number, local: LocalState): void {
    const g = this.gulag;
    if (!g) return;
    const room = arenaMap(GULAG.map);
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    const bot = this.gulagBot;
    // (the flag on the floor of the middle, or on THE GULAG's ledge, its top)
    const flagY = room.ledge?.y ?? 0;
    const onFlag = (x: number, y: number, z: number) => Math.hypot(x - room.center.x, z - room.center.z) <= GULAG.flagRadius && y > flagY - 0.5 && y < flagY + 1.5;
    const meOn = g.phase === "overtime" && this.alive && onFlag(local.x, local.y, local.z);
    const themOn = g.phase === "overtime" && !!bot && bot.alive && onFlag(bot.pos.x, bot.pos.y, bot.pos.z);
    const ev = g.tick(now, dt, meOn, themOn);
    if (ev === "enter") this.enterGulag();
    else if (ev === "fight") this.onNotice?.("FIGHT");
    else if (ev === "overtime") {
      this.onNotice?.("OVERTIME: TAKE THE FLAG");
      this.showFlag(true);
    }
    if (bot && (g.phase === "countdown" || g.live)) {
      const sees = this.alive && bot.alive && bot.sees(feet);
      // in overtime it goes for the flag; in the fight, once the countdown is out, it comes looking for you where it cannot
      // see you (the owner, 2026-09-28: it stood at its spawn the whole fight, waiting to be found). By the room's middle
      // while the middle is nearer you than it is: straight at you ran it into the cover between the two ends
      const mid = new THREE.Vector3(room.center.x, flagY, room.center.z);
      const viaMid = Math.hypot(bot.pos.x - mid.x, bot.pos.z - mid.z) > 3 && Math.hypot(mid.x - feet.x, mid.z - feet.z) < Math.hypot(bot.pos.x - feet.x, bot.pos.z - feet.z);
      let goal = g.phase === "overtime" ? mid : g.phase === "fight" ? (viaMid ? mid : new THREE.Vector3(feet.x, 0, feet.z)) : null;
      // THE GULAG's middle is a ledge whose stairs climb from its ends, and a bot cannot jump: from the street, the middle
      // is by the nearer way up (rules.arenas gulag `ways`, on the room's long axis) and straight in along the axis from it
      let exact = false;
      const L = room.ledge;
      if (goal === mid && L && L.ways.length && bot.pos.y < 0.3) {
        const way = L.ways.reduce((a, w) => (Math.hypot(w.x - bot.pos.x, w.z - bot.pos.z) < Math.hypot(a.x - bot.pos.x, a.z - bot.pos.z) ? w : a));
        const [ax, az] = [way.x - mid.x, way.z - mid.z];
        const len = Math.hypot(ax, az);
        const along = ((bot.pos.x - mid.x) * ax + (bot.pos.z - mid.z) * az) / len;
        const off = Math.abs((bot.pos.x - mid.x) * az - (bot.pos.z - mid.z) * ax) / len;
        if (!(off < 0.35 && along > 0 && along <= len + 0.3)) {
          goal = new THREE.Vector3(way.x, 0, way.z);
          exact = true;
        }
      }
      // (in overtime it holds the flag once on it: a bot that sees you from it fights from it)
      const tether = g.phase === "overtime" ? { x: room.center.x, z: room.center.z, r: GULAG.flagRadius } : undefined;
      const shots = bot.update(now, dt, { target: sees ? feet : null, targetId: this.id, goal, exact, tether, canShoot: g.live });
      let d = 0;
      for (const s of shots) {
        this.onShotFired?.(bot.remote.id, s.from, s.dir, s.weapon);
        if (hitsBody(s.from, s.dir, feet)) d += s.damage;
      }
      if (d > 0 && this.alive) this.takeHit(d, bot.remote.id, false, shots[0].weapon, bot.pos.distanceTo(feet));
      bot.remote.health = bot.dummy.health;
      bot.remote.shield = bot.dummy.shield;
      if (g.live && !bot.alive) this.decideGulag(g.won(now));
    }
    if (ev === "won" || ev === "lost") this.decideGulag(ev);
    // won: a moment to see it, then back into the match
    if (this.gulag && g.phase === "won" && now - g.decidedAt >= GULAG.after) this.leaveGulag(true);
  }

  /** in: up again in the room, at its first spawn, with the bot at the other, both on the fight's guns */
  private enterGulag(): void {
    const g = this.gulag!;
    const room = arenaMap(GULAG.map);
    const mine = room.spawns[0];
    const theirs = room.spawns[1];
    const name = `GULAG ${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}`;
    const bot = new Bot(90, this.scene, this.projectiles, DIFFICULTY[GULAG.tier as keyof typeof DIFFICULTY], theirs, GULAG_BOT_ID, g.guns[Math.random() < 0.5 ? 0 : 1], name);
    bot.remote.name = name;
    this.gulagBot = bot;
    this.alive = true;
    this.health = HEALTH_MAX;
    this.gulagEntry = { x: mine.x, z: mine.z, yaw: mine.yaw, guns: g.guns };
    this.onRespawn?.();
  }

  /** won or lost: said, and a loss by the flag is a death */
  private decideGulag(ev: GulagEvent): void {
    if (ev === "won") this.onNotice?.("YOU WON THE GULAG: BACK INTO THE MATCH");
    else if (ev === "lost" && this.alive && this.gulagBot) this.eliminate(this.gulagBot.remote.id, "finished");
  }

  /** out of the room: won, dropping back into the live ring near someone of yours; lost, out */
  private leaveGulag(won: boolean): void {
    const g = this.gulag;
    this.gulag = null;
    this.gulagBot?.dispose();
    this.gulagBot = null;
    this.showFlag(false);
    this.noteGulag(this.id, won ? 2 : 0);
    if (!won || !g) return;
    const mates: THREE.Vector3[] = [];
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !this.friendly(r.id) || !r.alive || this.gulagIds.has(r.id)) continue;
      const s = r.samples[r.samples.length - 1];
      if (s) mates.push(new THREE.Vector3(s.x, 0, s.z));
    }
    const at = this.dropBackSpot(mates.length ? mates[Math.floor(Math.random() * mates.length)] : null);
    this.gulagKit = g.guns;
    this.respawnPoint = new THREE.Vector3(at.x, 0, at.z);
    this.onRespawn?.();
    this.respawnPoint = null;
  }

  /** the overtime flag: a lit ring on the floor of the room's middle and a pole with a flag on it */
  private showFlag(on: boolean): void {
    if (!on) {
      if (this.gulagFlag) {
        this.gulagFlag.removeFromParent();
        this.gulagFlag.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
      }
      this.gulagFlag = null;
      return;
    }
    if (this.gulagFlag) return;
    const room = arenaMap(GULAG.map);
    const g = new THREE.Group();
    const lit = new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0xffc020, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(GULAG.flagRadius - 0.25, GULAG.flagRadius, 48), lit);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.4 }));
    pole.position.y = 1.5;
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
    flag.position.set(0.56, 2.6, 0);
    g.add(flag);
    g.position.set(room.center.x, room.ledge?.y ?? 0, room.center.z);
    this.scene.add(g);
    this.gulagFlag = g;
  }

  // ------------------------------------------------------------ host migration

  /**
   * Host migration (docs/PLAN_HOST_MIGRATION.md): once every bot is off the
   * ship and down on the map (a bot aboard or gliding in sends nothing a
   * guest could put it back from), until the match is decided.
   */
  protected override canMigrate(): boolean {
    return this.phase === "fight" && !this.brOver && this.bots.every((b) => !b.bot.aboard && (b.landed || !b.bot.alive));
  }

  /**
   * What only the host has, for the heir: each bot's tier, squad, waypoints,
   * kit, whether it is up; the care packages called; the placings; and the loot
   * field's next key. The ring is not in it: every browser draws its plan
   * from the seed, and a guest's view says where along it the ring is.
   */
  protected override snapshotMode(now: number): BrSnap {
    const t = (v: number): number | null => (Number.isFinite(v) ? v - now : null);
    return {
      b: this.bots.map((b) => ({
        i: b.bot.index,
        t: Math.max(0, WIRE_TIERS.indexOf(b.bot.diff.name as BotTier)),
        tm: b.team,
        sl: b.slot,
        n: b.node,
        g: b.goal,
        ar: t(b.armedAt),
        as: !!b.armedShown,
        al: b.bot.alive,
        k: { ...b.bot.lootKit },
        dt: [b.dropTo.x, b.dropTo.z],
      })),
      ps: this.podSeq,
      pp: [...this.podPhases],
      pl: [...this.placedAt],
      nk: this.lootField?.keyNext ?? 1,
    };
  }

  /**
   * The heir, now the host: the ring from its seeded plan where this page
   * last saw it, and each bot made again where this page last saw its figure
   * (which then gives way to it, so nothing jumps), with its kit, its health
   * and whatever it was in the middle of. Then the packages, the placings and the
   * loot keys as the host had them.
   */
  protected override restoreAsHost(now: number, _oldHost: number, mode: unknown): void {
    // (on the final sector's circle, as the first host's: without it the bots fled the decay, packages fell and a won
    // Gulag dropped you toward the seed's own circles, Milestone 726)
    const ring = new Ring(this.area, seeded((this.seed ^ RING_SALT) >>> 0), RING_ATTRACTORS, this.phases, this.decayCircle ?? undefined);
    ring.restore(this.view, this.area);
    this.ring = ring;
    // the capture's meter where this page last heard it (Milestone 728): the old host's meters went with it, and a hold
    // under way started again from nothing on the heir. The holder's alone: the others' were never told.
    this.capture.progress.clear();
    if (this.capture.holder >= 0 && this.capture.held > 0) this.capture.progress.set(this.capture.holder, this.capture.held);
    const s = readBrSnap(mode);
    if (!s) return;
    const rt = (v: number | null): number => (v === null ? Infinity : now + v);
    for (const row of s.b) {
      const id = Duel.BOT_ID + row.i;
      if (this.bots.some((b) => b.bot.index === row.i)) continue;
      const r = this.remotes.get(id);
      const last = r?.samples[r.samples.length - 1];
      const spawn: Spawn = last ? { x: last.x, z: last.z, yaw: last.yaw } : { x: row.dt[0], z: row.dt[1], yaw: 0 };
      const bot = this.makeBot(row.i, WIRE_TIERS[row.t] ?? "normal", spawn);
      if (last) bot.pos.y = last.y;
      bot.restoreKit(row.k);
      if (!this.startLoot || row.as) bot.dummy.setGunVisible(true);
      const b: BrBot = { bot, node: row.n, goal: row.g, armedAt: rt(row.ar), armedShown: row.as, landed: true, team: row.tm, slot: row.sl, dropTo: { x: row.dt[0], z: row.dt[1] }, jumpAt: Infinity };
      if (r) {
        bot.dummy.health = r.health;
        bot.dummy.shield = Math.min(r.shield, bot.dummy.shieldMax);
      }
      bot.remote.shieldMax = bot.dummy.shieldMax;
      bot.remote.health = bot.dummy.health;
      bot.remote.shield = bot.dummy.shield;
      if (!row.al) {
        bot.dummy.fallDown(false);
        bot.remote.alive = false;
      }
      this.bots.push(b);
      this.dropFigure(id);
    }
    this.podSeq = Math.max(this.podSeq, s.ps);
    for (const ph of s.pp) this.podPhases.add(ph);
    for (const [side, place] of s.pl) this.placedAt.set(side, place);
    if (this.lootField) this.lootField.keyNext = s.nk;
    this.botSendNext = 0;
    this.ringSendNext = 0;
  }

  /** the bots as the host runs them: index, tier and squad (the tests) */
  get botRoster(): string[] {
    return this.bots.map((b) => `${b.bot.index}:${b.bot.diff.name}:${b.team}`).sort();
  }

  // ------------------------------------------------------------ the squad

  /** a squad mate still standing (a ghost waits for one): never in solo, nor from the Gulag */
  protected override squadUp(): boolean {
    if (this.gulag) return false;
    if (this.team.size <= 1) return false;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && this.friendly(r.id) && this.standing(r)) return true;
    return false;
  }

  /**
   * Up in the match: alive, and not in the Gulag. A player in the Gulag's
   * room is alive there, but nobody here can be helped by them (plan section
   * 12, item 2). Their squad is still not out while they are in it, which the
   * side's own count keeps (sideOut, gulagIds).
   */
  private standing(r: { id: number; alive: boolean }): boolean {
    return r.alive && !this.gulagIds.has(r.id);
  }

  /** a squad of bots wiped out, the last of it by anyone (announcer.ts) */
  onWiped: (() => void) | null = null;

  /** where the match is played: the whole map */
  readonly area: { cx: number; cz: number; r: number };

  /** a place well inside the area, and every spot a squad drops on there too (a drop can be 30 m from the middle) */
  private inArea(p: { x: number; z: number; drops?: ReadonlyArray<{ x: number; z: number }> }): boolean {
    const inside = (x: number, z: number) => Math.hypot(x - this.area.cx, z - this.area.cz) <= this.area.r * 0.9;
    return inside(p.x, p.z) && (p.drops ?? []).every((d) => inside(d.x, d.z));
  }

  /** started with fewer friends than it was made for: the sides are counted again */
  protected override onStartShort(): void {
    this.squadsTotal = squadsInMatch(this.botCount, this.team.size, this.players, this.split);
    this.squadsSeen = this.squadsTotal;
  }

  /** the host's landing and a guest's say the same thing, and solo says it differently */
  protected override fightNotice(): string {
    return `LANDED  ·  LAST ${this.team.size === 1 ? "ONE" : "SQUAD"} STANDING WINS`;
  }

  /**
   * Solo is everyone against everyone. Duel's rule puts every human on one
   * side in any battle royale, so friends in a solo match could not hurt each
   * other and two left alive both "won" when the bots were gone.
   */
  protected override friendly(id: number): boolean {
    return this.team.size > 1 && super.friendly(id) && this.sideOf(id) === this.sideOf(this.id);
  }

  /** a human's side: their own in solo, their squad when the friends are split, else everyone's */
  sideOf(id: number): number {
    return sideOfHuman(id, this.team.size, this.split);
  }

  /** the humans are more than one side (solo with friends, or squads of friends): each placed on its own */
  private get manySides(): boolean {
    return humanSides(this.team.size, this.players, this.split) > 1;
  }

  /** the one whose jump takes you with them: the first of your squad, unless that is you or you are alone in it */
  jumpmaster(): number | null {
    if (this.team.size === 1 || this.players < 2) return null;
    const first = this.split ? this.sideOf(this.id) * this.team.size : 0;
    return first === this.id || first >= this.players ? null : first;
  }

  /** you lead a squad of more than you down */
  isJumpmaster(): boolean {
    if (this.team.size === 1 || this.players < 2) return false;
    const first = this.split ? this.sideOf(this.id) * this.team.size : 0;
    return first === this.id && first + 1 < this.players;
  }

  /** the host: where each side of humans finished, noted as it went out (by side) */
  private placedAt = new Map<number, number>();

  /**
   * The host, with the humans on more than one side (solo with friends, or
   * squads of friends): note which side is out and where it placed, and end
   * the match once one side is left. A side is standing while one of it is up
   * (a player in the Gulag counts); one that comes back (the Gulag won, a
   * redeploy) loses the placing.
   */
  private judgeSides(): void {
    if (!this.manySides || this.role !== "host" || this.brOver || this.phase !== "fight") return;
    const humans = [this.id, ...[...this.remotes.values()].filter((r) => r.id < Duel.BOT_ID).map((r) => r.id)];
    const up = (id: number): boolean => {
      if (this.gulagIds.has(id)) return true;
      if (id === this.id) return this.alive;
      const r = this.remotes.get(id);
      return !!r && r.alive;
    };
    const sides = [...new Set(humans.map((id) => this.sideOf(id)))];
    const standing = sides.filter((s) => humans.some((id) => this.sideOf(id) === s && up(id)));
    const botSides = this.botSquadsAlive;
    for (const s of sides) {
      if (standing.includes(s)) this.placedAt.delete(s);
      // out now: behind every side still standing
      else if (!this.placedAt.has(s)) this.placedAt.set(s, standing.length + botSides + 1);
    }
    // over when one side is left, or when no human is: the bots finishing it
    // among themselves is nothing any of the humans can play for
    if (standing.length > 0 && standing.length + botSides > 1) return;
    // a side of humans won, or every human is out and placed where their side went out
    this.brOver = true;
    const winner = standing.length === 1 && botSides === 0 ? standing[0] : -1;
    for (const id of humans) {
      const won = this.sideOf(id) === winner;
      const placement = won ? 1 : Math.max(2, this.placedAt.get(this.sideOf(id)) ?? 2);
      if (id === this.id) {
        this.brOver = false;
        this.finishBr(won, placement);
      } else this.links.get(id)?.send({ t: "brend", won, placement });
    }
    this.brOver = true;
  }

  /** a squad mate gone (left, or silent): with nobody of the squad still up, it is over */
  protected override playerGone(id: number, notice: string): void {
    super.playerGone(id, notice);
    // (gone from the Gulag too: one who left in it stayed counted in there, and their side was never out, Milestone 726)
    this.gulagIds.delete(id);
    if (this.manySides) this.judgeSides();
    else if (this.role === "host" && !this.brOver && this.phase === "fight" && this.sideOut) this.endBr(false);
  }

  /** the match ends for this side: once the result is in, say the result (the host's goodbye follows it) */
  protected override finish(reason: string): void {
    const p = this.placement;
    super.finish(this.brOver && p ? this.placedText(p) : reason);
  }

  /**
   * Where you finished, in words. A placement is out of the squads (bot
   * squads and yours), not the players: in trios a squad wiped with two bot
   * squads still up is third, and it read "#7 of 10" once the bots came in
   * threes. In solo the two are the same count.
   */
  private placedText(p: number): string {
    const solo = this.team.size === 1;
    if (p === 1) return solo ? "You won the battle royale." : "The squad won the battle royale.";
    return solo ? `You placed #${p} of ${this.squadsTotal}.` : `The squad placed #${p} of ${this.squadsTotal} squads.`;
  }

  /** a human out (any side, this player included): the host decides whether the squad is out */
  protected override onSomeoneDown(_id: number, _by: number): void {
    for (const o of this.bots) o.bot.forget(_id);
    if (this.manySides) this.judgeSides();
    else if (this.role === "host" && this.sideOut) this.endBr(false);
  }

  /** the remote's name for the feed, bots included on the host */
  protected nameOf(id: number): string | undefined {
    if (this.gulagBot && id === this.gulagBot.remote.id) return this.gulagBot.remote.name;
    return this.remotes.get(id)?.name ?? this.bots.find((b) => b.bot.remote.id === id)?.bot.remote.name;
  }

  /**
   * SpeedKills' capture zone, on the host (decay.json capture): once every
   * sector but the final one has gone, a squad alone in the zone fills its
   * meter, two at once fill neither, and a meter full ends the match: a side
   * of players wins it, or a bot squad does and everyone else is placed behind.
   */
  private updateCapture(dt: number, local: LocalState): void {
    const zone = this.captureZone();
    const c = this.capture;
    c.open = !!zone;
    if (!zone || this.role !== "host" || this.brOver || this.phase !== "fight") return;
    const inside = (x: number, z: number): boolean => Math.hypot(x - zone.x, z - zone.z) <= zone.r;
    const here = new Set<number>();
    if (this.alive && !this.gulagIds.has(this.id) && inside(local.x, local.z)) here.add(this.sideOf(this.id));
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive) continue;
      const last = r.samples[r.samples.length - 1];
      if (last && inside(last.x, last.z)) here.add(this.sideOf(r.id));
    }
    for (const b of this.bots) if (b.bot.alive && !b.bot.dropping && inside(b.bot.pos.x, b.bot.pos.z)) here.add(CAPTURE_BOT + b.team);
    if (here.size !== 1) {
      // empty, or contested: nobody's meter moves
      c.holder = here.size > 1 ? -2 : -1;
      c.held = 0;
      return;
    }
    const key = [...here][0];
    const held = (c.progress.get(key) ?? 0) + dt;
    c.progress.set(key, held);
    c.holder = key;
    c.held = held;
    if (held < decayCfg.capture.hold) return;
    // a full meter: the match is theirs
    if (key >= CAPTURE_BOT) {
      this.onFeed?.("A SQUAD HELD THE CAPTURE ZONE", false, true);
      // (friends on sides of their own each placed as their side stands: Milestone 727)
      if (this.manySides) this.placeSides(null, this.botSquadsAlive + 1);
      else this.endBr(false);
      return;
    }
    this.placeSides(key, 2);
  }

  /**
   * A capture's result, a side at a time (Milestone 727): the side that held it first, a side already out at the place
   * it went out in (judgeSides placedAt), any other at `rest`. Every side was told the same place: behind the bot squads
   * when a bot squad held it, second when a side of players did, a side out long before among them.
   */
  private placeSides(winner: number | null, rest: number): void {
    const humans = [this.id, ...[...this.remotes.values()].filter((r) => r.id < Duel.BOT_ID).map((r) => r.id)];
    for (const id of humans) {
      const side = this.sideOf(id);
      const won = side === winner;
      const placement = won ? 1 : Math.max(2, this.placedAt.get(side) ?? rest);
      if (id === this.id) this.finishBr(won, placement);
      else this.links.get(id)?.send({ t: "brend", won, placement });
    }
    this.brOver = true;
  }

  /** the host: the squad's result, sent to everyone */
  private endBr(won: boolean): void {
    if (this.brOver) return;
    // placed behind every bot squad still up (in solo, every bot)
    const placement = won ? 1 : this.botSquadsAlive + 1;
    this.broadcast({ t: "brend", won, placement });
    this.finishBr(won, placement);
  }

  private finishBr(won: boolean, placement: number): void {
    if (this.brOver) return;
    this.brOver = true;
    this.placement = won ? 1 : Math.max(2, placement);
    this.phase = "matchEnd";
    this.finishedAt = wallClock();
    this.endAt = this.finishedAt + END_HOLD;
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
      // out of the squads, as the card and the result line say it
      placement: this.placement ?? this.squadsTotal,
      players: this.squadsTotal,
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
    if (m.t === "door") {
      const doors = this.map.doors;
      const d = doors.list[m.i];
      if (!d) return;
      if (this.role === "host") {
        // a friend asking: only from near the door (a page can claim anything), and never shut on anybody
        const at = this.whereIs(from);
        const near = !!at && at.distanceTo(d.centre) <= doorsCfg.guestReach;
        if (m.k === 1) {
          // a friend's kick: counted from within a swing of it
          if (at && at.distanceTo(d.centre) <= doorsCfg.kickReach + 1.5) this.hostKick(d.i);
          return;
        }
        if (!near || !this.hostDoor(d.i, m.open)) this.links.get(from)?.send({ t: "door", i: d.i, open: d.open, b: d.broken ? 1 : undefined });
      } else {
        this.doorAsked.delete(d.i);
        if (m.b === 1) doors.breakDoor(d.i);
        else if (m.k === 1) doors.kickHeard(d.i);
        else doors.set(d.i, m.open);
      }
      return;
    }
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
        const was = f.drops.get(key)?.pos.clone();
        const it = f.remove(key);
        if (it && m.by === this.id && !this.discarding.delete(key)) {
          // granted after you went out (a round trip late): back on the floor where it lay, not into the slots of one who
          // is out (Milestone 726: with both full the gun in hand went down a second time, beside the one your death left)
          if (!this.alive || this.gulag) {
            if (was) this.dropLoot(it, was);
          } else this.onLootTaken?.(it);
        }
      } else if (m.op === "add" && at) {
        const it = wireItem(m.item);
        if (it) f.add(it, at, key);
      }
      return;
    }
    if (m.t === "pod") {
      // no more warning than this build ever gives: a stray number cannot hang a package in the sky
      if (this.role !== "host" && Array.isArray(m.at) && m.at.length === 3 && m.at.every((v) => typeof v === "number" && Number.isFinite(v)) && typeof m.lands === "number" && Number.isFinite(m.lands)) {
        this.addPod(new THREE.Vector3(...(m.at as [number, number, number])), Math.max(0, Math.min(brCfg.pod.announce + LOOT.podFall, m.lands)));
      }
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
      if (typeof m.sq === "number" && Number.isFinite(m.sq)) this.squadsSeen = Math.max(0, Math.floor(m.sq));
      // the doors as the host has them (this is how a friend who missed a door, or came back, is put right),
      // but not one this page asked about in the last second: the host's answer is on its way
      if (Array.isArray(m.db)) for (const n of m.db) if (typeof n === "number") this.map.doors.breakDoor(n);
      if (Array.isArray(m.dr)) {
        const t = wallClock();
        const open = new Set(m.dr.filter((n) => typeof n === "number"));
        for (const d of this.map.doors.list) if (t - (this.doorAsked.get(d.i) ?? -Infinity) > 1) this.map.doors.set(d.i, open.has(d.i));
      }
      // SpeedKills' capture zone, as the host has it
      if (Array.isArray(m.cp) && m.cp.length === 3 && m.cp.every((x) => typeof x === "number" && Number.isFinite(x))) {
        this.capture.open = m.cp[0] === 1;
        this.capture.holder = Math.round(m.cp[1]);
        this.capture.held = Math.max(0, Math.min(decayCfg.capture.hold, m.cp[2]));
      }
    } else if (m.t === "brend") this.finishBr(m.won, m.placement);
  }

  override update(local: LocalState): void {
    this.lastLocal = local;
    const frameDt = Math.max(0, Math.min(0.1, wallClock() - this.lastClock));
    super.update(local);
    if (this.ended) return;
    const now = wallClock();
    if (this.phase === "matchEnd" && now >= this.endAt) {
      // over: the links stay open, for the group's next match (main's endMatch takes them)
      this.finish(this.placement ? this.placedText(this.placement) : "The battle royale is over.");
      return;
    }
    // the ship flies on every browser, on its own clock, from when this page has shown the match
    if (local.shipHeld) this.holdShip(now);
    this.placeShip(now);
    // the Gulag: your first death's way back, while there is a match to go back to (the end card's seconds took a mate's
    // win's waiting player into the room and cut the killcam and the recap, Milestone 726)
    if (this.phase !== "matchEnd" && !this.brOver) this.gulagFrame(now, frameDt, local);
    this.updatePods(now);
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
        const outHere = this.decay ? this.lostAt(local.x, local.z) : Math.hypot(local.x - cur.cx, local.z - cur.cz) > cur.r;
        if (this.alive && !this.gulag && outHere) this.hurt(this.phases[Math.min(this.view.phase, this.phases.length - 1)].damage, -1);
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
    // the start of the drop: the ship sets off on this browser's clock, before
    // main is told (super.respawn calls onRespawn, which boards it)
    if (this.shipLine && !this.ship) {
      const now = wallClock();
      this.ship = new ShipRun(this.shipLine, now);
      this.shipModel = buildShip();
      this.scene.add(this.shipModel.group);
      this.placeShip(now);
    }
    super.respawn();
    this.dropAt = wallClock();
    this.launchBots();
  }

  /**
   * Main asks at the start of the drop whether to board the ship rather than
   * drop straight in. Once.
   */
  takeBoarding(): ShipRun | null {
    if (this.boardingTaken || !this.ship || this.respawnPoint || this.ship.gone(wallClock())) return null;
    this.boardingTaken = true;
    return this.ship;
  }

  /**
   * The host: the bots board the ship, each to leave it as it passes nearest
   * its place (a squad together, the squads a moment apart). With no ship they
   * drop straight onto their places. Either way they come down from the sky:
   * the squad match had them start on the ground.
   */
  private launchBots(): void {
    if (this.role !== "host" || this.botsLaunched) return;
    this.botsLaunched = true;
    const run = this.ship;
    const late = new Map<number, number>();
    for (const b of this.bots) {
      if (!b.bot.alive) continue;
      if (run) {
        if (!late.has(b.team)) late.set(b.team, Math.random() * SHIP.botJitter);
        b.bot.boardShip();
        b.bot.pos.copy(run.at(wallClock()));
        b.jumpAt = run.abeamAt(b.dropTo.x, b.dropTo.z) + late.get(b.team)! + b.slot * SHIP.botGap;
      } else {
        b.bot.pos.x = b.dropTo.x;
        b.bot.pos.z = b.dropTo.z;
        b.bot.dropFrom(DROP_HEIGHT * (0.8 + Math.random() * 0.4));
      }
    }
  }

  /**
   * The ship waits at its start (SpeedKills: the loading screen and the card are still up on this page): its clock is
   * moved on by the wait, and so is each bot's jump off it, so a bot still leaves as the ship passes its place
   */
  private holdShip(now: number): void {
    const run = this.ship;
    if (!run) return;
    const late = now - run.startAt;
    if (late <= 0) return;
    run.startAt = now;
    for (const b of this.bots) if (b.bot.aboard && Number.isFinite(b.jumpAt)) b.jumpAt += late;
  }

  /** the ship's figure where the flight has got to; taken away a while after it leaves the map */
  private placeShip(now: number): void {
    const run = this.ship;
    const m = this.shipModel;
    if (!run || !m) return;
    run.at(now, m.group.position);
    m.group.rotation.set(0, (run.yaw * Math.PI) / 180, 0);
    m.setDoors(run.doorsOpen(now));
    if (run.along(now) > run.line.length + SHIP.speed * 12) this.dropShipModel();
  }

  private dropShipModel(): void {
    const m = this.shipModel;
    if (!m) return;
    m.group.removeFromParent();
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.shipModel = null;
  }

  /** a player's figure by id, while it is being drawn: the jumpmaster a squad follows down */
  figureOf(id: number): Dummy | null {
    const r = this.remotes.get(id);
    return r && r.samples.length ? r.avatar : null;
  }

  /** the host: the ring, the bots, and what goes out about them */
  protected override tick(now: number, dt: number, local: LocalState): void {
    const ring = this.ring;
    if (!ring || this.brOver) return;
    // the lobby (someone still on the menu): the ring, the care packages and the bots wait for the drop
    if (this.phase === "waiting") return;
    // the drop ends for the host when it lands: the fight is on from then
    // (a skydive is in the air too: the figure others see has its own stance for it, Milestone 604)
    if (this.phase === "countdown" && !airborne(local.stance) && now - this.dropAt > 1) {
      this.enter("fight", now, 0);
      this.onNotice?.(this.fightNotice());
    }
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    // the bots that have landed search, then have their gun and a shield of some tier
    for (const b of this.bots) {
      if (!b.landed && b.bot.alive && !b.bot.dropping) {
        b.landed = true;
        b.landedAt = { x: b.bot.pos.x, z: b.bot.pos.z };
        // where it came down, its own floor's node (its node was chosen in the sky, by (x, z) alone)
        b.node = b.goal = this.nearestNode(b.bot.pos.x, b.bot.pos.z, b.bot.pos.y);
        b.climb = null;
        // nobody shoots for a moment after a landing, loot or loadouts; with
        // loot on, the bot's own search is what keeps its gun down after that
        b.armedAt = now + squadCfg.drop.grace;
      }
      if (b.landed && this.botArmed(b, now) && !b.armedShown && b.bot.alive) {
        // found its gun and a shield of some tier (its health is what it is)
        b.armedShown = true;
        // With loot on, the shield tier and the gun are whatever the bot has
        // found (bots.ts equip and setArmor): a random tier here would write
        // over the armour it looted. With loadouts it had its kit all along.
        if (!this.startLoot) b.bot.dummy.setGunVisible(true);
        b.bot.remote.shieldMax = b.bot.dummy.shieldMax;
        b.bot.remote.shield = b.bot.dummy.shield;
      }
    }
    // The centre's loot coming back (speedkills.json loot.restock), the host's to roll and send, as a drop is
    const RS = PROFILE.loot?.restock;
    if (RS && this.role === "host" && this.lootField && this.phase === "fight" && now >= this.restockAt) {
      this.restockAt = now + RS.every;
      for (const { item, at } of this.lootField.restockPlan(RS, Math.random)) this.dropLoot(item, at);
    }
    // a care package inside the next ring as br.json's rounds close; the
    // squad is told the whole warning, announce and fall, so every screen
    // counts the same arrival down
    const P = brCfg.pod;
    if (this.lootField && ring.state === "closing" && P.phases.includes(ring.phase) && !this.podPhases.has(ring.phase)) {
      this.podPhases.add(ring.phase);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * ring.next.r * P.inset;
      // out of any wall or rock it would have come down in, as a bot's landing is
      const clear = clearGround(ring.next.cx + Math.cos(a) * r, ring.next.cz + Math.sin(a) * r);
      const at = new THREE.Vector3(clear.x, 0, clear.z);
      const warning = P.announce + LOOT.podFall;
      this.addPod(at, warning);
      this.broadcast({ t: "pod", at: [at.x, at.y, at.z], lands: warning });
    }
    // The ring: a tick hurts everyone outside it (the guests hurt themselves).
    // Its first wait starts once the dropship has flown its line: round one's
    // wait was set before there was a ship, and the ride and the dive ate 12
    // to 25 s of it, which left about 25 s to loot before the first close.
    const shipFlying = this.shipLine !== null && (!this.ship || !this.ship.gone(now));
    const tick = shipFlying ? false : ring.update(dt);
    this.view = { phase: ring.phase, state: ring.state, timeLeft: Math.max(0, ring.timeLeft), current: { ...ring.current }, next: { ...ring.next } };
    if (tick && this.phase === "fight") {
      const out = (x: number, z: number): boolean => (this.decay ? this.lostAt(x, z) : ring.outside(x, z));
      if (this.alive && !this.gulag && out(local.x, local.z)) this.hurt(ring.damage, -1);
      for (const b of this.bots) {
        if (!b.bot.alive || b.bot.dropping) continue;
        if (out(b.bot.pos.x, b.bot.pos.z)) {
          b.bot.dummy.hit(now, "body", ring.damage, 1, 1, b.bot.pos);
          b.bot.remote.health = b.bot.dummy.health;
          b.bot.remote.shield = b.bot.dummy.shield;
          if (b.bot.dummy.knocked) this.botDown(b, -1);
        }
      }
    }
    this.updateCapture(dt, local);
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
        sq: this.squadsAlive,
        dr: this.map.doors.openList(),
        db: this.map.doors.brokenList(),
        // SpeedKills: the capture zone (open, who holds it alone, their seconds)
        cp: this.decay ? [this.capture.open ? 1 : 0, this.capture.holder, Math.round(this.capture.held * 10) / 10] : undefined,
      });
    }

    // the humans a bot can go after: the host, and the guests where they last were
    // what each is doing, for the bots' eyes: a runner is seen further out, a
    // crouched body nearer, and anyone who has just fired gives themselves away
    const firing = (id: number) => now - (this.shotAt.get(id) ?? -Infinity) < 0.5;
    const humans: Array<{ id: number; feet: THREE.Vector3; low: boolean; cue: SightCue }> = [];
    // a player under INVISIBILITY is not seen by the bots until it runs out or they fire (SpeedKills)
    const unseen = (id: number) => (this.hiddenUntil.get(id) ?? -Infinity) > now && !firing(id);
    if (this.alive && !this.gulagIds.has(this.id) && !unseen(this.id)) humans.push({ id: this.id, feet, low: local.crouch, cue: { speed: local.speed, crouched: local.crouch, firing: firing(this.id) } });
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive || unseen(r.id)) continue;
      const last = r.samples[r.samples.length - 1];
      const low = !!last && (last.stance === "crouch" || last.stance === "slide");
      if (last) humans.push({ id: r.id, feet: new THREE.Vector3(last.x, last.y, last.z), low, cue: { speed: last.speed, crouched: low, firing: firing(r.id) } });
    }

    // the ship: a bot leaves it as it passes nearest the bot's place, and
    // nobody is still aboard past the far edge
    const run = this.ship;
    if (run) {
      const at = run.riderAt(now);
      for (const b of this.bots) {
        if (!b.bot.aboard) continue;
        if (now >= b.jumpAt || run.gone(now)) b.bot.leaveShip(at.clone().setY(at.y - SHIP.exit), b.dropTo);
        else b.bot.pos.copy(at);
      }
    }

    // the bots: sense, walk the graph, fight; their shots are tested here
    for (const b of this.bots) {
      const bot = b.bot;
      const wasAlive = bot.alive;
      const sense: BotSense = bot.alive && !bot.dropping ? this.sense(b, humans) : { target: null, targetId: -1, goal: null, canShoot: false };
      // a shut door in its way: it opens it, as anyone would
      if (bot.alive && !bot.dropping) {
        const door = this.map.doors.closedAt(bot.pos, doorsCfg.botReach);
        if (door) this.hostDoor(door.i, true);
        this.botTraversal(b, sense, b.ropeTo);
      }
      // still searching: it walks the map and does not shoot
      if (b.armedAt > now) sense.canShoot = false;
      const shots = bot.update(now, dt, sense);
      // and held there, whatever moved it (a pad's throw, a chase along the edge); the ship carries riders outside before its doors open
      if (bot.alive && !bot.aboard && !bot.dropping) {
        const r = MOVE.radius;
        bot.pos.x = Math.max(BR_BOUNDS.minX + r, Math.min(BR_BOUNDS.maxX - r, bot.pos.x));
        bot.pos.z = Math.max(BR_BOUNDS.minZ + r, Math.min(BR_BOUNDS.maxZ - r, bot.pos.z));
        bot.dummy.group.position.copy(bot.pos);
      }
      if (wasAlive && !bot.alive && bot.remote.alive) this.botDown(b, this.id);
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
        for (const s of shots) if (hitsBody(s.from, s.dir, human.feet, human.low ? CROUCH_TOP : BODY_TOP)) dealt += s.damage;
        if (dealt <= 0) continue;
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
          // (a rocket's shot does nothing: its burst does, botBurst)
          if (s.damage <= 0 || !hitsBody(s.from, s.dir, other.bot.pos, BODY_TOP)) continue;
          other.bot.dummy.hit(now, "body", s.damage, 1, 1, other.bot.pos.clone().setY(other.bot.pos.y + 1.2));
          other.bot.remote.health = other.bot.dummy.health;
          other.bot.remote.shield = other.bot.dummy.shield;
          if (other.bot.dummy.knocked) {
            this.botDown(other, bot.remote.id, bot.weapon.id);
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
        // on the ship it is nowhere yet: a guest draws a figure only once one has been sent
        if (bot.aboard) continue;
        const yaw = ((bot.dummy.group.rotation.y - Math.PI) * 180) / Math.PI;
        // what its hands are doing and where it aims, as a player's state says: a guest's figure of a bot reloaded and
        // aimed in only on the host's screen
        const pose = bot.dummy.currentPose;
        const ac = actCode(pose.act ?? null, pose.reloadEmpty);
        this.broadcast({
          t: "s",
          from: bot.remote.id,
          tm: senderStamp(),
          x: bot.pos.x,
          y: bot.pos.y,
          z: bot.pos.z,
          yaw,
          pitch: pose.pitch,
          ad: pose.ads ? Math.round(pose.ads * 10) : undefined,
          ac: ac || undefined,
          crouch: bot.crouching,
          w: this.botArmed(b, now) ? bot.remote.avatarWeapon : "",
          hp: bot.dummy.health,
          sh: bot.dummy.shield,
          alive: bot.alive,
          op: bot.remote.avatarOp,
          name: bot.remote.name,
          ready: true,
          st: bot.travel?.kind === "zip" ? 6 : bot.dropping || bot.travel ? 3 : bot.crouching ? 1 : 0,
          sp: bot.alive && !bot.dropping ? Math.round(bot.diff.speed * 10) : 0,
        });
      }
    }
  }

  /** what a bot can see and where it should go */
  private sense(b: BrBot, humans: Array<{ id: number; feet: THREE.Vector3; low: boolean; cue: SightCue }>): BotSense {
    const bot = b.bot;
    // the nearest enemy in sight: a human, or another bot
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    // everyone it might be after, nearest first, so the first it sees is the one: the lines of sight
    // to anyone further are never cast (each is kept a moment, bots.json sight.recheck)
    const near: Array<{ d: number; feet: THREE.Vector3; id: number; cue?: SightCue }> = [];
    if (this.phase === "fight") {
      for (const h of humans) near.push({ d: bot.pos.distanceTo(h.feet), feet: h.feet, id: h.id, cue: h.cue });
    }
    for (const o of this.bots) {
      // its own squad is not a target: in duos and trios the bots land in
      // twos and threes, and they used to shoot each other on the way down
      if (o === b || o.team === b.team || !o.bot.alive || o.bot.dropping) continue;
      near.push({ d: bot.pos.distanceTo(o.bot.pos), feet: o.bot.pos, id: o.bot.remote.id });
    }
    near.sort((x, y) => x.d - y.d);
    for (const c of near) {
      if (!bot.sees(c.feet, c.cue, c.id)) continue;
      target = c.feet;
      targetId = c.id;
      break;
    }
    // A squad acts as one: what one bot sees, its mates close by go to look at.
    const mates = this.team.size > 1 ? this.bots.filter((o) => o !== b && o.team === b.team && o.bot.alive && !o.bot.dropping) : [];
    if (target && targetId >= 0) {
      const now = wallClock();
      for (const m of mates) {
        if (m.bot.pos.distanceTo(bot.pos) > SQUADS.share) continue;
        if (!m.bot.lastSeen || now - m.bot.lastSeen.at > 1) m.bot.lastSeen = { pos: target.clone(), at: now, id: targetId };
      }
    }
    // the walk: to the next ring's centre when outside it (or when it is
    // closing and this node will be left out), else along the graph
    const nodes = this.map.nodes;
    const ring = this.ring!;
    // SpeedKills: a bot runs for the final sector once its own is warned, decaying or gone
    const skSector = this.decay ? this.sectorStates()[sectorIdAt(bot.pos.x - BR_X, bot.pos.z - BR_Z) ?? ""] : null;
    const outsideNext = this.decay ? !!skSector && skSector.phase !== "live" : Math.hypot(bot.pos.x - ring.next.cx, bot.pos.z - ring.next.cz) > ring.next.r - 4;
    const hurry = this.decay ? outsideNext : outsideNext && (ring.state === "closing" || ring.timeLeft < 25 || ring.outside(bot.pos.x, bot.pos.z));
    let goal: THREE.Vector3 | null;
    // standing under its node or over it for a while: the nearest node on its own floor instead
    if (b.landed) this.unstick(b, wallClock());
    // a package coming down near it is worth more than the next node: without
    // this nobody contests one but the squad, and a package nobody contests
    // is a free gold gun rather than an event
    const pod = this.podToContest(bot.pos, b);
    const zone = this.decay && !hurry ? this.captureZone() : null;
    if (hurry) {
      // (a climb is given up: the decay comes first)
      b.climb = null;
      // Along the graph to the node nearest the circle's middle, then straight
      // in: a straight line at the middle from anywhere crossed the Table,
      // the Notch's defile and the edge cliffs, which the graph's tested
      // links go round.
      // It finishes the link it is on first (b.goal), then takes the steps.
      const inside = Math.hypot(bot.pos.x - ring.next.cx, bot.pos.z - ring.next.cz) < ring.next.r * 0.8;
      const cur = nodes[b.goal];
      if (!inside && cur && Math.hypot(cur.x - bot.pos.x, cur.z - bot.pos.z) < 3 && Math.abs((cur.y ?? bot.pos.y) - bot.pos.y) < 2.5) {
        b.node = b.goal;
        const hop = this.hurryHop(ring.next.cx, ring.next.cz, b.node);
        if (hop >= 0) {
          b.goal = hop;
          // a step the graph says is a rope: the bot rides it from this end
          const here = nodes[b.node];
          b.ropeTo = here?.ropes?.includes(hop) ? { x: nodes[hop].x, z: nodes[hop].z } : null;
        }
      }
      const g = nodes[b.goal];
      // inside the circle, or at the node nearest its middle: straight in
      goal = inside || !g || (b.goal === b.node && this.hurryHop(ring.next.cx, ring.next.cz, b.node) < 0) ? new THREE.Vector3(ring.next.cx, 0, ring.next.cz) : new THREE.Vector3(g.x, 0, g.z);
    } else if (zone) {
      // SpeedKills' capture zone, open: the squads go for it and hold it, along the graph to the node nearest its
      // middle whatever its height, up the Spire's stairs, bridges and pads if that is where it is
      b.climb = null;
      const t = this.zoneTree(zone);
      const cur = nodes[b.goal];
      if (cur && Math.hypot(cur.x - bot.pos.x, cur.z - bot.pos.z) < 1.5 && Math.abs((cur.y ?? bot.pos.y) - bot.pos.y) < 1) {
        b.node = b.goal;
        const hop = b.node === t.target ? -1 : t.toward[b.node];
        if (hop >= 0) b.goal = hop;
      }
      const g = nodes[b.goal];
      goal = new THREE.Vector3(g.x, 0, g.z);
    } else if (pod) {
      goal = pod;
    } else if (b.climb) {
      // SpeedKills: up a low tower's stairs, a node at a time, then the roof held a while
      const c = b.climb;
      const cur = nodes[b.goal];
      if (cur && Math.hypot(cur.x - bot.pos.x, cur.z - bot.pos.z) < 1.2 && Math.abs((cur.y ?? bot.pos.y) - bot.pos.y) < 1) {
        b.node = b.goal;
        if (b.node === c.roof) c.holdUntil ??= wallClock() + botsCfg.skRoofs.hold;
        else {
          const hop = this.climbTree(c.roof).toward[b.node];
          if (hop >= 0) b.goal = hop;
          else b.climb = null;
        }
      }
      if (c.holdUntil !== null && wallClock() >= c.holdUntil) b.climb = null;
      const g = nodes[b.goal];
      goal = new THREE.Vector3(g.x, 0, g.z);
    } else {
      const here = nodes[b.goal];
      // arrived at it, and on its floor: a node on a deck or a crest is not
      // reached by standing under it (a node without a floor is on the sand
      // or on whatever the bot stands on)
      if (Math.hypot(here.x - bot.pos.x, here.z - bot.pos.z) < 3 && Math.abs((here.y ?? bot.pos.y) - bot.pos.y) < 2.5) {
        // a linked node inside the next ring, at random, but not straight back
        // to the one it came from while there is another way on
        const from = b.node;
        b.node = b.goal;
        const inRing = here.links.filter((i) => Math.hypot(nodes[i].x - ring.next.cx, nodes[i].z - ring.next.cz) <= ring.next.r + 20);
        const onward = (list: number[]) => (list.length > 1 ? list.filter((i) => i !== from) : list);
        const options = onward(inRing);
        const all = onward(here.links);
        const pick = options.length ? options[Math.floor(Math.random() * options.length)] : all[Math.floor(Math.random() * all.length)];
        b.goal = pick ?? b.goal;
        // SpeedKills: now and then, the high ground instead (bots.json skRoofs)
        const roof = this.decay ? this.roofFor(b) : -1;
        if (roof >= 0) {
          b.climb = { roof, holdUntil: null };
          const hop = this.climbTree(roof).toward[b.node];
          if (hop >= 0) b.goal = hop;
          else b.climb = null;
        }
      }
      const g = nodes[b.goal];
      goal = new THREE.Vector3(g.x, 0, g.z);
    }
    // The squad follows its first bot, wandering or running from the ring:
    // the others close in when they drift off, each at its own place round it.
    // Not while one of them has a target, or is going for a care package.
    if (!target && !(pod && !hurry) && mates.length) {
      const lead = [b, ...mates].reduce((a, o) => (o.slot < a.slot ? o : a));
      if (lead !== b && bot.pos.distanceTo(lead.bot.pos) > SQUADS.follow) {
        const a = (b.slot / this.team.size) * Math.PI * 2;
        goal = new THREE.Vector3(lead.bot.pos.x + Math.cos(a) * SQUADS.spread, 0, lead.bot.pos.z + Math.sin(a) * SQUADS.spread);
      }
    }
    // (a climb is a purpose, as the ring is: it comes before a loot spot or a hunt, and after someone in sight)
    return { target, targetId, goal, canShoot: this.phase === "fight" && !this.holdFire, urgent: hurry || !!b.climb, exact: !!b.climb };
  }

  /** SpeedKills: the steps toward each low tower's roof, by roof node, worked out once each */
  /** the way to the capture zone's node (navgraph.ts), made once it opens */
  private zoneNav: { key: string; tree: NavTree } | null = null;
  /** the nodes a bot reaches from the street (navgraph.ts reachedFrom), worked out once for the match's map */
  private streetReach: Uint8Array | null = null;
  private zoneTree(z: { x: number; z: number }): NavTree {
    const key = `${z.x.toFixed(1)},${z.z.toFixed(1)}`;
    // (to the nearest node a bot gets to from the street: the zone's nearest of all was a roof only a player climbs to, and
    // a bot in the final sector had no way at all)
    if (!this.zoneNav || this.zoneNav.key !== key) {
      this.streetReach ??= reachedFrom(this.map.nodes, this.map.nodes.flatMap((n, i) => (Math.abs(n.y ?? 0) < 0.5 && n.links.length ? [i] : [])));
      this.zoneNav = { key, tree: navTree(this.map.nodes, z.x, z.z, { reach: this.streetReach }) };
    }
    return this.zoneNav.tree;
  }
  private climbTrees = new Map<number, NavTree>();
  private climbTree(roof: number): NavTree {
    let t = this.climbTrees.get(roof);
    if (!t) {
      t = navTree(this.map.nodes, 0, 0, { target: roof });
      this.climbTrees.set(roof, t);
    }
    return t;
  }

  /** SpeedKills: a roof for this bot to take, by its tier's chance, within reach, and none already holding it; -1 for none.
   * A low tower's roof up its stairs, or a district's walkway up its pad (city.ts DISTRICT_HOLDS) */
  private roofFor(b: BrBot): number {
    const chance = (botsCfg.skRoofs.chance as Record<string, number>)[b.bot.diff.name] ?? 0;
    if (!(Math.random() < chance)) return -1;
    const nodes = this.map.nodes;
    let best = -1;
    let bestD = botsCfg.skRoofs.reach;
    for (const roof of [...ROOF_ROUTES.filter((r) => r.street >= 0).map((r) => r.nodes[r.nodes.length - 1]), ...DISTRICT_HOLDS]) {
      if (this.bots.some((o) => o !== b && o.climb?.roof === roof)) continue;
      const n = nodes[roof];
      const dd = Math.hypot(n.x - b.bot.pos.x, n.z - b.bot.pos.z);
      if (dd < bestD) {
        bestD = dd;
        best = roof;
      }
    }
    return best;
  }

  /** the next step along the graph from each node toward the node nearest a circle's middle, worked out once per circle (navgraph.ts) */
  private hurryTree: { key: string; tree: NavTree } | null = null;

  /** from node `from`, the next node on the graph toward the node nearest (cx, cz): -1 at it (walk straight in from there) */
  private hurryHop(cx: number, cz: number, from: number): number {
    const key = `${cx.toFixed(1)},${cz.toFixed(1)}`;
    // (SpeedKills: the node nearest on the ground, not one up a tower's stairs)
    if (!this.hurryTree || this.hurryTree.key !== key) this.hurryTree = { key, tree: navTree(this.map.nodes, cx, cz, { ground: !!this.decay }) };
    const t = this.hurryTree.tree;
    if (from < 0 || from >= t.toward.length || from === t.target) return -1;
    const step = t.toward[from];
    return step === -2 ? -1 : step;
  }

  // ------------------------------------------------------------ the HUD

  /** the hot zone this match drew, with the place's name on it (null before the loot is laid out) */
  hotZone(): { name: string; x: number; z: number; radius: number } | null {
    const h = this.lootField?.hotZone ?? null;
    if (!h) return null;
    const poi = this.map.pois.find((p) => p.id === h.id);
    return { name: poi?.name ?? h.id.toUpperCase(), x: h.x, z: h.z, radius: h.radius };
  }

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
      hot: this.hotZone(),
      ring: {
        phase: Math.min(v.phase + 1, RING_PHASES.length),
        phases: RING_PHASES.length,
        closing: v.state === "closing",
        timeLeft: v.timeLeft,
        current: { ...v.current },
        next: { ...v.next },
        // not in the Gulag's room: the ring cannot reach you there, so it does not warn you either
        // (nor out: a ghost waiting on its squad walked the decayed streets told it was being hurt, Milestone 733)
        outside: local && this.alive && !(this.gulag && this.gulag.phase !== "wait") ? (this.decay ? this.lostAt(local.x, local.z) : Math.hypot(local.x - v.current.cx, local.z - v.current.cz) > v.current.r) : false,
        damage: this.phases[Math.min(v.phase, this.phases.length - 1)].damage,
      },
      placement: this.phase === "matchEnd" ? this.placement : null,
      // (it went on counting through the end card's hold, so the card said 0:31 and the line over it 0:40)
      survived: (this.finishedAt ?? now) - this.startedAt,
      pois: this.map.pois.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      sites: this.map.sites.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      bounds: { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF },
      team: this.team.size,
      squads: this.squadsAlive,
      squadsTotal: this.squadsTotal,
      towers: this.map.towers,
      pods: this.podSpots,
      // your squad on the map: friends on another side (solo with friends,
      // squads against each other) are enemies, and the map does not show those
      mates: [...this.remotes.values()]
        .filter((r) => r.id < Duel.BOT_ID && this.friendly(r.id) && r.samples.length)
        .map((r) => {
          const s = r.samples[r.samples.length - 1];
          return { id: r.id, x: s.x, z: s.z, name: r.name, alive: r.alive };
        }),
      gulag: this.gulag ? { phase: this.gulag.phase, clock: this.gulag.clock(now), opponent: this.gulagBot?.remote.name ?? "", capMe: this.gulag.capMe, capThem: this.gulag.capThem, capture: GULAG.capture } : null,
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
      out.push({ id: bot.remote.id, name: bot.remote.name, x: bot.pos.x, y: bot.pos.y, z: bot.pos.z, yaw: ((bot.dummy.group.rotation.y - Math.PI) * 180) / Math.PI, pitch: p.pitch, stance: p.stance, speed: p.speed, weapon: bot.remote.avatarWeapon, op: bot.remote.avatarOp, alive: bot.alive, soldier: bot.dummy.skin.soldier });
    }
    return out;
  }

  override vitalsFor(id: number): { shield: number; health: number } | null {
    const b = this.bots.find((x) => x.bot.remote.id === id);
    return b ? { shield: b.bot.dummy.shield, health: b.bot.dummy.health } : super.vitalsFor(id);
  }

  /** a bot of this match where it stands, for the hit check */
  protected override whereIs(id: number): THREE.Vector3 | null {
    const b = this.bots.find((x) => x.bot.remote.id === id);
    return b ? b.bot.pos : super.whereIs(id);
  }

  /** out with others still up: a squad mate first, then whoever is nearest */
  override spectateTarget(): Dummy | null {
    return this.spectateList()[0]?.figure ?? null;
  }

  /**
   * Out of a battle royale: your squad first (their eyes are the ones worth
   * borrowing), then everyone else still standing in the order of how near
   * they were to where you fell, bots included. A ten minute match with a bad
   * landing in it is ten minutes of nothing otherwise.
   */
  override spectateList(): Array<{ figure: Dummy; name: string; friend: boolean }> {
    if (this.alive || this.phase !== "fight") return [];
    const out: Array<{ figure: Dummy; name: string; friend: boolean }> = [];
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !this.friendly(r.id) || !r.alive || !r.samples.length) continue;
      out.push({ figure: r.avatar, name: this.nameOf(r.id) ?? `PLAYER ${r.id + 1}`, friend: true });
    }
    const me = this.lastLocal;
    const rest: Array<{ figure: Dummy; name: string; friend: boolean; d: number }> = [];
    for (const a of this.avatars) {
      if (a.knocked || !a.group.visible) continue;
      if (out.some((o) => o.figure === a)) continue;
      const r = this.remoteOf(a);
      const d = me ? Math.hypot(a.group.position.x - me.x, a.group.position.z - me.z) : 0;
      rest.push({ figure: a, name: (r && this.nameOf(r.id)) || "SOMEONE", friend: false, d });
    }
    rest.sort((a, b) => a.d - b.d);
    return [...out, ...rest.map(({ figure, name, friend }) => ({ figure, name, friend }))];
  }

  override leave(): void {
    if (this.ended) return;
    this.left = true;
    const placed = this.placement;
    for (const l of this.links.values()) l.close();
    this.hostLink?.close();
    this.dispose();
    this.finish(placed ? this.placedText(placed) : "You left the battle royale.");
  }

  override dispose(): void {
    this.map.doors.reset();
    this.dropShipModel();
    this.gulagBot?.dispose();
    this.gulagBot = null;
    this.showFlag(false);
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
