# Plan: finishing the Neon City

The owner, 2026-10-17: "plan this part out deeply then finish out the city overall". The bar set before that: "we
should only be done when we finish all outside districts and they are all populated nicely along with the center being
a large ass and detailed place to fight".

**What is left is planned in "The last stretch (2026-10-20)" below**, from the fresh reviews of that day; it takes over
every item of the phases that follow that is not built. The rest of this page is the plan as it was written on
2026-10-17.

This plan comes from two fresh reviews taken today on the live map (version 93) and from measurements on it. Each
review was by an agent that saw only the pictures. Every item below names the picture or number it answers. The
reviews' full text is in docs/CENTRE_REVIEW.md (the centre, round 7, and the districts, round 1).

## Where it stands

- **The centre: 6 of 10** (round 7; it was 5.5 in rounds 5 and 6). Its strengths: the tower and THE VAULT's gold band
  are a landmark from every height, the layering is real (the Sky Ring, zips, fire escape, footbridges, the gangway),
  and the tower floors are good close-range spaces. What holds it back: few doors at street level, wide flat squares,
  nothing to stand on between the 12 m roofs and the 27 m ones, one ceiling and one light in every interior, THE WELL
  a black hole, and a list of finish faults.
- **The eight districts: 4.5 of 10** (round 1, the first time they were reviewed). They read as "a centre with filler
  around it", told apart by one colour, not by shape:

  | District | Score |
  |---|---|
  | THE TERMINAL | 6.5 |
  | THE STACKS | 6 |
  | THE CANYON | 5.5 |
  | LANTERN ALLEYS | 5 |
  | GLASS HEIGHTS | 5 |
  | THE STRIP | 4.5 |
  | THE TERRACES | 3 |
  | THE WORKS | 3 |

  Most of the faults were confirmed by looking at the pictures. THE WORKS' block hall is empty on its ground floor:
  only its upper ring was furnished. THE STRIP's ad screens show solid blue.
- **Smoothness.** The lobby agent measured the city at about 420 draw calls a frame from the street: one primitive per
  material, each spanning the whole city. That is the largest cost on a laptop's processor.
  - Milestone 657's first stage (texture-array batches, uncommitted) took the centre from 441 primitives to 193, with
    the look unchanged. On half a processor it went from 47 to 57 fps.
  - In full-speed runs the graphics card's timer read about 1.5 ms more; the frame still came out faster at both
    speeds.

## What "done" means, measured

1. **The centre: 7 of 10 or better** from a fresh reviewer, with no "bare", "empty" or "broken" finding left that I
   find true in its picture.
2. **The districts: 7 of 10 or better overall**, and every district 6 or better, from a fresh reviewer.
3. **The frame**, measured last with the PC unused, at the bench's street spot, on Competitive:
   - half a processor at 60 fps or better (47 today);
   - the graphics card's time no worse than today's;
   - no new frame over 50 ms.

   Balanced and High must be no worse than today.
4. **Every new structure**:
   - walked and climbed by a player with the game's real moves;
   - railed at every edge;
   - covered within the district's distance;
   - photographed by day and by night;
   - its decay top measured.

   These are the checks every milestone already carries.
5. **The decay re-timed** for the districts' sizes.

## The order, and why

The owner, 2026-10-18: "good to keep in mind fps but we can't focus on it ... we have multiple agents running multiple
versions of the game at once when they are all working on fixes/features to speedkills so save that for last and
mention that the pc needs to be unused to really benchmark". So the frame is kept in mind while building (no needless
draws), its first stage (Milestone 657, finished when this was written) ships, and the rest of the frame work and its
measuring go last. A benchmark on this machine with the other agents' games running swings by a quarter. A real one
needs the PC unused, a session for the owner to schedule.

The districts come first. They are the owner's named bar ("all outside districts ... populated nicely") and the
lowest score (4.5 against the centre's 6). The worst districts go first.

The centre's remaining items follow, biggest gameplay gain first. The frame and the whole map are closed last.

Each milestone ships on its own: build, bake, checks (each new one proven by putting the bug back), photographs,
e2e, docs and deploy.

## Phase 0: the frame's first stage (Milestone 657)

- **657: the opaque materials batched** (shipped). The 249 opaque, lit materials without detail maps are batched over
  texture arrays at lo, hi and max. Each array is kept under 128 MB, so lo is one batch, hi three and max twelve.
  - The shader reads each material's row of numbers per vertex. Measured: it was the cheapest of the variants on the
    graphics card.
  - Cutting the batches into 50 m cells was measured and dropped. From the street most cells are in view, so it cut
    only 5% of the triangles and bought no fps.
  - Measured: the look unchanged at 12 spots. Half a processor went from 40 to 50 fps and a whole one from 132 to
    139, with no new frame over 50 ms. These numbers came with the other agents' games running on the same PC; a
    clean bench needs it unused (Phase 3).

## Phase 1: the districts populated (Milestones 660 to 672)

- **660: head-high cover in every open district space** (the districts' review asks for this first: "no stretch past
  about 15 m without head-high cover"). The places it names:
  - LANTERN ALLEYS' way in from the ring (d01);
  - THE STACKS' hotel court (d11);
  - THE TERRACES' top tier (d05);
  - THE TERMINAL's forecourt (d07);
  - THE WORKS' yard (d24);
  - GLASS HEIGHTS' deck (d14).

  It uses the street cover's own farthest-point fill, run over each district's open ground and roofs with 1.4 to 2.5 m
  pieces: stalls, crate stacks, barriers and vehicles. A new check holds every open district point to within 8 m of
  cover a body stands behind.
- **661: the best loot in every district's landmark** (docs/GAP_ANALYSIS_MAP.md, gap 2): a loot site at each of the
  eight landmarks, rolled at a `landmark` tier of eight spots, so each district is worth a drop.
- **662: the Gulag a street** (the owner, 2026-10-18: "one street like the firing range with one building in the
  middle ... or just a ledge that has two levels to it ... just a double jump height worth"): THE GULAG, a 48 m street
  of the city's pieces with a two-level ledge in its middle, the overtime flag on its top, in place of the Vault.
- **663: the legacy left over taken out** (the owner, 2026-10-18: the old range's textures and the old ILranch city
  gone, if nothing uses them): the Vault and what only it used, the ILranch import code, and any texture or file
  nothing loads.
- **664: THE WORKS made rust and machinery** (3/10). *Built: the block hall's ground floor, its walls' pipes, the
  halls in rust, no beams indoors. Left: the stairs to the ring (its pads are the way up), the outside tanks and
  gantry.*
  - The block hall's empty ground floor filled: machines, crate stacks, pipe runs, and stairs up to its ring in view.
  - The halls' grey walls in the pack's rust.
  - Outside, more tanks, pipes and a crane-like gantry (the pack's beam frames).
  - The light cones taken out indoors.
- **665: THE TERRACES made terraced** (3/10). *Photographed again on version 95, the tiers, the grand stair and the
  planted beds were already there; built: the rooms furnished, lit and plastered. The two pillars at the stair's head
  hold its name, and stay.*
  - Retaining walls 3 to 4 m between the tiers, a wide stair seen straight from the ring road, and planted beds as
    cover.
  - The walk-through blocks' rooms given doors, windows and furniture.
  - The top tier's two blank pillars traced and taken out.
- **666: THE STRIP lit and finished** (4.5/10). *Built: the screens show their ads, the pyramid and the club canopy
  as lit-window glass. Left: the club as a dark room, the night (671).*
  - The flat red planes given the pack's patterned LED panels.
  - The ad screens' solid blue traced (a material the import does not read) and fixed.
  - The loose black slab and cube traced and taken out.
  - The club closed into a dark room with a lit dance floor.
  - Its night made the brightest in the map.
- **667: LANTERN ALLEYS made alleys** (5/10).
  - Shophouses infilled so its lanes are 4 to 6 m wide.
  - The white capsule pods at its way in replaced with shophouses.
  - Stalls in the court, and the court's stray booth taken out.
- **668: GLASS HEIGHTS its own white glass** (5/10).
  - Its towers in white glass, not the centre's window grid, and the 72 m tower white with a lit cyan crown read
    from every district.
  - Its 27 m decks covered (660 starts this).
- **669: THE CANYON's roofs and lane** (5.5/10).
  - The 48 m plateau split into separate roofs with height changes and gaps to jump.
  - The straight street broken by an arch or a stall cluster every 30 m or so.
  - Its cliffs in a facade of their own: the pack's stacked shopfront walls.
- **670: THE STACKS and THE TERMINAL finished** (6 and 6.5).
  - The hotel court and roofs given cover.
  - THE TERMINAL's forecourt given cover and more wagons at its platforms.
  - Its vault roofs lit, not a black wall.
- **671: the districts by night**: each district's light colour strong enough to read from the dropship, and the
  streets under the lamps dark, not lit like day (d98).
- **672: the map's edge**: the red edge lines that read as "lasers across the sky" lowered or thinned, and a distant
  skyline past the fence so the city is not a diorama. The fog over the drop view is the owner's call (below).

## Phase 2: the centre to 7 (Milestones 673 to 680)

- **673: enterable two-storey shopfronts**, the centre review's first ask and the biggest gap to Hyper Scape. Three to
  five per side along the Loop and in each corner block.
  - Built from the pack's room modules (3.5 m rooms from 5 x 5 to 10 x 20 m, entrance rooms, corridors), with a stair
    to a roof you can fight on.
  - One assembled, measured and photographed first, then laid in the open lots between the curved streets.
- **674: the squares filled**: NOODLE ROW's square, the plaza ring round the base and MARKET's street, with stall
  clusters, awnings and kiosk lines, cover every 4 to 5 m.
- **675: the 16 to 20 m tier**: ledge shelves, balcony runs and container stacks on the High City faces and the corner
  roofs, so a double jump chains a 12 m corner roof to a 27 m High City roof. Checked with the climb simulator.
- **676: the tower floors dressed and THE VAULT made rich.**
  - First, fix the mismatch between the layout's reach model and the walk check (it shut a room on the 35 m floor).
  - Then a ceiling and a light colour of its own on each floor, furniture and crates.
  - THE VAULT gets gold crates, an atrium into the floor over it, and more ways in.
- **677: THE WELL lit**: lit balconies at each level, a coloured wash up the shaft, and a sign at its rim.
- **678: the centre's finish**, each fault checked in its picture first:
  - the torn wall bottoms on the tower floors (11, 13, 28);
  - the base-hall kiosk's seam (07);
  - cover on the 49 m lookout, kept off the zips' landings (10);
  - the gangway: a lit "26" at its window and lighter crates (25);
  - an anchor post where each zip's cable ends (the "pipe that ends in mid-air", 14);
  - the plain white slab (17);
  - the walk-in doors made to read as doors (22).
- **679: a rail per zone**: gold at the tower, red at MOTEL HILL, cyan at the High City. Now one green rail runs
  everywhere.
- **680: the base hall lit and furnished, and the corner blocks told apart at street level** (round 6's open asks).

## Phase 3: the frame and the whole city, last (Milestones 681 to 685)

- **681: the detail-mapped materials batched** (126 materials, the asphalt and the walls whose real surface is the
  pack's detail map), with a detail variant of the shader: the detail colour, normal and mask as three more arrays.
- **682: the cut-out materials batched** (signs, blinds, grilles and palms) with alpha testing and their own shadow
  depth material. The see-through and additive ones stay as they are.
- **683: the decay re-timed** for the districts' sizes: crossing times measured.
- **684: the frame measured with the PC unused**, every district in view, on Competitive, Balanced and High. The
  targets: the city at 80 draws or fewer from the street, 60 fps on half a processor.
- **685: the final reviews**: the centre's round 8 and the districts' round 2. Done if both meet the bar above;
  otherwise their lists become the next milestones.

## The last stretch (2026-10-20)

The owner, 2026-10-20: "plan it all out now that we are getting near the end of the map build and then implement it
all". Two fresh reviews were taken that morning on map version 96 (Milestones 660 to 666 in it), by agents that saw only
the pictures; their text is in docs/CENTRE_REVIEW.md.

- **The centre: 5.5** (round 8; 6 in round 7, by another reviewer). Visual 5, readability 5, flow 6, play styles 5,
  finish 4, fun 6.
- **The districts: 5.0** (round 2; 4.5 in round 1). THE STACKS, THE STRIP and THE CANYON 6; LANTERN ALLEYS and GLASS
  HEIGHTS 5.5; THE TERMINAL 5; THE TERRACES and THE WORKS 4.5. Finish 4.

The bar is unchanged: 7 or better for each, and every district 6 or better.

### What both reviews hold against it

1. **Finish** (4 in both): pieces floating or black in a picture, ceiling lamps hanging into head height, a kiosk that
   reads as a train carriage, dark ground.
2. **One face everywhere:** the same cream-framed window front on the centre, THE TERRACES, GLASS HEIGHTS, THE CANYON
   and THE STRIP, the same crate, planter, car and rail in every district. This is the fault reviewers held against
   Hyper Scape itself.
3. **Bare tops and plazas:** roofs, decks, forecourts and courts with nothing to fight round.
4. **The map ends in beige:** no city past the fence, "a tabletop floating in haze".
5. **Night:** black but THE STRIP and the fence.
6. **Pads read as white wedges of light,** not as pads.
7. **Thin payoffs:** THE VAULT is a painted maze; MARKET and THE WELL have no silhouette; the club is open to the sky.

### The order, and why

Finish first: it is the lowest score in both reviews and the cheapest to raise. Then the districts' own faces and fronts,
which most of the district scores turn on. Then the centre's payoffs, then the street level. The game-side items (a city
past the fence, the pads' rings, the night) need no bake, so they are built while each batch bakes: a full bake takes 70
minutes to two hours on the shared PC.

Each batch is one map version and one full bake; each milestone in it keeps its own checks (a new check proven by
putting the fault back, the touched e2e section, photographs by day and by night) and docs.

**Batch 1, map version 97: finish and readability** (built 2026-10-20, with 680, 681 and 682: Milestones 667 to 668 and
680 to 682 in docs/DEVELOPMENT_ROADMAP.md)

- **667: the finish sweep**, each fault looked at in its picture first, then traced to its piece:
  - THE STRIP: the black slab standing alone in the boulevard (d16, d98) and the untextured black cube by the club (d17);
  - the dark specks floating in the sky (d00, centre 03 and 10);
  - the pink see-through sheet at the boundary corner (d12), the white chevrons (d14), the blank white billboard (d08),
    the black square on a capsule roof (d03), the GLASS HEIGHTS board standing out past its tower (d13);
  - LANTERN ALLEYS' lantern lines given a mast where they meet (d02);
  - the base hall's white kiosk that reads as a train carriage (centre 07), replaced with counters and kiosks;
  - the tower floors' ceiling lamps set flush (centre 11, 13, 28);
  - the sunken court's crates and machinery lit (centre 20);
  - THE TERMINAL's vault roofs, solid black from above (d09);
  - the hard ground seams and dirt patches (d01, d24);
  - the sun drawn as an ellipse (centre 14).
- **668: the pads read as pads**: a ring of light on the ground round each pad in its district's colour (game side) and
  its beam cut to a short stub; the edge's red lines made thinner.

**Batch 2, map version 98: the districts' own faces** (built 2026-10-20 as Milestones 669 to 672; GLASS HEIGHTS'
deck and lift, THE CANYON's stalls and roofs, the fronts' own pieces in LANTERN ALLEYS, THE STACKS and THE TERRACES
still to do)

- **669: GLASS HEIGHTS in white glass**: its towers' window grid worn as the pack's light glass, its crown cyan; its
  27 m deck dressed (glass windbreaks, planters, benches); its glass lift's cabin framed so it reads (d13, d14, d15).
- **670: THE CANYON a market**: stalls under awnings and hanging signs down its floor (d19, d20); its cliffs broken by
  balconies, AC units, awnings and shop signs; its 48 m roofs broken by sheds, tanks and sign frames (d21, aerial).
- **671: the fronts and courts**:
  - LANTERN ALLEYS' silver capsule pods out of its rows, stalls in its court (d01, d02);
  - THE STACKS' car park in parked cars and booths, food stalls in the hotel court, its roof dressed (d10, d11, d12);
  - THE TERMINAL's forecourt kiosks and a taxi rank, wagons at its platforms (d07, d08);
  - THE WORKS' ring in containers and pipe racks, its yards' cover 1.5 m and taller, teal floodlights on its halls
    (d22, d23, d24);
  - THE TERRACES' grand stair on one lit line seen from the centre (d04).
- **672: THE STRIP's club**: a lit dance-floor grid, a DJ booth and speakers, a rig of lights over it, masts for its
  ribbons, the concrete ring out (d18).

**Batch 3, map version 99: the centre's payoffs** (built 2026-10-20 as Milestones 673 and 674; the deck materials, the
High City crowns, the tower floors' drop holes (675) and the corner blocks' silhouettes still to do)

- **673: the roofs**: cover on the base roof, the lookout, each High City roof and each bridge (centre 09, 10, 14, 15);
  a different crown on each High City roof (a helipad, a dish array, a roof garden, a pool); the walkable tops in deck
  materials with trims and edge stripes (14, 15, 19, 25).
- **674: THE VAULT a strongroom**: gold metal panels, a double-height strongroom with vault doors, display cases and lit
  high-tier crates (28). The old 676's first fix (the reach model on the 35 m floor) goes first.
- **675: the tower floors**: a drop hole or an atrium every second floor, ceilings with beams and ducts, the wall modules
  varied floor to floor (11, 12, 13).
- **676: the corner blocks and the plaza**: MARKET a canopy hall of crate stacks seen from the plaza, THE WELL a neon
  ring at its rim and a lit bottom, MOTEL HILL a pole sign (18, 19); a centrepiece in the plaza before the base (06);
  stalls in NOODLE square and MARKET street (16, 18).

**Batch 4, map version 100: the street level** (built 2026-10-20 as THE WELL's ring, MOTEL HILL's sign (676), the
walk-ins' doors (678's first part) and THE STRIP brightest (681's second part); the shopfronts, the rest of the doors
and the 16 to 20 m tier still to do)

- **677: enterable two-storey shopfronts** along the Loop and in each corner block (the old 673).
- **678: doors that read as doors**: a lit frame and an awning on every building you can enter, ledges and balconies to
  mantle (22); the base hall's stair core in view (07).
- **679: the 16 to 20 m tier** between the 12 m corner roofs and the 27 m High City roofs (the old 675), and a rail
  colour per zone (the old 679).

**Game side, built during the bakes**

- **680: a city past the fence**: a ring of low towers and ground carried on beyond the wall, fogged, their windows lit
  by night (both reviews' first ask for the frame of the map).
- **681: the night pass**: each district glowing its colour from the air (THE STACKS pink, THE WORKS teal, LANTERN
  ALLEYS red, GLASS HEIGHTS cyan, THE TERMINAL amber), pools of lamp light on the ground, THE STRIP the brightest.
- **682: the loot spots' own light** (PHASE_29 item 11, the map's half after the lobby's beams) **and the decay
  re-timed** for the districts' sizes.

**After map version 100 (the fresh reviews of 2026-10-21: the centre 5.5, the districts 5.3)**

- **Version 101:** THE CANYON's roofs and bigger signs, the beams and the pads' cones cut down, the club's rig out, THE
  TERMINAL's vaults amber, GLASS HEIGHTS' chevrons in their texture, the tower floors' marble replaced, GLASS HEIGHTS'
  deck dressed, a third stall in LANTERN ALLEYS' court.
- **Version 102:** GLASS HEIGHTS' and THE STRIP's towers lit at their corners and crowns, THE TERRACES' grand stair lit,
  THE TERMINAL's lights in their texture, container trailers in THE WORKS' yards.
- **The rest, planned 2026-10-23** (the owner: "plan it all out ... continue until we have all the map planning stuff
  finished"), one map version each, about 3 to 4 hours apiece on the shared PC, shipped as each passes:
  - **Version 103 (Milestone 686), roofs into islands:** cover over THE STACKS' hotel roof, THE WORKS' hall roofs and
    GLASS HEIGHTS' three back decks, as new perches laid last (each measured off the collision, its roof kept walkable);
    THE TERRACES' tiers given planter walls and trees.
  - **Version 104 (Milestone 687), industry and market:** THE WORKS' pipe runs across the yards between its halls,
    machine rows in its halls, its facades lit by day; THE CANYON's floor hung with lantern lines and awnings over its
    stalls.
  - **Version 105 (Milestone 688), the lighting pass:** fill light in THE TERMINAL's concourse and THE WORKS' halls;
    THE STRIP's dance floor a lit grid and its pyramid's steps edged in light; MOTEL HILL's yard and MARKET lit.
  - **Version 106 (Milestone 689), the centre's ground and THE VAULT:** more cover on the plaza and the Loop, in
    clusters; THE VAULT's gates as gold vault doors, gold edging round its halls, its loot lit.
  - **Version 107 (Milestones 770 and 771), the close:** the final reviews (the centre's round 10, the districts' round
    4) and a last batch from their lists; then the frame measured with the PC unused (the owner's call when).
  - Tried and dropped: a neon ring round THE WELL's rim (twice), a different crown set on each High City roof, more
    stalls in NOODLE square and MARKET street. The page: https://claude.ai/artifact/VtTRbvjkrHzHbe82hxm5xb.
- **After the tenth reviews (2026-10-24, on version 105: the centre 5.5, the districts 5.4, finish 4.5 in both)**, the
  owner: "rate the map ... and give clear next steps to get a better rating". The close (version 107 above) became:
  - **Version 106 (Milestone 689), the finish faults and THE VAULT:** the district towers' outlines, the pads' and corner
    blocks' beams, the flying cars on the lantern lines, the pale zip ropes, the brown panels and patches; THE VAULT's
    gold doors, floor, strips and edge; the centre's street cover real; three review spots out of the geometry.
  - **Version 107 (Milestones 770 to 772), the ground and the climbs:** fill light so shaded faces are not black (MOTEL
    HILL's yard, THE WORKS' halls, THE TERMINAL's domes); a lit marker at the foot of every lift, pad and fire escape;
    staggered cover on the bridge ring's spans; rows of cover every 15 to 20 m on the bare floors (THE CANYON's floor,
    LANTERN ALLEYS' mouth, THE TERRACES' top tier, THE STACKS' court, THE WORKS' yard).
  - **Version 108 (773 to 775), each district its own:** its own cover kit in place of the shared cabinet and planter;
    THE TERMINAL a station (wagons in view at its platforms, departure boards for its blank panels); THE WORKS' halls
    with gantries and machine rows; THE TERRACES seen from the centre; THE CANYON's lanterns traded for hanging signs.
  - **Version 109 (776 to 778), the edge and the night:** low lit blocks in the dark moat past the fence; the districts
    lit by night.
  - **Then the reviews' round 11 and the districts' round 5.** Larger asks after that: an atrium through the tower's
    floors, the High City blocks in different shapes, roofs cut into islands with gaps. The jagged shadows are the
    renderer's (the lobby side).

**Last**

- **683: the frame measured with the PC unused** (the detail-mapped and cut-out batches if it misses the bar).
- **684: the final reviews**, the centre's round 9 and the districts' round 3. Done if both meet the bar; otherwise
  their lists become the next milestones.

## The owner's calls, decided 2026-10-18

- **The golden-hour haze:** thinned (Milestone 658).
- **The bloom on the lamps and ceiling lights:** almost none (658).
- **The night fog:** just a little (658).
- **The old bakes:** deleted (91 GB).
- **The frame rate:** last, benchmarked with the PC unused (Phase 3).
- **Shadows** dithering on the flat roofs (14, 15, 19, 25) is the renderer's shadow resolution, handed to the lobby
  agent.

## Risks

- **The texture arrays on weak graphics cards.** Each array is kept under 128 MB, the smallest single allocation
  Direct3D 11 promises, and WebGL 2 promises 256 layers. If assembling an array still fails, the city is reported as
  failed through the lobby's reload message (Milestone 629), never drawn white.
- **Bake time.** A full bake is 70 minutes to two hours on the shared PC (the arrays' square layers and the other
  agents' load). Each batch takes test bakes at lo and one full bake; the game-side items fill the waits.
- **Reach-model mismatches** like the one on the 35 m floor. Every placement is walked by the real player check, as
  now.
- **Machine load.** e2e runs that flake under load are rerun alone, as now.
