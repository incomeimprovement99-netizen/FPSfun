// The first-person arms from KINEMATION's FPS Animation Ultimate (docs/PLAN_FIRST_PERSON_ARMS.md), made into what
// the game loads, as the other bought packs are (tools/import-paid.ts): written to public/models/paid/arms/, which git
// never tracks and the game server alone ships.
//
// - arms.glb: the pack's arms (SK_Arms_Mono: glove, sleeve and hand on the UE4 skeleton, with the virtual bones
//   ik_hand_gun, ik_hand_l and ik_hand_r), its materials left as named slots that fprig.ts fills from tex/;
// - clips/<name>.glb: each clip src/config/fparms.json names, animation alone: the pack's clip files each carry the
//   arms' meshes too, which go;
// - guns/<model>.glb: the pack's own guns the arms clips were made round, and their clips; read for measurements and
//   drawn only by the tools (tools/fparms-sheet.ts), never in play.
//
// Only local tools touch the files: tar, FBX2glTF, glTF-Transform and sharp. Nothing here uploads them.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export interface FpArmsImportHelpers {
  root: string;
  paid: string;
  out: string;
  unpack: (pkg: string, name: string) => Map<string, string>;
  fbx2gltf: () => string;
}

const BASE = "Assets/KINEMATION/FPSAnimationPack/";

export async function fpArms(h: FpArmsImportHelpers, packages: Map<string, string>): Promise<void> {
  const cfg = JSON.parse(readFileSync(join(h.root, "src", "config", "fparms.json"), "utf8"));
  const pkg = packages.get(cfg.package);
  if (!pkg) {
    console.log(`arms: no ${cfg.package} under the Unity downloads, skipped`);
    return;
  }
  const files = h.unpack(pkg, "fparms");
  // every path by its file name alone, for the clips: they sit in a folder per gun and a Character, Weapon or Camera
  // folder under it, and their names are unique across the pack
  const byName = new Map<string, string>();
  for (const [p, f] of files) {
    const name = p.slice(p.lastIndexOf("/") + 1).replace(/\.fbx$/i, "");
    if (/\.fbx$/i.test(p) && !byName.has(name)) byName.set(name, f);
  }
  const out = join(h.out, "arms");
  const tex = join(out, "tex");
  const clipsOut = join(out, "clips");
  const gunsOut = join(out, "guns");
  for (const d of [tex, clipsOut, gunsOut]) mkdirSync(d, { recursive: true });
  const tmp = join(h.paid, "conv", "arms");
  mkdirSync(tmp, { recursive: true });
  const { NodeIO } = await import("@gltf-transform/core");
  const io = new NodeIO();

  /** an FBX to a glTF-Transform document, by way of FBX2glTF (converted once; kept while the source is unchanged) */
  const convert = async (src: string, name: string) => {
    const fbx = join(tmp, `${name}.fbx`);
    if (!existsSync(fbx) || statSync(fbx).size !== statSync(src).size) writeFileSync(fbx, readFileSync(src));
    const raw = join(tmp, `${name}_raw`);
    if (!existsSync(`${raw}.glb`) || statSync(`${raw}.glb`).mtimeMs < statSync(fbx).mtimeMs) {
      execFileSync(h.fbx2gltf(), ["-b", "--pbr-metallic-roughness", "-i", fbx, "-o", raw], { stdio: "ignore" });
    }
    return io.read(`${raw}.glb`);
  };
  type Doc = Awaited<ReturnType<typeof convert>>;
  /** the materials as empty named slots: the game fills them by name */
  const emptyMaterials = (doc: Doc): void => {
    for (const m of doc.getRoot().listMaterials()) {
      m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    }
    for (const t of doc.getRoot().listTextures()) t.dispose();
  };
  /** the animation alone: meshes, skins and materials gone, the nodes (the tracks' targets, by name) kept */
  const animationOnly = (doc: Doc): void => {
    const root = doc.getRoot();
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        for (const a of prim.listAttributes()) a.dispose();
        prim.getIndices()?.dispose();
        prim.dispose();
      }
      mesh.dispose();
    }
    for (const skin of root.listSkins()) {
      skin.getInverseBindMatrices()?.dispose();
      skin.dispose();
    }
    for (const m of root.listMaterials()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
  };

  // the arms
  const armsSrc = files.get(BASE + "Character/SK_Arms_Mono.fbx");
  if (!armsSrc) throw new Error("the arms pack has no Character/SK_Arms_Mono.fbx");
  const arms = await convert(armsSrc, "SK_Arms_Mono");
  emptyMaterials(arms);
  await io.write(join(out, "arms.glb"), arms);

  // their textures: base colour and normal at 2048 (the arms fill a good part of the view), the packed occlusion,
  // roughness and metalness (glTF's own order, as the pack's ORM already is) at 1024
  const T = BASE + "Character/Textures/";
  for (const part of ["Arm01", "Glove01", "Cloth01"]) {
    const jobs: Array<[string, string, number, number]> = [
      [`T_${part}_B.png`, `${part}_color.webp`, 2048, 86],
      [`T_${part}_N.png`, `${part}_normal.webp`, 2048, 92],
      [`T_${part}_ORM.png`, `${part}_orm.webp`, 1024, 90],
    ];
    for (const [src, dst, size, q] of jobs) {
      const f = files.get(T + src);
      if (!f) throw new Error(`the arms pack has no ${src}`);
      await sharp(readFileSync(f)).resize(size, size, { kernel: "lanczos3" }).webp({ quality: q, effort: 5 }).toFile(join(tex, dst));
    }
  }

  // the clips: the shared ones, and each pack gun's arms and gun clips
  const clipNames = new Set<string>(cfg.general);
  const gunModels: string[] = [];
  for (const g of Object.values<{ model: string; arms: Record<string, string>; gun: Record<string, string> }>(cfg.packGuns)) {
    for (const c of Object.values(g.arms)) clipNames.add(c);
    for (const c of Object.values(g.gun)) clipNames.add(c);
    gunModels.push(g.model);
  }
  const report: string[] = [];
  for (const name of clipNames) {
    const src = byName.get(name);
    if (!src) throw new Error(`the arms pack has no clip ${name}`);
    const doc = await convert(src, name);
    animationOnly(doc);
    const anims = doc.getRoot().listAnimations();
    // a gun's pose can be a still with no take (the L96X's): the gun at rest, which is what the game draws anyway
    if (anims.length === 0 && name.startsWith("A_W_")) {
      report.push(`${name}: a still, no take`);
      continue;
    }
    if (anims.length !== 1) throw new Error(`${name}: ${anims.length} takes, one wanted`);
    anims[0].setName(name);
    await io.write(join(clipsOut, `${name}.glb`), doc);
    const sampler = anims[0].listSamplers()[0];
    const input = sampler?.getInput();
    const seconds = input ? input.getMax([0])[0] : 0;
    report.push(`${name} ${seconds.toFixed(2)} s, ${anims[0].listChannels().length} tracks`);
  }
  // the pack's own guns: mesh and parts, materials as slots
  for (const model of gunModels) {
    const src = byName.get(model);
    if (!src) throw new Error(`the arms pack has no gun ${model}`);
    const doc = await convert(src, model);
    emptyMaterials(doc);
    await io.write(join(gunsOut, `${model}.glb`), doc);
  }

  // each pack gun's own settings (its Settings/Weapons/<gun>_Settings.asset, which KINEMATION's player reads): where it
  // moves the weapon (ikOffset) and each shoulder (the clavicle offsets, the L96X's right one 21 cm back so the long gun's
  // grip is reached), in its root's space, metres, as Unity writes them (x right, y up, z ahead)
  const vec = (text: string, key: string): number[] => {
    const m = new RegExp(`${key}: \\{x: ([-\\d.e]+), y: ([-\\d.e]+), z: ([-\\d.e]+)\\}`).exec(text);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const settings: Record<string, { ikOffset: number[]; clavicleL: number[]; clavicleR: number[]; aimPoint: number[] }> = {};
  for (const name of Object.keys(cfg.packGuns)) {
    const lowerName = `${BASE}Settings/Weapons/${name}_Settings.asset`.toLowerCase();
    const key = [...files.keys()].find((k) => k.toLowerCase() === lowerName);
    if (!key) throw new Error(`the arms pack has no settings for ${name}`);
    const text = readFileSync(files.get(key)!, "utf8");
    settings[name] = { ikOffset: vec(text, "ikOffset"), clavicleL: vec(text, "leftClavicleOffset"), clavicleR: vec(text, "rightClavicleOffset"), aimPoint: vec(text, "aimPointOffset") };
  }
  writeFileSync(join(out, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`);

  // The moving clips' own motion of the gun (and the camera): KINEMATION's walk, sprint, jump and equip move no arm
  // bone the FBX files keep. Its controller plays them on an Additive layer masked to two bones its player adds,
  // ik_hand_gun_additive and camera_bone, whose motion its script adds to the gun (FPSProceduralJob ProcessAdditives)
  // and the camera; those curves exist only in the pack's Unity .anim files. Baked at 30 keys a second, so read as they
  // are; Unity's axes to glTF's (x mirrored: a position's x, a turn's y and z, negated).
  const additive: Record<string, { seconds: number; gun: { t: number[]; p: number[]; q: number[] }; cam: { t: number[]; p: number[]; q: number[] } }> = {};
  for (const name of cfg.general as string[]) {
    const key = [...files.keys()].find((k) => k.endsWith(`/${name}.anim`));
    if (!key) continue;
    const text = readFileSync(files.get(key)!, "utf8").replace(/\r/g, "");
    const curves = (section: string): Map<string, Array<{ t: number; v: number[] }>> => {
      const out = new Map<string, Array<{ t: number; v: number[] }>>();
      const at = text.indexOf(`\n  ${section}:`);
      if (at < 0) return out;
      const end = text.indexOf("\n  m_", at + 5);
      const body = text.slice(at, end < 0 ? undefined : end);
      for (const block of body.split("\n  - curve:").slice(1)) {
        const path = /\n    path: (.*)/.exec(block)?.[1]?.trim();
        if (!path) continue;
        const keys: Array<{ t: number; v: number[] }> = [];
        const re = /time: ([-\d.e]+)\n\s+value: \{([^}]*)\}/g;
        for (let m = re.exec(block); m; m = re.exec(block)) keys.push({ t: Number(m[1]), v: m[2].split(",").map((kv) => Number(kv.split(":")[1])) });
        out.set(path, keys);
      }
      return out;
    };
    const rot = curves("m_RotationCurves");
    const pos = curves("m_PositionCurves");
    const track = (path: string) => {
      const r = rot.get(path) ?? [];
      const p = pos.get(path) ?? [];
      const times = [...new Set([...r, ...p].map((k) => k.t))].sort((x, y) => x - y);
      const sample = (keys: Array<{ t: number; v: number[] }>, t: number, n: number): number[] => {
        if (!keys.length) return n === 4 ? [0, 0, 0, 1] : [0, 0, 0];
        let i = 0;
        while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
        const a = keys[i];
        const b = keys[Math.min(i + 1, keys.length - 1)];
        const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
        return a.v.map((x, j) => x + (b.v[j] - x) * u);
      };
      const out = { t: [] as number[], p: [] as number[], q: [] as number[] };
      for (const t of times) {
        const pv = sample(p, t, 3);
        const qv = sample(r, t, 4);
        out.t.push(Math.round(t * 1e4) / 1e4);
        out.p.push(...[-pv[0], pv[1], pv[2]].map((x) => Math.round(x * 1e5) / 1e5));
        out.q.push(...[qv[0], -qv[1], -qv[2], qv[3]].map((x) => Math.round(x * 1e5) / 1e5));
      }
      return out;
    };
    const seconds = Number(/m_StopTime: ([-\d.e]+)/.exec(text)?.[1] ?? 0);
    additive[name] = { seconds, gun: track("root/ik_hand_gun_additive"), cam: track("root/camera_bone") };
  }
  writeFileSync(join(out, "additive.json"), `${JSON.stringify(additive)}\n`);
  report.push(`additive: ${Object.entries(additive).map(([k, v]) => `${k} ${v.seconds.toFixed(2)} s ${v.gun.t.length}/${v.cam.t.length} keys`).join("; ")}`);

  const bytes = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? bytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  console.log(`arms: ${out}, ${clipNames.size} clips, ${gunModels.length} pack guns, all files ${(bytes(out) / 1e6).toFixed(1)} MB`);
  for (const r of report) console.log(`  ${r}`);
}
