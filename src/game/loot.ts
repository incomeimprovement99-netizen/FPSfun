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
//
// Two things decide what you find. A place has a TIER (src/config/loot.json),
// which says how many spots it carries and how the rarity weights lean, and
// one place a match is the HOT ZONE, which rolls the richest tier and holds a
// gun that is already kitted. That is the whole reason to pick one place over
// another. And a spot is a KIND, not a handful of separate dice: a gun rack, a
// med shelf, a bench, an ordnance crate, an ammo crate, so a room reads as a
// room instead of coming out four shield cells and nothing else.
import * as THREE from "three";
import cfg from "../config/loot.json";
import { displayGunModel } from "./gunmodels";
import { weaponMods, weaponName, type AmmoType } from "./weapons";
import { HEALS, type HealItem, type Helmet } from "./kit";
import { hopupName, opticName, throwName } from "../config/names";
import { RANGE_SOLIDS } from "./range";
import { ammoTypeOf, STACK } from "./ammo";
import { optionsFor, SLOTS, type Attachments } from "./attachments";

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

/** how rich a place is: loot.json's tiers, and "hot" for the one the match picked */
export type PlaceTier = keyof typeof cfg.tiers;

/** a place to put loot round. The id names its tier; without one we go by position in loot.json's placeOrder */
export interface LootPlace {
  x: number;
  z: number;
  id?: string;
}

/** the match's Hot Zone, for the maps to ring and the HUD to call out */
export interface HotZone {
  /** the place's id, and where it sat in the list handed to generate */
  id: string;
  index: number;
  x: number;
  z: number;
  radius: number;
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

/**
 * The rarity weights a tier rolls on: loot.json's one table, each weight
 * scaled by the tier's multiplier. The owner tunes `rarity` and every tier
 * moves with it, which is the point of writing the tiers as multipliers
 * rather than as four more tables to keep in step.
 */
export function rarityWeights(tier: PlaceTier | null): Record<Rarity, number> {
  const base = cfg.rarity as Record<Rarity, number>;
  if (!tier) return { ...base };
  const mult = cfg.tiers[tier].rarity as Record<Rarity, number>;
  const out = {} as Record<Rarity, number>;
  for (const k of RARITY_ORDER) out[k] = base[k] * mult[k];
  return out;
}

/** a rarity from the weights, leaning the way the place's tier leans */
function rollRarity(rnd: () => number, tier: PlaceTier | null = null): Rarity {
  const w = rarityWeights(tier);
  const total = w.common + w.rare + w.epic + w.legendary;
  let r = rnd() * total;
  for (const k of RARITY_ORDER) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return "common";
}

const pick = <T>(rnd: () => number, xs: T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];

// One item of each class, so the single-item roll below and the typed spots
// further down make the same things out of the same table.
const makeWeapon = (rnd: () => number, rarity: Rarity): LootItem => ({ kind: "weapon", id: pick(rnd, cfg.weapons[rarity]), n: 1, rarity, mag: (cfg.gunMag as Record<Rarity, number>)[rarity] });
const makeHeal = (rnd: () => number, rarity: Rarity): LootItem => {
  const id = pick(rnd, cfg.heals[rarity]) as HealItem;
  return { kind: "heal", id, n: cfg.healAmount[id], rarity };
};
const makeAttach = (rnd: () => number, rarity: Rarity): LootItem => ({ kind: "attach", id: pick(rnd, cfg.attachments[rarity]), n: 1, rarity });
const makeMag = (rarity: Rarity): LootItem => ({ kind: "attach", id: `mag:${(cfg.magLevel as Record<Rarity, number>)[rarity]}`, n: 1, rarity });
const makeHopup = (rnd: () => number): LootItem => ({ kind: "hopup", id: pick(rnd, cfg.hopups), n: 1, rarity: "epic" });
const makeHelmet = (rnd: () => number): LootItem => ({ kind: "helmet", id: rnd() < cfg.helmetGold ? "gold" : "red", n: 1, rarity: "legendary" });
const makeGrenade = (rnd: () => number): LootItem => ({ kind: "grenade", id: pick(rnd, cfg.grenades), n: 1, rarity: "rare" });
/** a stack of one type: the gun's own where a rack names one, otherwise whatever lies about */
const makeAmmo = (rnd: () => number, type: AmmoType | null): LootItem => {
  const t = type ?? (pick(rnd, cfg.ammoTypes) as AmmoType);
  return { kind: "ammo", id: t, n: STACK[t as Exclude<AmmoType, "energy">] ?? STACK.light, rarity: "common" };
};

/**
 * One loose item from the kinds table. The floor is laid out by spot kind now
 * (see rollSpot), so this is what something wants when it wants a single item
 * on its own, and it is where tools/verify.ts holds the rarity table to
 * account.
 */
export function rollItem(rnd: () => number, tier: PlaceTier | null = null): LootItem {
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
  const rarity = rollRarity(rnd, tier);
  switch (kind) {
    case "weapon":
      return makeWeapon(rnd, rarity);
    case "heal":
      return makeHeal(rnd, rarity);
    case "attach":
      return makeAttach(rnd, rarity);
    case "hopup":
      return makeHopup(rnd);
    case "helmet":
      return makeHelmet(rnd);
    case "grenade":
      return makeGrenade(rnd);
    default:
      return makeAmmo(rnd, null);
  }
}

interface SpotKind {
  id: string;
  weight: Record<PlaceTier, number>;
  gun: number[];
  ammo: number[];
  mag: number[];
  attach: number[];
  heal: number[];
  throwables: number[];
  hopupChance: number;
  helmetChance: number;
}
const SPOT_KINDS = cfg.spotKinds as SpotKind[];

/** the tier a place rolls on: its id's, or its place in loot.json's placeOrder when it arrives without one */
export function tierOf(place: LootPlace, index: number): PlaceTier {
  const id = place.id ?? cfg.placeOrder[index];
  return ((cfg.places as Record<string, PlaceTier>)[id] ?? cfg.defaultTier) as PlaceTier;
}

/**
 * The Hot Zone for a match: one place, off the seed alone. It runs on its own
 * stream so a guest works it out from the welcome's seed without the host
 * sending anything, and so that adding it moved none of the floor's other
 * rolls. The mix is Knuth's, the same family of constant as `seeded` itself.
 */
export function pickHotZone(seed: number, places: LootPlace[]): HotZone | null {
  if (!places.length) return null;
  const rnd = seeded(Math.imul(seed >>> 0 || 1, 2654435761) >>> 0);
  const index = Math.floor(rnd() * places.length) % places.length;
  const p = places[index];
  return { id: p.id ?? cfg.placeOrder[index] ?? String(index), index, x: p.x, z: p.z, radius: cfg.hotZone.radius };
}

/**
 * The Hot Zone's prize: a gun off the epic list wearing everything it can
 * take. Every slot is filled from what the gun is actually offered
 * (src/game/attachments.ts knows which mods fit which gun), so this cannot
 * hand out a sniper stock on an SMG.
 */
export function kittedGun(rnd: () => number): LootItem {
  const id = pick(rnd, cfg.weapons[cfg.kitted.pool as Rarity]);
  const mods = weaponMods(id);
  const attach: Attachments = {};
  for (const slot of SLOTS) {
    const fits = optionsFor(slot, mods, id).filter((o) => o.mod !== null);
    if (!fits.length) continue;
    const prefer = (cfg.kitted.prefer as Record<string, string[]>)[slot] ?? [];
    attach[slot] = prefer.find((m) => fits.some((o) => o.mod === m)) ?? fits[fits.length - 1].mod;
  }
  return { kind: "weapon", id, n: 1, rarity: cfg.kitted.rarity as Rarity, mag: cfg.kitted.mag, attach };
}

/**
 * What one spot holds. The kind comes off the tier's weights, then the kind
 * says what goes in it: a rack's ammo is the ammo its own gun eats, and when
 * that gun runs on energy it carries its magazines with it (ammo.json), so
 * the rack holds another attachment instead of a stack nobody can use.
 */
export function rollSpot(rnd: () => number, tier: PlaceTier): LootItem[] {
  const total = SPOT_KINDS.reduce((a, s) => a + s.weight[tier], 0);
  let r = rnd() * total;
  let spot = SPOT_KINDS[SPOT_KINDS.length - 1];
  for (const s of SPOT_KINDS) {
    r -= s.weight[tier];
    if (r <= 0) {
      spot = s;
      break;
    }
  }
  const count = (range: number[]) => range[0] + Math.floor(rnd() * (range[1] - range[0] + 1));
  const guns = count(spot.gun);
  let ammo = count(spot.ammo);
  const mags = count(spot.mag);
  let attach = count(spot.attach);
  const heals = count(spot.heal);
  const throwables = count(spot.throwables);
  const out: LootItem[] = [];
  // A rack used to remember only the LAST gun's ammo type, so a rack holding
  // two guns left one of them with a stack it could not use. Each gun's type
  // is kept, and the stacks are dealt round the guns, so two guns means two
  // kinds of ammo and not two of one.
  const takes: Array<AmmoType | null> = [];
  for (let i = 0; i < guns; i++) {
    const gun = makeWeapon(rnd, rollRarity(rnd, tier));
    out.push(gun);
    takes.push(ammoTypeOf(gun.id));
  }
  // The stacks are NOT one per gun. A rack of two with one stack between them
  // is the old floor's ratio (about three stacks for every four guns) and it
  // is the more interesting spot: it decides which of the two you take.
  for (let i = 0; i < ammo; i++) {
    const t = takes.length ? takes[i % takes.length] : null;
    // an energy gun draws on a stockpile rather than a stack, so its share of
    // the spot goes to an attachment instead of an ammo box it cannot use
    if (t === "energy") attach++;
    else out.push(makeAmmo(rnd, t));
  }
  for (let i = 0; i < mags; i++) out.push(makeMag(rollRarity(rnd, tier)));
  for (let i = 0; i < attach; i++) out.push(makeAttach(rnd, rollRarity(rnd, tier)));
  for (let i = 0; i < heals; i++) out.push(makeHeal(rnd, rollRarity(rnd, tier)));
  for (let i = 0; i < throwables; i++) out.push(makeGrenade(rnd));
  if (rnd() < spot.hopupChance) out.push(makeHopup(rnd));
  if (rnd() < spot.helmetChance) out.push(makeHelmet(rnd));
  return out;
}

/** the floor (or a roof, if there is a low one there) at x, z */
/**
 * Every surface at (x, z) a player could stand on with room over their head:
 * the ground, a building's first floor, a roof, the top of a crate.
 *
 * This used to be one number and it refused a spot outright if anything above
 * it had a base over 0.5 m — which was right when a place was a solid block,
 * and wrong the moment the places became buildings with floors in them
 * (src/game/brpoi.ts): every room in every building was disqualified, so the
 * loot all went back outdoors, which is the opposite of what the buildings
 * are for.
 */
function standingSpots(x: number, z: number): number[] {
  const here = RANGE_SOLIDS.filter((s) => x > s.minX - 0.3 && x < s.maxX + 0.3 && z > s.minZ - 0.3 && z < s.maxZ + 0.3);
  const tops = [0, ...here.map((s) => s.top)].filter((y) => y <= 12);
  const out: number[] = [];
  for (const y of new Set(tops)) {
    // room to stand: nothing occupying the 1.9 m above this surface
    const blocked = here.some((s) => s.base < y + 1.9 - 1e-4 && s.top > y + 0.05);
    if (!blocked) out.push(y);
  }
  return out.sort((a, b) => a - b);
}

/** the lowest place to stand at (x, z), or null when there is none */
function floorAt(x: number, z: number): number | null {
  const spots = standingSpots(x, z);
  return spots.length ? spots[0] : null;
}

export class LootField {
  readonly group = new THREE.Group();
  drops = new Map<number, LootDrop>();
  /**
   * The place this match's rich table went to, once generate has run. It is
   * here so the maps can ring it and the HUD can call it out without anyone
   * having to re-roll it: the same seed gives the same answer everywhere,
   * which is also why a guest needs nothing sent to draw the same circle.
   */
  hotZone: HotZone | null = null;
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
    // the Hot Zone belongs to the floor that was cleared: generate() names the
    // next one, and nothing should be able to read the last match's circle
    this.hotZone = null;
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
   * The floor's loot from a seed: spots round each place (on the ground, on a
   * floor above, or on a roof), and in the field. How many spots a place gets
   * and how its rarities lean is its tier's, and one place a match rolls the
   * hot tier and keeps the kitted gun. The same on every browser for the same
   * seed.
   */
  generate(seed: number, places: LootPlace[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    this.clear();
    const rnd = seeded(seed);
    this.hotZone = pickHotZone(seed, places);
    const trySpot = (into: THREE.Vector3[], x: number, z: number) => {
      const y = floorAt(x, z);
      if (y !== null) into.push(new THREE.Vector3(x, y + 0.01, z));
    };
    // A place's loot goes on ANY floor at that spot, picked at random from the
    // ones with headroom, so a two-storey building holds loot upstairs and on
    // its roof as well as on its ground floor. That is the reason to go in.
    const trySpotAnyFloor = (into: THREE.Vector3[], x: number, z: number): void => {
      const floors = standingSpots(x, z);
      if (!floors.length) return;
      const y = floors[Math.floor(rnd() * floors.length)];
      into.push(new THREE.Vector3(x, y + 0.01, z));
    };
    const fill = (spots: THREE.Vector3[], tier: PlaceTier) => {
      for (const s of spots) {
        for (const item of rollSpot(rnd, tier)) {
          const off = new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2);
          this.add(item, s.clone().add(off));
        }
      }
    };
    let hotSpots: THREE.Vector3[] = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const hot = this.hotZone?.index === i;
      const tier: PlaceTier = hot ? "hot" : tierOf(p, i);
      const spots: THREE.Vector3[] = [];
      let tries = 0;
      while (spots.length < cfg.tiers[tier].spots && tries++ < 400) {
        const a = rnd() * Math.PI * 2;
        const r = 4 + rnd() * 30;
        trySpotAnyFloor(spots, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      }
      if (hot) hotSpots = spots;
      fill(spots, tier);
    }
    const field: THREE.Vector3[] = [];
    for (let i = 0; i < cfg.fieldSpots; i++) trySpot(field, bounds.minX + 20 + rnd() * (bounds.maxX - bounds.minX - 40), bounds.minZ + 20 + rnd() * (bounds.maxZ - bounds.minZ - 40));
    fill(field, cfg.fieldTier as PlaceTier);
    // The kitted gun last, on one of the Hot Zone's own spots so it is indoors
    // as often as the rest of that place's loot is. Not every match has one:
    // a Hot Zone you can see is worth crossing for even when the prize is not
    // in it, and a guaranteed prize would make it the only place to land.
    if (hotSpots.length && rnd() < cfg.hotZone.kittedChance) {
      const at = hotSpots[Math.floor(rnd() * hotSpots.length)];
      this.add(kittedGun(rnd), at.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2)));
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
