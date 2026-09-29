# Phase 26 plan: finish the corner, then rebuild the middle the same way

Started 2026-09-28 from the owner's feedback after playing High City's corner (Phase 25). Every request is listed here,
in the owner's words where they matter, so none is lost. Each item is built, tested, documented, committed and shipped
in turn, and marked here as it goes.

## What the owner asked

> "the slam doesn't seem to do any damage to an enemy, it should show the radius circle around the player when they are
> landing to visually show if it will hit or not and if it hits give the damage number."

> "i was able to glitch into the corner map area. So, obviously buggy and not what we want."

> "This corner of the map, visually, was pretty good though. It looks like 10x better than our current middle district
> ... we should just straight up finish this corner of the map and we should wipe that middle district out. When we
> finish this corner out, we will have a better idea of how to build the bigger and better one for the middle."

> "techinically wallrunning is working, but it should twist the camera a bit and have some sort of visual feedback that
> we are indeed wallrunning, like empulse does. we aren't sure if we want to keep wallrunning but we will have it in for
> now."

> "make a planning document as well so you don't lose track of any request here"

> "remember for the map, there was alot of apartments, like 3+ storeys and the roof gameplay in hyperscape, that was
> extremely common and we should utilize that, regardless of if its apratments or those grey, in and out shaped
> buildings with balconies on our pack, the main ones we use for larger buildings. Should be able to double jump between
> the rooftops, determining how wide the street should be, and the main center district should have a large building
> that has the 1st and second floor in it and the jump pads to the roof. if that isn't possible with your current assets,
> don't do the half baked bullshit we did with the initial spire district, bc it looks really bad right now. the layout
> and shape is great, just asset wise its not there."

Before that, the same day: "Do one quick bug hunt to ensure we are good on the map and tell me how many building assets
we are using out of how many."

## The order

1. The slam (26.1) and the glitch (26.2): broken things the owner hit.
2. Wallrun feedback (26.3): small, and the owner will judge wallrunning with it.
3. Finish the corner (26.4), item by item.
4. Then the middle (26.5): wiped and rebuilt the corner's way, bigger. The owner's order is the corner first: "When we
   finish this corner out, we will have a better idea of how to build the bigger and better one for the middle." The
   middle stays as it is until the corner is finished and the rebuild starts; wiping it first would leave the map
   without its centre.

## Items

| id | item | state | milestone |
|---|---|---|---|
| 26.0 | The bug hunt: the storage cases' glow 404; the building assets counted | shipped | 314 |
| 26.1 | The slam hurts enemies in every mode; its radius on the ground while you fall; the damage number on a hit | shipped | 315 |
| 26.2 | Nobody gets into the corner where they should not | shipped | 315 |
| 26.3 | Wallrunning: the camera leans, and you can see you are on the wall | shipped | 315 |
| 26.4 | Finish the corner: the fire escapes up its walkways; the arm ends closed; loot and bots up on the walkways | in progress | 317, 318, 320 |
| 26.5 | Wipe the middle district and rebuild it the corner's way, bigger | moved to Phase 28: the owner bought Daelonik's Neon City for it (`docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md`) | |

### 26.0 The bug hunt (done)

- Live, a solo battle royale dropped onto the corner: the district drawn 12 s after the page opened, the landing on the
  crossroads' street, still standing 5 s on, the city kit and the district drawn whole (6,443 pieces; 612,049
  triangles). Pictures of twelve spots (both arms' ends, the map's edge across the south and east arms, the walkways,
  the plaza, the edge from the city's streets, the pads, from above): nothing broken.
- **Found and fixed:** the storage cases (the death box, the supply bin) asked for a glow map their pack does not have,
  a 404 each time one was drawn. The importer now writes a black one where the pack has none, and `paid-weapons.ts`
  checks every skin has all four maps (it fails on the live files, passes with the six written).
- **Found, cosmetic (26.4):** at the west arm's walkway end, High City's backdrop building stands a few metres off, its
  texture made for the distance and blurry that close.
- **The count** (`import-city.ts PREFAB_REPORT`, `tools/.scratch/assetcount.ts`): the five packs hold 741 prefabs,
  313 of them building pieces (walls, facades, roofs, parapets, shop fronts, rooms, fire escapes, construction). The
  game draws **220 of the 313**: 92 whole (the centre's dressing), 127 inside the facade strips it places, 120 in the
  corner, many of them more than one way.

  | pack | building prefabs | drawn | whole | in the strips | in the corner |
  |---|---|---|---|---|---|
  | High City | 136 | 122 | 38 | 65 | 120 |
  | Kyber | 62 | 45 | 15 | 39 | 0 |
  | Cyber City | 79 | 51 | 37 | 23 | 0 |
  | Glass City | 20 | 2 | 2 | 0 | 0 |
  | Cyber City first-person | 16 | 0 | 0 | 0 | 0 |
  | all | 313 | 220 | 92 | 127 | 120 |

### 26.1 The slam

Found: the slam did hurt a battle royale's bots (20 off a shield in a test), but a hit showed no number, and it counted
enemies by their distance in the air, so one a storey off counted and one at the ring's edge on the floor did not. With
nothing on the floor to aim by, it looked as if it did nothing.

- Its damage reaches every enemy in its radius in every mode: a battle royale's bots, a duel's players and figures.
- While you are up and coming down, its radius (`hacks.json slam radius`, 5 m) drawn on the ground under you, in a
  colour that says whether an enemy is inside it.
- On a hit, the damage number, as a shot's.
- Tests: an e2e check in a battle royale, a bot inside the radius and one outside, proven by the old finder.

### 26.2 The corner's glitch

Found: the corner's collision filled every building up to 40 m whatever stood there, an invisible floor over every
lower building and every empty lot: from above, 2,458 of the corner's 1 m spots landed a body on nothing drawn. Fixed
(Milestone 315): each building filled to its own height, its hollow insides drawn as dark blocks with roofs, the
scene's open ground round its buildings left undrawn and solid to 200 m; no spot now lands on anything undrawn.

The candidates as first listed:

- The collision behind the faces is filled up to 40 m whatever stands there: an invisible floor over the corner's lower
  buildings, and over empty ground, that a player lands on from the dropship's glide or a tall roof nearby.
- The walkways' alleys run to the edge of the corner's plan, where the film set ends.
- The plan's edges against the city's streets, and the arms' ends.
- Tests: a check that no surface to stand on in the corner is higher than what is drawn there, and walks from the
  city's streets and roofs round it.

### 26.3 Wallrunning's feedback

Kept for now; the owner will judge it with this.

- The camera leans away from the wall while you run it (as Empulse does), easing in and out.
- Something else that says you are on the wall: streaks down the wall's side of the screen, or a mark on the HUD.
- Tests: the lean read from the camera during a real wall run and gone after it.

### 26.4 Finish the corner

The corner as a finished place to fight:

- 26.2's fix, and walks round every edge.
- The bots up on the walkways, not only in the canyons (the graph reaches them, and in a test match none went up).
  **Done (Milestone 320):** each pad's landing is high ground a bot takes and holds as it takes a low tower's roof
  (`city.ts DISTRICT_HOLDS`, `brmatch.ts roofFor`); proven in a real match.
- More of its loot up on the walkways; most lands on the canyons' floor. **Done (Milestone 318):** half the corner's
  spots are drawn from the walkways' own decks (`loot.json districts walkways`); 7 to 9 items up there a match.
- Ways up besides the pads, in the packs' own pieces, not ours (the owner, 2026-09-28: "pretty sure there are versions in
  the asset packs"): High City's fire escapes (sets a, b and c: a tile to stack, a foot with its drop ladder, a top over
  the parapet), Kyber's ladder set (tiles A and B, its top and foot), Cyber City's fire ladder. The city already hangs
  High's b set and Kyber's tile A up 18 towers, walkable, their solids measured off the pieces (`tools/measure-escape.ts`);
  here they go up the walkways' fronts from the canyons' floor, measured and walked the same way. The demo street
  itself has none from its floor, since its canyons are bottomless.
  **Done (Milestone 317):** the city's builder is shared (`city.ts escapeAt`, the city's 31 unchanged box for box) and
  the corner's hang from `citydistricts.json escapes`. Every quarter metre of the four walkway fronts was tried by the
  city's rules: High City's set fits only on the north arm's east front, and hangs there twice (z 89 and 122.6). The
  others were turned down for what is on them: ledges at 3.05 and 7.05 m the length of the west arm's south front; a
  ledge with a wall to 9.2 m behind it and no walkway on its north front; a block standing alone in the canyon on the
  north arm's west front; the blurry backdrop building at the west arm's end. Kyber's narrower set would fit more,
  but as another pack's look on High City's street, so not.
- Its arms' ends: the backdrop buildings close up, and the drop from the west walkway's end to the street.
  **Found with the fire escapes:** the scene's open ground (solid to 200 m and undrawn, Milestone 315) meets ground you
  walk on in four lots, each an invisible wall where the street seems to go on. At the north arm's end, west of its
  canyon (x 108 to 126, z 60 to 85): an empty lot between the city's building and High City's, seen from the canyon and
  from the city's street along z 60. Beside it, east of the east walkway (x 140 to 152): a narrow lot at the map's edge,
  a facade seen edge on. Either side of the west arm's end (x 60 to 92, z 108 to 125; x 60 to 120, z 141 to 152), from
  the city's street along x 60: the backdrop's blurry faces close a courtyard.
  **The plan for them (26.4b, the film set's backs closed):** measured, the undrawn fill is four big pieces, one at
  each arm end (623, 557, 439 and 328 m²), each beside the street or a canyon along 120 to 180 half metres, and three
  small ones behind the east walkway. Rectangles laid over them do not fit: the film set's backs step round its
  buildings, so a rectangle either leaves fill beside its roof (an invisible wall up there) or cuts into the scene's
  corner building. So the pieces themselves become buildings. The importer (`districtSolids`) makes every piece of the
  fill that meets ground you stand on into solid blocks up to its neighbours' measured height, not 200 m, with a roof the
  city draws; the faces it shows to the street, a canyon or a walkway go to the kit, which dresses them in High City's
  own facade strips as it dresses the centre's High City towers (whole buildings cannot be lifted out of High City's
  street: Phase 24.2 found them one blob). A piece that meets nothing you stand on stays as it is. And the backdrop's
  pieces made for the distance that stand inside the map (`fill build 07`, the blurry block at the west arm's end, and
  `fill build 09`, which stands 6 m out onto the city's street at x 54) are left out of the bake. The check that should
  have caught it (`sk-district.ts`, nothing undrawn beside anywhere you stand) fails on the live corner: 491 half metres.
  **Done (Milestone 318):** 0 now; the backs 20, 24 and 28 m, drawn as the city's own buildings, their fronts in High
  City's strips from Balanced up; 17 backdrop parts left out (district v5); the kit's limits raised by the fronts' 125k
  triangles on the fire escapes' precedent, and benched once the machine was quiet: Balanced 11.6 ms against 11.5, High
  20.9 against 20.7, inside the rounds' spread.
- The kit's recovered parts (Phase 25's v9: High City's fire escapes 2 m wider, the triangle budgets) where they touch
  the corner.
- The rest of what a playtest finds.

### 26.5 The middle, rebuilt the corner's way

After 26.4. The owner: wipe the current middle district and build "the bigger and better one" as the corner was made:
the packs' own buildings, whole, as their artists made them, staged, with collision measured off their triangles. The
owner's brief for it (2026-09-28):

- **Rooftops you fight across, as in Hyper Scape:** many apartment buildings of 3 storeys and more, High City's
  apartments or the packs' grey buildings with balconies that step in and out (the ones the city already uses for its
  larger buildings), roofs you can stand and fight on.
- **Streets as wide as a double jump:** the street widths set by how far a double jump carries you from roof to roof,
  measured with the real movement, so the rooftops join up.
- **A large building at the centre** with its ground and first floors inside, to fight through, and jump pads up to its
  roof.
- **The layout stays:** "the layout and shape is great, just asset wise its not there." What changes is what the
  buildings are made of.
- **No half measures:** if the packs cannot make it look right, say so and do not build the half-made version the
  first Spire district was ("it looks really bad right now"). So the first step is a survey of what the packs have
  for it: whole apartment buildings and their floors, the balconied grey buildings, roofs you can stand on, interiors,
  measured, with pictures, before anything is placed. What the packs cannot give is reported, not faked.

What it is made of, how the Spire and the capture zone fit, and what goes first get planned when 26.4 is done, and the
owner decides the choices that are theirs.

## Carried over from Phase 25

- The city kit v9 (the parts found by Unity's mesh ID): within the triangle budgets, High City's fire escapes
  re-measured for their 8.09 m tiles.
- A model's GameObject and renderer IDs (not the mesh's hash): 1,020 material overrides placed by slots and names.
