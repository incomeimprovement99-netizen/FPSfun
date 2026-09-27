# Phase 21: the vertical centre, measured

The brief's section 4 (the owner: "determining the distance between these things is crucial right now"). Every
number here comes from `tools/checks/reach.ts`, which drives the real movement controller with SpeedKills' movement
(A15's sprint, 14 m/s) and writes `src/config/reach.json`. When the movement changes (A17's footage numbers), rerun
it and every module below follows; nothing here is typed in by eye.

## The reach table (2026-09-27, measured)

| Move | Measured |
|---|---|
| Sprint | 13.97 m/s, reached in 1.35 s from standing |
| Jump from a sprint | apex 1.42 m, flat carry 11.35 m |
| Double jump (best timing, 0.75 s after the jump) | apex 1.69 m, carry 22.1 m |
| Slide jump | carry 10.1 m: **less than a sprint jump** at today's tuning |
| Wall run from a sprint jump | 21.0 m along the wall in its full 1.5 s, finishing 1.59 m higher than it began |
| Zig-zag (kick wall to wall) | climbs without end at 2.5 to 4.25 m wide; breaks after 7 crossings at 4.5 m, 1 to 3 from 4.75 m |

Zig-zag by corridor width (height won a crossing, and metres travelled along the corridor a crossing at a sprint,
about 8.8 m):

| Width | Crossings held | Height a crossing |
|---|---|---|
| 2.50 m | unbroken | +1.57 m |
| 3.00 m | unbroken | +1.41 m |
| 3.50 m | unbroken | +1.06 m |
| 4.00 m | unbroken | +0.56 m |
| 4.25 m | unbroken | +0.28 m |
| 4.50 m | 7, then it drops | +0.15 m |
| 4.75 m and wider | 1 to 3 | not a chain |

## The modules, from the table

The brief's rule 1 builds the main path at 0.6 to 0.85 of the widest working width, so imperfect input still makes
it. With the widest reliable zig-zag at 4.25 m:

| Module | Geometry | Why |
|---|---|---|
| **Run gap** (roof to roof) | at most 9.4 m | a sprint jump's 11.35 m with 20% to spare |
| **Double gap** | 12.5 to 19.9 m | wider than a sprint jump by a tenth, inside the double jump's 22.1 m by a tenth: the check must fail it without the double jump and pass it with one |
| **Slide gap** | none | a slide jump carries less than a sprint jump today; the class returns only if the slide is retuned |
| **Chain gap** (needs a wall run) | wider than 22.1 m, a runnable side wall of at least 21 m along it | beyond any jump, inside the wall run's 21 m and the jump off its end |
| **Zig-zag corridor** (flat or rising) | **3.0 m wide** (0.7 of 4.25), wall segments staggered 8.8 m a crossing | each crossing gains 1.41 m, so it rises gently even when flat is the intent: put its floor on a matching ramp, or accept a climb |
| **Chimney** (the owner's chain, climbing) | **3.0 m wide**, 3 crossings climb one storey (4.2 m against a 4 m storey), about 26 m of canyon a storey | the owner's "repeat like 3 times" is exactly one storey at this width; a block is 57 m, so a chimney climbs two storeys along one block's length, or folds with the tap-strafe 180 as its turn |
| **Balcony ladder** | a balcony every storey (4 m) | under the climb's reach (5.1 m, sk-movesim) |

## What is next

1. The window pads and pad ladders, solved by `padSolve` against the solids above each arc.
2. `tools/checks/chains.ts`: every module above run through the real controller, passing at nominal input and
   failing with its key gap widened by a tenth (the brief's proof).
3. The centre's layout by coordinates: the chimneys between the downtown towers (the city's canyons are 3 to 4.5 m
   today, so the 3.0 m chimney fits the existing downtown with no new buildings), one per side of the Spire.
4. The grey-box course in the range, so the owner can play the distances.
