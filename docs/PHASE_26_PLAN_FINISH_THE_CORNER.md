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
| 26.0 | The bug hunt: the storage cases' glow 404; the building assets counted | shipped | 313 |
| 26.1 | The slam hurts enemies in every mode; its radius on the ground while you fall; the damage number on a hit | shipped | 314 |
| 26.2 | Nobody gets into the corner where they should not | shipped | 314 |
| 26.3 | Wallrunning: the camera leans, and you can see you are on the wall | shipped | 314 |
| 26.4 | Finish the corner | | |
| 26.5 | Wipe the middle district and rebuild it the corner's way, bigger | after 26.4 | |

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
(Milestone 314): each building filled to its own height, its hollow insides drawn as dark blocks with roofs, the
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
- More of its loot up on the walkways; most lands on the canyons' floor.
- Ways up besides the pads: the demo's own stairs and fire escapes, where they reach the walkways.
- Its arms' ends: the backdrop buildings close up, and the drop from the west walkway's end to the street.
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
