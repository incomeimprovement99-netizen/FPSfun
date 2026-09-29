// Unity's Standard shader's detail maps, for the pieces of Daelonik's Neon City (Phase 28). A third of its materials keep
// the real surface in their detail slots (its asphalt's main map is a noise, the asphalt itself the detail) and the rest
// a grain over the main one; read alone, the city came out plain white. tools/import-city.ts writes each material's
// detail colour, normal and mask as textures its extras name by index (`detail`: map, normal, mask, xf, normalScale);
// here they are multiplied in as Unity does: the colour times the detail times 2 in gamma, which is 4.595 in linear
// (unity_ColorSpaceDouble), weighted by the mask's alpha, and the detail's normal added to the main one's, all at the
// detail's own tiling (xf: u' = a u + b, v' = c v + d from the stored UV). Its particle shaders too (applyUnityLooks).
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

type Detail = { map: number; normal: number; mask: number; xf: number[]; normalScale: number };

/** each patched material's detail uniforms, for the checks (not userData: a material's copy stringifies that) */
export const DETAIL_OF = new WeakMap<THREE.Material, Record<string, { value: unknown }>>();

/** every material of a loaded file that names detail maps, patched to draw them: how many */
export async function applyDetailMaps(gltf: GLTF): Promise<number> {
  const mats = new Set<THREE.MeshStandardMaterial>();
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && !Array.isArray(m) && m.userData?.detail) mats.add(m);
  });
  // the extras name images; a texture entry is what the loader loads, found by its image (its source, or its KTX2's)
  const byImage = new Map<number, number>();
  ((gltf.parser.json.textures ?? []) as Array<{ source?: number; extensions?: Record<string, { source?: number }> }>).forEach((t, k) => {
    const src = t.extensions?.KHR_texture_basisu?.source ?? t.source;
    if (src !== undefined && !byImage.has(src)) byImage.set(src, k);
  });
  const tex = new Map<number, Promise<THREE.Texture>>();
  const load = (img: number, srgb: boolean): Promise<THREE.Texture> | null => {
    const i = byImage.get(img);
    if (img < 0 || i === undefined) return null;
    let p = tex.get(i);
    if (!p) {
      p = gltf.parser.getDependency("texture", i).then((t: THREE.Texture) => {
        // (a colour map read outside a material's own slots is not told its colour space by the loader)
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
        return t;
      });
      tex.set(i, p);
    }
    return p;
  };
  await Promise.all(
    [...mats].map(async (m) => {
      const d = m.userData.detail as Detail;
      const [map, normal, mask] = await Promise.all([load(d.map, true), m.normalMap ? load(d.normal, false) : null, load(d.mask, false)]);
      patch(m, map, normal, mask, d);
    }),
  );
  return mats.size;
}

/**
 * Unity's built-in particle shaders, which Neon City draws its light beams, glows and grille decals with: the importer
 * marks them (extras `unlit`, `additive`) and here they are drawn as Unity does, unlit, and added to what is behind them
 * with no depth written for its additive mode. As plain lit materials the pads' beams were solid white columns. How many
 * materials it changed
 */
export function applyUnityLooks(root: THREE.Object3D): number {
  const made = new Map<THREE.Material, THREE.MeshBasicMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mesh.isMesh || !m || Array.isArray(m) || !(m.userData?.unlit || m.userData?.additive)) return;
    let b = made.get(m);
    if (!b) {
      const add = !!m.userData.additive;
      b = new THREE.MeshBasicMaterial({ name: m.name, map: m.map, color: m.color, opacity: m.opacity, transparent: add || m.transparent, alphaTest: m.alphaTest, side: m.side, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !add && m.depthWrite });
      b.userData = { ...m.userData };
      made.set(m, b);
    }
    mesh.material = b;
    // (light casts no shadow)
    if (b.blending === THREE.AdditiveBlending) mesh.castShadow = mesh.receiveShadow = false;
  });
  return made.size;
}

function patch(m: THREE.MeshStandardMaterial, map: THREE.Texture | null, normal: THREE.Texture | null, mask: THREE.Texture | null, d: Detail): void {
  if (!map && !normal) return;
  const uniforms = {
    uDetailMap: { value: map },
    uDetailNormal: { value: normal },
    uDetailMask: { value: mask },
    uDetailXf: { value: new THREE.Vector4(d.xf[0], d.xf[1], d.xf[2], d.xf[3]) },
    uDetailNormalScale: { value: d.normalScale },
  };
  DETAIL_OF.set(m, uniforms);
  const flags = `${map ? "M" : ""}${normal ? "N" : ""}${mask ? "K" : ""}`;
  m.defines = { ...(m.defines ?? {}), USE_UV: "", ...(map ? { DETAIL_MAP: "" } : {}), ...(normal ? { DETAIL_NORMAL: "" } : {}), ...(mask ? { DETAIL_MASK: "" } : {}) };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D uDetailMap;
uniform sampler2D uDetailNormal;
uniform sampler2D uDetailMask;
uniform vec4 uDetailXf;
uniform float uDetailNormalScale;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec2 dUv = vec2(uDetailXf.x * vUv.x + uDetailXf.y, uDetailXf.z * vUv.y + uDetailXf.w);
#ifdef DETAIL_MASK
  float dMask = texture2D(uDetailMask, vUv).a;
#else
  float dMask = 1.0;
#endif
#ifdef DETAIL_MAP
  diffuseColor.rgb *= mix(vec3(1.0), texture2D(uDetailMap, dUv).rgb * 4.59479, dMask);
#endif`,
      )
      // (the normal's chunk expanded here, its last step given the detail: an #include is not yet expanded at this point)
      .replace(
        "#include <normal_fragment_maps>",
        THREE.ShaderChunk.normal_fragment_maps.replace(
          "normal = normalize( tbn * mapN );",
          `#ifdef DETAIL_NORMAL
  vec3 dN = texture2D(uDetailNormal, dUv).xyz * 2.0 - 1.0;
  mapN = normalize(vec3(mapN.xy + dN.xy * uDetailNormalScale * dMask, mapN.z));
#endif
  normal = normalize( tbn * mapN );`,
        ),
      );
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|detail${flags}`;
  m.needsUpdate = true;
}
