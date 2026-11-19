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

A second slip in the same paragraph of both briefs: the zone was given as "14 m across". It is 14 m in radius, 28 m
across (decay.json `capture.radius`), and it counts a body at any height over the circle (brmatch.ts updateCapture reads
x and z only), so "the zone on one level" means one circle in plan, roof and street alike. Round 3's brief says so.

## Round 3 (2026-11-18, on version 147: the whole inner ring rebuilt, each quarter its own way)

Two new reviewers, E and F, neither told of the other, the plan or the earlier scores, given the pack rebuilt on version
147 (`%TEMP%/neon/layout3/`: the brief with the ending's rule as it is, the four measured maps, each quarter from the tower
and from one of its spokes, the numbers by quarter). Both measured the maps' pixels rather than reading them by eye.
Reviews in full: `%TEMP%/neon/layout3/review-E.md`, `review-F.md`.

| | E | F |
|---|---|---|
| Flow | 6 | 6 |
| Verticality | 6 | 6 |
| Cover | 4 | 4 |
| How readable the routes are | 6 | 6.5 |
| Variety of fights | 5 | 6 |
| The ending | 3 | 3.5 |
| Overall for play | 5 | 5 |
| North-east / north-west / south-east / south-west | 6 / 4.5 / 5.5 / 5 | 6 / 4.5 / 6.5 / 5 |

Round 2 gave the whole map 4.5 and 4.5 and forecast 5.5 for the roll-out as it stood: it came in at 5, with flow and
verticality up from 4 and 5 to 6 and the ending down. Both forecast 6.5 with their top three changes. One slip in the
brief: its quarter table put version 146's numbers in brackets, but its islands row's brackets are the islands with no
leap; both read it so.

**What both said, each without the other:**

- **Every outer ending opens on the ring road.** The outer sectors' middles are at x or z = 100, the ring road's outer
  edge (it runs 90 to 100 m out), so each 28 m circle is half bare asphalt under the 27 m blocks. Seen by forty high
  spots or more, of each circle (E / F): S 95 / 100%, NW 91 / 100, W 84 / 100, E 80 / 93, N 79 / 93, NE 67 / 78, SW
  23 / 41, SE 22 / 29. The worst S (bare road under High City S's rim), W and NW (a bare crossroads by a tower nobody
  climbs); SE (THE WORKS) and SW (THE CANYON's corner) play. Both first: open each outer zone at a chosen spot 20 to 25 m
  into its district (GLASS HEIGHTS' court, THE TERMINAL, THE TERRACES, THE STRIP, LANTERN ALLEYS, THE CANYON's junction),
  keep the south-east's.
- **"Any height" spoils the centre's.** Half the centre's circle is the tower's footprint, and the tower's top (60 m
  and more, reached only by its two express ropes) is inside it with no counter. Both second: count a body only up to a
  height (E 13 m, F 20 m). E also: the zone on the podium east of the tower, 20 m across the radius, a body contesting
  only after 2 s in, a 35 s hold.
- **The ring road is a moat:** 78 to 95% seen from forty high spots, 30 to 38 m of bare road, one roof crossing (the
  6 m neck from GLASS HEIGHTS to High City N). Both: decks at 9 to 12 m across it.
- **The middle tier is in the right ring and nowhere else**: none in the outer band or the centre (the centre jumps from
  the 6 to 12 m podium to the 30 to 60 m base), so no ending has one; F: every piece of it sits under a 27 m rim within
  30 m, a step below the top more than a tier of its own. The centre has 22 m of wall to run; both: run walls and a
  ledge or balcony ring on the tower at 12 to 35 m.
- **The quarters differ in detail and look alike from the tower.** North-east best or near it (its spokes 36 to 66%
  roofed); south-east the most middle tier; north-west worst (78% of its street seen by forty or more, both ways up with
  no pad start in one alley, its 19.7 m high leg owns the west spoke); MARKET's west spoke the barest on the map (53 to
  64% seen by forty or more).
- **The 5 and 10 m span gaps sit under the 11 m level leap** (E): they cost nothing; only MARKET's 15 m gap is a
  decision.

**One each:** E, a second way into MOTEL HILL's alley and a 12 m deck half way down the north-west's west spoke; two
decks over MARKET's west spoke; leaps to the south-east's six dead islands; THE CANYON a cache, a rope and a zip to
MARKET. F, ways up in the west and north-west outer band (THE STACKS, CAPSULE HOTEL, THE TERRACES have no pad, rope or
fire escape) and THE STRIP; one clear sprint lane and roof route in each outer district; two-level ending sites for W
and NW; THE CANYON's plate broken; a second 27 m bridge into the tower, from High City W.

**Taken up:** see the correction below: the first answers on the endings measured the wrong spots.

### A correction to round 3: where the zones open, and the scores asked again

Round 3's brief said the capture zone opens "at its middle", and both reviewers took the sector's rectangle: x or z = 100,
the ring road. It opens at the sector's own `middle` (neonmap.json game.sectors, decay.ts centreOf): the centre's at
(0, -22) on the tower's base north of the tower, the four edge sectors' on the High City blocks themselves at 72 m, the
four corners' on the corner blocks at (72, 72) and its mirrors. The map agent checked E's claim against the rectangles too
and repeated it. The brief now says so, with a table of what each 14 m circle holds and the nine circles drawn on the map,
and E and F answered questions 5, 6, 10 and 11 again (their reviews' addenda).

| | E | F |
|---|---|---|
| The ending, asked again (first answer) | 6 (3) | 5.5 (3.5) |
| Overall for play, asked again (first answer) | 5.5 (5) | 5.5 (5) |
| By ending | corners 7, centre 6, edges 4 | ne 7, nw 7, c 6.5, se 6.5, sw 6, n s e w 4 to 5 |

Both forecast 6.5 with their new top three. Gone from the first answers: the zones on the ring road and every number
measured there, and the changes that moved them. Standing: the ring road as ground (78 to 95% seen by forty high spots
or more, one roof crossing), the centre's 22 m of wall, and the quarters' scores.

**What both say now:**

- **The corners are the best endings on the map**: two tiers at 6 to 12 and 12 to 20 m, a third of their street roofed,
  3 to 15% of it seen by forty or more. The batch 14 rebuild made them. Keep them as they are.
- **The four edge endings are one flat-roof standoff four times**: each zone is a High City block's 27 m roof over two
  thirds of its circle, bare, the highest point in its sector, its holder seeing every pad, rope and stack that lands on
  it. Worst e and s, whose circles hang over the street at the block's foot (24 and 19% of them), so a squad 27 m below
  by the pads at (85, 0) and (0, 85) freezes the roof's meter; w, all of its street seen by forty or more and nothing
  landing inside it. Both: structures about 3 m tall inside each roof zone with the ways up landing behind them, and a
  second way up onto the roof.
- **The centre is a real layered fight** (the court under a 6 to 12 m deck, no street seen by forty) **spoiled by the
  tower**: the circle reaches 2 m inside the tower's north wall, and the tower has a floor every 3 m to 110 m, so a body
  in a north room at any height counts (measured by the map agent: tops at 14 to 110 m inside the circle). Both: count a
  body only up to a height (E 13 m at the centre, F 30 m everywhere), and cover and walls to run on the bare deck.
- **The rule:** E, a body contests only after 2 s inside, so a sprint through freezes nothing; F, a contested meter
  drains slowly. Both keep the 45 s; E a radius of 18 m for the edges, F 14.

**Taken up:** docs/PLAN_ENDINGS.md.

## Round 4 (2026-11-19, on version 148: the endings' ground)

Two new reviewers, G and H, neither told of the other, the plan or the earlier scores, given the pack rebuilt on version
148 with the zones' rule as the code has it (each zone its own heights, a body counted after 2 s in it), the nine zones
drawn and measured, and pictures from inside each High City roof's zone, the centre's deck and two of the ring road's
decks (`%TEMP%/neon/layout4/`). Reviews in full: `review-G.md`, `review-H.md`.

| | G | H |
|---|---|---|
| Flow | 5 | 6 |
| Verticality | 6.5 | 7 |
| Cover | 4 | 4 |
| How readable the routes are | 5 | 6 |
| Variety of fights | 6 | 6 |
| The ending | 5 (corners 6.5, edges 4.5, centre 4.5) | 5 (corners 6 to 7) |
| Overall for play | 5.5 | 5.5 |
| North-east / north-west / south-east / south-west | 6.5 / 5 / 5.5 / 5.5 | 6 / 4.5 / 5.5 / 5.5 |

Round 3, asked again with the zones where they open, gave 5.5 and 5.5: batch 15 held the score and moved where the asks
are. Both forecast 6.5 with their top three.

**What both said, each without the other:**

- **The centre's ending is watched from above by what it does not count.** The zone's circle reaches the base's annex (30
  to 60 m) and lies 9 m off the tower's north face, whose floors to 110 m look straight down on the deck; the 2.4 m panels
  give no cover from above, so the hold moves under the deck and into the court, three counted floors with no sight
  between them, and the meter freezes. G: a lid at about 16 m over the deck's north half and the tower's and annex's
  openings toward the deck shut from 13 to 40 m; H: the tower above 20 m decays when the centre's zone opens.
- **A contest freezes the meter and nothing makes it end.** G: the squad with more settled bodies in the zone ticks at
  half rate, and a 30 s hold; H: after 8 s of contest every body in the zone is shown to everyone in it.
- **The four edge zones are still one fight.** A flat 27 m roof with four 3 m pieces in a 616 m2 circle, climbed up to by
  attackers into a defender who has the height; N the best (the level walk from GLASS HEIGHTS), W the worst (86% of its
  circle bare roof, nothing landing in it from the street side), then E (a quarter of its circle street, its pad throwing
  climbers into view). Both: a raised platform at 31 to 33 m and a lower level at 24 m on each roof (G the block's top
  floor opened as a counted room, H a sunken court), each roof laid out its own way.
- **Walls to run where half the matches end**: the centre sector has 22 m of them. G two 4 m walls; H 4 m walls on the
  backs of the Loop's kiosks chained onto the deck at (0, -36), and a 15 to 18 m tier on the base.
- **The ring road**: G arcades at 4.5 m on the south and west legs' pavements and walls down their middles; H roofs at
  4.5 m over its north leg and south-west corner. The four new decks are routes over it, not cover on it.
- **The corners are the best endings** (6 to 7), the north-west the worst quarter (78% of its street seen by forty high
  spots or more), 47 of the 137 roof islands dead ends (6 of the south-east's 15), the outer band's roof routes still at
  5 m/s, and THE TERRACES and the CAPSULE HOTEL nowhere anyone would drop.

**One each:** G, THE WORKS' ten pads thinned to six with four moved to the west and east bands; a counted 25 m stall tower
in MARKET's zone, or THE CANYON's facing edge lowered a storey, since its 27 m plate overlooks the zone uncounted. H, a
hoarding to slide under and an offset kiosk half way down each spoke, so the sprint stays and the straight sightline from
the Loop does not; corner zones counted only up to 20 m (THE WELL's underground counts at any height).

**Taken up:** batch 16 (docs/PLAN_ENDINGS.md part C), after the picture round on the same version.
