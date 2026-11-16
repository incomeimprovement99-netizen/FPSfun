# The roll-out: the other three quarters, and the north-east brought up (version 147)

Written 2026-11-16 by the map agent. Step 4 of docs/PLAN_MAP_TO_8.md. The north-east quarter was rebuilt as version 146
(docs/PLAN_NE_QUARTER.md) and judged by two fresh layout reviewers (docs/LAYOUT_REVIEW.md, round 2): 5.5 for the quarter
against 4.5 for the map, "better by about a point", to be rolled out changed first. Both forecast 5.5 for the map with
all four quarters as the north-east is, and 7 with the changes below and the ending mended.

## 1. What is kept from the north-east

The span between two High City blocks lowered to about 16 m, stepped up to each block and broken where the streets pass
under; a way from the street to both blocks' roofs with no pad; the roofs cleared along a line; both spoke streets'
carriageways clear kerb to kerb with sets of 3 m panels at their sides; canopies at 4.5 m over the pavements.

## 2. What changes, in every quarter (the north-east too)

1. **Cover over the fast path.** "The pavement canopies cover the slow path, not the fast one." Two or three decks across
   each spoke street at 8 to 10 m, 5 m and more wide, a leap apart from a roof or from each other, so a sprint down the
   carriageway passes under cover every 20 to 25 m and the decks are themselves a route. Canopies on both pavements.
   Measure: the street open and seen by forty high spots or more, of all street spots, 50% or less (59% in the
   north-east now, 58 to 69% in the others).
2. **The middle tier doubled.** 1,000 m2 and more of open roof between 12 and 20 m in each quarter (521 in the
   north-east now): the cross-street decks count only where they stand in that band, so this is more: a second stepped
   piece, a roof raised, a terrace on a block's outer face.
3. **Walls as a route.** Walls 35 m and more in all, in a chain of two or three that a run goes along and that ends on
   a roof, not one 20 m set piece. Measure: a line with 30 m and more on walls.
4. **Each quarter broken its own way.** The four spans do not play alike: where the gaps are, which end steps and which
   drops, where the way up starts. The north-west and south-east spans are cut already (rules.bridges.gaps, with pads).
5. **A lane that bends.** The carriageway stays clear to sprint, with one tall blocker (5 to 6 m) every 35 to 40 m set
   off the middle line so the line of sight down it breaks and the run does not stop.

## 3. Each quarter's aims (tools/neon-mapstats.cjs innerRingByQuarter; tools/neon-lines.ts)

| Measure | Aim |
|---|---|
| Street to each of its two blocks' roofs with no pad | a line each, inside 18 s |
| A roof line across three roofs | 30 m inside 3.5 s |
| Each spoke sprinted from the Loop to the ring road | inside 4.5 s |
| Mean free run from a street spot, median | 14 m or more |
| Open roof between 12 and 20 m | 1,000 m2 or more |
| Street open and seen by forty high spots or more, of all street | 50% or less |
| Walls on one line | 30 m or more |

## 4. How it is built and judged

Four proposal agents on version 146's snapshot, one a quarter, each owning everything in its quarter and using the rules
the north-east added (rules.bridges.tops and open, rules.routes rows and boxes, rules.overhead13 modules,
rules.dress.lanes streets, quadrants and sets, rules.lines). Applied one at a time, baked as version 147, measured by
quarter, photographed, and sent to a third layout review. Then the ending (zones on three heights, the hold, the tower
closed late) and what both reviewers named beside it: GLASS HEIGHTS' spine, the east block's bridge to the tower.
