// The SpeedKills world's shared state, whatever map it is on (it lived in city.ts with the old ILranch city's builder,
// which the owner had taken out on 2026-10-09): the map's sectors and the decay that takes them, the edge's fence, the
// legacy ring's wall, the Spire top the dropship flies past, and the bots' roof routes. The Neon City sets the sectors and
// the Spire top as it is built (neonmap.ts); the numbers are world.json's.
import * as THREE from "three";
import { RANGE_SOLIDS, type Solid } from "./range";
import { emissive } from "./geo";
import { BR_X, BR_Z, BR_HALF } from "./br";
import worldCfg from "../config/world.json";
import neonCfg from "../config/neonmap.json";
import { dissolvedTo, useSectorRects, type SectorPhase, type SectorRect } from "./decay";

/** a sector of the city: its rectangle (map-local), its name, its neon */
export interface Sector {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  accent: number;
}

/** the nine sectors (map-local): the centre, then the eight round it, the Neon City's (useSectors sets the map in play's) */
export const SECTORS: readonly Sector[] = (neonCfg.game.sectors as SectorRect[]).map((s) => ({ ...s, accent: parseInt(s.accent.slice(1), 16) }));

/**
 * The map in play's sectors, set as it is built: the Neon City's its own districts (neonmap.json game.sectors). Every
 * reader holds the same lists (SECTORS here, decay.ts SECTOR_RECTS for the plan, the match's final circle and where a
 * spot stands), so they are filled in place, and the decay's rectangles with them
 */
export function useSectors(list: readonly SectorRect[]): void {
  (SECTORS as Sector[]).splice(0, SECTORS.length, ...list.map((s) => ({ id: s.id, name: s.name, minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ, accent: parseInt(s.accent.slice(1), 16) })));
  useSectorRects(list);
  SECTORS.forEach((s, i) => DECAY.rect[i]?.set(s.minX + BR_X, s.minZ + BR_Z, s.maxX + BR_X, s.maxZ + BR_Z));
}

/** the sector a map-local point is in (the centre's edges belong to it) */
export function sectorAt(x: number, z: number): Sector | null {
  return SECTORS.find((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) ?? null;
}

/** each low tower's way up as graph nodes, door to roof, and the street node it hangs off (-1: none in reach): none on the
 * Neon City yet, so its bots take no roofs by them (brmatch.ts roofFor) */
export const ROOF_ROUTES: Array<{ street: number; nodes: number[]; storeys: number }> = [];
/** the districts' walkways a bot may take and hold as it takes a low tower's roof (bots.json skRoofs): each pad's landing
 * on one, as graph nodes; the pad is the way up (Phase 26.4) */
export const DISTRICT_HOLDS: number[] = [];

/**
 * The Spire's crown deck, world metres: its middle, its roof and its size, and how high the mast on it reaches, set by
 * the Neon City as it is built (its tower's crown). The SpeedKills ship flies past it (dropship.ts shipLine), always
 * near enough to glide onto it.
 */
export const SPIRE_TOP = { x: 0, z: 0, y: 0, w: 0, d: 0, mast: 0 };

// Lit lines climbing a red fence on all four sides, posts along it and a strip on the ground: the map's edge,
// plain in the world and not only on the minimap. Past it a countdown runs (edge.ts). Its materials opt out of
// the decay (userData.decay): the edge sectors dissolving would take the fence with them.
export function buildEdgeFence(root: THREE.Group): void {
  const F = worldCfg.edge.fence;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "rgba(255,255,255,0.9)";
    for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 3);
    const foot = g.createLinearGradient(0, 256, 0, 180);
    foot.addColorStop(0, "rgba(255,255,255,0.9)");
    foot.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = foot;
    g.fillRect(0, 180, 256, 76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set((BR_HALF * 2) / 8, F.height / 8);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(F.color), transparent: true, opacity: F.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true });
  mat.userData.decay = true;
  for (const [x, z, turn] of [
    [0, -BR_HALF, false],
    [0, BR_HALF, false],
    [-BR_HALF, 0, true],
    [BR_HALF, 0, true],
  ] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BR_HALF * 2, F.height), mat);
    m.position.set(x, F.height / 2, z);
    if (turn) m.rotation.y = Math.PI / 2;
    m.name = "edgeFence";
    m.userData.dynamic = true;
    root.add(m);
  }
  const postMat = emissive(parseInt(F.color.slice(1), 16), worldCfg.neonGlow);
  postMat.userData.decay = true;
  const per = Math.round((BR_HALF * 2) / F.postGap);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, F.height, 0.3), postMat, per * 4);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < per; i++) {
    const t = -BR_HALF + i * F.postGap;
    for (const [x, z] of [
      [t, -BR_HALF],
      [BR_HALF, t],
      [-t, BR_HALF],
      [-BR_HALF, -t],
    ] as const) posts.setMatrixAt(n++, m4.makeTranslation(x, F.height / 2, z));
  }
  posts.name = "edgePosts";
  root.add(posts);
  for (const [w, d, x, z] of [
    [BR_HALF * 2, 0.5, 0, -BR_HALF],
    [BR_HALF * 2, 0.5, 0, BR_HALF],
    [0.5, BR_HALF * 2, -BR_HALF, 0],
    [0.5, BR_HALF * 2, BR_HALF, 0],
  ] as const) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), postMat);
    strip.position.set(x, 0.05, z);
    root.add(strip);
  }
  FENCE = { mat, tex, base: F.opacity };
}

/** the legacy ring's wall, scaled to the live ring each frame (SpeedKills' decay has no ring, and draws it nowhere) */
export function buildRingWall(root: THREE.Group): THREE.Mesh {
  const ringWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 120, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2e9a, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
  );
  ringWall.position.y = 60;
  ringWall.userData.dynamic = true;
  ringWall.frustumCulled = false;
  root.add(ringWall);
  return ringWall;
}

/**
 * A map's boxes and materials given to the decay (cityDecay): each box by the sector it stands in, so a decaying
 * sector's boxes leave the collision list as it dissolves, and every material under `root` taught to dissolve. Called
 * again for materials that come later (a file loaded after the map is built: neonmap.ts), with `solids` null
 */
export function holdForDecay(root: THREE.Object3D, solids: Solid[] | null): void {
  if (solids) {
    // each sector's boxes the decay can take (the street and what is under it stay), lowest base first
    DECAY.bySector = SECTORS.map(() => []);
    for (const s of solids) {
      const sector = SECTORS.findIndex((x) => sectorContains(x, (s.minX + s.maxX) / 2 - BR_X, (s.minZ + s.maxZ) / 2 - BR_Z));
      if (sector >= 0 && s.top > 0.001) DECAY.bySector[sector].push(s);
    }
    for (const list of DECAY.bySector) list.sort((a, b) => a.base - b.base);
    DECAY.out = SECTORS.map(() => 0);
  }
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m && !Array.isArray(m)) mats.add(m);
  });
  for (const m of mats) teachDecay(m);
}

const sectorContains = (s: Sector, x: number, z: number): boolean => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;

/**
 * The decay's hold on the city: the shader's numbers every city material
 * reads (each sector's rectangle in world space, how high it has dissolved,
 * whether it is warned), and the city's boxes by sector with the ones taken
 * out of the collision list so far.
 */
/** the edge's fence (Phase 20 A4): its material and texture, which cityEdge brightens near you and scrolls */
let FENCE: { mat: THREE.MeshBasicMaterial; tex: THREE.Texture; base: number } | null = null;

/** the fence a frame on: its lines climb, and it brightens as you come within nearAt metres of it */
export function cityEdge(now: number, near: number): void {
  if (!FENCE) return;
  const F = worldCfg.edge.fence;
  FENCE.tex.offset.y = -((now * F.scroll) % 1);
  FENCE.mat.opacity = F.opacity + (F.nearOpacity - F.opacity) * Math.max(0, 1 - near / F.nearAt);
}

const DECAY = {
  rect: SECTORS.map((s) => new THREE.Vector4(s.minX + BR_X, s.minZ + BR_Z, s.maxX + BR_X, s.maxZ + BR_Z)),
  level: { value: SECTORS.map(() => -1) },
  warn: { value: SECTORS.map(() => 0) },
  time: { value: 0 },
  /**
   * Each sector's boxes by their base, and how many of the lowest are out of the collision list: a line that rises
   * takes the next few, one that falls or goes puts them back. Every box of the city was looked at every frame,
   * decaying or not, 0.44 ms of a Neon City frame (tools/profile-frame.ts, 2026-10-03).
   */
  bySector: [] as Solid[][],
  out: [] as number[],
  removed: new Set<Solid>(),
};

/**
 * A material that dissolves where the decay has reached: under a decaying
 * sector's line it is not drawn, a band just above the line glows magenta,
 * and a warned sector's surfaces pulse. One patch, shared by every city
 * material, so the whole city dissolves as one thing.
 */
function teachDecay(m: THREE.Material): void {
  if (m.userData.decay) return;
  m.userData.decay = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uSkRect = { value: DECAY.rect };
    shader.uniforms.uSkLevel = DECAY.level;
    shader.uniforms.uSkWarn = DECAY.warn;
    shader.uniforms.uSkTime = DECAY.time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSkWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    const n = SECTORS.length;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vSkWorld;
uniform vec4 uSkRect[${n}];
uniform float uSkLevel[${n}];
uniform float uSkWarn[${n}];
uniform float uSkTime;
vec3 skGlow = vec3(0.0);`
      )
      .replace(
        "void main() {",
        `void main() {
  for (int i = 0; i < ${n}; i++) {
    vec4 r = uSkRect[i];
    if (vSkWorld.x < r.x || vSkWorld.x > r.z || vSkWorld.z < r.y || vSkWorld.z > r.w) continue;
    float jag = fract(sin(dot(floor(vSkWorld.xz * 0.8), vec2(12.9898, 78.233))) * 43758.5453) * 1.4;
    float line = uSkLevel[i] - jag;
    // the ground stays, corrupted red: it is where you still stand while the decay hurts you
    if (uSkLevel[i] >= 0.0 && vSkWorld.y <= 0.25) { skGlow += vec3(0.55, 0.02, 0.12); continue; }
    if (uSkLevel[i] >= 0.0 && vSkWorld.y < line) discard;
    if (uSkLevel[i] >= 0.0 && vSkWorld.y < line + 1.6) skGlow += vec3(1.0, 0.18, 0.6) * (1.0 - (vSkWorld.y - line) / 1.6) * 3.0;
    if (uSkWarn[i] > 0.0) skGlow += vec3(1.0, 0.18, 0.6) * (0.25 + 0.25 * sin(uSkTime * 6.0)) * uSkWarn[i];
  }`
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += skGlow;");
  };
  // (with what the material's program is already keyed by: the Neon City map's detail maps patch it too, detailmaps.ts)
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|skdecay`;
  m.needsUpdate = true;
}

/**
 * The city as the decay has it now (decay.ts sectorPhases, by sector id):
 * a decaying sector dissolved up to its line, a gone one entirely, a warned
 * one pulsing; the boxes under a line taken out of the collision list, and
 * every box put back once nothing is decaying (a match over, the range).
 * Returns how many boxes the decay holds out now, for the tests.
 */
export function cityDecay(states: Record<string, { phase: SectorPhase; k: number }> | null, now: number): number {
  DECAY.time.value = now;
  const levels = SECTORS.map((s) => {
    const st = states?.[s.id];
    if (!st || st.phase === "live" || st.phase === "warning") return -1;
    return st.phase === "gone" ? dissolvedTo(1) + 100 : dissolvedTo(st.k);
  });
  SECTORS.forEach((s, i) => {
    DECAY.level.value[i] = levels[i];
    DECAY.warn.value[i] = states?.[s.id]?.phase === "warning" ? 1 : 0;
  });
  // The collision list: out below the lines, back where there is no line. Not what is under the street (the metro,
  // and the street's slab over it, top 0, never in bySector): the decay's damage finds you down there, and the street
  // stays a floor.
  let changed = false;
  for (let i = 0; i < DECAY.bySector.length; i++) {
    const list = DECAY.bySector[i];
    const was = DECAY.out[i];
    let n = 0;
    if (levels[i] >= 0) {
      n = was;
      while (n < list.length && list[n].base < levels[i]) n++;
      while (n > 0 && list[n - 1].base >= levels[i]) n--;
    }
    for (let k = was; k < n; k++) {
      DECAY.removed.add(list[k]);
      changed = true;
    }
    for (let k = n; k < was; k++) {
      DECAY.removed.delete(list[k]);
      RANGE_SOLIDS.push(list[k]);
    }
    DECAY.out[i] = n;
  }
  if (changed) {
    let j = 0;
    for (const s of RANGE_SOLIDS) if (!DECAY.removed.has(s)) RANGE_SOLIDS[j++] = s;
    RANGE_SOLIDS.length = j;
  }
  return DECAY.removed.size;
}
