// Dressing the arenas (src/game/arenas/dress.ts).
//
// Seven of the game's modes are played in the arenas, and every piece of
// cover in them was a grey box. A CC0 prop now stands in for the box: the
// box's mesh is not drawn and a stack of crates, a run of barriers or a rack
// is drawn in the same space.
//
// The whole of that is safe only while one thing holds: **the cover does not
// change**. The collider comes from the plan exactly as before, so what has
// to be checked is that what is drawn still matches it. A crate two thirds
// the height of the box it replaced is cover you can see over but not shoot
// over, and a crate narrower than its box is a bullet stopping in mid air.
//
// Run on its own: npx tsx tools/checks/dress.ts.
import { ARENA_PLANS } from "../../src/game/arenas/index";
import { allBoxes, solidsOf, type PlanBox } from "../../src/game/arenas/plan";
import { COVER, MOST, dressBox, dressPlan } from "../../src/game/dress";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** the size one placement is drawn at, whether it was stretched or scaled */
const sizeOf = (p: { scale?: number; scale3?: { x: number; y: number; z: number } }, model: { w: number; h: number; d: number }) =>
  p.scale3 ? { w: p.scale3.x, h: p.scale3.y, d: p.scale3.z } : { w: model.w * (p.scale ?? 1), h: model.h * (p.scale ?? 1), d: model.d * (p.scale ?? 1) };

/** the models' own sizes, the same numbers dress.ts holds */
const MODEL: Record<string, { w: number; h: number; d: number }> = {
  wooden_military_crate: { w: 1.1, h: 0.75, d: 0.75 },
  concrete_road_barrier: { w: 2.0, h: 0.85, d: 0.6 },
  steel_frame_shelves_01: { w: 1.0, h: 2.0, d: 0.5 },
  plastic_crate_03: { w: 0.6, h: 0.4, d: 0.4 },
  portable_generator: { w: 1.2, h: 0.9, d: 0.8 },
  Barrel_01: { w: 0.6, h: 0.9, d: 0.6 },
};

console.log("Dressing the arenas");
for (const plan of ARENA_PLANS) {
  const boxes = allBoxes(plan) as PlanBox[];
  const { props, instead } = dressPlan(boxes);
  const cover = boxes.filter((b) => ["crate", "cover", "container", "containerAlt"].includes(b.mat) && b.solid !== false).length;
  check(`${plan.id}: its cover wears something`, instead.size > 0 && props.length > 0, `${instead.size} of ${cover} boxes, ${props.length} props`);
  check(`${plan.id}: and not more than the budget`, props.length <= MOST + 8, `${props.length} against ${MOST}`);

  // nothing but cover is dressed: the shell, the floors and the stairs stay
  const wrong = [...instead].filter((i) => !["crate", "cover", "container", "containerAlt"].includes(boxes[i].mat));
  check(`${plan.id}: only cover is dressed, never a wall or a floor`, wrong.length === 0, wrong.map((i) => boxes[i].mat).join(", ") || "none");

  check(`${plan.id}: no prop brings a collider of its own`, props.every((p) => !p.solid));

  // every prop of a dressed box lies inside that box, and together they fill it
  let out = 0;
  let thin = 0;
  for (const i of instead) {
    const b = boxes[i];
    const put = dressBox(b, i);
    const y0 = b.y ?? 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let top = y0;
    for (const p of put) {
      const s = sizeOf(p, MODEL[p.prop]);
      // a quarter turn swaps the footprint
      const turned = Math.round(((p.rot ?? 0) % 360) / 90) % 2 !== 0;
      const w = turned ? s.d : s.w;
      const d = turned ? s.w : s.d;
      if (p.x - w / 2 < b.x - b.w / 2 - 0.02 || p.x + w / 2 > b.x + b.w / 2 + 0.02) out++;
      if (p.z - d / 2 < b.z - b.d / 2 - 0.02 || p.z + d / 2 > b.z + b.d / 2 + 0.02) out++;
      minX = Math.min(minX, p.x - w / 2);
      maxX = Math.max(maxX, p.x + w / 2);
      minZ = Math.min(minZ, p.z - d / 2);
      maxZ = Math.max(maxZ, p.z + d / 2);
      top = Math.max(top, (p.y ?? 0) + s.h);
    }
    if ((maxX - minX) / b.w < COVER || (maxZ - minZ) / b.d < COVER || (top - y0) / b.h < COVER) thin++;
  }
  check(`${plan.id}: no prop stands outside the box it stands in for`, out === 0, `${out} overhangs`);
  check(`${plan.id}: and every dressed box is filled, so the cover is the cover it replaced`, thin === 0, `${thin} of ${instead.size} left short of ${COVER * 100}%`);

  // the collision is the plan's, and dressing never touches it: the same
  // solids, to the metre, before and after the map has been dressed
  const before = JSON.stringify(solidsOf(plan));
  dressPlan(boxes);
  check(`${plan.id}: the map's collision is untouched by dressing it`, JSON.stringify(solidsOf(plan)) === before, `${solidsOf(plan).length} solids`);
}
{
  // a box nothing suits is left alone rather than dressed badly
  const odd: PlanBox = { x: 0, z: 0, w: 9, d: 0.3, h: 6, mat: "crate" };
  check("a box no prop suits keeps its own mesh", dressBox(odd, 0).length === 0, "9 by 0.3 by 6 m");
  const wall: PlanBox = { x: 0, z: 0, w: 4, d: 1, h: 1, mat: "wall" };
  check("and a wall is never dressed, whatever its shape", dressBox(wall, 0).length === 0);
  const ghost: PlanBox = { x: 0, z: 0, w: 2, d: 2, h: 1, mat: "crate", solid: false };
  check("nor is a box bullets already pass through", dressBox(ghost, 0).length === 0);
  const same = JSON.stringify(dressBox({ x: 3, z: 1, w: 2, d: 2, h: 1.2, mat: "crate" }, 7));
  const again = JSON.stringify(dressBox({ x: 3, z: 1, w: 2, d: 2, h: 1.2, mat: "crate" }, 7));
  check("the same box wears the same thing every time: cover that moved between matches would not be cover", same === again);
}

console.log(fails === 0 ? "\nDRESS PASS" : `\nDRESS FAIL (${fails})`);
export const dressFails = fails;
if (process.argv[1]?.endsWith("dress.ts")) process.exit(fails === 0 ? 0 : 1);
