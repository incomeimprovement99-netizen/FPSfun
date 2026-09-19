// WARD's walls (src/config/kits.json ward).
//
// A wall put up in play is a real solid (range.ts RANGE_SOLIDS) with a panel
// to look at, so everything that already asks the world a question gets the
// right answer: bullets stop at it (solidHit), bodies walk into it, bots path
// round it, and a figure behind it is out of sight. It stands for its seconds
// and then goes.
//
// Kept apart from the kits so both the wall and the ultimate's horseshoe are
// one piece of code, and so the checks can put one up without a match.
import * as THREE from "three";
import kits from "../config/kits.json";
import { RANGE_SOLIDS, type Solid } from "./range";

const CFG = kits.ward;

export interface PutWall {
  solid: Solid;
  mesh: THREE.Mesh;
  until: number;
}

/** the walls standing now */
export const WALLS: PutWall[] = [];

let wallGeo: THREE.BoxGeometry | null = null;
let wallMat: THREE.MeshStandardMaterial | null = null;

/**
 * A wall standing on the ground at (x, z), `deg` degrees round, `seconds`
 * long. Its solid is the box it fills, so it stops what any wall stops.
 */
export function putWall(parent: THREE.Object3D, x: number, y: number, z: number, deg: number, now: number, seconds = CFG.tactical.seconds): PutWall {
  wallGeo ??= new THREE.BoxGeometry(CFG.width, CFG.height, CFG.thick);
  wallMat ??= new THREE.MeshStandardMaterial({ color: 0x3fa7ff, emissive: 0x1b4f7a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.4, metalness: 0.2 });
  const mesh = new THREE.Mesh(wallGeo, wallMat);
  mesh.position.set(x, y + CFG.height / 2, z);
  mesh.rotation.y = deg * (Math.PI / 180);
  parent.add(mesh);
  // the solid: the box the panel fills, squared off to the world's axes (as
  // every other solid is), so a wall put up at an angle is the box round it
  const c = Math.abs(Math.cos(mesh.rotation.y));
  const s = Math.abs(Math.sin(mesh.rotation.y));
  const halfX = (CFG.width * c + CFG.thick * s) / 2;
  const halfZ = (CFG.width * s + CFG.thick * c) / 2;
  const solid: Solid = { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ, base: y, top: y + CFG.height };
  RANGE_SOLIDS.push(solid);
  const w: PutWall = { solid, mesh, until: now + seconds };
  WALLS.push(w);
  return w;
}

/** the walls a step on: the ones whose time is up come down */
export function stepWalls(now: number): void {
  for (let i = WALLS.length - 1; i >= 0; i--) {
    if (now < WALLS[i].until) continue;
    drop(WALLS[i]);
    WALLS.splice(i, 1);
  }
}

function drop(w: PutWall): void {
  const i = RANGE_SOLIDS.indexOf(w.solid);
  if (i >= 0) RANGE_SOLIDS.splice(i, 1);
  w.mesh.removeFromParent();
}

/** every wall gone (a match ending) */
export function clearWalls(): void {
  for (const w of WALLS) drop(w);
  WALLS.length = 0;
}
