// The motion-captured figure: Quaternius's mannequin and his Universal
// Animation Library clips (CC0; public/models/mannequin), in place of the
// robot built in code, when Settings says "Figures: mannequins".
//
// It is the default figure; the robot is the setting's other choice and the
// fallback until the files have loaded. The library's clips are pistol clips
// (it has no rifle set), so a pistol is held as the aim clip holds it, and a
// long gun is not: it hangs off the chest with its stock in the right
// shoulder, and both arms reach onto it (a two-bone IK to the grip and the
// handguard), lowered and canted across the body for a sprint or a swap. The
// hit zones are the Dummy's own invisible boxes either way, so the choice
// changes nothing about what a bullet hits.
//
// The body is two layers. The legs (and the hips' bob) play the locomotion
// clip for the stance and speed: idle, walk, jog, sprint, crouched, backward
// by running the clip in reverse. The upper body plays the hands' clip: the
// aim pose, the reload, the heal, the gun lowered for a sprint or a swap; an
// unarmed figure's arms swing with the legs. Then, on top of the clips, the
// same corrections the robot makes: the hips turn toward a strafe and the
// spine turns back onto the aim, the spine bends to the look pitch, a shot
// kicks, a hit flinches, a JOLT leans.
import * as THREE from "three";
import { fitGlint, fitMuzzle } from "./muzzle";
import { opticInfo } from "./optics";
import { ammoTypeOf } from "./ammo";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { displayGunModel } from "./gunmodels";
import { LOWER as CARRY, REACH, gripAt, reachFraction, stockBehind } from "./hold";
import type { OperatorSkin } from "./operators";
import { buildGear, type GearPiece } from "./gear";
import { OUR_GEOMETRY, buildOutfit, outfitMaterials } from "./outfit";
import outfitCfg from "../config/outfits.json";
import vmCfg from "../config/viewmodel.json";
import figureCfg from "../config/figure.json";
import perfCfg from "../config/perf.json";
import { slow } from "./slow";
import soldierHold from "../config/soldierhold.json";
import finCfg from "../config/finisher.json";
import feelCfg from "../config/gunfeel.json";
import { newSweep, phaseMeshes, type PhaseSweep } from "./phase";
import type { FigurePose } from "./dummy";
import type { EmotePose } from "./emotes";
import { IS_SK, PROFILE } from "./game";
import { loadSoldier, lookOf, readSoldierCode, soldierCode, soldierMaterial, soldierScene, SOLDIER_VARIANTS, type SoldierLook } from "./soldier";
import { retargetClip, retargeter, rigOf, type Retargeter } from "./retarget";
import { buttOf, FIRST_PERSON_RELOAD, gunScaleOf, holdRifle, measureRifleRig, pistolStance, RIFLE_BONES, shoulderGain, sizeFingers, supportOf, SWAP_CUP, tacticalOf, type ReloadParts, type RifleOut, type RifleRig } from "./rifle";
import { resolveWeapon } from "./weapons";

export type FigureStyle = "robot" | "mannequin";
let style: FigureStyle = "robot";
/** what new figures are built as (Settings); the robot until the mannequin has loaded */
export function setFigureStyle(s: FigureStyle): void {
  style = s;
  if (s === "mannequin") void loadMannequin();
}
export function useMannequin(): boolean {
  // (SpeedKills: robots until its soldier is ready, not the legacy body it never shows, whose figures fetched its outfits)
  return style === "mannequin" && template !== null && !soldierPending;
}

interface Template {
  scene: THREE.Object3D;
  /** the clips split in two: "lower:Walk_Loop", "upper:Pistol_Reload", and whole ones: "full:Slide_Loop" */
  clips: Map<string, THREE.AnimationClip>;
  /** the right hand's place in the aim pose, figure space (where a pistol's grip goes) */
  handAim: THREE.Matrix4;
  /** the upper chest bone in the aim pose, figure space (a rifle's mount hangs off it) */
  chestAim: THREE.Matrix4;
  /** the right shoulder in the aim pose, figure space (a rifle's stock goes to it) */
  shoulderR: THREE.Vector3;
  /** SpeedKills' soldier: its rifle hold's measures (rifle.ts), off its rest pose */
  rifle?: RifleRig | null;
}
let template: Template | null = null;
let loading: Promise<void> | null = null;
/**
 * SpeedKills' soldier (soldier.ts), once its files and its clips are in: the game's clips carried over to its rig
 * (retarget.ts), and its hand and chest sampled in the aim pose on it. Figures made before it is ready are the
 * figures of before, and keep their own template, so no figure ever plays another rig's clips.
 */
let soldierTemplate: Template | null = null;
let soldierMap: Retargeter | null = null;
/**
 * SpeedKills' soldier is on its way: until its template is made, or its files turn out not to be here, no figure is
 * built on the legacy body (and none of its outfits fetched). The legacy body was the first figure a SpeedKills page
 * made and then never showed, and it and its outfits were the last 3.5 MB the page's first screen waited for
 * (2026-10-03).
 */
let soldierPending = IS_SK;
/** the clips as they came, kept so the soldier's are made from all of them whenever it arrives */
const rawClips: THREE.AnimationClip[] = [];
/** the soldier is what new figures are (SpeedKills with its files here) */
export function soldierReady(): boolean {
  return soldierTemplate !== null;
}
/** the figures' loading is over, whichever way it went (the body, its clips, the soldier and their retargeting) */
let figuresDone = false;
/**
 * Nothing more is coming for the figures: never asked for, failed, or in, the soldier's clips carried over. The intro
 * card waits for it (intro.ts): retargeting the soldier's clips is a half-second stall that landed on the card.
 */
export function figuresSettled(): boolean {
  return loading === null || figuresDone;
}
/** a figure's look: the one chosen, else one from its operator, so the operators still read as different people */
function soldierLookFor(skin: OperatorSkin): SoldierLook {
  const chosen = readSoldierCode(skin.soldier);
  if (chosen) return chosen;
  let h = 0;
  for (const c of skin.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const l = lookOf(SOLDIER_VARIANTS[h % SOLDIER_VARIANTS.length]);
  l.skin = h % 6;
  l.eyes = 1 + (h % 5);
  return l;
}

/**
 * The garment PARTS: a body, arms, legs, feet, a hood, a shoulder guard, each
 * its own skinned mesh on the same universal rig. This is what a modular
 * outfit pack is for - a ranger's legs under a peasant's shirt is an outfit
 * neither set shipped - and it is how an outfit is real cloth without being a
 * whole second figure.
 *
 * They load ON DEMAND. Loading them all beside the body put 15 MB on every
 * page whether anything wore them or not, and the e2e felt it twice: a mode
 * test and a Resurgence test each found a match that had not started yet. A
 * figure now asks for what its own outfit needs.
 */
const parts = new Map<string, THREE.SkinnedMesh[]>();
const partLoads = new Map<string, Promise<unknown>>();

/**
 * EVERY skinned mesh in a loaded part, not the first one.
 *
 * A ranger's body is three meshes - the coat and two belts - and taking only
 * the first of them put a belt on a bare chest. That is the "the clothes
 * aren't fully covering the body" the owner saw.
 */
function skinnedIn(o: THREE.Object3D): THREE.SkinnedMesh[] {
  const found: THREE.SkinnedMesh[] = [];
  o.traverse((c) => {
    const m = c as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) found.push(m);
  });
  return found;
}

/**
 * A garment sits exactly on the skin it was modelled over, so the body shows
 * through wherever the two meet. Pushing the cloth out along its own normals
 * by a few millimetres puts it outside the skin everywhere at once, which is
 * what a shell offset is for. Done once per part, on the geometry every
 * figure wearing it shares.
 */
const OVER_CLOTH = outfitCfg.fit.overCloth as number;
function inflate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.clone();
  if (!out.attributes.normal) out.computeVertexNormals();
  const p = out.attributes.position as THREE.BufferAttribute;
  const n = out.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * OVER_CLOTH, p.getY(i) + n.getY(i) * OVER_CLOTH, p.getZ(i) + n.getZ(i) * OVER_CLOTH);
  }
  p.needsUpdate = true;
  out.computeBoundingSphere();
  return out;
}

/**
 * The bodies. There are two in the pack, a heavier and a lighter build of the
 * same rig, and a garment is cut for one of them: the ranger's coat shaped for
 * the second sits wrong on the first. So an outfit names the body its clothes
 * were made for, and the figure is built on that one.
 *
 * The skeleton is identical either way, which is the part that matters for a
 * shooter: the hit boxes are built from the bones, so nobody is a bigger or a
 * smaller target for the body their clothes came on.
 */
const bodies = new Map<string, THREE.Object3D>();
const bodyLoads = new Map<string, Promise<unknown>>();
const DEFAULT_BODY = "Superhero_Male_FullBody";

/**
 * The body a figure is built on: the one its player picked, or the one its
 * outfit names, or the default. Every garment binds to either body, so the
 * pick is free rather than tied to the clothes.
 */
export function bodyOf(outfit: string, picked?: string): string {
  if (picked && picked in (outfitCfg.bodies as Record<string, unknown>)) return picked;
  return ((outfitCfg.sets as Record<string, { body?: string }>)[outfit]?.body ?? DEFAULT_BODY) as string;
}

/**
 * How a torso is shaped: the body brought in so the cloth closes on it, and
 * the build a player picked, both as one width factor that eases in up the
 * chest and back out at the neck.
 *
 * The clothes in this pack are cut for the pack's Regular build; the free tier
 * ships the Superhero one, 424 mm across the shoulders, and a coat cut for the
 * slimmer body gapes on it - a bare back with a collar and a belt, which is
 * what the owner saw. Narrowing the BODY (not the skeleton, so nothing about
 * the hit boxes or the animation changes) puts it back inside the cloth.
 *
 * By HEIGHT, not uniformly: this build's bulk is in the traps and the lats,
 * and a tenth off everywhere still left a bare upper back inside a coat that
 * closed at the waist. And eased back OUT above the shoulders: the first cut
 * held the full narrowing all the way up, so the head was 29% narrower than
 * the skull the hair and the hood were made for. The numbers are per body and
 * measured (outfits.json fit.torso).
 */
interface Torso {
  from: number;
  to: number;
  neck: number;
  head: number;
  chest: number;
  armFrom: number;
  armTo: number;
  upperArm?: number;
}
const TORSO = outfitCfg.fit.torso as Record<string, Torso>;

/** a build's width across the chest, 1 for the one the clothes were cut to */
function buildWidth(build: string): number {
  const b = (outfitCfg.builds as Record<string, { shoulders: number }>)[build];
  return b ? b.shoulders : 1;
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** the bones that make a vertex part of an arm rather than the torso */
const ARM_BONE = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;

/**
 * A copy of `g` with its torso brought to `target` of its width and depth.
 * The body gets its measured narrowing times the build; a garment gets the
 * build alone, and so the two move together and the fit between them holds.
 *
 * What counts as the torso is decided by the skin weights: a vertex is arm
 * in the proportion the arm bones move it. The first cut decided by distance
 * from the middle, and at armpit height that caught the lats as well, which
 * kept their full width and showed as skin at the back of every armpit.
 */
function shapeTorso(g: THREE.BufferGeometry, t: Torso, target: number, bones: string[]): THREE.BufferGeometry {
  if (target === 1) return g;
  const out = g.clone();
  const p = out.attributes.position as THREE.BufferAttribute;
  const si = out.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const sw = out.attributes.skinWeight as THREE.BufferAttribute | undefined;
  const isArm = bones.map((b) => ARM_BONE.test(b));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // Arms are left alone. In the bind pose they are out at shoulder height,
    // so narrowing them dragged the hands in off their own wrist bones and
    // the skinning stretched them into fans.
    let arm = 0;
    if (si && sw) {
      arm = (isArm[si.getX(i)] ? sw.getX(i) : 0) + (isArm[si.getY(i)] ? sw.getY(i) : 0) + (isArm[si.getZ(i)] ? sw.getZ(i) : 0) + (isArm[si.getW(i)] ? sw.getW(i) : 0);
    } else arm = smooth(t.armFrom, t.armTo, Math.abs(x));
    const ease = smooth(t.from, t.to, y) * (1 - smooth(t.neck, t.head, y)) * (1 - Math.min(1, arm));
    const k = 1 + (target - 1) * ease;
    p.setXYZ(i, x * k, y, p.getZ(i) * k);
  }
  p.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/**
 * A copy of `g` with each upper arm brought in around its own bone to `k` of
 * its thickness: fully for the first 60% of the way to the elbow, and back to
 * nothing at it, so the forearm and the hand stay where the clips put them.
 * The free body's upper arm is 101 to 104 mm out from the bone through the
 * deltoid and the sleeves are cut for 60 to 69 (outfits.json fit.torso), so
 * the back of every shoulder showed through the top of the sleeve.
 */
function shapeUpperArms(g: THREE.BufferGeometry, skeleton: THREE.Skeleton, k: number): THREE.BufferGeometry {
  if (k === 1) return g;
  const out = g.clone();
  const p = out.attributes.position as THREE.BufferAttribute;
  const si = out.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const sw = out.attributes.skinWeight as THREE.BufferAttribute | undefined;
  if (!si || !sw) return g;
  const names = skeleton.bones.map((b) => b.name);
  const rest = (name: string): THREE.Vector3 | null => {
    const i = names.indexOf(name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const v = new THREE.Vector3();
  for (const side of ["l", "r"]) {
    const ua = names.indexOf(`upperarm_${side}`);
    const a = rest(`upperarm_${side}`);
    const b = rest(`lowerarm_${side}`);
    if (ua < 0 || !a || !b) continue;
    const axis = b.clone().sub(a);
    const len = axis.length();
    axis.normalize();
    for (let i = 0; i < p.count; i++) {
      let w = 0;
      if (si.getX(i) === ua) w += sw.getX(i);
      if (si.getY(i) === ua) w += sw.getY(i);
      if (si.getZ(i) === ua) w += sw.getZ(i);
      if (si.getW(i) === ua) w += sw.getW(i);
      if (w <= 0) continue;
      v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(a);
      const along = v.dot(axis);
      const s = 1 + (k - 1) * Math.min(1, w) * (1 - smooth(0.6, 1, along / len));
      // the offset from the bone's own line is what is brought in; the
      // position along the bone is kept, so the arm is no shorter
      const px = a.x + axis.x * along + (v.x - axis.x * along) * s;
      const py = a.y + axis.y * along + (v.y - axis.y * along) * s;
      const pz = a.z + axis.z * along + (v.z - axis.z * along) * s;
      p.setXYZ(i, px, py, pz);
    }
  }
  p.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/** the bones whose skin is seen through any outfit: face, neck, forearms, hands */
const SKIN_BONE = /^(head|neck_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/i;
const UNDERSUIT = new THREE.Color(outfitCfg.fit.undersuit as string);

/**
 * A copy of `g` with a vertex colour that keeps the skin where it is seen and
 * takes it to the undersuit's colour where the clothes always cover it.
 *
 * Shaping the body closes the big gaps; it cannot close every seam, because
 * each garment piece was cut against a body we do not have and each seam
 * against a different outline. A seam that shows a dark undersuit reads as
 * fabric or shadow; one that shows skin reads as a hole in the clothes.
 */
function undersuit(g: THREE.BufferGeometry, bones: string[]): THREE.BufferGeometry {
  const si = g.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute | undefined;
  if (!si || !sw) return g;
  const out = g.clone();
  const skin = bones.map((b) => SKIN_BONE.test(b));
  const n = out.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = Math.min(1, (skin[si.getX(i)] ? sw.getX(i) : 0) + (skin[si.getY(i)] ? sw.getY(i) : 0) + (skin[si.getZ(i)] ? sw.getZ(i) : 0) + (skin[si.getW(i)] ? sw.getW(i) : 0));
    // eased, so the change sits under a collar or a cuff rather than on show
    const e = s * s * (3 - 2 * s);
    col[i * 3] = UNDERSUIT.r + (1 - UNDERSUIT.r) * e;
    col[i * 3 + 1] = UNDERSUIT.g + (1 - UNDERSUIT.g) * e;
    col[i * 3 + 2] = UNDERSUIT.b + (1 - UNDERSUIT.b) * e;
  }
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

/** a body in a build, made once from the body as it was loaded */
const shaped = new Map<string, THREE.Object3D>();
function bodyFor(name: string, build: string): THREE.Object3D | null {
  const key = `${name}|${build}`;
  const had = shaped.get(key);
  if (had) return had;
  const raw = bodies.get(name);
  const t = TORSO[name];
  if (!raw) return null;
  const out = cloneSkinned(raw);
  if (t) {
    const target = t.chest * buildWidth(build);
    out.traverse((c) => {
      const m = c as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      m.geometry = shapeTorso(m.geometry, t, target, m.skeleton.bones.map((x) => x.name));
      m.geometry = shapeUpperArms(m.geometry, m.skeleton, t.upperArm ?? 1);
      // the skin itself, not the eyes or the brows that share its skeleton
      if ((m.material as THREE.Material).name.startsWith("MI_Superhero")) m.geometry = undersuit(m.geometry, m.skeleton.bones.map((x) => x.name));
    });
  }
  shaped.set(key, out);
  return out;
}

/** a garment mesh's geometry for a build on a body, made once */
const garmentShapes = new Map<string, THREE.BufferGeometry>();
function garmentFor(src: THREE.SkinnedMesh, key: string, body: string, build: string): THREE.BufferGeometry {
  const t = TORSO[body];
  const w = buildWidth(build);
  if (!t || w === 1) return src.geometry;
  const k = `${key}|${body}|${build}`;
  let g = garmentShapes.get(k);
  if (!g) {
    g = shapeTorso(src.geometry, t, w, src.skeleton.bones.map((x) => x.name));
    garmentShapes.set(k, g);
  }
  return g;
}

/** fetch a body, once */
export function loadBody(name: string): Promise<unknown> {
  const had = bodyLoads.get(name);
  if (had) return had;
  const job = new GLTFLoader()
    .loadAsync(`models/body/${name}.gltf`)
    .then((g) => {
      bodies.set(name, g.scene);
    })
    .catch(() => null);
  bodyLoads.set(name, job);
  return job;
}

/**
 * An outfit's own recoloured atlas (tools/tint-outfits.ts), loaded once.
 *
 * Multiplying a colour into the material was the first try and it could only
 * darken, so every outfit stayed in the atlas's own brown-green family and
 * ARCTIC's white came out as a pale coat. The colour lives in the picture now:
 * the artist's folds and seams as luminance, the outfit's colour over them.
 */
const tintMaps = new Map<string, THREE.Texture | null>();
const tintLoads = new Map<string, Promise<unknown>>();

/**
 * The pack a garment came out of, which decides which atlas reads its UVs.
 *
 * An outfit borrows from both sets now - a ranger's body over a peasant's
 * legs is a different outline from either, and outlines are what the wardrobe
 * is short of - and the two sets lay their UVs out differently. One atlas per
 * outfit put a peasant shirt in a ranger's seams.
 */
function packOf(part: string): string | null {
  return part.includes("Ranger") ? "Ranger" : part.includes("Peasant") ? "Peasant" : null;
}

function tintMap(outfit: string, part: string): THREE.Texture | null {
  const pack = packOf(part);
  return pack ? (tintMaps.get(`${outfit}_${pack}`) ?? null) : null;
}

/**
 * Fetch an outfit's own atlas, once, and only when it has one.
 *
 * Nine of the twenty outfits wear the pack's own colours and have no
 * recoloured atlas made for them. Asking for one anyway was a 404 each, which
 * the catch swallowed and the console did not: the e2e's "no page errors"
 * check is what noticed.
 */
export function loadTint(outfit: string): Promise<unknown> {
  const had = tintLoads.get(outfit);
  if (had) return had;
  const packs = [...new Set(partsOf(outfit).map(packOf))].filter((p): p is string => !!p);
  if (tintOf(outfit) === null || !packs.length) {
    const none = Promise.resolve(null);
    tintLoads.set(outfit, none);
    return none;
  }
  const job = Promise.all(
    packs.map((pack) => {
      const key = `${outfit}_${pack}`;
      return new THREE.TextureLoader()
        .loadAsync(`models/outfits/tints/${key}.webp`)
        .then((t) => {
          t.flipY = false;
          t.colorSpace = THREE.SRGBColorSpace;
          t.needsUpdate = true;
          tintMaps.set(key, t);
        })
        .catch(() => {
          tintMaps.set(key, null);
        });
    })
  );
  tintLoads.set(outfit, job);
  return job;
}

/** the colour an outfit paints its garments, or null for the asset's own */
export function tintOf(outfit: string): number | null {
  const t = (outfitCfg.sets as Record<string, { tint?: string }>)[outfit]?.tint;
  return typeof t === "string" ? parseInt(t.replace("#", ""), 16) : null;
}

/** what an outfit is made of, or nothing when it is built in code */
export function partsOf(outfit: string): string[] {
  return (((outfitCfg.sets as Record<string, { parts?: string[] }>)[outfit]?.parts ?? []) as string[]).slice();
}

/**
 * The hair an outfit wears. It is fetched and worn exactly like a garment,
 * because it is one: the pack rigs each style to the same 65 joints, so a
 * hairstyle binds to the figure's own skeleton and turns with the head.
 *
 * What it is NOT is tinted. A garment gets the outfit's colour; hair keeps
 * the colour the pack gave it, or every figure in an olive outfit would have
 * olive hair.
 */
export function hairOf(outfit: string, picked?: string): string[] {
  const named = ((outfitCfg.sets as Record<string, { hair?: string[] }>)[outfit]?.hair ?? []) as string[];
  // an outfit's hair was chosen for the male body; a body can swap it
  const swap = (outfitCfg.bodies as Record<string, { hair?: Record<string, string | null> }>)[bodyOf(outfit, picked)]?.hair;
  if (!swap) return named.slice();
  const out: string[] = [];
  for (const h of named) {
    const to = h in swap ? swap[h] : h;
    if (to && !out.includes(to)) out.push(to);
  }
  return out;
}

/**
 * The colour hair is painted. The pack ships its hair as a greyscale mask,
 * mean 143 of 255 measured off the webp, and leaves the colouring to the
 * engine; without this every figure is white haired.
 */
export function hairTintOf(outfit: string): number {
  const t = (outfitCfg.sets as Record<string, { hairColor?: string }>)[outfit]?.hairColor;
  return typeof t === "string" ? parseInt(t.replace("#", ""), 16) : 0x3a2c20;
}

/** hair lives beside the bodies it belongs to, a garment in its own folder */
function partUrl(name: string): string {
  return name.startsWith("Hair_") ? `models/body/hair/${name}.gltf` : `models/outfits/parts/${name}.gltf`;
}

/** fetch an outfit's parts, once each; resolves when they are all in or given up on */
export function loadOutfit(outfit: string): Promise<unknown> {
  const loader = new GLTFLoader();
  return Promise.all(
    // the hair for every body, since which one wears the outfit is a pick
    [...new Set([...partsOf(outfit), ...Object.keys(outfitCfg.bodies).flatMap((b) => hairOf(outfit, b))])].map((n) => {
      const had = partLoads.get(n);
      if (had) return had;
      const job = loader
        .loadAsync(partUrl(n))
        .then((g) => {
          const found = skinnedIn(g.scene);
          // Only the layer against the skin is pushed out. The shell exists so
          // cloth and skin stop fighting over the same pixels, and a piece
          // that was never against the skin does not need it: a pauldron sits
          // on the coat and lifted clear of the shoulder when it got one, a
          // hood sits on the head, and hair sits on the scalp. Measured off
          // the parts: the pauldron spans y 1437..1575 mm against the sleeve's
          // 1380..1530, so it is already 45 mm proud before anything moves it.
          if (/_(Body|Arms|Legs|Feet)(_|$)/.test(n)) for (const m of found) m.geometry = inflate(m.geometry);
          if (found.length) parts.set(n, found);
        })
        .catch(() => null);
      partLoads.set(n, job);
      return job;
    })
  );
}


/** the bones below the waist: the locomotion layer's */
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

/** clips into the map three ways: the legs', the rest of the body's, and whole */
function addClips(clips: Map<string, THREE.AnimationClip>, list: THREE.AnimationClip[]): void {
  for (const c of list) {
    const lower = c.tracks.filter((t) => LOWER.test(t.name.split(".")[0]));
    const upper = c.tracks.filter((t) => !LOWER.test(t.name.split(".")[0]));
    clips.set(`lower:${c.name}`, new THREE.AnimationClip(`lower:${c.name}`, c.duration, lower));
    clips.set(`upper:${c.name}`, new THREE.AnimationClip(`upper:${c.name}`, c.duration, upper));
    clips.set(`full:${c.name}`, c);
  }
}

// ------------------------------------------------------------ the fit test

/**
 * The fit test's paint (tools/snap.ts `magentaMax`, docs/TEST_AUDIT.md). The
 * body where clothes always cover it (the undersuit, undersuit()) is drawn
 * flat, unlit magenta, and the rest of it (face, neck, forearms, hands) not at
 * all, so every magenta pixel in a picture is body showing through clothes,
 * counted rather than looked for. It is how the bare backs and the shoulders
 * through the sleeves were found by eye, made into something a check can fail.
 */
let fitDebug = false;
const bodyMeshes = new Set<THREE.SkinnedMesh>();
let fitMat: THREE.MeshBasicMaterial | null = null;
function fitMaterial(): THREE.MeshBasicMaterial {
  if (!fitMat) {
    fitMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    fitMat.toneMapped = false;
    fitMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        ["#include <color_fragment>", "  if (vColor.r > 0.5) discard;", "  diffuseColor = vec4(1.0, 0.0, 1.0, 1.0);"].join(String.fromCharCode(10))
      );
    };
  }
  return fitMat;
}
/** paint every figure's clothed body magenta (on) or put their own material back (off) */
export function setFitDebug(on: boolean): void {
  fitDebug = on;
  for (const m of bodyMeshes) m.material = on ? fitMaterial() : (m.userData.ownMaterial as THREE.Material);
}

/** a clip is in (the extras arrive after the figures do) */
export function hasClip(name: string): boolean {
  return !!template?.clips.has(`full:${name}`);
}

/** a clip's length, s, or 0 when it is not in */
function clipSeconds(name: string): number {
  return template?.clips.get(`full:${name}`)?.duration ?? 0;
}

/** horizontal speed, m/s, above which a jump is the athletic one (figure.json) */
const ATHLETIC_JUMP = figureCfg.athleticJump;
/** a double jump's knee lift: how long, and how far the thighs come up and the knees bend, degrees (figure.json doubleJump) */
const DOUBLE_JUMP = figureCfg.doubleJump;
/** standing or crouched still, each foot's toe brought down to its bind pose's (figure.json flatFeet) */
const FLAT_FEET = figureCfg.flatFeet;
/** the soldier's head held up to where it looks, against the chest's lean (figure.json headUp) */
const HEAD_UP = figureCfg.headUp as { hold: number; most: number };
/** the soldier's chest held no more than this far forward of upright, degrees (figure.json chestUp) */
const CHEST_UP = figureCfg.chestUp as { most: number };
/** how long the soldier's throw takes before the hands go back for the gun, s (soldierhold.json throwFor) */
const THROW_FOR = soldierHold.throwFor;
/** how far the hands have come back onto a returning long gun when it shows (soldierhold.json gunBack) */
const GUN_BACK = soldierHold.gunBack;
/** how fast a sprint jump's own carry comes in, per second (soldierhold.json airRate) */
const AIR_CARRY = soldierHold.airRate;

/** the melee swings, in the order a string of them goes through */
const MELEE_SWINGS = ["Punch_Jab", "Punch_Cross", "Melee_Hook"];

/** load the two files once; figures made after it is in use it */
export function loadMannequin(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  // The body is a different file from the clips.
  //
  // mannequin.glb is Quaternius's Universal Animation Library: a grey
  // untextured mannequin and the motion. The body is their Universal Base
  // Characters, built on the SAME universal humanoid rig - the Unreal
  // mannequin's own bone names, pelvis / spine_01..03 / clavicle_l /
  // upperarm_l / calf_l / ball_l - so the clips drive it without retargeting,
  // and the clothes hang on the bones they already hang on. It has real
  // topology, a face, and base colour, normal and roughness maps, which is
  // what the grey mannequin never had.
  // SpeedKills' soldier asked for with the clips, not after them: it is the figure, and it waited on 4.4 MB it does not need
  const soldier = IS_SK ? loadSoldier().catch(() => null) : null;
  loading = Promise.all([loader.loadAsync("models/mannequin/mannequin.glb"), loader.loadAsync("models/mannequin/mannequin-more.glb")])
    .then(([main, more]) => {
      const clips = new Map<string, THREE.AnimationClip>();
      addClips(clips, [...main.animations, ...more.animations]);
      rawClips.push(...main.animations, ...more.animations);
      // The clips a figure only plays now and then (a slide's way in and out,
      // a throw, a revive, an emote) come after it is up, so they never hold a
      // page up; until they are in, whatever would play them plays what it
      // did before (hasClip). tools/fetch-clips.ts says which are which.
      for (const extra of ["models/mannequin/mannequin-extra-1.glb", "models/mannequin/mannequin-extra-2.glb"])
        void loader
          .loadAsync(extra)
          .then((g) => {
            addClips(clips, g.animations);
            rawClips.push(...g.animations);
            if (soldierTemplate && soldierMap) addClips(soldierTemplate.clips, g.animations.map((c) => retargetClip(soldierMap!, c)));
          })
          .catch(() => null);
      // the right hand in the aim pose: sample the clip onto a copy once
      const probe = cloneSkinned(main.scene);
      const mixer = new THREE.AnimationMixer(probe);
      mixer.clipAction(clips.get("full:Pistol_Aim_Neutral")!).play();
      mixer.update(0);
      probe.updateMatrixWorld(true);
      const hand = probe.getObjectByName("hand_r")!;
      const chest = probe.getObjectByName("spine_03")!;
      const shoulder = probe.getObjectByName("upperarm_r")!;
      // The real body is an UPGRADE, not a gate.
      //
      // It was in the promise above, and that delayed the moment a figure
      // could stop being a robot by however long 3 MB of body and textures
      // takes. The e2e saw that as a bot with no spine_03 on it: it was still
      // a robot when the check ran. The grey mannequin is 4.4 MB we load
      // anyway and has the same skeleton, so figures start there, and every
      // figure built after the body arrives is the real one.
      // (Through loadBody, the one fetch a body gets: loaded here on its own, a figure asking for the same body before it
      // came fetched its file and its seven textures a second time, and held two copies of them; a hunt, 2026-09-30.)
      // (SpeedKills: only if its soldier is not here; the legacy body is not what a SpeedKills figure wears)
      const upgradeBody = (): void => {
      void loadBody(DEFAULT_BODY)
        .then(() => {
          const body = bodies.get(DEFAULT_BODY);
          if (!template || !body) return;
          template.scene = bodyFor(DEFAULT_BODY, "regular") ?? body;
          // the hand's aim pose is sampled off whatever the body is
          const p2 = cloneSkinned(body);
          const m2 = new THREE.AnimationMixer(p2);
          m2.clipAction(clips.get("full:Pistol_Aim_Neutral")!).play();
          m2.update(0);
          p2.updateMatrixWorld(true);
          template.handAim = p2.getObjectByName("hand_r")!.matrixWorld.clone();
          template.chestAim = p2.getObjectByName("spine_03")!.matrixWorld.clone();
          template.shoulderR = new THREE.Vector3().setFromMatrixPosition(p2.getObjectByName("upperarm_r")!.matrixWorld);
        })
        .catch(() => null);
      };
      if (!IS_SK) upgradeBody();

      template = { scene: main.scene, clips, handAim: hand.matrixWorld.clone(), chestAim: chest.matrixWorld.clone(), shoulderR: new THREE.Vector3().setFromMatrixPosition(shoulder.matrixWorld) };
      // SpeedKills: the bought soldier, when its files are here (they are local only; see soldier.json)
      if (soldier)
        void soldier
          .then((a) => {
            if (a) return makeSoldierTemplate(main.scene, a.scene);
            // no soldier here (a checkout without the bought files): the legacy body after all
            upgradeBody();
            return null;
          })
          .catch(() => upgradeBody())
          .finally(() => {
            soldierPending = false;
            figuresDone = true;
          });
      else figuresDone = true;
    })
    .catch((e) => {
      console.warn("the mannequin did not load; the figures stay robots", e);
      loading = null;
    });
  return loading;
}

/**
 * The soldier's template: every clip carried over to its rig, a few a tick so the page does not stall while a
 * hundred clips are resampled, then its hand, chest and shoulder sampled in the aim pose, as the body's are.
 */
async function makeSoldierTemplate(clipRig: THREE.Object3D, soldier: THREE.Object3D): Promise<void> {
  const r = retargeter(rigOf(clipRig), rigOf(soldier));
  const clips = new Map<string, THREE.AnimationClip>();
  const todo = rawClips.slice();
  for (let i = 0; i < todo.length; i += 6) {
    addClips(clips, todo.slice(i, i + 6).map((c) => retargetClip(r, c)));
    await new Promise((ok) => setTimeout(ok, 0));
  }
  // extras that came in while this ran
  for (const c of rawClips.slice(todo.length)) addClips(clips, [retargetClip(r, c)]);
  const probe = soldierScene(lookOf("VANGUARD"));
  if (!probe) return;
  const p = cloneSkinned(probe);
  const mixer = new THREE.AnimationMixer(p);
  const aim = clips.get("full:Pistol_Aim_Neutral");
  if (!aim) return;
  mixer.clipAction(aim).play();
  mixer.update(0);
  p.updateMatrixWorld(true);
  soldierMap = r;
  soldierTemplate = {
    scene: probe,
    clips,
    handAim: p.getObjectByName("hand_r")!.matrixWorld.clone(),
    chestAim: p.getObjectByName("spine_03")!.matrixWorld.clone(),
    shoulderR: new THREE.Vector3().setFromMatrixPosition(p.getObjectByName("upperarm_r")!.matrixWorld),
    // measured on a clone no clip has touched: the rest pose is the one the measures are taken in
    rifle: measureRifleRig(cloneSkinned(probe)),
  };
}

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * a gun's reload time, seconds (weapons.ts, fusion 0), from empty (the longer, with the rack) or tactical (a round
 * still chambered): how long an enemy's figure takes over its reload
 */
const reloadTimes = new Map<string, number>();
function reloadSeconds(id: string, empty: boolean): number {
  const key = `${id}|${empty}`;
  let t = reloadTimes.get(key);
  if (t === undefined) {
    try {
      const w = resolveWeapon(id, 0);
      t = empty ? w.reloadEmptyTime : w.reloadTime;
    } catch {
      t = 2;
    }
    reloadTimes.set(key, (t = Math.max(0.5, t)));
  }
  return t;
}

/** the first person's magazine phases round its own middle (fparms.json reload.magPhase), not along it */
const MAG_RADIAL = (FIRST_PERSON_RELOAD as { magPhase?: string }).magPhase === "radial";

/** a signature gun's swap phase (gunfeel.json guns.<id>.swap: shares of the swap, the model changing at its middle) */
const swapOf = (id: string): { out: number[]; in: number[] } | null => (feelCfg.guns as unknown as Record<string, { swap?: { out: number[]; in: number[] } }>)[id]?.swap ?? null;
/** a gun's holster and draw times, seconds (weapons.ts, fusion 0): what a swap's phase out and in run over */
const swapTimes = new Map<string, { holster: number; deploy: number }>();
function swapSeconds(id: string): { holster: number; deploy: number } {
  let t = swapTimes.get(id);
  if (!t) {
    try {
      const w = resolveWeapon(id, 0);
      t = { holster: Math.max(0.1, w.holsterTime), deploy: Math.max(0.1, w.deployTime) };
    } catch {
      t = { holster: 0.5, deploy: 0.5 };
    }
    swapTimes.set(id, t);
  }
  return t;
}
const tq1 = new THREE.Quaternion();
const tq2 = new THREE.Quaternion();
const tq3 = new THREE.Quaternion();
const tv = new THREE.Vector3();

/** turn a bone by `angle` about an axis given in the figure's own frame, on top of what the clip set */
function turnBone(bone: THREE.Object3D, figure: THREE.Object3D, axisLocal: THREE.Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-5 || !bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(tq1);
  const world = tq2.copy(parentQ).multiply(bone.quaternion);
  const axis = tv.copy(axisLocal).applyQuaternion(figure.getWorldQuaternion(tq3)).normalize();
  world.premultiply(tq3.setFromAxisAngle(axis, angle));
  bone.quaternion.copy(parentQ.invert().multiply(world));
}

export interface MannequinImpulses {
  kick: number;
  flinch: number;
  jolt: number;
  legYaw: number;
  ads: number;
  /** a landing's squash, 1 on touchdown */
  land?: number;
  /** when the shield last broke, on the figure's clock (a stagger) */
  stagger?: number;
  /** when the head was last hit, on the figure's clock */
  headHit?: number;
  /** how many double jumps it has made (FigurePose.airJumps): a change is a new one, and its knee lift */
  airJumps?: number;
  /** an emote in progress (emotes.ts): its angles, already eased */
  emote?: EmotePose | null;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const v5 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion();

/** turn a bone (weighted by w) so its direction `from` (world) points along `to` (world) */
function aimBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, w: number): void {
  if (!bone.parent || from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const d = q1.setFromUnitVectors(from.normalize(), to.normalize());
  if (w < 1) d.slerpQuaternions(IDENTITY, d.clone(), w);
  const world = bone.getWorldQuaternion(q2).premultiply(d);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

/**
 * How far a gun's body reaches behind its grip, metres. The model is built
 * pointing along its own -z with the grip `gripF` in front of the origin, so
 * the rearmost point of the box, measured from the grip, is what would end up
 * in the shoulder. Measured on the gun that is actually held, so an extended
 * stock or a long barrel is measured rather than assumed.
 */
function rearOfGrip(gun: THREE.Object3D, gripF: number): number {
  const box = new THREE.Box3().setFromObject(gun);
  return Math.max(0, box.max.z + gripF);
}

/** each merged geometry's head: the sum of its Head vertices in the Head bone's rest frame, and how many (MannequinFigure.headMiddle) */
const headSums = new WeakMap<THREE.BufferGeometry, { sum: THREE.Vector3; n: number }>();

/** a figure's height off its rest pose, skinned (the soldier's meshes are stored lying down), by its first mesh's geometry */
const figureHeights = new WeakMap<THREE.BufferGeometry, number>();

/** how tall a figure stands: its skinned meshes' box in its own frame, measured once for each kind of figure */
function figureHeight(root: THREE.Object3D, meshes: THREE.SkinnedMesh[]): number {
  const had = figureHeights.get(meshes[0].geometry);
  if (had !== undefined) return had;
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  for (const m of meshes) {
    m.computeBoundingBox();
    box.union(m.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld)));
  }
  const h = Math.max(0.5, box.max.y);
  figureHeights.set(meshes[0].geometry, h);
  return h;
}

/**
 * A figure's skinned meshes culled by one sphere round the figure, where they were never culled (?slow=cull puts that
 * back). Never, because a skinned mesh's bounds are its rest pose's and an animated one leaves them; but then every
 * figure in a match was drawn every frame wherever it stood, its skeleton worked out and sent to the GPU, behind you or
 * across the map (a battle royale's 29 bots: about 116 of a frame's 500 draw calls at the Neon City's street,
 * 2026-10-01). The sphere is the figure's, not each mesh's: half its height up and perf.json figureCull heights
 * across, so it holds the figure lying down with its gun, and every piece of it (an eye's own rest sphere is 4 cm
 * round its head) is drawn wherever the figure is. It is set in the figure's frame and carried into each mesh's (the
 * soldier's are stored lying down and stood up by their skeleton: a sphere off a mesh's own geometry stood 1.7 m out
 * along the ground, and the figure in front of you was not drawn).
 */
function cullAsFigure(root: THREE.Object3D, meshes: THREE.SkinnedMesh[], height: number): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  for (const m of meshes) {
    const rel = new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld);
    const centre = new THREE.Vector3(0, height / 2, 0).applyMatrix4(rel.clone().invert());
    m.boundingSphere = new THREE.Sphere(centre, (height * perfCfg.figureCull) / rel.getMaxScaleOnAxis());
  }
}

/** two skeletons over the same bones in the same rest pose: one can do for both */
const sameRig = (a: THREE.Skeleton, b: THREE.Skeleton): boolean =>
  a.bones.length === b.bones.length && a.bones.every((x, i) => x === b.bones[i]) && a.boneInverses.every((x, i) => x.equals(b.boneInverses[i]));

/**
 * A figure's skinned meshes over the same bones in the same rest pose share one skeleton (?slow=skeleton puts one each
 * back). The clone gave each of the soldier's four meshes a skeleton of its own over the same 67 bones, each worked out
 * every frame and sent to the GPU: four times over (2026-10-01, with every figure drawn: 109 bone textures a frame).
 */
function shareSkeletons(root: THREE.Object3D): void {
  const kept: THREE.Skeleton[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const same = kept.find((k) => k !== m.skeleton && sameRig(k, m.skeleton));
    if (!same) {
      if (!kept.includes(m.skeleton)) kept.push(m.skeleton);
      return;
    }
    m.skeleton.dispose();
    m.skeleton = same;
  });
}

export class MannequinFigure {
  readonly root: THREE.Object3D;
  private headMid: THREE.Vector3 | null = null;
  private mixer: THREE.AnimationMixer;
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private lowerName = "";
  private upperName = "";
  private bones: Record<string, THREE.Object3D> = {};
  /** how tall it stands, off its rest pose (figureHeight): the size of the sphere it is culled by */
  private height = 1.8;
  /**
   * The clip's own rotation of each bone this class turns on top of the clips.
   * three's mixer writes a bone only when the clip's value has changed since
   * the last frame ("value has changed -> update scene graph" in
   * PropertyMixer.apply), and the upper body plays a held pose: after the first
   * frame it never wrote spine_01..03 or the head again, so every frame's
   * turnBone piled onto the last frame's and the torso spun without end. So:
   * the clip's pose goes back on before the mixer runs, is taken again after
   * it, and the edits start from it every frame.
   */
  private clipPose = new Map<THREE.Object3D, THREE.Quaternion>();
  private static readonly EDITED = ["pelvis", "spine_01", "spine_02", "spine_03", "Head", "upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r", "thigh_l", "calf_l", "thigh_r", "calf_r"];

  /** a bone of this figure by name, for what follows it (dummy.ts: SpeedKills' hit volumes) */
  bone(name: string): THREE.Object3D | undefined {
    return this.bones[name];
  }

  /**
   * The middle of this figure's head in its Head bone's own space: every vertex drawn weighted at least half to Head
   * (a helmet with it), carried from where it was bound into the bone's rest frame, averaged. Measured off the
   * geometry, so it holds for any kit, in any pose, at any scale; null before the figure has a head.
   */
  headMiddle(): THREE.Vector3 | null {
    if (this.headMid) return this.headMid;
    const sum = new THREE.Vector3();
    let n = 0;
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const h = m.skeleton.bones.findIndex((b) => b.name === "Head");
      if (h < 0) return;
      let got = headSums.get(m.geometry);
      if (!got) {
        got = { sum: new THREE.Vector3(), n: 0 };
        // skinned in place: bone.matrixWorld x boneInverse x bindMatrix x p, so the part after the bone is fixed
        const toBone = m.skeleton.boneInverses[h].clone().multiply(m.bindMatrix);
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        const si = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
        const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
        const used = new Uint8Array(pos.count);
        const idx = m.geometry.index;
        if (idx) for (let k = 0; k < idx.count; k++) used[idx.getX(k)] = 1;
        else used.fill(1);
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          if (!used[i]) continue;
          let w = 0;
          for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
          if (w < 0.5) continue;
          got.sum.add(p.fromBufferAttribute(pos, i).applyMatrix4(toBone));
          got.n++;
        }
        headSums.set(m.geometry, got);
      }
      sum.add(got.sum);
      n += got.n;
    });
    return n ? (this.headMid = sum.divideScalar(n)) : null;
  }
  private restoreClipPose(): void {
    for (const [b, q] of this.clipPose) b.quaternion.copy(q);
  }
  /** the bones this figure turns on top of its clips: the soldier's rifle hold turns its hands and fingers too */
  private get edited(): readonly string[] {
    return this.rifle ? MannequinFigure.EDITED_RIFLE : MannequinFigure.EDITED;
  }
  private static readonly EDITED_RIFLE = [...MannequinFigure.EDITED, ...RIFLE_BONES];
  private captureClipPose(): void {
    for (const n of this.edited) {
      const b = this.bones[n];
      if (!b) continue;
      const q = this.clipPose.get(b);
      if (q) q.copy(b.quaternion);
      else this.clipPose.set(b, b.quaternion.clone());
    }
  }
  private gun: THREE.Object3D | null = null;
  /** the gun in its hands, for a finish to be painted on (dummy.ts) */
  get gunRoot(): THREE.Object3D | null {
    return this.gun;
  }
  /** its gun's muzzle flash, lit by the figure on a shot */
  flash: THREE.Sprite | null = null;
  /** its gun's scope glint, lit while it aims a magnified optic (muzzle.ts fitGlint), or null */
  glint: THREE.Sprite | null = null;
  /**
   * How far the figure is looking down its scope this frame, 0..1: its aim in, only while the gun is up at the eye and the
   * hands are on nothing else (a reload, a swap, a throw, a strike) and it is not carried low. The scope's glint shows by
   * it (the owner, 2026-09-30: "the sniper should only have glint when they are ADSing"); by the pose's aim alone, a bot
   * aiming as it reloaded glinted through the reload.
   */
  scoped = 0;
  private gunShown = true;
  private mats: THREE.MeshStandardMaterial[] = [];
  private joints: THREE.MeshStandardMaterial | null = null;
  /** knocked out: the death clip, once, then lying still */
  private dead = false;
  /** where the left hand holds the gun, gun-local (its handguard), and how far the reach is blended in */
  private support: THREE.Vector3 | null = null;
  private ikW = 0;
  /**
   * A long gun is not held as the clips hold a pistol, out at arm's length:
   * it hangs off the chest with its stock at the right shoulder, and both
   * hands reach onto it (the grip and the handguard). `mount` is its pivot
   * at the grip; `mountBase` its place in the aim pose; `grip` gun-local.
   */
  private mount: THREE.Object3D | null = null;
  private mountBase = new THREE.Matrix4();
  private grip: THREE.Vector3 | null = null;
  private gripW = 0;
  /** 0..1 the long gun lowered and canted across the body (a sprint, a swap) */
  private lowered = 0;
  /** how far the still figure's feet are flattened, 0 to 1, eased (figure.json flatFeet) */
  private flatW = 0;
  /** how far a figure standing still is lifted onto its flattened soles, 0 to 1, eased (figure.json flatFeet.lift) */
  private liftW = 0;
  /** each foot's foot-to-ball pitch in the bind pose against the figure's up, radians, found once */
  private footRest: Record<string, number> | null = null;
  /** the way the face looks, in the Head bone's own frame, from the bind pose (headUp); null until measured */
  private faceLocal: THREE.Vector3 | null = null;
  private readonly footA = new THREE.Vector3();
  private readonly footB = new THREE.Vector3();
  private readonly footSide = new THREE.Vector3();
  private readonly footQ = new THREE.Quaternion();
  private readonly footW = new THREE.Quaternion();
  private readonly footT = new THREE.Quaternion();
  /** the long gun is on its way back into the hands after a throw, a heal or a reach: hidden until they are on it */
  private gunComing = false;
  /** 0..1 each, eased: the lowered carry a swap's own, and a sprint jump's own (rifle.ts carryOf) */
  private carryW = { swap: 0, air: 0, vent: 0 };
  /** the stance and the hands' act last frame, when a slide began and when its way out ends, and which swing a melee is on */
  private lastStance = "";
  private lastAct: FigurePose["act"] = null;
  /** when the act began, on this figure's clock: a finisher is two blows in order */
  private actAt = 0;
  private slideAt = -Infinity;
  private slideExitUntil = -Infinity;
  private meleeSwing = 0;
  private headSeen = -Infinity;
  private headUntil = -Infinity;
  /** the figure's own clock, and when a landing's clip and a stagger's end */
  private t = 0;
  private landUntil = -Infinity;
  private staggerSeen = -Infinity;
  private staggerUntil = -Infinity;
  private wasAir = false;
  /** the double jumps seen so far (null until the first count arrives), and when the last one's knee lift began */
  private airJumpsSeen: number | null = null;
  private liftAt = -Infinity;
  /** the gun is in the hand and showing this frame */
  gunInHand = false;

  /** the template this figure was made from, and plays the clips of, for its whole life */
  private tpl: Template;
  /** SpeedKills' soldier: this figure's look, or null for the figures of before */
  readonly soldier: SoldierLook | null;

  constructor(skin: OperatorSkin, gunId: string | null) {
    this.soldier = soldierTemplate ? soldierLookFor(skin) : null;
    const t = (this.tpl = this.soldier ? soldierTemplate! : template!);
    // the body this outfit's clothes were cut for, if it is here; the one the
    // template holds otherwise, and the next figure gets it right
    const want = bodyOf(skin.outfit, skin.body);
    const body = this.soldier ? soldierScene(this.soldier) : bodyFor(want, skin.build ?? "regular");
    if (!body && !this.soldier) void loadBody(want);
    this.root = cloneSkinned(body ?? t.scene);
    this.root.name = "mannequin";
    const skinned: THREE.SkinnedMesh[] = [];
    this.mixer = new THREE.AnimationMixer(this.root);
    this.root.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o;
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.castShadow = true;
        if (slow("cull")) m.frustumCulled = false;
        else skinned.push(m);
        // its own materials, so a hit can flash this figure and not every one.
        // The grey mannequin is untextured and takes the operator's colours:
        // the body the shell's, the joints the accent's. A real body is NOT
        // painted. Its colour is a multiply over the skin texture, so an
        // operator with a near-black shell got a black, glossy face that
        // followed the contour of the head, one figure in every lineup.
        const src = m.material as THREE.MeshStandardMaterial;
        // the soldier's are its own, rebuilt with this figure's colours (soldier.ts); none of the rules below apply
        const slot = m.userData.soldierMaterial as string | undefined;
        const mat = this.soldier && slot ? soldierMaterial(slot, this.soldier) : src.clone();
        if (this.soldier && slot) {
          // (nothing: the soldier's material is complete as it is)
        } else if (!src.map) {
          if (src.name === "M_Joints") {
            mat.color.setHex(skin.accent);
            this.joints = mat;
          } else mat.color.setHex(skin.shell);
          mat.roughness = 0.55;
        } else if (src.name.startsWith("MI_Hair")) {
          // the eyebrows are on the body and read the same grey hair mask,
          // so they take the same colour as the hair or they are white
          mat.color.setHex(hairTintOf(skin.outfit));
        } else if (src.name.startsWith("MI_Superhero") && m.geometry.attributes.color) {
          // the undersuit is a vertex colour over the skin (undersuit())
          mat.vertexColors = true;
          bodyMeshes.add(m);
          if (fitDebug) m.material = fitMaterial();
        }
        this.mats.push(mat);
        if (!(fitDebug && bodyMeshes.has(m))) m.material = mat;
        m.userData.ownMaterial = mat;
      }
    });
    // The soldier's eyes are a mesh of their own, a draw call a figure (apex-lobby counted 28 bots' in a Neon street
    // frame): never in the shadow pass, where an eye's shadow is nothing, and hidden past lod.json figures.eyes (showEyes),
    // where an eye is under a pixel
    if (this.soldier) {
      this.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh && /eye/i.test(String(m.userData.soldierMaterial ?? ""))) {
          m.castShadow = false;
          m.userData.shadowOff = true;
          this.eyes.push(m);
        }
      });
    }
    // the soldier wears its own pieces, nothing of the figures' wardrobe; its fingers are drawn smaller than its model's
    if (skinned.length) {
      this.height = figureHeight(this.root, skinned);
      cullAsFigure(this.root, skinned, this.height);
    }
    if (!this.soldier) this.wearGear(skin);
    else sizeFingers(this.bones);
    if (!slow("skeleton")) shareSkeletons(this.root);
    if (gunId) this.setGun(gunId);
  }

  /** what it is wearing, so a check and a snapshot can name the pieces */
  readonly gear: GearPiece[] = [];

  /**
   * Put the operator's kit on: each piece onto the bone it hangs from, so it
   * moves with the body without being weighted to it. A helmet on the head
   * bone turns when the head turns; a vest on the upper spine leans when the
   * spine leans; and nothing has to deform, because none of it would.
   */
  /**
   * Put real garment meshes on: each one is skinned to the same rig, so it is
   * rebound to THIS figure's bones and then moves with it exactly as the body
   * does - no bone to hang it from, no piece that fails to bend at a knee.
   * The body underneath is hidden where a garment covers it, because two
   * surfaces in the same place fight each other in the depth buffer.
   */
  private wearParts(names: string[], tint: number | null = null, outfit = "", build = "regular", picked?: string): void {
    const body = bodyOf(outfit, picked);
    for (const n of names) {
      const srcs = parts.get(n);
      // already on, or not here yet
      if (!srcs || this.worn.some((w) => w.name.startsWith(`wear:${n}`))) continue;
      const hair = n.startsWith("Hair_");
      for (let k = 0; k < srcs.length; k++) {
        const src = srcs[k];
        const bones = src.skeleton.bones.map((b) => this.bones[b.name]);
        if (bones.some((b) => !b)) continue;
        const mat = (src.material as THREE.MeshStandardMaterial).clone();
        // its own atlas if one is made for it; the multiply is the fallback.
        // Hair is exempt: it is worn like a garment but it is not one, and an
        // outfit's colour on it would give every figure in olive olive hair.
        const map = outfit && !hair ? tintMap(outfit, n) : null;
        if (map) mat.map = map;
        else if (tint !== null && !hair) mat.color.setHex(tint);
        if (hair && outfit) mat.color.setHex(hairTintOf(outfit));
        // hair sits on the head, which no build changes
        const geo = hair ? src.geometry : garmentFor(src, `${n}#${k}`, body, build);
        const mesh = new THREE.SkinnedMesh(geo, mat);
        mesh.bind(new THREE.Skeleton(bones as THREE.Bone[], src.skeleton.boneInverses), src.bindMatrix);
        mesh.castShadow = true;
        if (slow("cull")) mesh.frustumCulled = false;
        else cullAsFigure(this.root, [mesh], this.height);
        mesh.name = k === 0 ? `wear:${n}` : `wear:${n}#${k}`;
        this.root.add(mesh);
        this.worn.push(mesh);
      }
    }
    // (a garment cut for the same rest pose shares the body's skeleton too)
    if (!slow("skeleton")) shareSkeletons(this.root);
  }

  /** the outfit's atlas arrived after the clothes went on: put it on them */
  private redressParts(outfit: string): void {
    for (const w of this.worn) {
      if (w.name.startsWith("wear:Hair_")) continue;
      // the mesh carries the part it came from, which is what says whose
      // atlas reads its UVs
      const part = w.name.replace(/^wear:/, "").replace(/#\d+$/, "");
      const map = tintMap(outfit, part);
      if (!map) continue;
      const m = w.material as THREE.MeshStandardMaterial;
      m.map = map;
      m.color.setHex(0xffffff);
      m.needsUpdate = true;
    }
  }

  /** the garment meshes this figure is wearing */
  private worn: THREE.SkinnedMesh[] = [];

  private wearGear(skin: OperatorSkin): void {
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    // the clothes first, then the kit on top of them (src/game/outfit.ts).
    // A sleeve hangs on the arm bone and turns with it, so it is added raw;
    // what goes on a face is authored the way a person would describe it and
    // gets the same rest-frame holder the kit does.
    // real garment parts, if this outfit is made of them
    // Real garment meshes, if this outfit is made of them. They are fetched
    // on demand, so a figure built before they land wears what is there and
    // puts the rest on when it arrives - which is one frame later on this
    // machine and a second on a bad connection, either way better than every
    // page in the game waiting for clothes nobody asked for.
    // the hair goes on with the clothes: same skeleton, same fetch, same wear
    const want = [...partsOf(skin.outfit), ...hairOf(skin.outfit, skin.body)];
    if (want.length) {
      const tint = tintOf(skin.outfit);
      this.wearParts(want, tint, skin.outfit, skin.build ?? "regular", skin.body);
      // The parts and the outfit's own atlas both arrive late on a cold page,
      // and BOTH are asked for here. The first try only started the atlas
      // inside the dressing loop, which a cold page never reaches because the
      // parts are not in yet: every figure wore the multiply instead and the
      // recoloured atlases were never seen.
      const outfit = skin.outfit;
      const build = skin.build ?? "regular";
      const picked = skin.body;
      void Promise.all([loadOutfit(outfit), loadTint(outfit)]).then(() => {
        this.wearParts(want, tint, outfit, build, picked);
        this.redressParts(outfit);
      });
    }
    const mats = outfitMaterials(skin.outfit, skin.visor, skin.eye);
    // a real outfit brings its own clothes; only what goes on the face is ours
    const all = buildOutfit(skin.outfit, mats, skin.face ?? [], skin.build ?? "regular");
    // a figure in real cloth wears only what the player put on its face
    const built = partsOf(skin.outfit).length ? all.filter((w) => w.bone === "Head") : all;
    for (const worn of built) {
      const bone = this.bones[worn.bone];
      if (!bone) continue;
      if (!worn.aligned) {
        bone.add(worn.group);
        continue;
      }
      const holder = new THREE.Group();
      holder.name = `wearMount:${worn.id}`;
      holder.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ));
      holder.add(worn.group);
      bone.add(holder);
    }
    // The kit is OURS, built in code out of boxes, and on a figure wearing
    // real cloth it is exactly what the owner spotted: our shapes stacked on
    // top of somebody's asset. The pack already brings a hood and a shoulder
    // guard of its own, and a plate carrier of boxes over a ranger's coat
    // reads as what it is. So a real-cloth outfit wears no kit at all; what
    // stays is the face, because nothing in the pack covers a pair of eyes and
    // the rule is that everybody's are covered.
    for (const piece of !OUR_GEOMETRY() || partsOf(skin.outfit).length ? [] : buildGear(skin)) {
      const bone = this.bones[piece.bone];
      if (!bone) continue;
      // Each piece is authored the way a person would describe it: so far up
      // the head, so far in front of the chest. A bone is not authored that
      // way (this rig's head bone leans, its arm bones point down their own
      // length), so the piece goes on a holder that undoes the bone's rest
      // turn. The holder still turns WITH the bone from there, which is what
      // a helmet and a vest do.
      const holder = new THREE.Group();
      holder.name = `gearMount:${piece.id}`;
      holder.add(piece.group);
      bone.add(holder);
      this.gear.push(piece);
    }
    this.fitGear(rootQ);
  }

  /**
   * Point every holder the way the figure points in its rest pose, so a piece
   * can be authored the way a person would describe it: so far up the head, so
   * far in front of the chest. From there each holder turns with its bone, so
   * a helmet leans when the head leans into the sights and a vest turns with
   * the chest, which is what a helmet and a vest do.
   */
  private fitGear(rootQ?: THREE.Quaternion): void {
    this.root.updateMatrixWorld(true);
    const rq = rootQ ?? this.root.getWorldQuaternion(new THREE.Quaternion());
    for (const piece of this.gear) {
      const holder = piece.group.parent;
      if (!holder?.parent) continue;
      holder.quaternion.copy(holder.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rq));
    }
  }


  /** a gun into the right hand, held as the aim pose holds it: pointing the way the figure faces */
  setGun(id: string): void {
    const hand = this.bones.hand_r;
    const chest = this.bones.spine_03;
    if (!hand || !template) return;
    this.gun?.removeFromParent();
    this.mount?.removeFromParent();
    this.mount = null;
    // (a gun in place of another is the one a swap phases in; the first one given is just there)
    if (id !== this.gunId) this.gunAt = this.gunId ? this.t : -1;
    this.gunId = id;
    this.rifleMem.gunInHand = null;
    const m = displayGunModel(id);
    const gun = m.root.clone(true);
    // the model's own flash out, a marker with a flash sprite in its place (muzzle.ts)
    this.flash = fitMuzzle(gun, ammoTypeOf(id) === "energy", m.muzzle);
    // a magnified optic glints when its holder aims (Hyper Scape's lens flare), at its front lens: the frontmost point
    // of the gun within 3 cm of its sight line, measured off the model (at the eyepiece the gun and head hid it)
    // (SpeedKills: every gun wears its profile's one optic; the legacy game's figures carry none they show)
    const optic = IS_SK ? ((PROFILE.weapons as Record<string, { optic?: string }>)[id]?.optic ?? null) : null;
    this.glint = optic && opticInfo(optic)?.overlay ? fitGlint(gun, lensFront(gun, m.sightY)) : null;
    gun.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.support = new THREE.Vector3(m.support.x ?? 0, m.support.u, -m.support.f);
    this.grip = new THREE.Vector3(0, m.grip.u, -m.grip.f);
    // (a pistol given the soldier's pistol stance goes the long guns' way too: the rifleman's rig holds it, rifle.ts)
    if ((m.support.kind !== "pistol" || (this.soldier && !!this.tpl.rifle && pistolStance(id))) && chest) {
      // A long gun: its stock in the shoulder pocket, which is OUTBOARD of the
      // joint and not inboard of it, its grip below and in front. How far in
      // front is the gun's own business: a carbine needs less room behind the
      // grip than a sniper with a full stock, and a gun given the carbine's
      // room has its stock through the chest (src/game/hold.ts).
      const sh = this.tpl.shoulderR;
      this.rear = rearOfGrip(gun, m.grip.f);
      const at = gripAt({ x: sh.x, y: sh.y, z: sh.z }, this.rear);
      const gripAtV = new THREE.Vector3(at.x, at.y, at.z);
      const inFigure = new THREE.Matrix4().compose(gripAtV, new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
      this.mountBase.copy(this.tpl.chestAim).invert().multiply(inFigure);
      const mount = new THREE.Object3D();
      mount.name = "gunMount";
      this.mountBase.decompose(mount.position, mount.quaternion, mount.scale);
      // the soldier's gun drawn at its own size for the glove (soldierhold.json scale), its grip still at the mount,
      // and its left hand's hold where the arm reaches it when the model's own is too far out (soldierhold.json support)
      const size = this.soldier && this.tpl.rifle ? gunScaleOf(id) : 1;
      if (this.soldier && this.tpl.rifle) this.support = supportOf(id) ?? this.support;
      gun.scale.setScalar(size);
      gun.position.copy(this.grip).multiplyScalar(size).negate();
      gun.visible = this.gunShown && !this.dead;
      mount.add(gun);
      chest.add(mount);
      this.mount = mount;
      this.gun = gun;
      // SpeedKills' soldier holds it as a rifleman does (rifle.ts): its butt measured off the gun it holds
      this.rifle = this.soldier ? (this.tpl.rifle ?? null) : null;
      this.butt = this.rifle ? buttOf(gun) : null;
      // the magazine group the reload takes out (gunmodels.ts builds it as "mag"), where it sits, and the handle
      const mag = gun.getObjectByName("mag") ?? null;
      this.reloadParts = this.rifle ? { mag, magHome: mag ? mag.position.clone() : new THREE.Vector3(), magHomeQ: mag ? mag.quaternion.clone() : new THREE.Quaternion(), magBottom: m.magBottom.clone(), handle: m.boltGrip ? m.boltGrip.clone() : null } : null;
      if (this.rifle && mag) {
        // the magazine's top and bottom in its own frame, for its sweep; its meshes onto this figure's phased copies
        mag.updateMatrixWorld(true);
        const inv = mag.matrixWorld.clone().invert();
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        // (the magazine as drawn: its group holds the procedural gun's magazine too, hidden, 107 mm off on the USSO)
        const drawn = (o: THREE.Object3D) => {
          for (let q: THREE.Object3D | null = o; q && q !== mag; q = q.parent) if (!q.visible) return false;
          return true;
        };
        mag.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || !drawn(mesh)) return;
          const pos = mesh.geometry.getAttribute("position");
          const to = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
          for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to));
        });
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        this.magTop.set(cx, box.max.y, cz);
        this.magEnd.set(cx, box.min.y, cz);
        box.getCenter(this.magMid);
        this.magRadius = Math.max(0.005, box.getSize(new THREE.Vector3()).length() / 2);
        const under = (o: THREE.Object3D, g: THREE.Object3D | null) => {
          for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === g) return true;
          return false;
        };
        // the bought model's own meshes for the swap (never the flash, the glint or a procedural gun under them), its
        // length in its own frame as the first person's sweep runs it: from the back to the muzzle
        const paid = swapOf(id) ? gun.getObjectByName("paid") ?? null : null;
        if (paid) {
          gun.updateMatrixWorld(true);
          const ginv = gun.matrixWorld.clone().invert();
          const g = new THREE.Box3();
          paid.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh || !mesh.visible) return;
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            g.union(mesh.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(ginv, mesh.matrixWorld)));
          });
          const cy = (g.min.y + g.max.y) / 2;
          this.gunNear.set(0, cy, g.max.z);
          this.gunFar.set(0, cy, g.min.z);
          g.getCenter(this.gunMid);
          this.gunRadius = Math.max(0.01, g.getSize(new THREE.Vector3()).length() / 2);
        }
        phaseMeshes(gun, (mesh) => (under(mesh, mag) ? this.magSweep : paid && under(mesh, paid) ? this.gunSweep : null));
      }
      this.sight = new THREE.Vector3(m.sightX ?? 0, m.sightY, -m.rearF);
      return;
    }
    this.reloadParts = null;
    this.rifle = null;
    this.butt = null;
    // where the gun sits in the figure's frame in the aim pose: its grip in the
    // hand (a little into the palm), the muzzle forward
    const grip = new THREE.Vector3().setFromMatrixPosition(this.tpl.handAim).add(new THREE.Vector3(0.02, -0.02, 0.06));
    const inFigure = new THREE.Matrix4().compose(grip.clone().sub(new THREE.Vector3(0, m.grip.u, m.grip.f)), new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(this.tpl.handAim).invert().multiply(inFigure);
    local.decompose(gun.position, gun.quaternion, gun.scale);
    gun.visible = this.gunShown && !this.dead;
    hand.add(gun);
    this.gun = gun;
  }

  /**
   * Each foot's toe brought down by `w` of the way to no higher than its bind pose has it, about the foot's own side to
   * side (the figure stands upright, so its up is the world's). The bind pose's pitch is read off the skeleton's inverse
   * binds against the head over the feet, as the meshes are Z up.
   */
  private flattenFeet(w: number): void {
    const b = this.bones;
    if (!this.footRest) {
      let sk: THREE.Skeleton | null = null;
      this.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!sk && m.isSkinnedMesh && m.skeleton.bones.some((x) => x.name === "foot_l")) sk = m.skeleton;
      });
      const S = sk as THREE.Skeleton | null;
      if (!S) return;
      const at = (name: string) => {
        const i = S.bones.findIndex((x) => x.name === name);
        return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(S.boneInverses[i].clone().invert());
      };
      const [head, fl, fr, bl, br] = ["Head", "foot_l", "foot_r", "ball_l", "ball_r"].map(at);
      if (!head || !fl || !fr || !bl || !br) return;
      const up = head.clone().sub(fl.clone().add(fr).multiplyScalar(0.5)).normalize();
      const pitch = (f: THREE.Vector3, ball: THREE.Vector3) => Math.asin(THREE.MathUtils.clamp(ball.clone().sub(f).normalize().dot(up), -1, 1));
      this.footRest = { l: pitch(fl, bl), r: pitch(fr, br) };
    }
    for (const s of ["l", "r"]) {
      const foot = b[`foot_${s}`];
      const ball = b[`ball_${s}`];
      if (!foot || !ball || !foot.parent) continue;
      foot.parent.updateWorldMatrix(true, false);
      foot.updateMatrixWorld(true);
      const dir = ball.getWorldPosition(this.footA).sub(foot.getWorldPosition(this.footB)).normalize();
      const lift = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) - this.footRest[s];
      if (lift <= 0) continue;
      // (a positive turn about this lifts the toe)
      const side = this.footSide.crossVectors(dir, Y).normalize();
      if (side.lengthSq() < 0.5) continue;
      const parentQ = foot.parent.getWorldQuaternion(this.footQ);
      const world = this.footW.copy(parentQ).multiply(foot.quaternion);
      world.premultiply(this.footT.setFromAxisAngle(side, -lift * w));
      foot.quaternion.copy(parentQ.invert().multiply(world));
    }
  }

  /**
   * The head turned about the figure's left so its face looks at the look's pitch (level when not aiming), `hold` of
   * the way, the turn no more than `most` degrees (figure.json headUp). The face's way in the Head bone's frame is the
   * bind pose's forward, the figure's left crossed with its up there (the shoulders and the head over the feet).
   */
  private holdHeadUp(head: THREE.Object3D, fig: THREE.Object3D, pitch: number): void {
    if (!this.faceLocal) {
      let sk: THREE.Skeleton | null = null;
      this.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!sk && m.isSkinnedMesh && m.skeleton.bones.some((x) => x.name === "Head")) sk = m.skeleton;
      });
      const S = sk as THREE.Skeleton | null;
      if (!S) return;
      const idx = (name: string) => S.bones.findIndex((x) => x.name === name);
      const at = (i: number) => new THREE.Vector3().setFromMatrixPosition(S.boneInverses[i].clone().invert());
      const [h, fl, fr, ul, ur] = ["Head", "foot_l", "foot_r", "upperarm_l", "upperarm_r"].map(idx);
      if ([h, fl, fr, ul, ur].some((i) => i < 0)) return;
      const up = at(h).sub(at(fl).add(at(fr)).multiplyScalar(0.5)).normalize();
      const left = at(ul).sub(at(ur));
      const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
      this.faceLocal = fwd.transformDirection(S.boneInverses[h]);
    }
    head.updateWorldMatrix(true, false);
    const face = this.headFace.copy(this.faceLocal).transformDirection(head.matrixWorld).applyQuaternion(fig.getWorldQuaternion(this.headQ).invert());
    const now = Math.asin(THREE.MathUtils.clamp(face.y, -1, 1));
    const most = HEAD_UP.most * DEG;
    // (+x is the figure's left: a positive turn tips the face down)
    turnBone(head, fig, X_AXIS, THREE.MathUtils.clamp((now - pitch) * HEAD_UP.hold, -most, most));
  }
  /**
   * The chest tipped back so the upper chest (spine_03 to the neck, what stands between a shooter behind and the head)
   * leans no more than `most` degrees forward of the figure's up (figure.json chestUp), split between spine_02 and
   * spine_03; a lean back (a slide) is the clip's.
   */
  private holdChestUp(b: Record<string, THREE.Object3D>, fig: THREE.Object3D): void {
    fig.updateWorldMatrix(true, true);
    const toFig = this.chestQ.copy(fig.getWorldQuaternion(this.chestQ)).invert();
    const line = b.neck_01.getWorldPosition(this.chestA).sub(b.spine_03.getWorldPosition(this.chestB)).applyQuaternion(toFig);
    const lean = Math.atan2(line.z, line.y);
    const over = lean - CHEST_UP.most * DEG;
    if (over <= 0) return;
    // (+x is the figure's left: a negative turn tips the chest back)
    turnBone(b.spine_02, fig, X_AXIS, -over * 0.5);
    turnBone(b.spine_03, fig, X_AXIS, -over * 0.5);
  }
  private readonly chestA = new THREE.Vector3();
  private readonly chestB = new THREE.Vector3();
  private readonly chestQ = new THREE.Quaternion();
  private readonly headFace = new THREE.Vector3();
  private readonly headQ = new THREE.Quaternion();

  /** the soldier's eye meshes (see the constructor), shown only near the camera */
  private readonly eyes: THREE.SkinnedMesh[] = [];
  /** the eyes drawn or not: a far figure's are under a pixel (lod.json figures.eyes, the figure's level of detail) */
  showEyes(on: boolean): void {
    for (const m of this.eyes) m.visible = on;
  }

  /** how far this gun reaches behind its own grip, metres (0 for a pistol) */
  rear = 0;
  /** the soldier's rifle hold (rifle.ts), while it holds a long gun: its measures, and the held gun's butt, gun-local */
  private rifle: RifleRig | null = null;
  /** the gun in its hands, by id */
  private gunId = "";
  /** where the eye goes to aim the held gun, gun-local */
  private sight: THREE.Vector3 | null = null;
  private butt: THREE.Vector3 | null = null;
  /** what the hold did last frame (how far short each arm fell), for the checks */
  rifleOut: RifleOut | null = null;
  /** where the gun sits in the right hand, remembered while held (rifle.ts RifleState.mem) */
  private rifleMem: { gunInHand: THREE.Matrix4 | null } = { gunInHand: null };
  /** what the held gun gives a reload (its magazine, its charging handle), and last frame's reload progress */
  private reloadParts: ReloadParts | null = null;
  private lastReload: number | null = null;
  /**
   * The magazine's phase in a reload, as the first person's (phase.ts, gunfeel.json phase): its own sweep, run from the
   * magazine's top to its bottom (its group's frame), so only this figure's magazine phases. And the seat's kick.
   */
  private readonly magSweep: PhaseSweep = newSweep(feelCfg.phase);
  private readonly magTop = new THREE.Vector3();
  private readonly magEnd = new THREE.Vector3();
  /** the drawn magazine's middle (its group's frame) and half its size corner to corner, for a radial phase */
  private readonly magMid = new THREE.Vector3();
  private magRadius = 0.05;
  /**
   * A signature gun's swap, as the first person's (gunfeel.json guns.<id>.swap, viewmodel.ts): the gun going away
   * phases out over the holster, the one coming phases in over its draw, along the gun from its back to its muzzle,
   * its magazine with it. Without it the new gun appeared whole in the hands at the swap's middle, a jump in the frames.
   * A gun with no swap of its own changes as it did.
   */
  private readonly gunSweep: PhaseSweep = newSweep(feelCfg.phase);
  private readonly gunNear = new THREE.Vector3();
  private readonly gunFar = new THREE.Vector3();
  /** the bought model's middle, gun-local, and half its size corner to corner: a swap in place phases out from and to it */
  private readonly gunMid = new THREE.Vector3();
  private gunRadius = 0.3;
  /** when the gun in the hands last changed (setGun), on the figure's clock */
  private gunAt = -1;

  /** a swap in place, as the first person's (rifle.ts SWAP_CUP): a signature gun held as a rifle, being swapped */
  private cupSwap(p: FigurePose): boolean {
    return p.act === "swap" && !!SWAP_CUP && !!this.rifle && !!this.mount && !!swapOf(this.gunId);
  }
  private seatKick = 0;
  /**
   * Where the gun ended up, for the checks: how far behind the shoulder its
   * stock sits (positive is behind, and a stock is allowed a little), and how
   * far each hand is from the hold it is reaching for. A hand further than a
   * few centimetres off is the floating hand.
   */
  holdGaps(): { stock: number; grip: number; support: number; slide: number } | null {
    if (!this.gun || !this.grip || !this.support) return null;
    this.root.updateMatrixWorld(true);
    const gap = (side: "l" | "r", onGun: THREE.Vector3): number => {
      const hand = this.bones[`hand_${side}`];
      if (!hand) return 0;
      return hand.getWorldPosition(new THREE.Vector3()).distanceTo(this.gun!.localToWorld(onGun.clone()));
    };
    // the support gap is measured against the hold the hand is reaching for,
    // which on a long gun is further back than the handguard (supportHold)
    return { stock: this.mount ? stockBehind(this.rear) : 0, grip: gap("r", this.grip), support: gap("l", this.supportHold()), slide: this.supportSlide };
  }

  /** the right hand's reach onto a long gun's grip, 0..1 (the tests look) */
  get gripReach(): number {
    return this.gripW;
  }

  /** the left hand's reach onto the gun, 0..1 (the tests look) */
  get supportReach(): number {
    return this.ikW;
  }

  /**
   * The left hand onto the gun's support point: a two-bone reach (upper arm,
   * forearm) with the elbow down and out, weighted by `w`. The clips are a
   * pistol's two-hand grip; a rifle's handguard is 20 to 30 cm further out.
   */
  private reachSupport(w: number): void {
    if (!this.support) return;
    this.reach("l", this.supportHold(), w);
  }

  /**
   * Where the support hand takes hold this frame. Normally the handguard; on
   * a gun too long for the arm, as far along it as the arm reaches
   * (src/game/hold.ts reachFraction). The hand is then holding the gun in a
   * place a person would hold it, rather than hanging in the air beside the
   * place it could not get to, which is what the owner saw.
   */
  private supportHold(): THREE.Vector3 {
    const held = this.support!;
    const up = this.bones.upperarm_l;
    const lo = this.bones.lowerarm_l;
    const hand = this.bones.hand_l;
    if (!up || !lo || !hand || !this.grip || !this.gun) return held;
    // (a pistol's left hand is on the grip already, round the right: slid toward the grip it went 4 cm across into the
    // gun at a sprint, 17 mm in, and the reach was judged to the support point, 7 cm ahead of where its palm goes)
    if (this.rifle && this.gunId && pistolStance(this.gunId)) {
      this.supportSlide = 0;
      return held;
    }
    this.root.updateMatrixWorld(true);
    const shoulder = up.getWorldPosition(v1);
    // (the soldier's rifle hold reaches further with the shoulder brought forward, rifle.ts reachWithShoulder)
    const clav = this.rifle ? this.bones.clavicle_l : null;
    const gain = clav ? shoulderGain(clav.getWorldPosition(v2).distanceTo(shoulder), this.gunId) : 0;
    const arm = shoulder.distanceTo(lo.getWorldPosition(v2)) + lo.getWorldPosition(v2).distanceTo(hand.getWorldPosition(v3)) + gain;
    const a = this.gun.localToWorld(v4.copy(held));
    const b = this.gun.localToWorld(v5.copy(this.grip));
    const t = reachFraction([a.x - shoulder.x, a.y - shoulder.y, a.z - shoulder.z], [b.x - a.x, b.y - a.y, b.z - a.z], arm * 0.98);
    this.supportSlide = t;
    return t < 1e-3 ? held : this.supportAt.copy(held).lerp(this.grip, t);
  }

  /** how far back along the gun the support hand had to slide, 0..1 (the tests look) */
  supportSlide = 0;
  private readonly supportAt = new THREE.Vector3();

  /** one arm (l or r) onto a point on the gun (gun-local), weighted by w */
  private reach(side: "l" | "r", onGun: THREE.Vector3, w: number): void {
    const b = this.bones;
    const up = b[`upperarm_${side}`];
    const lo = b[`lowerarm_${side}`];
    const hand = b[`hand_${side}`];
    if (!up || !lo || !hand || !this.gun || w < 0.01) return;
    this.root.updateMatrixWorld(true);
    const target = this.gun.localToWorld(v4.copy(onGun));
    const a = up.getWorldPosition(v1);
    const bb = lo.getWorldPosition(v2);
    const c = hand.getWorldPosition(v3);
    const lab = a.distanceTo(bb);
    const lbc = bb.distanceTo(c);
    const toT = v5.copy(target).sub(a);
    const dist = Math.max(0.05, Math.min(lab + lbc - 1e-3, toT.length()));
    const dir = toT.normalize();
    // the elbow's side: down and out (the left arm to +x, the figure's left; the right to -x), a little back
    const out = side === "l" ? 0.7 : -0.9;
    const pole = new THREE.Vector3(out, -1, -0.2).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = Math.max(-1, Math.min(1, (lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = a.clone().addScaledVector(dir, cosA * lab).addScaledVector(pole, sinA * lab);
    aimBone(up, bb.clone().sub(a), elbow.clone().sub(a), w);
    const b2 = lo.getWorldPosition(new THREE.Vector3());
    const c2 = hand.getWorldPosition(new THREE.Vector3());
    const goal = a.clone().addScaledVector(dir, dist);
    aimBone(lo, c2.sub(b2), goal.sub(b2), w);
  }

  setGunVisible(on: boolean): void {
    this.gunShown = on;
    if (this.gun) this.gun.visible = on && !this.dead;
    this.gunInHand = !!this.gun && this.gun.visible;
  }

  /** the gun in its hand (the figure drops a copy of it when knocked out) */
  get gunObject(): THREE.Object3D | null {
    return this.gun;
  }

  /** a bone by its name (the rig's own, e.g. hand_r or middle_01_l), for the tools that measure a figure */
  boneAt(name: string): THREE.Object3D | null {
    return this.bones[name] ?? null;
  }

  /**
   * Where each palm is meant to be this frame, in the world (tools/figure-frames.ts): the soldier's rifle hold's own
   * (its hold points and each gun's palm offsets, rifle.ts), else the gun's grip and support; null without a long gun.
   */
  holdPoints(): { grip: THREE.Vector3; support: THREE.Vector3 } | null {
    if (!this.gun || !this.grip || !this.support) return null;
    const p = this.rifle ? this.rifleOut?.palm : null;
    if (p?.r && p.l) return { grip: p.r.clone(), support: p.l.clone() };
    this.root.updateMatrixWorld(true);
    return { grip: this.gun.localToWorld(this.grip.clone()), support: this.gun.localToWorld(this.supportHold().clone()) };
  }

  /** knocked out, or back up: the death clip plays once from the start; back up snaps to the pose */
  setDead(on: boolean): void {
    if (on === this.dead) return;
    this.dead = on;
    if (this.gun) this.gun.visible = this.gunShown && !on;
    this.gunInHand = !!this.gun && this.gun.visible;
    if (on) {
      // the library's death is 2.4 s: a game's is quicker (1.5 s)
      this.play("lower", "Death01", 1.6, 0.12, true, "full");
      this.upper?.fadeOut(0.12);
      this.upper = null;
      this.upperName = "";
    } else {
      // up again (a new round, a respawn): the next update picks the clips, at once
      this.mixer.stopAllAction();
      this.lower = this.upper = null;
      this.lowerName = this.upperName = "";
    }
  }

  /** knocked out: only the death clip runs */
  updateDead(dt: number): void {
    // the last live frame's turns come off first, so the death clip starts clean
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
  }

  /** the joints glow in the armour's colour (the robot's vest does it on the robot) */
  setArmorColour(hex: number | null): void {
    if (!this.joints) return;
    this.joints.emissive.setHex(hex ?? 0x000000);
    this.joints.emissiveIntensity = hex === null ? 0 : 0.35;
  }

  /** the hit flash: the body lights up for a moment */
  setFlash(amount: number, head: boolean): void {
    for (const m of this.mats) if (m !== this.joints) m.emissive.setRGB(amount * 0.9 + (head ? amount * 0.6 : 0), amount * 0.9 + (head ? amount * 0.3 : 0), amount * 0.9);
  }

  private play(layer: "lower" | "upper", name: string, timeScale: number, fade = 0.18, once = false, source: "lower" | "upper" | "full" = layer): void {
    const key = `${source}:${name}`;
    const clip = this.tpl.clips.get(key) ?? this.tpl.clips.get(`${layer}:Idle_Loop`);
    if (!clip) return;
    if ((layer === "lower" ? this.lowerName : this.upperName) === key) {
      const cur = layer === "lower" ? this.lower : this.upper;
      if (cur) cur.timeScale = timeScale;
      return;
    }
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.timeScale = timeScale;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    const prev = layer === "lower" ? this.lower : this.upper;
    if (prev) next.crossFadeFrom(prev, fade, false);
    if (layer === "lower") {
      this.lower = next;
      this.lowerName = key;
    } else {
      this.upper = next;
      this.upperName = key;
    }
  }

  /**
   * One frame: the clips for the pose, the mixer, then the corrections on
   * top (the strafe's hips and spine, the look pitch, a kick, a flinch, a
   * JOLT's lean). `armed`: it has a gun in hand.
   */
  /** the time of the frames it sat out (figlod.ts): given to the mixer when its turn comes, so nothing drifts */
  private owed = 0;

  /**
   * Its pose this frame. `animate` false is a frame it sits out at distance
   * (figlod.ts): the time is kept and handed over on the next one it plays.
   */
  update(p: FigurePose, dt: number, armed: boolean, fx: MannequinImpulses, animate = true): void {
    if (!animate) {
      this.owed += dt;
      return;
    }
    dt += this.owed;
    this.owed = 0;
    const speed = Math.max(0, p.speed);
    this.t += dt;
    // a landing from standing (or a walk): the impact's crouch from the landing clip, briefly
    const air = p.stance === "air";
    if (this.wasAir && !air && (fx.land ?? 0) > 0.4 && speed < 2.6 && p.stance === "stand") this.landUntil = this.t + 0.32;
    this.wasAir = air;
    // A double jump: the knees come up and go back down (figure.json doubleJump). The first count a figure is given is
    // where it starts, so a player first seen after some double jumps does not lift for them.
    if (fx.airJumps !== undefined && fx.airJumps !== this.airJumpsSeen) {
      if (this.airJumpsSeen !== null && air) this.liftAt = this.t;
      this.airJumpsSeen = fx.airJumps;
    }
    const lift = air ? (this.t - this.liftAt) / DOUBLE_JUMP.time : 1;
    // the head was hit: the head snaps back, once
    if (fx.headHit !== undefined && fx.headHit !== this.headSeen && Number.isFinite(fx.headHit)) {
      this.headSeen = fx.headHit;
      this.headUntil = this.t + 0.35;
    }
    // the shield broke: the stagger clip on the upper body, once
    if (fx.stagger !== undefined && fx.stagger !== this.staggerSeen && Number.isFinite(fx.stagger)) {
      this.staggerSeen = fx.stagger;
      this.staggerUntil = this.t + 0.3;
    }
    const back = speed > 0.3 && Math.abs(p.moveDir ?? 0) > 1.9;
    const dirSign = back ? -1 : 1;
    // A slide has a way in and a way out (the free library's Slide_Start and
    // Slide_Exit, once they have loaded): it used to cut straight into its
    // loop and straight out of it, which every other player saw as a pop.
    if (p.stance !== this.lastStance) {
      if (p.stance === "slide") this.slideAt = this.t;
      else if (this.lastStance === "slide" && hasClip("Slide_Exit")) this.slideExitUntil = this.t + clipSeconds("Slide_Exit") * 0.6;
      this.lastStance = p.stance;
    }
    // a new melee picks the next of the three swings, so a string of them is not one punch over and over
    const act = p.act ?? null;
    // A throw, a swing, a revive and a reach for something take the hands
    // off the gun: it goes away for the moment, and with it the rifle's
    // two-handed hold, whose reach onto the gun ran after the clip and pulled
    // both arms straight back onto it.
    // SpeedKills' soldier with a long gun strikes with it instead (rifle.ts melee): it keeps it, and both hands on it
    const rifleMelee = act === "melee" && !!this.rifle && !!this.mount && p.stance !== "downed";
    if (act !== this.lastAct) {
      if (act === "melee") this.meleeSwing = (this.meleeSwing + 1) % MELEE_SWINGS.length;
      this.lastAct = act;
      this.actAt = this.t;
    }
    // the soldier's throw is over once the grenade has gone (soldierhold.json throwFor), and the hands go back for the
    // gun: held to the act's own time, its arms hung empty for 0.35 s after the release
    const throwing = act === "throw" && !(this.rifle && this.mount && this.t - this.actAt >= THROW_FOR);
    if (throwing || (act === "melee" && !rifleMelee) || act === "revive" || act === "interact" || act === "finish" || act === "finished") armed = false;
    let lowerOnce = false;
    // the legs
    let lower = "Idle_Loop";
    let lowerRate = 1;
    let full = false;
    switch (p.stance) {
      case "crouch":
        lower = speed > 0.3 ? "Crouch_Fwd_Loop" : "Crouch_Idle_Loop";
        lowerRate = speed > 0.3 ? (speed / 2.2) * dirSign : 1;
        break;
      case "slide":
        lower = hasClip("Slide_Start") && this.t - this.slideAt < clipSeconds("Slide_Start") ? "Slide_Start" : "Slide_Loop";
        full = true;
        break;
      case "air":
        // a fast jump (out of a sprint, a slide, a pad) tucks its legs like an athlete's; a standing hop does not
        lower = speed > ATHLETIC_JUMP && hasClip("NinjaJump_Idle_Loop") ? "NinjaJump_Idle_Loop" : "Jump_Loop";
        break;
      case "climb":
      case "mantle":
        lower = "ClimbUp_1m";
        full = true;
        break;
      case "zip":
        lower = "Idle_Rail_Loop";
        full = true;
        break;
      case "downed":
        lower = "Crouch_Fwd_Loop";
        lowerRate = Math.max(0.2, speed / 2);
        break;
      default:
        if (act === "revive" && hasClip("Fixing_Kneeling")) {
          // on one knee over the one being brought back
          lower = "Fixing_Kneeling";
          full = true;
        } else if (this.t < this.slideExitUntil && speed > 0.3) {
          lower = "Slide_Exit";
          full = true;
        } else if (this.t < this.landUntil) {
          lower = "Jump_Land";
          lowerRate = 2.2;
        } else if (speed > 6.2) {
          lower = "Sprint_Loop";
          lowerRate = (speed / 7.5) * dirSign;
        } else if (speed > 2.6) {
          lower = "Jog_Fwd_Loop";
          lowerRate = (speed / 4.8) * dirSign;
        } else if (speed > 0.3) {
          lower = "Walk_Loop";
          lowerRate = (speed / 1.6) * dirSign;
        }
    }
    // an emote: the gun put away, the arms hanging from the legs' clip, and the pose on top (below);
    // one made of a clip (a dance, a nod) is that clip, whole, instead of a pose
    const em = fx.emote && fx.emote.weight > 0.02 ? fx.emote : null;
    if (em) armed = false;
    const emClip = em?.clip && hasClip(em.clip) ? em.clip : null;
    if (emClip && p.stance !== "air" && p.stance !== "slide") {
      lower = emClip;
      lowerRate = 1;
      full = true;
    }
    // A finisher. The one finishing crouches over the one on the floor and
    // throws a hook, then a cross, from the hips up: standing, the same blows
    // went a metre over a downed head (the snapshot motion-finisher-hook).
    // The one finished stays down, crawling pose and all, until the last
    // blow lands, and only then goes back.
    const finishing = act === "finish" && p.stance !== "air";
    if (finishing) lower = "Crouch_Idle_Loop";
    if (act === "finished" && hasClip("Hit_Knockback") && this.t - this.actAt >= finCfg.blows[finCfg.blows.length - 1]) {
      lower = "Hit_Knockback";
      lowerRate = finCfg.knockRate;
      full = true;
      lowerOnce = true;
    }
    // A jump out of a sprint keeps the sprint's carry, as a runner's gun stays low until they aim: raised in the air and
    // lowered again on landing, the stock swept through the right forearm both ways. And a gun carried low into the
    // landing stays low until the landing is over, to come up in the standing body (Phase 27, 27.12)
    const sprintJump = (p.stance === "air" && speed > 6.2) || (lower === "Jump_Land" && this.lowered > 0.5);
    // the hands: a full-body clip takes them too; otherwise the gun's pose, or the arms' swing
    let upper = lower;
    let upperRate = lowerRate;
    let once = false;
    if (!full) {
      if (finishing) {
        // without the extra clips the jab stands in for both blows
        const hook = hasClip("Melee_Hook") ? "Melee_Hook" : "Punch_Jab";
        const cross = hasClip("Punch_Cross") ? "Punch_Cross" : "Punch_Jab";
        upper = this.t - this.actAt < clipSeconds(hook) / finCfg.rate ? hook : cross;
        upperRate = finCfg.rate;
        once = true;
      } else if (p.act === "heal") {
        upper = "Consume";
        upperRate = 1;
      } else if (this.t < this.headUntil && hasClip("Hit_Head") && p.stance !== "downed") {
        upper = "Hit_Head";
        upperRate = 1.3;
        once = true;
      } else if (this.t < this.staggerUntil && p.stance !== "downed") {
        upper = "Hit_Chest";
        upperRate = 1.1;
        once = true;
      } else if (throwing && hasClip("OverhandThrow") && p.stance !== "downed") {
        upper = "OverhandThrow";
        upperRate = 1.3;
        once = true;
      } else if (rifleMelee) {
        upper = "Pistol_Aim_Neutral";
        upperRate = 1;
      } else if (act === "melee" && p.stance !== "downed") {
        // a jab, a cross or a hook, whichever of them has loaded
        upper = [MELEE_SWINGS[this.meleeSwing], "Punch_Jab"].find((c) => hasClip(c))!;
        upperRate = 1.4;
        once = true;
      } else if (act === "interact" && hasClip("Interact") && p.stance !== "downed") {
        upper = "Interact";
        upperRate = 1;
      } else if (!armed || p.stance === "downed") {
        upper = lower;
      } else if (p.act === "reload") {
        // the soldier's rifle is reloaded by its own hands (rifle.ts); the pistol's reload clip is the rest's
        upper = this.rifle && this.mount ? "Pistol_Aim_Neutral" : "Pistol_Reload";
        upperRate = 1;
        once = !(this.rifle && this.mount);
      } else if ((p.act === "swap" && !this.cupSwap(p)) || ((lower === "Sprint_Loop" || sprintJump) && (p.ads ?? 0) < 0.3)) {
        upper = "Pistol_Idle_Loop";
        upperRate = 1;
      } else {
        upper = "Pistol_Aim_Neutral";
        upperRate = 1;
      }
    }
    this.play("lower", lower, lowerRate, 0.18, lowerOnce);
    this.play("upper", upper, upperRate, 0.15, once);
    // no gun in the hand for a heal, or down (the figure says armed = false then). SpeedKills' soldier, taking its long
    // gun back (after a throw, a heal, a reach for something), has the hands go to it first and shows it once they are
    // nearly there: shown at once, it came back through both hands while they were still on their way (Phase 27, 27.12)
    const wantGun = this.gunShown && armed && p.act !== "heal" && !this.dead;
    if (!wantGun && this.rifle && this.mount) this.gunComing = true;
    if (this.gun) this.gun.visible = wantGun && !(this.gunComing && Math.min(this.gripW, this.ikW) < GUN_BACK);
    this.gunInHand = !!this.gun && this.gun.visible;
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
    // on top of the clips
    const b = this.bones;
    const fig = this.root;
    if (b.pelvis && b.spine_01) {
      turnBone(b.pelvis, fig, Y, fx.legYaw);
      turnBone(b.spine_01, fig, Y, -fx.legYaw);
    }
    const aimed = !full && armed && p.act !== "heal" && p.act !== "swap" && p.stance !== "downed";
    // Down: the crouched walk bent right over into a crawl, the head up to
    // see. At 45 degrees a knocked figure at 30 m read as a live one
    // crouching, which is the one thing a knock has to not look like: bent to
    // about 70 and sunk (below), it is low and plainly out of the fight.
    if (p.stance === "downed" && !full) {
      if (b.spine_01) turnBone(b.spine_01, fig, new THREE.Vector3(1, 0, 0), 0.7);
      if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), 0.5);
      if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -0.95);
    }
    this.scoped = aimed && !act && wantGun && !this.gunComing ? (p.ads ?? 0) * (1 - this.lowered) : 0;
    const pitch = aimed ? Math.max(-70, Math.min(70, p.pitch)) * DEG : 0;
    // (the soldier's chest held up before the look bends it: the clips lean it 33 to 40 degrees crouched and aimed or
    // sprinting, and from behind the shoulder armour and the pack hid the head; the owner, 2026-10-04: more upright)
    if (this.soldier && b.spine_02 && b.spine_03 && b.neck_01 && !full && p.stance !== "downed" && !this.dead) this.holdChestUp(b, fig);
    // +x is the figure's left: a turn about it by a negative angle tips the chest back (a look up)
    const lean = fx.jolt * 0.45 - fx.flinch * 0.22;
    if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5);
    if (b.spine_03) turnBone(b.spine_03, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5 - fx.kick * 0.1);
    // (the soldier's head held up to the look before its deliberate tilts: the clips carried it down with the chest, the
    // head 43 degrees forward of the neck standing, 52 to 56 aimed, 74 to 80 crouched or sprinting, chin on the chest,
    // and from behind a shot at the back of the head it showed took the neck's or torso's volume: 2 to 7 in 100 were
    // headshots sprinting or crouched, the owner unable to headshot one from behind with BOOG)
    if (this.soldier && b.Head && !full && p.stance !== "downed" && !this.dead) this.holdHeadUp(b.Head, fig, pitch);
    if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -fx.flinch * 0.25 + 0.1 * fx.ads);
    // The emote, on top of everything: the arms raised and swung in figure
    // space (+x is the figure's left, +z its front), the forearms bent at the
    // elbow, the spine and the head turned, the hips swung. Each angle arrives
    // eased, so the figure goes into it and comes out of it smoothly. An
    // emote playing its own clip is the clip, with nothing on top.
    if (em && !(emClip && lower === emClip)) {
      const X = new THREE.Vector3(1, 0, 0);
      const Z = new THREE.Vector3(0, 0, 1);
      if (b.pelvis) turnBone(b.pelvis, fig, Y, em.hipSway);
      if (b.spine_02) {
        turnBone(b.spine_02, fig, Y, em.spineTwist);
        turnBone(b.spine_02, fig, X, em.spineLean);
        turnBone(b.spine_02, fig, Z, -em.spineSide);
      }
      if (b.Head) {
        turnBone(b.Head, fig, X, em.headNod);
        turnBone(b.Head, fig, Z, -em.headTilt);
      }
      // the right arm hangs toward -x's side: raising it turns it about the front axis the negative way
      if (b.upperarm_r) {
        turnBone(b.upperarm_r, fig, Z, -em.rRaise);
        turnBone(b.upperarm_r, fig, X, -em.rForward);
      }
      if (b.lowerarm_r) {
        turnBone(b.lowerarm_r, fig, Z, -em.rElbow);
        turnBone(b.lowerarm_r, fig, X, -em.rElbowF);
      }
      if (b.upperarm_l) {
        turnBone(b.upperarm_l, fig, Z, em.lRaise);
        turnBone(b.upperarm_l, fig, X, -em.lForward);
      }
      if (b.lowerarm_l) {
        turnBone(b.lowerarm_l, fig, Z, em.lElbow);
        turnBone(b.lowerarm_l, fig, X, -em.lElbowF);
      }
      this.root.position.y = em.bounce;
    } else this.root.position.y = p.stance === "downed" ? -0.15 : FLAT_FEET.lift * this.liftW;
    // the double jump's knees, up and back down over its time: the thighs forward (a turn about the figure's left by a
    // negative angle brings a hanging bone's end forward) and the knees bent back
    if (lift >= 0 && lift < 1) {
      const w = Math.sin(Math.PI * lift);
      for (const s of ["l", "r"]) {
        const thigh = b[`thigh_${s}`];
        const calf = b[`calf_${s}`];
        if (thigh) turnBone(thigh, fig, X_AXIS, -DOUBLE_JUMP.raise * DEG * w);
        if (calf) turnBone(calf, fig, X_AXIS, DOUBLE_JUMP.bend * DEG * w);
      }
    }
    // Standing or crouched still, the soldier's clips held its toes 16 degrees up from its bind pose, so it stood on its
    // heels (measured by apex-lobby for the card, Milestone 416; the owner asked it fixed): each foot is turned about its
    // own side to side until its toe is no higher than the bind pose has it, eased in as it stops and out as it moves, so
    // a walk's, a run's, a jump's and a kneeling foot's are the clips' own
    const still = this.soldier && (p.stance === "stand" || p.stance === "crouch") && p.speed < FLAT_FEET.under ? 1 : 0;
    this.flatW += (still - this.flatW) * Math.min(1, dt * FLAT_FEET.rate);
    // (and lifted onto them standing: the standing clip holds the legs lower than a walk's planted foot)
    this.liftW += ((still && p.stance === "stand" ? 1 : 0) - this.liftW) * Math.min(1, dt * FLAT_FEET.rate);
    if (this.flatW > 0.01) this.flattenFeet(this.flatW);
    const shown = !!this.gun && this.gun.visible;
    if (this.mount && this.grip && this.rifle && this.butt && this.support) {
      // (the hold goes on for a gun on its way back, not yet shown: the hands go to where it will be)
      const holding = shown || (this.gunComing && wantGun);
      // SpeedKills' soldier: the rifleman's hold (rifle.ts), the stance, the gun and both hands, on top of the clips
      // (a swap in place keeps the gun where it is: SWAP_CUP)
      const cup = this.cupSwap(p);
      // (an overheated gun vents in a carry of its own, soldierhold.json vent, eased in and out as the act holds)
      const low = holding && !full && !rifleMelee && ((p.act === "swap" && !cup) || p.act === "vent" || upper === "Pistol_Idle_Loop") ? 1 : 0;
      this.lowered += (low - this.lowered) * Math.min(1, dt * REACH.lower);
      // a melee's swing: where it is, and which of a string (a string held on the act goes on from one to the next)
      const swung = rifleMelee ? (this.t - this.actAt) / soldierHold.melee.time : -1;
      const melee = swung >= 0 ? { u: swung % 1, swing: this.meleeSwing + Math.floor(swung) } : null;
      this.carryW.swap += ((p.act === "swap" && !cup ? 1 : 0) - this.carryW.swap) * Math.min(1, dt * REACH.lower);
      this.carryW.vent += ((p.act === "vent" ? 1 : 0) - this.carryW.vent) * Math.min(1, dt * REACH.lower);
      // how far into the swap, as the first person's shares of it run: the gun going away over its holster (the first
      // half, held at its middle until the next comes), the one coming over its draw from when it came (the second)
      const SW = swapOf(this.gunId);
      const second = this.gunAt >= this.actAt;
      const swapR = SW && p.act === "swap" ? (second ? Math.min(1, 0.5 + (0.5 * (this.t - this.gunAt)) / swapSeconds(this.gunId).deploy) : Math.min(0.5, (0.5 * (this.t - this.actAt)) / swapSeconds(this.gunId).holster)) : null;
      const K = SWAP_CUP;
      const cupState = cup && K && swapR !== null ? { w: smooth(K.off[0], K.off[1], swapR) * (1 - smooth(K.back[0], K.back[1], swapR)), second, carry: smooth(K.carry[0], K.carry[1], swapR) } : null;
      // (the air's own carry as fast as the jump's clip tucks the body, 0.18 s: at the carry's own pace the body was
      // tucked round a gun still in the sprint's carry, 39 mm into the belly, as the feet left the ground)
      this.carryW.air += ((sprintJump ? 1 : 0) - this.carryW.air) * Math.min(1, dt * AIR_CARRY);
      this.gripW += ((holding && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * REACH.grip);
      // the left hand stays with the gun through a reload: it is the hand that does it
      const support = holding && !full && this.t >= this.staggerUntil;
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * REACH.support);
      if (this.gunComing && Math.min(this.gripW, this.ikW) >= GUN_BACK) this.gunComing = false;
      // a reload's progress, on the gun's own reload time (an enemy's figure is told only that it reloads)
      // (a tactical one, where the first person has its own, laid on the empty one's beats in seconds: rifle.ts tacticalOf)
      const empty = p.reloadEmpty ?? false;
      const tactical = !empty && !!tacticalOf(this.gunId);
      const reloadU = shown && !full && p.act === "reload" ? Math.min(1, (this.t - this.actAt) / reloadSeconds(this.gunId, empty)) : null;
      const reload = reloadU !== null && tactical ? (reloadU * reloadSeconds(this.gunId, false)) / reloadSeconds(this.gunId, true) : reloadU;
      this.rifleOut = holdRifle(this.root, this.bones, this.rifle, { id: this.gunId, gun: this.gun!, mount: this.mount, grip: this.grip, support: this.supportHold(), butt: this.butt, parts: this.reloadParts ?? undefined, sight: this.sight ?? undefined, mid: this.gunMid }, {
        pitch: (Math.max(-70, Math.min(70, p.pitch)) * DEG * (aimed ? 1 : 0)),
        ads: aimed ? (p.ads ?? 0) : 0,
        lowered: this.lowered,
        carry: this.carryW,
        wR: this.gripW,
        wL: this.ikW,
        stance: this.gripW,
        reload,
        reloadTactical: tactical,
        lastReload: this.lastReload,
        // a seat's kick, as the first person's slap of the magazine home (soldierhold.json reload.seatKick)
        kick: Math.max(fx.kick, this.seatKick * soldierHold.reload.seatKick),
        melee,
        mem: this.rifleMem,
        cup: cupState,
      });
      this.lastReload = reload;
      if (this.rifleOut.seated) this.seatKick = 1;
      this.seatKick = Math.max(0, this.seatKick - dt / soldierHold.reload.seatKickFor);
      // a swap's phase: the gun going away out over the first half, the new one in over the second; whole once it is over
      const swapPh = SW && swapR !== null ? (second ? smooth(SW.in[0], SW.in[1], swapR) : 1 - smooth(SW.out[0], SW.out[1], swapR)) : 1;
      const G = this.gunSweep;
      G.phase.value = swapPh;
      G.time.value = this.t;
      // in place, as the first person's (phase.ts radial): out from the gun's edges in, and the next from its middle out
      G.radial.value = cup ? 1 : 0;
      if (swapPh < 1 && this.gun) {
        this.gun.updateWorldMatrix(true, false);
        G.origin.value.copy(this.gunNear).applyMatrix4(this.gun.matrixWorld);
        G.dir.value.copy(this.gunFar).applyMatrix4(this.gun.matrixWorld).sub(G.origin.value);
        G.len.value = Math.max(1e-4, G.dir.value.length());
        G.dir.value.normalize();
        G.center.value.copy(this.gunMid).applyMatrix4(this.gun.matrixWorld);
        G.radius.value = this.gunRadius * this.gun.getWorldScale(new THREE.Vector3()).x;
      }
      // the magazine's phase: along it from its top, as far as the reload has it (1 whole); in a swap the gun's, with it
      const mag = this.reloadParts?.mag;
      const S = this.magSweep;
      S.phase.value = Math.min(this.rifleOut.magPhase ?? 1, swapPh);
      S.time.value = this.t;
      if (swapPh < 1) {
        S.origin.value.copy(G.origin.value);
        S.dir.value.copy(G.dir.value);
        S.len.value = G.len.value;
        S.radial.value = G.radial.value;
        S.center.value.copy(G.center.value);
        S.radius.value = G.radius.value;
      } else if (mag && S.phase.value < 1) {
        mag.updateMatrixWorld(true);
        // out from the top down its length; in the way gunfeel.json phase.magIn says, as the first person's ("up": from its
        // end up), the same key the guns agent's view reads
        const up = (this.rifleOut.magIn ?? false) && (feelCfg.phase as { magIn?: string }).magIn === "up";
        S.origin.value.copy(up ? this.magEnd : this.magTop).applyMatrix4(mag.matrixWorld);
        S.dir.value.copy(up ? this.magTop : this.magEnd).applyMatrix4(mag.matrixWorld).sub(S.origin.value);
        S.len.value = Math.max(1e-4, S.dir.value.length());
        S.dir.value.normalize();
        // round its own middle, as the first person's (fparms.json reload.magPhase "radial"; the owner, 2026-10-01: "make the
        // magazine phase in from the middle out and then we take the mag out it should be from the outside in")
        S.radial.value = MAG_RADIAL ? 1 : 0;
        S.center.value.copy(this.magMid).applyMatrix4(mag.matrixWorld);
        S.radius.value = this.magRadius * mag.getWorldScale(new THREE.Vector3()).x;
      }
    } else if (this.mount && this.grip) {
      // a long gun: lowered and canted across the body for a sprint or a swap, up at the shoulder otherwise
      const low = shown && !full && (p.act === "swap" || upper === "Pistol_Idle_Loop") ? 1 : 0;
      this.lowered += (low - this.lowered) * Math.min(1, dt * REACH.lower);
      this.mount.position.setFromMatrixPosition(this.mountBase);
      this.mount.quaternion.setFromRotationMatrix(this.mountBase);
      if (this.lowered > 1e-3) {
        this.mount.position.y -= CARRY.drop * this.lowered;
        this.mount.rotateX(CARRY.pitch * this.lowered);
        this.mount.rotateZ(CARRY.roll * this.lowered);
      }
      // the right hand always on the grip while it shows; the left on the handguard unless the hands are busy
      this.gripW += ((shown && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * REACH.grip);
      this.reach("r", this.grip, this.gripW);
      const support = shown && !full && p.act !== "reload" && this.t >= this.staggerUntil;
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * REACH.support);
      this.reachSupport(this.ikW);
    } else {
      // a pistol: the aim clip's two-hand grip, the left hand onto the frame's support point
      const holding = aimed && upper === "Pistol_Aim_Neutral" && shown;
      this.ikW += ((holding ? 1 : 0) - this.ikW) * Math.min(1, dt * 10);
      this.reachSupport(this.ikW);
    }
  }

  dispose(): void {
    this.root.traverse((o) => bodyMeshes.delete(o as THREE.SkinnedMesh));
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
    // each clone has its own skeleton (and its bone texture on the GPU), or shares one (disposing a disposed one is nothing)
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.skeleton.dispose();
    });
  }
}

// ------------------------------------------------------------ first-person arms

/**
 * The bones a first-person arm is made of: the forearm, the hand and the
 * fingers, and the end of the upper arm nearest the elbow (FP_UPPER). The
 * rest of the upper arm is left off. Run back to a shoulder by the eye it was
 * a wall of deltoid across the middle of the screen; run on down the drawn
 * forearm's line it swept up both edges of the frame past the eye; and cut
 * right at the elbow, the cut showed.
 */
const ARM_PART = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/;
/** how much of the upper arm a first-person arm keeps, from the elbow, as a share of its length (viewmodel.json realArms) */
/** how much of the upper arm a first-person arm keeps: all of it for SpeedKills' soldier (speedkills.json viewmodel upperArm) */
export const FP_UPPER: number = (IS_SK ? (PROFILE.viewmodel as { upperArm?: number } | undefined)?.upperArm : undefined) ?? vmCfg.realArms.upper;

/**
 * A copy of `g` keeping only the triangles an arm owns: every corner
 * weighted at least half to the arm's own bones. What is left is the arm and
 * the hand, cut off at the shoulder, well out of the frame.
 */
function armOnly(g: THREE.BufferGeometry, skeleton: THREE.Skeleton, forearm = 0): THREE.BufferGeometry {
  const si = g.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute | undefined;
  if (!si || !sw) return g;
  const bones = skeleton.bones.map((b) => b.name);
  const arm = bones.map((b) => ARM_PART.test(b));
  const upper = bones.map((b) => /^upperarm_/.test(b));
  // each side's elbow and upper-arm length at rest, in the mesh's own space
  const rest = (name: string): THREE.Vector3 | null => {
    const i = bones.indexOf(name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const sides = (["l", "r"] as const).map((s) => {
    const e = rest(`lowerarm_${s}`);
    const sh = rest(`upperarm_${s}`);
    return e && sh ? { elbow: e, reach: e.distanceTo(sh) * FP_UPPER } : null;
  });
  const n = g.attributes.position.count;
  const on = new Uint8Array(n);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = (arm[si.getX(i)] ? sw.getX(i) : 0) + (arm[si.getY(i)] ? sw.getY(i) : 0) + (arm[si.getZ(i)] ? sw.getZ(i) : 0) + (arm[si.getW(i)] ? sw.getW(i) : 0);
    const u = (upper[si.getX(i)] ? sw.getX(i) : 0) + (upper[si.getY(i)] ? sw.getY(i) : 0) + (upper[si.getZ(i)] ? sw.getZ(i) : 0) + (upper[si.getW(i)] ? sw.getW(i) : 0);
    let near = false;
    if (u >= 0.5) {
      p.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, i);
      near = sides.some((sd) => !!sd && p.distanceTo(sd.elbow) < sd.reach);
    }
    on[i] = w >= 0.5 || near ? 1 : 0;
  }
  const src = g.index ? (g.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  const keep: number[] = [];
  for (let t = 0; t + 2 < src.length; t += 3) if (on[src[t]] && on[src[t + 1]] && on[src[t + 2]]) keep.push(src[t], src[t + 1], src[t + 2]);
  const out = g.clone();
  out.setIndex(keep);
  if (forearm > 0) {
    armWeightsOnly(out, on, arm.map((a, i) => a || upper[i]));
    slimForearms(out, skeleton, forearm);
  }
  return out;
}

/**
 * The kept points' weight all on the arm's own bones: a point near the shoulder is partly the collarbone's and the
 * spine's, which the first-person rig never poses (fparms.ts poses the upper arm, the forearm and the hand), and drawn
 * whole the upper arm's shoulder end stretched back to them across the screen. What was theirs goes to the arm bone
 * the point is most on.
 */
function armWeightsOnly(g: THREE.BufferGeometry, on: Uint8Array, arm: boolean[]): void {
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    let best = -1;
    let off = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (arm[si.getComponent(i, k)]) {
        if (best < 0 || w > sw.getComponent(i, best)) best = k;
      } else off += w;
    }
    if (best < 0 || off <= 0) continue;
    for (let k = 0; k < 4; k++) if (!arm[si.getComponent(i, k)]) sw.setComponent(i, k, 0);
    sw.setComponent(i, best, sw.getComponent(i, best) + off);
  }
  sw.needsUpdate = true;
}

/**
 * The forearms drawn thinner, their length kept: every point skinned to a forearm drawn in toward the bone, by as much
 * of its weight as the forearm has, so the forearm's median thickness is `radius` (viewmodel.json realArms
 * forearmRadius), measured off this mesh's own points as it loads. SpeedKills' soldier (soldierArmRig): at its armoured
 * thickness the two forearms walled the gun in the sights (the owner, 2026-09-27: "the hands are huge ... covering the
 * weapons"); shrunk whole, a forearm was too short to take the arm out of the frame from a handguard.
 */
function slimForearms(g: THREE.BufferGeometry, skeleton: THREE.Skeleton, radius: number): void {
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const names = skeleton.bones.map((b) => b.name);
  const rest = (name: string): THREE.Vector3 | null => {
    const i = names.indexOf(name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const p = new THREE.Vector3();
  const foot = new THREE.Vector3();
  for (const s of ["l", "r"] as const) {
    const bone = names.indexOf(`lowerarm_${s}`);
    const elbow = rest(`lowerarm_${s}`);
    const wrist = rest(`hand_${s}`);
    if (bone < 0 || !elbow || !wrist) continue;
    const axis = wrist.clone().sub(elbow);
    const len = axis.length();
    axis.normalize();
    const footOf = (v: THREE.Vector3) => foot.copy(elbow).addScaledVector(axis, Math.max(0, Math.min(len, v.clone().sub(elbow).dot(axis))));
    const weight = (i: number) => {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bone) w += sw.getComponent(i, k);
      return w;
    };
    // its thickness now: the median distance from the bone of the points mostly on it
    const r: number[] = [];
    for (let i = 0; i < pos.count; i++) if (weight(i) >= 0.5) r.push(p.fromBufferAttribute(pos, i).distanceTo(footOf(p)));
    if (!r.length) continue;
    r.sort((a, b) => a - b);
    const slim = Math.min(1, radius / r[Math.floor(r.length / 2)]);
    for (let i = 0; i < pos.count; i++) {
      const w = weight(i);
      if (w <= 0) continue;
      p.fromBufferAttribute(pos, i);
      footOf(p);
      p.sub(foot).multiplyScalar(1 - (1 - slim) * w).add(foot);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

const armBodies = new Map<string, THREE.BufferGeometry>();

/** the arms a first-person view is built from, and the clip pose their fingers take */
export interface ArmRig {
  root: THREE.Object3D;
  bones: Record<string, THREE.Bone>;
  /** every finger bone's turn in a hand closed round a grip, bone name to local rotation */
  grip: Map<string, THREE.Quaternion>;
  /** the same for a closed fist, for the empty hands while holstered */
  fist: Map<string, THREE.Quaternion>;
  /** the fist with the index finger out straight, for tapping a hack's card (hackcast.ts) */
  point: Map<string, THREE.Quaternion>;
  /** every finger straight, the body's own rest */
  open: Map<string, THREE.Quaternion>;
  /** the body, build and outfit it was built for, so a change of look rebuilds it */
  key: string;
}

/** the fingers as the body was made, straight, and a fist with only the index finger out */
function restFingers(rig: THREE.Object3D, fist: Map<string, THREE.Quaternion>): { point: Map<string, THREE.Quaternion>; open: Map<string, THREE.Quaternion> } {
  const open = new Map<string, THREE.Quaternion>();
  rig.traverse((o) => {
    if ((o as THREE.Bone).isBone && /^(thumb|index|middle|ring|pinky)_/.test(o.name)) open.set(o.name, o.quaternion.clone());
  });
  const point = new Map(fist);
  for (const [name, q] of open) if (/^index_/.test(name)) point.set(name, q);
  return { point, open };
}

/** a pose's finger turns, sampled off a clip at one moment */
function fingersFrom(rig: THREE.Object3D, clip: THREE.AnimationClip | undefined, at: number): Map<string, THREE.Quaternion> {
  const out = new Map<string, THREE.Quaternion>();
  if (!clip) return out;
  const mixer = new THREE.AnimationMixer(rig);
  const a = mixer.clipAction(clip);
  a.play();
  mixer.setTime(at);
  rig.traverse((o) => {
    if ((o as THREE.Bone).isBone && /^(thumb|index|middle|ring|pinky)_/.test(o.name)) out.set(o.name, o.quaternion.clone());
  });
  a.stop();
  mixer.uncacheRoot(rig);
  return out;
}

/**
 * The player's own arms, for the first-person view: the published body cut
 * down to its arms and hands, in the body and build the loadout picked, with
 * the outfit's own sleeves on them in the outfit's own colour. Null until the
 * body and the clips are in, and the viewmodel keeps its drawn arms till then.
 */
export function buildArmRig(skin: OperatorSkin): ArmRig | null {
  if (soldierTemplate) return soldierArmRig(skin);
  // (SpeedKills: no legacy body's arms, nor its outfit's sleeves fetched, while the soldier is on its way)
  if (!template || soldierPending) return null;
  const name = bodyOf(skin.outfit, skin.body);
  const build = skin.build ?? "regular";
  const body = bodyFor(name, build);
  if (!body) {
    void loadBody(name);
    return null;
  }
  const root = cloneSkinned(body);
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  const keepers: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (!mat.name.startsWith("MI_Superhero")) {
      // the brows and the eyes: no part of an arm
      m.visible = false;
      return;
    }
    const key = `${name}|${build}|${m.name}`;
    let g = armBodies.get(key);
    if (!g) {
      g = armOnly(m.geometry, m.skeleton);
      armBodies.set(key, g);
    }
    m.geometry = g;
    if (g.attributes.color) mat.vertexColors = true;
    m.material = mat;
    m.frustumCulled = false;
    m.castShadow = false;
    keepers.push(m);
  });
  // the outfit's own sleeves, fetched with the outfit and painted by it
  const sleeves = partsOf(skin.outfit).filter((n) => /_Arms$/.test(n));
  void loadOutfit(skin.outfit);
  void loadTint(skin.outfit);
  for (const n of sleeves) {
    const srcs = parts.get(n);
    if (!srcs) continue;
    for (let k = 0; k < srcs.length; k++) {
      const src = srcs[k];
      const bs = src.skeleton.bones.map((b) => bones[b.name]);
      if (bs.some((b) => !b)) continue;
      const mat = (src.material as THREE.MeshStandardMaterial).clone();
      const map = tintMap(skin.outfit, n);
      if (map) mat.map = map;
      else {
        const tint = tintOf(skin.outfit);
        if (tint !== null) mat.color.setHex(tint);
      }
      const gk = `${name}|${build}|${n}#${k}`;
      let g = armBodies.get(gk);
      if (!g) {
        g = armOnly(garmentFor(src, `${n}#${k}`, name, build), src.skeleton);
        armBodies.set(gk, g);
      }
      const mesh = new THREE.SkinnedMesh(g, mat);
      mesh.bind(new THREE.Skeleton(bs as THREE.Bone[], src.skeleton.boneInverses), src.bindMatrix);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.name = `sleeve:${n}`;
      root.add(mesh);
    }
  }
  const t = template;
  // The fingers are the clips' own. The two-handed pistol aim closes the
  // hands round a grip; a jab, a third of the way in, is a closed fist.
  const grip = fingersFrom(cloneSkinned(body), t.clips.get("full:Pistol_Aim_Neutral"), 0);
  const fist = fingersFrom(cloneSkinned(body), t.clips.get("full:Punch_Jab"), 0.3);
  const ready = sleeves.every((n) => parts.has(n)) && (tintOf(skin.outfit) === null || sleeves.every((n) => tintMap(skin.outfit, n)));
  return { root, bones, grip, fist, ...restFingers(cloneSkinned(body), fist), key: `${name}|${build}|${skin.outfit}|${ready ? "dressed" : "bare"}` };
}

/**
 * SpeedKills' soldier's own arms (soldier.ts), the same cut: its gloves and its suit's sleeves in the colours
 * picked, so the arms in the sights are the arms the others see. The old body's arms under an outfit's sleeves
 * would show a wardrobe the soldier does not wear (the picker hides it). The fingers take the soldier's own
 * copies of the clips (retarget.ts carries the fingers too).
 */
function soldierArmRig(skin: OperatorSkin): ArmRig | null {
  const look = soldierLookFor(skin);
  const src = soldierScene(look);
  if (!src || !soldierTemplate) return null;
  const root = cloneSkinned(src);
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  const code = soldierCode(look);
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const slot = m.userData.soldierMaterial as string | undefined;
    // keyed by the pieces shown, not the colours: the cut is the same whatever they are painted
    const key = `soldier|${look.variant}|${[...look.off].sort().join(",")}|${m.name}`;
    let g = armBodies.get(key);
    if (!g) {
      g = armOnly(m.geometry, m.skeleton, vmCfg.realArms.forearmRadius);
      armBodies.set(key, g);
    }
    // a piece with nothing on the arm (a helmet, a vest) is left out rather than drawn empty
    if (!g.index || g.index.count === 0) {
      m.visible = false;
      return;
    }
    m.geometry = g;
    if (slot) m.material = soldierMaterial(slot, look);
    m.frustumCulled = false;
    m.castShadow = false;
  });
  const t = soldierTemplate;
  const grip = fingersFrom(cloneSkinned(src), t.clips.get("full:Pistol_Aim_Neutral"), 0);
  const fist = fingersFrom(cloneSkinned(src), t.clips.get("full:Punch_Jab"), 0.3);
  return { root, bones, grip, fist, ...restFingers(cloneSkinned(src), fist), key: `soldier|${code}` };
}

/**
 * Where a scope's flare hangs: 12 cm ahead of the front of the gun's sight line (its frontmost drawn point within 3 cm
 * of `sightY` and 4 cm of its centre). At the lens itself the lens housing, depth-tested, hid it from every side; ahead,
 * a wall between still does
 */
function lensFront(gun: THREE.Object3D, sightY: number): THREE.Vector3 {
  gun.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert();
  const to = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let front = Infinity;
  gun.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    to.multiplyMatrices(inv, mesh.matrixWorld);
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(to);
      if (Math.abs(v.y - sightY) < 0.03 && Math.abs(v.x) < 0.04) front = Math.min(front, v.z);
    }
  });
  return new THREE.Vector3(0, sightY, Number.isFinite(front) ? front - 0.12 : -0.4);
}

/** what a rig built now for this look would be keyed, so the viewmodel knows when to rebuild */
export function armRigKey(skin: OperatorSkin): string {
  if (soldierTemplate) return `soldier|${soldierCode(soldierLookFor(skin))}`;
  const name = bodyOf(skin.outfit, skin.body);
  const sleeves = partsOf(skin.outfit).filter((n) => /_Arms$/.test(n));
  const ready = sleeves.every((n) => parts.has(n)) && (tintOf(skin.outfit) === null || sleeves.every((n) => tintMap(skin.outfit, n)));
  return `${name}|${skin.build ?? "regular"}|${skin.outfit}|${ready ? "dressed" : "bare"}`;
}
