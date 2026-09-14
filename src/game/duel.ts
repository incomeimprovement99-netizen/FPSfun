// A match against friends over Links (src/net/link.ts): a 1v1, or a 1v1v1.
//
// Who decides what:
//   - Each player owns their own movement and sends it 30 times a second.
//   - The SHOOTER decides hits: your bullets are tested against the other
//     players' figures as you see them, and you send the damage to the one
//     you hit. They apply it to their shield, then health. That is what makes
//     a hit feel right on your screen, and between friends it is the right
//     trade; it offers no protection against cheating.
//   - The player who made the match (the host, id 0) runs the rounds:
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
import * as THREE from "three";
import { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { resolveWeapon, type ResolvedWeapon } from "./weapons";
import type { Link, NetMsg, RoundPhase } from "../net/link";
import { ARENA_CENTER, ARENA_SPAWNS, TRI_CENTER, TRI_SPAWNS, ZONE_RADIUS } from "./arena";
import { operatorById } from "./operators";
import type { MatchSummary } from "./stats";

const SEND_HZ = 30;
const INTERP_DELAY = 0.1;
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

/** the arena a match of this size uses */
export function arenaFor(players: number): { spawns: Spawn[]; center: THREE.Vector3 } {
  return players >= 3 ? { spawns: TRI_SPAWNS, center: TRI_CENTER } : { spawns: [ARENA_SPAWNS.host, ARENA_SPAWNS.guest], center: ARENA_CENTER };
}

interface Sample {
  at: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  crouch: boolean;
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
  health: number;
  shield: number;
  alive: boolean;
  /** off the menu, in the game */
  ready: boolean;
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
}

/** what a match (against friends or bots) offers the game loop */
export interface MatchLike {
  readonly kind: "duel" | "bots";
  readonly players: number;
  phase: RoundPhase;
  round: number;
  health: number;
  shield: number;
  alive: boolean;
  readonly canFire: boolean;
  readonly spawn: Spawn;
  /** the figures bullets can hit right now */
  readonly avatars: Dummy[];
  remoteOf(d: Dummy): Remote | null;
  localShot(origin: THREE.Vector3, dir: THREE.Vector3, weapon: string): void;
  localHit(r: Remote, amount: number, head: boolean): void;
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
  /** a line for the kill feed: who knocked whom */
  onFeed: ((text: string, mine: boolean) => void) | null;
  /** the match end card wants your win streak from the profile */
  streak: number;
  /** knocked with others still standing: a figure to watch, or null */
  spectateTarget(): Dummy | null;
}

export class Duel implements MatchLike {
  readonly kind = "duel" as const;
  readonly id: number;
  readonly players: number;
  readonly role: "host" | "guest";
  phase: RoundPhase;
  private phaseEndsAt = 0;
  round = 1;
  private scores: number[];
  private lastWinner = -1;

  // this player
  health = HEALTH_MAX;
  shield = SHIELD_MAX;
  alive = true;
  private myName = "";
  /** this player is in the game, not on the menu (round 1 waits for everyone) */
  private ready = false;

  // the others, by id
  private remotes = new Map<number, Remote>();
  /** the host's links by guest id; a guest has one link, to the host */
  private links = new Map<number, Link>();
  private hostLink: Link | null = null;
  private lastShotSound = -Infinity;

  // the circle
  private fightStartedAt = 0;
  private zoneLive = false;
  private zoneStartsIn = ZONE_DELAY;
  private caps: number[];
  private zoneSendNext = 0;
  private lastClock: number;
  private sendNext = 0;
  private pingNext = 0;
  ping: number | null = null;
  private weaponCache = new Map<string, ResolvedWeapon>();
  private ended = false;
  private readonly spawns: Spawn[];
  private readonly center: THREE.Vector3;

  // for the summary
  private kills = 0;
  private deaths = 0;
  private damage = 0;
  private shots = 0;
  private hits = 0;
  private summarised = false;

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
  onFeed: ((text: string, mine: boolean) => void) | null = null;
  streak = 0;
  private lastSummary: MatchSummary | null = null;
  /** the host: how many have arrived, for the panel */
  onRoster: ((connected: number, players: number) => void) | null = null;

  /**
   * A host passes its guests' links as they arrive (`addGuest` for the
   * later ones) with `myId` 0; a guest passes the host's link and the id the
   * host gave it.
   */
  constructor(
    private scene: THREE.Scene,
    private projectiles: ProjectileSystem,
    opts: { players: number; myId: number; link: Link; guestId?: number }
  ) {
    const now = wallClock();
    this.players = Math.max(2, Math.min(3, opts.players));
    this.id = opts.myId;
    this.role = this.id === 0 ? "host" : "guest";
    this.lastClock = now;
    this.scores = new Array(this.players).fill(0);
    this.caps = new Array(this.players).fill(0);
    const a = arenaFor(this.players);
    this.spawns = a.spawns;
    this.center = a.center;
    this.phase = "waiting";
    this.phaseEndsAt = now + COUNTDOWN;
    if (this.role === "host") {
      this.addGuest(opts.link, opts.guestId ?? 1);
    } else {
      this.hostLink = opts.link;
      opts.link.onMessage = (m) => this.receive(m, 0);
      opts.link.onClose = () => this.finish("The host left the match.");
      // the others are known once their state arrives; the host is id 0
      this.remote(0);
    }
    // The first spawn is the caller's to do (onRespawn is not set yet); every
    // later round calls onRespawn itself.
  }

  /** the host: a guest arrived on this link with this id */
  addGuest(link: Link, id: number): void {
    if (this.role !== "host" || this.ended) return;
    this.links.set(id, link);
    link.onMessage = (m) => this.receive(m, id);
    link.onClose = () => this.guestLeft(id);
    this.remote(id).link = link;
    this.onRoster?.(this.links.size, this.players);
  }

  /** the host: everyone connected and in the game (off the menu), so round 1 can start */
  private everyoneReady(): boolean {
    if (this.links.size < this.players - 1 || !this.ready) return false;
    for (const id of this.links.keys()) if (!this.remotes.get(id)?.ready) return false;
    return true;
  }

  /** the link a message to `id` goes out on: theirs (the host) or the host's (a guest) */
  private linkFor(id: number): Link | null {
    return this.role === "host" ? (this.links.get(id) ?? null) : this.hostLink;
  }

  /** the host: how many guests are connected */
  get connected(): number {
    return this.role === "host" ? this.links.size : 1;
  }

  get spawn(): Spawn {
    return this.spawns[this.id] ?? this.spawns[0];
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

  private remote(id: number): Remote {
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
      alive: true,
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
      d = new Dummy(0, 0, 0, { armed: weapon, respawn: false, skin: operatorById(op) });
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
    if (old.knocked) next.fallDown();
    this.scene.remove(old.group);
    this.projectiles.removeDummy(old);
    r.avatar = next;
  }

  // --------------------------------------------------------------- network

  /** send to everyone else (the host: every guest; a guest: the host, who relays) */
  private broadcast(m: NetMsg): void {
    if (this.role === "host") for (const l of this.links.values()) l.send(m);
    else this.hostLink?.send(m);
  }

  /** the host: pass a guest's message on to the other guests, stamped */
  private relay(m: NetMsg, from: number): void {
    if (this.role !== "host") return;
    const stamped = { ...m, from } as NetMsg;
    for (const [id, l] of this.links) if (id !== from) l.send(stamped);
  }

  private receive(m: NetMsg, via: number): void {
    // a message still in flight when the match ended changes nothing
    if (this.ended) return;
    const now = wallClock();
    // who it is from: a guest's own messages arrive on its link; a relayed
    // one carries the sender's id
    const from = "from" in m && typeof m.from === "number" ? m.from : via;
    if (from === this.id) return;
    // the host only listens to links it still holds; a guest it dropped for
    // silence must not come back as a figure with no link behind it
    if (this.role === "host" && !this.links.has(via)) return;
    // a goodbye or a stray message from someone unknown makes no figure
    if (m.t === "bye" || m.t === "ping" || m.t === "pong" || m.t === "round" || m.t === "zone" || m.t === "hello" || m.t === "welcome") {
      const known = this.remotes.get(from);
      if (known) known.lastHeard = now;
      if (m.t === "bye") {
        if (this.role === "host") this.guestLeft(from);
        else if (from === 0) this.finish("The host left the match.");
        else this.playerGone(from, `${known?.name ?? "A player"} left the match.`);
        return;
      }
      if (m.t === "ping") this.linkFor(from)?.send({ t: "pong", at: m.at });
      else if (m.t === "pong") {
        if (from === 0 || this.role === "host") this.ping = Math.max(0, performance.now() - m.at);
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
    const r = this.remote(from);
    r.lastHeard = now;
    switch (m.t) {
      case "s": {
        r.samples.push({ at: now, x: m.x, y: m.y, z: m.z, yaw: m.yaw, crouch: m.crouch });
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
        if (m.name) r.name = m.name;
        if (typeof m.ready === "boolean") r.ready = m.ready;
        this.setAvatarLook(r, m.w, m.op);
        if (!m.alive && r.alive) r.avatar.fallDown();
        r.alive = m.alive;
        r.avatar.health = 1e9;
        r.avatar.shield = m.sh;
        this.relay(m, from);
        break;
      }
      case "shot": {
        const o = new THREE.Vector3(...m.o);
        this.projectiles.fire(o, new THREE.Vector3(...m.d), this.weapon(m.w), true);
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
        if (m.to === this.id) this.takeHit(m.amount, from);
        else if (this.role === "host") this.links.get(m.to)?.send({ ...m, from });
        break;
      case "down":
        // a player went down: their figure falls now (the next state packet
        // would find them already marked dead), and the host scores the round
        // if one is left
        r.alive = false;
        r.avatar.fallDown();
        {
          const by = m.by === this.id ? (this.myName || "YOU") : (this.remotes.get(m.by)?.name ?? `PLAYER ${m.by + 1}`);
          this.onFeed?.(`${by} knocked ${r.name}`, m.by === this.id);
          if (m.by === this.id) this.kills++;
        }
        if (this.role === "host") {
          this.relay(m, from);
          this.checkLastStanding(now);
        }
        break;
      // round, zone, ping, pong, bye, hello and welcome are handled above,
      // before a figure is made for the sender
    }
  }

  private guestLeft(id: number): void {
    const link = this.links.get(id);
    if (!link) return; // already handled (a bye and a close both arrive)
    const r = this.remotes.get(id);
    this.links.delete(id);
    link.onMessage = null;
    link.onClose = null;
    link.close();
    // tell the other guest, then carry on if one is left; a 1v1 is over
    this.relay({ t: "bye" }, id);
    if (this.players === 2 || this.links.size === 0) {
      this.finish(`${r?.name ?? "Your opponent"} left the match.`);
      return;
    }
    this.playerGone(id, `${r?.name ?? "A player"} left the match.`);
    this.ping = null;
    if (this.phase === "fight") this.checkLastStanding(wallClock());
  }

  /** one of three is gone: their figure goes, the match carries on as a 1v1 */
  private playerGone(id: number, notice: string): void {
    const r = this.remotes.get(id);
    if (!r) return;
    for (const d of r.avatars.values()) {
      this.projectiles.removeDummy(d);
      d.dispose();
    }
    this.remotes.delete(id);
    this.onNotice?.(notice.toUpperCase());
  }

  private weapon(id: string): ResolvedWeapon {
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

  private enter(phase: RoundPhase, now: number, seconds: number, winner = -1): void {
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
    if (m.phase === "fight" && prev === "countdown") this.onNotice?.("FIGHT");
    if (m.phase === "matchEnd" && prev !== "matchEnd") this.summarise();
    if (m.phase === "countdown" && m.n === 1 && prev === "matchEnd") this.summarised = false;
  }

  /** host only: a round is decided for `winner` (-1: nobody, both down together) */
  private scoreRound(winner: number, now: number): void {
    if (this.phase !== "fight") return;
    if (winner >= 0) this.scores[winner]++;
    this.lastWinner = winner;
    const over = this.scores.some((s) => s >= ROUNDS_TO_WIN);
    this.enter(over ? "matchEnd" : "roundEnd", now, over ? MATCH_END : ROUND_END, winner);
  }

  /** host: with one (or none) standing, the round is over */
  private checkLastStanding(now: number): void {
    if (this.phase !== "fight") return;
    const standing: number[] = [];
    if (this.alive) standing.push(this.id);
    for (const r of this.remotes.values()) if (r.alive) standing.push(r.id);
    if (standing.length <= 1) this.scoreRound(standing[0] ?? -1, now);
  }

  private respawn(): void {
    this.health = HEALTH_MAX;
    this.shield = SHIELD_MAX;
    this.alive = true;
    // every figure stands back up here, not on the next state packet: the
    // round message beats that packet, so the alive transition was never seen
    // and a knocked figure lay on the floor, unhittable, for the rest of the match
    for (const r of this.remotes.values()) {
      r.alive = true;
      r.health = HEALTH_MAX;
      r.shield = SHIELD_MAX;
      r.avatar.reset();
      r.avatar.health = 1e9;
    }
    this.onRespawn?.();
  }

  private summarise(): void {
    if (this.summarised) return;
    this.summarised = true;
    const mine = this.scores[this.id] ?? 0;
    const others = this.scores.reduce((a, s, i) => (i === this.id ? a : a + s), 0);
    this.lastSummary = { won: mine >= ROUNDS_TO_WIN, roundsWon: mine, roundsLost: others, kills: this.kills, deaths: this.deaths, damage: this.damage, shots: this.shots, hits: this.hits };
    this.onMatchEnd?.(this.lastSummary);
    this.kills = 0;
    this.deaths = 0;
    this.damage = 0;
    this.shots = 0;
    this.hits = 0;
  }

  /** another player's bullet hit this player */
  private takeHit(amount: number, from: number): void {
    if (!this.alive || this.phase !== "fight") return;
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health = Math.max(0, this.health - (amount - toShield));
    this.onHurt?.(amount);
    if (this.health <= 0) {
      this.alive = false;
      this.deaths++;
      this.onFeed?.(`${this.remotes.get(from)?.name ?? "SOMEONE"} knocked ${this.myName || "YOU"}`, false);
      this.broadcast({ t: "down", by: from });
      if (this.role === "host") this.checkLastStanding(wallClock());
    }
  }

  // ---------------------------------------------------------------- per frame

  /** this player's shot, so the others can draw and hear it */
  localShot(origin: THREE.Vector3, dir: THREE.Vector3, weapon: string): void {
    this.shots++;
    this.broadcast({ t: "shot", o: [origin.x, origin.y, origin.z], d: [dir.x, dir.y, dir.z], w: weapon });
  }

  /** one of this player's bullets hit another player's figure */
  localHit(r: Remote, amount: number, head: boolean): void {
    if (this.phase !== "fight" || !r.alive) return;
    this.hits++;
    this.damage += amount;
    const m: NetMsg = { t: "hit", to: r.id, amount, head };
    if (this.role === "host") r.link.send(m);
    else this.hostLink?.send(m);
    // show it at once rather than a round trip later
    const toShield = Math.min(r.shield, amount);
    r.shield -= toShield;
    r.health = Math.max(0, r.health - (amount - toShield));
    // the kill is credited when their `down` says it was us (once)
  }

  update(local: LocalState): void {
    const now = wallClock();
    this.ready = local.ready;
    // Capture time is real time too. Up to 1.1 s a step covers a hidden tab's
    // one frame a second; a longer gap (a stalled tab) is not counted.
    const dt = Math.max(0, Math.min(1.1, now - this.lastClock));
    this.lastClock = now;
    this.myName = local.name;
    if (this.ended) return;
    for (const r of [...this.remotes.values()]) {
      if (now - r.lastHeard > SILENCE_LIMIT) {
        if (this.role === "guest" && r.id === 0) {
          this.finish("Lost the connection to the host.");
          return;
        }
        if (this.role === "host") this.guestLeft(r.id);
        else this.playerGone(r.id, `Lost ${r.name}.`);
        if (this.ended) return;
      }
    }

    // host: the circle. Live ZONE_DELAY into the fight; alone in it for
    // ZONE_CAPTURE takes the round; more than one in it is contested.
    if (this.role === "host" && this.phase === "fight") {
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

    // host: advance the rounds
    if (this.role === "host" && this.phase === "waiting" && this.everyoneReady()) this.enter("countdown", now, COUNTDOWN);
    if (this.role === "host" && this.phase !== "waiting" && now >= this.phaseEndsAt) {
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
        ready: this.ready,
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
    const t = now - INTERP_DELAY;
    let a = s[0];
    let b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].at <= t && s[i + 1].at >= t) {
        a = s[i];
        b = s[i + 1];
        break;
      }
    }
    const span = b.at - a.at;
    const k = span > 1e-6 ? Math.max(0, Math.min(1, (t - a.at) / span)) : 1;
    const g = r.avatar.group;
    g.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    let dy = b.yaw - a.yaw;
    dy = ((((dy + 180) % 360) + 360) % 360) - 180;
    // the figure faces +z; a player at yaw 0 looks down -z
    if (!r.avatar.knocked) g.rotation.y = (a.yaw + dy * k) * DEG + Math.PI;
    // crouched or sliding: shorter, and so are its hit zones
    // (the same blend at any frame rate: 35% a frame at 60 fps)
    const targetScale = (k < 0.5 ? a.crouch : b.crouch) ? 0.66 : 1;
    g.scale.y += (targetScale - g.scale.y) * (1 - Math.exp(-26 * dt));
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
      youWonMatch: this.phase === "matchEnd" ? mine >= ROUNDS_TO_WIN : null,
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

  /** knocked in a 1v1v1 with two still up: watch one of them until the round ends */
  spectateTarget(): Dummy | null {
    if (this.alive || this.phase !== "fight") return null;
    for (const r of this.remotes.values()) if (r.alive && r.samples.length) return r.avatar;
    return null;
  }

  private finish(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.onEnd?.(reason);
  }

  /** leave: tell the others, remove the figures */
  leave(): void {
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
