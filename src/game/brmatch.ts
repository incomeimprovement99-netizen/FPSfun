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
//                    welcome carries it). It decides whether a knock is a
//                    down or an elimination, how long the bleed-out is, and
//                    how the bots are grouped, so a solo match is a lobby of
//                    singles rather than a trio match with gaps in it. The
//                    humans are always one side whatever the size: it is
//                    the bots that come in squads.
//   care packages    called before they arrive, marked where they will land,
//                    trailing smoke under a canopy, and lit and pinged for a
//                    while after the thump so there is a window to fight over
//                    one. Bots go for them too.
//   loadout crates   the drop that hands you the loadout you built on the
//                    Loadouts tab. One serves the whole lobby: each player
//                    claims their own guns out of it once. Nothing about it
//                    goes over the wire, because every browser works out the
//                    same spot from the match seed and the ring it can see.
//   the dropship     the match starts on a ship flying a line across the
//                    map (dropship.ts); you jump when you like, a squad
//                    follows its jumpmaster, and the bots leave it as it
//                    passes their places and glide down onto them.
//   the Gulag        under the battle royale's own rules, a first death
//                    goes to a 1v1 in an arena against a bot of your own
//                    (gulag.ts): win and you drop back in, lose and you are
//                    out. The host only hears you are in it, so your squad
//                    is not out and its bots leave you be.
//   Resurgence       a choice beside the squad size (resurgence.ts): the
//                    dead redeploy from the sky after a wait that the side's
//                    kills cut, until a set round of the ring; a side all
//                    dead at once is out. The host runs the bots' waits, and
//                    every browser its own player's.
//   Ring Consoles    terminals by four of the places (ringconsole.ts): a
//                    scan puts the circle after next on the squad's map.
//                    The ring's chain is drawn from the seed at the start,
//                    so every browser knows it; a scan only says which
//                    console and which circle.
//   Storm Surge      the ring is the only pressure and it only hurts you
//                    outside it, so hiding used to win ties. In the late
//                    rounds, when more are alive than the phase allows,
//                    whoever has dealt the least damage starts taking it.
//                    The host ranks everyone, because every hit on a bot
//                    comes to it, and the ring packet carries the line, so a
//                    guest takes its own tick the way it takes the ring's.
import { IS_SK, PROFILE } from "./game";
import type { Seen } from "./reveal";
import moveCfg from "../config/movement.json";
import { ZIPLINES } from "./traversal";
import type { Doors } from "./doors";
import doorsCfg from "../config/doors.json";
import { senderStamp } from "../net/state";
import * as THREE from "three";
import squadCfg from "../config/squad.json";
import brCfg from "../config/br.json";
import { Throwables, blastDamage, throwCode } from "./throwables";
import { lockedHopupFor } from "./attachments";
import { weaponName } from "./weapons";
import { savedLoadout, type LoadoutDef } from "./loadouts";
import { Bot, BODY_TOP, BOT_NAMES, MOST_BOTS, botName, BOT_WEAPONS, CROUCH_TOP, DIFFICULTY, hitsBody, tierFor, type BotSense, type SightCue, BOT_TIERS, type BotKit, type BotTier } from "./bots";
import botsCfg from "../config/bots.json";
import { RANGE_SOLIDS } from "./range";
/**
 * The nearest point to (x, z) where a body stands clear of every box at body
 * height: walls, rock, crates. Floor slabs and roofs are not in the way. The
 * rings stop at 40 m, which no place on the map needs, and the spot asked for
 * comes back if nothing clear is found rather than no spot at all.
 */
function clearGround(x: number, z: number): { x: number; z: number } {
  const pad = 0.7;
  const blocked = (px: number, pz: number): boolean =>
    RANGE_SOLIDS.some((s) => s.base < 1.8 && s.top > 0.56 && px > s.minX - pad && px < s.maxX + pad && pz > s.minZ - pad && pz < s.maxZ + pad);
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
  const covered = (px: number, pz: number): boolean => RANGE_SOLIDS.some((s) => s.top > 0.56 && px > s.minX - pad && px < s.maxX + pad && pz > s.minZ - pad && pz < s.maxZ + pad);
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
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { navTree, type NavTree } from "./navgraph";
import { Ring, RING_ATTRACTORS, RING_PHASES, RING_TICK, ringPace, type Circle, type RingPhase } from "./ring";
import { RESURGENCE, Redeploy, asRules, comesBack, redeployWait, resurgenceLive, resurgencePhases, resurgenceArea, secondsToFinal, type BrRules } from "./resurgence";
import { GULAG, Gulag, gulagFor, type GulagEvent } from "./gulag";
import { arenaMap } from "./arena";

/** the Gulag's bot, apart from the match's (theirs start at Duel.BOT_ID) */
const GULAG_BOT_ID = 990;
import { BR_BOUNDS, BR_CENTER, BR_HALF, type BrMap, type Poi } from "./br";
import { SHIP, ShipRun, buildShip, shipLine, type ShipLine } from "./dropship";
import { buildConsole, consoleSpots } from "./ringconsole";

/** the ring's own stream off the match seed, so the loot field's and the ship's draws do not shift it */
const RING_SALT = 0x2545f491;
import { Duel, HEALTH_MAX, SHIELD_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";
import type { ActorState } from "./killcam";
import { HEAL_CODES } from "./recap";
import brmapCfg from "../config/brmap.json";
/** bot squads acting as squads (bots.json squads) */
const SQUADS = botsCfg.squads;
import { LootField, LOOT, binContents, deathBoxOf, isBin, kittedAttach, seeded, type LootItem, type LootKind, type Rarity } from "./loot";
import { ammoTypeOf, STACK } from "./ammo";

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
  /** what the bleed-out clock is multiplied by (0 = no downs at all) */
  bleed: number;
}

// SpeedKills' own sizes: up to 30 in a match, and no knockdowns (bleed 0)
export const TEAMS: readonly TeamMode[] = IS_SK && PROFILE.match.teams ? PROFILE.match.teams : brCfg.teams;

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

/** Storm Surge as the HUD shows it, the host's own or read off its ring packet */
export interface SurgeView {
  /** the warning is over and the ticks have started */
  live: boolean;
  /** seconds to the first tick, 0 once it is live */
  startsIn: number;
  /** what one tick costs now */
  damage: number;
  /** how many are below the line */
  below: number;
}

/**
 * The notice a change in the surge is worth, or null. The host runs the
 * surge and a guest only sees it in the ring packet, and both come through
 * here so they say the same thing at the same moments: the warning when it
 * is called, each step of its damage once it is live, and its end.
 */
export function surgeNotice(was: SurgeView | null, now: SurgeView | null): string | null {
  if (!now) return was ? "STORM SURGE OVER" : null;
  if (now.live && (!was || !was.live || was.damage !== now.damage)) return `STORM SURGE  ·  ${now.damage} EVERY ${RING_TICK} S IF YOU HIDE`;
  if (!was) return `STORM SURGE IN ${Math.ceil(now.startsIn)}  ·  DEAL DAMAGE OR TAKE IT`;
  return null;
}

/** the most one surge tick can cost: a guest holds a host's number to it */
const SURGE_MAX = Math.max(...brCfg.surge.damage);

/**
 * A pod's ping carries an id of its own, below every player's and the
 * ring's -1. The ping path keeps one ping per sender, so a package pinged as
 * this player replaced their own ping, and a crate called on the same frame
 * as a package replaced the package's.
 */
const POD_MARK = -1000;
/** the vault's marker, for the keycard's holder */
const VAULT_MARK = -900;
const VAULT = brCfg.vault;
/** the vault's news, by the code the host sends it as */
const vaultSays = (code: 0 | 1 | 2, _opener = ""): string =>
  code === 0 ? `${VAULT.guardName} IS DOWN  ·  THE VAULT KEYCARD IS IN HIS BOX` : code === 1 ? "THE VAULT KEYCARD IS ON THE FLOOR" : "THE VAULT IS OPEN";

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

/**
 * What a loadout crate hands you: your loadout's two guns, wearing what the
 * Hot Zone's kitted gun wears (loot.ts kittedAttach) and a magazine of
 * br.json's tier, and br.json's `stacks` of each one's ammo. An energy gun
 * brings its own stockpile and a bow one quiver, the way a match's kit counts
 * them (ammo.ts AmmoPouch.kit).
 */
export function loadoutItems(def: LoadoutDef): LootItem[] {
  const L = brCfg.loadoutPod;
  const ids = [def.slot1, def.slot2];
  const out = ids.map((id): LootItem => ({ kind: "weapon", id, n: 1, rarity: L.rarity as Rarity, mag: L.mag, attach: kittedAttach(id) }));
  for (const type of new Set(ids.map(ammoTypeOf))) {
    if (type === "energy") continue;
    out.push({ kind: "ammo", id: type, n: type === "arrows" ? STACK[type] : STACK[type] * L.stacks, rarity: "common" });
  }
  return out;
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
    /** the circle after next, while a Ring Console scan has shown it */
    ahead: Circle | null;
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
  /** jump towers, respawn beacons, care packages, for the maps */
  towers: Array<{ x: number; z: number }>;
  beacons: Array<{ x: number; z: number }>;
  /** the Ring Consoles, lit while they have something to show this round */
  consoles: Array<{ x: number; z: number; ready: boolean }>;
  /** `loadout` is a loadout crate rather than a care package; `hot` is still worth contesting */
  pods: Array<{ x: number; z: number; landed: boolean; loadout: boolean; hot: boolean }>;
  /** the squad mates, for the maps: where, their name, down or out */
  mates: Array<{ x: number; z: number; name: string; downed: boolean; alive: boolean }>;
  /** Storm Surge, null until the late rounds put it in play; `safe` is this player above the line (the host ranks, a guest reads it off the ring packet) */
  surge: (SurgeView & { safe: boolean }) | null;
  /** standing in a loadout crate: how far through the claim you are, 0 to 1 */
  crate: number | null;
  /** Resurgence: still on (and for how long), and your wait while you are on your way back */
  resurgence: { live: boolean; toFinal: number; redeployIn: number | null } | null;
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
    c: { cell: number; syringe: number; frags: number };
    rd: number;
    dn: [number, number] | null;
    rv: number;
    dt: [number, number];
    gd: [number, number] | null;
  }>;
  kh: number;
  vs: boolean;
  dl: Array<[number, number, number]>;
  sa: number | null;
  ss: number | null;
  pc: number;
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
    const c = x.c as Record<string, unknown> | null;
    return num(x.i) && x.i >= 0 && x.i < 64 && num(x.t) && num(x.tm) && num(x.sl) && num(x.n) && num(x.g) && numOrNull(x.ar) && typeof x.as === "boolean" && typeof x.al === "boolean"
      && !!k && typeof k === "object" && (k.gunId === null || typeof k.gunId === "string") && num(k.gun) && num(k.mag) && num(k.armor) && !!k.mods && typeof k.mods === "object"
      && !!c && num(c.cell) && num(c.syringe) && num(c.frags) && num(x.rd) && (x.dn === null || x.dn === undefined || (Array.isArray(x.dn) && x.dn.length === 2 && x.dn.every(num))) && num(x.rv)
      && Array.isArray(x.dt) && x.dt.length === 2 && x.dt.every(num);
  }).map((r) => {
    const g = (r as { gd?: unknown }).gd;
    return { ...r, ar: r.ar ?? null, dn: r.dn ?? null, gd: Array.isArray(g) && g.length === 2 && g.every(num) ? (g as [number, number]) : null };
  });
  const triples = (Array.isArray(o.dl) ? o.dl : []).filter((r): r is [number, number, number] => Array.isArray(r) && r.length === 3 && r.every(num));
  const pairs = (Array.isArray(o.pl) ? o.pl : []).filter((r): r is [number, number] => Array.isArray(r) && r.length === 2 && r.every(num));
  return {
    b,
    dl: triples,
    sa: num(o.sa) ? o.sa : null,
    ss: num(o.ss) ? o.ss : null,
    pc: num(o.pc) ? o.pc : 0,
    ps: num(o.ps) ? o.ps : 0,
    pp: (Array.isArray(o.pp) ? o.pp : []).filter(num),
    pl: pairs,
    nk: num(o.nk) ? o.nk : 1,
    kh: num(o.kh) ? o.kh : -1,
    vs: o.vs === true,
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
  /** Resurgence: dead, and on its way back */
  redeploy: Redeploy | null;
  /** down, not out (duos and trios): who knocked it, and the seconds of bleed-out left */
  down: { by: number; bleed: number } | null;
  /** its revive of a downed squad mate so far, s (0 while it is not reviving) */
  reviving: number;
  /** the vault's guard: where it stands (world space). On no side, in no squad, never on the ship, and not counted among those left */
  guard?: { x: number; z: number };
  /** the route's next step is a rope to here (br.ts node ropes): the bot rides rather than walks it */
  ropeTo?: { x: number; z: number } | null;
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
// every kind loot.ts can make: backpacks and knockdown shields were left out, so a dropped one sent over the wire was thrown away
const KINDS = ["weapon", "ammo", "heal", "attach", "hopup", "helmet", "banner", "box", "grenade", "bin", "keycard", "backpack", "knockdown", "hack"];

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
  if (o.mythic === true) it.mythic = true;
  if (typeof o.owner === "number") it.owner = o.owner;
  if (typeof o.ownerName === "string") it.ownerName = o.ownerName.replace(/[\p{Cc}<>&"'`]/gu, "").slice(0, 16);
  if (typeof o.pod === "number" && Number.isFinite(o.pod)) it.pod = Math.floor(o.pod);
  if (typeof o.hop === "number" && Number.isFinite(o.hop)) it.hop = Math.max(0, Math.min(10000, o.hop));
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
  /** friends in squads of the size against each other (the host's choice, in the welcome), not one side */
  readonly split: boolean;
  /** every squad at the start, the humans' included: what a placement is out of */
  squadsTotal: number;
  /** a guest: the squads still up, as the host's ring packet last said (a guest runs no bots to count) */
  private squadsSeen: number;
  /** the match seed: the floor's loot, and the loadout crates every browser works out for itself */
  /** the match seed: the loot, the ring, the ship and the hour are all drawn from it */
  readonly seed: number;
  /** the dropship's line, from the seed and the squad's place (null: the drop goes straight onto the place, which the tests ask for) */
  readonly shipLine: ShipLine | null;
  /** this browser's flight along the line, from the start of its drop */
  ship: ShipRun | null = null;
  private shipModel: { group: THREE.Group; setDoors(open: boolean): void } | null = null;
  /** the ship is handed to main once, at the start of the drop: a beacon's respawn drops straight in */
  private boardingTaken = false;
  private botsLaunched = false;
  /** the ring's whole chain, the same on every browser (the host's ring's, or one made from the seed) */
  readonly ringPlan: readonly Circle[];
  /** the Ring Consoles: where, the round each was last scanned in, and its figure */
  readonly consoles: Array<{ x: number; z: number; place: string; usedPhase: number; model: ReturnType<typeof buildConsole> }> = [];
  /** the furthest circle of the plan a console has shown the squad (-1: none) */
  private revealed = -1;
  /** the battle royale or Resurgence: the host's, for everyone */
  readonly rules: BrRules;
  /** the ring's rounds as this match runs them (Resurgence's clock is faster) */
  readonly phases: readonly RingPhase[];
  /** Resurgence: this player is dead and on the way back */
  selfRedeploy: Redeploy | null = null;
  /** the redeploy that just brought this player back, for main to hand over the kit (taken once) */
  private redeployKit = false;
  /** the cut to final deaths has been announced */
  private finalSaid = false;
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
    opts: { players: number; myId: number; link: Link | null; guestId?: number; poi?: string; abilities?: boolean; seed?: number; start?: "loot" | "loadout"; team?: string; ship?: boolean; rules?: string; pace?: string; gulag?: boolean; split?: boolean; vault?: boolean },
    rng: () => number = Math.random
  ) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "br", abilities: opts.abilities ?? true });
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
    // the rules first: Resurgence is played on a quarter of the map
    this.rules = asRules(opts.rules);
    const full = { cx: BR_CENTER.x, cz: BR_CENTER.z, r: BR_HALF * 1.35 };
    const spokes = map.pois.filter((p) => ["north", "south", "east", "west"].includes(p.id));
    const area = this.rules === "resurgence" ? resurgenceArea(this.seed, BR_CENTER, spokes) : full;
    this.area = area;
    // no vault in SpeedKills' city: its loot is guns and hacks
    this.vaultAllowed = opts.vault !== false && !IS_SK;
    // every door shut, as a match starts
    map.doors.reset();
    // the squad drops on one place: the host's pick, told to the guests; in
    // Resurgence one inside the area (the nearest to the pick, the same on
    // every browser)
    let poi = (opts.poi && map.pois.find((p) => p.id === opts.poi)) || map.pois[Math.floor(rng() * map.pois.length)];
    if (!this.inArea(poi)) poi = [...map.pois].filter((p) => this.inArea(p)).sort((a, b) => Math.hypot(a.x - poi.x, a.z - poi.z) - Math.hypot(b.x - poi.x, b.z - poi.z))[0] ?? poi;
    this.poi = poi;
    // the ship's line passes over it, and every browser draws the same one
    this.shipLine = opts.ship === false ? null : shipLine(this.seed, this.poi, BR_BOUNDS);
    const now = wallClock();
    this.startedAt = now;
    this.aliveSeen = this.botCount + this.players;
    const start = area;
    // the tests of the plain death switch it off; a real match always has it
    this.gulagOn = opts.gulag !== false;
    // the ring's clock that goes with the rules, its circles shrunk to the area
    // the pace is the lobby's own setting, applied on top: Resurgence's
    // faster clock is a rule of the mode, this is how long a match should be
    const paced = ringPace(RING_PHASES, opts.pace ?? "normal");
    this.phases = this.rules === "resurgence" ? resurgencePhases(paced, area.r / full.r) : paced;
    // the floor's loot, from the host's seed (the welcome carries it), unless the squad lands with its loadouts
    this.startLoot = opts.start !== "loadout";
    if (this.startLoot) {
      this.lootField = new LootField(scene);
      this.lootField.generate(
        this.seed,
        map.pois.map((p) => ({ x: p.x, z: p.z, id: p.id, radius: p.radius })),
        BR_BOUNDS_WORLD,
        map.sites.map((s) => ({ x: s.x, z: s.z, id: s.id, radius: brmapCfg.siteRadius }))
      );
    }
    if (this.role === "host") {
      // The bots take the OTHER places: where the squad drops is the squad's.
      // Landing beside three of them with no gun was the whole of a match.
      const others = map.pois.filter((p) => p !== this.poi && this.inArea(p)).sort(() => rng() - 0.5);
      let order = others.length ? others : [this.poi];
      // SpeedKills: the centre is the hottest drop, and the bots go there the
      // most (the owner): every other bot squad drops on the Spire, the rest
      // spread over the other sectors
      if (IS_SK) {
        const spire = map.pois.find((p) => p.id === "c");
        const rest = order.filter((p) => p !== spire);
        if (spire) order = rest.length ? rest.flatMap((p) => [spire, p]) : [spire];
      }
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
        const bot = this.makeBot(i, tierFor(difficulty, rng), spawn, rng);
        const node = this.nearestNode(spawn.x, spawn.z);
        // it comes down from the sky, so it lands somewhere with no roof over it
        const dropTo = openGround(spawn.x, spawn.z);
        this.bots.push({ bot, node, goal: node, armedAt: Infinity, landed: false, team: squad, slot: i % this.team.size, dropTo, jumpAt: Infinity, redeploy: null, down: null, reviving: 0 });
      }
      if (this.vaultOn) this.makeGuard(this.botCount);
      this.ring = new Ring(start, seeded((this.seed ^ RING_SALT) >>> 0), RING_ATTRACTORS, this.phases);
      this.view = { phase: 0, state: "waiting", timeLeft: this.phases[0].wait, current: { ...this.ring.current }, next: { ...this.ring.next } };
    } else {
      this.ring = null;
      this.view = { phase: 0, state: "waiting", timeLeft: this.phases[0].wait, current: start, next: start };
    }
    // the chain: the host's own, or the same one drawn here from the seed
    this.ringPlan = this.ring ? this.ring.plan : new Ring(start, seeded((this.seed ^ RING_SALT) >>> 0), RING_ATTRACTORS, this.phases).plan;
    // the consoles, where the seed puts them, lit
    for (const spot of consoleSpots(this.seed, map.pois)) {
      const model = buildConsole();
      model.group.position.set(spot.x, 0, spot.z);
      // the screen toward the place it belongs to
      const poi = map.pois.find((q) => q.name === spot.place);
      if (poi) model.group.rotation.y = Math.atan2(poi.x - spot.x, poi.z - spot.z);
      scene.add(model.group);
      this.consoles.push({ ...spot, usedPhase: -1, model });
    }
    // the vault, locked on every page until its keycard opens it
    if (this.vaultOn) map.doors.lock(map.vault.door);
  }

  /** one of the match's bots: the host's, at the start, or the heir's, in place of the figure it saw (host migration) */
  private makeBot(i: number, tier: BotTier, spawn: Spawn, rng: () => number = Math.random, name = botName(i)): Bot {
    const scene = this.scene;
    const projectiles = this.projectiles;
    const bot = new Bot(i, scene, projectiles, DIFFICULTY[tier], spawn, Duel.BOT_ID + i, BOT_WEAPONS[i % BOT_WEAPONS.length], name);
    // Its eyes are the battle royale's. A bot nobody tells keeps the arena's
    // 55 to 70 m, which was right for a 40 m room and blind on a map
    // 440 m across (bots.ts sightRange, src/config/bots.json sight).
    bot.sightMode = "br";
    // With loot on it lands with nothing and LOOTS for its kit, rather than
    // waiting out a timer and being handed one: a bot that landed somewhere
    // rich is really better armed than one that landed in a field. It
    // holds its fire until it has found a gun (bot.holdingFire).
    if (this.startLoot) {
      bot.dummy.setGunVisible(false);
      const field = this.lootField;
      if (field) {
        bot.lootSource = {
          // Only what is on the bot's own floor. A bot cannot jump or
          // climb, so an item on the floor above can be a metre away across
          // the ground and still out of reach for ever: it stood under one,
          // gave it up, picked the next one up there, and never moved.
          near: (at, r) => [...field.drops.values()].filter((d) => d.item.kind !== "box" && Math.abs(d.pos.y - at.y) <= BOT_LOOT_FLOOR && d.pos.distanceTo(at) <= r),
          take: (key) => {
            const it = field.remove(key);
            // the squad's fields drop an item only on this message, so
            // without it a bot's pickups would stay on every other screen
            if (it) this.broadcast({ t: "loot", op: "gone", key, by: bot.remote.id });
            return it;
          },
        };
      }
    }
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
    return bot;
  }

  /** the round the ring is on (0-based; the host's, or what its last packet said) */
  private get ringPhase(): number {
    return this.view.phase;
  }

  /** a console can be scanned: not already this round, and there is a circle after next to show */
  consoleReady(i: number): boolean {
    const c = this.consoles[i];
    return !!c && c.usedPhase !== this.ringPhase && this.ringPhase + 1 < this.ringPlan.length;
  }

  /** the console within reach of the feet, and whether it has something to show */
  consoleNear(p: THREE.Vector3, reach: number): { index: number; ready: boolean; place: string } | null {
    for (let i = 0; i < this.consoles.length; i++) {
      const c = this.consoles[i];
      if (Math.hypot(p.x - c.x, p.z - c.z) <= reach && Math.abs(p.y) < 2) return { index: i, ready: this.consoleReady(i), place: c.place };
    }
    return null;
  }

  /** your scan finished: the circle after next for the squad, and the console spent for the round. False when there was nothing to show */
  scanConsole(i: number): boolean {
    if (!this.consoleReady(i)) return false;
    const c = this.consoles[i];
    const show = this.ringPhase + 1;
    this.markScanned(i, show);
    this.localFx("rcon", new THREE.Vector3(c.x, 0, c.z), undefined, show);
    return true;
  }

  /** a squad mate's scan (their "rcon" effect): the console at `at` is spent, and plan[show] is on the map */
  hearConsole(at: THREE.Vector3, show: number): void {
    if (!Number.isInteger(show) || show < 1 || show >= this.ringPlan.length) return;
    let best = -1;
    let bestD = 3;
    this.consoles.forEach((c, i) => {
      const d = Math.hypot(c.x - at.x, c.z - at.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) this.markScanned(best, show);
    else this.revealed = Math.max(this.revealed, show);
  }

  private markScanned(i: number, show: number): void {
    const c = this.consoles[i];
    c.usedPhase = show - 1;
    this.revealed = Math.max(this.revealed, show);
  }

  /** the circle after next, while a scan has shown it and the ring has not got there yet */
  get ringAhead(): Circle | null {
    return this.revealed === this.ringPhase + 1 ? { ...this.ringPlan[this.revealed] } : null;
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
  /** a bot has a gun in its hands: past the landing grace, and with loot on, one it has actually found */
  private botArmed(b: { bot: Bot; armedAt: number }, now: number): boolean {
    if (b.armedAt > now) return false;
    return !this.startLoot || b.bot.lootKit.gunId !== null;
  }

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
    return [...super.avatars, ...this.bots.map((b) => b.bot.dummy), ...(this.gulagBot ? [this.gulagBot.dummy] : [])];
  }

  /** the bots this page runs (a squad's, and the vault's guard): a SCOUT's scan finds them as it finds a player */
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
    for (const b of this.bots) if (b.bot.alive && !b.guard) n++;
    return n;
  }
  /** the squad still standing: up and not down (all of it down is the squad out) */
  private get humansAlive(): number {
    let n = this.alive && !this.downed ? 1 : 0;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive && !r.downed) n++;
    return n;
  }
  /** the bot squads with someone still up (the host's: it runs the bots) */
  private get botSquadsAlive(): number {
    const teams = new Set<number>();
    for (const b of this.bots) if (b.bot.alive && !b.guard) teams.add(b.team);
    return teams.size;
  }
  /** squads still in it: the humans', and every bot squad with someone up (in solo everyone is their own); a guest has the host's count */
  private get squadsAlive(): number {
    if (this.role !== "host") return this.squadsSeen;
    // the humans' sides with someone up: each their own in solo, each squad when split, else one
    const up = new Set<number>();
    if (this.alive && !this.downed) up.add(this.sideOf(this.id));
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive && !r.downed) up.add(this.sideOf(r.id));
    const mine = up.size;
    return this.botSquadsAlive + mine;
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
   * Your loadout crate is yours: your saved loadout's two guns, kitted, and
   * ammo for them. The match cannot put a gun in your hands itself (main.ts
   * owns the kit), so it hands them over here. With nothing listening and
   * nobody else in the match, the crate spills them at your feet instead and
   * the ordinary loot prompt does the rest.
   */
  onLoadoutDrop: ((items: LootItem[], def: LoadoutDef) => void) | null = null;

  /** take an item: the host's own at once, a guest's asked of the host (first come, first served) */
  takeLoot(key: number): void {
    const f = this.lootField;
    if (!f) return;
    if (this.role === "host") {
      const pos = f.drops.get(key)?.pos.clone();
      const it = f.remove(key);
      if (!it) return;
      if (it.kind === "keycard") this.keyHolder = this.id;
      this.onLootTaken?.(it);
      this.broadcast({ t: "loot", op: "gone", key, by: this.id });
      if (pos && isBin(it) && it.id === "closed") this.spillBin(pos, key);
    } else if (f.drops.has(key)) this.hostLink?.send({ t: "loot", op: "take", key });
  }

  /**
   * The host: a supply bin was opened (taken first by whoever held E at it).
   * An open one stands in its place for the rest of the match, and what was
   * in it is thrown out round it, from the seed and the bin's own key.
   */
  private spillBin(at: THREE.Vector3, key: number): void {
    this.dropLoot({ kind: "bin", id: "open", n: 1, rarity: "rare" }, at);
    this.onBinOpened?.(at);
    const items = binContents(this.seed, key);
    items.forEach((it, i) => {
      const a = (i / Math.max(1, items.length)) * Math.PI * 2 + 0.4;
      this.dropLoot(it, at.clone().add(new THREE.Vector3(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1)));
    });
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
    const id = ++this.podSeq;
    this.pods.push({ id, kind, at: at.clone(), landsAt: wallClock() + lands, fallFor, hotUntil: Infinity, obj, canopy, beam, trail, nextPuff: 0, dust: null, landed: false, claimed: new Set() });
    const where = this.placeNear(at);
    this.onNotice?.(crate ? `LOADOUT CRATE INBOUND  ·  ${where}` : `CARE PACKAGE INBOUND  ·  ${where}`);
    // the compass and the world get it through the ping path the squad
    // already has, under the pod's own id so it sits beside your pings
    this.onMark?.("go", POD_MARK - id, at.clone(), crate ? "LOADOUT CRATE" : "CARE PACKAGE", -1);
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
          // One still coming down when the match ends lands in silence and
          // empty: the card is up, and a notice or a gold gun on the floor
          // behind it is a match that has not stopped.
          if (!this.brOver) {
            this.onRemoteFx?.("pod", this.id, p.at.clone(), undefined, 1);
            this.onNotice?.(`${p.kind === "loadout" ? "LOADOUT CRATE" : "CARE PACKAGE"} DOWN  ·  ${this.placeNear(p.at)}`);
            if (p.kind === "supply" && this.role === "host") this.podItems().forEach((it, i) => this.dropLoot(it, p.at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.3, 0, Math.sin(i * 2.1) * 1.3))));
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

  /**
   * The loadout crate (item 24): called into the ring a little way into the
   * close of each of br.json's phases, once per phase, on every browser.
   *
   * Nothing about it goes over the wire. The host and the guests share the
   * match seed and see the same circle in the ring packet, so all of them
   * work the same spot out, and the claim below is each player's own anyway.
   * Only a match that landed with nothing gets one, as with care packages: a
   * squad that landed with its loadouts has nothing for it to hand over.
   */
  private maybeCrate(): void {
    if (this.phase !== "fight" || !this.lootField) return;
    const v = this.view;
    const L = brCfg.loadoutPod;
    if (v.state !== "closing" || this.cratePhases.has(v.phase) || !L.phases.includes(v.phase)) return;
    // br.json's `after`: the same close calls a care package, and a call on
    // the same frame as the package's was a notice nobody saw
    if (RING_PHASES[v.phase].close - v.timeLeft < L.after) return;
    this.cratePhases.add(v.phase);
    const spot = loadoutPodAt(this.seed, v.phase, v.next);
    // out of any wall or rock it would have come down in (the same on every browser)
    const clear = clearGround(spot.x, spot.z);
    this.addPod(new THREE.Vector3(clear.x, 0, clear.z), brCfg.pod.announce + LOOT.podFall, "loadout");
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
        if (Math.hypot(local.x - p.at.x, local.z - p.at.z) <= claim.reach && Math.abs(local.y - p.at.y) < claim.height) {
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
    const items = loadoutItems(def);
    this.onNotice?.(`${def.name.toUpperCase()}  ·  ${weaponName(def.slot1).toUpperCase()} + ${weaponName(def.slot2).toUpperCase()}`);
    if (this.onLoadoutDrop) this.onLoadoutDrop(items, def);
    else if (!this.links.size && !this.hostLink) {
      // alone, with nothing listening: the crate pops them out at your feet
      const at = on.at;
      items.forEach((g, i) => this.dropLoot(g, at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.1, 0, Math.sin(i * 2.1) * 1.1))));
    }
  }

  /** the map's towers, beacons and pads (brplay.ts) */
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
    this.hostLink?.send({ t: "door", i, open });
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
      this.hostLink?.send({ t: "door", i, open: false, k: 1 });
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
  private hostDoor(i: number, open: boolean, by = this.id): boolean {
    const doors = this.map.doors;
    if (open && doors.isLocked(i)) {
      if (by !== this.keyHolder) return false;
      // the keycard opens the vault, and is used up doing it
      doors.unlock(i);
      this.keyHolder = null;
      this.vaultOpened();
      this.vaultNews(2);
    }
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

  get mapInfo(): { towers: Array<{ x: number; z: number; y: number }>; beacons: Array<{ x: number; z: number }>; pads: Array<{ x: number; z: number; dx: number; dz: number }> } {
    return this.map;
  }

  /** a downed squad mate within reach, to revive */
  downedMateNear(p: THREE.Vector3, reach: number): { id: number; name: string } | null {
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !this.friendly(r.id) || !r.alive || !r.downed) continue;
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

  /** a name for the feed: whoever `by` is (a human, a bot, or -1 for the ring) */
  private whoDid(by: number): string {
    return by === -1 ? "THE RING" : by === this.id ? this.myName || "YOU" : (this.remotes.get(by)?.name ?? this.bots.find((x) => x.bot.remote.id === by)?.bot.remote.name ?? "SOMEONE");
  }

  /** a squad's bot can be knocked (not killed) while one of its squad still stands; in solo, and against friends in solo, a knock is the end */
  private canKnockBot(b: BrBot): boolean {
    return !this.noKnocks && this.team.size > 1 && this.bots.some((o) => o !== b && o.team === b.team && o.bot.alive && !o.down && !o.bot.aboard);
  }

  /**
   * A bot of a duo or a trio knocked with a mate still up: on the floor, as
   * a player would be. It bleeds out on the players' clock, crawls toward its
   * squad, can be finished off, and a mate out of a fight walks over and
   * picks it up. Before this every bot's knock was its death, so a bot squad
   * was three solos walking together.
   */
  private knockBot(b: BrBot, by: number): void {
    const bot = b.bot;
    const r = bot.remote;
    b.down = { by, bleed: squadCfg.bleedOut[0] * this.team.bleed };
    bot.goDown(wallClock(), squadCfg.bleedHealth, bot.diff.speed * SQUADS.crouchWalk * squadCfg.crawl);
    r.health = bot.dummy.health;
    r.shield = 0;
    r.downed = true;
    this.onFeed?.(`${this.whoDid(by)} knocked ${r.name}`, by === this.id, by !== this.id);
    // the bots after it turn to whoever is still up
    for (const o of this.bots) o.bot.forget(r.id);
    this.broadcast({ t: "dnd", from: r.id, by });
    this.onKnockSeen?.(r.id, by);
    if (by === this.id) this.onNotice?.(`${r.name} KNOCKED`);
    this.cutBotWaits(by, "knock");
  }

  /** a downed bot picked up by `by`, one of its squad */
  private reviveBot(o: BrBot, by: BrBot): void {
    o.down = null;
    o.bot.standUp(squadCfg.reviveHealth);
    o.bot.remote.health = o.bot.dummy.health;
    o.bot.remote.shield = 0;
    o.bot.remote.downed = false;
    this.onFeed?.(`${by.bot.remote.name} revived ${o.bot.remote.name}`, false, false);
    this.broadcast({ t: "rev", op: "done", to: o.bot.remote.id, from: by.bot.remote.id });
  }

  /**
   * The host, each frame: a downed bot's bleed-out runs, and a standing bot
   * with nothing in sight goes to a downed mate within reach of its squad
   * and kneels over it for the revive's 5 s. A target breaks the revive off
   * and it starts over. The ring pushing it on keeps it from walking back for
   * one, but not from picking up one it is already beside.
   */
  private botCare(b: BrBot, sense: BotSense, dt: number): void {
    const bot = b.bot;
    bot.kneel = false;
    if (b.down) {
      b.down.bleed -= dt;
      if (b.down.bleed <= 0) this.finishDowned(b);
      return;
    }
    if (!bot.alive || bot.dropping || this.team.size < 2 || sense.target) {
      b.reviving = 0;
      return;
    }
    let mate: BrBot | null = null;
    let best: number = SQUADS.reviveRange;
    for (const o of this.bots) {
      if (o === b || o.team !== b.team || !o.down) continue;
      const d = o.bot.pos.distanceTo(bot.pos);
      if (d < best) {
        best = d;
        mate = o;
      }
    }
    if (!mate) {
      b.reviving = 0;
      return;
    }
    if (best > squadCfg.reviveReach * 0.8) {
      if (sense.urgent) {
        b.reviving = 0;
        return;
      }
      sense.goal = mate.bot.pos.clone();
      b.reviving = 0;
      return;
    }
    sense.goal = null;
    bot.kneel = true;
    b.reviving += dt;
    if (b.reviving >= squadCfg.reviveTime) {
      b.reviving = 0;
      bot.kneel = false;
      this.reviveBot(mate, b);
    }
  }

  /**
   * The traversal, taken as a player passing by would take it. A bot that
   * steps onto a launch pad is thrown by it; a bot out of a fight standing at
   * a zipline's end, when the rope's far end is nearer where it is going (by
   * rideGain metres), rides it. Before this every rope and pad was scenery
   * to the bots, and a bot wanting the other side of the map walked it.
   */
  private botTraversal(b: BrBot, sense: BotSense, planned?: { x: number; z: number } | null): void {
    // the vault's guard keeps its post
    if (b.guard) return;
    const bot = b.bot;
    if (bot.travel) return;
    // A squad goes as one: its first bot takes a pad or a rope where it will,
    // and the others only toward it (a follower thrown down the road away from
    // its squad split it, and the squads' test caught it).
    const lead = this.team.size > 1 ? this.bots.filter((o) => o.team === b.team && o.bot.alive && !o.down && !o.bot.dropping).reduce<BrBot | null>((a, o) => (!a || o.slot < a.slot ? o : a), null) : null;
    const follower = !!lead && lead !== b;
    const P = squadCfg.pad;
    for (const p of this.map.pads) {
      if (Math.hypot(bot.pos.x - p.x, bot.pos.z - p.z) > P.reach || bot.pos.y > 0.6) continue;
      // a follower: only where the pad throws it toward its lead
      if (follower && lead && (lead.bot.pos.x - bot.pos.x) * p.dx + (lead.bot.pos.z - bot.pos.z) * p.dz < SQUADS.follow) continue;
      bot.fling(new THREE.Vector3(p.dx * P.speed, P.up, p.dz * P.speed));
      return;
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
    if (!sense.target && sense.goal && !bot.travel && !bot.dropping && bot.pos.y < 1.2) {
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
    if (lead === b && this.bots.some((o) => o !== b && o.team === b.team && o.bot.alive && !o.down && !o.bot.dropping && o.bot.pos.distanceTo(bot.pos) > SQUADS.follow)) return;
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

  /** a downed bot's end without a last shot (bled out, or its squad gone): on its knocker */
  private finishDowned(b: BrBot): void {
    const by = b.down?.by ?? -1;
    b.bot.dummy.fallDown();
    this.botDown(b, by);
  }

  /** a bot went down, knocked by `by` (a human id, a bot id, or -1 for the ring) */
  private botDown(b: BrBot, by: number): void {
    // (SpeedKills has no knockdowns: canKnockBot says no, and a bot at zero health is out)
    const r = b.bot.remote;
    if (!r.alive) return;
    if (!b.down && this.canKnockBot(b)) {
      this.knockBot(b, by);
      return;
    }
    b.down = null;
    b.reviving = 0;
    b.bot.downedAt = null;
    b.bot.kneel = false;
    r.downed = false;
    r.alive = false;
    const mine = by === this.id;
    if (mine) this.kills++;
    // its death box: what it had looted (loot.ts deathBoxOf), or its gun and the basics
    if (this.lootField && this.role === "host") {
      const armed = this.botArmed(b, wallClock());
      const kit = b.bot.lootKit;
      const items = deathBoxOf(kit.gunId ? kit : null, armed ? r.avatarWeapon : null);
      if (b.guard) items.push({ kind: "keycard", id: "vault", n: 1, rarity: "legendary" });
      this.dropBox(items, b.bot.pos.clone());
      if (b.guard) this.vaultNews(0);
    }
    const who = this.whoDid(by);
    // the end of it: the feed says eliminated
    this.onFeed?.(`${who} eliminated ${r.name}`, mine, !mine);
    for (const o of this.bots) o.bot.forget(r.id);
    this.broadcast({ t: "down", from: r.id, by });
    this.onKnockSeen?.(r.id, by);
    // nobody of its squad left standing: its downed are finished with it, as a squad of players is
    if (this.team.size > 1 && !this.bots.some((o) => o.team === b.team && o.bot.alive && !o.down)) for (const o of this.bots) if (o.team === b.team && o.down) this.finishDowned(o);
    const left = this.aliveCount;
    // the last of a bot squad: the squad is wiped (duos and trios; in solo every death is one)
    const wiped = this.team.size > 1 && !this.bots.some((o) => o.team === b.team && o.bot.alive);
    if (wiped) {
      this.onNotice?.(`SQUAD WIPED  ·  ${this.squadsAlive} SQUADS LEFT`);
      this.onWiped?.();
    }
    else this.onNotice?.(mine ? `${r.name} DOWN  ·  ${left} LEFT` : `${left} LEFT`);
    if (this.rules === "resurgence") {
      // it comes back if its squad has someone up (a bot on its own always does, while the rules are on)
      const up = this.bots.filter((o) => o.team === b.team && o.bot.alive).length;
      if (!b.guard && comesBack(this.ringPhase, this.team.size, up)) b.redeploy = new Redeploy(r.id, redeployWait(this.ringPhase));
      // the killer's squad: a kill cuts the wait of its own dead
      this.cutBotWaits(by, "kill");
    }
    if (this.manySides) this.judgeSides();
    else if (this.bots.every((x) => x.guard || (!x.bot.alive && !x.redeploy)) && this.humansAlive > 0) this.endBr(true);
  }

  /** Resurgence: a knock or a kill by a bot cuts the wait of its squad's dead */
  private cutBotWaits(by: number, kind: "knock" | "kill"): void {
    if (this.rules !== "resurgence" || by < Duel.BOT_ID) return;
    const killer = this.bots.find((x) => x.bot.remote.id === by);
    if (!killer) return;
    for (const o of this.bots) if (o.team === killer.team && o.redeploy) o.redeploy.cut(kind);
  }

  /**
   * Resurgence, the host: a bot whose wait is over comes back from the sky
   * near a squad mate who is up (on its own, somewhere in the ring), unless
   * its whole squad went down meanwhile, which puts the squad out.
   */
  private redeployBots(dt: number): void {
    if (this.rules !== "resurgence") return;
    for (const b of this.bots) {
      if (!b.redeploy || b.bot.alive) continue;
      if (!b.redeploy.tick(dt)) continue;
      b.redeploy = null;
      // a mate still coming down from its own redeploy is up: it is alive and on its way
      const mates = this.bots.filter((o) => o !== b && o.team === b.team && o.bot.alive && !o.down);
      if (this.team.size > 1 && mates.length === 0) continue;
      const near = mates.length ? mates[Math.floor(Math.random() * mates.length)].bot.pos : null;
      const at = this.redeploySpot(near);
      b.bot.redeployAt(at.x, at.z, DROP_HEIGHT * (0.8 + Math.random() * 0.4));
      if (this.startLoot) b.bot.dummy.setGunVisible(false);
      b.landed = false;
      b.armedAt = Infinity;
      b.armedShown = false;
      b.landedAt = undefined;
      b.node = this.nearestNode(at.x, at.z);
      b.goal = b.node;
      b.bot.remote.shieldMax = b.bot.dummy.shieldMax;
      this.onFeed?.(`${b.bot.remote.name} redeployed`, false, true);
    }
    // nobody left to fight and nobody coming back: the squad has won
    if (this.manySides) this.judgeSides();
    else if (this.phase === "fight" && this.humansAlive > 0 && this.bots.every((x) => x.guard || (!x.bot.alive && !x.redeploy))) this.endBr(true);
  }

  /** where a redeploy comes down: 8 m or more from a squad mate who is up, else anywhere well inside the ring, on open ground */
  private redeploySpot(near: THREE.Vector3 | null): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    let x: number;
    let z: number;
    if (near) {
      const r = 8 + Math.random() * Math.max(0, RESURGENCE.spread - 8);
      x = near.x + Math.cos(a) * r;
      z = near.z + Math.sin(a) * r;
    } else {
      const c = this.view.current;
      const r = Math.sqrt(Math.random()) * c.r * 0.6;
      x = c.cx + Math.cos(a) * r;
      z = c.cz + Math.sin(a) * r;
    }
    x = Math.max(BR_CENTER.x - BR_HALF + 5, Math.min(BR_CENTER.x + BR_HALF - 5, x));
    z = Math.max(BR_CENTER.z - BR_HALF + 5, Math.min(BR_CENTER.z + BR_HALF - 5, z));
    return openGround(x, z);
  }

  /** your side, besides you, still up: squad mates alive and not down */
  private get matesUp(): number {
    let n = 0;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && this.friendly(r.id) && r.alive && !r.downed) n++;
    return n;
  }

  /**
   * Out (a solo knock, a finish, a bleed-out): under Resurgence the wait
   * starts here, before the squad's end is judged, so a side of one that is
   * coming back is not out.
   */
  protected override eliminate(from: number, how: "knocked" | "finished" | "bled out"): void {
    if (!this.alive) return;
    // a death in the Gulag is the end of the trip: out for good
    const inGulag = this.gulag !== null && this.gulag.phase !== "wait";
    if (inGulag) this.gulag!.lost(wallClock());
    else if (this.rules === "resurgence" && comesBack(this.ringPhase, this.players, this.matesUp)) this.selfRedeploy = new Redeploy(this.id, redeployWait(this.ringPhase));
    // a first death, early, goes to the Gulag; decided before the squad is judged, so it is not out meanwhile
    else if (this.gulagOn && this.phase === "fight" && gulagFor(this.rules, this.ringPhase, this.gulagUsed)) {
      this.gulag = new Gulag(wallClock());
      this.gulagUsed = true;
      this.noteGulag(this.id, 1);
    }
    super.eliminate(from, how);
    if (inGulag) this.leaveGulag(false);
  }

  /**
   * A squad mate brought you back (a beacon, your death box) while you were on
   * your way to the Gulag or in it: that is your way back, and the trip is over.
   */
  protected override respawnHere(at: THREE.Vector3, box = false): void {
    if (this.gulag) {
      this.gulag = null;
      this.gulagBot?.dispose();
      this.gulagBot = null;
      this.showFlag(false);
      this.noteGulag(this.id, 2);
      this.alive = false;
    }
    super.respawnHere(at, box);
  }

  /** the side is out: nobody of it up, nobody of it in the Gulag, and a side of one not on its way back */
  private get sideOut(): boolean {
    return this.humansAlive === 0 && this.gulagIds.size === 0 && !(this.players === 1 && this.selfRedeploy);
  }

  /** someone of the side went to the Gulag (1), came back from it (2) or lost it (0): the host keeps count, and yours is told to everyone */
  private noteGulag(id: number, n: number): void {
    if (n === 1) this.gulagIds.add(id);
    else this.gulagIds.delete(id);
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
    const onFlag = (x: number, y: number, z: number) => Math.hypot(x - room.center.x, z - room.center.z) <= GULAG.flagRadius && y < 1.5;
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
      // in overtime it goes for the flag
      const goal = g.phase === "overtime" ? new THREE.Vector3(room.center.x, 0, room.center.z) : null;
      const shots = bot.update(now, dt, { target: sees ? feet : null, targetId: this.id, goal, canShoot: g.live });
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
    this.downed = false;
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
      if (r.id >= Duel.BOT_ID || !this.friendly(r.id) || !r.alive || r.downed || this.gulagIds.has(r.id)) continue;
      const s = r.samples[r.samples.length - 1];
      if (s) mates.push(new THREE.Vector3(s.x, 0, s.z));
    }
    const at = this.redeploySpot(mates.length ? mates[Math.floor(Math.random() * mates.length)] : null);
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
    g.position.set(room.center.x, 0, room.center.z);
    this.scene.add(g);
    this.gulagFlag = g;
  }

  /** your side knocked or finished someone (main hears every down): the wait of yours is cut. The seconds cut */

  /** your side knocked or finished someone (main hears every down): the wait of yours is cut. The seconds cut */
  sideKill(victim: number, by: number): number {
    if (this.rules !== "resurgence" || !this.selfRedeploy || this.alive) return 0;
    if (by < 0 || by >= Duel.BOT_ID || victim < Duel.BOT_ID) return 0;
    return this.selfRedeploy.cut("kill");
  }

  /** the kit a redeploy hands over, once (main) */
  takeRedeployKit(): boolean {
    const k = this.redeployKit;
    this.redeployKit = false;
    return k;
  }

  /** this player is on the way back into the match: main says so rather than "dropping into" */
  get redeploying(): boolean {
    return this.redeployKit;
  }

  /** Resurgence, every browser: your wait, your way back, and the cut to final deaths said once */
  private resurgenceFrame(dt: number): void {
    if (this.rules !== "resurgence") return;
    if (!this.finalSaid && this.phase === "fight" && !resurgenceLive(this.ringPhase)) {
      this.finalSaid = true;
      this.onNotice?.("RESURGENCE IS OVER: EVERY DEATH IS FINAL NOW");
    }
    // brought back some other way (a squad mate at a beacon or the box): the wait is over
    if (this.alive) {
      this.selfRedeploy = null;
      return;
    }
    const w = this.selfRedeploy;
    if (!w || this.brOver || !w.tick(dt)) return;
    this.selfRedeploy = null;
    // nobody of yours is up any more: the squad is out, and the host has said so
    if (this.players > 1 && this.matesUp === 0) return;
    const mates: THREE.Vector3[] = [];
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !this.friendly(r.id) || !r.alive || r.downed) continue;
      const s = r.samples[r.samples.length - 1];
      if (s) mates.push(new THREE.Vector3(s.x, 0, s.z));
    }
    const at = this.redeploySpot(mates.length ? mates[Math.floor(Math.random() * mates.length)] : null);
    this.redeployKit = true;
    this.respawnHere(new THREE.Vector3(at.x, 0, at.z));
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
   * kit and what it still carries, whether it is up, down (who knocked it,
   * the bleed-out left) or waiting to redeploy; the damage the surge ranks
   * on and its clock; the care packages called; the placings; and the loot
   * field's next key. The ring is not in it: every browser draws its plan
   * from the seed, and a guest's view says where along it the ring is.
   */
  protected override snapshotMode(now: number): BrSnap {
    const t = (v: number): number | null => (Number.isFinite(v) ? v - now : null);
    return {
      b: this.bots.map((b) => ({
        i: b.bot.index,
        t: Math.max(0, BOT_TIERS.indexOf(b.bot.diff.name as BotTier)),
        tm: b.team,
        sl: b.slot,
        n: b.node,
        g: b.goal,
        ar: t(b.armedAt),
        as: !!b.armedShown,
        al: b.bot.alive,
        k: { ...b.bot.lootKit, mods: { ...b.bot.lootKit.mods } },
        c: b.bot.carried,
        rd: b.redeploy ? b.redeploy.left : -1,
        dn: b.down ? [b.down.by, b.down.bleed] : null,
        rv: b.reviving,
        dt: [b.dropTo.x, b.dropTo.z],
        gd: b.guard ? [b.guard.x, b.guard.z] : null,
      })),
      kh: this.keyHolder ?? -1,
      vs: this.vaultStocked,
      dl: [...this.dealt].map(([id, d]) => [id, d.total, Number.isFinite(d.at) ? d.at - now : -1e6]),
      sa: t(this.surgeAt),
      ss: t(this.surgeSince),
      pc: this.podCount,
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
   * and whatever it was in the middle of: down and bleeding, or waiting to
   * redeploy. Then the surge's record, the packages, the placings and the
   * loot keys as the host had them.
   */
  protected override restoreAsHost(now: number, _oldHost: number, mode: unknown): void {
    const ring = new Ring(this.area, seeded((this.seed ^ RING_SALT) >>> 0), RING_ATTRACTORS, this.phases);
    ring.restore(this.view, this.area);
    this.ring = ring;
    const s = readBrSnap(mode);
    if (!s) return;
    const rt = (v: number | null): number => (v === null ? Infinity : now + v);
    for (const row of s.b) {
      const id = Duel.BOT_ID + row.i;
      if (this.bots.some((b) => b.bot.index === row.i)) continue;
      const r = this.remotes.get(id);
      const last = r?.samples[r.samples.length - 1];
      const spawn: Spawn = last ? { x: last.x, z: last.z, yaw: last.yaw } : { x: row.dt[0], z: row.dt[1], yaw: 0 };
      const bot = this.makeBot(row.i, BOT_TIERS[row.t] ?? "normal", spawn, Math.random, row.gd ? VAULT.guardName : undefined);
      if (last) bot.pos.y = last.y;
      bot.restoreKit(row.k, row.c);
      if (!this.startLoot || row.as) bot.dummy.setGunVisible(true);
      const b: BrBot = { bot, node: row.n, goal: row.g, armedAt: rt(row.ar), armedShown: row.as, landed: true, team: row.tm, slot: row.sl, dropTo: { x: row.dt[0], z: row.dt[1] }, jumpAt: Infinity, redeploy: row.rd >= 0 ? new Redeploy(id, row.rd) : null, down: null, reviving: row.rv, guard: row.gd ? { x: row.gd[0], z: row.gd[1] } : undefined };
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
      } else if (row.dn) {
        bot.goDown(now, r?.health ?? squadCfg.bleedHealth, bot.diff.speed * SQUADS.crouchWalk * squadCfg.crawl);
        b.down = { by: row.dn[0], bleed: row.dn[1] };
      }
      this.bots.push(b);
      this.dropFigure(id);
    }
    this.dealt.clear();
    for (const [id, total, ago] of s.dl) this.dealt.set(id, { total, at: now + ago });
    this.surgeAt = rt(s.sa);
    this.surgeSince = rt(s.ss);
    this.podCount = Math.max(this.podCount, s.pc);
    this.podSeq = Math.max(this.podSeq, s.ps);
    for (const ph of s.pp) this.podPhases.add(ph);
    for (const [side, place] of s.pl) this.placedAt.set(side, place);
    if (this.lootField) this.lootField.keyNext = s.nk;
    this.keyHolder = s.kh >= 0 ? s.kh : null;
    this.vaultStocked = s.vs;
    this.botSendNext = 0;
    this.ringSendNext = 0;
  }

  // ------------------------------------------------------------ the vault

  /** the vault is in this match (on, and inside Resurgence's area when that is the rules) */
  get vaultOn(): boolean {
    const v = this.map.vault;
    return VAULT.on && this.vaultAllowed && v.door >= 0 && Math.hypot(v.x - this.area.cx, v.z - this.area.cz) <= this.area.r * 0.9;
  }

  /** the vault for the tests and the HUD: its door, where it is, whether it is still locked */
  get vault(): { door: number; x: number; z: number; locked: boolean } | null {
    if (!this.vaultOn) return null;
    const v = this.map.vault;
    return { door: v.door, x: v.x, z: v.z, locked: this.map.doors.isLocked(v.door) };
  }

  /** the vault in this match at all (the tests turn it off where they count the bots) */
  private vaultAllowed = true;
  /** the host: who holds the vault keycard (a player's id), or null */
  private keyHolder: number | null = null;
  /** this player holds the vault keycard (the page sets it when it takes one) */
  myKey = false;
  private vaultStocked = false;
  private vaultMarkAt = 0;

  /** the host: the vault's guard, at its post with its gun, its armour and a few heals */
  private makeGuard(i: number): void {
    const v = this.map.vault;
    const spawn: Spawn = { x: v.post.x, z: v.post.z, yaw: 180 };
    const bot = this.makeBot(i, VAULT.guardTier as BotTier, spawn, Math.random, VAULT.guardName);
    bot.restoreKit({ gunId: VAULT.guardGun, gun: 3, mag: 3, mods: {}, armor: 3, cells: 2, syringes: 2, frags: 1, taken: 0 }, { cell: 2, syringe: 2, frags: 1 });
    bot.dummy.setGunVisible(true);
    const node = this.nearestNode(spawn.x, spawn.z);
    this.bots.push({ bot, node, goal: node, armedAt: 0, armedShown: true, landed: true, team: -1, slot: 0, dropTo: { x: spawn.x, z: spawn.z }, jumpAt: Infinity, redeploy: null, down: null, reviving: 0, guard: { x: spawn.x, z: spawn.z } });
  }

  /** the guard: whoever comes within its range and in its sight, else back to its post */
  private guardSense(b: BrBot, humans: Array<{ id: number; feet: THREE.Vector3; cue: SightCue; down: boolean }>): BotSense {
    const bot = b.bot;
    const post = new THREE.Vector3(b.guard!.x, bot.pos.y, b.guard!.z);
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    let best = VAULT.guardRange;
    if (this.phase === "fight") {
      for (const h of humans) {
        const d = h.feet.distanceTo(post);
        if (!h.down && d < best && bot.sees(h.feet, h.cue)) {
          best = d;
          target = h.feet;
          targetId = h.id;
        }
      }
      for (const o of this.bots) {
        if (o === b || !o.bot.alive || o.down || o.bot.dropping) continue;
        const d = o.bot.pos.distanceTo(post);
        if (d < best && bot.sees(o.bot.pos)) {
          best = d;
          target = o.bot.pos;
          targetId = o.bot.remote.id;
        }
      }
    }
    return { target, targetId, goal: post, canShoot: this.phase === "fight" && !this.holdFire, urgent: true };
  }

  /** the vault's news on every screen: here, and to the others as an effect they turn back into the words (0 the guard is down, 1 the keycard is on the floor, 2 the vault is open) */
  private vaultNews(code: 0 | 1 | 2, opener = ""): void {
    this.onNotice?.(vaultSays(code, opener));
    this.broadcast({ t: "fx", k: "vault", n: code });
  }

  /** a guest: the host's vault news (the mode's own effect, not drawn) */
  protected override onFx(k: string, _from: number, n: number | undefined): boolean {
    if (k !== "vault") return false;
    if (this.role !== "host" && (n === 0 || n === 1 || n === 2)) this.onNotice?.(vaultSays(n));
    return true;
  }

  /** the vault door unlocked (here, or the host said): the card that did it is spent */
  private vaultOpened(): void {
    if (this.myKey) this.onNotice?.("THE KEYCARD OPENED THE VAULT");
    this.myKey = false;
  }

  /**
   * Every frame. The host stocks the vault as the fight starts (two supply
   * bins and a mythic gun on its floor) and drops a keycard where its holder
   * fell; the holder's page keeps the way to the vault marked.
   */
  private stepVault(now: number, local: LocalState): void {
    if (!this.vaultOn) return;
    const v = this.map.vault;
    if (this.role === "host" && !this.vaultStocked && this.phase === "fight" && this.lootField) {
      this.vaultStocked = true;
      const gun = LOOT.carePackage[Math.floor(Math.random() * LOOT.carePackage.length)];
      const hop = lockedHopupFor(gun);
      const attach = { ...kittedAttach(gun), ...(hop ? { hopup: hop } : {}) };
      this.dropLoot({ kind: "weapon", id: gun, n: 1, rarity: "legendary", mag: 4, attach, mythic: true }, new THREE.Vector3(v.x, v.y, v.z + 1.2));
      for (const dx of [-2.6, 2.6]) this.dropLoot({ kind: "bin", id: "closed", n: 1, rarity: "common" }, new THREE.Vector3(v.x + dx, v.y, v.z + 1.6));
    }
    // a holder who is gone drops the keycard where they fell (the host's own, a guest's last state)
    if (this.role === "host" && this.keyHolder !== null) {
      const id = this.keyHolder;
      const gone = id === this.id ? !this.alive : !this.remotes.get(id)?.alive;
      if (gone) {
        const at = id === this.id ? new THREE.Vector3(local.x, local.y, local.z) : this.whereIs(id);
        this.keyHolder = null;
        if (at) {
          this.dropLoot({ kind: "keycard", id: "vault", n: 1, rarity: "legendary" }, at);
          this.vaultNews(1);
        }
      }
    }
    if (this.myKey && !this.alive) this.myKey = false;
    if (this.myKey && now >= this.vaultMarkAt) {
      this.vaultMarkAt = now + VAULT.markEvery;
      this.onMark?.("go", VAULT_MARK, new THREE.Vector3(v.x, v.y, v.z), "THE VAULT", -1);
    }
  }

  /** the bots as the host runs them: index, tier and squad (the tests) */
  get botRoster(): string[] {
    return this.bots.map((b) => `${b.bot.index}:${b.bot.diff.name}:${b.team}`).sort();
  }

  // ------------------------------------------------------------ Storm Surge

  /** who has dealt how much damage, and when they last dealt any: the surge ranks on it */
  private dealt = new Map<number, { total: number; at: number }>();
  /** the host: when the first surge tick lands, and when the surge went live (Infinity for neither) */
  private surgeAt = Infinity;
  private surgeSince = Infinity;
  /** the surge as this side sees it (the host's own, a guest's from the ring packet), null when there is none */
  private surge: SurgeView | null = null;
  /** this player is below the line */
  private surgeMine = false;
  /** the host: the humans below the line, for the ring packet */
  private surgeHumans: number[] = [];

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
      this.surgeAt = Infinity;
      this.surgeSince = Infinity;
      this.surgeHumans = [];
      this.setSurge(null, false);
      return;
    }
    if (this.surgeAt === Infinity) this.surgeAt = now + brCfg.surge.warn;
    const victims = new Set(surgeVictims(this.surgeRows(), allowed, now));
    const live = now >= this.surgeAt;
    if (live && this.surgeSince === Infinity) this.surgeSince = now;
    const amount = surgeDamage(live ? now - this.surgeSince : 0);
    this.surgeHumans = [...victims].filter((id) => id < Duel.BOT_ID);
    this.setSurge({ live, startsIn: Math.max(0, this.surgeAt - now), damage: amount, below: victims.size }, victims.has(this.id));
    if (!live || !tick || !victims.size) return;
    // the surge is the ring's kind of damage: it comes from nobody (-1)
    if (victims.has(this.id) && this.alive && !this.gulag) this.hurt(amount, -1);
    // A guest below the line takes its own tick off the ring packet (onExtra
    // and update below): a hit message from here would carry a sender, and a
    // sender that is not a squad mate builds a figure on the guest's screen.
    for (const b of this.bots) {
      if (!victims.has(b.bot.remote.id) || !b.bot.alive || b.bot.dropping) continue;
      b.bot.dummy.hit(now, "body", amount, 1, 1, b.bot.pos);
      b.bot.remote.health = b.bot.dummy.health;
      b.bot.remote.shield = b.bot.dummy.shield;
      if (b.bot.dummy.knocked) this.botDown(b, -1);
    }
  }

  /** the surge as this side now sees it, whether this player is below the line, and the notice the change is worth */
  private setSurge(next: SurgeView | null, mine: boolean): void {
    const say = surgeNotice(this.surge, next);
    if (say) this.onNotice?.(say);
    this.surge = next;
    this.surgeMine = !!next && mine;
  }

  // ------------------------------------------------------------ the squad

  /** solo: there is nobody to pick you up, so a knock is an elimination */
  protected override squadUp(): boolean {
    if (this.gulag) return false;
    return this.team.size > 1 && super.squadUp();
  }

  /** a supply bin opened at `at` (its lid and its sound), on every browser */
  onBinOpened: ((at: THREE.Vector3) => void) | null = null;
  /** a squad of bots wiped out, the last of it by anyone (announcer.ts) */
  onWiped: (() => void) | null = null;

  /** where the match is played: the whole map, or Resurgence's quarter of it */
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
      if (id === this.id) return this.alive && !this.downed;
      const r = this.remotes.get(id);
      return !!r && r.alive && !r.downed;
    };
    const sides = [...new Set(humans.map((id) => this.sideOf(id)))];
    const standing = sides.filter((s) => humans.some((id) => this.sideOf(id) === s && up(id)));
    const botSides = this.botSquadsAlive + new Set(this.bots.filter((b) => !b.bot.alive && b.redeploy).map((b) => b.team)).size;
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

  /** squads of friends: a player down with nobody of their squad left up is out with it */
  protected override wipesWithSquad(): boolean {
    return this.manySides;
  }

  /** a squad mate gone (left, or silent): with nobody of the squad still up, it is over */
  protected override playerGone(id: number, notice: string): void {
    super.playerGone(id, notice);
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

  /** a human went down (any side, this player included): the host decides whether the squad is out */
  protected override onSomeoneDown(_id: number, _by: number): void {
    for (const o of this.bots) o.bot.forget(_id);
    // A duo has less time on the floor than a trio: only one person can ever
    // be coming. Duel owns the bleed-out clock and has already started it by
    // the time this runs, so the size cuts what it set rather than running a
    // second clock beside it.
    if (_id === this.id && this.downed && this.team.bleed > 0 && this.team.bleed < 1) {
      const now = wallClock();
      this.bleedUntil = now + (this.bleedUntil - now) * this.team.bleed;
    }
    // a bot's knock of one of yours cuts its squad's waits (Resurgence)
    if (_by >= Duel.BOT_ID) this.cutBotWaits(_by, (_id === this.id ? this.downed : !!this.remotes.get(_id)?.downed) ? "knock" : "kill");
    if (this.manySides) this.judgeSides();
    else if (this.role === "host" && this.sideOut) this.endBr(false);
  }

  /** the remote's name for the feed, bots included on the host */
  protected nameOf(id: number): string | undefined {
    if (this.gulagBot && id === this.gulagBot.remote.id) return this.gulagBot.remote.name;
    return this.remotes.get(id)?.name ?? this.bots.find((b) => b.bot.remote.id === id)?.bot.remote.name;
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
        if (!near || !this.hostDoor(d.i, m.open, from)) this.links.get(from)?.send({ t: "door", i: d.i, open: d.open, b: d.broken ? 1 : undefined });
      } else {
        this.doorAsked.delete(d.i);
        if (m.b === 1) doors.breakDoor(d.i);
        else if (m.k === 1) doors.kickHeard(d.i);
        else {
          // the host opened a locked one (the vault): it was unlocked there
          if (m.open && doors.isLocked(d.i)) {
            doors.unlock(d.i);
            this.vaultOpened();
          }
          doors.set(d.i, m.open);
        }
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
          const pos = f.drops.get(key)!.pos.clone();
          const it = f.remove(key);
          if (it?.kind === "keycard") this.keyHolder = from;
          this.broadcast({ t: "loot", op: "gone", key, by: from });
          if (it && isBin(it) && it.id === "closed") this.spillBin(pos, key);
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
        // a bin opened somewhere: heard across the place
        if (it && isBin(it) && it.id === "open") this.onBinOpened?.(at);
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
      // Storm Surge, as the host ranked it: a guest shows it and takes its
      // own tick while the packet names it below the line (update, below)
      const sg = m.sg;
      const next: SurgeView | null =
        Array.isArray(sg) && sg.length === 4 && sg.every((x) => typeof x === "number" && Number.isFinite(x))
          ? { startsIn: Math.max(0, sg[0]), live: sg[1] === 1, damage: Math.max(0, Math.min(SURGE_MAX, sg[2])), below: Math.max(0, Math.floor(sg[3])) }
          : null;
      this.setSurge(next, Array.isArray(m.sv) && m.sv.includes(this.id));
    } else if (m.t === "brend") this.finishBr(m.won, m.placement);
  }

  override update(local: LocalState): void {
    this.lastLocal = local;
    const frameDt = Math.max(0, Math.min(0.1, wallClock() - this.lastClock));
    super.update(local);
    if (this.ended) return;
    const now = wallClock();
    this.stepVault(now, local);
    if (this.phase === "matchEnd" && now >= this.endAt) {
      // over: the links stay open, for the group's next match (main's endMatch takes them)
      this.finish(this.placement ? this.placedText(this.placement) : "The battle royale is over.");
      return;
    }
    // the ship flies on every browser, on its own clock
    this.placeShip(now);
    // Resurgence: your wait and your way back
    this.resurgenceFrame(frameDt);
    // the Gulag: your first death's way back
    this.gulagFrame(now, frameDt, local);
    // the consoles: lit while they have something to show this round, their rings turning
    for (let i = 0; i < this.consoles.length; i++) {
      const c = this.consoles[i];
      c.model.setReady(this.consoleReady(i));
      c.model.spin(frameDt);
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
        if (this.alive && !this.gulag && Math.hypot(local.x - cur.cx, local.z - cur.cz) > cur.r) this.hurt(RING_PHASES[Math.min(this.view.phase, RING_PHASES.length - 1)].damage, -1);
        // Storm Surge on the same clock, while the host's packet has this player below the line
        if (this.alive && !this.downed && !this.gulag && this.surge?.live && this.surgeMine) this.hurt(this.surge.damage, -1);
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
   * drop straight in. Once: a beacon's respawn later in the match drops
   * straight in over the beacon.
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
      if (!b.bot.alive || b.guard) continue;
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
    if (this.phase === "countdown" && local.stance !== "air" && now - this.dropAt > 1) {
      this.enter("fight", now, 0);
      this.onNotice?.(this.fightNotice());
    }
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    // the bots that have landed search, then have their gun and a shield of some tier
    for (const b of this.bots) {
      if (!b.landed && b.bot.alive && !b.bot.dropping) {
        b.landed = true;
        b.landedAt = { x: b.bot.pos.x, z: b.bot.pos.z };
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
      if (this.alive && !this.gulag && ring.outside(local.x, local.z)) this.hurt(ring.damage, -1);
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
      const s = this.surge;
      const sg: [number, number, number, number] | undefined = s ? [s.startsIn, s.live ? 1 : 0, s.damage, s.below] : undefined;
      this.broadcast({
        t: "ring",
        ph: ring.phase,
        st: ring.state === "closing" ? 1 : ring.state === "closed" ? 2 : 0,
        left: Math.max(0, ring.timeLeft),
        cur: [ring.current.cx, ring.current.cz, ring.current.r],
        next: [ring.next.cx, ring.next.cz, ring.next.r],
        alive: this.aliveCount,
        sq: this.squadsAlive,
        sg,
        sv: s ? this.surgeHumans : undefined,
        dr: this.map.doors.openList(),
        db: this.map.doors.brokenList(),
      });
    }

    // the humans a bot can go after: the host, and the guests where they last were
    // what each is doing, for the bots' eyes: a runner is seen further out, a
    // crouched body nearer, and anyone who has just fired gives themselves away
    const firing = (id: number) => now - (this.shotAt.get(id) ?? -Infinity) < 0.5;
    const humans: Array<{ id: number; feet: THREE.Vector3; low: boolean; cue: SightCue; down: boolean }> = [];
    // a player under INVISIBILITY is not seen by the bots until it runs out or they fire (SpeedKills)
    const unseen = (id: number) => (this.hiddenUntil.get(id) ?? -Infinity) > now && !firing(id);
    if (this.alive && !this.gulagIds.has(this.id) && !unseen(this.id)) humans.push({ id: this.id, feet, low: local.crouch, cue: { speed: local.speed, crouched: local.crouch, firing: firing(this.id) }, down: this.downed });
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive || unseen(r.id)) continue;
      const last = r.samples[r.samples.length - 1];
      const low = !!last && (last.stance === "crouch" || last.stance === "slide");
      if (last) humans.push({ id: r.id, feet: new THREE.Vector3(last.x, last.y, last.z), low, cue: { speed: last.speed, crouched: low, firing: firing(r.id) }, down: r.downed });
    }

    // Resurgence: the bots whose wait is over come back
    this.redeployBots(dt);

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
      this.botCare(b, sense, dt);
      // a shut door in its way: it opens it, as anyone would
      if (bot.alive && !b.down && !bot.dropping) {
        const door = this.map.doors.closedAt(bot.pos, doorsCfg.botReach);
        if (door) this.hostDoor(door.i, true);
        this.botTraversal(b, sense, b.ropeTo);
      }
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
      // SMOKE's cloud or WARD's wall: drawn here and on every squad's screen
      const put = bot.takePutUp();
      if (put) {
        this.onRemoteFx?.(put.k, bot.remote.id, put.from, put.to, 0);
        this.broadcast({ t: "fx", from: bot.remote.id, k: put.k, a: [put.from.x, put.from.y, put.from.z], b: [put.to.x, put.to.y, put.to.z], n: 0 });
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
        for (const s of shots) if (hitsBody(s.from, s.dir, human.feet, human.low ? CROUCH_TOP : BODY_TOP)) dealt += s.damage;
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
          if (!hitsBody(s.from, s.dir, other.bot.pos, other.down ? CROUCH_TOP : BODY_TOP)) continue;
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
        // on the ship it is nowhere yet: a guest draws a figure only once one has been sent
        if (bot.aboard) continue;
        const yaw = ((bot.dummy.group.rotation.y - Math.PI) * 180) / Math.PI;
        this.broadcast({
          t: "s",
          from: bot.remote.id,
          tm: senderStamp(),
          x: bot.pos.x,
          y: bot.pos.y,
          z: bot.pos.z,
          yaw,
          pitch: 0,
          crouch: bot.crouching,
          w: this.botArmed(b, now) ? bot.remote.avatarWeapon : "",
          hp: bot.dummy.health,
          sh: bot.dummy.shield,
          alive: bot.alive,
          op: bot.remote.avatarOp,
          name: bot.remote.name,
          ready: true,
          st: b.down ? 7 : bot.travel?.kind === "zip" ? 6 : bot.dropping || bot.travel ? 3 : bot.crouching || bot.kneel ? 1 : 0,
          dn: b.down ? 1 : 0,
          sp: bot.alive && !bot.dropping ? Math.round(bot.diff.speed * 10) : 0,
        });
      }
    }
  }

  /** what a bot can see and where it should go */
  private sense(b: BrBot, humans: Array<{ id: number; feet: THREE.Vector3; low: boolean; cue: SightCue; down: boolean }>): BotSense {
    const bot = b.bot;
    if (b.guard) return this.guardSense(b, humans);
    // down: no fighting, only a crawl toward the nearest of its squad still standing
    if (b.down) {
      let near: BrBot | null = null;
      for (const o of this.bots) if (o !== b && o.team === b.team && o.bot.alive && !o.down && !o.bot.dropping && (!near || o.bot.pos.distanceTo(bot.pos) < near.bot.pos.distanceTo(bot.pos))) near = o;
      return { target: null, targetId: -1, goal: near ? near.bot.pos.clone() : null, canShoot: false };
    }
    // the nearest enemy in sight: a human, or another bot
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    let best = Infinity;
    if (this.phase === "fight") {
      for (const h of humans) {
        // a downed human counts as further off: a bot turns to whoever is still up
        const d = bot.pos.distanceTo(h.feet) * (h.down ? SQUADS.downedFar : 1);
        if (d < best && bot.sees(h.feet, h.cue)) {
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
      const d = bot.pos.distanceTo(o.bot.pos) * (o.down ? SQUADS.downedFar : 1);
      if (d < best && bot.sees(o.bot.pos)) {
        best = d;
        target = o.bot.pos;
        targetId = o.bot.remote.id;
      }
    }
    // A squad acts as one: what one bot sees, its mates close by go to look at.
    const mates = this.team.size > 1 ? this.bots.filter((o) => o !== b && o.team === b.team && o.bot.alive && !o.down && !o.bot.dropping) : [];
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
    const outsideNext = Math.hypot(bot.pos.x - ring.next.cx, bot.pos.z - ring.next.cz) > ring.next.r - 4;
    const hurry = outsideNext && (ring.state === "closing" || ring.timeLeft < 25 || ring.outside(bot.pos.x, bot.pos.z));
    let goal: THREE.Vector3 | null;
    // a package coming down near it is worth more than the next node: without
    // this nobody contests one but the squad, and a package nobody contests
    // is a free gold gun rather than an event
    const pod = this.podToContest(bot.pos);
    if (hurry) {
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
    } else if (pod) {
      goal = pod;
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
    return { target, targetId, goal, canShoot: this.phase === "fight" && !this.holdFire, urgent: hurry };
  }

  /** the next step along the graph from each node toward the node nearest a circle's middle, worked out once per circle (navgraph.ts) */
  private hurryTree: { key: string; tree: NavTree } | null = null;

  /** from node `from`, the next node on the graph toward the node nearest (cx, cz): -1 at it (walk straight in from there) */
  private hurryHop(cx: number, cz: number, from: number): number {
    const key = `${cx.toFixed(1)},${cz.toFixed(1)}`;
    if (!this.hurryTree || this.hurryTree.key !== key) this.hurryTree = { key, tree: navTree(this.map.nodes, cx, cz) };
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
        ahead: this.ringAhead,
        // not in the Gulag's room: the ring cannot reach you there, so it does not warn you either
        outside: local && !(this.gulag && this.gulag.phase !== "wait") ? Math.hypot(local.x - v.current.cx, local.z - v.current.cz) > v.current.r : false,
        damage: this.phases[Math.min(v.phase, this.phases.length - 1)].damage,
      },
      placement: this.phase === "matchEnd" ? this.placement : null,
      survived: now - this.startedAt,
      pois: this.map.pois.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      sites: this.map.sites.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      bounds: { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF },
      team: this.team.size,
      squads: this.squadsAlive,
      squadsTotal: this.squadsTotal,
      towers: this.map.towers,
      beacons: this.map.beacons,
      consoles: this.consoles.map((c, i) => ({ x: c.x, z: c.z, ready: this.consoleReady(i) })),
      pods: this.podSpots,
      // your squad on the map: friends on another side (solo with friends,
      // squads against each other) are enemies, and the map does not show those
      mates: [...this.remotes.values()]
        .filter((r) => r.id < Duel.BOT_ID && this.friendly(r.id) && r.samples.length)
        .map((r) => {
          const s = r.samples[r.samples.length - 1];
          return { x: s.x, z: s.z, name: r.name, downed: r.downed, alive: r.alive };
        }),
      // the card is up once it is over: no surge on it
      surge: this.surge && this.phase !== "matchEnd" ? { ...this.surge, safe: !this.surgeMine } : null,
      crate: this.crateProgress,
      gulag: this.gulag ? { phase: this.gulag.phase, clock: this.gulag.clock(now), opponent: this.gulagBot?.remote.name ?? "", capMe: this.gulag.capMe, capThem: this.gulag.capThem, capture: GULAG.capture } : null,
      resurgence:
        this.rules === "resurgence"
          ? { live: resurgenceLive(v.phase), toFinal: secondsToFinal(this.phases, Math.min(v.phase, this.phases.length - 1), v.state === "closing", v.timeLeft), redeployIn: this.selfRedeploy && !this.alive ? this.selfRedeploy.left : null }
          : null,
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
    this.map.doors.unlock(this.map.vault.door);
    this.map.doors.reset();
    this.dropShipModel();
    this.gulagBot?.dispose();
    this.gulagBot = null;
    this.showFlag(false);
    for (const c of this.consoles) {
      c.model.group.removeFromParent();
      c.model.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
    }
    this.consoles.length = 0;
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
