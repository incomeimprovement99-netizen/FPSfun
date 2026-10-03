// three.js sends a single uniform to the GPU only when its value has changed since that program last had it, but an
// array uniform (a list of numbers, vectors or matrices) on every draw that uses it. A Neon City frame drew about 330
// meshes with the decay's three arrays (city.ts teachDecay: the sectors' rectangles, their lines, their warnings) and
// 445 with the sun's shadow matrices: 1,450 of the frame's 3,225 uniform calls (2026-10-03), nearly all sending what
// the program already had, since those values change at most once a frame.
//
// So each program's float arrays keep what they last sent and skip a send of the same, as three does for a single
// value. The GPU keeps a uniform's value per program, and each array here belongs to one program, so nothing drawn
// changes. The cache goes in the first time three asks a program for its uniforms (its first draw), through that
// program's own getUniforms: asked earlier, a program still compiling in the background would be finished on the
// spot, the freeze compileAsync is there to avoid. ?slow=uniforms leaves it out, for measuring it (slow.ts).
import type * as THREE from "three";

type Send = (this: ArrayUniform, gl: WebGL2RenderingContext, v: unknown, textures?: unknown) => void;
interface ArrayUniform {
  type: number;
  size: number;
  setValue: Send;
}
interface UniformList {
  seq: Array<ArrayUniform | UniformList | { setValue: unknown }>;
}
interface Program {
  getUniforms(): UniformList;
}

/** numbers an element, by its GL type: the float, vector and matrix arrays (three caches sampler arrays already) */
const WIDTH: Record<number, number> = { 0x1406: 1, 0x8b50: 2, 0x8b51: 3, 0x8b52: 4, 0x8b5a: 4, 0x8b5b: 9, 0x8b5c: 16 };

function remember(u: ArrayUniform): void {
  const width = WIDTH[u.type];
  if (!width) return;
  const send = u.setValue;
  const last = new Float32Array(u.size * width);
  const now = new Float32Array(u.size * width);
  let sent = false;
  u.setValue = function (gl, v, textures) {
    // as three flattens it: numbers as they are, or each element's own numbers in turn
    const a = v as ArrayLike<number | { toArray(out: Float32Array, at: number): unknown }>;
    const n = Math.min(u.size, a.length);
    if (typeof a[0] === "number") for (let i = 0; i < Math.min(now.length, a.length); i++) now[i] = a[i] as number;
    else for (let i = 0; i < n; i++) (a[i] as { toArray(out: Float32Array, at: number): unknown }).toArray(now, i * width);
    if (sent) {
      let same = true;
      for (let i = 0; i < now.length; i++)
        if (now[i] !== last[i]) {
          same = false;
          break;
        }
      if (same) return;
    }
    last.set(now);
    sent = true;
    send.call(this, gl, v, textures);
  };
}

function rememberAll(list: UniformList): void {
  for (const u of list.seq) {
    if ("seq" in u) rememberAll(u);
    else if ("size" in u) remember(u as ArrayUniform);
  }
}

const seen = new WeakSet<object>();
let known = -1;
let calls = 0;

/** once a frame, before it is drawn: the programs made since the last frame get the cache on their first draw */
export function cacheArrayUniforms(renderer: THREE.WebGLRenderer): void {
  const programs = renderer.info.programs as unknown as Program[] | null;
  // (a new count, or a look every second or so: one program let go and another made leave the count as it was)
  if (!programs || (programs.length === known && ++calls % 64 !== 0)) return;
  known = programs.length;
  for (const p of programs) {
    if (seen.has(p)) continue;
    seen.add(p);
    const own = p.getUniforms;
    p.getUniforms = function (this: Program): UniformList {
      const list = own.call(this);
      rememberAll(list);
      // once is enough: three asks on every draw
      p.getUniforms = own;
      return list;
    };
  }
}
