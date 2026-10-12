// Fetch CC0 materials for the range. Everything here is Creative Commons
// CC0 1.0 Universal (public domain dedication): commercial use allowed,
// no attribution required, redistribution allowed. We credit anyway in
// public/tex/ATTRIBUTION.md because it costs nothing.
//
// Run: npm run assets
// Downloaded files are gitignored; this script is the source of truth.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { shrinkSky } from "./hdr";
import { compressAssets } from "./compress-assets";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "public", "tex");

/** ambientCG asset id -> the folder name we use in code */
// What the game draws with since the legacy game's went (Milestone 535: its range's metals and asphalt, Outskirts' set
// and the city's unused facades): the courses' and the Vault's light concrete, and SpeedKills' night city (docs/
// PHASE_18_PLAN_SPEEDKILLS.md 7.9), a facade photographed at night with an emission map so its windows glow for real,
// dark asphalt and pavement, black metal and a dark concrete.
const MATERIALS: Array<{ id: string; as: string; note: string }> = [
  { id: "Concrete048", as: "concrete", note: "the courses' floors and the Vault's, clean light concrete" },
  { id: "Facade007", as: "skNight2", note: "SpeedKills: a night tower, lit windows (the movement lab's walls)" },
  { id: "Road012A", as: "skStreet", note: "SpeedKills: the streets, dark asphalt" },
  { id: "Asphalt026C", as: "skPave", note: "SpeedKills: pavements and plazas" },
  { id: "Metal029", as: "skMetal", note: "SpeedKills: black metal trim, walkways and rails" },
  { id: "Concrete033", as: "skConcrete", note: "SpeedKills: floors, interiors and roofs" },
];

const KEEP = ["Color", "Roughness", "NormalGL", "Emission"] as const;

/**
 * The skies, CC0 (Poly Haven). Not decoration: metalness materials reflect their environment, and with nothing to
 * reflect every metal surface renders pure black; it is also the ambient light that makes shadowed faces readable.
 * SpeedKills' three hours (speedkills.json identity.skies): the golden hour (its default, and what a missing file falls
 * back to), the hazy day and the neon night. The legacy game's other four hours and its default sky went in Milestone
 * 535. All the 1k HDR, shrunk (tools/hdr.ts), so the set is under a megabyte.
 */
const SKIES: Array<{ id: string; file: string; note: string }> = [
  { id: "qwantani_late_afternoon_puresky", file: "sky-afternoon.hdr", note: "the golden hour: low warm sun" },
  { id: "kloofendal_43d_clear_puresky", file: "sky-noon.hdr", note: "the hazy day: hard noon, short shadows" },
  { id: "qwantani_moon_noon_puresky", file: "sky-night.hdr", note: "the neon night's moonlight" },
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

  for (const sky of SKIES) {
    process.stdout.write(`  ${sky.id} -> ${sky.file} ... `);
    try {
      const hdr = await download(skyUrl(sky.id));
      const small = shrinkSky(hdr);
      writeFileSync(join(OUT, sky.file), small);
      console.log(`${(small.length / 1024).toFixed(0)} KB`);
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
