# Plan: the Neon City's draw calls

The owner asked for the game to run smoother on low and high end machines. The lobby agent measured where the frame
goes (2026-10-17, main 687b5e12, map v91, the bench's `neonstreet` spot, Competitive, 28 bots):

- On a half-speed CPU (`BENCH_CPU=2`) a frame is about 19 ms; at a quarter speed, 21 fps. The presets barely differ on
  the CPU.
- Hiding the city's meshes (`neonc_*`) took the render phase from about 10.5 ms to 5.2 ms and the draw calls from 601 to
  178. The city is about 420 draw calls a frame, the largest single cost on the CPU.
- Culling saves nothing: the bake writes the whole centre as one glTF mesh of 441 primitives, one per material (435
  materials), each spanning the city, so 407 are drawn from the street whichever way the camera looks.

## Why it is this way

The bake (tools/import-neon.ts `groupOf`, tools/import-city.ts `bake()`) puts every `c-` chunk into one group and
merges its triangles by material: the fewest primitives for a given set of materials, and nothing to cull. The
materials are the pack's own, 435 of them, and the bake keeps each one's look exactly (its colour, normal, a packed
occlusion-roughness-metal texture, its emission and the Unity detail maps).

## The material classes (measured off neonmap-v92-lo.glb)

| Class | Materials | Triangles |
|---|---|---|
| Opaque lit, plain | 154 | 2.64M |
| Opaque, emissive | 96 | 0.41M |
| Opaque, detail-mapped | 60 | 1.50M |
| Opaque, emissive and detail-mapped | 66 | 0.39M |
| Cut out (alpha mask: signs, blinds, grilles, palms) | 30 | 70k |
| See-through (glass, liquid, decals) | 25 | 116k |
| Additive light beams | 3 | 720 |
| Unlit | 1 | 32 |

The 376 opaque lit materials carry 326 different texture sets: merging only those that share textures saves about 50
draws. The lever is texture arrays.

## The design

1. **Batches of opaque materials, one primitive per batch and sector.** Every opaque lit material in a batch has a
   layer in each of the batch's texture arrays (colour, normal, occlusion-roughness-metal, emission; and for the
   detail batches the detail colour, normal and mask). A vertex carries its material's index (`_MATID`).
2. **The arrays are assembled when the map loads**, not baked: each layer stays its own KTX2 image, encoded as now
   (Basis ETC1S, normals UASTC), and after KTX2Loader transcodes them the game joins each mip level across the layers
   into a `THREE.CompressedArrayTexture`. Baking the arrays would share one ETC1S codebook across hundreds of
   different materials and take tens of minutes a size. Every layer of an array must be the same size and the same
   transcoded format: the bake makes a batch's layers square at the size's own resolution (lo 512, normals 256; a
   non-square texture is stretched, which a 0 to 1 UV does not see) and encodes them all with or all without alpha.
3. **A material table**, a float texture read with `texelFetch`, a row per material: its base colour, emission and
   strength, normal scale, roughness, metal and occlusion strength, detail transform and scale, and its layer in each
   array. Layer 0 of every array is neutral (white, flat normal, full occlusion-roughness-metal, mid-grey detail), so
   a material without a map reads its neutral layer and the shader has no branches round its fetches.
4. **The shader** is MeshStandardMaterial with an `onBeforeCompile`, as the detail maps and the decay are now: the
   material index through a flat varying, the map, normal, roughness, metalness, occlusion and emission lookups
   changed to array fetches (the packed texture read once, not three times). Placeholder 1x1 maps make three emit its
   tangent frame and UV code. The `#include <emissivemap_fragment>` line stays: the decay's glow is added after it.
5. **Batches sized to fit**: at most 256 layers an array (WebGL2's guaranteed minimum) and about 128 MB an array (one
   allocation's limit on Direct3D 11): lo two or three batches, hi about four. The max size stays on today's file
   until it is measured.
6. **Sectors**: each batch split by triangle centroid into 50 m cells (the game's nine 100 m sectors cut in four,
   lining up with the decay's), so a camera on the street draws the 15 to 25 cells in front of it.
7. **The fallback**: the bake goes on writing today's file beside the batched one; the game loads today's file when
   assembling the arrays fails (a format it cannot join, an allocation refused) and behind a URL switch for
   comparing.

## The stages, each shipped on its own and measured

1. **The count and a baseline.** The bake writes its primitives, materials and classes to `cfg.baked.draw`; a check
   holds it; the bench's numbers before any change (`BENCH_SPOT=neonstreet`, full and half CPU, interleaved).
2. **The plain and emissive opaque materials batched** (250 materials, about 245 draws less).
3. **The detail-mapped ones** (126 materials, about 120 less).
4. **Sectors** (from about 420 city draws from the street to 60 to 100).
5. Later: the cut-out materials (they need their own depth material for shadows); the max size's arrays.

## Checks

- sk-neon (in node, no glb): the city's primitives under a budget; every opaque lit material in exactly one batch;
  every array at most 256 layers and under its byte cap, its layers one size; every table index in range.
- The game exposes its batches (`NEON_MAP.batches`) for the e2e: the arrays assembled, no fallback taken.
- Photographs of the same spots before and after each stage, side by side: the look must not move.
- The bench, before and after, interleaved: draw calls, render phase, GPU time, p99 frame and hitches; on High, where
  the shadows are drawn live, too.

## Risks

- Three patches chain on the same materials (detail maps, the decay's sector discard and glow, the reflections).
- Uploading 70 to 90 MB arrays stalls: behind the loading screen, but its hitches are measured.
- More texture fetches a fragment: the GPU time could rise where the CPU time falls.
- How meshopt's compression treats a custom attribute is not yet known: tried first, on one batch.

## Stage 1, measured (Milestone 657)

- **What shipped:** the 249 opaque, lit materials without detail maps in batches at lo, hi and max (lo one batch, hi
  three, max twelve). The centre went from 441 primitives to 193, and the look is unchanged: 12 spots compared,
  mean difference under 1 of 255 (the moving cars aside).
- **The bench** (the street spot, Competitive, interleaved runs):
  - half a processor: 40 to 50 fps;
  - a whole processor: 132 to 139 fps;
  - the game loop's time fell from about 9 ms to about 6 in the best runs.
- **The graphics card's timer** read about 1 to 1.5 ms more at full speed, in every variant of the shader. The
  cheapest variant shipped: each material's row read per vertex and handed on flat. Branches round each lookup to
  skip the neutral layers cost more than they saved.
- **Cells were dropped.** The batch cut into 50 m cells, each its own node so three.js could sort and cull it, was
  baked and measured. From the street most cells are in view: 5% fewer triangles and no more fps, at the cost of 40
  more draws.
- **The hitches:** one frame over 50 ms "outside the loop" in some batched runs, in some runs of every variant. Keeping
  the layers' pictures alive (so nothing became garbage) did not remove it. It is watched in the next stages' benches.
