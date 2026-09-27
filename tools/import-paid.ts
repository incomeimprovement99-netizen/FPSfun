// The bought assets, made into what the game loads (Phase 21,
// docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md section 5.2).
//
// Paid files are licensed to the owner, not to the public: their sources never
// enter git, and what the game loads is written to public/models/paid/, which
// .gitignore keeps out and `npm run rules` refuses if it is ever tracked. They
// ship only with the game server (`npm run fps deploy`); the Pages build drops
// them (tools/deploy-pages.ts). A checkout without them runs as before, because
// every paid model has a free fallback in the game.
//
// Only local tools touch the files: tar, FBX2glTF, glTF-Transform and sharp.
// Nothing here uploads them anywhere.
//
// Sources: the owner's Unity Asset Store downloads, which Unity keeps as
// .unitypackage files under %APPDATA%\Unity\Asset Store-5.x, unpacked into
// PAID_DIR/extract (default C:\Users\jwilb\Downloads\speedkills-paid).
//
//   npm run paid
//
// The soldier (AC Game Assets, Sci-Fi Modular Soldier): its FBX becomes one GLB
// with its 18 modular parts and its skeleton, without its materials or its 104
// face morphs (the game has no facial animation, and the morphs were most of
// the head's weight). Its materials are rebuilt at run time (soldier.ts) from
// the textures written here, the way the pack's own shaders build them: the
// base colour multiplied by a tint wherever a mask is white.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PAID = process.env.PAID_DIR ?? "C:\\Users\\jwilb\\Downloads\\speedkills-paid";
const OUT = join(ROOT, "public", "models", "paid");
const STORE = join(process.env.APPDATA ?? "", "Unity", "Asset Store-5.x");

/** every .unitypackage under a folder, by file name */
function findPackages(dir: string, found = new Map<string, string>()): Map<string, string> {
  if (!existsSync(dir)) return found;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) findPackages(p, found);
    else if (e.name.endsWith(".unitypackage")) found.set(e.name, p);
  }
  return found;
}

/**
 * A .unitypackage is a gzipped tar of one folder per asset, each holding the
 * asset's bytes as `asset` and its project path as `pathname`. Unpacked once;
 * the map says where each project path's bytes are.
 */
function unpack(pkg: string, name: string): Map<string, string> {
  const dir = join(PAID, "extract", name);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    execFileSync("tar", ["-xzf", pkg, "-C", dir], { stdio: "inherit" });
  }
  const files = new Map<string, string>();
  for (const guid of readdirSync(dir)) {
    const pn = join(dir, guid, "pathname");
    const asset = join(dir, guid, "asset");
    if (existsSync(pn) && existsSync(asset)) files.set(readFileSync(pn, "utf8").split(/\r?\n/)[0].trim(), asset);
  }
  return files;
}

/**
 * An uncompressed or run-length TGA as raw RGB(A). sharp reads no TGA, and the
 * pack's textures are all TGA (4096 square, 24-bit, stored bottom row first).
 */
function readTga(file: string): { data: Buffer; width: number; height: number; channels: 3 | 4 } {
  const b = readFileSync(file);
  const idLen = b[0], cmapType = b[1], type = b[2];
  const cmapLen = b.readUInt16LE(5), cmapDepth = b[7];
  const width = b.readUInt16LE(12), height = b.readUInt16LE(14), depth = b[16], desc = b[17];
  if (cmapType !== 0 || (type !== 2 && type !== 10 && type !== 3 && type !== 11)) throw new Error(`${file}: TGA type ${type} not handled`);
  const grey = type === 3 || type === 11;
  const inBpp = depth / 8;
  const channels: 3 | 4 = depth === 32 ? 4 : 3;
  let p = 18 + idLen + cmapLen * Math.ceil(cmapDepth / 8);
  const px = width * height;
  const out = Buffer.alloc(px * channels);
  const put = (i: number, src: number): void => {
    const o = i * channels;
    if (grey) out[o] = out[o + 1] = out[o + 2] = b[src];
    else { out[o] = b[src + 2]; out[o + 1] = b[src + 1]; out[o + 2] = b[src]; }
    if (channels === 4) out[o + 3] = b[src + 3];
  };
  if (type === 2 || type === 3) {
    for (let i = 0; i < px; i++, p += inBpp) put(i, p);
  } else {
    let i = 0;
    while (i < px) {
      const h = b[p++];
      const n = (h & 0x7f) + 1;
      if (h & 0x80) { for (let k = 0; k < n; k++) put(i++, p); p += inBpp; }
      else for (let k = 0; k < n; k++, p += inBpp) put(i++, p);
    }
  }
  // bit 5 of the descriptor set means the first row is the top; otherwise flip
  if (!(desc & 0x20)) {
    const row = width * channels;
    const tmp = Buffer.alloc(row);
    for (let y = 0; y < height >> 1; y++) {
      const a = y * row, z = (height - 1 - y) * row;
      out.copy(tmp, 0, a, a + row);
      out.copy(out, a, z, z + row);
      tmp.copy(out, z);
    }
  }
  return { data: out, width, height, channels };
}

const tgaCache = new Map<string, ReturnType<typeof readTga>>();
const tga = (file: string): ReturnType<typeof readTga> => tgaCache.get(file) ?? tgaCache.set(file, readTga(file)).get(file)!;

/** a TGA written as WebP at `size`, normal maps at a higher quality since their blocks show as dents in the light */
async function webp(src: string, out: string, size: number, normal = false): Promise<void> {
  const t = tga(src);
  if (t.data.length !== t.width * t.height * t.channels) throw new Error(`${src}: ${t.data.length} bytes for ${t.width}x${t.height}x${t.channels}`);
  await sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } })
    .resize(size, size, { kernel: "lanczos3" })
    .webp({ quality: normal ? 92 : 84, effort: 5 })
    .toBuffer()
    .then((b) => writeFileSync(out, b));
}

/**
 * Several masks packed into one texture's channels, so a material that tints
 * two regions (the armour's plates and its helmet) samples one texture, not two.
 * The pack's masks are grey; their red channel is the mask.
 */
async function packMasks(srcs: Array<string | null>, out: string, size: number): Promise<void> {
  const planes = await Promise.all(
    srcs.map(async (s) => {
      if (!s) return Buffer.alloc(size * size);
      const t = tga(s);
      return sharp(t.data, { raw: { width: t.width, height: t.height, channels: t.channels } })
        .extractChannel(0)
        .resize(size, size, { kernel: "lanczos3" })
        .raw()
        .toBuffer();
    }),
  );
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = planes[c]?.[i] ?? 0;
  writeFileSync(out, await sharp(rgb, { raw: { width: size, height: size, channels: 3 } }).webp({ lossless: true }).toBuffer());
}

/** FBX2glTF's own binary for this platform, from the fbx2gltf package */
function fbx2gltf(): string {
  const dir = join(ROOT, "node_modules", "fbx2gltf", "bin", process.platform === "win32" ? "Windows_NT" : process.platform === "darwin" ? "Darwin" : "Linux");
  const exe = readdirSync(dir).find((f) => /^FBX2glTF/i.test(f));
  if (!exe) throw new Error(`no FBX2glTF in ${dir}`);
  return join(dir, exe);
}

async function soldier(files: Map<string, string>): Promise<void> {
  const base = "Assets/SciFiModularSoldier/";
  const src = (p: string): string => {
    const f = files.get(base + p);
    if (!f) throw new Error(`the soldier pack has no ${p}`);
    return f;
  };
  const out = join(OUT, "soldier");
  const tex = join(out, "tex");
  mkdirSync(tex, { recursive: true });

  // the textures, at what a figure on screen can show: the armour and suit at
  // 2048 for colour and normals, the packed occlusion, roughness and metal and
  // the masks at 1024, and the head (a small part of the screen) at 1024
  const T = "Textures/";
  const jobs: Array<() => Promise<void>> = [
    () => webp(src(T + "T_armor_BaseColor.tga"), join(tex, "armor_color.webp"), 2048),
    () => webp(src(T + "T_armor_Normal.tga"), join(tex, "armor_normal.webp"), 2048, true),
    () => webp(src(T + "T_armor_OcclusionRoughnessMetallic.tga"), join(tex, "armor_orm.webp"), 1024),
    () => packMasks([src(T + "masks/T_armor_mask.tga"), src(T + "masks/T_hat_mask.tga"), null], join(tex, "armor_mask.webp"), 1024),
    () => webp(src(T + "T_body_BaseColor.tga"), join(tex, "body_color.webp"), 2048),
    () => webp(src(T + "T_body_Normal.tga"), join(tex, "body_normal.webp"), 2048, true),
    () => webp(src(T + "T_body_OcclusionRoughnessMetallic.tga"), join(tex, "body_orm.webp"), 1024),
    () => packMasks([src(T + "masks/T_body_mask.tga"), null, null], join(tex, "body_mask.webp"), 1024),
    () => webp(src(T + "T_head_BaseColor.tga"), join(tex, "head_color.webp"), 1024),
    () => webp(src(T + "T_head_Normal.tga"), join(tex, "head_normal.webp"), 1024, true),
    () => webp(src(T + "T_head_OcclusionRoughnessMetallic.tga"), join(tex, "head_orm.webp"), 1024),
    () => packMasks([src(T + "masks/T_head_mask.tga"), null, null], join(tex, "head_mask.webp"), 1024),
    () => webp(src(T + "T_eyes_Normal.tga"), join(tex, "eyes_normal.webp"), 256, true),
    () => webp(src(T + "T_eyes_OcclusionRoughnessMetallic.tga"), join(tex, "eyes_orm.webp"), 256),
  ];
  for (let v = 1; v <= 5; v++) jobs.push(() => webp(src(`${T}T_eyes_BaseColor_v${v}.tga`), join(tex, `eyes_color_${v}.webp`), 256));
  // one at a time: each 4096 TGA is 50 MB raw and the lot at once is several GB
  for (const j of jobs) {
    await j();
    tgaCache.clear();
  }

  // the model: FBX to GLB, then without its materials, textures and morphs
  const tmp = join(PAID, "conv");
  mkdirSync(tmp, { recursive: true });
  const fbx = join(tmp, "Soldier.fbx");
  if (!existsSync(fbx) || statSync(fbx).size !== statSync(src("Models/Soldier.fbx")).size) writeFileSync(fbx, readFileSync(src("Models/Soldier.fbx")));
  const raw = join(tmp, "soldier_raw");
  execFileSync(fbx2gltf(), ["-b", "--pbr-metallic-roughness", "-i", fbx, "-o", raw], { stdio: "inherit" });
  // glTF-Transform's core only: its functions package brings a second sharp,
  // and two copies of libvips in one process break each other
  const { NodeIO } = await import("@gltf-transform/core");
  const io = new NodeIO();
  const doc = await io.read(`${raw}.glb`);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const t of prim.listTargets()) {
        const used = t.listAttributes();
        prim.removeTarget(t);
        t.dispose();
        // a morph's accessors belong to it alone, and would otherwise still be written
        for (const a of used) a.dispose();
      }
    }
    mesh.setWeights([]);
  }
  // the materials stay as named slots (M_armor, M_body, M_head, M_eyes), empty:
  // soldier.ts puts the rebuilt ones in them by name
  for (const m of doc.getRoot().listMaterials()) {
    m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  }
  for (const t of doc.getRoot().listTextures()) t.dispose();
  await io.write(join(out, "soldier.glb"), doc);

  const bytes = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? bytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  console.log(`soldier: ${join(out, "soldier.glb")} ${(statSync(join(out, "soldier.glb")).size / 1e6).toFixed(1)} MB, all files ${(bytes(out) / 1e6).toFixed(1)} MB`);
}

/**
 * The guns (Tirgames, Sci-Fi Battle Weapons; docs/PHASE_21_OVERNIGHT_PLAN.md, the weapons). Each model FBX becomes a
 * GLB with its materials left as named slots, as the soldier's are; each gun family's three skins (A, B, C) become
 * WebP: the colour and the glow (sRGB), the normal, and one packed map in glTF's layout, occlusion in R, roughness
 * in G and metalness in B, made from the pack's AO map and its Unity metallic map (metalness in R, smoothness in
 * alpha, so roughness is 1 minus the alpha). A skin without its own AO, normal or glow uses skin A's, as the pack's
 * materials do.
 */
const GUN_MODELS = [
  "SciFiRifle01_1", "SciFiRifle01_2", "SciFiSMG01_1", "SciFiSMG01_2", "SciFiSMG02_1", "SciFiSMG02_2",
  "SciFiShotGun01_1", "SciFiShotGun01_2", "SciFiShotGun02_1", "SciFiShotGun02_2", "SciFiSniperRifle01_1", "SciFiSniperRifle01_2",
  "SciFiPistol01_1", "SciFiPistol01_2", "SciFiPistol02_1", "SciFiPistol02_2",
  "SciFiGrenadeLauncher01_1", "SciFiGrenadeLauncher01_2", "SciFiGrenadeLauncher01_3", "SciFiRocketLauncher01_1", "SciFiRocketLauncher01_2",
];
const SKINS = ["A", "B", "C"];

async function weapons(files: Map<string, string>): Promise<void> {
  const base = "Assets/TirgamesAssets/SciFiWorld/Weapons/";
  // the pack's paths are not all one case (SciFiPistol01_1.fbx beside SciFiPistol01_2.FBX)
  const lower = new Map([...files.keys()].map((k) => [k.toLowerCase(), k]));
  const find = (p: string): string | null => {
    const k = lower.get((base + p).toLowerCase());
    return k ? files.get(k)! : null;
  };
  const out = join(OUT, "weapons");
  const tex = join(out, "tex");
  mkdirSync(tex, { recursive: true });
  const tmp = join(PAID, "conv", "weapons");
  mkdirSync(tmp, { recursive: true });
  const { NodeIO } = await import("@gltf-transform/core");
  const io = new NodeIO();

  for (const name of GUN_MODELS) {
    const src = find(`Models/${name}.fbx`);
    if (!src) {
      console.log(`weapons: no ${name} in the pack, skipped`);
      continue;
    }
    const fbx = join(tmp, `${name}.fbx`);
    if (!existsSync(fbx) || statSync(fbx).size !== statSync(src).size) writeFileSync(fbx, readFileSync(src));
    const raw = join(tmp, `${name}_raw`);
    execFileSync(fbx2gltf(), ["-b", "--pbr-metallic-roughness", "-i", fbx, "-o", raw], { stdio: "ignore" });
    const doc = await io.read(`${raw}.glb`);
    for (const m of doc.getRoot().listMaterials()) {
      m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    }
    for (const t of doc.getRoot().listTextures()) t.dispose();
    await io.write(join(out, `${name}.glb`), doc);
  }

  // the scopes' reticles, their alpha kept (they are drawn added over the view through the lens)
  for (const dot of ["SciFiScopeDot01", "SciFiGrenadeLauncher01_Dot"]) {
    const d = find(`Textures/${dot}.png`);
    if (d) await sharp(readFileSync(d)).resize(256, 256).webp({ quality: 90, alphaQuality: 100 }).toFile(join(tex, `${dot}.webp`));
  }

  // the skins, one family at a time (each 4096 PNG is tens of MB raw)
  const families = [...new Set(GUN_MODELS.map((n) => n.replace(/_\d+$/, "")))];
  const png = (p: string | null) => (p ? sharp(readFileSync(p)) : null);
  for (const fam of families) {
    for (const sk of SKINS) {
      const color = find(`Textures/${fam}${sk}.png`);
      if (!color) continue;
      const pick = (suffix: string): string | null => find(`Textures/${fam}${sk}_${suffix}.png`) ?? find(`Textures/${fam}A_${suffix}.png`);
      const id = `${fam}${sk}`;
      await png(color)!.resize(1024, 1024, { kernel: "lanczos3" }).webp({ quality: 86, effort: 5 }).toFile(join(tex, `${id}_color.webp`));
      const nm = pick("NM");
      if (nm) await png(nm)!.resize(1024, 1024, { kernel: "lanczos3" }).webp({ quality: 92, effort: 5 }).toFile(join(tex, `${id}_normal.webp`));
      const glow = pick("Emission");
      if (glow) await png(glow)!.resize(512, 512, { kernel: "lanczos3" }).webp({ quality: 86, effort: 5 }).toFile(join(tex, `${id}_emit.webp`));
      // the packed map: occlusion, roughness (1 - smoothness), metalness
      const size = 1024;
      const metal = pick("Metallic");
      const ao = pick("AO");
      const m = metal ? await png(metal)!.resize(size, size, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer() : null;
      const o = ao ? await png(ao)!.resize(size, size, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer() : null;
      const orm = Buffer.alloc(size * size * 3);
      for (let i = 0; i < size * size; i++) {
        orm[i * 3] = o ? o[i * 3] : 255;
        orm[i * 3 + 1] = m ? 255 - m[i * 4 + 3] : 200;
        orm[i * 3 + 2] = m ? m[i * 4] : 0;
      }
      await sharp(orm, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 90, effort: 5 }).toFile(join(tex, `${id}_orm.webp`));
    }
  }
  const bytes = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? bytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  console.log(`weapons: ${out}, all files ${(bytes(out) / 1e6).toFixed(1)} MB`);
}

const packages = findPackages(STORE);
findPackages(PAID, packages);
const soldierPkg = packages.get("Sci-Fi Modular Soldier.unitypackage");
const weaponsPkg = packages.get("Sci-Fi Battle Weapons.unitypackage");
if (!soldierPkg && !weaponsPkg) {
  console.log(`No bought package found under ${STORE} or ${PAID}: download it in Unity's Package Manager (My Assets) first.`);
  process.exit(1);
}
mkdirSync(dirname(join(OUT, "x")), { recursive: true });
// PAID_ONLY=weapons (or soldier) makes one of them only
const only = process.env.PAID_ONLY;
if (soldierPkg && only !== "weapons") await soldier(unpack(soldierPkg, "soldier"));
if (weaponsPkg && only !== "soldier") await weapons(unpack(weaponsPkg, "weapons"));
