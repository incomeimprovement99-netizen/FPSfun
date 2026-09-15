// The battle royale from the player's side: what E does where you stand
// (take the item under the crosshair, hold it to revive a downed squad mate or
// to bring one back at a respawn beacon, ride a jump tower), the launch pads
// on the roads, and pings (the middle mouse button: an enemy, an item, or a
// place, shown to the squad).
import * as THREE from "three";
import type { BrMatch } from "./brmatch";
import type { Dummy } from "./dummy";
import type { MoveInput, Player } from "./player";
import { solidHit } from "./projectile";
import { lootLabel, type LootItem, type LootDrop } from "./loot";
import { DROP_HEIGHT } from "./brmatch";
import squad from "../config/squad.json";

export interface Marker {
  k: "enemy" | "loot" | "go";
  at: THREE.Vector3;
  label: string;
  from: number;
  until: number;
  /** a figure it follows (an enemy ping), or -1 */
  target: number;
}

export interface BrPlayHud {
  prompt: { key: string; text: string } | null;
  hold: { label: string; progress: number } | null;
  markers: Array<{ k: Marker["k"]; at: THREE.Vector3; label: string; mine: boolean }>;
  banner: { name: string; left: number } | null;
}

interface Deps {
  keyLabel: (a: "interact" | "ping") => string;
  notice: (text: string) => void;
  sound: (kind: "ping" | "tower" | "pad" | "revive") => void;
  /** a revive of yours finished (EVO) */
  onRevive?: () => void;
  /** a Deathbox Respawn's beam: on at a place, or off */
  beam?: (at: THREE.Vector3 | null) => void;
}

/** seconds to hold for a revive and a beacon (Season 30), a banner's life, the pads (src/config/squad.json) */
const REVIVE_TIME = squad.reviveTime;
const BOX = squad.boxRespawn;
const BEACON_TIME = squad.beaconTime;
const BANNER_LIFE = squad.bannerLife;
const PAD_SPEED = squad.pad.speed;
const PAD_UP = squad.pad.up;

export class BrPlay {
  markers: Marker[] = [];
  /** a squad mate's banner you carry to a beacon */
  carried: { owner: number; name: string; until: number } | null = null;
  private hold: { kind: "revive" | "beacon" | "box"; target: number; label: string; start: number; need: number } | null = null;
  /** interact went down at a squad mate's banner, and when (a tap takes it, a hold respawns them) */
  private eDownAt: number | null = null;
  private padAt = -Infinity;
  /** what the frame's prompt and hold are */
  private out: BrPlayHud = { prompt: null, hold: null, markers: [], banner: null };

  constructor(private deps: Deps) {}

  reset(): void {
    this.markers = [];
    this.carried = null;
    this.hold = null;
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
    this.markers.push({ k: kind, at: at.clone(), label, from, until: now + squad.pingLife[kind], target });
    this.deps.sound("ping");
  }

  /** an enemy ping where you look (the double tap): "ENEMY HERE", whatever is there */
  pingEnemy(match: BrMatch, eye: THREE.Vector3, fwd: THREE.Vector3, now: number, myId: number): void {
    const wall = solidHit(eye, fwd, 300);
    const ground = fwd.y < -1e-3 ? eye.y / -fwd.y : Infinity;
    const t = Math.min(wall, ground, 300);
    const at = eye.clone().addScaledVector(fwd, Number.isFinite(t) ? t : 60);
    // the place ping it replaces goes
    this.markers = this.markers.filter((m) => !(m.from === myId && m.k === "go"));
    this.addMarker("enemy", at, "ENEMY HERE", myId, -1, now);
    match.sendMark("enemy", at, "ENEMY HERE");
  }

  /**
   * A ping where you look: a figure under the crosshair is an enemy, an item
   * near the line is loot, else the ground or wall you are looking at.
   */
  ping(match: BrMatch, eye: THREE.Vector3, fwd: THREE.Vector3, now: number, myId: number): void {
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
      return;
    }
    const drop = match.lootField?.nearest(eye, fwd, 40);
    if (drop) {
      const label = `LOOT: ${lootLabel(drop.item)}`;
      this.addMarker("loot", drop.pos, label, myId, -1, now);
      match.sendMark("loot", drop.pos, label);
      return;
    }
    const wall = solidHit(eye, fwd, 300);
    const ground = fwd.y < -1e-3 ? eye.y / -fwd.y : Infinity;
    const t = Math.min(wall, ground, 300);
    const at = eye.clone().addScaledVector(fwd, Number.isFinite(t) ? t : 60);
    this.addMarker("go", at, "GOING HERE", myId, -1, now);
    match.sendMark("go", at, "GOING HERE");
  }

  /**
   * One frame: the launch pads, then what E would do here, in order: a
   * revive, a beacon with a banner, a jump tower, an item. Returns the prompt
   * and any hold in progress for the HUD.
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
    const out: BrPlayHud = { prompt: null, hold: null, markers: [], banner: null };
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
      this.out = out;
      return out;
    }
    const key = this.deps.keyLabel("interact");
    const holdingE = input.held("interact");
    // a revive: a downed squad mate within reach
    const mate = match.downedMateNear(p, squad.reviveReach);
    // a beacon, carrying a banner
    const beacon = this.carried ? match.mapInfo.beacons.find((b) => Math.hypot(p.x - b.x, p.z - b.z) < squad.beaconReach) : undefined;
    if (mate) {
      out.prompt = { key: `HOLD ${key}`, text: `REVIVE ${mate.name}` };
      this.runHold("revive", mate.id, `REVIVING ${mate.name}`, REVIVE_TIME, holdingE, now, match, () => {
        match.sendRevive(mate.id, "done");
        this.deps.notice(`${mate.name} IS BACK UP`);
        this.deps.sound("revive");
        this.deps.onRevive?.();
      });
    } else if (this.boxHere(match, p)) {
      // a dead squad mate's death box: a tap takes the banner, a hold of 7 s respawns them on it
      const d = this.boxHere(match, p)!;
      const owner = d.item.owner!;
      const name = d.item.ownerName ?? "A SQUAD MATE";
      const lock = match.boxLockout(owner);
      out.prompt = lock > 0 ? { key, text: `TAKE ${name}'S BANNER  ·  RESPAWN HERE IN ${Math.ceil(lock)} S` } : { key: `${key} / HOLD`, text: `TAKE ${name}'S BANNER  ·  HOLD: RESPAWN ${name} HERE` };
      if (holdingE) {
        if (this.eDownAt === null) this.eDownAt = now;
        if (lock <= 0 && now - this.eDownAt >= BOX.tapTime) {
          const at = d.pos.clone();
          const fresh = !this.hold || this.hold.kind !== "box";
          this.runHold("box", owner, `RESPAWNING ${name}`, BOX.time, true, now, match, () => {
            match.sendRespawn(owner, at, true);
            this.deps.notice(`${name} IS BACK`);
            this.deps.beam?.(null);
          });
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
    } else {
      this.cancelHold(match);
      const tower = match.mapInfo.towers.find((t) => Math.hypot(p.x - t.x, p.z - t.z) < squad.towerReach);
      if (tower && player.onGround) {
        out.prompt = { key, text: "RIDE THE JUMP TOWER" };
        if (input.pressedNow("interact")) {
          player.beginDrop(tower.x, DROP_HEIGHT * 0.75, tower.z, player.yaw);
          this.deps.sound("tower");
        }
      } else if (!player.zipPrompt) {
        const d = match.lootField?.nearest(eye, fwd);
        if (d) {
          out.prompt = { key, text: `TAKE ${lootLabel(d.item)}` };
          if (input.pressedNow("interact")) match.takeLoot(d.key);
        }
      }
    }
    if (this.hold) out.hold = { label: this.hold.label, progress: Math.min(1, (now - this.hold.start) / this.hold.need) };
    this.out = out;
    return out;
  }

  /** a hold-E action: started, kept going, given up, or done */
  private runHold(kind: "revive" | "beacon" | "box", target: number, label: string, need: number, holding: boolean, now: number, match: BrMatch, done: () => void): void {
    if (!holding) {
      this.cancelHold(match);
      return;
    }
    if (!this.hold || this.hold.kind !== kind || this.hold.target !== target) {
      this.cancelHold(match);
      this.hold = { kind, target, label, start: now, need };
      if (kind === "revive") match.sendRevive(target, "start");
    }
    if (now - this.hold.start >= need) {
      this.hold = null;
      done();
    }
  }

  private cancelHold(match: BrMatch): void {
    if (this.hold?.kind === "revive") match.sendRevive(this.hold.target, "stop");
    if (this.hold?.kind === "box") this.deps.beam?.(null);
    this.hold = null;
  }

  /** a dead squad mate's banner lying within reach (their death box) */
  private boxHere(match: BrMatch, p: THREE.Vector3): LootDrop | null {
    const f = match.lootField;
    if (!f) return null;
    for (const d of f.drops.values()) {
      if (d.item.kind !== "banner" || d.item.owner === undefined || d.item.owner === match.id) continue;
      if (Math.hypot(d.pos.x - p.x, d.pos.z - p.z) > BOX.reach) continue;
      if (match.memberAlive(d.item.owner) !== false) continue;
      return d;
    }
    return null;
  }

  get hud(): BrPlayHud {
    return this.out;
  }
}
