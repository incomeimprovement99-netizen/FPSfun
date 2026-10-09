# Phase 28 plan: the map wiped, and the centre built from Daelonik's Neon City

Started 2026-09-28, the evening. The owner bought Daelonik's Neon City bundle and asked for a fresh start: the whole map
wiped but for its idea, the centre rebuilt from the bundle alone, the eight other districts plain for now. This plan is
the long planning step the owner asked for ("you really need to take a long planning phase to get to know each object
available to you (which is 100s so this is probably THE most important step)"): every prefab of the four packages was
rebuilt, measured and seen before any of it was placed. It takes over item 26.5 of
`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`.

## What the owner asked

> "the quality in the game doesn't look insane like AAA for their photos but they look way better than the ones we
> tried to sneak out $25 out with."

> "create a saved version of this map in git so we can always come back to it if needed. Then, keep the 9 districts
> with the center being the largest with underground and the tallest building. the rest how you described it. Just do
> the center for now. We want the best textures we can get and save that for the high quality settings, similar to how
> we did it before. you should really be able to tell now."

> "remember we are basically wiping the entire map except the idea. we want to have a fresh start and have in all the
> lessons we learned previously with building a map ... everything is just plain for now and is the smaller district
> sizes, just basic roads there if anything and we want to make the before vs after performance and triangle / polygon
> testing so that we can see the difference ... implement using all new assets, nothing at all should be custom made or
> not coming from the asset packs. if you have to look for something the most similar to one we have custom for, then
> look for the closest thing and make it work. Like the jump pads and path shown coming out of them is an ugly color
> that looks like we drew it in ms.paint."

> "Analyze, make the plan, build, don't stop til we have the center district laid out as planned. Then, once we have
> the layout, start adding in the detail, ensuring we utilize the underground, higher buildings, inside rooms to fight
> in."

Still in force from Phase 26's brief (26.5): Hyper Scape's rooftops ("Should be able to double jump between the
rooftops, determining how wide the street should be"), "the main center district should have a large building that has
the 1st and second floor in it and the jump pads to the roof", and "don't do the half baked bullshit".

## 28.0 The save point (done)

- Git tag `city-ilranch-final` on 5d8700b (Milestones 281 to 320), pushed: the city made from ILranch's packs.
- Its bakes, never in git: `C:\Users\jwilb\Downloads\speedkills-paid\city-bake-ilranch-final\` (521 MB).
- The frozen copy `apex-bench` is checked out at the tag and served on port 5212, the "before" of every comparison.

## 28.1 The inventory (done)

The four packages, unpacked (`C:\Users\jwilb\Downloads\speedkills-paid\neon\extract\`), are one pack: the three
expansions carry 3 to 6 materials and 4 to 70 models each and build on the core's.

| package | files | prefabs | models | materials | textures |
|---|---|---|---|---|---|
| SciFi Neon City (core) | 3,682 | 978 | 143 FBX (882 MB) | 625 | 1,092 PNG (3.7 GB), 376 EXR lightmaps |
| SciFi Neon Buildings | 545 | 332 | 4 | 6 | 38 PNG |
| SciFi Neon High City | 478 | 320 | 46 | 3 | 33 PNG |
| SciFi Neon Underground | 521 | 214 | 70 | 2 | 41 PNG |

- **Read by our importer, no Unity.** `tools/import-neon.ts` reads the four as one pack with `tools/import-city.ts`'s
  reader. All 1,826 City Builder prefabs rebuild (`NEON=catalogue`, `speedkills-paid\neon\catalogue.json`: each one's
  size, bounds, triangles, parts and materials); 14 material slots of 7 models and one mesh go unfound.
- **Found and fixed: the models' import scale.** Unity applies each FBX's Scale Factor (`globalScale` in its .meta);
  Daelonik's shared models import at 10 (some at 0.1, 8, 13, 80 or 200), and the importer ignored it: the buildings came
  out as clouds of specks a tenth their size. `Pack.unityScale` applies it, for this pack only (ILranch's are all 1).
- **Materials are Unity's Standard shader.** 613 of the 636 (the others: plants, water, one shadow). So colour, normal,
  metal and smoothness, occlusion, emission and height all read straight into glTF's material; the custom Amplify
  shaders that do not export are only on what the centre does not use.
- **Textures are a tiling library, mostly 2048.** 722 at 2048, 333 at 1024, 15 at 4096 (ads and effects). So High
  gets 2048, Balanced 1024, Competitive 512, as the kit's max, hi and lo files and the guns' skins are split.
- **Seen, every category**: `NEON=gallery` bakes contact sheets and `tools/neon-sheets.ts` draws them
  (`tools/neongallery.html`), 90 sheets over the 1,826 prefabs, each piece framed with its name and measured size.

### What there is, by what the centre needs

| role | pieces | measured |
|---|---|---|
| The tallest building | Neon Buildings / Realistic / **Neon Building 08** | 42.5 x 151.4 x 25.6 m, 211k triangles, 109 materials. Its levels (its room prefabs by height): a basement of underground rooms and ramp stairs (-7 to -3 m); the ground and first floors with working elevators, large ramp stairs and double stairs (0 to 9 m); elevator rooms (12 m); a floor of chamfered 12.5 m rooms and corridors (39 to 45 m); the tower (48 to 105 m); a roof room (108 to 129 m) |
| Other realistic buildings (interiors) | Neon Building 00 to 10 | 11 to 50 m wide, 13.6 to 111 m tall, 16k to 111k triangles; most reach 3.5 to 12.4 m below the street |
| Decorative buildings (no interiors) | Neon Buildings / Decorative, NeonBuilding_Decorative00 to 18 | 17 detailed: 10 to 37 m wide, 12.5 to 234 m tall (the 3 to 6 storey ones 12.5 to 24.5 m), 9k to 49k triangles; 2 low-detail skyline giants 206 and 262 m |
| More buildings | Essential / Decorative (StreetBuilding00 to 07, BuildingDeco towers, CityWalls facades) | street buildings 6 to 23 m wide, 10 to 144 m tall; facade dressings 9 m high |
| High City towers with walkable roofs | High City / Platform High (26) | rounded glass towers 26.9 m tall (9 storeys of 3 m), railed flat roofs; their pivot is the roof, their body hangs 26 m below it |
| Decks and bridges | High City / Platform Floating (32), Building Deco / Bridges (4) | decks 2.9 m thick with rails: 5 m bridges, crossings, islands, peninsulas, stairs; FloorBridge00 a 10 m ramped bridge |
| Raised walkways | High City / Platform Street (97), Streets Build / High City Streets (127) | walkways on 50 m scaffolds; high street modules |
| Rooms to fight in | Neon Buildings / Realistic / Rooms (110) | wall sets on a 5 and 10 m grid, 3 to 3.5 m high: square, rectangle, capsule, hexagonal, corridors, halls, entrances, underground rooms |
| Floors and walls | Building Interior / Floors (94), Walls (128), Building Pieces (59), Roof (16) | a 2.5 m grid: floors 2.5 x 0.5 x 2.5, walls 2.5 x 3 m |
| Streets | Streets Build / Streets (39) | road tiles with pavements: 10 x 5 straight, crossing, 12.5 corner, 15 x 12.5 T, 15 x 15 crossroads, composed 40 to 45 m lengths; raised concrete levels with steps, ramps and railings (3.4 to 4.8 m) |
| The underground | Underground premade (96) and deco (61) | metro tunnels 20 x 8 x 10 m and 38 m junctions, station modules 10 x 10.5 x 11, stairs down 4 to 5 m, a street entrance 5.3 x 14.4 x 20 m, arched halls and passages, a 22 x 27 m square atrium ring, an inverted building in a 76 m shaft; 4 metro trains, 34 signs |
| Ways up | Active / Elevator (8), Building Deco / Stairs (25), High City stairs | working lift cabins (a round glass one 4 x 3.8 x 4), elevator systems 12 to 14 m, stairs |
| A jump pad, from the pack | Building Deco / CapHole00 and CapHole01, Lighting / StreetFocusLarge00 (white, red, blue) | a round floor cap 4.8 m and an octagonal glowing plate 2.7 m; a light beam 2.5 x 91.9 m. Our pads' own ring and beam, "drawn in ms.paint", go |
| Cover and props | Building Deco (Furniture, Items, Coolbox, Tech, Fence), Street Deco (Street Furniture, Sidewalk, Street Elements, Cars) | crates 1 m, barrels 1.5 m, bars, counters, racks, fences and glass rails, benches, AC units |
| Doors | Active / Doors | 2.8 m doors, 5 m gates, thin doors |
| Light | Lighting (40) | lamps, strips, spots, Chinese lanterns, the light beams |
| Signs and ads | Street Ads (52), Road Signs (12), Underground Signs (34), Graffiti (39) | |

The pack's own store pictures (`%TEMP%\neon\store\`) are the look to meet: dense, hazy streets lit by neon, interiors
behind glass.

## What the old map taught (carried into this one)

- **Measure, never type.** Every size, height and storey comes off the pieces (the catalogue); every jump off the real
  movement (`tools/checks/reach.ts`): a sprint carries 11.35 m, a double jump 22.1 m rising only 1.69 m, a slide
  jump 16.7 m, a wall run's kick 27.75 m; a climb goes 5.59 m, a mantle 2.29 m.
- **Collision from the drawn triangles**, never invisible: nothing solid that is not drawn, and nothing drawn you fall
  through (Milestones 315 and 318: invisible floors and invisible walls were the owner's "glitch into the corner").
- **A demo scene is a film set; these are whole pieces.** Daelonik's buildings have four sides and roofs, and the
  realistic ones real rooms, so the fills that closed ILranch's backs are not needed.
- **Pivots lie.** Pieces are placed by their measured bounds, not their origin (High City's towers hang 26 m under
  theirs).
- **Draw calls, not triangles, are the cost** (a building carries 36 to 123 materials): the centre is baked as one file
  grouped by material, so the materials shared by every building draw once.
- **Every way up walked by a body, every bot link walked both ways, every pad's landing short of the rail.**
- **The streets as wide as a double jump:** 15 m, so roofs of the same height join and a lower roof is always reachable.
- **Loot where the fights are:** a share on the roofs and in the rooms, not all in the street.
- **Before and after, measured the same way:** `tools/map-stats.ts` (downloads, load, the scene's triangles, meshes,
  materials, textures) and `tools/bench.ts` (frame time, draw calls, triangles a frame), the old and new builds run in
  turn in the same session.

## The design

### The map

- The same nine districts and bounds (`city.json sectors`): the centre 200 x 200 m (x and z from -100 to 100), eight
  around it to the edge at 152, so the decay, the capture zone and the edge work unchanged.
- **The eight around it, plain for now:** the pack's road tiles on a ring road round the centre and on the centre's
  street lines out to the edge, the pack's concrete floor tiles between them. Nothing else.
- **The centre, the largest.** Since Milestone 360 its streets curve (the owner, 2026-09-30: "have them curve left and
  right along with buildings so that it's different visually"): the Loop round the tower and eight S-curved streets out
  to the edge road (`tools/neon-streets.ts`), the blocks laid along them; the master plan for every level is at
  https://claude.ai/artifact/Pa1VbqmLBvytX2gBVvK9fP. Before that, a 3 by 3 grid of blocks with 15 m streets centred on
  x and z of -36.25 and 36.25:
  - the middle block, 57.5 m square (-28.75 to 28.75): the tallest building;
  - four blocks along the axes, 57.5 x 56.25 m: the high city, High City's 26.9 m towers with walkable roofs;
  - four corner blocks, 56.25 m square: the low city, buildings of 3 to 6 storeys (12.5 to 24.5 m).

### The middle block: the tallest building

- **Neon Building 08** (42.5 x 151.4 x 25.6 m) in the middle, turned so its long side faces the plaza. It is exactly
  what the brief asks: its ground and first floors are rooms with stairs and working elevators, its basement is the
  underground's, a floor of rooms at 40 m is a sky lobby, and its roof room at 108 to 129 m is the top.
- A plaza of the pack's floor tiles round it, its cover the pack's bars, planters and crates.
- **Jump pads**, each the pack's CapHole plate with its StreetFocusLarge beam, from the plaza up to the building's lower
  roofs; its elevators up inside.
- The capture zone on its 40 m floor or its roof (the owner decides; the 40 m floor first, for a fight indoors).

### The high city: the four axis blocks

- High City's high platforms (Addon, Island, Peninsula, Crossroads: 10 to 55 m wide, all 26.9 m tall with railed
  roofs) filling each block's street fronts, so the roofs make one level at 26.9 m.
- **High City's floating bridges** (2.9 m decks, 5 m modules) across the streets between them and to the tallest
  building, so the roof level is walked and run the whole way round the centre.
- Their ground floors are glass fronts; the rooms kit where the towers are entered.

### The low city: the four corner blocks

- Decorative and realistic buildings of 3 to 6 storeys (NeonBuilding_Decorative05, 11, 12, 13, 14 and 15; Neon Building
  04, 05 and 06; StreetBuilding01, 04 and 05), their roofs 12.5 to 24.5 m, stepped so every roof is a double jump from a
  neighbour at its height or a drop to a lower one; the realistic ones have their rooms inside.
- Raised concrete levels with the pack's steps and ramps on the block's inner yard: the way up to the first roofs.

### The underground

- A metro station under the middle block (station modules, 10 m each, along x), joined to the tallest building's
  basement.
- Metro entrances from the street on two sides (MetroEntrance00, its stairs 7 m down), metro stairs down from the plaza.
- Tunnels out to the centre's edge under two streets, for later.
- The game's floor under the street (`floors.ts FLOORS`) where the underground is, as the old metro had it.

### Look

- The pack's own lights where its pieces carry them; the store's haze and night colours.
- High: 2048 textures; Balanced: 1024; Competitive: 512.

## The build, in shipped steps

| id | item | state |
|---|---|---|
| 28.0 | The save point | done |
| 28.1 | The inventory: every prefab rebuilt, measured and seen; the import scale fixed | done |
| 28.2 | The layout: the centre's placements from these rules, placed by measured bounds (`tools/neon-layout.ts`, `src/config/neonmap.json`), drawn from above for the owner | done |
| 28.3 | The bake: the centre and the plain districts into one file at three texture sizes, its collision off its triangles (`tools/import-neon.ts NEON=bake`) | done |
| 28.4 | The new map in the game (`src/game/neonmap.ts`): its ground, its collision, its districts and their places, the bots' graph, loot, pads, the drop | done (Milestone 325); SpeedKills' default since Milestone 328, the old city at `?map=city` |
| 28.5 | The first look beside the pack's own pictures, for the owner | done: the buildings and their textures are the pack's; its signs, props and haze are not in yet |
| 28.6 | Before and after: downloads, load, triangles, draw calls, frame times | done (below) |
| 28.7 | The detail: the underground station, the tallest building's rooms, the high city's bridges, cover | the station, the bridge ring, the court's halls done (Milestones 349 to 358) |
| 28.8 | The master plan, built in phases: the curved streets (Milestone 360); the Sky Ring walkway storey (Milestone 362); the base, the tower's wide lower floors (Milestone 365); the tower's floors (Milestones 368 and 370) and the way in from the base's roof (Milestone 374); glass lifts (Milestone 386); the Well (its galleries and rope, Milestone 387; its stairs, Milestone 388; its corridor from the station, Milestone 390; sealed behind its galleries, Milestone 392); life on every level (fire escapes onto the rooms buildings' roofs, Milestone 395; walled yards on them, Milestone 397; the corner blocks named, Milestone 402; each its own colour, Milestone 403; NOODLE ROW's street food, Milestone 404; MARKET's crates, Milestone 405; walk-in buildings on the curves, Milestone 406; zip lines from the roof yards to the High City, Milestone 407); the base's ground floor open and wide (Milestone 411); jump pads up the centre and back down (Milestone 413); open windows in the tower and its base (Milestone 417); pads up to the crown and cover on the perches (Milestone 420); the interiors lit from their lamps (Milestone 425); the tower floors' walls in the pack's panels (Milestone 468); each High City block in its own colour (Milestone 474); cover down the streets in pieces that look like what they collide as (Milestone 480); the tower's doorways framed and its numbers on black (Milestone 484); the sky floors closed over, numbered and each its own (Milestone 503); the High City climbed from the street (Milestone 465); the street level measured at a standing eye and its long lines cut (Milestone 458); THE VAULT marked from outside and thicker zip lines (Milestone 454); the tower's floors meeting its facade, the stairs checked, and each corner block's own thing at street level (Milestone 451); the streets' median and hover vans, 2 m floor numbers and the interiors' lights by preset (Milestone 443); the corner blocks' signs, the decks' landmarks and the tower's floors lit right in their own colours (Milestone 437); the roof routes (Milestone 432); the tower's floors numbered, finished and THE VAULT (Milestone 431); cover on the decks and along the streets (Milestone 429); the beams made to read (Milestone 424) | phases 1 to 5 and the base done; phase 6 begun |
| 28.9 | The checks: walked streets, every pad's landing, every roof joined by jumps, rooms walked, the drop lands only on what is drawn, the bots reach every level | |

### What building it found (28.2 to 28.4)

- **A third of the pack's surfaces are in their detail maps.** Unity's Standard shader multiplies `_DetailAlbedoMap` in
  (times 2 in gamma, 4.595 in linear) at its own tiling, weighted by `_DetailMask`; the asphalt's main map is a noise
  and the asphalt itself the detail, so read alone the roads came out white. The importer writes the detail maps as
  textures the material's extras name, and the game multiplies them in (`src/game/detailmaps.ts`, 80 materials).
- **The roughness was counted twice** wherever the packed roughness map carried a material's own smoothness (its
  colour's alpha, or no gloss map at all): the factor was also left at 1 - smoothness, so the asphalt (0.85 smooth)
  drew at roughness 0.148 squared, a mirror. The factors are 1 now whenever the map is written. Measured after: the
  asphalt with its gloss taken off renders at 112 against 102 for a plate of exactly Unity's albedo, 0.096.
- **The light beams, glows and grille decals are Unity's particle shaders** (built-in fileID 211, additive at `_Mode`
  4): read as Standard they were solid white. They are drawn unlit and added now (`applyUnityLooks`).
- **High City's towers are shells with nothing inside.** Filled only where no triangle crossed, their hollow stayed
  open under the roof slab and the street reached it through the glass fronts' gaps: 26 of the street's nodes were
  cut off inside them. What a solid building's ground-floor walls close in (gaps up to 3 m shut) now collides from
  its foot.
- **High City's roofs step** 0.3 to 0.85 m between their decks, and a bot never jumps: the bots' graph has a node
  every 5 m on raised floors (10 m on the street), and a pad is a bot's way up only where its landing joins the roof.
- **The pads are the pack's**: its CapHole plate on the street and its StreetFocusLarge beam, blue, rising from it.
  The bake finds each face in the collision it has just made and the game solves the throw (`src/game/padsolve.ts`,
  the old city's solve, shared): all eight land a rider 3 m onto their 26 m roof.
- **Draw calls, not triangles, again.** Baked a chunk at a time (a mesh a material a chunk, 743 meshes) the map cost
  Competitive more than the old city's light kit: 920 draw calls in the street. The centre's pieces share the pack's
  materials, so its chunks bake as one now, a mesh a material: 440 calls, and measured in turn three times on
  Competitive, 106, 106 and 98 fps became 141, 139 and 167 in the street (over the centre it draws more triangles, 2.1 M
  against 1.5 M, and is as fast or faster).
- **What the store's pictures have that ours do not yet**: the streets full of the pack's signs, holograms and props;
  a heavy haze; and a night lit by the neon alone, where ours is lit by the game's moon and sky, so the wet asphalt
  shows grey. The signs and props are 28.7, the light is the look.

The "before" (the saved map, 2026-09-28, `tools/map-stats.ts`, the machine at 95%):

| preset | loaded | downloaded | triangles in the scene | meshes | materials | textures |
|---|---|---|---|---|---|---|
| Competitive | 14.4 s | 111 MB | 6.56 M | 3,337 | 1,071 | 665 |
| Balanced | 16.0 s | 200 MB | 9.04 M | 4,382 | 1,303 | 1,134 |
| High | 26.3 s | 425 MB | 9.14 M | 4,342 | 1,311 | 1,141 |

The "after" (2026-09-29, the same build both ways in one session: the old city is the page as it opens, the Neon City
map the page with `&map=neon`; "the map's" is what hangs under the map's root, the range, the figures and the ship
being the rest of the scene):

| preset | map | loaded | downloaded | the map's triangles | the map's meshes | the map's materials | the scene's triangles | textures in memory |
|---|---|---|---|---|---|---|---|---|
| Competitive | old city | 11.0 s | 115 MB | 1.25 M | 489 | 211 | 6.56 M | 987 MB |
| Competitive | Neon City | 9.2 s | 98 MB | 1.21 M | 251 | 226 | 6.30 M | 812 MB |
| Balanced | old city | 10.9 s | 199 MB | 3.73 M | 1,533 | 442 | 9.04 M | 1,757 MB |
| Balanced | Neon City | 8.6 s | 143 MB | 1.21 M | 251 | 226 | 6.30 M | 1,191 MB |
| High | old city | 16.7 s | 424 MB | 3.84 M | 1,554 | 451 | 9.14 M | 3,837 MB |
| High | Neon City | 12.2 s | 309 MB | 1.21 M | 251 | 226 | 6.30 M | 2,585 MB |

The Neon City map's geometry is the same on every preset (its texture size is what differs), so Balanced and High
draw a third of the old city's triangles; its centre has no signs, props or rooms' dressing yet, which 28.7 adds. The
frames (`tools/bench.ts`, the two maps in turn, three rounds, the median frame; the RX 9070 XT, the machine shared with
two other agents' tests):

| preset | in the street (skmatch) | over the centre (skroof) |
|---|---|---|
| Competitive | 5.0 ms (200 fps) to 5.4 ms (185) | 4.1 ms (244 fps) to 5.3 ms (189) |
| Balanced | 8.4 ms (119 fps) to 6.0 ms (167) | 6.6 ms (152 fps) to 4.7 ms (213) |
| High | 16.0 ms (63 fps) to 9.3 ms (108) | 13.3 ms (75 fps) to 8.2 ms (122) |

Balanced and High are 2.4 to 6.7 ms a frame faster. Competitive is 0.4 to 1.2 ms slower: the map's geometry is the same
on every preset, only its textures smaller, where the old city gave Competitive a lighter kit. The street's two spots
are not the same place (the old city's is south of the Spire, the new map's the ring road before the south block);
the view over the centre is.

## 28.7 The detail, planned from the pieces

The owner, 2026-09-28: "once we have the layout, start adding in the detail, ensuring we utilize the underground,
higher buildings, inside rooms to fight in". In this order, each shipped on its own, each walked by a body and the bots:

**First, the corner blocks' rooms (Milestone 344):** the pack's Neon Building 04 on each corner block's inner corner,
its ground floor and the two over it walked on foot from the street (`sk-neon.ts`), its roof a climb. Building it found
that every room in the bundle had been drawn with no floor: the pack's floor slabs and plain walls are OBJ files, and
the importer read FBX only. They are drawn now, the tower's and the metro's included. Still: the bots on the stairs.

1. **The tallest building's rooms.** Its ground floor, first floor, the ring of rooms at 38 to 50 m and the top rooms
   (the sections, 28.4) walked: which doors open to the plaza, which stairs join which floors (its stair tower climbs
   13 to 40 m), and every floor drawn made a floor a body stands on (its floors came out of the collision as narrow
   strips: its floor slabs, OBJ files, were never drawn until Milestone 344). The way up: its own stairs, and a window pad (the old Sky Lobby's, `hold`) from the plaza into the
   40 m ring. Loot in the rooms. Found already: its base is an open atrium of terraces, glass rails, ramps and stairs
   (a body sprinting at it from the plaza gets 2 m inside on 154 of 168 tries, legitimately), standing in a pit to its
   basement 7 m down that showed the sky through the world and was walked over on nothing: floored and walled as a
   court, the world's floor lowered into it (Milestone 326).
2. **The underground under the middle block.** Begun (Milestone 328): four of the pack's metro corridors off the
   tower's court under the plaza, the world's floor lowered in them and the street's slab over them. The street
   entrances next (Milestone 334): the pack's metro kiosk over the north and south halls, walked through by a player
   both ways. Then the station (Milestone 349): Centre Station under the south street at -10 m, put together as the
   pack's own demo scene puts its -10 m station (NeonUnderground00, read piece by piece), its glass-roofed hall on the
   plaza its way down, a concourse of marble halls behind the platform, closed on every side (checked by looking out
   from every metre of it). The court joined to it (Milestone 357): a door in the court's south wall, one of the pack's
   corridors, and the pack's 3 m terrain ramp down to a gate behind the marble room's first arch (the pack's stairs
   and escalators all climb 3.5 m, the court stands 3 m over the station). The court's east and west halls the pack's shop corridors, a noodle
   bar and an electronics shop (Milestone 358). Still to do: a way down the bots can walk (the
   kiosk's lower escalator is too narrow at its foot for a bot's square body), the demo's -24 m station and its lines
   under it, and the square shaft through every level. The pack's station (`Subway Hall` MetroStation00 modules, 10 x 10.5 x
   11 m; MetroStationDouble00 for the platforms either side), its tunnels (`Subway Tunnels`) out under two streets, the
   street entrances (MetroEntrance00, 5.3 x 14.4 x 20 m, stairs down) on two streets, and SquareHoleGroundLevel00
   (22.6 x 13.7 x 25 m) in the plaza: the ground opened into the station, a sunken court with sightlines up and down.
   The world's floor lowered where it opens (`floors.ts FLOORS`, as the old metro had it).
3. **High City's roofs joined and reached on foot.** Joined (Milestone 354): a ring of the floating PlatformBridge
   modules round the tower, island to island over the four street crossings, the decks riding over the islands' fence
   at 26.9 m (the islands are round-lobed and a 5 m deck crosses a lobe's arc on a slant, so cutting the fence either
   opened the roof's edge or left the arc across the way) and stepping down to each roof by the pack's small stair.
   Still to do: the roofs reached on foot from the street. Not by HighPlatform_Stairs01 and 02, as this plan first
   had it: photographed, they are High City towers (30.4 and 33.9 m) whose roofs carry an escalator between two roof
   levels, and HighPlatform_Stairs00 is that escalator pair alone (5 m of climb); none starts at the street. The
   pack's fire escapes (FireEscape00, 6 m a flight), its CityWallsStairs00 (15.5 m) and its stair rooms are what is
   left to study for it. And StreetPlatformBridge00 to 03 (10 m spans on 26 m pillars) where two roofs face each other
   across an inner street, the ring out to the tower itself, and FloorBridge00 (10 m) to the low city's roofs.
4. **The streets dressed**: begun (Milestone 338): the pack's lamps along the kerbs, parked cars as cover, flying cars
   over the streets; its neon signs on the fronts (Milestone 339). Still: its billboards and holograms, its street props (benches, bins,
   vending machines, barriers, planters) as cover along the pavements, its StreetFocus lamps and its flying cars over
   the streets, so a street reads like the store's pictures. Its ad screens (SquareAd00 and the rest, the picture as
   both colour and emission at 1) come out blank white: lit colour and full emission together saturate under the game's
   tone mapping and bloom.
5. **The look**: begun (Milestone 336): the roads reflect the city, not the sky, and the map has its own pale violet
   haze in place of the old city's. Still: the range's sky fill lights the city by night (the dressing's lights first).
   The store's haze and a night lit by the neon: the map's own hour (its fog, its sky's light and the
   environment's strength, in `neonmap.json`), so the wet asphalt reflects the signs and not a sky.
6. **The eight districts** round the centre, each its own build after the centre (the owner: "just do the center for
   now").

## Licence

The Unity Asset Store EULA, as for the ILranch packs, the soldier and the guns: the files are never in git or the public
build, and only the game's own server hands them out.
