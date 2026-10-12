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
// med shelf, a bench, an ammo crate, so a room reads as a
// room instead of coming out four shield cells and nothing else.
import { IS_SK, PROFILE } from "./game";
import { HACK_IDS, hackDef, hackSlotOf } from "./hacks";
import * as THREE from "three";
import { slow } from "./slow";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import cfg from "../config/loot.json";
import { displayGunModel } from "./gunmodels";
import { paidGunMaterial, paidPropBatch } from "./paidgun";
import { weaponLabel } from "./weapons";
import { RANGE_SOLIDS } from "./range";
import { solidsIn } from "./solidgrid";
// the world's floor (floors.ts), named apart from this file's own floorAt, the lowest place loot can stand
import { DISTRICT_FLOORS, floorAt as worldFloor, FLOORS, HALL_FLOORS, inHall } from "./floors";
import { inView } from "./figlod";

export type Rarity = "common" | "rare" | "epic" | "legendary";
/** within this of the eye, squared, a hack core is the bought canister; beyond, a box (loot.json coreDetail) */
const CORE_DETAIL2 = cfg.coreDetail ** 2;

/**
 * What can lie on the floor: SpeedKills' guns and hack cores, and a squad mate's echo. The legacy game's ammo,
 * attachments, magazines, hop-ups, helmets and knockdown shields went in Milestone 526 (its heals and backpacks in 523).
 */
export type LootKind = "weapon" | "echo" | "hack";

export interface LootItem {
  kind: LootKind;
  /** a weapon's id, a hack's, or an echo's ("echo") */
  id: string;
  n: number;
  rarity: Rarity;
  /** an echo (where a squad mate died, for their restore): whose, and their name */
  owner?: number;
  ownerName?: string;
  /** from a care package (its number): the package's EVO, once */
  pod?: number;
  /** SpeedKills: a gun's fusion level, 0 as found to 5 (a hack core's level is its n) */
  fusion?: number;
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
  /** how far the place reaches, metres (br.ts): its loot is laid out to here */
  radius?: number;
  /** a site on one floor (THE VAULT): its loot on the floor at this height alone */
  y?: number;
  /** a site's own tier where it is not loot.json's siteTier */
  tier?: string;
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

/** each rarity's colour as a number, read once (it was read from its string for every item drawn, every frame) */
const RARITY_HEX = new Map<string, number>(Object.entries(cfg.colors).map(([r, c]) => [r, new THREE.Color(c as string).getHex()]));
const hexOf = (r: Rarity) => RARITY_HEX.get(r) ?? new THREE.Color(cfg.colors[r]).getHex();

/** a small deterministic random, the same on every browser for the same seed */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** what an item is called on the prompt */
export function lootLabel(it: LootItem): string {
  switch (it.kind) {
    case "weapon":
      return weaponLabel(it.id).toUpperCase();
    case "hack":
      return `${hackDef(it.id)?.name ?? it.id.toUpperCase()} HACK${it.n > 0 ? `  ·  LEVEL ${it.n}` : ""}`;
    case "echo":
      return `${it.ownerName ?? "A SQUAD MATE"}'S ECHO`;
  }
}

/** the tier a place rolls on: the centre is the hot drop, every other sector the same */
export function tierOf(place: LootPlace): PlaceTier {
  return place.id === "c" ? "hot" : "mid";
}

/** what a bot had on it when it went down, as bots.ts keeps it (a type only: loot.ts does not load the bots) */
export interface DeadBotKit {
  gunId: string | null;
  gun: number;
}

/**
 * What a bot drops where it dies: its gun at the level it had fused it to, and nothing else, since the floor is guns
 * and hack cores. `fallbackGun` is the gun a bot held without looting one (a match that starts with loadouts); null when
 * it had none. It lies loose on the floor: there are no death boxes (the owner, 2026-10-04).
 */
export function deathDropOf(kit: DeadBotKit | null, fallbackGun: string | null): LootItem[] {
  const gun = kit?.gunId ?? fallbackGun;
  // a looting bot's rank is its gun's fusion level plus one (bots.ts put); a gun it landed with is level 0
  const level = kit?.gunId ? Math.max(0, Math.min(PROFILE.fusion.levels, kit.gun - 1)) : 0;
  return gun ? [{ kind: "weapon", id: gun, n: 1, rarity: levelRarity(level), fusion: level }] : [];
}

/**
 * The Hot Zone for a match: always the centre, the owner's hottest drop (its sector's id is c). (The legacy game drew
 * it from the seed among its places.)
 */
export function pickHotZone(places: LootPlace[]): HotZone | null {
  if (!places.length) return null;
  const index = Math.max(0, places.findIndex((p) => p.id === "c"));
  const p = places[index];
  return { id: p.id ?? "c", index, x: p.x, z: p.z, radius: p.radius ?? cfg.hotZone.radius };
}

/** SpeedKills: a floor level for a found thing, from a tier's odds (one number a level) */
function levelFrom(rnd: () => number, odds: number[]): number {
  let r = rnd();
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r <= 0) return i;
  }
  return 0;
}
/** a level's colour on the floor: 0 white, 1 blue, 2 purple, 3 and up gold */
const LEVEL_RARITY: Rarity[] = ["common", "rare", "epic", "legendary"];
/** SpeedKills: the colour a gun or hack core of `level` is drawn in, wherever it is put down */
export const levelRarity = (level: number): Rarity => LEVEL_RARITY[Math.max(0, Math.min(3, Math.round(level)))];

/**
 * SpeedKills' care package (speedkills.json loot.carePackage): guns and hack
 * cores only, as its floor is, each a different one, at levels the floor
 * seldom or never gives. The host's alone to roll: its items go to the squad
 * as any drop's do.
 */
export function speedkillsPackage(rnd: () => number): LootItem[] {
  const P = PROFILE.loot?.carePackage;
  if (!P) return [];
  // levelFrom falls back to 0 when a roll runs past the odds; a package never holds less than its lowest level
  const level = (odds: number[]) => Math.max(levelFrom(rnd, odds), odds.findIndex((p) => p > 0));
  const out: LootItem[] = [];
  const guns = [...PROFILE.roster];
  for (let i = 0; i < P.guns && guns.length; i++) {
    const id = guns.splice(Math.floor(rnd() * guns.length), 1)[0];
    const lv = level(P.gunOdds);
    out.push({ kind: "weapon", id, n: 1, rarity: levelRarity(lv), fusion: lv });
  }
  const hacks = [...HACK_IDS];
  for (let i = 0; i < P.hacks && hacks.length; i++) {
    const id = hacks.splice(Math.floor(rnd() * hacks.length), 1)[0];
    const lv = level(P.hackOdds);
    out.push({ kind: "hack", id, n: lv, rarity: levelRarity(lv) });
  }
  return out;
}

/**
 * What one spot holds: a gun, a hack core, or both, and nothing else (the
 * owner: loot is never homework). What level each is found at is the tier's
 * odds, the Spire's the best (speedkills.json loot).
 */
export function rollSpot(rnd: () => number, tier: PlaceTier): LootItem[] {
  const L = PROFILE.loot!;
  const key = tier === "hot" ? "hot" : "mid";
  const out: LootItem[] = [];
  const gun = rnd() < L.gunChance;
  const hack = rnd() < L.hackChance || !gun;
  if (gun) {
    const id = PROFILE.roster[Math.floor(rnd() * PROFILE.roster.length)];
    const level = levelFrom(rnd, L.gunOdds[key]);
    out.push({ kind: "weapon", id, n: 1, rarity: LEVEL_RARITY[Math.min(3, level)], fusion: level });
  }
  if (hack) {
    const id = HACK_IDS[Math.floor(rnd() * HACK_IDS.length)];
    const level = levelFrom(rnd, L.hackOdds[key]);
    out.push({ kind: "hack", id, n: level, rarity: LEVEL_RARITY[Math.min(3, level)] });
  }
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
const MAX_FLOOR = (IS_SK && PROFILE.loot?.maxFloor) || 12;
function standingSpots(x: number, z: number): number[] {
  // (the boxes near, from the solid grid: over all of the Neon map's 79,000, every spot a match's loot tried was most of
  // the battle royale's 1.4 s start, 2026-10-04; the same boxes, as the test below is the same)
  const here = solidsIn(x - 0.3, x + 0.3, z - 0.3, z + 0.3).filter((s) => x > s.minX - 0.3 && x < s.maxX + 0.3 && z > s.minZ - 0.3 && z < s.maxZ + 0.3);
  // a top is a floor only if it is wide enough to stand on: not a parapet, a wall's top or a stair's tread
  const floorTops = here.filter((s) => s.maxX - s.minX >= cfg.minSurface && s.maxZ - s.minZ >= cfg.minSurface).map((s) => s.top);
  // SpeedKills' buildings collide by their own triangles (tools/import-city.ts districtSolids), so a room's floor is many
  // boxes side by side, few of them a metre across: there a top is a floor too where boxes at that height cover the
  // square round the spot between them. Without it the rooms held loot on their ground floors only
  if (IS_SK) floorTops.push(...acrossTops(x, z));
  // the highest floor loot is put on: the legacy map's roofs top out near 12 m; SpeedKills' city is its roofs
  const tops = [0, ...floorTops].filter((y) => y <= MAX_FLOOR);
  const out: number[] = [];
  for (const y of new Set(tops)) {
    // room to stand: nothing occupying the 1.9 m above this surface
    const blocked = here.some((s) => s.base < y + 1.9 - 1e-4 && s.top > y + 0.05);
    // and not a podium hall's floor (floors.ts HALL_FLOORS): the field lands where it did before there were halls, and
    // the halls get loot of their own below
    if (!blocked && !inHall(x, z, y)) out.push(y);
  }
  return out.sort((a, b) => a - b);
}

/** the tops over (x, z) that boxes at that height, together, cover the `minSurface` square round it with */
function acrossTops(x: number, z: number): number[] {
  const h = cfg.minSurface / 2;
  // (from the solid grid: over all of the Neon map's boxes a spot at a time it took laying a match's loot from 170 ms
  // to 320; from the grid, 175)
  const near = solidsIn(x - h, x + h, z - h, z + h).filter((s) => x > s.minX - h && x < s.maxX + h && z > s.minZ - h && z < s.maxZ + h);
  const covered = (px: number, pz: number, y: number) => near.some((s) => Math.abs(s.top - y) < 0.05 && px >= s.minX && px <= s.maxX && pz >= s.minZ && pz <= s.maxZ);
  const out: number[] = [];
  for (const s of near) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    let all = true;
    for (let dx = -h; dx <= h + 1e-6 && all; dx += h) for (let dz = -h; dz <= h + 1e-6 && all; dz += h) all = covered(x + dx, z + dz, s.top);
    if (all) out.push(s.top);
  }
  return out;
}

/**
 * A spot on the street over a hole in it (a metro stairwell's opening, floors.ts): the street is not there, so the
 * item goes down onto what is under it, the stair or the tunnel's floor. Only its height moves, so the field's draws
 * are the same with the metro as without it.
 */
function underHole(x: number, z: number, y: number): number {
  if (y !== 0 || worldFloor(x, z) >= 0) return y;
  const under = solidsIn(x, x, z, z).filter((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top < 0.05);
  if (under.some((s) => Math.abs(s.top) < 0.05)) return y;
  return under.reduce((a, s) => Math.max(a, s.top), worldFloor(x, z));
}

/** the lowest place to stand at (x, z), or null when there is none */
function floorAt(x: number, z: number): number | null {
  const spots = standingSpots(x, z);
  return spots.length ? spots[0] : null;
}

/**
 * A gun on the floor as one mesh: every part of its display model baked into
 * one geometry with its colour in the vertices, made once a gun. The display
 * model is 11 to 15 meshes, each its own draw call, and a rich place put 40
 * to 60 guns in draw distance (docs/PLAN_LOD_DRAW_DISTANCE.md step C). The
 * parts keep their shapes; what is lost is each part's own shine, which on
 * the floor at 0.3 m tall nobody reads.
 */
const floorGuns = new Map<string, THREE.BufferGeometry>();
/** the merged guns' one material: their colours are in the vertices (figure LOD borrows it for a figure's far gun) */
export const floorGunMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.45 });
/** how many times the floor guns were made again: a gun lying since before takes the new ones from the next frame */
let floorGunsMade = 0;
/** forget the floor guns made, so the next are made again (the bought guns have come in) */
export function resetFloorGuns(): void {
  floorGuns.clear();
  floorGunsMade++;
}
/** a gun on the floor lies on its side, a little up off it (its ring is under it) */
const FLOOR_GUN_POSE = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.06, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
/** a floor gun is drawn while a ball this big round it is in view: about its length, and a frame's turn of margin */
const FLOOR_GUN_VIEW_R = 1;

export function floorGun(id: string): THREE.BufferGeometry {
  const hit = floorGuns.get(id);
  if (hit) return hit;
  const root = displayGunModel(id).root;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  // a bought gun (paidgun.ts) keeps its texture coordinates, and is drawn in its own skin (visual), not flat colours
  const paid = !!root.userData.paid;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.name === "muzzleflash" || !m.visible) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    if (mat.transparent) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as THREE.BufferGeometry;
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && !(paid && name === "uv")) g.deleteAttribute(name);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const c = (mat.color ?? new THREE.Color(0x888888)).clone();
    if (mat.emissive) c.add(mat.emissive.clone().multiplyScalar(mat.emissiveIntensity ?? 1));
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  });
  const merged = (parts.length ? mergeGeometries(parts) : null) ?? new THREE.BoxGeometry(0.6, 0.12, 0.08);
  for (const p of parts) p.dispose();
  merged.userData.paid = paid && !!merged.getAttribute("uv");
  floorGuns.set(id, merged);
  return merged;
}

/**
 * One kind of small loot shape, every copy of it in draw distance in one draw
 * call (an item's box, a gun's ring, a rare one's beam). Refilled each frame
 * with the items near enough to draw; it follows no single item.
 */
class Batch {
  readonly mesh: THREE.InstancedMesh;
  n = 0;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    // its copies move every frame and are all near the camera: its own bounds would be stale
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  put(m: THREE.Matrix4): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.mesh.setMatrixAt(this.n++, m);
  }
  close(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    // one with nothing to draw is left out of the frame: drawn empty, it still cost its program and uniforms
    this.mesh.visible = this.n > 0;
    this.n = 0;
  }
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
  /** the hot zone's spots, and how many guns and hack cores it started with: what a restock puts back to */
  hotSpots: THREE.Vector3[] = [];
  hotStock = 0;
  private nextKey = 1;
  /** the next key a new item gets (host migration: the heir's snapshot carries the host's) */
  get keyNext(): number {
    return this.nextKey;
  }
  set keyNext(n: number) {
    this.nextKey = Math.max(this.nextKey, Math.floor(n));
  }
  private beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6, 1, true);
  private boxGeo = new THREE.BoxGeometry(0.34, 0.2, 0.34);
  /** a gun's ring on the floor , shared by every one (not one geometry each) */
  private ringGeo = new THREE.RingGeometry(0.34, 0.42, 20);
  private crateGeo = new THREE.BoxGeometry(0.9, 0.55, 0.6);
  private mats = new Map<string, THREE.Material>();
  /** the instanced shapes, by the material key they draw with */
  private batches = new Map<string, Batch>();
  private batch(key: string, geo: THREE.BufferGeometry, make: () => THREE.Material): Batch {
    let b = this.batches.get(key);
    if (!b) this.batches.set(key, (b = new Batch(geo, this.mat(key, make), this.group, cfg.batchCap)));
    return b;
  }
  /** each floor gun's batch, by the drop's key, and the making of the floor guns it was for */
  private gunBatches = new Map<number, { made: number; batch: Batch }>();
  /**
   * A floor gun's batch: every copy of that gun in that skin in one draw call. Each gun on the floor was its own,
   * about 130 a frame in the Neon City's street (2026-10-03), in a dozen kinds. Made with the drop, so the match's
   * warm-up (main.ts warmMatch) compiles its shader with the rest, not the frame the first one comes into view.
   */
  private gunBatch(d: LootDrop): Batch {
    const had = this.gunBatches.get(d.key);
    if (had && had.made === floorGunsMade) return had.batch;
    const geo = floorGun(d.item.id);
    // a bought gun in its skin at the level it lies at (paidgun.ts); ours in the shared flat-colour material
    const mat = (geo.userData.paid ? paidGunMaterial(d.item.id, d.item.fusion ?? 0) : null) ?? floorGunMat;
    const batch = this.batch(`gun${geo.id}.${mat.id}`, geo, () => mat);
    this.gunBatches.set(d.key, { made: floorGunsMade, batch });
    return batch;
  }
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpE = new THREE.Euler();
  private readonly tmpP = new THREE.Vector3();
  private readonly unit = new THREE.Vector3(1, 1, 1);

  /** no scene: nothing drawn (tools/verify.ts, in Node) */
  constructor(scene: THREE.Scene | null) {
    this.group.name = "loot";
    scene?.add(this.group);
    // (it never moves, nor does an item once it is down: their matrices worked out once, not every frame; ?slow=static)
    if (!slow("static")) {
      this.group.updateMatrix();
      this.group.matrixAutoUpdate = false;
    }
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
    if (it.kind === "weapon") {
      // a gun is drawn with every other of its kind and skin, as its ring is with every other ring (gunBatch)
    }
    // an item's box, a gun's ring and a rare one's beam are drawn in batches (update), not here
    return g;
  }

  /** the batched shapes of an item near enough to draw: its box, a gun's ring, a rare one's beam */
  private drawBatched(d: LootDrop, now: number, near = true): void {
    const it = d.item;
    const colour = hexOf(it.rarity);
    const p = this.tmpP;
    if (it.kind === "weapon") {
      // the gun, when it is in view: its batch draws every copy it is given, wherever they are
      if (inView(d.pos.x, d.pos.y + 0.1, d.pos.z, FLOOR_GUN_VIEW_R)) {
        this.tmpM.copy(FLOOR_GUN_POSE);
        this.tmpM.elements[12] += d.pos.x;
        this.tmpM.elements[13] += d.pos.y;
        this.tmpM.elements[14] += d.pos.z;
        this.gunBatch(d).put(this.tmpM);
      }
      p.set(d.pos.x, d.pos.y + 0.02, d.pos.z);
      this.tmpQ.setFromEuler(this.tmpE.set(-Math.PI / 2, 0, 0));
      this.batch(`ring${colour}`, this.ringGeo, () => new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide })).put(this.tmpM.compose(p, this.tmpQ, this.unit));
    } else {
      // a hack core in its slot's colour (mobility cyan, utility magenta)
      const col = it.kind === "echo" ? 0x7ddc8a : it.kind === "hack" ? (hackSlotOf(it.id) === "mobility" ? 0x20e0ff : 0xff2e9a) : colour;
      // the items turn slowly
      this.tmpQ.setFromEuler(this.tmpE.set(0, now * 0.8 + d.key, 0));
      // SpeedKills: a hack core is the pack's canister standing, glowing in its slot's colour (paidgun.ts)
      const core = it.kind === "hack" && IS_SK && near ? paidPropBatch("hackcore", col) : null;
      if (core) {
        p.set(d.pos.x, d.pos.y + 0.22 + 0.04 * Math.sin(now * 2 + d.key), d.pos.z);
        this.batch(`core${col}`, core.geo, () => core.mat).put(this.tmpM.compose(p, this.tmpQ, this.unit));
        // and a ring on the floor in the slot's colour, as a gun has in its rarity's: the canister's own glow is a few
        // strips, which do not say mobility or utility from across a street
        p.set(d.pos.x, d.pos.y + 0.02, d.pos.z);
        this.tmpQ.setFromEuler(this.tmpE.set(-Math.PI / 2, 0, 0));
        this.batch(`ring${col}`, this.ringGeo, () => new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })).put(this.tmpM.compose(p, this.tmpQ, this.unit));
      } else {
        p.set(d.pos.x, d.pos.y + 0.12, d.pos.z);
        this.batch(`box${col}`, this.boxGeo, () => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.5 })).put(this.tmpM.compose(p, this.tmpQ, this.unit));
      }
    }
    if (it.rarity === "epic" || it.rarity === "legendary" || it.kind === "echo") {
      p.set(d.pos.x, d.pos.y + 1.2, d.pos.z);
      this.tmpQ.identity();
      this.batch(`beam${colour}`, this.beamGeo, () => new THREE.MeshBasicMaterial({ color: it.kind === "echo" ? 0x7ddc8a : colour, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })).put(this.tmpM.compose(p, this.tmpQ, this.unit));
    }
  }

  /** an item into the world at `pos`: with a given key (from the seed or the host), or the next free one */
  add(item: LootItem, pos: THREE.Vector3, key?: number): number {
    const k = key ?? this.nextKey++;
    if (key !== undefined) this.nextKey = Math.max(this.nextKey, key + 1);
    this.remove(k);
    const obj = this.visual(item);
    obj.position.copy(pos);
    this.group.add(obj);
    if (!slow("static"))
      obj.traverse((o) => {
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      });
    const d = { key: k, item, pos: pos.clone(), obj };
    this.drops.set(k, d);
    if (item.kind === "weapon" && !this.headless) this.gunBatch(d);
    return k;
  }

  remove(key: number): LootItem | null {
    const d = this.drops.get(key);
    if (!d) return null;
    d.obj.removeFromParent();
    this.drops.delete(key);
    this.gunBatches.delete(key);
    return d.item;
  }

  /** the guns and hack cores lying in the hot zone now */
  hotHeld(): LootDrop[] {
    const z = this.hotZone;
    if (!z) return [];
    return [...this.drops.values()].filter((d) => (d.item.kind === "weapon" || d.item.kind === "hack") && Math.hypot(d.pos.x - z.x, d.pos.z - z.z) <= z.radius);
  }

  /**
   * The host's restock of the hot zone (speedkills.json loot.restock): when
   * fewer than `below` of what it started with are left, the spots with
   * nothing near are rolled again, up to `batch` of them. Says what to put
   * down where; the caller keys and sends each (brmatch.ts dropLoot).
   */
  restockPlan(R: { below: number; batch: number; near: number }, rnd: () => number): Array<{ item: LootItem; at: THREE.Vector3 }> {
    const held = this.hotHeld();
    if (!this.hotStock || held.length >= R.below * this.hotStock) return [];
    const empty = this.hotSpots.filter((s) => !held.some((d) => Math.hypot(d.pos.x - s.x, d.pos.z - s.z) < R.near && Math.abs(d.pos.y - s.y) < 1.5));
    const out: Array<{ item: LootItem; at: THREE.Vector3 }> = [];
    for (let i = 0; i < R.batch && empty.length; i++) {
      const s = empty.splice(Math.floor(rnd() * empty.length), 1)[0];
      for (const item of rollSpot(rnd, "hot")) out.push({ item, at: s.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2)) });
    }
    return out;
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
    this.hotSpots = [];
    this.hotStock = 0;
  }

  /** done with the field (the match is over): the items, its shapes and its materials freed */
  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    for (const b of this.batches.values()) b.mesh.dispose();
    this.batches.clear();
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
  generate(seed: number, places: LootPlace[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, sites: LootPlace[] = []): void {
    this.clear();
    const rnd = seeded(seed);
    this.hotZone = pickHotZone(places);
    const trySpot = (into: THREE.Vector3[], x: number, z: number) => {
      const y = floorAt(x, z);
      if (y !== null) into.push(new THREE.Vector3(x, underHole(x, z, y) + 0.01, z));
    };
    // A place's loot goes on ANY floor at that spot, picked at random from the
    // ones with headroom, so a two-storey building holds loot upstairs and on
    // its roof as well as on its ground floor. That is the reason to go in.
    const trySpotAnyFloor = (into: THREE.Vector3[], x: number, z: number): void => {
      const floors = standingSpots(x, z);
      if (!floors.length) return;
      const y = floors[Math.floor(rnd() * floors.length)];
      into.push(new THREE.Vector3(x, underHole(x, z, y) + 0.01, z));
    };
    const fill = (spots: THREE.Vector3[], tier: PlaceTier) => {
      for (const s of spots) {
        for (const item of rollSpot(rnd, tier)) {
          const off = new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2);
          this.add(item, s.clone().add(off));
        }
      }
    };
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const hot = this.hotZone?.index === i;
      const tier: PlaceTier = hot ? "hot" : tierOf(p);
      const spots: THREE.Vector3[] = [];
      let tries = 0;
      const want = IS_SK && PROFILE.loot ? (PROFILE.loot.spots[tier] ?? PROFILE.loot.spots.mid) : cfg.tiers[tier].spots;
      while (spots.length < want && tries++ < want * 12) {
        const a = rnd() * Math.PI * 2;
        // out to the place's own reach: West Town's clocktower is 34 m and more from its middle
        const reach = Math.max(cfg.placeReachMin, p.radius ?? 0);
        const r = 4 + rnd() * (reach - 4);
        trySpotAnyFloor(spots, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      }
      fill(spots, tier);
      if (hot) {
        this.hotSpots = spots.map((s) => s.clone());
        this.hotStock = this.hotHeld().length;
      }
    }

    const field: THREE.Vector3[] = [];
    for (let i = 0; i < cfg.fieldSpots; i++) trySpot(field, bounds.minX + 20 + rnd() * (bounds.maxX - bounds.minX - 40), bounds.minZ + 20 + rnd() * (bounds.maxZ - bounds.minZ - 40));
    fill(field, cfg.fieldTier as PlaceTier);
    // (the legacy game's kitted prize gun was laid here, on one of the Hot Zone's own spots: off in SpeedKills from
    // Milestone 499, where it laid guns off the roster, and gone with the attachments it wore in 522)
    // The small sites between the places, last: their own tier, out to their
    // own reach (they are small, so no floor on it), and never the Hot Zone.
    // Rolled after everything else so the places, the field and the kitted
    // gun draw exactly what they drew before there were sites.
    const siteTier = cfg.siteTier as PlaceTier;
    for (const p of sites) {
      const spots: THREE.Vector3[] = [];
      let tries = 0;
      const reach = Math.max(6, p.radius ?? 18);
      // (a site's own tier where it has one, and on its own floor alone where it names one: THE VAULT is one floor of
      // the Neon tower, and the floors over and under it are other floors)
      const tier = (p.tier ?? siteTier) as PlaceTier;
      const floorY = p.y;
      while (spots.length < cfg.tiers[tier].spots && tries++ < 200) {
        const a = rnd() * Math.PI * 2;
        const r = 2 + rnd() * (reach - 2);
        const [x, z] = [p.x + Math.cos(a) * r, p.z + Math.sin(a) * r];
        if (floorY === undefined) trySpotAnyFloor(spots, x, z);
        else {
          // (its own floor's boxes under the spot and a standing body's room over it: the tower's floors are halls,
          // which standingSpots leaves to the halls' own loot below)
          const here = solidsIn(x - 0.3, x + 0.3, z - 0.3, z + 0.3).filter((s) => x > s.minX - 0.3 && x < s.maxX + 0.3 && z > s.minZ - 0.3 && z < s.maxZ + 0.3);
          const floor = here.find((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && Math.abs(s.top - floorY) < 0.3);
          if (floor && !here.some((s) => s.base < floor.top + 1.9 - 1e-4 && s.top > floor.top + 0.05)) spots.push(new THREE.Vector3(x, floor.top + 0.01, z));
        }
      }
      fill(spots, tier);
    }
    // The metro under SpeedKills' centre (floors.ts), after everything and on a stream of its own, so everything above
    // draws what it drew before there was one: spots down every side of the tunnel on its floor, clear of its train
    // and its stairs
    const M = cfg.metro;
    const metroRnd = seeded((seed ^ 0x7e1d3a95) >>> 0);
    for (const f of FLOORS) {
      const spots: THREE.Vector3[] = [];
      for (let tries = 0; spots.length < M.perSide && tries < M.perSide * 20; tries++) {
        const x = f.minX + 1.5 + metroRnd() * (f.maxX - f.minX - 3);
        const z = f.minZ + 1.5 + metroRnd() * (f.maxZ - f.minZ - 3);
        const blocked = solidsIn(x - 1, x + 1, z - 1, z + 1).some((s) => x > s.minX - 1 && x < s.maxX + 1 && z > s.minZ - 1 && z < s.maxZ + 1 && s.base < f.y + 1.9 && s.top > f.y + 0.05);
        if (!blocked) spots.push(new THREE.Vector3(x, f.y + 0.01, z));
      }
      for (const s of spots) for (const item of rollSpot(metroRnd, M.tier as PlaceTier)) this.add(item, s.clone().add(new THREE.Vector3((metroRnd() - 0.5) * 0.8, 0, (metroRnd() - 0.5) * 0.8)));
    }
    // The podium halls (floors.ts HALL_FLOORS, Phase 24.4), last and on a stream of their own as the metro's: spots over
    // each hall's floor, clear of its columns and counters
    const Hl = cfg.halls;
    const hallRnd = seeded((seed ^ 0x4a11f10a) >>> 0);
    // (with a floor under the spot: a hall need not be floored all over, the Neon tower's floors stop at the grooves down
    // its faces; the old city's halls are floored wall to wall and draw what they drew)
    const floored = (x: number, z: number, y: number) => Math.abs(worldFloor(x, z) - y) < 0.15 || solidsIn(x, x, z, z).some((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && Math.abs(s.top - y) < 0.15);
    for (const f of HALL_FLOORS) {
      const spots: THREE.Vector3[] = [];
      for (let tries = 0; spots.length < Hl.perHall && tries < Hl.perHall * 20; tries++) {
        const x = f.minX + 1.5 + hallRnd() * (f.maxX - f.minX - 3);
        const z = f.minZ + 1.5 + hallRnd() * (f.maxZ - f.minZ - 3);
        const blocked = solidsIn(x - 1, x + 1, z - 1, z + 1).some((s) => x > s.minX - 1 && x < s.maxX + 1 && z > s.minZ - 1 && z < s.maxZ + 1 && s.base < f.y + 1.9 && s.top > f.y + 0.05);
        if (!blocked && floored(x, z, f.y)) spots.push(new THREE.Vector3(x, f.y + 0.01, z));
      }
      for (const s of spots) for (const item of rollSpot(hallRnd, Hl.tier as PlaceTier)) this.add(item, s.clone().add(new THREE.Vector3((hallRnd() - 0.5) * 0.8, 0, (hallRnd() - 0.5) * 0.8)));
    }
    // The districts made of the packs' own demo scenes (floors.ts DISTRICT_FLOORS, Phase 25), on a stream of their own
    // as the halls': spots on each one's canyons' floor and its walkways, a metre and more from any edge, since a spot's
    // items are spread round it; `walkways` of them up on the walkways, drawn from the walkways' own decks (the
    // collision's boxes at a walkway's height, by their area): drawn over the whole plan, a narrow walkway lost to the
    // canyons' floor
    const Dl = cfg.districts;
    const districtRnd = seeded((seed ^ 0x0d157c75) >>> 0);
    for (const f of DISTRICT_FLOORS) {
      const onPlan = (x: number, z: number): boolean => {
        let n = false;
        for (let i = 0, j = f.plan.length - 1; i < f.plan.length; j = i++) {
          const [xi, zi] = f.plan[i];
          const [xj, zj] = f.plan[j];
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
        }
        return n;
      };
      const spots: THREE.Vector3[] = [];
      const upWant = Math.round(Dl.perDistrict * Dl.walkways);
      let up = 0;
      const decks = RANGE_SOLIDS.filter((s) => s.top >= f.walkway[0] && s.top <= f.walkway[1] && (s.maxX - s.minX) * (s.maxZ - s.minZ) >= 1 && onPlan((s.minX + s.maxX) / 2, (s.minZ + s.maxZ) / 2));
      const deckArea = decks.reduce((a, s) => a + (s.maxX - s.minX) * (s.maxZ - s.minZ), 0);
      const onDeck = (): [number, number] => {
        let r = districtRnd() * deckArea;
        for (const s of decks) {
          const a = (s.maxX - s.minX) * (s.maxZ - s.minZ);
          if (r < a) return [s.minX + districtRnd() * (s.maxX - s.minX), s.minZ + districtRnd() * (s.maxZ - s.minZ)];
          r -= a;
        }
        return [f.minX, f.minZ];
      };
      for (let tries = 0; spots.length < Dl.perDistrict && tries < Dl.perDistrict * 80; tries++) {
        const [x, z] = up < upWant && decks.length ? onDeck() : [f.minX + districtRnd() * (f.maxX - f.minX), f.minZ + districtRnd() * (f.maxZ - f.minZ)];
        if (!onPlan(x, z)) continue;
        const y = standingSpots(x, z).find((h) => h === 0 || (h >= f.walkway[0] && h <= f.walkway[1]));
        if (y === undefined) continue;
        // (a share full, its spot is passed over)
        if (y > 0 ? up >= upWant : spots.length - up >= Dl.perDistrict - upWant) continue;
        const firm = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dz]) => standingSpots(x + dx, z + dz).some((h) => Math.abs(h - y) < 0.2));
        if (!firm) continue;
        spots.push(new THREE.Vector3(x, y + 0.01, z));
        if (y > 0) up++;
      }
      for (const s of spots) for (const item of rollSpot(districtRnd, Dl.tier as PlaceTier)) this.add(item, s.clone().add(new THREE.Vector3((districtRnd() - 0.5) * 0.8, 0, (districtRnd() - 0.5) * 0.8)));
    }
    // (the hot zone's stock counted again once everything is down: the tower's floors are halls, filled after the hot
    // place's own spots and inside its circle, and counted only among what it holds, a restock waited for less than 60% of
    // what it started with plus all of theirs; with the tower's three levels and its crown the e2e's crowd, taking 70%,
    // left more than that and none came back)
    if (this.hotZone) this.hotStock = this.hotHeld().length;
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
      if (d.item.kind === "echo") continue;
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

  /** draw only what is near; the items turn slowly (their boxes, in the batches) */
  update(cam: THREE.Vector3, now: number): void {
    if (this.headless) return;
    const far2 = cfg.drawDistance * cfg.drawDistance;
    for (const d of this.drops.values()) {
      const v = d.pos.distanceToSquared(cam) < far2;
      d.obj.visible = v;
      if (!v) continue;
      this.drawBatched(d, now, d.pos.distanceToSquared(cam) < CORE_DETAIL2);
    }
    for (const b of this.batches.values()) b.close();
  }

  get count(): number {
    return this.drops.size;
  }
}

export const LOOT = cfg;
