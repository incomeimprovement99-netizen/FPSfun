// Dressing an arena: a CC0 prop in place of the cover box it stands for.
//
// The arenas are where seven of the game's modes are played, and they are
// generated boxes: a crate is a box with a crate texture on it, cover is a
// box, a barrier is a box. From a metre away that reads as a toy, which is
// what the owner meant by "less like roblox". The battle royale map and the
// range both carry modelled and scanned props (src/game/props.ts, Poly Haven
// CC0); the arenas carry none.
//
// The rule that makes this safe is that **the collider never moves**. A box's
// solid is registered from the plan exactly as before; what changes is that
// its grey mesh is not drawn, and a stack of crates, a run of drums or a
// generator is drawn in the same space instead. A piece of cover is then the
// same cover: the same height to shoot over, the same width to hide behind,
// the same thing the bots' walk was checked against.
//
// Which means a prop may only stand in for a box it actually fills. A crate
// two thirds the height of the box it replaced would be cover you could see
// over but not shoot over, which is the worst thing a map can do to a player.
// `COVER` is how much of each axis a prop has to fill to take a box's place,
// and anything less leaves the box alone.
//
// A plan is numbers and no three.js (plan.ts), so this is too.
import type { Placement, PropName } from "./props";
import type { PlanBox } from "./arenas/plan";

/** a prop and the size it is modelled at, metres */
interface Dress {
  prop: PropName;
  size: { w: number; h: number; d: number };
  /** how many of it may stand side by side in one box */
  most: number;
  /** and how many may stack */
  stack: number;
  /**
   * True for a prop that comes in sizes: a crate, a rack, a barrier. Those
   * may be stretched to the box they stand in, so the cover is exactly the
   * cover it replaced. A drum does not come in a stretched version and never
   * gets one: it has to fit as it is or not stand in at all.
   */
  stretch?: boolean;
  /** how far a stretched prop's proportions may be pulled from the model's */
  pull?: number;
}

/**
 * The wardrobe. Sizes are the models' own (public/models), measured once so
 * this stays a numbers file.
 */
const WARDROBE: Dress[] = [
  { prop: "wooden_military_crate", size: { w: 1.1, h: 0.75, d: 0.75 }, most: 4, stack: 3, stretch: true, pull: 2.2 },
  { prop: "concrete_road_barrier", size: { w: 2.0, h: 0.85, d: 0.6 }, most: 4, stack: 1, stretch: true, pull: 1.7 },
  { prop: "steel_frame_shelves_01", size: { w: 1.0, h: 2.0, d: 0.5 }, most: 3, stack: 1, stretch: true, pull: 1.8 },
  { prop: "plastic_crate_03", size: { w: 0.6, h: 0.4, d: 0.4 }, most: 6, stack: 4, stretch: true, pull: 2.0 },
  { prop: "portable_generator", size: { w: 1.2, h: 0.9, d: 0.8 }, most: 2, stack: 1 },
  { prop: "Barrel_01", size: { w: 0.6, h: 0.9, d: 0.6 }, most: 5, stack: 2 },
];

/** how much of each axis a prop has to fill before it may stand in for the box */
export const COVER = 0.85;
/** how far a prop may be scaled from the size it was modelled at: a crate comes in sizes, a generator does not come in doubles */
const SCALE = { min: 0.7, max: 1.6 };
/** how many props an arena wears at most: the cover a fight happens behind, not every block in the map */
export const MOST = 60;
/** the materials whose boxes are cover rather than structure */
const DRESSED: ReadonlySet<string> = new Set(["crate", "cover", "container", "containerAlt"]);

/** what one prop, repeated and stacked, comes to inside a box */
interface Fit {
  d: Dress;
  scale: number;
  across: number;
  rows: number;
  /** how much of the box's length, height and depth it fills, 0..1 */
  cover: { w: number; h: number; d: number };
  /** for a stretched prop, the size one piece is drawn at */
  size?: { x: number; y: number; z: number };
}

/** how well a fit fills its box, for choosing between them */
const score = (f: Fit): number => f.cover.w + f.cover.h + f.cover.d;

/**
 * The best a prop can do inside a box: scaled, repeated along the box's
 * longer side and stacked up its height. Null when it cannot fill the box to
 * `COVER` on every axis, which is most of the time and is the point.
 */
export function fit(d: Dress, b: PlanBox): Fit | null {
  let best: Fit | null = null;
  for (let rows = 1; rows <= d.stack; rows++) {
    for (let across = 1; across <= d.most; across++) {
      const alongX = b.w >= b.d;
      const along = alongX ? b.w : b.d;
      const cross = alongX ? b.d : b.w;
      if (d.stretch) {
        // A prop that comes in sizes is stretched to the box exactly, so it
        // fills it by construction. What is checked is only that the stretch
        // is one a thing of that kind could plausibly be: a crate twice as
        // wide as it is deep is a crate, and one eight times as wide is a
        // plank pretending to be one.
        const want = { x: along / across, y: b.h / rows, z: cross };
        const by = { x: want.x / d.size.w, y: want.y / d.size.h, z: want.z / d.size.d };
        const most = Math.max(by.x, by.y, by.z);
        const least = Math.min(by.x, by.y, by.z);
        if (most / least > (d.pull ?? 1.6)) continue;
        if (most > SCALE.max * 1.4 || least < SCALE.min * 0.6) continue;
        const f: Fit = { d, scale: 1, across, rows, cover: { w: 1, h: 1, d: 1 }, size: want };
        // fewer, bigger pieces read better than a wall of small ones
        if (!best || across * rows < best.across * best.rows) best = f;
        continue;
      }
      // everything else has to fit as it is: scaled by whichever axis runs out
      // first, so it never sticks out of the box it is standing in for
      const scale = Math.min(b.h / (d.size.h * rows), along / (d.size.w * across), cross / d.size.d);
      if (scale < SCALE.min || scale > SCALE.max) continue;
      const cover = {
        w: (d.size.w * across * scale) / along,
        h: (d.size.h * rows * scale) / b.h,
        d: (d.size.d * scale) / cross,
      };
      if (cover.w < COVER || cover.h < COVER || cover.d < COVER) continue;
      const f: Fit = { d, scale, across, rows, cover };
      if (!best || score(f) > score(best)) best = f;
    }
  }
  return best;
}

/** the props one box wears, or none when nothing in the wardrobe fills it */
export function dressBox(b: PlanBox, seed: number): Placement[] {
  if (!DRESSED.has(b.mat) || b.solid === false) return [];
  let best: Fit | null = null;
  // the wardrobe is walked from a different place for each box, so two boxes
  // of the same shape are not the same stack of crates twice over
  for (let k = 0; k < WARDROBE.length; k++) {
    // the seed is a box's own place on a map and may be negative
    const w = WARDROBE[(((k + seed) % WARDROBE.length) + WARDROBE.length) % WARDROBE.length];
    const f = fit(w, b);
    if (f && (!best || score(f) > score(best))) best = f;
  }
  if (!best) return [];
  const { d, scale, across, rows, size } = best;
  const alongX = b.w >= b.d;
  const along = alongX ? b.w : b.d;
  const step = size ? size.x : d.size.w * scale;
  const floor = b.y ?? 0;
  const out: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < across; i++) {
      const off = across === 1 ? 0 : -along / 2 + step / 2 + i * ((along - step) / (across - 1));
      // a half turn on every other one, so a run of crates is not a comb
      const turn = Math.abs(seed + i + row) % 2 ? 180 : 0;
      out.push({
        prop: d.prop,
        x: b.x + (alongX ? off : 0),
        z: b.z + (alongX ? 0 : off),
        y: floor + row * (size ? size.y : d.size.h * scale),
        rot: (alongX ? 0 : 90) + turn,
        ...(size ? { scale3: { x: size.x, y: size.y, z: size.z } } : { scale }),
      });
    }
  }
  return out;
}

/**
 * Every prop an arena wears, and the boxes whose mesh a prop now stands in
 * for. The caller draws every box except those, and registers every box's
 * solid exactly as before.
 *
 * No placement carries a `solid` of its own: the box it stands in is already
 * one, and a second collider in the same space would be cover bigger than it
 * looks.
 */
export function dressPlan(boxes: readonly PlanBox[], most = MOST): { props: Placement[]; instead: Set<number> } {
  // the biggest cover first: an arena wants the blocks a fight happens behind
  // to stop being blocks, and the budget spent on the small ones last
  const order = boxes
    .map((b, i) => ({ b, i }))
    .filter((x) => DRESSED.has(x.b.mat) && x.b.solid !== false)
    .sort((a, z) => z.b.w * z.b.d * z.b.h - a.b.w * a.b.d * a.b.h);
  const props: Placement[] = [];
  const instead = new Set<number>();
  for (const { b, i } of order) {
    if (props.length >= most) break;
    const put = dressBox(b, i);
    if (!put.length) continue;
    props.push(...put);
    instead.add(i);
  }
  return { props, instead };
}
