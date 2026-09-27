// The soldier's head against the head hit volume (Phase 21 S7): the hit volumes are the figures' own, fixed in the
// figure (dummy.ts: a 0.13 m sphere at 1.68 m, squashed to two thirds crouched), and the soldier is drawn at the
// figures' height, so its head should sit in that sphere in every pose. Measured, not looked at: every vertex the
// soldier's head owns (weighted at least half to its Head bone, the helmet with it), skinned to where it is drawn
// this frame, and the share of them inside the volume and how far their middle is from its centre. Prints the
// numbers and takes a picture with the volumes drawn over the figures. Headless, never the real mouse or keyboard.
//
// Run: SHOT_URL=http://localhost:5196/ npx tsx tools/soldier-hits.ts [out.png]
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5196/";
const OUT = process.argv[2] ?? "docs/updates/2026-09-28-soldier-hits.png";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/** the poses a head is shot in: standing, aiming, on the move, low */
export const HIT_POSES: Array<[string, Record<string, unknown>]> = [
  ["idle", { speed: 0, stance: "stand" }],
  ["aim", { speed: 0, stance: "stand", ads: 1 }],
  ["walk", { speed: 2.5, stance: "stand" }],
  ["run", { speed: 7, stance: "stand" }],
  ["sprint", { speed: 14, stance: "stand" }],
  ["crouch", { speed: 0, stance: "crouch" }],
  ["crouch walk", { speed: 3, stance: "crouch" }],
  ["slide", { speed: 12, stance: "slide" }],
];

/** the page's side: for each lab figure, its head's vertices against its head volume */
export const MEASURE_HEADS = `(() => {
  const r = window.__range;
  const THREE = r.THREE;
  const v = new THREE.Vector3();
  return r.labFigures().map((f) => {
    f.group.updateMatrixWorld(true);
    const vol = f.hitMeshes.find((m) => m.userData.zone === "head");
    const inv = vol.matrixWorld.clone().invert();
    const R = vol.geometry.parameters.radius;
    const mid = new THREE.Vector3();
    let n = 0;
    let inside = 0;
    const root = f.mq?.root;
    if (!root) return { soldier: false, n: 0, inside: 0, offset: -1, volY: 0, headY: 0 };
    root.traverse((o) => {
      if (!o.isSkinnedMesh || !o.visible) return;
      const h = o.skeleton.bones.findIndex((b) => b.name === "Head");
      if (h < 0) return;
      const si = o.geometry.attributes.skinIndex;
      const sw = o.geometry.attributes.skinWeight;
      const idx = o.geometry.index;
      const count = o.geometry.attributes.position.count;
      const used = new Uint8Array(count);
      if (idx) for (let k = 0; k < idx.count; k++) used[idx.getX(k)] = 1;
      else used.fill(1);
      for (let i = 0; i < count; i++) {
        if (!used[i]) continue;
        let w = 0;
        for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
        if (w < 0.5) continue;
        o.getVertexPosition(i, v);
        v.applyMatrix4(o.matrixWorld);
        mid.add(v);
        n++;
        if (v.clone().applyMatrix4(inv).length() <= R) inside++;
      }
    });
    mid.divideScalar(Math.max(1, n));
    const c = new THREE.Vector3().setFromMatrixPosition(vol.matrixWorld);
    return { soldier: !!f.mq.soldier, n, inside: inside / Math.max(1, n), offset: mid.distanceTo(c), volY: c.y - f.group.position.y, headY: mid.y - f.group.position.y };
  });
})()`;

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 60000 });
    await page.evaluate(`document.getElementById("overlay").classList.add("hidden")`);
    console.log("soldier ready:", await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 60000 }).then(() => true, () => false));
    const poses = HIT_POSES.map(([, p]) => ({ pitch: 0, look: "S0000000", ...p }));
    await page.evaluate(`(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, -8); r.hideViewModel(true); r.figureLab(${JSON.stringify(poses)}, 4.5, 90); })()`);
    await new Promise((r) => setTimeout(r, 1500));
    const got = await page.evaluate(MEASURE_HEADS) as Array<{ soldier: boolean; n: number; inside: number; offset: number; volY: number; headY: number }>;
    HIT_POSES.forEach(([name], i) => {
      const g = got[i];
      console.log(`${name.padEnd(12)} soldier ${g.soldier}  head vertices ${g.n}  inside the volume ${(g.inside * 100).toFixed(0)}%  middle ${(g.offset * 1000).toFixed(0)} mm from its centre  (volume ${g.volY.toFixed(3)} m, head ${g.headY.toFixed(3)} m)`);
    });
    // the volumes drawn in, for the picture
    await page.evaluate(`(() => { const r = window.__range; const THREE = r.THREE; const mat = new THREE.MeshBasicMaterial({ color: 0xff2020, wireframe: true, depthTest: false }); for (const f of r.labFigures()) for (const m of f.hitMeshes) { m.material = m.userData.zone === "head" ? mat : new THREE.MeshBasicMaterial({ color: 0x20ff60, wireframe: true, transparent: true, opacity: 0.35 }); m.visible = true; } })()`);
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: OUT });
    console.log(OUT);
  } finally {
    await browser.close();
  }
}
