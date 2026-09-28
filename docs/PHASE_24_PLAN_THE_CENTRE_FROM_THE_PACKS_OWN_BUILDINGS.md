# Phase 24 plan: the centre rebuilt from the packs' own buildings

**Written 2026-09-28**, before the first edit of the round. It replaces what was left of Phase 23 after 23.3; results:
`docs/PHASE_24_THE_CENTRE_FROM_THE_PACKS_OWN_BUILDINGS.md`.

The owner, 2026-09-28, after the side by sides: "Ensure we have all of the textures working appropriately and that the
skyscrapers actually make sense and you seemed to have missed out on what red tiger is on hyperscape, i want an inside
area as well to fight in on the bottom floor, likke the metro area. so most of hte buildings just look like trash ... the
one we bought has grey buildings with balconies and shapes in and out, why couldn't we just stack those on top of each
other and things like that? like "apartment" buildings? ... you may need to take a step back and look at how bad it
looks overall ... its very clear ours looks like a 3rd grader drew it compared to a professional on the website".

## What stepping back found

- **The files and the engine were never the problem.** Every pack ships the demo street its store pictures are taken
  from (High City's `Demo City.unity`, 1,903 placed pieces; Kyber's `DemoScene.unity`, 1,914; Cyber City's `city.unity`,
  2,581; the FP pack's `Demo - CITY LIGHT.unity`; Glass's `DemoScene URP.unity`). High City's, baked whole by our importer
  (`CITY_SCENE`) and drawn by a renderer like the game's (`tools/sceneview.html`, `tools/scene-shot.ts`), looks like the
  store: brick and stone, fire escapes and catwalks on every building, pipes, AC units, lamps, the taxi. Our centre, from
  the same pieces, looks like a sketch.
- **So the difference is composition.** We tiled one wall module per bay up a box twenty storeys high, pressed its depth,
  filled faces with flat panels, and put a fire escape on one face in eighteen. The packs' artists build each building
  from dozens of pieces: a base, stacked storeys that step in and out, ledges and cornices, balconies and escapes, pipes
  and vents, a roof line. No pack has a whole-building prefab: the buildings exist only as assembled in the demo streets.
- **Red Tiger was misread.** What could be verified: Hyper Scape's Red Tiger is the district at the middle of Neo
  Arcadia, its buildings French in style (Paris), the busiest drop with the best loot, its landmark a raised
  platform-shaped structure with a second floor. The README's "after Red Tiger: nine podiums joined by bridges" was this
  project's own invention, not Red Tiger. The owner's ask is plain in any case: an inside area to fight in on the bottom
  floor, as the metro is.

## The items

| id | item | how | verified by |
|---|---|---|---|
| 24.1 | **All five demo streets baked, their textures whole** | `CITY_SCENE` for each pack; the 758 material overrides the scene bake could not place fixed (a model's mesh by its override's own name where the ID cannot be computed); an audit of every material in each scene | pictures of each demo street in our renderer beside the store's; `tools/kit-audit.ts` over the scenes |
| 24.2 | **The packs' buildings, cut out of their demo streets** | Each demo street cut into its buildings: the pieces clustered by footprint and height (a building is the pieces standing together, walls to cornice), each baked as one piece with its measured footprint, height, storey height, faces and their depth; a catalogue in `citykit.json` (`buildings`) | a contact sheet of every building cut; each whole in the picture, nothing of its neighbours |
| 24.3 | **Towers that are stacks of the packs' buildings** | Each centre tower rebuilt as a stack: a pack building at its base, others of its family on top, stepping in and out (a stack's footprint the building's own, so set-backs and balconies are real), the tower's height the stack's. Collision from each stacked building's measured envelope (its walls a box, its balconies and escapes' landings their own), so the silhouette is the art's. The gameplay kept: the Sky Lobby's and the Sky Park's floors, their bridges and windows, the chimneys, the pads and the stair cores re-placed on the new towers and walked again by their checks | every walking check (`sk-lobbies`, `sk-chimneys`, `sk-stairs`, `sk-escapes`, `sk-roofs`, `sk-roofrun`, `city-levels`); side by sides against the store at street level and from above |
| 24.4 | **The ground floor inside** | The podiums' street floors opened into halls to fight in (arcades, a market, a lobby), their fronts the packs' shop fronts and doors you walk through, joined to the metro's stairs and the stair cores, lit inside | a walk through every hall and down into the metro; the bots' graph through them |
| 24.5 | **Light and air, and the old look gone** | The coloured haze and wet streets (Phase 23.4b, held back unshipped), the packs' cars on every street, the pads and kerb lines in pack parts | side by sides; a bench |
| 24.6 | **The release tests** | e2e for the sections touched, then the full batches and `npm run fit` once | green, or each failure named |

## Order and time

24.1 and 24.2 first, since 24.3 is built from them: about four hours. 24.3 is the bulk, about a day: the gameplay layer
(lobbies, bridges, chimneys, pads, stairs) was fitted to today's boxes and has to be fitted again. 24.4 half a day.
Phase 23's unshipped work (whole modules, stacked bands, ledges, two escapes a tower, the haze) stays in the worktree:
the haze and the escapes carry over; the module work is superseded by 24.3.

## Re-ranked after Milestones 298 and 299 (2026-09-28)

What the pictures of the shipped build showed, in the order the eye finds it, and so the order of the work:

1. **The pads in the packs' parts (24.5).** Their gold beams and rings are in every view and are the loudest thing of
   the old look. A pad's base from the packs (High City's round vent laid flat), its beam slimmer and softer, one ring
   where it lands you; still readable from a street away, which is what a pad is for.
2. **The halls, part two (24.4b).** Kiosks, vending machines and food stands from the packs as cover in the middle of
   each hall (it is open between its columns), a gallery round the walls at the podium's first storey, and a stair down
   from a hall to the metro beside it, so the inside areas join up as the owner described.
3. **The street's density (24.5).** The Kyber demo street's clutter at street level: cables overhead between the
   buildings, pipes down the walls, litter, grass in the cracks, traffic lights, as the store pictures have.
4. **The canyons' faces.** 41,000 m² of the towers' faces still wear the pressed modules; strips there need a shallow
   pressing that does not flicker.
5. **The towers' lines of light.** The cyan edge line on every tower was the city's look before the packs; on the
   faces the strips dress, it fights them.
