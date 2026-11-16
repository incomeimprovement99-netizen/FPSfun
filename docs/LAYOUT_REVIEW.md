# Layout reviews: the Neon City map judged for play

A layout review is the second measure docs/PLAN_MAP_TO_8.md asked for (step 2): fresh reviewers who are given no
screenshots to score, only the measured maps (heights with every way up, exposure, free runs, roof islands), the numbers
off the collision, the movement and the match's rules, and who answer a level designer's questions: lanes and loops, power
positions and their counters, the ground, the roofs, rotations, the ending, what is the wrong size at 14 m/s, where a
squad lands, and the ten changes with the most leverage. The pack is rebuilt by `%TEMP%/neon/layoutmap.cjs`; the brief is
`%TEMP%/neon/layout1/BRIEF.md`.

## Round 1 (2026-11-13, on version 145)

Two reviewers, A and B, neither told of the other or of any plan. Their reviews in full: `%TEMP%/neon/layout1/review-A.md`
and `review-B.md`.

| | A | B |
|---|---|---|
| Flow | 4 | 4 |
| Verticality | 5 | 5 |
| Cover | 3 | 3 |
| How readable the routes are | 6 | 6 |
| Variety of fights | 4 | 4 |
| The ending | 5 | 4 |
| Overall for play | 4.5 | 4 |

The picture reviews of the same version gave the centre 6.4 and the districts 6.3. The gap between 6.4 and 4 is what
the pictures could not see.

**What both said, each without the other:**

- **The 27 m bridge ring is the map's fault line.** One catwalk 131 m square that watches every way in, with no counter
  from the street: the deck hides whoever stands on it. Both put changing it first: A, its spans lowered to 15 m with the
  blocks kept at 27; B, each side broken in three with gaps of 9 to 16 m and alternate pieces at 18 m.
- **The street cover stops the runner, not the bullet.** "The 1,360 pieces stop sprints, not bullets" (A); "cover to
  2.6 m stops the runner, not the bullet from 27 m" (B). A shooter at 27 m, 30 m off, looks down at 42 degrees: a 2 m
  prop shadows 2 m of ground. Both: clear the middles of the streets, move the props to the kerbs under canopies, and on
  the open decks swap props for walls 4 to 6 m tall and 10 to 30 m long, which break lines from above and can be run.
- **The roofs are neither islands nor a route.** Three plates that are walked and 96 crumbs, 44 of them dead ends; the
  one measured roof route runs at 5 m/s. Both want a middle tier of 5,000 to 7,000 m2 at 14 to 18 m in pieces 8 to 18 m
  apart, and the roofs' kerbs stripped.
- **The ending.** The centre is the best ground on the map (layered, sheltered, a true loop), but the tower holds the
  vault, is never deleted and is the high ground, so the best drop never moves; the 45 s hold is long against a kill
  under a second; the centre has 22 m of wall to run. Both: a hold of 20 to 25 s, the tower's upper floors closed at the
  last wave, the zone on one of three levels or hopping round them.
- **The wave is never the threat.** A sector is 7 s wide and the grace 60 s; only watchers kill. The north and the west
  have no covered way in (the underground serves the centre, the south and the east).
- **Landing.** The tower, always. Nobody would drop THE TERRACES, THE STRIP, THE CANYON, THE TERMINAL or the capsule
  hotel: no way up, no way in, or nothing to hold.
- **Sizes.** The ring road's legs are 24 m wide where a wall kick wants under 11; a full wall run is 47 m and the inner
  ring holds nine such walls, the centre half of one; the best wall-run shape on the map, THE CANYON's 9 m slot, is in a
  corner.

**One each:** A, a 2 m step beside every 6 to 8 m eave, so a mantle and a climb replace the pad (the low roofs start
0.4 m over the 5.6 m climb); underground mouths north and west; the vault's key spawned at an edge landmark. B, zips
inward and two-way from the corner blocks up to the High City; THE CANYON's plate cut into four roofs; six of THE WORKS'
pads moved to the places nobody drops.

**What is taken up, and where:**

| Change | Where it goes |
|---|---|
| The bridge ring's spans lowered and broken | The north-east quarter's trial (docs/PLAN_NE_QUARTER.md, amended the same day), then the other three spans |
| The streets' middles cleared, props to the kerbs under canopies | The trial's lanes and overhead changes |
| Roofs' kerbs stripped, a clear lane across | The trial, roofs A, B, C |
| Walls to run, 15 m and more | The trial |
| A step beside low eaves | To try in the trial where a route needs it; a rule for every low roof after |
| The middle tier's other pieces (the corner kiosks raised, a roof 10 m off the ring in each corner block) | After the trial is measured |
| Tall walls on the open decks, the ring road's legs made two streets | With the roll-out (step 4) |
| The ending's rule: hold, the tower closed late, the zone's level | Not the map's alone: the match's rules (docs/PLAN_MAP_TO_8.md step 5) |
| Zips inward, the vault's key, underground mouths, THE CANYON's plate cut | Listed for after the roll-out |

**What the numbers say about the first change** (tools/neon-mapstats.cjs on the snapshot's collision with the span's
decks moved): the span lowered to 16 m, stepped and broken adds 288 m2 of roof between 12 and 20 m to the quarter, and
does not lower how many high spots see its streets (79% of open spots seen by forty or more before, 83% after; 90% seen
by ten or more from 20 m up, before and after). The watchers that count are the two blocks' roofs, hundreds of spots
against the span's eighteen. So the span's change is for routes and for a position with a counter, and the blocks' own
edges need the parapet.

## Round 2 (2026-11-16, on version 146: the north-east quarter rebuilt)

Two new reviewers, C and D, given the same pack on version 146 and, beside it, the rebuilt quarter's numbers against the
other three and the question whether to roll it out. Reviews in full: `%TEMP%/neon/layout2/review-C.md`, `review-D.md`.

| | Whole map, C | Whole map, D | North-east alone, C | North-east alone, D |
|---|---|---|---|---|
| Flow | 5 | 4 | 7 | 6 |
| Verticality | 5 | 5 | 6 | 6 |
| Cover | 3 | 3 | 4 | 4 |
| How readable the routes are | 6 | 4 | 7 | 6 |
| Variety of fights | 4 | 4 | 6 | 5 |
| The ending | 4 | 4 | 5 | 4 |
| Overall for play | 4.5 | 4.5 | 5.5 | 5.5 |

Round 1 gave the whole map 4.5 and 4. Both forecast 5.5 overall with all four quarters as the north-east is, and 7 with
their changes and the ending mended.

**The trial, both:** better by about a point, and to be rolled out changed first.

- **Flow is mended, being seen is not.** The free run is up 40% and the roofs run at 9 m/s, but 75% of the quarter's open
  street is still seen by forty high spots or more. The carriageways were cleared and the canopies put over the
  pavements: "the pavement canopies cover the slow path, not the fast one" (C); "a 60 m bare lane crossed in 4.3 s under
  two 27 m roofs" (D). Both: cover over the fast path. C, two or three decks at 8 to 10 m across each street; D, canopies
  continuous on both pavements and a 6 m blocker every 35 to 40 m, offset so the lane bends and does not stop.
- **The middle tier is a sixth of what the quarter needs** (C); double it (D). D: lower the blocks' own outer lobes to 16
  to 20 m, not only the span.
- **The two walls are set pieces, not a route** (C): chain four or five into a line that ends on a roof. D: 20 m is 1.3 s
  of a 3 s run; build 35 to 45 m.
- **Break each quarter differently** (C), so the four do not play alike.

**New in this round, both:** GLASS HEIGHTS' 27 m spine into High City N is a free rotation with no counter, and the north
squad walks in above everyone while the south squad crosses the worst ground on the map; the 27 m bridge from High City E
to the tower should be broken; the ending wants zones on three heights, a hold of 25 to 30 s paused while contested, the
tower closed above 12 m at the last wave, and walls round the plaza.

**Taken up:** docs/PLAN_ROLLOUT.md (version 147): the other three quarters as the north-east with these changes, and the
north-east brought up to them.



## A correction to rounds 1 and 2: where the match ends

Both rounds' briefs told the reviewers that every match ends in the centre sector. That was the map agent's misreading.
The final sector is the centre with odds of a half and otherwise one of the eight outer sectors at random (decay.json
`finalCentre`, decay.ts), and two squads in the zone at once already stop it filling. So what all four said of the ending
(the tower holds the vault and the height and is never deleted; the same fight every match; end it in other sectors too;
pause the hold while contested) holds for half the matches, is already so for the other half, and the pause is the rule
today. What stands untouched: the hold is long against a kill under a second, the centre has 22 m of wall to run, and its
zone is on one level. Round 3's brief states the rule as it is and asks about the outer endings.
