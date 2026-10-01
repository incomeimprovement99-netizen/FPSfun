// The Well's stairs (rules.well.flights, tools/neon-layout.ts writes cfg.well.flights): a straight flight from one
// gallery's walkway down to the next one's (and the first from the street down to the first gallery), its treads
// floating between two sloped walls that are its railings, rising through a slot cut in the floor above, the slot
// walled round where the flight has gone too far below it to wall it. Measured to the player's step: a riser no higher
// than `riser`, a tread `tread` deep
import { boxInto } from "./neon-tower";

type Part = { pos: number[]; uv: number[]; nrm: number[]; idx: number[] };

/** a flight on the map: its top end at (x, z) on the floor at `high`, running down along +x (`dir` 1) or -x to `low`;
 * `slot`, the floor above cut that far from its top instead of as far as a head needs (the street's, to its tiles) */
export type Flight = { x: number; z: number; dir: number; low: number; high: number; width: number; slot?: number };
export type FlightSpec = { tread: number; riser: number; stepDepth: number; wall: number; rail: number; head: number; floor: number; body: number; cell: number; approach: number };

/** a flight's measures: its steps' count and rise, its run, its bottom end's x, and how far from its top the floor over it must be cut for a head */
export function measure(f: Flight, s: FlightSpec): { n: number; r: number; run: number; bottom: number; cut: number } {
  const n = Math.ceil((f.high - f.low) / s.riser - 1e-9);
  const r = (f.high - f.low) / n;
  const run = n * s.tread;
  // (as far as a body's head, `head` over the tread under its back while its front goes on, a `body` across, meets the
  // underside of the floor above, `floor` thick; and a collision `cell` on, where what is left of the floor collides)
  const cut = f.slot ?? Math.ceil((s.body + ((s.head + s.floor) / (f.high - f.low)) * run + s.cell) * 2) / 2;
  return { n, r, run, bottom: f.x + f.dir * run, cut };
}

/** a box sheared along x: its bottom and top at x0 (y0b, y0t) and at x1 (y1b, y1t), between z0 and z1 */
function shearedInto(p: Part, x0: number, x1: number, y0b: number, y0t: number, y1b: number, y1t: number, z0: number, z1: number, scale: number): void {
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    const base = p.pos.length / 3;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const q of [a, b, c, d]) {
      p.pos.push(...q);
      p.nrm.push(n[0] / l, n[1] / l, n[2] / l);
      // (mapped by the metre along the run and up, on whichever face)
      p.uv.push((Math.abs(n[0] / l) > 0.7 ? q[2] : q[0]) * scale, -q[1] * scale);
    }
    p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const [A, B, C, D] = [[x0, y0b, z0], [x1, y1b, z0], [x1, y1t, z0], [x0, y0t, z0]];
  const [E, F, G, H] = [[x0, y0b, z1], [x1, y1b, z1], [x1, y1t, z1], [x0, y0t, z1]];
  // each face wound counter-clockwise seen from outside it, whichever way x0 and x1 lie
  const flip = x1 < x0;
  const face = (a: number[], b: number[], c: number[], d: number[]) => (flip ? quad(a, d, c, b) : quad(a, b, c, d));
  face(B, A, D, C); // -z
  face(E, F, G, H); // +z
  face(D, H, G, C); // top
  face(A, B, F, E); // bottom
  face(A, E, H, D); // the x0 end
  face(F, B, C, G); // the x1 end
}

/**
 * A flight's treads and its walls (the railings each side, from under the treads to `rail` over them), the slot's
 * parapet on the floor above (along the slot's sides and across its far end, `rail` high), and the route a body walks down it: from `approach` short of its top to a metre past its foot
 */
export function wellFlight(f: Flight, s: FlightSpec, scale: { step: number; wall: number }): { steps: Part; walls: Part; route: number[][]; cut: number[] } {
  const { n, r, bottom, cut } = measure(f, s);
  const part = (): Part => ({ pos: [], uv: [], nrm: [], idx: [] });
  const [steps, walls] = [part(), part()];
  const [z0, z1] = [f.z - f.width / 2, f.z + f.width / 2];
  // treads, the lowest at the foot: each `stepDepth` thick
  for (let i = 1; i <= n; i++) {
    const [xa, xb] = [bottom - f.dir * (i - 1) * s.tread, bottom - f.dir * i * s.tread];
    const top = f.low + i * r;
    boxInto(steps, Math.min(xa, xb), Math.max(xa, xb), top - s.stepDepth, top, z0, z1, scale.step);
  }
  // the walls each side, along the nosings' line: from the foot (low) to the top (high), `rail` over it and down under
  // the treads; at the foot they stand on the floor
  for (const [w0, w1] of [[z0 - s.wall, z0], [z1, z1 + s.wall]]) shearedInto(walls, bottom, f.x, f.low, f.low + s.rail, f.high - s.stepDepth - 0.3, f.high + s.rail, w0, w1, scale.wall);
  // the slot's parapet on the floor above: its sides the slot's whole length, outside the walls (begun where the walls
  // sank under the floor, the two did not meet: a step and a gap where they changed), and across its far end
  const far = f.x + f.dir * cut;
  for (const [w0, w1] of [[z0 - 2 * s.wall, z0 - s.wall], [z1 + s.wall, z1 + 2 * s.wall]]) boxInto(walls, Math.min(f.x, far), Math.max(f.x, far), f.high, f.high + s.rail, w0, w1, scale.wall);
  boxInto(walls, Math.min(far, far + f.dir * s.wall), Math.max(far, far + f.dir * s.wall), f.high, f.high + s.rail, z0 - 2 * s.wall, z1 + 2 * s.wall, scale.wall);
  // (a metre on past its foot, onto the gallery: half of it left a body on the lowest step)
  const route = [[f.x - f.dir * s.approach, f.z, f.high], [f.x, f.z, f.high], [bottom, f.z, f.low], [bottom + f.dir, f.z, f.low]];
  // the slot to cut in the floor above, on the map: x0, x1, z0, z1, from under the floor to over it
  const slot = [Math.min(f.x, far), Math.max(f.x, far), z0 - 2 * s.wall, z1 + 2 * s.wall, f.high - s.floor - 0.1, f.high + 0.05];
  return { steps, walls, route, cut: slot };
}
