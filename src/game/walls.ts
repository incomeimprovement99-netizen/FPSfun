// The WALL hack's walls (src/config/wall.json, hacks.json wall).
//
// A wall put up in play is a real solid (range.ts RANGE_SOLIDS) with a panel
// to look at, so everything that already asks the world a question gets the
// right answer: bullets stop at it (solidHit), bodies walk into it, bots path
// round it, and a figure behind it is out of sight. It stands for its seconds
// and then goes.
//
// Kept apart from main.ts so the checks can put one up without a match.
import * as THREE from "three";
import wallCfg from "../config/wall.json";
import { RANGE_SOLIDS, type Solid } from "./range";

/** the wall's panel and its reach (wall.json) */
export const WALL = wallCfg;
const CFG = wallCfg;

export interface PutWall {
  /** its collision: one box square to the world's axes, or short pieces along a panel at an angle (wall.json piece) */
  solids: Solid[];
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
export function putWall(parent: THREE.Object3D, x: number, y: number, z: number, deg: number, now: number, seconds: number): PutWall {
  wallGeo ??= new THREE.BoxGeometry(CFG.width, CFG.height, CFG.thick);
  wallMat ??= new THREE.MeshStandardMaterial({ color: 0x3fa7ff, emissive: 0x1b4f7a, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.4, metalness: 0.2 });
  const mesh = new THREE.Mesh(wallGeo, wallMat);
  mesh.position.set(x, y + CFG.height / 2, z);
  mesh.rotation.y = deg * (Math.PI / 180);
  parent.add(mesh);
  // its collision: boxes squared off to the world's axes, as every other solid is. One box round a panel at an angle was
  // up to 3.2 m square (Milestone 894); a panel at an angle is short pieces along it now, each the box round its piece,
  // and one square to the axes stays the one box that is exactly it
  const c = Math.abs(Math.cos(mesh.rotation.y));
  const s = Math.abs(Math.sin(mesh.rotation.y));
  const n = Math.min(c, s) < 1e-3 ? 1 : Math.max(1, Math.ceil(CFG.width / CFG.piece));
  const len = CFG.width / n;
  // (the panel's width runs along its own x, which a turn about y takes to (cos, 0, -sin))
  const ax = Math.cos(mesh.rotation.y);
  const az = -Math.sin(mesh.rotation.y);
  const halfX = (len * c + CFG.thick * s) / 2;
  const halfZ = (len * s + CFG.thick * c) / 2;
  const solids: Solid[] = [];
  for (let k = 0; k < n; k++) {
    const t = -CFG.width / 2 + len * (k + 0.5);
    const px = x + ax * t;
    const pz = z + az * t;
    solids.push({ minX: px - halfX, maxX: px + halfX, minZ: pz - halfZ, maxZ: pz + halfZ, base: y, top: y + CFG.height });
  }
  RANGE_SOLIDS.push(...solids);
  const w: PutWall = { solids, mesh, until: now + seconds };
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
  for (const s of w.solids) {
    const i = RANGE_SOLIDS.indexOf(s);
    if (i >= 0) RANGE_SOLIDS.splice(i, 1);
  }
  w.mesh.removeFromParent();
}

/** every wall gone (a match ending) */
export function clearWalls(): void {
  for (const w of WALLS) drop(w);
  WALLS.length = 0;
}
