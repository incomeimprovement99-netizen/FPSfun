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
//
// Who is on whose side: in team deathmatch the players (the humans) are one
// team, filled out with bots to the team size, against a team of bots. Team
// mates cannot hurt each other and their bullets pass through each other.
// Gun Run and Crown are every player for themselves.
import * as THREE from "three";
import { Bot, BOT_NAMES, BOT_WEAPONS, DIFFICULTY, hitsBody, type BotSense } from "./bots";
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { Duel, HEALTH_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import { ARENA_X, ARENA_Z } from "./arena";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";
import type { ActorState } from "./killcam";
import { HEAL_CODES } from "./recap";
import { Crown, GunLadder, MODES, MODE_TITLE, TeamScore, gunList, pickSpawn, yawToMiddle, type CrownPhase, type ModeKind } from "./modes";
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
  /** bots in a free-for-all (Gun Run, Crown); team deathmatch fills both teams to the team size */
  bots: number;
  difficulty: BotDifficulty;
  /** Gun Run's list */
  list?: "short" | "full";
}

/** arena coordinates to the world */
const world = (p: number[]): { x: number; z: number } => ({ x: p[0] + ARENA_X, z: p[1] + ARENA_Z });

export class ArenaMode extends Duel {
  readonly modeKind: ModeKind;
  readonly difficulty: BotDifficulty;
  readonly list: "short" | "full";
  readonly ladder: GunLadder;
  readonly teams = new TeamScore();
  private bots: ModeBot[] = [];
  /** team by id (team deathmatch); everyone is team 0 on their own otherwise */
  private teamOf = new Map<number, 0 | 1>();
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
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "arena", abilities: opts.abilities });
    this.modeKind = opts.kind;
    this.difficulty = opts.difficulty;
    this.list = opts.list === "full" ? "full" : "short";
    this.ladder = new GunLadder(gunList(this.list));
    const tdm = this.modeKind === "tdm";
    // the humans: team 0 in team deathmatch
    for (let id = 0; id < this.players; id++) this.teamOf.set(id, 0);
    this.crownModel = makeCrown();
    this.crownModel.visible = false;
    scene.add(this.crownModel);
    if (this.role !== "host") return;
    const diff = DIFFICULTY[this.difficulty];
    const size = MODES.tdm.teamSize;
    const allies = tdm ? Math.max(0, size - this.players) : 0;
    const enemies = tdm ? size : Math.max(0, Math.min(MODES.maxBots, opts.bots));
    for (let i = 0; i < allies + enemies; i++) {
      const team: 0 | 1 = tdm && i >= allies ? 1 : 0;
      const id = Duel.BOT_ID + i;
      const gun = this.modeKind === "gunrun" ? this.ladder.guns[0] : BOT_WEAPONS[i % BOT_WEAPONS.length];
      const bot = new Bot(i, scene, projectiles, diff, this.startSpawn(id, team), id, gun, BOT_NAMES[i % BOT_NAMES.length]);
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
    if (this.modeKind !== "tdm" || id < 0) return false;
    const a = this.teamOf.get(this.id);
    const b = this.teamOf.get(id);
    return a !== undefined && a === b;
  }

  private sameSide(a: number, b: number): boolean {
    if (a === b) return true;
    if (this.modeKind !== "tdm") return false;
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
    const S = MODES.spawns;
    let p: number[];
    if (this.modeKind === "tdm") {
      const list = team === 0 ? S.a : S.b;
      const i = id < Duel.BOT_ID ? id : (this.players + (id - Duel.BOT_ID)) % list.length;
      p = list[i % list.length];
    } else {
      const order = [S.a[0], S.b[0], S.mid[0], S.mid[1], S.a[1], S.b[2], S.mid[2], S.mid[3], S.a[2], S.b[1]];
      const i = id < Duel.BOT_ID ? id : this.players + (id - Duel.BOT_ID);
      p = order[i % order.length];
    }
    const w = world(p);
    return { x: w.x, z: w.z, yaw: yawToMiddle(p[0], p[1]) };
  }

  /** a respawn: this side's spawns (a team's end in team deathmatch, anywhere otherwise) farthest from the enemies up */
  private respawnSpawn(id: number): Spawn {
    const S = MODES.spawns;
    const cands = (this.modeKind === "tdm" ? (this.teamFor(id) === 0 ? [...S.a, ...S.mid.slice(0, 2)] : [...S.b, ...S.mid.slice(2, 4)]) : [...S.a, ...S.b, ...S.mid]) as Array<[number, number]>;
    const enemies = this.fighters()
      .filter((f) => f.alive && !this.sameSide(f.id, id))
      .map((f) => ({ x: f.x - ARENA_X, z: f.z - ARENA_Z }));
    const p = pickSpawn(cands, enemies);
    const w = world(p);
    return { x: w.x, z: w.z, yaw: yawToMiddle(p[0], p[1]) };
  }

  override get spawn(): Spawn {
    return this.spawnPick ?? this.startSpawn(this.id, this.teamFor(this.id));
  }

  /** everyone in the fight as the host knows them: this player, the guests where they last were, the bots */
  private fighters(): Array<{ id: number; x: number; z: number; y: number; alive: boolean }> {
    const out: Array<{ id: number; x: number; z: number; y: number; alive: boolean }> = [];
    const me = this.lastLocal;
    if (me) out.push({ id: this.id, x: me.x, y: me.y, z: me.z, alive: this.alive });
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID) continue;
      const s = r.samples[r.samples.length - 1];
      if (s) out.push({ id: r.id, x: s.x, y: s.y, z: s.z, alive: r.alive });
    }
    for (const b of this.bots) out.push({ id: b.bot.remote.id, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, alive: b.bot.alive });
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
    return this.modeKind === "gunrun" ? MODES.gunRun.respawn : MODES.tdm.respawn;
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
    const won = this.winner !== null && (this.winner === this.id || (this.modeKind === "tdm" && this.winner === TEAM_WIN(myTeam)));
    let roundsWon = 0;
    let roundsLost = 0;
    if (this.modeKind === "crown") {
      roundsWon = this.roundWins.get(this.id) ?? 0;
      for (const [id, n] of this.roundWins) if (id !== this.id) roundsLost += n;
    } else if (this.modeKind === "tdm") {
      roundsWon = this.teams.score[myTeam];
      roundsLost = this.teams.score[myTeam === 0 ? 1 : 0];
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
    // team deathmatch: a team mate's figure is no target for this side's bullets
    if (this.modeKind === "tdm") for (const r of this.remotes.values()) if (this.friendly(r.id)) this.projectiles.removeDummy(r.avatar);
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
      if (this.modeKind === "crown") this.crown = new Crown(ARENA_X, ARENA_Z, now);
      else if (!Number.isFinite(this.timeEndsAt)) this.timeEndsAt = now + (this.modeKind === "gunrun" ? MODES.gunRun.timeLimit : MODES.tdm.timeLimit);
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
      if (this.modeKind === "gunrun") this.endMatch(this.ladder.leader?.id ?? -1, now);
      else {
        const ahead = this.teams.ahead;
        this.endMatch(ahead === null ? -1 : TEAM_WIN(ahead), now);
      }
      return;
    }
    const fighters = this.fighters();
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

  /** a bot's shots at its target: this player, a guest (as a hit message), or another bot */
  private applyBotShots(b: ModeBot, targetId: number, shots: ReturnType<Bot["update"]>, now: number): void {
    const bot = b.bot;
    const melee = !!shots[0].melee;
    if (targetId < Duel.BOT_ID) {
      const f = this.fighters().find((x) => x.id === targetId);
      if (!f || !f.alive) return;
      const at = new THREE.Vector3(f.x, f.y, f.z);
      let dealt = 0;
      for (const s of shots) if (melee ? s.from.distanceTo(at.clone().setY(at.y + 1.2)) < 2.1 : hitsBody(s.from, s.dir, at)) dealt += s.damage;
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
    if (c && c.phase === "ground") goal = new THREE.Vector3(c.x, 0, c.z);
    else if (c && c.phase === "carried" && c.carrier !== me) goal = new THREE.Vector3(c.x, 0, c.z);
    else if (c && c.carrier === me) {
      const s = this.respawnSpawn(me);
      goal = new THREE.Vector3(s.x, 0, s.z);
    } else {
      // a roam over the spawns and the middle, a new point on arrival
      const pts = [...MODES.spawns.a, ...MODES.spawns.b, ...MODES.spawns.mid];
      const g = world(pts[b.goal % pts.length]);
      if (Math.hypot(g.x - bot.pos.x, g.z - bot.pos.z) < 2.5) b.goal = Math.floor(Math.random() * pts.length);
      const n = world(pts[b.goal % pts.length]);
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
        crouch: false,
        w: bot.knife !== null ? "" : bot.remote.avatarWeapon,
        hp: bot.dummy.health,
        sh: bot.dummy.shield,
        alive: bot.alive,
        op: bot.remote.avatarOp,
        name: bot.remote.name,
        ready: true,
        st: 0,
        sp: bot.alive ? Math.round(DIFFICULTY[this.difficulty].speed * 10) : 0,
      });
    }
  }

  /** a guest left: Crown checks who is left, and the crown drops if they had it */
  protected override guestLeft(id: number): void {
    const f = this.fighters().find((x) => x.id === id);
    super.guestLeft(id);
    if (this.ended || this.role !== "host") return;
    if (this.crown?.carrier === id) this.crown.drop(f?.x ?? ARENA_X, f?.z ?? ARENA_Z);
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
    const won = this.winner === null ? null : this.winner === this.id || (this.modeKind === "tdm" && this.winner === TEAM_WIN(myTeam));
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
      you: this.modeKind === "tdm" ? this.teams.score[myTeam] : this.modeKind === "crown" ? (this.roundWins.get(this.id) ?? 0) : this.ladder.level(this.id),
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
    this.crownModel.removeFromParent();
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
