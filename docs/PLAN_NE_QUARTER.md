# The north-east quarter rebuilt for 14 m/s: the trial

Written 2026-11-13 by the map agent. Step 3 of docs/PLAN_MAP_TO_8.md: one quarter of the inner ring rebuilt for how
SpeedKills moves, measured against the other three, before anything is rolled out. The owner's word the same day: act on
the recommendations without asking. This is the plan the proposal agents build from and the record of what was meant.

## 1. The quarter as it stands (version 145)

The inner ring's north-east quarter is x 0 to 100, z -100 to 0, outside the centre sector (north is -z, east is +x):
the north-east corner block (NOODLE ROW), the east half of the north High City block, the north half of the east one,
the two spoke streets from the Loop to the ring road, and the ring road's corner.

What stands in it, read off the collision (`node %TEMP%/neon/roofgrid.cjs`, `plan.cjs`):

| What | Where (x, z) | Height |
|---|---|---|
| The bridge ring, an L of 5 m decks, fenced | z -65 to -60 from x 20 to 65; x 60 to 65 from z -60 to -15 | 26.9 m |
| North High City block's roof | x -27 to 27, z -82 to -58 | 26 to 28 m |
| East High City block's roof | x 58 to 82, z -28 to 28 | 26 to 28 m |
| Roof A (a walk-in building, floors at 3.5, 7 and 10.5) | x 52 to 63, z -81 to -72 | 11 to 13 m |
| Roof B (the block's biggest), kerbs and boxes all over it | x 67 to 88, z -86 to -66 | 11 m, features to 19 |
| Roof C | x 67 to 78, z -60 to -49 | 11 to 12.5 m |
| Roof D | x 79 to 86, z -60 to -49 | 7 m |
| A low building turned 45 degrees | x 46 to 56, z -58 to -47 | 7 m |
| The north spoke street | from the Loop by (41, -64) to the ring road | street |
| The east spoke street | from the Loop by (64, -41) to the ring road | street |

Its numbers (`tools/neon-mapstats.cjs`, `innerRingByQuarter`; the lines by `tools/neon-lines.ts`):

| Measure | North-east now | The other three | The trial's aim |
|---|---|---|---|
| Open street / street under a roof | 60% / 10% | 58 to 62% / 6 to 9% | 50% / 20% |
| Street spots open and seen by 40 high spots or more, of all street spots | 68% | 59 to 70% | 50% or less |
| Mean free run from a street spot, median | 10.7 m | 10.1 to 11.4 m | 14 m or more |
| Open roof between 12 and 20 m | 175 m2 | 72 to 265 m2 | 500 m2 or more |
| Roof islands with no leap to another | 2 of 6 | 1 to 4 | none |
| Wall to run along | 75 m | 90 to 151 m | 150 m or more, 40 m of it on lines |
| The three roofs A, B, C, 30 m | 5.9 s | | 3.5 s or less |
| The street to a 27 m block's roof with no pad, by the span | no way | no way | two lines, inside 18 s each |
| A spoke street sprinted from the Loop to the ring road | stops twice on cover | | inside 4.5 s, both spokes |

## 2. What a body can do

From `src/config/movement.speedkills.json` (hammer units, 0.0254 m): a sprint of 14.0 m/s; a jump 1.42 m high and a
second in the air 1.32 m; a mantle onto anything up to 2.29 m; a climb, by running at a wall, to 5.6 m over where the
feet last stood; a wall run at 15.7 m/s, up to 20 with speed brought to it, for 3 seconds, level, with a kick off it
that adds speed. A level leap carries about 11 m, with the second jump about 20. Climbing needs a wall's face: a deck's
edge on columns gives a body nothing to climb.

## 3. The five changes

Each has a measure and, where it is a route, a movement line that must run.

1. **The middle tier and the way up: the span lowered, stepped and broken** (amended 2026-11-13 from the two layout
   reviews, docs/LAYOUT_REVIEW.md: each put it first). Between the 12 m roofs and the 27 m ring there is nothing, and the
   ring's span here is a catwalk that watches both spokes with no counter from the street. The span's decks come down to
   16 m and are the middle tier: two gaps of 10 m where the spokes pass under, a leap each; steps of 3.6 m up to each
   block's roof at its two ends, a solid riser under each; solid steps on roofs A, B and C's edges where a route comes up
   to it (a deck's slab with air under it cannot be climbed); piers under the pieces that stand free. Tried on the
   collision before anything was built: each gap leapt in 2.3 s, roof A across to the span in 1.3 s. Measure: roof
   between 12 and 20 m; a line from the street to the north block's roof and one to the east block's, by the span, with
   no pad.
2. **Walls to run.** Flat walls 6 m tall and more, 15 m long and more, with a clear lane beside them, where a run
   crosses a gap a leap cannot: from roof C over the east spoke to the east block's face, from roof A over the north
   spoke toward the north block's, and one at street level along a spoke. The pack's city wall (0.3 by 7 by 10 m, drawn
   already) worn as a hoarding. Measure: two lines with 15 m or more on a wall each.
3. **The roofs cleaned.** Roofs A, B and C keep a clear lane 2 m wide along the line across them: their kerbs and boxes
   moved off it or dropped. Measure: the three roofs inside 3.5 s.
4. **Cover overhead and at the edge.** Canopies and arcades at 4 to 5 m over the spokes' pavements and along the High
   City blocks' feet, so a rotation is not watched from every roof; and a solid parapet 1.9 m tall with a 1.5 m gap in
   each 5 m on the two blocks' roof edges that face the quarter (amended: it was the span's, and the span lowered does
   not change how many high spots see the streets; the blocks' roofs are the watchers that count). Measure: the street
   open and seen by forty high spots or more, of all street spots, 50% or less.
5. **The lanes.** Each spoke's carriageway clear down its middle from the Loop to the ring road; the small cover on it
   gathered into fewer pieces 2.5 to 3 m tall at the pavements' edges, with head-high cover still within reach of every
   open spot. Measure: each spoke sprinted inside 4.5 s; the mean free run 14 m or more.

## 4. How it is built and judged

1. Three proposal agents measure and write patches on version 145's snapshot (routes: changes 1 to 3; overhead: change
   4; lanes: change 5). None bakes. Each proves what it can before a bake: lines run on the collision with its own
   boxes added, the quarter's numbers on the same.
2. The map agent applies them one at a time, lays and bakes version 146, and runs every check.
3. The quarter is measured again and photographed from the same ten spots (`%TEMP%/neon/ne-survey.json`), by day and
   by night, and read against the other three quarters.
4. What holds is rolled out to the other quarters; what does not is changed here first.

## 5. Not in the trial

The districts past the ring road, the centre sector, the match's ending, the High City blocks' heights (step 6 of the
plan), the bots' use of the roofs.
