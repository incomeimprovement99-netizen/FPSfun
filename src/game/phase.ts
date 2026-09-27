/**
 * The phase: a gun materialising in the hands, and dissolving out of them, the way Hyper Scape's weapons did
 * (the owner, 2026-09-27: "have them kind of phase in like how hyperscape does it ... it doesn't need to be
 * realistic, it needs to be futuristic"). A sweep runs along the gun from one end to the other: behind it the gun
 * is solid, on it a bright band with scanlines, and ahead of it a scatter of flickering cells where the gun is
 * about to be. Its edge is blocky, a digital edge rather than a smooth wipe.
 *
 * It is a material wrapper: a clone of the gun's material with the sweep compiled in, so the copies of the same gun
 * on figures and the floor never phase. The sweep runs in world space along an axis the viewmodel sets each frame
 * (the gun's length, or a magazine's), so every mesh of the gun shares one sweep however it is parented.
 * Numbers: src/config/gunfeel.json phase.
 */
import * as THREE from "three";

/** one sweep: how far along it is and the axis it runs along, shared by every material it drives */
export interface PhaseSweep {
  /** 0 gone, 1 whole */
  phase: { value: number };
  /** where the sweep starts and the way it runs, world space; len is how long the axis is */
  origin: { value: THREE.Vector3 };
  dir: { value: THREE.Vector3 };
  len: { value: number };
  color: { value: THREE.Color };
  /** the band's width and the edge's jag, as shares of the axis's length; the cell size, a share too */
  band: { value: number };
  jag: { value: number };
  cell: { value: number };
  /** the scanlines along the axis, lines per length */
  lines: { value: number };
  /** how much of the length ahead of the edge the scatter of cells reaches, and how thick it is there */
  ahead: { value: number };
  scatter: { value: number };
  time: { value: number };
  /** a scan: a lit band passing along the whole gun without taking any of it away (an inspect, a fusion), below 0 none */
  scan: { value: number };
}

export function newSweep(o: { color: string; band: number; jag: number; cell: number; lines: number; ahead: number; scatter: number }): PhaseSweep {
  return {
    phase: { value: 1 },
    origin: { value: new THREE.Vector3() },
    dir: { value: new THREE.Vector3(0, 0, -1) },
    len: { value: 1 },
    color: { value: new THREE.Color(o.color) },
    band: { value: o.band },
    jag: { value: o.jag },
    cell: { value: o.cell },
    lines: { value: o.lines },
    ahead: { value: o.ahead },
    scatter: { value: o.scatter },
    time: { value: 0 },
    scan: { value: -1 },
  };
}

const VERT_HEAD = /* glsl */ `
varying vec3 vPhasePos;
`;
const VERT_BODY = /* glsl */ `
vPhasePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const FRAG_HEAD = /* glsl */ `
uniform float uPhase;
uniform vec3 uPhaseOrigin;
uniform vec3 uPhaseDir;
uniform float uPhaseLen;
uniform vec3 uPhaseColor;
uniform float uPhaseBand;
uniform float uPhaseJag;
uniform float uPhaseCell;
uniform float uPhaseLines;
uniform float uPhaseAhead;
uniform float uPhaseScatter;
uniform float uPhaseTime;
uniform float uPhaseScan;
varying vec3 vPhasePos;
float phaseHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;
// early in main: where this fragment is against the sweep, and whether it is drawn at all
const FRAG_TEST = /* glsl */ `
float phaseGlow = 0.0;
bool phaseHolo = false;
if (uPhase < 0.0001) discard;
if (uPhase < 0.9999 || uPhaseScan > -0.5) {
  float s = dot(vPhasePos - uPhaseOrigin, uPhaseDir) / uPhaseLen;
  vec3 cell = floor(vPhasePos / (uPhaseCell * uPhaseLen));
  // the edge: the sweep's front, pushed back and forth by a cell at a time, so it steps like pixels
  float edge = uPhase * (1.0 + uPhaseBand + uPhaseJag) - uPhaseJag * phaseHash(cell) - s;
  if (edge < 0.0) {
    // ahead of the front: a thinning scatter of cells, re-rolled many times a second
    float k = 1.0 + edge / uPhaseAhead;
    // (thin while the sweep has barely begun, so a gun that is nearly gone is not a cloud of cells)
    if (k <= 0.0 || phaseHash(cell + floor(uPhaseTime * 24.0)) > uPhaseScatter * k * min(1.0, uPhase * 6.0)) discard;
    phaseHolo = true;
  } else if (uPhase < 0.9999) {
    phaseGlow = 1.0 - smoothstep(0.0, uPhaseBand, edge);
  }
  // the scan: the same light as the edge, on a band passing along a whole gun
  if (uPhaseScan > -0.5) phaseGlow = max(phaseGlow, 1.0 - smoothstep(0.0, uPhaseBand * 0.5, abs(s - uPhaseScan)));
  phaseGlow *= 0.6 + 0.4 * sin(s * uPhaseLines - uPhaseTime * 30.0);
}
`;
// last: the band's light over the lit colour, and the scatter as pure light
const FRAG_TAIL = /* glsl */ `
if (phaseHolo) gl_FragColor = vec4(uPhaseColor * 1.6, 1.0);
else gl_FragColor.rgb += uPhaseColor * phaseGlow * 2.2;
`;

const phased = new WeakMap<THREE.Material, Map<PhaseSweep, THREE.Material>>();

/** a material with this sweep compiled in: one clone a material and sweep, made once */
export function phasedMaterial(src: THREE.Material, sweep: PhaseSweep): THREE.Material {
  let bySweep = phased.get(src);
  if (!bySweep) phased.set(src, (bySweep = new Map()));
  const have = bySweep.get(sweep);
  if (have) return have;
  const m = src.clone();
  m.userData.phaseOf = src;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uPhase: sweep.phase,
      uPhaseOrigin: sweep.origin,
      uPhaseDir: sweep.dir,
      uPhaseLen: sweep.len,
      uPhaseColor: sweep.color,
      uPhaseBand: sweep.band,
      uPhaseJag: sweep.jag,
      uPhaseCell: sweep.cell,
      uPhaseLines: sweep.lines,
      uPhaseAhead: sweep.ahead,
      uPhaseScatter: sweep.scatter,
      uPhaseTime: sweep.time,
      uPhaseScan: sweep.scan,
    });
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader =
      FRAG_HEAD +
      shader.fragmentShader
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${FRAG_TEST}`)
        .replace("#include <dithering_fragment>", `#include <dithering_fragment>\n${FRAG_TAIL}`);
  };
  // its own program: three keys programs by the compile function's text, and every phased clone shares it
  m.customProgramCacheKey = () => `phase|${src.type}`;
  bySweep.set(sweep, m);
  return m;
}

/** the material a phased clone was made from, or the material itself */
export function unphased(m: THREE.Material): THREE.Material {
  return (m.userData.phaseOf as THREE.Material | undefined) ?? m;
}

/**
 * Every mesh under `root` onto its phased clone for the sweep `pick` gives it (a gun's body and its magazine run
 * separate sweeps), from whatever material it wears now: a fusion level's new skin is wrapped again the next time
 * this runs. The per-mesh sweep is kept, so a mesh already on the right clone is left alone.
 */
export function phaseMeshes(root: THREE.Object3D, pick: (mesh: THREE.Mesh) => PhaseSweep | null): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const sweep = pick(mesh);
    const src = unphased(mesh.material);
    const want = sweep ? phasedMaterial(src, sweep) : src;
    if (mesh.material !== want) mesh.material = want;
  });
}
