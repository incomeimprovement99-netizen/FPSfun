// The battle royale from the player's side: what E does where you stand (take
// the item the prompt names, hold it to empty a loot spot, to revive a downed
// squad mate or to bring one back at a respawn beacon, ride a jump tower), the
// launch pads on the roads, and pings (the middle mouse button: an enemy, an
// item, or a place, shown to the squad).
//
// Looting used to be one item a press at whatever happened to be nearest the
// crosshair, so a landing was dozens of presses with your head down and a
// death box of eight things was eight aims. Three habits from Apex, Warzone
// and The Finals fix that, and they all live here:
//
//   walk over it   ammo for a gun you carry and the small heals you have room
//                  for come up with no press at all, inside a small sweep
//   hold the key   past a short delay the spot empties itself, one item on a
//                  cadence, skipping anything there is nothing to gain from
//   the reach list what is at your feet is listed, nearest first, and you can
//                  step the list rather than trust whatever is closest
import * as THREE from "three";
import type { BrMatch } from "./brmatch";
import type { Dummy } from "./dummy";
import type { Action } from "./input";
import type { MoveInput, Player } from "./player";
import { solidHit } from "./projectile";
import { BINS, lootLabel, type LootItem, type LootDrop, type Rarity } from "./loot";
import { DROP_HEIGHT } from "./brmatch";
import squad from "../config/squad.json";
import hudCfg from "../config/hud.json";
import { CONSOLE } from "./ringconsole";

export interface Marker {
  k: "enemy" | "loot" | "go";
  at: THREE.Vector3;
  label: string;
  from: number;
  until: number;
  /** a figure it follows (an enemy ping), or -1 */
  target: number;
}

/** one thing lying within reach of your feet, as the prompt's list shows it */
export interface ReachRow {
  key: number;
  label: string;
  rarity: Rarity;
  /** how far away it is, flat, in metres */
  dist: number;
  /**
   * Nothing to gain from it: ammo neither of your guns takes, a heal your kit
   * is already full of, a magazine no better than the one on your gun. Drawn
   * grey, and the hold steps over it rather than filling your hands with it.
   */
  dim: boolean;
}

/** the frame's reach list: the rows, the one the prompt points at, and what steps the list */
export interface ReachHud {
  rows: ReachRow[];
  /** the highlighted row's key, or -1 when there is nothing in reach */
  pick: number;
  /** the key that steps the list, shown only when there is more than one row */
  cycleKey: string;
}

/**
 * What you carry, which the walk-over pickup and the grey-out both need:
 * which ammo types your guns take, how many more of each heal your kit has
 * room for, and the magazine level you already have. BrPlay asks for it once
 * a frame and simply does neither of those two things without it, so the
 * press-to-take path never depends on it being wired up.
 */
export interface CarryState {
  /** the ammo types your guns take ("light", "heavy", "sniper", "shotgun", "energy") */
  ammo: string[];
  /** how many more of each heal fit in the kit, by its id; 0 or missing is full */
  healRoom: Record<string, number>;
  /** how many more rounds of each ammo type fit, by type; missing is no limit */
  ammoRoom?: Record<string, number>;
  /**
   * The magazine to measure a looted one against, 0 to 4: the LOWER of your
   * two guns' levels, because main.ts's applyLoot offers a magazine to both
   * slots (Loadout.fitMag) and keeps it if either takes it. The higher one
   * would grey out a magazine that is an upgrade for your other gun.
   */
  mag?: number;
}

/** an item as the reach list needs it: no THREE objects, so a tool can build one */
export interface ReachDrop {
  key: number;
  item: LootItem;
  pos: { x: number; y: number; z: number };
}

export interface BrPlayHud {
  prompt: { key: string; text: string } | null;
  hold: { label: string; progress: number } | null;
  markers: Array<{ k: Marker["k"]; at: THREE.Vector3; label: string; mine: boolean }>;
  banner: { name: string; left: number } | null;
  /** what lies at your feet this frame, for the HUD's list */
  reach: ReachHud;
}

/**
 * The frame's reach list, published here for the HUD to read straight
 * (src/game/hud.ts). It does not travel through main.ts's HudState like the
 * rest of the HUD does because the list is worked out here, changes nowhere
 * else, and is only ever read: one live object beats a field threaded through
 * two files for the same result. BrPlay rewrites it every frame and empties it
 * when the match ends, so it is never stale.
 */
export const REACH: ReachHud = { rows: [], pick: -1, cycleKey: "" };

/** looting: the walk-over sweep, the hold that empties a spot, the reach list (src/config/hud.json) */
const LOOTING = hudCfg.loot;
/** the action that steps the reach list, named in the config */
const CYCLE = LOOTING.cycle as Action;

/**
 * Would walking over this pick it up, with no press at all? Ammo for a gun
 * you actually carry, and the small heals you have room for: refills, the
 * things you would take every single time. A gun, an attachment or a helmet
 * is a choice, so those still wait for the key.
 *
 * A heal is only swept when the whole stack fits. Taking half of one puts the
 * remainder back down at your feet (src/main.ts applyLoot), and a remainder
 * lying inside the sweep is picked at once and put back again: better to
 * leave the stack alone and let the player press for it.
 */
export function autoTakes(item: LootItem, carry: CarryState | null): boolean {
  if (!carry) return false;
  if (!(LOOTING.autoKinds as string[]).includes(item.kind)) return false;
  // ammo as heals: swept only when the whole stack fits (see above)
  if (item.kind === "ammo") return carry.ammo.includes(item.id) && (carry.ammoRoom?.[item.id] ?? Infinity) >= item.n;
  if (item.kind === "heal") return (LOOTING.autoHeals as string[]).includes(item.id) && (carry.healRoom[item.id] ?? 0) >= item.n;
  return false;
}

/** nothing to gain from this one: it is listed, but greyed, and the hold steps over it */
export function nothingToGain(item: LootItem, carry: CarryState | null): boolean {
  if (!carry) return false;
  if (item.kind === "ammo") return !carry.ammo.includes(item.id) || (carry.ammoRoom?.[item.id] ?? Infinity) <= 0;
  if (item.kind === "heal") return (carry.healRoom[item.id] ?? 0) <= 0;
  if (item.kind === "attach" && item.id.startsWith("mag:")) return Number(item.id.slice(4)) <= (carry.mag ?? 0);
  return false;
}

/**
 * Everything lying within reach of your feet, nearest first, at most
 * `listMax` rows. Death boxes are the box itself rather than a thing to take,
 * and anything a floor above or below you is out of reach however close it is
 * on the map. Equal distances go to the lower key, so the list holds still
 * under the cursor instead of shuffling while you stand there.
 */
export function reachRows(drops: Iterable<ReachDrop>, at: { x: number; y: number; z: number }, carry: CarryState | null, ours: (owner: number) => boolean = () => true): ReachRow[] {
  const rows: ReachRow[] = [];
  for (const d of drops) {
    if (d.item.kind === "box" || d.item.kind === "bin") continue;
    // another squad's banner is not yours to carry (squads of friends)
    if (d.item.kind === "banner" && d.item.owner !== undefined && !ours(d.item.owner)) continue;
    if (Math.abs(d.pos.y - at.y) > LOOTING.floorGap) continue;
    const dist = Math.hypot(d.pos.x - at.x, d.pos.z - at.z);
    if (dist > LOOTING.reach) continue;
    rows.push({ key: d.key, label: lootLabel(d.item), rarity: d.item.rarity, dist, dim: nothingToGain(d.item, carry) });
  }
  rows.sort((a, b) => a.dist - b.dist || a.key - b.key);
  return rows.slice(0, LOOTING.listMax);
}

/**
 * When the hold takes its items: the first one at `startAfter` after the key
 * went down, the rest one `cadence` apart. Given the moment the key went down
 * and the moment the last item came up, this says whether the next one is due.
 */
export function holdDue(now: number, downAt: number, lastAt: number): boolean {
  return now - downAt >= LOOTING.startAfter && now - lastAt >= LOOTING.cadence;
}

interface Deps {
  keyLabel: (a: Action) => string;
  notice: (text: string) => void;
  sound: (kind: "ping" | "tower" | "pad" | "revive") => void;
  /** an enemy ping, yours or a squad mate's: someone says so (announcer.ts) */
  onEnemyPing?: () => void;
  /** a revive of yours finished (EVO) */
  onRevive?: () => void;
  /** a Deathbox Respawn's beam: on at a place, or off */
  beam?: (at: THREE.Vector3 | null) => void;
  /** a Ring Console scan of yours finished (EVO) */
  onScan?: () => void;
}

/** seconds to hold for a revive and a beacon (Season 30), a banner's life, the pads (src/config/squad.json) */
const REVIVE_TIME = squad.reviveTime;
const REVIVE_CONFIRM = squad.reviveConfirm;
const BOX = squad.boxRespawn;
const BEACON_TIME = squad.beaconTime;
const BANNER_LIFE = squad.bannerLife;
const PAD_SPEED = squad.pad.speed;
const PAD_UP = squad.pad.up;

/**
 * The ping wheel (src/config/squad.json `pingWheel`). A tap marks what you are
 * looking at; holding the key opens this, and what you pick says what the mark
 * MEANS. Apex's wheel is the reason a squad without voice is legible: "going
 * here" and "defending here" are different plans, and a mark that says only
 * "here" is neither. The order is the wheel's, clockwise from the top.
 */
export const PING_INTENTS: ReadonlyArray<{ id: "go" | "defend" | "attack" | "ammo" | "watch" | "enemy"; label: string; marker: "enemy" | "loot" | "go" }> = [
  { id: "go", label: "GOING HERE", marker: "go" },
  { id: "attack", label: "ATTACKING HERE", marker: "go" },
  { id: "watch", label: "WATCHING HERE", marker: "go" },
  { id: "enemy", label: "ENEMY HERE", marker: "enemy" },
  { id: "ammo", label: "NEED AMMO", marker: "loot" },
  { id: "defend", label: "DEFENDING HERE", marker: "go" },
];

/** the slice of the wheel a direction points at (the same maths as the emote and heal wheels) */
export function pingPickAt(dx: number, dy: number, deadzone = 40): number | null {
  if (Math.hypot(dx, dy) <= deadzone) return null;
  const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / ((Math.PI * 2) / PING_INTENTS.length)) % PING_INTENTS.length;
}

export class BrPlay {
  markers: Marker[] = [];
  /** a squad mate's banner you carry to a beacon */
  carried: { owner: number; name: string; until: number } | null = null;
  /**
   * A revive you finished, waiting for the one you revived to say they are
   * up: the credit (the notice, the sound, the EVO) is given then, and not if
   * they are out instead or say nothing for revive.confirm seconds. It was
   * given the moment the hold ended, even to a revive that never happened (plan
   * section 12, item 5).
   */
  private revived: { id: number; name: string; at: number } | null = null;
  private hold: { kind: "revive" | "beacon" | "box" | "console" | "bin"; target: number; label: string; start: number; need: number; filled: number; last: number } | null = null;
  /** what the player is holding interact on, for their figure: a revive, something else, or nothing */
  get holdKind(): "revive" | "interact" | null {
    return this.hold ? (this.hold.kind === "revive" ? "revive" : "interact") : null;
  }
  /** interact went down at a squad mate's banner, and when (a tap takes it, a hold respawns them) */
  private eDownAt: number | null = null;
  private padAt = -Infinity;
  /** what the frame's prompt and hold are */
  private out: BrPlayHud = { prompt: null, hold: null, markers: [], banner: null, reach: { rows: [], pick: -1, cycleKey: "" } };
  /**
   * What you carry, asked once a frame. The walk-over pickup and the grey-out
   * both need it and both stay off until something sets it, so main.ts wires
   * it once the loadout and the kit exist:
   *
   *   const held = loadout.slots.filter((s) => !s.empty);
   *   brPlay.carrying = () => ({
   *     ammo: held.map((s) => ammoTypeOf(s.id)),                    // src/game/ammo.ts
   *     healRoom: Object.fromEntries(HEAL_ORDER.map((h) => [h, HEALS[h].stack - kit.items[h]])),
   *     mag: held.length ? Math.min(...held.map((s) => s.magLevel)) : 0,
   *   });
   */
  carrying: (() => CarryState | null) | null = null;
  /** the row you stepped to with the cycle key, while it is still in reach */
  private picked: number | null = null;
  /** the interact key went down at a spot, and when the last item came up */
  private takeDownAt: number | null = null;
  private lastTakeAt = -Infinity;
  /**
   * The last gun taken, and the highest loot key there was at that moment.
   * Taking a gun with both slots full puts the one in hand down at your feet,
   * where it is in reach and nearest, so a press read over a few frames took
   * it straight back and the two guns swapped every frame. A gun with a key
   * above the floor is one that appeared after the take, and it is left out
   * of the list until LOOTING.swapGuard has passed.
   */
  private gunTakenAt = -Infinity;
  private gunKeyFloor = Infinity;
  /**
   * Where you stood when you took it. main.ts puts a swapped-out gun down at
   * exactly your feet, so only a new gun there is the one you let go of. The
   * first version guarded every new gun in reach, and hid a gun somebody else
   * put down a step away half a second after you took yours.
   */
  private gunTakenFrom = { x: 0, z: 0 };
  /** items already asked of the host, and when: a guest must not ask twice a frame while the answer is in flight */
  private asked = new Map<number, number>();

  constructor(private deps: Deps) {}

  reset(): void {
    this.markers = [];
    this.carried = null;
    this.hold = null;
    this.stopTaking();
    this.asked.clear();
    this.publish({ rows: [], pick: -1, cycleKey: "" });
  }

  /** the hold at a spot is over: the next press starts a fresh one */
  private stopTaking(): void {
    this.takeDownAt = null;
    this.picked = null;
  }

  /** the frame's reach list, where the HUD reads it */
  private publish(r: ReachHud): void {
    REACH.rows = r.rows;
    REACH.pick = r.pick;
    REACH.cycleKey = r.cycleKey;
  }

  /**
   * Ask for an item, at most once every `askAgain` seconds. The host takes
   * its own at once, but a guest's take is a question to the host and the
   * item stays on the floor until the answer lands, so without this the sweep
   * would ask for the same stack on every frame of the round trip.
   */
  private take(match: BrMatch, key: number, now: number): boolean {
    if (this.inFlight(key, now)) return false;
    if (this.asked.size > 32) for (const [k, t] of this.asked) if (now - t >= LOOTING.askAgain) this.asked.delete(k);
    this.asked.set(key, now);
    match.takeLoot(key);
    return true;
  }

  /** asked for already, with the answer still on its way: ask for something else instead */
  private inFlight(key: number, now: number): boolean {
    const asked = this.asked.get(key);
    return asked !== undefined && now - asked < LOOTING.askAgain;
  }

  /** a banner picked up */
  carry(item: LootItem, now: number): void {
    if (item.owner === undefined) return;
    this.carried = { owner: item.owner, name: item.ownerName ?? "A SQUAD MATE", until: now + BANNER_LIFE };
    this.deps.notice(`${this.carried.name}'S BANNER: TAKE IT TO A RESPAWN BEACON`);
  }

  /** a ping arrived from the squad, or is yours */
  addMarker(k: string, at: THREE.Vector3, label: string, from: number, target: number, now: number): void {
    const kind = k === "enemy" || k === "loot" ? k : "go";
    // one ping each at a time: a new one replaces your last
    this.markers = this.markers.filter((m) => m.from !== from || m.k !== kind);
    // an "enemy here" right after a place ping is the double tap: it replaces that place ping (on every screen)
    if (kind === "enemy" && target === -1) this.markers = this.markers.filter((m) => !(m.from === from && m.k === "go" && m.until - squad.pingLife.go > now - 0.6));
    // an intent's own life when the wheel chose one (its label says which),
    // else the kind's: a plan outlives a warning (src/config/squad.json)
    const intent = PING_INTENTS.find((x) => x.label === label);
    const life = intent ? (squad.pingWheel.life as Record<string, number>)[intent.id] : squad.pingLife[kind];
    this.markers.push({ k: kind, at: at.clone(), label, from, until: now + life, target });
    this.deps.sound("ping");
    if (kind === "enemy") this.deps.onEnemyPing?.();
  }

  /** an enemy ping where you look (the double tap): "ENEMY HERE", whatever is there */
  pingEnemy(match: BrMatch, eye: THREE.Vector3, fwd: THREE.Vector3, now: number, myId: number): void {
    const wall = solidHit(eye, fwd, 300);
    const ground = fwd.y < -1e-3 ? eye.y / -fwd.y : Infinity;
    const t = Math.min(wall, ground, 300);
    const at = eye.clone().addScaledVector(fwd, Number.isFinite(t) ? t : 60);
    this.addMarker("enemy", at, "ENEMY HERE", myId, -1, now);
    match.sendMark("enemy", at, "ENEMY HERE");
  }

  /**
   * A ping with a meaning, from the wheel: the same place a plain ping would
   * mark, said as what you mean by it. An "enemy here" still marks the figure
   * under the crosshair when there is one, because that is the mark a squad
   * acts on fastest.
   */
  pingIntent(match: BrMatch, eye: THREE.Vector3, fwd: THREE.Vector3, now: number, myId: number, which: number): string {
    const it = PING_INTENTS[((which % PING_INTENTS.length) + PING_INTENTS.length) % PING_INTENTS.length];
    if (it.id === "enemy") {
      this.pingEnemy(match, eye, fwd, now, myId);
      return it.label;
    }
    const wall = solidHit(eye, fwd, 300);
    const at = eye.clone().addScaledVector(fwd, Math.min(wall, 300));
    this.addMarker(it.marker, at, it.label, myId, -1, now);
    match.sendMark(it.marker, at, it.label);
    return it.label;
  }

  /**
   * A ping where you look: a figure under the crosshair is an enemy, an item
   * near the line is loot, else the ground or wall you are looking at.
   */
  ping(match: BrMatch, eye: THREE.Vector3, fwd: THREE.Vector3, now: number, myId: number): "enemy" | "loot" | "go" {
    // a figure within 2 degrees of the line and in sight
    let best: { d: Dummy; dist: number } | null = null;
    for (const a of match.avatars) {
      if (!a.group.visible || a.knocked) continue;
      const r = match.remoteOf(a);
      if (!r || r.id < 100) continue;
      const to = a.group.position.clone().setY(a.group.position.y + 1.2).sub(eye);
      const dist = to.length();
      if (dist > 200) continue;
      if (to.dot(fwd) / dist < Math.cos((2.5 * Math.PI) / 180)) continue;
      if (solidHit(eye, to.clone().divideScalar(dist), dist) < dist) continue;
      if (!best || dist < best.dist) best = { d: a, dist };
    }
    if (best) {
      const r = match.remoteOf(best.d)!;
      const at = best.d.group.position.clone();
      this.addMarker("enemy", at, `ENEMY: ${r.name}`, myId, r.id, now);
      match.sendMark("enemy", at, `ENEMY: ${r.name}`, r.id);
      return "enemy";
    }
    const drop = match.lootField?.nearest(eye, fwd, 40);
    if (drop) {
      const label = `LOOT: ${lootLabel(drop.item)}`;
      this.addMarker("loot", drop.pos, label, myId, -1, now);
      match.sendMark("loot", drop.pos, label);
      return "loot";
    }
    const wall = solidHit(eye, fwd, 300);
    const ground = fwd.y < -1e-3 ? eye.y / -fwd.y : Infinity;
    const t = Math.min(wall, ground, 300);
    const at = eye.clone().addScaledVector(fwd, Number.isFinite(t) ? t : 60);
    this.addMarker("go", at, "GOING HERE", myId, -1, now);
    match.sendMark("go", at, "GOING HERE");
    return "go";
  }

  /**
   * One frame: the launch pads, the walk-over sweep, then what E would do
   * here, in order: a revive, a beacon with a banner, a jump tower, an item.
   * Returns the prompt, any hold in progress and the reach list for the HUD.
   */
  update(
    now: number,
    match: BrMatch,
    player: Player,
    input: MoveInput,
    eye: THREE.Vector3,
    fwd: THREE.Vector3,
    ctx: { alive: boolean; downed: boolean; playing: boolean; myId: number }
  ): BrPlayHud {
    const out: BrPlayHud = { prompt: null, hold: null, markers: [], banner: null, reach: { rows: [], pick: -1, cycleKey: "" } };
    // a revive you finished: credited once they say they are up
    if (this.revived) {
      const up = match.memberStanding(this.revived.id);
      if (up) {
        this.deps.notice(`${this.revived.name} IS BACK UP`);
        this.deps.sound("revive");
        this.deps.onRevive?.();
        this.revived = null;
      } else if (up === null || !match.memberAlive(this.revived.id) || now - this.revived.at > REVIVE_CONFIRM) this.revived = null;
    }
    this.markers = this.markers.filter((m) => now < m.until);
    for (const m of this.markers) {
      // an enemy ping follows its figure
      if (m.target >= 0) {
        const a = match.avatars.find((x) => match.remoteOf(x)?.id === m.target);
        if (a) m.at.copy(a.group.position);
      }
      out.markers.push({ k: m.k, at: m.at.clone().setY(m.at.y + (m.k === "enemy" ? 2.2 : 0.4)), label: m.label, mine: m.from === ctx.myId });
    }
    if (this.carried && now >= this.carried.until) {
      this.deps.notice(`${this.carried.name}'S BANNER HAS EXPIRED`);
      this.carried = null;
    }
    if (this.carried) out.banner = { name: this.carried.name, left: this.carried.until - now };
    if (!ctx.alive || !ctx.playing) {
      this.cancelHold(match);
      this.stopTaking();
      this.publish(out.reach);
      this.out = out;
      return out;
    }
    const p = player.pos;
    // launch pads: step on one and be thrown along the road and up
    if (!ctx.downed && player.onGround && now - this.padAt > 1) {
      for (const pad of match.mapInfo.pads) {
        if (Math.hypot(p.x - pad.x, p.z - pad.z) < squad.pad.reach && p.y < 0.5) {
          this.padAt = now;
          player.impulse(pad.dx * PAD_SPEED, PAD_UP, pad.dz * PAD_SPEED);
          this.deps.sound("pad");
          break;
        }
      }
    }
    if (ctx.downed) {
      this.cancelHold(match);
      this.stopTaking();
      this.publish(out.reach);
      this.out = out;
      return out;
    }
    const carry = this.carrying?.() ?? null;
    // walk over it: the refills come up on their own, which is what turns a
    // landing from dozens of presses into running through the rooms
    // The keys first, the taking after: on the host a take runs main.ts's
    // applyLoot then and there, and a heal that does not all fit is put back
    // at your feet (dropLoot), which adds to the very map this walks. A Map
    // hands out entries added while it is being iterated, so taking inside
    // the loop would meet that remainder, weigh it against the same
    // frame-old carry, take it, put it back, and never leave the loop.
    if (carry && match.lootField) {
      // Never out of a death box. The box's things lie spread round it, and a
      // squad mate standing on it to bring the owner back (a Deathbox
      // Respawn) swept up the ammo and heals the owner was meant to get back,
      // so they came back with nothing. A box is opened on purpose, with the
      // key, like everywhere else in the genre.
      const boxes: Array<{ x: number; z: number }> = [];
      for (const d of match.lootField.drops.values()) if (d.item.kind === "box") boxes.push({ x: d.pos.x, z: d.pos.z });
      const sweep: number[] = [];
      for (const d of match.lootField.drops.values()) {
        if (Math.abs(d.pos.y - p.y) > LOOTING.floorGap) continue;
        if (Math.hypot(d.pos.x - p.x, d.pos.z - p.z) > LOOTING.sweep) continue;
        if (boxes.some((b) => Math.hypot(d.pos.x - b.x, d.pos.z - b.z) < LOOTING.boxClear)) continue;
        if (autoTakes(d.item, carry)) sweep.push(d.key);
      }
      for (const k of sweep) this.take(match, k, now);
    }
    const key = this.deps.keyLabel("interact");
    const holdingE = input.held("interact");
    // a revive: a downed squad mate within reach
    const mate = match.downedMateNear(p, squad.reviveReach);
    const boxDrop = mate ? null : this.boxHere(match, p, eye, fwd, now);
    if (!boxDrop) this.eDownAt = null;
    // a beacon, carrying a banner
    const beacon = this.carried ? match.mapInfo.beacons.find((b) => Math.hypot(p.x - b.x, p.z - b.z) < squad.beaconReach) : undefined;
    // a Ring Console at your feet
    const rc = player.onGround ? match.consoleNear(p, CONSOLE.reach) : null;
    // a closed supply bin within reach, on your floor, and nothing solid between you and it: a bin just
    // inside the vault was offered through its locked door (the release run's vault checks, on a seed
    // that stood one by the door). The line may stop at the bin's own box, 0.6 m short of its middle.
    const clearTo = (at: THREE.Vector3): boolean => {
      const dir = new THREE.Vector3(at.x - eye.x, at.y + 0.4 - eye.y, at.z - eye.z);
      const len = dir.length();
      return len < 0.6 || solidHit(eye, dir.divideScalar(len), len) >= len - 0.6;
    };
    const bin = player.onGround && match.lootField ? [...match.lootField.drops.values()].find((d) => d.item.kind === "bin" && d.item.id === "closed" && Math.hypot(d.pos.x - p.x, d.pos.z - p.z) < LOOTING.reach && Math.abs(d.pos.y - p.y) < LOOTING.floorGap && clearTo(d.pos)) : undefined;
    if (mate) {
      out.prompt = { key: `HOLD ${key}`, text: `REVIVE ${mate.name}` };
      this.runHold("revive", mate.id, `REVIVING ${mate.name}`, REVIVE_TIME, holdingE, now, match, () => {
        match.sendRevive(mate.id, "done");
        this.revived = { id: mate.id, name: mate.name, at: now };
      });
    } else if (boxDrop) {
      // a dead squad mate's death box: a tap takes the banner, a hold of 7 s respawns them on it
      const d = boxDrop;
      const owner = d.item.owner!;
      const name = d.item.ownerName ?? "A SQUAD MATE";
      const lock = match.boxLockout(owner);
      // SpeedKills: this box is the ghost's echo; the restore is quicker with the ghost beside you
      const sk = match.decay ? match.ghostNear(owner, p) : null;
      const need = sk ? sk.need : BOX.time;
      const rate = sk ? sk.rate : 1;
      out.prompt = !Number.isFinite(lock)
        ? { key, text: `${name} HAS NO RESTORES LEFT` }
        : lock > 0
          ? { key, text: `TAKE ${name}'S BANNER  ·  RESPAWN HERE IN ${Math.ceil(lock)} S` }
          : sk
            ? { key: `HOLD ${key}`, text: `RESTORE ${name}${sk.near ? "  ·  THEIR GHOST IS WITH YOU" : "  ·  THEIR GHOST IS AWAY: 3X SLOWER"}` }
            : { key: `${key} / HOLD`, text: `TAKE ${name}'S BANNER  ·  HOLD: RESPAWN ${name} HERE` };
      if (holdingE) {
        if (this.eDownAt === null) this.eDownAt = now;
        if (lock <= 0 && now - this.eDownAt >= BOX.tapTime) {
          const at = d.pos.clone();
          const fresh = !this.hold || this.hold.kind !== "box";
          this.runHold("box", owner, sk ? `RESTORING ${name}${sk.near ? "" : "  ·  GHOST AWAY"}` : `RESPAWNING ${name}`, need, true, now, match, () => {
            match.sendRespawn(owner, at, true);
            this.deps.notice(`${name} IS BACK`);
            this.deps.beam?.(null);
            // (until their first packet says they are up, the box is not offered again)
            this.boxDone = { owner, at: now };
            this.eDownAt = null;
          }, rate);
          if (fresh && this.hold?.kind === "box") this.deps.beam?.(at);
        }
      } else {
        if (this.eDownAt !== null && now - this.eDownAt < BOX.tapTime) match.takeLoot(d.key);
        this.eDownAt = null;
        this.cancelHold(match);
      }
    } else if (beacon && this.carried) {
      const who = this.carried;
      out.prompt = { key: `HOLD ${key}`, text: `RESPAWN ${who.name}` };
      this.runHold("beacon", who.owner, `CALLING IN ${who.name}`, BEACON_TIME, holdingE, now, match, () => {
        match.sendRespawn(who.owner, new THREE.Vector3(beacon.x, 0, beacon.z));
        this.deps.notice(`${who.name} IS DROPPING IN`);
        this.carried = null;
      });
    } else if (rc) {
      // a Ring Console: hold to put the circle after next on the squad's map
      if (!rc.ready) {
        this.cancelHold(match);
        out.prompt = { key: "", text: "RING CONSOLE: SCANNED THIS ROUND, IT REBOOTS WHEN THE RING CLOSES" };
      } else {
        out.prompt = { key: `HOLD ${key}`, text: "SCAN THE RING CONSOLE: SEE WHERE THE RING GOES AFTER NEXT" };
        this.runHold("console", rc.index, "SCANNING THE RING CONSOLE", CONSOLE.hold, holdingE, now, match, () => {
          if (!match.scanConsole(rc.index)) return;
          this.deps.notice("THE RING AFTER NEXT IS ON YOUR MAP");
          this.deps.sound("ping");
          this.deps.onScan?.();
        });
      }
    } else if (bin) {
      // a supply bin: hold to open it (whoever is first gets it open), and what was in it comes out round it
      out.prompt = { key: `HOLD ${key}`, text: "OPEN THE SUPPLY BIN" };
      this.runHold("bin", bin.key, "OPENING THE SUPPLY BIN", BINS.hold, holdingE, now, match, () => {
        match.takeLoot(bin.key);
      });
    } else {
      this.cancelHold(match);
      // on the tower's own floor: the Mast's balloon is on its roof, not in the hall 28 m under it
      // a door you look at, unless there is loot under the crosshair (that is what you meant)
      const aimedLoot = match.lootField?.nearest(eye, fwd) ?? null;
      const door = aimedLoot ? null : match.doors.aimedAt(eye, fwd);
      const tower = match.mapInfo.towers.find((t) => Math.hypot(p.x - t.x, p.z - t.z) < squad.towerReach && Math.abs(p.y - t.y) < 1.5);
      if (tower && player.onGround) {
        out.prompt = { key, text: "RIDE THE JUMP TOWER" };
        if (input.pressedNow("interact")) {
          player.beginDrop(tower.x, DROP_HEIGHT * 0.75, tower.z, player.yaw);
          this.deps.sound("tower");
        }
      } else if (door && !player.zipPrompt) {
        // a door you look at: a tap opens or shuts it
        this.stopTaking();
        // the vault's door: locked, and only the keycard opens it
        const locked = match.doors.isLocked(door.i);
        out.prompt = locked ? (match.myKey ? { key, text: "OPEN THE VAULT (USES THE KEYCARD)" } : { key: "", text: "LOCKED  ·  THE VAULT KEYCARD OPENS IT" }) : { key, text: door.open ? "SHUT THE DOOR" : "OPEN THE DOOR" };
        if (input.pressedNow("interact") && (!locked || match.myKey)) match.useDoor(door.i, !door.open);
      } else if (!player.zipPrompt) {
        this.lootHere(now, match, input, p, eye, fwd, key, carry, out);
      } else this.stopTaking();
    }
    if (this.hold) out.hold = { label: this.hold.label, progress: Math.min(1, this.hold.filled / this.hold.need) };
    // the key belonged to a revive, a beacon or a tower this frame, or there
    // is nothing at your feet: either way any hold at a spot is over
    if (!out.reach.rows.length) this.stopTaking();
    this.publish(out.reach);
    this.out = out;
    return out;
  }

  /**
   * Standing in loot: the list of what is in reach, the prompt for the one it
   * points at, a tap to take that one, and a hold to empty the spot.
   *
   * The prompt points at the row you stepped to with the cycle key while that
   * row is still in reach, else at whatever is under the crosshair, else at
   * the nearest thing. So aiming still works exactly as it did, and the list
   * is there for the times when what is nearest is not what you want.
   */
  private lootHere(
    now: number,
    match: BrMatch,
    input: MoveInput,
    p: THREE.Vector3,
    eye: THREE.Vector3,
    fwd: THREE.Vector3,
    key: string,
    carry: CarryState | null,
    out: BrPlayHud
  ): void {
    const f = match.lootField;
    if (!f) return;
    const isGun = (key: number): boolean => f.drops.get(key)?.item.kind === "weapon";
    const guarding = now - this.gunTakenAt < LOOTING.swapGuard;
    const letGo = (key: number): boolean => {
      if (!guarding || key <= this.gunKeyFloor || !isGun(key)) return false;
      const d = f.drops.get(key);
      return !!d && Math.hypot(d.pos.x - this.gunTakenFrom.x, d.pos.z - this.gunTakenFrom.z) < 0.5;
    };
    const rows = reachRows(f.drops.values(), p, carry, (o) => o === match.id || match.isAlly(o)).filter((r) => !letGo(r.key));
    if (!rows.length) {
      this.stopTaking();
      return;
    }
    if (this.picked !== null && !rows.some((r) => r.key === this.picked)) this.picked = null;
    const many = rows.length > 1;
    if (many && input.pressedNow(CYCLE)) {
      const at = rows.findIndex((r) => r.key === this.pickOf(rows, eye, fwd, f));
      this.picked = rows[(at + 1) % rows.length].key;
    }
    const pick = this.pickOf(rows, eye, fwd, f);
    const row = rows.find((r) => r.key === pick) ?? rows[0];
    out.reach = { rows, pick: row.key, cycleKey: many ? this.deps.keyLabel(CYCLE) : "" };
    // what a hold would still take: everything in reach bar the greyed rows
    const left = rows.filter((r) => !r.dim);
    out.prompt = { key: many && left.length > 1 ? `${key} / HOLD` : key, text: many && left.length > 1 ? `TAKE ${row.label}  ·  HOLD: TAKE ALL` : `TAKE ${row.label}` };
    if (input.pressedNow("interact")) {
      // the press takes the one the prompt names, as it always has
      if (isGun(row.key)) {
        this.gunTakenAt = now;
        this.gunTakenFrom = { x: p.x, z: p.z };
        let top = 0;
        for (const k of f.drops.keys()) if (k > top) top = k;
        this.gunKeyFloor = top;
      }
      this.take(match, row.key, now);
      this.takeDownAt = now;
      this.lastTakeAt = now;
      return;
    }
    if (!input.held("interact")) {
      this.takeDownAt = null;
      return;
    }
    if (this.takeDownAt === null) return;
    // the nearest one still worth taking that is not already asked for: on the
    // host the press has taken its item and it is gone from the list by now,
    // but a guest's take is a question and the item stays put until the answer
    // A hold takes everything EXCEPT guns. Taking a gun is a choice about what
    // you carry, and with both slots full it puts the one in hand down, which
    // the next step of the hold would pick straight back up.
    const next = left.find((r) => !this.inFlight(r.key, now) && !isGun(r.key));
    if (next && holdDue(now, this.takeDownAt, this.lastTakeAt)) {
      this.take(match, next.key, now);
      this.lastTakeAt = now;
    }
    // the bar fills to the first item, then once per item after it
    if (left.length) {
      const since = now - this.takeDownAt;
      const progress = since < LOOTING.startAfter ? since / LOOTING.startAfter : Math.min(1, (now - this.lastTakeAt) / LOOTING.cadence);
      out.hold = { label: `TAKING EVERYTHING  ·  ${left.length} LEFT`, progress };
    }
  }

  /** the row the prompt points at: your cycled one, else what you aim at, else the nearest */
  private pickOf(rows: ReachRow[], eye: THREE.Vector3, fwd: THREE.Vector3, f: NonNullable<BrMatch["lootField"]>): number {
    if (this.picked !== null && rows.some((r) => r.key === this.picked)) return this.picked;
    const aimed = f.nearest(eye, fwd);
    if (aimed && rows.some((r) => r.key === aimed.key)) return aimed.key;
    return rows[0].key;
  }

  /** a hold-E action: started, kept going, given up, or done */
  /**
   * A hold in progress: `rate` is how fast it fills (1 is real time), which
   * can change as it goes (SpeedKills' restore, a third as fast while the
   * ghost is away from you).
   */
  private runHold(kind: "revive" | "beacon" | "box" | "console" | "bin", target: number, label: string, need: number, holding: boolean, now: number, match: BrMatch, done: () => void, rate = 1): void {
    if (!holding) {
      this.cancelHold(match);
      return;
    }
    if (!this.hold || this.hold.kind !== kind || this.hold.target !== target) {
      this.cancelHold(match);
      this.hold = { kind, target, label, start: now, need, filled: 0, last: now };
      if (kind === "revive") match.sendRevive(target, "start");
    }
    this.hold.filled += Math.max(0, now - this.hold.last) * rate;
    this.hold.last = now;
    this.hold.label = label;
    if (this.hold.filled >= need) {
      this.hold = null;
      done();
    }
  }

  private cancelHold(match: BrMatch): void {
    if (this.hold?.kind === "revive") match.sendRevive(this.hold.target, "stop");
    if (this.hold?.kind === "box") this.deps.beam?.(null);
    this.hold = null;
  }

  /** a hold at a box just finished: that mate is on their way back */
  private boxDone: { owner: number; at: number } | null = null;

  /**
   * A dead squad mate's banner lying within reach (their death box), when you
   * look at it or at no other item: an item under the crosshair (a gun in
   * the box) is taken as any item is.
   */
  private boxHere(match: BrMatch, p: THREE.Vector3, eye: THREE.Vector3, fwd: THREE.Vector3, now: number): LootDrop | null {
    const f = match.lootField;
    if (!f) return null;
    const aimed = f.nearest(eye, fwd);
    if (aimed && aimed.item.kind !== "banner") return null;
    for (const d of f.drops.values()) {
      if (d.item.kind !== "banner" || d.item.owner === undefined || d.item.owner === match.id || !match.isAlly(d.item.owner)) continue;
      if (Math.hypot(d.pos.x - p.x, d.pos.z - p.z) > BOX.reach) continue;
      if (match.memberAlive(d.item.owner) !== false) continue;
      if (this.boxDone && this.boxDone.owner === d.item.owner && now - this.boxDone.at < 3) continue;
      return d;
    }
    return null;
  }

  get hud(): BrPlayHud {
    return this.out;
  }
}
