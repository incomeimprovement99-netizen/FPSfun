// The city bundle drawn (docs/CITY_BUNDLE_IMPLEMENTATION.md): the pieces citydress.ts places, from the owner's bought
// files in models/paid/city/ (tools/import-city.ts writes them; gitignored and served only by the game server). A
// checkout without them, and the public Pages build, draw the city as it was: the probe finds nothing and this adds
// nothing. What loads depends on the graphics preset (quality.ts cityKit and cityDetail) and never changes how the
// city plays: every piece is looks, the collision is the city's own boxes.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
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

export async function dressCityKit(root: THREE.Object3D, places: KitPlace[], q: Quality, renderer: THREE.WebGLRenderer): Promise<number> {
  const want = places.filter((p) => p.tier <= q.cityDetail);
  if (!want.length) return 0;
  const packs = [...new Set(want.map((p) => p.piece.split("/")[0]))];
  const file = (pack: string): string => `${pack}-v${kit.version}${q.cityKit === "lo" ? "-lo" : q.cityKit === "max" ? "-max" : ""}.glb`;
  // a HEAD first: the Vite dev server answers a missing file with its index page, not a 404
  const probe = await fetch(url(file(packs[0])), { method: "HEAD" }).catch(() => null);
  if (!probe || !probe.ok || (probe.headers.get("content-type") ?? "").includes("text/html")) return 0;
  // the packs' textures are KTX2 (Basis), transcoded in a worker to whatever the card reads compressed (BC7 and BC1
  // on a desktop): public/libs/basis is three.js's own transcoder
  const ktx2 = new KTX2Loader().setTranscoderPath("libs/basis/").detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2);
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
  const lit = new Map<string, THREE.Material>();
  // Every piece's meshes go into batches, one a material (Phase 22.4): a BatchedMesh draws many geometries that share a
  // material in one multi-draw, culling each placement on its own, where an instanced mesh a piece's mesh was a draw
  // each (604 on Balanced for 206 materials, tools/kit-drawcalls.ts). A batch's geometries must agree in their
  // attributes and in having an index, so that is in its key too.
  const batches = new Map<string, { mat: THREE.Material; parts: Array<{ geo: THREE.BufferGeometry; at: THREE.Matrix4[] }> }>();
  // Batched only with ?kitbatched: on the owner's machine it drew 40% fewer calls but no frame measurably faster, the
  // bench loaded by another worktree throughout (Phase 22.4), so the instanced meshes it measured against stay the
  // default until a quiet bench says otherwise
  const instanced = !(typeof location !== "undefined" && new URLSearchParams(location.search).has("kitbatched"));
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
      const geo = mesh.geometry;
      const sig =
        Object.keys(geo.attributes)
          .sort()
          .map((k) => `${k}:${geo.getAttribute(k).itemSize}${geo.getAttribute(k).normalized ? "n" : ""}`)
          .join(",") + (geo.getIndex() ? "|indexed" : "");
      const at = list.map((p) => new THREE.Matrix4().multiplyMatrices(p.m, local));
      if (instanced) {
        const im = new THREE.InstancedMesh(geo, mat, at.length);
        at.forEach((a, i) => im.setMatrixAt(i, a));
        im.computeBoundingSphere();
        im.castShadow = false;
        im.receiveShadow = true;
        im.name = `citykit:${piece}`;
        group.add(im);
        CITY_KIT.meshes++;
        return;
      }
      const key = `${mat.uuid}|${sig}`;
      const batch = batches.get(key) ?? batches.set(key, { mat, parts: [] }).get(key)!;
      batch.parts.push({ geo, at });
    });
    CITY_KIT.pieces++;
    CITY_KIT.drawn += list.length;
  }
  for (const { mat, parts } of batches.values()) {
    const instances = parts.reduce((a, q) => a + q.at.length, 0);
    const vertices = parts.reduce((a, q) => a + q.geo.getAttribute("position").count, 0);
    const indices = parts.reduce((a, q) => a + (q.geo.getIndex()?.count ?? 0), 0);
    const bm = new THREE.BatchedMesh(instances, vertices, Math.max(1, indices), mat);
    // no work a frame: culling and sorting each of its placements in script cost more than the draws it saved (the
    // A/B bench, Phase 22.4: Balanced 9.4 ms against 6.5 with them on), and the instanced meshes it replaces did
    // neither; the batch as a whole is still culled by its bounds
    bm.perObjectFrustumCulled = false;
    bm.sortObjects = false;
    for (const q of parts) {
      const id = bm.addGeometry(q.geo);
      for (const at of q.at) bm.setMatrixAt(bm.addInstance(id), at);
    }
    // the boxes under the kit already cast the city's shadows
    bm.castShadow = false;
    bm.receiveShadow = true;
    bm.name = `citykit:${mat.name || "batch"}`;
    group.add(bm);
    CITY_KIT.meshes++;
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
  // and the Spire's machinery in its Glass pieces
  const machines = new Set([kit.dress.machinery.stack, kit.dress.machinery.machine]);
  const dressedMachines = want.filter((p) => machines.has(p.piece) && byId.has(p.piece)).length;
  if (KIT_SITES.machinery.length && dressedMachines >= KIT_SITES.machinery.length) for (const m of STAND_INS.machinery) m.visible = false;
  // and the fire escapes, once every storey of every one wears its piece
  const escapeStoreys = KIT_SITES.escapes.reduce((a, e) => a + e.storeys - 1, 0);
  const dressedEscapes = want.filter((p) => p.kind === "escape" && byId.has(p.piece)).length;
  if (escapeStoreys && dressedEscapes >= escapeStoreys) for (const m of STAND_INS.escapes) m.visible = false;
  return CITY_KIT.drawn;
}
