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

## The auto-climb stretches every gap (found by the proofs)

The auto-climb catches a far roof's lip up to 5.1 m below it. So running straight off a roof clears 9.5 m (falling
4 m by the far wall, then climbing), and a single jump clears 16 m the same way. A gap is therefore classed by a
**clean** landing, on the far roof without a climb, which is also the fast one: the climb costs time, and in a fight
it is the moment you cannot shoot.

## Proven (tools/checks/reach.ts, the chains, run by verify)

- **Run gap, 9.46 m:** landed clean with a sprint jump, and not by running off.
- **Double gap, 16.2 m:** landed clean with the double jump, and not with the jump alone.
- **Chimney, 3.0 m:** climbs a 4 m storey in three crossings (1.41 m a crossing); a 5.0 m corridor holds only two.

## The centre as built today, measured (tools/centre-canyons.ts)

THE SPIRE sector has 54 towers. Every canyon between two of them that is 2.5 to 6 m wide and at least 10 m long,
face to face, off the built city:

| Width | Length | Walls to | Where (map-local) |
|---|---|---|---|
| 4.87 m | 14.1 m | 44.1 m | z -79.3 to -74.4, x 73.4 to 87.5 |
| 4.87 m | 15.2 m | 32.1 m | x 68.6 to 73.4, z -94.5 to -79.3 |
| 4.92 m | 13.3 m | 36.1 m | x 71.0 to 75.9, z -16.5 to -3.2 |
| 4.92 m | 18.6 m | 36.1 m | z -3.2 to 1.7, x 75.9 to 94.5 |
| 4.94 m | 13.4 m | 28.1 m | z 73.9 to 78.9, x 55.5 to 68.9 |
| 4.94 m | 15.6 m | 28.1 m | x 68.9 to 73.9, z 78.9 to 94.5 |
| 5.18 m | 16.8 m | 40.1 m | x -10.1 to -4.9, z -65.3 to -48.5 |
| 5.18 m | 21.4 m | 32.1 m | z -70.5 to -65.3, x -4.9 to 16.5 |
| 5.46 m | 20.0 m | 40.1 m | z -2.0 to 3.4, x -68.5 to -48.5 |
| 5.46 m | 21.5 m | 36.1 m | x -74.0 to -68.5, z -23.5 to -2.0 |
| 5.67 m | 14.5 m | 44.1 m | z 73.0 to 78.6, x -87.5 to -73.0 |
| 5.67 m | 15.9 m | 36.1 m | x -73.0 to -67.4, z 78.6 to 94.5 |

**No canyon in the centre takes the chain today.** Every one is wider than the 4.25 m the zig-zag holds (the config's
3 to 4.5 m is not what the built faces measure), and every one is shorter than the 26 m a storey of chimney needs
(three crossings at 8.8 m each).

## The four chimneys (the layout's instruction to city.ts)

One per side of the Spire, in the canyons the city already has, each narrowed to **3.0 m** (one tower's face moved
in) and its shared faces lengthened to **27 m or more**, so three crossings climb one storey and the walls run above
the climb:

| Side | Canyon today | Change | Climbs |
|---|---|---|---|
| North | x -10.1 to -4.9, z -65.3 to -48.5 (5.18 m, 16.8 m, walls to 40.1 m) | narrow to 3.0 m; extend the faces to z -75.5 | the concourse (8 m) to the Sky Lobby deck (about 32 m) in six storeys of chimney, broken by a landing every storey |
| East | x 71.0 to 75.9, z -16.5 to -3.2 (4.92 m, 13.3 m, to 36.1 m) | narrow to 3.0 m; extend to z -30.5 | the same |
| South | x 68.9 to 73.9, z 78.9 to 94.5 (4.94 m, 15.6 m, to 28.1 m) | narrow to 3.0 m; extend inward to z 67.5 | the concourse to the lower crowns |
| West | x -74.0 to -68.5, z -23.5 to -2.0 (5.46 m, 21.5 m, to 36.1 m) | narrow to 3.0 m; extend to z -29 | the concourse to the Sky Lobby |

A landing (a 2 m ledge at each storey) breaks each chimney into storeys the owner's chain climbs one at a time,
with the tap-strafe 180 turning back into the next, as the brief's rule 5 folds a chain that would otherwise need
100 m of alley. Each is proven like the 3.0 m chimney above once city.ts builds it.

## The four chimneys, built and proven (city.json chimneys, tools/checks/sk-chimneys.ts)

Built as two walls 3.0 m apart and 27 m long in each of the four canyons above (the towers do not move), closed at
the far end, standing on the centre's podium roof at 8.2 m (at the street the canyons are inside the podium, which
the first proof found by being pushed out of it). What the proof found on the way:

- **An open end loses the chain:** a chain that comes in high flies out of the far end; closing it drops the player
  onto the landing.
- **One storey is too easy to mean anything:** one wall run and a double jump, no kicks, reach 4.6 m above the
  floor, so a landing a storey up (4.2 m) is reached without the chain.
- **So the landing is at 5.5 m:** above what one wall run reaches, inside what the kicks reach in 27 m (6.5 m and
  more). In all four, the chain lands it by wall runs and kicks alone, with no climb and no touch of the floor, and
  the same runs without the kicks top out 3.1 m above the floor.

**The second leg, proven too:** turning on the landing (the owner's tap-strafe 180), the chain climbs on to the top
at the near end, 11 m above the floor, in all four; the near end is closed above the landing so a chain arriving
high there drops onto the top, and stays open below it as the way in. So each chimney is the owner's chain folded
once: kicks up one leg, a turn, kicks up the other, two landings in 27 m of canyon.

## What is next

1. The window pads and pad ladders, solved by `padSolve` against the solids above each arc.
2. The rest of the modules proven the same way (window pad, pad ladder, balcony ladder, tap-strafe gate).
3. The centre's layout by coordinates: the chimneys between the downtown towers (the city's canyons are 3 to 4.5 m
   today, so the 3.0 m chimney fits the existing downtown with no new buildings), one per side of the Spire.
4. ~~The grey-box course in the range~~ done: THE CHAIN, below.

## THE CHAIN: the grey-box in the range (courses/chain.ts, tools/checks/sk-chaincourse.ts)

SpeedKills' third course, through a gate in the middle of the range's back wall (legacy's wall stays whole). Every
width is worked out from `src/config/reach.json` when the course loads (`src/config/chaincourse.json` says how), so a
retune of the movement moves them, and the check proves them again on the course's own colliders.

| Room | Width | Landed clean with | And not with |
|---|---|---|---|
| Run gap | 9.46 m (a sprint jump's 11.35 over 1.2) | a sprint jump | running off |
| Double gap | 16.2 m | the double jump | one jump (reaches 10.5 m of it) |
| Wall gap | 27.75 m (past the double jump by a tenth, inside the kick by a tenth) | a wall run along the lit wall and a kick late in it | the run alone (22.4 m of it), a double jump in the open (20.3 m) |
| Chimney | city.json's: 3.0 m, 27 m, landing 5.5 m, top 11 m | kicks alone, a turn on the landing, kicks to the top | no kicks (3.1 m high at best) |

**A new measurement for the wall gap** (`reach.ts`, `reach.json` wallKick): a sprint jump into a wall run carries
24.35 m if you run off its end, and 34.6 m if you kick off it 1.45 s in (32.2 m at 1.2 s, so the timing is not tight).
The kick is what crosses a gap past the double jump.

Each gap room is climbed into: a 3 m deck (a climb), 12 m to reach full sprint, the pit (a fall below 2.5 m over it
restarts the room with 2 s added), a 6 m deck to land on, and down to the floor for the next door, because the
course's doors are 3.3 m from the floor. From the chimney's top, a hop over its wall's cap reaches the deck beside it,
and a zip goes down to the finish. The ranks (S 35 s) are provisional until the owner sets real times.

Not in it yet: the window pad and the pad ladder. The range has no pads (they are the battle royale's, `brplay.ts`),
so the pad's code has to come to the course engine first.
