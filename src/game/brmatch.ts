// Battle royale against bots: you and the bots drop onto OUTSKIRTS (br.ts),
// the ring closes (ring.ts), the last one standing wins.
//
// The bots share the arena bots' brain (bots.ts): walk toward a goal, fight
// what they see, keep a distance, strafe. Here the goal comes from a graph of
// the map's nodes: a bot picks a node, walks to it, picks a linked one, and
// while the ring is closing it heads for the ring's centre instead. Bots
// fight each other as well as you, and the kill feed says who knocked whom.
//
// One life, no rounds: you drop, you fight, you win or you are out, and the
// card says where you placed. Damage from the ring is the ring's; damage
// from a bot's shot is tested against a capsule at the target's feet, yours
// or another bot's.
import * as THREE from "three";
import { Bot, BOT_NAMES, BOT_WEAPONS, DIFFICULTY, DROP_SPEED, hitsBody, type BotSense } from "./bots";
import type { Dummy } from "./dummy";
import type { ProjectileSystem } from "./projectile";
import { Ring, RING_PHASES, type Circle } from "./ring";
import { BR_CENTER, BR_HALF, type BrMap, type Poi } from "./br";
import { HEALTH_MAX, SHIELD_MAX, type DuelHud, type LocalState, type MatchLike, type Remote, type Spawn } from "./duel";
import type { BotDifficulty, MatchSummary } from "./stats";
import type { RoundPhase } from "../net/link";

/** how high the drop starts */
export const DROP_HEIGHT = 90;
/** the card stays this long before the menu comes back */
const END_HOLD = 9;
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
  /** where you finished once you are out (1 = the win) */
  placement: number | null;
  survived: number;
  pois: Array<{ name: string; x: number; z: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

interface BrBot {
  bot: Bot;
  node: number;
  goal: number;
  /** when it was knocked, for the placement order */
  downAt: number;
}

export class BrMatch implements MatchLike {
  readonly kind = "bots" as const;
  readonly players: number;
  phase: RoundPhase = "countdown";
  round = 1;
  health = HEALTH_MAX;
  shield = SHIELD_MAX;
  alive = true;
  private bots: BrBot[] = [];
  private readonly ring: Ring;
  private lastClock: number;
  private startedAt: number;
  private ended = false;
  private kills = 0;
  private damage = 0;
  private shots = 0;
  private hits = 0;
  private myName = "";
  private placement: number | null = null;
  private endAt = Infinity;
  private lastSummary: MatchSummary | null = null;
  private lastHitBy: Bot | null = null;
  readonly poi: Poi;
  readonly spawn: Spawn;
  onRespawn: (() => void) | null = null;
  onHurt: ((amount: number) => void) | null = null;
  onRemoteShot: ((origin: THREE.Vector3) => void) | null = null;
  onEnd: ((reason: string) => void) | null = null;
  onNotice: ((text: string) => void) | null = null;
  onMatchEnd: ((s: MatchSummary) => void) | null = null;
  onFeed: ((text: string, mine: boolean, neutral?: boolean) => void) | null = null;
  streak = 0;

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    private readonly map: BrMap,
    readonly difficulty: BotDifficulty,
    botCount: number,
    rng: () => number = Math.random
  ) {
    const n = Math.max(1, Math.min(BOT_NAMES.length, botCount));
    this.players = n + 1;
    // you drop on a random POI; the bots spread over all five, two or three each
    this.poi = map.pois[Math.floor(rng() * map.pois.length)];
    const d = this.poi.drops[0];
    this.spawn = { x: d.x, z: d.z, yaw: rng() * 360 };
    const diff = DIFFICULTY[difficulty];
    const order = map.pois.slice().sort(() => rng() - 0.5);
    for (let i = 0; i < n; i++) {
      const poi = order[i % order.length];
      const drop = poi.drops[1 + (Math.floor(i / order.length) % (poi.drops.length - 1))];
      const jitter = () => (rng() - 0.5) * 6;
      const spawn = { x: drop.x + jitter(), z: drop.z + jitter(), yaw: rng() * 360 };
      const bot = new Bot(i, scene, projectiles, diff, spawn, 100 + i, BOT_WEAPONS[i % BOT_WEAPONS.length], BOT_NAMES[i % BOT_NAMES.length]);
      bot.remote.name = BOT_NAMES[i % BOT_NAMES.length];
      bot.dropFrom(DROP_HEIGHT * (0.8 + rng() * 0.4));
      const node = this.nearestNode(spawn.x, spawn.z);
      this.bots.push({ bot, node, goal: node, downAt: Infinity });
    }
    this.ring = new Ring({ cx: BR_CENTER.x, cz: BR_CENTER.z, r: BR_HALF * 1.35 }, rng);
    const now = wallClock();
    this.lastClock = now;
    this.startedAt = now;
  }

  get canFire(): boolean {
    return this.phase === "fight" && this.alive;
  }
  get avatars(): Dummy[] {
    return this.bots.map((b) => b.bot.dummy);
  }
  remoteOf(d: Dummy): Remote | null {
    return this.bots.find((b) => b.bot.dummy === d)?.bot.remote ?? null;
  }
  get aliveCount(): number {
    return this.bots.filter((b) => b.bot.alive).length + (this.alive ? 1 : 0);
  }
  get ringState(): Ring {
    return this.ring;
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

  localShot(): void {
    this.shots++;
  }

  /** one of your bullets hit a bot: it is a dummy, so its own hit() already took the damage */
  localHit(r: Remote, amount: number): void {
    if (this.phase !== "fight") return;
    const b = this.bots.find((x) => x.bot.remote === r);
    if (!b) return;
    this.hits++;
    this.damage += amount;
    r.health = b.bot.dummy.health;
    r.shield = b.bot.dummy.shield;
    if (b.bot.dummy.knocked && r.alive) this.botDown(b, this.myName || "YOU", true);
  }

  private botDown(b: BrBot, by: string, mine: boolean): void {
    b.bot.remote.alive = false;
    b.downAt = wallClock();
    if (mine) this.kills++;
    this.onFeed?.(`${by} knocked ${b.bot.remote.name}`, mine, !mine);
    const left = this.aliveCount;
    this.onNotice?.(mine ? `${b.bot.remote.name} DOWN  ·  ${left} LEFT` : `${left} LEFT`);
    if (this.alive && left === 1) this.win();
  }

  private win(): void {
    if (this.phase === "matchEnd") return;
    this.placement = 1;
    this.finishMatch(true);
  }

  private takeHit(amount: number, by: string): void {
    if (!this.alive || this.phase !== "fight") return;
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health = Math.max(0, this.health - (amount - toShield));
    this.onHurt?.(amount);
    if (this.health <= 0) {
      this.alive = false;
      this.placement = this.aliveCount + 1;
      this.onFeed?.(`${by} knocked ${this.myName || "YOU"}`, false);
      this.finishMatch(false);
    }
  }

  private finishMatch(won: boolean): void {
    const now = wallClock();
    this.phase = "matchEnd";
    this.endAt = now + END_HOLD;
    this.lastSummary = {
      won,
      roundsWon: won ? 1 : 0,
      roundsLost: won ? 0 : 1,
      kills: this.kills,
      deaths: won ? 0 : 1,
      damage: this.damage,
      shots: this.shots,
      hits: this.hits,
      placement: this.placement ?? this.players,
      players: this.players,
      survived: now - this.startedAt,
    };
    this.onMatchEnd?.(this.lastSummary);
  }

  update(local: LocalState): void {
    const now = wallClock();
    const dt = Math.max(0, Math.min(0.1, now - this.lastClock));
    this.lastClock = now;
    this.myName = local.name;
    this.lastLocal = local;
    if (this.ended) return;
    const feet = new THREE.Vector3(local.x, local.y, local.z);
    // the drop ends for you when you land: the fight is on from then
    const dropping = local.stance === "air" && now - this.startedAt < 12 && this.phase === "countdown";
    if (this.phase === "countdown" && !dropping) {
      this.phase = "fight";
      this.onNotice?.("LANDED  ·  LAST ONE STANDING WINS");
    }
    if (this.phase === "matchEnd" && now >= this.endAt) {
      this.leave();
      return;
    }

    // the ring: a tick hurts everyone outside it
    const tick = this.ring.update(dt);
    if (tick && this.phase === "fight") {
      if (this.alive && this.ring.outside(local.x, local.z)) this.takeHit(this.ring.damage, "THE RING");
      for (const b of this.bots) {
        if (!b.bot.alive || b.bot.dropping) continue;
        if (this.ring.outside(b.bot.pos.x, b.bot.pos.z)) {
          b.bot.dummy.hit(now, "body", this.ring.damage, 1, 1, b.bot.pos);
          b.bot.remote.health = b.bot.dummy.health;
          b.bot.remote.shield = b.bot.dummy.shield;
          if (b.bot.dummy.knocked) this.botDown(b, "THE RING", false);
        }
      }
    }
    const wall = this.map.ringWall;
    wall.position.set(this.ring.current.cx - BR_CENTER.x, 60, this.ring.current.cz - BR_CENTER.z);
    wall.scale.set(Math.max(0.01, this.ring.current.r), 1, Math.max(0.01, this.ring.current.r));

    // the bots: sense, walk the graph, fight; their shots are tested here
    for (const b of this.bots) {
      const bot = b.bot;
      const wasAlive = bot.alive;
      const sense = bot.alive && !bot.dropping ? this.sense(b, feet) : { target: null, targetId: -1, goal: null, canShoot: false };
      const shots = bot.update(now, dt, sense);
      if (wasAlive && !bot.alive && bot.remote.alive) this.botDown(b, this.myName || "YOU", true);
      if (!shots.length || this.phase !== "fight") continue;
      if (sense.targetId === 0) {
        let dealt = 0;
        for (const s of shots) if (hitsBody(s.from, s.dir, feet)) dealt += s.damage;
        if (dealt > 0) {
          this.lastHitBy = bot;
          this.onRemoteShot?.(shots[0].from);
          this.takeHit(dealt, bot.remote.name);
        }
      } else {
        const other = this.bots.find((x) => x.bot.remote.id === sense.targetId);
        if (!other || !other.bot.alive) continue;
        for (const s of shots) {
          if (!hitsBody(s.from, s.dir, other.bot.pos)) continue;
          other.bot.dummy.hit(now, "body", s.damage, 1, 1, other.bot.pos.clone().setY(other.bot.pos.y + 1.2));
          other.bot.remote.health = other.bot.dummy.health;
          other.bot.remote.shield = other.bot.dummy.shield;
          if (other.bot.dummy.knocked && other.bot.remote.alive) {
            this.botDown(other, bot.remote.name, false);
            break;
          }
        }
      }
      // you hear a bot's gun within earshot
      if (shots.length && feet.distanceTo(shots[0].from) < 80) this.onRemoteShot?.(shots[0].from);
    }
    void this.lastHitBy;
    for (const b of this.bots) {
      const s = b.bot.remote.samples;
      s.length = 0;
      s.push({ at: now, x: b.bot.pos.x, y: b.bot.pos.y, z: b.bot.pos.z, yaw: 0, pitch: 0, crouch: false, stance: "stand", speed: 0 });
    }
  }

  /** what a bot can see and where it should go */
  private sense(b: BrBot, feet: THREE.Vector3): BotSense {
    const bot = b.bot;
    // the nearest enemy in sight: you, or another bot
    let target: THREE.Vector3 | null = null;
    let targetId = -1;
    let best = Infinity;
    if (this.alive && this.phase === "fight") {
      const d = bot.pos.distanceTo(feet);
      if (d < best && bot.sees(feet)) {
        best = d;
        target = feet;
        targetId = 0;
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
    const ring = this.ring;
    const outsideNext = Math.hypot(bot.pos.x - ring.next.cx, bot.pos.z - ring.next.cz) > ring.next.r - 4;
    const hurry = outsideNext && (ring.state === "closing" || ring.timeLeft < 25 || ring.outside(bot.pos.x, bot.pos.z));
    let goal: THREE.Vector3 | null;
    if (hurry) {
      goal = new THREE.Vector3(ring.next.cx, 0, ring.next.cz);
    } else {
      const here = nodes[b.goal];
      if (Math.hypot(here.x - bot.pos.x, here.z - bot.pos.z) < 3) {
        // arrived: a linked node inside the next ring, at random, not straight back
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

  hud(): DuelHud {
    const now = wallClock();
    const r = this.ring;
    const local = this.lastLocal;
    const br: BrHud = {
      alive: this.aliveCount,
      total: this.players,
      kills: this.kills,
      dropping: this.phase === "countdown",
      poi: this.poi.name,
      ring: {
        phase: Math.min(r.phase + 1, RING_PHASES.length),
        phases: RING_PHASES.length,
        closing: r.state === "closing",
        timeLeft: Math.max(0, r.timeLeft),
        current: { ...r.current },
        next: { ...r.next },
        outside: local ? r.outside(local.x, local.z) : false,
        damage: r.damage,
      },
      placement: this.phase === "matchEnd" ? this.placement : null,
      survived: now - this.startedAt,
      pois: this.map.pois.map((p) => ({ name: p.name, x: p.x, z: p.z })),
      bounds: { minX: BR_CENTER.x - BR_HALF, maxX: BR_CENTER.x + BR_HALF, minZ: BR_CENTER.z - BR_HALF, maxZ: BR_CENTER.z + BR_HALF },
    };
    return {
      you: this.kills,
      them: 0,
      round: 1,
      phase: this.phase,
      left: this.phase === "matchEnd" ? Math.max(0, this.endAt - now) : 0,
      ping: null,
      youWonRound: null,
      youWonMatch: this.phase === "matchEnd" ? this.placement === 1 : null,
      zone: { live: false, startsIn: 0, you: 0, them: 0, need: 1 },
      players: [{ name: this.myName || "YOU", score: this.kills, alive: this.alive, you: true }],
      waiting: null,
      summary: this.phase === "matchEnd" && this.lastSummary ? { ...this.lastSummary, streak: this.streak } : null,
      br,
    };
  }

  /** your last position: the HUD reads the ring against it, spectating picks the nearest bot */
  private lastLocal: LocalState | null = null;

  /** out with bots still up: watch the nearest one until the card goes */
  spectateTarget(): Dummy | null {
    if (this.alive) return null;
    let best: BrBot | null = null;
    let bd = Infinity;
    for (const b of this.bots) {
      if (!b.bot.alive || !this.lastLocal) continue;
      const d = Math.hypot(b.bot.pos.x - this.lastLocal.x, b.bot.pos.z - this.lastLocal.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best?.bot.dummy ?? null;
  }

  leave(): void {
    if (this.ended) return;
    this.ended = true;
    const placed = this.placement;
    this.dispose();
    this.onEnd?.(placed === 1 ? "You won the battle royale." : placed ? `You placed #${placed} of ${this.players}.` : "You left the battle royale.");
  }

  dispose(): void {
    for (const b of this.bots) b.bot.dispose();
    this.bots = [];
    this.map.ringWall.scale.set(0.01, 1, 0.01);
  }
}

void DROP_SPEED;
