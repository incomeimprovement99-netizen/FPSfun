// The rain behind the start screen (Milestone 635): the intro card's falling glyphs (src/ui/intro.ts rainColumns),
// in the game's blue and pink, half seen (the owner, 2026-10-17: "can we add the matrix falling style stuff we have? it
// could be like 50% transparant or something with blue and pink ones to match the theme").
//
// A canvas over the overlay's backdrop and under the start screen, drawn only while the start screen is up: a dark base
// with the glyphs on it, the whole of it at rain.opacity, so the game behind shows through only that much (Milestone
// 639: 0.75, the owner's "we see less of the background"). A machine set to less movement gets one still frame of it.
import { rainColumns, type RainColumn } from "./intro";
import cfg from "../config/start.json";

const GLYPHS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ<>[]{}/\\|=+*#%&$@";

export class StartRain {
  private readonly ctx: CanvasRenderingContext2D | null;
  private cols: RainColumn[] = [];
  private frame = 0;
  private t0 = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private running = false;
  private readonly still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    canvas.style.opacity = String(cfg.rain.opacity);
  }

  /** up with the start screen, and stopped with it */
  set(on: boolean): void {
    this.canvas.hidden = !on;
    if (on === this.running) return;
    this.running = on;
    cancelAnimationFrame(this.frame);
    if (!on) return;
    this.fit();
    this.t0 = performance.now() / 1000;
    this.last = 0;
    this.frame = requestAnimationFrame(this.draw);
  }

  /** the canvas at the window's size in CSS pixels (a backdrop needs no more), its columns laid out for it */
  private fit(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (w === this.w && h === this.h) return;
    this.w = this.canvas.width = w;
    this.h = this.canvas.height = h;
    this.cols = rainColumns(w, h, 7);
    // (a new size clears the canvas: the base under it again at once)
    if (this.ctx) {
      this.ctx.fillStyle = cfg.rain.base;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  private draw = (): void => {
    if (!this.running || !this.ctx) return;
    this.fit();
    const R = cfg.rain;
    const ctx = this.ctx;
    const t = performance.now() / 1000 - this.t0;
    // (at most rain.fps frames a second: a backdrop at the display's 240 is the GPU's time for nothing)
    if (t - this.last >= 1 / R.fps || this.still) {
      this.last = t;
      // what was there fades toward the base: each head leaves a tail
      ctx.globalAlpha = R.fade;
      ctx.fillStyle = R.base;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
      ctx.font = `${R.glyph}px "Consolas", "Courier New", monospace`;
      ctx.textBaseline = "top";
      const rows = Math.ceil(this.h / R.glyph) + 2;
      const turn = Math.floor(t / R.swap);
      this.cols.forEach((col, i) => {
        const span = rows + col.tail;
        const row = Math.floor((((col.start + t * col.speed) % span) + span) % span) - col.tail;
        // every other column pink, the rest the blue
        const pink = i % 2 === 1;
        for (let k = 0; k < 3; k++) {
          const r = row - k;
          if (r < 0 || r > rows) continue;
          ctx.fillStyle = k === 0 ? (pink ? R.pinkHead : R.blueHead) : pink ? R.pink : R.blue;
          ctx.globalAlpha = k === 0 ? 1 : 0.6 - k * 0.15;
          ctx.fillText(GLYPHS[(i * 7 + r * 13 + turn) % GLYPHS.length], col.x, r * R.glyph);
        }
      });
      ctx.globalAlpha = 1;
    }
    if (!this.still) this.frame = requestAnimationFrame(this.draw);
  };
}
