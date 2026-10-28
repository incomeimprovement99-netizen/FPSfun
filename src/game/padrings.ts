// The jump pads read as pads (Milestone 668). Both fresh reviews of 2026-10-20 read the pads' white beams as "white light
// wedges", nothing to do with a pad. So each pad gets a ring of light on the ground round it, in its place's colour: a
// district's own past the ring road (THE WORKS teal, LANTERN ALLEYS red, ...), the centre's sector's inside it. Its beam
// is no longer drawn (neonmap.json rules.pads.beamScale 0, Milestone 689).
//
// One instanced mesh for every ring, its colour per instance. The numbers are in neonmap.json game.padRings.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";
import { BR_X, BR_Z } from "./br";
import { decayLight } from "./world";

type Sector = { id: string; accent: string; minX: number; maxX: number; minZ: number; maxZ: number };
const G = (neonCfg as unknown as { game: { padRings: { inner: number; outer: number; glow: number; opacity: number; band: number; district: Record<string, string>; column?: { h: number; k: number }; centre?: string }; sectors: Sector[] } }).game;
const R = G.padRings;

/** a pad's colour: its district's past the ring road (`band` from the middle), its sector's inside it (map metres) */
export function padColour(x: number, z: number): THREE.Color {
  const s = G.sectors.find((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ);
  const names = (neonCfg as unknown as { districtNames?: Array<{ district: string; colour: string }> }).districtNames ?? [];
  const district = s && Math.max(Math.abs(x), Math.abs(z)) > R.band ? R.district[s.id] : undefined;
  const own = district ? names.find((q) => q.district === district)?.colour : undefined;
  // (the centre's own, `centre`: its sector's accent is white, and its pads' columns and its climbs' frames drew as
  // blown-out white drums and rectangles, the lobby agent's bug hunt of 2026-10-27)
  const centre = !district && s?.id === "c" ? R.centre : undefined;
  return new THREE.Color(own ?? centre ?? s?.accent ?? "#ffffff");
}

/** the rings, one a pad, laid on its floor (world space in, the map's root out) */
export function buildPadRings(root: THREE.Object3D, pads: Array<{ x: number; z: number; y?: number }>): THREE.InstancedMesh {
  const geo = new THREE.RingGeometry(R.inner, R.outer, 40).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: R.opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
  // (gone with its sector's decay, Milestone 810)
  decayLight(mat);
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
  // (and over each ring a short column of its light, `column`, bright at the ring and gone `h` up: the centre's eleventh
  // review could not read the rings from 30 m once the pack's cones were gone, Milestone 779; a vertex colour fades it,
  // added to what is behind it, so its top is nothing)
  const C = R.column;
  if (C) {
    const cg = new THREE.CylinderGeometry(R.outer, R.outer, C.h, 40, 1, true).translate(0, C.h / 2, 0);
    const pos = cg.getAttribute("position");
    const fade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) fade.fill(Math.max(0, 1 - pos.getY(i) / C.h) * C.k, i * 3, i * 3 + 3);
    cg.setAttribute("color", new THREE.BufferAttribute(fade, 3));
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
    decayLight(cm);
    const cols = new THREE.InstancedMesh(cg, cm, pads.length);
    pads.forEach((p, i) => {
      const [x, z] = [p.x - BR_X, p.z - BR_Z];
      cols.setMatrixAt(i, m4.makeTranslation(x, (p.y ?? 0) + 0.04, z));
      cols.setColorAt(i, padColour(x, z).multiplyScalar(R.glow));
    });
    cols.name = "padColumns";
    cols.frustumCulled = false;
    cols.userData.dynamic = true;
    root.add(cols);
  }
  return rings;
}
