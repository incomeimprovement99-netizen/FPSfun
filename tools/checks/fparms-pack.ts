// The first-person arms pack (KINEMATION's FPS Animation Ultimate, src/config/fparms.json, docs/PLAN_FIRST_PERSON_ARMS.md):
// its files are in, the rig has the bones it is driven by, and each pack gun is measured, in its own pose, the way the
// game puts our guns in its hands:
//
// - `turn`: the quarter turns that stand the pack gun on the gun bone (ik_hand_gun) as KINEMATION's own prefabs do,
//   found as the one of the 24 axis turns that points the gun ahead with its trigger nearest the right index finger
//   (Unity and FBX2glTF read the files' axes differently, so it is not the identity the prefabs show);
// - `forward` and `up`: the gun's own axes in that frame, the rig's ahead and up at the pose snapped to the nearest axis;
// - `trigger`: its Trigger part's pivot in that frame, where our gun's trigger goes;
// - `palm`: where the left hand holds it, on its underside under the palm, 22 mm up (as paidgun.ts puts our guns'
//   support point over theirs), so our gun's own support point can be held instead;
// - `clavicleL` and `clavicleR`: how far KINEMATION's player moves each shoulder for this gun, off the gun's settings
//   asset (the L96X's right one 21 cm back, so the long gun's grip is reached with the elbow bent).
//
// The paid files are local only (npm run paid makes them), so without them this is skipped.
// Run: npx tsx tools/checks/fparms-pack.ts   (WRITE=1 writes the measurements into fparms.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import cfg from "../../src/config/fparms.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const D = `public/${cfg.models}`;
console.log("\nThe first-person arms pack");
if (!existsSync(`${D}arms.glb`)) {
  console.log(`  --  ${D}arms.glb is not here (the paid files are local only: npm run paid makes them), so this is skipped`);
  console.log("\nFP ARMS SKIPPED");
  process.exit(0);
}
async function load(path: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const b = readFileSync(path);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return new Promise((ok, no) => new GLTFLoader().parse(ab, "", (g) => ok(g as never), no));
}
const r3 = (v: THREE.Vector3): number[] => [v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000);
let arms = await load(`${D}arms.glb`);
const bone = (n: string): THREE.Object3D | undefined => arms.scene.getObjectByName(n);
const need = ["ik_hand_gun", "ik_hand_l", "ik_hand_r", "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r", "index_03_r", "middle_01_l", "head"];
const missing = need.filter((n) => !bone(n));
check("the arms have the bones the rig is driven by: the gun bone, both hands' targets, both arms, the head", missing.length === 0, missing.join(", ") || `${need.length} of them`);
let meshes = 0;
arms.scene.traverse((o) => void ((o as THREE.SkinnedMesh).isSkinnedMesh && meshes++));
check("the arms are skinned meshes (glove, sleeve and hand)", meshes >= 3, `${meshes}`);

const world = (o: THREE.Object3D): THREE.Vector3 => o.getWorldPosition(new THREE.Vector3());
const turns: THREE.Euler[] = [];
for (const x of [0, 1, 2, 3]) for (const y of [0, 1, 2, 3]) for (const z of [0, 1, 2, 3]) turns.push(new THREE.Euler((x * Math.PI) / 2, (y * Math.PI) / 2, (z * Math.PI) / 2));
const snap = (v: THREE.Vector3): THREE.Vector3 => {
  const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
  const i = a.indexOf(Math.max(...a));
  return new THREE.Vector3(i === 0 ? Math.sign(v.x) : 0, i === 1 ? Math.sign(v.y) : 0, i === 2 ? Math.sign(v.z) : 0);
};
/** the clip's first frame on the arms */
const at0 = (clip: THREE.AnimationClip): void => {
  const mixer = new THREE.AnimationMixer(arms.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  arms.scene.updateMatrixWorld(true);
};

const measured: Record<string, { turn: number[]; forward: number[]; up: number[]; trigger: number[]; palm: number[]; clavicleL: number[]; clavicleR: number[] }> = {};
// each pack gun's shoulder offsets, read off its own settings asset by the import (tools/import-fparms.ts)
const settings = JSON.parse(readFileSync(`${D}settings.json`, "utf8")) as Record<string, { clavicleL: number[]; clavicleR: number[] }>;
for (const [name, g] of Object.entries(cfg.packGuns)) {
  for (const c of [...Object.values(g.arms), ...Object.values(g.gun)]) {
    const f = `${D}clips/${c}.glb`;
    // (every one the game asks for: a pose excused here was a 404 on every page once the arms loaded at the start)
    if (!existsSync(f)) check(`${name}: its clip ${c} is in`, false);
  }
  // fresh arms for each: a clip leaves the bones it tracks where it put them, and the pose clips do not all track the same
  arms = await load(`${D}arms.glb`);
  const pose = (await load(`${D}clips/${g.arms.pose}.glb`)).animations[0];
  at0(pose);
  const gun = await load(`${D}guns/${g.model}.glb`);
  const holder = new THREE.Group();
  bone("ik_hand_gun")!.add(holder);
  holder.add(gun.scene);
  const trig = gun.scene.getObjectByName("Trigger");
  check(`${name}: the pack gun has a Trigger part`, !!trig);
  if (!trig) continue;
  // the turn: ahead (its length along the rig's z, the muzzle in front) and the trigger nearest the index finger
  let best: { e: THREE.Euler; d: number } | null = null;
  const index = world(bone("index_03_r")!);
  const boxOf = (): THREE.Box3 => {
    const box = new THREE.Box3();
    gun.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
    });
    return box;
  };
  const gunBoneAt = world(bone("ik_hand_gun")!);
  for (const e of turns) {
    holder.quaternion.setFromEuler(e);
    arms.scene.updateMatrixWorld(true);
    const box = boxOf();
    const s = box.getSize(new THREE.Vector3());
    if (s.z < Math.max(s.x, s.y) || box.max.z - gunBoneAt.z < gunBoneAt.z - box.min.z) continue;
    const d = world(trig).distanceTo(index);
    if (!best || d < best.d - 1e-6) best = { e: e.clone(), d };
  }
  check(`${name}: a turn stands it ahead in the hands with its trigger under the index finger`, !!best && best.d < 0.06, best ? `${(best.d * 100).toFixed(1)} cm` : "none");
  if (!best) continue;
  holder.quaternion.setFromEuler(best.e);
  arms.scene.updateMatrixWorld(true);
  const inv = holder.matrixWorld.clone().invert();
  const rot = new THREE.Matrix3().setFromMatrix4(holder.matrixWorld).invert();
  const forward = snap(new THREE.Vector3(0, 0, 1).applyMatrix3(rot).normalize());
  const up = snap(new THREE.Vector3(0, 1, 0).applyMatrix3(rot).normalize());
  const trigger = world(trig).applyMatrix4(inv);
  // the palm: between the wrist and the middle knuckle, along the gun; the underside under it, 22 mm up
  const palmW = world(bone("hand_l")!).lerp(world(bone("middle_01_l")!), 0.55);
  const palm = palmW.clone().applyMatrix4(inv);
  const along = palm.dot(forward);
  // a ray up from well below the gun at that point along it, in the gun's frame
  const origin = forward.clone().multiplyScalar(along).addScaledVector(up, -0.5).applyMatrix4(holder.matrixWorld);
  const dirW = up.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(holder.matrixWorld)).normalize();
  const hits: THREE.Intersection[] = [];
  gun.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // a skinned part raycast as its rest shape: the pack gun is at rest in its pose
    const plain = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    plain.matrixWorld.copy(m.matrixWorld);
    new THREE.Raycaster(origin, dirW, 0, 1).intersectObject(plain, false, hits);
  });
  hits.sort((a, b) => a.distance - b.distance);
  check(`${name}: the underside under the left palm is found`, hits.length > 0);
  if (!hits.length) continue;
  const under = hits[0].point.clone().applyMatrix4(inv);
  const support = forward.clone().multiplyScalar(along).addScaledVector(up, under.dot(up) + 0.022);
  measured[name] = {
    turn: [best.e.x, best.e.y, best.e.z].map((a) => Math.round((a * 180) / Math.PI)),
    forward: r3(forward),
    up: r3(up),
    trigger: r3(trigger),
    palm: r3(support),
    clavicleL: settings[name]?.clavicleL ?? [0, 0, 0],
    clavicleR: settings[name]?.clavicleR ?? [0, 0, 0],
  };
  console.log(`      ${name}: ${JSON.stringify(measured[name])}`);
  holder.removeFromParent();
}

const have = cfg as unknown as { measured?: Record<string, unknown> };
if (process.env.WRITE) {
  const file = "src/config/fparms.json";
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.measured = measured;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`  wrote the measurements into ${file}`);
} else {
  const same = JSON.stringify(have.measured ?? null) === JSON.stringify(measured);
  check("fparms.json holds these measurements (WRITE=1 writes them)", same);
}
console.log(fails === 0 ? "\nFP ARMS PASS" : `\nFP ARMS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
