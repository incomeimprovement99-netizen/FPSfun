// A warehouse roof: steel beams across every 2.5 m, solid ceiling panels with
// light strips between them, a frosted skylight every few bays, and a
// collider so nobody jumps out. Shared by the range, the course and the 1v1
// arena so the three read as one building.
//
// The panels do not cast the sun's shadow. That is deliberate: a real roof
// would leave everything under it in shade and need point lights to fill it,
// and point lights cost every lit pixel. The beams do cast, in stripes, which
// is what sells the light as coming through a roof.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAL, bevel, flat, emissive } from "./geo";

export interface RoofSpec {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** underside of the roof */
  y: number;
  /** a skylight every this many bays (0 for none) */
  skylightEvery?: number;
  /** long girders under the beams at these x */
  girders?: number[];
  /** light strips at these x on each solid bay */
  lights?: number[];
  lightColor?: number;
  /**
   * A pitched roof instead of a flat one: it climbs `rise` metres from the
   * eaves to a ridge down the middle, in `steps` steps each side. The owner
   * asked for it, and the shape of a building is the first thing that says it
   * is one: walls and a flat lid is a box, walls and two slopes is a house.
   *
   * It is stepped because this engine collides against axis-aligned boxes and
   * nothing else. A drawn slope over a flat collider would be a ceiling you
   * could see into and not shoot into, so the steps ARE the roof: each one is
   * drawn and collided at the same height, and with enough of them the eye
   * reads a slope while the game still knows exactly where the ceiling is.
   */
  gable?: { rise: number; steps: number };
  /** adds the collider; given in the parent's coordinates */
  solid: (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) => void;
}

export function warehouseRoof(parent: THREE.Object3D, r: RoofSpec): void {
  const beamMat = flat(PAL.steelDark, 0.6, 0.2);
  const panelMat = flat(PAL.ceiling, 0.85, 0.05);
  const lamp = emissive(r.lightColor ?? 0xfff0d2, 2.6);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xdfe8ef,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const W = r.x1 - r.x0;
  const cx = (r.x0 + r.x1) / 2;
  // the pitch: how high this strip of roof sits above the eaves, and how tall
  // the step under it is. A flat roof is one step of no rise.
  const gable = r.gable && r.gable.steps > 0 && r.gable.rise > 0 ? r.gable : null;
  const bands = gable ? gable.steps : 1;
  const bandW = W / (bands * 2);
  /** the underside of the roof over a point, and the band it belongs to */
  const lift = (x: number): number => {
    if (!gable) return 0;
    const from = Math.abs(x - cx) / (W / 2); // 0 at the ridge, 1 at the eaves
    const step = Math.min(bands - 1, Math.floor((1 - from) * bands));
    return (step / Math.max(1, bands - 1)) * gable.rise;
  };
  const every = r.skylightEvery ?? 3;
  const lights = r.lights ?? [cx - W * 0.25, cx + W * 0.25];
  const glassGeos: THREE.BufferGeometry[] = [];
  let bay = 0;
  for (let z = r.z0; z < r.z1 - 1e-3; z += 2.5, bay++) {
    const d = Math.min(2.5, r.z1 - z);
    if (every > 0 && bay % every === 1) {
      const g = new THREE.PlaneGeometry(W, d);
      g.rotateX(Math.PI / 2);
      g.translate(cx, r.y + 0.02, z + d / 2);
      glassGeos.push(g);
      continue;
    }
    // the bay, in bands across the width: flat is one band, a gable is a run
    // of them stepping up to the ridge and down again
    for (let b = 0; b < bands * 2; b++) {
      const bx = r.x0 + bandW * (b + 0.5);
      const y = r.y + lift(bx);
      const p = new THREE.Mesh(new THREE.BoxGeometry(bandW + 0.02, 0.1, d), panelMat);
      p.position.set(bx, y + 0.05, z + d / 2);
      p.castShadow = false;
      p.receiveShadow = false;
      parent.add(p);
      // the riser between this band and the one outside it, so the ceiling is
      // closed rather than a flight of floating shelves
      if (gable && b > 0) {
        const below = r.y + lift(r.x0 + bandW * (b - 0.5));
        const h = Math.abs(y - below);
        if (h > 1e-3) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, d), panelMat);
          wall.position.set(r.x0 + bandW * b, Math.min(y, below) + h / 2, z + d / 2);
          parent.add(wall);
        }
      }
    }
    if (d > 1) {
      for (const x of lights) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, Math.min(1.6, d - 0.6)), lamp);
        l.position.set(x, r.y - 0.03, z + d / 2);
        parent.add(l);
      }
    }
  }
  if (glassGeos.length) {
    const sky = new THREE.Mesh(mergeGeometries(glassGeos, false)!, glass);
    sky.castShadow = false;
    sky.receiveShadow = false;
    parent.add(sky);
  }
  for (let z = r.z0 + 1.5; z < r.z1; z += 2.5) {
    const b = new THREE.Mesh(bevel(W, 0.45, 0.3, 0.04), beamMat);
    b.position.set(cx, r.y - 0.2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    parent.add(b);
  }
  for (const x of r.girders ?? []) {
    const g = new THREE.Mesh(bevel(0.3, 0.35, r.z1 - r.z0, 0.04), beamMat);
    g.position.set(x, r.y - 0.55, (r.z0 + r.z1) / 2);
    g.castShadow = true;
    parent.add(g);
  }
  // the collider follows the same steps, so the ceiling is where it looks
  if (!gable) {
    r.solid(r.x0, r.x1, r.z0, r.z1, r.y, r.y + 0.5);
  } else {
    for (let b = 0; b < bands * 2; b++) {
      const x0 = r.x0 + bandW * b;
      const y = r.y + lift(x0 + bandW / 2);
      r.solid(x0, x0 + bandW, r.z0, r.z1, y, y + 0.5 + gable.rise);
    }
  }
}
