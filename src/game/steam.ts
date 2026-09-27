// Steam and flickering signs over SpeedKills' centre (Phase 22.2; city.json steam and flicker). Looks only: nothing
// here collides, and neither hides anything. The steam is added light (it can brighten a view, never paint over a
// body in it), rising from where city.ts put its sources (STEAM_SOURCES), one instanced draw for all of it, moved each
// frame as the flying traffic is. A few of the centre's lit signs dip now and then, never more than three times a
// second. Both from Balanced up; Competitive has neither.
import * as THREE from "three";
import cityCfg from "../config/city.json";
import { STEAM_SOURCES, FLICKER_SIGNS } from "./city";

const S = cityCfg.steam;
const Fl = cityCfg.flicker;

/** a stable number in [0, 1) from whole numbers: the same on every client, from nothing but what is passed */
function h(...n: number[]): number {
  let x = 0x9e3779b9;
  for (const v of n) {
    x ^= Math.imul(Math.round(v) | 0, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
  }
  return (x >>> 0) / 4294967296;
}

/**
 * Puff `k` of source `j` at `now` (seconds): where it is (into `out`, world metres), how wide, and how bright (0 to
 * the config's peak). Each lives the config's life, rising, growing and drifting on the wind, brightest halfway up;
 * a source's puffs are spread evenly through that life, and each source starts at its own point in it.
 */
export function steamPuff(j: number, k: number, now: number, out: THREE.Vector3): { size: number; bright: number } {
  const s = STEAM_SOURCES[j];
  const T = S.life;
  const age = (((now + (k / S.perSource) * T + h(j, 1) * T) % T) + T) % T;
  const f = age / T;
  // a slow sway, out of step between puffs, so a column does not rise as a stack
  const w = S.wobble * Math.sin(age * 1.7 + j + k * 2.3);
  out.set(s.x + S.wind[0] * age + w, s.y + f * S.rise, s.z + S.wind[1] * age + w * 0.6);
  return { size: S.size[0] + (S.size[1] - S.size[0]) * f, bright: S.peak * Math.sin(Math.PI * f) };
}

/**
 * A flickering sign's light at `now`, as a share of its steady light: 1 but for its dips. Time runs in windows; in
 * a window, at the config's chance, a burst of dips a spacing apart, placed so it ends a spacing before the window
 * does. So no two dips are ever closer than the spacing: at most three in any second.
 */
export function cityFlicker(now: number, seed: number): number {
  const W = Fl.window;
  const w = Math.floor(now / W);
  const t = now - w * W;
  if (h(seed, w, 1) >= Fl.chance) return 1;
  const n = Fl.burst[0] + Math.floor(h(seed, w, 2) * (Fl.burst[1] - Fl.burst[0] + 1));
  const span = (n - 1) * Fl.spacing + Fl.dipLength[1];
  const start = h(seed, w, 3) * Math.max(0, W - span - Fl.spacing);
  for (let i = 0; i < n; i++) {
    const at = start + i * Fl.spacing;
    const len = Fl.dipLength[0] + h(seed, w, 4 + i) * (Fl.dipLength[1] - Fl.dipLength[0]);
    if (t >= at && t < at + len) return Fl.dip[0] + h(seed, w, 10 + i) * (Fl.dip[1] - Fl.dip[0]);
  }
  return 1;
}

let steam: THREE.InstancedMesh | null = null;
let flickering = false;

/** the steam's one draw, and whether the signs flicker: `on` from Balanced up. How many puffs it draws */
export function buildAtmosphere(scene: THREE.Object3D, on: boolean): number {
  flickering = on;
  if (!on || !STEAM_SOURCES.length || typeof document === "undefined") return 0;
  const n = Math.min(S.cap, STEAM_SOURCES.length * S.perSource);
  // a soft round puff, drawn once
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  steam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
  steam.name = "steam";
  // the puffs move over the whole centre: never culled for a sphere set where they started
  steam.frustumCulled = false;
  steam.castShadow = steam.receiveShadow = false;
  steam.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  scene.add(steam);
  return n;
}

const colour = new THREE.Color(S.color);
const tint = new THREE.Color();
const at = new THREE.Vector3();
const size = new THREE.Vector3();
const face = new THREE.Quaternion();
const m = new THREE.Matrix4();

/** the steam and the signs a frame on (seconds), each puff turned to face the camera */
export function tickAtmosphere(now: number, camera: THREE.Camera): void {
  for (const f of FLICKER_SIGNS) f.material.emissiveIntensity = f.base * (flickering ? cityFlicker(now, f.seed) : 1);
  if (!steam) return;
  camera.getWorldQuaternion(face);
  for (let i = 0; i < steam.count; i++) {
    const p = steamPuff(Math.floor(i / S.perSource), i % S.perSource, now, at);
    size.set(p.size, p.size, p.size);
    steam.setMatrixAt(i, m.compose(at, face, size));
    steam.setColorAt(i, tint.copy(colour).multiplyScalar(p.bright));
  }
  steam.instanceMatrix.needsUpdate = true;
  if (steam.instanceColor) steam.instanceColor.needsUpdate = true;
}
