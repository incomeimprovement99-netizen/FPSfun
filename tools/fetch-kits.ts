// The battle royale's world kit: modelled building detail and vegetation, from
// Quaternius's Downtown City MegaKit and Stylized Nature MegaKit, both CC0,
// free tiers (docs/AAA_GAP.md steps 1 to 3).
//
// The map's buildings already wear real CC0 textures; what made them read as
// boxes is that nothing on them is modelled: no cornice along a roofline, no
// column at a corner, no band at a floor line, no frame round a door, nothing
// on a roof. And the sand between the places had nothing on it at all. These
// are the pieces for that, and only those: a kit is 150 models and the game
// wants a few dozen.
//
//   npm run kits
//
// Written to public/models/kit/city and public/models/kit/nature, textures as
// 1k WebP, with an ATTRIBUTION.md.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { itchZip } from "./itch";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(ROOT, "public", "models", "kit");
const TMP = process.env.TEMP ?? "/tmp";

const KITS = [
  {
    slug: "downtown-city-megakit",
    upload: 17615373,
    dir: "Exports/glTF (Godot)",
    out: "city",
    pieces: [
      // along a roofline
      ..."Cornice_Brick_Center Cornice_Brick_90Angle_L Cornice_Metal_Center Cornice_Metal_90Angle_L Cornice_Trim_Center Cornice_Trim_90Angle_L".split(" "),
      // up a corner, and a band at a floor line
      ..."Brick_CornerColumn_Bottom Brick_CornerColumn_Center Brick_CornerColumn_CapShort Metal_Column_Bottom Metal_Column_Center Brick_Ornament_Horizontal".split(" "),
      // round a doorway, under a window
      ..."DoorFrame_Trim DoorFrame_Metal_Single Trim_Wall_Guard".split(" "),
      // on a roof, against a wall, on a street
      ..."Prop_ACUnit Prop_Bollard Prop_Drain Prop_ManholeCover Prop_Planter_Single".split(" "),
    ],
  },
  {
    slug: "stylized-nature-megakit",
    upload: 11055123,
    dir: "glTF",
    out: "nature",
    pieces: [
      // what suits a desert: dead trees, a dry bush, wispy grass and pebbles (the
      // green trees, pines and the kit's rocks are left: the field's rocks are
      // Poly Haven's scans, and nothing green grows on this sand)
      ..."DeadTree_1 DeadTree_2 DeadTree_3 Bush_Common Grass_Wispy_Short Grass_Wispy_Tall Pebble_Round_1".split(" "),
    ],
  },
];

/** a zip's entries by name, read with python (the same way fetch-characters does) */
function extract(zip: string, names: string[], into: string): void {
  const script = `import zipfile,os\nz=zipfile.ZipFile(r"${zip}")\nfor n in ${JSON.stringify(names)}:\n  data=z.read(n)\n  p=os.path.join(r"${into}", os.path.basename(n))\n  open(p,"wb").write(data)`;
  execFileSync("python", ["-c", script]);
}

function listZip(zip: string): string[] {
  return JSON.parse(execFileSync("python", ["-c", `import zipfile,json;print(json.dumps(zipfile.ZipFile(r"${zip}").namelist()))`], { encoding: "utf8", maxBuffer: 1 << 26 }));
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  let total = 0;
  for (const kit of KITS) {
    const zip = join(TMP, `${kit.slug}.zip`);
    if (!existsSync(zip)) itchZip(kit.slug, kit.upload);
    const all = listZip(zip);
    const dir = join(OUT, kit.out);
    mkdirSync(dir, { recursive: true });
    // each piece's .gltf and .bin, then every image any of them names
    const want = new Set<string>();
    for (const p of kit.pieces) for (const ext of [".gltf", ".bin"]) want.add(`${kit.dir}/${p}${ext}`);
    const missing = [...want].filter((n) => !all.includes(n));
    if (missing.length) throw new Error(`${kit.slug}: not in the zip: ${missing.join(", ")}`);
    extract(zip, [...want], dir);
    const images = new Set<string>();
    for (const p of kit.pieces) {
      const g = JSON.parse(readFileSync(join(dir, `${p}.gltf`), "utf8"));
      for (const im of g.images ?? []) if (im.uri) images.add(decodeURIComponent(im.uri));
    }
    extract(zip, [...images].map((i) => `${kit.dir}/${i}`), dir);
    // PNG to 1k WebP, and every .gltf pointed at it
    for (const im of images) {
      const png = join(dir, im);
      const webp = png.replace(/\.png$/i, ".webp");
      await sharp(png).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(webp);
      rmSync(png);
    }
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".gltf")) continue;
      const p = join(dir, f);
      writeFileSync(p, readFileSync(p, "utf8").replace(/"uri"\s*:\s*"([^"]+)\.png"/gi, (_m, a: string) => `"uri":"${a}.webp"`));
    }
    const bytes = readdirSync(dir).reduce((n, f) => n + readFileSync(join(dir, f)).length, 0);
    total += bytes;
    console.log(`  ${kit.out}: ${kit.pieces.length} pieces, ${images.size} textures, ${(bytes / 1e6).toFixed(1)} MB`);
  }
  writeFileSync(
    join(OUT, "ATTRIBUTION.md"),
    [
      "# World kit attribution",
      "",
      "Released as **Public Domain (CC0 1.0)** by **Quaternius**: commercial use permitted, attribution not required,",
      "redistribution permitted. Credited anyway.",
      "",
      "| Folder | Pack | Used for |",
      "|---|---|---|",
      "| `city/` | Downtown City MegaKit, quaternius.itch.io/downtown-city-megakit | cornices, corner columns, floor bands, door frames and wall guards on the battle royale's buildings; AC units, bollards, drains and planters |",
      "| `nature/` | Stylized Nature MegaKit, quaternius.itch.io/stylized-nature-megakit | trees, bushes, rocks, pebbles and grass across the map |",
      "",
      "Fetched by `npm run kits` (tools/fetch-kits.ts).",
      "",
    ].join("\n")
  );
  console.log(`\n${(total / 1e6).toFixed(1)} MB in public/models/kit`);
}

void main();
