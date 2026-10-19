# Plan: finishing the Neon City

The owner, 2026-10-17: "plan this part out deeply then finish out the city overall". The bar set before that: "we
should only be done when we finish all outside districts and they are all populated nicely along with the center being
a large ass and detailed place to fight".

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
- **664: THE WORKS made rust and machinery** (3/10).
  - The block hall's empty ground floor filled: machines, crate stacks, pipe runs, and stairs up to its ring in view.
  - The halls' grey walls in the pack's rust.
  - Outside, more tanks, pipes and a crane-like gantry (the pack's beam frames).
  - The light cones taken out indoors.
- **665: THE TERRACES made terraced** (3/10).
  - Retaining walls 3 to 4 m between the tiers, a wide stair seen straight from the ring road, and planted beds as
    cover.
  - The walk-through blocks' rooms given doors, windows and furniture.
  - The top tier's two blank pillars traced and taken out.
- **666: THE STRIP lit and finished** (4.5/10).
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
- **Bake time.** A full bake is about 30 minutes, and the arrays add the square layers. Each milestone takes one test
  bake and one full bake.
- **Reach-model mismatches** like the one on the 35 m floor. Every placement is walked by the real player check, as
  now.
- **Machine load.** e2e runs that flake under load are rerun alone, as now.
