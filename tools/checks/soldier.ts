// The bought soldier, measured and proven to take the game's clips (Phase 21 S2 and S5,
// docs/OVERNIGHT_BRIEF_SOLDIER_AND_VERTICAL_CENTRE.md).
//
// What it measures off the model (the numbers soldier.json carries, each with its measurement): its height, its
// pelvis, its shoulders, and that every bone the game's clips drive and every part soldier.json names is there.
// What it proves: the clips, carried over to the soldier's A-posed, +X-boned rig by src/game/retarget.ts, point every
// limb the way they point the clip rig's (within a few degrees), and its feet stay on the floor. The paid files are
// not in git, so a checkout without them skips this with a note (the game falls back to its own figures).
//
// Run on its own: npx tsx tools/checks/soldier.ts.
import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { retargetClip, retargeter, rigOf } from "../../src/game/retarget";
import { botSoldierCode, collarLowering, lookOf, mergeSoldier, readSoldierCode } from "../../src/game/soldier";
import soldierCfg from "../../src/config/soldier.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const GLB = `public/${soldierCfg.model}`;
console.log("\nThe bought soldier");
// the bots' soldiers need no files: a battle royale's bots (ids 100 up) in many looks, every code one the network
// reads back, and the same code for the same id every time, so the host and every guest see the same bot
{
  const ids = Array.from({ length: 27 }, (_, i) => 100 + i);
  const codes = ids.map(botSoldierCode);
  const kits = new Set(codes.map((c) => readSoldierCode(c)?.variant));
  check(
    "a battle royale's 27 bots wear 20 or more different soldiers across all four kits, each a code the network reads, the same for the same id",
    new Set(codes).size >= 20 && kits.size === 4 && codes.every((c) => readSoldierCode(c) !== null) && ids.every((id, i) => botSoldierCode(id) === codes[i]),
    `${new Set(codes).size} looks, ${kits.size} kits`,
  );
}
if (!existsSync(GLB)) {
  console.log(`  --  ${GLB} is not here (the paid files are local only: npm run paid makes them), so this is skipped`);
  console.log("\nSOLDIER SKIPPED");
  process.exit(0);
}

async function load(path: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const b = readFileSync(path);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return new Promise((ok, no) => new GLTFLoader().parse(ab, "", (g) => ok(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), no));
}

const soldier = await load(GLB);
const clipsGlb = await load("public/models/mannequin/mannequin.glb");
const more = await load("public/models/mannequin/mannequin-more.glb");
// the soldier's head bone is "head"; the game's (and its clips') is "Head" (soldier.ts renames it the same way)
soldier.scene.getObjectByName(soldierCfg.rename.from)!.name = soldierCfg.rename.to;
soldier.scene.updateMatrixWorld(true);

// ------------------------------------------------------------------ measured
const wp = (root: THREE.Object3D, n: string) => root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
{
  const box = new THREE.Box3();
  soldier.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.computeBoundingBox();
    box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  const M = soldierCfg.measured;
  const height = box.max.y - box.min.y;
  const pelvis = wp(soldier.scene, "pelvis").y;
  const shoulders = wp(soldier.scene, "upperarm_l").distanceTo(wp(soldier.scene, "upperarm_r"));
  check(`its height, feet to the top of the head, is soldier.json's ${M.height} m`, Math.abs(height - M.height) < 0.01, `${height.toFixed(3)} m`);
  check(`its pelvis is at ${M.pelvis} m`, Math.abs(pelvis - M.pelvis) < 0.005, `${pelvis.toFixed(3)} m`);
  check(`its shoulders are ${M.shoulders} m apart`, Math.abs(shoulders - M.shoulders) < 0.005, `${shoulders.toFixed(3)} m`);
  check("it stands on the floor", Math.abs(box.min.y) < 0.02, `lowest point ${box.min.y.toFixed(3)} m`);
}
{
  const names = new Set<string>();
  soldier.scene.traverse((o) => names.add(o.name));
  const drive = rigOf(clipsGlb.scene).order.filter((n) => n !== "root" && !/_leaf_/.test(n));
  const missing = drive.filter((n) => !names.has(n));
  check(`every bone the clips drive is on it (${drive.length})`, missing.length === 0, missing.join(", "));
  const parts = Object.keys(soldierCfg.parts);
  const absent = parts.filter((p) => !names.has(p));
  check(`every part soldier.json names is in the model (${parts.length})`, absent.length === 0, absent.join(", "));
}

// ------------------------------------------------------------------ the clips on it
{
  const src = rigOf(clipsGlb.scene);
  const dst = rigOf(soldier.scene);
  const r = retargeter(src, dst);
  const all = [...clipsGlb.animations, ...more.animations];
  const LIMBS = ["upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r", "thigh_l", "calf_l", "thigh_r", "calf_r", "spine_01", "spine_03", "neck_01", "clavicle_l", "clavicle_r"];
  const CHILD: Record<string, string> = { upperarm_l: "lowerarm_l", lowerarm_l: "hand_l", hand_l: "middle_01_l", upperarm_r: "lowerarm_r", lowerarm_r: "hand_r", hand_r: "middle_01_r", thigh_l: "calf_l", calf_l: "foot_l", thigh_r: "calf_r", calf_r: "foot_r", spine_01: "spine_02", spine_03: "neck_01", neck_01: "Head", clavicle_l: "upperarm_l", clavicle_r: "upperarm_r" };
  const dir = (root: THREE.Object3D, n: string) => wp(root, CHILD[n]).sub(wp(root, n)).normalize();
  let worst = { angle: 0, clip: "", bone: "", t: 0 };
  let lowFoot = 0;
  const tried: string[] = [];
  const srcMixer = new THREE.AnimationMixer(clipsGlb.scene);
  const dstMixer = new THREE.AnimationMixer(soldier.scene);
  for (const name of ["Idle_Loop", "Sprint_Loop", "Jog_Fwd_Loop", "Pistol_Aim_Neutral", "Jump_Loop", "Crouch_Fwd_Loop"]) {
    const clip = all.find((c) => c.name === name);
    if (!clip) continue;
    tried.push(name);
    const out = retargetClip(r, clip);
    for (const k of [0, 0.25, 0.5, 0.75]) {
      const t = clip.duration * k;
      srcMixer.stopAllAction();
      dstMixer.stopAllAction();
      srcMixer.clipAction(clip).play();
      dstMixer.clipAction(out).play();
      srcMixer.setTime(t);
      dstMixer.setTime(t);
      clipsGlb.scene.updateMatrixWorld(true);
      soldier.scene.updateMatrixWorld(true);
      for (const b of LIMBS) {
        const a = dir(clipsGlb.scene, b).angleTo(dir(soldier.scene, b)) * (180 / Math.PI);
        if (a > worst.angle) worst = { angle: a, clip: name, bone: b, t };
      }
      // the lower ball of a foot against where it stands at rest
      if (name === "Idle_Loop") lowFoot = Math.max(lowFoot, Math.abs(Math.min(wp(soldier.scene, "ball_l").y, wp(soldier.scene, "ball_r").y) - soldierCfg.measured.ballHeight));
    }
  }
  check(`the clips carried over point every limb as the clip rig's do, within 4 degrees (${tried.join(", ")})`, tried.length >= 5 && worst.angle < 4, `worst ${worst.angle.toFixed(1)} deg: ${worst.bone} in ${worst.clip} at ${worst.t.toFixed(2)} s`);
  check("and standing idle, its feet stay on the floor (the toe within 4 cm of where it stands at rest)", lowFoot < 0.04, `${(lowFoot * 100).toFixed(1)} cm`);
  check("no carried-over clip moves the root, which holds the model's axis turn", retargetClip(r, all[0]).tracks.every((t) => !t.name.startsWith("root.")));

  // the merge (soldier.ts): eighteen pieces as four meshes, one a material, that deform exactly as the pieces did.
  // Both posed mid-sprint; every seventh vertex of each merged mesh against the same vertex of its piece.
  const merged = mergeSoldier(soldier.scene, lookOf("VANGUARD"));
  const mm: THREE.SkinnedMesh[] = [];
  merged.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mm.push(o as THREE.SkinnedMesh);
  });
  check("VANGUARD, every piece on, is four skinned meshes, one a material slot", mm.length === 4 && mm.every((m) => m.name.startsWith("soldier:")), mm.map((m) => m.name).join(", "));
  const pieces: THREE.SkinnedMesh[] = [];
  soldier.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) pieces.push(o as THREE.SkinnedMesh);
  });
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  // each merged vertex against its piece's, every seventh, in the pose they are both in
  const each = (f: (m: THREE.SkinnedMesh, key: string) => void): void => {
    for (const m of mm) {
      const slot = m.userData.soldierMaterial as string;
      let at = 0;
      for (const p of pieces.filter((x) => (x.material as THREE.Material).name === slot)) {
        const n = p.geometry.getAttribute("position").count;
        for (let i = 0; i < n; i += 7) {
          p.getVertexPosition(i, va).applyMatrix4(p.matrixWorld);
          m.getVertexPosition(at + i, vb).applyMatrix4(m.matrixWorld);
          f(m, `${m.name}:${at + i}`);
        }
        at += n;
      }
    }
  };
  // The collar behind the head is brought down in the merge (soldier.ts collarLowering, soldier.json collar): in the bind
  // pose those vertices are where the lowering put them, straight down from their piece's, and they are left out below
  for (const m of [...pieces, ...mm]) m.skeleton.pose();
  soldier.scene.updateMatrixWorld(true);
  merged.updateMatrixWorld(true);
  const lowered = new Set<string>();
  let sideways = 0;
  let rose = 0;
  each((_m, key) => {
    if (va.distanceTo(vb) < 1e-4) return;
    lowered.add(key);
    sideways = Math.max(sideways, Math.hypot(vb.x - va.x, vb.z - va.z) * 1000);
    rose = Math.max(rose, (vb.y - va.y) * 1000);
  });
  check("the merge moves only the collar behind the head, and only down (soldier.json collar), in the bind pose", lowered.size > 0 && lowered.size < 400 && sideways < 30 && rose <= 0, `${lowered.size} vertices, most sideways ${sideways.toFixed(1)} mm, most up ${rose.toFixed(1)} mm`);
  // ...and never past the bottom edge of the neck's skin, which is meant to be inside it: the cut under the head alone
  // left the collar's top 5 cm under the edge all round the back and the sides, a gap at the bottom of the back of the
  // neck you could see the world through (the owner, 2026-10-12, in third person with the USSO). Round the neck in
  // 15-degree sectors, over the bind pose: the head piece's lowest point near the neck's line (their middle, the edge),
  // and the lowered collar's highest in each sector of the back and the sides
  {
    const partOf = (o: THREE.Object3D): string => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if ((soldierCfg.parts as Record<string, string>)[p.name]) return p.name;
      return o.name;
    };
    const body = pieces.find((m) => partOf(m) === "body")!;
    const skel = body.skeleton;
    const toBody = body.bindMatrix.clone().invert();
    const bone = (n: string) => new THREE.Vector3().setFromMatrixPosition(toBody.clone().multiply(skel.boneInverses[skel.bones.findIndex((x) => x.name === n)].clone().invert()));
    const [pelvis, neck, head, ul, ur] = ["pelvis", "neck_01", "Head", "upperarm_l", "upperarm_r"].map(bone);
    const up = head.clone().sub(pelvis).normalize();
    const left = ul.clone().sub(ur);
    left.addScaledVector(up, -left.dot(up)).normalize();
    const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
    const nx = neck.clone().sub(pelvis).dot(left);
    const nz = neck.clone().sub(pelvis).dot(fwd);
    const neckH = neck.clone().sub(pelvis).dot(up);
    const lower = collarLowering(pieces, body);
    const C = soldierCfg.collar;
    const edgeLow = new Map<number, number>();
    const top = new Map<number, number>();
    const index = new Map(skel.bones.map((x, i) => [x.name, i]));
    const m4 = new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (const m of pieces) {
      const part = partOf(m);
      // the suit: the armour over it stays lowered as far as the head's cut, and the suit is what closes the neck
      if (part !== "head_eyes" && !C.overNeckParts.includes(part)) continue;
      m4.copy(skel.boneInverses[index.get(m.skeleton.bones[0].name)!]).invert().multiply(m.skeleton.boneInverses[0]);
      const geo = m.geometry.clone().applyMatrix4(toBody.clone().multiply(m4).multiply(m.bindMatrix));
      if (part !== "head_eyes" && lower) lower(geo, part);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const d = v.fromBufferAttribute(pos, i).sub(pelvis);
        const hx = d.dot(left) - nx;
        const hz = d.dot(fwd) - nz;
        const y = d.dot(up);
        // the back and the sides, as far round as the collar is lowered: two thirds of the way to the front
        const a = Math.atan2(hx, -hz);
        if (Math.hypot(hx, hz) > C.neckRadius || Math.abs(a) > (2 * Math.PI) / 3 || y < neckH - 0.15 || y > neckH + 0.12) continue;
        const sct = Math.round((a / (2 * Math.PI)) * 24);
        if (part === "head_eyes") edgeLow.set(sct, Math.min(edgeLow.get(sct) ?? Infinity, y));
        else top.set(sct, Math.max(top.get(sct) ?? -Infinity, y));
      }
    }
    const lows = [...edgeLow.values()].sort((a, b) => a - b);
    const edge = lows[lows.length >> 1];
    const over = [...top.entries()].map(([sct, y]) => ({ deg: sct * 15, mm: Math.round((y - edge) * 1000) }));
    const short = over.filter((o) => o.mm < -2);
    check(
      "the lowered suit's collar comes up to the bottom edge of the neck's skin all round the back and the sides, 2 mm under its middle at most (no gap to see through)",
      over.length >= 15 && short.length === 0,
      short.length ? JSON.stringify(short) : `the edge ${Math.round((edge - neckH) * 1000)} mm over the neck bone, the collar ${Math.min(...over.map((o) => o.mm))} to ${Math.max(...over.map((o) => o.mm))} mm over it in ${over.length} sectors`,
    );
  }
  const sprint = retargetClip(r, all.find((c) => c.name === "Sprint_Loop")!);
  const a1 = new THREE.AnimationMixer(soldier.scene);
  const a2 = new THREE.AnimationMixer(merged);
  a1.clipAction(sprint).play();
  a2.clipAction(sprint).play();
  a1.setTime(sprint.duration * 0.3);
  a2.setTime(sprint.duration * 0.3);
  soldier.scene.updateMatrixWorld(true);
  merged.updateMatrixWorld(true);
  let worstMm = 0;
  let compared = 0;
  each((_m, key) => {
    if (lowered.has(key)) return;
    worstMm = Math.max(worstMm, va.distanceTo(vb) * 1000);
    compared++;
  });
  check("and mid-sprint every other merged vertex is where its piece's is, within a millimetre", compared > 1000 && worstMm < 1, `${compared} vertices, worst ${worstMm.toFixed(3)} mm`);
}

console.log(fails === 0 ? "\nSOLDIER PASS" : `\nSOLDIER FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
