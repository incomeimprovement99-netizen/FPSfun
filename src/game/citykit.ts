// The city bundle drawn (docs/CITY_BUNDLE_IMPLEMENTATION.md): the pieces citydress.ts places, from the owner's bought
// files in models/paid/city/ (tools/import-city.ts writes them; gitignored and served only by the game server). A
// checkout without them, and the public Pages build, draw the city as it was: the probe finds nothing and this adds
// nothing. What loads depends on the graphics preset (quality.ts cityKit and cityDetail) and never changes how the
// city plays: every piece is looks, the collision is the city's own boxes.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import kit from "../config/citykit.json";
import type { KitPlace } from "./citydress";
import type { Quality } from "./quality";

// the server caches /models/ for a day, so the version rides in the file name and the query
const url = (f: string): string => `models/paid/city/${f}?v=${kit.version}`;

export interface CityKitState {
  drawn: number;
  pieces: number;
  meshes: number;
  packs: string[];
}
export const CITY_KIT: CityKitState = { drawn: 0, pieces: 0, meshes: 0, packs: [] };

export async function dressCityKit(root: THREE.Object3D, places: KitPlace[], q: Quality): Promise<number> {
  const want = places.filter((p) => p.tier <= q.cityDetail);
  if (!want.length) return 0;
  const packs = [...new Set(want.map((p) => p.piece.split("/")[0]))];
  const file = (pack: string): string => `${pack}-v${kit.version}${q.cityKit === "lo" ? "-lo" : ""}.glb`;
  // a HEAD first: the Vite dev server answers a missing file with its index page, not a 404
  const probe = await fetch(url(file(packs[0])), { method: "HEAD" }).catch(() => null);
  if (!probe || !probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) return 0;
  const loader = new GLTFLoader();
  const byId = new Map<string, THREE.Object3D>();
  await Promise.all(
    packs.map(async (pack) => {
      try {
        const g = await loader.loadAsync(url(file(pack)));
        g.scene.updateMatrixWorld(true);
        // three.js strips "/" from node names, so each piece's id rides in its extras (import-city.ts)
        for (const o of g.scene.children) byId.set(String(o.userData.id ?? o.name), o);
        CITY_KIT.packs.push(pack);
      } catch (e) {
        console.warn("city kit: a pack did not load", pack, e);
      }
    }),
  );
  const byPiece = new Map<string, KitPlace[]>();
  for (const p of want) (byPiece.get(p.piece) ?? byPiece.set(p.piece, []).get(p.piece)!).push(p);
  const group = new THREE.Group();
  group.name = "citykit";
  const inv = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const lit = new Map<string, THREE.Material>();
  for (const [piece, list] of byPiece) {
    const src = byId.get(piece);
    if (!src) continue;
    inv.copy(src.matrixWorld).invert();
    const glow = (kit.dress.glow as Record<string, number>)[list[0].kind];
    src.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      local.multiplyMatrices(inv, mesh.matrixWorld);
      let mat = mesh.material as THREE.MeshStandardMaterial;
      // HDR emission past 1 comes from the importer as a strength (glTF extras reach userData)
      const strength = Number(mat.userData?.emissiveStrength ?? 1);
      if (strength > 1 && mat.emissiveIntensity === 1) mat.emissiveIntensity = strength;
      // a billboard's or a poster's picture is its own light
      if (glow && mat.map) {
        const key = mat.uuid + glow;
        mat = (lit.get(key) as THREE.MeshStandardMaterial) ?? (lit.set(key, mat.clone()).get(key) as THREE.MeshStandardMaterial);
        mat.emissiveMap = mat.map;
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = glow;
      }
      const im = new THREE.InstancedMesh(mesh.geometry, mat, list.length);
      list.forEach((p, i) => im.setMatrixAt(i, m.multiplyMatrices(p.m, local)));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      // the boxes under the kit already cast the city's shadows
      im.castShadow = false;
      im.receiveShadow = true;
      im.name = `citykit:${piece}`;
      group.add(im);
      CITY_KIT.meshes++;
    });
    CITY_KIT.pieces++;
    CITY_KIT.drawn += list.length;
  }
  root.add(group);
  return CITY_KIT.drawn;
}
