# The Neon City: what it lacks, and how it gets to 7, then 8

Written 2026-11-08 by the map agent, from nineteen rounds of fresh reviews (the centre) and thirteen (the districts), the
last of them on map version 138, and from what version 139 carries. This page is the gap list: every area of the map, what
the reviewers keep naming there, what is actually there now and why it reads the way it does, how it gets fixed, and in
what order. The step-by-step procedures live in docs/PLAN_MAP_RUNBOOK.md; the review record in docs/CENTRE_REVIEW.md.

## 1. How to read this

**Who scores.** Each round, two fresh reviewers score the centre and two score the districts, each seeing only the
pictures and a short brief, never our notes or earlier scores. Their scale is fixed: "a 10 is a shipped AAA map, a 5 is a
competent prototype". Six sub-scores: visual, readability, flow, play-style, finish and fun.

**The bar.** 7 for the centre and 7 for the districts, from both reviewers in one round, with every district 6 or over.
When that is met the bar becomes **8**, with every district 7 or over and finish 7 or over (the owner, 2026-11-05).

**The tags on each item.** **v139** is built in the version shipping now. **Batch 7** and **Batch 8** are the next two
batches (section 6). **Owner** means a decision that is yours. **Renderer** means the lighting code, which belongs to the
lobby agent's worktree.

**Effort.** S is under an hour of work and one bake. M is a few hours or a proposal agent. L is a proposal agent and more
than one round of pictures.

## 2. Where it stands

| Round (version) | Centre | Districts | What held it |
|---|---|---|---|
| 8 (96) | 5.5 | 5.0 | finish 4 |
| 12 (114) | 5.5 | 5.5 | finish 4.5, play-style 5 |
| 14 (127) | 6.5, 6.5 | 5.8, 5.8 | finish 5, flow 5.5 |
| 16 (132) | 6.0, 6.0 | 6.1, 6.1 | finish 5 to 5.5 |
| 17 (133) | 6.0, 6.0 | 6.2, 6.2 | finish 5, the ground smeared |
| 18 (134) | 6.0, 6.0 | 6.2, 6.2 | finish 5 to 5.5, the roads' blotches |
| 19 (138) | 6.0, 6.0 | 6.2, 6.2 | finish 5 to 5.5, play-style 6 |
| 20 (139) | 6.0, 6.0 | 6.2, 6.3 | finish 5 to 5.6, flow 5.9 to 7 |
| 21 (140) | 6.2, 6.3 | 6.4, 6.3 | finish 5.5 to 5.8, flow 5.8 to 6 in the districts |
| 22 (141) | 6.3, 6.3 | 6.2, 6.4 | finish 5.5 to 5.8, flow 5.7 to 6 in the districts; the new ceilings and frames |

Round 19's districts, one by one (reviewer A, reviewer B): LANTERN ALLEYS 6.5, 6.6; THE TERRACES 6.0, 5.9; THE TERMINAL
7.0, 6.3; THE STACKS 6.0, 6.0; GLASS HEIGHTS 5.5, 6.0; THE STRIP 6.5, 6.8; THE CANYON 6.5, 6.3; THE WORKS 6.5, 6.4.

Round 20's (2026-11-08, version 139): LANTERN ALLEYS 6.5, 6.5; THE TERRACES 6.0, 6.3; THE TERMINAL 7.0, 6.8; THE STACKS
5.9, 6.2; GLASS HEIGHTS 6.2, 5.8; THE STRIP 6.8, 7.0; THE CANYON 6.7, 6.7; THE WORKS 6.4, 6.4. Version 139's work was read
(the carriageway cover gone from the asks, the strongroom "gold and costly inside", the pack's low buildings past the fence)
and each brought its next fault: the strongroom's racks outside it too, its gold flat orange paint, the white towers behind
the low buildings. Batch 7 (version 140) answers the first two; the rest of round 20's new asks are in section 6.2.

**The pattern, plainly.** Every fault a reviewer names gets fixed, and the next round names that fix as seen. The road
blotches that every reviewer named for two rounds were named by none in round 19, for example. But the centre has held 6.0
for six rounds, because the small fixes are replaced by new small faults of the same size. What moves a score now is
structural: places to fight in, ways up and across, interiors worth entering, and the landmarks paying off. Finish (5 to
5.5) trails everything, so at 8 it will need its own share of each batch.

**The two constraints that shape every fix.**
- **Draws.** The centre's file is at 219 of its 220-primitive ceiling at the max size. Any new material in the centre costs
  one; a material the map already draws costs nothing. So paving, stains or new glass are done by reusing materials that
  are already drawn, or by freeing a primitive first (Milestone 1071 freed one by moving a pane onto an existing advert).
- **The pack.** Everything is built from Daelonik's Neon City bundle (your rule). It has no traffic cones, road barriers,
  fountains or furniture sets, so those asks get the nearest pack pieces, or are left with the reason written down.

## 3. What version 139 answered (live since 2026-11-08)

| Ask (round 19 and before) | What 139 does | Expect |
|---|---|---|
| "cover in the carriageway every 15-20 m", "the missing mid-range band" (centre, both, first or third ask) | 39 stations down the Loop and the corner streets (slewed hover vans, planted islands, low barrier Ls with lit tops), crossings, manholes, lane edges | the Loop's share past 5 m from cover falls from about half to about a fifth (measured on the prediction) |
| "the plaza a place to fight", "lit stairs onto the Sky Ring" | the four stairs lit up both flights, light lines from the base's gates across the plaza | partial: the plaza's own cover clusters and paving are batch 7 |
| "the strongroom a room", "halve the gold bars" (both, two rounds) | a dark steel room 1.6 m deep behind the round door, lit racks of bars at half size, the leaf back on its hinge | the vault's broken items should clear |
| "the skyline boxes as pack buildings" (all four reviewers), "red lasers across the sky" | the pack's own low buildings with roof props, cars on the outer ring road, towers in storeys, the fence's lines faded | the "box city" and "floating" items should clear |
| GLASS HEIGHTS at street level (its 5.5) | frosted screens in white troughs with benches, shop signs and a lobby, white decks, cover round the lift | GLASS HEIGHTS to about 6.5 |
| "the ring road's kerb a black pipe with blue dots" (both, d01, d13b, d22) | every kerb in concrete | cleared |
| THE TERRACES' white pods at the mouth (both) | the band from the ring road's inner edge, single pieces in the district's own kit | cleared |

## 4. The centre, area by area

### 4.1 The plaza round the tower (picture 06)

- **Said:** "a flat kill bowl" (round 19 B); "the plaza a place to fight: a paving pattern, a central feature, two cover
  clusters, lit stairs" (19 A); "the base a landmark: a canopy over the hall's entrances" (18 B); "a dark rectangle on the
  plaza floor" (18 A).
- **There now:** open paving between the base's gates, the pads and the Sky Ring's stairs, with the street fill's single
  pieces; 139 adds light lines and lit stairs.
- **Why it reads flat:** the bands between the gates are 2 to 12 m deep, and the street fill treats them as street, so it
  lays the same pods as anywhere else. Nothing marks the plaza as a place of its own.
- **Fix (Batch 7, M):** the plaza as a designed set. Two cover clusters on its open faces, each an L of low walls with a
  planter and a crate stack (pieces the centre has). A low wall ring round the base's foot with gaps at the gates. A paving
  pattern in a material the map already draws (the court's hex tile or THE TERRACES' brick, so no new draw). A centrepiece
  on the main axis: a raised planter ring round a sign column carrying the tower's name.
- **Lifts:** play-style and visual.

### 4.2 The Loop and the corner streets (pictures 04, 05, 16, 18, 22)

- **Said:** see section 3; also "street level is open asphalt or tight boxes, few 10-20 m rooms" (18 B); "the Loop's
  streets and plaza wide under many perches, the roofs without mid-range cover" (19 B).
- **There now (139):** stations every 16 m, crossings and road marks.
- **Still missing:** road-works pens and stains (the pack has no cones or barriers, and a stain material is a new draw),
  and **rooms at street level**: 10 to 20 m spaces with two doors, where a fight can happen out of the roofs' sight.
- **Fix (Batch 8, L):** two or three street-level rooms per corner block, built from the shop and hall pieces the base and
  the walk-ins already use, each with two openings onto different streets and a chest inside.
- **Lifts:** play-style, flow.

### 4.3 The corner blocks: MARKET, NOODLE ROW, MOTEL HILL (pictures 16, 18, 22)

- **Said:** "MARKET themed: stall canopies, produce and cargo crates, an awning over the street, for the white sci-fi crates"
  (19 B); "each weak corner block a signature: a stall canopy over MARKET's street, a two-storey L-shaped motel with outside
  walkways at MOTEL HILL" (19 A); "ledges and balconies on MARKET and NOODLE ROW" (18 B); "MARKET neon cropped, a car
  mid-road, no market dressing" (17).
- **There now:** the corner buildings, the street fill's generic pods, MARKET's name.
- **Why:** the corner blocks were built as streets, and their dress is the centre's generic kit.
- **Fix (Batch 7, M, a proposal agent):** each corner block its own kit, as the districts have.
  - MARKET: rows of stalls (the pack's food stall pieces) with awnings (the sunshade piece) along both kerbs, crate stacks
    of produce, and an awning line across the street on cables.
  - MOTEL HILL: an L of motel rooms two storeys high with an outside walkway and stair (balcony and stair pieces), its sign
    on the roof.
  - NOODLE ROW: its lantern canopy kept, stalls under it, stools.
- **Lifts:** visual identity, readability ("where am I"), play-style.

### 4.4 The tower's outside and the base's facade (pictures 02, 06, 08, 09, 14, 25)

- **Said:** "the tower's bands and windows lit only on the playable storeys, each in its floor's colour, the dummy storeys
  dark" (19 A, second ask); "the base a facade: window frames, shutters, loading doors, ledges, lit bands" (19 B, fourth
  ask); "the base a landmark: a distinct facade, its name large on four sides" (18 B); "exterior terraces and ledges on the
  tower 14 to 35 m on the plaza faces, a gold balcony outside THE VAULT" (18 A); "one tower on a drum among same-kit
  blocks" (19 A gap).
- **There now:** the pack's 151 m tower (Neon Building 08) with storey bands (Milestone 1046) and THE VAULT's gold band;
  every storey's windows lit alike, playable or not; the base a raw concrete frame.
- **Why:** the tower's shell is one model; its windows are lit by its material, the same at every height.
- **Fix (Batch 7, M, a proposal agent):**
  - The windows lit by height: the shell's window material lit only in the bands of the playable floors, each in its
    floor's own light colour, the dummy storeys dark. Done in the game's shader by height, so there is no new draw.
  - The base's facade: frames and shutters over its openings, loading doors, a lit band at each floor and its name large on
    four sides.
  - Batch 8: two or three balconies on the plaza faces between 14 and 35 m, a gold one outside THE VAULT, each reached from
    its floor.
- **Lifts:** readability (the playable floors read from outside), visual.

### 4.5 The tower's floors (pictures 11, 12, 13)

- **Said:** "neutral white light with the floor colour as trim, the floor number facing each stair, desks and racks on the
  26 m floor" (19 A); "calm panels for the greeble ceilings" (18, done in 1070); "each tower floor a slab with one hole"
  (18 A gap).
- **There now:** each floor its own ceiling and light colour (1065, 1070), furniture on three floors.
- **Fix (Batch 7, S to M):**
  - A white fill light with the floor's colour only in its trim.
  - The floor's number as a lit sign facing each stair's top.
  - Desks and racks on the 26 m floor.
  - Batch 8: one floor split into rooms with doors, so the floors are not all one open slab.
- **Lifts:** readability, play-style.

### 4.6 THE VAULT (pictures 28, 30, 19)

- **There now (139):** the strongroom.
- **Still said:** "every chest gold-lidded and glowing" (19 A); "the violet floor's one object white-grey not gold" (19 A,
  THE WELL's bottom); "the best loot one storey of a stack, not a cluster to cross" (19 B gap); "nothing from the street
  says best loot" (18 B gap).
- **Fix:**
  - Batch 7, S: every chest on the map gold-lidded and lit.
  - Batch 8, L: the best loot as a route rather than a room, a gallery at 35 m with its own loot, the strongroom, and a
    second lit room at 29 m, joined by the core's stair, so a fight goes through them.
- **Lifts:** play-style, fun.

### 4.7 The base: hall, atrium and court (pictures 07, 20, 20b, 20c, 29, 29c)

- **Said:** "the base hall a recognisable lobby (turnstiles, desk, lounge)" (19 A); "the white open capsule unexplained"
  (19 B, 07); "a square atrium with galleries for the T-shaped hole and its black dome; beams, ducts and light strips on the
  flat dark ceilings" (19 B); "29 a black dome half over the T skylight" (both, three rounds running).
- **There now:** a hall with modules, the court (1064) with pillars, a platform and coloured ceiling panels. The atrium's
  void stands under the tower: the "black dome" is the underside of the tower's own base, measured, so there can never be
  sky there. The T-shaped skylight cut in 1064 reads as a mis-cut hole.
- **Fix (Batch 7, M, a proposal agent):**
  - The atrium given a designed ceiling instead of a fake sky: the T cut closed, a square lit coffer the size of the void
    under the dome, a light ring round it and a hanging sign in the void, so it reads as an interior.
  - The hall as a lobby: a desk, a turnstile line from the base's gate pieces, a lounge of benches.
  - The capsule removed or given a sign.
  - Beams and light strips on the flat ceilings of 07, 20c and 29c.
- **Lifts:** finish, readability.

### 4.8 The High City roofs, the Sky Ring and the lookout (pictures 10, 14, 26, 27)

- **Said:** "the High City ring cut at two points into gaps with a pad, chest-high cover on the bare roof (14) and the
  lookout's rim (10)" (19 A); "the bare tops covered: skylight boxes, HVAC rows, antennas on the teal roof, a low-walled
  raised centre on the lookout" (19 B); "mantle ledges every storey and jumpable awnings on the High City and corner faces"
  (19 B); "roofs at 10.5 and 26.9 m, the bridge ring one walkway, not parkour" (19 B gap); "the High City roofs a highway
  of bridges" (19 A gap); "26 a truss fills half the frame" (19, both).
- **There now:** the ring of bridges joins every High City roof; the roofs are open flat tops; climbs by balconies (n and w).
- **Why:** the bridges were built for flow, and now there is no risk in crossing; the roofs have nothing to fight around.
- **Fix (Batch 7, M, a proposal agent):**
  - Two of the ring's bridges cut into gaps, each with a jump pad either side.
  - Each High City roof its own roofline: skylight boxes, HVAC rows and an antenna mast (pack roof props), chest-high cover.
  - The lookout a low-walled raised centre with a chest.
  - Awnings and ledges on the faces at mantle heights, so a player can climb from the street to a roof without a pad.
  - Picture 26's truss moved out of the view or removed.
- **Lifts:** play-style and flow, the centre's two biggest sub-scores to move.

### 4.9 THE WELL (pictures 19, 19b)

- **Said:** "19b the rope rising past the rim into empty sky" (19 A); "the rim railing's blocky shadow" (19 A, the
  renderer's).
- **Fix (Batch 7, S):** the rope's top anchored on a frame at the rim, not ending in the air; the chest on its floor gold.

### 4.10 Night (pictures night 23, night 24)

- **Said:** "the pools flat pastel discs" (19 B, 18 B); "the left building and its bin near black" (19 B, 18 A).
- **Fix (Batch 7, S):** the light pools under the street lamps as soft-edged gradients instead of flat discs; the dark
  facades of 24 lit with a few windows and a sign.

### 4.11 Shadows (pictures 04, 08, 14, 19, 25, 26)

- **Said:** "the shadows' aliasing, cascades or a tighter frustum, soft filtering" (19 B, first ask); "the near shadows
  sharpened and filtered" (19 A); "the loudest unfinished tell" (districts 19 A, first ask). Three of four reviewers put it
  first in round 19.
- **Why it is not map work:** it is the renderer's shadow map size, cascades and filtering, in the lobby agent's
  worktree. It was handed over by message on 2026-11-05; the lobby agent has been offline since.
- **Owner:** this is the single most-named fault. Either the lobby agent takes it when it next runs, or you let me make the
  change in the renderer for this one item. It will probably lift visual and finish across the centre and every district at
  once.

### 4.12 The finish list (named in round 19, still open after 139)

| Picture | Fault | Fix | Batch |
|---|---|---|---|
| 04 | a hover car straddling the kerb | the parked cars' kerb clearance | 7 |
| 07 | a white open capsule unexplained | out, or signed | 7 |
| 19 | the violet floor's object grey, not gold | the chest gold-lidded | 7 |
| 19b | the rope into empty sky | anchored at the rim | 7 |
| 26 | a truss fills half the frame | moved or removed | 7 |
| 29 | the black dome over a T skylight | the atrium's ceiling (4.7) | 7 |
| 28 | the orange walls painted board | THE VAULT's walls in a panel material already drawn | 7 |
| night 23 | the pools flat discs | soft gradients (4.10) | 7 |
| night 24 | the left building and bin black | lit windows and a sign | 7 |

## 5. The districts, one by one

Round 19's whole-map notes: "eight different patches; each district a self-contained block, neighbours meeting in hard
cuts"; "THE STACKS and THE CANYON both brown from above"; "at night only THE STRIP and THE WORKS read"; "the outer road
empty, the city past it untextured boxes" (the last two answered by 139).

### 5.1 THE TERRACES (6.0, 5.9; tied lowest)

- **Said:**
  - "slimmer pergolas, hedge paths and low walls on the lawn, terracotta pots for the yellow-black planters" (d05);
  - "hedge courts for the white pods and grey blocks before the stair, the gate sign" (d04, both);
  - "the name larger, lamps on the dark approach" (d04);
  - "the pergola posts oversized, the wood stretched" (two rounds);
  - "the lawn empty" (whole map).
- **There now:** the stepped terraces with rooms, the green lawn (1068), pergolas, planters; 139 clears the mouth's pods.
- **Measured cause of the "yellow-black planters":** every pit in the pack has sides that are a lit panel printing a yellow
  cross, which reads as hazard stripes (found by the GLASS HEIGHTS agent in 139). THE TERRACES wears the same pits.
- **Fix (Batch 7, M):**
  - The planters' sides in a terracotta wear, not the lit panel.
  - Pergola posts scaled to 25 cm with the wood mapped to its length.
  - Hedge-lined paths and low walls across the lawn, with benches.
  - The gate sign twice the size, and lamps along the approach from the ring road.
- **Lifts:** finish and visual; this is the cheapest district to lift by half a point.

### 5.2 GLASS HEIGHTS (5.5, 6.0; 139 answers most of it)

- **Said:** "lit lobbies and shop signs in the grey lower panels, white planter-and-bench sets, cover round the lift's
  foot, white troughs, no flower box"; "the plain white blocks at the mouth as built kit"; "near-white deck tops so it reads
  from the air".
- **139:** all of the above (Milestone 1077).
- **Risks to watch in round 20:** a lone screen reading as a "floating card", white on white on the decks.
- **Next (Batch 8):** the court round the lift a place with a centrepiece, and the lift's foot a sheltered stop.

### 5.3 THE STACKS (6.0, 6.0)

- **Said:**
  - "a cover line across the court's middle" (d11);
  - "its roof two or three sets, a pink rail, a roof surface for the wet cobble" (d12);
  - "roof islands: THE STACKS' hotel roof broken with decks, wells, gaps with pads";
  - "blends into the centre's browns from above" (two rounds).
- **There now:** the capsule hotel, the court with a barricade and machine rows (1067), the kiosk with lit ads (1071).
- **Fix (Batch 7, M):**
  - A line of cover across the court (cars and cabinets), so it splits into two halves.
  - The roof a surface of its own (a deck material already drawn), two or three cover sets and a pink rail.
  - A gap on the roof with a pad.
  - Pink on large surfaces (the hotel's trims and the court's floor lines) so it reads from the air.
- **Lifts:** play-style and identity.

### 5.4 THE CANYON (6.5, 6.3)

- **Said:**
  - "a different facade every 20-30 m, its roof tanks gathered into clusters with stair houses" (d20, d21);
  - "the cliffs stepped, balconies, ledges, a second window material, booths on the walkways" (d20);
  - "the roof plates broken with decks, wells, gaps with pads" (d21);
  - "the orange strip between THE CANYON and the fence" empty (whole map).
- **There now:** the cut with its walkways and ad stands, the outer cliff walls, the hanging posters (1073).
- **Why:** each cliff is one long run of the same building piece; the roofs are flat plates.
- **Fix (Batch 7, M, a proposal agent):**
  - The cliffs in segments of 20 to 30 m, each a different building piece or window material, with set-backs and
    balconies.
  - The roof tanks gathered round stair houses, and decks with a pad gap across the roof plates.
  - The strip by the fence given a use: parked trucks and a service lane.
- **Lifts:** visual and flow.

### 5.5 THE WORKS (6.5, 6.4)

- **Said:**
  - "the hall oiled concrete, the light pool dimmed, machinery round the boiler" (d23);
  - "bolted plates on the flat rust L-walls" (d22);
  - "the yard grouped with lanes, full-size containers" (d24);
  - "the pads flat rings" (d23, two rounds).
- **Fix (Batch 7, M):**
  - The hall's floor in a concrete already drawn, its light pool dimmed, and machines (tanks, pipes, cabinets) round the
    boiler.
  - The yard's crates grouped into container stacks with lanes between.
  - The pads given a lit base and column, as the centre's pads have.
- **Lifts:** finish and play-style.

### 5.6 LANTERN ALLEYS (6.5, 6.6)

- **Said:**
  - "flat roof terraces linked by planks" (d03);
  - "shutters and signs on the court's blank fronts, a stall row through it" (d02);
  - "a lone brick booth with a red door, a red glow on the floor" (d02, two rounds);
  - "the court a bigger centrepiece" (12).
- **Fix (Batch 8, M):**
  - Plank walks between three or four roofs, so the alleys have a rooftop route.
  - Shutters and signs on the court's blank fronts and a stall row through it.
  - The booth and its red floor glow out.

### 5.7 THE STRIP (6.5, 6.8)

- **Said:**
  - "the pyramid's step lights inset" (d17);
  - "screens and neon on every second bay" (d16, d18);
  - "the plain white blocks on THE STRIP's street as built kit" (d17);
  - "the striped metal floors' moire" (d08, d18);
  - "THE STRIP's tower a pink ball past the east fence" (top-down).
- **Fix (Batch 8, M):**
  - The white blocks in THE STRIP's own kit, as GLASS HEIGHTS' were.
  - Screens on every second bay.
  - The step lights set into the pyramid's steps.
  - The striped floors in a material without the fine stripes.
  - The pink ball read off the bake and moved inside the fence or out.

### 5.8 THE TERMINAL (7.0, 6.3)

- **Said:** "a platform edge, track and wagon through the arches, the floor's striping, frosted ribbed glass for the lime
  hexagons" (d08, d09); "departure boards" (12).
- **There now:** the hall, the train behind it, trams on rails (earlier), map boards back to back (1071).
- **Fix (Batch 8, M):**
  - A platform edge and a track with a wagon seen through the arches.
  - The lime hexagon glass in a frosted glass already drawn.
  - The striped floor calmed.
  - A departure board.

### 5.9 Across the districts

- **Hard cuts between neighbours** (19, the whole-map note): **Batch 8, M**. A transition strip where two districts meet:
  each side's kit thinning into the other's over 10 to 15 m, and the ring road's band (1074, 1080) carrying the facing
  district's kit to the road.
- **Night identity** ("at night only THE STRIP and THE WORKS read"): **Batch 7, S**. Each district's own night colour
  pushed (its washes and sign lights), the outer roads' lines kept dim.
- **Roof access visible from the street** (districts' flow, the weakest sub-score for several rounds): pads glowing at
  street level, and a fire escape on a street face of each block where none shows.

## 6. The order

### 6.1 Batch 7 (built 2026-11-08 as version 140, Milestones 1081 to 1094)

Six proposal agents, all measuring on version 139's files at once. Each comes back with a dry run, its checks proven, and
the review spots that show it. They are applied one at a time, then baked once as one version:

1. **The tower and the base outside** (4.4): the windows lit by height, the base's facade and name.
2. **The High City roofs and the lookout** (4.8): two bridge gaps with pads, roof props and cover, the lookout's centre,
   mantle awnings, picture 26's truss.
3. **The base inside** (4.7): the atrium's ceiling, the lobby, the capsule, the ceilings' beams.
4. **The corner blocks** (4.3): MARKET, MOTEL HILL, NOODLE ROW each their own kit.
5. **THE TERRACES and THE STACKS** (5.1, 5.3).
6. **THE CANYON and THE WORKS** (5.4, 5.5).

Mine, alongside them: the plaza (4.1), the tower floors (4.5), every chest gold (4.6), THE WELL's rope (4.9), night (4.10),
the finish list (4.12), the districts' night colours (5.9).

**What round 20 showed** (version 139): the strongroom, the street cover and the backdrop read as fixed, the centre held at
6.0; its asks were batch 7's (the plaza first in both, the roofs' cover, the base's skin, MARKET, the atrium). **Built as
version 140:** all six agents' items and a seventh, the plaza (Milestone 1088), and of mine every chest gold (1089), the lamp
pools (1090), THE WELL's rope frame (1091), the tower floors' light and numbers (1092), and from round 20 THE VAULT's gold in
one room with its walls scratched gold (1093) and THE CANYON's worn paving (1094). Left for batch 8: the desks on the 26 m
floor, the districts' night colours, the finish list's hover car and picture 24's dark facade.

### 6.2 Batch 8 (built 2026-11-09 as version 141, Milestones 1095 to 1108; then round 22)

From round 20, new and named twice or first:
- **GLASS HEIGHTS' street storeys as real shopfronts** (district B's first ask): mullioned glazing, lit interiors,
  canopies and recessed doors in the grey lower panels; the lift's white bands as slim rings.
- **The lift ropes' tops anchored** (centre A, 04 and 14: "a vertical rope from the sky with no anchor"), as THE WELL's.
- **Roof access seen from the street** (both district reviews): a stair, ladder or pad visible on every block.
- **THE WORKS' yard as a few big set pieces** (both): container stacks, a pipe rack, a gantry, for the crate field.
- **THE CANYON's roofs** (both): rooftop structures 3 to 6 m, gaps, zips across.
- **THE TERRACES' room** (both, d06): a garden pavilion for the shipping container; its dark forecourt lit.
- **The pale slab across LANTERN ALLEYS' mouth** (both, d01) and a centrepiece in its court.
- **THE STRIP's red X tile on every face** (both): two or three facade materials; the pyramid's pink band (d17).
- **The centre's white lit street boxes** read as greybox cubes (06, 16); the city's white striped towers past the fence
  (all four).
- **Night**: the facades lit from below where a street is dark (24); the north and west districts nearly invisible (d99).

And from before:
- Rooms at street level (4.2) and the tower's balconies (4.4).
- The best loot as a route (4.6) and one tower floor in rooms (4.5).
- LANTERN ALLEYS, THE STRIP and THE TERMINAL (5.6 to 5.8), and GLASS HEIGHTS' court (5.2).
- The transitions between districts (5.9).

**What round 21 showed** (version 140): every score rose for the first time since round 14 (the centre 6.2 and 6.3, the
districts 6.4 and 6.3); its asks moved up a level, to the strongroom as a room, the High City blocks' shapes and faces you
can climb, the bare high slabs, denser streets, GLASS HEIGHTS' street storey, THE WORKS' yard, LANTERN ALLEYS dense, the city
past the fence dimmer. **Built as version 141:** eight proposal agents' items, THE VAULT's strongroom a room with five ways
in (1095), ledge stacks up three High City blocks (1096), the base's roof furnished and the Sky Ring's underside lit (1097),
the streets' second stations and four of the street faults (1098), GLASS HEIGHTS' seven shopfronts and clear lift (1099),
THE WORKS' yard in set pieces on slabs (1100), LANTERN ALLEYS' mouths and pavilion, THE TERRACES' rooms, THE STACKS' pink
(1101), the ceilings in plain plaster (1106); and of mine the city past the fence quieter (1102), the awning over picture
18 (1103), THE LOBBY's box on rods (1104), every rope's end on a frame (1105), NIGHT MARKET over the crossing's fence (1107),
THE STRIP's crown banded (1108).

**Left for batch 9** (the agents' "not done", each measured in its report in T/proposals8):
- THE VAULT reached from outside: a ledge along its gold window row with zips onto it (vault8.md).
- The High City blocks' crowns (the largest free rectangle on a deck is 2 to 3 m: perches or cover move), the east block's
  climb, the tower's balconies on the played storeys (highcity8.md has the spec).
- Cover on the lookout (10) and the north deck (14): both review cameras stand on arrivals, so the cover goes past their
  keep-off or the arrivals move (slabs8.md).
- Kiosks and stair towers from the plaza to the Sky Ring: a 45 degree stair cuts the base's corner door (slabs8.md).
- GLASS HEIGHTS' plaza: solid cover, a centrepiece (glass8.md has a plan).
- THE CANYON's walkways broken every 12 to 15 m (needs new bays: the walkway is 2.0 m clear and walked down its middle) and
  its roofs: stair houses, plant rooms, a gap and a zip (yards8.md).
- LANTERN ALLEYS' roof routes and facades, THE STACKS' court and roof tanks, THE TERRACES' garden rooms (gardens8.md).
- Mine: the desks on the 26 m floor, the centre's white lit street boxes, the facades lit from below at night, the
  transitions between districts, the pyramid's edge at a grazing angle (the renderer's aliasing, seen at d17).

### 6.3 Reaching 7, and then 8

**For 7,** play-style and finish have to move. Flow (7) and fun (6.5 to 7) are already there. Batches 7 and 8 are
mostly play-style; the finish list is cleared each batch, picture by picture. The shadows (4.11) are the largest single
finish item and are not map work.

**At 8,** finish must reach 7. The reference changes too: each picture is compared against a shipped map's screenshot of
the same kind of place (a street, a roof, an interior) rather than against our last round. The plan is rewritten when 7 is
met (runbook section 6.1).

## 7. Making each batch faster

- **The texture cache (built 2026-11-08).** Every bake used to encode all its ~1,100 textures again, even though almost
  none change between versions. A full release was about 2 hours of machine time: about 35 minutes for the low loop and 75
  for the full-size bakes. The bake now keeps each encoded texture, keyed by its pixels, size and kind and by the encoder,
  and encodes only new ones. A cached bake is checked byte for byte against an uncached one. Measured on version 140: the hi bake 4 minutes and the max 8, one texture of 1,126 encoded, for about 75 minutes the pair before.
- **Bigger batches.** The agents of a batch all measure on one snapshot, and the batch ships as one version: one low loop,
  one pair of full bakes and one round of reviews per batch, instead of one per milestone.
- **What cannot be baked ahead.** The map's geometry is one merged file per size, so any piece that moves means a re-bake.
  That part takes minutes; the textures were the slow part.
- **Reviews per batch, not per version,** so each round sees a real step.

## 8. What is not in our hands

- **Shadows:** the renderer, the lobby agent's (4.11). Owner.
- **Frame time:** measured last, with the PC unused (your rule, 2026-10-18).
- **Pieces the pack lacks:** cones, road barriers, a fountain, furniture sets; the nearest pack pieces stand in, each
  noted.
