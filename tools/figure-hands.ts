// The soldier's hands on its gun, close (Phase 27, 27.11): each hold (the right hand's grip, the left hand's) from the
// gun's right, its left and its front, half a metre off, aimed in, each tile captioned with what tools/figure-audit.js
// measures of that hand (its skin in the gun, its palm and its holding fingers off it). The frame sheets' tiles are too
// small to judge a finger against a trigger guard: these are what showed the USSO's right hand across its grip and
// BOOG's flat on its receiver, both of which the measures had passed.
//
// Seen from the left the chest stands between the camera and the right hand, and from the front the left arm does: for
// those the camera's near plane is put 0.42 m out, so what is nearer is not drawn and the hand (0.5 m and more) is. A
// finger drawn hollow is one the near plane cut: nearer than that. The left hand is seen whole from all three.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-hands.ts [out dir] [gun ids...]
//      GUNONLY=1 hides the soldier and draws a centimetre grid in the gun's own middle plane (red every 5 cm): how a
//      new gun's grip and fore-end are measured before its hands are fitted (tools/gun-shape.ts gives the numbers)
//      XRAY=1 adds each view with the soldier see-through and the skin found in the gun marked
//      TUNE='{"hands":...}' tries hold numbers over the gun's own before photographing (soldierhold.json guns.<id>)
//      POSE='{"speed":14}' photographs the hands in another pose than aimed in (a lab pose: speed, stance, pitch, ads, act)
// (needs the dev server and a real GPU; never the real mouse or keyboard)
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";
import sharp from "sharp";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(process.argv[2] ?? "shots/hands");
const IDS = process.argv.slice(3).length ? process.argv.slice(3) : ["r97", "sentinel"];
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
/** each view: the figure's turn from facing the camera (degrees) */
const VIEWS: Record<string, number> = { right: 90, left: -90, front: 0 };
/** the camera's near plane for each hold's views (metres): past the chest and the other arm where they are in the way */
const NEAR: Record<string, Record<string, number>> = { grip: { right: 0.1, left: 0.42, front: 0.42 }, support: { right: 0.1, left: 0.1, front: 0.1 } };
const HOLDS = { grip: "r", support: "l" } as const;
/** how far in front of the camera the hold is put, metres */
const OFF = 0.55;
const CLIP = { x: 200, y: 200, width: 600, height: 600 };
const TILE = 300;
/** the pose the hands are photographed in: aimed in, or what POSE says over it */
const POSE = { speed: 0, stance: "stand", pitch: 0, ads: 1, ...(process.env.POSE ? (JSON.parse(process.env.POSE) as object) : {}) };

type Audit = { handWhere?: Record<string, number>; palmGap?: { l: number; r: number }; fingerGap?: Record<string, number> };
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** what the audit says of one hand: its deepest skin in the gun, its palm's gap, and each finger's gap, mm */
function caption(a: Audit | null, side: "l" | "r"): string {
  if (!a) return "no figure";
  const deep = Math.max(0, ...Object.entries(a.handWhere ?? {}).filter(([b]) => b.endsWith(`_${side}`)).map(([, d]) => d));
  const off = ["thumb", "index", "middle", "ring", "pinky"].map((f) => `${f[0]}${a.fingerGap?.[`${f}_${side}`] ?? "-"}`).join(" ");
  return `in gun ${deep} mm, palm off ${a.palmGap?.[side] ?? "-"} mm, fingers off ${off}`;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded() && window.__range.soldierReady()", { timeout: 90000, polling: 250 });
    await page.waitForFunction("window.__range.paidGuns().ready", { timeout: 60000, polling: 250 }).catch(() => console.log("the bought guns did not load: the procedural ones are shown"));
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });
    await ev(page, `(() => { document.getElementById("overlay").classList.add("hidden"); document.getElementById("hud")?.style.setProperty("visibility", "hidden"); const r = window.__range; r.hideViewModel(true); r.shotFov(40); })()`);
    for (const id of IDS) {
      const tiles: Buffer[] = [];
      for (const [hold, side] of Object.entries(HOLDS)) {
        for (const [view, turn] of Object.entries(VIEWS)) {
          // the figure aimed in, then moved so its hold is OFF in front of the camera
          const audit = await ev<Audit | null>(
            page,
            `(() => {
              const r = window.__range, T = r.THREE;
              r.player.teleport(0, 0, 0, 0, 0);
              ${process.env.TUNE ? `r.rifleTune({ guns: { ${JSON.stringify(id)}: ${process.env.TUNE} } });` : ""}
              r.figureLabManual(false);
              r.figureLab([${JSON.stringify({ ...POSE, weapon: "@" })}].map((p) => ({ ...p, weapon: ${JSON.stringify(id)}, look: "S0000010" })), 2.6, ${turn});
              r.figureLabManual(true);
              r.figureLabStep(0.8);
              const f = r.labFigures()[0], mq = f.figure;
              f.group.updateMatrixWorld(true);
              const at = mq.holdPoints()[${JSON.stringify(hold)}].clone();
              const cam = r.camera;
              cam.near = ${NEAR[hold][view]};
              cam.updateProjectionMatrix();
              cam.updateMatrixWorld(true);
              const want = cam.getWorldPosition(new T.Vector3()).addScaledVector(cam.getWorldDirection(new T.Vector3()), ${OFF});
              f.group.position.add(want.sub(at));
              r.figureLabStep(0.001);
              if (${process.env.GUNONLY === "1"}) {
                mq.root.traverse((o) => { if (o.isSkinnedMesh) o.visible = false; });
                const pts = [], cols = [];
                const col = (k) => (k % 5 === 0 ? [1, 0.2, 0.2] : [0.2, 0.6, 1]);
                for (let a = -30; a <= 30; a++) { pts.push(0, -0.3, a / 100, 0, 0.05, a / 100); cols.push(...col(a), ...col(a)); }
                for (let b = -30; b <= 5; b++) { pts.push(0, b / 100, -0.3, 0, b / 100, 0.3); cols.push(...col(b), ...col(b)); }
                const g = new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(pts, 3)).setAttribute("color", new T.Float32BufferAttribute(cols, 3));
                const lines = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthTest: false }));
                lines.renderOrder = 998;
                mq.gunObject.add(lines);
              }
              return window.__figureAudit(0, { pitch: ${POSE.pitch ?? 0}, handsOnly: true });
            })()`,
          );
          await wait(400);
          const file = path.join(OUT, `${id}-${hold}-${view}.png`);
          await page.screenshot({ path: file as `${string}.png`, clip: CLIP });
          const svg = `<svg width="${TILE}" height="${TILE}"><rect width="${TILE}" height="34" fill="rgba(0,0,0,0.7)"/><text x="5" y="14" font-family="Arial" font-size="11" fill="#fff">${esc(`${id} ${hold} (${side === "r" ? "right" : "left"} hand) from the ${view}`)}</text><text x="5" y="29" font-family="Arial" font-size="10" fill="#ddd">${esc(caption(audit, side))}</text></svg>`;
          tiles.push(await sharp(file).resize(TILE, TILE).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer());
          if (process.env.XRAY === "1") {
            await ev(
              page,
              `(() => {
                const r = window.__range, T = r.THREE, mq = r.labFigures()[0].figure;
                const pts = window.__figureAudit(0, { pitch: ${POSE.pitch ?? 0}, pts: true }).pts ?? [];
                const mats = new Map();
                mq.root.traverse((o) => { if (o.isSkinnedMesh) for (const m of [].concat(o.material)) if (!mats.has(m)) { mats.set(m, [m.transparent, m.opacity, m.depthWrite]); m.transparent = true; m.opacity = 0.25; m.depthWrite = false; } });
                const g = new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(pts.flatMap((q) => q.slice(0, 3)), 3));
                const dots = new T.Points(g, new T.PointsMaterial({ color: 0xffdd00, size: 4, sizeAttenuation: false, depthTest: false }));
                dots.renderOrder = 999;
                r.scene.add(dots);
                window.__handsUndo = () => { r.scene.remove(dots); for (const [m, [t, o, d]] of mats) { m.transparent = t; m.opacity = o; m.depthWrite = d; } };
              })()`,
            );
            await wait(300);
            await page.screenshot({ path: file.replace(/\.png$/, "-xray.png") as `${string}.png`, clip: CLIP });
            await ev(page, "window.__handsUndo()");
          }
          console.log(`${file}: ${caption(audit, side)}`);
        }
      }
      const sheet = path.join(OUT, `${id}-hands-sheet.png`);
      await sharp({ create: { width: TILE * 3, height: TILE * 2, channels: 3, background: "#000" } })
        .composite(tiles.map((t, i) => ({ input: t, left: (i % 3) * TILE, top: Math.floor(i / 3) * TILE })))
        .png()
        .toFile(sheet);
      console.log(sheet);
    }
    await ev(page, "(() => { const r = window.__range; r.camera.near = 0.1; r.camera.updateProjectionMatrix(); r.figureLabManual(false); })()");
  } finally {
    await browser.close();
  }
}

void main();
