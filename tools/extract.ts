// P0 extractor: reads the reference weapon KeyValues files (read-only, outside
// this repo) and writes data/weapons.json containing NUMBERS ONLY plus a
// short whitelist of descriptive strings. No script code, no asset paths.
//
// Usage: npm run extract            (reads ../apex-range-research/r5_scripts)
//        R5_SCRIPTS=<dir> npm run extract
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
// The CANONICAL unmodified script dump. We started from a community MOD's
// fork of this, which turned out to differ on 139 of 455 top-level values we
// read (R-301 13 vs 14 damage, Wingman 6 vs 4 rounds, Mastiff 11 vs 18, and
// so on). `npm run compare-sources` prints the full diff.
const SRC = resolve(
  process.env.R5_SCRIPTS ?? join(ROOT, "..", "apex-range-research", "scripts_r5_canonical")
);
const WEAPONS_DIR = join(SRC, "weapons");
const OUT_DIR = join(ROOT, "data");
const OUT = join(OUT_DIR, "weapons.json");

type KV = { [k: string]: string | KV };

// ---------- KeyValues parser (Valve-style, with #base) ----------
function tokenize(text: string): string[] {
  const toks: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (c === "{" || c === "}") {
      toks.push(c);
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j++;
      toks.push(text.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < n && !/[\s{}]/.test(text[j])) j++;
    toks.push(text.slice(i, j));
    i = j;
  }
  return toks;
}

function parseBlock(toks: string[], pos: { i: number }): KV {
  const obj: KV = {};
  while (pos.i < toks.length) {
    const t = toks[pos.i];
    if (t === "}") {
      pos.i++;
      return obj;
    }
    pos.i++;
    const next = toks[pos.i];
    if (next === "{") {
      pos.i++;
      const child = parseBlock(toks, pos);
      const prev = obj[t];
      obj[t] = typeof prev === "object" ? deepMerge(prev, child) : child;
    } else {
      obj[t] = next ?? "";
      pos.i++;
    }
  }
  return obj;
}

function deepMerge(base: KV, over: KV): KV {
  const out: KV = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}

const fileCache = new Map<string, KV>();
function loadFile(name: string): KV {
  const cached = fileCache.get(name);
  if (cached) return cached;
  const path = join(WEAPONS_DIR, name);
  if (!existsSync(path)) {
    console.warn(`  missing base ${name}`);
    return {};
  }
  const text = readFileSync(path, "utf8");
  const toks = tokenize(text);
  const bases: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === "#base") {
      bases.push(toks[++i]);
    } else body.push(toks[i]);
  }
  let merged: KV = {};
  for (const b of bases) merged = deepMerge(merged, loadFile(b));
  const own = parseBlock(body, { i: 0 });
  merged = deepMerge(merged, own);
  fileCache.set(name, merged);
  return merged;
}

// ---------- extraction ----------
const STRING_KEYS = new Set([
  "printname",
  "shortprintname",
  "fire_mode",
  "weapon_type_flags",
  "weaponSubClass",
  "menu_category",
  "ammo_pool_type",
  "viewkick_pattern",
  "viewkick_spring",
  "viewkick_spring_hot",
  "damage_type",
  "body_type",
]);

const isNum = (s: string) => /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s.trim());
const isOp = (s: string) => /^(\*|\+\+|--)[-+]?\d*\.?\d+$/.test(s.trim());

function flatNumbers(kv: KV, keepOps = false): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(kv)) {
    if (typeof v !== "string") continue;
    if (isNum(v)) out[k] = Number(v);
    else if (keepOps && isOp(v)) out[k] = v.trim();
    else if (STRING_KEYS.has(k)) out[k] = v;
  }
  return out;
}

function applyOp(base: number | undefined, op: number | string): number | undefined {
  if (typeof op === "number") return op;
  const s = op.trim();
  const num = Number(s.replace(/^(\*|\+\+|--)/, ""));
  if (s.startsWith("*")) return base === undefined ? undefined : base * num;
  if (s.startsWith("++")) return (base ?? 0) + num;
  if (s.startsWith("--")) return (base ?? 0) - num;
  return num;
}

// Display names (ours; ids are the file stems). Codename swap lives in src/config/names.ts.
const NAMES: Record<string, string> = {
  rspn101: "R-301 Carbine",
  r97: "R-99 SMG",
  volt_smg: "Volt SMG",
  vinson: "VK-47 Flatline",
  hemlok: "Hemlok Burst AR",
  wingman: "Wingman",
  shotgun: "EVA-8 Auto",
  mastiff: "Mastiff Shotgun",
  g2: "G7 Scout",
  lmg: "M600 Spitfire",
  energy_ar: "HAVOC Rifle",
  energy_shotgun: "Peacekeeper",
  car: "C.A.R. SMG",
  alternator_smg: "Alternator SMG",
  dmr: "Longbow DMR",
  sniper: "Kraber .50-Cal",
  defender: "Charge Rifle",
  doubletake: "Triple Take",
  sentinel: "Sentinel",
  pdw: "Prowler Burst PDW",
  esaw: "Devotion LMG",
  lstar: "L-STAR EMG",
  autopistol: "RE-45 Auto",
  semipistol: "P2020",
  shotgun_pistol: "Mozambique Shotgun",
  "3030": "30-30 Repeater",
  bow: "Bocek Compound Bow",
  dragon_lmg: "Rampage LMG",
  nemesis: "Nemesis Burst AR",
};

// Ammo classes name their mag mods differently: light/heavy use `bullets_`,
// energy `energy_`, sniper ammo `sniper_` (the Wingman), and `highcal_` for
// the high-calibre family. Assuming `bullets_` silently gave the Wingman
// 6/6/6/6 instead of its real 6/7/8/9.
// `shotgun_bolt` is the shotgun family's equivalent of a magazine (it scales
// fire rate rather than clip size). Leaving it out made the mag key a silent
// no-op on all four shotguns.
// Full mod-name prefixes, level number appended. `shotgun_bolt_l*` is the
// shotgun family's equivalent of a magazine (it scales fire rate rather than
// clip size) and does not follow the `*_mag_l*` shape; leaving it out made the
// mag key a silent no-op on all four shotguns.
const MAG_PREFIXES = ["bullets_mag_l", "energy_mag_l", "sniper_mag_l", "highcal_mag_l", "shotgun_bolt_l"];

/** which mag family this weapon's Mods block actually defines */
function magPrefixFor(mods: Record<string, Record<string, number | string>>): string | null {
  for (const p of MAG_PREFIXES) {
    if (Object.keys(mods).some((m) => m.startsWith(p))) return p;
  }
  return null;
}

type WeaponOut = {
  id: string;
  name: string;
  stats: Record<string, number | string>;
  mods: Record<string, Record<string, number | string>>;
  magMods: Array<string | null>;
  /** explicit clip size per mag level from the override table, or null */
  magClips: number[] | null;
};

type Override = Record<string, number | number[] | string>;
const OVERRIDES: Record<string, Override> = (() => {
  const p = join(OUT_DIR, "overrides.json");
  if (!existsSync(p)) return {};
  const j = JSON.parse(readFileSync(p, "utf8")) as { weapons?: Record<string, Override> };
  return j.weapons ?? {};
})();
let overridden = 0;

const weapons: Record<string, WeaponOut> = {};
const files = readdirSync(WEAPONS_DIR).filter((f) => /^mp_weapon_.*\.txt$/.test(f));
for (const f of files) {
  const id = basename(f, ".txt").replace(/^mp_weapon_/, "");
  const kv = loadFile(f);
  const wd = kv["WeaponData"];
  if (typeof wd !== "object") continue;
  // The canonical files split some values into MP_BASE / SP_BASE context
  // blocks, and the multiplayer one is what a player experiences. Reading
  // only the top level silently lost damage on the R-99, Spitfire, Prowler
  // and P2020, which then fell back to a hardcoded default.
  const mp = wd["MP_BASE"];
  const merged: KV = typeof mp === "object" ? deepMerge(wd, mp) : wd;
  const stats = flatNumbers(merged);
  const flags = String(stats["weapon_type_flags"] ?? "");
  if (!flags.includes("WPT_PRIMARY")) continue;
  if (!NAMES[id]) continue; // curated roster only; others are abilities/grenades/mod-pack guns
  const mods: WeaponOut["mods"] = {};
  const modsKv = merged["Mods"];
  if (typeof modsKv === "object") {
    for (const [m, body] of Object.entries(modsKv)) {
      if (typeof body !== "object") continue;
      const flat = flatNumbers(body, true);
      if (Object.keys(flat).length) mods[m] = flat;
    }
  }
  // Emit the mod NAME for each mag level rather than precomputed stats. A
  // precomputed table is a second source of truth: it was derived from the
  // bare weapon, so it overwrote every attachment that touched the same
  // field, and a purple stock's reload bonus vanished the moment it was read.
  // As a mod name it just joins the attachment chain and stacks correctly.
  const magPrefix = magPrefixFor(mods);
  const magMods: Array<string | null> = [null];
  for (let lvl = 1; lvl <= 4; lvl++) {
    const name = magPrefix ? `${magPrefix}${lvl}` : null;
    // No mod at this level: carry the previous level forward, never fall back
    // to the bare weapon. `_base_mags_sniper.txt` defines l3 twice and never
    // l4, which otherwise made the Sentinel's gold mag WORSE than its purple.
    magMods.push(name && mods[name] ? name : magMods[lvl - 1]);
  }
  // Current-season overrides. The dump is a coherent snapshot of an early
  // build and live balance has moved a long way: the Kraber's headshot
  // multiplier alone fell from 2.05 to 1.4, and three of the four shotguns
  // no longer have one at all.
  const ov = OVERRIDES[id];
  let magClips: number[] | null = null;
  let pellets = 1;
  if (ov) {
    for (const [k, v] of Object.entries(ov)) {
      if (k.startsWith("_")) continue;
      if (k === "magClips") {
        magClips = v as number[];
        continue;
      }
      if (k === "pellets") {
        pellets = v as number;
        continue;
      }
      stats[k] = v as number;
    }
    overridden++;
  }
  if (pellets > 1) stats.pellets = pellets;

  weapons[id] = { id, name: NAMES[id], stats, mods, magMods, magClips };
}

// viewkick patterns
function parsePatterns(): Record<string, { loopOffset: number; startMax: number; bullets: number[][] }> {
  const kv = loadFile("viewkick_patterns.txt");
  const root = kv["WeaponViewkickPatterns"];
  const out: Record<string, { loopOffset: number; startMax: number; bullets: number[][] }> = {};
  if (typeof root !== "object") return out;
  for (const [name, body] of Object.entries(root)) {
    if (typeof body !== "object") continue;
    const bullets: number[][] = [];
    for (let i = 0; ; i++) {
      const b = body[`bullet_${i}`];
      if (typeof b !== "string") break;
      bullets.push(b.trim().split(/\s+/).map(Number));
    }
    out[name] = {
      loopOffset: Number(body["loop_offset"] ?? 0),
      startMax: Number(body["start_max"] ?? -1),
      bullets,
    };
  }
  return out;
}

function parseSprings(): Record<string, Record<string, number>> {
  const kv = loadFile("springs.txt");
  const out: Record<string, Record<string, number>> = {};
  // root may be a single named block or several
  const visit = (obj: KV) => {
    for (const [name, body] of Object.entries(obj)) {
      if (typeof body !== "object") continue;
      const nums: Record<string, number> = {};
      let anyNum = false;
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string" && isNum(v)) {
          nums[k] = Number(v);
          anyNum = true;
        }
      }
      if (anyNum) out[name] = nums;
      else visit(body);
    }
  };
  visit(kv);
  return out;
}

const patterns = parsePatterns();
const springs = parseSprings();

// keep only patterns/springs referenced by the roster, plus their _hot twins
const usedPatterns: typeof patterns = {};
const usedSprings: typeof springs = {};
for (const w of Object.values(weapons)) {
  const collect = (src: Record<string, number | string>) => {
    const p = src["viewkick_pattern"];
    if (typeof p === "string" && patterns[p]) usedPatterns[p] = patterns[p];
    for (const key of ["viewkick_spring", "viewkick_spring_hot"]) {
      const s = src[key];
      if (typeof s === "string" && springs[s]) usedSprings[s] = springs[s];
    }
  };
  collect(w.stats);
  for (const m of Object.values(w.mods)) collect(m);
}

const out = {
  _meta: {
    generated: new Date().toISOString(),
    source: "reference weapon KeyValues (numbers only)",
    unitsNote: "Source engine units: 1 unit = 0.0254 m (1 inch). fire_rate is rounds per second. zoom_fov is the 4:3 horizontal FOV while ADS.",
    weaponCount: Object.keys(weapons).length,
  },
  weapons,
  patterns: usedPatterns,
  springs: usedSprings,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

// review table
const cols = ["damage_near_value", "fire_rate", "ammo_clip_size", "reload_time", "zoom_time_in", "zoom_fov", "projectile_launch_speed", "viewkick_pattern"];
console.log(`wrote ${OUT} (${Object.keys(weapons).length} weapons, ${overridden} with current-season overrides, ${Object.keys(usedPatterns).length} patterns, ${Object.keys(usedSprings).length} springs)`);
console.log(["id".padEnd(16), ...cols.map((c) => c.replace(/_value|_time_in|_launch_speed|viewkick_/g, "").slice(0, 12).padEnd(13))].join(""));
for (const w of Object.values(weapons)) {
  // review table only: apply each level's mod the same way the game will
  const mags = w.magMods
    .map((name) => {
      const base = typeof w.stats.ammo_clip_size === "number" ? w.stats.ammo_clip_size : undefined;
      if (!name) return base ?? "?";
      const v = w.mods[name]?.ammo_clip_size;
      const out = v === undefined ? base : applyOp(base, v);
      return out === undefined ? "?" : Math.floor(out);
    })
    .join("/");
  console.log(
    [w.id.padEnd(16), ...cols.map((c) => String(w.stats[c] ?? "-").slice(0, 12).padEnd(13))].join("") + ` mags ${mags}`
  );
}
