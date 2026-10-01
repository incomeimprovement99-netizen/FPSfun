// Graphics quality presets, chosen on the settings screen.
//
// Where the frame time goes, most expensive first, and what each preset does
// about it:
//
//   point lights   Forward rendering pays for every point light on every lit
//                  pixel. The range had twelve (six ceiling, six rack pools)
//                  plus one on the muzzle, on top of the sun, sky and rim.
//   ambient occl.  GTAO samples the depth buffer 16 times per pixel at full
//                  resolution. The single biggest post-processing cost.
//   shadow map     4096 x 4096, redrawn every frame with every caster in it.
//                  The range barely moves, so drawing it once is nearly free.
//   post chain     bloom, SMAA, output and grade are four full-screen passes,
//                  and they force rendering into offscreen targets, which also
//                  rules out hardware MSAA and adds a copy of latency.
//
// Competitive draws the scene straight to the screen with MSAA and none of the
// above. That is both the fastest path and the lowest-latency one.
export type Preset = "competitive" | "balanced" | "high";

export interface Quality {
  preset: Preset;
  /** render through the post-processing composer at all */
  post: boolean;
  ao: boolean;
  bloom: boolean;
  smaa: boolean;
  grade: boolean;
  /** "static" draws the shadow map once (and again when props arrive) */
  shadows: "off" | "static" | "live";
  shadowSize: number;
  pointLights: boolean;
  /** cap on the device pixel ratio */
  maxPixelRatio: number;
  /**
   * A desynchronized (low-latency) canvas lets the browser skip part of its
   * compositing step. It can tear, which is the same trade a game makes with
   * v-sync off.
   */
  lowLatency: boolean;
  /**
   * How far this preset draws, metres. The fog ends here and the camera's far
   * plane sits a little beyond it, so nothing is ever clipped in clear air:
   * what goes out of the world goes out inside the fog. Competitive draws
   * least (it is the preset for frames), High the most.
   */
  drawDistance: number;
  /**
   * The city bundle's pictures (citykit.json sizes): "lo" its 512 textures, "hi" its 1024, "max" its 2048 (High),
   * all GPU-compressed (KTX2), so even the 2K bake costs the card about what the 1K WebP did. Looks only, like
   * everything the bundle draws: collision and play are the same in every preset.
   */
  cityKit: "lo" | "hi" | "max";
  /**
   * How much of the bundle the centre wears (citykit.json dress tiers): 0 the buildings, shop fronts, parapets,
   * billboards and skyline; 1 adds the signs, posters, AC units, roof gear, antennas and lamps; 2 adds the cables,
   * pipes, wires and street clutter.
   */
  cityDetail: 0 | 1 | 2;
}

/**
 * The fog and the far plane for a part of the world at a preset: the region's
 * own fog, shortened to what the preset draws, with the near end kept in
 * proportion, and the far plane `beyond` metres past the fog's end.
 */
export function drawRange(regionFog: { near: number; far: number }, q: { drawDistance: number }, beyond = 60): { near: number; far: number; camFar: number } {
  const far = Math.min(regionFog.far, q.drawDistance);
  const k = far / regionFog.far;
  return { near: Math.max(20, regionFog.near * k), far, camFar: far + beyond };
}

/**
 * A distance something is drawn to, scaled by the preset. The distances in the
 * world were tuned on Balanced (a rock's scan is worth drawing to 170 m, a
 * cliff face to 260, a dead branch to 150), so Balanced is 1 and the other two
 * are its ratio: without this the draw distance would only move the fog, since
 * the map itself is merged into meshes that span the whole of it and nothing
 * culls by how far you asked to see.
 */
export function sceneryFar(base: number, q: { drawDistance: number }): number {
  return Math.round((base * q.drawDistance) / 620);
}

export const PRESETS: Record<Preset, Quality> = {
  competitive: {
    preset: "competitive",
    post: false,
    ao: false,
    bloom: false,
    smaa: false,
    grade: false,
    shadows: "static",
    shadowSize: 2048,
    pointLights: false,
    maxPixelRatio: 1,
    lowLatency: true,
    drawDistance: 460,
    cityKit: "lo",
    cityDetail: 0,
  },
  balanced: {
    preset: "balanced",
    post: true,
    ao: false,
    bloom: true,
    smaa: true,
    grade: true,
    shadows: "static",
    shadowSize: 4096,
    pointLights: false,
    maxPixelRatio: 1.5,
    lowLatency: false,
    drawDistance: 620,
    cityKit: "hi",
    cityDetail: 1,
  },
  high: {
    preset: "high",
    post: true,
    ao: true,
    bloom: true,
    smaa: true,
    grade: true,
    shadows: "live",
    shadowSize: 4096,
    pointLights: true,
    maxPixelRatio: 2,
    lowLatency: false,
    drawDistance: 760,
    cityKit: "max",
    cityDetail: 2,
  },
};

const KEY = "range.quality";

/** the saved preset, or Competitive: the owner put snappy above pretty */
export function loadQuality(): Quality {
  try {
    const p = localStorage.getItem(KEY) as Preset | null;
    if (p && p in PRESETS) return overridden(PRESETS[p]);
  } catch {
    /* storage blocked: fall through to the default */
  }
  return overridden(PRESETS.competitive);
}

/**
 * The preset with some of its settings changed by the page's address, `&q=ao:0,shadows:live`, each key a Quality's
 * own: for measuring what one setting costs on its own (tools/bench.ts BENCH_QUERY), where a preset moves several.
 */
function overridden(q: Quality): Quality {
  const raw = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("q");
  if (!raw) return q;
  const out: Record<string, unknown> = { ...q };
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":");
    if (!(k in q) || v === undefined) continue;
    const was = out[k];
    out[k] = typeof was === "boolean" ? v === "1" || v === "true" : typeof was === "number" ? Number(v) : v;
  }
  return out as unknown as Quality;
}

export function saveQuality(p: Preset): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* ignore */
  }
}

/**
 * Measure the display's refresh rate from requestAnimationFrame spacing. The
 * browser paces frames to the monitor, so this is also the frame cap: a
 * 240 Hz panel allows up to 240, but only if each frame fits in 4.2 ms.
 */
export function measureRefresh(samples = 90): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    let prev = 0;
    const tick = (t: number) => {
      if (prev) times.push(t - prev);
      prev = t;
      if (times.length < samples) requestAnimationFrame(tick);
      else {
        times.sort((a, b) => a - b);
        const median = times[Math.floor(times.length / 2)];
        resolve(1000 / median);
      }
    };
    requestAnimationFrame(tick);
  });
}
