// Recoloured texture atlases, one per outfit that asks for a colour.
//
// The pack ships one atlas per set (ranger, peasant). Painting an outfit by
// multiplying a colour into the material is cheap and it half worked: a
// multiply can only darken, so ARCTIC's white came out as a slightly paler
// ranger coat and every outfit stayed the same brown-green family. The cards
// claimed colours the figures did not have.
//
// So the colour goes into the picture instead. Each atlas is flattened to its
// luminance and tinted, which keeps every fold, seam and strap the artist
// painted while letting an outfit be white, black or orange. Written once,
// here, rather than every time a figure is built.
//
// Run: npm run tints  (npm run characters runs it at the end)
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import outfitCfg from "../src/config/outfits.json";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "public", "models", "outfits");
const TINTS = join(OUT, "tints");

/**
 * The packs whose atlases an outfit's parts are painted with.
 *
 * One atlas per outfit was right while an outfit was all Ranger or all
 * Peasant. It stopped being right the day the wardrobe started mixing them to
 * get more outlines out of the same forty files: the two sets lay their UVs
 * out differently, so a peasant shirt reading the ranger atlas is a garment in
 * somebody else's seams. An outfit gets one atlas per pack it borrows from.
 */
function packsIn(parts: string[]): string[] {
  const out: string[] = [];
  for (const pack of ["Ranger", "Peasant"])
    if (parts.some((p) => p.includes(pack))) out.push(pack);
  return out;
}

async function main(): Promise<void> {
  mkdirSync(TINTS, { recursive: true });
  const sets = outfitCfg.sets as Record<
    string,
    { parts?: string[]; tint?: string }
  >;
  let made = 0;
  for (const [id, set] of Object.entries(sets)) {
    if (!set.tint || !set.parts?.length) continue;
    const hex = set.tint.replace("#", "");
    const rgb = {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
    for (const pack of packsIn(set.parts)) {
      const atlas = `T_${pack}_BaseColor.webp`;
      if (!existsSync(join(OUT, atlas))) continue;
      // The luminance the artist painted, then the outfit's own colour scaled
      // into each channel. `.tint()` after `.greyscale()` does not colourise -
      // it wrote eleven identical grey atlases and the figures went grey with
      // them - so the colour goes in as a per-channel multiplier on a greyscale
      // image that has been put back into three channels first.
      // `.greyscale()` leaves one band and `.linear()` cannot expand bands, so
      // the desaturation is done with modulate, which keeps three.
      await sharp(join(OUT, atlas))
        .modulate({ saturation: 0, brightness: 1.1 })
        .linear(
          [(rgb.r / 255) * 1.35, (rgb.g / 255) * 1.35, (rgb.b / 255) * 1.35],
          [0, 0, 0],
        )
        .webp({ quality: 82 })
        .toFile(join(TINTS, `${id}_${pack}.webp`));
      made++;
    }
  }
  const size = readdirSync(TINTS).reduce(
    (n, f) => n + (f.endsWith(".webp") ? 1 : 0),
    0,
  );
  console.log(
    `${made} outfit atlases written to public/models/outfits/tints (${size} files)`,
  );
}

void main();
