# Plan: LOD and draw distance

**Written 2026-09-18**, the open half of "LOD, draw distance, and a loading screen" (the loading screen shipped with Milestone 64). This came from reading the code and building the battle royale map and the gun models headless in node (the document stub `tools/checks/net-delta.ts` uses), so the map and model counts below are measured. The loot and bot draw-call figures are worked out from those counts, not read off a running match.

## What a battle royale frame costs today

The headline: **the map is not the biggest cost. Loot guns and bot figures are**, and the benchmark cannot see either.

**The map** (`brMap.root`, merged by `mergeStatic` in `src/game/staticmerge.ts`)
- 2,489 meshes and 185.7k triangles at d488c63; 2,797 meshes and 204.7k triangles with the map expansion's stages 1 to 4. It merges to 59 draw calls.
- Bevel boxes (`bevel()` in `src/game/geo.ts`, a RoundedBoxGeometry at 300 triangles each, non-indexed) are about 85% of the triangles.
- The merge keeps indexed and non-indexed geometry apart, so ten materials cost two calls each.
- Every merged mesh spans the whole map, so frustum culling never drops any of it. One `mergeStatic` call covers the range, the arenas and the battle royale map, so groups probably mix regions (not yet measured).

**Draw distance.** The camera's far plane is 400 m, and the battle royale fog runs 140 to 680 m. The map's corners (622 m apart) cut off at about half fog, and they pop.

**Shadows.** The sun's shadow box is 460 m square. Competitive and Balanced draw it once, so moving figures cast nothing there. High redraws it every frame: all 175k caster triangles and every figure, at 11 cm per texel.

**Figures.** Each mannequin is about 13.7k triangles on 65 bones. It clones its own materials, casts shadows, and is never frustum-culled. Its gun adds 11 to 15 meshes and 5k to 14k triangles. So an armed bot is about 15 draw calls and 25k triangles, twice that on High. With eleven bots that is about 165 calls and 275k triangles, more than the map. Every bot's animation mixer runs every frame, whatever the distance.

**Loot.** A match lays out 820 to 980 items, 200 to 280 of them guns. A gun on the floor is a full copy of the display model: 11 to 15 draw calls plus its plate. The only culling is a 70 m radius. A rich place can put 40 to 60 guns in range, which works out to roughly 500 to 900 draw calls. That is the prime suspect for CPU time.

**The measurements are wrong.** `drawCalls()` reads `renderer.info.render.calls`, which resets on every render call. With post-processing on, it reports only the last pass, so only the Competitive numbers are real. `BENCH_SPOT=br` moves the camera over an empty map, with no match, bots or loot.

## The first measurement, and what it changes

Step A below was built first, the same day. `npm run bench` now counts every pass of a frame, draw calls and triangles averaged over the run, and reports the 99th percentile. `BENCH_SPOT=brmatch` plays a real solo battle royale on seed 42, dropped on the hub. Measured at d488c63's map, 1920x1080, on this machine:

| Where | Preset | fps median | p99 frame | Draw calls | Triangles |
|---|---|---|---|---|---|
| Range | Competitive | 556 | 3.0 ms | 479 | 689k |
| Range | High | 263 | 5.7 ms | 1,649 | 3.68M |
| BR, empty, from the Mast's roof | Competitive | 132 | 11.8 ms | 1,238 | 2.85M |
| BR, empty, from the Mast's roof | High | 143 | 9.5 ms | 2,551 | 6.58M |
| BR match at the hub, 9 bots | Competitive | 100 | 16.3 ms | 1,366 | 2.72M |
| BR match at the hub, 9 bots | Balanced | 175 | 8.6 ms | 1,384 | 2.72M |
| BR match at the hub, 9 bots | High | 88 | 19.8 ms | 2,773 | 6.63M |

**What this changes: the world, not the loot, is the first target.** The empty map already costs 1,238 draw calls and 2.85M triangles, about fifteen times the map's own 186k triangles. The loot and bots in view at the hub add only about 130 calls. So something across the whole merged world is drawn from everywhere, twice or more per frame: the range, the arenas and the battle royale map share merged groups with no culling, and the shadow pass comes on top. **Step F (cells) moves ahead of C and D**, after a short investigation. That investigation lists the draw calls by mesh at the `br` spot to find what the 2.85M triangles are. The Competitive preset at the hub, 100 fps median with a 16 ms p99, is the number to beat.

## Step F, as built, and what the first measurement got wrong (2026-09-19, Milestone 100)

Profiling the frame by object (every draw call attributed to the mesh that made it) found three things the table
above could not show:

- **The `brmatch` spot never measured a match.** `startBr` builds the match but nothing took the pointer lock a
  click takes, so the match waited for the page to be in the game, and the teleport onto the hub was clamped by the
  range's bounds: every `brmatch` row above is the range's southern edge with a battle royale waiting. The spot now
  takes the lock (the same pretend lock the e2e's clicks take).
- **The battle royale map was drawn twice.** `rangeRoots` in main.ts is "everything added to the scene since the
  range started building", and the map is built in between, so its root was in that list and in the merge's list
  as well: every one of its meshes went into its merged group twice.
- **Each side of the world drew the other.** The camera sees 400 m and the range is 500 m from the map, so from the
  Mast's roof the range's target frames (232 calls), its course signs (80), its fetched props (a million triangles:
  eight road barriers are 61k triangles each) and its merged walls were all drawn, fogged to nothing.

What was built: the map out of `rangeRoots`; the merge takes a region per list of roots and merges nothing across
two, and puts each region's merged meshes in a group of the caller's; main keeps the range side (the range, the
courses, the arenas, the targets and dummies) and the map side in two groups and draws only the one the camera is
on; and the bevelled box is indexed (900 vertices to 212). **Cells of 73 m inside a region were tried and dropped**:
from the Mast's roof they took the map from 1,262 draw calls to 1,986 for 15% fewer triangles, and this frame is
bound by its draw calls, not its triangles.

| Where | Preset | fps median before | after | p99 before | after | Draw calls before | after | Triangles before | after |
|---|---|---|---|---|---|---|---|---|---|
| BR, empty, from the Mast's roof | Competitive | 159 | 385 | 9.0 ms | 3.7 ms | 1,262 | 400 | 3.01M | 1.64M |
| BR, empty, from the Mast's roof | Balanced | 270 | 500 | 5.1 ms | 3.3 ms | 1,276 | 418 | 3.00M | 1.64M |
| BR, empty, from the Mast's roof | High | 175 | 333 | 9.5 ms | 4.9 ms | 2,535 | 731 | 6.82M | 3.77M |
| BR match at the hub, 9 bots (now a match) | Competitive | 172 | 185 | 8.5 ms | 7.2 ms | 966 | 867 | 1.27M | 0.78M |
| BR match at the hub, 9 bots | Balanced | 175 | 182 | 8.1 ms | 7.6 ms | 962 | 913 | 1.25M | 0.80M |
| BR match at the hub, 9 bots | High | 93 | 106 | 14.6 ms | 12.3 ms | 2,077 | 1,833 | 4.04M | 2.21M |
| Range | Competitive | 476 | 476 | 3.0 ms | 2.9 ms | 490 | 497 | 619k | 581k |

In a match what is left of the draw calls is now what the plan first suspected: the loot (its boxes, rings and
beams, about 150 calls at the hub), the doors (one mesh each now, from two), and the gun's hands (about 75 calls of
capsules and spheres in the gun's own pass). Steps C (loot) and D (figures) are next, and the hands after them.

## Options, best gain per hour first

1. **Fix the measurements.** Everything else is judged by them.
2. **Loot LOD.**
   - Merge each display gun into one mesh with per-vertex colour and one material, cached per weapon: 13 calls become 1.
   - Show the full model only within about 10 m.
   - Draw the boxes and plates as one InstancedMesh each. BatchedMesh could hold every merged gun in one call, with culling per instance.
3. **Figure LOD.**
   - Give each figure a fixed bounding sphere and turn frustum culling back on.
   - Run the animation every frame within 30 m, every 2nd frame to 80 m and every 4th beyond, and skip it off screen past 20 m.
   - Use the merged gun beyond 15 m.
   - Cast shadows only within 60 m.
   - Hit boxes come from the figure's own boxes, not the animation, so none of this changes what a bullet hits.
4. **Match the far plane to the fog**, with a draw distance per quality preset. About an hour, and it ends the pop at 400 m.
5. **Cells in mergeStatic.** Put the region and a cell of about 73 m into the merge key, never merge across regions, and index the bevel geometry while at it: that cuts its vertices about three times and ends the doubled calls. Frustum culling then drops about half the map. That ranks here because 200k triangles is small for a GPU.
6. **A shadow box that follows the player on High** (about 80 m across, snapped to whole texels); the other presets keep the static whole-map shadow.
7. **Dynamic resolution** for Balanced and High, driven by frame time.
8. **Build the battle royale map only when a match starts.** This needs the regions kept apart (5).

## Measuring and guarding it

`tools/bench.ts` should:
- set `renderer.info.autoReset = false` and reset at each frame's start, so it counts every pass;
- report triangles and 50th, 95th and 99th percentile frame times;
- gain a `brmatch` spot: a battle royale on a fixed seed, standing in the richest place with the bots alive. This needs a `__range.startBr({ seed })` hook.

A new `tools/checks/render-budget.ts` in verify builds the map headless and asserts:
- a triangle budget;
- no material split by indexed and non-indexed geometry;
- after step F, no merged mesh wider than a cell and no group across regions;
- a merged loot gun is one mesh with the same bounds as the full model;
- the animation-stride bands.

## Build order

| Step | Work | Hours | Test |
|---|---|---|---|
| A | ~~Benchmark: every pass counted, triangles, percentiles, the `brmatch` spot~~ done, baseline above | 2-3 | A baseline on all three presets at `br`, `brmatch` and `range` |
| B | `render-budget.ts` at today's numbers | 2 | Verify passes; a budget one lower fails |
| C | Loot LOD: merged guns, instanced boxes and plates | 4-6 | Merged-gun check; `brmatch` draw calls drop by hundreds |
| D | Figure LOD: bounds, animation stride, far gun, 60 m shadows | 3-4 | Stride check; the bot and knockdown checks still pass; High benchmark |
| E | Far plane and fog per preset | 1-2 | The sky-hours check; a map-corner benchmark |
| F | ~~Cells in mergeStatic, regions apart, indexed bevels~~ done without the cells (measured worse), with the double merge fixed and each side drawn only from itself: see above | 4-6 | The cell and region assertions; `br` and `range` benchmarks |
| G | A shadow box that follows the player on High | 2-3 | High benchmark; snap comparison |
| H | Dynamic resolution, then building the map per mode | 3-4 each | Percentiles; loading-screen timing |

Do this after the map expansion lands, so the numbers are taken on the finished map.
