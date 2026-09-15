// The README screen at the far end of the firing range, under a "B00G'S RANGE"
// sign: the project's own README.md, drawn on a canvas as sections and pages.
//
// You turn its pages by shooting: four arrow plates beside the screen (page
// back and forward, section back and forward), and the list of sections down
// its left side is shootable too, so a round on a name jumps straight to it.
// Any gun, pellet, arrow or melee does it (projectile.ts's shootables); a
// round anywhere else on the screen is an ordinary miss, so stray fire down
// range never moves the page.
//
// The text is README.md itself (readme.ts parses it), bundled at build time,
// so the screen cannot drift from the file. The public build swaps the real
// names for codenames first (vite.config.ts, tools/public-text.ts).
import * as THREE from "three";
import readmeMd from "../../README.md?raw";
import cfg from "../config/readme-tv.json";
import { parseReadme, type Block, type Section } from "./readme";
import type { Shootable } from "./projectile";

const SCREEN = cfg.screen;
const SIGN = cfg.sign;
const BTN = cfg.buttons;
const L = cfg.layout;

export type TvAction = "prevPage" | "nextPage" | "prevSection" | "nextSection";

const FACE = '500 %spx "Rajdhani", "Segoe UI", sans-serif';
const BOLD = '700 %spx "Rajdhani", "Segoe UI", sans-serif';
const MONO = '%spx "Share Tech Mono", "Consolas", monospace';

interface Run {
  text: string;
  bold: boolean;
  code: boolean;
}
/** one drawn line: its runs, how far in it starts, and how to colour it */
interface Line {
  runs: Run[];
  indent: number;
  style: "body" | "head" | "caption" | "code";
  /** a blank line between blocks */
  gap?: boolean;
}

/** an arrow plate: the flat shape, pointing right before it is rotated */
function arrowShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const tail = -w / 2;
  const tip = w / 2;
  const neck = w * 0.06;
  const stem = h * 0.22;
  const head = h / 2;
  s.moveTo(tail, stem);
  s.lineTo(neck, stem);
  s.lineTo(neck, head);
  s.lineTo(tip, 0);
  s.lineTo(neck, -head);
  s.lineTo(neck, -stem);
  s.lineTo(tail, -stem);
  s.closePath();
  return s;
}

class Button {
  readonly plate: THREE.Mesh;
  readonly arrow: THREE.Mesh;
  flashUntil = 0;
  constructor(
    readonly action: TvAction,
    readonly label: string,
    x: number,
    y: number,
    dir: "left" | "right" | "up" | "down",
    root: THREE.Group
  ) {
    const w = BTN.width;
    const h = BTN.height;
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * SCREEN.px);
    cv.height = Math.round(h * SCREEN.px);
    const g = cv.getContext("2d")!;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.paint = (hot: boolean) => {
      g.fillStyle = hot ? "#2d1c08" : "#0d1014";
      g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = hot ? "#ffd23c" : "#d4712a";
      g.lineWidth = 10;
      g.strokeRect(5, 5, cv.width - 10, cv.height - 10);
      g.fillStyle = hot ? "#ffd23c" : "#9fb2c0";
      g.font = BOLD.replace("%s", String(Math.round(cv.height * 0.17)));
      g.textAlign = "center";
      g.fillText(label, cv.width / 2, cv.height - Math.round(cv.height * 0.06));
      tex.needsUpdate = true;
    };
    this.paint(false);
    this.plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    this.plate.position.set(x, y, BTN.z);
    this.plate.userData.dynamic = true;
    this.arrow = new THREE.Mesh(
      new THREE.ShapeGeometry(arrowShape(w * 0.5, h * 0.42)),
      new THREE.MeshBasicMaterial({ color: 0xffd23c })
    );
    this.arrow.position.set(x, y + h * 0.08, BTN.z + 0.02);
    this.arrow.rotation.z = dir === "right" ? 0 : dir === "left" ? Math.PI : dir === "up" ? Math.PI / 2 : -Math.PI / 2;
    this.arrow.userData.dynamic = true;
    root.add(this.plate, this.arrow);
  }
  /** redraw, lit or not */
  readonly paint: (hot: boolean) => void;

  flash(now: number): void {
    this.flashUntil = now + BTN.flash;
    this.paint(true);
    (this.arrow.material as THREE.MeshBasicMaterial).color.set(0xffffff);
  }
  update(now: number): void {
    if (this.flashUntil && now >= this.flashUntil) {
      this.flashUntil = 0;
      this.paint(false);
      (this.arrow.material as THREE.MeshBasicMaterial).color.set(0xffd23c);
    }
  }
}

export class ReadmeTv implements Shootable {
  readonly root = new THREE.Group();
  readonly sections: Section[] = parseReadme(readmeMd);
  section = 0;
  page = 0;
  /** a press, for the sound and the hit marker: the action and where it was */
  onPress: ((action: TvAction | "jump", at: THREE.Vector3) => void) | null = null;

  private cv = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private screen: THREE.Mesh;
  private buttons: Button[] = [];
  /** the laid-out pages of each section, kept once measured */
  private pages: (Line[][] | null)[] = [];
  /** where each section's name sits in the sidebar, in canvas pixels */
  private entries: { top: number; bottom: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.cv.width = Math.round(SCREEN.width * SCREEN.px);
    this.cv.height = Math.round(SCREEN.height * SCREEN.px);
    this.g = this.cv.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.pages = this.sections.map(() => null);

    // the frame, the screen, the sign above it
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(SCREEN.width + 0.3, SCREEN.height + 0.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5, metalness: 0.4 })
    );
    frame.position.set(SCREEN.x, SCREEN.y, SCREEN.z - 0.07);
    // the fog is 22% deep at 107 m: a lit screen reads through it, and the
    // point of the size is that the text can be read from the firing line
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), new THREE.MeshBasicMaterial({ map: this.tex, fog: false }));
    this.screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
    for (const m of [frame, this.screen]) m.userData.dynamic = true;
    this.root.add(frame, this.screen, this.sign());

    this.buttons = [
      new Button("prevPage", "PAGE", -BTN.x, BTN.pageY, "left", this.root),
      new Button("nextPage", "PAGE", BTN.x, BTN.pageY, "right", this.root),
      new Button("prevSection", "SECTION", -BTN.x, BTN.sectionY, "up", this.root),
      new Button("nextSection", "SECTION", BTN.x, BTN.sectionY, "down", this.root),
    ];
    scene.add(this.root);
    this.draw();
    // the web font arrives after the first draw: the text is measured, so it
    // must be laid out again
    document.fonts?.load(`500 ${L.bodySize}px "Rajdhani"`).then(
      () => {
        this.pages = this.sections.map(() => null);
        this.draw();
      },
      () => undefined
    );
  }

  // ---------- what a bullet hits ----------

  get meshes(): THREE.Mesh[] {
    return [this.screen, ...this.buttons.map((b) => b.plate)];
  }

  /**
   * A round landed. An arrow plate turns its page; the list of sections jumps
   * to the one that was hit. Anywhere else on the screen is a plain miss
   * (false), so shooting past the targets does not move the page.
   */
  onHit(point: THREE.Vector3, _weapon: string): boolean {
    const b = this.buttons.find((x) => Math.abs(point.x - x.plate.position.x) <= BTN.width / 2 + 0.05 && Math.abs(point.y - x.plate.position.y) <= BTN.height / 2 + 0.05);
    if (b) {
      this.press(b.action);
      return true;
    }
    const px = (point.x - (SCREEN.x - SCREEN.width / 2)) * SCREEN.px;
    const py = (SCREEN.y + SCREEN.height / 2 - point.y) * SCREEN.px;
    if (px < 0 || px > this.cv.width || py < 0 || py > this.cv.height) return false;
    if (px > L.sidebar) return false;
    const i = this.entries.findIndex((e) => py >= e.top && py <= e.bottom);
    if (i < 0) return false;
    this.goto(i, 0);
    this.onPress?.("jump", point.clone());
    return true;
  }

  // ---------- paging ----------

  press(action: TvAction): void {
    const n = this.sections.length;
    // the page is set first and drawn once at the end: a redraw is a whole
    // texture upload
    if (action === "nextPage") {
      if (this.page + 1 < this.pageCount) this.page++;
      else {
        this.section = (this.section + 1) % n;
        this.page = 0;
      }
    } else if (action === "prevPage") {
      if (this.page > 0) this.page--;
      else {
        // back past the first page: the end of the section before it
        this.section = (this.section - 1 + n) % n;
        this.page = Math.max(0, this.pageCount - 1);
      }
    } else {
      this.section = (this.section + (action === "nextSection" ? 1 : n - 1)) % n;
      this.page = 0;
    }
    const btn = this.buttons.find((b) => b.action === action);
    if (btn) {
      btn.flash(this.lastNow);
      this.onPress?.(action, btn.plate.position.clone());
    }
    this.draw();
  }

  goto(section: number, page = 0): void {
    this.section = Math.max(0, Math.min(this.sections.length - 1, section));
    this.page = Math.max(0, Math.min(this.pageCount - 1, page));
    this.draw();
  }

  get pageCount(): number {
    return this.laidOut(this.section).length;
  }

  private lastNow = 0;
  update(now: number): void {
    this.lastNow = now;
    for (const b of this.buttons) b.update(now);
  }

  /** the current page as plain text (tools/e2e.ts) */
  pageText(): string {
    const page = this.laidOut(this.section)[this.page] ?? [];
    return page.map((ln) => ln.runs.map((r) => r.text).join("")).join("\n");
  }

  state(): { section: number; page: number; pages: number; title: string; sections: string[] } {
    return { section: this.section, page: this.page, pages: this.pageCount, title: this.sections[this.section]?.title ?? "", sections: this.sections.map((s) => s.title) };
  }

  /** where an arrow plate is, for a test that wants to shoot it (tools/e2e.ts) */
  buttonAt(action: TvAction): THREE.Vector3 {
    return (this.buttons.find((b) => b.action === action) ?? this.buttons[0]).plate.position.clone();
  }

  /** the middle of the page itself, where a round must change nothing (tools/e2e.ts) */
  bodyPoint(): THREE.Vector3 {
    return new THREE.Vector3(SCREEN.x + (L.sidebar / SCREEN.px) / 2, SCREEN.y, SCREEN.z);
  }

  /** where a section's name is in the list, for a test that wants to shoot it (tools/e2e.ts) */
  entryAt(section: number): THREE.Vector3 | null {
    const e = this.entries[section];
    if (!e) return null;
    return new THREE.Vector3(
      SCREEN.x - SCREEN.width / 2 + (L.pad + 120) / SCREEN.px,
      SCREEN.y + SCREEN.height / 2 - ((e.top + e.bottom) / 2) / SCREEN.px,
      SCREEN.z
    );
  }

  // ---------- the layout ----------

  private font(style: Line["style"], run: Run): string {
    const size = style === "head" ? L.bodySize + 4 : style === "caption" ? L.bodySize - 3 : L.bodySize;
    if (run.code || style === "code") return MONO.replace("%s", String(size - 3));
    return (run.bold || style === "head" ? BOLD : FACE).replace("%s", String(size));
  }

  /** the width a run of text takes, at the style it is drawn in */
  private measure(style: Line["style"], run: Run, text: string): number {
    this.g.font = this.font(style, run);
    return this.g.measureText(text).width;
  }

  /** a block wrapped to the body's width: a list item hangs its text past the marker, a table row past its first cell */
  private wrap(b: Block, width: number): Line[] {
    const style: Line["style"] = b.kind === "head" ? "head" : b.kind === "caption" ? "caption" : b.kind === "code" ? "code" : "body";
    const first = b.kind === "code" ? L.indent / 2 : 0;
    const hang = b.kind === "item" || b.kind === "row" ? L.indent : first;
    // a code line is kept as it was written
    if (style === "code") return [{ runs: b.spans.map((s) => ({ text: s.text, bold: false, code: true })), indent: first, style }];
    const lines: Line[] = [];
    let runs: Run[] = [];
    let indent = first;
    let used = 0;
    const push = () => {
      if (runs.length) lines.push({ runs, indent, style });
      runs = [];
      indent = hang;
      used = 0;
    };
    if (b.kind === "item") {
      // the bullet or the number sits in the margin
      const marker: Run = { text: `${b.marker} `, bold: false, code: false };
      runs.push(marker);
      used = this.measure(style, marker, marker.text);
    }
    for (const span of b.spans) {
      let run: Run = { text: "", bold: !!span.bold, code: !!span.code };
      for (const word of span.text.split(" ")) {
        if (!word) continue;
        const piece = used ? ` ${word}` : word;
        const w = this.measure(style, run, piece);
        if (used + w > width - indent && used) {
          if (run.text) runs.push(run);
          push();
          run = { text: word, bold: !!span.bold, code: !!span.code };
          used = this.measure(style, run, word);
        } else {
          run.text += piece;
          used += w;
        }
      }
      if (run.text) runs.push(run);
    }
    push();
    return lines;
  }

  /** every page of a section, measured once and kept */
  private laidOut(index: number): Line[][] {
    const had = this.pages[index];
    if (had) return had;
    const section = this.sections[index];
    const width = this.cv.width - L.sidebar - L.pad * 2;
    const perPage = Math.max(4, Math.floor((this.cv.height - L.header - L.footer - L.pad) / L.bodyLine));
    const lines: Line[] = [];
    section.blocks.forEach((b, i) => {
      if (i) lines.push({ runs: [], indent: 0, style: "body", gap: true });
      lines.push(...this.wrap(b, width));
    });
    const pages: Line[][] = [];
    let page: Line[] = [];
    for (const line of lines) {
      // a gap never opens a page
      if (line.gap && !page.length) continue;
      page.push(line);
      if (page.length >= perPage) {
        // a subhead (or the gap before it) left at the foot of a page goes over with its text
        const held: Line[] = [];
        while (page.length > 1 && (page[page.length - 1].style === "head" || page[page.length - 1].gap)) held.unshift(page.pop()!);
        pages.push(page);
        page = held.filter((l) => !l.gap);
      }
    }
    if (page.length) pages.push(page);
    this.pages[index] = pages.length ? pages : [[]];
    return this.pages[index]!;
  }

  // ---------- drawing ----------

  private sign(): THREE.Group {
    const group = new THREE.Group();
    const cv = document.createElement("canvas");
    cv.width = Math.round(SIGN.width * SCREEN.px);
    cv.height = Math.round(SIGN.height * SCREEN.px);
    const g = cv.getContext("2d")!;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const draw = () => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = "#0d1014";
      g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = "#d4712a";
      g.fillRect(0, 0, cv.width, 9);
      g.fillRect(0, cv.height - 9, cv.width, 9);
      g.textAlign = "center";
      g.font = BOLD.replace("%s", String(Math.round(cv.height * 0.55)));
      g.shadowColor = "#ffb347";
      g.shadowBlur = 26;
      g.fillStyle = "#ffd23c";
      g.fillText(SIGN.text, cv.width / 2, cv.height * 0.62);
      g.shadowBlur = 0;
      g.font = FACE.replace("%s", String(Math.round(cv.height * 0.15)));
      g.fillStyle = "#9fb2c0";
      g.fillText(SIGN.sub, cv.width / 2, cv.height * 0.88);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.load(`700 64px "Rajdhani"`).then(draw, () => undefined);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.width, SIGN.height), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
    board.position.set(SCREEN.x, SIGN.y, SCREEN.z);
    board.userData.dynamic = true;
    group.add(board);
    return group;
  }

  private draw(): void {
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    const pages = this.laidOut(this.section);
    if (this.page >= pages.length) this.page = pages.length - 1;
    const section = this.sections[this.section];
    g.fillStyle = "#0b0e12";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#11161c";
    g.fillRect(0, 0, L.sidebar, H);

    // header
    g.fillStyle = "#d4712a";
    g.fillRect(0, 0, W, 10);
    g.textAlign = "left";
    g.font = BOLD.replace("%s", String(L.titleSize));
    g.fillStyle = "#ffd23c";
    g.fillText(section.title.toUpperCase(), L.pad, L.header - 26);
    g.textAlign = "right";
    g.font = FACE.replace("%s", String(L.titleSize - 6));
    g.fillStyle = "#9fb2c0";
    g.fillText(`SECTION ${this.section + 1}/${this.sections.length}  ·  PAGE ${this.page + 1}/${pages.length}`, W - L.pad, L.header - 26);
    g.fillStyle = "#223040";
    g.fillRect(0, L.header - 12, W, 2);

    // the list of sections: shoot a name to jump to it
    this.entries = [];
    // the list always fits, however many sections the README grows to
    const room = H - L.header - L.footer - 26;
    const line = Math.min(L.entryLine, Math.floor(room / Math.max(1, this.sections.length)));
    const size = Math.min(L.entrySize, Math.round(line * 0.74));
    let y = L.header + 18;
    g.textAlign = "left";
    this.sections.forEach((s, i) => {
      const on = i === this.section;
      this.entries.push({ top: y - size, bottom: y + (line - size) / 2 });
      if (on) {
        g.fillStyle = "#1d2836";
        g.fillRect(0, y - size - 2, L.sidebar, line);
        g.fillStyle = "#d4712a";
        g.fillRect(0, y - size - 2, 6, line);
      }
      g.font = (on ? BOLD : FACE).replace("%s", String(size));
      g.fillStyle = on ? "#ffd23c" : "#9fb2c0";
      let name = `${i + 1}. ${s.title}`;
      while (g.measureText(name).width > L.sidebar - L.pad * 1.5 && name.length > 4) name = `${name.slice(0, -2)}…`;
      g.fillText(name, L.pad * 0.7, y);
      y += line;
    });

    // the page
    const x0 = L.sidebar + L.pad;
    let ty = L.header + L.bodySize + 6;
    for (const line of pages[this.page] ?? []) {
      if (!line.gap) {
        let x = x0 + line.indent;
        for (const run of line.runs) {
          g.font = this.font(line.style, run);
          g.fillStyle = run.code || line.style === "code" ? "#9fe0ff" : line.style === "head" ? "#ffd23c" : line.style === "caption" ? "#7f909c" : run.bold ? "#ffffff" : "#dbe4ec";
          g.fillText(run.text, x, ty);
          x += g.measureText(run.text).width;
        }
      }
      ty += line.gap ? L.gap : L.bodyLine;
    }

    // footer
    g.fillStyle = "#223040";
    g.fillRect(0, H - L.footer, W, 2);
    g.font = FACE.replace("%s", String(L.bodySize - 6));
    g.fillStyle = "#7f909c";
    g.textAlign = "left";
    g.fillText("SHOOT ◀ ▶ TO TURN A PAGE   ·   ▲ ▼ FOR THE SECTION BEFORE OR AFTER   ·   SHOOT A NAME ON THE LEFT TO JUMP", L.pad, H - 14);
    g.textAlign = "right";
    g.fillText("README.md", W - L.pad, H - 14);
    this.tex.needsUpdate = true;
  }
}
