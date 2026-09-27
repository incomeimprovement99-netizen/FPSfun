// The bought guns, measured (Phase 21 W2, docs/PHASE_21_OVERNIGHT_PLAN.md): for each gun src/config/paidweapons.json
// maps to a model, off the model itself: its length, which end of it is the muzzle (the end farther from the model's
// origin, which the pack puts at the grip: +Z on every long gun, Unity's forward; the narrower end was tried first
// and chose the stock on four of ten, whose skeletal stocks are thinner than their shrouded barrels), where the
// muzzle is, and the top of its sights over the rear half. paidweapons.json carries these beside its numbers and this fails when they part. The collision
// hulls (UCX_*) are never counted. Without the paid files (they are local only) it is skipped with a note.
//
// Every model of each gun's family is measured, into paidmodels.json, and this fails when a model and its numbers part
// or a family member is missing, so which build a gun wears is chosen by numbers. The seat a fitted optic sits on is
// measured without the pack's own sights (paidweapons.json sights), which give way to it: measured with them, the
// rifle's optic sat on its hidden scope's top, 69 mm over the gun.
//
// Run on its own: npx tsx tools/checks/paid-weapons.ts (WRITE=1 measures the families and writes src/config/paidmodels.json).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import cfg from "../../src/config/paidweapons.json";
import skCfg from "../../src/config/games/speedkills.json";
import { OPTICS, opticLineH } from "../../src/game/optics";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe bought guns");
const dir = `public/${cfg.models}`;
if (!existsSync(dir)) {
  console.log(`  --  ${dir} is not here (the paid files are local only: npm run paid makes them), so this is skipped`);
  console.log("\nPAID WEAPONS SKIPPED");
  process.exit(0);
}

export interface Measured {
  length: number;
  /** +1 when the muzzle is at the model's +Z end, -1 at its -Z end */
  muzzleEnd: number;
  muzzle: [number, number, number];
  /** the highest point over the rear half: the sight line's top */
  sightTop: number;
  /** where along the gun that top is (the model's z) */
  sightZ: number;
  /**
   * the seat a fitted optic sits on (paidgun.ts railY, opticF): the top of the gun within 15 mm of its centre line and
   * 30 mm along it of railZ, without the sights that give way to the optic; railZ is where the sight it takes the place
   * of stood (a scope or rear sight over the rear half), or the top's z on a gun without one
   */
  railTop: number;
  railZ: number;
  /**
   * a scope in one piece with the gun (paidweapons.json sights.ownScope): its axis's height (its top less its half
   * width, a round tube) and the z of its back end, where the eye goes
   */
  scope?: { axis: number; back: number };
}

const SIGHTS = cfg.sights as { hide: string; fold: string; ownScope: string[] };
const offPart = new RegExp(`${SIGHTS.hide}|${SIGHTS.fold}`);

async function measure(file: string): Promise<Measured> {
  const b = readFileSync(file);
  const g = await new Promise<{ scene: THREE.Group }>((ok, no) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", (x) => ok(x as never), no));
  g.scene.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  // the pack's own sights (paidweapons.json sights), each part with its children, apart: they give way to an optic
  const off = new Map<string, THREE.Vector3[]>();
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || /^UCX_/.test(m.name)) return;
    let part: string | null = null;
    for (let q: THREE.Object3D | null = m; q; q = q.parent) if (offPart.test(q.name)) part = q.name;
    const p = m.geometry.getAttribute("position");
    const into = part ? (off.get(part) ?? off.set(part, []).get(part)!) : null;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      pts.push(v);
      into?.push(v);
    }
  });
  const offSet = new Set([...off.values()].flat());
  const body = pts.filter((p) => !offSet.has(p));
  const box = new THREE.Box3().setFromPoints(pts);
  const len = box.max.z - box.min.z;
  const section = (atMax: boolean) => {
    const band = pts.filter((p) => (atMax ? box.max.z - p.z : p.z - box.min.z) < 0.06);
    const bb = new THREE.Box3().setFromPoints(band);
    const s = bb.getSize(new THREE.Vector3());
    return { area: s.x * s.y, centre: bb.getCenter(new THREE.Vector3()) };
  };
  const hi = section(true);
  const lo = section(false);
  const end = box.max.z >= -box.min.z ? 1 : -1;
  const tip = end > 0 ? hi.centre.setZ(box.max.z) : lo.centre.setZ(box.min.z);
  const mid = (box.max.z + box.min.z) / 2;
  const rear = pts.filter((p) => (end > 0 ? p.z < mid : p.z > mid));
  const top = rear.reduce((a, p) => (p.y > a.y ? p : a), rear[0]);
  const sightTop = top.y;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const isRear = (z: number) => (end > 0 ? z < mid : z > mid);
  // where the optic goes: where the sight it takes the place of stood, over the rear half
  const replaced = [...off.values()].map((v) => new THREE.Box3().setFromPoints(v)).filter((b) => isRear((b.min.z + b.max.z) / 2));
  const seat = replaced.length ? replaced.reduce((a, b) => a.union(b)) : null;
  const railZ = seat ? (seat.min.z + seat.max.z) / 2 : top.z;
  const railTop = body.filter((p) => Math.abs(p.x) < 0.015 && Math.abs(p.z - railZ) < 0.03).reduce((a, p) => Math.max(a, p.y), -Infinity);
  const out: Measured = { length: r(len), muzzleEnd: end, muzzle: [r(tip.x), r(tip.y), r(tip.z)], sightTop: r(sightTop), sightZ: r(top.z), railTop: r(railTop), railZ: r(railZ) };
  const family = file.replace(/^.*[\\/]/, "").replace(/_\d+\.glb$/, "");
  if (SIGHTS.ownScope.includes(family)) {
    const upper = body.filter((p) => p.y > sightTop - 0.03);
    const axis = sightTop - upper.reduce((a, p) => Math.max(a, Math.abs(p.x)), 0);
    const above = body.filter((p) => p.y > axis && isRear(p.z));
    const back = end > 0 ? above.reduce((a, p) => Math.min(a, p.z), Infinity) : above.reduce((a, p) => Math.max(a, p.z), -Infinity);
    out.scope = { axis: r(axis), back: r(back) };
  }
  return out;
}

const guns = cfg.guns as unknown as Record<string, { model: string }>;
const MODELS = "src/config/paidmodels.json";
const table: Record<string, { measured: Measured }> = existsSync(MODELS) ? JSON.parse(readFileSync(MODELS, "utf8")).models : {};
const familyOf = (model: string) => model.replace(/_\d+$/, "");
/** every model of a family in the import, by name */
const inPack = (family: string) =>
  readdirSync(dir)
    .filter((f) => f.startsWith(`${family}_`) && f.endsWith(".glb"))
    .map((f) => f.slice(0, -4))
    .sort();
const families = [...new Set(Object.values(guns).map((g) => familyOf(g.model)))];
if (process.env.WRITE) {
  const out: Record<string, { measured: Measured }> = {};
  for (const fam of families) for (const m of inPack(fam)) out[m] = { measured: await measure(`${dir}${m}.glb`) };
  const note = "Generated by tools/checks/paid-weapons.ts (WRITE=1): every model of each SpeedKills gun's family in the bought pack, measured off the model (its length, which end is the muzzle, the muzzle, the top of its sights over the rear half, the seat a fitted optic sits on without the pack's own sights, and a scope in one piece with the gun), so a gun sits in the hands by numbers, not by eye. Rerun it when the pack is imported again.";
  writeFileSync(MODELS, JSON.stringify({ _note: note, models: out }, null, 2) + "\n");
  console.log(`        wrote ${MODELS}: ${Object.keys(out).length} models`);
  Object.assign(table, out);
}
for (const [name, entry] of Object.entries(table)) {
  const file = `${dir}${name}.glb`;
  if (!existsSync(file)) {
    check(`${name} is here`, false);
    continue;
  }
  const m = await measure(file);
  const want = entry.measured;
  check(
    `${name}: paidweapons.json holds what the model measures`,
    Math.abs(want.length - m.length) < 0.002 &&
      want.muzzleEnd === m.muzzleEnd &&
      Math.abs(want.sightTop - m.sightTop) < 0.002 &&
      Math.abs((want.sightZ ?? NaN) - m.sightZ) < 0.002 &&
      Math.abs((want.railTop ?? NaN) - m.railTop) < 0.002 &&
      Math.abs((want.railZ ?? NaN) - m.railZ) < 0.002 &&
      JSON.stringify(want.scope ?? null) === JSON.stringify(m.scope ?? null) &&
      want.muzzle.every((v, i) => Math.abs(v - m.muzzle[i]) < 0.002),
    `measured ${JSON.stringify(m)}`,
  );
}
for (const [id, g] of Object.entries(guns)) {
  const fam = inPack(familyOf(g.model));
  check(`${id}: its model and every other ${familyOf(g.model)} in the pack are measured (${fam.length})`, fam.includes(g.model) && fam.every((m) => table[m]), fam.filter((m) => !table[m]).join(", "));
}

// every gun's model is a split build (its magazine, slide or pump a part of its own, which a reload or a shot moves)
// and a gun, not a part: the pack's _1 of a family is the same gun in one piece, and three guns that wore one kept
// their magazines in on a reload; SciFiGrenadeLauncher01_3 is the launcher's round
{
  const partsOf = async (name: string): Promise<string[]> => {
    const b = readFileSync(`${dir}${name}.glb`);
    const g = await new Promise<{ scene: THREE.Group }>((ok, no) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", (x) => ok(x as never), no));
    const out: string[] = [];
    g.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && /^(Clip|Slide|Slider|Pump|Drum)/.test(o.name)) out.push(o.name);
    });
    return out;
  };
  const bad: string[] = [];
  for (const id of Object.keys(guns)) {
    for (const name of [guns[id].model]) {
      const parts = await partsOf(name);
      const len = table[name]?.measured.length ?? 0;
      if (!parts.length || len < 0.4) bad.push(`${id}: ${name}${parts.length ? "" : " (in one piece)"}${len < 0.4 ? ` (${len} m long)` : ""}`);
    }
  }
  check("every gun's model is a split build with moving parts, and a gun", bad.length === 0, bad.join("; ") || "all");
}

// The pack's parts the view moves, which it gives split and never moves itself, hinged by the game's own code
// (paidgun.ts hingeParts) and moved as the view moves them: the launcher's drum turned a chamber must put every round
// where another stood, or a shot would leave one out of line with the barrel; and a flip-up sight folded under the
// gun's fitted optic (paidweapons.json sightFold, viewmodel.ts fitOptic) must lie below the optic's window (standing,
// NOVA's front sight stood in it; folded from the middle of its foot, its long foot tipped up into it)
{
  const { hingeParts } = await import("../../src/game/paidgun");
  const optics = skCfg.weapons as Record<string, { optic: string }>;
  const meshPoints = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true);
    const out: THREE.Vector3[] = [];
    root.traverse((o) => {
      const p = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry.getAttribute("position") : null;
      for (let i = 0; p && i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    });
    return out;
  };
  const centre = (o: THREE.Object3D) => new THREE.Box3().setFromPoints(meshPoints(o)).getCenter(new THREE.Vector3());
  for (const [id, gun] of Object.entries(guns)) {
    const size = table[gun.model]?.measured;
    if (!size) continue;
    const b = readFileSync(`${dir}${gun.model}.glb`);
    const g = await new Promise<{ scene: THREE.Group }>((ok, no) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", (x) => ok(x as never), no));
    const parts = hingeParts(g.scene, size.muzzleEnd);
    if (parts.drum) {
      const rounds = () => parts.drum!.children[0].children.filter((o) => /^Grenade/.test(o.name)).map(centre);
      const before = rounds();
      parts.drum.rotation.z = parts.drumStep;
      g.scene.updateMatrixWorld(true);
      const miss = rounds().map((v) => Math.min(...before.map((w) => v.distanceTo(w))));
      parts.drum.rotation.z = 0;
      check(
        `${id}: ${gun.model}'s drum, turned a chamber (${((parts.drumStep * 180) / Math.PI).toFixed(1)} degrees), puts each of its ${before.length} rounds where another stood`,
        before.length > 1 && Math.max(...miss) < 0.002,
        `farthest ${(Math.max(...miss) * 1000).toFixed(1)} mm`,
      );
    }
    if (parts.sights.length) {
      const info = OPTICS[optics[id]?.optic];
      const windowBottom = size.railTop + opticLineH(info) - info.winH / 2;
      for (const s of parts.sights) s.rotation.x = parts.end * cfg.motion.sightFold;
      const top = parts.sights.flatMap(meshPoints).reduce((a, v) => Math.max(a, v.y), -Infinity);
      check(
        `${id}: ${gun.model}'s flip-up sights, folded, lie under its optic's window (${optics[id]?.optic})`,
        top < windowBottom,
        `folded top ${top.toFixed(3)} m, the window's bottom ${windowBottom.toFixed(3)} m`,
      );
    }
  }
}

// the props (W7): a name that is not in the import falls back to our own shapes without a word, so each is looked for
const props = (cfg as unknown as { props: Record<string, { model: string; skin: string }> }).props;
for (const [key, p] of Object.entries(props)) {
  const colour = `public/${cfg.textures}${p.model.replace(/_\d+$/, "")}${p.skin}_color.webp`;
  check(`the ${key} prop: its model ${p.model} and its skin ${p.skin} are here`, existsSync(`${dir}${p.model}.glb`) && existsSync(colour), colour);
}

console.log(fails === 0 ? "\nPAID WEAPONS PASS" : `\nPAID WEAPONS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
