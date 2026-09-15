// Fetch CC0 glTF props from Poly Haven.
//
// Licence: Creative Commons CC0 1.0 Universal. Commercial use permitted,
// attribution NOT required, redistribution permitted. Credited anyway.
//
// Run: npm run models
//
// Gotcha that cost a retry: the per-asset `include` map must be followed
// literally. The .bin is served from the 4k folder no matter which resolution
// you ask for, so constructing URLs by string templating gives a 404.
import { mkdirSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { compressAssets } from "./compress-assets";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "public", "models");
const RES = "1k";

/** slug -> the folder we load it from in code */
const MODELS: Array<{ slug: string; note: string }> = [
  { slug: "wooden_military_crate", note: "stacked crates" },
  { slug: "Barrel_01", note: "drums" },
  { slug: "concrete_road_barrier", note: "lane barriers" },
  { slug: "plastic_crate_03", note: "small clutter" },
  { slug: "security_light", note: "floodlights on the walls" },
  { slug: "utility_box_01", note: "wall clutter" },
  { slug: "ammo_box", note: "beside the racks" },
  { slug: "steel_frame_shelves_01", note: "rack shelving" },
  { slug: "portable_generator", note: "yard clutter" },
  { slug: "modular_chainlink_fence", note: "perimeter" },
];

interface FileEntry {
  url: string;
  include?: Record<string, { url: string }>;
}

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const credits: string[] = [
    "",
    "## Models",
    "",
    "All from Poly Haven, **Creative Commons CC0 1.0 Universal**: commercial use",
    "permitted, attribution NOT required, redistribution permitted.",
    "",
    "| Folder | Source asset | Used for |",
    "|---|---|---|",
  ];

  for (const m of MODELS) {
    process.stdout.write(`  ${m.slug.padEnd(28)} `);
    try {
      const meta = JSON.parse(
        (await get(`https://api.polyhaven.com/files/${m.slug}`)).toString("utf8")
      ) as Record<string, Record<string, Record<string, FileEntry>>>;
      const entry = meta.gltf?.[RES]?.gltf;
      if (!entry) throw new Error(`no gltf at ${RES}`);
      const dir = join(OUT, m.slug);
      mkdirSync(dir, { recursive: true });
      // the .gltf itself
      writeFileSync(join(dir, `${m.slug}.gltf`), await get(entry.url));
      // everything it references, at the RELATIVE path it expects
      let n = 1;
      for (const [rel, f] of Object.entries(entry.include ?? {})) {
        const dest = join(dir, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, await get(f.url));
        n++;
      }
      console.log(`${n} files`);
      credits.push(`| \`${m.slug}/\` | Poly Haven ${m.slug} (CC0) | ${m.note} |`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      credits.push(`| \`${m.slug}/\` | Poly Haven ${m.slug} (CC0) | ${m.note} — DOWNLOAD FAILED |`);
    }
  }

  const att = resolve(HERE, "..", "public", "tex", "ATTRIBUTION.md");
  if (existsSync(att)) appendFileSync(att, credits.join("\n") + "\n");
  console.log(`\nappended model credits to ${att}`);
  // smaller downloads: the maps as WebP, the .gltf files pointed at them
  const r = await compressAssets();
  console.log(`textures to WebP: ${(r.before / 1048576).toFixed(1)} MB -> ${(r.after / 1048576).toFixed(1)} MB`);
}

void main();
