// The arena's modes, played: Gun Run, team deathmatch and Crown (modes.ts
// has the rules, src/config/modes.json the numbers), in the 1v1 arena,
// against friends, bots, or both.
//
// Built on the 1v1's Duel, the way the battle royale is (brmatch.ts): the
// same links, figures, hits and downs. The host runs the bots and the rules
// and tells the guests: bots go out as ordinary state packets with ids from
// 100 up; the rules' state (levels, kills, team scores, the crown, the clock,
// the winner) goes out as a `mode` message four times a second and on every
// change. Alone it is the same class with no links.
//
//   Gun Run and team deathmatch are one long fight: a player who goes down
//   comes back a few seconds later at the spawn farthest from the enemies,
//   until someone (or a team) reaches the end, or the clock runs out.
//   Crown is played in rounds like the 1v1: down is out until the next round;
//   the crown, or being the last one up, takes the round; first to 3.
//   Control (modes.ts Control) is team deathmatch's teams over three zones:
//   a point a second for each zone held, first to 500; you come back on the
//   most forward zone your team holds in a line from its base.
//
// Who is on whose side: in team deathmatch the players (the humans) are one
// team, filled out with bots to the team size, against a team of bots. Team
// mates cannot hurt each other and their bullets pass through each other.
// Gun Run and Crown are every player for themselves.
import * as THREE from "three";
import { Throwables, blastDamage, throwCode } from "./throwables";
import { Bot, BOT_NAMES, BOT_WEAPONS, DIFFICULTY, BODY_TOP, CROUCH_TOP, hitsBody, tierFor, type BotSense } from "./bots";
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { Duel, HEALTH_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import { ARENA_X, ARENA_Z, arenaMap, type ArenaMapId } from "./arena";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";
import type { ActorState } from "./killcam";
import { HEAL_CODES } from "./recap";
import { Control, Crown, GunLadder, MODES, MODE_TITLE, TeamScore, controlSpawnZone, gunList, killLeader, pickSpawn, teamMode, yawToMiddle, type CrownPhase, type ModeKind } from "./modes";
import { weaponName } from "./weapons";

const wallClock = (): number => performance.now() / 1000;
/** bot states go out this often (the humans' own go at 30 Hz) */
const BOT_SEND_HZ = 15;
/** the rules' state goes out this often, and on every change */
const MODE_SEND_EVERY = 0.25;
/** a winner that is a team, as the `mode` message carries it */
const TEAM_WIN = (team: 0 | 1): number => -10 - team;

export interface ModeHud {
  kind: ModeKind;
  title: string;
  /** seconds on the clock (Gun Run, team deathmatch); Crown: until the crown appears, else null */
  left: number | null;
  /** everyone, for the scoreboard, leader first */
  rows: Array<{ name: string; level: number; kills: number; deaths: number; you: boolean; team: 0 | 1; ally: boolean; alive: boolean; wins: number }>;
  /** Gun Run: your level, its gun, the next one */
  gun?: { level: number; of: number; name: string; next: string | null; knife: boolean };
  /** team deathmatch: your team's score, theirs, the limit */
  teams?: { you: number; them: number; limit: number };
  /** Crown: where it is, who has it, how long they have held it */
  crown?: { phase: CrownPhase; carrier: string | null; mine: boolean; held: number; need: number; at: THREE.Vector3; wins: number; roundsToWin: number };
  /** Control: the zones (owner from your side: "you", "them" or null; how far toward your side, -1..1), the scores, the bonus and a lockout */
  control?: {
    zones: Array<{ id: string; owner: "you" | "them" | null; v: number; bonus: boolean; at: THREE.Vector3; here: boolean }>;
    you: number;
    them: number;
    limit: number;
    bonusLeft: number | null;
    lockout: { mine: boolean; left: number } | null;
  };
  /** free-for-all: your kills, the best of the others, the limit */
  ffa?: { you: number; best: number; limit: number };
  /** down in a mode with respawns: seconds until you are back */
  respawnIn: number | null;
  /** once decided: who won ("YOU", a name, "YOUR TEAM", "THE OTHER TEAM") */
  winner: string | null;
  won: boolean | null;
}

interface ModeBot {
  bot: Bot;
  team: 0 | 1;
  /** down, back in at this time (the respawn modes) */
  respawnAt: number;
  /** its roaming waypoint */
  goal: number;
  /** for Gun Run's regen: the last time it was hurt, and what it had */
  hurtAt: number;
  vital: number;
}

export interface ArenaModeOpts {
  players: number;
  myId: number;
  link: Link | null;
  guestId?: number;
  abilities?: boolean;
  kind: ModeKind;
  /**
   * The bots you face. In a team mode your side is filled with ally bots to
   * match, so "3 bots" is three against you whoever else is on your side.
   */
  bots: number;
  difficulty: BotDifficulty;
  /** the gun every bot carries; unset is the mixed list */
  botWeapon?: string | null;
  /** Gun Run's list */
  list?: "short" | "full";
  /**
   * Team modes: the friends split into two sides against each other, the
   * humans alternating, and bots filling whichever side is short. Unset, every
   * human is on one side against the bots.
   */
  split?: boolean;
  /** the arena (src/game/arena.ts ARENA_MAPS); none is the warehouse, as it always was */
  map?: ArenaMapId | null;
}

/**
 * Where a mode's points are, for the map it is played on. Everything in the
 * mode rules is in the arena's own coordinates, its middle at 0, 0, so the
 * same rules play on any map: the warehouse's come from src/config/modes.json
 * as they always did, and a drawn arena's come from its plan
 * (src/game/arenas), turned from world space into the arena's own.
 */
interface ModeLayout {
  /** the arena's middle in world space */
  ox: number;
  oz: number;
  /** team deathmatch's two ends, and the spread points between them */
  a: number[][];
  b: number[][];
  mid: number[][];
  /** a free-for-all's order of starts: a lobby of eight each gets their own */
  order: number[][];
  /** Control's three points: id, x, z */
  zones: Array<[string, number, number]>;
  /** where the crown drops, world space */
  crown: { x: number; z: number };
}

function layoutFor(map: ArenaMapId | null | undefined): ModeLayout {
  const m = map ? arenaMap(map) : null;
  if (!m || m.id === "warehouse" || m.id === "triangle") {
    const S = MODES.spawns;
    return {
      ox: ARENA_X,
      oz: ARENA_Z,
      a: S.a,
      b: S.b,
      mid: S.mid,
      // all eighteen points, ends and middle alternating
      order: [S.a[0], S.b[0], S.mid[0], S.mid[1], S.a[1], S.b[2], S.mid[2], S.mid[3], S.a[2], S.b[1], S.a[3], S.b[4], S.mid[4], S.mid[5], S.a[4], S.b[3], S.a[5], S.b[5]],
      zones: MODES.control.zones.map(([id, x, z]) => [String(id), Number(x), Number(z)] as [string, number, number]),
      crown: { x: ARENA_X, z: ARENA_Z },
    };
  }
  const local = (q: { x: number; z: number }): number[] => [q.x - m.center.x, q.z - m.center.z];
  return {
    ox: m.center.x,
    oz: m.center.z,
    a: m.teams.a.map(local),
    b: m.teams.b.map(local),
    // a drawn map's eight spawns are its spread points: every one is a start
    // somebody can have, and the arenas check proves none sees another across
    // the map
    mid: m.spawns.map(local),
    order: m.spawns.map(local),
    zones: m.zones.map((z) => [z.id.toUpperCase(), z.x - m.center.x, z.z - m.center.z] as [string, number, number]),
    crown: { x: m.crown.x, z: m.crown.z },
  };
}

export class ArenaMode extends Duel {
  private layoutCache: ModeLayout | null = null;
  /** this match's map in the mode's own coordinates; lazy, because Duel's constructor can ask for a spawn before this class's fields exist */
  private get layout(): ModeLayout {
    if (!this.layoutCache) this.layoutCache = layoutFor(this.arenaId);
    return this.layoutCache;
  }
  /** arena coordinates to the world */
  private world(p: number[]): { x: number; z: number } {
    return { x: p[0] + this.layout.ox, z: p[1] + this.layout.oz };
  }
  readonly modeKind: ModeKind;
  readonly difficulty: BotDifficulty;
  readonly list: "short" | "full";
  readonly ladder: GunLadder;
  readonly teams = new TeamScore();
  private bots: ModeBot[] = [];
  /** team by id (team deathmatch); everyone is team 0 on their own otherwise */
  private teamOf = new Map<number, 0 | 1>();
  /** team modes: the friends are on two sides (the host's choice) */
  readonly split: boolean;
  /** Control's zones and scores (the host's; a guest mirrors it in `controlView`), and the zones drawn in the arena */
  private control: Control | null = null;
  private controlView: { v: number[]; owner: number[]; score: [number, number]; bonus: number; bonusLeft: number; lockTeam: number; lockLeft: number } | null = null;
  private zoneModels: Array<{ root: THREE.Group; ring: THREE.Mesh; fill: THREE.Mesh; pole: THREE.Mesh }> = [];
  /** the round's crown (the host's; a guest mirrors it in `crownView`) */
  private crown: Crown | null = null;
  private crownView: { phase: CrownPhase; x: number; z: number; carrier: number; held: number } | null = null;
  private crownModel: THREE.Group;
  /** Crown's round wins by id */
  private roundWins = new Map<number, number>();
  /** the clock: when the fight's time runs out (the host's), and what a guest was told */
  private timeEndsAt = Infinity;
  private leftAt = 0;
  private leftSeen: number | null = null;
  /** once decided: an id, or TEAM_WIN(team) */
  private winner: number | null = null;
  private respawnAt = Infinity;
  private spawnPick: Spawn | null = null;
  private modeSendNext = 0;
  private botSendNext = 0;
  private hurtAt = -Infinity;
  private lastLocal: LocalState | null = null;
  private myGun: string | null | undefined = undefined;
  /** the tests: the bots hold their fire (they still move and see) */
  holdFire = false;
  /** Gun Run: this player's gun changed (null: the knife); the game puts it in hand */
  onGun: ((id: string | null) => void) | null = null;

  constructor(scene: THREE.Scene, projectiles: ProjectileSystem, opts: ArenaModeOpts) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "arena", abilities: opts.abilities, map: opts.map ?? null });
    this.modeKind = opts.kind;
    this.difficulty = opts.difficulty;
    this.list = opts.list === "full" ? "full" : "short";
    this.ladder = new GunLadder(gunList(this.list));
    const tdm = teamMode(this.modeKind);
    // the humans: team 0 in a team mode, or alternating when the friends are split
    const split = tdm && !!opts.split && this.players > 1;
    this.split = split;
    for (let id = 0; id < this.players; id++) this.teamOf.set(id, split ? ((id % 2) as 0 | 1) : 0);
    this.crownModel = makeCrown();
    this.crownModel.visible = false;
    scene.add(this.crownModel);
    if (this.modeKind === "control") this.buildZones(scene);
    if (this.role !== "host") return;
    // The bots you asked for are the ones you face. A team mode then fills
    // your side with ally bots so the sides are even, which is what "3 bots"
    // means when there are two of you: three against you, one beside you.
    const enemies = Math.max(tdm ? 1 : 0, Math.min(MODES.maxBots, opts.bots));
    let allies = tdm ? Math.max(0, enemies - this.players) : 0;
    let foes = enemies;
    if (split) {
      // Split: the bots even the two sides up. The side size is the larger
      // side of humans, or half of everyone if the bots asked for take it past.
      const h0 = Math.ceil(this.players / 2);
      const h1 = Math.floor(this.players / 2);
      const side = Math.max(h0, Math.ceil((this.players + Math.min(MODES.maxBots, opts.bots)) / 2));
      allies = side - h0;
      foes = side - h1;
    }
    for (let i = 0; i < allies + foes; i++) {
      const team: 0 | 1 = tdm && i >= allies ? 1 : 0;
      const id = Duel.BOT_ID + i;
      const gun = this.modeKind === "gunrun" ? this.ladder.guns[0] : (opts.botWeapon || BOT_WEAPONS[i % BOT_WEAPONS.length]);
      // each its own tier ("mixed" draws one per bot)
      const bot = new Bot(i, scene, projectiles, DIFFICULTY[tierFor(this.difficulty)], this.startSpawn(id, team), id, gun, BOT_NAMES[i % BOT_NAMES.length]);
      // Gun Run is guns and the knife: no frags
      bot.grenadesAllowed = this.modeKind !== "gunrun";
      bot.setAbilities(this.abilities);
      bot.onJolt = (a, b) => {
        this.onRemoteFx?.("jolt", bot.remote.id, a, b);
        this.broadcast({ t: "fx", from: bot.remote.id, k: "jolt", a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] });
      };
      bot.onHealed = (item) => {
        this.onHealSeen?.(bot.remote.id, item);
        this.broadcast({ t: "fx", from: bot.remote.id, k: "heal", n: HEAL_CODES.indexOf(item) });
      };
      this.teamOf.set(id, team);
      this.ladder.row(id);
      this.bots.push({ bot, team, respawnAt: Infinity, goal: Math.floor(Math.random() * 12), hurtAt: -Infinity, vital: 0 });
      // a team mate's bullets pass through it (it is not a target for this side's guns)
      if (tdm && team === 0) projectiles.removeDummy(bot.dummy);
    }
    for (let id = 0; id < this.players; id++) this.ladder.row(id);
  }

  // ------------------------------------------------------------ who is who

  /** team deathmatch: the same side as this player; nobody in a free-for-all */
  protected override friendly(id: number): boolean {
    if (!teamMode(this.modeKind) || id < 0) return false;
    const a = this.teamOf.get(this.id);
    const b = this.teamOf.get(id);
    return a !== undefined && a === b;
  }

  private sameSide(a: number, b: number): boolean {
    if (a === b) return true;
    if (!teamMode(this.modeKind)) return false;
    const ta = this.teamOf.get(a);
    return ta !== undefined && ta === this.teamOf.get(b);
  }

  private teamFor(id: number): 0 | 1 {
    return this.teamOf.get(id) ?? 0;
  }

  get respawns(): boolean {
    return this.modeKind !== "crown";
  }

  /** Gun Run's knife level for this player: melee is the throwing knife */
  get knifeNow(): boolean {
    return this.modeKind === "gunrun" && this.ladder.level(this.id) >= this.ladder.knifeLevel;
  }

  /** the gun this player should have (Gun Run), null for the knife */
  get currentGun(): string | null {
    return this.ladder.gunFor(this.id);
  }

  override get avatars(): Dummy[] {
    return [...super.avatars, ...this.bots.map((b) => b.bot.dummy)];
  }

  override remoteOf(d: Dummy): Remote | null {
    return this.bots.find((b) => b.bot.dummy === d)?.bot.remote ?? super.remoteOf(d);
  }

  protected override nameOf(id: number): string | undefined {
    return this.remotes.get(id)?.name ?? this.bots.find((b) => b.bot.remote.id === id)?.bot.remote.name;
  }

  // ------------------------------------------------------------ spawns

  /** where a player or bot starts a round: a team's end, or spread round the arena */
  private startSpawn(id: number, team: 0 | 1): Spawn {
    const S = this.layout;
    let p: number[];
    if (teamMode(this.modeKind)) {
      const list = team === 0 ? S.a : S.b;
      const i = id < Duel.BOT_ID ? id : (this.players + (id - Duel.BOT_ID)) % list.length;
      p = list[i % list.length];
    } else {
      // all eighteen points, ends and middle alternating: a lobby of eight
      // humans plus bots each gets their own
      const order = S.order;
      const i = id < Duel.BOT_ID ? id : this.players + (id - Duel.BOT_ID);
      p = order[i % order.length];
    }
    const w = this.world(p);
    return { x: w.x, z: w.z, yaw: yawToMiddle(p[0], p[1]) };
  }

  /** a respawn: this side's spawns (a team's end in team deathmatch, anywhere otherwise) farthest from the enemies up */
  private respawnSpawn(id: number): Spawn {
    const S = this.layout;
    // Control: the most forward zone your team holds in a line from its base, else the base
    // (a guest works it out from the zones the host last sent)
    if (this.modeKind === "control" && (this.control || this.controlView)) {
      const team = this.teamFor(id);
      const zones = this.layout.zones.map(([, x, z], i) => ({ x, z, owner: this.zonesNow()[i]?.owner ?? -1 }));
      const zn = controlSpawnZone(zones, team);
      if (zn) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 1.5;
        const p = [zn.x + Math.cos(a) * r, zn.z + Math.sin(a) * r];
        const w = this.world(p);
        return { x: w.x, z: w.z, yaw: yawToMiddle(team === 0 ? p[0] : p[0], team === 0 ? p[1] - 20 : p[1] + 20) };
      }
    }
    const cands = (teamMode(this.modeKind) ? (this.teamFor(id) === 0 ? [...S.a, ...S.mid.slice(0, 2)] : [...S.b, ...S.mid.slice(2, 4)]) : [...S.a, ...S.b, ...S.mid]) as Array<[number, number]>;
    const enemies = this.fighters()
      .filter((f) => f.alive && !this.sameSide(f.id, id))
      .map((f) => ({ x: f.x - this.layout.ox, z: f.z - this.layout.oz }));
    const p = pickSpawn(cands, enemies);
    const w = this.world(p);
    return { x: w.x, z: w.z, yaw: yawToMiddle(p[0], p[1]) };
  }

  override get spawn(): Spawn {
    return this.spawnPick ?? this.startSpawn(this.id, this.teamFor(this.id));
  }

  /** everyone in the fight as the host knows them: this player, the guests where they last were, the bots */
  private fighters(): Array<{ id: number; x: number; z: number; y: number; alive: boolean; low: boolean }> {
    const out: Array<{ id: number; x: number; z: number; y: number; alive: boolean; low: boolean }> = [];
    const me = this.lastLocal;
    if (me) out.push({ id: this.id, x: me.x, y: me.y, z: me.z, alive: this.alive, low: me.crouch });
    // a guest's remotes include the host's bots (the host's own are in this.bots)
    for (const r of this.remotes.values()) {
      const s = r.samples[r.samples.length - 1];
      if (s) out.push({ id: r.id, x: s.x, y: s.y, z: s.z, alive: r.alive, low: s.stance === "crouch" || s.stance === "slide" });
    }
    for (const b of this.bots) out.push({ id: b.bot.remote.id, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, alive: b.bot.alive, low: false });
    return out;
  }

  // ------------------------------------------------------------ the fight

  /** the host's own bullet hit a bot (its dummy took the damage already) */
  override localHit(r: Remote, amount: number, head: boolean, weapon = "", dist: number | null = null): void {
    const b = this.bots.find((x) => x.bot.remote === r);
    if (!b) {
      super.localHit(r, amount, head, weapon, dist);
      return;
    }
    if (this.phase !== "fight" || !r.alive || this.friendly(r.id)) return;
    this.hits++;
    this.damage += amount;
    r.health = b.bot.dummy.health;
    r.shield = b.bot.dummy.shield;
    if (b.bot.dummy.knocked) this.botDown(b, this.id, weapon === "melee");
  }

  /** the host: a guest's hit on a bot (a team mate's is ignored) */
  protected override onHitOther(to: number, amount: number, head: boolean, from: number, weapon = ""): boolean {
    const b = this.bots.find((x) => x.bot.remote.id === to);
    if (!b) return false;
    if (this.phase !== "fight" || !b.bot.alive || this.sameSide(from, to)) return true;
    const bot = b.bot;
    bot.dummy.hit(wallClock(), head ? "head" : "body", amount, 1, 1, bot.pos.clone().setY(bot.pos.y + 1.2));
    bot.remote.health = bot.dummy.health;
    bot.remote.shield = bot.dummy.shield;
    if (bot.dummy.knocked) this.botDown(b, from, weapon === "melee");
    return true;
  }

  /** a bot went down to `by` (a player's id or another bot's) */
  private botDown(b: ModeBot, by: number, melee: boolean): void {
    const r = b.bot.remote;
    if (!r.alive) return;
    r.alive = false;
    const now = wallClock();
    const mine = by === this.id;
    if (mine) this.kills++;
    const who = by === this.id ? this.myName || "YOU" : (this.nameOf(by) ?? "SOMEONE");
    this.onFeed?.(`${who} knocked ${r.name}`, mine, !mine);
    this.broadcast({ t: "down", from: r.id, by, m: melee ? 1 : undefined });
    if (mine) this.onNotice?.(`${r.name} DOWN`);
    if (this.respawns) b.respawnAt = now + this.respawnDelay;
    this.scoreDown(r.id, by, melee, b.bot.pos.x, b.bot.pos.z);
  }

  private get respawnDelay(): number {
    return this.modeKind === "gunrun" ? MODES.gunRun.respawn : this.modeKind === "control" ? MODES.control.respawn : this.modeKind === "ffa" ? MODES.ffa.respawn : MODES.tdm.respawn;
  }

  /** a human went down (this player, or a guest's `down`): a respawn to come, and the score */
  protected override onSomeoneDown(id: number, by: number, melee = false): void {
    if (id === this.id && this.respawns) this.respawnAt = wallClock() + this.respawnDelay;
    if (this.role !== "host") return;
    const f = this.fighters().find((x) => x.id === id);
    this.scoreDown(id, by, melee, f?.x ?? 0, f?.z ?? 0);
  }

  /**
   * The host: `victim` went down to `by` (-1 nobody). Gun Run moves the
   * killer on (a knife kill wins it); team deathmatch scores for the killer's
   * team; Crown drops the crown if they had it and checks who is left.
   */
  private scoreDown(victim: number, by: number, melee: boolean, x: number, z: number): void {
    if (this.phase !== "fight" || this.winner !== null) return;
    const killer = by >= 0 && !this.sameSide(by, victim) ? by : -1;
    for (const b of this.bots) b.bot.forget(victim);
    const won = this.ladder.kill(killer, victim, melee && this.modeKind === "gunrun");
    const now = wallClock();
    if (this.modeKind === "gunrun") {
      this.gunsChanged();
      if (won) {
        this.endMatch(killer, now);
        return;
      }
    } else if (this.modeKind === "tdm") {
      if (killer >= 0) {
        const done = this.teams.kill(this.teamFor(killer));
        if (done !== null) {
          this.endMatch(TEAM_WIN(done), now);
          return;
        }
      }
    } else if (this.modeKind === "ffa") {
      // everyone for themselves: the killer's own count, first to the limit
      if (killer >= 0 && this.ladder.row(killer).kills >= MODES.ffa.scoreLimit) {
        this.endMatch(killer, now);
        return;
      }
    } else if (this.crown) {
      if (this.crown.carrier === victim) {
        this.crown.drop(x, z);
        this.onNotice?.("THE CROWN IS DOWN");
      }
      this.checkLastUp(now);
    }
    this.sendMode(now);
  }

  /** Gun Run: every bot's gun from its level, and this player's */
  private gunsChanged(): void {
    if (this.modeKind !== "gunrun") return;
    const knife = MODES.gunRun.knifeDamage;
    for (const b of this.bots) {
      const g = this.ladder.gunFor(b.bot.remote.id);
      if (g === null) b.bot.setKnife(knife);
      else {
        b.bot.setKnife(null);
        b.bot.setWeapon(g);
      }
    }
    this.syncMyGun();
  }

  private syncMyGun(): void {
    if (this.modeKind !== "gunrun") return;
    const g = this.ladder.gunFor(this.id);
    if (g === this.myGun) return;
    const first = this.myGun === undefined;
    this.myGun = g;
    if (!first) this.onNotice?.(g === null ? "THE KNIFE: A MELEE KILL WINS" : `NEXT GUN: ${weaponName(g).toUpperCase()}`);
    this.onGun?.(g);
  }

  /** Crown: one (or nobody) left up takes the round */
  private checkLastUp(now: number): void {
    if (this.modeKind !== "crown" || this.phase !== "fight") return;
    const up = this.fighters().filter((f) => f.alive);
    if (up.length <= 1) this.roundWon(up[0]?.id ?? -1, now);
  }

  /** Crown: a round to `id` (-1 nobody); the match at three */
  private roundWon(id: number, now: number): void {
    if (this.phase !== "fight") return;
    if (id >= 0) this.roundWins.set(id, (this.roundWins.get(id) ?? 0) + 1);
    this.crown = null;
    const wins = id >= 0 ? (this.roundWins.get(id) ?? 0) : 0;
    this.lastWinner = id;
    if (wins >= MODES.crown.roundsToWin) {
      this.endMatch(id, now);
      return;
    }
    // the rounds' counts ride in the round message's scores, in id order of the rows
    this.sendMode(now);
    this.enter("roundEnd", now, MODES.roundEnd, id);
  }

  /** the host: it is decided */
  private endMatch(winner: number, now: number): void {
    this.winner = winner;
    this.sendMode(now);
    this.enter("matchEnd", now, MODES.matchEnd, winner);
  }

  /** the damage this player takes: Gun Run's regen waits 4 s after it */
  protected override takeHit(amount: number, from: number, head = false, weapon = "", dist: number | null = null): void {
    const before = this.health + this.shield;
    this.lastHitMelee = weapon === "melee";
    super.takeHit(amount, from, head, weapon, dist);
    if (this.health + this.shield < before) this.hurtAt = wallClock();
  }

  // ------------------------------------------------------------ rounds

  protected override respawn(): void {
    super.respawn();
    this.respawnAt = Infinity;
    this.spawnPick = null;
    this.hurtAt = -Infinity;
    // a new round (Crown) or a new match: everyone at their start; the bots too
    for (const b of this.bots) {
      b.bot.respawnAt(this.startSpawn(b.bot.remote.id, b.team));
      b.bot.remote.alive = true;
      b.respawnAt = Infinity;
    }
  }

  /** back in after going down (Gun Run, team deathmatch): at the spawn farthest from the enemies */
  private respawnMe(): void {
    this.spawnPick = this.respawnSpawn(this.id);
    this.respawnAt = Infinity;
    this.health = HEALTH_MAX;
    this.shield = this.shieldMax;
    this.alive = true;
    this.downed = false;
    this.hurtAt = -Infinity;
    this.onRespawn?.();
  }

  protected override summarise(): void {
    if (this.summarised) return;
    this.summarised = true;
    const me = this.ladder.row(this.id);
    const myTeam = this.teamFor(this.id);
    const won = this.winner !== null && (this.winner === this.id || (teamMode(this.modeKind) && this.winner === TEAM_WIN(myTeam)));
    let roundsWon = 0;
    let roundsLost = 0;
    if (this.modeKind === "crown") {
      roundsWon = this.roundWins.get(this.id) ?? 0;
      for (const [id, n] of this.roundWins) if (id !== this.id) roundsLost += n;
    } else if (this.modeKind === "tdm") {
      roundsWon = this.teams.score[myTeam];
      roundsLost = this.teams.score[myTeam === 0 ? 1 : 0];
    } else if (this.modeKind === "control") {
      const sc = this.controlScore();
      roundsWon = Math.floor(sc[myTeam]);
      roundsLost = Math.floor(sc[myTeam === 0 ? 1 : 0]);
    } else if (this.modeKind === "ffa") {
      // your kills against the best of the others
      roundsWon = me.kills;
      roundsLost = Math.max(0, ...this.ladder.sorted.filter((r) => r.id !== this.id).map((r) => r.kills));
    } else roundsWon = me.level;
    this.lastSummary = { won, roundsWon, roundsLost, kills: me.kills, deaths: me.deaths, damage: this.damage, shots: this.shots, hits: this.hits };
    this.onMatchEnd?.(this.lastSummary);
    this.kills = 0;
    this.deaths = 0;
    this.damage = 0;
    this.shots = 0;
    this.hits = 0;
  }

  // ------------------------------------------------------------ the network

  // ------------------------------------------------------------ Control

  /** the zones in the arena: a ring on the floor, a fill that grows with the capture, a pole with a light */
  private buildZones(scene: THREE.Scene): void {
    if (this.zoneModels.length) return;
    const R = MODES.control.radius;
    for (const [, x, z] of this.layout.zones) {
      const root = new THREE.Group();
      const w = this.world([Number(x), Number(z)]);
      root.position.set(w.x, 0.03, w.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.18, R, 48), new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 48), new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.01;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      pole.position.y = 3;
      root.add(ring, fill, pole);
      scene.add(root);
      this.zoneModels.push({ root, ring, fill, pole });
    }
  }

  /** the zones as this side sees them: the host's Control, or what a guest was told */
  private zonesNow(): Array<{ v: number; owner: number }> {
    if (this.control) return this.control.zones.map((z) => ({ v: z.v, owner: z.owner }));
    const cv = this.controlView;
    return cv ? cv.v.map((v, i) => ({ v, owner: cv.owner[i] })) : this.layout.zones.map(() => ({ v: 0, owner: -1 }));
  }

  private controlScore(): [number, number] {
    return this.control ? this.control.score : (this.controlView?.score ?? [0, 0]);
  }

  /** colours: your team's blue, theirs red, nobody's white; the fill grows with the side's hold */
  private drawZones(now: number): void {
    const mine = this.teamFor(this.id);
    const col = (owner: number) => (owner === -1 ? 0xe8e8e8 : owner === mine ? 0x3fa7ff : 0xff4a3d);
    const bonus = this.control?.bonus?.zone ?? (this.controlView && this.controlView.bonus >= 0 ? this.controlView.bonus : -1);
    this.zonesNow().forEach((z, i) => {
      const m = this.zoneModels[i];
      if (!m) return;
      const lean = z.v < 0 ? 0 : 1;
      (m.ring.material as THREE.MeshBasicMaterial).color.setHex(col(z.owner));
      (m.fill.material as THREE.MeshBasicMaterial).color.setHex(Math.abs(z.v) < 1e-3 ? 0xe8e8e8 : col(lean));
      m.fill.scale.setScalar(Math.max(0.02, Math.abs(z.v)));
      (m.pole.material as THREE.MeshBasicMaterial).color.setHex(i === bonus ? 0xffd23c : col(z.owner));
      (m.pole.material as THREE.MeshBasicMaterial).opacity = i === bonus ? 0.45 + 0.25 * Math.sin(now * 5) : 0.35;
    });
  }

  /** the host's Control for the guests: 12 numbers */
  private controlPacket(now: number): number[] {
    const c = this.control!;
    return [...c.zones.map((z) => z.v), ...c.zones.map((z) => z.owner), c.score[0], c.score[1], c.bonus ? c.bonus.zone : -1, c.bonus ? Math.max(0, c.bonus.endsAt - now) : 0, c.lockout ? c.lockout.team : -1, c.lockout ? Math.max(0, c.lockout.endsAt - now) : 0];
  }

  /** Control for the HUD, from this side */
  private controlHud(now: number): NonNullable<ModeHud["control"]> {
    const mine = this.teamFor(this.id);
    const sc = this.controlScore();
    const c = this.control;
    const cv = this.controlView;
    const bonusZone = c ? (c.bonus ? c.bonus.zone : -1) : (cv?.bonus ?? -1);
    const bonusLeft = c ? (c.bonus ? c.bonus.endsAt - now : null) : cv && cv.bonus >= 0 ? cv.bonusLeft : null;
    const lockTeam = c ? (c.lockout ? c.lockout.team : -1) : (cv?.lockTeam ?? -1);
    const lockLeft = c ? (c.lockout ? c.lockout.endsAt - now : 0) : (cv?.lockLeft ?? 0);
    const me = this.lastLocal;
    return {
      zones: this.zonesNow().map((z, i) => {
        const [id, x, zz] = this.layout.zones[i];
        const w = this.world([Number(x), Number(zz)]);
        return {
          id: String(id),
          owner: z.owner === -1 ? null : z.owner === mine ? "you" : "them",
          v: mine === 0 ? -z.v : z.v,
          bonus: i === bonusZone,
          at: new THREE.Vector3(w.x, 0, w.z),
          here: !!me && Math.hypot(me.x - w.x, me.z - w.z) <= MODES.control.radius,
        };
      }),
      you: Math.floor(sc[mine]),
      them: Math.floor(sc[mine === 0 ? 1 : 0]),
      limit: MODES.control.scoreLimit,
      bonusLeft: bonusLeft !== null ? Math.max(0, bonusLeft) : null,
      lockout: lockTeam >= 0 ? { mine: lockTeam === mine, left: Math.max(0, lockLeft) } : null,
    };
  }

  /** a Control bot's goal: a zone of its team's that is being taken, else the nearest zone not its team's, else the bonus, else the middle */
  private controlGoal(b: ModeBot): THREE.Vector3 | null {
    const c = this.control;
    if (!c) return null;
    const team = b.team;
    const counts = c.counts(this.fighters().map((f) => ({ x: f.x - this.layout.ox, z: f.z - this.layout.oz, team: this.teamFor(f.id), alive: f.alive })));
    const pos = { x: b.bot.pos.x - this.layout.ox, z: b.bot.pos.z - this.layout.oz };
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    c.zones.forEach((z, i) => {
      const threatened = z.owner === team && counts[i][team === 0 ? 1 : 0] > 0;
      const want = threatened || z.owner !== team || (c.bonus?.zone === i && z.owner !== team);
      if (!want) return;
      // spread out: each bot has its own lean toward a zone (its index), threats first
      const d = Math.hypot(z.x - pos.x, z.z - pos.z) - (threatened ? 20 : 0) + ((b.bot.index + i) % 3) * 6;
      if (d < bestD) {
        bestD = d;
        best = { x: z.x, z: z.z };
      }
    });
    if (!best) {
      // everything held: hold the middle zone, a bit off its centre
      const z = c.zones[1];
      best = { x: z.x + (((b.bot.index % 3) - 1) * 2), z: z.z };
    }
    const w = this.world([best.x, best.z]);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  /** the host: the rules' state to every guest */
  private sendMode(now: number): void {
    if (this.role !== "host") return;
    this.modeSendNext = now + MODE_SEND_EVERY;
    if (!this.links.size) return;
    const rows: Array<[number, number, number, number, number]> = [];
    const ids = [this.id, ...[...this.remotes.keys()].filter((id) => id < Duel.BOT_ID), ...this.bots.map((b) => b.bot.remote.id)];
    for (const id of ids) {
      const r = this.ladder.row(id);
      const wins = this.roundWins.get(id) ?? 0;
      rows.push([id, this.modeKind === "crown" ? wins : r.level, r.kills, r.deaths, this.teamFor(id)]);
    }
    const c = this.crown;
    this.broadcast({
      t: "mode",
      left: Math.max(0, this.clockLeft(now) ?? 0),
      rows,
      tm: this.modeKind === "tdm" ? [this.teams.score[0], this.teams.score[1]] : undefined,
      cr: c ? [c.phase === "waiting" ? 0 : c.phase === "ground" ? 1 : 2, c.x, c.z, c.carrier, c.held] : undefined,
      ct: this.control ? this.controlPacket(now) : undefined,
      win: this.winner ?? undefined,
    });
  }

  /** a guest: the host's state */
  protected override onExtra(m: NetMsg, _from: number): void {
    if (m.t !== "mode" || this.role === "host") return;
    const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
    if (!Array.isArray(m.rows) || !fin(m.left)) return;
    const rows = m.rows.filter((r) => Array.isArray(r) && r.length === 5 && r.every(fin));
    this.ladder.set(rows.map(([id, level, kills, deaths]) => ({ id, level: this.modeKind === "crown" ? 0 : level, kills, deaths })));
    if (this.modeKind === "crown") {
      this.roundWins.clear();
      for (const [id, wins] of rows) this.roundWins.set(id, wins);
    }
    for (const [id, , , , team] of rows) this.teamOf.set(id, team === 1 ? 1 : 0);
    if (Array.isArray(m.tm) && m.tm.length === 2 && m.tm.every(fin)) this.teams.score = [m.tm[0], m.tm[1]];
    // Control: v A B C, owners A B C, the two scores, the bonus zone and its time, the lockout's team and time
    if (Array.isArray(m.ct) && m.ct.length === 12 && m.ct.every(fin)) {
      const c = m.ct;
      this.controlView = { v: [c[0], c[1], c[2]], owner: [c[3], c[4], c[5]], score: [c[6], c[7]], bonus: c[8], bonusLeft: c[9], lockTeam: c[10], lockLeft: c[11] };
    } else this.controlView = null;
    if (Array.isArray(m.cr) && m.cr.length === 5 && m.cr.every(fin)) {
      const [ph, x, z, carrier, held] = m.cr;
      this.crownView = { phase: ph === 2 ? "carried" : ph === 1 ? "ground" : "waiting", x, z, carrier, held };
    } else this.crownView = null;
    this.leftSeen = m.left;
    this.leftAt = wallClock();
    this.winner = fin(m.win) ? m.win : null;
    this.syncMyGun();
  }

  /** seconds on the clock: the fight's time, or Crown's wait for the crown */
  private clockLeft(now: number): number | null {
    if (this.role !== "host") return this.leftSeen === null ? null : Math.max(0, this.leftSeen - (now - this.leftAt));
    if (this.modeKind === "crown") return this.crown && this.crown.phase === "waiting" ? this.crown.appearsIn - now : null;
    // (Control's clock is the same as team deathmatch's)
    return Number.isFinite(this.timeEndsAt) ? this.timeEndsAt - now : null;
  }

  // ------------------------------------------------------------ per frame

  override update(local: LocalState): void {
    this.lastLocal = local;
    super.update(local);
    if (this.ended) return;
    const now = wallClock();
    const dt = Math.min(0.1, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    // down in a mode with respawns: back in after the delay
    if (this.respawns && this.phase === "fight" && !this.alive && now >= this.respawnAt) this.respawnMe();
    // Gun Run: health and shields come back 4 s after the last damage
    if (this.modeKind === "gunrun" && this.alive && this.phase === "fight" && now - this.hurtAt >= MODES.gunRun.regenAfter) {
      let heal = MODES.gunRun.regenRate * dt;
      const toShield = Math.min(heal, this.shieldMax - this.shield);
      this.shield += toShield;
      heal -= toShield;
      this.health = Math.min(HEALTH_MAX, this.health + heal);
    }
    // Control: the zones in the arena, in the colour of whoever holds them
    if (this.modeKind === "control") this.drawZones(now);
    // team deathmatch: a team mate's figure is no target for this side's bullets
    if (teamMode(this.modeKind)) for (const r of this.remotes.values()) if (this.friendly(r.id)) this.projectiles.removeDummy(r.avatar);
    // the crown: over its carrier's head, or turning on the floor
    const cv = this.crownState();
    this.crownModel.visible = !!cv && cv.phase !== "waiting" && this.phase === "fight";
    if (cv && this.crownModel.visible) {
      let y = 0.35;
      if (cv.phase === "carried") {
        const f = cv.carrier === this.id ? local : this.figureAt(cv.carrier);
        if (f) {
          this.crownModel.position.set(f.x, f.y + 2.35, f.z);
          y = -1;
        }
      }
      if (y >= 0) this.crownModel.position.set(cv.x, y + 0.15 * Math.sin(now * 2.5), cv.z);
      this.crownModel.rotation.y = now * 1.4;
    }
    // the bots, for this side's figures and plates
    for (const b of this.bots) {
      const s = b.bot.remote.samples;
      s.length = 0;
      s.push({ at: now, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0, ads: 0, act: null });
    }
  }
  private lastFrame = wallClock();

  /** a figure's feet by id (a guest's last state, a bot) */
  private figureAt(id: number): { x: number; y: number; z: number } | null {
    const b = this.bots.find((x) => x.bot.remote.id === id);
    if (b) return b.bot.pos;
    const r = this.remotes.get(id);
    return r ? r.avatar.group.position : null;
  }

  private crownState(): { phase: CrownPhase; x: number; z: number; carrier: number; held: number } | null {
    if (this.role !== "host") return this.crownView;
    const c = this.crown;
    return c ? { phase: c.phase, x: c.x, z: c.z, carrier: c.carrier, held: c.held } : null;
  }

  /** the host: the phases, the rules, the bots */
  protected override tick(now: number, dt: number, local: LocalState): void {
    this.lastLocal = local;
    if (this.phase === "countdown" && now >= this.phaseEndsAt) {
      this.enter("fight", now, 0);
      this.onNotice?.(this.modeKind === "crown" ? "FIGHT  ·  THE CROWN IN 20 S" : "FIGHT");
      if (this.modeKind === "crown") this.crown = new Crown(this.layout.crown.x, this.layout.crown.z, now);
      else if (!Number.isFinite(this.timeEndsAt)) this.timeEndsAt = now + (this.modeKind === "gunrun" ? MODES.gunRun.timeLimit : this.modeKind === "control" ? MODES.control.timeLimit : this.modeKind === "ffa" ? MODES.ffa.timeLimit : MODES.tdm.timeLimit);
      if (this.modeKind === "control" && !this.control) this.control = new Control(now, Math.random, this.layout.zones);
      this.gunsChanged();
      this.sendMode(now);
    } else if (this.phase === "roundEnd" && now >= this.phaseEndsAt) {
      this.round++;
      this.enter("countdown", now, MODES.countdown);
    } else if (this.phase === "matchEnd" && now >= this.phaseEndsAt) {
      // straight into a rematch
      this.ladder.clear();
      this.teams.clear();
      this.roundWins.clear();
      this.control = null;
      this.winner = null;
      this.timeEndsAt = Infinity;
      this.round = 1;
      this.summarised = false;
      this.gunsChanged();
      this.enter("countdown", now, MODES.countdown);
      this.sendMode(now);
    }
    if (this.phase === "fight") this.fight(now, dt, local);
    if (this.links.size && now >= this.botSendNext) this.sendBots(now);
    if (now >= this.modeSendNext) this.sendMode(now);
  }

  /** the host, in the fight: the clock, the crown, the bots' respawns, minds and shots */
  private fight(now: number, dt: number, local: LocalState): void {
    if (now >= this.timeEndsAt) {
      // the clock ran out: the leader, or the team ahead (a draw: nobody)
      if (this.modeKind === "gunrun") {
        const [a, b] = this.ladder.sorted;
        const tie = !!a && !!b && a.level === b.level && a.kills === b.kills && a.deaths === b.deaths;
        this.endMatch(!a || tie ? -1 : a.id, now);
      } else if (this.modeKind === "ffa") {
        // the most kills, the fewest deaths on a tie; level on both is a draw
        const lead = killLeader(this.ladder.sorted.map((r) => ({ id: r.id, kills: r.kills, deaths: r.deaths })));
        this.endMatch(lead ?? -1, now);
      } else {
        const ahead = this.modeKind === "control" && this.control ? this.control.ahead : this.teams.ahead;
        this.endMatch(ahead === null ? -1 : TEAM_WIN(ahead), now);
      }
      return;
    }
    const fighters = this.fighters();
    // Control: the zones, the points, the bonus and the lockout
    if (this.control) {
      const r = this.control.update(now, dt, fighters.map((f) => ({ x: f.x - this.layout.ox, z: f.z - this.layout.oz, team: this.teamFor(f.id), alive: f.alive })));
      const mine = this.teamFor(this.id);
      for (const e of r.events) {
        const [what, zone, team] = e.split(" ");
        if (what === "taken") this.onNotice?.(Number(team) === mine ? `ZONE ${zone} TAKEN` : `ZONE ${zone} LOST`);
        else if (what === "bonus" && zone === undefined) this.onNotice?.(`BONUS: HOLD ZONE ${this.control.zones[this.control.bonus?.zone ?? 0].id} FOR ${MODES.control.bonus.points}`);
        else if (what === "lockout" && zone !== "broken") this.onNotice?.(Number(zone) === mine ? "LOCKOUT: HOLD ALL THREE TO WIN" : "LOCKOUT: RETAKE A ZONE OR LOSE");
        else if (what === "lockout") this.onNotice?.("LOCKOUT BROKEN");
      }
      if (r.events.length) this.sendMode(now);
      if (r.winner !== null) {
        this.endMatch(TEAM_WIN(r.winner), now);
        return;
      }
    }
    if (this.crown) {
      const r = this.crown.update(now, dt, fighters);
      if (r.event === "appears") {
        this.onNotice?.("THE CROWN IS UP  ·  TAKE IT AND HOLD IT");
        this.sendMode(now);
      } else if (r.event === "taken") {
        const c = this.crown.carrier;
        this.onNotice?.(c === this.id ? "YOU HAVE THE CROWN: STAY UP" : `${this.nameOf(c) ?? "SOMEONE"} HAS THE CROWN`);
        this.sendMode(now);
      }
      if (r.winner !== null) {
        this.onNotice?.(r.winner === this.id ? "YOU HELD THE CROWN" : `${this.nameOf(r.winner) ?? "SOMEONE"} HELD THE CROWN`);
        this.roundWon(r.winner, now);
        return;
      }
    }
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    for (const b of this.bots) {
      const bot = b.bot;
      // back in after the delay
      if (!bot.alive && now >= b.respawnAt) {
        b.respawnAt = Infinity;
        bot.respawnAt(this.respawnSpawn(bot.remote.id));
        bot.remote.alive = true;
        b.hurtAt = -Infinity;
        b.vital = bot.dummy.health + bot.dummy.shield;
      }
      // Gun Run's regen, the bots' too
      if (bot.alive) {
        const v = bot.dummy.health + bot.dummy.shield;
        if (v < b.vital - 1e-6) b.hurtAt = now;
        if (this.modeKind === "gunrun" && now - b.hurtAt >= MODES.gunRun.regenAfter) {
          let heal = MODES.gunRun.regenRate * dt;
          const toShield = Math.min(heal, bot.dummy.shieldMax - bot.dummy.shield);
          bot.dummy.shield += toShield;
          heal -= toShield;
          bot.dummy.health = Math.min(HEALTH_MAX, bot.dummy.health + heal);
        }
        b.vital = bot.dummy.health + bot.dummy.shield;
      }
      const wasAlive = bot.alive;
      const sense = bot.alive ? this.sense(b, fighters) : { target: null, targetId: -1, goal: null, canShoot: false };
      const shots = bot.update(now, dt, sense);
      // a frag: drawn here and on the others' screens; the blast comes back through botBlast
      const th = bot.takeThrow();
      if (th) {
        this.onRemoteFx?.("throw", bot.remote.id, th.from, th.vel, throwCode(th.kind));
        this.broadcast({ t: "fx", from: bot.remote.id, k: "throw", a: [th.from.x, th.from.y, th.from.z], b: [th.vel.x, th.vel.y, th.vel.z], n: throwCode(th.kind) });
      }
      // knocked by something that did not come through a hit (this player's melee)
      if (wasAlive && !bot.alive && bot.remote.alive) this.botDown(b, this.id, true);
      if (bot.alive) {
        bot.remote.health = bot.dummy.health;
        bot.remote.shield = bot.dummy.shield;
      }
      if (!shots.length) continue;
      if (feet.distanceTo(shots[0].from) < 80) this.onRemoteShot?.(shots[0].from);
      for (const s of shots) this.onShotFired?.(bot.remote.id, s.from, s.dir, s.weapon);
      if (this.links.size && !shots[0].melee) this.broadcast({ t: "shot", from: bot.remote.id, o: [shots[0].from.x, shots[0].from.y, shots[0].from.z], d: [shots[0].dir.x, shots[0].dir.y, shots[0].dir.z], w: shots[0].weapon });
      this.applyBotShots(b, sense.targetId, shots, now);
      if (this.phase !== "fight") return;
    }
  }

  /** a shot here or a guest's: the bots in earshot may come to look */
  protected override heardShot(at: THREE.Vector3): void {
    if (this.role !== "host") return;
    const now = wallClock();
    for (const b of this.bots) b.bot.hear(at, now);
  }

  /** a bot's frag went off (the host's page drew it): its enemies in reach and in its sight take the damage */
  botBlast(owner: number, at: THREE.Vector3, kind: "frag" | "arcstar"): void {
    if (this.role !== "host" || this.phase !== "fight") return;
    const thrower = this.bots.find((x) => x.bot.remote.id === owner);
    if (!thrower) return;
    const now = wallClock();
    for (const f of this.fighters()) {
      if (!f.alive || f.id === owner || this.sameSide(f.id, owner)) continue;
      const feet = new THREE.Vector3(f.x, f.y, f.z);
      const chest = feet.clone().setY(feet.y + 1.1);
      const dmg = blastDamage(kind, chest.distanceTo(at));
      if (dmg <= 0 || !Throwables.inSight(at, chest)) continue;
      const dist = Math.round(thrower.bot.pos.distanceTo(feet) * 10) / 10;
      if (f.id === this.id) this.takeHit(dmg, owner, false, kind, dist);
      else if (f.id < Duel.BOT_ID) {
        this.links.get(f.id)?.send({ t: "hit", to: f.id, amount: dmg, head: false, from: owner, w: kind, d: dist });
        const r = this.remotes.get(f.id);
        if (r) {
          const toShield = Math.min(r.shield, dmg);
          r.shield -= toShield;
          r.health = Math.max(0, r.health - (dmg - toShield));
        }
      } else {
        const o = this.bots.find((x) => x.bot.remote.id === f.id);
        if (!o || !o.bot.alive) continue;
        o.bot.dummy.hit(now, "body", dmg, 1, 1, feet.clone().setY(feet.y + 1.2));
        o.bot.remote.health = o.bot.dummy.health;
        o.bot.remote.shield = o.bot.dummy.shield;
        if (o.bot.dummy.knocked) this.botDown(o, owner, false);
      }
    }
  }

  /** a bot's shots at its target: this player, a guest (as a hit message), or another bot */
  private applyBotShots(b: ModeBot, targetId: number, shots: ReturnType<Bot["update"]>, now: number): void {
    const bot = b.bot;
    const melee = !!shots[0].melee;
    if (targetId < Duel.BOT_ID) {
      const f = this.fighters().find((x) => x.id === targetId);
      if (!f || !f.alive) return;
      const at = new THREE.Vector3(f.x, f.y, f.z);
      let dealt = 0;
      for (const s of shots) if (melee ? s.from.distanceTo(at.clone().setY(at.y + 1.2)) < 2.1 : hitsBody(s.from, s.dir, at, f.low ? CROUCH_TOP : BODY_TOP)) dealt += s.damage;
      if (dealt <= 0) return;
      const dist = Math.round(bot.pos.distanceTo(at) * 10) / 10;
      if (targetId === this.id) this.takeHit(dealt, bot.remote.id, false, shots[0].weapon, dist);
      else {
        this.links.get(targetId)?.send({ t: "hit", to: targetId, amount: dealt, head: false, from: bot.remote.id, w: shots[0].weapon, d: dist });
        const r = this.remotes.get(targetId);
        if (r) {
          const toShield = Math.min(r.shield, dealt);
          r.shield -= toShield;
          r.health = Math.max(0, r.health - (dealt - toShield));
        }
      }
      return;
    }
    const other = this.bots.find((x) => x.bot.remote.id === targetId);
    if (!other || !other.bot.alive) return;
    for (const s of shots) {
      const hit = melee ? s.from.distanceTo(other.bot.pos.clone().setY(other.bot.pos.y + 1.2)) < 2.1 : hitsBody(s.from, s.dir, other.bot.pos);
      if (!hit) continue;
      other.bot.dummy.hit(now, "body", s.damage, 1, 1, other.bot.pos.clone().setY(other.bot.pos.y + 1.2));
      other.bot.remote.health = other.bot.dummy.health;
      other.bot.remote.shield = other.bot.dummy.shield;
      if (other.bot.dummy.knocked) {
        this.botDown(other, bot.remote.id, melee);
        break;
      }
    }
  }

  /** what a bot sees and where it goes: the nearest enemy in sight; the crown, its carrier, or a roam */
  private sense(b: ModeBot, fighters: Array<{ id: number; x: number; y: number; z: number; alive: boolean }>): BotSense {
    const bot = b.bot;
    const me = bot.remote.id;
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    let best = Infinity;
    for (const f of fighters) {
      if (!f.alive || f.id === me || this.sameSide(f.id, me)) continue;
      const p = new THREE.Vector3(f.x, f.y, f.z);
      const d = bot.pos.distanceTo(p);
      if (d < best && bot.sees(p)) {
        best = d;
        target = p;
        targetId = f.id;
      }
    }
    let goal: THREE.Vector3 | null = null;
    const c = this.crown;
    if (this.modeKind === "control") goal = this.controlGoal(b);
    else if (c && c.phase === "ground") goal = new THREE.Vector3(c.x, 0, c.z);
    else if (c && c.phase === "carried" && c.carrier !== me) goal = new THREE.Vector3(c.x, 0, c.z);
    else if (c && c.carrier === me) {
      const s = this.respawnSpawn(me);
      goal = new THREE.Vector3(s.x, 0, s.z);
    } else {
      // a roam over the spawns and the middle, a new point on arrival
      const pts = [...this.layout.a, ...this.layout.b, ...this.layout.mid];
      const g = this.world(pts[b.goal % pts.length]);
      if (Math.hypot(g.x - bot.pos.x, g.z - bot.pos.z) < 2.5) b.goal = Math.floor(Math.random() * pts.length);
      const n = this.world(pts[b.goal % pts.length]);
      goal = new THREE.Vector3(n.x, 0, n.z);
    }
    return { target, targetId, goal, canShoot: this.phase === "fight" && !this.holdFire };
  }

  /** the bots, to the guests, as state packets */
  private sendBots(now: number): void {
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
        w: bot.knife !== null ? "" : bot.remote.avatarWeapon,
        hp: bot.dummy.health,
        sh: bot.dummy.shield,
        alive: bot.alive,
        op: bot.remote.avatarOp,
        name: bot.remote.name,
        ready: true,
        st: bot.crouching ? 1 : 0,
        sp: bot.alive ? Math.round(bot.diff.speed * 10) : 0,
      });
    }
  }

  /** a guest left: Crown checks who is left, and the crown drops if they had it */
  protected override guestLeft(id: number): void {
    const f = this.fighters().find((x) => x.id === id);
    super.guestLeft(id);
    if (this.ended || this.role !== "host") return;
    this.ladder.remove(id);
    this.roundWins.delete(id);
    if (this.crown?.carrier === id) this.crown.drop(f?.x ?? this.layout.crown.x, f?.z ?? this.layout.crown.z);
    this.checkLastUp(wallClock());
  }

  // ------------------------------------------------------------ the HUD

  override hud(): DuelHud {
    const base = super.hud();
    const now = wallClock();
    const names = (id: number): string => (id === this.id ? this.myName || "YOU" : (this.nameOf(id) ?? `PLAYER ${id + 1}`));
    const aliveOf = (id: number): boolean => (id === this.id ? this.alive : (this.bots.find((b) => b.bot.remote.id === id)?.bot.alive ?? this.remotes.get(id)?.alive ?? false));
    const rows = this.ladder.sorted.map((r) => ({
      name: names(r.id),
      level: r.level,
      kills: r.kills,
      deaths: r.deaths,
      you: r.id === this.id,
      team: this.teamFor(r.id),
      ally: r.id !== this.id && this.sameSide(r.id, this.id),
      alive: aliveOf(r.id),
      wins: this.roundWins.get(r.id) ?? 0,
    }));
    if (this.modeKind === "crown") rows.sort((a, b) => b.wins - a.wins || b.kills - a.kills);
    const myTeam = this.teamFor(this.id);
    if (teamMode(this.modeKind)) rows.sort((a, b) => a.team - b.team || b.kills - a.kills);
    if (this.modeKind === "ffa") rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const winnerName =
      this.winner === null
        ? null
        : this.winner === -1
          ? "NOBODY"
          : this.winner <= -10
            ? this.winner === TEAM_WIN(myTeam)
              ? "YOUR TEAM"
              : "THE OTHER TEAM"
            : this.winner === this.id
              ? "YOU"
              : names(this.winner);
    const won = this.winner === null ? null : this.winner === this.id || (teamMode(this.modeKind) && this.winner === TEAM_WIN(myTeam));
    const mode: ModeHud = {
      kind: this.modeKind,
      title: MODE_TITLE[this.modeKind],
      left: this.clockLeft(now),
      rows,
      respawnIn: this.respawns && !this.alive && this.phase === "fight" && Number.isFinite(this.respawnAt) ? Math.max(0, this.respawnAt - now) : null,
      winner: winnerName,
      won,
    };
    if (this.modeKind === "gunrun") {
      const level = this.ladder.level(this.id);
      const guns = this.ladder.guns;
      const gun = this.ladder.gunFor(this.id);
      const next = level + 1 < guns.length ? guns[level + 1] : level + 1 === guns.length ? null : null;
      mode.gun = { level: level + 1, of: guns.length + 1, name: gun === null ? "THE KNIFE" : weaponName(gun).toUpperCase(), next: gun === null ? null : next === null ? "THE KNIFE" : weaponName(next).toUpperCase(), knife: gun === null };
    } else if (this.modeKind === "tdm") {
      mode.teams = { you: this.teams.score[myTeam], them: this.teams.score[myTeam === 0 ? 1 : 0], limit: this.teams.limit };
    } else if (this.modeKind === "control") {
      mode.control = this.controlHud(now);
    } else if (this.modeKind === "ffa") {
      const me = this.ladder.row(this.id);
      mode.ffa = { you: me.kills, best: Math.max(0, ...rows.filter((r) => !r.you).map((r) => r.kills)), limit: MODES.ffa.scoreLimit };
    } else {
      const cv = this.crownState();
      mode.crown = {
        phase: cv?.phase ?? "waiting",
        carrier: cv && cv.phase === "carried" ? names(cv.carrier) : null,
        mine: !!cv && cv.phase === "carried" && cv.carrier === this.id,
        held: cv?.held ?? 0,
        need: MODES.crown.hold,
        at: this.crownModel.position.clone(),
        wins: this.roundWins.get(this.id) ?? 0,
        roundsToWin: MODES.crown.roundsToWin,
      };
    }
    const decided = this.phase === "roundEnd" || this.phase === "matchEnd";
    return {
      ...base,
      you: this.modeKind === "tdm" ? this.teams.score[myTeam] : this.modeKind === "control" ? Math.floor(this.controlScore()[myTeam]) : this.modeKind === "crown" ? (this.roundWins.get(this.id) ?? 0) : this.modeKind === "ffa" ? this.ladder.row(this.id).kills : this.ladder.level(this.id),
      them: 0,
      youWonRound: decided && this.phase === "roundEnd" ? this.lastWinner === this.id : base.youWonRound,
      youWonMatch: this.phase === "matchEnd" ? won : null,
      players: rows.map((r) => ({ name: r.name, score: this.modeKind === "crown" ? r.wins : this.modeKind === "gunrun" ? r.level : r.kills, alive: r.alive, you: r.you })),
      mode,
    };
  }

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

  /** Crown: out for the round, watch someone still up (a player first, then a bot) */
  override spectateTarget(): Dummy | null {
    if (this.alive || this.phase !== "fight" || this.respawns) return null;
    const human = super.spectateTarget();
    if (human) return human;
    return this.bots.find((b) => b.bot.alive)?.bot.dummy ?? null;
  }

  override leave(): void {
    if (this.ended) return;
    for (const l of this.links.values()) l.close();
    this.hostLink?.close();
    this.dispose();
    this.finish(`You left ${MODE_TITLE[this.modeKind].toLowerCase().replace(/^./, (c) => c.toUpperCase())}.`);
  }

  override dispose(): void {
    for (const b of this.bots) b.bot.dispose();
    this.bots = [];
    for (const z of this.zoneModels) {
      z.root.removeFromParent();
      z.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.zoneModels = [];
    this.crownModel.removeFromParent();
    this.crownModel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    super.dispose();
  }
}

/** the crown: a gold band with points, drawn in code, and a beam so it is seen across the arena */
function makeCrown(): THREE.Group {
  const g = new THREE.Group();
  g.name = "crown";
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc12e, emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 20, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), gold);
    p.position.set(Math.cos(a) * 0.22, 0.13, Math.sin(a) * 0.22);
    g.add(p);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    gem.position.set(Math.cos(a) * 0.23, 0.02, Math.sin(a) * 0.23);
    g.add(gem);
  }
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 10, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  beam.position.y = 5.1;
  g.add(beam);
  g.scale.setScalar(1.3);
  return g;
}
