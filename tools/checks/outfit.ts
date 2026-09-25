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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { OUTFIT_IDS, buildOutfit, lookCode, outfitInfo, outfitMaterials, readLook, setOurGeometry, type OutfitId } from "../../src/game/outfit";
import { DEFAULT_LOADOUTS, valid } from "../../src/game/loadouts";
import { OPERATORS, operatorById } from "../../src/game/operators";
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

/**
 * An outfit is one of two kinds. A REAL one is an asset: a whole clothed
 * figure that replaces the body, or garment meshes rebound to this figure's
 * bones (outfits.json `character` / `parts`, public/models/outfits). A BUILT
 * one is shells on bones, made in code out of tubes and boxes. Most rules
 * here are the built ones': a real one has no garment list to read, because
 * its clothes are its mesh.
 */
const real = (id: OutfitId): boolean => ((outfitCfg.sets[id] as { parts?: string[] }).parts?.length ?? 0) > 0;
const BUILT = OUTFIT_IDS.filter((id) => !real(id));
// The fallback geometry is off in the game (outfit.ts OUR_GEOMETRY): what a
// player sees is published assets and nothing else. It is turned on HERE so
// the code that draws it is still checked, because it is what would dress a
// figure if a download ever failed.
setOurGeometry(true);

console.log("What an operator wears");
{
  check("there are outfits to wear", OUTFIT_IDS.length >= 4, OUTFIT_IDS.join(", "));
  // An outfit is one of two kinds. A REAL one is an asset: a whole clothed
  // figure, mesh and textures, which the game puts on in place of the body
  // (outfits.json `character`, public/models/outfits). A BUILT one is shells
  // on bones, made here out of tubes and boxes. The rules below are the built
  // ones' rules: a real one has no garment list to check, because its clothes
  // are its mesh, and what it looks like is the asset's business.
  check("and some of them are real assets rather than shells on bones", OUTFIT_IDS.length - BUILT.length >= 4, `${OUTFIT_IDS.length - BUILT.length} real, ${BUILT.length} built in code`);
  // the mixed ones are the point of a modular pack: parts from two sets make
  // an outfit neither of them shipped
  const mixed = OUTFIT_IDS.filter((id) => {
    const ps = ((outfitCfg.sets[id] as { parts?: string[] }).parts ?? []) as string[];
    return new Set(ps.map((n) => n.split("_")[1])).size > 1;
  });
  check("and some of the real ones are parts of two sets mixed", mixed.length >= 2, mixed.join(", "));
  for (const id of OUTFIT_IDS) {
    const ps = ((outfitCfg.sets[id] as { parts?: string[] }).parts ?? []) as string[];
    if (!ps.length) continue;
    check(`${id}: its parts cover a body, arms and legs`, ["Body", "Arms", "Legs"].every((k) => ps.some((n) => n.includes(k))), ps.join(" "));
    check(`${id}: and they are all the same build, so nothing is two sizes`, new Set(ps.map((n) => n.split("_")[0])).size === 1, ps.join(" "));
  }
  const names = OUTFIT_IDS.map((id) => outfitInfo(id).name);
  check("each has a name a person would use", names.every((n) => /^[A-Z() ]{4,16}$/.test(n)), names.join(" / "));
  check("and a line saying what it is", OUTFIT_IDS.every((id) => outfitInfo(id).blurb.length > 12));
  const sets = BUILT.map((id) => (outfitCfg.sets[id].wears as string[]).slice().sort().join("+"));
  const colours = BUILT.map((id) => outfitCfg.sets[id].cloth);
  check("no two outfits are the same clothes in the same colour", new Set(sets.map((s, i) => `${s}|${colours[i]}`)).size === sets.length);
  check("every outfit covers the legs and the body, which is what being dressed is", BUILT.every((id) => {
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
    // the set's own head pieces, plus the three a player can choose, minus any
    // the set already wears (a motocross set brings its own goggles)
    const own = ((outfitCfg.sets[id] as { head?: string[] }).head ?? []) as string[];
    const want = new Set([...own, "wrap", "goggles", "fullMask"]);
    const face = built.filter((b) => b.bone === "Head");
    check(`${id}: what goes on a face is aligned to the face`, face.length === want.size && face.every((f) => f.aligned), `${face.length} pieces of ${want.size}: ${face.map((f) => f.id).join(" ")}`);
    check(`${id}: and nothing is put on twice`, new Set(face.map((f) => f.id)).size === face.length, face.map((f) => f.id).join(" "));
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
  // built ones only: a real outfit's card describes the asset, and what the
  // asset is wearing is not a list this file can read
  for (const id of BUILT) {
    const set = outfitCfg.sets[id] as { blurb: string; wears: string[]; head?: string[] };
    const has = new Set([...set.wears, ...(set.head ?? [])]);
    for (const [says, needs] of PROMISE) {
      if (!says.test(set.blurb)) continue;
      check(`${id}: it says "${set.blurb}", so it wears ${needs.join(" and ")}`, needs.some((n) => has.has(n)), [...has].join(", "));
    }
  }
  // every outfit is published cloth now, so the variety to check is the
  // garments they are made of and the colours they are painted
  const shapes = OUTFIT_IDS.map((id) => ((outfitCfg.sets[id] as { parts?: string[] }).parts ?? []).slice().sort().join("+"));
  check("the wardrobe is not one set of garments over and over", new Set(shapes).size >= 4, `${new Set(shapes).size} different sets of parts across ${shapes.length} outfits`);
  // A silhouette is what a player reads first, well before a colour reaches
  // them. Two outfits in the same parts on the same body are the same person
  // in different paint at any range that matters, so the pair that a player
  // can tell apart is (body, parts) and every one of them is its own.
  const outlines = OUTFIT_IDS.map((id) => {
    const set = outfitCfg.sets[id] as { parts?: string[]; body?: string };
    return `${set.body ?? "Superhero_Male_FullBody"}|${(set.parts ?? []).slice().sort().join("+")}`;
  });
  check("no two outfits are the same outline", new Set(outlines).size === outlines.length, `${new Set(outlines).size} outlines across ${outlines.length} outfits`);
  // Every named file is on disk. A part that is not there is a figure with a
  // bare chest and nothing in the console but a 404.
  const missing: string[] = [];
  for (const id of OUTFIT_IDS) {
    const set = outfitCfg.sets[id] as { parts?: string[]; hair?: string[] };
    for (const n of set.parts ?? []) if (!existsSync(resolve(process.cwd(), `public/models/outfits/parts/${n}.gltf`))) missing.push(`${id}: ${n}`);
    for (const n of set.hair ?? []) if (!existsSync(resolve(process.cwd(), `public/models/body/hair/${n}.gltf`))) missing.push(`${id}: ${n}`);
  }
  check("every garment and hairstyle an outfit names is on disk", missing.length === 0, missing.join(", "));
  // Nobody is bald. Four hairstyles came down with the bodies and went unworn
  // for weeks, which is the kind of thing a count catches and an eye does not.
  const bald = OUTFIT_IDS.filter((id) => !((outfitCfg.sets[id] as { hair?: string[] }).hair ?? []).length);
  check("every outfit has hair on its head", bald.length === 0, bald.join(", "));
  const hairCols = OUTFIT_IDS.map((id) => (outfitCfg.sets[id] as { hairColor?: string }).hairColor);
  check("and a colour to paint it, because the pack ships it grey", hairCols.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)), `${hairCols.filter(Boolean).length} of ${hairCols.length}`);
  const tints = OUTFIT_IDS.map((id) => (outfitCfg.sets[id] as { tint?: string }).tint).filter(Boolean);
  check("and the ones that share garments do not share a colour", new Set(tints).size === tints.length, `${new Set(tints).size} colours over ${tints.length} tinted outfits`);
}

{
  // Nobody's eyes. The owner's rule, and a good one: a figure whose face you
  // can read is a figure out of a different game from the one it is standing
  // in. So every operator, and every loadout the game ships, has to be wearing
  // something that covers the eyes - goggles, a full mask, or a helmet - and a
  // head wrap on its own does not count, because a wrap leaves the eyes.
  console.log("\nEvery figure's eyes are covered");
  // The owner's rule was that every figure has its face covered, and it was a
  // good one. It is not met right now, and that is a deliberate trade rather
  // than a thing nobody noticed: the only eyewear we ever had was built out of
  // boxes, the owner asked for the published assets and nothing else, and no
  // published part in this pack covers a pair of eyes. What is checked instead
  // is that every operator wears published cloth; the eye rule comes back the
  // day a pack with eyewear does.
  for (const o of OPERATORS) {
    check(`${o.id}: wears published cloth`, real(o.outfit as OutfitId), o.outfit);
  }
  for (const d of DEFAULT_LOADOUTS) {
    const outfit = (d.outfit ?? operatorById(d.operator).outfit) as OutfitId;
    check(`the "${d.name}" loadout is dressed in published cloth`, !!d.outfit && !!d.build && real(outfit), `${outfit}, ${d.build ?? "no build"}`);
  }
  check("and one of them is the dirt bike", DEFAULT_LOADOUTS.some((d) => d.outfit === "motocross"), DEFAULT_LOADOUTS.map((d) => d.outfit).join(", "));
  // the lens itself: dark enough that there is nothing to read through it
  const mats = outfitMaterials("motocross", 0x0a0f14, 0xffa03c);
  const lum = mats.glass.color.r * 0.2126 + mats.glass.color.g * 0.7152 + mats.glass.color.b * 0.0722;
  check("the glass is dark, so an eye behind it is not a thing you can see", lum < 0.03 && mats.glass.emissiveIntensity <= 0.02, `luminance ${lum.toFixed(3)}, glow ${mats.glass.emissiveIntensity}`);
  // and it is backed: a lens with nothing behind it shows the face under a bright sky
  // the fallback's own head pieces, which are what a figure would wear if the
  // published parts never arrived
  const built = buildOutfit("fatigues", mats, ["goggles", "fullMask"]);
  const helmet = built.find((b) => b.id === "fullMask");
  const lenses = built.find((b) => b.id === "goggles");
  const black = (g: THREE.Object3D): boolean => {
    let found = false;
    g.traverse((c) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && !Array.isArray(m) && m.color && m.color.r + m.color.g + m.color.b < 0.12) found = true;
    });
    return found;
  };
  check("the goggles are backed, so no face reads through them", !!lenses && black(lenses.group));
  check("and the full mask is backed the same way", !!helmet && black(helmet.group));
}

{
  // The body is a pick of its own, carried as a fourth field on the look so a
  // page from before it existed reads the first three as it always did.
  const F = "Superhero_Female_FullBody";
  const code = lookCode({ outfit: "ranger", build: "heavy", face: "", body: F });
  const back = readLook(code);
  check("the body goes over the wire and comes back", back.body === F && back.outfit === "ranger" && back.build === "heavy", code);
  const old = readLook("ranger|heavy|");
  check("and a look from before the body existed still reads, with no body in it", old.outfit === "ranger" && old.body === undefined, JSON.stringify(old));
  check("a body we do not have is dropped rather than trusted", readLook("ranger|heavy||Nobody").body === undefined);
  // four outfits were the same clothes on the other body; a loadout that
  // stored one keeps the clothes and gets the body
  const moved = valid({ ...DEFAULT_LOADOUTS[0], outfit: "rangerF", body: undefined }, DEFAULT_LOADOUTS[0]);
  check("a loadout that wore RANGER (F) wears the ranger on the lighter body", moved.outfit === "ranger" && moved.body === F, `${moved.outfit} on ${moved.body}`);
  const kept = valid({ ...DEFAULT_LOADOUTS[0], outfit: "ranger", body: F }, DEFAULT_LOADOUTS[0]);
  check("and a body somebody picked is kept", kept.body === F, `${kept.body}`);
}

console.log(fails === 0 ? "\nOUTFIT PASS" : `\nOUTFIT FAIL (${fails})`);
export const outfitFails = fails;
if (process.argv[1]?.endsWith("outfit.ts")) process.exit(fails === 0 ? 0 : 1);
