// Pools of lamp light on the ground by night (Milestone 681). The districts' review of 2026-10-20 (round 2) found the
// city at night "black but THE STRIP and the fence", and both reviews asked for the districts to read by their own
// colours from the air. So under every street lamp a soft pool of light lies on the ground, the lamp's warm white mixed
// with its place's colour (the pads' rings' colours, padrings.ts: a district's own past the ring road, its sector's
// inside it); a small red one on the street under every third lantern of LANTERN ALLEYS; and a broad wash of each
// district's colour over its open ground, which is what reads from the air. None by day.
//
// One instanced mesh for every pool, drawn added to what is under it. The numbers are in neonmap.json game.pools.
import * as THREE from "three";
import neonCfg from "../config/neonmap.json";
import { padColour } from "./padrings";

type PoolSet = { pieces: string[]; r: number; k: number; every?: number; floor?: number };
type Pools = { sets: PoolSet[]; wash: { r: number; k: number; out: number }; lift: number; mix: number; warm: string; glow: { day: number; night: number } };
const P = (neonCfg as unknown as { game: { pools: Pools } }).game.pools;
let mat: THREE.MeshBasicMaterial | null = null;

/** the pools for the hour: lit by night, none by day */
export function lightPoolsHour(day: boolean): void {
  if (!mat) return;
  mat.opacity = day ? P.glow.day : P.glow.night;
  mat.visible = mat.opacity > 0;
}

/** a soft round pool, bright at its middle and gone at its rim (none in the node checks, which have no canvas) */
function poolTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const r2 = ((x - 63.5) ** 2 + (y - 63.5) ** 2) / 63.5 ** 2;
      const a = r2 >= 1 ? 0 : (1 - r2) ** 2;
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** where each pool lies and how big and bright: [x, y, z, radius, brightness], map-local */
export function poolSpots(): number[][] {
  const chunks = (neonCfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number]> }> }).chunks;
  const spots: number[][] = [];
  for (const set of P.sets) {
    let n = 0;
    for (const [id, ch] of Object.entries(chunks)) {
      // (an arena is drawn alone, without the city's extras; its own lamps keep their own light)
      if (id.startsWith("a-")) continue;
      // (a hanging light's pool on the street under it, `floor`, not at its own height)
      for (const [name, x, y, z] of ch.place) if (set.pieces.includes(name.split("/").pop()!) && n++ % (set.every ?? 1) === 0) spots.push([x, set.floor ?? y, z, set.r, set.k]);
    }
  }
  // (each district's wash: the middle of its sector's part past the ring road, `out` metres from the map's middle)
  for (const s of (neonCfg as unknown as { game: { sectors: Array<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }> } }).game.sectors) {
    if (s.id === "c") continue;
    const [x, z] = [Math.sign(s.minX + s.maxX) * P.wash.out, Math.sign(s.minZ + s.maxZ) * P.wash.out];
    spots.push([x, 0, z, P.wash.r, P.wash.k]);
  }
  return spots;
}

/** the pools, one under each street lamp the layout placed (the arenas' own left out), on the map's root */
export function buildLightPools(root: THREE.Object3D): THREE.InstancedMesh {
  const spots = poolSpots();
  // (one quad a metre round, each pool scaled to its own radius)
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  mat = new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffffff, transparent: true, opacity: P.glow.night, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.userData.decay = true;
  const pools = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4();
  const warm = new THREE.Color(P.warm);
  spots.forEach(([x, y, z, r, k], i) => {
    pools.setMatrixAt(i, m4.makeScale(r, 1, r).setPosition(x, y + P.lift, z));
    pools.setColorAt(i, warm.clone().lerp(padColour(x, z), P.mix).multiplyScalar(k));
  });
  pools.name = "lightPools";
  pools.frustumCulled = false;
  pools.userData.dynamic = true;
  root.add(pools);
  return pools;
}
