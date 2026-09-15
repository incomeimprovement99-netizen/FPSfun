// The README as the public build ships it (on the range's README TV).
//
// PROJECT_RULES.md section 2: real weapon, hop-up and game names only while
// the project is private. The private build shows README.md as it is; the
// public build (vite.config.ts, mode beta) runs it through `publicText`,
// which swaps every real name for the codename the game itself shows, and
// `tools/beta-check.ts` then proves nothing slipped through.
//
// Node-side only (imported by vite.config.ts): nothing here is bundled.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** the public build's weapon names, by id (src/config/names.ts keeps the same table for the game) */
const CODENAMES: Record<string, string> = {
  rspn101: "Not R-301",
  vinson: "Not Flatline",
  hemlok: "Not Hemlok",
  energy_ar: "Not HAVOC",
  "3030": "Not 30-30",
  g2: "Not G7 Scout",
  dmr: "Not Longbow",
  doubletake: "Not Triple Take",
  sentinel: "Not Sentinel",
  sniper: "Not Kraber",
  defender: "Not Charge Rifle",
  r97: "Not R-99",
  volt_smg: "Not Volt",
  car: "Not C.A.R.",
  alternator_smg: "Not Alternator",
  pdw: "Not Prowler",
  lmg: "Not Spitfire",
  esaw: "Not Devotion",
  dragon_lmg: "Not Rampage",
  lstar: "Not L-STAR",
  shotgun: "Not EVA-8",
  mastiff: "Not Mastiff",
  energy_shotgun: "Not Peacekeeper",
  shotgun_pistol: "Not Mozambique",
  wingman: "Not Wingman",
  autopistol: "Not RE-45",
  semipistol: "Not P2020",
  g17: "Striker 9",
  nemesis: "Not Nemesis",
  bocek: "Not Bocek",
};

/**
 * The short forms prose uses ("the Kraber", "the R-301"), and the other
 * names that are the game's own. Longest first where one contains another.
 * A gun keeps its name behind "Not", as the public build's HUD shows it.
 */
const SHORT: [string, string][] = [
  ["Apex Legends'", "the game's"],
  ["Apex Legends", "the game"],
  ["the Apex", "the game's"],
  ["Apex's", "the game's"],
  ["Apex", "the game"],
  ["Kraber", "Not Kraber"],
  ["HAVOC", "Not HAVOC"],
  ["Havoc", "Not HAVOC"],
  ["Devotion", "Not Devotion"],
  ["Charge Rifle", "Not Charge Rifle"],
  ["L-STAR", "Not L-STAR"],
  ["30-30", "Not 30-30"],
  ["Peacekeeper", "Not Peacekeeper"],
  ["Mastiff", "Not Mastiff"],
  ["Nemesis", "Not Nemesis"],
  ["Bocek", "Not Bocek"],
  ["Hemlok", "Not Hemlok"],
  ["Prowler", "Not Prowler"],
  ["R-301", "Not R-301"],
  ["R-99", "Not R-99"],
  ["Flatline", "Not Flatline"],
  ["Spitfire", "Not Spitfire"],
  ["Rampage", "Not Rampage"],
  ["Longbow", "Not Longbow"],
  ["Triple Take", "Not Triple Take"],
  ["Sentinel", "Not Sentinel"],
  ["Wingman", "Not Wingman"],
  ["Mozambique", "Not Mozambique"],
  ["RE-45", "Not RE-45"],
  ["P2020", "Not P2020"],
  ["EVA-8", "Not EVA-8"],
  ["Alternator", "Not Alternator"],
  ["Volt", "Not Volt"],
  ["C.A.R.", "Not C.A.R."],
  ["G7 Scout", "Not G7 Scout"],
  ["Glock", "Striker"],
  ["Turbocharger", "spin-up kit"],
  ["turbocharger", "spin-up kit"],
  ["Skullpiercer", "head rounds"],
  ["Hammerpoint", "hollow points"],
  ["Disruptor", "shield rounds"],
  ["Selectfire", "mode switch"],
  ["Executioner", "knock recharge"],
  ["Shattercaps", "split rounds"],
  ["Redline", "hot bolts"],
  ["Phoenix kit", "Nova kit"],
  ["phoenix kit", "Nova kit"],
  ["Phoenix", "Nova"],
  ["phoenix", "Nova"],
  ["ARC STAR", "SPARK STAR"],
  ["Arc Star", "Spark Star"],
  ["arc star", "spark star"],
  ["Respawn Entertainment", "the studio"],
  ["Electronic Arts", "the publisher"],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Whole words only, as beta-check reads them ("climbGreenApex" is not the
 * name), and a space in a name matches a line break too: prose wraps, and
 * "the Charge\nRifle" is still the gun's name.
 */
const word = (s: string) => new RegExp(`(^|[^A-Za-z0-9_])${esc(s).replace(/ /g, "\\s+")}(?![A-Za-z0-9_])`, "g");

/** every real name the public text must not carry: the weapon data's names, then the short forms */
export function realNames(root: string): [string, string][] {
  const data = JSON.parse(readFileSync(resolve(root, "data", "weapons.json"), "utf8")) as { weapons: Record<string, { name: string }> };
  const full = Object.entries(data.weapons).map(([id, w]) => [w.name, CODENAMES[id] ?? id] as [string, string]);
  return [...full.sort((a, b) => b[0].length - a[0].length), ...SHORT];
}

/** a real name already behind "Not " is the public build's own name for the gun, and is left alone */
const behindNot = (text: string, at: number): boolean => /(^|[^A-Za-z0-9_])Not $/.test(text.slice(Math.max(0, at - 5), at));

/** the text with every real name swapped for the public build's; the result is checked, and a miss throws */
export function publicText(text: string, root: string): string {
  const names = realNames(root);
  let out = text;
  for (const [real, code] of names) {
    out = out.replace(word(real), (m: string, pre: string, offset: number, whole: string) => (behindNot(whole, offset + pre.length) ? m : pre + code));
  }
  // "the the game": a replacement after an article
  out = out.replace(/\bthe the game/g, "the game").replace(/\bThe the game/g, "The game");
  for (const [real] of names) {
    for (const m of out.matchAll(word(real))) {
      const at = (m.index ?? 0) + m[1].length;
      if (behindNot(out, at)) continue;
      throw new Error(`publicText: "${real}" is still in the text: ...${out.slice(Math.max(0, at - 30), at + 40)}`);
    }
  }
  return out;
}
