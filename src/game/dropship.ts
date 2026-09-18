// The dropship: the line across the map a battle royale starts on, and the
// ship that flies it.
//
// The drop used to put everyone 90 m over the place the host had picked, so
// every landing was that place and there was nothing to decide. Now a ship
// flies a straight line across the map and you choose when to leave it. The
// line passes close to the squad's place (the host's pick is still the plan),
// comes in from the side of the map that leaves most of the line before that
// place, so you see it coming, and carries on to the far edge. Whoever is
// still aboard there is put out.
//
// Every browser works the line out for itself from the match seed and the
// squad's place, the way the loot field and the loadout crates are, so
// nothing about the ship goes over the wire. Each runs its own clock from its
// own start of the drop, which is within a round trip of everyone else's.
//
// The numbers are in src/config/squad.json `ship`.
import * as THREE from "three";
import squadCfg from "../config/squad.json";
import { seeded } from "./loot";
import { RANGE_SOLIDS } from "./range";

export const SHIP = squadCfg.ship;
const DIVE = squadCfg.dive;

/** a straight line across the map, from the edge it enters to the edge it leaves */
export interface ShipLine {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** unit direction, a to b */
  dx: number;
  dz: number;
  /** a to b, metres */
  length: number;
}

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** where the line through (px, pz) along (dx, dz) enters and leaves the box: t0 <= 0 <= t1 for a point inside */
function clip(px: number, pz: number, dx: number, dz: number, b: Box): [number, number] {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const [p, d, lo, hi] of [
    [px, dx, b.minX, b.maxX],
    [pz, dz, b.minZ, b.maxZ],
  ]) {
    if (Math.abs(d) < 1e-9) continue;
    const a = (lo - p) / d;
    const c = (hi - p) / d;
    t0 = Math.max(t0, Math.min(a, c));
    t1 = Math.min(t1, Math.max(a, c));
  }
  return [t0, t1];
}

/**
 * The match's line: through a point within `pass` metres of the squad's place,
 * at an angle from the seed, clipped to the map, and flown from whichever end
 * leaves more of it before the place.
 */
export function shipLine(seed: number, place: { x: number; z: number }, bounds: Box): ShipLine {
  // its own stream off the seed, so the loot field's draws are not shifted by it
  const rng = seeded((seed ^ 0x5bd1e995) >>> 0);
  // uniform over the disc round the place, and never outside the map
  const r = Math.sqrt(rng()) * SHIP.pass;
  const a = rng() * Math.PI * 2;
  const inset = 1;
  const px = Math.max(bounds.minX + inset, Math.min(bounds.maxX - inset, place.x + Math.cos(a) * r));
  const pz = Math.max(bounds.minZ + inset, Math.min(bounds.maxZ - inset, place.z + Math.sin(a) * r));
  // An angle whose line is a real crossing: through a place near a corner,
  // most angles clip the corner and are over in a second. Some angle through
  // any point of a square is a full side long, so a long enough one is found.
  let dx = 1;
  let dz = 0;
  let t0 = 0;
  let t1 = 0;
  for (let i = 0; i < SHIP.tries; i++) {
    const angle = rng() * Math.PI * 2;
    const cx = Math.cos(angle);
    const cz = Math.sin(angle);
    const [c0, c1] = clip(px, pz, cx, cz, bounds);
    if (c1 - c0 > t1 - t0) [dx, dz, t0, t1] = [cx, cz, c0, c1];
    if (t1 - t0 >= SHIP.minLine) break;
  }
  // come in from the side with more of the line before the place: time to see it coming
  if (-t0 < t1) {
    dx = -dx;
    dz = -dz;
    [t0, t1] = [-t1, -t0];
  }
  return { ax: px + dx * t0, az: pz + dz * t0, bx: px + dx * t1, bz: pz + dz * t1, dx, dz, length: t1 - t0 };
}

/** the top of whatever is under (x, z) at or below `y`: the ground (0), a roof, a rock */
export function surfaceUnder(x: number, z: number, y: number): number {
  let best = 0;
  for (const s of RANGE_SOLIDS) if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top <= y + 1e-3 && s.top > best) best = s.top;
  return best;
}

/**
 * One frame of a bot's glide off the ship onto its place, flying the player's
 * numbers: across at the glide's speed, and down at whatever rate lands it as
 * it arrives, never slower than a glide or faster than a dive. Against a wall
 * it holds its ground and comes straight down beside it rather than through
 * it. `floor` is what is under a point, `blocked` whether a body there would
 * be inside something. Moves `pos`; returns the way it faced, or null once it
 * is over its place.
 */
export function glideStep(pos: THREE.Vector3, target: { x: number; z: number }, dt: number, floor: (x: number, z: number) => number, blocked: (x: number, z: number) => boolean): number | null {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  const height = Math.max(0, pos.y - floor(pos.x, pos.z));
  const arrive = dist / DIVE.glideSpeed;
  const fall = arrive > 0.05 ? Math.max(DIVE.glideFall, Math.min(DIVE.diveFall, height / arrive)) : DIVE.diveFall;
  let yaw: number | null = null;
  if (dist > 0.05) {
    const step = Math.min(dist, DIVE.glideSpeed * dt);
    const nx = pos.x + (dx / dist) * step;
    const nz = pos.z + (dz / dist) * step;
    // against a wall it slides along it, the way a walking body does, and
    // only comes straight down where neither way along is open
    if (!blocked(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
    } else if (!blocked(nx, pos.z)) pos.x = nx;
    else if (!blocked(pos.x, nz)) pos.z = nz;
    yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
  }
  pos.y -= fall * dt;
  return yaw;
}

/** how far along the line (metres from its entry, clamped to it) is the point nearest (x, z) */
export function alongNearest(line: ShipLine, x: number, z: number): number {
  return Math.max(0, Math.min(line.length, (x - line.ax) * line.dx + (z - line.az) * line.dz));
}

/** how far (x, z) is from the line, metres */
export function offLine(line: ShipLine, x: number, z: number): number {
  const s = alongNearest(line, x, z);
  return Math.hypot(x - (line.ax + line.dx * s), z - (line.az + line.dz * s));
}

/**
 * One browser's flight along the line. It appears `doorsIn` seconds of flight
 * short of the map's edge, so the doors open as it crosses into the map, and
 * it is gone past the far edge.
 */
export class ShipRun {
  /** the moment it appeared (performance.now() seconds); the tests move it to fast-forward the flight */
  startAt: number;
  constructor(
    readonly line: ShipLine,
    startAt: number
  ) {
    this.startAt = startAt;
  }

  /** metres along the line at `now`: negative before the edge */
  along(now: number): number {
    return (now - this.startAt) * SHIP.speed - SHIP.speed * SHIP.doorsIn;
  }

  /** where the ship is at `now` (its middle, at its height) */
  at(now: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.along(now);
    return out.set(this.line.ax + this.line.dx * s, SHIP.height, this.line.az + this.line.dz * s);
  }

  /**
   * Where a rider is at `now`: the ship, but never past the end of the line.
   * A frame loop that stalls (a hidden tab, a slow machine) lets the clock run
   * on, and whoever the ship puts out then must start over the map, not past it.
   */
  riderAt(now: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = Math.min(this.along(now), this.line.length);
    return out.set(this.line.ax + this.line.dx * s, SHIP.height, this.line.az + this.line.dz * s);
  }

  /** the doors are open: over the map, and not yet past its far edge */
  doorsOpen(now: number): boolean {
    const s = this.along(now);
    return s >= 0 && s < this.line.length;
  }

  /** seconds until the doors open (0 once they have) */
  doorsIn(now: number): number {
    return Math.max(0, -this.along(now) / SHIP.speed);
  }

  /** seconds until the ship leaves the map and puts out whoever is still aboard */
  endIn(now: number): number {
    return Math.max(0, (this.line.length - this.along(now)) / SHIP.speed);
  }

  /** past the far edge: nobody is aboard any more */
  gone(now: number): boolean {
    return this.along(now) >= this.line.length;
  }

  /** the moment the ship passes nearest (x, z): when a bot bound there leaves it */
  abeamAt(x: number, z: number): number {
    return this.startAt + SHIP.doorsIn + alongNearest(this.line, x, z) / SHIP.speed;
  }

  /** the ship's heading as a yaw (degrees; a yaw looks down (-sin, -cos)) */
  get yaw(): number {
    return (Math.atan2(-this.line.dx, -this.line.dz) * 180) / Math.PI;
  }
}

/**
 * The ship's figure: a hull with the game's orange along it, wings with four
 * engines glowing at the back, a tail, the ramp at the rear, and the jump
 * light over it (red, then green when the doors open). Built of boxes and
 * cylinders like everything else on the map, facing -z.
 *
 * The riders' own figures sit inside the hull, which hides them; the camera
 * rides behind it.
 */
export function buildShip(): { group: THREE.Group; setDoors(open: boolean): void } {
  const g = new THREE.Group();
  g.name = "dropship";
  const hull = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.55, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d3446, emissive: 0x2a6f9a, emissiveIntensity: 0.6, roughness: 0.2 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xffa040, emissiveIntensity: 2.2 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  // the hull, closed on every side: the riders are in it
  box(4.4, 3.8, 26, 0, 0, 0, hull);
  box(3.2, 2.8, 5, 0, -0.3, -15.5, hull);
  box(2.4, 0.9, 2.6, 0, 0.9, -15.4, glass);
  box(4.5, 0.5, 20, 0, 0.7, -1, accent);
  // wings and the four engines under them, glowing at the back
  box(34, 0.45, 6, 0, 0.4, -1, dark);
  for (const x of [-13, -7.5, 7.5, 13]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 12), hull);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(x, -0.5, -1.5);
    g.add(pod);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 12), glow);
    fire.rotation.x = Math.PI / 2;
    fire.position.set(x, -0.5, 0.7);
    g.add(fire);
  }
  // the tail: a fin and the tailplane
  box(0.5, 5.5, 4.5, 0, 3.4, 11.5, dark);
  box(0.6, 1.2, 3, 0, 6.2, 11.8, accent);
  box(12, 0.35, 3.2, 0, 1.2, 12, dark);
  // the ramp, down at the back once the doors open
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 4), dark);
  const hinge = new THREE.Group();
  hinge.position.set(0, -1.8, 13);
  ramp.position.set(0, 0, 2);
  hinge.add(ramp);
  g.add(hinge);
  // the jump light over the ramp
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2.5 });
  box(1.2, 0.5, 0.5, 0, 1.6, 13.1, lightMat);
  const setDoors = (open: boolean): void => {
    hinge.rotation.x = open ? -0.45 : 0;
    const c = open ? 0x30ff60 : 0xff3030;
    lightMat.color.setHex(c);
    lightMat.emissive.setHex(c);
  };
  setDoors(false);
  return { group: g, setDoors };
}
