// The city bundle drawn (docs/CITY_BUNDLE_IMPLEMENTATION.md): the pieces citydress.ts places, from the owner's bought
// files in models/paid/city/ (tools/import-city.ts writes them; gitignored and served only by the game server). A
// checkout without them, and the public Pages build, draw the city as it was: the probe finds nothing and this adds
// nothing. What loads depends on the graphics preset (quality.ts cityKit and cityDetail) and never changes how the
// city plays: every piece is looks, the collision is the city's own boxes.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import kit from "../config/citykit.json";
import type { KitPlace } from "./citydress";
import { cityKitTraffic } from "./citydress";
import { KIT_SITES, STAND_INS } from "./city";
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

/** the flying traffic once drawn: each car's instance in each of its piece's meshes, and where its loop is */
const TRAFFIC: { cars: ReturnType<typeof cityKitTraffic>; meshes: Array<{ mesh: THREE.InstancedMesh; local: THREE.Matrix4; cars: number[] }>; root: THREE.Object3D | null } = { cars: [], meshes: [], root: null };
const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const tp = new THREE.Vector3();
const ts = new THREE.Vector3(1, 1, 1);
const up = new THREE.Vector3(0, 1, 0);
/** a point `s` metres round a closed loop of corners, and which way it runs there */
function onLoop(loop: Array<[number, number, number]>, s: number, at: THREE.Vector3): number {
  const n = loop.length;
  let left = s;
  for (let k = 0; ; k = (k + 1) % n) {
    const a = loop[k];
    const b = loop[(k + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= len) {
      const f = left / len;
      at.set(a[0] + (b[0] - a[0]) * f, a[1], a[2] + (b[2] - a[2]) * f);
      return Math.atan2(b[0] - a[0], b[2] - a[2]);
    }
    left -= len;
  }
}
/** the flying traffic a frame on (seconds of game time) */
export function tickCityKit(now: number): void {
  if (!TRAFFIC.meshes.length) return;
  for (const { mesh, local, cars } of TRAFFIC.meshes) {
    cars.forEach((ci, i) => {
      const c = TRAFFIC.cars[ci];
      const yaw = onLoop(c.loop, (c.start + now * c.speed) % c.length, tp);
      tm.compose(tp, tq.setFromAxisAngle(up, yaw), ts);
      if (c.standing) tm.multiply(c.standing);
      mesh.setMatrixAt(i, tm.multiply(local));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
}

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
  // the flying traffic, from Balanced up: an instanced mesh for each of a car piece's meshes, moved every frame
  if (q.cityDetail >= 1) {
    TRAFFIC.cars = cityKitTraffic();
    TRAFFIC.meshes = [];
    const byCar = new Map<string, number[]>();
    TRAFFIC.cars.forEach((c, i) => (byCar.get(c.piece) ?? byCar.set(c.piece, []).get(c.piece)!).push(i));
    for (const [piece, cars] of byCar) {
      const src = byId.get(piece);
      if (!src) continue;
      inv.copy(src.matrixWorld).invert();
      src.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const im = new THREE.InstancedMesh(mesh.geometry, mesh.material as THREE.Material, cars.length);
        im.name = `citykit:traffic:${piece}`;
        // they cross the whole centre: never culled for leaving a sphere set where they started
        im.frustumCulled = false;
        im.castShadow = false;
        group.add(im);
        TRAFFIC.meshes.push({ mesh: im, local: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld), cars });
      });
    }
    tickCityKit(0);
  }
  root.add(group);
  // every stall wearing its stand: the dark kiosks under them go (the stands are open-fronted), their collision stays
  const stands = new Set(kit.dress.alley.stands);
  const dressed = want.filter((p) => stands.has(p.piece) && byId.has(p.piece)).length;
  if (KIT_SITES.stalls.length && dressed >= KIT_SITES.stalls.length) for (const m of STAND_INS.stalls) m.visible = false;
  // and every car in the centre wearing its van: the boxes under them go, their collision stays
  const vans = new Set(kit.dress.cars);
  const parked = want.filter((p) => p.kind === "car" && vans.has(p.piece) && byId.has(p.piece)).length;
  if (KIT_SITES.cars.length && parked >= KIT_SITES.cars.length) for (const m of STAND_INS.cars) m.visible = false;
  return CITY_KIT.drawn;
}
