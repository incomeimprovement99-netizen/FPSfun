// The figures' clip files (public/models/mannequin, made by tools/fetch-clips.ts): each holds the clips its list names
// and no others, every clip in them is one the game plays, every clip the game asks for by name is in them, and no
// bone a clip holds still is keyed every frame (tools/trim-glb.ts).
//
// Why: nine clips nothing played rode in the files for a release after the old game's heals, knockdowns and revives
// went, and three quarters of every file was keys for bones that never move (Milestone 566). Both go unseen: a clip
// nobody plays costs only download, and the game asks for its optional clips through hasClip, so a needed one dropped
// from a file is quietly never played.
//
//   npx tsx tools/checks/clips.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FILES } from "../fetch-clips";
import { floatsOf, held, readGlb } from "../trim-glb";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe figures' clip files");
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const inFiles = new Map<string, string>();
const wrong: string[] = [];
const keyedStill: string[] = [];
for (const f of FILES) {
  const { json, bin } = readGlb(f.out);
  const names = (json.animations ?? []).map((a) => a.name ?? "");
  for (const n of names) inFiles.set(n, f.out);
  const want = [...f.clips].sort().join(" ");
  if (names.slice().sort().join(" ") !== want) wrong.push(`${f.out}: has ${names.length}, its list ${f.clips.length}`);
  for (const a of json.animations ?? [])
    for (const s of a.samplers) {
      const out = floatsOf(json, bin, s.output);
      const w = WIDTH[json.accessors![s.output].type ?? ""];
      if (out && w && out.length > 2 * w && held(out, w)) keyedStill.push(a.name ?? "");
    }
}
check("each clip file holds the clips its list names (tools/fetch-clips.ts) and no others", wrong.length === 0, wrong.join("; "));
check("no bone a clip holds still is keyed every frame: two keys each", keyedStill.length === 0, keyedStill.length ? `${keyedStill.length} channels, in ${[...new Set(keyedStill)].slice(0, 6).join(", ")}` : "");

// The game's source, comments out, so a clip only mentioned in passing does not count as played
const SRC = "src";
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : /\.(ts|json)$/.test(d.name) ? [join(dir, d.name)] : []));
const code = files(SRC)
  .map((p) => readFileSync(p, "utf8"))
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"])\/\/.*$/gm, "$1"))
  .join("\n");
const played = (n: string) => new RegExp(`"(?:(?:full|upper|lower):)?${n}"`).test(code);
const unplayed = [...inFiles.keys()].filter((n) => !played(n));
check("every clip in the files is one the game names (a clip nothing plays is only download)", unplayed.length === 0, unplayed.join(", "));

// What the soldier asks for by name: hasClip's optional clips, the layers' keys, the melee swings, the emotes
const mq = readFileSync(join(SRC, "game", "mannequin.ts"), "utf8");
const asked = new Set<string>();
for (const m of mq.matchAll(/hasClip\("(\w+)"\)|"(?:full|upper|lower):(\w+)"/g)) asked.add(m[1] ?? m[2]);
for (const m of mq.match(/MELEE_SWINGS = \[([^\]]*)\]/)?.[1].matchAll(/"(\w+)"/g) ?? []) asked.add(m[1]);
const emotes = JSON.parse(readFileSync(join(SRC, "config", "emotes.json"), "utf8")) as Record<string, unknown>;
JSON.stringify(emotes, (k, v) => (k === "clip" && typeof v === "string" ? (asked.add(v), v) : v));
const missing = [...asked].filter((n) => !inFiles.has(n));
check(`every clip the soldier asks for by name is in the files (${asked.size} of them)`, asked.size >= 10 && missing.length === 0, missing.join(", "));

console.log(fails === 0 ? "\nCLIPS PASS" : `\nCLIPS FAIL (${fails})`);
export const clipsFails = fails;
if (process.argv[1]?.endsWith("clips.ts")) process.exit(fails === 0 ? 0 : 1);
