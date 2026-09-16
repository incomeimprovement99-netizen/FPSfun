// The HUD's icons (public/icons, fetched by npm run icons).
//
// The HUD is a canvas redrawn every frame, so an icon has to be something
// drawImage can take. These are SVG files loaded as Images: a vector
// rasterises at whatever the display scale is, where a sprite sheet blurs at
// 150 per cent and the range is played at every scale there is.
//
// Two things make this less obvious than it sounds.
//
// An SVG drawn straight to a canvas keeps its own colours, and the HUD tints
// everything to say what it means (a heal is green, a warning is orange). So
// each icon is rasterised once per size into an offscreen canvas, then tinted
// with a source-in fill, and the result is cached per name, size and colour.
// A frame that draws the same icon twice pays for neither.
//
// And an icon that has not loaded yet must not leave a hole. Every draw
// returns whether it drew, so the caller keeps the text it was drawing before
// and the icon simply appears when it arrives. A checkout that never ran
// npm run icons therefore looks exactly like the old HUD.
const BASE = "icons";

/** name -> the loaded image, or null while it loads and forever if it 404s */
const loaded = new Map<string, HTMLImageElement | null>();
/** "name|size|colour" -> the tinted bitmap */
const tinted = new Map<string, HTMLCanvasElement>();
let indexAsked = false;
let names: Record<string, string> | null = null;

/**
 * Start loading the index and, with it, every icon. Called once when the HUD
 * is built. It is deliberately fire and forget: nothing waits on it, and the
 * HUD draws its text until the files arrive.
 */
export function loadIcons(): void {
  if (indexAsked) return;
  indexAsked = true;
  void fetch(`${BASE}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : null))
    .then((list) => {
      if (!list) return;
      names = list;
      for (const [name, file] of Object.entries(list)) {
        const img = new Image();
        img.onload = () => loaded.set(name, img);
        img.onerror = () => loaded.set(name, null);
        img.src = `${BASE}/${file}`;
      }
    })
    .catch(() => {
      // no icons: the HUD keeps its text, which is what it had before
    });
}

/** is this one here yet */
export function hasIcon(name: string): boolean {
  return Boolean(loaded.get(name));
}

/** how many are loaded (tests) */
export function iconCount(): number {
  let n = 0;
  for (const v of loaded.values()) if (v) n++;
  return n;
}

/** the names the index offered, for a test that wants to know what exists */
export function iconNames(): string[] {
  return names ? Object.keys(names) : [];
}

function bitmap(name: string, size: number, color: string): HTMLCanvasElement | null {
  const img = loaded.get(name);
  if (!img) return null;
  // Sizes are rounded to the pixel before caching. Without it a HUD that
  // scales with the window would make a new bitmap on every resize frame and
  // the cache would grow for the life of the page.
  const px = Math.max(1, Math.round(size));
  const key = `${name}|${px}|${color}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(img, 0, 0, px, px);
  // source-in keeps the glyph's alpha and replaces its colour, which is what
  // makes one file serve every state the HUD draws it in
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, px, px);
  // a page that leaves a tab open for an hour should not grow this without end
  if (tinted.size > 400) tinted.clear();
  tinted.set(key, c);
  return c;
}

/**
 * Draw one, centred on (x, y). Returns false when it is not here yet, so the
 * caller can fall back to whatever it drew before rather than leaving a gap.
 */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color: string, alpha = 1): boolean {
  const b = bitmap(name, size, color);
  if (!b) return false;
  const prev = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prev * alpha;
  ctx.drawImage(b, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  ctx.globalAlpha = prev;
  return true;
}
