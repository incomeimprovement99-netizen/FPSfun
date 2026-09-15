// Battle royale loot: what lies on Outskirts' floors and roofs, in death
// boxes and care packages, and how you pick it up (src/config/loot.json).
//
// Every item has a key. The floor's items come from a seed, so a squad's
// browsers lay out the same items with the same keys from the host's seed
// (the welcome carries it); items made while playing (a dropped gun, a death
// box, a care package) get their keys from the host, which tells the squad.
// Taking an item is the host's call in a squad: first come, first served.
//
// Drawn in code: a gun lies as its own model, the rest as a small box in the
// rarity's colour; epic and legendary items stand in a beam of light. Only
// what is within 70 m is drawn.
import * as THREE from "three";
import cfg from "../config/loot.json";
import { displayGunModel } from "./gunmodels";
import { weaponName, type AmmoType } from "./weapons";
import { HEALS, type HealItem, type Helmet } from "./kit";
import { hopupName, opticName, throwName } from "../config/names";
import { RANGE_SOLIDS } from "./range";
import type { Attachments } from "./attachments";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type LootKind = "weapon" | "ammo" | "heal" | "attach" | "hopup" | "helmet" | "banner" | "box" | "grenade";

export interface LootItem {
  kind: LootKind;
  /** weapon id, ammo type, heal item, mod name ("mag:N" for a magazine), helmet kind, a banner's player id */
  id: string;
  n: number;
  rarity: Rarity;
  /** a dropped gun keeps its fittings */
  mag?: number;
  attach?: Attachments;
  /** a banner: whose, and their name */
  owner?: number;
  ownerName?: string;
  /** from a care package (its number): the package's EVO, once */
  pod?: number;
  /** a gun's locked hop-up: the damage done with it so far */
  hop?: number;
}

export interface LootDrop {
  key: number;
  item: LootItem;
  pos: THREE.Vector3;
  obj: THREE.Object3D;
}

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];
const hexOf = (r: Rarity) => new THREE.Color(cfg.colors[r]).getHex();

/** a small deterministic random, the same on every browser for the same seed */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ATTACH_LABEL: Record<string, string> = {
  barrel_stabilizer_l1: "white barrel",
  barrel_stabilizer_l2: "blue barrel",
  barrel_stabilizer_l3: "purple barrel",
  stock_tactical_l1: "white stock",
  stock_tactical_l2: "blue stock",
  stock_tactical_l3: "purple stock",
  stock_sniper_l1: "white sniper stock",
  stock_sniper_l2: "blue sniper stock",
  stock_sniper_l3: "purple sniper stock",
};
const MAG_NAMES = ["", "white mag", "blue mag", "purple mag", "gold mag"];

/** what an item is called on the prompt */
export function lootLabel(it: LootItem): string {
  switch (it.kind) {
    case "weapon":
      return weaponName(it.id).toUpperCase();
    case "ammo":
      return `${it.id.toUpperCase()} AMMO x${it.n}`;
    case "heal":
      return `${HEALS[it.id as HealItem]?.name.toUpperCase() ?? it.id} x${it.n}`;
    case "attach":
      if (it.id.startsWith("mag:")) return MAG_NAMES[Number(it.id.slice(4))]?.toUpperCase() ?? "MAG";
      if (it.id.startsWith("optic_")) return opticName(it.id, it.id).toUpperCase();
      return (ATTACH_LABEL[it.id] ?? it.id).toUpperCase();
    case "hopup":
      return hopupName(it.id).toUpperCase();
    case "helmet":
      return it.id === "red" ? "MYTHIC HELMET" : "GOLD HELMET";
    case "grenade":
      return `${throwName(it.id)}${it.n > 1 ? ` x${it.n}` : ""}`;
    case "banner":
      return `${it.ownerName ?? "A SQUAD MATE"}'S BANNER`;
    default:
      return "DEATH BOX";
  }
}

/** a rarity from the weights */
function rollRarity(rnd: () => number): Rarity {
  const w = cfg.rarity;
  const total = w.common + w.rare + w.epic + w.legendary;
  let r = rnd() * total;
  for (const k of RARITY_ORDER) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return "common";
}

const pick = <T>(rnd: () => number, xs: T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];

/** one random floor item */
export function rollItem(rnd: () => number): LootItem {
  const kinds = Object.entries(cfg.kinds) as Array<[LootKind, number]>;
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  let kind: LootKind = "ammo";
  for (const [k, w] of kinds) {
    r -= w;
    if (r <= 0) {
      kind = k;
      break;
    }
  }
  const rarity = rollRarity(rnd);
  switch (kind) {
    case "weapon":
      return { kind, id: pick(rnd, cfg.weapons[rarity]), n: 1, rarity, mag: rarity === "legendary" ? 4 : rarity === "epic" ? 2 : 0 };
    case "heal": {
      const id = pick(rnd, cfg.heals[rarity]) as HealItem;
      return { kind, id, n: cfg.healAmount[id], rarity: rarity };
    }
    case "attach":
      return { kind, id: pick(rnd, cfg.attachments[rarity]), n: 1, rarity };
    case "hopup":
      return { kind, id: pick(rnd, cfg.hopups), n: 1, rarity: "epic" };
    case "helmet":
      return { kind, id: rnd() < 0.8 ? "gold" : "red", n: 1, rarity: "legendary" };
    case "grenade":
      return { kind, id: pick(rnd, cfg.grenades), n: 1, rarity: "rare" };
    default: {
      const type = pick(rnd, ["light", "heavy", "sniper", "shotgun"] as AmmoType[]);
      const stack = { light: 60, heavy: 60, sniper: 28, shotgun: 20 } as Record<string, number>;
      return { kind: "ammo", id: type, n: stack[type], rarity: "common" };
    }
  }
}

/** the floor (or a roof, if there is a low one there) at x, z */
function floorAt(x: number, z: number): number | null {
  let top = 0;
  for (const s of RANGE_SOLIDS) {
    if (x > s.minX - 0.3 && x < s.maxX + 0.3 && z > s.minZ - 0.3 && z < s.maxZ + 0.3) {
      if (s.top > 7 || s.base > 0.5) return null;
      top = Math.max(top, s.top);
    }
  }
  return top;
}

export class LootField {
  readonly group = new THREE.Group();
  drops = new Map<number, LootDrop>();
  private nextKey = 1;
  private beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6, 1, true);
  private boxGeo = new THREE.BoxGeometry(0.34, 0.2, 0.34);
  /** a gun's ring on the floor and a death box, shared by every one (not one geometry each) */
  private ringGeo = new THREE.RingGeometry(0.34, 0.42, 20);
  private crateGeo = new THREE.BoxGeometry(0.9, 0.55, 0.6);
  private mats = new Map<string, THREE.Material>();

  /** no scene: nothing drawn (tools/verify.ts, in Node) */
  constructor(scene: THREE.Scene | null) {
    this.group.name = "loot";
    scene?.add(this.group);
    this.headless = !scene;
  }
  private headless: boolean;

  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) this.mats.set(key, (m = make()));
    return m;
  }

  /** the look of an item: its gun, or a box in the rarity's colour; a beam over the rare ones */
  private visual(it: LootItem): THREE.Object3D {
    const g = new THREE.Group();
    if (this.headless) return g;
    const colour = hexOf(it.rarity);
    if (it.kind === "weapon") {
      const m = displayGunModel(it.id).root.clone(true);
      for (const c of [...m.children]) if (c.name === "muzzleflash") m.remove(c);
      m.rotation.set(0, Math.PI / 2, Math.PI / 2);
      m.position.y = 0.06;
      g.add(m);
      const plate = new THREE.Mesh(this.ringGeo, this.mat(`ring${colour}`, () => new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide })));
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = 0.02;
      g.add(plate);
    } else if (it.kind === "box") {
      const crate = new THREE.Mesh(this.crateGeo, this.mat("deathbox", () => new THREE.MeshStandardMaterial({ color: 0x2b2f35, emissive: 0xff5a3a, emissiveIntensity: 0.25, roughness: 0.6 })));
      crate.position.y = 0.28;
      g.add(crate);
    } else {
      const col = it.kind === "banner" ? 0x7ddc8a : colour;
      const b = new THREE.Mesh(this.boxGeo, this.mat(`box${col}`, () => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.5 })));
      b.position.y = 0.12;
      g.add(b);
    }
    if (it.rarity === "epic" || it.rarity === "legendary" || it.kind === "banner") {
      const beam = new THREE.Mesh(this.beamGeo, this.mat(`beam${colour}`, () => new THREE.MeshBasicMaterial({ color: it.kind === "banner" ? 0x7ddc8a : colour, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
      beam.position.y = 1.2;
      g.add(beam);
    }
    return g;
  }

  /** an item into the world at `pos`: with a given key (from the seed or the host), or the next free one */
  add(item: LootItem, pos: THREE.Vector3, key?: number): number {
    const k = key ?? this.nextKey++;
    if (key !== undefined) this.nextKey = Math.max(this.nextKey, key + 1);
    this.remove(k);
    const obj = this.visual(item);
    obj.position.copy(pos);
    this.group.add(obj);
    this.drops.set(k, { key: k, item, pos: pos.clone(), obj });
    return k;
  }

  remove(key: number): LootItem | null {
    const d = this.drops.get(key);
    if (!d) return null;
    d.obj.removeFromParent();
    this.drops.delete(key);
    return d.item;
  }

  /** the next key the host will hand out */
  get next(): number {
    return this.nextKey;
  }

  clear(): void {
    for (const k of [...this.drops.keys()]) this.remove(k);
    this.nextKey = 1;
  }

  /** done with the field (the match is over): the items, its shapes and its materials freed */
  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    for (const g of [this.beamGeo, this.boxGeo, this.ringGeo, this.crateGeo]) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }

  /**
   * The floor's loot from a seed: spots round each place (on the ground, or a
   * low roof), and in the field; one to three items a spot. The same on every
   * browser for the same seed.
   */
  generate(seed: number, places: Array<{ x: number; z: number }>, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    this.clear();
    const rnd = seeded(seed);
    const spots: THREE.Vector3[] = [];
    const trySpot = (x: number, z: number) => {
      const y = floorAt(x, z);
      if (y !== null) spots.push(new THREE.Vector3(x, y + 0.01, z));
    };
    for (const p of places) {
      let tries = 0;
      const before = spots.length;
      while (spots.length - before < cfg.spotsPerPoi && tries++ < 200) {
        const a = rnd() * Math.PI * 2;
        const r = 4 + rnd() * 30;
        trySpot(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      }
    }
    for (let i = 0; i < cfg.fieldSpots; i++) trySpot(bounds.minX + 20 + rnd() * (bounds.maxX - bounds.minX - 40), bounds.minZ + 20 + rnd() * (bounds.maxZ - bounds.minZ - 40));
    for (const s of spots) {
      const [lo, hi] = cfg.itemsPerSpot;
      const n = lo + Math.floor(rnd() * (hi - lo + 1));
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2);
        this.add(rollItem(rnd), s.clone().add(off));
      }
    }
  }

  /**
   * The item you would take: within reach of the eye and nearest the
   * crosshair's line (within about 25 degrees), or null.
   */
  nearest(eye: THREE.Vector3, fwd: THREE.Vector3, reach = cfg.pickupReach): LootDrop | null {
    let best: LootDrop | null = null;
    let bestScore = Infinity;
    const to = new THREE.Vector3();
    for (const d of this.drops.values()) {
      if (d.item.kind === "box") continue;
      to.copy(d.pos).setY(d.pos.y + 0.15).sub(eye);
      const dist = to.length();
      if (dist > reach + 1.2) continue;
      const flat = Math.hypot(d.pos.x - eye.x, d.pos.z - eye.z);
      if (flat > reach) continue;
      const cos = to.dot(fwd) / Math.max(1e-6, dist);
      if (cos < 0.9) continue;
      const score = (1 - cos) * 10 + dist * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  /** draw only what is near; the items turn slowly */
  update(cam: THREE.Vector3, now: number): void {
    const far2 = cfg.drawDistance * cfg.drawDistance;
    for (const d of this.drops.values()) {
      const v = d.pos.distanceToSquared(cam) < far2;
      d.obj.visible = v;
      if (v && d.item.kind !== "box" && d.item.kind !== "weapon") d.obj.rotation.y = now * 0.8 + d.key;
    }
  }

  get count(): number {
    return this.drops.size;
  }
}

export const LOOT = cfg;
export type { Helmet };
