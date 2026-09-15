// Fetch CC0 materials for the range. Everything here is Creative Commons
// CC0 1.0 Universal (public domain dedication): commercial use allowed,
// no attribution required, redistribution allowed. We credit anyway in
// public/tex/ATTRIBUTION.md because it costs nothing.
//
// Run: npm run assets
// Downloaded files are gitignored; this script is the source of truth.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
];

/** the only maps we ship; the rest of each pack is discarded */
const KEEP = ["Color", "Roughness", "NormalGL"] as const;

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

  lines.push(
    "",
    "Poly Haven assets are also CC0 1.0. Sounds and all geometry are generated",
    "in code; no third-party audio or models are used.",
    ""
  );
  writeFileSync(join(OUT, "ATTRIBUTION.md"), lines.join("\n"));
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
