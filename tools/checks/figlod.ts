// Figure LOD (src/config/lod.json, src/game/figlod.ts): what a figure owes at
// its distance.
//
// The animation runs every frame up close, every second frame out to `mid`,
// every fourth beyond, and not at all off screen past `offscreen`; a figure
// casts a shadow only within `shadow`; its gun is the merged mesh past
// `farGun`. The frames a figure sits out are spread by its own number, so
// they do not all animate on the same one, and over any four frames every
// figure gets its turn.
//
// Run on its own: npx tsx tools/checks/figlod.ts.
import * as THREE from "three";
import { FIG_LOD, figureOnScreen, figureWork, setFigureView } from "../../src/game/figlod";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const L = FIG_LOD;
const at = (d: number) => new THREE.Vector3(0, 0, -d);
/** a view from the origin looking down -z, with everything in front of it on screen */
function look(frame: number): void {
  const cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.1, 1000);
  cam.position.set(0, 1.6, 0);
  cam.lookAt(0, 1.6, -10);
  cam.updateMatrixWorld();
  const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  setFigureView(cam.position, f, frame);
}
/** how often a figure at `d` animates over 12 frames */
function ran(d: number, spread = 0): number {
  let n = 0;
  for (let f = 0; f < 12; f++) {
    look(f);
    if (figureWork(at(d), spread).animate) n++;
  }
  return n;
}

console.log("Figure LOD");
{
  look(0);
  check(`within ${L.near} m a figure animates every frame`, ran(L.near - 5) === 12 && figureWork(at(5), 0).stride === 1, `${ran(L.near - 5)} of 12`);
  check(`to ${L.mid} m it animates every second frame`, ran((L.near + L.mid) / 2) === 6 && figureWork(at(L.mid - 1), 0).stride === 2, `${ran((L.near + L.mid) / 2)} of 12`);
  check(`beyond ${L.mid} m every fourth`, ran(L.mid + 40) === 3 && figureWork(at(L.mid + 40), 0).stride === 4, `${ran(L.mid + 40)} of 12`);
  // the spread: two figures at the same far distance do not animate on the same frames
  const mine: number[] = [];
  const theirs: number[] = [];
  for (let f = 0; f < 8; f++) {
    look(f);
    if (figureWork(at(120), 0).animate) mine.push(f);
    if (figureWork(at(120), 1).animate) theirs.push(f);
  }
  check("two far figures take turns rather than animating on the same frame", mine.length === 2 && theirs.length === 2 && mine.every((f) => !theirs.includes(f)), `${mine.join(",")} and ${theirs.join(",")}`);
}
{
  // off screen: behind the camera
  look(0);
  const behind = new THREE.Vector3(0, 0, 40);
  check("a figure behind the camera is off screen", !figureOnScreen(behind) && figureOnScreen(at(40)));
  check(`off screen and past ${L.offscreen} m it does not animate at all`, [0, 1, 2, 3].every((f) => (look(f), !figureWork(behind, 0).animate)));
  const close = new THREE.Vector3(0, 0, L.offscreen - 5);
  check(`off screen but within ${L.offscreen} m it still animates (it is about to be looked at)`, [0, 1, 2, 3].some((f) => (look(f), figureWork(close, 0).animate)));
}
{
  look(0);
  check(`a figure casts a shadow within ${L.shadow} m and none beyond`, figureWork(at(L.shadow - 1), 0).shadow && !figureWork(at(L.shadow + 1), 0).shadow);
  check(`its gun is the full model within ${L.farGun} m and the merged mesh beyond`, figureWork(at(L.farGun - 1), 0).fullGun && !figureWork(at(L.farGun + 1), 0).fullGun);
}
{
  // nothing said yet: everything animates, as it did before any of this
  setFigureView(new THREE.Vector3(), null, 0);
  const w = figureWork(new THREE.Vector3(0, 0, 0), 0);
  check("before the page has said where it is looking from, a figure animates, casts a shadow and holds its full gun", w.animate && w.shadow && w.fullGun);
}

console.log(fails === 0 ? "\nFIGURE LOD PASS" : `\nFIGURE LOD FAIL (${fails})`);
export const figLodFails = fails;
if (process.argv[1]?.endsWith("figlod.ts")) process.exit(fails === 0 ? 0 : 1);
