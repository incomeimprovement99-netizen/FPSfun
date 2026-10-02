// The guns' sounds from the paid pack (src/config/packsounds.json, tools/import-pack-sounds.ts, src/game/audio.ts):
// every gun SpeedKills hands out has its pack gun's shots, a reload's sound is only ever a pack gun's own animation's,
// and a reload quicker than the pack's clip keeps each sound's pitch and lands it on the same share of the reload.
//
// That the files load and play in a page (a shot, a reload cut short by a swap, BOOG's bolt) was checked in a page
// once, 2026-10-02 (Milestone 410); the files are paid and absent from any other checkout, so no e2e can count on them.
//
// Run on its own: npx tsx tools/checks/packsounds.ts.
import { packPieces } from "../../src/game/audio";
import PACK from "../../src/config/packsounds.json";
import FP from "../../src/config/fparms.json";
import SK from "../../src/config/games/speedkills.json";
import AUDIO from "../../src/config/audio.json";
import { readFileSync } from "node:fs";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The pack's gun sounds");
{
  const guns = PACK.guns as Record<string, { pack: string; level: number }>;
  const packs = PACK.packs as Record<string, { fire: string[]; reloadTac?: string; reloadEmpty?: string; foley?: string }>;
  const roster = SK.roster as string[];
  const without = roster.filter((id) => !guns[id]);
  check("every gun SpeedKills hands out has a pack gun's shots", without.length === 0, without.join(", "));
  const unknown = Object.entries(guns).filter(([, g]) => !packs[g.pack]?.fire?.length);
  check("every pack gun named has shots to play", unknown.length === 0, unknown.map(([id]) => id).join(", "));
  check("every gun's level is a level, not a typo (0.5 to 2)", Object.values(guns).every((g) => g.level >= 0.5 && g.level <= 2));
  // a reload's sound is recorded to its pack gun's own animation: only a gun reloaded with it may have one
  const fp = FP.guns as Record<string, string>;
  const timed = Object.entries(fp).filter(([id, pack]) => guns[id]?.pack === pack);
  check("the guns reloaded with the pack's animation are the USSO and BOOG, each with its pack gun's sounds", timed.map(([id]) => id).sort().join() === "r97,sentinel", timed.map(([id]) => id).join());
  check("each of them has a tactical and an empty reload to play", timed.every(([, pack]) => !!packs[pack].reloadTac && !!packs[pack].reloadEmpty));
}
{
  // the USSO's tactical reload as measured off the pack: four sounds over 3 s, played to our 1.8 s
  const cuts = [0, 0.565, 1.535, 1.635];
  const p = packPieces(cuts, 3, 3, 1.8, PACK.overlap);
  check("a reload quicker than the clip keeps every piece", p.length === 4, `${p.length}`);
  check("each piece starts at the same share of the reload as of the clip", p.every((x, i) => Math.abs(x.at / 1.8 - cuts[i] / 3) < 1e-9 && x.offset === cuts[i]));
  check("a piece ends where the next starts, plus the overlap, not at its own end", Math.abs(p[1].len - ((1.535 - 0.565) * 0.6 + PACK.overlap)) < 1e-9 && p[1].len < 1.535 - 0.565);
  check("no piece runs past its own sound", p.every((x, i) => x.offset + x.len <= (i + 1 < cuts.length ? cuts[i + 1] : 3) + 1e-9));
  const slow = packPieces(cuts, 3, 3, 4.5, PACK.overlap);
  check("a reload slower than the clip plays each piece whole, spread out", slow.every((x, i) => Math.abs(x.len - ((i + 1 < cuts.length ? cuts[i + 1] : 3) - cuts[i])) < 1e-9) && Math.abs(slow[3].at - 1.635 * 1.5) < 1e-9);
  check("the overlap is a fade, not a second sound (under 0.1 s)", PACK.overlap > 0 && PACK.overlap < 0.1);
}

console.log("\nThe hacks' recorded sounds");
{
  // every hack has its recorded layers, but the two kept as they were (GRAPPLE the zipline's catch, INVISIBILITY a whoosh)
  const kept = ["grapple", "invis"];
  const layers = AUDIO.hacks as Record<string, Array<{ take: string; level: number; len: number; rate: number }>>;
  const ids = (SK.abilities.set as Array<{ id: string }>).map((h) => h.id);
  const without = ids.filter((id) => !layers[id] && !kept.includes(id));
  check("every hack has recorded layers, but the two kept as they were", without.length === 0, without.join(", "));
  check("no layers for a hack that is not one", Object.keys(layers).every((id) => ids.includes(id)));
  // each take one tools/fetch-sounds.ts fetches, and none of the pack's lasers (a laser's falling pitch is the squeak)
  const fetched = readFileSync(new URL("../fetch-sounds.ts", import.meta.url), "utf8");
  const takes = [...new Set(Object.values(layers).flat().map((l) => l.take))];
  const unknown = takes.filter((t) => !new RegExp(`\\b${t}: \\{ pack: "sci-fi-sounds"`).test(fetched));
  check("every take is one the sounds tool fetches from the sci-fi pack", unknown.length === 0, unknown.join(", "));
  const picks = takes.map((t) => new RegExp(`\\b${t}: \\{[^}]*files: \\[([^\\]]*)\\]`).exec(fetched)?.[1] ?? "").join(" ");
  check("no laser among them", !/laser/i.test(picks) && picks.length > 0, picks);
  check("each layer a short sound at a level in the mix (under 1.2 s, level 0.1 to 1, rate 0.5 to 2)", Object.values(layers).flat().every((l) => l.len > 0 && l.len <= 1.2 && l.level >= 0.1 && l.level <= 1 && l.rate >= 0.5 && l.rate <= 2));
}

console.log(fails === 0 ? "\nPACK SOUNDS PASS" : `\nPACK SOUNDS FAIL (${fails})`);
export const packSoundsFails = fails;
