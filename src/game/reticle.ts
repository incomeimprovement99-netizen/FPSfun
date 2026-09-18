// The crosshair, as the player sets it up (Settings, Crosshair).
//
// Every shooter people play seriously lets you change the crosshair, and most
// players do: Valorant and CS2 have whole communities trading codes for them.
// This one was fixed at Apex's three prongs and a dot. The default here is
// still exactly that, drawn the same way, so nobody sees a change until they
// ask for one.
//
// The HUD is a canvas redrawn every frame, so a reticle is drawn from these
// numbers rather than stored as an image: it stays sharp at any display scale
// and costs a handful of strokes.
import hudCfg from "../config/hud.json";

export type ReticleStyle = "apex" | "cross" | "t" | "dot" | "circle";

export interface Reticle {
  style: ReticleStyle;
  /** an id from hud.json reticle.colors */
  color: string;
  /** line length, 1 is the old crosshair's */
  size: number;
  /** line width in pixels */
  thickness: number;
  /** pixels added to the gap between the lines and the centre */
  gap: number;
  /** a dot in the middle */
  dot: boolean;
  /** a dark edge round every line, so it reads on a bright sky and on snow */
  outline: boolean;
  /** the gap opens with the gun's spread, as the old crosshair's did */
  dynamic: boolean;
  /** 0.2 to 1 */
  opacity: number;
}

const CFG = hudCfg.reticle;
export const RETICLE_STYLES = CFG.styles as Array<{ id: ReticleStyle; label: string }>;
export const RETICLE_COLORS = CFG.colors as Array<{ id: string; label: string; hex: string }>;
export const RETICLE_DEFAULT: Reticle = { ...(CFG.default as Reticle) };
const LIMITS = CFG.limits;
const KEY = "range.reticle.v1";

/** a stored reticle, every field checked: a bad saved value falls back to the default rather than drawing nothing */
export function cleanReticle(raw: unknown): Reticle {
  const out: Reticle = { ...RETICLE_DEFAULT };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Partial<Record<keyof Reticle, unknown>>;
  const num = (v: unknown, lo: number, hi: number, d: number): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
  };
  if (RETICLE_STYLES.some((s) => s.id === r.style)) out.style = r.style as ReticleStyle;
  if (RETICLE_COLORS.some((c) => c.id === r.color)) out.color = r.color as string;
  out.size = num(r.size, LIMITS.size[0], LIMITS.size[1], out.size);
  out.thickness = num(r.thickness, LIMITS.thickness[0], LIMITS.thickness[1], out.thickness);
  out.gap = num(r.gap, LIMITS.gap[0], LIMITS.gap[1], out.gap);
  out.opacity = num(r.opacity, LIMITS.opacity[0], LIMITS.opacity[1], out.opacity);
  if (typeof r.dot === "boolean") out.dot = r.dot;
  if (typeof r.outline === "boolean") out.outline = r.outline;
  if (typeof r.dynamic === "boolean") out.dynamic = r.dynamic;
  return out;
}

export function loadReticle(): Reticle {
  try {
    const raw = localStorage.getItem(KEY);
    return cleanReticle(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...RETICLE_DEFAULT };
  }
}

export function saveReticle(r: Reticle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // storage off: the reticle still changes, it just is not kept
  }
}

export function reticleHex(r: Reticle): string {
  return RETICLE_COLORS.find((c) => c.id === r.color)?.hex ?? "#ffffff";
}

/**
 * Draw it centred on (cx, cy). `spreadGap` is the gap the gun's spread asks
 * for, in pixels; `u` is the HUD's scale; `alpha` fades it out as you aim.
 */
export function drawReticle(c: CanvasRenderingContext2D, cx: number, cy: number, spreadGap: number, u: number, alpha: number, r: Reticle): void {
  if (alpha <= 0) return;
  const gap = (r.dynamic ? spreadGap : 3) + r.gap * u;
  const len = (7 * u + 3) * r.size;
  const hex = reticleHex(r);
  const prongs: Array<[number, number]> =
    r.style === "apex"
      ? [
          [0, -1],
          [-0.866, 0.5],
          [0.866, 0.5],
        ]
      : r.style === "cross"
        ? [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]
        : r.style === "t"
          ? [
              [0, 1],
              [-1, 0],
              [1, 0],
            ]
          : [];
  c.save();
  c.globalAlpha = alpha * r.opacity;
  c.lineCap = "butt";
  // An outline is the same shapes drawn first, wider and dark, so the colour
  // sits on a dark edge whatever is behind it. It replaces the old soft
  // shadow, which smeared thin lines and did nothing for a light colour.
  const passes: Array<{ color: string; width: number }> = r.outline
    ? [
        { color: "rgba(0,0,0,0.85)", width: r.thickness + 2 },
        { color: hex, width: r.thickness },
      ]
    : [{ color: hex, width: r.thickness }];
  for (const pass of passes) {
    c.strokeStyle = pass.color;
    c.fillStyle = pass.color;
    c.lineWidth = pass.width;
    for (const [dx, dy] of prongs) {
      c.beginPath();
      c.moveTo(cx + dx * gap, cy + dy * gap);
      c.lineTo(cx + dx * (gap + len), cy + dy * (gap + len));
      c.stroke();
    }
    if (r.style === "circle") {
      c.beginPath();
      c.arc(cx, cy, gap + len * 0.5, 0, Math.PI * 2);
      c.stroke();
    }
    // a dot style is only the dot, whatever the dot setting says
    if (r.dot || r.style === "dot") {
      const rad = Math.max(1.2, r.thickness * 0.7) + (pass.width - r.thickness) / 2;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}
