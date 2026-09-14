// Compare the two reference script trees on the numbers we actually use.
// The fork we started from is a MOD's script set; the canonical tree is the
// unmodified dump. Any difference means we extracted modded values.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const BASE = resolve(HERE, "..", "..", "apex-range-research");
const A = join(BASE, "scripts_r5_canonical", "weapons"); // canonical
const B = join(BASE, "r5_scripts", "weapons"); // the fork we used

const KEYS = [
  "damage_near_value",
  "damage_far_value",
  "damage_headshot_scale",
  "damage_leg_scale",
  "fire_rate",
  "ammo_clip_size",
  "reload_time",
  "zoom_time_in",
  "zoom_fov",
  "projectile_launch_speed",
  "spread_stand_hip",
  "viewkick_pattern",
  "burst_fire_count",
  "rechamber_time",
];

/** top-level value of a key, ignoring anything inside a Mods block */
function topLevel(text: string, key: string): string | null {
  let depth = 0;
  let inMods = false;
  let modsDepth = 0;
  for (const line of text.split("\n")) {
    const t = line.replace(/\/\/.*$/, "").trim();
    if (!t) continue;
    if (/^Mods$/i.test(t)) {
      inMods = true;
      modsDepth = depth;
    }
    for (const ch of t) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (inMods && depth <= modsDepth) inMods = false;
      }
    }
    if (inMods) continue;
    const m = t.match(/^"?([A-Za-z_0-9]+)"?\s+"([^"]*)"/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const files = readdirSync(A).filter((f) => /^mp_weapon_.*\.txt$/.test(f));
const rows: Array<[string, string, string, string]> = [];
let same = 0;
let checked = 0;

for (const f of files) {
  const pb = join(B, f);
  if (!existsSync(pb)) continue;
  const ta = readFileSync(join(A, f), "utf8");
  const tb = readFileSync(pb, "utf8");
  for (const k of KEYS) {
    const va = topLevel(ta, k);
    const vb = topLevel(tb, k);
    if (va === null && vb === null) continue;
    checked++;
    if (va === vb) same++;
    else rows.push([f.replace(/^mp_weapon_|\.txt$/g, ""), k, va ?? "-", vb ?? "-"]);
  }
}

console.log(`compared ${checked} top-level values across ${files.length} weapon files`);
console.log(`identical: ${same}    different: ${rows.length}\n`);
console.log("weapon".padEnd(18) + "key".padEnd(26) + "canonical".padEnd(14) + "fork (modded)");
for (const [w, k, a, b] of rows.sort()) {
  console.log(w.padEnd(18) + k.padEnd(26) + a.padEnd(14) + b);
}
