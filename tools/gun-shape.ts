// A held gun's shape, measured (Phase 27, 27.11): where its grip, trigger guard, magazine and fore-end are, in the gun's
// own frame (cm; -z its muzzle, +y up, +x its right), so a hand's hold is started from the gun and not guessed. Every
// triangle is sampled every 3 to 4 mm, so a big face counts as well as its corners.
//
//   side [z0]      the gun's half-thickness (|x|, cm) in each 1 cm cell of its side view, 36 cm from z0 back and
//                  from 3 cm under the bore to 29 cm under it: a grip, a guard's opening, a magazine read off at a glance
//                  (how the USSO's full-hand trigger guard, 7.5 cm tall and 4 cm deep, was found)
//   across z...    the gun's cross-section at each z: its x extent in each 1 cm of height (a fore-end's width and bottom)
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/gun-shape.ts <gun id> side [z0] | across <z> [z...]
// (the model as the soldier holds it, at its soldierhold.json scale; ?norender, never the real mouse or keyboard)
import puppeteer from "puppeteer";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [ID = "r97", MODE = "side", ...REST] = process.argv.slice(2);
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;

/** in the page: every triangle of the shown gun sampled, gun-local, handed to `each` (metres) */
const SAMPLE = `(each) => {
  const r = window.__range, T = r.THREE;
  const gun = r.labFigures()[0].figure.gunObject;
  gun.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(gun.matrixWorld).invert();
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), v = new T.Vector3();
  gun.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== gun; p = p.parent) if (!p.visible) return;
    const pos = o.geometry.getAttribute("position"), idx = o.geometry.index;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const n = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < n; t++) {
      A.fromBufferAttribute(pos, idx ? idx.getX(3 * t) : 3 * t).applyMatrix4(m);
      B.fromBufferAttribute(pos, idx ? idx.getX(3 * t + 1) : 3 * t + 1).applyMatrix4(m);
      C.fromBufferAttribute(pos, idx ? idx.getX(3 * t + 2) : 3 * t + 2).applyMatrix4(m);
      const k = Math.max(1, Math.ceil(Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)) / 0.0035));
      for (let u = 0; u <= k; u++)
        for (let w = 0; w <= k - u; w++) {
          const a = u / k, b = w / k, c = 1 - a - b;
          each(v.set(A.x * a + B.x * b + C.x * c, A.y * a + B.y * b + C.y * c, A.z * a + B.z * b + C.z * c));
        }
    }
  });
}`;

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro&norender`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { timeout: 90000, polling: 250 });
    await page.waitForFunction("window.__range.paidGuns().ready", { timeout: 60000, polling: 250 }).catch(() => console.log("the bought guns did not load: the procedural ones are measured"));
    await page.evaluate(`(() => { const r = window.__range; r.figureLabManual(false); r.figureLab([{ speed: 0, stance: "stand", pitch: 0, weapon: ${JSON.stringify(ID)}, look: "S0000010" }], 2.6, 0); r.figureLabManual(true); r.figureLabStep(0.3); })()`);
    const holds = await page.evaluate(`(() => { const mq = window.__range.labFigures()[0].figure; const f = (p) => p.toArray().map((x) => (x * 100).toFixed(1)).join(", "); return "grip (" + f(mq.grip) + "), support (" + f(mq.support) + ")"; })()`);
    console.log(`${ID}, cm in its own frame: its hold points ${holds}`);
    if (MODE === "side") {
      const z0 = Number(REST[0] ?? -6);
      const rows = (await page.evaluate(`(() => {
        const cells = new Map();
        (${SAMPLE})((v) => {
          if (v.y > -0.02 || v.y < -0.3 || v.z < ${z0 / 100 - 0.005} || v.z > ${(z0 + 35) / 100 + 0.005}) return;
          const key = Math.round(v.y * 100) + "," + Math.round(v.z * 100);
          cells.set(key, Math.max(cells.get(key) ?? 0, Math.abs(v.x)));
        });
        const rows = ["   z " + Array.from({ length: 36 }, (_, i) => String((((${z0} + i) % 10) + 10) % 10).padStart(2)).join("")];
        for (let y = -3; y >= -29; y--) {
          let line = String(y).padStart(4) + " ";
          for (let z = ${z0}; z <= ${z0 + 35}; z++) { const x = cells.get(y + "," + z); line += x === undefined ? " ." : String(Math.min(9, Math.round(x * 100))).padStart(2); }
          rows.push(line);
        }
        return rows;
      })()`)) as string[];
      console.log(`half-thickness |x| (cm) by height y (rows, cm) and z from ${z0} (columns, the last digit shown):`);
      console.log(rows.join("\n"));
    } else {
      for (const z of REST.map(Number)) {
        const row = (await page.evaluate(`(() => {
          const rows = new Map();
          (${SAMPLE})((v) => {
            if (Math.abs(v.z - ${z / 100}) > 0.005) return;
            const y = Math.round(v.y * 100);
            const s = rows.get(y) ?? [9, -9];
            s[0] = Math.min(s[0], v.x); s[1] = Math.max(s[1], v.x);
            rows.set(y, s);
          });
          return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([y, s]) => y + ": " + (s[0] * 100).toFixed(1) + " to " + (s[1] * 100).toFixed(1)).join("   ");
        })()`)) as string;
        console.log(`z ${z}, x at each height y: ${row}`);
      }
    }
  } finally {
    await browser.close();
  }
}

void main();
