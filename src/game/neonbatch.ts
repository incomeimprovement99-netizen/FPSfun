// The Neon City centre's batches (Milestone 657, docs/PLAN_CITY_DRAWS.md). The bake wrote the centre as one primitive
// a material, 441 of them each spanning the whole city, so every one was drawn whichever way a camera looked: about 420
// draw calls a frame from the street, the frame's largest cost on a laptop's processor. Its opaque materials now come
// in batches (tools/import-city.ts writePack): one primitive each, every vertex its material's row in a table, every
// material's pictures one layer of a texture array a kind. The layers ride in the file as KTX2 pictures of their own,
// encoded as every other (one Basis codebook over hundreds of materials blurred them all); here, once the loader has
// transcoded them, each kind's are joined into one CompressedArrayTexture, and the batch's material reads its colour,
// normal, packed occlusion, roughness and metal, and glow from them at its row's layers, with its row's numbers.
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** a batch as the bake writes it into its material's extras */
type Batch = { k: number; rows: number; width: number; table: number[]; layers: Record<string, number[]> };

/** the arrays' kinds, and whether each is a colour (sRGB) or data */
const KINDS: Array<[string, boolean]> = [
  ["color", true],
  ["normal", false],
  ["orm", false],
  ["emissive", true],
];

/** each batch's uniforms, for the checks (not userData: a material's copy stringifies that) */
export const BATCH_OF = new WeakMap<THREE.Material, Record<string, { value: unknown }>>();

/** each kind's pictures joined into one array, mip level by mip level: every layer must be the same size and format */
function join(texs: THREE.CompressedTexture[], srgb: boolean): THREE.CompressedArrayTexture {
  const mipsOf = (t: THREE.CompressedTexture) => (t.mipmaps ?? []) as Array<{ data: Uint8Array; width: number; height: number }>;
  const first = texs[0];
  const { width, height } = first.image as { width: number; height: number };
  const levels = mipsOf(first).length;
  for (const t of texs) {
    const im = t.image as { width: number; height: number };
    if (t.format !== first.format || im.width !== width || im.height !== height || mipsOf(t).length !== levels)
      throw new Error(`a batch's layers differ: ${first.format} ${width}x${height} ${levels} mips, and ${t.format} ${im.width}x${im.height} ${mipsOf(t).length}`);
  }
  const mipmaps: Array<{ data: Uint8Array; width: number; height: number }> = [];
  for (let l = 0; l < levels; l++) {
    const m0 = mipsOf(first)[l];
    const size = m0.data.byteLength;
    const data = new Uint8Array(size * texs.length);
    texs.forEach((t, i) => {
      const d = mipsOf(t)[l].data;
      if (d.byteLength !== size) throw new Error(`a batch's layer ${i} is ${d.byteLength} bytes at mip ${l}, not ${size}`);
      data.set(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), i * size);
    });
    mipmaps.push({ data, width: m0.width, height: m0.height });
  }
  const arr = new THREE.CompressedArrayTexture(mipmaps as unknown as ImageData[], width, height, texs.length, first.format as THREE.CompressedPixelFormat, first.type);
  arr.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  arr.wrapS = arr.wrapT = THREE.RepeatWrapping;
  arr.magFilter = THREE.LinearFilter;
  arr.minFilter = levels > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  arr.anisotropy = first.anisotropy;
  arr.generateMipmaps = false;
  arr.needsUpdate = true;
  return arr;
}

/** every batch of a loaded file joined and its material taught to read it: how many batches */
export async function applyBatches(gltf: GLTF): Promise<{ batches: number; materials: number; layers: number }> {
  const mats = new Set<THREE.MeshStandardMaterial>();
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && !Array.isArray(m) && m.userData?.batch) mats.add(m);
  });
  // (the extras name images; a texture entry is what the loader loads, found by its image: detailmaps.ts does the same)
  const byImage = new Map<number, number>();
  ((gltf.parser.json.textures ?? []) as Array<{ source?: number; extensions?: Record<string, { source?: number }> }>).forEach((t, k) => {
    const src = t.extensions?.KHR_texture_basisu?.source ?? t.source;
    if (src !== undefined && !byImage.has(src)) byImage.set(src, k);
  });
  let [materials, layers] = [0, 0];
  for (const m of mats) {
    const b = m.userData.batch as Batch;
    const arrays: Record<string, THREE.CompressedArrayTexture> = {};
    for (const [kind, srgb] of KINDS) {
      const texs = (await Promise.all(
        b.layers[kind].map((img) => {
          const i = byImage.get(img);
          if (i === undefined) throw new Error(`batch ${b.k}: no texture for its ${kind} layer's image ${img}`);
          return gltf.parser.getDependency("texture", i);
        }),
      )) as THREE.CompressedTexture[];
      arrays[kind] = join(texs, srgb);
      // (the layers were never drawn, so nothing of theirs is on the GPU: their pictures let go)
      for (const t of texs) t.mipmaps = [];
      layers += texs.length;
    }
    const table = new THREE.DataTexture(new Float32Array(b.table), b.width, b.rows, THREE.RGBAFormat, THREE.FloatType);
    table.minFilter = table.magFilter = THREE.NearestFilter;
    table.needsUpdate = true;
    patch(m, arrays, table);
    materials += b.rows;
  }
  return { batches: mats.size, materials, layers };
}

/**
 * The batch's material reading its arrays. Its own maps are the file's white and a stand-in normal map (for the tangent
 * frame and the normal scale's sign the loader gives a glTF normal map); each lookup is its row's layer in the kind's
 * array, times its row's numbers: (0) the colour, (1) the glow and the normal's scale, (2) roughness, metal and the
 * occlusion's strength, (3) the layers. The glow is set before three's own emissive chunk, whose include line stays:
 * the decay adds its own glow after it (world.ts teachDecay). Measured on the graphics card (Milestone 657): the row
 * read per vertex and handed on flat costs less than read per fragment, and a branch round each lookup to skip a
 * neutral layer cost more than it saved
 */
function patch(m: THREE.MeshStandardMaterial, arrays: Record<string, THREE.CompressedArrayTexture>, table: THREE.DataTexture): void {
  const uniforms = {
    uBColor: { value: arrays.color },
    uBNormal: { value: arrays.normal },
    uBOrm: { value: arrays.orm },
    uBGlow: { value: arrays.emissive },
    uBTable: { value: table },
  };
  BATCH_OF.set(m, uniforms);
  m.defines = { ...(m.defines ?? {}), USE_UV: "" };
  const ao = THREE.ShaderChunk.aomap_fragment.replace("#ifdef USE_AOMAP", "#if 1").replace("( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0", "( bOrm.r - 1.0 ) * bRow2.z + 1.0");
  const normal = THREE.ShaderChunk.normal_fragment_maps
    .replace("vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;", "vec3 mapN = texture( uBNormal, vec3( vNormalMapUv, bLayer.y ) ).xyz * 2.0 - 1.0;")
    .replace("mapN.xy *= normalScale;", "mapN.xy *= normalScale * bRow1.w;");
  if (!ao.includes("bOrm.r") || !normal.includes("uBNormal") || !normal.includes("bRow1.w")) throw new Error("three's shader chunks have changed: the batches' patch no longer fits them");
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float _matid;\nuniform highp sampler2D uBTable;\nflat varying vec4 vBRow0;\nflat varying vec4 vBRow1;\nflat varying vec4 vBRow2;\nflat varying vec4 vBLayer;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  {
    int bRow = int(_matid + 0.5);
    vBRow0 = texelFetch(uBTable, ivec2(0, bRow), 0);
    vBRow1 = texelFetch(uBTable, ivec2(1, bRow), 0);
    vBRow2 = texelFetch(uBTable, ivec2(2, bRow), 0);
    vBLayer = texelFetch(uBTable, ivec2(3, bRow), 0);
  }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform highp sampler2DArray uBColor;
uniform highp sampler2DArray uBNormal;
uniform highp sampler2DArray uBOrm;
uniform highp sampler2DArray uBGlow;
flat varying vec4 vBRow0;
flat varying vec4 vBRow1;
flat varying vec4 vBRow2;
flat varying vec4 vBLayer;
vec4 bRow0;
vec4 bRow1;
vec4 bRow2;
vec4 bLayer;
vec4 bOrm;`,
      )
      .replace(
        "void main() {",
        `void main() {
  bRow0 = vBRow0;
  bRow1 = vBRow1;
  bRow2 = vBRow2;
  bLayer = vBLayer;
  bOrm = texture(uBOrm, vec3(vUv, bLayer.z));`,
      )
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= bRow0.rgb * texture(uBColor, vec3(vUv, bLayer.x)).rgb;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nroughnessFactor = bRow2.x * bOrm.g;\nmetalnessFactor = bRow2.y * bOrm.b;")
      .replace("#include <normal_fragment_maps>", normal)
      .replace("#include <aomap_fragment>", ao)
      .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance = bRow1.rgb * texture(uBGlow, vec3(vUv, bLayer.w)).rgb;\n#include <emissivemap_fragment>");
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|nbatch`;
  m.needsUpdate = true;
}
