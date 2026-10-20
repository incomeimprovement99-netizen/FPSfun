// The jump pads read as pads (Milestone 668). Both fresh reviews of 2026-10-20 read the pads' white beams as "white light
// wedges", nothing to do with a pad. So each pad gets a ring of light on the ground round it, in its place's colour: a
// district's own past the ring road (THE WORKS teal, LANTERN ALLEYS red, ...), the centre's sector's inside it. Its beam
// is cut to a stub in the bake (neonmap.json rules.pads.beamScale).
//
// One instanced mesh for every ring, its colour per instance. The numbers are in neonmap.json game.padRings.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";
import { BR_X, BR_Z } from "./br";

type Sector = { id: string; accent: string; minX: number; maxX: number; minZ: number; maxZ: number };
const G = (neonCfg as unknown as { game: { padRings: { inner: number; outer: number; glow: number; opacity: number; band: number; district: Record<string, string> }; sectors: Sector[] } }).game;
const R = G.padRings;

/** a pad's colour: its district's past the ring road (`band` from the middle), its sector's inside it (map metres) */
export function padColour(x: number, z: number): THREE.Color {
  const s = G.sectors.find((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ);
  const names = (neonCfg as unknown as { districtNames?: Array<{ district: string; colour: string }> }).districtNames ?? [];
  const district = s && Math.max(Math.abs(x), Math.abs(z)) > R.band ? R.district[s.id] : undefined;
  const own = district ? names.find((q) => q.district === district)?.colour : undefined;
  return new THREE.Color(own ?? s?.accent ?? "#ffffff");
}

/** the rings, one a pad, laid on its floor (world space in, the map's root out) */
export function buildPadRings(root: THREE.Object3D, pads: Array<{ x: number; z: number; y?: number }>): THREE.InstancedMesh {
  const geo = new THREE.RingGeometry(R.inner, R.outer, 40).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: R.opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
  mat.userData.decay = true;
  const rings = new THREE.InstancedMesh(geo, mat, pads.length);
  const m4 = new THREE.Matrix4();
  pads.forEach((p, i) => {
    const [x, z] = [p.x - BR_X, p.z - BR_Z];
    rings.setMatrixAt(i, m4.makeTranslation(x, (p.y ?? 0) + 0.04, z));
    rings.setColorAt(i, padColour(x, z).multiplyScalar(R.glow));
  });
  rings.name = "padRings";
  rings.frustumCulled = false;
  rings.userData.dynamic = true;
  root.add(rings);
  return rings;
}
