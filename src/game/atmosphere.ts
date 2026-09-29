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
import districtCfg from "../config/citydistricts.json";
import { BR_X, BR_Z, BR_HALF } from "./br";
import { sunNow } from "./range";

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

/**
 * A map's own haze in place of the ILranch city's (the Neon City map, neonmap.json game.air): one colour by night and one
 * by day, its own near and far, thinning as you climb; none of that city's blocks' colours or its districts' staged light,
 * which fell on the new map's streets where the old blocks had stood
 */
let own: { night: string; day: string; near: number; far: number; farUp: number } | null = null;
export function ownAir(look: typeof own): void {
  own = look;
}

/**
 * A district's light over the hour's: the sun and the sky's fill scaled while you stand in it, the hour's own given back
 * when you leave. The hour can change under it (F8), so what it set is remembered, and a value it did not set is the
 * hour's new one to scale from.
 */
let staged: { sun: number; env: number; setSun: number; setEnv: number } | null = null;
function stageLight(scene: THREE.Scene, light: { sun: number; env: number } | null): void {
  const sun = sunNow();
  if (!sun) return;
  if (!light) {
    if (staged) {
      if (sun.intensity === staged.setSun) sun.intensity = staged.sun;
      if (scene.environmentIntensity === staged.setEnv) scene.environmentIntensity = staged.env;
      staged = null;
    }
    return;
  }
  if (!staged || sun.intensity !== staged.setSun || scene.environmentIntensity !== staged.setEnv)
    staged = { sun: staged && sun.intensity === staged.setSun ? staged.sun : sun.intensity, env: staged && scene.environmentIntensity === staged.setEnv ? staged.env : scene.environmentIntensity, setSun: 0, setEnv: 0 };
  sun.intensity = staged.setSun = staged.sun * light.sun;
  scene.environmentIntensity = staged.setEnv = staged.env * light.env;
}

/** the district made of a pack's own demo scene a camera stands in (citydistricts.json hole), while the city's air is on */
export function districtHere(camera: THREE.Camera): (typeof districtCfg.districts)[number] | null {
  if (!on) return null;
  const x = camera.position.x - BR_X;
  const z = camera.position.z - BR_Z;
  return districtCfg.districts.find((d) => inPoly(d.hole, x, z)) ?? null;
}

/** a point inside a polygon (map-local x, z), by the crossings of a ray from it */
function inPoly(poly: number[][], x: number, z: number): boolean {
  let n = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
  }
  return n;
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
    stageLight(scene, null);
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
  if (own) {
    want.set(day ? own.day : own.night);
    stageLight(scene, null);
    const dt = Math.min(0.25, Math.max(0, now - last));
    last = now;
    cur.lerp(want, 1 - Math.exp(-dt / A.ease));
    fog.color.copy(cur);
    fog.near = own.near;
    fog.far = Math.min(saved?.far ?? own.far, own.far + Math.max(0, camera.position.y - 2) * own.farUp);
    if (skyU) {
      skyU.uHorizon.value.copy(cur);
      skyU.uGround.value.copy(cur);
    }
    return;
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
  // in a district made of a pack's own demo scene (citydistricts.json look), its own haze and light, as the pack's pictures
  // have it: staged, as the store's are
  const dist = districtCfg.districts.find((d) => inPoly(d.hole, x, z));
  if (dist) want.set(day ? dist.look.haze.day : dist.look.haze.night);
  stageLight(scene, dist?.look.light ?? null);
  const dt = Math.min(0.25, Math.max(0, now - last));
  last = now;
  cur.lerp(want, 1 - Math.exp(-dt / A.ease));
  fog.color.copy(cur);
  fog.near = dist ? dist.look.haze.near : A.near;
  // thinning as you climb, never past where the region's own fog ended
  fog.far = dist ? dist.look.haze.far : Math.min(saved?.far ?? A.far, A.far + Math.max(0, camera.position.y - 2) * A.farUp);
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
