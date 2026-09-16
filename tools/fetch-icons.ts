// Fetch the HUD's icon set as SVG.
//
// Two sources, two licences, both fine for a commercial build:
//
//   Lucide (lucide.dev) — ISC licence. Permissive, attribution not required.
//   Plain UI glyphs: menus, settings, the map legend, the boards.
//
//   game-icons.net — Creative Commons Attribution 3.0. Attribution IS
//   required, so every icon taken from there is listed with its author in
//   public/icons/ATTRIBUTION.md and the README credits the site. Used only
//   where Lucide has nothing: ammo, magazines, grenades, armour, a parachute.
//
// Why SVG and not a sprite sheet: the HUD is a canvas that is redrawn every
// frame at whatever the display scale is, so a vector that rasterises once
// per size beats a bitmap that blurs at 150%. The game loads each file as an
// Image and draws it; nothing here needs a runtime library.
//
// Run: npm run icons
// Downloaded files are gitignored; this script is the source of truth.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "icons");

/** pinned, so a re-fetch a year from now gives the same glyphs */
const LUCIDE = "1.46.0";

/** what the game calls it -> Lucide's file name */
const UI: Record<string, string> = {
  // the heads-up display
  health: "heart-pulse",
  shield: "shield",
  helmet: "hard-hat",
  syringe: "syringe",
  medkit: "briefcase-medical",
  battery: "battery-charging",
  backpack: "backpack",
  ping: "map-pin",
  map: "map",
  timer: "timer",
  eye: "eye",
  skull: "skull",
  crown: "crown",
  trophy: "trophy",
  // the battle royale's furniture
  door: "door-open",
  doorShut: "door-closed",
  bin: "package",
  beacon: "radio-tower",
  zipline: "cable",
  tower: "circle-arrow-up",
  hotzone: "flame",
  carePackage: "package-open",
  // menus and settings
  settings: "settings",
  pad: "gamepad-2",
  keyboard: "keyboard",
  volume: "volume-2",
  user: "user",
  squad: "users",
  sens: "mouse-pointer-2",
  screen: "monitor",
  // the range and the modes
  target: "target",
  crosshair: "crosshair",
  swords: "swords",
  course: "flag",
  stats: "chart-column",
  readme: "book-open",
};

/** what the game calls it -> game-icons.net author/name, and the author to credit */
const GAME: Record<string, { path: string; author: string }> = {
  ammo: { path: "lorc/bullets", author: "Lorc" },
  mag: { path: "delapouite/machine-gun-magazine", author: "Delapouite" },
  frag: { path: "lorc/grenade", author: "Lorc" },
  arcstar: { path: "lorc/lightning-arc", author: "Lorc" },
  thermite: { path: "lorc/spiky-explosion", author: "Lorc" },
  crate: { path: "delapouite/cargo-crate", author: "Delapouite" },
  armor: { path: "delapouite/armor-upgrade", author: "Delapouite" },
  parachute: { path: "lorc/parachute", author: "Lorc" },
  ladder: { path: "delapouite/ladder", author: "Delapouite" },
};

async function get(url: string): Promise<string> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/**
 * game-icons.net serves its icons already coloured, with a black background
 * plate behind the white glyph. The HUD tints icons itself, so the plate is
 * dropped and every fill is made currentColor.
 */
function strip(svg: string): string {
  const out = svg
    // the background plate: the first path is the full 512 square, and it
    // carries no fill attribute at all, so it paints black by default
    .replace(/<path d="M0 0h512v512H0z"[^>]*\/>/g, "")
    // the glyph itself is served as #fff, which would ignore the HUD's tint
    .replace(/fill="#fff"/g, 'fill="currentColor"')
    .replace(/fill="#ffffff"/g, 'fill="currentColor"')
    .replace(/<title>[\s\S]*?<\/title>/g, "");
  if (out.includes("512v512")) throw new Error("background plate not removed: game-icons changed its markup");
  if (!out.includes("currentColor")) throw new Error("glyph fill not found: game-icons changed its markup");
  return out;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const index: Record<string, string> = {};
  const credits: string[] = [
    "# Icon attribution",
    "",
    "## Lucide (ISC licence)",
    "",
    "Plain UI glyphs from [Lucide](https://lucide.dev) " + LUCIDE + ", ISC licence:",
    "commercial use, modification and redistribution permitted, attribution not",
    "required. Credited anyway.",
    "",
    "## game-icons.net (CC BY 3.0 — attribution REQUIRED)",
    "",
    "The gameplay glyphs Lucide has no equivalent for come from",
    "[game-icons.net](https://game-icons.net) under **Creative Commons",
    "Attribution 3.0**. Attribution is a condition of the licence, so it is",
    "given here, in the README's credits, and in the game's own README screen.",
    "",
    "| File | Icon | Author |",
    "|---|---|---|",
  ];
  let ok = 0;
  const missing: string[] = [];

  for (const [name, file] of Object.entries(UI)) {
    try {
      const svg = await get(`https://unpkg.com/lucide-static@${LUCIDE}/icons/${file}.svg`);
      writeFileSync(join(OUT, `${name}.svg`), svg);
      index[name] = `${name}.svg`;
      ok++;
    } catch {
      missing.push(`lucide ${file}`);
    }
  }
  for (const [name, g] of Object.entries(GAME)) {
    try {
      const svg = await get(`https://game-icons.net/icons/ffffff/000000/1x1/${g.path}.svg`);
      writeFileSync(join(OUT, `${name}.svg`), strip(svg));
      index[name] = `${name}.svg`;
      credits.push(`| \`${name}.svg\` | ${g.path.split("/")[1]} | ${g.author}, game-icons.net (CC BY 3.0) |`);
      ok++;
    } catch {
      missing.push(`game-icons ${g.path}`);
    }
  }

  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  credits.push("", "Re-fetch with `npm run icons` (tools/fetch-icons.ts); the files are gitignored.", "");
  writeFileSync(join(OUT, "ATTRIBUTION.md"), credits.join("\n"));
  console.log(`\n${ok} icons in ${OUT}`);
  if (missing.length) {
    console.log(`missing (${missing.length}): ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

void main();
