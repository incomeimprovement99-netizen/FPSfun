// Accessibility: colour vision and the HUD scale (src/game/palette.ts,
// src/config/hud.json accessibility).
//
// Run on its own: npx tsx tools/checks/access.ts. Also runs inside npm run verify.
import { HUD_SCALES, P, VISION_MODES, access, setHudScale, setVision } from "../../src/game/palette";

import { CAPTION_IDS, CAPTION_WORDS, Captions, howFar, whereFrom } from "../../src/game/captions";
let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nAccessibility");

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/**
 * How a colour looks to someone with deuteranopia, by the standard
 * Machado et al. (2009) simulation matrix at full severity, in linear-ish RGB
 * (good enough to tell whether two colours stay apart).
 */
const deutan = ([r, g, b]: [number, number, number]): [number, number, number] => [
  0.367 * r + 0.861 * g - 0.228 * b,
  0.28 * r + 0.673 * g + 0.047 * b,
  -0.012 * r + 0.043 * g + 0.969 * b,
];
const dist = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const normal = VISION_MODES.find((v) => v.id === "normal")!;
check(
  "normal colour vision is the colours the HUD always used",
  normal.enemy === "#ff4b3e" && normal.ally === "#7ddc8a" && normal.damage === "255,60,50" && normal.feedEnemy === "#ff8a7a" && normal.feedAlly === "#7ddc8a",
  `${normal.enemy} / ${normal.ally}`
);
check("four modes, every colour a real hex", VISION_MODES.length === 4 && VISION_MODES.every((v) => [v.enemy, v.ally, v.feedEnemy, v.feedAlly].every((h) => /^#[0-9a-f]{6}$/i.test(h))));

// the point of it: under a deuteranope's eyes the default pair collapses and
// the deuteranopia pair does not
const before = dist(deutan(rgb(normal.enemy)), deutan(rgb(normal.ally)));
const d = VISION_MODES.find((v) => v.id === "deuteranopia")!;
const after = dist(deutan(rgb(d.enemy)), deutan(rgb(d.ally)));
check("to a deuteranope the deuteranopia pair is further apart than the default pair", after > before * 1.5, `${before.toFixed(0)} -> ${after.toFixed(0)}`);

// switching is live and total
setVision("deuteranopia");
check("switching the mode swaps every meaning colour at once", P.enemy === d.enemy && P.ally === d.ally && P.damage === d.damage && P.feedEnemy === d.feedEnemy && access.vision === "deuteranopia");
setVision("nonsense" as never);
check("an unknown mode is normal colour vision, not no colours", P.enemy === normal.enemy && access.vision === "normal");

// the scale
check("the scales on offer include the default and stay sane", HUD_SCALES.includes(1) && HUD_SCALES.every((k) => k >= 0.5 && k <= 2), HUD_SCALES.join(", "));
setHudScale(1.25);
check("an offered scale is taken", access.hudScale === 1.25);
setHudScale(4);
check("a scale that is not on offer is the default, never a HUD off the screen", access.hudScale === 1);

// Captions for the sounds that matter (src/game/captions.ts). What has to
// hold: a sound behind you says behind and one to your left says left,
// whichever way you happen to be facing; the distance bands are words a
// player can act on; a run of footsteps is one line rather than eight; and the
// important list is the short one, the sounds that mean somebody is near you.
console.log("");
console.log("Sound captions");
{
  // facing -z, which is what yaw 0 means in this game
  check("a sound in front says ahead, and one behind says behind", whereFrom(0, -10, 0, -1) === "AHEAD" && whereFrom(0, 10, 0, -1) === "BEHIND");
  check("and the sides are the sides of the screen, not of the map", whereFrom(-10, 0, 0, -1) === "LEFT" && whereFrom(10, 0, 0, -1) === "RIGHT");
  check("turn round and the same sound swaps sides", whereFrom(10, 0, 0, 1) === "LEFT" && whereFrom(-10, 0, 0, 1) === "RIGHT");
  check("how far off it was, in words rather than metres", howFar(5) === "CLOSE" && howFar(25) === "NEAR" && howFar(120) === "FAR");
  const caps = new Captions();
  caps.mode = "important";
  caps.heard("step", 10, "LEFT", "CLOSE");
  caps.heard("step", 10.3, "LEFT", "CLOSE");
  caps.heard("step", 10.6, "LEFT", "CLOSE");
  check("a run of footsteps is one line that stays up, not one line a step", caps.live(10.7).length === 1, caps.live(10.7).length + " line(s)");
  caps.heard("door", 11, "RIGHT", "NEAR");
  check("a different sound is its own line", caps.live(11).length === 2);
  check("and the lines go when they are old", caps.live(30).length === 0);
  const quiet = new Captions();
  quiet.mode = "off";
  quiet.heard("gun", 1, "AHEAD", "FAR");
  check("off means off: nothing is written down at all", quiet.live(1).length === 0);
  const all = new Captions();
  all.mode = "all";
  all.heard("pickup", 1, "AHEAD", "CLOSE");
  const only = new Captions();
  only.mode = "important";
  only.heard("pickup", 1, "AHEAD", "CLOSE");
  check("the important list is the short one: a pickup is captioned only on everything", all.live(1).length === 1 && only.live(1).length === 0);
  check("every sound the game cues has a word for it", ["gun", "blast", "step", "land", "door", "bin", "reload", "knock"].every((id) => !!CAPTION_WORDS[id]), CAPTION_IDS.length + " sounds");
}


console.log(fails === 0 ? "\nACCESS PASS" : "\nACCESS FAIL (" + fails + ")");
export const accessFails = fails;
if (process.argv[1]?.endsWith("access.ts")) process.exit(fails === 0 ? 0 : 1);
