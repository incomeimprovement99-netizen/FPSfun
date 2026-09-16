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
  // Outskirts' field. The open ground between the places was 40 hand-placed
  // boxes called rocks, which from any distance read as 40 boxes. These are
  // scans, so one of them breaks a sightline the way a rock does and not the
  // way a crate does. They are decoration only: the collision box that
  // stands in for each is still registered in src/game/br.ts, because this
  // engine collides against axis-aligned boxes and nothing else.
  { slug: "namaqualand_boulder_04", note: "field cover, waist high" },
  { slug: "namaqualand_boulder_06", note: "field cover, chest high" },
  { slug: "namaqualand_boulders_01", note: "a cluster, for the bigger stops" },
  { slug: "namaqualand_rocks_01", note: "scatter, ankle high, no collision" },
  { slug: "rock_face_02", note: "against the ridge and the mesas" },
  // sand_rocks_small_01 was here and is not any more: its geometry alone is a
  // 21 MB .bin, which is more than the rest of the models put together and
  // four times the whole texture set. A scan that dense buys nothing at the
  // size a roadside rock is drawn. Anything added here should stay under
  // about 2 MB of .bin; check before you keep it.
  // dry scrub: something vertical in the field that is not a box or a rock
  { slug: "dead_quiver_trunk", note: "dead tree, a silhouette in the open" },
  { slug: "dead_quiver_branch_02", note: "scrub at the foot of the rocks" },
  { slug: "dry_branches_medium_01", note: "ground dressing near the places" },
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
