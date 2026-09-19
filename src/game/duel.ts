// A match against friends over Links (src/net/link.ts): a 1v1, or a 1v1v1.
//
// Who decides what:
//   - Each player owns their own movement and sends it 30 times a second.
//   - The SHOOTER decides hits: your bullets are tested against the other
//     players' figures as you see them, and you send the damage to the one
//     you hit. They apply it to their shield, then health. That is what makes
//     a hit feel right on your screen, and between friends it is the right
//     trade; it offers no protection against cheating.
//   - The player who made the match (the host: id 0, or hostId after a takeover) runs the rounds:
//     countdown, fight, round over, match over. Guests follow the host's
//     messages. With three players the host also relays: everything a guest
//     sends goes to the host, which passes it to the other guest with the
//     sender's id on it. Hits carry a `to`; the host applies its own and
//     relays the rest.
//   - A round goes to the last player standing, or to whoever is alone in
//     the circle for 10 s once it is live (20 s into the round). First to 3.
//
// The other players are drawn as robot figures holding their weapons, 100 ms
// behind real time and interpolated between updates, which hides the jitter
// of packets arriving unevenly.
//
// Every state packet goes out through broadcast (ours, and the host's bots)
// or relay (the host passing a guest on), and every one comes in through
// receive, so this class is the one place that decides what form it takes:
// a delta packet to a peer that has said it reads them (src/net/statesync.ts),
// the full packet to any other. The battle royale and the arena modes send
// their bots through the same broadcast and get the same choice for free.
import * as THREE from "three";
import squadCfg from "../config/squad.json";
import netCfg from "../config/net.json";
import { Dummy, actFromCode, stanceCode, stanceFromCode, type FigureAct, type FigureStance } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { resolveWeapon, type ResolvedWeapon } from "./weapons";
import type { AckMsg, DeltaMsg, DeltaPart, Link, NetMsg, RoundPhase, StateMsg } from "../net/link";
import { senderStamp, stateMsg, stateOf, type PlayerState } from "../net/state";
import { StateSync } from "../net/statesync";
import { HitCheck } from "../net/hitcheck";
import { ARENA_BOUNDS, ARENA_CENTER, ARENA_LOBBY_SPAWNS, ARENA_MAPS, ARENA_SPAWNS, TRI_BOUNDS, TRI_CENTER, TRI_SPAWNS, ZONE_RADIUS, arenaMap, mapFor, type ArenaMapId } from "./arena";
import type { Bounds } from "./player";
import { operatorById } from "./operators";
import type { MatchSummary } from "./stats";
import type { BrHud } from "./brmatch";
import type { ModeHud } from "./modematch";
import type { ActorState } from "./killcam";
import { HEAL_CODES } from "./recap";

const SEND_HZ = 30;
/** the least a friend's figure is drawn behind (net.json buffer: it grows with the connection's jitter) */
const INTERP_DELAY = netCfg.buffer.min;
export const ROUNDS_TO_WIN = 3;
const COUNTDOWN = 3;
const ROUND_END = 3;
const MATCH_END = 7;
/** the anti-camping circle: live this long into a round... */
export const ZONE_DELAY = 20;
/** ...and standing in it alone this long takes the round */
export const ZONE_CAPTURE = 10;
/** blue shields and full health: a common fight in the real game */
export const SHIELD_MAX = 75;
export const HEALTH_MAX = 100;
const DEG = Math.PI / 180;
/** nothing from a player for this long and they are gone */
const SILENCE_LIMIT = 10;
/** host migration is on (net.json migrate.on; ?migrate=0 in the address turns it off, for comparison) */
const MIGRATE = netCfg.migrate.on && (typeof location === "undefined" || new URLSearchParams(location.search).get("migrate") !== "0");

/** what the heir holds to take a match over (link.ts "heir" snap): each seat's key and everyone's ids, and when it came */
export interface HeirSnapshot {
  keys: Array<[number, string]>;
  ids: number[];
  /** the mode's own host state (snapshotMode), checked by the mode that reads it */
  mode?: unknown;
  at: number;
}
/**
 * The most humans in one match. The star topology puts every packet through
 * the host, which also runs the bots, so this is a friends-and-bots ceiling
 * rather than a lobby size: at eight the host is relaying about 1,500 small
 * messages a second. Every arena carries eight spawns for exactly this
 * reason: the warehouse's are in arena.ts, and each drawn map's are in its
 * own plan under src/game/arenas.
 */
export const MAX_PLAYERS = 8;
/** one gunshot sound per trigger pull: a shotgun's pellets arrive together */
const SHOT_SOUND_GAP = 0.03;

/**
 * The match runs on wall-clock seconds, not the game clock. The game clock
 * advances at most 0.1 s a frame, and a hidden tab gets about one frame a
 * second, so a host who alt-tabbed slowed every countdown and the circle for
 * everyone about tenfold.
 */
const wallClock = (): number => performance.now() / 1000;

export interface Spawn {
  x: number;
  z: number;
  yaw: number;
}

/** what a match plays on: where everyone starts, the middle, and the walls the player is held inside */
export interface ArenaChoice {
  map: ArenaMapId;
  spawns: Spawn[];
  center: THREE.Vector3;
  bounds: Bounds;
}

/**
 * The arena a match uses. There are five of them now (src/game/arena.ts
 * ARENA_MAPS): the warehouse, the triangle, and the three in
 * src/game/arenas. `map` is the host's choice, and it is the host's because
 * everyone in a match has to be standing in the same building.
 *
 * With no choice made this returns exactly what it always returned, which is
 * on purpose. main.ts still clamps a match's player to ARENA_BOUNDS by hand,
 * so a match that quietly moved to another map would put the player in the
 * warehouse's walls with the Vault's floor under them. The day the menu and
 * the welcome packet carry a map id, and main.ts reads `bounds` off this,
 * every mode can open on the map `mapFor` picks for it.
 */
export function arenaFor(players: number, map?: ArenaMapId | null): ArenaChoice {
  if (map) {
    const m = arenaMap(map);
    // a map has to have a spawn for everyone in the match; the warehouse and
    // the three drawn arenas all carry eight
    const spawns = m.spawns.length ? m.spawns : ARENA_LOBBY_SPAWNS;
    return { map: m.id as ArenaMapId, spawns, center: new THREE.Vector3(m.center.x, 0, m.center.z), bounds: m.bounds };
  }
  // two: the warehouse's ends. three: the triangle, a corner each. more than
  // that and the triangle is too small and has only three corners, so a lobby
  // plays the warehouse, which has a spawn each.
  if (players === 3) return { map: "triangle", spawns: TRI_SPAWNS, center: TRI_CENTER, bounds: TRI_BOUNDS };
  if (players > 3) return { map: "warehouse", spawns: ARENA_LOBBY_SPAWNS, center: ARENA_CENTER, bounds: ARENA_BOUNDS };
  return { map: "warehouse", spawns: [ARENA_SPAWNS.host, ARENA_SPAWNS.guest], center: ARENA_CENTER, bounds: ARENA_BOUNDS };
}

/** the maps a menu can offer, each with the modes it was drawn for */
export function arenaMapList(): Array<{ id: ArenaMapId; name: string; blurb: string; bestFor: string[]; players: number }> {
  return ARENA_MAPS.map((m) => ({ id: m.id as ArenaMapId, name: m.name, blurb: m.blurb, bestFor: m.bestFor, players: m.spawns.length }));
}

/** the map a mode opens on when the host has not picked one (src/game/arena.ts mapFor) */
export const defaultMapFor = mapFor;

interface Sample {
  at: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  stance: FigureStance;
  /** m/s */
  speed: number;
  /** 0..1 aiming; the hands' action and a heal's item */
  ads: number;
  act: FigureAct;
  healItem?: string;
}

/** another player as this side sees them */
export interface Remote {
  id: number;
  name: string;
  avatar: Dummy;
  avatarWeapon: string;
  avatarOp: string;
  avatars: Map<string, Dummy>;
  samples: Sample[];
  /** the sender's clock against ours: its unwrapped time, and the smallest gap seen between the two (placeByClock) */
  clock?: { last: number; sent: number; gap: number; heard: number };
  /** the jitter buffer: the worst recent wait from one state's time to the next one's arrival, and the delay the figure is drawn at */
  buffer?: { need: number; delay: number };
  health: number;
  shield: number;
  /** their armour's size (a battle royale's shield core), from their state packets */
  shieldMax: number;
  alive: boolean;
  /** a battle royale squad member down, not out: a squad mate can revive them */
  downed: boolean;
  /** off the menu, in the game */
  ready: boolean;
  /** the practice aim bot is on for them: everyone is shown it */
  aimbot?: boolean;
  lastHeard: number;
  /** who this player's messages come in on (the host: their link; a guest: the host's) */
  link: Link;
}

export interface DuelHud {
  you: number;
  them: number;
  round: number;
  phase: RoundPhase;
  left: number;
  ping: number | null;
  youWonRound: boolean | null;
  youWonMatch: boolean | null;
  zone: { live: boolean; startsIn: number; you: number; them: number; need: number };
  /** every player: name, score, alive; you first */
  players: Array<{ name: string; score: number; alive: boolean; you: boolean }>;
  /** the message while the host waits for the rest to arrive */
  waiting: string | null;
  /** at the end of a match: the numbers for the card (streak from the profile) */
  summary: (MatchSummary & { streak: number }) | null;
  /** a battle royale: the ring, the count, the drop (brmatch.ts) */
  br?: BrHud;
  /** an arena mode: Gun Run, team deathmatch, Crown (modematch.ts) */
  mode?: ModeHud;
}

export interface LocalState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  weapon: string;
  operator: string;
  name: string;
  /** in the game (not on the menu) */
  ready: boolean;
  /** for the figure the others see */
  stance: FigureStance;
  speed: number;
  /** 0..1 aiming down sights */
  ads?: number;
  /** what the hands are doing (dummy.ts actCode) */
  act?: number;
  /** the practice aim bot is on (it is shown to everyone) */
  aimbot?: boolean;
}

/** what a match (against friends or bots) offers the game loop */
export interface MatchLike {
  readonly kind: "duel" | "bots";
  readonly players: number;
  phase: RoundPhase;
  round: number;
  health: number;
  shield: number;
  /** this player's armour size: 75 (blue) in the arena, the shield core's in a battle royale */
  shieldMax: number;
  alive: boolean;
  readonly canFire: boolean;
  readonly spawn: Spawn;
  /** the figures bullets can hit right now */
  readonly avatars: Dummy[];
  remoteOf(d: Dummy): Remote | null;
  localShot(origin: THREE.Vector3, dir: THREE.Vector3, weapon: string): void;
  /** one of your bullets hit someone: `weapon` and `dist` go to them for their recap */
  localHit(r: Remote, amount: number, head: boolean, weapon?: string, dist?: number | null): void;
  update(local: LocalState): void;
  hud(): DuelHud;
  leave(): void;
  dispose(): void;
  onRespawn: (() => void) | null;
  onHurt: ((amount: number) => void) | null;
  onRemoteShot: ((origin: THREE.Vector3) => void) | null;
  onEnd: ((reason: string) => void) | null;
  onNotice: ((text: string) => void) | null;
  onMatchEnd: ((s: MatchSummary) => void) | null;
  /** a line for the kill feed: who knocked whom (`neutral`: neither side was you) */
  onFeed: ((text: string, mine: boolean, neutral?: boolean) => void) | null;
  /** the match end card wants your win streak from the profile */
  streak: number;
  /** knocked with others still standing: a figure to watch, or null */
  spectateTarget(): Dummy | null;
  /** JOLT and TRIAGE are on in this match (the host's setting) */
  readonly abilities: boolean;
  /** this player's id in the match (the recap's "you") */
  readonly id: number;
  /** you took damage: who, how much, a headshot, their gun and the distance when known */
  onDamaged: ((from: number, amount: number, head: boolean, weapon: string, dist: number | null) => void) | null;
  /** you are out (of the round, or the match): by whom, -1 the ring */
  onEliminated: ((by: number) => void) | null;
  /** someone fired (you, a player, a bot): the killcam re-fires it */
  onShotFired: ((id: number, o: THREE.Vector3, d: THREE.Vector3, weapon: string) => void) | null;
  /** every other figure as it stands (the killcam's recording) */
  actorStates(): ActorState[];
  /** a name for anyone in the match, you included */
  nameFor(id: number): string;
  /** what someone has left, when known (the recap) */
  vitalsFor(id: number): { shield: number; health: number } | null;
  /** an effect of this player's for the others (a JOLT from a to b; a finished heal, n its item code) */
  localFx(k: string, a?: THREE.Vector3, b?: THREE.Vector3, n?: number): void;
  /** someone else finished a heal (a player's fx, or a bot): the recap's "healed recently" */
  onHealSeen: ((id: number, item: string) => void) | null;
  /** someone else's effect (a player's, or a bot's): draw and play it */
  onRemoteFx: ((k: string, from: number, a?: THREE.Vector3, b?: THREE.Vector3, n?: number) => void) | null;
  /**
   * A bot's frag went off at `at` (the throw's flight is the page's): the side
   * that runs the bots works out who it hurt, as it does for their bullets.
   */
  botBlast?(owner: number, at: THREE.Vector3, kind: "frag" | "arcstar"): void;
}

export class Duel implements MatchLike {
  readonly kind = "duel" as const;
  readonly id: number;
  /** how many people the match is for (the host can start with fewer: startNow) */
  players: number;
  /**
   * Whose match it is: the one with the host's id. That is 0 from the start,
   * and a guest's own id after it takes a match over from a host that dropped
   * (docs/PLAN_HOST_MIGRATION.md), so nothing below may take 0 to mean the host.
   */
  role: "host" | "guest";
  /** the host's id (see role) */
  hostId = 0;
  phase: RoundPhase;
  protected phaseEndsAt = 0;
  round = 1;
  protected scores: number[];
  protected lastWinner = -1;

  // this player
  health = HEALTH_MAX;
  shield = SHIELD_MAX;
  shieldMax = SHIELD_MAX;
  alive = true;
  protected myName = "";
  /** this player is in the game, not on the menu (round 1 waits for everyone) */
  protected ready = false;

  // the others, by id
  protected remotes = new Map<number, Remote>();
  /** the host's links by guest id; a guest has one link, to the host */
  protected links = new Map<number, Link>();
  protected hostLink: Link | null = null;
  /** the delta packets' streams to and from each peer, and whether each peer reads them (public for the tests and tools/net-cost.ts) */
  readonly sync: StateSync;
  /** during a frame (update), the delta parts waiting to go to each peer as one packet */
  private batch: Map<number, DeltaPart[]> | null = null;
  private lastShotSound = -Infinity;

  // the circle
  private fightStartedAt = 0;
  private zoneLive = false;
  private zoneStartsIn = ZONE_DELAY;
  private caps: number[];
  private zoneSendNext = 0;
  protected lastClock: number;
  private sendNext = 0;
  private pingNext = 0;
  ping: number | null = null;
  /** when each player last fired (the host's bots are given it: a shooter gives itself away) */
  protected readonly shotAt = new Map<number, number>();
  /** the host: every claimed hit held up to what the gun can do before it reaches anyone (src/net/hitcheck.ts) */
  readonly hitCheck = new HitCheck();
  /** where this player last was, for the host's hit check */
  private selfAt = new THREE.Vector3();
  /** the host: each guest's round trip, ms (the roster, and the worst as this.ping) */
  readonly pingOf = new Map<number, number>();
  private weaponCache = new Map<string, ResolvedWeapon>();
  protected ended = false;
  private readonly spawns: Spawn[];
  private readonly center: THREE.Vector3;
  /** the arena this match is played in, and the walls the player is held inside it by */
  // Named arenaId and not map: BrMatch extends Duel and already keeps its
  // own private `map`, the battle royale's, and the two collided.
  readonly arenaId: ArenaMapId;
  readonly arenaBounds: Bounds;

  // for the summary
  protected kills = 0;
  protected deaths = 0;
  protected damage = 0;
  protected shots = 0;
  protected hits = 0;
  protected summarised = false;

  /** a new round begins: put the player at their spawn with full health and ammo */
  onRespawn: (() => void) | null = null;
  /** this player took damage */
  onHurt: ((amount: number) => void) | null = null;
  /** another player fired: where from, for sound */
  onRemoteShot: ((origin: THREE.Vector3) => void) | null = null;
  /** the match is over for this side (a link closed, or you left) */
  onEnd: ((reason: string) => void) | null = null;
  /** short messages for the HUD */
  onNotice: ((text: string) => void) | null = null;
  /** first to 3: the result, for stats (before the rematch starts) */
  onMatchEnd: ((s: MatchSummary) => void) | null = null;
  onFeed: ((text: string, mine: boolean, neutral?: boolean) => void) | null = null;
  streak = 0;
  protected lastSummary: MatchSummary | null = null;
  /** the host: how many have arrived, for the panel */
  onRoster: ((connected: number, players: number) => void) | null = null;
  /** rounds to win the 1v1 (custom rules; 3 as ever) */
  roundsToWin = ROUNDS_TO_WIN;
  /** squad mates and team mates can hurt each other (custom rules; off as ever) */
  friendlyFire = false;

  /** voice chat: each player's PeerJS id (the host's own, and every guest's), for voice.ts's calls */
  readonly voicePeers = new Map<number, string>();

  /** the lobby's host handover (link.ts "host"): main runs it; only while waiting, and a guest only hears it from the host */
  onHandover: ((m: Extract<NetMsg, { t: "host" }>, from: number) => void) | null = null;
  /** a guest: the connection to the host dropped mid-match; main tries the code again with the seat's key (swapHost takes the new link) */
  onHostLost: (() => void) | null = null;
  /**
   * Host migration (docs/PLAN_HOST_MIGRATION.md). The host: the guests that
   * said they can take the match over, the one it named, and when it next
   * tells them. A guest: who the host named and when, and (the heir itself)
   * the host's last snapshot.
   */
  private heirCan = new Set<number>();
  private heirNamed: number | null = null;
  private heirSendNext = 0;
  private heirSeen: { id: number; at: number } | null = null;
  private heirSnap: HeirSnapshot | null = null;
  /** the host: each seat's key, from the hosting (main sets it; the heir's snapshot carries them) */
  seatKeys: ((ids: number[]) => Array<[number, string]>) | null = null;
  /** the heir: the host is gone; main registers the match's code again, and calls takeOver once it has it */
  onTakeOver: ((snap: HeirSnapshot, oldHost: number) => void) | null = null;
  /** the host: seats held for guests whose connection dropped, until when (net.json rejoin.hold) */
  readonly held = new Map<number, number>();
  /** a guest: trying to get back to the host until this time, or null while connected */
  reconnectUntil: number | null = null;
  /** the host: a guest left before round 1, so their place can be taken again */
  onSlotFree: ((id: number) => void) | null = null;
  onRemoteFx: ((k: string, from: number, a?: THREE.Vector3, b?: THREE.Vector3, n?: number) => void) | null = null;
  onDamaged: ((from: number, amount: number, head: boolean, weapon: string, dist: number | null) => void) | null = null;
  onEliminated: ((by: number) => void) | null = null;
  onHealSeen: ((id: number, item: string) => void) | null = null;
  onShotFired: ((id: number, o: THREE.Vector3, d: THREE.Vector3, weapon: string) => void) | null = null;
  /** a squad member pinged something: what, where, the label, the figure it is on */
  onMark: ((k: string, from: number, at: THREE.Vector3, label: string, target: number) => void) | null = null;
  /** you went down (not out): the HUD's bleed-out clock starts */
  onDowned: (() => void) | null = null;
  /** someone went down or out that this side saw (a bot knocked, a player downed): EVO's knocks and assists */
  onKnockSeen: ((victim: number, by: number) => void) | null = null;
  /**
   * Down with the knockdown shield raised: what a hit from `from` leaves after
   * the shield has taken what it could (main.ts decides: the shield's arc and
   * what it has left). Null: nothing in the way.
   */
  downedBlock: ((amount: number, from: number) => number) | null = null;
  /** the knockdown shield is raised: the others see it (the state packet's dn is 2) */
  kdUp = false;
  /** the last respawn was a squad mate's hold at your death box, not a beacon's drop */
  respawnOnBox = false;
  /** each squad member's deaths since their lockout reset, the last one's time, and when they were last back in (Deathbox Respawn's lockout) */
  private boxDeaths = new Map<number, { n: number; at: number; backAt: number }>();
  /** a squad mate got you back up */
  onRevived: ((by: number) => void) | null = null;

  // ---- down, not out (a battle royale squad; Season 30's numbers)
  downed = false;
  private bleedHp = 0;
  /** what is left of the bleed-out while down: a hit lands here, not on health (a gold shield's self-revive watches it) */
  get bleedLeft(): number {
    return this.bleedHp;
  }
  bleedUntil = 0;
  /** the knocks this life (the bleed-out shortens each time; the knockdown shield is per knock) */
  knockCount = 0;
  private downBy = -1;
  /** the squad mate reviving you, while they are at it */
  revivedBy: number | null = null;
  /** bleed-out seconds for the first, second, third and later knocks */
  static readonly BLEED = squadCfg.bleedOut;
  /** the health a revive gives back */
  static readonly REVIVE_HEALTH = squadCfg.reviveHealth;
  /** JOLT and TRIAGE are on (the host's setting, told to the guests in the welcome) */
  readonly abilities: boolean;

  /**
   * A host passes its guests' links as they arrive (`addGuest` for the
   * later ones) with `myId` 0; a guest passes the host's link and the id the
   * host gave it.
   */
  /**
   * "duel": the arena rounds. "br": the battle royale (brmatch.ts) runs on
   * the same links and figures: no rounds or circle here, no damage between
   * the humans (they are a squad), the subclass drives the phases and adds
   * the bots and the ring. "arena": the arena's modes (modematch.ts: Gun Run,
   * team deathmatch, Crown), whose subclass drives the phases, the scores and
   * the bots, and says who is on whose side.
   */
  readonly mode: "duel" | "br" | "arena";

  constructor(
    protected scene: THREE.Scene,
    protected projectiles: ProjectileSystem,
    opts: { players: number; myId: number; hostId?: number; link: Link | null; guestId?: number; mode?: "duel" | "br" | "arena"; abilities?: boolean; map?: ArenaMapId | null }
  ) {
    const now = wallClock();
    this.mode = opts.mode ?? "duel";
    this.abilities = opts.abilities ?? false;
    this.players = this.mode === "duel" ? Math.max(2, Math.min(MAX_PLAYERS, opts.players)) : Math.max(1, Math.min(MAX_PLAYERS, opts.players));
    this.id = opts.myId;
    this.hostId = opts.hostId ?? 0;
    this.role = this.id === this.hostId ? "host" : "guest";
    this.sync = new StateSync(this.id);
    this.lastClock = now;
    this.scores = new Array(Math.max(2, this.players)).fill(0);
    this.caps = new Array(Math.max(2, this.players)).fill(0);
    const a = arenaFor(this.players, opts.map ?? null);
    this.spawns = a.spawns;
    this.center = a.center;
    this.arenaId = a.map;
    this.arenaBounds = a.bounds;
    this.phase = "waiting";
    this.phaseEndsAt = now + COUNTDOWN;
    if (this.role === "host") {
      // a battle royale alone has no link at all
      if (opts.link) this.addGuest(opts.link, opts.guestId ?? 1);
    } else if (opts.link) {
      this.hostLink = opts.link;
      opts.link.onMessage = (m) => this.receive(m, this.hostId);
      opts.link.onClose = () => this.hostDropped();
      // the others are known once their state arrives; the host at once
      this.remote(this.hostId);
      if (MIGRATE) opts.link.send({ t: "heir", op: "can" });
    }
    // The first spawn is the caller's to do (onRespawn is not set yet); every
    // later round calls onRespawn itself.
  }

  // ------------------------------------------------- hooks for the subclass

  /** a message this class does not know (the battle royale's ring, its end) */
  protected onExtra(_m: NetMsg, _from: number): void {}
  /** the host: a hit sent to an id that is not a guest's (a bot); true when taken */
  protected onHitOther(_to: number, _amount: number, _head: boolean, _from: number, _weapon?: string): boolean {
    return false;
  }
  /** the host, once a frame, after the links and before the state packet */
  protected tick(_now: number, _dt: number, _local: LocalState): void {}
  /** someone (a human) went down, on any side; `melee` when a melee did it */
  protected onSomeoneDown(_id: number, _by: number, _melee?: boolean): void {}
  /** the last hit this player took was a melee (the `down` says so: Gun Run takes a level for it) */
  protected lastHitMelee = false;
  /** the ids the humans use; bots are 100 up */
  static readonly BOT_ID = 100;
  /** on this player's side: no damage either way (a battle royale's squad; a team in the modes) */
  /** the damage this player has dealt this match (the ultimate's meter reads it) */
  get damageDealt(): number {
    return this.damage;
  }

  /** a team or squad mate of this player's (the page's kits ask: a MEDIC's FIELD HEAL is for them) */
  isFriend(id: number): boolean {
    return id !== this.id && this.friendly(id);
  }

  protected friendly(id: number): boolean {
    return this.mode === "br" && id >= 0 && id < Duel.BOT_ID;
  }
  /** a figure on this player's side: its plate reads as a team mate's, aim assist leaves it alone */
  isAlly(id: number): boolean {
    return id !== this.id && this.friendly(id);
  }
  /** what a guest is told as the fight starts; the battle royale says who wins it, and a solo one says it differently */
  protected fightNotice(): string {
    return this.mode === "br" ? "LANDED  ·  LAST SQUAD STANDING WINS" : "FIGHT";
  }
  /** a name for the feed by id (the subclass adds the bots it runs) */
  protected nameOf(id: number): string | undefined {
    return this.remotes.get(id)?.name;
  }

  /** the host: a guest arrived on this link with this id */
  addGuest(link: Link, id: number): void {
    if (this.role !== "host" || this.ended) return;
    this.links.set(id, link);
    link.onMessage = (m) => this.receive(m, id);
    // a close with no goodbye first is a dropped connection: the seat is held (a leave says goodbye)
    link.onClose = () => this.guestDropped(id);
    this.remote(id).link = link;
    this.onRoster?.(this.links.size, this.players);
    this.sendVoiceRoster();
  }

  /** the host: everyone's PeerJS id to everyone, for voice chat (on the local transport there are none) */
  protected sendVoiceRoster(): void {
    if (this.role !== "host") return;
    this.voicePeers.clear();
    for (const [id, l] of this.links) {
      const ids = l.peerIds?.();
      if (!ids) continue;
      this.voicePeers.set(this.id, ids.mine);
      this.voicePeers.set(id, ids.theirs);
    }
    const peers = [...this.voicePeers.entries()];
    if (peers.length) for (const l of this.links.values()) l.send({ t: "voice", peers });
  }

  /** a match that holds a dropped player's seat: under way, and not a 1v1 (which ends when one of the two goes) */
  private holdsSeats(): boolean {
    return !this.ended && this.mode !== "duel" && this.phase !== "waiting" && this.phase !== "matchEnd";
  }

  /**
   * The host: a guest's connection dropped without a goodbye. Their seat, and
   * their figure where it stood, are held for net.json's rejoin.hold seconds
   * for them to come back on (rejoin); after that they are gone, as if they
   * had left.
   */
  protected guestDropped(id: number): void {
    const link = this.links.get(id);
    if (!link) return;
    if (!this.holdsSeats()) {
      this.guestLeft(id);
      return;
    }
    this.links.delete(id);
    this.sync.forgetPeer(id);
    this.pingOf.delete(id);
    link.onMessage = null;
    link.onClose = null;
    link.abandon?.();
    this.held.set(id, wallClock() + netCfg.rejoin.hold);
    const r = this.remotes.get(id);
    this.onFeed?.(`${r?.name ?? "A player"} lost the connection: their place is held for ${netCfg.rejoin.hold} s`, false);
    this.onRoster?.(this.links.size, this.players);
  }

  /** the host: a guest back for its held seat on a new link. False if there is no seat held for it */
  rejoin(link: Link, id: number): boolean {
    if (this.role !== "host" || this.ended || !this.held.has(id)) return false;
    this.held.delete(id);
    this.links.set(id, link);
    link.onMessage = (m) => this.receive(m, id);
    link.onClose = () => this.guestDropped(id);
    const r = this.remote(id);
    r.link = link;
    r.lastHeard = wallClock();
    // their streams start over from whole states, both ways
    this.sync.forgetPeer(id);
    this.onFeed?.(`${r.name} is back`, false);
    this.onRoster?.(this.links.size, this.players);
    this.sendVoiceRoster();
    return true;
  }

  /** a guest: the host's link closed with no goodbye. Mid-match, keep playing and let main try to get back; otherwise it is over */
  private hostDropped(): void {
    if (this.ended || this.reconnectUntil !== null) return;
    const link = this.hostLink;
    if (link) {
      link.onMessage = null;
      link.onClose = null;
    }
    // The heir: main asks the broker for the match's code, and takes the
    // match over (takeOver) only once it has it. Until then it also tries to
    // get back in as a guest, as the others do: a host that is still there
    // (only this page's connection dropped) keeps the code, and its match.
    if (this.holdsSeats() && this.canTakeOver(wallClock()) && this.heirSnap && this.onHostLost) {
      this.hostLink = null;
      this.reconnectUntil = wallClock() + netCfg.rejoin.hold;
      this.onFeed?.("The host is gone: taking the match over...", false);
      this.onTakeOver?.(this.heirSnap, this.hostId);
      this.onHostLost();
      return;
    }
    if (!this.holdsSeats() || !this.onHostLost) {
      this.left = true;
      this.finish("The host left the match.");
      return;
    }
    this.hostLink = null;
    this.reconnectUntil = wallClock() + netCfg.rejoin.hold;
    this.onFeed?.(this.heirLive(wallClock()) ? "The host is gone: moving to the new host..." : "Lost the connection to the host: getting back in...", false);
    this.onHostLost();
  }

  /** a guest: the host named an heir lately (so the match will go on after the host) */
  private heirLive(now: number): boolean {
    return MIGRATE && !!this.heirSeen && now - this.heirSeen.at < netCfg.migrate.fresh;
  }

  /** a guest: this page is the heir, with a recent snapshot and someone to take it for */
  private canTakeOver(now: number): boolean {
    return MIGRATE && !!this.onTakeOver && !!this.heirSnap && now - this.heirSnap.at < netCfg.migrate.fresh && this.heirSeen?.id === this.id;
  }

  /** a match whose host state a guest's own copy holds (the snapshot adds only the seats): the modes override it as they are made to */
  protected canMigrate(): boolean {
    return false;
  }

  /** an effect a mode keeps for itself (the host hears a guest's Search "hold"): true if it took it */
  protected onFx(_k: string, _from: number, _n: number | undefined): boolean {
    return false;
  }

  /** the host: what the mode keeps only on the host, for the heir's snapshot (nothing, for a mode a guest's copy covers) */
  protected snapshotMode(_now: number): unknown {
    return undefined;
  }

  /** the heir, now the host: the mode's host state rebuilt from what this page had as a guest and the snapshot's `mode` (`oldHost` has gone) */
  protected restoreAsHost(_now: number, _oldHost: number, _mode: unknown): void {
    /* the base match's phase, round and scores are already every guest's */
  }

  /**
   * The heir takes the match over: this page is the host from here. The
   * others' seats are held for them to come back on (their retries find the
   * code main registers again), with their figures where they stood; the old
   * host is gone. The hit check starts empty, which only makes its first
   * second lenient.
   */
  takeOver(snap: HeirSnapshot): void {
    if (this.role === "host" || this.ended) return;
    const old = this.hostId;
    const now = wallClock();
    this.role = "host";
    this.hostId = this.id;
    this.hostLink = null;
    this.reconnectUntil = null;
    this.heirSnap = null;
    this.heirSeen = null;
    this.sync.forgetPeer(old);
    for (const id of snap.ids) {
      if (id === this.id || id === old || id >= Duel.BOT_ID) continue;
      this.held.set(id, now + netCfg.rejoin.hold);
      // their streams start over from whole states when they are back
      this.sync.forgetPeer(id);
    }
    this.playerGone(old, `${this.remotes.get(old)?.name ?? "The host"} left: you are the host now`);
    this.restoreAsHost(now, old, snap.mode);
    this.onFeed?.("The host is gone: you are the host now", false);
  }

  /** the host: its heir named to everyone, and the heir sent what it needs to take over, now and then */
  private sendHeir(now: number): void {
    this.heirSendNext = now + netCfg.migrate.snapshot;
    if (!MIGRATE || !this.canMigrate() || !this.holdsSeats()) return;
    let heir: number | null = null;
    for (const id of this.links.keys()) if (this.heirCan.has(id) && (heir === null || id < heir)) heir = id;
    this.heirNamed = heir;
    if (heir === null) return;
    const ids = [this.id, ...this.links.keys(), ...this.held.keys()];
    const keys = this.seatKeys?.(ids.filter((id) => id !== this.id)) ?? [];
    const m = this.snapshotMode(now);
    for (const [id, l] of this.links) l.send(id === heir ? { t: "heir", op: "snap", keys, ids, m } : { t: "heir", op: "is", id: heir });
  }

  /** the host's heir, or null (the tests) */
  get heir(): number | null {
    return this.role === "host" ? this.heirNamed : (this.heirSeen?.id ?? null);
  }

  /** a guest: back in, on a new link to the host (another page, when the host was taken over: `host` is its id) */
  swapHost(link: Link, host?: number): void {
    if (this.ended || this.role !== "guest") {
      link.close();
      return;
    }
    if (typeof host === "number" && host !== this.hostId && host >= 0 && host < Duel.BOT_ID) {
      const old = this.hostId;
      this.sync.forgetPeer(old);
      this.hostId = host;
      this.heirSeen = null;
      this.heirSnap = null;
      this.playerGone(old, `${this.remotes.get(old)?.name ?? "The host"} left: ${this.remotes.get(host)?.name ?? "a friend"} is the host now`);
    }
    this.hostLink = link;
    link.onMessage = (m) => this.receive(m, this.hostId);
    link.onClose = () => this.hostDropped();
    this.reconnectUntil = null;
    this.remote(this.hostId).lastHeard = wallClock();
    this.sync.forgetPeer(this.hostId);
    if (MIGRATE) link.send({ t: "heir", op: "can" });
    this.onFeed?.("Back in the match", false);
  }

  /** a player's figure by id, or null (the page paints their gun's finish on it) */
  avatarOf(id: number): Dummy | null {
    return this.remotes.get(id)?.avatar ?? null;
  }

  /** a link of this match (the host's first guest's, a guest's to the host): its PeerJS peer carries voice chat */
  anyLink(): Link | null {
    return this.role === "host" ? (this.links.values().next().value ?? null) : this.hostLink;
  }

  /** a message to one player: theirs from the host, the host's from a guest */
  tell(id: number, m: NetMsg): void {
    this.linkFor(id)?.send(m);
  }

  /** the tests: this guest's connection to the host drops, as a real one does, with no goodbye */
  dropHostLink(): void {
    this.hostLink?.abandon?.();
  }

  /**
   * The host, in the lobby: start with whoever is in. A host who made a match
   * for eight with seven in waited for ever: the match waited for every seat.
   * Not the 1v1s, whose arena is chosen by the count. The page stops the code
   * taking anyone new.
   */
  startNow(): boolean {
    if (this.role !== "host" || this.phase !== "waiting" || this.mode === "duel" || this.links.size < 1 || this.links.size >= this.players - 1) return false;
    this.players = this.links.size + 1;
    this.onStartShort();
    this.onRoster?.(this.links.size, this.players);
    return true;
  }

  /** the host's lobby as it stands: each friend in, whether they have clicked Play, their ping */
  roster(): Array<{ id: number; name: string; ready: boolean; ping: number | null }> {
    if (this.role !== "host") return [];
    return [...this.links.keys()].sort((a, b) => a - b).map((id) => {
      const r = this.remotes.get(id);
      return { id, name: r?.name ?? `PLAYER ${id + 1}`, ready: !!r?.ready, ping: this.pingOf.get(id) ?? null };
    });
  }

  /** the host, in the lobby: take a friend out (told so), and their place is open again */
  kick(id: number): boolean {
    if (this.role !== "host" || this.phase !== "waiting") return false;
    const link = this.links.get(id);
    if (!link) return false;
    link.send({ t: "kick" });
    // a moment for the message to go before the link closes behind it
    setTimeout(() => this.guestLeft(id), 150);
    return true;
  }

  /** the match is for fewer than it was made for (startNow): anything counted by the headcount recounts */
  protected onStartShort(): void {}

  /** the host: everyone connected and in the game (off the menu), so round 1 can start */
  protected everyoneReady(): boolean {
    if (this.links.size < this.players - 1 || !this.ready) return false;
    for (const id of this.links.keys()) if (!this.remotes.get(id)?.ready) return false;
    return true;
  }

  /** the link a message to `id` goes out on: theirs (the host) or the host's (a guest) */
  protected linkFor(id: number): Link | null {
    return this.role === "host" ? (this.links.get(id) ?? null) : this.hostLink;
  }

  /** the host: how many guests are connected */
  get connected(): number {
    return this.role === "host" ? this.links.size : 1;
  }

  get spawn(): Spawn {
    // never two players on one spot: past the list, step round it and push
    // out, rather than silently stacking everyone on the first
    const s = this.spawns[this.id];
    if (s) return s;
    const base = this.spawns[this.id % this.spawns.length] ?? this.spawns[0];
    const lap = Math.floor(this.id / Math.max(1, this.spawns.length));
    return { x: base.x + lap * 2.5, z: base.z + lap * 2.5, yaw: base.yaw };
  }

  /** firing is held during the countdown and after a round is decided */
  get canFire(): boolean {
    return this.phase === "fight" && this.alive;
  }

  get active(): boolean {
    return !this.ended;
  }

  get avatars(): Dummy[] {
    return [...this.remotes.values()].map((r) => r.avatar);
  }

  remoteOf(d: Dummy): Remote | null {
    for (const r of this.remotes.values()) if (r.avatar === d) return r;
    return null;
  }

  // ---------------------------------------------------------------- avatars

  protected remote(id: number): Remote {
    let r = this.remotes.get(id);
    if (r) return r;
    r = {
      id,
      name: `PLAYER ${id + 1}`,
      avatar: null as unknown as Dummy,
      avatarWeapon: "",
      avatarOp: "",
      avatars: new Map(),
      samples: [],
      health: HEALTH_MAX,
      shield: SHIELD_MAX,
      shieldMax: SHIELD_MAX,
      alive: true,
      downed: false,
      ready: false,
      lastHeard: wallClock(),
      link: this.hostLink ?? (this.links.get(id) as Link),
    };
    this.remotes.set(id, r);
    r.avatar = this.makeAvatar(r, "rspn101", "vanguard");
    return r;
  }

  private makeAvatar(r: Remote, weapon: string, op: string): Dummy {
    const key = `${weapon}|${op}`;
    let d = r.avatars.get(key);
    if (!d) {
      d = new Dummy(0, 0, 0, { armed: weapon, respawn: false, skin: operatorById(op), rig: true, noBase: true });
      // Its own health is not the truth, the other player's is; a huge pool
      // means its hit() reports full damage and never knocks it by itself.
      // Blue shields like the player's, so hits read in the shield colour.
      d.setTier(2);
      d.group.name = `opponent:${r.id}`;
      r.avatars.set(key, d);
    }
    d.reset();
    d.setThreat(0);
    d.health = 1e9;
    this.scene.add(d.group);
    this.projectiles.addDummy(d);
    r.avatarWeapon = weapon;
    r.avatarOp = op;
    return d;
  }

  /** the other figure when a player changes weapon or operator */
  private setAvatarLook(r: Remote, weapon: string, op: string): void {
    if (weapon === r.avatarWeapon && op === r.avatarOp) return;
    const old = r.avatar;
    const next = this.makeAvatar(r, weapon, op);
    next.group.position.copy(old.group.position);
    next.group.rotation.copy(old.group.rotation);
    next.group.scale.copy(old.group.scale);
    next.shield = old.shield;
    // (the new look of a figure already down: down, without a second gun falling; the old one's goes)
    if (old.knocked) next.fallDown(false);
    old.clearDropped();
    this.scene.remove(old.group);
    this.projectiles.removeDummy(old);
    r.avatar = next;
  }

  // --------------------------------------------------------------- network

  /** send to everyone else (the host: every guest; a guest: the host, who relays) */
  protected broadcast(m: NetMsg): void {
    if (m.t === "s") {
      // a state: ours, or one of the host's bots, which carries its id
      this.sendState(m, typeof m.from === "number" ? m.from : this.id, -1);
      return;
    }
    if (this.role === "host") for (const l of this.links.values()) l.send(m);
    else this.hostLink?.send(m);
  }

  /** the host: pass a guest's message on to the other guests, stamped */
  protected relay(m: NetMsg, from: number): void {
    if (this.role !== "host") return;
    if (m.t === "s") {
      this.sendState(m, from, from);
      return;
    }
    const stamped = { ...m, from } as NetMsg;
    for (const [id, l] of this.links) if (id !== from) l.send(stamped);
  }

  /**
   * One player's state to everyone who should have it: on the host every
   * guest but the one it is about (and `except`, the one it came in from), on
   * a guest the host. A peer that reads the delta packets gets a difference,
   * or nothing at all when nothing has changed; any other peer gets the full
   * packet it has always had, at the same moment, so an older build's match
   * is the match it always was.
   */
  private sendState(m: StateMsg, subject: number, except: number): void {
    const now = wallClock();
    let state: PlayerState | null = null;
    let full: StateMsg | null = null;
    for (const [to, link] of this.stateTargets()) {
      if (to === subject || to === except) continue;
      if (this.sync.speaksDeltas(to)) {
        if (!this.interested(to, subject, now)) continue;
        state ??= stateOf(m);
        const part = this.sync.encode(to, subject, state, now);
        if (!part) continue;
        // inside a frame, held for the frame's one packet (update); a relay goes at once
        const held = this.batch?.get(to);
        if (this.batch && held) held.push(part);
        else if (this.batch) this.batch.set(to, [part]);
        else (link.sendFast ?? link.send).call(link, { t: "sd", p: [part] });
      } else {
        full ??= this.fullPacket(m, subject);
        link.send(full);
      }
    }
  }

  /** the host's interest management (net.json interest): when each subject's state last went to each guest */
  private sentAt = new Map<number, number>();
  private readonly interestOn = new URLSearchParams(typeof location === "undefined" ? "" : location.search).get("interest") !== "0";

  /** the host: whether `subject`'s state is due to go to guest `to` now (always, near; less often, far) */
  private interested(to: number, subject: number, now: number): boolean {
    if (this.role !== "host" || !this.interestOn) return true;
    const a = this.whereIs(to);
    const b = this.whereIs(subject);
    if (!a || !b) return true;
    const I = netCfg.interest;
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < I.near) return true;
    const key = to * 4096 + subject;
    if (now - (this.sentAt.get(key) ?? -Infinity) < 1 / (d > I.far ? I.farHz : I.midHz)) return false;
    this.sentAt.set(key, now);
    return true;
  }

  /** who a state goes to: the host's guests, or a guest's host */
  private stateTargets(): Iterable<[number, Link]> {
    return this.role === "host" ? this.links : this.hostLink ? [[this.hostId, this.hostLink]] : [];
  }

  /** the frame's delta parts, one packet to each peer that is still there */
  private sendBatch(): void {
    const batch = this.batch;
    this.batch = null;
    if (!batch?.size) return;
    for (const [to, link] of this.stateTargets()) {
      const parts = batch.get(to);
      if (parts?.length) (link.sendFast ?? link.send).call(link, { t: "sd", p: parts });
    }
  }

  /**
   * The full packet for a peer that does not read the delta packets. Our own
   * carries the announcement (`dp`), which is how a newer peer finds out it
   * can send us differences; anyone else's carries the id it is about and no
   * announcement, because one is only ever about its sender.
   */
  private fullPacket(m: StateMsg, subject: number): StateMsg {
    const out: StateMsg = { ...m };
    delete out.dp;
    if (subject !== this.id) out.from = subject;
    else if (this.sync.announce !== undefined) out.dp = this.sync.announce;
    return out;
  }

  private receive(m: NetMsg, via: number): void {
    // a message still in flight when the match ended changes nothing
    if (this.ended) return;
    const now = wallClock();
    // Who it is from. On the host, always the link it came in on: a guest
    // never sends a `from`, and one it wrote itself would let it drop another
    // player (a forged bye), down them, or pass a hit off as a bot's. A guest
    // hears only the host, whose relayed messages carry the sender's id.
    const from = this.role === "host" ? via : "from" in m && typeof m.from === "number" ? m.from : via;
    if (from === this.id) return;
    // the host only listens to links it still holds; a guest it dropped for
    // silence must not come back as a figure with no link behind it
    if (this.role === "host" && !this.links.has(via)) return;
    // a state: the full packet, a delta one, or the ack for deltas we sent
    if (m.t === "s" || m.t === "sd" || m.t === "sa") {
      this.receiveState(m, from, via, now);
      return;
    }
    // a squad's systems: downs, revives, respawns, pings, loot and care packages
    if (m.t === "dnd" || m.t === "rev" || m.t === "respawn" || m.t === "mark" || m.t === "loot" || m.t === "pod" || m.t === "door") {
      this.receiveSquad(m, from, via);
      return;
    }
    // an effect: drawn where it happened, passed on by the host; it makes no figure
    if (m.t === "fx") {
      if (!fxWellFormed(m)) return;
      const known = this.remotes.get(from);
      if (known) known.lastHeard = now;
      // a mode's own (Search's "hold"): its to keep, not a thing to draw or pass on
      if (this.onFx(m.k, from, m.n)) return;
      if (m.k === "heal" && typeof m.n === "number" && HEAL_CODES[m.n]) this.onHealSeen?.(from, HEAL_CODES[m.n]);
      else this.onRemoteFx?.(m.k, from, m.a ? new THREE.Vector3(...m.a) : undefined, m.b ? new THREE.Vector3(...m.b) : undefined, m.n);
      // a JOLT: the figure leans into it
      if (m.k === "jolt") known?.avatar.jolt();
      this.relay(m, from);
      return;
    }
    // a goodbye or a stray message from someone unknown makes no figure
    // host migration: who can take over, who will, and what the heir holds
    if (m.t === "heir") {
      if (this.role === "host") {
        if (m.op === "can") this.heirCan.add(from);
      } else if (from === this.hostId) {
        if (m.op === "is" && typeof m.id === "number") this.heirSeen = { id: m.id, at: now };
        else if (m.op === "snap" && Array.isArray(m.keys) && Array.isArray(m.ids)) {
          const keys = m.keys.filter((k): k is [number, string] => Array.isArray(k) && typeof k[0] === "number" && typeof k[1] === "string" && k[1].length < 40);
          const ids = m.ids.filter((id): id is number => typeof id === "number" && id >= 0 && id < Duel.BOT_ID);
          this.heirSnap = { keys, ids, mode: m.m, at: now };
          this.heirSeen = { id: this.id, at: now };
        }
      }
      return;
    }
    // voice chat's roster, from the host
    if (m.t === "voice") {
      if (this.role !== "guest" || from !== this.hostId || !Array.isArray(m.peers)) return;
      this.voicePeers.clear();
      for (const p of m.peers) if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "string" && p[1].length < 80) this.voicePeers.set(p[0], p[1]);
      return;
    }
    // the host handed over, or is being handed it (main runs the rest)
    if (m.t === "host") {
      if (this.phase === "waiting" && (this.role === "host" || from === this.hostId)) this.onHandover?.(m, from);
      return;
    }
    // the host took you out of its lobby
    if (m.t === "kick") {
      if (this.role === "guest" && from === this.hostId) this.finish("The host took you out of the match.");
      return;
    }
    if (m.t === "bye" || m.t === "ping" || m.t === "pong" || m.t === "round" || m.t === "zone" || m.t === "hello" || m.t === "welcome" || m.t === "ring" || m.t === "brend" || m.t === "mode") {
      const known = this.remotes.get(from);
      if (known) known.lastHeard = now;
      if (m.t === "ring" || m.t === "brend" || m.t === "mode") {
        if (this.role === "guest") this.onExtra(m, from);
        return;
      }
      if (m.t === "bye") {
        if (this.role === "host") this.guestLeft(from);
        else if (from === this.hostId) {
          // a host leaving mid-match hands it to its heir, as a dropped one does
          if (this.heirLive(now) && this.holdsSeats() && this.onHostLost) {
            this.hostDropped();
            return;
          }
          this.left = true;
          this.finish("The host left the match.");
        }
        else this.playerGone(from, `${known?.name ?? "A player"} left the match.`);
        return;
      }
      if (m.t === "ping") this.linkFor(from)?.send({ t: "pong", at: m.at });
      else if (m.t === "pong") {
        const ms = Math.max(0, performance.now() - m.at);
        if (this.role === "host") {
          // one number per guest: each guest's answer used to overwrite the
          // last, so the host's ping flickered between them. The host shows
          // the worst, the connection its match is waiting on.
          this.pingOf.set(from, ms);
          this.ping = Math.max(...this.pingOf.values());
        } else if (from === this.hostId) this.ping = ms;
      } else if (m.t === "round") {
        if (this.role === "guest") this.applyRound(m);
      } else if (m.t === "zone") {
        if (this.role === "guest") {
          this.zoneLive = m.live;
          this.caps = m.caps.slice();
          this.zoneStartsIn = m.startsIn;
        }
      }
      return;
    }
    // numbers from another browser: a NaN would poison a position or health
    // for the rest of the match, so a malformed packet is dropped whole
    if (!wellFormed(m)) return;
    const r = this.remote(from);
    r.lastHeard = now;
    switch (m.t) {
      case "shot": {
        const o = new THREE.Vector3(...m.o);
        const dir = new THREE.Vector3(...m.d);
        // the figure's gun kicks
        r.avatar.kick();
        this.projectiles.fire(o, dir, this.weapon(m.w), true, 1, 1, r.avatar.muzzleWorld());
        this.onShotFired?.(from, o, dir, m.w);
        if (this.role === "host" && from < Duel.BOT_ID) this.heardShot(o);
        this.shotAt.set(from, wallClock());
        // Every pellet is its own message; the sound is once per pull. The
        // fastest guns fire about 55 ms apart, so no real shot is skipped.
        if (now - this.lastShotSound > SHOT_SOUND_GAP) {
          this.lastShotSound = now;
          this.onRemoteShot?.(o);
        }
        this.relay(m, from);
        break;
      }
      case "hit":
        // the host holds every claim up to what the gun can do (its own hits it makes itself)
        if (this.role === "host" && !this.hitSane(from, m)) break;
        if (m.to === this.id) this.takeHit(m.amount, from, m.head, typeof m.w === "string" ? m.w.slice(0, 32) : "", typeof m.d === "number" && Number.isFinite(m.d) ? m.d : null);
        else if (this.role === "host" && !this.onHitOther(m.to, m.amount, m.head, from, typeof m.w === "string" ? m.w : "")) this.links.get(m.to)?.send({ ...m, from });
        break;
      case "down":
        // a player went down: their figure falls now (the next state packet
        // would find them already marked dead), and the host scores the round
        // if one is left
        r.alive = false;
        r.downed = false;
        r.avatar.fallDown();
        {
          const by = m.by === this.id ? this.myName || "YOU" : m.by === -1 ? "THE RING" : (this.nameOf(m.by) ?? `PLAYER ${m.by + 1}`);
          const mine = m.by === this.id;
          // a `down` is the end of them (a knock is a `dnd`): the feed says so
          this.onFeed?.(`${by} eliminated ${r.name}`, mine, !mine && this.mode !== "duel");
          if (mine) this.kills++;
        }
        if (this.role === "host") {
          this.relay(m, from);
          if (this.mode === "duel") this.checkLastStanding(now);
        }
        this.onKnockSeen?.(from, m.by);
        this.outWithSquad();
        if (from < Duel.BOT_ID) this.noteDeath(from);
        if (from < Duel.BOT_ID) this.onSomeoneDown(from, m.by, m.m === 1);
        break;
      // the state packets, round, zone, ping, pong, bye, hello and welcome
      // are handled above, before a figure is made for the sender
    }
  }

  /** a state packet: a full one (any build), a delta one (a peer of this build), or an ack for the deltas we sent */
  private receiveState(m: StateMsg | DeltaMsg | AckMsg, from: number, via: number, now: number): void {
    if (m.t === "sa") {
      this.sync.onAck(m, via);
      const known = this.remotes.get(via);
      if (known) known.lastHeard = now;
      return;
    }
    if (m.t === "sd") {
      // every part that could be applied, rebuilt as the full packet it
      // stands for, so it is read by exactly the code that reads one
      for (const got of this.sync.decode(m, via)) this.applyState(stateMsg(got.state), got.from, now);
      // what we applied, and anything we are stuck on, back to the sender
      const ack = this.sync.ackFor(via, now);
      const back = this.linkFor(via);
      if (ack && back) (back.sendFast ?? back.send).call(back, ack);
      return;
    }
    // A peer's own full packet says whether it reads the delta packets (an
    // older build says nothing). A relayed one carries the id it is about and
    // says nothing about the peer that passed it on, which may well be an
    // older host relaying a newer guest.
    if (typeof m.from !== "number") this.sync.notePeer(via, m.dp);
    this.applyState(m, from, now);
  }

  /** place figures by when their states were sent (net.json senderClock); a switch for the tests' comparison */
  senderClock = netCfg.senderClock.on && new URLSearchParams(typeof location === "undefined" ? "" : location.search).get("senderclock") !== "0";

  /**
   * When a state was made, on our clock: the sender's own stamp (16 bits of
   * milliseconds, unwrapped here) plus the smallest gap seen between its clock
   * and ours, which is the least delayed state's. That gap creeps up slowly so
   * one lucky early state does not pin it. A state with no stamp (an older
   * build) is placed by when it arrived, as before, and so is everything after
   * a long silence or a jump in the stamps.
   */
  private placeByClock(r: Remote, tm: number | undefined, now: number): number {
    if (!this.senderClock || typeof tm !== "number" || !Number.isFinite(tm)) return now;
    const c = r.clock;
    let step = c ? (tm - c.last) & 0xffff : 0;
    if (step > 0x8000) step -= 0x10000;
    if (!c || now - c.heard > 5 || Math.abs(step) > 5000) {
      r.clock = { last: tm, sent: 0, gap: now, heard: now };
      return now;
    }
    c.last = tm;
    c.sent += step / 1000;
    c.gap = Math.min(c.gap + netCfg.senderClock.creep * (now - c.heard), now - c.sent);
    c.heard = now;
    return Math.min(now, c.sent + c.gap);
  }

  /**
   * The jitter buffer. As a state arrives, how long it has been since the
   * time of the one before it: a figure drawn less far behind than that ran
   * out of states before this one came, and stood still. The worst of that
   * lately is how far behind the figure is drawn, so it never does.
   */
  private noteLateness(r: Remote, _at: number, now: number): void {
    const B = netCfg.buffer;
    const b = (r.buffer ??= { need: 0, delay: INTERP_DELAY });
    const prev = r.samples[r.samples.length - 1];
    // a gap of seconds is a player who stopped sending (standing still between keyframes), not a late state
    if (prev && now - prev.at < B.max * 2) b.need = Math.max(now - prev.at, b.need * B.keep);
    else b.need *= B.keep;
  }

  /** one player's state: their figure moves and shows what they are doing, and the host passes it on */
  private applyState(m: StateMsg, from: number, now: number): void {
    if (!wellFormed(m)) return;
    const r = this.remote(from);
    r.lastHeard = now;
    // an older build sends no stance: its crouch flag stands in
    const stance = typeof m.st === "number" ? stanceFromCode(m.st) : m.crouch ? "crouch" : "stand";
    const ac = typeof m.ac === "number" && Number.isFinite(m.ac) ? m.ac : 0;
    const at = this.placeByClock(r, m.tm, now);
    this.noteLateness(r, at, now);
    r.samples.push({ at, x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch, crouch: m.crouch, stance, speed: (m.sp ?? 0) / 10, ads: typeof m.ad === "number" && Number.isFinite(m.ad) ? Math.max(0, Math.min(1, m.ad / 10)) : 0, act: actFromCode(ac), healItem: ac >= 10 ? HEAL_CODES[ac - 10] : undefined });
    if (r.samples.length > 30) r.samples.shift();
    // Their own numbers lag our hits by a round trip, so a packet can only
    // ever LOWER what we already predicted; a respawn (alive again) resets.
    if (m.alive && !r.alive) {
      r.avatar.reset();
      r.health = m.hp;
      r.shield = m.sh;
    } else {
      r.health = Math.min(r.health, m.hp);
      r.shield = Math.min(r.shield, m.sh);
    }
    // a name is whatever the other browser sent: text only, and short
    if (typeof m.name === "string") {
      const name = m.name.replace(/[\p{Cc}<>&"'`]/gu, "").trim().slice(0, 16);
      if (name) r.name = name;
    }
    if (typeof m.ready === "boolean") r.ready = m.ready;
    r.aimbot = m.bot === 1;
    if (typeof m.shm === "number" && Number.isFinite(m.shm) && m.shm >= 0 && m.shm <= 200) r.shieldMax = m.shm;
    r.downed = m.alive && (m.dn === 1 || m.dn === 2);
    r.avatar.setKnockShield(r.downed && m.dn === 2);
    // back in (a respawn): the lockout's "alive since"
    if (m.alive && !r.alive) this.noteBack(from);
    this.setAvatarLook(r, m.w, m.op);
    if (!m.alive && r.alive) r.avatar.fallDown();
    r.alive = m.alive;
    r.avatar.health = 1e9;
    r.avatar.shield = m.sh;
    this.relay(m, from);
  }

  protected guestLeft(id: number): void {
    const link = this.links.get(id);
    if (!link) return; // already handled (a bye and a close both arrive)
    this.links.delete(id);
    this.sync.forgetPeer(id);
    this.pingOf.delete(id);
    link.onMessage = null;
    link.onClose = null;
    link.close();
    this.seatGone(id, "left the match");
  }

  /** the host: a player gone for good (left, or their held seat ran out): the others told, the match goes on or ends */
  private seatGone(id: number, how: string): void {
    const r = this.remotes.get(id);
    this.sendVoiceRoster();
    // tell the other guest, then carry on if one is left; a 1v1 is over (a
    // battle royale goes on for whoever is left in the squad)
    this.relay({ t: "bye" }, id);
    if (this.mode === "duel" && (this.players === 2 || this.links.size === 0)) {
      this.finish(`${r?.name ?? "Your opponent"} left the match.`);
      return;
    }
    this.playerGone(id, `${r?.name ?? "A player"} ${how}.`);
    this.ping = null;
    if (this.phase === "fight" && this.mode === "duel") this.checkLastStanding(wallClock());
    // before round 1 a 1v1v1 waits for everyone: without a free place it
    // waited forever, and every new arrival (the same friend rejoining) was
    // turned away as "full"
    if (this.phase === "waiting") {
      this.onSlotFree?.(id);
      this.onRoster?.(this.links.size, this.players);
    }
  }

  /** one of three is gone: their figure goes, the match carries on as a 1v1 */
  protected playerGone(id: number, notice: string): void {
    if (this.revivedBy === id) this.revivedBy = null;
    if (this.dropFigure(id)) this.onNotice?.(notice.toUpperCase());
  }

  /** a figure and its stream gone, with nothing said (a bot the heir now runs itself): true if there was one */
  protected dropFigure(id: number): boolean {
    // their streams go with them, so a friend who rejoins under the same id starts clean
    this.sync.forgetSubject(id);
    const r = this.remotes.get(id);
    if (!r) return false;
    for (const d of r.avatars.values()) {
      this.projectiles.removeDummy(d);
      d.dispose();
    }
    this.remotes.delete(id);
    return true;
  }

  protected weapon(id: string): ResolvedWeapon {
    let w = this.weaponCache.get(id);
    if (!w) {
      try {
        w = resolveWeapon(id, 0);
      } catch {
        w = resolveWeapon("rspn101", 0);
      }
      this.weaponCache.set(id, w);
    }
    return w;
  }

  // ----------------------------------------------------------------- rounds

  protected enter(phase: RoundPhase, now: number, seconds: number, winner = -1): void {
    const wasEnd = this.phase === "roundEnd" || this.phase === "matchEnd";
    this.phase = phase;
    this.phaseEndsAt = now + seconds;
    if (phase === "countdown" || phase === "fight") {
      this.caps.fill(0);
      this.zoneLive = false;
      this.zoneStartsIn = ZONE_DELAY;
    }
    if (phase === "fight") this.fightStartedAt = now;
    if (phase === "countdown" && (wasEnd || this.round === 1)) this.respawn();
    if (phase === "matchEnd") this.summarise();
    if (this.role === "host") {
      this.broadcast({ t: "round", n: this.round, scores: this.scores.slice(), phase, left: seconds, winner });
    }
  }

  /** the guest follows the host's round messages */
  private applyRound(m: Extract<NetMsg, { t: "round" }>): void {
    const prev = this.phase;
    this.round = m.n;
    this.scores = m.scores.slice();
    this.phase = m.phase;
    this.phaseEndsAt = wallClock() + m.left;
    if (m.phase === "roundEnd" || m.phase === "matchEnd") this.lastWinner = m.winner;
    if (m.phase === "countdown" && prev !== "countdown") {
      this.caps.fill(0);
      this.zoneLive = false;
      this.respawn();
    }
    if (m.phase === "fight" && prev === "countdown") this.onNotice?.(this.fightNotice());
    if (m.phase === "matchEnd" && prev !== "matchEnd") this.summarise();
    if (m.phase === "countdown" && m.n === 1 && prev === "matchEnd") this.summarised = false;
  }

  /** host only: a round is decided for `winner` (-1: nobody, both down together) */
  private scoreRound(winner: number, now: number): void {
    if (this.phase !== "fight") return;
    if (winner >= 0) this.scores[winner]++;
    this.lastWinner = winner;
    const over = this.scores.some((s) => s >= this.roundsToWin);
    this.enter(over ? "matchEnd" : "roundEnd", now, over ? MATCH_END : ROUND_END, winner);
  }

  /** host: with one (or none) standing, the round is over */
  protected checkLastStanding(now: number): void {
    if (this.phase !== "fight") return;
    const standing: number[] = [];
    if (this.alive) standing.push(this.id);
    for (const r of this.remotes.values()) if (r.alive) standing.push(r.id);
    if (standing.length <= 1) this.scoreRound(standing[0] ?? -1, now);
  }

  protected respawn(): void {
    this.health = HEALTH_MAX;
    this.shield = this.shieldMax;
    this.alive = true;
    this.downed = false;
    this.knockCount = 0;
    this.revivedBy = null;
    // every figure stands back up here, not on the next state packet: the
    // round message beats that packet, so the alive transition was never seen
    // and a knocked figure lay on the floor, unhittable, for the rest of the match
    for (const r of this.remotes.values()) {
      r.alive = true;
      r.downed = false;
      r.health = HEALTH_MAX;
      r.shield = r.shieldMax;
      r.avatar.reset();
      r.avatar.health = 1e9;
    }
    this.onRespawn?.();
  }

  protected summarise(): void {
    if (this.summarised) return;
    this.summarised = true;
    const mine = this.scores[this.id] ?? 0;
    const others = this.scores.reduce((a, s, i) => (i === this.id ? a : a + s), 0);
    this.lastSummary = { won: mine >= this.roundsToWin, roundsWon: mine, roundsLost: others, kills: this.kills, deaths: this.deaths, damage: this.damage, shots: this.shots, hits: this.hits };
    this.onMatchEnd?.(this.lastSummary);
    this.kills = 0;
    this.deaths = 0;
    this.damage = 0;
    this.shots = 0;
    this.hits = 0;
  }

  /** another player's bullet hit this player (in a battle royale the humans are a squad: only bots and the ring, -1, hurt) */
  protected takeHit(amount: number, from: number, head = false, weapon = "", dist: number | null = null): void {
    if (!this.alive || this.phase !== "fight") return;
    if (!this.friendlyFire && this.friendly(from)) return;
    if (this.downed) {
      // the knockdown shield, raised and facing it, takes what it can
      if (this.downedBlock) amount = this.downedBlock(amount, from);
      if (amount <= 0) return;
      // down: what is left is the bleed-out's 100, and it can be finished
      this.bleedHp -= amount;
      this.onHurt?.(amount);
      this.onDamaged?.(from, amount, head, weapon, dist);
      if (this.bleedHp <= 0) this.eliminate(from, "finished");
      return;
    }
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health = Math.max(0, this.health - (amount - toShield));
    this.onHurt?.(amount);
    this.onDamaged?.(from, amount, head, weapon, dist);
    if (this.health <= 0) {
      // a squad with someone still up: down, not out; alone, out
      if (this.mode === "br" && this.squadUp()) this.goDown(from);
      else this.eliminate(from, "knocked");
    }
  }

  /** a squad mate still standing (up and not down) */
  protected squadUp(): boolean {
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && this.friendly(r.id) && r.alive && !r.downed) return true;
    return false;
  }

  /** a player down goes out with their squad when it has nobody up (squads of friends; with one side the match ends instead) */
  protected wipesWithSquad(): boolean {
    return false;
  }

  /** down with nobody of your squad left up: out, on whoever knocked you */
  protected outWithSquad(): void {
    if (this.wipesWithSquad() && this.alive && this.downed && !this.squadUp()) this.eliminate(this.downBy, "finished");
  }

  /** down, not out: the bleed-out clock (90, 60, 30, then 15 s a knock), the squad told */
  private goDown(from: number): void {
    this.downed = true;
    this.bleedHp = squadCfg.bleedHealth;
    this.bleedUntil = wallClock() + Duel.BLEED[Math.min(this.knockCount, Duel.BLEED.length - 1)];
    this.knockCount++;
    this.downBy = from;
    this.revivedBy = null;
    this.onFeed?.(`${from === -1 ? "THE RING" : (this.nameOf(from) ?? "SOMEONE")} knocked ${this.myName || "YOU"}`, false);
    this.broadcast({ t: "dnd", by: from });
    this.onDowned?.();
    this.onKnockSeen?.(this.id, from);
    this.onSomeoneDown(this.id, from);
  }

  /** out: the elimination (the killcam, the recap, the squad told) */
  protected eliminate(from: number, how: "knocked" | "finished" | "bled out"): void {
    if (!this.alive) return;
    this.alive = false;
    this.downed = false;
    this.deaths++;
    this.onEliminated?.(from);
    const who = from === -1 ? "THE RING" : (this.nameOf(from) ?? "SOMEONE");
    this.onFeed?.(how === "bled out" ? `${this.myName || "YOU"} bled out` : `${who} eliminated ${this.myName || "YOU"}`, false);
    this.broadcast({ t: "down", by: from, m: this.lastHitMelee ? 1 : undefined });
    this.noteDeath(this.id);
    if (this.role === "host" && this.mode === "duel") this.checkLastStanding(wallClock());
    this.onSomeoneDown(this.id, from, this.lastHitMelee);
  }

  /** a revive of a downed squad mate: started, given up, or done (the reviver's side) */
  sendRevive(to: number, op: "start" | "stop" | "done"): void {
    const m: NetMsg = { t: "rev", to, op };
    if (this.role === "host") this.links.get(to)?.send({ ...m, from: this.id });
    else this.hostLink?.send(m);
  }

  /** a squad member's death: the Deathbox Respawn lockout grows (reset after long enough alive) */
  protected noteDeath(id: number): void {
    const now = wallClock();
    const b = this.boxDeaths.get(id) ?? { n: 0, at: -Infinity, backAt: -Infinity };
    if (b.n > 0 && Number.isFinite(b.backAt) && now - b.backAt >= squadCfg.boxRespawn.resetAfter) b.n = 0;
    b.n++;
    b.at = now;
    this.boxDeaths.set(id, b);
  }
  protected noteBack(id: number): void {
    const b = this.boxDeaths.get(id);
    if (b) b.backAt = wallClock();
  }
  /** is this player in the match up (alive, maybe down)? null when not known */
  memberAlive(id: number): boolean | null {
    const r = this.remotes.get(id);
    return r ? r.alive : null;
  }

  /** seconds before a squad member can be respawned at their box (0: now) */
  boxLockout(id: number): number {
    const b = this.boxDeaths.get(id);
    if (!b || b.n <= 0) return 0;
    const L = squadCfg.boxRespawn.lockout;
    return Math.max(0, b.at + L[Math.min(b.n - 1, L.length - 1)] - wallClock());
  }

  /** a respawn of an eliminated squad mate: at a beacon (they drop in), or held at their death box (`box`: they stand up on it) */
  sendRespawn(to: number, at: THREE.Vector3, box = false): void {
    const m: NetMsg = { t: "respawn", to, at: [at.x, at.y, at.z], ...(box ? { bx: 1 } : {}) };
    if (this.role === "host") this.links.get(to)?.send({ ...m, from: this.id });
    else this.hostLink?.send(m);
  }

  /** a ping, for the squad */
  sendMark(k: string, at: THREE.Vector3, label: string, target = -1): void {
    this.broadcast({ t: "mark", k, at: [at.x, at.y, at.z], label: label.slice(0, 40), target });
  }

  /** where a respawn drops you in; the battle royale's own spawn otherwise */
  protected respawnPoint: THREE.Vector3 | null = null;
  /** a beacon brought you back: up, full health, dropping in over it; or a hold at your death box: up on it at 20 health */
  protected respawnHere(at: THREE.Vector3, box = false): void {
    if (this.alive) return;
    this.respawnPoint = at.clone();
    this.respawnOnBox = box;
    this.alive = true;
    this.downed = false;
    this.health = box ? squadCfg.boxRespawn.health : HEALTH_MAX;
    this.shield = box ? 0 : this.shieldMax;
    this.noteBack(this.id);
    this.onRespawn?.();
    this.respawnPoint = null;
    this.respawnOnBox = false;
  }

  /** the squad's messages: downs, revives, respawns, pings; loot and pods go to the subclass */
  private receiveSquad(m: NetMsg, from: number, via: number): void {
    const known = this.remotes.get(from);
    if (known) known.lastHeard = wallClock();
    switch (m.t) {
      case "dnd": {
        if (!finite(m.by)) return;
        const r = this.remote(from);
        r.downed = true;
        const by = m.by === this.id ? this.myName || "YOU" : m.by === -1 ? "THE RING" : (this.nameOf(m.by) ?? "SOMEONE");
        this.onFeed?.(`${by} knocked ${r.name}`, m.by === this.id, m.by !== this.id);
        this.relay(m, from);
        this.onKnockSeen?.(from, m.by);
        if (from < Duel.BOT_ID) this.onSomeoneDown(from, m.by);
        this.outWithSquad();
        break;
      }
      case "rev":
      case "respawn": {
        if (!finite(m.to)) return;
        if (m.to === this.id) {
          if (m.t === "rev") {
            if (m.op === "done" && this.downed && this.alive) {
              this.downed = false;
              this.health = Duel.REVIVE_HEALTH;
              this.revivedBy = null;
              this.onRevived?.(from);
              this.onFeed?.(`${this.nameOf(from) ?? "A SQUAD MATE"} revived ${this.myName || "YOU"}`, true);
            } else if (m.op === "start") this.revivedBy = from;
            else if (m.op === "stop") this.revivedBy = null;
          } else if (vec3(m.at)) this.respawnHere(new THREE.Vector3(...m.at), m.bx === 1);
        } else if (this.role === "host") this.links.get(m.to)?.send({ ...m, from });
        else if (m.t === "rev" && m.op === "done" && m.to >= Duel.BOT_ID) {
          // a bot picked up by its squad (the host's bots): the feed says so here too
          const r = this.remotes.get(m.to);
          if (r) r.downed = false;
          this.onFeed?.(`${this.nameOf(from) ?? "A BOT"} revived ${this.nameOf(m.to) ?? "A BOT"}`, false, false);
        }
        break;
      }
      case "mark":
        if (!vec3(m.at) || typeof m.k !== "string") return;
        // a ping is for its squad: another squad's (squads of friends) is passed on, not shown
        if (this.friendly(from)) this.onMark?.(m.k.slice(0, 12), from, new THREE.Vector3(...m.at), typeof m.label === "string" ? m.label.replace(/[\p{Cc}<>&"'`]/gu, "").slice(0, 40) : "", typeof m.target === "number" ? m.target : -1);
        this.relay(m, from);
        break;
      default:
        // loot and care packages: the battle royale's
        this.onExtra(m, from);
        void via;
    }
  }

  // ---------------------------------------------------------------- per frame

  /** this player's shot, so the others can draw and hear it */
  localShot(origin: THREE.Vector3, dir: THREE.Vector3, weapon: string): void {
    this.heardShot(origin);
    this.shotAt.set(this.id, wallClock());
    this.shots++;
    this.onShotFired?.(this.id, origin, dir, weapon);
    this.broadcast({ t: "shot", o: [origin.x, origin.y, origin.z], d: [dir.x, dir.y, dir.z], w: weapon });
  }

  /** a shot went off here (this player's, or a guest's on the host): the bots in earshot may come to look */
  protected heardShot(_at: THREE.Vector3): void {}

  /** this player's effect (a JOLT), for the others */
  localFx(k: string, a?: THREE.Vector3, b?: THREE.Vector3, n?: number): void {
    this.broadcast({ t: "fx", k, a: a ? [a.x, a.y, a.z] : undefined, b: b ? [b.x, b.y, b.z] : undefined, n });
  }

  /** one of this player's bullets hit another player's figure */
  localHit(r: Remote, amount: number, head: boolean, weapon = "", dist: number | null = null): void {
    if (this.phase !== "fight" || !r.alive) return;
    // a squad mate in a battle royale, a team mate in the modes: no friendly fire
    if (!this.friendlyFire && this.friendly(r.id)) return;
    this.hits++;
    this.damage += amount;
    const m: NetMsg = { t: "hit", to: r.id, amount, head, w: weapon || undefined, d: dist === null ? undefined : Math.round(dist * 10) / 10 };
    if (this.role === "host") r.link.send(m);
    else this.hostLink?.send(m);
    // show it at once rather than a round trip later
    const toShield = Math.min(r.shield, amount);
    r.shield -= toShield;
    r.health = Math.max(0, r.health - (amount - toShield));
    // the kill is credited when their `down` says it was us (once)
  }

  update(local: LocalState): void {
    // Everything this frame tells a peer about its players (our own state,
    // and on the host the bots its tick sends) goes out as ONE delta packet,
    // because every message pays about 90 bytes of SCTP, DTLS, UDP and IP
    // around it, which is more than the differences inside it. The frame's
    // other messages (shots, downs, rounds) go as they always did, and the
    // subclasses send their bots' shots and downs before their states, so
    // nothing a figure's state depends on is overtaken by holding it here.
    this.batch = new Map();
    try {
      this.frame(local);
    } finally {
      this.sendBatch();
    }
  }

  /** the host: whether a claimed hit passes the check; one that does not is dropped (and noted once per player in the console) */
  private hitSane(from: number, m: Extract<NetMsg, { t: "hit" }>): boolean {
    const a = this.whereIs(from);
    const b = this.whereIs(m.to);
    const why = this.hitCheck.judge(
      { from, amount: m.amount, weapon: typeof m.w === "string" ? m.w : "", dist: typeof m.d === "number" && Number.isFinite(m.d) ? m.d : null },
      wallClock(),
      this.shotAt.get(from),
      a && b ? a.distanceTo(b) : null
    );
    if (why && !this.warned.has(from)) {
      this.warned.add(from);
      console.warn(`hit from ${this.nameOf(from) ?? from} refused: ${why}`);
    }
    return why === null;
  }
  private warned = new Set<number>();

  /** where a player is as this browser sees it (this player, or a remote's last state); the subclasses add their bots */
  protected whereIs(id: number): THREE.Vector3 | null {
    if (id === this.id) return this.selfAt;
    const s = this.remotes.get(id)?.samples.at(-1);
    return s ? new THREE.Vector3(s.x, s.y, s.z) : null;
  }

  /** one frame of the match: the silence check, the circle, the rounds, the host's tick, our state, the figures */
  private frame(local: LocalState): void {
    const now = wallClock();
    this.selfAt.set(local.x, local.y, local.z);
    this.ready = local.ready;
    // Capture time is real time too. Up to 1.1 s a step covers a hidden tab's
    // one frame a second; a longer gap (a stalled tab) is not counted.
    const dt = Math.max(0, Math.min(1.1, now - this.lastClock));
    this.lastClock = now;
    this.myName = local.name;
    if (this.ended) return;
    // the host: a held seat nobody came back for is gone
    for (const [id, until] of [...this.held]) {
      if (now < until && this.holdsSeats()) continue;
      this.held.delete(id);
      this.seatGone(id, "did not come back");
      if (this.ended) return;
    }
    // a guest getting back in: out of time is out of the match
    if (this.reconnectUntil !== null && now > this.reconnectUntil) {
      this.reconnectUntil = null;
      this.left = true;
      this.finish("Lost the connection to the host.");
      return;
    }
    for (const r of [...this.remotes.values()]) {
      if (now - r.lastHeard > SILENCE_LIMIT && !(r.id >= Duel.BOT_ID && this.phase === "matchEnd")) {
        if (this.role === "guest" && r.id === this.hostId) {
          // a connection gone quiet is a dropped one: drop it and get back in (the timer above ends it)
          if (this.reconnectUntil !== null) continue;
          if (this.hostLink) this.hostLink.onClose = null;
          this.hostLink?.abandon?.();
          this.hostDropped();
          if (this.ended) return;
          continue;
        }
        if (this.role === "host") {
          // a held seat is the hold's to end
          if (this.held.has(r.id)) continue;
          this.guestDropped(r.id);
        } else this.playerGone(r.id, `Lost ${r.name}.`);
        if (this.ended) return;
      }
    }

    // host: the circle. Live ZONE_DELAY into the fight; alone in it for
    // ZONE_CAPTURE takes the round; more than one in it is contested.
    if (this.role === "host" && this.phase === "fight" && this.mode === "duel") {
      const since = now - this.fightStartedAt;
      this.zoneStartsIn = Math.max(0, ZONE_DELAY - since);
      this.zoneLive = since >= ZONE_DELAY;
      if (this.zoneLive) {
        const inZone = (x: number, y: number, z: number) => Math.hypot(x - this.center.x, z - this.center.z) <= ZONE_RADIUS && y < 1.5;
        const inside: number[] = [];
        if (this.alive && inZone(local.x, local.y, local.z)) inside.push(this.id);
        for (const r of this.remotes.values()) {
          const last = r.samples[r.samples.length - 1];
          if (r.alive && last && inZone(last.x, last.y, last.z)) inside.push(r.id);
        }
        if (inside.length === 1) {
          this.caps[inside[0]] += dt;
          if (this.caps[inside[0]] >= ZONE_CAPTURE) this.scoreRound(inside[0], now);
        }
      }
      if (wall(now) >= this.zoneSendNext) {
        this.zoneSendNext = now + 0.1;
        this.broadcast({ t: "zone", live: this.zoneLive, caps: this.caps.slice(), startsIn: this.zoneStartsIn });
      }
    }

    // down too long: bled out
    if (this.downed && this.alive && now >= this.bleedUntil) this.eliminate(this.downBy, "bled out");
    if (this.ended) return;

    // host: advance the rounds (a battle royale drives its own phases after the drop)
    if (this.role === "host" && this.phase === "waiting" && this.everyoneReady()) this.enter("countdown", now, COUNTDOWN);
    if (this.role === "host") this.tick(now, dt, local);
    if (this.ended) return;
    if (this.role === "host" && now >= this.heirSendNext) this.sendHeir(now);
    if (this.role === "host" && this.mode === "duel" && this.phase !== "waiting" && now >= this.phaseEndsAt) {
      if (this.phase === "countdown") {
        this.enter("fight", now, 0);
        this.onNotice?.("FIGHT");
      } else if (this.phase === "roundEnd") {
        this.round++;
        this.enter("countdown", now, COUNTDOWN);
      } else if (this.phase === "matchEnd") {
        // straight into a rematch
        this.scores.fill(0);
        this.round = 1;
        this.summarised = false;
        this.enter("countdown", now, COUNTDOWN);
      }
    }

    // send this player's state
    if (now >= this.sendNext) {
      this.sendNext = now + 1 / SEND_HZ;
      this.broadcast({
        t: "s",
        x: local.x,
        y: local.y,
        z: local.z,
        yaw: local.yaw,
        pitch: local.pitch,
        crouch: local.crouch,
        w: local.weapon,
        hp: this.health,
        sh: this.shield,
        alive: this.alive,
        op: local.operator,
        name: this.myName,
        bot: local.aimbot ? 1 : undefined,
        ready: this.ready,
        st: stanceCode(local.stance),
        sp: Math.round(local.speed * 10),
        shm: this.shieldMax,
        dn: this.downed ? (this.kdUp ? 2 : 1) : 0,
        ad: local.ads ? Math.round(local.ads * 10) : undefined,
        ac: local.act || undefined,
        tm: senderStamp(),
      });
    }
    if (now >= this.pingNext) {
      this.pingNext = now + 1;
      if (this.role === "host") for (const l of this.links.values()) l.send({ t: "ping", at: performance.now() });
      else this.hostLink?.send({ t: "ping", at: performance.now() });
    }

    for (const r of this.remotes.values()) {
      this.placeAvatar(r, now, dt);
      // the knock animation and the hit flash
      r.avatar.update(now, dt);
    }
  }

  /** a player, INTERP_DELAY behind, between the two samples around then */
  private placeAvatar(r: Remote, now: number, dt: number): void {
    const s = r.samples;
    if (!s.length) {
      r.avatar.group.visible = false;
      return;
    }
    r.avatar.group.visible = true;
    // the delay eases toward what the connection needs, so the figure never jumps when it changes
    const B = netCfg.buffer;
    const buf = r.buffer;
    let delay = INTERP_DELAY;
    if (buf) {
      const want = Math.max(B.min, Math.min(B.max, buf.need + 0.01));
      buf.delay += (want - buf.delay) * Math.min(1, dt * (want > buf.delay ? B.grow : B.shrink));
      delay = buf.delay;
    }
    const t = now - delay;
    let a = s[0];
    let b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].at <= t && s[i + 1].at >= t) {
        a = s[i];
        b = s[i + 1];
        break;
      }
    }
    // past the newest state (lost ones, a late one): along the last two a little way rather than a freeze
    const past = s.length > 1 && t > b.at;
    if (past) a = s[s.length - 2];
    const span = b.at - a.at;
    const k = span > 1e-6 ? Math.max(0, Math.min(1, (t - a.at) / span)) : 1;
    const ahead = past && span > 1e-6 && span < 0.5 ? Math.min(t - b.at, B.extrapolate) / span : 0;
    const g = r.avatar.group;
    const kp = k + ahead;
    g.position.set(a.x + (b.x - a.x) * kp, a.y + (b.y - a.y) * kp, a.z + (b.z - a.z) * kp);
    let dy = b.yaw - a.yaw;
    dy = ((((dy + 180) % 360) + 360) % 360) - 180;
    // the figure faces +z; a player at yaw 0 looks down -z
    if (!r.avatar.knocked) g.rotation.y = (a.yaw + dy * k) * DEG + Math.PI;
    // what the figure is doing: its stance and speed drive the animation, and
    // a crouch or a slide shrinks its hit zones (inside Dummy.update)
    const near = k < 0.5 ? a : b;
    // the way it moves against the way it faces, from the last two samples
    const last = s[s.length - 1];
    const prev = s.length > 1 ? s[s.length - 2] : last;
    r.avatar.setPose({
      speed: near.speed,
      stance: near.stance,
      pitch: a.pitch + (b.pitch - a.pitch) * k,
      moveDir: moveDirOf(last.x - prev.x, last.z - prev.z, last.yaw),
      ads: near.ads,
      act: near.act,
      healItem: near.healItem,
    });
    void dt;
  }

  hud(): DuelHud {
    const now = wallClock();
    const mine = this.scores[this.id] ?? 0;
    const theirs = Math.max(0, ...this.scores.filter((_, i) => i !== this.id));
    const players: DuelHud["players"] = [{ name: this.myName || "YOU", score: mine, alive: this.alive, you: true }];
    for (const r of this.remotes.values()) players.push({ name: r.name, score: this.scores[r.id] ?? 0, alive: r.alive, you: false });
    const decided = this.phase === "roundEnd" || this.phase === "matchEnd";
    return {
      you: mine,
      them: theirs,
      round: this.round,
      phase: this.phase,
      left: Math.max(0, this.phaseEndsAt - now),
      ping: this.ping,
      youWonRound: decided ? this.lastWinner === this.id : null,
      youWonMatch: this.phase === "matchEnd" ? mine >= this.roundsToWin : null,
      zone: {
        live: this.phase === "fight" && this.zoneLive,
        startsIn: this.phase === "fight" ? this.zoneStartsIn : ZONE_DELAY,
        you: this.caps[this.id] ?? 0,
        them: Math.max(0, ...this.caps.filter((_, i) => i !== this.id)),
        need: ZONE_CAPTURE,
      },
      players,
      waiting:
        this.phase === "waiting"
          ? this.role === "host"
            ? this.links.size < this.players - 1
              ? `WAITING FOR ${this.players - 1 - this.links.size} MORE`
              : "WAITING FOR EVERYONE TO CLICK PLAY"
            : "WAITING FOR THE OTHERS"
          : null,
      summary: this.phase === "matchEnd" && this.lastSummary ? { ...this.lastSummary, streak: this.streak } : null,
    };
  }

  /** every other figure as it stands: the killcam's recording */
  actorStates(): ActorState[] {
    const out: ActorState[] = [];
    for (const r of this.remotes.values()) {
      if (!r.samples.length) continue;
      const g = r.avatar.group;
      const p = r.avatar.currentPose;
      out.push({ id: r.id, name: r.name, x: g.position.x, y: g.position.y, z: g.position.z, yaw: ((g.rotation.y - Math.PI) * 180) / Math.PI, pitch: p.pitch, stance: p.stance, speed: p.speed, weapon: r.avatarWeapon, op: r.avatarOp, alive: r.alive, ads: p.ads ?? 0 });
    }
    return out;
  }

  nameFor(id: number): string {
    if (id === this.id) return this.myName || "YOU";
    if (id === -1) return "THE RING";
    return this.nameOf(id) ?? `PLAYER ${id + 1}`;
  }

  vitalsFor(id: number): { shield: number; health: number } | null {
    const r = this.remotes.get(id);
    return r ? { shield: Math.max(0, r.shield), health: Math.max(0, r.health) } : null;
  }

  /** knocked in a 1v1v1 with two still up: watch one of them until the round ends */
  spectateTarget(): Dummy | null {
    if (this.alive || this.phase !== "fight") return null;
    for (const r of this.remotes.values()) if (r.alive && r.samples.length) return r.avatar;
    return null;
  }

  protected finish(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.onEnd?.(reason);
  }

  /**
   * The match is over and the group stays together: its links, handed back
   * open, with nothing of this match left listening on them (the host's,
   * by guest id; a guest's, its link to the host).
   */
  takeLinks(): { guests: Map<number, Link>; host: Link | null } {
    const guests = new Map(this.links);
    for (const l of guests.values()) {
      l.onMessage = null;
      l.onClose = null;
    }
    const host = this.hostLink;
    if (host) {
      host.onMessage = null;
      host.onClose = null;
    }
    this.links.clear();
    this.hostLink = null;
    return { guests, host };
  }

  /** this player left, or a guest's host did (not the match running out): nothing to keep together after it */
  left = false;

  /** leave: tell the others, remove the figures */
  leave(): void {
    this.left = true;
    for (const l of this.links.values()) l.close();
    this.hostLink?.close();
    this.dispose();
    this.finish("You left the match.");
  }

  dispose(): void {
    for (const l of this.links.values()) l.onMessage = null;
    if (this.hostLink) this.hostLink.onMessage = null;
    for (const r of this.remotes.values()) {
      for (const d of r.avatars.values()) {
        this.projectiles.removeDummy(d);
        d.dispose();
      }
    }
    this.remotes.clear();
  }
}

const wall = (now: number): number => now;

/**
 * Which way a player moves against where they look, in radians: 0 forward,
 * +pi/2 to their right, pi backward. `yaw` in degrees, positive to the left;
 * a player at yaw 0 looks down -z.
 */
export function moveDirOf(dx: number, dz: number, yawDeg: number): number {
  if (Math.hypot(dx, dz) < 1e-5) return 0;
  const y = yawDeg * DEG;
  const fwd = -Math.sin(y) * dx - Math.cos(y) * dz;
  const right = Math.cos(y) * dx - Math.sin(y) * dz;
  return Math.atan2(right, fwd);
}

const finite = (...xs: unknown[]): boolean => xs.every((x) => typeof x === "number" && Number.isFinite(x));
const vec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && finite(...v);

/** an effect: a short name and, if there, finite points */
function fxWellFormed(m: Extract<NetMsg, { t: "fx" }>): boolean {
  return typeof m.k === "string" && m.k.length <= 16 && (m.a == null || vec3(m.a)) && (m.b == null || vec3(m.b)) && (m.n == null || finite(m.n));
}

/** the packets that make or move a figure, checked field by field */
function wellFormed(m: NetMsg): boolean {
  switch (m.t) {
    case "s":
      return finite(m.x, m.y, m.z, m.yaw, m.pitch, m.hp, m.sh) && typeof m.w === "string" && typeof m.alive === "boolean";
    case "shot":
      return vec3(m.o) && vec3(m.d) && typeof m.w === "string";
    case "hit":
      return finite(m.to, m.amount) && m.amount >= 0 && m.amount <= 1000 && (m.w == null || typeof m.w === "string") && (m.d == null || finite(m.d));
    case "down":
      return finite(m.by);
    case "door":
      return finite(m.i) && typeof m.open === "boolean";
    default:
      return true;
  }
}
