// Neon outlines drawn round the map's openings (Milestone 676). The centre's review (round 8) asked for THE WELL to have
// "a neon ring at its rim and light at its bottom": from the plaza it read as a hole in the street, nothing marking it
// from across the block. So a lit strip runs round its rim on the street, in its block's colour, by day and by night.
//
// Each outline is four thin boxes round a rectangle, or a cap `h` high on each box of a list the layout wrote (`on`, a
// key of cfg.well: THE WELL's rail, read off the collision, since its rim is a curved rail and not the hole's edge), one
// instanced mesh for all of them. The numbers are in neonmap.json game.outlines.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";

type Outline = { name: string; rect?: number[]; on?: string; posts?: boolean; y: number; out: number; w: number; h: number; colour: string; glow: number };
const O = (neonCfg as unknown as { game: { outlines?: Outline[] } }).game.outlines ?? [];

/** the strips' boxes, map-local [x0, x1, z0, z1, y0, y1] each, four to an outline (the checks read them) */
export function outlineBoxes(): Array<number[] & { k?: number }> {
  const out: number[][] = [];
  const well = (neonCfg as unknown as { well?: Record<string, unknown> }).well ?? {};
  for (const q of O) {
    if (q.on) {
      // (a line `w` wide along each box's top, down its long side's middle, `h` high: whole caps on the rail's
      // half-metre cells drew as "a huge flat pink plane with saw-tooth edges" from over the shaft, round 9)
      for (const b of (well[q.on] as number[][] | undefined) ?? []) {
        const [mx, mz] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
        const along = b[1] - b[0] >= b[3] - b[2];
        out.push(along ? [b[0], b[1], mz - q.w / 2, mz + q.w / 2, b[4], b[4] + q.h] : [mx - q.w / 2, mx + q.w / 2, b[2], b[3], b[4], b[4] + q.h]);
      }
      continue;
    }
    if (q.posts) {
      // (a post `w` square at each corner of `rect`, from `y` up `h`: the tower's lit corners)
      for (const [x, z] of [[q.rect![0], q.rect![2]], [q.rect![1], q.rect![2]], [q.rect![0], q.rect![3]], [q.rect![1], q.rect![3]]]) out.push([x - q.w / 2, x + q.w / 2, z - q.w / 2, z + q.w / 2, q.y, q.y + q.h]);
      continue;
    }
    if (!q.rect) continue;
    const [x0, x1, z0, z1] = [q.rect[0] - q.out, q.rect[1] + q.out, q.rect[2] - q.out, q.rect[3] + q.out];
    const [y0, y1] = [q.y, q.y + q.h];
    // (the long sides whole, the short ones between them, so no corner is drawn twice)
    out.push([x0 - q.w, x1 + q.w, z0 - q.w, z0, y0, y1], [x0 - q.w, x1 + q.w, z1, z1 + q.w, y0, y1], [x0 - q.w, x0, z0, z1, y0, y1], [x1, x1 + q.w, z0, z1, y0, y1]);
  }
  return out;
}

/** the outlines, on the map's root */
export function buildOutlines(root: THREE.Object3D): THREE.InstancedMesh | null {
  const boxes = outlineBoxes();
  if (!boxes.length) return null;
  // (which outline each box is of, for its colour)
  const well = (neonCfg as unknown as { well?: Record<string, unknown> }).well ?? {};
  const outlineOf = O.flatMap((q) => Array<Outline>(q.on ? (((well[q.on] as unknown[] | undefined) ?? []).length) : q.rect ? 4 : 0).fill(q));
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  // (past the decay's own shader, as the fence's and the pads' rings are)
  mat.userData.decay = true;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, boxes.length);
  const m4 = new THREE.Matrix4();
  boxes.forEach(([x0, x1, z0, z1, y0, y1], i) => {
    mesh.setMatrixAt(i, m4.makeScale(x1 - x0, y1 - y0, z1 - z0).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    const q = outlineOf[i];
    mesh.setColorAt(i, new THREE.Color(q.colour).multiplyScalar(q.glow));
  });
  mesh.name = "outlines";
  mesh.frustumCulled = false;
  mesh.userData.dynamic = true;
  root.add(mesh);
  return mesh;
}
