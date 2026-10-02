/**
 * A gun in the bought arms' hands placed as another game's gun of its kind is at rest (docs/PLAN_GUNS_IN_HAND.md, the
 * recipe's placement step): its look (fparms.json packGuns look) solved at the gun camera's field of view until the
 * barrel's line meets the screen where the reference's does and the muzzle sits on the reference's, then our gun laid over
 * the reference frame, its outline in red and a ghost of it, to judge by eye.
 *
 * The reference: a frame of the gun at rest from the game's own weapon showcase (a still camera), 16:9; where its barrel's
 * line meets the screen (`vp`, read by extending the barrel's edges on a grid) and its muzzle (`muzzle`), as shares of the
 * screen from the left and from the top.
 *
 *   ID=r97 REF=r99-rest.jpg OUT=shots CANDS='[{"name":"r99","vp":[0.25,0.58],"muzzle":[0.55,0.74],"dz":-0.3}]' \
 *     npx tsx tools/gun-fit.ts
 *
 * A candidate is a `look` to show as it is ([x, y, z view metres, up, left, roll radians]), or a `vp` and `muzzle` (and
 * `level`, the degrees off level of the gun's across axis on the screen) to solve
 * for, starting from the gun's look with `dz` added to its depth (how far from the eye: further, smaller) and `roll` in place
 * of its roll. `fov` draws it at another gun FOV. NOARMS=1 hides the arms for a gun-only comparison. Each writes
 * <ID>-<name>-normal.png (the game's picture), -over.png (the reference with ours laid on it) and -mask.png, and prints the
 * look to put in fparms.json.
 */
import fs from "node:fs";
import puppeteer from "puppeteer";
import sharp from "sharp";

type Cand = { name: string; look?: number[]; fov?: number; vp?: number[]; muzzle?: number[]; dz?: number; roll?: number; level?: number };
type Measure = { vanish: number[]; muzzle: number[]; across: number; wrists: number[]; short: number; tanH: number; tanV: number };

const OUT = process.env.OUT ?? ".";
const ID = process.env.ID ?? "r97";
const REF = process.env.REF;
if (!REF) throw new Error("REF=<the reference frame> is needed");
const CANDS: Cand[] = JSON.parse(process.env.CANDS ?? '[{"name":"now"}]');
const W = 1920;
const H = 1080;
// (the page never takes the real mouse: tools/e2e.ts NO_REAL_MOUSE, input.ts's webdriver guard)
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const ref = await sharp(REF).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(NO_REAL_MOUSE);
  // the owner's view (FOV 110) and the key list off, as the reference frames have none
  await page.evaluateOnNewDocument(`try { const k = "range.settings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.fovScale = 1.571; localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem("range.quality", "high"); localStorage.setItem("range.keyHints", "off"); } catch {}`);
  await page.goto(`${process.env.SHOT_URL ?? "http://localhost:5196/"}?game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction("window.__range && window.__range.loaded() && window.__range.paidGuns().ready && window.__range.soldierReady()", { polling: 250, timeout: 180000 });
  await page.evaluate(`(() => { const r = window.__range; document.getElementById("overlay").classList.add("hidden"); r.input.locked = true; r.player.teleport(0, 0, 0, 0, 0); r.debugView.inspect = -1; r.debugView.flourish = -1; r.loadout.give(0, "${ID}"); r.loadout.requestSwap(0, r.gameTime()); })()`);
  await wait(3500);
  // where the barrel's line meets the screen (its direction from back to front, projected) and the muzzle, in the gun
  // camera's frame (x right, y up, -1 to 1), under a look
  await page.evaluate(`(() => {
    const r = window.__range; const T = r.THREE; const rig = r.packRig();
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    window.__gunFit = async (look) => {
      rig.debugHipLook = look; await frame(); await frame();
      const root = r.viewModelRoot(); let gun = null; root.traverse((x) => { if (x.userData && x.userData.paid && !gun) gun = x; });
      gun.updateWorldMatrix(true, true);
      const inv = new T.Matrix4().copy(gun.matrixWorld).invert(); const lb = new T.Box3();
      gun.traverse((m) => { if (m.isMesh && m.visible) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); lb.union(m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } });
      const vinv = new T.Matrix4().copy(root.matrixWorld).invert();
      const tv = Math.tan(r.gunFov().gun / 2 * Math.PI / 180); const th = tv * innerWidth / innerHeight;
      const toV = (p) => p.clone().applyMatrix4(gun.matrixWorld).applyMatrix4(vinv);
      const scr = (v) => [v.x / -v.z / th, v.y / -v.z / tv];
      const c = lb.getCenter(new T.Vector3());
      const back = toV(new T.Vector3(c.x, c.y, lb.max.z)), front = toV(new T.Vector3(c.x, c.y, lb.min.z));
      const d = front.clone().sub(back);
      // the gun's across axis on the screen, degrees from level (a vector square to the view's line keeps its angle in
      // the picture; below 0 its right end lower), folded to -90..90
      const ax = toV(new T.Vector3(c.x + 0.1, c.y, c.z)).sub(toV(c));
      let across = Math.atan2(ax.y, ax.x) * 180 / Math.PI;
      if (across > 90) across -= 180;
      if (across < -90) across += 180;
      const s = r.packArms();
      return { vanish: d.z < 0 ? scr(d) : [9, 9], muzzle: scr(front), across, wrists: [s.wristL, s.wristR], short: Math.max(s.reachShort, s.reachShortR), tanH: th, tanV: tv };
    };
  })()`);
  // (everything but the game's own canvas hidden for the gun-alone shot: the HUD and the page's panels)
  const hideDom = (on: boolean) => page.evaluate(`(() => { const gl = [...document.querySelectorAll("canvas")].find((c) => !c.id && c.width >= 1000); const keep = new Set(); for (let e = gl; e; e = e.parentElement) keep.add(e); const walk = (p) => { for (const el of p.children) { if (keep.has(el)) walk(el); else if (el !== gl) el.style.visibility = ${on} ? "hidden" : ""; } }; walk(document.body); })()`);
  const base = (await page.evaluate(`(() => { const L = window.__range.packRig().hipLook; return [...L.shift, ...L.turn]; })()`)) as number[];
  for (const c of CANDS) {
    await page.evaluate(`(() => { window.__range.debugView.gunFov = ${c.fov ?? null}; })()`);
    await wait(300);
    if (c.vp && c.muzzle) {
      // shares of the screen to the gun camera's frame
      const vx = c.vp[0] * 2 - 1;
      const vy = 1 - c.vp[1] * 2;
      const mxT = c.muzzle[0] * 2 - 1;
      const myT = 1 - c.muzzle[1] * 2;
      const L = [base[0], base[1], base[2] + (c.dz ?? 0), base[3], base[4], c.roll ?? base[5]];
      const meas = async (look: number[]) => (await page.evaluate(`window.__gunFit(${JSON.stringify(look)})`)) as Measure;
      let mm = await meas(L);
      for (let it = 0; it < 8; it++) {
        // turned until the barrel's line meets the screen at `vp` (the angle off it taken away each pass) and, with `level`,
        // rolled until its across axis is that many degrees off level on the screen (the reference's cross edges: below 0
        // its right end lower); then moved across and up until the muzzle is on `muzzle` (a step each way measured, the
        // two solved together)
        for (let k = 0; k < 6; k++) {
          const offVp = Math.abs(mm.vanish[0] - vx) > 0.004 || Math.abs(mm.vanish[1] - vy) > 0.004;
          const offLevel = c.level !== undefined && Math.abs(mm.across - c.level) > 0.3;
          if (!offVp && !offLevel) break;
          if (offLevel) L[5] += ((c.level! - mm.across) * Math.PI) / 180;
          L[3] += Math.atan(vy * mm.tanV) - Math.atan(mm.vanish[1] * mm.tanV);
          L[4] += Math.atan(-vx * mm.tanH) - Math.atan(-mm.vanish[0] * mm.tanH);
          mm = await meas(L);
        }
        const ex = mxT - mm.muzzle[0];
        const ey = myT - mm.muzzle[1];
        if (Math.abs(ex) < 0.006 && Math.abs(ey) < 0.006) break;
        const h = 0.02;
        const mx = await meas([L[0] + h, ...L.slice(1)]);
        const my = await meas([L[0], L[1] + h, ...L.slice(2)]);
        const a = (mx.muzzle[0] - mm.muzzle[0]) / h;
        const b = (my.muzzle[0] - mm.muzzle[0]) / h;
        const cc = (mx.muzzle[1] - mm.muzzle[1]) / h;
        const dd = (my.muzzle[1] - mm.muzzle[1]) / h;
        const det = a * dd - b * cc;
        if (Math.abs(det) < 1e-9) break;
        L[0] += (dd * ex - b * ey) / det;
        L[1] += (-cc * ex + a * ey) / det;
        mm = await meas(L);
      }
      c.look = L;
      console.log(`${ID} ${c.name}: look ${JSON.stringify({ shift: L.slice(0, 3).map((x) => +x.toFixed(4)), turn: L.slice(3).map((x) => +x.toFixed(4)) })}, barrel line ${mm.vanish.map((x) => x.toFixed(3))}, muzzle ${mm.muzzle.map((x) => x.toFixed(3))}, across ${mm.across.toFixed(1)} deg, wrists ${mm.wrists.map(Math.round)}, arms short ${(mm.short * 1000).toFixed(1)} mm`);
    }
    await page.evaluate(`(() => { const r = window.__range; r.packRig().debugHipLook = ${JSON.stringify(c.look ?? null)}; r.packRig().group.traverse((o) => { if (o.isMesh) o.visible = ${process.env.NOARMS ? "false" : "true"}; }); })()`);
    await wait(700);
    const normal = await page.screenshot({ type: "png" });
    // the gun alone over a magenta world (main.ts soloGun), the key cut out of it
    await page.evaluate(`window.__range.soloGun(true)`);
    await hideDom(true);
    await wait(400);
    const solo = await sharp(await page.screenshot({ type: "png" })).removeAlpha().raw().toBuffer();
    await page.evaluate(`window.__range.soloGun(false)`);
    await hideDom(false);
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = solo[i * 3];
      const g = solo[i * 3 + 1];
      const b = solo[i * 3 + 2];
      mask[i] = r > 150 && b > 150 && g < 90 && Math.abs(r - b) < 70 ? 0 : 1;
    }
    // the reference with our gun on it: a 3 px outline in red, a 35% ghost inside
    const out = Buffer.from(ref);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        let edge = false;
        for (let d = 1; d <= 3 && !edge; d++) {
          if ((x >= d && !mask[i - d]) || (x < W - d && !mask[i + d]) || (y >= d && !mask[i - d * W]) || (y < H - d && !mask[i + d * W])) edge = true;
        }
        if (edge) {
          out[i * 3] = 255;
          out[i * 3 + 1] = 40;
          out[i * 3 + 2] = 40;
        } else for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(ref[i * 3 + k] * 0.65 + solo[i * 3 + k] * 0.35);
      }
    }
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${OUT}/${ID}-${c.name}-over.png`);
    fs.writeFileSync(`${OUT}/${ID}-${c.name}-normal.png`, normal);
    await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${OUT}/${ID}-${c.name}-mask.png`);
    console.log(`${ID} ${c.name}: written`);
  }
} finally {
  await browser.close();
}
