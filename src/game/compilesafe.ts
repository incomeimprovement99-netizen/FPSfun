// three's compileAsync, but a material disposed while its shader is being built is let go, not asked about again.
//
// three builds every material's shader at once and then asks each one, every 10 ms, whether its program is ready
// (WebGLRenderer.compileAsync, checkMaterialsReady). A material disposed in the meantime (a figure rebuilt as a loadout
// changed, the Neon map's stand-in floor gone as the city's file drew, a reflection's material swapped) has no program
// left, and the question threw inside three's own timer, where no .catch reaches it: a page error, "Cannot read
// properties of undefined (reading 'isReady')", in the e2e on the Neon map (2026-10-04). This asks the same question of
// what is still there, and lets the rest go.
import type * as THREE from "three";

interface Built {
  currentProgram?: { isReady(): boolean };
}

/** every material under `scene` built for `camera` (lit by `target`'s lights), resolved once each is ready or gone */
export function compileSafely(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, target: THREE.Scene | null = null): Promise<void> {
  const materials = renderer.compile(scene, camera, target);
  return new Promise((resolve) => {
    const check = (): void => {
      for (const m of materials) {
        // (disposed: three forgot it, or kept nothing for it)
        const p = renderer.properties.has(m) ? (renderer.properties.get(m) as Built).currentProgram : undefined;
        if (!p || p.isReady()) materials.delete(m);
      }
      if (materials.size === 0) resolve();
      else setTimeout(check, 10);
    };
    // as three does: asked for at once where the browser builds shaders off its thread, after a moment where it does not
    if (renderer.extensions.get("KHR_parallel_shader_compile") !== null) check();
    else setTimeout(check, 10);
  });
}
