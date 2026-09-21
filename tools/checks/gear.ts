// The kit an operator wears (src/game/gear.ts, src/config/gear.json).
//
// The figures were a bare mannequin in one colour, and the owner asked for
// clothes, shades and gas masks. What is checked here is the part of that
// which is not taste: every operator wears something, no two of them wear the
// same set (an operator is a silhouette before it is a colour), every piece
// hangs from a bone the rig actually has, the pieces that come in pairs come
// in pairs on opposite sides, and nothing is the wrong size for a person: a
// helmet that is 40 cm across is a bucket, and a vest thinner than a
// centimetre is a sticker.
//
// How it looks is checked by eye, in the snapshots `gear-lineup` and
// `gear-close`.
//
// Run on its own: npx tsx tools/checks/gear.ts.
import { GEAR_IDS, buildGear, gearMaterials, wears, type GearBone } from "../../src/game/gear";
import outfitCfg from "../../src/config/outfits.json";
import { OPERATORS } from "../../src/game/operators";
import gearCfg from "../../src/config/gear.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** the bones the mannequin's rig has, read off it once (src/game/mannequin.ts) */
const RIG: readonly GearBone[] = ["Head", "spine_03", "pelvis", "upperarm_l", "upperarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r"];

console.log("The operators' kit");
{
  // What an operator has on comes from two places now: the kit here, and the
  // clothes in outfit.ts, which carry their own headgear (a hood, a motocross
  // helmet) and what is on the face. So both are counted: an operator in a
  // full-face helmet does not also need the kit's shades, and one whose
  // goggles are part of its outfit should not wear the kit's flat bar over
  // them.
  const dressed = (o: (typeof OPERATORS)[number]): string[] => [...(o.face ?? []), ...((((outfitCfg.sets as Record<string, { head?: string[] }>)[o.outfit] ?? {}).head ?? []) as string[])];
  const kits = OPERATORS.map((o) => ({ id: o.id, wears: GEAR_IDS.filter((g) => wears(o, g)), worn: dressed(o) }));
  for (const k of kits) check(`${k.id} is wearing something`, k.wears.length + k.worn.length >= 3, [...k.wears, ...k.worn].join(", ") || "nothing");
  const sets = kits.map((k) => k.wears.slice().sort().join("+"));
  check("no two operators wear the same kit: you can tell them apart by their outline", new Set(sets).size === sets.length, `${new Set(sets).size} of ${sets.length}`);
  const worn = new Set(kits.flatMap((k) => k.wears));
  check("and every piece that exists is worn by somebody", GEAR_IDS.every((g) => worn.has(g)), GEAR_IDS.filter((g) => !worn.has(g)).join(", ") || "all of them");
  const heads = kits.map((k) => k.wears.filter((g) => ["helmet", "hood", "brim", "mask", "shades"].includes(g)).length + k.worn.length);
  check("every one of them has something on its head, which is what reads first at range", heads.every((n) => n > 0), heads.join(", "));
}
{
  const built = OPERATORS.map((o) => ({ id: o.id, pieces: buildGear(o, gearMaterials(o)) }));
  check("every piece builds, and hangs from a bone the rig has", built.every((b) => b.pieces.every((p) => RIG.includes(p.bone))), built.flatMap((b) => b.pieces.map((p) => p.bone)).filter((b) => !RIG.includes(b)).join(", ") || "all of them");
  check("and carries geometry rather than being an empty group", built.every((b) => b.pieces.every((p) => p.group.children.length > 0)));
  for (const b of built) {
    const pairs = ["shoulders", "knees", "pouches"].filter((id) => wears(OPERATORS.find((o) => o.id === b.id)!, id as never));
    const ok = pairs.every((id) => {
      const both = b.pieces.filter((p) => p.id === id);
      return both.length === 2 && Math.sign(both[0].group.position.x || 1) !== Math.sign(both[1].group.position.x || -1);
    });
    if (pairs.length) check(`${b.id}: what comes in pairs is on both sides`, ok, pairs.join(", "));
  }
  const named = built.flatMap((b) => b.pieces).every((p) => p.group.name.startsWith("gear:"));
  check("every piece is named, so a snapshot and a check can find it", named);
  // a plate carrier is seven boxes and a helmet four: welded per material,
  // a lobby of twelve figures is not six hundred things to draw
  const meshes = built.flatMap((b) => b.pieces).map((p) => p.group.children.filter((c) => (c as { isMesh?: boolean }).isMesh).length);
  check("and is welded into one mesh per material rather than left as its boxes", Math.max(...meshes) <= 4, `${Math.max(...meshes)} at the most, ${meshes.reduce((a, b) => a + b, 0)} across all five operators`);
}
{
  // sizes: a person, not a cartoon. A head is about 22 cm across and a chest about 32.
  const c = gearCfg;
  check("the helmet fits a head rather than swallowing it", c.helmet.radius > 0.09 && c.helmet.radius < 0.14, `${(c.helmet.radius * 200).toFixed(0)} cm across`);
  check("the shades cover the eyes and no more", c.shades.size[0] > 0.14 && c.shades.size[0] < 0.24 && c.shades.size[1] < 0.07, `${(c.shades.size[0] * 100).toFixed(0)} cm wide`);
  check("the gas mask covers the nose and mouth, and its filter is off to one side", c.mask.snout[0] > 0.1 && c.mask.snout[0] < 0.2 && Math.abs(c.mask.filter.at[0]) > c.mask.snout[0] / 3, `${(c.mask.snout[0] * 100).toFixed(0)} cm wide`);
  check("the vest is a plate on a chest, front and back, with the body between them", c.vest.plate[0] > 0.2 && c.vest.plate[0] < 0.42 && c.vest.plate[2] > 0.02 && c.vest.gap > 0.05, JSON.stringify(c.vest.plate));
  check("the pack sits behind the body rather than inside it", c.pack.at[2] < -c.pack.size[2] / 4, `${(c.pack.at[2] * 100).toFixed(0)} cm back`);
  check("the hood stands off the head: it is bigger than a skull", c.hood.radius > c.helmet.radius, `${(c.hood.radius * 100).toFixed(1)} against ${(c.helmet.radius * 100).toFixed(1)} cm`);
  check("and nothing on the head is so far forward it is off the face", [c.shades.at[2], c.mask.at[2], c.brim.at[2]].every((z) => z < 0.14), [c.shades.at[2], c.mask.at[2], c.brim.at[2]].join(", "));
  check("every piece carries a note saying what it is", GEAR_IDS.every((id) => typeof (c as Record<string, { _note?: string }>)[id]._note === "string"));
}

console.log(fails === 0 ? "\nGEAR PASS" : `\nGEAR FAIL (${fails})`);
export const gearFails = fails;
if (process.argv[1]?.endsWith("gear.ts")) process.exit(fails === 0 ? 0 : 1);
