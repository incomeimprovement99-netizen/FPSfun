// A city past the fence (Milestone 680). Both fresh reviews of 2026-10-20 found the map's edge "a tabletop floating in
// beige haze" and asked first for a city carried on past the wall. So the ground goes on past the fence, and past the
// out-of-bounds margin a ring of tower blocks stands to the horizon. None of it is stood in or shot: it is drawn, and
// nothing else.
//
// One instanced mesh for every tower and one for the ground. The windows are worked out in the shader from where each
// fragment stands: a storey `storey` high, a bay `bay` wide, about `lit` of the windows lit, a fixed hash a window. So a
// tower of any size gets windows its own size, with no texture to stretch. They glow by night and barely by day. The
// numbers are in src/config/world.json `skyline`.
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

/** whether a rectangle [x0, x1, z0, z1] (map metres) reaches into one kept clear (`keep`: the firing range's footprint) */
const kept = (x0: number, x1: number, z0: number, z1: number) => S.keep.some(([a0, a1, b0, b1]) => x1 > a0 && x0 < a1 && z1 > b0 && z0 < b1);

/** a rectangle less the kept ones, as the rectangles left */
function cut(r: number[]): number[][] {
  let out = [r];
  for (const [a0, a1, b0, b1] of S.keep)
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

/** the towers' windows lit for the hour: bright by night, a glint by day; and how far the haze takes the far ones */
export function skylineHour(day: boolean): void {
  glow.value = day ? S.glow.day : S.glow.night;
  haze.value = day ? S.haze.day : S.haze.night;
}

/** what was built, for the checks: the towers' footprints in the map's own metres, and the ground's reach */
export const SKYLINE: { towers: Array<{ x: number; z: number; w: number; d: number; h: number; y: number }>; ground: number } = { towers: [], ground: 0 };

export function buildSkyline(root: THREE.Object3D): void {
  const rnd = seeded(S.seed);
  SKYLINE.towers.length = 0;
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
      SKYLINE.towers.push({ x: +(x + jx).toFixed(2), z: +(z + jz).toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), h: +h.toFixed(1), y: 0 });
      // (a narrower block on top of some, not the tall ones, which already stand out: a skyline's broken line, not a
      // row of flat-topped boxes)
      if (!tall && rnd() < S.setback.share) {
        const k = S.setback.scale[0] + rnd() * (S.setback.scale[1] - S.setback.scale[0]);
        const sh = h * (S.setback.height[0] + rnd() * (S.setback.height[1] - S.setback.height[0]));
        SKYLINE.towers.push({ x: +(x + jx).toFixed(2), z: +(z + jz).toFixed(2), w: +(w * k).toFixed(2), d: +(d * k).toFixed(2), h: +sh.toFixed(1), y: +h.toFixed(1) });
      }
    }
  // (each block its own shade, by instance: the body colour is white and the instances carry the shades)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.15 });
  // (past the fence, out of the decay's reach: its own shader would take this one's place, world.ts holdForDecay)
  mat.userData.decay = true;
  const warm = new THREE.Color(S.warm);
  const cool = new THREE.Color(S.cool);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSkyGlow = glow;
    sh.uniforms.uSkyHaze = haze;
    sh.uniforms.uSkyWarm = { value: warm };
    sh.uniforms.uSkyCool = { value: cool };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSkyPos;\nvarying vec3 vSkyN;\nvarying float vSkyId;\nvarying vec2 vSkyMap;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvSkyPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvSkyN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);\nvSkyId = float(gl_InstanceID);\nvSkyMap = (instanceMatrix * vec4(transformed, 1.0)).xz;"
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vSkyPos;\nvarying vec3 vSkyN;\nvarying float vSkyId;\nvarying vec2 vSkyMap;\nuniform float uSkyGlow;\nuniform float uSkyHaze;\nuniform vec3 uSkyWarm;\nuniform vec3 uSkyCool;`
      )
      // (the far blocks into the haze faster than the map's own fog, which is set for the map's own distances)
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        #ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, uSkyHaze * smoothstep(${S.inner.toFixed(1)}, ${S.outer.toFixed(1)}, max(abs(vSkyMap.x), abs(vSkyMap.y))));
        #endif`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 an = abs(vSkyN);
          if (an.y < 0.5) {
            vec2 f = an.x > an.z ? vec2(vSkyPos.z, vSkyPos.y) : vec2(vSkyPos.x, vSkyPos.y);
            vec2 g = f / vec2(${S.bay.toFixed(2)}, ${S.storey.toFixed(2)});
            vec2 cell = floor(g);
            vec2 q = fract(g);
            float win = step(0.18, q.x) * step(q.x, 0.82) * step(0.3, q.y) * step(q.y, 0.78);
            float h = fract(sin(dot(cell + vec2(vSkyId * 13.7, vSkyId * 3.1), vec2(12.9898, 78.233))) * 43758.5453);
            float on = step(${(1 - S.lit).toFixed(3)}, h);
            vec3 wc = mix(uSkyWarm, uSkyCool, step(0.62, fract(h * 7.31)));
            totalEmissiveRadiance += win * on * wc * uSkyGlow;
          }
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
  const ground = new THREE.Group();
  ground.name = "skylineGround";
  // (in pieces round the firing range, whose own floor is at the same height)
  for (const [x0, x1, z0, z1] of strips.flatMap(cut)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), gmat);
    m.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.userData.dynamic = true;
    ground.add(m);
  }
  root.add(ground);
  SKYLINE.ground = G;
}
