// First-person weapon models, built in code.
//
// The old viewmodel was six boxes and a cylinder, and that is most of why the
// game read as Roblox: a gun is defined by its SILHOUETTE, and stacked boxes
// cannot draw a pistol grip, a stock or a curved magazine. So every major part
// here is a side profile, drawn as a 2D outline and extruded to its width with
// a small bevel. That one technique gives real receivers, grips, stocks and
// magazines, and the bevel puts a highlight on every edge, which is what reads
// as machined metal.
//
// The shapes are our own. No model, texture or file from any game is used;
// PROJECT_RULES.md draws that line and this file stays on the right side of it.
//
// Coordinates: metres, gun-local. +x right, +y up, and the muzzle points down
// -z. Profiles are written as [forward, up] pairs because that is how you read
// a gun side-on; `prof()` turns them into geometry.
//
// Parts are merged per material, so a whole rifle costs a handful of draw
// calls. Anything that animates (magazine, bolt, slide, pump, cylinder,
// hammer) is kept as its own group so the viewmodel can move it.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** a profile point: [forward, up], with an optional per-corner chamfer */
type P = [number, number] | [number, number, number];

export type Cycle = "auto" | "slide" | "pump" | "bolt" | "cylinder" | "none";
export type ReloadStyle = "mag" | "cylinder" | "shells";

export interface HandPlacement {
  /** forward and up of the hand's centre, gun-local */
  f: number;
  u: number;
  x?: number;
  /** tilt of the held bar from vertical, radians, top leaning forward */
  angle: number;
  scale?: number;
}

export interface GunModel {
  id: string;
  root: THREE.Group;
  mag: THREE.Group | null;
  /** the rarity-coloured base plate, recoloured by mag level */
  magPlate: THREE.Mesh | null;
  bolt: THREE.Group | null;
  cylinder: THREE.Group | null;
  hammer: THREE.Group | null;
  pump: THREE.Group | null;
  cycle: Cycle;
  reload: ReloadStyle;
  /** how far the bolt, slide or pump travels, metres */
  travel: number;
  /** muzzle, gun-local */
  muzzle: THREE.Vector3;
  /** ejection port, gun-local; null for weapons that do not eject casings */
  port: THREE.Vector3 | null;
  shell: "brass" | "hull" | null;
  /** height of the sight line and the forward position of the rear sight */
  sightY: number;
  rearF: number;
  /**
   * Iron sights that come off when an optic is fitted, or null where the
   * sights are low enough to sit under an optic's sight line (the pistols)
   */
  irons: THREE.Group | null;
  /** top of the rail or slide an optic clamps to, and where along it the optic's centre sits */
  railY: number;
  opticF: number;
  /** a pistol's optic rides the slide, so it moves with it */
  opticOnSlide: boolean;
  /** where the magazine sits when seated, for the support hand on a reload */
  magBottom: THREE.Vector3;
  grip: HandPlacement;
  support: HandPlacement & { kind: "guard" | "pistol" | "pump" };
  /** visual recoil strength, 1 = rifle */
  kick: number;
  energy: boolean;
  /** hip pose, before the global viewmodel scale */
  hip: THREE.Vector3;
}

// ------------------------------------------------------------------ textures

/**
 * Tileable value noise, drawn once. Used as a roughness map on metal and a
 * bump map on polymer: a perfectly uniform roughness is the single biggest
 * tell of a CG surface, and a few percent of variation fixes it.
 */
function noiseTexture(size: number, cells: number, octaves: number, lo: number, hi: number): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(size, size);
  const acc = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * n;
      const y0 = Math.floor(gy) % n;
      const y1 = (y0 + 1) % n;
      let ty = gy - Math.floor(gy);
      ty = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * n;
        const x0 = Math.floor(gx) % n;
        const x1 = (x0 + 1) % n;
        let tx = gx - Math.floor(gx);
        tx = tx * tx * (3 - 2 * tx);
        const a = grid[y0 * n + x0] + (grid[y0 * n + x1] - grid[y0 * n + x0]) * tx;
        const b = grid[y1 * n + x0] + (grid[y1 * n + x1] - grid[y1 * n + x0]) * tx;
        acc[y * size + x] += (a + (b - a) * ty) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < acc.length; i++) {
    const v = Math.round((lo + (hi - lo) * (acc[i] / total)) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let roughTex: THREE.CanvasTexture | null = null;
let stippleTex: THREE.CanvasTexture | null = null;
function textures(): { rough: THREE.CanvasTexture; stipple: THREE.CanvasTexture } {
  if (!roughTex) {
    roughTex = noiseTexture(256, 8, 4, 0.62, 1.0);
    roughTex.repeat.set(6, 6);
    stippleTex = noiseTexture(256, 64, 2, 0, 1);
    stippleTex.repeat.set(9, 9);
  }
  return { rough: roughTex, stipple: stippleTex! };
}

// ----------------------------------------------------------------- materials

export interface Mats {
  body: THREE.MeshStandardMaterial;
  body2: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  poly: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  inset: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  sight: THREE.MeshStandardMaterial;
  energy: THREE.MeshStandardMaterial;
  grip: THREE.MeshStandardMaterial;
}

const matCache = new Map<string, Mats>();

/**
 * The body is anodised aluminium (partly metallic, a coloured base), the
 * barrel and bolt are bare steel (fully metallic, so they pick up the sky),
 * and the furniture is stippled polymer (not metallic at all). Getting those
 * three responses different from each other matters more than any colour.
 */
function materials(body: number, accent: number, grip: number): Mats {
  const key = `${body}:${accent}:${grip}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const { rough, stipple } = textures();
  const bodyC = new THREE.Color(body);
  const m: Mats = {
    // Cerakote-style coated finish: mostly paint, a little metal. At 0.55
    // metalness the body mirrored the blue sky and every rifle read as navy.
    body: new THREE.MeshStandardMaterial({ color: bodyC, metalness: 0.28, roughness: 0.5, roughnessMap: rough }),
    body2: new THREE.MeshStandardMaterial({
      color: bodyC.clone().multiplyScalar(0.72),
      metalness: 0.25,
      roughness: 0.56,
      roughnessMap: rough,
    }),
    metal: new THREE.MeshStandardMaterial({ color: 0x51565c, metalness: 0.92, roughness: 0.36, roughnessMap: rough }),
    poly: new THREE.MeshStandardMaterial({
      color: 0x2c3035,
      metalness: 0.02,
      roughness: 0.84,
      bumpMap: stipple,
      bumpScale: 0.35,
    }),
    accent: new THREE.MeshStandardMaterial({ color: accent, metalness: 0.15, roughness: 0.58, roughnessMap: rough }),
    inset: new THREE.MeshStandardMaterial({ color: 0x07080a, metalness: 0.2, roughness: 0.95 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0, roughness: 0.96, bumpMap: stipple, bumpScale: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.3 }),
    sight: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff8a2a, emissiveIntensity: 2.4 }),
    energy: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xc2ec3c, emissiveIntensity: 2.6 }),
    grip: new THREE.MeshStandardMaterial({ color: grip, metalness: 0.02, roughness: 0.8, bumpMap: stipple, bumpScale: 0.45 }),
  };
  // The camera sits left of the gun, so the flank it sees faces away from the
  // sun and rendered near-black. Games solve that with a lighting rig that
  // only touches the viewmodel; three cannot mask lights per object, but these
  // materials ARE viewmodel-only, so extra image-based fill on them does the
  // same job without brightening the world.
  for (const mat of Object.values(m)) mat.envMapIntensity = 1.9;
  matCache.set(key, m);
  return m;
}

/** rarity colours for the magazine base plate: none, white, blue, purple, gold */
const RARITY = [0, 0xe2e2e2, 0x3b8bff, 0xb04cff, 0xffc12e];
const rarityMats = RARITY.map((c) =>
  c
    ? new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, metalness: 0.3, roughness: 0.45 })
    : null
);

// --------------------------------------------------------------- primitives

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** a placement matrix from forward/up/x and optional rotation and scale */
function T(f = 0, u = 0, x = 0, rx = 0, ry = 0, rz = 0, s = 1): THREE.Matrix4 {
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  tmpS.set(s, s, s);
  tmpP.set(x, u, -f);
  return tmpM.clone().compose(tmpP, tmpQ, tmpS);
}

/** replace each corner with two points, so an outline reads as machined */
function chamfer(pts: P[], r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const cr = p.length > 2 ? (p[2] as number) : r;
    if (cr <= 0) {
      out.push([p[0], p[1]]);
      continue;
    }
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(cr, da * 0.45);
    const rb = Math.min(cr, db * 0.45);
    out.push([p[0] + ((a[0] - p[0]) / da) * ra, p[1] + ((a[1] - p[1]) / da) * ra]);
    out.push([p[0] + ((b[0] - p[0]) / db) * rb, p[1] + ((b[1] - p[1]) / db) * rb]);
  }
  return out;
}

/**
 * Extrude a side profile to a width, centred on x. The bevel is what makes the
 * edge catch light; the chamfer is what makes the outline look cut rather than
 * drawn. Holes are how a skeleton stock, a trigger guard and a revolver's
 * cylinder window get made without boolean operations.
 */
function prof(pts: P[], width: number, ch = 0.003, bevel = 0.0022, holes: P[][] = []): THREE.BufferGeometry {
  const c = chamfer(pts, ch);
  const shape = new THREE.Shape();
  shape.moveTo(c[0][0], c[0][1]);
  for (let i = 1; i < c.length; i++) shape.lineTo(c[i][0], c[i][1]);
  shape.closePath();
  for (const h of holes) {
    const hc = chamfer(h, ch);
    const path = new THREE.Path();
    path.moveTo(hc[0][0], hc[0][1]);
    for (let i = 1; i < hc.length; i++) path.lineTo(hc[i][0], hc[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  const b = Math.min(bevel, width * 0.3);
  const depth = Math.max(0.0005, width - 2 * b);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b * 0.75,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  // shape x (forward) -> world -z; extrude depth -> world x
  g.rotateY(Math.PI / 2);
  return g;
}

/** a cylinder along the barrel axis; `rf` at the front, `rr` at the rear */
function cylZ(rf: number, rr: number, len: number, seg = 20): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rr, rf, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** a cylinder across the gun, along x */
function cylX(r: number, len: number, seg = 18): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** a small box; `w` across, `h` up, `l` along the barrel */
function box(w: number, h: number, l: number, r = 0): THREE.BufferGeometry {
  if (r > 0) return new RoundedBoxGeometry(w, h, l, 2, Math.min(r, Math.min(w, h, l) * 0.45));
  return new THREE.BoxGeometry(w, h, l);
}

/**
 * Collects geometry per material and merges it. `add` bakes the placement in,
 * so the merged mesh needs no per-part transforms at all.
 */
class Part {
  private byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) {
      if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    }
    g.clearGroups();
    if (m) g.applyMatrix4(m);
    const list = this.byMat.get(mat) ?? [];
    list.push(g);
    this.byMat.set(mat, list);
    geo.dispose();
    return this;
  }

  build(name: string): THREE.Group {
    const grp = new THREE.Group();
    grp.name = name;
    for (const [mat, geos] of this.byMat) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `${name}:${(mat as THREE.MeshStandardMaterial).name || "m"}`;
      grp.add(mesh);
      for (const g of geos) g.dispose();
    }
    return grp;
  }
}

/**
 * A pistol-grip outline along an axis from `top` to `bottom`, with finger
 * grooves on the front strap and a palm swell on the back. The swell is small,
 * 6 mm, and it is the difference between a grip and a slanted plank.
 */
function gripOutline(top: [number, number], bottom: [number, number], depth: number, grooves: number): P[] {
  const af = bottom[0] - top[0];
  const au = bottom[1] - top[1];
  const L = Math.hypot(af, au);
  const df = af / L;
  const du = au / L;
  // perpendicular pointing toward the muzzle
  const nf = -du;
  const nu = df;
  const N = 14;
  const front: P[] = [];
  const back: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const groove = grooves > 0 && t > 0.15 && t < 0.92 ? -0.0028 * Math.abs(Math.sin(Math.PI * grooves * ((t - 0.15) / 0.77))) : 0;
    const flare = t > 0.9 ? 0.004 * ((t - 0.9) / 0.1) : 0;
    const hf = depth / 2 + groove + flare;
    const hb = depth / 2 + 0.006 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + flare;
    front.push([top[0] + af * t + nf * hf, top[1] + au * t + nu * hf, 0.0015]);
    back.push([top[0] + af * t - nf * hb, top[1] + au * t - nu * hb, 0.0015]);
  }
  // bottom corners get a real radius, the rest a small chamfer
  front[N] = [front[N][0], front[N][1], 0.006];
  back[N] = [back[N][0], back[N][1], 0.006];
  return [...front, ...back.reverse()];
}

/**
 * A magazine outline hanging from its own origin (the top of the magazine
 * well). `curve` is how far forward the bottom sits: 0 is a straight stick,
 * 0.05 is a rifle magazine, 0.08 is the deep curve of a big-calibre one.
 */
function magOutline(len: number, depth: number, curve: number): { pts: P[]; bottomF: number; angle: number } {
  const N = 12;
  const front: P[] = [];
  const back: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cf = curve * Math.pow(t, 1.6);
    const cu = -len * t;
    const hd = (depth / 2) * (1 + 0.1 * t);
    front.push([cf + hd, cu, 0.002]);
    back.push([cf - hd, cu, 0.002]);
  }
  const tanF = curve * 1.6;
  const angle = Math.atan2(tanF, len);
  return { pts: [...front, ...back.reverse()], bottomF: curve, angle };
}

// ---------------------------------------------------------------- rifle kit

export interface RifleSpec {
  body: number;
  accent: number;
  grip?: number;
  recvRear: number;
  recvFront: number;
  recvH: number;
  width: number;
  guardLen: number;
  guardTop: number;
  guardBot: number;
  guardW: number;
  guardVents: number;
  barrelLen: number;
  barrelR: number;
  muzzle: "brake" | "flash" | "can" | "energy" | "none";
  stock: "solid" | "skeleton" | "thumbhole" | "folded" | "none";
  stockLen: number;
  mag: "curved" | "straight" | "box" | "drum" | "energy" | "none";
  magF: number;
  magLen: number;
  magCurve: number;
  magDepth: number;
  magW: number;
  sightH: number;
  cycle: Cycle;
  reload: ReloadStyle;
  kick: number;
  energy: boolean;
  bipod: boolean;
  carryHandle: boolean;
  tubeMag: boolean;
  pump: boolean;
  shell: "brass" | "hull" | null;
  /** three barrels in a triangle (Triple Take) */
  triple: boolean;
}

const RIFLE: RifleSpec = {
  body: 0x6a7079,
  accent: 0xc9772f,
  recvRear: 0.14,
  recvFront: 0.16,
  recvH: 0.056,
  width: 0.034,
  guardLen: 0.24,
  guardTop: 0.05,
  guardBot: -0.026,
  guardW: 0.042,
  guardVents: 4,
  barrelLen: 0.13,
  barrelR: 0.0095,
  muzzle: "brake",
  stock: "solid",
  stockLen: 0.3,
  mag: "curved",
  magF: 0.085,
  magLen: 0.19,
  magCurve: 0.05,
  magDepth: 0.062,
  magW: 0.028,
  sightH: 0.024,
  cycle: "auto",
  reload: "mag",
  kick: 1,
  energy: false,
  bipod: false,
  carryHandle: false,
  tubeMag: false,
  pump: false,
  shell: "brass",
  triple: false,
};

function buildRifle(id: string, s: RifleSpec): GunModel {
  const M = materials(s.body, s.accent, s.grip ?? 0x1e2125);
  const root = new THREE.Group();
  root.name = `gun:${id}`;
  const stat = new Part();

  const W = s.width;
  const rear = -s.recvRear;
  const front = s.recvFront;
  const top = s.recvH;
  const guardEnd = front + s.guardLen;
  const axisU = top * 0.5;
  const railTop = top + 0.012;
  const sightY = railTop + s.sightH;

  // ---- upper receiver, with a ramped rear and a dust-cover step
  stat.add(
    prof(
      [
        [rear, 0.004],
        [rear, top - 0.014, 0.008],
        [rear + 0.024, top],
        [front, top],
        [front, 0.002],
        [front - 0.06, 0.002, 0],
        [front - 0.07, -0.004, 0],
        [rear + 0.03, -0.004],
      ],
      W,
      0.004
    ),
    M.body
  );
  // raised ribs down both flanks, the detail that stops a receiver reading flat
  for (const sx of [-1, 1]) {
    stat.add(box(0.002, 0.008, s.recvRear + s.recvFront - 0.06, 0.001), M.body2, T((rear + front) / 2, top * 0.72, sx * (W / 2 + 0.0008)));
  }

  // ---- lower receiver with the magazine-well flare
  const mf = s.magF;
  stat.add(
    prof(
      [
        [rear + 0.07, 0.002],
        [rear + 0.07, -0.018],
        [rear + 0.1, -0.034],
        [mf - 0.042, -0.034],
        [mf - 0.047, -0.05, 0.004],
        [mf + 0.047, -0.05, 0.004],
        [mf + 0.052, -0.03],
        [front - 0.012, -0.026],
        [front - 0.012, 0.002],
      ],
      W * 0.94,
      0.004
    ),
    M.body2
  );

  // ---- pistol grip
  const gripTop: [number, number] = [-0.024, -0.028];
  const gripBot: [number, number] = [-0.07, -0.138];
  stat.add(prof(gripOutline(gripTop, gripBot, 0.042, 3), W * 0.9, 0.0015, 0.004), M.grip);

  // ---- trigger guard (an L, open at the back where the grip meets it) and trigger
  stat.add(
    prof(
      [
        [-0.006, -0.051],
        [-0.006, -0.058],
        [mf - 0.04, -0.058],
        [mf - 0.04, -0.034],
        [mf - 0.047, -0.034],
        [mf - 0.047, -0.051],
      ],
      0.014,
      0.002,
      0.0015
    ),
    M.poly
  );
  stat.add(prof([[0.012, -0.028], [0.021, -0.028], [0.017, -0.047], [0.008, -0.05]], 0.006, 0.0015, 0.001), M.metal);

  // ---- ejection port and fire selector
  if (s.shell) stat.add(box(0.0012, 0.024, 0.07), M.inset, T(0.035, top * 0.5, W / 2 + 0.0004));
  stat.add(cylX(0.006, W + 0.004), M.metal, T(-0.03, 0.012, 0));
  stat.add(box(0.004, 0.004, 0.018, 0.001), M.accent, T(-0.03, 0.012, -(W / 2 + 0.004)));

  // ---- charging handle at the rear top
  if (!s.energy) stat.add(prof([[rear - 0.005, top - 0.004], [rear + 0.035, top - 0.004], [rear + 0.035, top + 0.006], [rear - 0.005, top + 0.006]], 0.03, 0.002), M.metal);

  // ---- handguard with vents and an accent stripe
  stat.add(
    prof(
      [
        [front - 0.004, s.guardTop],
        [guardEnd, s.guardTop - 0.004],
        [guardEnd, s.guardBot + 0.012, 0.008],
        [guardEnd - 0.014, s.guardBot],
        [front + 0.02, s.guardBot],
        [front - 0.004, s.guardBot + 0.016],
      ],
      s.guardW,
      0.005,
      0.003
    ),
    s.energy ? M.body : M.poly
  );
  for (let i = 0; i < s.guardVents; i++) {
    const vf = front + 0.04 + (i * (s.guardLen - 0.07)) / Math.max(1, s.guardVents - 1);
    for (const sx of [-1, 1]) {
      stat.add(box(0.0014, 0.012, 0.03, 0.002), s.energy ? M.energy : M.inset, T(vf, (s.guardTop + s.guardBot) / 2 - 0.004, sx * (s.guardW / 2 + 0.0004)));
    }
  }
  for (const sx of [-1, 1]) {
    stat.add(box(0.0016, 0.006, s.guardLen * 0.7, 0.001), M.accent, T(front + s.guardLen * 0.45, s.guardTop - 0.012, sx * (s.guardW / 2 + 0.0006)));
  }

  // ---- top rail with teeth
  const railFrom = rear + 0.012;
  const railTo = guardEnd - 0.02;
  const railLen = railTo - railFrom;
  stat.add(box(0.022, 0.007, railLen), M.metal, T((railFrom + railTo) / 2, top + 0.0035));
  const teeth = Math.floor(railLen / 0.0105);
  for (let i = 0; i < teeth; i++) stat.add(box(0.022, 0.005, 0.0055), M.metal, T(railFrom + 0.006 + i * 0.0105, top + 0.0095));

  // ---- barrel, gas block and the muzzle device
  const bStart = guardEnd - 0.02;
  const bEnd = guardEnd + s.barrelLen;
  const barrelOffsets = s.triple ? [[0, 0.009], [-0.009, -0.006], [0.009, -0.006]] : [[0, 0]];
  for (const [bx, bu] of barrelOffsets) stat.add(cylZ(s.barrelR, s.barrelR, bEnd - bStart), M.metal, T((bStart + bEnd) / 2, axisU + bu, bx));
  stat.add(box(0.026, 0.03, 0.03, 0.004), M.body2, T(guardEnd + 0.005, axisU + 0.004));
  const muzzleF = bEnd;
  let muzzleEnd = bEnd;
  const mr = s.barrelR;
  if (s.muzzle === "brake") {
    const len = 0.05;
    stat.add(cylZ(mr * 1.75, mr * 1.8, len, 16), M.metal, T(muzzleF + len / 2, axisU));
    for (let i = 0; i < 3; i++) {
      for (const sx of [-1, 1]) stat.add(box(0.004, mr * 1.6, 0.007), M.inset, T(muzzleF + 0.012 + i * 0.013, axisU, sx * mr * 1.7));
    }
    muzzleEnd += len;
  } else if (s.muzzle === "flash") {
    const len = 0.042;
    stat.add(cylZ(mr * 1.3, mr * 1.4, len, 16), M.metal, T(muzzleF + len / 2, axisU));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      stat.add(box(0.0015, 0.006, 0.02), M.inset, T(muzzleF + len - 0.01, axisU + Math.sin(a) * mr * 1.32, Math.cos(a) * mr * 1.32, 0, 0, a));
    }
    muzzleEnd += len;
  } else if (s.muzzle === "can") {
    const len = 0.13;
    stat.add(cylZ(mr * 2.2, mr * 2.2, len, 22), M.body2, T(muzzleF + len / 2 - 0.02, axisU));
    muzzleEnd += len - 0.02;
  } else if (s.muzzle === "energy") {
    const len = 0.06;
    stat.add(box(0.036, 0.04, len, 0.006), M.body, T(muzzleF + len / 2, axisU));
    const ring = new THREE.TorusGeometry(0.013, 0.0022, 8, 24);
    stat.add(ring, M.energy, T(muzzleF + len + 0.001, axisU));
    muzzleEnd += len;
  }

  // ---- iron sights: a ringed rear aperture and a guarded front post. Their
  // own group, because fitting an optic takes them off (as in Apex), or the
  // rear aperture sits right in front of the optic's window.
  const ironPart = new Part();
  const rearF = rear + 0.035;
  ironPart.add(box(0.026, 0.01, 0.03, 0.002), M.metal, T(rearF, railTop + 0.004));
  for (const sx of [-1, 1]) ironPart.add(box(0.005, sightY - railTop + 0.006, 0.014, 0.0015), M.metal, T(rearF, (railTop + sightY + 0.006) / 2 + 0.002, sx * 0.0095));
  ironPart.add(new THREE.TorusGeometry(0.0048, 0.0017, 8, 18), M.metal, T(rearF, sightY));
  const frontF = guardEnd - 0.028;
  ironPart.add(box(0.004, sightY - railTop, 0.006), M.metal, T(frontF, (railTop + sightY) / 2));
  for (const sx of [-1, 1]) ironPart.add(box(0.003, sightY - railTop + 0.004, 0.012, 0.001), M.metal, T(frontF, (railTop + sightY + 0.004) / 2, sx * 0.009));
  ironPart.add(new THREE.SphereGeometry(0.0022, 8, 6), M.sight, T(frontF, sightY));
  const irons = ironPart.build("irons");
  root.add(irons);

  // ---- stock
  const sEnd = rear - s.stockLen;
  if (s.stock === "solid" || s.stock === "skeleton" || s.stock === "thumbhole") {
    const outline: P[] = [
      [rear + 0.004, top - 0.01],
      [sEnd + 0.03, top - 0.004],
      [sEnd, top - 0.012, 0.01],
      [sEnd, -0.07, 0.01],
      [sEnd + 0.045, -0.066],
      [rear - 0.03, -0.018],
      [rear + 0.004, -0.012],
    ];
    const holes: P[][] = [];
    if (s.stock === "skeleton") {
      holes.push([
        [rear - 0.035, top - 0.022],
        [sEnd + 0.04, top - 0.018],
        [sEnd + 0.04, -0.05],
        [sEnd + 0.06, -0.052],
        [rear - 0.045, -0.02],
      ]);
    } else if (s.stock === "thumbhole") {
      holes.push([
        [rear - 0.03, top - 0.03],
        [rear - 0.1, top - 0.03],
        [rear - 0.1, -0.02],
        [rear - 0.045, -0.012],
      ]);
    }
    stat.add(prof(outline, 0.036, 0.006, 0.004, holes), s.stock === "thumbhole" && s.grip ? M.grip : M.poly);
    // butt pad and an accent band where the stock meets the pad
    stat.add(prof([[sEnd + 0.002, top - 0.014], [sEnd + 0.002, -0.072], [sEnd - 0.014, -0.072], [sEnd - 0.014, top - 0.014]], 0.04, 0.005, 0.004), M.rubber);
    stat.add(box(0.0375, 0.006, 0.012, 0.001), M.accent, T(sEnd + 0.02, top - 0.006));
  } else if (s.stock === "folded") {
    stat.add(box(0.006, 0.03, 0.2, 0.002), M.metal, T(rear + 0.06, axisU, W / 2 + 0.006));
    stat.add(prof([[rear + 0.002, top - 0.01], [rear - 0.02, top - 0.01], [rear - 0.02, -0.01], [rear + 0.002, -0.01]], 0.03, 0.004), M.poly);
  }

  // ---- extras
  if (s.carryHandle) {
    stat.add(prof([[rear + 0.03, top], [rear + 0.04, top + 0.045], [front - 0.02, top + 0.045], [front - 0.01, top]], 0.014, 0.006, 0.003, [[[rear + 0.05, top + 0.004], [rear + 0.052, top + 0.032], [front - 0.032, top + 0.032], [front - 0.03, top + 0.004]]]), M.body2);
  }
  if (s.bipod) {
    for (const sx of [-1, 1]) stat.add(box(0.006, 0.006, 0.17, 0.002), M.metal, T(guardEnd - 0.1, s.guardBot - 0.006, sx * 0.012));
    stat.add(box(0.03, 0.014, 0.02, 0.003), M.body2, T(guardEnd - 0.012, s.guardBot - 0.004));
  }
  const tubeU = axisU - s.barrelR - 0.014;
  if (s.tubeMag) {
    stat.add(cylZ(0.011, 0.011, bEnd - front - 0.02), M.metal, T((front + bEnd) / 2, tubeU));
    stat.add(cylZ(0.012, 0.012, 0.01), M.body2, T(bEnd - 0.02, tubeU));
  }

  // ---- magazine, its own group so it can drop out on a reload
  let mag: THREE.Group | null = null;
  let magPlate: THREE.Mesh | null = null;
  let magBottom = new THREE.Vector3(0, -0.03 - s.magLen, -mf);
  if (s.mag !== "none") {
    const mp = new Part();
    if (s.mag === "curved" || s.mag === "straight" || s.mag === "energy") {
      const curve = s.mag === "curved" ? s.magCurve : 0.004;
      const len = s.mag === "energy" ? s.magLen * 0.7 : s.magLen;
      const o = magOutline(len, s.magDepth, curve);
      mp.add(prof(o.pts, s.magW, 0.002, 0.002), s.energy ? M.body : M.poly);
      // a raised centre rib down each side
      const rib = magOutline(len * 0.86, s.magDepth * 0.5, curve * 0.86);
      mp.add(prof(rib.pts, s.magW + 0.003, 0.002, 0.0015), s.energy ? M.body2 : M.poly, T(0.002, -len * 0.05));
      if (s.mag === "energy") mp.add(box(s.magW + 0.004, len * 0.55, 0.01, 0.002), M.energy, T(curve * 0.4, -len * 0.45));
      magBottom = new THREE.Vector3(0, -0.03 - len, -(mf + o.bottomF));
      // the base plate, recoloured by magazine rarity
      const plateGeo = new RoundedBoxGeometry(s.magW + 0.006, 0.01, s.magDepth * 1.18, 2, 0.003);
      magPlate = new THREE.Mesh(plateGeo, M.accent);
      magPlate.position.set(0, -len - 0.004, -o.bottomF);
      magPlate.rotation.x = -o.angle;
    } else if (s.mag === "box") {
      mp.add(box(0.07, 0.11, 0.1, 0.008), M.body2, T(0, -0.05, -0.012));
      mp.add(box(0.074, 0.01, 0.104, 0.004), M.accent, T(0, -0.1));
      magBottom = new THREE.Vector3(0, -0.13, -mf);
    } else if (s.mag === "drum") {
      mp.add(cylX(0.065, 0.058, 28), M.body2, T(0, -0.085));
      mp.add(cylX(0.05, 0.062, 28), M.poly, T(0, -0.085));
      mp.add(box(0.03, 0.03, 0.05, 0.004), M.body2, T(0, -0.02));
      magBottom = new THREE.Vector3(0, -0.15, -mf);
    }
    mag = mp.build("mag");
    if (magPlate) mag.add(magPlate);
    mag.position.set(0, -0.03, -mf);
    root.add(mag);
  }

  // ---- bolt, visible through the ejection port, or a bolt-action handle
  let bolt: THREE.Group | null = null;
  let travel = 0;
  if (s.cycle === "auto" && s.shell) {
    const bp = new Part();
    bp.add(box(0.003, 0.018, 0.05, 0.001), M.metal);
    bp.add(box(0.004, 0.004, 0.012), M.metal, T(0.018, 0.006, 0.002));
    bolt = bp.build("bolt");
    bolt.position.set(W / 2 + 0.0008, top * 0.5, -0.035);
    root.add(bolt);
    travel = 0.028;
  } else if (s.cycle === "bolt") {
    const bp = new Part();
    bp.add(cylZ(0.008, 0.008, 0.07), M.metal, T(0, 0, 0));
    bp.add(cylX(0.0035, 0.045), M.metal, T(0.02, 0, 0.022, 0, 0, -0.5));
    bp.add(new THREE.SphereGeometry(0.009, 14, 10), M.metal, T(0.02, -0.02, 0.043));
    bolt = bp.build("bolt");
    bolt.position.set(W / 2 - 0.004, top * 0.62, -0.01);
    root.add(bolt);
    travel = 0.06;
  }

  // ---- pump forend around the tube magazine
  let pump: THREE.Group | null = null;
  if (s.pump) {
    const pp = new Part();
    pp.add(prof([[0, 0.02], [0.13, 0.02], [0.136, 0.012], [0.136, -0.024], [0.13, -0.03], [0, -0.03], [-0.006, -0.02], [-0.006, 0.012]], 0.052, 0.004, 0.004), M.poly);
    for (let i = 0; i < 6; i++) pp.add(box(0.0535, 0.003, 0.006), M.inset, T(0.02 + i * 0.018, -0.028));
    pump = pp.build("pump");
    pump.position.set(0, tubeU, -(front + 0.03));
    root.add(pump);
    travel = 0.07;
  }

  root.add(stat.build("static"));

  const supportF = s.pump ? front + 0.09 : front + s.guardLen * 0.42;
  return {
    id,
    root,
    mag,
    magPlate,
    bolt,
    cylinder: null,
    hammer: null,
    pump,
    cycle: s.cycle,
    reload: s.reload,
    travel,
    muzzle: new THREE.Vector3(0, axisU, -muzzleEnd),
    port: s.shell ? new THREE.Vector3(W / 2 + 0.004, top * 0.55, -0.04) : null,
    shell: s.shell,
    sightY,
    irons,
    railY: railTop,
    opticF: rearF + 0.06,
    opticOnSlide: false,
    rearF,
    magBottom,
    grip: { f: -0.047, u: -0.075, angle: 0.32 },
    support: {
      f: supportF,
      u: s.pump ? tubeU - 0.006 : s.guardBot + 0.022,
      angle: Math.PI / 2,
      scale: 1.15,
      kind: s.pump ? "pump" : "guard",
    },
    kick: s.kick,
    energy: s.energy,
    hip: new THREE.Vector3(0.21, -0.22, -0.5),
  };
}

// --------------------------------------------------------------- pistol kit

interface PistolSpec {
  body: number;
  accent: number;
  slideLen: number;
  triple: boolean;
  extMag: boolean;
  kick: number;
}

function buildPistol(id: string, s: PistolSpec): GunModel {
  const M = materials(s.body, s.accent, 0x1e2125);
  const root = new THREE.Group();
  root.name = `gun:${id}`;
  const stat = new Part();
  const SL = s.slideLen;
  const sTop = 0.031;
  const sightY = sTop + 0.006;
  const rearF = -0.066;

  // ---- frame, dust cover and accessory notches
  stat.add(
    prof(
      [
        [-0.07, 0.0],
        [SL - 0.004, 0.0],
        [SL - 0.004, -0.016, 0.004],
        [0.045, -0.018],
        [0.035, -0.012],
        [-0.03, -0.012],
        [-0.07, -0.006],
      ],
      0.026,
      0.003
    ),
    M.poly
  );
  for (let i = 0; i < 3; i++) stat.add(box(0.027, 0.004, 0.004), M.inset, T(0.06 + i * 0.012, -0.014));

  // ---- trigger guard, a real closed loop cut with a hole
  stat.add(
    prof(
      [[-0.012, -0.012], [0.05, -0.012], [0.056, -0.02], [0.053, -0.045], [0.045, -0.05], [0.004, -0.05], [-0.012, -0.04]],
      0.022,
      0.004,
      0.002,
      [[[-0.004, -0.018], [0.043, -0.018], [0.047, -0.023], [0.044, -0.041], [0.039, -0.043], [0.008, -0.043], [-0.004, -0.034]]]
    ),
    M.poly
  );
  stat.add(prof([[0.012, -0.012], [0.02, -0.012], [0.017, -0.03], [0.009, -0.033]], 0.006, 0.0015, 0.001), M.metal);

  // ---- grip, with a stippled accent panel
  stat.add(prof(gripOutline([-0.045, -0.006], [-0.072, -0.118], 0.047, 3), 0.03, 0.0015, 0.004), M.poly);
  stat.add(prof(gripOutline([-0.049, -0.03], [-0.068, -0.1], 0.03, 0), 0.0325, 0.002, 0.001), M.grip);
  stat.add(box(0.012, 0.004, 0.018, 0.001), M.accent, T(-0.025, -0.004, -0.014));

  // ---- the slide, which cycles on every shot
  const sp = new Part();
  if (s.triple) {
    sp.add(prof([[-0.075, 0.0], [-0.075, 0.03], [-0.066, sTop + 0.004], [SL, sTop + 0.004], [SL + 0.008, 0.028], [SL + 0.008, 0.0]], 0.036, 0.005), M.body);
    for (const [bx, bu] of [[0, 0.026], [-0.009, 0.01], [0.009, 0.01]]) {
      sp.add(cylZ(0.0085, 0.0085, 0.02), M.metal, T(SL + 0.014, bu, bx));
      sp.add(cylZ(0.005, 0.005, 0.002), M.inset, T(SL + 0.0245, bu, bx));
    }
  } else {
    sp.add(prof([[-0.075, 0.0], [-0.075, 0.024], [-0.068, sTop], [SL, sTop], [SL + 0.006, 0.024], [SL + 0.006, 0.0]], 0.027, 0.004), M.body);
    // cocking serrations
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) sp.add(box(0.0014, 0.02, 0.0028), M.inset, T(-0.066 + i * 0.006, 0.015, sx * 0.0137));
    }
    sp.add(box(0.001, 0.012, 0.034), M.inset, T(0.02, 0.022, 0.0136));
    sp.add(cylZ(0.0065, 0.0065, 0.004), M.inset, T(SL + 0.0065, 0.015));
  }
  // sights ride on the slide
  for (const sx of [-1, 1]) sp.add(box(0.007, 0.007, 0.01, 0.0015), M.metal, T(rearF, sTop + 0.0035, sx * 0.0055));
  sp.add(box(0.004, 0.007, 0.008, 0.001), M.metal, T(SL - 0.008, sTop + 0.0035));
  sp.add(new THREE.SphereGeometry(0.0018, 8, 6), M.sight, T(SL - 0.008, sightY));
  const slide = sp.build("slide");
  root.add(slide);

  // ---- magazine, hidden inside the grip until it drops out
  const mp = new Part();
  const gTop: [number, number] = [-0.047, -0.01];
  const gBot: [number, number] = [-0.07, -0.118];
  mp.add(prof(gripOutline(gTop, gBot, 0.032, 0), 0.02, 0.002, 0.001), M.metal);
  const mag = mp.build("mag");
  const ext = s.extMag ? 0.014 : 0;
  const plateGeo = new RoundedBoxGeometry(0.032, 0.009 + ext, 0.05, 2, 0.003);
  const magPlate = new THREE.Mesh(plateGeo, M.accent);
  magPlate.position.set(0, gBot[1] - 0.004 - ext / 2, -gBot[0]);
  magPlate.rotation.x = -Math.atan2(gTop[0] - gBot[0], gTop[1] - gBot[1]);
  mag.add(magPlate);
  root.add(mag);

  root.add(stat.build("static"));

  return {
    id,
    root,
    mag,
    magPlate,
    bolt: slide,
    cylinder: null,
    hammer: null,
    pump: null,
    cycle: s.triple ? "none" : "slide",
    reload: "mag",
    travel: 0.02,
    muzzle: new THREE.Vector3(0, s.triple ? 0.02 : 0.015, -(SL + (s.triple ? 0.03 : 0.012))),
    port: s.triple ? null : new THREE.Vector3(0.016, 0.022, -0.02),
    shell: s.triple ? null : "brass",
    sightY,
    irons: null,
    railY: sTop,
    opticF: rearF + 0.034,
    opticOnSlide: !s.triple,
    rearF,
    magBottom: new THREE.Vector3(0, gBot[1] - 0.01, -gBot[0]),
    grip: { f: -0.058, u: -0.06, angle: 0.24 },
    support: { f: -0.058, u: -0.075, x: -0.036, angle: 0.24, scale: 1, kind: "pistol" },
    kick: s.kick,
    energy: false,
    hip: new THREE.Vector3(0.16, -0.17, -0.4),
  };
}

// -------------------------------------------------------------- revolver kit

/**
 * The Wingman: a heavy-frame revolver with a full underlug, a vented top rib
 * and a fluted six-shot cylinder that turns one chamber per shot. The frame
 * is extruded with a window cut through it, so the cylinder genuinely sits
 * inside the frame rather than floating beside it.
 */
function buildRevolver(id: string): GunModel {
  const M = materials(0x5f646b, 0xb8742e, 0x5b3a24);
  const root = new THREE.Group();
  root.name = `gun:${id}`;
  const stat = new Part();

  const cylF = 0.036;
  const cylU = 0.008;
  const cylR = 0.028;
  const boreU = cylU + 0.017;
  const sightY = 0.056;
  const rearF = -0.042;
  const bEnd = 0.295;

  // ---- frame, with the cylinder window cut through it
  stat.add(
    prof(
      [
        [-0.064, -0.02],
        [-0.064, 0.03],
        [-0.05, 0.047],
        [0.08, 0.047],
        [0.084, 0.041],
        [0.084, -0.018],
        [0.072, -0.028],
        [0.004, -0.028],
        [-0.012, -0.032],
        [-0.042, -0.032],
      ],
      0.03,
      0.004,
      0.0025,
      [[[0.004, -0.0215], [0.068, -0.0215], [0.068, 0.0385], [0.004, 0.0385]]]
    ),
    M.body
  );
  // side plate seams and the crane latch
  for (const sx of [-1, 1]) stat.add(box(0.0012, 0.03, 0.001), M.inset, T(-0.03, 0.006, sx * 0.0152));
  stat.add(box(0.004, 0.008, 0.014, 0.002), M.metal, T(-0.012, 0.018, -0.0165));

  // ---- barrel shroud: vented top rib, full underlug, polished flats
  stat.add(
    prof(
      [
        [0.078, 0.047],
        [bEnd - 0.004, 0.045],
        [bEnd, 0.041],
        [bEnd, 0.004],
        [bEnd - 0.012, -0.007],
        [0.11, -0.007],
        [0.088, -0.021],
        [0.078, -0.021],
      ],
      0.026,
      0.004,
      0.0025
    ),
    M.body
  );
  for (let i = 0; i < 6; i++) stat.add(box(0.012, 0.0015, 0.014), M.inset, T(0.1 + i * 0.03, 0.0465));
  for (const sx of [-1, 1]) {
    stat.add(box(0.0012, 0.018, bEnd - 0.12, 0.001), M.metal, T((0.1 + bEnd) / 2 + 0.005, 0.02, sx * 0.0131));
    stat.add(box(0.0012, 0.003, bEnd - 0.12), M.accent, T((0.1 + bEnd) / 2 + 0.005, 0.034, sx * 0.0132));
  }
  stat.add(cylZ(0.0068, 0.0068, 0.003), M.inset, T(bEnd + 0.0005, boreU));
  stat.add(cylZ(0.0038, 0.0038, 0.05), M.metal, T(0.11, -0.014));

  // ---- sights
  stat.add(prof([[bEnd - 0.03, 0.045], [bEnd - 0.012, 0.045], [bEnd - 0.016, sightY + 0.002], [bEnd - 0.026, sightY + 0.002]], 0.004, 0.001, 0.0008), M.metal);
  stat.add(new THREE.SphereGeometry(0.0019, 8, 6), M.sight, T(bEnd - 0.021, sightY));
  for (const sx of [-1, 1]) stat.add(box(0.0055, 0.011, 0.012, 0.0015), M.metal, T(rearF, 0.0515, sx * 0.0058));

  // ---- grip: a chunky rubber grip with finger grooves
  stat.add(prof(gripOutline([-0.036, -0.026], [-0.078, -0.132], 0.05, 3), 0.036, 0.0015, 0.005), M.grip);
  stat.add(box(0.037, 0.006, 0.02, 0.002), M.accent, T(-0.028, -0.024));

  // ---- trigger guard and trigger
  stat.add(
    prof(
      [[-0.012, -0.028], [0.046, -0.028], [0.052, -0.036], [0.048, -0.059], [0.04, -0.064], [0.004, -0.064], [-0.012, -0.052]],
      0.022,
      0.004,
      0.002,
      [[[-0.004, -0.034], [0.04, -0.034], [0.044, -0.039], [0.041, -0.055], [0.036, -0.057], [0.008, -0.057], [-0.004, -0.047]]]
    ),
    M.body
  );
  stat.add(prof([[0.01, -0.028], [0.019, -0.028], [0.015, -0.049], [0.006, -0.052]], 0.007, 0.0015, 0.001), M.metal);

  // ---- the cylinder: fluted, six chambers, brass visible at the rear face
  const cp = new Part();
  const cylLen = 0.058;
  cp.add(cylZ(cylR, cylR, cylLen, 36), M.metal);
  cp.add(cylZ(cylR * 0.92, cylR * 0.92, 0.004, 36), M.body2, T(cylLen / 2 - 0.001));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // chambers on the front face
    cp.add(cylZ(0.0056, 0.0056, 0.004, 12), M.inset, T(cylLen / 2 + 0.0003, sa * 0.017, ca * 0.017));
    // brass case heads at the back
    cp.add(cylZ(0.0058, 0.0058, 0.003, 12), M.brass, T(-cylLen / 2 - 0.0003, sa * 0.017, ca * 0.017));
    // flutes between chambers
    const fa = a + Math.PI / 6;
    cp.add(box(0.0065, 0.004, cylLen * 0.62, 0.0015), M.inset, T(-0.004, Math.sin(fa) * (cylR - 0.0012), Math.cos(fa) * (cylR - 0.0012), 0, 0, fa + Math.PI / 2));
  }
  const cylinder = cp.build("cylinder");
  cylinder.position.set(0, cylU, -cylF);
  root.add(cylinder);

  // ---- hammer, pivoting at the rear of the frame
  const hp = new Part();
  hp.add(prof([[0.006, 0.0], [-0.004, 0.0], [-0.01, 0.022], [-0.024, 0.028], [-0.022, 0.018], [-0.006, 0.014]], 0.008, 0.0015, 0.001), M.metal);
  const hammer = hp.build("hammer");
  hammer.position.set(0, 0.028, 0.058);
  root.add(hammer);

  root.add(stat.build("static"));

  return {
    id,
    root,
    mag: null,
    magPlate: null,
    bolt: null,
    cylinder,
    hammer,
    pump: null,
    cycle: "cylinder",
    reload: "cylinder",
    travel: 0,
    muzzle: new THREE.Vector3(0, boreU, -(bEnd + 0.006)),
    port: null,
    shell: "brass",
    sightY,
    irons: null,
    railY: sightY - 0.006,
    opticF: rearF + 0.045,
    opticOnSlide: false,
    rearF,
    magBottom: new THREE.Vector3(-0.04, cylU, -cylF),
    grip: { f: -0.064, u: -0.07, angle: 0.36, scale: 1.08 },
    support: { f: -0.064, u: -0.088, x: -0.04, angle: 0.36, scale: 1.05, kind: "pistol" },
    kick: 1.9,
    energy: false,
    hip: new THREE.Vector3(0.16, -0.175, -0.42),
  };
}

// ------------------------------------------------------- detailed pistols

/**
 * Shared pieces of a modern polymer-frame pistol, built at real size. Both
 * detailed pistols are self-contained groups with the grip origin at the
 * hand, which is exactly what a WebXR controller grip space needs: parent the
 * root to the grip and offset by `grip`, no viewmodel code involved.
 */
interface DetailedPistolSpec {
  id: string;
  slideColor: number;
  frameColor: number;
  accent: number;
  /** slide from rearF to frontF along the barrel */
  rearF: number;
  frontF: number;
  slideTop: number;
  slideW: number;
  /** grip axis: top and bottom centres */
  gripTop: [number, number];
  gripBot: [number, number];
  grooves: number;
  /** holes cut through the slide sides, as [f0, f1, u0, u1] */
  windows: Array<[number, number, number, number]>;
  railSlots: number;
  beavertail: number;
  flaredWell: boolean;
  squareGuard: boolean;
  nightSights: boolean;
  kick: number;
}

function buildDetailedPistol(s: DetailedPistolSpec): GunModel {
  const M = materials(s.slideColor, s.accent, s.frameColor);
  const frameMat = new THREE.MeshStandardMaterial({
    color: s.frameColor,
    metalness: 0.05,
    roughness: 0.72,
    bumpMap: textures().stipple,
    bumpScale: 0.25,
    envMapIntensity: 1.9,
  });
  const root = new THREE.Group();
  root.name = `gun:${s.id}`;
  const stat = new Part();
  const R = s.rearF;
  const F = s.frontF;
  const TOP = s.slideTop;
  const W = s.slideW;
  const boreU = 0.015;
  const sightY = TOP + 0.006;

  // ---- frame: dust cover, accessory rail, trigger guard, beavertail
  stat.add(
    prof(
      [
        [R + 0.006, 0.002],
        [F - 0.008, 0.002],
        [F - 0.008, -0.013, 0.004],
        [0.06, -0.017],
        [0.05, -0.012],
        [-0.02, -0.012],
        [R - s.beavertail, -0.004, 0.006],
        [R - s.beavertail, 0.002],
      ],
      W - 0.002,
      0.003
    ),
    frameMat
  );
  for (let i = 0; i < s.railSlots; i++) stat.add(box(W - 0.001, 0.004, 0.004), M.inset, T(0.062 + i * 0.011, -0.015));
  // trigger guard: a real loop cut with a hole, squared off at the front
  const gF = s.squareGuard ? 0.058 : 0.054;
  stat.add(
    prof(
      [
        [-0.012, -0.011],
        [gF - 0.006, -0.011],
        [gF, -0.017],
        [gF, s.squareGuard ? -0.043 : -0.04, 0.006],
        [gF - 0.01, -0.05],
        [0.004, -0.05],
        [-0.012, -0.04],
      ],
      0.021,
      0.004,
      0.002,
      [[[-0.004, -0.017], [gF - 0.009, -0.017], [gF - 0.006, -0.022], [gF - 0.006, -0.039], [gF - 0.013, -0.044], [0.007, -0.044], [-0.004, -0.034]]]
    ),
    frameMat
  );
  // trigger with its safety blade
  stat.add(prof([[0.013, -0.012], [0.021, -0.012], [0.019, -0.03], [0.011, -0.034]], 0.007, 0.0015, 0.001), frameMat);
  stat.add(box(0.0022, 0.012, 0.002), M.inset, T(0.017, -0.022));

  // ---- grip, with a stippled panel either side and a flat base
  stat.add(prof(gripOutline(s.gripTop, s.gripBot, 0.05, s.grooves), W + 0.004, 0.0015, 0.004), frameMat);
  const panelTop: [number, number] = [s.gripTop[0] - 0.004, s.gripTop[1] - 0.03];
  const panelBot: [number, number] = [s.gripBot[0] + 0.003, s.gripBot[1] + 0.02];
  stat.add(prof(gripOutline(panelTop, panelBot, 0.034, 0), W + 0.0065, 0.003, 0.001), M.grip);
  // controls: magazine release, slide stop, takedown lever
  stat.add(box(0.004, 0.008, 0.009, 0.002), M.accent, T(-0.008, -0.02, -(W / 2 + 0.003)));
  stat.add(box(0.003, 0.004, 0.022, 0.0015), M.metal, T(0.02, 0.0, -(W / 2 + 0.0015)));
  for (const sx of [-1, 1]) stat.add(box(0.002, 0.004, 0.009, 0.001), M.metal, T(0.032, -0.006, sx * (W / 2 + 0.001)));
  if (s.flaredWell) {
    stat.add(prof(gripOutline([s.gripBot[0] + 0.002, s.gripBot[1] + 0.012], [s.gripBot[0], s.gripBot[1] - 0.001], 0.058, 0), W + 0.012, 0.003, 0.002), M.accent);
  }

  // ---- the slide: windows cut through, serrations, port, sights
  const sp = new Part();
  sp.add(
    prof(
      [
        [R, 0.001],
        [R, TOP - 0.006, 0.005],
        [R + 0.007, TOP],
        [F - 0.006, TOP],
        [F, TOP - 0.007, 0.004],
        [F, 0.001],
      ],
      W,
      0.004,
      0.002,
      s.windows.map(([f0, f1, u0, u1]) => [[f0, u0], [f1, u0], [f1, u1], [f0, u1]] as P[])
    ),
    M.body
  );
  // the barrel, visible through the windows and at the muzzle
  sp.add(cylZ(0.0068, 0.0068, F - R - 0.012), M.metal, T((R + F) / 2 + 0.004, boreU));
  sp.add(cylZ(0.0046, 0.0046, 0.002), M.inset, T(F + 0.0005, boreU));
  // rear serrations, and front ones on the longer slides
  for (let i = 0; i < 8; i++) {
    for (const sx of [-1, 1]) sp.add(box(0.0012, TOP - 0.008, 0.0022), M.inset, T(R + 0.006 + i * 0.0048, (TOP - 0.004) / 2 + 0.002, sx * (W / 2 + 0.0002)));
  }
  if (s.windows.length === 0) {
    for (let i = 0; i < 5; i++) {
      for (const sx of [-1, 1]) sp.add(box(0.0012, TOP - 0.012, 0.0022), M.inset, T(F - 0.03 + i * 0.0048, (TOP - 0.006) / 2 + 0.002, sx * (W / 2 + 0.0002)));
    }
  }
  // ejection port with the barrel hood showing through it
  sp.add(box(0.0014, 0.012, 0.036), M.inset, T(0.012, TOP - 0.007, W / 2 + 0.0002));
  sp.add(box(W * 0.55, 0.004, 0.032), M.metal, T(0.012, TOP - 0.0015, 0.001));
  // extractor
  sp.add(box(0.0012, 0.004, 0.016, 0.0005), M.metal, T(0.004, TOP - 0.01, W / 2 + 0.0008));
  // sights: rear notch with two dots, front post with one
  const dot = s.nightSights
    ? new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xe8ffe8, emissiveIntensity: 1.6 })
    : M.sight;
  for (const sx of [-1, 1]) {
    sp.add(box(0.0075, 0.0065, 0.009, 0.0015), M.metal, T(R + 0.01, TOP + 0.003, sx * 0.0058));
    sp.add(new THREE.SphereGeometry(0.0011, 6, 5), dot, T(R + 0.0056, TOP + 0.0035, sx * 0.0058));
  }
  sp.add(box(0.0035, 0.0065, 0.007, 0.001), M.metal, T(F - 0.009, TOP + 0.003));
  sp.add(new THREE.SphereGeometry(0.0013, 6, 5), dot, T(F - 0.0125, sightY));
  const slide = sp.build("slide");
  root.add(slide);

  // ---- magazine inside the grip, base plate showing
  const mp = new Part();
  mp.add(prof(gripOutline([s.gripTop[0], s.gripTop[1] - 0.004], s.gripBot, 0.034, 0), 0.021, 0.002, 0.001), M.metal);
  const mag = mp.build("mag");
  const plateGeo = new RoundedBoxGeometry(W + 0.006, 0.009, 0.054, 2, 0.003);
  const magPlate = new THREE.Mesh(plateGeo, s.flaredWell ? M.poly : frameMat);
  magPlate.position.set(0, s.gripBot[1] - 0.005, -s.gripBot[0]);
  magPlate.rotation.x = -Math.atan2(s.gripTop[0] - s.gripBot[0], s.gripTop[1] - s.gripBot[1]);
  mag.add(magPlate);
  root.add(mag);

  root.add(stat.build("static"));

  const gf = (s.gripTop[0] + s.gripBot[0]) / 2;
  const gu = (s.gripTop[1] + s.gripBot[1]) / 2 + 0.008;
  const angle = Math.atan2(s.gripTop[0] - s.gripBot[0], s.gripTop[1] - s.gripBot[1]);
  return {
    id: s.id,
    root,
    mag,
    magPlate,
    bolt: slide,
    cylinder: null,
    hammer: null,
    pump: null,
    cycle: "slide",
    reload: "mag",
    travel: 0.022,
    muzzle: new THREE.Vector3(0, boreU, -(F + 0.008)),
    port: new THREE.Vector3(W / 2 + 0.003, TOP - 0.006, -0.012),
    shell: "brass",
    sightY,
    irons: null,
    railY: TOP,
    opticF: R + 0.038,
    opticOnSlide: true,
    rearF: R + 0.01,
    magBottom: new THREE.Vector3(0, s.gripBot[1] - 0.01, -s.gripBot[0]),
    grip: { f: gf, u: gu, angle },
    support: { f: gf, u: gu - 0.016, x: -0.037, angle, scale: 1, kind: "pistol" },
    kick: s.kick,
    energy: false,
    hip: new THREE.Vector3(0.16, -0.17, -0.4),
  };
}

/**
 * Glock 17 shape: a long, flat-sided, square-topped slide, a steep 22 degree
 * grip with three finger grooves, a squared trigger guard, a one-slot rail and
 * white-dot night sights. All black: nitrided slide, polymer frame.
 */
function buildGlock17(): GunModel {
  const angle = 22 * (Math.PI / 180);
  const top: [number, number] = [-0.046, -0.004];
  const len = 0.118;
  return buildDetailedPistol({
    id: "g17",
    slideColor: 0x2b2d30,
    frameColor: 0x18191b,
    accent: 0x2b2d30,
    rearF: -0.075,
    frontF: 0.112,
    slideTop: 0.03,
    slideW: 0.0255,
    gripTop: top,
    gripBot: [top[0] - Math.sin(angle) * len, top[1] - Math.cos(angle) * len],
    grooves: 3,
    windows: [],
    railSlots: 1,
    beavertail: 0.008,
    flaredWell: false,
    squareGuard: true,
    nightSights: true,
    kick: 0.85,
  });
}

/**
 * The P2020, our design: a two-tone pistol with lightening windows cut
 * through the slide (the barrel shows through), a three-slot rail, an
 * extended beavertail and an orange-flared magazine well.
 */
function buildP2020(): GunModel {
  const angle = 18 * (Math.PI / 180);
  const top: [number, number] = [-0.044, -0.004];
  const len = 0.114;
  return buildDetailedPistol({
    id: "semipistol",
    slideColor: 0x4a4f56,
    frameColor: 0x232629,
    accent: 0xd4712a,
    rearF: -0.072,
    frontF: 0.118,
    slideTop: 0.031,
    slideW: 0.026,
    gripTop: top,
    gripBot: [top[0] - Math.sin(angle) * len, top[1] - Math.cos(angle) * len],
    grooves: 0,
    windows: [
      [0.034, 0.058, 0.012, 0.022],
      [0.066, 0.09, 0.012, 0.022],
    ],
    railSlots: 3,
    beavertail: 0.016,
    flaredWell: true,
    squareGuard: false,
    nightSights: false,
    kick: 0.8,
  });
}

// ------------------------------------------------------------------ roster

type Family =
  | { kind: "rifle"; spec: Partial<RifleSpec> }
  | { kind: "pistol"; spec: PistolSpec }
  | { kind: "revolver" }
  | { kind: "p2020" }
  | { kind: "g17" };

const SMG: Partial<RifleSpec> = {
  recvRear: 0.1,
  recvFront: 0.13,
  guardLen: 0.13,
  guardVents: 2,
  barrelLen: 0.05,
  barrelR: 0.008,
  stock: "skeleton",
  stockLen: 0.2,
  mag: "straight",
  magLen: 0.2,
  magDepth: 0.04,
  kick: 0.75,
};

const LMG: Partial<RifleSpec> = {
  recvRear: 0.16,
  recvFront: 0.22,
  recvH: 0.07,
  width: 0.04,
  guardLen: 0.3,
  guardTop: 0.064,
  guardBot: -0.034,
  guardW: 0.054,
  guardVents: 6,
  barrelLen: 0.16,
  barrelR: 0.012,
  muzzle: "flash",
  stockLen: 0.32,
  mag: "box",
  magF: 0.1,
  bipod: true,
  kick: 1.25,
};

const MARKSMAN: Partial<RifleSpec> = {
  guardLen: 0.3,
  guardVents: 5,
  barrelLen: 0.2,
  barrelR: 0.0105,
  mag: "straight",
  magLen: 0.12,
  magDepth: 0.055,
  stock: "thumbhole",
  stockLen: 0.32,
  kick: 1.6,
};

const SHOTGUN: Partial<RifleSpec> = {
  recvH: 0.07,
  width: 0.04,
  guardLen: 0.0,
  guardVents: 0,
  barrelLen: 0.3,
  barrelR: 0.015,
  muzzle: "none",
  stockLen: 0.3,
  mag: "none",
  tubeMag: true,
  pump: true,
  cycle: "pump",
  reload: "shells",
  shell: "hull",
  kick: 2.2,
};

/**
 * Every weapon gets a family and a few differences: colour, magazine type,
 * stock, muzzle device, energy cells. The aim is that no two guns in the
 * roster share a silhouette AND a colour scheme, so a swap is always visible.
 */
const ROSTER: Record<string, Family> = {
  // assault rifles
  rspn101: { kind: "rifle", spec: {} },
  hemlok: { kind: "rifle", spec: { body: 0x4a4136, accent: 0xb0995a, mag: "straight", magLen: 0.16, muzzle: "flash", guardLen: 0.26, recvH: 0.06 } },
  vinson: { kind: "rifle", spec: { body: 0x2f3236, accent: 0xb33a2a, magCurve: 0.085, magLen: 0.2, magDepth: 0.066, stock: "skeleton", guardVents: 5 } },
  energy_ar: { kind: "rifle", spec: { body: 0x2c3a3f, accent: 0x9fd23a, mag: "energy", muzzle: "energy", energy: true, recvH: 0.064, shell: null, cycle: "none" } },
  // submachine guns
  r97: { kind: "rifle", spec: { ...SMG, body: 0x2b2e33, accent: 0x3f8fd8, muzzle: "flash" } },
  alternator_smg: { kind: "rifle", spec: { ...SMG, body: 0x4b4f54, accent: 0x8a6a3a, muzzle: "can", magLen: 0.15, stock: "solid" } },
  car: { kind: "rifle", spec: { ...SMG, body: 0x333840, accent: 0xd6a13a, magLen: 0.17 } },
  volt_smg: { kind: "rifle", spec: { ...SMG, body: 0xc6cbcf, accent: 0x9fd23a, mag: "energy", muzzle: "energy", energy: true, shell: null, cycle: "none", stock: "folded" } },
  pdw: { kind: "rifle", spec: { ...SMG, body: 0x3a3d33, accent: 0xb9542a, magLen: 0.22, stock: "solid", stockLen: 0.18 } },
  // light machine guns
  lmg: { kind: "rifle", spec: { ...LMG, body: 0x3c3f34, accent: 0xc2a13a, carryHandle: true } },
  esaw: { kind: "rifle", spec: { ...LMG, body: 0x2e3336, accent: 0xe2502e, mag: "energy", magLen: 0.16, magDepth: 0.07, magW: 0.034, muzzle: "energy", energy: true, shell: null, cycle: "none" } },
  dragon_lmg: { kind: "rifle", spec: { ...LMG, body: 0x4a3a2e, accent: 0xd6782a, mag: "drum", muzzle: "brake" } },
  lstar: { kind: "rifle", spec: { ...LMG, body: 0x33373b, accent: 0x3fd1e8, mag: "energy", magLen: 0.1, muzzle: "energy", energy: true, shell: null, cycle: "none", bipod: false } },
  // marksman and snipers
  g2: { kind: "rifle", spec: { ...MARKSMAN, body: 0x4a3b2c, accent: 0x9a6a3a, grip: 0x5b3a24 } },
  "3030": { kind: "rifle", spec: { ...MARKSMAN, body: 0x3d3833, accent: 0xa07a4a, grip: 0x6a4428, stock: "solid", mag: "none", tubeMag: true, cycle: "bolt", muzzle: "none" } },
  dmr: { kind: "rifle", spec: { ...MARKSMAN, body: 0x33373d, accent: 0x4f7fa0, stock: "skeleton", barrelLen: 0.26, bipod: true } },
  doubletake: { kind: "rifle", spec: { ...MARKSMAN, body: 0x3a3f3a, accent: 0x9fd23a, mag: "energy", muzzle: "energy", energy: true, shell: null, cycle: "bolt", triple: true, stock: "solid" } },
  defender: { kind: "rifle", spec: { ...MARKSMAN, body: 0x2a2f36, accent: 0x3fa7e8, mag: "energy", muzzle: "energy", energy: true, shell: null, cycle: "none", barrelLen: 0.24, stock: "solid" } },
  sentinel: { kind: "rifle", spec: { ...MARKSMAN, body: 0x2f3a33, accent: 0xb03a2a, cycle: "bolt", barrelLen: 0.28, magLen: 0.1, kick: 2.2 } },
  sniper: { kind: "rifle", spec: { ...MARKSMAN, body: 0x2b2d30, accent: 0xd8b23a, cycle: "bolt", barrelLen: 0.34, barrelR: 0.013, stock: "skeleton", stockLen: 0.34, bipod: true, kick: 2.8 } },
  // shotguns
  shotgun: { kind: "rifle", spec: { ...SHOTGUN, body: 0x3a3a38, accent: 0xc0522a, pump: false, tubeMag: false, mag: "straight", magLen: 0.1, magDepth: 0.07, magW: 0.034, cycle: "auto", reload: "mag" } },
  mastiff: { kind: "rifle", spec: { ...SHOTGUN, body: 0x4a3f32, accent: 0xd6a13a, barrelR: 0.017 } },
  energy_shotgun: { kind: "rifle", spec: { ...SHOTGUN, body: 0x33383d, accent: 0x9fd23a, energy: true, muzzle: "energy" } },
  // pistols
  semipistol: { kind: "p2020" },
  g17: { kind: "g17" },
  autopistol: { kind: "pistol", spec: { body: 0x4a4e53, accent: 0x3f8fd8, slideLen: 0.13, triple: false, extMag: true, kick: 0.6 } },
  shotgun_pistol: { kind: "pistol", spec: { body: 0x3a3f36, accent: 0xd6a13a, slideLen: 0.11, triple: true, extMag: false, kick: 1.4 } },
  wingman: { kind: "revolver" },
};

const built = new Map<string, GunModel>();
const display = new Map<string, GunModel>();

function buildModel(id: string): GunModel {
  const fam = ROSTER[id] ?? { kind: "rifle", spec: {} };
  let m: GunModel;
  if (fam.kind === "pistol") m = buildPistol(id, fam.spec);
  else if (fam.kind === "revolver") m = buildRevolver(id);
  else if (fam.kind === "p2020") m = buildP2020();
  else if (fam.kind === "g17") m = buildGlock17();
  else m = buildRifle(id, { ...RIFLE, ...fam.spec });
  // remember the plate's own colour so a mag level of 0 can restore it
  if (m.magPlate) m.magPlate.userData.base = m.magPlate.material;
  return m;
}

/** build (once) and return the model for a weapon id: the one in your hands, which the viewmodel changes */
export function gunModel(id: string): GunModel {
  let m = built.get(id);
  if (!m) built.set(id, (m = buildModel(id)));
  return m;
}

/**
 * A second copy that nothing ever changes, for figures in the world to clone.
 * Cloning the viewmodel's copy gave every dummy (and the 1v1 opponent) your
 * optic, your magazine colour and wherever your bolt was in its cycle.
 */
export function displayGunModel(id: string): GunModel {
  let m = display.get(id);
  if (!m) display.set(id, (m = buildModel(id)));
  return m;
}

/** recolour the magazine base plate by rarity: 0 none .. 4 gold */
export function setMagRarity(m: GunModel, level: number): void {
  if (!m.magPlate) return;
  const r = rarityMats[Math.max(0, Math.min(4, level))];
  if (r) {
    m.magPlate.material = r;
  } else {
    // level 0 goes back to the gun's own accent colour
    const base = m.magPlate.userData.base as THREE.Material | undefined;
    if (base) m.magPlate.material = base;
  }
  // an extended magazine is visibly longer
  if (m.mag) m.mag.scale.y = 1 + 0.07 * Math.max(0, level);
}

/** every weapon id with a model, for the verification pass */
export const MODELLED_IDS = Object.keys(ROSTER);
