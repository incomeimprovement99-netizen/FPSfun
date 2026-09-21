// Fetch the CC0 character assets: real bodies and real clothes.
//
// Licence: Creative Commons CC0 1.0 Universal (Quaternius). Commercial use
// permitted, attribution NOT required, redistribution permitted. Credited
// anyway, in public/models/body/ATTRIBUTION.md.
//
// Why these two packs and not any others: our figures are driven by
// Quaternius's Universal Animation Library, and these are built on the same
// universal humanoid rig - pelvis, spine_01..03, clavicle_l, upperarm_l,
// calf_l, ball_l, the Unreal mannequin's own bone names. So the body is a
// drop-in for the grey mannequin and the garments hang on the bones the
// outfit system already measures against. Anything else CC0 that is rigged to
// the Unreal mannequin will drop in the same way.
//
// Run: npm run characters
//
// The download is itch.io's own free-download flow, which is three requests:
// the page (for a CSRF token), a POST for a signed download-page URL, and a
// POST to that page's file endpoint for the storage URL. No account.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "public", "models");

interface Pack {
  slug: string;
  upload: number;
  /** what to pull out of the zip, by a match on the path, and where it goes */
  take: Array<{ match: RegExp; into: string }>;
}

const PACKS: Pack[] = [
  {
    slug: "universal-base-characters",
    upload: 15861669,
    take: [
      { match: /Base Characters\/Godot - UE\/Superhero_(Male|Female)_FullBody\.(gltf|bin)$/, into: "body" },
      { match: /Base Characters\/Godot - UE\/T_Superhero_(Male|Female)_(Dark|Dark_BaseColor|Normal|Roughness)\.png$/, into: "body" },
      { match: /Base Characters\/Godot - UE\/T_(Eye|Hair)_[^/]*\.png$/, into: "body" },
      { match: /Hairstyles\/Rigged to Head Bone\/glTF \(Godot -Unreal\)\/Hair_(Buzzed|Long|SimpleParted|Beard)\.(gltf|bin)$/, into: "body/hair" },
    ],
  },
  {
    slug: "modular-character-outfits-fantasy",
    upload: 16289385,
    take: [
      { match: /Outfits\/(Male|Female)_(Ranger|Peasant)\.(gltf|bin)$/, into: "outfits" },
      { match: /Textures\/(Ranger|Peasant|Base)\/[^/]*\.png$/, into: "outfits" },
    ],
  },
];

function itchZip(slug: string, upload: number): Buffer {
  const sh = (cmd: string): string => execFileSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 1 << 28 }).trim();
  const jar = `${process.env.TEMP ?? "/tmp"}/itch-${slug}.jar`;
  const page = `${process.env.TEMP ?? "/tmp"}/itch-${slug}.html`;
  sh(`curl -sL -c '${jar}' 'https://quaternius.itch.io/${slug}' -o '${page}'`);
  const tok = sh(`grep -oE 'name="csrf_token" value="[^"]+"' '${page}' | head -1 | sed 's/.*value="//;s/"//'`);
  if (!tok) throw new Error(`${slug}: no csrf token`);
  const url = sh(`curl -s -b '${jar}' -c '${jar}' -X POST 'https://quaternius.itch.io/${slug}/download_url' -d 'csrf_token=${tok}' | python -c "import sys,json;print(json.load(sys.stdin)['url'])"`);
  const dl = `${process.env.TEMP ?? "/tmp"}/dl-${slug}.html`;
  sh(`curl -sL -b '${jar}' -c '${jar}' -o '${dl}' '${url}'`);
  const tok2 = sh(`grep -oE 'name="csrf_token" value="[^"]+"' '${dl}' | head -1 | sed 's/.*value="//;s/"//'`);
  const file = sh(
    `curl -s -b '${jar}' -c '${jar}' -X POST 'https://quaternius.itch.io/${slug}/file/${upload}?source=game_download' --data-urlencode 'csrf_token=${tok2}' -H 'X-Requested-With: XMLHttpRequest' -H 'Referer: ${url}' | python -c "import sys,json;print(json.load(sys.stdin)['url'])"`
  );
  const zip = `${process.env.TEMP ?? "/tmp"}/${slug}.zip`;
  if (!existsSync(zip)) sh(`curl -sL -o '${zip}' '${file}'`);
  return readFileSync(zip);
}

/** every fetched PNG to a 1k WebP, and every .gltf pointed at it */
async function shrink(): Promise<void> {
  for (const dir of ["body", "body/hair", "outfits"].map((d) => resolve(OUT, d))) {
    if (!existsSync(dir)) continue;
    // the two files a body asks for by a name the pack does not ship
    for (const [from, to] of [
      ["T_Hair_1_Normal.png", "T_Hair_1_Normal_png.png"],
      ["T_Hair_2_Normal.png", "T_Hair_2_Normal_png.png"],
      ["T_Eye_Normal.png", "T_Eye_Normal_png.png"],
    ]) {
      if (existsSync(join(dir, from)) && !existsSync(join(dir, to))) copyFileSync(join(dir, from), join(dir, to));
    }
    let saved = 0;
    for (const f of readdirSync(dir)) {
      if (!f.toLowerCase().endsWith(".png")) continue;
      const src = join(dir, f);
      const was = readFileSync(src).length;
      await sharp(src)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: /normal/i.test(f) ? 90 : 80 })
        .toFile(src.replace(/\.png$/i, ".webp"));
      saved += was - readFileSync(src.replace(/\.png$/i, ".webp")).length;
      rmSync(src);
    }
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".gltf")) continue;
      const p = join(dir, f);
      const before = readFileSync(p, "utf8");
      const after = before.replace(/"uri"\s*:\s*"([^"]+)\.png"/gi, (_m, a: string) => `"uri":"${a}.webp"`);
      if (after !== before) writeFileSync(p, after);
    }
    if (saved > 0) console.log(`  ${dir.split(/[\/]/).pop()}: ${(saved / 1e6).toFixed(1)} MB saved as WebP`);
  }
}

function main(): void {
  for (const p of PACKS) {
    console.log(`\n${p.slug}`);
    const zipPath = `${process.env.TEMP ?? "/tmp"}/${p.slug}.zip`;
    if (!existsSync(zipPath)) itchZip(p.slug, p.upload);
    // node has no zip reader; python does, and this repo already leans on it
    for (const t of p.take) {
      const dir = resolve(OUT, t.into);
      mkdirSync(dir, { recursive: true });
      const script = `
import zipfile, os, re, sys
z = zipfile.ZipFile(${JSON.stringify(zipPath)})
pat = re.compile(${JSON.stringify(t.match.source)})
n = 0
for name in z.namelist():
    if name.endswith('/') or not pat.search(name):
        continue
    out = os.path.join(${JSON.stringify(dir.split(String.fromCharCode(92)).join("/"))}, os.path.basename(name))
    with open(out, 'wb') as f:
        f.write(z.read(name))
    n += 1
print(n)
`;
      const got = execFileSync("python", ["-c", script], { encoding: "utf8" }).trim();
      console.log(`  ${got} files -> public/models/${t.into}  (${t.match.source.slice(0, 40)})`);
    }
  }
  // The packs ship 2k and 4k PNGs: 108 MB of them, which is not a thing to put
  // on a web page. The same pictures as 1k WebP are 8 MB, and every .gltf is
  // pointed at the new files. Normal maps keep more quality, because their
  // blocks show as dents in the light before a colour map's would show at all.
  void shrink();

  writeFileSync(
    resolve(OUT, "body", "ATTRIBUTION.md"),
    `# Character attribution

Released as **Public Domain (CC0 1.0)**: commercial use permitted, attribution
not required, redistribution permitted. Credited anyway.

| Files | What | Author | Source |
|---|---|---|---|
| \`Superhero_*_FullBody.gltf\` | The bodies the figures are built on: real topology, a face, base colour, normal and roughness maps | Quaternius | Universal Base Characters, https://quaternius.itch.io/universal-base-characters |
| \`hair/Hair_*.gltf\` | Hair and a beard, rigged to the Head bone | Quaternius | the same pack |
| \`../outfits/*.gltf\` | Modular garments: bodies, arms, legs, boots, hoods and pauldrons | Quaternius | Modular Character Outfits, https://quaternius.itch.io/modular-character-outfits-fantasy |

All of it is built on the same universal humanoid rig as the Universal
Animation Library our clips come from (the Unreal mannequin's bone names), so
the bodies take our animations and the garments hang on the bones the outfit
system measures against. Fetched by \`tools/fetch-characters.ts\`.
`
  );
  console.log("\nwrote public/models/body/ATTRIBUTION.md");
}

main();
