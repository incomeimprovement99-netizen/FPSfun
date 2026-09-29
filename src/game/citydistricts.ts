// Districts made of the packs' own demo scenes (Phase 25; src/config/citydistricts.json): a pack's demo street whole, as
// its artist assembled it, baked by tools/import-city.ts already moved into the map's own metres, so it is added as it
// is. The owner's test of the pipeline: "we should barely see differences" between the store's pictures and the game.
// Like the kit, the bought files are served only by the game server: a checkout without them draws nothing here.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DISTRICT_INSIDES } from "./districtsolids";
import cfg from "../config/citydistricts.json";

// the server caches /models/ for a day, so the version rides in the file name and the query; `-lo` is the file at the
// kit's lo texture size, for the presets that load the kit's lo files (Competitive: every preset loaded the 51 MB one)
const url = (id: string, lo: boolean): string => `models/paid/city/${id}-v${cfg.version}${lo ? "-lo" : ""}.glb?v=${cfg.version}`;

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

/**
 * A district's buildings' insides, drawn: the film set is faced only toward its canyons and hollow behind, and its
 * collision fills each building to its height (tools/import-city.ts districtSolids), so what you stand on up there and
 * what you see through a window is this, dark blocks a cell back from the faces and a roof over the faces' own cells,
 * not the air over a hollow (the owner, 2026-09-28: "i was able to glitch into the corner map area")
 */
/** the street under a district, where its collision starts (citydistricts.json collision floor) */
const STREET = cfg.collision.floor;
function insides(id: string, shadows: boolean): THREE.Object3D {
  const { covers, caps } = DISTRICT_INSIDES[id] ?? { covers: [], caps: [] };
  const parts: THREE.BufferGeometry[] = [];
  // (its backs, the open ground closed where it meets ground you stand on, the city draws as its own buildings: city.ts)
  for (const [x0, x1, z0, z1, top] of covers) {
    const h = top - STREET;
    parts.push(new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate((x0 + x1) / 2, STREET + h / 2, (z0 + z1) / 2));
  }
  for (const [x0, x1, z0, z1, top] of caps) parts.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, top, (z0 + z1) / 2));
  const mesh = new THREE.Mesh(parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide }));
  mesh.name = `district:${id}:insides`;
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  return mesh;
}

export async function dressDistricts(root: THREE.Object3D, renderer: THREE.WebGLRenderer, lo = false): Promise<number> {
  const ktx2 = new KTX2Loader().setTranscoderPath("libs/basis/").detectSupport(renderer);
  // (its geometry comes meshopt-compressed: tools/import-city.ts writePack)
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  for (const d of cfg.districts) {
    // a HEAD first: the Vite dev server answers a missing file with its index page, not a 404
    const probe = await fetch(url(d.id, lo), { method: "HEAD" }).catch(() => null);
    if (!probe || !probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) continue;
    try {
      const g = await loader.loadAsync(url(d.id, lo));
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
      root.add(insides(d.id, d.look.shadows));
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
