// What an operator is wearing, as clothes rather than as kit.
//
// src/game/gear.ts is the hard stuff strapped on top: plates, a helmet, a
// pack, a gas mask. This is what is under it. The difference matters because
// it is the clothes that say who somebody is: a man in fatigues and a man in a
// t-shirt and shorts read as two different people before you see a single
// piece of their kit, and our figures were all the same bare body in a
// different colour.
//
// The trick that makes this cheap: every bone in this rig points along its own
// +y with a measured length (thigh 0.400 m, calf 0.429, upper arm 0.274,
// forearm 0.273, measured off the rig itself). So a sleeve is a tube from 0 to
// a fraction of that length, hung on the bone, and it moves with the arm
// without being rigged or weighted to it. A garment that has to bend at a
// joint is a different kind of asset and a different pipeline; a garment made
// of one piece per bone is boxes and cylinders, which is what this is.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import outfitCfg from "../config/outfits.json";

/** the bones a garment can hang on, in the mannequin's rig */
export type WearBone = "spine_01" | "upperarm_l" | "upperarm_r" | "lowerarm_l" | "lowerarm_r" | "thigh_l" | "thigh_r" | "calf_l" | "calf_r" | "Head";

/** one garment, built and ready to hang */
export interface WornPiece {
  id: string;
  bone: WearBone;
  group: THREE.Group;
  /**
   * True when the piece is aligned to the FIGURE rather than to the bone. A
   * sleeve belongs to the arm and turns with it; a pair of goggles belongs to
   * the face and is authored the way a person would describe it, so the head's
   * pieces get the same rest-frame holder the kit does.
   */
  aligned: boolean;
}

export type OutfitId = keyof typeof outfitCfg.sets;
/** what can go on a face, over whatever the kit already puts there */
export type FacePiece = "wrap" | "goggles" | "fullMask";
const FACE_IDS: FacePiece[] = ["wrap", "goggles", "fullMask"];
export type BuildId = keyof typeof outfitCfg.builds;

/** every build there is, and what each is called */
export const BUILD_IDS = Object.keys(outfitCfg.builds) as BuildId[];
export const buildName = (id: BuildId): string => outfitCfg.builds[id].name;

/** every outfit there is, in the order the pickers show them */
export const OUTFIT_IDS = Object.keys(outfitCfg.sets) as OutfitId[];

/** an outfit as a person would describe it: its name and what it is */
export function outfitInfo(id: OutfitId): { name: string; blurb: string } {
  const s = outfitCfg.sets[id];
  return { name: s.name, blurb: s.blurb };
}

/**
 * A player's own choice of clothes as one short string, for the wire and for
 * storage: "urban|heavy|wrap,goggles", and "" when they have not chosen and
 * the operator's own set stands. It rides BESIDE the operator id rather than
 * inside it, so a build that has never heard of clothes still draws the right
 * operator instead of falling back to the first one.
 */
export function lookCode(l: { outfit?: string; build?: string; face?: string }): string {
  const code = `${l.outfit ?? ""}|${l.build ?? ""}|${l.face ?? ""}`;
  return code === "||" ? "" : code;
}

/** a look back off the wire, with anything we do not recognise dropped rather than trusted */
export function readLook(code: string | undefined): { outfit?: OutfitId; build?: BuildId; face?: FacePiece[] } {
  if (typeof code !== "string" || !code) return {};
  const [o, b, f] = code.split("|");
  const out: { outfit?: OutfitId; build?: BuildId; face?: FacePiece[] } = {};
  if (OUTFIT_IDS.includes(o as OutfitId)) out.outfit = o as OutfitId;
  if (BUILD_IDS.includes(b as BuildId)) out.build = b as BuildId;
  const face = faceList(f);
  if (face.length) out.face = face;
  return out;
}

/** "wrap,goggles" as the pieces it names, each at most once */
export function faceList(s: string | undefined): FacePiece[] {
  if (!s) return [];
  const seen = new Set<FacePiece>();
  for (const part of s.split(",")) if (FACE_IDS.includes(part as FacePiece)) seen.add(part as FacePiece);
  return [...seen];
}

const hex = (s: string): number => parseInt(s.replace("#", ""), 16);
const FIT = outfitCfg.fit;
const PIECES = outfitCfg.pieces as Record<string, { bone: string; from: number; to: number; over: number; kind?: string; strips?: number; size?: number[] }>;
const HEAD = outfitCfg.head;

/** the lengths of the bones a garment hangs on, metres, measured off the rig */
const BONE_LEN: Record<string, number> = {
  spine_01: 0.265,
  upperarm: 0.274,
  lowerarm: 0.273,
  thigh: 0.4,
  calf: 0.429,
};

/** how thick the body is at each bone, metres: the widest it gets */
const BODY_R: Record<string, number> = {
  upperarm: FIT.arm,
  lowerarm: FIT.forearm,
  thigh: FIT.thigh,
  calf: FIT.calf,
};

/**
 * How thick the body is ALONG each bone, measured off the model itself
 * (tools/checks/body.ts): six samples from the start of the bone to its end.
 * A limb is not a cylinder. The arm is 84 mm across the shoulder and 61 mm at
 * the elbow; the calf is 61 mm at the knee, 104 mm at the muscle and 54 mm at
 * the ankle. A garment built on one number is inside the body at the wide end
 * or a barrel at the narrow one, and the first is what ours were: the sleeves
 * sat 84 mm inside a 84 mm arm and the bare body came through them in stripes.
 */
const PROFILE = FIT.profile as Record<string, number[]>;

/** the body's radius a fraction of the way along a bone, between the samples */
function bodyAt(bone: string, t: number): number {
  const p = PROFILE[bone];
  if (!p || !p.length) return BODY_R[bone] ?? 0.07;
  const at = Math.max(0, Math.min(1, t)) * (p.length - 1);
  const i = Math.min(p.length - 2, Math.floor(at));
  return p[i] + (p[i + 1] - p[i]) * (at - i);
}

/** the pieces that come in pairs, and the bones they go on */
const SIDED = new Set(["upperarm", "lowerarm", "thigh", "calf"]);

/**
 * A garment along a bone: from `from` to `to` as fractions of the bone's own
 * length, following the body's own shape there plus the garment's thickness.
 * It is turned rather than extruded, which is what lets it narrow at the
 * elbow and swell at the calf; ten sides, because a limb read as round at
 * eight and costs almost nothing at ten.
 */
function tube(bone: string, from: number, to: number, over: number, mat: THREE.Material): THREE.Mesh {
  const len = BONE_LEN[bone] ?? 0.3;
  const steps = 8;
  const y0 = from * len;
  const y1 = Math.max(y0 + 0.02, to * len);
  // a hair of radius at each end closes it off: an open tube on a limb shows
  // its own inside at the cuff, which reads as a hole rather than as cloth
  const pts = [new THREE.Vector2(0.002, y0)];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    pts.push(new THREE.Vector2(bodyAt(bone, from + (to - from) * f) + over, y0 + (y1 - y0) * f));
  }
  pts.push(new THREE.Vector2(0.002, y1));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), mat);
  m.castShadow = true;
  return m;
}

/**
 * Ragged strips hung off a bone, which is what a ghillie suit is: the point of
 * it is that it breaks the outline, and an outline is the thing a player reads
 * at eighty metres where a colour is not. Laid out by a fixed count rather
 * than at random, so the same outfit is the same outfit on every screen.
 */
function rags(bone: string, from: number, to: number, over: number, count: number, size: number[], mat: THREE.Material): THREE.Group {
  const len = BONE_LEN[bone] ?? 0.3;
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    // a spiral rather than rings: rings read as a lampshade
    const f = (i + 0.5) / count;
    const a = f * Math.PI * 2 * 3.7;
    const t = from + (to - from) * f;
    const band = bone === "spine_01" ? bodyBand(t) : null;
    const r = (band ? (band.w + band.d) / 4 : bodyAt(bone, t)) + over;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    strip.position.set(Math.sin(a) * r, t * len - size[1] * 0.35, Math.cos(a) * r + (band ? band.mid : 0));
    strip.rotation.set(0.25 + (i % 3) * 0.12, a, (i % 2 ? 0.2 : -0.2));
    strip.castShadow = true;
    g.add(strip);
  }
  return g;
}

/** a band down the outside of a bone: two of them are what makes a tracksuit a tracksuit */
function stripe(bone: string, from: number, to: number, over: number, size: number[], mat: THREE.Material, side: number): THREE.Mesh {
  const len = BONE_LEN[bone] ?? 0.3;
  const h = Math.max(0.04, (to - from) * len);
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], h, size[2]), mat);
  // on the outside of the limb, which is the side away from the body
  m.position.set(side * (bodyAt(bone, (from + to) / 2) + over), from * len + h / 2, 0);
  m.castShadow = true;
  return m;
}

/** a hood standing off the back of the head, up rather than down */
function hood(m: OutfitMats): THREE.Group {
  const c = outfitCfg.head.hood;
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(c.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), m.cloth);
  shell.scale.y = c.squash;
  shell.castShadow = true;
  g.add(shell);
  // the brow: the edge of a hood that is up, which is the whole of its shape
  const brow = new THREE.Mesh(new THREE.BoxGeometry(c.brow[0], c.brow[1], c.brow[2]), m.cloth);
  brow.position.set(c.browAt[0], c.browAt[1], c.browAt[2]);
  brow.rotation.x = -0.35;
  brow.castShadow = true;
  g.add(brow);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(c.collar[0], c.collar[1], c.collar[2]), m.cloth);
  collar.position.set(c.collarAt[0], c.collarAt[1], c.collarAt[2]);
  collar.castShadow = true;
  g.add(collar);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** the body up the spine, band by band, measured off the model (tools/checks/body.ts) */
const BODY = FIT.body as { from: number; to: number; w: number[]; d: number[]; mid: number[] };

/** the body's width, depth and middle a fraction of the way up the spine bone */
function bodyBand(t: number): { w: number; d: number; mid: number } {
  const n = BODY.w.length;
  const f = Math.max(0, Math.min(1, (t - BODY.from) / (BODY.to - BODY.from))) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  const at = (a: number[]): number => a[i] + (a[i + 1] - a[i]) * k;
  return { w: at(BODY.w), d: at(BODY.d), mid: at(BODY.mid) };
}

/**
 * The body's own shell: a tube of rectangular sections up the spine, one per
 * band, rather than the single box this used to be.
 *
 * The reason is the same as the limbs': the spine bone LEANS BACK, so a
 * garment built on its axis leans with it. The body's middle drifts from
 * +20 mm at the hips to -69 mm at the shoulders, and one box centred on an
 * average of that is too wide at the waist, too shallow at the chest and 90 mm
 * out at the collar, which is where the tops of the shoulders used to stand
 * outside their own jacket.
 */
function torso(from: number, to: number, over: number, mat: THREE.Material, shoulders = 1): THREE.Mesh {
  const len = BONE_LEN.spine_01;
  const steps = 7;
  const ring: number[][] = [];
  for (let i = 0; i < steps; i++) {
    const t = from + ((to - from) * i) / (steps - 1);
    const b = bodyBand(t);
    const hw = (b.w * shoulders) / 2 + over;
    const hd = b.d / 2 + over;
    const y = t * len;
    // where the body's middle actually is at this height, measured, which is
    // what the old single offset (fit.torsoAt) was standing in for
    const z = b.mid;
    // four corners, the same way round at every band
    ring.push([-hw, y, z - hd, hw, y, z - hd, hw, y, z + hd, -hw, y, z + hd]);
  }
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of ring) for (let c = 0; c < 4; c++) pos.push(r[c * 3], r[c * 3 + 1], r[c * 3 + 2]);
  for (let i = 0; i < steps - 1; i++) {
    for (let c = 0; c < 4; c++) {
      const a = i * 4 + c;
      const b = i * 4 + ((c + 1) % 4);
      idx.push(a, b + 4, b, a, a + 4, b + 4);
    }
  }
  // the ends, so a jacket is not open at the hem and the collar
  const base = ring.length * 4;
  pos.push(0, ring[0][1], ring[0][2] + (ring[0][8] - ring[0][2]) / 2);
  pos.push(0, ring[steps - 1][1], ring[steps - 1][2] + (ring[steps - 1][8] - ring[steps - 1][2]) / 2);
  for (let c = 0; c < 4; c++) {
    idx.push(base, ((c + 1) % 4), c);
    idx.push(base + 1, (steps - 1) * 4 + c, (steps - 1) * 4 + ((c + 1) % 4));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** the materials an outfit is made of */
export interface OutfitMats {
  cloth: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  boots: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

/**
 * An outfit's colours.
 *
 * The glass is DARK, on every operator: a quarter of the visor colour, so the
 * operator's own tint is still in it, and no glow behind it. A lens you can
 * see a face through is a lens that is not doing anything, and every figure in
 * this game should read as somebody who does not want to be recognised. The
 * lenses are backed as well (`lensBack` below), because a dark transparent
 * material still shows what is behind it under a bright sky.
 */
export function outfitMaterials(id: OutfitId, visor: number, eye: number): OutfitMats {
  const s = outfitCfg.sets[id];
  const dark = new THREE.Color(visor).multiplyScalar(0.25).getHex();
  return {
    cloth: new THREE.MeshStandardMaterial({ color: hex(s.cloth), roughness: 0.94, metalness: 0.02 }),
    trim: new THREE.MeshStandardMaterial({ color: hex(s.trim), roughness: 0.9, metalness: 0.05 }),
    boots: new THREE.MeshStandardMaterial({ color: hex(s.boots), roughness: 0.75, metalness: 0.08 }),
    // eye is kept for the rim light on the lens edge, at a tenth of what it was
    glass: new THREE.MeshStandardMaterial({ color: dark, roughness: 0.18, metalness: 0.85, emissive: eye, emissiveIntensity: 0.01 }),
  };
}

/** what sits immediately behind a lens: flat black, so no face reads through it */
const lensBack = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.95, metalness: 0 });

/** a head wrap: a shell round the skull with a tail down the back */
function wrap(m: OutfitMats): THREE.Group {
  const c = HEAD.wrap;
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(c.radius, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m.cloth);
  shell.scale.y = c.squash;
  shell.castShadow = true;
  g.add(shell);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(c.tail[0], c.tail[1], c.tail[2]), m.cloth);
  tail.position.set(c.tailAt[0], c.tailAt[1], c.tailAt[2]);
  tail.rotation.x = -0.25;
  tail.castShadow = true;
  g.add(tail);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** goggles: two round lenses on a strap, which read as goggles where a flat bar reads as shades */
function goggles(m: OutfitMats): THREE.Group {
  const c = HEAD.goggles;
  const g = new THREE.Group();
  const back = lensBack();
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(c.lens, c.lens, 0.022, 12), m.glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(side * c.gap, 0, 0);
    g.add(lens);
    // the eye behind it, blacked out
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(c.lens * 0.94, c.lens * 0.94, 0.008, 12), back);
    blank.rotation.x = Math.PI / 2;
    blank.position.set(side * c.gap, 0, -0.012);
    g.add(blank);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.lens, 0.009, 6, 14), m.trim);
    rim.position.set(side * c.gap, 0, 0.002);
    g.add(rim);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(c.gap * 2 - c.lens, 0.02, 0.02), m.trim);
  g.add(bridge);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(c.strap[0], c.strap[1], c.strap[2]), m.trim);
  strap.position.z = -0.06;
  g.add(strap);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/**
 * A motocross helmet: a shell round the whole skull, a chin bar across the
 * jaw, and a peak over the brow. It is the one piece of headgear here that
 * covers a face by itself, which is why the set that wears it needs nothing
 * else on its own.
 */
function mxHelmet(m: OutfitMats): THREE.Group {
  const c = outfitCfg.head.mxHelmet;
  const g = new THREE.Group();
  // the shell: an ellipsoid round the measured head, a couple of centimetres
  // proud of it everywhere (the head is 173 mm across and 265 mm tall in its
  // own bone's frame, and its face reaches 106 mm forward)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), m.cloth);
  shell.scale.set(c.shell[0], c.shell[1], c.shell[2]);
  shell.castShadow = true;
  g.add(shell);
  // the peak, which is the line that says dirt bike from any distance
  const peak = new THREE.Mesh(new THREE.BoxGeometry(c.peak[0], c.peak[1], c.peak[2]), m.trim);
  peak.position.set(c.peakAt[0], c.peakAt[1], c.peakAt[2]);
  peak.rotation.x = c.peakTilt;
  peak.castShadow = true;
  g.add(peak);
  // the visor band, where the eyes would be: dark, and backed, so there is
  // nothing to read behind it
  const visor = new THREE.Mesh(new THREE.BoxGeometry(c.visor[0], c.visor[1], c.visor[2]), m.glass);
  visor.position.set(c.visorAt[0], c.visorAt[1], c.visorAt[2]);
  g.add(visor);
  const blank = new THREE.Mesh(new THREE.BoxGeometry(c.visor[0] * 0.96, c.visor[1] * 0.92, 0.012), lensBack());
  blank.position.set(c.visorAt[0], c.visorAt[1], c.visorAt[2] - c.visor[2] * 0.6);
  g.add(blank);
  // the chin bar across the jaw, and the vent in it
  const chin = new THREE.Mesh(new THREE.BoxGeometry(c.chin[0], c.chin[1], c.chin[2]), m.cloth);
  chin.position.set(c.chinAt[0], c.chinAt[1], c.chinAt[2]);
  chin.castShadow = true;
  g.add(chin);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(c.vent[0], c.vent[1], c.vent[2]), m.trim);
  vent.position.set(c.ventAt[0], c.ventAt[1], c.ventAt[2]);
  g.add(vent);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** a full-face mask: the whole face, not the nose and mouth the gas mask covers */
function fullMask(m: OutfitMats): THREE.Group {
  const c = HEAD.fullMask;
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), m.trim);
  face.castShadow = true;
  g.add(face);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(c.lens[0], c.lens[1], c.lens[2]), m.glass);
  lens.position.set(0, c.size[1] * 0.18, c.size[2] * 0.48);
  g.add(lens);
  const blank = new THREE.Mesh(new THREE.BoxGeometry(c.lens[0] * 0.96, c.lens[1] * 0.9, 0.01), lensBack());
  blank.position.set(0, c.size[1] * 0.18, c.size[2] * 0.48 - c.lens[2] * 0.6);
  g.add(blank);
  const f = new THREE.Mesh(new THREE.CylinderGeometry(c.filter.r, c.filter.r, c.filter.len, 10), m.trim);
  f.rotation.x = Math.PI / 2;
  f.position.set(c.filter.at[0], c.filter.at[1], c.filter.at[2]);
  g.add(f);
  g.position.set(c.at[0], c.at[1], c.at[2]);
  return g;
}

/** everything that goes on a head, by name: a set's own and a player's choice both come through here */
function headPiece(id: string, m: OutfitMats): THREE.Group | null {
  if (id === "wrap") return wrap(m);
  if (id === "goggles") return goggles(m);
  if (id === "fullMask") return fullMask(m);
  if (id === "hood") return hood(m);
  if (id === "mxHelmet") return mxHelmet(m);
  return null;
}

/** one mesh per material: a sleeve and its cuff are one thing to draw */
function weld(group: THREE.Group): THREE.Group {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out = new THREE.Group();
  out.name = group.name;
  out.position.copy(group.position);
  out.quaternion.copy(group.quaternion);
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) {
      out.add(child.clone(true));
      continue;
    }
    const g = mesh.geometry.clone();
    mesh.updateMatrix();
    g.applyMatrix4(mesh.matrix);
    const list = byMat.get(mesh.material as THREE.Material) ?? [];
    list.push(g);
    byMat.set(mesh.material as THREE.Material, list);
  }
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    out.add(mesh);
  }
  return out;
}

/**
 * Everything an outfit puts on a figure. `face` is what it wears on its head
 * on top of the set's own clothes, which is the operator's choice rather than
 * the outfit's: a wrap, goggles, a full mask, or nothing.
 */
export function buildOutfit(id: OutfitId, mats: OutfitMats, face: FacePiece[] = [], build: BuildId = "regular"): WornPiece[] {
  const set = outfitCfg.sets[id];
  // how heavy-set this one is: thicker cloth and wider shoulders, and the
  // body and its hit boxes exactly as they were (outfits.json builds)
  const b = outfitCfg.builds[build] ?? outfitCfg.builds.regular;
  const out: WornPiece[] = [];
  for (const name of set.wears) {
    const p = PIECES[name];
    if (!p) continue;
    // a stripe and a set of rags are the trim colour: they are there to be
    // seen against the cloth, which is the whole of their job
    const mat = name === "boot" ? mats.boots : name === "cuff" || p.kind ? mats.trim : mats.cloth;
    const make = (bone: WearBone, side: "" | "_l" | "_r"): void => {
      const g = new THREE.Group();
      g.name = `wear:${name}${side}`;
      const over = p.over * b.cloth;
      if (p.kind === "rags") g.add(rags(p.bone, p.from, p.to, over, p.strips ?? 12, p.size ?? [0.05, 0.16, 0.012], mat));
      else if (p.kind === "stripe") g.add(stripe(p.bone, p.from, p.to, over, p.size ?? [0.026, 0, 0.016], mat, side === "_l" ? 1 : -1));
      else g.add(p.bone === "spine_01" ? torso(p.from, p.to, over, mat, b.shoulders) : tube(p.bone, p.from, p.to, over, mat));
      out.push({ id: name, bone, group: weld(g), aligned: false });
    };
    if (SIDED.has(p.bone)) {
      make(`${p.bone}_l` as WearBone, "_l");
      make(`${p.bone}_r` as WearBone, "_r");
    } else make(p.bone as WearBone, "");
  }
  // what the SET puts on the head (a hood is part of a hoodie, not a choice),
  // and then what the player chose on top of it
  for (const h of (set as { head?: string[] }).head ?? []) {
    const g = headPiece(h, mats);
    if (!g) continue;
    g.name = `wear:${h}`;
    out.push({ id: h, bone: "Head", group: weld(g), aligned: true });
  }
  for (const f of face) {
    // the set may already wear it (a motocross set brings its own goggles)
    if (out.some((w) => w.id === f)) continue;
    const g = headPiece(f, mats);
    if (!g) continue;
    g.name = `wear:${f}`;
    out.push({ id: f, bone: "Head", group: weld(g), aligned: true });
  }
  return out;
}
