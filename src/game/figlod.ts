// Figure LOD (src/config/lod.json, docs/PLAN_LOD_DRAW_DISTANCE.md step D).
//
// The page says where it is looking from once a frame; every figure asks what
// it owes at its distance: how often to animate, whether to cast a shadow, and
// whether its gun is the full model or the one merged mesh. Kept here, not in
// dummy.ts, so the checks can ask the same questions without a scene.
import * as THREE from "three";
import cfg from "../config/lod.json";
import { slow } from "./slow";

export const FIG_LOD = cfg.figures;

/** where the page is drawing from this frame, and which frame it is */
const view = { at: new THREE.Vector3(), frustum: new THREE.Frustum(), frame: 0, set: false, fps: 60 };

/** the page, once a frame: the camera's place, what it can see, the frame's number and the frame rate */
export function setFigureView(at: THREE.Vector3, frustum: THREE.Frustum | null, frame: number, fps = 60): void {
  view.at.copy(at);
  if (frustum) view.frustum.copy(frustum);
  view.frame = frame;
  view.set = !!frustum;
  view.fps = Number.isFinite(fps) ? Math.max(1, Math.min(1000, fps)) : 60;
}

export function figureFrame(): number {
  return view.frame;
}

/** the distance from the camera to a figure's feet (0 before the page has said where it is) */
export function figureDistance(at: THREE.Vector3): number {
  return view.at.distanceTo(at);
}

/** (one sphere for every test: they run for every figure and every gun on the floor, every frame) */
const probe = new THREE.Sphere();

/** is a figure at `at` (with about a metre of body over it) somewhere the camera can see */
export function figureOnScreen(at: THREE.Vector3): boolean {
  return inView(at.x, at.y + 1, at.z, 1.4);
}

/**
 * Is a ball of `r` metres round a point somewhere the camera can see (true before the page has said). The view is
 * the one the frame started with, a frame old by the time it is drawn, so `r` carries a margin for a fast turn.
 */
export function inView(x: number, y: number, z: number, r: number): boolean {
  if (!view.set) return true;
  probe.center.set(x, y, z);
  probe.radius = r;
  return view.frustum.intersectsSphere(probe);
}

/**
 * What a figure at `at` owes this frame. `spread` is its own number (its id),
 * so the figures that animate every second or fourth frame do not all land on
 * the same one.
 */
export function figureWork(at: THREE.Vector3, spread: number): { animate: boolean; shadow: boolean; fullGun: boolean; eyes: boolean; stride: number } {
  const d = figureDistance(at);
  const onScreen = figureOnScreen(at);
  const band = d <= FIG_LOD.near ? 1 : d <= FIG_LOD.mid ? 2 : 4;
  // past the near band, its own rate at any frame rate (lod.json midHz, farHz): never fewer frames apart than the band's
  // stride, and on a fast machine as many more as hold it to that rate
  const stride = band === 1 || slow("lodhz") ? band : Math.max(band, Math.round(view.fps / (band === 2 ? FIG_LOD.midHz : FIG_LOD.farHz)));
  // off screen and well away: nothing to animate until it is looked at again
  const animate = onScreen || d <= FIG_LOD.offscreen ? (view.frame + Math.abs(Math.round(spread))) % stride === 0 : false;
  return { animate, shadow: d <= FIG_LOD.shadow, fullGun: d <= FIG_LOD.farGun, eyes: d <= FIG_LOD.eyes, stride };
}
