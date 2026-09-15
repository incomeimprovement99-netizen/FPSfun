// CC0 PBR materials, loaded from public/tex (see public/tex/ATTRIBUTION.md).
// Every material falls back to a plain colour if the textures are missing, so
// the range still runs before `npm run assets` has been called.
import * as THREE from "three";

export type MatName = "concrete" | "wall" | "catwalk" | "panel" | "ground";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Load the CC0 sky and install it as the scene ENVIRONMENT only.
 *
 * A MeshStandardMaterial with metalness reflects its environment; with no
 * environment there is nothing to reflect, so every metal surface renders
 * pure black. Before this, the platforms, cover, pillars and roof were all
 * black slabs.
 *
 * It is no longer the background: src/game/sky.ts draws an authored gradient
 * dome instead, because a photographic sky puts its horizon at a fixed height
 * that does not line up with where our ground plane ends.
 *
 * `environmentIntensity` trims the ambient so the sun stays in charge of
 * contrast. At full strength the environment filled every shadow straight back
 * in, which is why the original render had no visible shadows despite a
 * shadow-casting sun. Cutting it to a THIRD then over-corrected into a night
 * scene, so it sits at 0.85: enough fill to keep shaded faces readable, not so
 * much that the sun stops mattering.
 */
export async function installSky(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): Promise<boolean> {
  try {
    const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
    const hdr = await new RGBELoader().loadAsync("tex/sky.hdr");
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    hdr.dispose();
    pmrem.dispose();
    return true;
  } catch {
    // No HDRI: the gradient dome still draws, so the frame is not empty, but
    // nothing has anything to reflect. Drop metalness so metal surfaces read
    // as dull paint rather than as black holes.
    for (const m of cache.values()) m.metalness = Math.min(m.metalness, 0.1);
    return false;
  }
}

interface Opts {
  color?: number;
  roughness?: number;
  metalness?: number;
}

const FALLBACK: Record<MatName, number> = {
  concrete: 0x8d8f8c,
  wall: 0x5d6570,
  catwalk: 0x6b7078,
  panel: 0x7b8189,
  ground: 0x7a7266,
};

/**
 * Load a map. TextureLoader is asynchronous and never throws on a 404, so the
 * failure has to be handled in the error callback: an unloaded texture still
 * gets bound and samples as black, which would have made the whole range black
 * on a checkout that had not run `npm run assets`.
 */
function load(name: MatName, map: string, srgb: boolean, onFail: () => void): THREE.Texture {
  // WebP (tools/compress-assets.ts); a checkout that has not compressed its downloads has the JPEGs
  const t = loader.load(`tex/${name}/${map}.webp`, undefined, undefined, () => {
    loader.load(
      `tex/${name}/${map}.jpg`,
      (img) => {
        t.image = img.image;
        t.needsUpdate = true;
      },
      undefined,
      onFail
    );
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * A textured material. `scale` is metres per tile, so a 4 m wall with scale 2
 * shows the texture twice. Materials are cached per (name, scale).
 */
export function material(name: MatName, opts: Opts = {}): THREE.MeshStandardMaterial {
  const key = `${name}:${opts.color ?? ""}:${opts.roughness ?? ""}:${opts.metalness ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? (name === "catwalk" || name === "panel" ? 0.55 : 0.05),
  });

  // If any map 404s, drop every map on this material and fall back to a flat
  // colour rather than rendering black.
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    m.map = null;
    m.roughnessMap = null;
    m.normalMap = null;
    m.color.setHex(FALLBACK[name]);
    m.needsUpdate = true;
  };

  m.map = load(name, "color", true, fail);
  m.roughnessMap = load(name, "roughness", false, fail);
  m.normalMap = load(name, "normalgl", false, fail);
  cache.set(key, m);
  return m;
}

/**
 * Set UV repeat to match a box's real size so the texture keeps a constant
 * world scale regardless of the geometry it is applied to. Three shares one
 * material across meshes, so this clones the geometry's UVs instead.
 */
export function tileBox(geo: THREE.BoxGeometry, metresPerTile: number): void {
  const p = geo.parameters;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // box UV order: +X, -X, +Y, -Y, +Z, -Z, 4 verts each
  const faces: Array<[number, number]> = [
    [p.depth, p.height],
    [p.depth, p.height],
    [p.width, p.depth],
    [p.width, p.depth],
    [p.width, p.height],
    [p.width, p.height],
  ];
  for (let f = 0; f < 6; f++) {
    const [w, h] = faces[f];
    const su = w / metresPerTile;
    const sv = h / metresPerTile;
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
}
