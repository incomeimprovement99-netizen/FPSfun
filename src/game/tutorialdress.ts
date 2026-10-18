// The tutorial's dressing in the Neon City bundle (Milestone 634): tools/tutorial-dress.ts bakes its rooms in the
// bundle's own materials and pieces into one small file of its own, public/models/paid/neon/tutorial-v<version>.glb,
// read here as the city's file is (neonmap.ts dressNeonMap: KTX2 textures, meshopt geometry, the bundle's detail maps
// and its unlit and added looks) and laid over the course's boxes (course.ts dressWith), which it still collides with.
// Its own small file and not the city's (155 MB): the tutorial is a new player's first click.
//
// A checkout without the bought files has no file here: the course's plain boxes stay, as they were before.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { applyDetailMaps, applyUnityLooks } from "./detailmaps";
import dress from "../config/tutorialdress.json";

/** what the dressing did, for the tests and the screen */
export const TUTORIAL_DRESS = { asked: false, drawn: false, failed: false, meshes: 0, file: "" };

/** the dressing's file, read and made ready to draw, or null where there is none (or it would not read) */
export async function loadTutorialDress(renderer: THREE.WebGLRenderer): Promise<THREE.Object3D | null> {
  return loadNeonDress(renderer, `models/paid/neon/tutorial-v${dress.version}.glb?v=${dress.version}`, "tutorial:dress", TUTORIAL_DRESS);
}

/**
 * A dressing of its own in the Neon City bundle, read: the tutorial's, and since Milestone 691 the range's street
 * (rangedress.ts). What it did goes in `state`, for the tests and the screen.
 */
export async function loadNeonDress(renderer: THREE.WebGLRenderer, url: string, name: string, state: typeof TUTORIAL_DRESS): Promise<THREE.Object3D | null> {
  state.asked = true;
  // (a HEAD first: the dev server answers a missing file with its index page, which is a checkout without the bought files)
  const probe = await fetch(url, { method: "HEAD" }).catch(() => null);
  if (!probe?.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) {
    state.failed = true;
    return null;
  }
  // its own transcoder, two workers: a few textures, not the city's hundreds
  const ktx2 = new KTX2Loader().setTranscoderPath("libs/basis/").setWorkerLimit(2).detectSupport(renderer);
  try {
    const gltf = await new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    await applyDetailMaps(gltf);
    let meshes = 0;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    applyUnityLooks(gltf.scene);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        // HDR emission past 1 comes from the importer as a strength (glTF extras reach userData), as the city's does
        const strength = Number(m.userData?.emissiveStrength ?? 1);
        if (strength > 1 && m.emissiveIntensity === 1) m.emissiveIntensity = strength;
      }
    });
    gltf.scene.name = name;
    Object.assign(state, { drawn: true, meshes, file: url });
    return gltf.scene;
  } catch {
    state.failed = true;
    return null;
  } finally {
    ktx2.dispose();
  }
}
