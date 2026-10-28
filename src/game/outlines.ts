// Neon outlines drawn round the map's openings (Milestone 676). The centre's review (round 8) asked for THE WELL to have
// "a neon ring at its rim and light at its bottom": from the plaza it read as a hole in the street, nothing marking it
// from across the block. So a lit strip runs round its rim on the street, in its block's colour, by day and by night.
//
// (And since Milestone 774 `frames`: a lit frame at the foot of each climb, two posts and a lintel across its way up, so
// the centre's tenth review's "make every climb visible from the street" has a mark at each fire escape and stair.)
//
// Each outline is four thin boxes round a rectangle, or a cap `h` high on each box of a list the layout wrote (`on`, a
// key of cfg.well: THE WELL's rail, read off the collision, since its rim is a curved rail and not the hole's edge), one
// instanced mesh for all of them. The numbers are in neonmap.json game.outlines.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";
import { padColour } from "./padrings";
import { decayLight } from "./world";

type Outline = { name: string; rect?: number[]; on?: string; posts?: boolean; lines?: number[][]; side?: number; step?: number; frames?: number[][]; span?: number; y: number; out: number; w: number; h: number; colour: string; glow: number };
const O = (neonCfg as unknown as { game: { outlines?: Outline[] } }).game.outlines ?? [];

/** the strips' boxes, map-local [x0, x1, z0, z1, y0, y1] each, four to an outline (the checks read them) */
export function outlineBoxes(only?: (name: string) => boolean): Array<number[] & { k?: number }> {
  const out: number[][] = [];
  const well = (neonCfg as unknown as { well?: Record<string, unknown> }).well ?? {};
  for (const q of O) {
    // (the checks may ask for some outlines' boxes alone, by name)
    if (only && !only(q.name)) continue;
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
    if (q.frames) {
      // (a frame's posts `span` apart across its way up, its yaw to the nearest quarter: the strips are boxes square to
      // the map, and every climb it marks stands square to its street)
      for (const [x, z, yaw, y] of q.frames) {
        const across = Math.round(yaw / 90) % 2 === 0;
        const [hs, hw] = [(q.span ?? 2) / 2, q.w / 2];
        const post = (d: number) => (across ? [x + d - hw, x + d + hw, z - hw, z + hw] : [x - hw, x + hw, z + d - hw, z + d + hw]);
        out.push([...post(-hs), y, y + q.h], [...post(hs), y, y + q.h]);
        out.push(across ? [x - hs - hw, x + hs + hw, z - hw, z + hw, y + q.h - q.w, y + q.h] : [x - hw, x + hw, z - hs - hw, z + hs + hw, y + q.h - q.w, y + q.h]);
      }
      continue;
    }
    if (q.lines) {
      // (a line either side of the route, `side` off its middle, in steps of `step` metres along it, each a box `w`
      // across: a stair's flight climbs in steps, so a line along it does too)
      const st = q.step ?? 0.25;
      for (let i = 0; i + 1 < q.lines.length; i++) {
        const [ax, az, ay] = q.lines[i];
        const [bx, bz, by] = q.lines[i + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-6) continue;
        const [ux, uz] = [(bx - ax) / L, (bz - az) / L];
        const n = Math.max(1, Math.round(L / st));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const [x, z, y] = [ax + (bx - ax) * t, az + (bz - az) * t, ay + (by - ay) * t];
          for (const sd of [-1, 1]) {
            const [px, pz] = [x - uz * sd * (q.side ?? 0), z + ux * sd * (q.side ?? 0)];
            const [hx, hz] = [Math.abs(ux) * (L / n) / 2 + Math.abs(uz) * q.w / 2, Math.abs(uz) * (L / n) / 2 + Math.abs(ux) * q.w / 2];
            out.push([px - hx, px + hx, pz - hz, pz + hz, y + q.y, y + q.y + q.h]);
          }
        }
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
  // (a line's box count: two a step along each leg)
  const lineBoxes = (q: Outline) => (q.lines ?? []).slice(1).reduce((n, b, i) => {
    const a = q.lines![i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return n + (L < 1e-6 ? 0 : 2 * Math.max(1, Math.round(L / (q.step ?? 0.25))));
  }, 0);
  const outlineOf = O.flatMap((q) => Array<Outline>(q.frames ? q.frames.length * 3 : q.lines ? lineBoxes(q) : q.on ? (((well[q.on] as unknown[] | undefined) ?? []).length) : q.rect ? 4 : 0).fill(q));
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  // (gone with its sector's decay, Milestone 810: until then past the decay's shader, and lit over a gone sector's ground)
  decayLight(mat);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, boxes.length);
  const m4 = new THREE.Matrix4();
  boxes.forEach(([x0, x1, z0, z1, y0, y1], i) => {
    mesh.setMatrixAt(i, m4.makeScale(x1 - x0, y1 - y0, z1 - z0).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    const q = outlineOf[i];
    // (a frame in its place's colour, "place": the pads' rings')
    mesh.setColorAt(i, (q.colour === "place" ? padColour((x0 + x1) / 2, (z0 + z1) / 2) : new THREE.Color(q.colour)).multiplyScalar(q.glow));
  });
  mesh.name = "outlines";
  mesh.frustumCulled = false;
  mesh.userData.dynamic = true;
  root.add(mesh);
  return mesh;
}
