// Fetch CC0 materials for the range. Everything here is Creative Commons
// CC0 1.0 Universal (public domain dedication): commercial use allowed,
// no attribution required, redistribution allowed. We credit anyway in
// public/tex/ATTRIBUTION.md because it costs nothing.
//
// Run: npm run assets
// Downloaded files are gitignored; this script is the source of truth.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { compressAssets } from "./compress-assets";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "public", "tex");

/** ambientCG asset id -> the folder name we use in code */
// Chosen to be LIGHT and rust-free. The first set (DiamondPlate008B,
// PaintedMetal014, MetalPlates006) was dark and heavily rusted, which read as
// near-black slabs and orange walls; a colour tint multiplies the map, so it
// can only darken a texture, never rescue a dark one.
const MATERIALS: Array<{ id: string; as: string; note: string }> = [
  { id: "Concrete048", as: "concrete", note: "range floor, clean light concrete" },
  { id: "Metal049A", as: "wall", note: "bay walls and dividers, clean silver metal" },
  { id: "Metal050A", as: "catwalk", note: "platforms and stairs, brushed aluminium" },
  { id: "Metal041A", as: "panel", note: "cover, posts and target frames, clean iron" },
  { id: "Asphalt031", as: "ground", note: "outside the pad, light asphalt" },
  // The battle royale's own set. Every place on Outskirts used to be the same
  // grey concrete and the same painted steel, so from 200 m one yard of boxes
  // looked like the next and there was no reason to choose where to land.
  // These give each place a surface of its own. They are fetched but not
  // preloaded: src/game/materials.ts loads a set the first time something
  // asks for it, so a set nothing uses costs nothing to ship.
  { id: "Ground037", as: "sand", note: "Outskirts' floor, dry packed sand" },
  { id: "Rock030", as: "rock", note: "the ridge, the mesas and the boulders" },
  { id: "Gravel023", as: "gravel", note: "yards and the roadside" },
  { id: "CorrugatedSteel005", as: "corrugated", note: "North Yard's sheds and warehouse" },
  { id: "Rust004", as: "rust", note: "South Depot: industrial, weathered" },
  { id: "PaintedPlaster017", as: "plaster", note: "West Town's houses" },
  { id: "Bricks066", as: "brick", note: "the Hub's compound walls" },
  { id: "RoofingTiles003", as: "roof", note: "roofs that read as roofs from above" },
  { id: "WoodFloor051", as: "planks", note: "interior floors and crate stacks" },
  { id: "Metal046B", as: "steel", note: "containers, masts and zipline posts" },
  // SpeedKills' city (docs/PHASE_18_PLAN_SPEEDKILLS.md 7.9): dark and neo-
  // futuristic, as the owner asked. Six facades photographed at night, their
  // windows lit, each with an emission map so the windows glow for real; dark
  // glass for the core; brick for the old town; dark asphalt and pavement;
  // black metal for trim; a dark concrete for floors and interiors.
  { id: "Facade002", as: "skNight1", note: "SpeedKills: a night tower, lit windows" },
  { id: "Facade007", as: "skNight2", note: "SpeedKills: a night tower, lit windows" },
  { id: "Facade009", as: "skNight3", note: "SpeedKills: a night tower, lit windows" },
  { id: "Facade011", as: "skNight4", note: "SpeedKills: a night tower, lit windows" },
  { id: "Facade014", as: "skNight5", note: "SpeedKills: a dark grid tower, a few windows lit" },
  { id: "Facade017", as: "skNight6", note: "SpeedKills: a night block, warm lit windows" },
  { id: "Facade001", as: "skGlass", note: "SpeedKills: dark curtain glass" },
  { id: "Facade020A", as: "skBrick", note: "SpeedKills: the old town's brick" },
  { id: "Road012A", as: "skStreet", note: "SpeedKills: the streets, dark asphalt" },
  { id: "Asphalt026C", as: "skPave", note: "SpeedKills: pavements and plazas" },
  { id: "Metal029", as: "skMetal", note: "SpeedKills: black metal trim, walkways and rails" },
  { id: "Concrete033", as: "skConcrete", note: "SpeedKills: floors, interiors and roofs" },
];

/** the only maps we ship; the rest of each pack is discarded */
// Emission only where a pack has it (the night facades' lit windows)
const KEEP = ["Color", "Roughness", "NormalGL", "Emission"] as const;

/**
 * A sky HDRI, also CC0 (Poly Haven). This is not decoration: metalness
 * materials reflect their environment, and with nothing to reflect every
 * metal surface in the range rendered pure black. It also provides the
 * ambient light that makes shadowed faces readable.
 */
const HDRI = {
  id: "kloofendal_48d_partly_cloudy_puresky",
  url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
  file: "sky.hdr",
};

/**
 * The other skies. One sky meant every match looked the same hour of the same
 * day, which is the single cheapest thing a shooter can vary: the light does
 * more for how a map reads than any amount of geometry. A match picks one by
 * seed, so a squad sees the same sky as each other and a different one next
 * game. They are extra files, not replacements, and the game falls back to
 * sky.hdr when one is missing, so a checkout that skipped them still runs.
 *
 * All Poly Haven, all CC0, all the 1k HDR so the whole set is a few megabytes.
 */
const SKIES: Array<{ id: string; file: string; note: string }> = [
  { id: "kloofendal_43d_clear_puresky", file: "sky-noon.hdr", note: "hard noon, short shadows" },
  { id: "qwantani_mid_morning_puresky", file: "sky-morning.hdr", note: "mid morning, long soft shadows" },
  { id: "qwantani_late_afternoon_puresky", file: "sky-afternoon.hdr", note: "low warm sun" },
  { id: "qwantani_dusk_1_puresky", file: "sky-dusk.hdr", note: "dusk, the lamps start to matter" },
  { id: "kloofendal_overcast_puresky", file: "sky-overcast.hdr", note: "flat grey, no shadows to read" },
  { id: "qwantani_moon_noon_puresky", file: "sky-night.hdr", note: "moonlight, for the night variant" },
];
const skyUrl = (id: string) => `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${id}_1k.hdr`;

/**
 * Minimal ZIP reader: walks the central directory and inflates the entries we
 * want. Avoids depending on an external unzip binary, which differs between
 * Windows, macOS and CI.
 */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  // end-of-central-directory record, scanning back from the tail
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip (no end-of-central-directory)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory entry");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    // local header: name and extra lengths differ from the central copy
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    // anything else (bzip2, lzma) is not used by these packs; skip it
  }
  return out;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const lines: string[] = [
    "# Texture attribution",
    "",
    "All materials below are from ambientCG and released under the",
    "**Creative Commons CC0 1.0 Universal** public domain dedication:",
    "commercial use permitted, attribution NOT required, redistribution permitted.",
    "We credit anyway.",
    "",
    "Re-fetch with `npm run assets`. The image files are gitignored;",
    "`tools/fetch-assets.ts` is the source of truth for what is used.",
    "",
    "| Folder | Source asset | Used for |",
    "|---|---|---|",
  ];

  for (const m of MATERIALS) {
    const dir = join(OUT, m.as);
    process.stdout.write(`  ${m.id} -> ${m.as} ... `);
    try {
      const zip = await download(`https://ambientcg.com/get?file=${m.id}_1K-JPG.zip`);
      const entries = unzip(zip);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      let kept = 0;
      for (const [name, data] of entries) {
        const hit = KEEP.find((k) => name.endsWith(`_${k}.jpg`));
        if (!hit) continue;
        writeFileSync(join(dir, `${hit.toLowerCase()}.jpg`), data);
        kept++;
      }
      if (kept < 2) throw new Error(`only ${kept} maps kept`);
      console.log(`${kept} maps`);
      lines.push(`| \`${m.as}/\` | ambientCG ${m.id} (CC0) | ${m.note} |`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      lines.push(`| \`${m.as}/\` | ambientCG ${m.id} (CC0) | ${m.note} — DOWNLOAD FAILED |`);
    }
  }

  // sky
  process.stdout.write(`  ${HDRI.id} -> ${HDRI.file} ... `);
  try {
    const hdr = await download(HDRI.url);
    writeFileSync(join(OUT, HDRI.file), hdr);
    console.log(`${(hdr.length / 1024).toFixed(0)} KB`);
    lines.push(`| \`${HDRI.file}\` | Poly Haven ${HDRI.id} (CC0) | sky, reflections and ambient light |`);
  } catch (err) {
    console.log(`FAILED: ${(err as Error).message}`);
    lines.push(`| \`${HDRI.file}\` | Poly Haven ${HDRI.id} (CC0) | sky — DOWNLOAD FAILED |`);
  }

  for (const sky of SKIES) {
    process.stdout.write(`  ${sky.id} -> ${sky.file} ... `);
    try {
      const hdr = await download(skyUrl(sky.id));
      writeFileSync(join(OUT, sky.file), hdr);
      console.log(`${(hdr.length / 1024).toFixed(0)} KB`);
      lines.push(`| \`${sky.file}\` | Poly Haven ${sky.id} (CC0) | ${sky.note} |`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      lines.push(`| \`${sky.file}\` | Poly Haven ${sky.id} (CC0) | ${sky.note} — DOWNLOAD FAILED |`);
    }
  }

  lines.push(
    "",
    "Poly Haven assets are also CC0 1.0. The level geometry is generated in code; the",
    "props are Poly Haven's (npm run models), the mannequin Quaternius's (CC0), and the recorded sounds Kenney's (CC0, public/audio/ATTRIBUTION.md) layered over the synthesis.",
    ""
  );
  // the models' credits are npm run models' own section of this file (fetch-models.ts): kept, not
  // written over, or fetching textures after models loses them (it did, 2026-09-26)
  const att = join(OUT, "ATTRIBUTION.md");
  const had = existsSync(att) ? readFileSync(att, "utf8").replace(/\r\n/g, "\n") : "";
  const models = had.indexOf("\n## Models");
  writeFileSync(att, lines.join("\n") + (models >= 0 ? had.slice(models) : ""));
  console.log(`\nwrote ${join(OUT, "ATTRIBUTION.md")}`);
  if (!existsSync(join(OUT, "concrete", "color.jpg"))) {
    console.error("no textures present; the range will fall back to flat colours");
    process.exit(1);
  }
  // smaller downloads: the surfaces as WebP (tools/compress-assets.ts)
  const r = await compressAssets();
  console.log(`textures to WebP: ${(r.before / 1048576).toFixed(1)} MB -> ${(r.after / 1048576).toFixed(1)} MB`);
}

void main();
