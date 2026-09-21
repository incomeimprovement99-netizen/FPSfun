// Lofting: a hull built from a run of cross-sections (src/game/dropship.ts).
//
// The dropship was fifteen boxes, the biggest of them a slab 4.4 by 3.8 by 26
// metres, and from the ground it read as a crate with a light on it. The owner
// asked for it to look like something. An aircraft's shape is one thing above
// all: a section that changes along its length, sharp at the nose, deepest
// over the bay, drawn back in at the tail. A box has none of that, and no
// number of boxes glued to a box gives it any.
//
// So: a station is a slice across the hull, and a loft is the skin stretched
// over a run of them. This is the arithmetic of it, away from any material or
// scene, because it is the part worth checking: a hull with a hole in it, or
// one whose triangles face inwards, is invisible in a screenshot taken from
// the other side and obvious the moment you are inside it.
import * as THREE from "three";

/** one slice across a hull, at `z` along it */
export interface Station {
  z: number;
  /** half the width and half the height at this slice, metres */
  w: number;
  h: number;
  /** the slice's centre, so a hull can have a flat floor and a rounded back */
  y?: number;
  /** 0 a rectangle, 1 an ellipse: how much the corners are cut */
  round?: number;
}

/**
 * The ring of points round one station, going anticlockwise from the right
 * flank. `sides` must be a multiple of four so the top, the bottom and both
 * flanks land on a point and the shape stays symmetrical.
 *
 * `round` slides each point between the rectangle its box would have and the
 * ellipse inside it, which is how a fuselage gets a flat floor, flat flanks
 * and a rounded spine without three different kinds of geometry.
 */
export function ring(s: Station, sides: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const r = s.round ?? 0.6;
  const cy = s.y ?? 0;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // the rectangle: whichever of x, y is furthest out is pinned to the edge
    const m = Math.max(Math.abs(cos), Math.abs(sin));
    const bx = cos / m;
    const by = sin / m;
    out.push(new THREE.Vector3((bx + (cos - bx) * r) * s.w, cy + (by + (sin - by) * r) * s.h, s.z));
  }
  return out;
}

/**
 * The skin over a run of stations, closed at both ends. The stations run nose
 * first, and each one's ring is wound so the triangles face outwards.
 *
 * Both ends are capped with a fan to the station's centre rather than left
 * open: an open end is a hole you can see the inside of the ship through, and
 * the ship is something the player sits inside and then falls out of the back
 * of, so both of those views happen every match.
 */
export function loft(stations: readonly Station[], sides = 12): THREE.BufferGeometry {
  if (stations.length < 2) throw new Error("a hull needs at least two stations");
  if (sides % 4 !== 0) throw new Error("a hull's sides must be a multiple of four");
  const rings = stations.map((s) => ring(s, sides));
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let s = 0; s < rings.length - 1; s++) {
    const a = s * sides;
    const b = (s + 1) * sides;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      // wound so the face looks outwards: the ship is seen from outside on
      // the way past and from inside on the way out of the back of it
      idx.push(a + i, a + j, b + i);
      idx.push(a + j, b + j, b + i);
    }
  }
  // the caps: a point at each end's centre, fanned to its ring
  const nose = pos.length / 3;
  const first = stations[0];
  pos.push(0, first.y ?? 0, first.z);
  const tail = pos.length / 3;
  const last = stations[stations.length - 1];
  pos.push(0, last.y ?? 0, last.z);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(nose, j, i);
    idx.push(tail, (rings.length - 1) * sides + i, (rings.length - 1) * sides + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** how many triangles a loft of this many stations comes to: the budget's arithmetic */
export function loftTriangles(stations: number, sides: number): number {
  return (stations - 1) * sides * 2 + sides * 2;
}
