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
import * as THREE from "three";
import { Bot, BOT_NAMES, BOT_WEAPONS, DIFFICULTY, hitsBody, type BotSense } from "./bots";
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { Ring, RING_PHASES, RING_TICK, type Circle } from "./ring";
import { BR_CENTER, BR_HALF, type BrMap, type Poi } from "./br";
import { Duel, HEALTH_MAX, SHIELD_MAX, type DuelHud, type LocalState, type Remote, type Spawn } from "./duel";
import type { BotDifficulty } from "./stats";
import type { Link, NetMsg } from "../net/link";

/** how high the drop starts */
export const DROP_HEIGHT = 90;
/** the card stays this long before the menu comes back */
const END_HOLD = 9;
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
}

interface BrBot {
  bot: Bot;
  node: number;
  goal: number;
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
  readonly difficulty: BotDifficulty;
  readonly botCount: number;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    private readonly map: BrMap,
    difficulty: BotDifficulty,
    botCount: number,
    opts: { players: number; myId: number; link: Link | null; guestId?: number; poi?: string },
    rng: () => number = Math.random
  ) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "br" });
    this.difficulty = difficulty;
    this.botCount = Math.max(1, Math.min(BOT_NAMES.length, botCount));
    // the squad drops on one place: the host's pick, told to the guests
    this.poi = (opts.poi && map.pois.find((p) => p.id === opts.poi)) || map.pois[Math.floor(rng() * map.pois.length)];
    const now = wallClock();
    this.startedAt = now;
    this.aliveSeen = this.botCount + this.players;
    const start = { cx: BR_CENTER.x, cz: BR_CENTER.z, r: BR_HALF * 1.35 };
    if (this.role === "host") {
      const diff = DIFFICULTY[difficulty];
      // the bots spread over the other places first, then the squad's
      const others = map.pois.filter((p) => p !== this.poi).sort(() => rng() - 0.5);
      const order = [...others, this.poi];
      for (let i = 0; i < this.botCount; i++) {
        const poi = order[i % order.length];
        const drop = poi.drops[i % poi.drops.length];
        const jitter = () => (rng() - 0.5) * 8;
        const spawn = { x: drop.x + jitter(), z: drop.z + jitter(), yaw: rng() * 360 };
        const bot = new Bot(i, scene, projectiles, diff, spawn, Duel.BOT_ID + i, BOT_WEAPONS[i % BOT_WEAPONS.length], BOT_NAMES[i % BOT_NAMES.length]);
        const node = this.nearestNode(spawn.x, spawn.z);
        this.bots.push({ bot, node, goal: node });
      }
      this.ring = new Ring(start, rng);
      this.view = { phase: 0, state: "waiting", timeLeft: RING_PHASES[0].wait, current: { ...this.ring.current }, next: { ...this.ring.next } };
    } else {
      this.ring = null;
      this.view = { phase: 0, state: "waiting", timeLeft: RING_PHASES[0].wait, current: start, next: start };
    }
  }

  /** your drop spot: one per squad member at the squad's place */
  override get spawn(): Spawn {
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
  private get humansAlive(): number {
    let n = this.alive ? 1 : 0;
    for (const r of this.remotes.values()) if (r.id < Duel.BOT_ID && r.alive) n++;
    return n;
  }
  get ringState(): RingView {
    return this.view;
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
  override localHit(r: Remote, amount: number, head: boolean): void {
    const b = this.bots.find((x) => x.bot.remote === r);
    if (!b) {
      super.localHit(r, amount, head);
      return;
    }
    if (this.phase !== "fight" || !r.alive) return;
    this.hits++;
    this.damage += amount;
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
    const who = by === -1 ? "THE RING" : by === this.id ? this.myName || "YOU" : (this.remotes.get(by)?.name ?? this.bots.find((x) => x.bot.remote.id === by)?.bot.remote.name ?? "SOMEONE");
    this.onFeed?.(`${who} knocked ${r.name}`, mine, !mine);
    this.broadcast({ t: "down", from: r.id, by });
    const left = this.aliveCount;
    this.onNotice?.(mine ? `${r.name} DOWN  ·  ${left} LEFT` : `${left} LEFT`);
    if (this.bots.every((x) => !x.bot.alive) && this.humansAlive > 0) this.endBr(true);
  }

  /** a human went down (any side, this player included): the host decides whether the squad is out */
  protected override onSomeoneDown(_id: number, _by: number): void {
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
  private hurt(amount: number, from: number): void {
    this.takeHit(amount, from);
  }

  // ------------------------------------------------------------ per frame

  /** a guest: the ring and the end, from the host */
  protected override onExtra(m: NetMsg, _from: number): void {
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
    super.update(local);
    if (this.ended) return;
    const now = wallClock();
    if (this.phase === "matchEnd" && now >= this.endAt) {
      this.leave();
      return;
    }
    // the ring wall, from the host's ring or the mirrored one
    const cur = this.view.current;
    const wall = this.map.ringWall;
    wall.position.set(cur.cx - BR_CENTER.x, 60, cur.cz - BR_CENTER.z);
    wall.scale.set(Math.max(0.01, cur.r), 1, Math.max(0.01, cur.r));
    // a guest hurts itself outside the mirrored ring, on its own tick
    if (this.role === "guest" && this.phase === "fight") {
      this.guestTick += Math.min(0.1, now - this.lastClock + 1e-9);
      if (this.guestTick >= RING_TICK) {
        this.guestTick -= RING_TICK;
        if (this.alive && Math.hypot(local.x - cur.cx, local.z - cur.cz) > cur.r) this.hurt(RING_PHASES[Math.min(this.view.phase, RING_PHASES.length - 1)].damage, -1);
      }
    }
    for (const b of this.bots) {
      const s = b.bot.remote.samples;
      s.length = 0;
      s.push({ at: now, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0 });
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
    // the drop ends for the host when it lands: the fight is on from then
    if (this.phase === "countdown" && local.stance !== "air" && now - this.dropAt > 1) {
      this.enter("fight", now, 0);
      this.onNotice?.("LANDED  ·  LAST SQUAD STANDING WINS");
    }
    const feet = new THREE.Vector3(local.x, local.y, local.z);
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
      const shots = bot.update(now, dt, sense);
      if (wasAlive && !bot.alive && bot.remote.alive) this.botDown(b, this.id);
      if (!shots.length || this.phase !== "fight") continue;
      if (shots.length && feet.distanceTo(shots[0].from) < 80) this.onRemoteShot?.(shots[0].from);
      if (sense.targetId < Duel.BOT_ID) {
        const human = humans.find((h) => h.id === sense.targetId);
        if (!human) continue;
        let dealt = 0;
        for (const s of shots) if (hitsBody(s.from, s.dir, human.feet)) dealt += s.damage;
        if (dealt <= 0) continue;
        if (human.id === this.id) this.hurt(dealt, bot.remote.id);
        else {
          // a guest takes it from the hit message; the figure here is predicted lower
          this.links.get(human.id)?.send({ t: "hit", to: human.id, amount: dealt, head: false, from: bot.remote.id });
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
          crouch: false,
          w: bot.remote.avatarWeapon,
          hp: bot.dummy.health,
          sh: bot.dummy.shield,
          alive: bot.alive,
          op: bot.remote.avatarOp,
          name: bot.remote.name,
          ready: true,
          st: bot.dropping ? 3 : 0,
          sp: bot.alive && !bot.dropping ? Math.round(DIFFICULTY[this.difficulty].speed * 10) : 0,
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
      if (o === b || !o.bot.alive || o.bot.dropping) continue;
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
    if (hurry) {
      goal = new THREE.Vector3(ring.next.cx, 0, ring.next.cz);
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
    return { target, targetId, goal, canShoot: this.phase === "fight" };
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
    this.map.ringWall.scale.set(0.01, 1, 0.01);
    super.dispose();
  }
}

export { HEALTH_MAX, SHIELD_MAX };
