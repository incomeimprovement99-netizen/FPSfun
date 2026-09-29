// What the map costs, for the before and after of a rebuild (Phase 28: the owner, 2026-09-28, "we want to make the
// before vs after performance and triangle / polygon testing so that we can see the difference"). For each graphics
// preset, a page of SpeedKills loaded from nothing:
//   - what it downloaded (models, textures, code), and how long until it was loaded;
//   - what the scene holds once loaded: meshes, instanced copies, triangles (an instanced mesh counted once a copy),
//     unique geometries and their vertex memory, materials, textures and their memory.
// The frames (time, draw calls, triangles a frame, in a match and over the centre) are tools/bench.ts's; run both.
// Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5212/ npx tsx tools/map-stats.ts <label> [out.json]; STATS_QUERY=&map=neon for the Neon
// City map (Phase 28), which is measured once its file is drawn
import puppeteer from "puppeteer";
import { writeFileSync } from "node:fs";

const URL = process.env.SHOT_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PRESETS = (process.env.STATS_PRESETS ?? "competitive,balanced,high").split(",");
const QUERY = process.env.STATS_QUERY ?? "";
const [label = "map", out] = process.argv.slice(2);
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

type Stats = {
  preset: string;
  loadS: number;
  mb: { models: number; textures: number; code: number; other: number; total: number };
  scene: { meshes: number; instanced: number; copies: number; triangles: number; geometries: number; geometryMb: number; materials: number; textures: number; textureMb: number };
  /** the map's own part of it: what hangs under the map's root (the range, the figures and the ship are the rest) */
  map: { meshes: number; triangles: number; materials: number };
};

const kind = (url: string): keyof Stats["mb"] => {
  const u = url.split("?")[0].toLowerCase();
  if (/\.(glb|gltf|bin|fbx|obj)$/.test(u)) return "models";
  if (/\.(ktx2|png|jpe?g|webp|basis|hdr|exr)$/.test(u)) return "textures";
  if (/\.(js|mjs|ts|tsx|wasm|css|html)$/.test(u) || u.endsWith("/")) return "code";
  return "other";
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
const all: Stats[] = [];
try {
  for (const preset of PRESETS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    // a fresh cache each preset, so its downloads are its own
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const bytes = { models: 0, textures: 0, code: 0, other: 0, total: 0 };
    const urls = new Map<string, string>();
    cdp.on("Network.responseReceived", (e: { requestId: string; response: { url: string } }) => urls.set(e.requestId, e.response.url));
    cdp.on("Network.loadingFinished", (e: { requestId: string; encodedDataLength: number }) => {
      const k = kind(urls.get(e.requestId) ?? "");
      bytes[k] += e.encodedDataLength;
      bytes.total += e.encodedDataLength;
    });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument((v: string) => localStorage.setItem("range.quality", v), preset);
    const t0 = Date.now();
    await page.goto(`${URL}?nointro&game=speedkills${QUERY}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 300000 });
    // and the bought files, which load after the page says it is loaded
    await page.waitForFunction("(!window.__range.cityKit || window.__range.cityKit().drawn > 0 || window.__range.cityKit().pieces === 0) && (!window.__range.cityDistricts || window.__range.cityDistricts().drawn.length >= 0)", { timeout: 300000 }).catch(() => undefined);
    await page.waitForFunction("!window.__range.neonMap || !window.__range.neonMap().on || window.__range.neonMap().drawn", { timeout: 300000 }).catch(() => undefined);
    await page.waitForNetworkIdle({ idleTime: 3000, timeout: 300000 }).catch(() => undefined);
    const loadS = (Date.now() - t0) / 1000;
    const scene = (await page.evaluate(`(() => {
      const r = window.__range;
      let meshes = 0, instanced = 0, copies = 0, triangles = 0;
      const geos = new Set(), mats = new Set();
      let geometryBytes = 0;
      const scene = r.scene;
      if (!scene || !scene.isScene) return null;
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        const tri = (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
        const n = o.isInstancedMesh ? o.count : 1;
        meshes++;
        if (o.isInstancedMesh) { instanced++; copies += n; }
        triangles += tri * n;
        if (!geos.has(g)) {
          geos.add(g);
          for (const a of Object.values(g.attributes)) geometryBytes += a.array ? a.array.byteLength : 0;
          if (g.index && g.index.array) geometryBytes += g.index.array.byteLength;
        }
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) mats.add(m);
      });
      const tex = r.textureMemory();
      let mMeshes = 0, mTris = 0;
      const mMats = new Set();
      r.brMap.root.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        mMeshes++;
        mTris += ((g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3) * (o.isInstancedMesh ? o.count : 1);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) mMats.add(m);
      });
      return { meshes, instanced, copies, triangles: Math.round(triangles), geometries: geos.size, geometryMb: +(geometryBytes / 1e6).toFixed(1), materials: mats.size, textures: tex.textures, textureMb: tex.mb, map: { meshes: mMeshes, triangles: Math.round(mTris), materials: mMats.size } };
    })()`)) as (Stats["scene"] & { map: Stats["map"] }) | null;
    const mb = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, +(v / 1e6).toFixed(1)])) as Stats["mb"];
    if (!scene) throw new Error("no scene to measure");
    const { map, ...rest } = scene;
    const s: Stats = { preset, loadS: +loadS.toFixed(1), mb, scene: rest, map };
    all.push(s);
    console.log(
      `${label} ${preset.padEnd(11)} loaded in ${String(s.loadS).padStart(5)} s   downloaded ${String(mb.total).padStart(6)} MB (models ${mb.models}, textures ${mb.textures}, code ${mb.code})   ` +
        `map ${(map.triangles / 1e6).toFixed(2)}M triangles in ${map.meshes} meshes, ${map.materials} materials   ` +
        `scene ${(scene.triangles / 1e6).toFixed(2)}M triangles in ${scene.meshes} meshes (${scene.instanced} instanced, ${scene.copies} copies), ${scene.geometries} geometries ${scene.geometryMb} MB, ${scene.materials} materials, ${scene.textures} textures ${scene.textureMb} MB`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
if (out) writeFileSync(out, JSON.stringify({ label, url: URL, at: new Date().toISOString(), presets: all }, null, 1));
