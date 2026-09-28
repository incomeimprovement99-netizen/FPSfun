# Phase 25: a district made of a pack's own demo scene

Started 2026-09-28, on the owner's word after Milestones 298 to 301: "it still doesn't look like what the assets look
like in the store pages ... we can see through objects a lot and they don't mesh well. Lets try to redo one of the
corner, smaller districts with the exact assets from the bought packs. i want to see if we were just failing to place
them on a map we designed before hand or if we are actually struggling to rip out the assets and place them in the
map." Then: "Just continue with the one district with the exact assets til it's playable so I can test it."

## What was asked

1. One corner district rebuilt from a bought pack's exact assets, whole, as the pack's artist put them together.
2. Pictures of the store page against the game from the same spot, with barely a difference, the lighting included
   (F8 toggles the pack's own look).
3. The pipeline examined, so that what works for one district scales to the rest of the map.
4. The Gulag's bot: a 3 s countdown, then it comes looking for you.
5. That one district playable, to test.

## The answer: taking the assets out works; placing them on our own layout was the fault

- The corner baked from High City's demo scene (2,640 parts, 601,571 triangles) draws the same geometry and materials as
  the pack's own scene does from the same camera (the comparison pictures sent 2026-09-28). The assets were never lost
  on the way out.
- What made the city look unlike the store was composition. Phase 24 took the pieces out of the artists' streets and
  laid them over a map drawn before them: strips stacked up our towers, modules pressed onto our faces. The store's
  pictures are the composition itself, meaning the canyons' proportions, what stands in front of what, and the air.
- What was left after that was staging, and staging is ours to set: the haze's colour and depth, the sun and the sky's
  fill, the colour grade, the windows' glow by day. Each is now a district's own (`citydistricts.json` look), applied
  while you stand in it.

## The pipeline, one district at a time

1. `src/config/citydistricts.json` names a pack's demo scene, where it goes on the map (`origin`, `at`, `yaw`), what of
   it to keep (`keep`, `radius`), the city blocks it replaces (`blocks`), its plan (`hole`), its look, its pads and how
   its collision is filled.
2. `tools/import-city.ts` (`CITY_DISTRICTS=1`) bakes the scene straight into the map's coordinates as
   `public/models/paid/city/<id>-v<version>.glb` (a bought file: served by the game server, never in git), and measures
   its collision off its own triangles (`districtSolids`) into `src/config/districts/<id>.solids.json`.
3. `src/game/city.ts` builds the replaced blocks and takes them away again, so the city's random stream and everything
   drawn after them stay as they were. It adds the district's collision and its pads, found off that collision, and
   keeps the city's own street things (parked cars, the sectors' edge lines, the bots' street graph and drop points)
   off the district's plan.
4. `src/game/citydistricts.ts` loads the file as the page opens. `atmosphere.ts` and `render.ts` stage the look inside
   the plan.
5. `tools/checks/sk-district.ts` (in verify) plays each district with the real movement.

Another pack's demo street (Kyber's, Cyber's) is one more entry in the config, one bake, and its canyons and pads
measured off the collision's cross-sections, then the check.

## The collision of a film set

The demo scenes are film sets, faced only where the camera looks: no backs, no insides, no collision of their own. So
the collision is measured off the triangles on a half-metre grid: in each cell, the heights its triangles span.

Behind the faces there is nothing to stand on. A flood from the canyons' floor marks where you can walk at street level.
Every other cell of the plan becomes its building, solid up to 40 m, and a walkway's cell is solid down to the street.
The first bake's flood got out at the end of an arm, where the walkways start late, and filled nothing behind the faces:
10,316 half-metre cells of the plan stood open at street level. Kept to the canyons' floors (`fill streets`), none are
open. The check fails on that first bake and passes on this one. 6,312 boxes.

## Playable (Milestone 303)

- **The canyons** are 6.5 to 11 m wide at the city's street level. The two arms inside the map meet the city's own
  streets at their ends, and the other two run out to the map's edge.
- **The walkways**, 7.75 m up either side, are about 6 m deep, with a line of posts every 2 m, 2.5 m in. The corner
  plazas and the alleys off them are the scene's own.
- **Five pads** go up from the canyons' floor. Their spots are in the config. Each one's face and height are found off
  the collision, and each lands you 1.2 m past the walkway's front, short of the posts (the city's 3 m landed you on top
  of one).
- **Loot of its own** (`loot.json districts`): 12 spots a match on its canyons' floor and walkways, a metre and more
  from any edge, drawn last on a stream of their own, so the rest of the field's loot lands where it did.
- **`?dropat=high-corner`** drops a solo battle royale straight onto its crossroads, no ship.
- **Off its plan:** the city's parked cars and the sectors' edge lines. That line was the orange stripe across the
  canyon floor in the first pictures, and it ran on into the buildings. The bots' street links and drop points stay
  clear of it too.

## Known limits

- Rails and bars thinner than 15 cm (`stick`) have no collision. The posts do.

## The bots, and what stands on the walkways (Milestone 305)

- **On the bots' graph:** a node every 6 m down each canyon's middle, from the city's street past an arm's end through
  the crossroads to the map's edge; its five pads, one way up; and its walkways as a grid of nodes every 3 m where the
  collision's top is a walkway's, linked where a bot walks both ways and kept where the walk reaches from a pad's
  landing. A line of nodes laid along each walkway from its landing stopped within a step or two, because the walkways
  are cluttered in front of their posts. 34 nodes in the canyons, 48 on the walkways, about 40 ms on the city's build.
- **What stands on a walkway is solid down to it** (`fill body`). A crate's or car's top alone in a cell, its sides in
  the cells round it, had hovered a hand over the deck, a ledge a bot walked into.
- **No 40 m pillars:** a cell with walkway on two sides and more (a lamp post's foot, a gap in the deck) had been filled
  as building, to 40 m, invisible above the lamp and in the way of shots. It now takes its own height or the walkway's.
  6,312 boxes became 5,406.

## The white slabs (Milestone 307)

Plain grey slabs showed in the gaps between the district's faces and over its skyline. They were High City's backdrop
buildings "fill build 08" and "09" in the importer's grey stand-in, 680 triangles. Part of it had no material the
importer could find: its FBX asks for "Material #3020", and its import settings name materials the way Unity's "By Base
Texture Name" does, after the texture that material uses, "fill build 1.psd". The rest was placed with the material
inside the FBX itself, which Unity makes from the same texture. The importer now does both (`Pack.matByTexture`), and
no part of the district is in the stand-in.

## Its backs (Milestone 308)

From the city's streets round it, the district showed bare frames against the sky: its facades seen from behind. The
film set is faced only toward its canyons, and single-sided faces vanish from the back, leaving only their thicker
framing. Its opaque materials are now drawn from both sides (`look backs`), so from outside it reads as solid brick
buildings. That cost nothing measurable, within 0.15 ms either way at four spots, interleaved over three rounds.

## Its file (Milestone 309)

The district was one 51 MB file for every preset: 19.7 MB of textures and 31.3 of geometry. Its geometry is now
meshopt-compressed (positions and texture coordinates exact, normals to 8 bits), which makes the file 31.3 MB. Competitive
loads its own at the kit's lo texture size, 24.1 MB. Same picture on Balanced.

## The city kit the same way (Milestone 310)

The kit's own pack files, re-imported as v8 with the importer's new rules: their geometry meshopt-compressed (Balanced
loads 114 MB where it loaded 135, Competitive 37 where 44, High 338 where 359; the kit is mostly textures, so less is
saved than on the district), and High City's last grey parts in the kit (20 triangles) in their materials.

## Next

- Kyber's facade strips still draw 15,440 triangles in the grey stand-in: its metro tunnel pieces, whose FBX materials
  ("tonnel14", "up circle") name no material of the pack and carry no texture, and whose scene overrides are among the
  1,020 the importer cannot place on a mesh.
- More of its loot up on the walkways: most of it lands on the canyons' floor, since the walkways' collision comes
  in strips too narrow to count as a floor.
- Kyber's and Cyber's demo streets as districts of their own.
