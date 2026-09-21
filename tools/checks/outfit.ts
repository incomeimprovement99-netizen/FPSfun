// What an operator wears (src/game/outfit.ts, src/config/outfits.json).
//
// The kit in gear.ts is what is strapped on top; this is the clothes under
// it, and it is what makes one figure a soldier and another a man in a
// t-shirt. Our figures were all the same bare body in a different colour.
//
// The thing that makes a garment cheap here is also the thing that can break
// it: a piece is a shell along ONE bone, sized from that bone's own measured
// length, so a sleeve that runs past the end of its bone hangs in the air off
// the elbow and a trouser leg that stops short leaves a band of bare leg. So
// what is checked is the fit: every piece stays inside its bone, is thicker
// than the body it covers and not by so much that it is a barrel, every
// outfit covers the body it is on, and no two outfits look the same.
//
// How it looks is checked by eye, in the snapshots `outfits` and
// `outfit-close`.
//
// Run on its own: npx tsx tools/checks/outfit.ts.
import { OUTFIT_IDS, buildOutfit, outfitInfo, outfitMaterials } from "../../src/game/outfit";
import { OPERATORS } from "../../src/game/operators";
import outfitCfg from "../../src/config/outfits.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** the bones' own lengths, measured off the rig (the same numbers outfit.ts holds) */
const BONE_LEN: Record<string, number> = { spine_01: 0.265, upperarm: 0.274, lowerarm: 0.273, thigh: 0.4, calf: 0.429 };
const BODY_R: Record<string, number> = {
  upperarm: outfitCfg.fit.arm,
  lowerarm: outfitCfg.fit.forearm,
  thigh: outfitCfg.fit.thigh,
  calf: outfitCfg.fit.calf,
};
const PIECES = outfitCfg.pieces as Record<string, { bone: string; from: number; to: number; over: number }>;

console.log("What an operator wears");
{
  check("there are outfits to wear", OUTFIT_IDS.length >= 4, OUTFIT_IDS.join(", "));
  const names = OUTFIT_IDS.map((id) => outfitInfo(id).name);
  check("each has a name a person would use", names.every((n) => /^[A-Z ]{4,16}$/.test(n)), names.join(" / "));
  check("and a line saying what it is", OUTFIT_IDS.every((id) => outfitInfo(id).blurb.length > 12));
  const sets = OUTFIT_IDS.map((id) => (outfitCfg.sets[id].wears as string[]).slice().sort().join("+"));
  const colours = OUTFIT_IDS.map((id) => outfitCfg.sets[id].cloth);
  check("no two outfits are the same clothes in the same colour", new Set(sets.map((s, i) => `${s}|${colours[i]}`)).size === sets.length);
  check("every outfit covers the legs and the body, which is what being dressed is", OUTFIT_IDS.every((id) => {
    const w = outfitCfg.sets[id].wears as string[];
    return w.some((p) => PIECES[p]?.bone === "spine_01") && w.some((p) => PIECES[p]?.bone === "thigh");
  }));
}
{
  // the fit: a piece lives on one bone and must stay on it
  for (const [name, p] of Object.entries(PIECES)) {
    const len = BONE_LEN[p.bone];
    // A limb's garment stays on its bone: a sleeve past the elbow hangs in the
    // air off it. The torso's does not, and cannot: the body runs from the
    // hips to the neck and the spine bone it hangs on is a third of that, so
    // its rule is that it covers the body rather than that it fits the bone.
    if (p.bone === "spine_01") {
      check(`${name}: it covers the body from the hips to the neck`, p.from <= -0.1 && p.to >= 1.3 && p.to <= 1.9, `${(p.from * (len ?? 0) * 100).toFixed(0)} to ${(p.to * (len ?? 0) * 100).toFixed(0)} cm, hips at -14 and the neck at 43`);
    } else {
      check(`${name}: it stays on the bone it hangs from`, !!len && p.to <= 1.1 && p.from >= -0.3 && p.to > p.from, `${(p.from * (len ?? 0) * 100).toFixed(0)} to ${(p.to * (len ?? 0) * 100).toFixed(0)} cm along a ${((len ?? 0) * 100).toFixed(0)} cm bone`);
    }
    const body = BODY_R[p.bone];
    if (body !== undefined) {
      check(`${name}: it is thicker than the limb inside it, and not by a barrel`, p.over > 0.005 && p.over < 0.08, `${(p.over * 1000).toFixed(0)} mm of cloth over a ${(body * 1000).toFixed(0)} mm limb`);
    }
  }
  check("a sleeve starts above the shoulder, so no bare arm shows between it and the body", PIECES.sleeveLong.from < 0 && PIECES.sleeveShort.from < 0, `${(PIECES.sleeveLong.from * BONE_LEN.upperarm * 100).toFixed(0)} cm over the joint`);
  check("a boot is on the bottom of the shin, not the middle of it", PIECES.boot.from > 0.5, `from ${(PIECES.boot.from * 100).toFixed(0)}% up the shin`);
  check("and shorts are shorter than trousers, which is the whole of the difference", PIECES.shorts.to < PIECES.trouserThigh.to, `${(PIECES.shorts.to * 100).toFixed(0)}% against ${(PIECES.trouserThigh.to * 100).toFixed(0)}%`);
}
{
  // what actually gets built
  const mats = outfitMaterials(OUTFIT_IDS[0], 0x101010, 0x39d7ee);
  for (const id of OUTFIT_IDS) {
    const built = buildOutfit(id, mats, ["wrap", "goggles", "fullMask"]);
    check(`${id}: every piece builds and carries geometry`, built.length > 0 && built.every((b) => b.group.children.length > 0), `${built.length} pieces`);
    const pairs = built.filter((b) => b.bone.endsWith("_l")).length;
    const rights = built.filter((b) => b.bone.endsWith("_r")).length;
    check(`${id}: what comes in pairs comes in pairs`, pairs === rights, `${pairs} left, ${rights} right`);
    // the three a player can choose, plus whatever the set puts there itself (a hood)
    const own = ((outfitCfg.sets[id] as { head?: string[] }).head ?? []).length;
    const face = built.filter((b) => b.bone === "Head");
    check(`${id}: what goes on a face is aligned to the face`, face.length === 3 + own && face.every((f) => f.aligned), `${face.length} pieces, ${own} of them the outfit's own`);
    const limbs = built.filter((b) => b.bone !== "Head");
    check(`${id}: and what goes on a limb turns with the limb`, limbs.every((l) => !l.aligned));
  }
}
{
  check("every operator is dressed", OPERATORS.every((o) => OUTFIT_IDS.includes(o.outfit)), OPERATORS.map((o) => `${o.id}: ${o.outfit}`).join(", "));
  const worn = new Set(OPERATORS.map((o) => o.outfit));
  check("and no two of them wear the same outfit", worn.size === OPERATORS.length, `${worn.size} of ${OPERATORS.length}`);
  const faces = OPERATORS.filter((o) => (o.face ?? []).length > 0).length;
  check("most of them have something on their face: a wrap, goggles, a mask", faces >= OPERATORS.length - 2, `${faces} of ${OPERATORS.length}`);
}

{
  // What the card says is what the figure wears. The picker shows a name and a
  // line of description, and a player reads that line before they see the
  // figure: "a hood up" with no hood on it, or "ragged strips" on a plain
  // jacket, is the outfit lying to them in their own language.
  const PROMISE: Array<[RegExp, string[]]> = [
    [/\bhood\b/i, ["hood"]],
    [/\brag(ged|s)\b/i, ["rags", "ragsLeg"]],
    [/\bstripes?\b/i, ["stripeArm", "stripeLeg"]],
    [/\bshorts\b/i, ["shorts"]],
    [/\bboots\b/i, ["boot"]],
    [/sleeves (down|long)|long sleeves/i, ["sleeveLong"]],
    [/sleeves rolled|t-shirt/i, ["sleeveShort", "shirt"]],
  ];
  for (const id of OUTFIT_IDS) {
    const set = outfitCfg.sets[id] as { blurb: string; wears: string[]; head?: string[] };
    const has = new Set([...set.wears, ...(set.head ?? [])]);
    for (const [says, needs] of PROMISE) {
      if (!says.test(set.blurb)) continue;
      check(`${id}: it says "${set.blurb}", so it wears ${needs.join(" and ")}`, needs.some((n) => has.has(n)), [...has].join(", "));
    }
  }
  const shapes = OUTFIT_IDS.map((id) => (outfitCfg.sets[id].wears as string[]).slice().sort().join("+"));
  check("and the wardrobe is not ten of the same shape in ten colours", new Set(shapes).size >= 4, `${new Set(shapes).size} different sets of garments across ${shapes.length} outfits`);
}

console.log(fails === 0 ? "\nOUTFIT PASS" : `\nOUTFIT FAIL (${fails})`);
export const outfitFails = fails;
if (process.argv[1]?.endsWith("outfit.ts")) process.exit(fails === 0 ? 0 : 1);
