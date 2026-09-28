// Districts made of the packs' own demo scenes (Phase 25; src/config/citydistricts.json): a pack's demo street whole, as
// its artist assembled it, baked by tools/import-city.ts already moved into the map's own metres, so it is added as it
// is. The owner's test of the pipeline: "we should barely see differences" between the store's pictures and the game.
// Like the kit, the bought files are served only by the game server: a checkout without them draws nothing here.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import cfg from "../config/citydistricts.json";

// the server caches /models/ for a day, so the version rides in the file name and the query
const url = (id: string): string => `models/paid/city/${id}-v${cfg.version}.glb?v=${cfg.version}`;

/** a district's crossroads (map-local) by its id, for ?dropat=<id>: a solo battle royale drops you straight onto it */
export const districtAt = (id: string | null): { x: number; z: number } | null => {
  const d = cfg.districts.find((q) => q.id === id);
  return d ? { x: d.at[0], z: d.at[2] } : null;
};

/** the districts drawn, for the page's hook and the checks */
export const CITY_DISTRICTS: { drawn: string[]; triangles: number } = { drawn: [], triangles: 0 };
/** each district's glowing materials and their own light, for the hour to scale (look glow) */
const GLOWS: Array<{ m: THREE.MeshStandardMaterial; full: number; glow: { day: number; night: number } }> = [];
let glowDay: boolean | null = null;
/** the districts' lit windows and signs for the hour: dim by day, as the store's daytime pictures have them */
export function districtGlow(day: boolean): void {
  if (day === glowDay) return;
  glowDay = day;
  for (const g of GLOWS) g.m.emissiveIntensity = g.full * (day ? g.glow.day : g.glow.night);
}

export async function dressDistricts(root: THREE.Object3D, renderer: THREE.WebGLRenderer): Promise<number> {
  const ktx2 = new KTX2Loader().setTranscoderPath("libs/basis/").detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2);
  for (const d of cfg.districts) {
    // a HEAD first: the Vite dev server answers a missing file with its index page, not a 404
    const probe = await fetch(url(d.id), { method: "HEAD" }).catch(() => null);
    if (!probe || !probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) continue;
    try {
      const g = await loader.loadAsync(url(d.id));
      g.scene.name = `district:${d.id}`;
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // HDR emission past 1 comes from the importer as a strength (glTF extras reach userData), as in citykit.ts
        for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
          const strength = Number(m.userData?.emissiveStrength ?? 1);
          if (strength > 1 && m.emissiveIntensity === 1) m.emissiveIntensity = strength;
          if (m.emissiveMap || m.emissive.getHex() !== 0) GLOWS.push({ m, full: m.emissiveIntensity, glow: d.look.glow });
          // the film set's faces from behind, from the city's streets round it: single-sided, only their frames showed,
          // a building you saw through (look backs)
          if (d.look.backs && !m.transparent) m.side = THREE.DoubleSide;
        }
        // its buildings shade its own canyons, as the pack's lighting does (look shadows); the shadow map is drawn once
        mesh.castShadow = d.look.shadows;
        mesh.receiveShadow = true;
        CITY_DISTRICTS.triangles += (mesh.geometry.getIndex()?.count ?? mesh.geometry.getAttribute("position").count) / 3;
      });
      root.add(g.scene);
      // the hour's glow on the new materials at once
      const was = glowDay;
      glowDay = null;
      if (was !== null) districtGlow(was);
      renderer.shadowMap.needsUpdate = true;
      CITY_DISTRICTS.drawn.push(d.id);
    } catch (e) {
      console.warn("city district: did not load", d.id, e);
    }
  }
  return CITY_DISTRICTS.drawn.length;
}
