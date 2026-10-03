// three.js's compile works out the shader parameters of every object it is given, one by one, though a program depends
// only on the material and a few things about the object (WebGLPrograms.getParameters: instancing, its colours and
// morphs, batching, skinning, morph targets, points, lines and sprites, and the geometry's tangents and colours). The
// Neon City is thousands of meshes over a few hundred materials: its warm (main.ts warmBrSide) spent 0.97 s in
// getParameters in one frame, the screen frozen at the end of the city's unpacking (2026-10-03).
//
// So a warm compiles one object for each program it will draw with: the same programs, from a fraction of the work.
// ?slow=reps compiles every object, as before (slow.ts).
import * as THREE from "three";
import { slow } from "./slow";

type Drawn = THREE.Object3D & {
  isMesh?: boolean;
  isPoints?: boolean;
  isLine?: boolean;
  isSprite?: boolean;
  isInstancedMesh?: boolean;
  isBatchedMesh?: boolean;
  isSkinnedMesh?: boolean;
  instanceColor?: unknown;
  morphTexture?: unknown;
  _colorsTexture?: unknown;
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

/** what about `o` and `m` decides the program it draws with (three r170's getParameters, the object's part of it) */
function programKey(o: Drawn, m: THREE.Material): string {
  const a = o.geometry?.attributes ?? {};
  const morph = o.geometry ? Object.entries(o.geometry.morphAttributes).map(([k, v]) => `${k}${v.length}`).join(",") : "";
  const colour = a.color as THREE.BufferAttribute | undefined;
  return [
    m.uuid,
    o.isInstancedMesh ? `i${o.instanceColor ? 1 : 0}${o.morphTexture ? 1 : 0}` : "",
    o.isBatchedMesh ? `b${o._colorsTexture ? 1 : 0}` : "",
    o.isSkinnedMesh ? "s" : "",
    o.isPoints ? `p${a.uv ? 1 : 0}` : "",
    o.isLine ? "l" : "",
    o.isSprite ? "S" : "",
    a.tangent ? "t" : "",
    colour ? `c${colour.itemSize}` : "",
    morph,
  ].join("|");
}

/** a root that hands three's compile the objects chosen, and no lights of its own (compile takes the scene's) */
class Reps extends THREE.Object3D {
  constructor(private readonly list: THREE.Object3D[]) {
    super();
  }
  override traverse(callback: (o: THREE.Object3D) => void): void {
    for (const o of this.list) callback(o);
  }
  override traverseVisible(): void {
    /* the lights are the scene's (compile gathers them from the scene it is given) */
  }
}

/** `root`, for three's compile: one object for each program under it */
export function programReps(root: THREE.Object3D): THREE.Object3D {
  return slow("reps") ? root : new Reps(programRepList(root));
}

/** a root over objects already chosen (programRepList), for a warm that compiles them a slice at a time */
export function repsRoot(list: THREE.Object3D[]): THREE.Object3D {
  return new Reps(list);
}

/** the objects, one for each program under the roots (every object under them with ?slow=reps) */
export function programRepList(...roots: THREE.Object3D[]): THREE.Object3D[] {
  const seen = new Set<string>();
  const list: THREE.Object3D[] = [];
  for (const root of roots)
    root.traverse((o) => {
      const d = o as Drawn;
      if (!(d.isMesh || d.isPoints || d.isLine || d.isSprite) || !d.material) return;
      let fresh = false;
      for (const m of Array.isArray(d.material) ? d.material : [d.material]) {
        const k = programKey(d, m);
        if (seen.has(k) && !slow("reps")) continue;
        seen.add(k);
        fresh = true;
      }
      if (fresh) list.push(o);
    });
  return list;
}
