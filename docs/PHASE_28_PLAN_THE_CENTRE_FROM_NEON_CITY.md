# Phase 28 plan: the centre rebuilt from Daelonik's Neon City

Started 2026-09-28, the evening. The owner bought Daelonik's Neon City Bundle after comparing it with the five ILranch
packs the city is made of today. Every request is listed here, in the owner's words where they matter, and each item is
built, tested, documented, committed and shipped in turn, and marked here as it goes. This takes over item 26.5 (the
middle rebuilt) of `docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`, with the same brief.

## What the owner asked

> "the quality in the game doesn't look insane like AAA for their photos but they look way better than the ones we
> tried to sneak out $25 out with."

> "create a saved version of this map in git so we can always come back to it if needed. Then, keep the 9 districts
> with the center being the largest with underground and the tallest building. the rest how you described it. Just do
> the center for now. We want the best textures we can get and save that for the high quality settings, similar to how
> we did it before. you should really be able to tell now."

"The rest how you described it" is this design, given the same evening:
- keep the street grid and a tallest building in the middle ("the layout and shape is great, just asset wise its not
  there", 26.5);
- round it, blocks of the pack's premade buildings, 3 to 8 storeys, roofs at matching heights across streets 12 to 16 m
  wide, so a double jump (22.1 m carry from a sprint, rising only 1.69 m: `tools/checks/reach.ts`) joins them;
- High City's floating bridges and platforms linking roofs and upper floors, for Hyper Scape's layers;
- the large building at the centre with its ground and first floors inside (the pack's realistic buildings: rooms,
  stairs, elevators), fought through, and jump pads up to its roof;
- the Underground's metro stations and tunnels under the centre, replacing the metro built of boxes;
- all of it measured as the corner is: collision off the pack's own triangles, the bots' graph through doors and stairs,
  loot a room.

And from Phase 26's brief (26.5), still in force: "if that isn't possible with your current assets, don't do the half
baked bullshit we did with the initial spire district". So the first look is checked against the pack's own pictures
before anything is built out, and what the pack cannot give is reported, not faked.

## The save point (28.0, done)

- Git tag `city-ilranch-final` on 5d8700b (Milestones 281 to 320), pushed: the code and config of the city made from
  ILranch's packs, High City's corner included.
- The baked pack files, which are never in git: `C:\Users\jwilb\Downloads\speedkills-paid\city-bake-ilranch-final\`
  (521 MB: the kit v8 in its lo, standard and max sizes, and the corner's district v5). The ILranch unitypackages stay in
  Unity's Asset Store cache, so every bake can be made again.
- To come back: `git checkout city-ilranch-final` in a worktree, copy those files into its `public/models/paid/city/`.

## What was bought

The bundle ($269.50) is a key: its own package is 1 MB, a readme and a window. The four packages it unlocks show as free
in Unity's Package Manager and are downloaded one by one:

| package | store size | what it is |
|---|---|---|
| SciFi Neon City (core) | 4.0 GB | 925 prefabs: a grid-snap kit (walls, floors, roofs, interior walls, doors and elevators that work, furniture, streets, lights, vehicles), 10 premade decorated buildings, a 2K tiling PBR texture library, a 3-level demo |
| SciFi Neon Buildings | | 313 prefabs: 19 whole decorated buildings (117 floors, 9 roof pieces) and 11 realistic buildings with 110 rooms (61 floor rooms, 7 basement levels, 17 stair layouts, 13 elevators) |
| SciFi Neon High City | 144 MB | 320 prefabs: raised streets, floating platforms, floating bridges, platform stairs |
| SciFi Neon Underground | 133 MB | 200+ prefabs: metro stations, metro tunnels, halls |

## The order

| id | item | state | milestone |
|---|---|---|---|
| 28.0 | The save point: the ILranch city tagged, its bakes kept | done | |
| 28.1 | The files: downloaded, unpacked without Unity, counted and measured | waiting on the downloads | |
| 28.2 | The materials: the pack's shaders read into ours; one building in the game beside the pack's own picture, for the owner | | |
| 28.3 | The textures by preset: the pack's best on High, as the kit and the guns do it | | |
| 28.4 | The kit measured: grid, storey, doors, stairs, elevators, bridges; collision a prefab | | |
| 28.5 | The centre's plan, drawn from above, for the owner | | |
| 28.6 | The centre built, in shipped steps | | |
| 28.7 | Frames: budgets a preset, benched | | |
| 28.8 | The checks: movement, bots, loot, landing | | |

### 28.1 The files

- The owner downloads the four in Unity: Window > Package Manager > My Assets, each package > Download (no Import
  needed). They land in `%APPDATA%\Unity\Asset Store-5.x\Daelonik Artworks\`; the core is 4 GB, so its size is watched
  until it stops changing.
- Unpacked as tars, read by `tools/import-city.ts` as the ILranch packs are (Unity's YAML prefabs and scenes, no Editor).
- Counted and measured, and written here: prefabs by folder; every whole building's size, storeys and triangles; texture
  sizes (the store says 2K, the first release 4K); which shaders and their properties; LODs; the demo scenes.

### 28.2 The materials, and the first look

- Daelonik's shaders are their own (DLNK's pipeline notes say they do not export), so each is read into three.js's
  standard material from its textures: colour, normal, metal and smoothness, emission (the neon, on the game's bloom),
  tiling, glass.
- **The checkpoint:** one of the pack's buildings, whole, in the game under the city's light, beside the pack's own
  picture of it, sent to the owner before anything else is built.

### 28.3 The textures a preset

- High gets the best the pack has, at full size; Balanced a half; Competitive a quarter; KTX2, as the kit's lo, standard
  and max files and the guns' 1024 and 2048 skins are split (the owner: "save that for the high quality settings,
  similar to how we did it before").
- The textures tile and are shared by every piece, so the download is the library once and the meshes, not a texture a
  piece as ILranch's are (the city's bought files are 150 MB today, 370 MB at max).

### 28.4 The kit measured

- The grid, the storey height, door and window sizes, stair rise and run (a body steps 0.56 m), elevator shafts, the
  platforms' and bridges' heights, off the meshes (`tools/checks/body.ts`'s rule: measure, never type a number in).
- Collision a prefab, from its own triangles (as `districtSolids` does a district's), made once and placed with every
  copy of it.

### 28.5 The centre's plan

- The centre sector (x and z from -100 to 100, the largest of the 9), on today's street grid.
- In the middle the tallest building, with its ground and first floors inside and pads to its roof; the capture zone,
  the drop and the Sky Lobby's parts that still make sense kept on it (proposed in the plan, the owner decides).
- Round it the blocks, their roofs joined by double jumps and by High City's bridges; the metro under it.
- A plan from above, with heights and street widths, for the owner before building.

### 28.6 The build, each step shipped

1. The streets and one block, whole, walked.
2. Every block.
3. The tallest building and its inside.
4. High City's bridges and platforms.
5. The underground.
6. The bots' graph, the loot, the pads, the capture zone.
7. The look a preset: haze, light, glow.

### 28.7 Frames

- Budgets a preset for triangles, draw calls and texture memory, as `citykit.json budget` has them.
- Every repeated piece drawn as one instanced batch (as the kit is); the insides drawn only near a building or inside it
  (three.js does not hide what walls hide); the pack's LODs on its decoration.
- Benched against today's build in the street of a match: Balanced 11.6 ms, High 20.9 ms (2026-09-28).
- Daelonik's own warning: its demo scenes are heavy on mid-range machines. The pack publishes no triangle counts; 28.1
  measures them.

### 28.8 The checks

- Every movement check stays green (reach, the roofs and the roof run).
- New for the centre: roofs joined by double jumps, every inside walked, every stair climbed, the underground walked from
  the street, a body dropped anywhere lands only on something drawn, the bots reach every floor, loot in the rooms.

## The rest of the map

The eight other districts stay as they are for now, and High City's corner (ILranch) with them.

## Licence

The Unity Asset Store EULA, as for the ILranch packs, the soldier and the guns: the files are never in git or the public
build, and only the game's own server hands them out.
