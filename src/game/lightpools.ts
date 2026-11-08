// Pools of lamp light on the ground by night (Milestone 681). The districts' review of 2026-10-20 (round 2) found the
// city at night "black but THE STRIP and the fence", and both reviews asked for the districts to read by their own
// colours from the air. So under every street lamp a soft pool of light lies on the ground, the lamp's warm white mixed
// with its place's colour (the pads' rings' colours, padrings.ts: a district's own past the ring road, its sector's
// inside it); a small red one on the street under every third lantern of LANTERN ALLEYS; and a broad wash of each
// district's colour over its open ground, which is what reads from the air. None by day.
//
// Two instanced meshes, drawn added to what is under them: the lamps' pools and the districts' washes, each its own
// falloff (Milestone 1090). The numbers are in neonmap.json game.pools.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";
import { padColour } from "./padrings";
import { decayLight } from "./world";

type PoolSet = { pieces: string[]; r: number; k: number; every?: number; floor?: number };
type Pools = { sets: PoolSet[]; wash: { r: number; k: number; out: number; mix?: number }; washK?: Record<string, number>; spots?: number[][]; trim?: number[][]; lift: number; mix: number; warm: string; glow: { day: number; night: number }; shape: { h: number; fade: number } };
const P = (neonCfg as unknown as { game: { pools: Pools } }).game.pools;
const mats: THREE.MeshBasicMaterial[] = [];

/** the pools for the hour: lit by night, none by day */
export function lightPoolsHour(day: boolean): void {
  for (const mat of mats) {
    mat.opacity = day ? P.glow.day : P.glow.night;
    mat.visible = mat.opacity > 0;
  }
}

/**
 * a lamp's pool's brightness `r` of its radius out: as a lamp `shape.h` radii over flat ground lights it (the cube of
 * the cosine of the angle off straight down, h^3 / (h^2 + r^2)^1.5), a bright middle under the lamp and a long dim tail,
 * faded to nothing from `shape.fade` to the rim. `h` is the look, set against the night pictures, not the lamp's own
 * height: the (1 - r^2)^2 the pools had until Milestone 1090 held near its full brightness to half the radius, and the
 * centre's nineteenth reviews saw "flat pastel discs" from the air.
 */
export function lampPool(r: number): number {
  if (r >= 1) return 0;
  const { h, fade } = P.shape;
  const t = Math.min(1, Math.max(0, (r - 1) / (fade - 1)));
  return (h * h / (h * h + r * r)) ** 1.5 * t * t * (3 - 2 * t);
}
/** a district's wash: broad and even, gone at its rim (the pools' falloff before Milestone 1090) */
export function washPool(r: number): number {
  return r >= 1 ? 0 : (1 - r * r) ** 2;
}

/** a round pool, its brightness `r` of the radius out by `alpha` (none in the node checks, which have no canvas) */
function poolTexture(alpha: (r: number) => number): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const a = alpha(Math.hypot(x - 63.5, y - 63.5) / 63.5);
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** where each pool lies and how big and bright: [x, y, z, radius, brightness, wash], map-local; `wash` 1 for a district's */
export function poolSpots(): number[][] {
  const chunks = (neonCfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number]> }> }).chunks;
  const spots: number[][] = [];
  // (a lamp's pool cut to its floor, `trim` [x, z, radius]: on a roof or a walkway a flat disc spilled past the edge
  // into the air, and by THE WELL over its open shaft, the lobby agent's bug hunt of 2026-10-27; 0 drops it. Measured
  // off the collision by tools/neon-pooltrim.ts, Milestone 810)
  const trim = new Map((P.trim ?? []).map(([x, z, r]) => [`${x.toFixed(2)},${z.toFixed(2)}`, r]));
  for (const set of P.sets) {
    let n = 0;
    for (const [id, ch] of Object.entries(chunks)) {
      // (an arena is drawn alone, without the city's extras; its own lamps keep their own light)
      if (id.startsWith("a-")) continue;
      // (a hanging light's pool on the street under it, `floor`, not at its own height)
      for (const [name, x, y, z] of ch.place)
        if (set.pieces.includes(name.split("/").pop()!) && n++ % (set.every ?? 1) === 0) {
          const r = trim.get(`${x.toFixed(2)},${z.toFixed(2)}`) ?? set.r;
          if (r > 0) spots.push([x, set.floor ?? y, z, Math.min(r, set.r), set.k]);
        }
    }
  }
  // (each district's wash: the middle of its sector's part past the ring road, `out` metres from the map's middle)
  // (a district at its own brightness where `washK` names it: THE STRIP the brightest)
  const district = (neonCfg as unknown as { game: { padRings: { district: Record<string, string> } } }).game.padRings.district;
  for (const s of (neonCfg as unknown as { game: { sectors: Array<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }> } }).game.sectors) {
    if (s.id === "c") continue;
    const [x, z] = [Math.sign(s.minX + s.maxX) * P.wash.out, Math.sign(s.minZ + s.maxZ) * P.wash.out];
    spots.push([x, 0, z, P.wash.r, P.washK?.[district[s.id]] ?? P.wash.k, 1]);
  }
  // (and pools of their own, `spots`: THE WELL's bottom)
  for (const q of P.spots ?? []) spots.push(q);
  return spots;
}

/** the pools, one under each street lamp the layout placed (the arenas' own left out), and the districts' washes, on the map's root */
export function buildLightPools(root: THREE.Object3D): THREE.InstancedMesh {
  const spots = poolSpots();
  // (one quad a metre round, each pool scaled to its own radius)
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  mats.length = 0;
  const warm = new THREE.Color(P.warm);
  const m4 = new THREE.Matrix4();
  // (a wash in more of its district's own colour than a lamp's pool, `wash.mix`: a district's colour is what reads from
  // the air by night, and mixed half with the lamps' warm white each read pastel)
  const mesh = (name: string, list: number[][], alpha: (r: number) => number, mix: number) => {
    const mat = new THREE.MeshBasicMaterial({ map: poolTexture(alpha), color: 0xffffff, transparent: true, opacity: P.glow.night, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // (gone with its sector's decay, Milestone 810)
    decayLight(mat);
    mats.push(mat);
    const pools = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, r, k], i) => {
      pools.setMatrixAt(i, m4.makeScale(r, 1, r).setPosition(x, y + P.lift, z));
      pools.setColorAt(i, warm.clone().lerp(padColour(x, z), mix).multiplyScalar(k));
    });
    pools.name = name;
    pools.frustumCulled = false;
    pools.userData.dynamic = true;
    root.add(pools);
    return pools;
  };
  mesh("lightWashes", spots.filter((q) => q[5] === 1), washPool, P.wash.mix ?? P.mix);
  return mesh("lightPools", spots.filter((q) => q[5] !== 1), lampPool, P.mix);
}
