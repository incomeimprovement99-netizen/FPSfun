// Ring Consoles: terminals on the battle royale's map that show the squad
// where the ring goes after the next one.
//
// The HUD drew two circles, the live one and where it closes to, so every
// rotation was a reaction to a circle you had just been shown. A console
// gives a squad that goes out of its way for it a round's head start: hold E
// at one for a few seconds and the circle after next is on everyone's map,
// dashed, until the ring gets there. A console reboots when the ring closes,
// so each one is worth one scan a round, and a scan pays EVO the way the
// genre pays for scouting.
//
// The ring's whole chain of circles is worked out when the match starts, from
// the match seed (ring.ts plan), so every browser knows it and a scan only has
// to say which console and which circle. Where the consoles stand comes from
// the seed too, each near one of the map's places on open ground.
//
// The numbers are in src/config/br.json `console`.
import * as THREE from "three";
import brCfg from "../config/br.json";
import { seeded } from "./loot";
import { RANGE_SOLIDS } from "./range";

export const CONSOLE = brCfg.console;

export interface ConsoleSpot {
  x: number;
  z: number;
  /** the place it stands at, by name (the prompt and the tests) */
  place: string;
}

/** no box over or through a body at (x, z), with a little room round it */
function clearAt(x: number, z: number): boolean {
  const pad = 0.9;
  return !RANGE_SOLIDS.some((s) => s.top > 0.3 && x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad);
}

/**
 * Where this match's consoles stand: `count` of the map's places, drawn from
 * the seed, each on the first clear ground found round a seeded bearing from
 * the place's middle. The same on every browser for the same match.
 */
export function consoleSpots(seed: number, places: ReadonlyArray<{ name: string; x: number; z: number }>): ConsoleSpot[] {
  const rng = seeded((seed ^ 0x27d4eb2f) >>> 0);
  // the places in a seeded order: the first `count` that have clear ground get one
  const order = places.map((p) => ({ p, k: rng() })).sort((a, b) => a.k - b.k).map((o) => o.p);
  const out: ConsoleSpot[] = [];
  for (const p of order) {
    if (out.length >= CONSOLE.count) break;
    const bearing = rng() * Math.PI * 2;
    let spot: { x: number; z: number } | null = null;
    // out from the middle along the bearing, then round it, until a clear spot turns up
    for (let r = CONSOLE.near; r <= CONSOLE.far && !spot; r += 1.5) {
      for (let k = 0; k < 12 && !spot; k++) {
        const a = bearing + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (clearAt(x, z)) spot = { x, z };
      }
    }
    if (spot) out.push({ x: spot.x, z: spot.z, place: p.name });
  }
  return out;
}

/**
 * A console's figure: a dark plinth, a slanted screen lit cyan while it has
 * something to show, and a ring of light turning over it that goes out when
 * it has been scanned this round. Not solid: it is a waist-high prop, and a
 * box in the collision list would change the bots' paths at match start.
 */
export function buildConsole(): { group: THREE.Group; setReady(on: boolean): void; spin(dt: number): void } {
  const g = new THREE.Group();
  g.name = "ring-console";
  const dark = new THREE.MeshStandardMaterial({ color: 0x23282f, roughness: 0.6, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.5 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0c2a33, emissive: 0x39d0ff, emissiveIntensity: 1.6 });
  const holo = new THREE.MeshStandardMaterial({ color: 0x39d0ff, emissive: 0x39d0ff, emissiveIntensity: 2, transparent: true, opacity: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 0.7), dark);
  base.position.y = 0.525;
  g.add(base);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.8), trim);
  lip.position.y = 1.07;
  g.add(lip);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), screen);
  face.position.set(0, 1.16, 0.02);
  face.rotation.x = -0.5;
  g.add(face);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), trim);
  mast.position.set(0, 1.55, -0.28);
  g.add(mast);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 32), holo);
  ring.position.set(0, 2.1, -0.28);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 24), holo);
  inner.position.copy(ring.position);
  inner.rotation.x = Math.PI / 2;
  g.add(inner);
  let lit = true;
  return {
    group: g,
    setReady(on: boolean) {
      if (on === lit) return;
      lit = on;
      screen.emissiveIntensity = on ? 1.6 : 0.12;
      ring.visible = on;
      inner.visible = on;
    },
    spin(dt: number) {
      if (!lit) return;
      ring.rotation.z += dt * 0.9;
      inner.rotation.z -= dt * 1.4;
    },
  };
}
