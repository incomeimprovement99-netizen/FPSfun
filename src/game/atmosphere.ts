// Light and air over SpeedKills' map (Phase 23.4b): the haze takes the map's own colour by night and by day (the Neon
// City's, neonmap.json game.air), eased to as you come into the map, starts near and thins as you climb (a view from a
// roof stays clear), and the sky's horizon takes the same colour so the two meet without a seam. From Balanced up;
// Competitive keeps its clear air, where seeing is the game. Looks only: nothing here touches play. (The old ILranch
// city's block colours, its districts' staged light and its wet streets went with it, 2026-10-09.)
import * as THREE from "three";
import worldCfg from "../config/world.json";
import { BR_X, BR_Z, BR_HALF } from "./br";

const A = worldCfg.atmosphere;

let on = false;
let inside = false;
let last = 0;
let saved: { color: THREE.Color; near: number; far: number } | null = null;
const cur = new THREE.Color();
const want = new THREE.Color();
let skyU: { uHorizon: { value: THREE.Color }; uGround: { value: THREE.Color } } | null = null;
let skyBase: { horizon: THREE.Color; ground: THREE.Color } | null = null;

/** from Balanced up (the preset's city detail), the haze is on */
export function atmosphereOn(v: boolean): void {
  on = v;
}

/** the map's own haze (the Neon City map, neonmap.json game.air): one colour by night and one by day, its own near and far, thinning as you climb */
let own: { night: string; day: string; near: number; far: number; farUp: number } | null = null;
export function ownAir(look: typeof own): void {
  own = look;
}

/** the air a frame on: `now` seconds of game time, `day` when the hour is a daytime one */
export function tickAir(scene: THREE.Scene, camera: THREE.Camera, now: number, day: boolean): void {
  const fog = scene.fog as THREE.Fog | null;
  if (!on || !fog || !own) return;
  const x = camera.position.x - BR_X;
  const z = camera.position.z - BR_Z;
  const here = Math.abs(x) < BR_HALF + A.margin && Math.abs(z) < BR_HALF + A.margin;
  if (!skyU) {
    const sky = scene.getObjectByName("sky") as THREE.Mesh | undefined;
    const u = (sky?.material as THREE.ShaderMaterial | undefined)?.uniforms as typeof skyU | undefined;
    if (u) skyU = u;
  }
  if (!here) {
    // leaving the map: the fog and the sky as the hour and the region left them
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
  want.set(day ? own.day : own.night);
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
}
