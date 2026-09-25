// Emotes (src/game/emotes.ts, src/config/emotes.json).
//
// The poses are one description read by two rigs, so the description has to
// behave: nothing before an emote starts or after it ends, fully in between,
// eased at both ends so a figure never snaps, no angle past a half turn (a
// rig would fold the wrong way), and each emote something different.
//
// Run on its own: npx tsx tools/checks/emotes.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import cfg from "../../src/config/emotes.json";
import { EMOTES, emoteAt, emotePose, type EmotePose } from "../../src/game/emotes";
import { BANNERS, bannerCode, bannerOf } from "../../src/game/banners";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const angles = (p: EmotePose) => Object.entries(p).filter(([k]) => k !== "weight" && k !== "bounce" && k !== "clip").map(([, v]) => v as number);

console.log("The emotes");
{
  check(`at least six, each named and timed (${EMOTES.map((e) => e.name).join(", ")})`, EMOTES.length >= 6 && EMOTES.every((e) => e.name && e.seconds >= 1.5 && e.seconds <= 6));
  // An emote made of a recorded clip is played whole by the figure; its pose
  // here is only what shows until the clip has loaded, and may be nothing.
  // What has to be true of it is that the clip is one the game fetches.
  const fetched = readFileSync(resolve(process.cwd(), "tools/fetch-clips.ts"), "utf8");
  const clipped = EMOTES.filter((e) => e.clip);
  const words = new Set(fetched.split(/[^A-Za-z0-9_]+/));
  check("every emote made of a clip names one tools/fetch-clips.ts puts in the game", clipped.every((e) => words.has(e.clip!)), clipped.map((e) => `${e.name}: ${e.clip}`).join(", "));
  check("an index off the list is no emote", emoteAt(-1) === null && emoteAt(EMOTES.length) === null && emoteAt(null) === null);
  let bad = 0;
  let snaps = 0;
  let still = 0;
  for (let i = 0; i < EMOTES.length; i++) {
    const def = EMOTES[i];
    const start = emotePose(i, 0);
    const end = emotePose(i, def.seconds);
    if (start.weight !== 0 || angles(start).some((a) => a !== 0) || end.weight !== 0 || angles(end).some((a) => a !== 0)) bad++;
    // the whole of it at a small step: no angle past a half turn, and no jump between two frames
    let prev = emotePose(i, 0);
    let moved = 0;
    for (let t = 1 / 60; t < def.seconds; t += 1 / 60) {
      const p = emotePose(i, t);
      if (angles(p).some((a) => !Number.isFinite(a) || Math.abs(a) > Math.PI)) bad++;
      const a = angles(p);
      const b = angles(prev);
      if (a.some((v, k) => Math.abs(v - b[k]) > 0.25)) snaps++;
      moved = Math.max(moved, ...a.map(Math.abs));
      prev = p;
    }
    if (moved < 0.3 && !def.clip) still++;
    const mid = emotePose(i, def.seconds / 2);
    if (Math.abs(mid.weight - 1) > 1e-9) bad++;
  }
  check("nothing before one starts or once it is over, all of it in the middle", bad === 0, `${bad} wrong`);
  check(`eased in over ${cfg.blendIn} s and out over ${cfg.blendOut} s: no jump between two frames at 60 fps`, snaps === 0, `${snaps} jumps`);
  check("every one moves the body (none is a figure standing still)", still === 0, `${still} barely move`);
  // different from each other at their fullest
  const sig = EMOTES.map((e, i) => e.clip ?? angles(emotePose(i, e.seconds / 2)).map((v) => v.toFixed(1)).join(","));
  check("and no two the same", new Set(sig).size === EMOTES.length);
}

console.log("\nBanner cards");
{
  let round = true;
  for (let icon = 0; icon < 8; icon++)
    for (let frame = 0; frame < BANNERS.frames.length; frame++)
      for (let title = 0; title < BANNERS.titles.length; title++) {
        const card = bannerOf(bannerCode(icon, frame, title));
        if (!card || card.frame !== BANNERS.frames[frame] || card.title !== BANNERS.titles[title]) round = false;
      }
  check("every pick of icon, frame and title comes back off the wire as itself", round);
  check("and anything else off the wire is no card", bannerOf(-1) === null && bannerOf(512) === null && bannerOf(3.5) === null && bannerOf("7") === null);
}

console.log(fails === 0 ? "\nEMOTES PASS" : `\nEMOTES FAIL (${fails})`);
export const emotesFails = fails;
if (process.argv[1]?.endsWith("emotes.ts")) process.exit(fails === 0 ? 0 : 1);
