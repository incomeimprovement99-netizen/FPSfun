// The hours of the day (src/config/sky.json, src/game/sky.ts).
//
// A sky palette is art direction and cannot be checked against a published
// number, so what is checked here is that the data is whole and that nothing
// in it can put the scene somewhere it cannot come back from: a colour that
// does not parse, a sun with no direction, an hour the menu lists but the
// config does not hold, a fog that ends before it starts.
//
// Run on its own: npx tsx tools/checks/sky-hours.ts. Also runs inside
// npm run verify.
import { readFileSync } from "node:fs";
import { DEFAULT_HOUR, HOURS, HOUR_IDS, hourFor } from "../../src/game/sky";
import skyCfg from "../../src/config/sky.json";
import skCfg from "../../src/config/games/speedkills.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe hours of the day");

// SpeedKills' three hours (speedkills.json identity.skies), the legacy game's other six gone (Milestone 535)
const ids = Object.keys(HOURS);
const skies = skCfg.identity.skies ?? [];
check(
  "three hours, SpeedKills' own: every one it offers is here, and nothing else is",
  ids.length === 3 && skies.length === ids.length && skies.every((id) => id in HOURS) && HOUR_IDS.length === ids.length,
  `${ids.join(", ")}; offered: ${skies.join(", ")}`
);
check("and it starts at the golden hour (the owner's, 2026-10-04), the default", skCfg.identity.sky === "goldenHour" && DEFAULT_HOUR === "goldenHour", `${skCfg.identity.sky}, default ${DEFAULT_HOUR}`);

let badColor = "";
let badDir = "";
let badFog = "";
let badLight = "";
for (const [id, h] of Object.entries(HOURS)) {
  for (const [k, v] of Object.entries(h.colors)) {
    if (!Number.isInteger(v) || v < 0 || v > 0xffffff) badColor = `${id}.${k}`;
  }
  if (!Number.isInteger(h.light) || h.light < 0 || h.light > 0xffffff) badColor = `${id}.light`;
  if (Math.abs(h.dir.length() - 1) > 1e-4 || h.dir.y <= 0) badDir = id;
  if (!(h.fog[0] > 0 && h.fog[1] > h.fog[0])) badFog = id;
  if (!(h.intensity > 0 && h.intensity <= 6) || !(h.env > 0 && h.env <= 2)) badLight = id;
}
check("every colour parses to a real hex", !badColor, badColor || "all four bands, every hour");
check("every sun is normalised and above the horizon", !badDir, badDir || `${ids.length} suns`);
check("every fog ends after it starts", !badFog, badFog || "near < far everywhere");
check("every light is lit and no hour blows out the environment", !badLight, badLight || "intensity 0 to 6, env 0 to 2");
{
  // the neon night is the darkest, its lit things carrying the picture; and its sky fill and rim light, an hour's own
  // since Milestone 576: they were the day's at every hour, and the Neon City's fourth review called the night "a
  // purple-tinted day"
  const n = HOURS.neonNight;
  const g = HOURS.goldenHour;
  check("the neon night is the darkest hour", !!n && ids.every((id) => HOURS[id].intensity >= n.intensity), n ? `${n.intensity} / ${n.env}` : "none");
  check("the neon night's sky fill under half the golden hour's, its rim light under the day's too", !!n && !!g && n.fill <= g.fill / 2 && n.rim < g.rim, n && g ? `fill ${n.fill} of ${g.fill}, rim ${n.rim} of ${g.rim}` : "none");
}
{
  const bad = Object.entries(HOURS).filter(([, h]) => !(h.fill > 0 && h.fill <= 2) || !(h.rim >= 0 && h.rim <= 1)).map(([id]) => id);
  check("every hour's sky fill lit and under 2, its rim light 0 to 1", bad.length === 0, bad.join(", ") || "all lit");
}
// An unknown id has to land somewhere: a saved setting from an older build, or a hand-typed one (the legacy hours'
// ids among them), must not leave the scene with no sky at all
check("an unknown hour, or a legacy one, falls back to the default", hourFor("nineteen-eighty-four").id === DEFAULT_HOUR && hourFor(null).id === DEFAULT_HOUR && hourFor("afternoon").id === DEFAULT_HOUR);

// Every hour names a sky file, and the fetch script has to actually fetch it.
const fetchScript = readFileSync(new URL("../fetch-assets.ts", import.meta.url), "utf8");
const missing = ids.filter((id) => !fetchScript.includes(`file: "${HOURS[id].hdr}"`));
check("every hour's sky is one npm run assets downloads", missing.length === 0, missing.join(", ") || `${new Set(ids.map((i) => HOURS[i].hdr)).size} distinct files`);

check("the config carries its own notes", Boolean(skyCfg._note && skyCfg._hdr && skyCfg._colors && skyCfg._sun && skyCfg._fog));

console.log(fails === 0 ? "\nSKY HOURS PASS" : "\nSKY HOURS FAIL (" + fails + ")");
export const skyHoursFails = fails;
if (process.argv[1]?.endsWith("sky-hours.ts")) process.exit(fails === 0 ? 0 : 1);
