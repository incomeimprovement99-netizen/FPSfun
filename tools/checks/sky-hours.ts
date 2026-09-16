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
import { DEFAULT_HOUR, HOURS, HOUR_IDS, hourFor } from "../../src/game/sky";
import skyCfg from "../../src/config/sky.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe hours of the day");

const ids = Object.keys(HOURS);
check("seven hours, from morning to moonlight", ids.length === 7, ids.join(", "));

check(
  "the menu's order lists every hour and invents none",
  HOUR_IDS.length === ids.length && HOUR_IDS.every((id) => id in HOURS),
  `${HOUR_IDS.length} listed, ${ids.length} defined`
);

check("the default is one of them", DEFAULT_HOUR in HOURS, DEFAULT_HOUR);

// The afternoon is what the range shipped with before there were hours, so it
// has to still be exactly that: the same palette as src/game/sky.ts's SKY and
// the same sun as range.ts's SUN_DIR, or turning the setting on would change
// how the range has always looked.
const after = HOURS.afternoon;
check(
  "the afternoon is the range's old look, unchanged",
  after.colors.zenith === 0x3f7cc4 && after.colors.horizon === 0xc6d5e2 && after.colors.ground === 0xa89880 && after.colors.sun === 0xfff0d0,
  `zenith ${after.colors.zenith.toString(16)}, horizon ${after.colors.horizon.toString(16)}`
);
check(
  "and its sun points where SUN_DIR points",
  Math.abs(after.dir.x - 0.5602) < 0.0005 && Math.abs(after.dir.y - 0.6603) < 0.0005 && Math.abs(after.dir.z - 0.5002) < 0.0005,
  `(${after.dir.x.toFixed(3)}, ${after.dir.y.toFixed(3)}, ${after.dir.z.toFixed(3)})`
);
check("and it is 3.1, the strength the range was built at", Math.abs(after.intensity - 3.1) < 1e-6, String(after.intensity));
// The dome's sun DISK and the directional LIGHT are different colours and
// always were: fff0d0 in the sky, fff2dc on the world. Reading one for the
// other relights the whole range by a shade, which is exactly the kind of
// drift a feature like this causes if nobody checks.
check(
  "the light on the world is not the disk in the sky",
  after.light === 0xfff2dc && after.colors.sun === 0xfff0d0,
  `light ${after.light.toString(16)}, disk ${after.colors.sun.toString(16)}`
);

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
check("every colour parses to a real hex", !badColor, badColor || "all four bands, all seven hours");
check("every sun is normalised and above the horizon", !badDir, badDir || `${ids.length} suns`);
check("every fog ends after it starts", !badFog, badFog || "near < far everywhere");
check("every light is lit and no hour blows out the environment", !badLight, badLight || "intensity 0 to 6, env 0 to 2");

// Night is the reason the environment intensity is per hour: with the day's
// value the moonlit scene reads as an overcast afternoon.
check(
  "moonlight is the darkest hour and overcast has the most fill",
  HOURS.night.intensity === Math.min(...ids.map((i) => HOURS[i].intensity)) && HOURS.overcast.env === Math.max(...ids.map((i) => HOURS[i].env)),
  `night ${HOURS.night.intensity}, overcast env ${HOURS.overcast.env}`
);

// An unknown id has to land somewhere: a saved setting from an older build,
// or a hand-typed one, must not leave the scene with no sky at all.
check("an unknown hour falls back to the default", hourFor("nineteen-eighty-four").id === DEFAULT_HOUR && hourFor(null).id === DEFAULT_HOUR);

// Every hour names a sky file, and the fetch script has to actually fetch it.
const fetched = new Set(["sky.hdr", "sky-noon.hdr", "sky-morning.hdr", "sky-afternoon.hdr", "sky-dusk.hdr", "sky-overcast.hdr", "sky-night.hdr"]);
const missing = ids.filter((id) => !fetched.has(HOURS[id].hdr));
check("every hour's sky is one npm run assets downloads", missing.length === 0, missing.join(", ") || `${new Set(ids.map((i) => HOURS[i].hdr)).size} distinct files`);

check("the config carries its own notes", Boolean(skyCfg._note && skyCfg._hdr && skyCfg._colors && skyCfg._sun && skyCfg._fog));

console.log(fails === 0 ? "\nSKY HOURS PASS" : "\nSKY HOURS FAIL (" + fails + ")");
export const skyHoursFails = fails;
if (process.argv[1]?.endsWith("sky-hours.ts")) process.exit(fails === 0 ? 0 : 1);
