// Light and air over SpeedKills' centre (Phase 23.4b; city.json atmosphere). The packs' own scenes stand in haze with a
// colour (Cyber City green, Kyber warm, High City pale, Glass blue) and on wet streets that shine; ours stood in clear
// black air on dry ones (the owner's side by sides against the store, 2026-09-28). So: the fog takes the colour of the
// block you are in, blended between blocks, starts near and thins as you climb (a view from a roof stays clear); the
// sky's horizon takes the same colour so the two meet without a seam; and the streets are wet, reflecting a picture of
// the lit city taken once the kit has dressed it. From Balanced up; Competitive keeps its clear air, where seeing is the
// game. Looks only: nothing here touches play.
import * as THREE from "three";
import cityCfg from "../config/city.json";
import kitCfg from "../config/citykit.json";
import { BR_X, BR_Z, BR_HALF } from "./br";

const A = cityCfg.atmosphere;
const FAMILIES = kitCfg.dress.families as Record<string, string>;
/** the centre's nine blocks: their middles and families (the middle three of the grid's blocks each way) */
const BLOCKS = (() => {
  const b = cityCfg.blocks as Array<[number, number]>;
  const mid = (b.length - 1) / 2;
  const three = [b[mid - 1], b[mid], b[mid + 1]].map(([a0, a1]) => (a0 + a1) / 2);
  const out: Array<{ x: number; z: number; fam: string }> = [];
  three.forEach((x, c) => three.forEach((z, r) => out.push({ x, z, fam: FAMILIES[`${c},${r}`] ?? "high" })));
  return out;
})();

let on = false;
let inside = false;
let last = 0;
let saved: { color: THREE.Color; near: number; far: number } | null = null;
const cur = new THREE.Color();
const want = new THREE.Color();
const tmp = new THREE.Color();
let skyU: { uHorizon: { value: THREE.Color }; uGround: { value: THREE.Color } } | null = null;
let skyBase: { horizon: THREE.Color; ground: THREE.Color } | null = null;

/** from Balanced up (the preset's city detail), the haze and the wet streets are on */
export function atmosphereOn(v: boolean): void {
  on = v;
}

/** the air a frame on: `now` seconds of game time, `day` when the hour is a daytime one */
export function tickAir(scene: THREE.Scene, camera: THREE.Camera, now: number, day: boolean): void {
  const fog = scene.fog as THREE.Fog | null;
  if (!on || !fog) return;
  const x = camera.position.x - BR_X;
  const z = camera.position.z - BR_Z;
  const here = Math.abs(x) < BR_HALF + A.margin && Math.abs(z) < BR_HALF + A.margin;
  if (!skyU) {
    const sky = scene.getObjectByName("sky") as THREE.Mesh | undefined;
    const u = (sky?.material as THREE.ShaderMaterial | undefined)?.uniforms as typeof skyU | undefined;
    if (u) skyU = u;
  }
  if (!here) {
    // leaving the city: the fog and the sky as the hour and the region left them
    if (inside && saved) {
      fog.color.copy(saved.color);
      fog.near = saved.near;
      fog.far = saved.far;
      if (skyU && skyBase) {
        skyU.uHorizon.value.copy(skyBase.horizon);
        skyU.uGround.value.copy(skyBase.ground);
      }
    }
    inside = false;
    return;
  }
  if (!inside) {
    saved = { color: fog.color.clone(), near: fog.near, far: fog.far };
    if (skyU) skyBase = { horizon: skyU.uHorizon.value.clone(), ground: skyU.uGround.value.clone() };
    cur.copy(fog.color);
    inside = true;
  }
  // the blocks' colours, each weighed by how near its middle is; past the centre the districts' own
  const pal = (day ? A.day : A.night) as Record<string, string>;
  want.setRGB(0, 0, 0);
  let sum = 0;
  for (const b of BLOCKS) {
    const d = Math.hypot(x - b.x, z - b.z);
    const w = Math.exp(-(d * d) / (A.blend * A.blend));
    want.add(tmp.set(pal[b.fam] ?? pal.districts).multiplyScalar(w));
    sum += w;
  }
  const out = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - kitCfg.dress.centre);
  const wd = 1 - Math.exp(-(out * out) / (A.blend * A.blend)) + 1e-6;
  want.add(tmp.set(pal.districts).multiplyScalar(wd * Math.max(sum, 1e-3) * 4));
  sum += wd * Math.max(sum, 1e-3) * 4;
  want.multiplyScalar(1 / sum);
  const dt = Math.min(0.25, Math.max(0, now - last));
  last = now;
  cur.lerp(want, 1 - Math.exp(-dt / A.ease));
  fog.color.copy(cur);
  fog.near = A.near;
  // thinning as you climb, never past where the region's own fog ended
  fog.far = Math.min(saved?.far ?? A.far, A.far + Math.max(0, camera.position.y - 2) * A.farUp);
  if (skyU) {
    skyU.uHorizon.value.copy(cur);
    skyU.uGround.value.copy(cur);
  }
}

/**
 * The streets wet: their materials glossy, reflecting a picture of the lit city taken once from `at` (world metres)
 * after the kit has dressed it, since a reflection of the real neon is what reads as wet. One cube map for all of them.
 */
export function wetStreets(renderer: THREE.WebGLRenderer, scene: THREE.Scene, mats: THREE.MeshStandardMaterial[]): void {
  if (!on || !mats.length) return;
  const rt = new THREE.WebGLCubeRenderTarget(A.wet.size, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.5, A.wet.far, rt);
  cam.position.set(BR_X + A.wet.at[0], A.wet.at[1], BR_Z + A.wet.at[2]);
  scene.add(cam);
  cam.update(renderer, scene);
  scene.remove(cam);
  for (const m of mats) {
    m.envMap = rt.texture;
    m.envMapIntensity = A.wet.intensity;
    m.roughness = A.wet.roughness;
    m.metalness = A.wet.metalness;
    m.needsUpdate = true;
  }
}
