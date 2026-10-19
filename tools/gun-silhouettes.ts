// Each gun's outline for the HUD (docs/PLAN_HUD_V2.md, Milestone 697): the gun's own bought model drawn side-on, flat
// white on nothing, into public/icons/guns/<id>.png, as Hyper Scape's and Apex's weapon panels and kill feeds show a
// gun's outline. Ours from our own guns, so the outline is the gun in your hands and no other game's art.
//
// Drawn by the page itself (its own three and its loaded models, window.__range.gunShape), at `PX` wide, the muzzle
// to the left as theirs face, cropped to the gun and centred. The HUD tints it (icons.ts gunIcon).
//
// Run: the dev server up (npm run dev), then npx tsx tools/gun-silhouettes.ts. URL= another page.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import game from "../src/config/games/speedkills.json";

const ROOT = join(import.meta.dirname, "..");
const URL = process.env.URL ?? "http://127.0.0.1:5199/";
const OUT = join(ROOT, "public", "icons", "guns");
/** the picture's width and height, pixels: wide and short, as a gun is */
const PX = 384;
const PY = 128;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 600000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--no-sandbox", "--mute-audio"] });
const page = await browser.newPage();
await page.goto(URL + "?nointro", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready", { timeout: 240000 });
const ids = (game as unknown as { roster: string[] }).roster;
const shots = (await page.evaluate(
  (ids: string[], PX: number, PY: number) => {
    const R = (window as unknown as { __range: { THREE: typeof import("three"); gunShape: (id: string) => import("three").Object3D | null } }).__range;
    const T = R.THREE;
    const canvas = document.createElement("canvas");
    const r = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(PX, PY, false);
    r.setClearColor(0x000000, 0);
    const white = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
    const out: Record<string, string> = {};
    for (const id of ids) {
      const src = R.gunShape(id);
      if (!src) continue;
      const gun = src.clone(true);
      gun.position.set(0, 0, 0);
      gun.rotation.set(0, 0, 0);
      gun.updateMatrixWorld(true);
      gun.traverse((o) => {
        const m = o as import("three").Mesh;
        if (m.isMesh) m.material = white;
      });
      const scene = new T.Scene();
      scene.add(gun);
      scene.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(gun);
      const size = box.getSize(new T.Vector3());
      const mid = box.getCenter(new T.Vector3());
      // side-on, looking along +x: the gun's length (z) across, its height (y) up; the muzzle (-z) to the left
      const aspect = PX / PY;
      const halfW = Math.max(size.z / 2, (size.y / 2) * aspect) * 1.04;
      const halfH = halfW / aspect;
      const cam = new T.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.001, 100);
      cam.position.set(mid.x - Math.max(1, size.x * 4), mid.y, mid.z);
      cam.lookAt(mid);
      r.render(scene, cam);
      out[id] = canvas.toDataURL("image/png");
    }
    r.dispose();
    return out;
  },
  ids,
  PX,
  PY,
)) as Record<string, string>;
for (const [id, url] of Object.entries(shots)) {
  writeFileSync(join(OUT, `${id}.png`), Buffer.from(url.split(",")[1], "base64"));
  console.log(`   ${id}.png`);
}
console.log(`${Object.keys(shots).length} of ${ids.length} guns' outlines: ${OUT}`);
await browser.close();
