// The third-person figure, frame by frame (Phase 27, 27.7): the soldier as another player sees it, holding the USSO
// and BOOG through everything a figure does with a gun, photographed a frame at a time and measured, as
// tools/pack-frames.ts does the first-person arms. The owner: "check out how we have the frame by frame tool for the
// first person FOV, we should be doing the third person / enemy view the same", and "Have you taken all screenshots
// frame by frame when the enemy is reloading and changing weapons and jumping and stuff of that nature?"
//
// Each sequence is played on a lab figure stepped by the tool (main.ts figureLabStep), so a reload's frames land at
// 0, 4, 8 ... 100% of it exactly; each frame is photographed from the angles an enemy sees it from and measured by
// tools/figure-audit.js: each palm against the point it holds, the barrel against the way the figure looks, the
// wrists, a hand's skin into the gun and the gun into the body. A tile's caption says what was measured and, in red,
// what is at fault. The Loadouts tab's soldier is photographed too, holding each gun, from four sides.
//
// Run: SHOT_URL=http://localhost:5198/ npx tsx tools/figure-frames.ts [out dir] [gun ids...]
//      SEQ=reload,swap  VIEWS=front,right  DIST=far,close
// (needs the dev server; a real GPU, as pack-frames.ts has; never the real mouse or keyboard)
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer";
import sharp from "sharp";

const URL = process.env.SHOT_URL ?? "http://localhost:5198/";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(process.argv[2] ?? "shots/figure");
const IDS = process.argv.slice(3).length ? process.argv.slice(3) : ["r97", "sentinel"];
const W = 1600;
const H = 1000;
const COLS = 6;
const TILE = { w: 300, h: 380 };
const NO_REAL_MOUSE = `for (const t of ["pointerrawupdate", "pointermove", "mousemove"]) window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);`;
/** the soldier every frame is taken on (soldier.ts code): the default kit, so the arms are not hidden by one */
const LOOK = "S0000010";

/** the bar a frame is held to (27.7); a caption says the measure, and in red what is past it */
const BAR = { grip: 3, support: 4, aim: 6, wrist: 60, handIn: 6, gunIn: 15 };
const XRAY = process.env.XRAY === "1";

type Pose = { speed: number; stance: string; pitch?: number; ads?: number; moveDir?: number; act?: string | null; weapon?: string };
type Times = { reload: number; reloadEmpty: number; deploy: number; holster: number };
/** a sequence: its pose to settle into, then what it does over time (a pose from each moment on), and when to photograph it */
type Seq = { name: string; settle: Pose; at: (t: number) => Pose; frames: number[]; label: (t: number) => string; aimed: (t: number) => boolean; kicks?: number[] };

const stand: Pose = { speed: 0, stance: "stand", pitch: 0 };
const every = (to: number, step: number, from = 0) => {
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
};

function sequences(gun: string, other: string, T: Times, To: Times): Seq[] {
  const R = T.reload;
  const S = T.holster + To.deploy;
  const pct = (t: number, of: number) => `${Math.round((t / of) * 100)}%`;
  return [
    { name: "idle", settle: stand, at: () => stand, frames: every(1.25, 0.25), label: (t) => `${t.toFixed(2)} s`, aimed: () => true },
    { name: "aim", settle: { ...stand, ads: 1 }, at: () => ({ ...stand, ads: 1 }), frames: every(1, 0.2), label: (t) => `${t.toFixed(2)} s`, aimed: () => true },
    // firing: a shot every tenth of a second (the figure's kick, as a remote's shot gives it), aimed in
    { name: "fire", settle: { ...stand, ads: 1 }, at: () => ({ ...stand, ads: 1 }), frames: every(0.6, 0.05), label: (t) => `${t.toFixed(2)} s`, aimed: () => false, kicks: every(0.5, 0.1) },
    {
      name: "look",
      settle: { ...stand, ads: 1, pitch: -40 },
      at: (t) => ({ ...stand, ads: 1, pitch: -40 + t * 80 }),
      frames: every(1, 1 / 8),
      label: (t) => `pitch ${Math.round(-40 + t * 80)}`,
      aimed: () => true,
    },
    {
      name: "reload",
      settle: stand,
      at: (t) => ({ ...stand, act: t < R ? "reload" : null }),
      frames: [...every(R, R * 0.04), R * 1.08, R * 1.2],
      label: (t) => pct(t, R),
      aimed: (t) => t >= R * 1.1,
    },
    {
      name: "swap",
      settle: stand,
      // the old gun for its holster time, the new one for its deploy (loadout.ts swapTotal), then back to the first
      at: (t) => ({ ...stand, act: t < S ? "swap" : null, weapon: t < T.holster ? gun : t < S ? other : gun }),
      frames: every(S, S * 0.04),
      label: (t) => `${pct(t, S)} ${t < T.holster ? gun : other}`,
      aimed: () => false,
    },
    {
      name: "jump",
      settle: { speed: 7, stance: "stand", pitch: 0 },
      at: (t) => (t < 0.2 ? { speed: 7, stance: "stand", pitch: 0 } : t < 0.9 ? { speed: 7, stance: "air", pitch: 0 } : { speed: t < 1.1 ? 1 : 0, stance: "stand", pitch: 0 }),
      frames: every(1.4, 0.07),
      label: (t) => `${t.toFixed(2)} s ${t < 0.2 ? "run" : t < 0.9 ? "air" : "land"}`,
      aimed: () => true,
    },
    { name: "run", settle: { speed: 7, stance: "stand", pitch: 0 }, at: () => ({ speed: 7, stance: "stand", pitch: 0 }), frames: every(0.8, 0.1), label: (t) => `${t.toFixed(2)} s`, aimed: () => true },
    { name: "sprint", settle: { speed: 14, stance: "stand", pitch: 0 }, at: () => ({ speed: 14, stance: "stand", pitch: 0 }), frames: every(1, 1 / 12), label: (t) => `${t.toFixed(2)} s`, aimed: () => false },
    {
      name: "crouch",
      settle: { speed: 0, stance: "crouch", pitch: 0 },
      at: (t) => ({ speed: t < 0.4 ? 0 : 3, stance: "crouch", pitch: 0 }),
      frames: every(1.2, 0.1),
      label: (t) => `${t.toFixed(2)} s ${t < 0.4 ? "still" : "walk"}`,
      aimed: () => true,
    },
    {
      name: "slide",
      settle: { speed: 12, stance: "stand", pitch: 0 },
      at: (t) => (t < 0.9 ? { speed: 12, stance: "slide", pitch: 0 } : { speed: 7, stance: "stand", pitch: 0 }),
      frames: every(1.3, 0.1),
      label: (t) => `${t.toFixed(2)} s ${t < 0.9 ? "slide" : "out"}`,
      aimed: () => false,
    },
  ];
}

/** the sides a figure is seen from: its turn from facing the camera, degrees (+ turns its right side toward the camera) */
const VIEWS: Record<string, number> = { front: 30, right: 90, left: -90, back: 165 };
/**
 * How far off, and where the camera looks: the whole figure, or its upper body close. Photographed at a 40 degree field
 * of view rather than the game's 92, so a tile is the figure and not the room round it: the same figure at a longer
 * lens, as a sheet wants it, and the lab figure is put further off to fit.
 */
const FOV = 40;
const DISTS: Record<string, { dist: number; pitch: number }> = { far: { dist: 6, pitch: -9 }, close: { dist: 2.6, pitch: -9 } };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;

type Audit = { armed: boolean; gripReach: number; supportReach: number; grip?: number; support?: number; aim?: number; wristL: number; wristR: number; handIn?: { l: number; r: number }; handWhere?: Record<string, number>; gunIn?: number; gunWhere?: Record<string, number> };

/** `keys`: where a reload has each hand (rifle.ts), "l:mag r:grip": a hand at a reload's key is not held to its hold */
function faults(a: Audit | null, aimed: boolean, keys: string | null): string[] {
  if (!a) return ["no figure"];
  const bad: string[] = [];
  const away = (side: string) => !!keys && new RegExp(`${side}:(?!hold|grip)`).test(keys);
  if (a.armed && a.gripReach > 0.9 && !away("r") && (a.grip ?? 0) > BAR.grip) bad.push(`grip ${a.grip}cm`);
  if (a.armed && a.supportReach > 0.9 && !away("l") && (a.support ?? 0) > BAR.support) bad.push(`support ${a.support}cm`);
  if (a.armed && aimed && (a.aim ?? 0) > BAR.aim) bad.push(`aim ${a.aim}deg off`);
  if (a.wristL > BAR.wrist) bad.push(`wristL ${Math.round(a.wristL)}`);
  if (a.wristR > BAR.wrist) bad.push(`wristR ${Math.round(a.wristR)}`);
  if (a.handIn && Math.max(a.handIn.l, a.handIn.r) > BAR.handIn) bad.push(`hand in gun L${a.handIn.l} R${a.handIn.r}mm`);
  if ((a.gunIn ?? 0) > BAR.gunIn) bad.push(`gun in body ${a.gunIn}mm`);
  return bad;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function tile(file: string, line1: string, line2: string, bad: boolean): Promise<Buffer> {
  const svg = `<svg width="${TILE.w}" height="${TILE.h}"><rect x="0" y="0" width="${TILE.w}" height="34" fill="rgba(0,0,0,0.7)"/><text x="5" y="14" font-family="Arial" font-size="11" fill="#fff">${esc(line1)}</text><text x="5" y="29" font-family="Arial" font-size="11" fill="${bad ? "#ff5050" : "#60ff60"}">${esc(line2)}</text></svg>`;
  return sharp(file).resize(TILE.w, TILE.h, { fit: "contain", background: "#000" }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
async function sheet(tiles: Buffer[], file: string): Promise<void> {
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: TILE.w * COLS, height: TILE.h * rows, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * TILE.w, top: Math.floor(i / COLS) * TILE.h })))
    .png()
    .toFile(file);
  console.log(file);
}

/** the screen box round the figure standing: its bones and its gun projected, padded, as a crop the whole sequence keeps */
async function cropOf(page: Page, close: boolean): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await ev<{ x0: number; y0: number; x1: number; y1: number }>(
    page,
    `(() => {
      const r = window.__range, T = r.THREE, f = r.labFigures()[0], mq = f.figure, cam = r.camera;
      const names = ${close ? `["Head", "hand_l", "hand_r", "upperarm_l", "upperarm_r", "spine_01"]` : `["Head", "ball_l", "ball_r", "hand_l", "hand_r", "upperarm_l", "upperarm_r"]`};
      const pts = names.map((n) => mq.boneAt(n)).filter(Boolean).map((b) => b.getWorldPosition(new T.Vector3()));
      const g = mq.gunObject; if (g) { const box = new T.Box3().setFromObject(g); pts.push(box.min, box.max); }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { const v = p.clone().project(cam); const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0, y0, x1, y1 };
    })()`,
  );
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  // a fixed shape (the tile's), big enough for the widest a sequence gets: arms out in a sprint, a leg up in a jump
  let h = (b.y1 - b.y0) * (close ? 1.7 : 1.35);
  let w = (h * TILE.w) / TILE.h;
  if (w < (b.x1 - b.x0) * 1.5) {
    w = (b.x1 - b.x0) * 1.5;
    h = (w * TILE.h) / TILE.w;
  }
  const x = Math.max(0, Math.min(W - w, cx - w / 2));
  const y = Math.max(0, Math.min(H - h, cy - h / 2));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(Math.min(w, W)), height: Math.round(Math.min(h, H)) };
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const only = (k: string) => (process.env[k] ?? "").split(",").filter(Boolean);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"] });
  const report: string[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(NO_REAL_MOUSE);
    await page.evaluateOnNewDocument(() => localStorage.setItem("range.welcomed", "1"));
    page.on("pageerror", (e) => console.log("pageerror:", String(e)));
    await page.goto(`${URL}${URL.includes("?") ? "&" : "?"}game=speedkills&nointro`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction("Boolean(window.__range) && window.__range.loaded()", { timeout: 90000 });
    await page.waitForFunction("window.__range.soldierReady()", { polling: 250, timeout: 60000 });
    await page.waitForFunction("window.__range.paidGuns().ready", { polling: 250, timeout: 60000 }).catch(() => console.log("the bought guns did not load: the procedural ones are shown"));
    await page.addScriptTag({ path: path.resolve("tools/figure-audit.js") });

    // ---- the Loadouts tab's soldier, holding each gun, from four sides
    for (const id of IDS) {
      if (only("SEQ").length && !only("SEQ").includes("loadout")) break;
      await ev(page, `(() => { const r = window.__range; r.loadouts.copyTo({ kind: "default", index: 0 }, 0); r.loadouts.edit(0, { slot1: "${id}" }); document.getElementById("overlay").classList.remove("hidden"); document.querySelector('[data-tab="loadouts"]').click(); })()`);
      await page.waitForFunction(`(window.__range.previewState().key || "").includes("|${id}|")`, { polling: 100, timeout: 15000 }).catch(() => console.log(`the Loadouts preview did not take ${id}`));
      const tiles: Buffer[] = [];
      for (const turn of [0, 0.6, Math.PI / 2, Math.PI]) {
        await ev(page, `window.__range.previewTurn(${turn})`);
        await wait(900);
        // the panel's box on the page (previewState's is in the canvas's own pixels)
        const rect = await ev<{ x: number; y: number; w: number; h: number } | null>(page, `(() => { const b = document.getElementById("loPreview"); if (!b || b.offsetParent === null) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
        if (!rect) continue;
        await wait(200);
        const file = path.join(OUT, `loadout-${id}-${Math.round((turn * 180) / Math.PI)}.png`);
        await page.screenshot({ path: file as `${string}.png`, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
        tiles.push(await tile(file, `Loadouts tab: ${id}, turned ${Math.round((turn * 180) / Math.PI)} deg`, "look", false));
      }
      if (tiles.length) await sheet(tiles, path.join(OUT, `loadout-${id}-sheet.png`));
    }
    await ev(page, `document.getElementById("overlay").classList.add("hidden"); document.getElementById("hud")?.style.setProperty("visibility", "hidden"); window.__range.hideViewModel(true); window.__range.shotFov(${FOV});`);

    for (const id of IDS) {
      const other = id === IDS[0] ? (IDS[1] ?? IDS[0]) : IDS[0];
      const T = await ev<Times>(page, `window.__range.weaponTimes("${id}")`);
      const To = await ev<Times>(page, `window.__range.weaponTimes("${other}")`);
      for (const seq of sequences(id, other, T, To)) {
        if (only("SEQ").length && !only("SEQ").includes(seq.name)) continue;
        for (const [view, turn] of Object.entries(VIEWS)) {
          if (only("VIEWS").length && !only("VIEWS").includes(view)) continue;
          for (const [dname, D] of Object.entries(DISTS)) {
            if (only("DIST").length && !only("DIST").includes(dname)) continue;
            // the figure, settled into the sequence's first pose, stepped by this tool from here on
            await ev(page, `(() => { const r = window.__range; r.player.teleport(0, 0, 0, 0, ${D.pitch}); r.figureLabManual(false); r.figureLab([${JSON.stringify({ ...seq.settle, weapon: id, look: LOOK })}], ${D.dist}, ${turn}); r.figureLabManual(true); r.figureLabStep(0.9); })()`);
            await wait(250);
            const crop = await cropOf(page, dname === "close");
            const tiles: Buffer[] = [];
            const frames: Array<{ t: number; audit: Audit | null; bad: string[] }> = [];
            let now = 0;
            for (const t of seq.frames) {
              // the pose each moment on the way there, so an act starts at 0 and a gun changes when it should
              while (now < t - 1e-9) {
                const kick = seq.kicks?.find((k) => k >= now - 1e-9 && k < now + 1 / 30 - 1e-9);
                if (kick !== undefined) await ev(page, "window.__range.labFigures()[0].kick()");
                const next = Math.min(t, now + 1 / 30);
                await ev(page, `(() => { const r = window.__range; r.figureLabPose(0, ${JSON.stringify(seq.at(now))}); r.figureLabStep(${next - now}); })()`);
                now = next;
              }
              await ev(page, `window.__range.figureLabPose(0, ${JSON.stringify(seq.at(t))})`);
              await wait(120);
              const file = path.join(OUT, id, `${seq.name}-${view}-${dname}-${String(Math.round(t * 1000)).padStart(5, "0")}.png`);
              fs.mkdirSync(path.dirname(file), { recursive: true });
              await page.screenshot({ path: file as `${string}.png`, clip: crop });
              const audit = await ev<Audit | null>(page, `window.__figureAudit(0, { pitch: ${seq.at(t).pitch ?? 0}, pts: ${XRAY} })`);
              // XRAY=1: the same frame again with the soldier see-through and every point found inside marked (red: the gun
              // in the body; yellow: a hand in the gun), to see where a measure comes from
              const pts = (audit as { pts?: number[][] } | null)?.pts;
              if (XRAY && pts?.length) {
                await ev(page, `(() => {
                  const r = window.__range, T = r.THREE, f = r.labFigures()[0], mq = f.figure;
                  const mats = new Map();
                  mq.root.traverse((o) => { if (o.isSkinnedMesh) for (const m of [].concat(o.material)) if (!mats.has(m)) { mats.set(m, [m.transparent, m.opacity, m.depthWrite]); m.transparent = true; m.opacity = 0.18; m.depthWrite = false; } });
                  const pts = ${JSON.stringify(pts)};
                  const g = new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(pts.flatMap((q) => q.slice(0, 3)), 3));
                  g.setAttribute("color", new T.Float32BufferAttribute(pts.flatMap((q) => (q[3] ? [1, 0, 0] : [1, 0.85, 0])), 3));
                  const dots = new T.Points(g, new T.PointsMaterial({ vertexColors: true, size: 5, sizeAttenuation: false, depthTest: false }));
                  dots.renderOrder = 999;
                  r.scene.add(dots);
                  window.__xrayUndo = () => { r.scene.remove(dots); for (const [m, [t, o, d]] of mats) { m.transparent = t; m.opacity = o; m.depthWrite = d; } };
                })()`);
                await wait(150);
                await page.screenshot({ path: file.replace(/\.png$/, "-xray.png") as `${string}.png`, clip: crop });
                await ev(page, "window.__xrayUndo()");
              }
              if (audit) delete (audit as { pts?: unknown }).pts;
              const keys = await ev<string | null>(page, "window.__range.labFigures()[0].figure?.rifleOut?.keys ?? null");
              const bad = faults(audit, seq.aimed(t), keys);
              frames.push({ t, audit, bad });
              const a = audit;
              const line1 = `${id} ${seq.name} ${seq.label(t)} ${view} ${dname}${keys ? `  ${keys}` : ""}`;
              const line2 = bad.length ? bad.join(", ") : a ? `ok  grip ${a.grip ?? "-"} sup ${a.support ?? "-"} aim ${a.aim ?? "-"} wr ${Math.round(a.wristL)}/${Math.round(a.wristR)}` : "ok";
              tiles.push(await tile(file, line1, line2, bad.length > 0));
              if (bad.length) report.push(`${id} ${seq.name} ${seq.label(t)} ${view} ${dname}: ${bad.join(", ")}${a?.handWhere && Object.keys(a.handWhere).length ? ` hand ${JSON.stringify(a.handWhere)}` : ""}${a?.gunWhere && Object.keys(a.gunWhere).length ? ` gun ${JSON.stringify(a.gunWhere)}` : ""}`);
            }
            await sheet(tiles, path.join(OUT, `${id}-${seq.name}-${view}-${dname}-sheet.png`));
            fs.writeFileSync(path.join(OUT, id, `${seq.name}-${view}-${dname}.json`), JSON.stringify(frames, null, 1));
          }
        }
      }
    }
    await ev(page, "window.__range.figureLabManual(false)");
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, "faults.txt"), report.join("\n"));
  console.log(report.length ? `\n${report.length} frames with a fault (faults.txt):\n${report.slice(0, 60).join("\n")}` : "\nno frame with a fault");
}

void main();
