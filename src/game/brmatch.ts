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
import squadCfg from "../config/squad.json";
import { Throwables, blastDamage, throwCode } from "./throwables";
import { lockedHopupFor } from "./attachments";
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
import { LootField, LOOT, type LootItem, type LootKind, type Rarity } from "./loot";
import { ammoTypeOf } from "./ammo";

/** how high the drop starts */
export const DROP_HEIGHT = 90;
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
  /** jump towers, respawn beacons, care packages, for the maps */
  towers: Array<{ x: number; z: number }>;
  beacons: Array<{ x: number; z: number }>;
  pods: Array<{ x: number; z: number; landed: boolean }>;
  /** the squad mates, for the maps: where, their name, down or out */
  mates: Array<{ x: number; z: number; name: string; downed: boolean; alive: boolean }>;
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
}

/** a care package on its way down, or landed */
interface Pod {
  at: THREE.Vector3;
  landsAt: number;
  obj: THREE.Group;
  landed: boolean;
}

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

  constructor(
    scene: THREE.Scene,
    projectiles: ProjectileSystem,
    private readonly map: BrMap,
    difficulty: BotDifficulty,
    botCount: number,
    opts: { players: number; myId: number; link: Link | null; guestId?: number; poi?: string; abilities?: boolean; seed?: number; start?: "loot" | "loadout" },
    rng: () => number = Math.random
  ) {
    super(scene, projectiles, { players: opts.players, myId: opts.myId, link: opts.link, guestId: opts.guestId, mode: "br", abilities: opts.abilities ?? true });
    this.difficulty = difficulty;
    this.botCount = Math.max(1, Math.min(BOT_NAMES.length, botCount));
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
      this.lootField.generate(opts.seed ?? 1, map.pois.map((p) => ({ x: p.x, z: p.z })), BR_BOUNDS_WORLD);
    }
    if (this.role === "host") {
      // The bots take the OTHER places: where the squad drops is the squad's.
      // Landing beside three of them with no gun was the whole of a match.
      const others = map.pois.filter((p) => p !== this.poi).sort(() => rng() - 0.5);
      const order = others.length ? others : [this.poi];
      const apart = squadCfg.drop.apart;
      for (let i = 0; i < this.botCount; i++) {
        const poi = order[i % order.length];
        const drop = poi.drops[i % poi.drops.length];
        // spread round the drop point, further out the more of them share it
        const ring = Math.floor(i / (order.length * poi.drops.length));
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
        this.bots.push({ bot, node, goal: node, armedAt: Infinity, landed: false });
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
      if (d > 0) this.hurt(d, owner, kind, Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10);
    }
    for (const r of this.remotes.values()) {
      if (r.id >= Duel.BOT_ID || !r.alive) continue;
      const s = r.samples[r.samples.length - 1];
      if (!s) continue;
      const f = new THREE.Vector3(s.x, s.y, s.z);
      const d = hurts(f);
      if (d <= 0) continue;
      const dist = Math.round(thrower.bot.pos.distanceTo(f) * 10) / 10;
      this.links.get(r.id)?.send({ t: "hit", to: r.id, amount: d, head: false, from: owner, w: kind, d: dist });
      const toShield = Math.min(r.shield, d);
      r.shield -= toShield;
      r.health = Math.max(0, r.health - (d - toShield));
    }
    // the other bots
    for (const o of this.bots) {
      if (o === thrower || !o.bot.alive || o.bot.dropping) continue;
      const d = hurts(o.bot.pos);
      if (d <= 0) continue;
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

  // ------------------------------------------------------------ loot

  /** the floor's loot, death boxes and care packages (null when the squad landed with its loadouts) */
  lootField: LootField | null = null;
  readonly startLoot: boolean;
  /** the item you asked for is yours (the host's own, or the host said so) */
  onLootTaken: ((item: LootItem) => void) | null = null;
  private pods: Pod[] = [];
  private podCount = 0;
  private podPhases = new Set<number>();

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

  /** a care package: its pod falls for podFall seconds, then its items land */
  private addPod(at: THREE.Vector3, lands: number): void {
    const obj = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x3a4250, emissive: 0x3fa7e8, emissiveIntensity: 0.35, roughness: 0.5 }));
    shell.position.y = 0.9;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 160, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x3fa7e8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 80;
    obj.add(shell, beam);
    obj.position.set(at.x, 120, at.z);
    this.scene.add(obj);
    this.pods.push({ at: at.clone(), landsAt: wallClock() + lands, obj, landed: false });
    this.onNotice?.("CARE PACKAGE INBOUND");
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

  /** the pods: falling, then landing (the host lays out their items) */
  private updatePods(now: number): void {
    for (const p of this.pods) {
      if (p.landed) continue;
      const left = p.landsAt - now;
      const t = Math.max(0, Math.min(1, 1 - left / LOOT.podFall));
      p.obj.position.y = 120 * (1 - t) + p.at.y * t;
      if (left <= 0) {
        p.landed = true;
        p.obj.position.y = p.at.y;
        if (this.role === "host") this.podItems().forEach((it, i) => this.dropLoot(it, p.at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 1.3, 0, Math.sin(i * 2.1) * 1.3))));
      }
    }
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

  /** where care packages are and will land, for the maps */
  get podSpots(): Array<{ x: number; z: number; landed: boolean }> {
    return this.pods.map((p) => ({ x: p.at.x, z: p.at.z, landed: p.landed }));
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
  override localHit(r: Remote, amount: number, head: boolean, weapon = "", dist: number | null = null): void {
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
      this.onNotice?.("LANDED  ·  LAST SQUAD STANDING WINS");
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
    // a care package inside the next ring as rounds 2, 3 and 4 close
    if (this.lootField && ring.state === "closing" && ring.phase >= 1 && ring.phase <= 3 && !this.podPhases.has(ring.phase)) {
      this.podPhases.add(ring.phase);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * ring.next.r * 0.6;
      const at = new THREE.Vector3(ring.next.cx + Math.cos(a) * r, 0, ring.next.cz + Math.sin(a) * r);
      this.addPod(at, LOOT.podFall);
      this.broadcast({ t: "pod", at: [at.x, at.y, at.z], lands: LOOT.podFall });
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
      towers: this.map.towers,
      beacons: this.map.beacons,
      pods: this.podSpots,
      mates: [...this.remotes.values()]
        .filter((r) => r.id < Duel.BOT_ID && r.samples.length)
        .map((r) => {
          const s = r.samples[r.samples.length - 1];
          return { x: s.x, z: s.z, name: r.name, downed: r.downed, alive: r.alive };
        }),
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
    }
    this.pods = [];
    this.map.ringWall.scale.set(0.01, 1, 0.01);
    super.dispose();
  }
}

export { HEALTH_MAX, SHIELD_MAX };
