// A city past the fence (Milestone 680). Both fresh reviews of 2026-10-20 found the map's edge "a tabletop floating in
// beige haze" and asked first for a city carried on past the wall. So the ground goes on past the fence, and past the
// out-of-bounds margin a ring of tower blocks stands to the horizon. None of it is stood in or shot: it is drawn, and
// nothing else.
//
// One instanced mesh for every tower and one for the ground. The windows are worked out in the shader from where each
// fragment stands: a storey `storey` high, a bay `bay` wide, about `lit` of the windows lit, a fixed hash a window. So a
// tower of any size gets windows its own size, with no texture to stretch. They glow by night and barely by day. The
// numbers are in src/config/world.json `skyline`.
//
// Since Milestone 1076 (the nineteenth reviews, all four: "untextured boxes with dot windows", "flat boxes ... some seeming
// to float over grey ground", "low-detail copies of pack buildings, or thicken the fog") the first rows are the pack's own
// backdrop buildings, baked with the city (tools/neon-layout.ts rules.backdrop) and handed in as `backdrop`, and no box of
// this file stands where they do. The towers past them wear a facade worked out the same way (`facade`), and the ground
// is shaded at the foot of every block and paved round it (`field`).
import * as THREE from "three";
import worldCfg from "../config/world.json";
import { BR_HALF } from "./br";

const S = worldCfg.skyline;

/** a seeded random (mulberry32): the same skyline on every page */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the rectangles [x0, x1, z0, z1] (map metres) kept clear (`keep`; none since round 9) */
const KEEP = S.keep as unknown as number[][];
/** whether a rectangle reaches into one kept clear */
const kept = (x0: number, x1: number, z0: number, z1: number) => KEEP.some(([a0, a1, b0, b1]) => x1 > a0 && x0 < a1 && z1 > b0 && z0 < b1);

/** a rectangle less the kept ones, as the rectangles left */
function cut(r: number[]): number[][] {
  let out = [r];
  for (const [a0, a1, b0, b1] of KEEP)
    out = out.flatMap(([x0, x1, z0, z1]) => {
      if (!(x1 > a0 && x0 < a1 && z1 > b0 && z0 < b1)) return [[x0, x1, z0, z1]];
      // (the strips either side of the hole across its whole depth, then the bits above and below it)
      return [
        [x0, Math.max(x0, a0), z0, z1],
        [Math.min(x1, a1), x1, z0, z1],
        [Math.max(x0, a0), Math.min(x1, a1), z0, Math.max(z0, b0)],
        [Math.max(x0, a0), Math.min(x1, a1), Math.min(z1, b1), z1],
      ].filter(([p0, p1, q0, q1]) => p1 - p0 > 0.01 && q1 - q0 > 0.01);
    });
  return out;
}

const glow = { value: S.glow.night };
const haze = { value: S.haze.night };
type Facade = { slab: number; slabK: number; glass: string; glassRough: number; styles: number[][]; share: number[]; cap: number; capK: number; base: number; baseK: number; shop: number[]; shopLit: number; foot: number; footK: number; roof: string; rim: number; rimK: number; body: { day: number; night: number } };
const FA = (S as unknown as { facade?: Facade }).facade;
/** the walls' light for the hour (Milestone 1076): the pack's own colours by day, by night as dark as the boxes were */
const body = { value: FA ? FA.body.night : 1 };
type Field = { res: number; reach: number; far: number; shade: number; shadeK: number; kerb: number; paveK: number; roadK: number };
const FIELD = (S as unknown as { field?: Field }).field;
/** the lit roads' material, for the hour (skylineHour) */
let roadMat: THREE.MeshBasicMaterial | null = null;
/** the ground past the fence's material, for the hour: asphalt by day, near black by night */
let groundMat: THREE.MeshStandardMaterial | null = null;
type Roads = { from: number; to: number; every: number; w: number; dash?: { len: number; every: number }; colour: string; glow: { day: number; night: number } };
const ROADS = (S as unknown as { roads?: Roads }).roads;
type Ring = { from: number; to: number; colour: string; paint: string; w: number; lines: number[][]; dash: { len: number; every: number } };
const RING = (S as unknown as { ring?: Ring }).ring;

/** the towers' windows lit for the hour: bright by night, a glint by day; and how far the haze takes the far ones */
export function skylineHour(day: boolean): void {
  glow.value = day ? S.glow.day : S.glow.night;
  haze.value = day ? S.haze.day : S.haze.night;
  if (FA) body.value = day ? FA.body.day : FA.body.night;
  groundMat?.color.set(day ? S.groundDay : S.groundColour);
  if (roadMat && ROADS) {
    roadMat.color.set(ROADS.colour).multiplyScalar(day ? ROADS.glow.day : ROADS.glow.night);
    roadMat.visible = (day ? ROADS.glow.day : ROADS.glow.night) > 0;
  }
}

/**
 * what was built, for the checks: the towers' footprints in the map's own metres, the ground's reach, the map's backdrop
 * (its baked buildings' footprints, [x0, x1, z0, z1, top]) and the ground's field (each texel's distance to the nearest
 * wall, `far` at 255)
 */
export const SKYLINE: {
  towers: Array<{ x: number; z: number; w: number; d: number; h: number; y: number }>;
  ground: number;
  backdrop: number[][];
  field: { n: number; res: number; reach: number; far: number; data: Uint8Array } | null;
} = { towers: [], ground: 0, backdrop: [], field: null };

/** `backdrop`: the map's own buildings past the fence, [x0, x1, z0, z1, top] (neonmap.json backdrop.blocks) */
export function buildSkyline(root: THREE.Object3D, backdrop: number[][] = []): void {
  const rnd = seeded(S.seed);
  SKYLINE.towers.length = 0;
  SKYLINE.backdrop = backdrop;
  // (none of this file's boxes on the map's backdrop, a metre clear of it: the two stood inside one another)
  const onBackdrop = (x0: number, x1: number, z0: number, z1: number) => backdrop.some(([a0, a1, b0, b1]) => x1 > a0 - 1 && x0 < a1 + 1 && z1 > b0 - 1 && z0 < b1 + 1);
  // (each setback stepped toward a side by up to `shift` of the room it has, Milestone 1076, from a sequence of its own so
  // every tower stands where it stood: centred, the tops read as stacked boxes from the lookout)
  const SB = S.setback as { share: number; scale: number[]; height: number[]; shift?: number };
  const step = seeded(S.seed + 5);
  // the towers: a jittered grid of `cell` metre squares over the square out to `outer`, none inside `inner` (past the
  // out-of-bounds margin, so nobody walks into one), each square filled by `fill`, a few `tall`
  for (let x = -S.outer + S.cell / 2; x < S.outer; x += S.cell)
    for (let z = -S.outer + S.cell / 2; z < S.outer; z += S.cell) {
      if (Math.max(Math.abs(x), Math.abs(z)) < S.inner) continue;
      if (rnd() > S.fill) continue;
      const [w, d] = [S.size[0] + rnd() * (S.size[1] - S.size[0]), S.size[0] + rnd() * (S.size[1] - S.size[0])];
      // (low by the fence and rising toward the horizon, so the map's own towers keep the skyline over the near
      // blocks: from the 50 m lookout an even ring stood as one wall over all of it)
      const far = (Math.max(Math.abs(x), Math.abs(z)) - S.inner) / (S.outer - S.inner);
      const tall = far > S.tall.from && rnd() < S.tall.share;
      const h = tall ? S.tall.height[0] + rnd() * (S.tall.height[1] - S.tall.height[0]) : S.height[0] + (S.height[1] - S.height[0]) * (0.6 * far ** 1.5 + 0.4 * rnd() * rnd());
      const jx = (rnd() - 0.5) * (S.cell - w);
      const jz = (rnd() - 0.5) * (S.cell - d);
      // (none in the firing range, which stands past the fence inside the ring)
      if (kept(x + jx - w / 2, x + jx + w / 2, z + jz - d / 2, z + jz + d / 2)) continue;
      const tower = { x: +(x + jx).toFixed(2), z: +(z + jz).toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), h: +h.toFixed(1), y: 0 };
      // (a narrower block on top of some, not the tall ones, which already stand out: a skyline's broken line, not a
      // row of flat-topped boxes)
      let setback: typeof tower | null = null;
      if (!tall && rnd() < S.setback.share) {
        const k = S.setback.scale[0] + rnd() * (S.setback.scale[1] - S.setback.scale[0]);
        const sh = h * (S.setback.height[0] + rnd() * (S.setback.height[1] - S.setback.height[0]));
        const [ox, oz] = SB.shift ? [(step() - 0.5) * (1 - k) * w * SB.shift, (step() - 0.5) * (1 - k) * d * SB.shift] : [0, 0];
        setback = { x: +(x + jx + ox).toFixed(2), z: +(z + jz + oz).toFixed(2), w: +(w * k).toFixed(2), d: +(d * k).toFixed(2), h: +sh.toFixed(1), y: +h.toFixed(1) };
      }
      // (given up after all its draws, so the towers after it stand where they stood)
      if (onBackdrop(tower.x - tower.w / 2, tower.x + tower.w / 2, tower.z - tower.d / 2, tower.z + tower.d / 2)) continue;
      SKYLINE.towers.push(tower);
      if (setback) SKYLINE.towers.push(setback);
    }
  // the low blocks between the out-of-bounds margin and the towers (Milestone 771; the districts' fourth review: past the
  // fence "a dark empty moat" made the map "a model on a black table", worst at night): `low.from` to `inner` metres out,
  // shorter and closer set, lit as the towers are, from a random sequence of their own so every tower stands where it stood
  const L = (S as unknown as { low?: { from: number; cell: number; fill: number; size: number[]; height: number[] } }).low;
  // (not where the map has its own backdrop, Milestone 1076: the pack's buildings stand in this band)
  if (L && !backdrop.length) {
    const lr = seeded(S.seed + 2);
    for (let x = -S.inner + L.cell / 2; x < S.inner; x += L.cell)
      for (let z = -S.inner + L.cell / 2; z < S.inner; z += L.cell) {
        const [w, d] = [L.size[0] + lr() * (L.size[1] - L.size[0]), L.size[0] + lr() * (L.size[1] - L.size[0])];
        const [jx, jz] = [(lr() - 0.5) * (L.cell - w), (lr() - 0.5) * (L.cell - d)];
        const h = L.height[0] + lr() * (L.height[1] - L.height[0]);
        const on = lr() < L.fill;
        // (wholly in the band: nearest edge past `from`, farthest inside `inner`)
        const [nx, nz] = [Math.abs(x + jx) - w / 2, Math.abs(z + jz) - d / 2];
        const [fx, fz] = [Math.abs(x + jx) + w / 2, Math.abs(z + jz) + d / 2];
        if (!on || Math.max(nx, nz) < L.from || Math.max(fx, fz) > S.inner) continue;
        if (kept(x + jx - w / 2, x + jx + w / 2, z + jz - d / 2, z + jz + d / 2)) continue;
        SKYLINE.towers.push({ x: +(x + jx).toFixed(2), z: +(z + jz).toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), h: +h.toFixed(1), y: 0 });
      }
  }
  // (each block its own shade, by instance: the body colour is white and the instances carry the shades)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.15 });
  // (past the fence, out of the decay's reach: its own shader would take this one's place, world.ts holdForDecay)
  mat.userData.decay = true;
  const warm = new THREE.Color(S.warm);
  const cool = new THREE.Color(S.cool);
  // the facade (Milestone 1076; the districts' thirteenth reviews: "storey lines, roof clutter and set-back silhouettes",
  // "roof caps ... and a dark base"): each storey's slab edge a band `slab` of it high, `slabK` the wall's light; the
  // glass dark in every window of the block's own style (`styles` [x0, x1, y0, y1] of a bay and a storey, `share` of the
  // blocks each), so the unlit windows show by day as the pack's black glass does; the top `cap` metres a coping, `capK`;
  // the ground storey, `base` metres, a shop front `baseK` dark with one wide window a bay (`shop`, of the bay and of the
  // storey), lit `shopLit` as often as the windows over it are; the foot shaded over `foot` metres down to `footK`; the
  // roof the pack's concrete, `roof`, its coping lighter, `rimK`, `rim` metres in from its edges
  const F = FA ?? { styles: [[0.18, 0.82, 0.3, 0.78]], share: [1] } as Partial<Facade> & { styles: number[][]; share: number[] };
  const g2 = (v: number) => v.toFixed(3);
  const style = (i: number) => `vec4(${F.styles[i].map(g2).join(", ")})`;
  let pick = style(F.styles.length - 1);
  for (let i = F.styles.length - 2, s = F.share.slice(0, -1).reduce((a, b) => a + b, 0); i >= 0; s -= F.share[i], i--) pick = `kind < ${g2(s)} ? ${style(i)} : ${pick}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSkyGlow = glow;
    sh.uniforms.uSkyHaze = haze;
    sh.uniforms.uSkyWarm = { value: warm };
    sh.uniforms.uSkyCool = { value: cool };
    sh.uniforms.uSkyBody = body;
    sh.uniforms.uSkyGlass = { value: new THREE.Color(FA?.glass ?? "#000000") };
    sh.uniforms.uSkyRoof = { value: new THREE.Color(FA?.roof ?? "#ffffff") };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSkyPos;\nvarying vec3 vSkyN;\nvarying float vSkyId;\nvarying vec2 vSkyMap;\nvarying vec3 vSkyLocal;\nvarying vec3 vSkySize;\nvarying float vSkyBase;")
      .replace(
        "#include <worldpos_vertex>",
        // (the block's own box: where in it the vertex is, 0 to 1 up and a half each way across, its size and its foot)
        "#include <worldpos_vertex>\nvSkyPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvSkyN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);\nvSkyId = float(gl_InstanceID);\nvSkyMap = (instanceMatrix * vec4(transformed, 1.0)).xz;\nvSkyLocal = transformed;\nvSkySize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));\nvSkyBase = instanceMatrix[3].y;"
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vSkyPos;\nvarying vec3 vSkyN;\nvarying float vSkyId;\nvarying vec2 vSkyMap;\nvarying vec3 vSkyLocal;\nvarying vec3 vSkySize;\nvarying float vSkyBase;\nuniform float uSkyGlow;\nuniform float uSkyHaze;\nuniform vec3 uSkyWarm;\nuniform vec3 uSkyCool;\nuniform float uSkyBody;\nuniform vec3 uSkyGlass;\nuniform vec3 uSkyRoof;`
      )
      // (the far blocks into the haze faster than the map's own fog, which is set for the map's own distances)
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        #ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, uSkyHaze * smoothstep(${S.inner.toFixed(1)}, ${S.outer.toFixed(1)}, max(abs(vSkyMap.x), abs(vSkyMap.y))));
        #endif`
      )
      // (worked out once, after the roughness and the metalness are read: the glass takes its own, and the emission below
      // lights only the windows found here)
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        float skWin = 0.0;
        float skShop = 0.0;
        vec2 skCell = vec2(0.0);
        {
          vec3 an = abs(vSkyN);
          float kind = fract(sin(vSkyId * 91.7 + 3.1) * 43758.5453);
          if (an.y < 0.5) {
            vec2 f = an.x > an.z ? vec2(vSkyPos.z, vSkyPos.y) : vec2(vSkyPos.x, vSkyPos.y);
            vec2 g = f / vec2(${S.bay.toFixed(2)}, ${S.storey.toFixed(2)});
            skCell = floor(g);
            vec2 q = fract(g);
            vec4 wr = ${pick};
            skWin = step(wr.x, q.x) * step(q.x, wr.y) * step(wr.z, q.y) * step(q.y, wr.w);
            ${
              FA
                ? `float slab = 1.0 - step(${g2(FA.slab)}, q.y);
            float cap = 1.0 - step(${g2(FA.cap)}, vSkySize.y * (1.0 - vSkyLocal.y));
            float shop = (1.0 - step(${g2(FA.base)}, vSkyPos.y)) * (1.0 - step(0.01, vSkyBase));
            float sy = vSkyPos.y / ${g2(FA.base)};
            skShop = shop * step(${g2(FA.shop[0])}, q.x) * step(q.x, ${g2(FA.shop[1])}) * step(${g2(FA.shop[2])}, sy) * step(sy, ${g2(FA.shop[3])});
            skWin = max(skWin * (1.0 - slab) * (1.0 - cap) * (1.0 - shop), skShop);
            diffuseColor.rgb *= uSkyBody * mix(1.0, ${g2(FA.slabK)}, slab) * mix(1.0, ${g2(FA.capK)}, cap) * mix(1.0, ${g2(FA.baseK)}, shop);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSkyGlass * uSkyBody, skWin);
            roughnessFactor = mix(roughnessFactor, ${g2(FA.glassRough)}, skWin);
            metalnessFactor = mix(metalnessFactor, 0.0, skWin);
            diffuseColor.rgb *= mix(${g2(FA.footK)}, 1.0, smoothstep(0.0, ${g2(FA.foot)}, vSkyPos.y));`
                : ""
            }
          }${
            FA
              ? ` else {
            vec2 e = vSkySize.xz * (0.5 - abs(vSkyLocal.xz));
            float rim = 1.0 - step(${g2(FA.rim)}, min(e.x, e.y));
            diffuseColor.rgb = uSkyRoof * uSkyBody * mix(1.0, ${g2(FA.rimK)}, rim) * (0.85 + 0.3 * kind);
          }`
              : ""
          }
        }`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float h = fract(sin(dot(skCell + vec2(vSkyId * 13.7, vSkyId * 3.1), vec2(12.9898, 78.233))) * 43758.5453);
          float on = max(step(${(1 - S.lit).toFixed(3)}, h), skShop * step(${(1 - Math.min(1, S.lit * (FA?.shopLit ?? 1))).toFixed(3)}, h));
          vec3 wc = mix(uSkyWarm, uSkyCool, step(0.62, fract(h * 7.31)));
          totalEmissiveRadiance += skWin * on * wc * uSkyGlow;
        }`
      );
  };
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const towers = new THREE.InstancedMesh(box, mat, SKYLINE.towers.length);
  const m4 = new THREE.Matrix4();
  const shades = S.bodies.map((c) => new THREE.Color(c));
  const shade = seeded(S.seed + 1);
  let k = 0;
  SKYLINE.towers.forEach((t, i) => {
    towers.setMatrixAt(i, m4.makeScale(t.w, t.h, t.d).setPosition(t.x, t.y, t.z));
    // (a setback wears its tower's shade)
    if (t.y === 0) k = Math.floor(shade() * shades.length);
    towers.setColorAt(i, shades[k]);
  });
  towers.name = "skyline";
  towers.frustumCulled = false;
  towers.userData.dynamic = true;
  root.add(towers);
  // the ground carried on past the fence: four slabs round the map's own ground (which runs on `from` metres past the
  // fence; not one slab under it all, which would show through the metro's and the Well's floors below the street), out
  // to `ground`
  const G = S.ground;
  const in0 = BR_HALF + S.from;
  const strips = [
    [-G, G, -G, -in0],
    [-G, G, in0, G],
    [-G, -in0, -in0, in0],
    [in0, G, -in0, in0],
  ];
  const gmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.groundColour), roughness: 1, metalness: 0 });
  gmat.userData.decay = true;
  groundMat = gmat;
  // the ground's field (Milestone 1076; the districts' thirteenth reviews: "some seeming to float over grey ground", "a dark
  // base with a contact shadow so they sit on the ground"): a texel every `res` metres out to `reach`, each the distance
  // to the nearest wall of a block on the ground (the backdrop's and the towers'), out to `far`. The ground reads it: shaded
  // to `shadeK` at a wall and to its own light `shade` metres out, a pavement `paveK` as light out to the kerb, `kerb`
  // metres, the road past it `roadK`. The blocks stand on the ground the sun's shadows do not reach out here (the map's
  // shadow covers the map), and in a flat grey one they floated
  if (FIELD) {
    const n = Math.ceil((2 * FIELD.reach) / FIELD.res);
    const data = new Uint8Array(n * n).fill(255);
    const at = (i: number) => -FIELD.reach + (i + 0.5) * FIELD.res;
    const span = (a: number, b: number) => [Math.max(0, Math.floor((a - FIELD.far + FIELD.reach) / FIELD.res)), Math.min(n - 1, Math.ceil((b + FIELD.far + FIELD.reach) / FIELD.res))];
    for (const [x0, x1, z0, z1] of [...SKYLINE.towers.filter((t) => t.y === 0).map((t) => [t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2]), ...backdrop]) {
      const [i0, i1] = span(x0, x1);
      const [j0, j1] = span(z0, z1);
      for (let j = j0; j <= j1; j++) {
        const z = at(j);
        const dz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
        const [dz2, row] = [dz * dz, j * n];
        for (let i = i0; i <= i1; i++) {
          const x = at(i);
          const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
          const v = Math.min(255, Math.round((Math.sqrt(dx * dx + dz2) / FIELD.far) * 255));
          if (v < data[row + i]) data[row + i] = v;
        }
      }
    }
    SKYLINE.field = { n, res: FIELD.res, reach: FIELD.reach, far: FIELD.far, data };
    const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    const f2 = (v: number) => v.toFixed(3);
    gmat.onBeforeCompile = (sh) => {
      sh.uniforms.uSkyField = { value: tex };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vSkyG;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSkyG = transformed.xz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vSkyG;\nuniform sampler2D uSkyField;").replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec2 fuv = vSkyG / ${f2(2 * FIELD.reach)} + 0.5;
          if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
            float d = texture2D(uSkyField, fuv).r * ${f2(FIELD.far)};
            diffuseColor.rgb *= mix(${f2(FIELD.shadeK)}, 1.0, smoothstep(0.0, ${f2(FIELD.shade)}, d)) * mix(${f2(FIELD.paveK)}, ${f2(FIELD.roadK)}, smoothstep(${f2(FIELD.kerb - 0.15)}, ${f2(FIELD.kerb + 0.15)}, d));
          }
        }`
      );
    };
  }
  const ground = new THREE.Group();
  ground.name = "skylineGround";
  // (in pieces round the firing range, whose own floor is at the same height; each laid in the map's own metres, so its
  // shader reads where it stands off its own vertices)
  for (const [x0, x1, z0, z1] of strips.flatMap(cut)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), gmat);
    m.position.set(0, -0.02, 0);
    m.receiveShadow = true;
    m.userData.dynamic = true;
    ground.add(m);
  }
  root.add(ground);
  SKYLINE.ground = G;
  // the ring road past the fence (Milestone 1062; the districts' tenth reviews: "a grey moat ... past the fence, a stage in a void",
  // "the edge part of the world: a raised highway or barrier wall"): an asphalt band all round from `ring.from` to
  // `ring.to` metres out, in the out-of-bounds margin and short of the low blocks, its lane lines `lines` [metres in from
  // its inner edge, dashed 0 or 1] painted on it, so the city ends on a road and not on a flat grey field. Drawn only, a
  // hair over the ground (and pulled forward in the depth test, as at the map's distances the two would fight)
  if (RING) {
    const band = new THREE.MeshStandardMaterial({ color: new THREE.Color(RING.colour), roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const paint = new THREE.MeshStandardMaterial({ color: new THREE.Color(RING.paint), roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    band.userData.decay = true;
    paint.userData.decay = true;
    const ring = new THREE.Group();
    ring.name = "skylineRing";
    const [a, b] = [RING.from, RING.to];
    for (const [x0, x1, z0, z1] of [
      [-b, b, -b, -a],
      [-b, b, a, b],
      [-b, -a, -a, a],
      [a, b, -a, a],
    ]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), band);
      m.position.set((x0 + x1) / 2, -0.01, (z0 + z1) / 2);
      m.receiveShadow = true;
      m.userData.dynamic = true;
      ring.add(m);
    }
    // (each line a square of half side `a + off`, its four sides, dashed or whole)
    const lines: number[][] = [];
    for (const [off, dashed] of RING.lines) {
      const r = a + off;
      const spans: number[][] = [];
      if (dashed) for (let s = -r + (RING.dash.every - RING.dash.len) / 2; s + RING.dash.len <= r + 1e-6; s += RING.dash.every) spans.push([s, s + RING.dash.len]);
      else spans.push([-r, r]);
      for (const [p, q] of spans)
        for (const c of [-r, r]) {
          lines.push([p, q, c - RING.w / 2, c + RING.w / 2]);
          lines.push([c - RING.w / 2, c + RING.w / 2, p, q]);
        }
    }
    const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), paint, lines.length);
    const m4 = new THREE.Matrix4();
    lines.forEach(([x0, x1, z0, z1], i) => marks.setMatrixAt(i, m4.makeScale(x1 - x0, 1, z1 - z0).setPosition((x0 + x1) / 2, -0.005, (z0 + z1) / 2)));
    marks.name = "skylineRingLines";
    marks.frustumCulled = false;
    marks.userData.dynamic = true;
    ring.add(marks);
    root.add(ring);
  }
  // the city's lit roads past the fence (Milestone 813; the districts' fifth review: "put something visible in the dark
  // band (a lit elevated road or a canal)", "at night ... the moat is a black void"): a grid of lit lines on the ground
  // every `every` metres from `from` out to `to`, between the low blocks, none inside the map's square
  if (ROADS) {
    const lines: number[][] = [];
    // (a line along x at z `c` (or along z at x `c`) from a to b, cut where a block stands on it, half a metre clear of
    // its walls: on the cells' edges a block of the full cell's width touched the line, and the outer towers stood on it;
    // the map's own backdrop's blocks too, Milestone 1076)
    const blocks = [...SKYLINE.towers.map((t) => [t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2]), ...backdrop];
    const cut = (alongX: boolean, a: number, b: number, c: number): number[][] => {
      const [c0, c1] = [c - ROADS.w / 2 - 0.5, c + ROADS.w / 2 + 0.5];
      const on = blocks
        .filter(([x0, x1, z0, z1]) => (alongX ? z0 < c1 && z1 > c0 : x0 < c1 && x1 > c0))
        .map(([x0, x1, z0, z1]) => (alongX ? [x0 - 0.5, x1 + 0.5] : [z0 - 0.5, z1 + 0.5]))
        .sort((p, q) => p[0] - q[0]);
      const out: number[][] = [];
      let s = a;
      for (const [h0, h1] of on) {
        if (h1 <= s || h0 >= b) continue;
        if (h0 > s) out.push([s, h0]);
        s = Math.max(s, h1);
      }
      if (s < b) out.push([s, b]);
      return out.filter(([p, q]) => q - p > 1);
    };
    // (and each line as a row of lamps, `dash`: drawn whole, the grid read from the air as a lit floor's lines, not as
    // streets)
    const dashes = (p: number, q: number): number[][] => {
      const D = ROADS.dash;
      if (!D) return [[p, q]];
      const out: number[][] = [];
      for (let s = p + (D.every - D.len) / 2; s + D.len <= q + 1e-6; s += D.every) out.push([s, s + D.len]);
      return out;
    };
    for (let c = -ROADS.to; c <= ROADS.to + 1e-6; c += ROADS.every) {
      const spans = Math.abs(c) < ROADS.from ? [[-ROADS.to, -ROADS.from], [ROADS.from, ROADS.to]] : [[-ROADS.to, ROADS.to]];
      for (const [a, b] of spans) {
        for (const [p, q] of cut(true, a, b, c)) for (const [d0, d1] of dashes(p, q)) lines.push([d0, d1, c - ROADS.w / 2, c + ROADS.w / 2]);
        for (const [p, q] of cut(false, a, b, c)) for (const [d0, d1] of dashes(p, q)) lines.push([c - ROADS.w / 2, c + ROADS.w / 2, d0, d1]);
      }
    }
    roadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ROADS.colour).multiplyScalar(ROADS.glow.night), toneMapped: false });
    roadMat.userData.decay = true;
    const roads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1), roadMat, lines.length);
    const m4 = new THREE.Matrix4();
    lines.forEach(([x0, x1, z0, z1], i) => roads.setMatrixAt(i, m4.makeScale(x1 - x0, 1, z1 - z0).setPosition((x0 + x1) / 2, 0.01, (z0 + z1) / 2)));
    roads.name = "skylineRoads";
    roads.frustumCulled = false;
    roads.userData.dynamic = true;
    root.add(roads);
  }
}
