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

// the figure's melee swing takes the game's melee time, as the first person's does (read off viewmodel.ts, which a
// check running in Node cannot import: it builds on the page)
{
  const m = /export const MELEE_TIME = ([\d.]+);/.exec(readFileSync("src/game/viewmodel.ts", "utf8"));
  check("the soldier's melee swing is the game's melee time (viewmodel.ts MELEE_TIME)", !!m && Number(m[1]) === holdCfg.melee.time, `${holdCfg.melee.time} s against ${m?.[1] ?? "none"}`);
}

// Every hand's fingers closed as a hand closes (Milestone 603; the owner, 2026-10-18: "ensure the hands logically line up
// and fingers and not just no gaps"). Read off soldierhold.json, gun by gun, both hands, as tools/figure-grip.ts fits
// them: a finger's last joint follows its middle one (one tendon bends both: grip.follow of it, the trigger finger's up
// to all of it, the thumb's grip.thumbFollow), no finger is hooked off a straight knuckle (its middle joint no more
// than twice its knuckle and 45 degrees), and no holding finger between two others is curled far off both of them (one
// straight between two closed round a grip touched the gun with its tip and was no grasp; a hand's end finger is let
// curl further, as a little finger wraps under a grip's end and a support hand's index round a trigger guard). The
// fingers before it broke all three: a ring finger 84 degrees at the knuckle, 5 at its middle and 76 at its last joint.
{
  const G = holdCfg.grip;
  type Joints = Record<string, number[]>;
  const base = holdCfg.fingers as unknown as Record<"l" | "r", Joints>;
  const bad: string[] = [];
  for (const [id, gun] of Object.entries(holdCfg.guns as unknown as Record<string, { fingers?: Record<"l" | "r", Joints> }>)) {
    for (const side of ["r", "l"] as const) {
      const F = { ...base[side], ...(gun.fingers?.[side] ?? {}) };
      const curl: Record<string, number> = {};
      for (const f of ["index", "middle", "ring", "pinky", "thumb"]) {
        const [k, m, d] = F[f];
        curl[f] = k + m;
        const trigger = side === "r" && f === "index";
        const lo = (f === "thumb" ? G.thumbFollow : G.follow) * m;
        const hi = trigger ? Math.max(m, lo) : lo;
        if (d < Math.min(lo, hi) - 1 || d > Math.max(lo, hi) + 1) bad.push(`${id} ${side} ${f}: its last joint ${d} on a middle one of ${m}`);
        if (f !== "thumb" && !trigger && m > 2 * Math.max(0, k) + G.hookBy) bad.push(`${id} ${side} ${f}: hooked, ${m} at its middle joint off ${k} at its knuckle`);
      }
      const holding = side === "r" ? ["middle", "ring", "pinky"] : ["index", "middle", "ring", "pinky"];
      holding.forEach((f, i) => {
        if (i === 0 || i === holding.length - 1) return;
        const near = [holding[i - 1], holding[i + 1]];
        const off = Math.min(...near.map((n) => Math.abs(curl[f] - curl[n])));
        if (off > G.apart) bad.push(`${id} ${side} ${f}: curled ${curl[f]} where the fingers beside it are ${near.map((n) => curl[n]).join(" and ")}`);
      });
    }
  }
  check("every gun's fingers close as a hand closes: each last joint following its middle, none hooked, none between two curled far off both (soldierhold.json grip)", bad.length === 0, bad.slice(0, 6).join("; ") + (bad.length > 6 ? `; and ${bad.length - 6} more` : ""));
}
// and a reload's grips the same way (Milestone 613): the keys where a hand takes hold of the gun (a charging handle, a
// bolt, a pump), not its point at the magazine or its pinch of a shell; their own fingers, over the hand's hold
{
  const G = holdCfg.grip;
  const GRASPS = /^(handle|handleBack|bolt|boltUp|boltBack|pump)/;
  const bad: string[] = [];
  for (const [id, gun] of Object.entries(holdCfg.guns as unknown as Record<string, { reload?: { keys?: Record<string, { fingers?: Record<string, number[]> }> } }>)) {
    for (const [key, k] of Object.entries(gun.reload?.keys ?? {})) {
      if (!GRASPS.test(key) || !k.fingers) continue;
      for (const [f, j] of Object.entries(k.fingers)) {
        if (j.length < 3) continue;
        const [kn, m, d] = j;
        const follow = (f === "thumb" ? G.thumbFollow : G.follow) * m;
        if (Math.abs(d - follow) > 1) bad.push(`${id} ${key} ${f}: its last joint ${d} on a middle one of ${m}`);
        if (f !== "thumb" && m > 2 * Math.max(0, kn) + G.hookBy) bad.push(`${id} ${key} ${f}: hooked, ${m} at its middle joint off ${kn} at its knuckle`);
      }
    }
  }
  check("every gun's reload grips (a charging handle, a bolt, a pump) close as a hand closes: each last joint following its middle, none hooked", bad.length === 0, bad.slice(0, 6).join("; ") + (bad.length > 6 ? `; and ${bad.length - 6} more` : ""));
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
