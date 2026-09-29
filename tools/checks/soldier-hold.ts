// The soldier's rifle hold (Phase 27, 27.8; src/game/rifle.ts, src/config/soldierhold.json), measured off the
// bought model, as CLAUDE.md asks of any number about a body: its arms' and hands' lengths and the front of its body
// before the right shoulder (where a butt sits), each against the number soldierhold.json carries. And what the hold
// takes from the rig, proven on it: each hand's frame (the way it runs, the way its palm faces) is the hand's on both
// sides of a rig whose right side mirrors its left, and every finger joint's bend closes it toward the palm. The paid
// files are not in git, so a checkout without them skips this with a note.
//
// Run on its own: npx tsx tools/checks/soldier-hold.ts.
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import soldierCfg from "../../src/config/soldier.json";
import holdCfg from "../../src/config/soldierhold.json";
import { measureRifleRig } from "../../src/game/rifle";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const GLB = `public/${soldierCfg.model}`;
console.log("\nThe soldier's rifle hold, measured");
if (!existsSync(GLB)) {
  console.log(`  --  ${GLB} is not here (the paid files are local only), so this is skipped`);
  console.log("\nSOLDIER HOLD SKIPPED");
  if (process.argv[1]?.endsWith("soldier-hold.ts")) process.exit(0);
} else {
  const b = readFileSync(GLB);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const g = await new Promise<{ scene: THREE.Group }>((ok, no) => new GLTFLoader().parse(ab, "", (x) => ok(x as unknown as { scene: THREE.Group }), no));
  const s = g.scene;
  s.getObjectByName(soldierCfg.rename.from)!.name = soldierCfg.rename.to;
  s.scale.setScalar(soldierCfg.scale);
  s.updateMatrixWorld(true);
  const wp = (n: string) => s.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
  const M = holdCfg.measured;
  const near = (a: number, want: number, tol: number) => Math.abs(a - want) <= tol;
  for (const side of ["l", "r"]) {
    const upper = wp(`upperarm_${side}`).distanceTo(wp(`lowerarm_${side}`));
    const fore = wp(`lowerarm_${side}`).distanceTo(wp(`hand_${side}`));
    const hand = wp(`hand_${side}`).distanceTo(wp(`middle_01_${side}`));
    const finger = wp(`middle_01_${side}`).distanceTo(wp(`middle_02_${side}`)) + wp(`middle_02_${side}`).distanceTo(wp(`middle_03_${side}`));
    check(`the ${side === "l" ? "left" : "right"} upper arm is soldierhold.json's ${M.upperArm} m`, near(upper, M.upperArm, 0.003), `${upper.toFixed(4)} m`);
    check(`the ${side === "l" ? "left" : "right"} forearm is ${M.foreArm} m`, near(fore, M.foreArm, 0.003), `${fore.toFixed(4)} m`);
    check(`the ${side === "l" ? "left" : "right"} hand, wrist to knuckle, is ${M.hand} m`, near(hand, M.hand, 0.003), `${hand.toFixed(4)} m`);
    check(`the ${side === "l" ? "left" : "right"} middle finger is ${M.finger} m`, near(finger, M.finger, 0.003), `${finger.toFixed(4)} m`);
    // the glove's width, which a gun's trigger guard has to take (soldierhold.json scale)
    const knuckles = wp(`index_01_${side}`).distanceTo(wp(`pinky_01_${side}`));
    check(`the ${side === "l" ? "left" : "right"} knuckles, index to little finger, are ${M.knuckles} m across`, near(knuckles, M.knuckles, 0.003), `${knuckles.toFixed(4)} m`);
  }
  // the front of the body before the right shoulder joint, the nearest of a few rays straight at it from the front
  {
    const meshes: THREE.Mesh[] = [];
    s.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.Mesh);
    });
    const sh = wp("upperarm_r");
    const ray = new THREE.Raycaster();
    let least = Infinity;
    for (const dy of [0, -0.04, -0.08]) {
      ray.set(new THREE.Vector3(sh.x, sh.y + dy, sh.z + 1), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) least = Math.min(least, hit.point.z - sh.z);
    }
    check(`the body's front is ${M.pocketAhead} m in front of the right shoulder joint, at its nearest`, near(least, M.pocketAhead, 0.004), `${least.toFixed(4)} m`);
    check("the butt's pocket is in front of the body there, not inside it", holdCfg.pocket.ahead >= M.pocketAhead, `pocket ${holdCfg.pocket.ahead} m`);
  }
  // what rifle.ts takes from the rig
  const rig = measureRifleRig(s);
  check("rifle.ts measures the rig", !!rig);
  if (rig) {
    // the right eye, where an aimed gun's sight line goes: on the figure's right (-x), in front of the head, at eye height
    const head = s.getObjectByName("Head")!;
    const eye = rig.eyeR ? head.localToWorld(rig.eyeR.clone()) : null;
    const mid = wp("Head");
    check("rifle.ts finds the right eye: right of the head's middle, in front of it, above its joint", !!eye && eye.x < mid.x - 0.01 && eye.z > mid.z + 0.03 && eye.y > mid.y, eye ? eye.toArray().map((x) => x.toFixed(3)).join(",") : "none");
    for (const side of ["l", "r"] as const) {
      const hand = s.getObjectByName(`hand_${side}`)!;
      const q = hand.getWorldQuaternion(new THREE.Quaternion());
      const fwd = rig.hands[side].fwd.clone().applyQuaternion(q);
      const face = rig.hands[side].face.clone().applyQuaternion(q);
      const toKnuckle = wp(`middle_01_${side}`).sub(wp(`hand_${side}`)).normalize();
      // in the rest pose the arms hang out and down: each palm faces in toward the body and down
      const inward = new THREE.Vector3(side === "l" ? -1 : 1, 0, 0);
      check(`the ${side === "l" ? "left" : "right"} hand runs wrist to knuckles`, fwd.angleTo(toKnuckle) < 0.02, `${((fwd.angleTo(toKnuckle) * 180) / Math.PI).toFixed(1)} degrees off`);
      check(`the ${side === "l" ? "left" : "right"} palm faces in toward the body, as a hanging arm's does (the mirrored rig read right)`, face.dot(inward) > 0.4 && face.y < 0, face.toArray().map((x) => x.toFixed(2)).join(","));
      // each finger joint's bend moves its child toward the palm's side
      let wrong = 0;
      let seen = 0;
      for (const f of ["index", "middle", "ring", "pinky"])
        for (let j = 1; j <= 2; j++) {
          const bone = s.getObjectByName(`${f}_0${j}_${side}`)!;
          const child = s.getObjectByName(`${f}_0${j + 1}_${side}`)!;
          const m = rig.bend.get(bone.name)!;
          const before = child.getWorldPosition(new THREE.Vector3());
          const keep = bone.quaternion.clone();
          bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(m.axis, 0.3));
          bone.updateMatrixWorld(true);
          const after = child.getWorldPosition(new THREE.Vector3());
          bone.quaternion.copy(keep);
          bone.updateMatrixWorld(true);
          seen++;
          if (after.sub(before).dot(face) <= 0) wrong++;
        }
      check(`each of the ${side === "l" ? "left" : "right"} hand's finger joints closes toward the palm`, wrong === 0, `${seen - wrong} of ${seen}`);
      // each finger's splay from the middle finger's line, which `together` closes: the index and the little finger on
      // opposite sides of it, none past 30 degrees; and swung by its whole splay, the little finger lies along it
      const splay = (f: string) => rig.bend.get(`${f}_01_${side}`)!.splay;
      const [ix, rg, pk] = [splay("index"), splay("ring"), splay("pinky")];
      check(`the ${side === "l" ? "left" : "right"} hand's fingers fan out from the middle finger, the index one way and the ring and little finger the other`, ix * pk < 0 && ix * rg < 0 && Math.max(Math.abs(ix), Math.abs(rg), Math.abs(pk)) < 30, `index ${ix.toFixed(1)}, ring ${rg.toFixed(1)}, little ${pk.toFixed(1)} degrees`);
      {
        const lineOf = (f: string) => {
          const d = wp(`${f}_02_${side}`).sub(wp(`${f}_01_${side}`));
          return d.addScaledVector(face, -d.dot(face)).normalize();
        };
        const bone = s.getObjectByName(`pinky_01_${side}`)!;
        const m = rig.bend.get(bone.name)!;
        const keep = bone.quaternion.clone();
        bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(m.spread, (m.splay * Math.PI) / 180));
        s.updateMatrixWorld(true);
        const off = (Math.acos(Math.min(1, lineOf("pinky").dot(lineOf("middle")))) * 180) / Math.PI;
        bone.quaternion.copy(keep);
        s.updateMatrixWorld(true);
        check(`the ${side === "l" ? "left" : "right"} little finger swung by its whole splay lies along the middle finger's line`, off < 2, `${off.toFixed(1)} degrees off`);
      }
    }
  }
  console.log(fails === 0 ? "\nSOLDIER HOLD PASS" : `\nSOLDIER HOLD FAIL (${fails})`);
}
export const soldierHoldFails = fails;
if (process.argv[1]?.endsWith("soldier-hold.ts")) process.exit(fails === 0 ? 0 : 1);
