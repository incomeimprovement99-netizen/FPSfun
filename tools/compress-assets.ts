// Smaller downloads: the fetched CC0 textures re-encoded as WebP.
//
// The range's surfaces (public/tex/<name>/{color,normalgl,roughness}.jpg) and
// the props' maps (public/models/<slug>/textures/*.jpg, which each .gltf points
// at) come from Poly Haven as high-quality JPEGs of about 800 KB each. The same
// pictures as WebP are a fraction of that at no visible loss. Normal maps keep
// a higher quality: their blocks show as dents in the lighting before a colour
// map's would show at all. The JPEGs go once their WebP is written, and each
// .gltf is pointed at the new files, so the site ships and loads only WebP.
// The game loads the .webp and falls back to a .jpg (materials.ts), so a
// checkout that has not run this still works.
//
// Run: npm run compress      (npm run assets and npm run models run it at the end)
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TEX = join(ROOT, "public", "tex");
const MODELS = join(ROOT, "public", "models");

/** quality by what the map is: a normal map's errors show as lighting, so it gets more */
const quality = (file: string): number => (/nor/i.test(file) ? 90 : /rough|arm/i.test(file) ? 80 : 82);

let before = 0;
let after = 0;
async function toWebp(jpg: string): Promise<string> {
  const out = jpg.replace(/\.jpe?g$/i, ".webp");
  const size = statSync(jpg).size;
  await sharp(jpg).webp({ quality: quality(jpg), effort: 5, smartSubsample: true }).toFile(out);
  before += size;
  after += statSync(out).size;
  rmSync(jpg);
  return out;
}

export async function compressAssets(): Promise<{ before: number; after: number; files: number }> {
  let files = 0;
  if (existsSync(TEX)) {
    for (const dir of readdirSync(TEX)) {
      const d = join(TEX, dir);
      if (!statSync(d).isDirectory()) continue;
      for (const f of readdirSync(d)) {
        if (!/\.jpe?g$/i.test(f)) continue;
        await toWebp(join(d, f));
        files++;
      }
    }
  }
  if (existsSync(MODELS)) {
    for (const slug of readdirSync(MODELS)) {
      const d = join(MODELS, slug);
      const gltfPath = join(d, `${slug}.gltf`);
      if (!existsSync(gltfPath)) continue;
      const gltf = JSON.parse(readFileSync(gltfPath, "utf8")) as { images?: Array<{ uri?: string; mimeType?: string }> };
      let changed = false;
      for (const img of gltf.images ?? []) {
        if (!img.uri || !/\.jpe?g$/i.test(img.uri)) continue;
        const src = join(d, decodeURIComponent(img.uri));
        if (existsSync(src)) {
          await toWebp(src);
          files++;
        }
        img.uri = img.uri.replace(/\.jpe?g$/i, ".webp");
        img.mimeType = "image/webp";
        changed = true;
      }
      if (changed) writeFileSync(gltfPath, JSON.stringify(gltf, null, 1));
    }
  }
  return { before, after, files };
}

if (process.argv[1] && /compress-assets/.test(process.argv[1])) {
  void compressAssets().then((r) => {
    const mb = (n: number) => (n / 1048576).toFixed(1);
    console.log(r.files ? `${r.files} textures to WebP: ${mb(r.before)} MB -> ${mb(r.after)} MB` : "nothing to compress (already WebP, or run npm run assets / npm run models first)");
  });
}
