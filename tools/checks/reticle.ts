// The crosshair's settings (src/game/reticle.ts, src/config/hud.json reticle).
//
// What matters here is that nobody sees a change they did not ask for, and
// that no stored value can leave the screen without a crosshair: the default
// has to be the old three prongs, and a bad saved setting has to land on
// something drawable.
//
// Run on its own: npx tsx tools/checks/reticle.ts. Also runs inside npm run verify.
import { RETICLE_COLORS, RETICLE_DEFAULT, RETICLE_STYLES, cleanReticle, reticleHex } from "../../src/game/reticle";
import hudCfg from "../../src/config/hud.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe crosshair");

const d = RETICLE_DEFAULT;
check(
  "the default is the crosshair the game always had: three prongs, white, a dot, moving with spread",
  d.style === "apex" && d.color === "white" && d.size === 1 && d.thickness === 2 && d.gap === 0 && d.dot && !d.outline && d.dynamic,
  JSON.stringify(d)
);
check("five styles, and the game's own is one of them", RETICLE_STYLES.length === 5 && RETICLE_STYLES.some((s) => s.id === "apex"), RETICLE_STYLES.map((s) => s.id).join(", "));
check("every colour is a real hex", RETICLE_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex)), RETICLE_COLORS.map((c) => c.hex).join(" "));
// the pairs a red-green colour blind player is told to use have to actually
// be far apart in brightness or hue, or the advice on the Settings tab is a lie
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const hexOf = (id: string) => RETICLE_COLORS.find((c) => c.id === id)?.hex ?? "#000000";
check(
  "green and magenta differ in brightness enough to tell apart without colour",
  Math.abs(lum(hexOf("green")) - lum(hexOf("magenta"))) > 0.25,
  `${lum(hexOf("green")).toFixed(2)} against ${lum(hexOf("magenta")).toFixed(2)}`
);
check("the config carries its own note", Boolean(hudCfg._reticle));

// what a stored value can do
check("nothing stored is the default", JSON.stringify(cleanReticle(null)) === JSON.stringify(d));
check("junk is the default, not a blank screen", JSON.stringify(cleanReticle("nonsense")) === JSON.stringify(d));
const wild = cleanReticle({ style: "starburst", color: "#123456", size: 99, thickness: -4, gap: 1e9, opacity: 0, dot: "yes" });
check(
  "an unknown style or colour keeps the default's, and every number is clamped into range",
  wild.style === "apex" && wild.color === "white" && wild.size === 3 && wild.thickness === 1 && wild.gap === 20 && wild.opacity === 0.2 && wild.dot === true,
  JSON.stringify(wild)
);
check("a NaN is ignored rather than drawn", cleanReticle({ size: Number.NaN }).size === 1);
const good = cleanReticle({ style: "cross", color: "green", size: 1.5, thickness: 3, gap: 4, dot: false, outline: true, dynamic: false, opacity: 0.8 });
check(
  "a sensible choice is kept exactly",
  good.style === "cross" && good.color === "green" && good.size === 1.5 && good.thickness === 3 && good.gap === 4 && !good.dot && good.outline && !good.dynamic && good.opacity === 0.8,
  JSON.stringify(good)
);
check("its colour resolves to its hex", reticleHex(good) === hexOf("green"));

console.log(fails === 0 ? "\nRETICLE PASS" : "\nRETICLE FAIL (" + fails + ")");
export const reticleFails = fails;
if (process.argv[1]?.endsWith("reticle.ts")) process.exit(fails === 0 ? 0 : 1);
