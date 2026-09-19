// Other players' muzzle flashes.
//
// Every third-person gun had its flash taken out (the display model's flash
// is a lit mesh meant for the view model, and it stayed on), and nothing took
// its place: a figure firing at you from 80 m gave nothing away but its
// tracer. In Apex and Warzone the flash is how you find a shooter at range,
// and the bots' own sight model already assumed it was there.
//
// The display model's flash child sits at the muzzle, so each figure's gun
// keeps an empty marker in its place, and the marker carries a sprite that
// lights for a few hundredths of a second on each shot. It is additive, one
// texture and two materials shared by every figure, and never smaller than a
// few pixels on screen, or at range it would vanish into a single pixel.
import * as THREE from "three";
import cfg from "../config/hud.json";

/** how long a flash stays lit, how big it is up close, and the fewest pixels across it ever is on screen */
export const MUZZLE = cfg.muzzleFlash;

let tex: THREE.Texture | null = null;
const mats: Partial<Record<"ballistic" | "energy", THREE.SpriteMaterial>> = {};

/** a soft white star, drawn once: tinted by the material */
function flashTexture(): THREE.Texture | null {
  if (tex) return tex;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  // four short spikes, so it reads as a flash and not a lamp
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillRect(30, 2, 4, 60);
  g.fillRect(2, 30, 60, 4);
  tex = new THREE.CanvasTexture(c);
  return tex;
}

function material(kind: "ballistic" | "energy"): THREE.SpriteMaterial {
  let m = mats[kind];
  if (!m) {
    m = new THREE.SpriteMaterial({
      map: flashTexture(),
      color: kind === "energy" ? 0x8fd8ff : 0xffc46b,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    });
    mats[kind] = m;
  }
  return m;
}

/**
 * Take the display model's flash out of a third-person gun and leave a
 * marker at the muzzle with a sprite on it, unlit. Null when the model has no
 * flash to take the place of.
 */
export function fitMuzzle(gun: THREE.Object3D, energy: boolean): THREE.Sprite | null {
  const f = gun.children.find((c) => c.name === "muzzleflash");
  if (!f) return null;
  const marker = new THREE.Object3D();
  marker.name = "muzzle";
  marker.position.copy(f.position);
  marker.quaternion.copy(f.quaternion);
  gun.remove(f);
  gun.add(marker);
  const s = new THREE.Sprite(material(energy ? "energy" : "ballistic"));
  s.name = "muzzle-flash";
  s.visible = false;
  s.renderOrder = 10;
  marker.add(s);
  return s;
}

/** where the flashes are seen from, and how many pixels a radian is there (main sets it each frame) */
export const viewer = { pos: new THREE.Vector3(), pxPerRad: 600 };

export function setMuzzleViewer(camera: THREE.PerspectiveCamera, heightPx: number): void {
  camera.getWorldPosition(viewer.pos);
  viewer.pxPerRad = heightPx / ((camera.fov * Math.PI) / 180);
}

const at = new THREE.Vector3();
const scaleOf = new THREE.Vector3();

/** light (or put out) a flash sprite: `lit` 0 is out; its size keeps at least MUZZLE.minPx across on screen */
export function showFlash(s: THREE.Sprite, lit: boolean, spin: number): void {
  s.visible = lit;
  if (!lit) return;
  s.getWorldPosition(at);
  const dist = at.distanceTo(viewer.pos);
  const size = Math.max(MUZZLE.size, (dist * MUZZLE.minPx) / viewer.pxPerRad);
  s.parent?.getWorldScale(scaleOf);
  const k = scaleOf.x > 1e-6 ? scaleOf.x : 1;
  s.scale.setScalar(size / k);
  s.material.rotation = spin;
}

/** the world-space size a flash is drawn at, seen from `dist` metres (the checks) */
export function flashSize(dist: number, pxPerRad: number): number {
  return Math.max(MUZZLE.size, (dist * MUZZLE.minPx) / pxPerRad);
}
