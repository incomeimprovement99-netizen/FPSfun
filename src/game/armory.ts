// The armory: SpeedKills' range's back wall, behind the spawn where the Run's gates are (the owner, 2026-09-30: "the back
// end of the firing range to show the 10 guns with some futuristic way of displaying them ... in that similar style to
// Hyper Scape ... make each hack and gun have a tv behind it showing details on the gun, what it is, how to fuse"). It
// took the place of the legacy game's racks by ammo type.
//
// Hyper Scape's training room had every gun and every hack out to try, and its loot stood as a hologram turning over the
// floor, its hacks on amber cards. So each stand here is the pack's own case, open, with the gun (or the hack's core)
// turning in a column of light over it, a hologram card over that in the hack card's own style (hackcast.ts), and a
// screen on the wall behind: what it is, how it plays at your level and the next, what each fusion level does, and how to
// fuse it. E takes it; taking it again fuses it a level up, as a second copy on a match's floor does (main.ts applyLoot,
// lootcard.ts says which). The guns stand left of the middle gate, the hacks right of it.
//
// The numbers are in src/config/armory.json.
import * as THREE from "three";
import cfg from "../config/armory.json";
import { PROFILE } from "./game";
import { COURSE_GATES, type Solid } from "./range";
import { floorGun, floorGunMat } from "./loot";
import { paidGunMaterial, paidGunsReady, paidProp, paidPropBatch, paidPropReady, setPropOpen } from "./paidgun";
import { hackCard } from "./hackcast";
import { cooldownOf, hackDef, hackSlotOf, HACK, type HackId } from "./hacks";
import { weaponKind, weaponName } from "./weapons";
import { gunStats, one, useOf } from "./lootcard";

export type ArmoryKind = "gun" | "hack";

/** what the player carries, as the stands show it */
export interface ArmoryView {
  /** the fusion level of each gun in the player's hands; a gun not carried is absent */
  guns: Record<string, number>;
  /** each hack slot's hack and its level */
  hacks: { mobility: { id: string; level: number } | null; utility: { id: string; level: number } | null };
  /** the keys as the player has them bound: take, and each hack slot's */
  keys: { take: string; mobility: string; utility: string };
}

export interface ArmoryStation {
  kind: ArmoryKind;
  id: string;
  x: number;
  z: number;
  root: THREE.Group;
  /** what turns: the gun, or the hack's core */
  spin: THREE.Group;
  item: THREE.Mesh | null;
  /** the bought gun's skin is on it (not the procedural stand-in) */
  dressed: boolean;
  stand: THREE.Object3D | null;
  card: THREE.Mesh;
  screen: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  /** the view its screen, its card and its skin were last drawn for */
  drawn: string;
  /** its own place in the turn, so the stands do not turn in step */
  phase: number;
}

const GUN_TOP = PROFILE.fusion.levels;
const HACK_TOP = HACK.fuseLevels;
const FUSE = PROFILE.fusion.gun;
const colourOf = (s: { kind: ArmoryKind; id: string }): string =>
  s.kind === "gun" ? cfg.colors.gun : hackSlotOf(s.id) === "mobility" ? cfg.colors.mobility : cfg.colors.utility;

/** where the stands go: the back wall's runs either side of the middle gate, the guns left of it, the hacks right */
export function armoryPlaces(): Array<{ kind: ArmoryKind; id: string; x: number }> {
  const cuts = [-34, ...COURSE_GATES.flatMap((g) => [g.minX, g.maxX]), 34];
  const runs: Array<[number, number]> = [];
  for (let i = 0; i < cuts.length; i += 2) runs.push([cuts[i], cuts[i + 1]]);
  const side = (ids: string[], kind: ArmoryKind, left: boolean) => {
    // the runs of this side, the one nearest the middle filled first: the stands close to the spawn
    const mine = runs.filter(([a, b]) => (left ? b <= 0 : a >= 0)).sort((p, q) => Math.abs((p[0] + p[1]) / 2) - Math.abs((q[0] + q[1]) / 2));
    const xs: number[] = [];
    let left_ = ids.length;
    for (const [a, b] of mine) {
      const k = Math.min(left_, Math.floor((b - a) / cfg.spacing));
      for (let i = 0; i < k; i++) xs.push((a + b) / 2 + (i - (k - 1) / 2) * cfg.spacing);
      left_ -= k;
    }
    xs.sort((p, q) => p - q);
    return ids.slice(0, xs.length).map((id, i) => ({ kind, id, x: xs[i] }));
  };
  return [...side(cfg.guns, "gun", true), ...side(cfg.hacks, "hack", false)];
}

/**
 * the stands' cases as the player collides with them, built with the range (range.ts buildRange) whether or not the
 * stands are drawn: each the case's box as it stands, its cover open (armory.json solid, measured off the case)
 */
export function armorySolids(): Solid[] {
  const b = cfg.solid;
  return armoryPlaces().map((p) => ({ minX: p.x + b.minX, maxX: p.x + b.maxX, minZ: cfg.z + b.minZ, maxZ: cfg.z + b.maxZ, base: 0, top: b.top }));
}

/** the hack card's cut-cornered frame (hackcast.ts), for a gun's card: so a gun's and a hack's read as one set */
function frame(c: CanvasRenderingContext2D, W: number, H: number, inset: number, cut: number): void {
  c.beginPath();
  c.moveTo(inset + cut, inset);
  c.lineTo(W - inset - cut, inset);
  c.lineTo(W - inset, inset + cut);
  c.lineTo(W - inset, H - inset - cut);
  c.lineTo(W - inset - cut, H - inset);
  c.lineTo(inset + cut, H - inset);
  c.lineTo(inset, H - inset - cut);
  c.lineTo(inset, inset + cut);
  c.closePath();
}

/** level pips along a foot: `at` of `of` lit */
function pips(c: CanvasRenderingContext2D, cx: number, y: number, at: number, of: number, colour: string, w = 26, gap = 8): void {
  const total = of * w + (of - 1) * gap;
  for (let i = 0; i < of; i++) {
    const x = cx - total / 2 + i * (w + gap);
    c.fillStyle = i < at ? colour : "rgba(255, 255, 255, 0.16)";
    c.fillRect(x, y, w, 9);
  }
}

const gunCards = new Map<string, THREE.CanvasTexture>();
/** a gun's hologram card: the hack card's frame in amber, its name, its class, and its fusion level as pips */
function gunCard(id: string, level: number): THREE.CanvasTexture {
  const key = `${id}|${level}`;
  const have = gunCards.get(key);
  if (have) return have;
  const W = 256;
  const H = 208;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  const amber = cfg.colors.gun;
  frame(c, W, H, 6, 26);
  c.fillStyle = "rgba(40, 22, 4, 0.55)";
  c.fill();
  c.strokeStyle = amber;
  c.lineWidth = 7;
  c.shadowColor = amber;
  c.shadowBlur = 12;
  c.stroke();
  c.setLineDash([10, 8]);
  c.lineWidth = 2.5;
  frame(c, W, H, 20, 26);
  c.stroke();
  c.setLineDash([]);
  c.shadowBlur = 0;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#fff6e6";
  c.font = '700 46px "Rajdhani", "Segoe UI", sans-serif';
  c.fillText(weaponName(id), W / 2, 78);
  c.fillStyle = amber;
  c.font = '700 22px "Rajdhani", "Segoe UI", sans-serif';
  c.fillText((weaponKind(id) ?? "").toUpperCase(), W / 2, 118);
  pips(c, W / 2, 152, level, GUN_TOP, amber, 24, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  gunCards.set(key, tex);
  return tex;
}

/** a line of words cut to fit `width`, as many lines as it takes */
function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > width && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

const FACE = (px: number, w = 600) => `${w} ${px}px "Rajdhani", "Segoe UI", sans-serif`;

/** set `c`'s font to the face at `px`, smaller until `text` fits `width` */
function fit(c: CanvasRenderingContext2D, text: string, width: number, px: number, weight: number): void {
  let size = px;
  c.font = FACE(size, weight);
  while (size > 12 && c.measureText(text).width > width) {
    size -= 2;
    c.font = FACE(size, weight);
  }
}

/** a share as a change: 1.2 is "+20%", 0.92 "-8%" */
const pct = (k: number): string => `${k >= 1 ? "+" : "-"}${Math.round(Math.abs(k - 1) * 100)}%`;

export class Armory {
  readonly root = new THREE.Group();
  readonly stations: ArmoryStation[] = [];
  /** the screens drawn since the page opened (the checks read it) */
  redraws = 0;
  private fontsIn = false;

  constructor() {
    this.root.name = "armory";
    for (const p of armoryPlaces()) this.stations.push(this.build(p.kind, p.id, p.x, cfg.z));
    // the screens are drawn in Rajdhani; drawn before the font has come, they are drawn again once it has
    void document.fonts?.ready.then(() => {
      this.fontsIn = true;
      for (const s of this.stations) s.drawn = "";
    });
  }

  private build(kind: ArmoryKind, id: string, x: number, z: number): ArmoryStation {
    const root = new THREE.Group();
    root.name = `armory:${id}`;
    root.position.set(x, 0, z);
    this.root.add(root);
    const colour = new THREE.Color(colourOf({ kind, id }));
    // the column of light the hologram stands in
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.beam.radius, cfg.beam.radius * 0.75, cfg.beam.height, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: cfg.beam.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = cfg.item.y - 0.1;
    root.add(beam);
    // a ring of light on the floor round the stand, as a gun on a match's floor has in its rarity's colour
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.86, 6), new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    root.add(ring);
    const spin = new THREE.Group();
    spin.position.y = cfg.item.y;
    root.add(spin);
    // the hologram card over it, facing the firing line
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.card.w, cfg.card.h),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    card.position.y = cfg.card.y;
    card.rotation.y = Math.PI;
    root.add(card);
    // the screen on the wall behind, in a dark bezel with a lit edge in the stand's colour
    const T = cfg.tv;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(T.w + 0.12, T.h + 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.4, metalness: 0.6, emissive: colour, emissiveIntensity: 0.08 }));
    bezel.position.set(0, T.y, T.z - z + 0.03);
    root.add(bezel);
    const canvas = document.createElement("canvas");
    canvas.width = T.px;
    canvas.height = Math.round((T.px * T.h) / T.w);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(T.w, T.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, T.y, T.z - z - 0.005);
    screen.rotation.y = Math.PI;
    screen.name = `armory-screen:${id}`;
    root.add(screen);
    const s: ArmoryStation = { kind, id, x, z, root, spin, item: null, dressed: false, stand: null, card, screen: { canvas, tex }, drawn: "", phase: x * 0.7 };
    this.dress(s, 0);
    return s;
  }

  /** there is something bought for this stand that it does not wear yet */
  private wantsDress(s: ArmoryStation): boolean {
    const key = s.kind === "gun" ? "armorygun" : "armoryhack";
    if (!s.stand && paidPropReady(key)) return true;
    return s.kind === "gun" ? paidGunsReady() && !s.dressed : !s.dressed && paidPropReady("hackcore");
  }

  /** the stand's case and its hologram, the bought ones once they are in (the procedural ones until then) */
  private dress(s: ArmoryStation, level: number): void {
    const key = s.kind === "gun" ? "armorygun" : "armoryhack";
    if (!s.stand && paidPropReady(key)) {
      const stand = paidProp(key);
      if (stand) {
        setPropOpen(stand, key, true);
        // its long side along the wall, its cover swung open toward the wall
        stand.rotation.y = Math.PI;
        s.root.add(stand);
        s.stand = stand;
      }
    }
    if (!s.stand && !s.root.getObjectByName("armory-plinth")) {
      // until the pack is in (or in a build without it): a plain plinth
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x1b222b, roughness: 0.5, metalness: 0.5 }));
      plinth.position.y = 0.25;
      plinth.name = "armory-plinth";
      s.root.add(plinth);
    }
    if (s.stand) s.root.getObjectByName("armory-plinth")?.removeFromParent();
    if (s.kind === "gun") {
      const paid = paidGunsReady();
      if (!s.item || (paid && !s.dressed)) {
        if (s.item) s.spin.remove(s.item);
        const geo = floorGun(s.id);
        const skin = geo.userData.paid ? paidGunMaterial(s.id, level) : null;
        const m = new THREE.Mesh(geo, skin ?? floorGunMat);
        // standing side on, as it is held, its middle over the stand
        m.rotation.set(0, Math.PI / 2, 0);
        m.scale.setScalar(cfg.item.gunScale);
        geo.computeBoundingBox();
        const c = geo.boundingBox!.getCenter(new THREE.Vector3()).multiplyScalar(cfg.item.gunScale);
        m.position.set(-c.z, -c.y, c.x);
        s.spin.add(m);
        s.item = m;
        s.dressed = !!skin;
      } else if (s.dressed) {
        const skin = paidGunMaterial(s.id, level);
        if (skin) s.item.material = skin;
      }
    } else if (!s.item || (!s.dressed && paidPropReady("hackcore"))) {
      if (s.item) s.spin.remove(s.item);
      const core = paidPropBatch("hackcore", new THREE.Color(colourOf(s)).getHex());
      const m = core
        ? new THREE.Mesh(core.geo, core.mat)
        : new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshStandardMaterial({ color: colourOf(s), emissive: colourOf(s), emissiveIntensity: 0.8 }));
      m.scale.setScalar(core ? cfg.item.coreScale : 1);
      if (core) {
        m.geometry.computeBoundingBox();
        m.position.y = -m.geometry.boundingBox!.getCenter(new THREE.Vector3()).y * cfg.item.coreScale;
      }
      s.spin.add(m);
      s.item = m;
      s.dressed = !!core;
    }
  }

  /** what a stand's screen and card say depends on: its level in your hands (or slot), and the keys */
  private viewKey(s: ArmoryStation, v: ArmoryView): string {
    if (s.kind === "gun") return `${v.guns[s.id] ?? -1}|${v.keys.take}|${this.fontsIn}`;
    const slot = hackSlotOf(s.id) ?? "mobility";
    const h = v.hacks[slot];
    return `${h ? `${h.id}:${h.level}` : "-"}|${v.keys.take}|${v.keys[slot]}|${this.fontsIn}`;
  }

  /** a stand's case as it stands, its cover open, about the stand's middle: [minX, maxX, top, minZ, maxZ] (the checks hold armory.json's solid to it) */
  caseBox(s: ArmoryStation): number[] | null {
    if (!s.stand) return null;
    s.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s.stand, true);
    const r = s.root.getWorldPosition(new THREE.Vector3());
    return [box.min.x - r.x, box.max.x - r.x, box.max.y - r.y, box.min.z - r.z, box.max.z - r.z];
  }

  /** the level a stand shows: the one you carry it at, else 0 */
  levelOf(s: ArmoryStation, v: ArmoryView): number {
    if (s.kind === "gun") return Math.max(0, v.guns[s.id] ?? 0);
    const h = v.hacks[hackSlotOf(s.id) ?? "mobility"];
    return h && h.id === s.id ? h.level : 0;
  }

  /** a frame: the holograms turn, and a stand whose state changed has its screen, card and skin drawn again */
  update(now: number, v: ArmoryView): void {
    // one stand dressed a frame as the pack comes in: all twenty at once was a 2.1 s frame (each gun's floor copy merged)
    let dressings = 1;
    for (const s of this.stations) {
      s.spin.rotation.y = now * cfg.item.spin + s.phase;
      s.spin.position.y = cfg.item.y + Math.sin(now * 1.6 + s.phase) * cfg.item.bob;
      const level = this.levelOf(s, v);
      // the bought stand or hologram, once the pack is in
      if ((!s.stand || !s.dressed) && dressings > 0 && this.wantsDress(s)) {
        dressings--;
        this.dress(s, level);
      }
      const key = this.viewKey(s, v);
      if (key === s.drawn) continue;
      s.drawn = key;
      this.dress(s, level);
      const mat = s.card.material as THREE.MeshBasicMaterial;
      mat.map = s.kind === "gun" ? gunCard(s.id, level) : hackCard(s.id, cfg.colors.gun, { at: level, of: HACK_TOP, color: colourOf(s) });
      mat.needsUpdate = true;
      this.drawScreen(s, v);
    }
  }

  /** the stand in reach and in front of you (looking along `yaw`), the nearest; null if none */
  near(pos: THREE.Vector3, yaw: number): ArmoryStation | null {
    const fx = -Math.sin((yaw * Math.PI) / 180);
    const fz = -Math.cos((yaw * Math.PI) / 180);
    let best: ArmoryStation | null = null;
    let bd = cfg.reach;
    for (const s of this.stations) {
      const dx = s.x - pos.x;
      const dz = s.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bd) continue;
      // close enough to touch it counts whatever the look; else it has to be in front
      if (d > 0.6 && (dx * fx + dz * fz) / d < cfg.facing) continue;
      bd = d;
      best = s;
    }
    return best;
  }

  /** the screen on the wall: what it is, how it plays, what fusing does, and how */
  private drawScreen(s: ArmoryStation, v: ArmoryView): void {
    const cv = s.screen.canvas;
    const c = cv.getContext("2d")!;
    const W = cv.width;
    const H = cv.height;
    const colour = colourOf(s);
    // the glass: a dark blue fading down, a scan line every few pixels, and a lit edge in the stand's colour
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#07101f");
    bg.addColorStop(1, "#03060c");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255, 255, 255, 0.025)";
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
    c.strokeStyle = colour;
    c.lineWidth = 6;
    c.strokeRect(3, 3, W - 6, H - 6);
    c.textBaseline = "alphabetic";
    c.textAlign = "left";
    const pad = 34;
    if (s.kind === "gun") this.drawGun(c, s, v, W, H, pad, colour);
    else this.drawHack(c, s, v, W, H, pad, colour);
    s.screen.tex.needsUpdate = true;
    this.redraws++;
  }

  /** the head every screen has: its name, what it is under it, and on the right whether you have it and at what level */
  private head(c: CanvasRenderingContext2D, W: number, pad: number, colour: string, name: string, sub: string, status: string, level: number, of: number, have: boolean): void {
    const T = cfg.screen;
    c.textAlign = "right";
    c.fillStyle = have ? colour : "#6f819a";
    fit(c, status, 330, T.status, 700);
    c.fillText(status, W - pad, 64);
    if (have) pips(c, W - pad - (of * 40 - 8) / 2, 84, level, of, colour, 32, 8);
    c.textAlign = "left";
    c.fillStyle = "#ffffff";
    fit(c, name, W - pad * 2 - 350, T.name, 700);
    c.fillText(name, pad, 98);
    c.fillStyle = colour;
    fit(c, sub, W - pad * 2, T.sub, 700);
    c.fillText(sub, pad, 148);
  }

  /** the lit band along the foot: what E does here now, and the rest of how fusing goes */
  private band(c: CanvasRenderingContext2D, W: number, H: number, pad: number, colour: string, now: string, more: string): void {
    const T = cfg.screen;
    const top = H - T.band;
    c.fillStyle = `${colour}2a`;
    c.fillRect(6, top, W - 12, T.band - 6);
    c.fillStyle = colour;
    c.fillRect(6, top, W - 12, 4);
    c.textAlign = "center";
    c.fillStyle = "#ffffff";
    fit(c, now, W - pad * 2, T.now, 700);
    c.fillText(now, W / 2, top + 50);
    c.fillStyle = "#c9d4e2";
    fit(c, more, W - pad * 2, T.more, 600);
    c.fillText(more, W / 2, top + 90);
    c.textAlign = "left";
  }

  private drawGun(c: CanvasRenderingContext2D, s: ArmoryStation, v: ArmoryView, W: number, H: number, pad: number, colour: string): void {
    const T = cfg.screen;
    const carried = v.guns[s.id];
    const have = carried !== undefined;
    const level = Math.max(0, carried ?? 0);
    const status = have ? `IN YOUR HANDS  ·  LEVEL ${level} OF ${GUN_TOP}` : "NOT IN YOUR HANDS";
    this.head(c, W, pad, colour, weaponName(s.id), `${(weaponKind(s.id) ?? "").toUpperCase()}  ·  ${useOf(s.id).toUpperCase()}`, status, level, GUN_TOP, have);
    // its numbers at your level and at the next (or at the top): what one more fusion buys, in green
    const next = Math.min(GUN_TOP, level + 1);
    const a = gunStats(s.id, level);
    const b = gunStats(s.id, next);
    const rows: Array<[string, string, string]> = [
      ["DAMAGE", a.dmg, b.dmg],
      ["HEADSHOT", one(a.head), one(b.head)],
      ["FIRE RATE", `${one(a.rate)}/S`, `${one(b.rate)}/S`],
      ["MAGAZINE", a.heat ? "COOLS" : `${a.mag}`, b.heat ? "COOLS" : `${b.mag}`],
      ["RELOAD", a.heat ? "-" : `${a.reload.toFixed(2)} S`, b.heat ? "-" : `${b.reload.toFixed(2)} S`],
      ["TIME TO KILL", `${a.ttk.toFixed(2)} S`, `${b.ttk.toFixed(2)} S`],
    ];
    const col1 = pad + 300;
    const col2 = pad + 560;
    const top = 202;
    c.font = FACE(T.label, 700);
    c.fillStyle = "#6f819a";
    c.fillText(`LEVEL ${level}`, col1, top);
    c.fillStyle = next > level ? "#7dffb0" : "#6f819a";
    c.fillText(next > level ? `LEVEL ${next}, FUSED` : "THE TOP", col2, top);
    rows.forEach(([label, now, then], i) => {
      const y = top + T.rowH + i * T.rowH;
      c.fillStyle = "#a9b8cc";
      c.font = FACE(T.label + 4, 600);
      c.fillText(label, pad, y);
      c.fillStyle = "#ffffff";
      c.font = FACE(T.row, 700);
      c.fillText(now, col1, y);
      c.fillStyle = next > level && now !== then ? "#7dffb0" : "#ffffff";
      c.fillText(then, col2, y);
    });
    // what the top level adds over level 0
    const f = FUSE[GUN_TOP];
    const all = `LEVEL ${GUN_TOP}:  MAG ${pct(f.mag)}   DAMAGE ${pct(f.damage)}   RELOAD ${pct(f.reload)}   KICK ${pct(f.recoil)}`;
    c.fillStyle = colour;
    fit(c, all, W - pad * 2, T.label, 700);
    c.fillText(all, pad, top + T.rowH * (rows.length + 1) + 6);
    const key = `[${v.keys.take}]`;
    const now = !have ? `${key}  TAKE IT  ·  AGAIN TO FUSE IT A LEVEL UP` : level < GUN_TOP ? `${key}  FUSE IT TO LEVEL ${level + 1} OF ${GUN_TOP}` : `AT ITS TOP LEVEL, ${GUN_TOP} OF ${GUN_TOP}`;
    this.band(c, W, H, pad, colour, now, "IN A MATCH, A SECOND COPY OFF THE FLOOR FUSES IT THE SAME");
  }

  private drawHack(c: CanvasRenderingContext2D, s: ArmoryStation, v: ArmoryView, W: number, H: number, pad: number, colour: string): void {
    const T = cfg.screen;
    const def = hackDef(s.id);
    const slot = hackSlotOf(s.id) ?? "mobility";
    const SLOT = slot.toUpperCase();
    const held = v.hacks[slot];
    const mine = !!held && held.id === s.id;
    const level = mine ? held.level : 0;
    const status = mine ? `IN YOUR ${SLOT} SLOT  ·  LEVEL ${level} OF ${HACK_TOP}` : held ? `YOUR ${SLOT} SLOT HOLDS ${hackDef(held.id)?.name ?? held.id}` : `YOUR ${SLOT} SLOT IS EMPTY`;
    this.head(c, W, pad, colour, def?.name ?? s.id.toUpperCase(), `${SLOT} HACK  ·  [${v.keys[slot]}]`, status, level, HACK_TOP, mine);
    // what it does
    c.fillStyle = "#dfe8f4";
    c.font = FACE(T.row, 600);
    wrap(c, (def?.blurb ?? "").toUpperCase(), W - pad * 2)
      .slice(0, 2)
      .forEach((l, i) => c.fillText(l, pad, 214 + i * T.rowH));
    // its cooldown at each level, yours lit
    const top = 318;
    c.fillStyle = colour;
    c.font = FACE(T.label, 700);
    c.fillText("COOLDOWN AT EACH LEVEL", pad, top);
    const n = HACK_TOP + 1;
    const boxW = (W - pad * 2 - 10 * (n - 1)) / n;
    for (let l = 0; l < n; l++) {
      const x = pad + l * (boxW + 10);
      const y = top + 14;
      const lit = mine && l === level;
      c.fillStyle = lit ? `${colour}55` : "rgba(255, 255, 255, 0.06)";
      c.fillRect(x, y, boxW, 112);
      c.fillStyle = lit ? colour : "#a9b8cc";
      c.font = FACE(T.label + 2, 700);
      c.fillText(`LEVEL ${l}`, x + 12, y + 36);
      c.fillStyle = "#ffffff";
      c.font = FACE(T.big, 700);
      c.fillText(`${one(cooldownOf(s.id as HackId, l))} S`, x + 12, y + 92);
    }
    const key = `[${v.keys.take}]`;
    const now = !mine ? `${key}  TAKE IT INTO YOUR ${SLOT} SLOT` : level < HACK_TOP ? `${key}  FUSE IT TO LEVEL ${level + 1} OF ${HACK_TOP}` : `AT ITS TOP LEVEL, ${HACK_TOP} OF ${HACK_TOP}`;
    this.band(c, W, H, pad, colour, now, `AGAIN TO FUSE IT  ·  ANOTHER ${SLOT} HACK SWAPS IT  ·  IN A MATCH, ITS CORE OFF THE FLOOR`);
  }
}
