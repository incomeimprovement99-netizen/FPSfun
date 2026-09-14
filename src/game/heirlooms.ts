// Heirlooms: the melee weapon you hold when holstered, and swing with melee.
//
// Four are built here from extruded profiles, the same way as the guns: a
// karambit (reverse grip), a butterfly knife (it flips while you hold it), a
// kukri and a tanto combat knife. Two more are free CC0 models, a katana by
// CreativeTrio and a dagger by Quaternius (public/models/heirlooms). All are
// our own or public domain; none is a copy of any game's heirloom.
//
// Model space matches the hand model (arms.ts): the hand closes round a
// vertical bar at the origin, so a handle runs along y through the origin,
// forward is -z and the back of the hand is +x.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface HeirloomDef {
  id: string;
  name: string;
  blurb: string;
  /** a CC0 model file under public/models/heirlooms, else built in code */
  file?: string;
  /** length to scale a loaded model to, metres */
  length?: number;
}

export const HEIRLOOMS: HeirloomDef[] = [
  { id: "fists", name: "Fists", blurb: "No blade. Just gloves." },
  { id: "karambit", name: "Karambit", blurb: "Hooked blade, reverse grip, ring pommel." },
  { id: "butterfly", name: "Butterfly Knife", blurb: "Balisong. Flips open while you hold it." },
  { id: "kukri", name: "Kukri", blurb: "Heavy forward-curved chopper." },
  { id: "tanto", name: "Combat Tanto", blurb: "Blackened tanto blade with an orange inlay." },
  { id: "katana", name: "Katana", blurb: "Free CC0 model by CreativeTrio.", file: "katana.glb", length: 0.62 },
  { id: "dagger", name: "Dagger", blurb: "Free CC0 model by Quaternius.", file: "dagger.glb", length: 0.34 },
];

export function heirloomById(id: string | undefined): HeirloomDef {
  return HEIRLOOMS.find((h) => h.id === id) ?? HEIRLOOMS[0];
}

/** a model and, for the butterfly knife, a way to animate it */
export interface HeirloomModel {
  group: THREE.Group;
  /** called every frame while shown; `t` is seconds */
  animate?: (t: number) => void;
}

let mats: Record<string, THREE.MeshStandardMaterial> | null = null;
function M(): Record<string, THREE.MeshStandardMaterial> {
  if (!mats) {
    mats = {
      steel: new THREE.MeshStandardMaterial({ color: 0xc9d1d9, metalness: 1, roughness: 0.22 }),
      edge: new THREE.MeshStandardMaterial({ color: 0xf2f6fa, metalness: 1, roughness: 0.08 }),
      black: new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.6, roughness: 0.35 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0, roughness: 0.85 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x5a3822, metalness: 0, roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.3 }),
      violet: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9b4dff, emissiveIntensity: 1.6 }),
      orange: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a2a, emissiveIntensity: 1.5 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x39d7ee, emissiveIntensity: 1.6 }),
    };
    for (const m of Object.values(mats)) m.envMapIntensity = 1.9;
  }
  return mats;
}

/**
 * Extrude a side profile drawn in (forward, up) and turn it into hand space:
 * the profile's x becomes forward (-z), the extrusion becomes thickness (x).
 */
function profile(draw: (s: THREE.Shape) => void, thick: number, bevel = 0.0012): THREE.BufferGeometry {
  const s = new THREE.Shape();
  draw(s);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -thick / 2);
  g.rotateY(Math.PI / 2); // x (forward) -> -z, z (thickness) -> x
  return g;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.castShadow = false;
  return o;
}

function karambit(): HeirloomModel {
  const m = M();
  const g = new THREE.Group();
  // handle through the fist, a finger ring above it, the hooked blade below
  g.add(mesh(profile((s) => {
    s.moveTo(-0.012, -0.055);
    s.lineTo(0.012, -0.058);
    s.quadraticCurveTo(0.018, 0, 0.012, 0.045);
    s.lineTo(-0.012, 0.045);
    s.quadraticCurveTo(-0.018, 0, -0.012, -0.055);
  }, 0.016, 0.002), m.black));
  const ring = mesh(new THREE.TorusGeometry(0.02, 0.0055, 10, 28), m.gold);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0, 0.068, 0);
  g.add(ring);
  g.add(mesh(profile((s) => {
    s.moveTo(-0.01, -0.05);
    s.quadraticCurveTo(0.0, -0.13, 0.08, -0.12);
    s.quadraticCurveTo(0.13, -0.11, 0.15, -0.055);
    s.quadraticCurveTo(0.11, -0.085, 0.07, -0.085);
    s.quadraticCurveTo(0.025, -0.085, 0.012, -0.05);
  }, 0.004, 0.0008), m.steel));
  // a violet inlay line along the spine
  const inlay = mesh(profile((s) => {
    s.moveTo(0.0, -0.075);
    s.quadraticCurveTo(0.04, -0.11, 0.1, -0.105);
    s.lineTo(0.1, -0.1);
    s.quadraticCurveTo(0.04, -0.103, 0.004, -0.072);
  }, 0.0046, 0), m.violet);
  g.add(inlay);
  return { group: g };
}

function butterfly(): HeirloomModel {
  const m = M();
  const g = new THREE.Group();
  const handleShape = (s: THREE.Shape) => {
    s.moveTo(-0.009, -0.07);
    s.lineTo(0.009, -0.07);
    s.lineTo(0.01, 0.05);
    s.lineTo(-0.01, 0.05);
  };
  // the fixed handle and the blade, pivoting at the top of the handles
  const fixed = mesh(profile(handleShape, 0.007, 0.0015), m.black);
  fixed.position.x = 0.0045;
  g.add(fixed);
  const blade = mesh(profile((s) => {
    s.moveTo(-0.008, 0.05);
    s.lineTo(0.009, 0.05);
    s.lineTo(0.008, 0.15);
    s.lineTo(0.0, 0.17);
    s.quadraticCurveTo(-0.009, 0.14, -0.009, 0.1);
  }, 0.0035, 0.0006), m.steel);
  g.add(blade);
  // the latch handle swings round the pivot: the flip
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.05, 0);
  const latch = mesh(profile(handleShape, 0.007, 0.0015), m.black);
  latch.position.set(-0.0045, -0.05, 0);
  pivot.add(latch);
  const cyanLine = mesh(new THREE.BoxGeometry(0.001, 0.1, 0.003), m.cyan);
  cyanLine.position.set(-0.0085, -0.06, 0);
  pivot.add(cyanLine);
  g.add(pivot);
  const pin = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 12).rotateZ(Math.PI / 2), m.gold);
  pin.position.set(0, 0.05, 0);
  g.add(pin);
  return {
    group: g,
    // every 3 s, a full flip of the latch handle over 0.45 s
    animate: (t) => {
      const c = t % 3;
      const k = c < 0.45 ? c / 0.45 : 0;
      pivot.rotation.x = -Math.PI * 2 * (k * k * (3 - 2 * k));
    },
  };
}

function kukri(): HeirloomModel {
  const m = M();
  const g = new THREE.Group();
  g.add(mesh(profile((s) => {
    s.moveTo(-0.014, -0.06);
    s.quadraticCurveTo(-0.02, -0.01, -0.013, 0.05);
    s.lineTo(0.013, 0.05);
    s.quadraticCurveTo(0.018, -0.01, 0.014, -0.06);
    s.quadraticCurveTo(0, -0.075, -0.014, -0.06);
  }, 0.02, 0.003), m.wood));
  const bolster = mesh(new THREE.BoxGeometry(0.024, 0.012, 0.034), m.gold);
  bolster.position.y = 0.056;
  g.add(bolster);
  // the forward-bent blade: narrow at the handle, a broad belly forward
  g.add(mesh(profile((s) => {
    s.moveTo(-0.01, 0.06);
    s.lineTo(0.01, 0.06);
    s.quadraticCurveTo(0.05, 0.12, 0.085, 0.19);
    s.quadraticCurveTo(0.1, 0.235, 0.075, 0.26);
    s.quadraticCurveTo(0.02, 0.2, -0.01, 0.13);
    s.lineTo(-0.01, 0.06);
  }, 0.005, 0.0008), m.steel));
  return { group: g };
}

function tanto(): HeirloomModel {
  const m = M();
  const g = new THREE.Group();
  g.add(mesh(profile((s) => {
    s.moveTo(-0.013, -0.065);
    s.lineTo(0.013, -0.065);
    s.lineTo(0.015, 0.045);
    s.lineTo(-0.015, 0.045);
  }, 0.021, 0.003), m.rubber));
  for (let i = 0; i < 4; i++) {
    const rib = mesh(new THREE.BoxGeometry(0.023, 0.004, 0.032), m.black);
    rib.position.y = -0.045 + i * 0.022;
    g.add(rib);
  }
  const guard = mesh(new THREE.BoxGeometry(0.02, 0.008, 0.05), m.black);
  guard.position.y = 0.05;
  g.add(guard);
  // straight blackened blade with the angled tanto point
  g.add(mesh(profile((s) => {
    s.moveTo(-0.014, 0.054);
    s.lineTo(0.012, 0.054);
    s.lineTo(0.012, 0.17);
    s.lineTo(0.0, 0.2);
    s.lineTo(-0.014, 0.18);
  }, 0.005, 0.0007), m.black));
  const edge = mesh(profile((s) => {
    s.moveTo(0.008, 0.06);
    s.lineTo(0.0125, 0.06);
    s.lineTo(0.0125, 0.17);
    s.lineTo(0.001, 0.199);
    s.lineTo(0.008, 0.168);
  }, 0.0052, 0), m.edge);
  g.add(edge);
  const inlay = mesh(new THREE.BoxGeometry(0.0055, 0.09, 0.003), m.orange);
  inlay.position.set(0, 0.11, 0.006);
  g.add(inlay);
  return { group: g };
}

const loader = new GLTFLoader();
const fileCache = new Map<string, Promise<THREE.Group | null>>();

/**
 * A CC0 model, scaled to `length` and turned so its long axis runs up the
 * hand. The handle is taken to be the short side of the model's origin, which
 * holds for both models used: their origins sit in the grip.
 */
function loadFile(def: HeirloomDef): Promise<THREE.Group | null> {
  let p = fileCache.get(def.id);
  if (!p) {
    p = loader
      .loadAsync(`models/heirlooms/${def.file}`)
      .then((gltf) => {
        const src = gltf.scene;
        src.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(src);
        const size = box.getSize(new THREE.Vector3());
        const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
        const lo = box.min[axis];
        const hi = box.max[axis];
        // the blade is the longer side of the origin
        const bladePositive = Math.abs(hi) >= Math.abs(lo);
        const holder = new THREE.Group();
        holder.add(src);
        const dir = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0).multiplyScalar(bladePositive ? 1 : -1);
        holder.quaternion.setFromUnitVectors(dir, new THREE.Vector3(0, 1, 0));
        holder.scale.setScalar((def.length ?? 0.3) / Math.max(1e-6, hi - lo));
        const out = new THREE.Group();
        out.add(holder);
        out.traverse((o) => {
          const mm = o as THREE.Mesh;
          if (mm.isMesh) {
            mm.castShadow = false;
            const mat = mm.material as THREE.MeshStandardMaterial;
            if (mat && "envMapIntensity" in mat) mat.envMapIntensity = 1.9;
          }
        });
        return out;
      })
      .catch(() => null);
    fileCache.set(def.id, p);
  }
  return p;
}

/** the model for an heirloom, or null for fists. Built ones return at once. */
export function heirloomModel(id: string): Promise<HeirloomModel | null> {
  const def = heirloomById(id);
  switch (def.id) {
    case "karambit":
      return Promise.resolve(karambit());
    case "butterfly":
      return Promise.resolve(butterfly());
    case "kukri":
      return Promise.resolve(kukri());
    case "tanto":
      return Promise.resolve(tanto());
    case "fists":
      return Promise.resolve(null);
    default:
      return loadFile(def).then((g) => (g ? { group: g.clone(true) } : null));
  }
}
