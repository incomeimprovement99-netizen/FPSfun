# The city bundle: what it is, and how to build the vertical centre from it

**Written 2026-09-28** for the agent building the city.
- `docs/NEXT_AGENT_CITY_BUNDLE.md` is your brief. **Where this doc disagrees with it, this doc wins.**
- `docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md` and `docs/PHASE_21_LAYOUT.md` hold the design and the measured
  movement. This doc turns them into a build with the bundle.

**The owner's words:**
- Replace the centre: "toss out the old map basically and replace it with this one (only center for now, but this
  center is the tallest / most vertical and needs to be the most detailed part of it, showing off exactly what you
  can do".
- The aim: "our environment going from child's play, to on the way to becoming AAA".
- The distances "between stuff for chaining movement, and all the pieces how they flow together" must hold.

**This is a plan only.** Nothing below has been built. The analysis behind it (section 1) was done outside the repo,
on the owner's unpacked files.

## 0. The short answer

- **The bundle fits the game.** All five packs are built on a **4 m grid**, the same as our city: 4 x 4 m and 8 x 4 m
  wall modules, 4 m window and door bays, 4 x 4 m street tiles. The measured chain distances map straight onto it.
- **It covers the whole centre, from the street to the skyline**:
  - street fronts, neon and clutter;
  - raised streets and parapets;
  - four facade families;
  - fire escapes;
  - rooftop gear;
  - huge billboards;
  - sci-fi machinery for the Spire;
  - lit background towers for the far skyline;
  - cars, including flying ones.
- **Its authors built to 6 to 8 storeys.** Their demo cities top out at 24 to 32 m (Kyber 51 m). Our centre goes to
  150 m, so the modules are stacked far higher than they did. The grid makes that simple, but it makes **performance
  the hard part**: detail goes where players play, and cheap facades go between the decks (section 6).
- **The measured movement stays as the skeleton**: collision boxes stay ours, and the kit is the skin.
  - the chimneys, the Sky Lobby, the window pads;
  - the gap classes, from `src/config/reach.json`.

  **Dressing rules protect every chain** (section 4.6).

## 1. What was bought, measured

**The five packs.** All five are by IL.ranch, bought 2026-09-27 at $4.99 each. They were downloaded to
`%APPDATA%\Unity\Asset Store-5.x\ILranch\3D ModelsEnvironmentsSci-Fi\` and unpacked (tar, no Editor) into
`C:\Users\jwilb\Downloads\speedkills-paid\extract\{cyberfp,cyber,glass,high,kyber}`.

**Measuring.**
- All 732 FBX files were converted with FBX2glTF and measured with glTF-Transform.
- The five demo scenes were rebuilt from their Unity YAML (about 12,000 placed meshes) and rendered with their
  textures.

| Pack | Download | Models / prefabs | Triangles (median a model) | Textures | What it is |
|---|---|---|---|---|---|
| **Cyber City Fp** (`cyberfp`) | 353 MB | 44 / 53 | 25k in all (82) | 67 PNG, 45 TGA | a street set built to be seen close: walls, street windows, shop door, sidewalks, pipes, a traffic light, neon, a bike |
| **Cyber City** (`cyber`) | 964 MB | 277 / 298 | 60k (72) | 126 TGA (3 GB raw), 108 PNG, 2K mostly | **the street kit**: shop fronts with interiors behind glass (shop 1 to 8, archetypes 5 to 8), 64 neon signs, food and hot-dog stands, cable webs (cable mix A to G), pipes, AC units, lamps and light cones, antennas (8.3 m masts), fire ladder, plates, cars with LODs, robots, 3 lit background towers |
| **Glass City** (`glass`) | 937 MB | 45 / 36 | 137k (1,582; LOD pairs) | 138 PNG | **sci-fi industrial**: deep tech walls with glowing cables (1.9 to 5.9 m deep), machinery (Machine3 20 x 24 x 24 m, Pumpa 10 m tall), tubes, an 80 m background tower |
| **High City** (`high`) | 4.7 GB | 198 / 212 | 86k (120) | 262 PNG, 26 PSD, 9 TGA, 4K | **raised streets and brownstone towers**: podium walls, parapets and fences, fire escapes (top, tile, down), 16 x 22 m billboards on 23 m holders, street and traffic lights (flying-car signals), 7 car types plus flying-car engines, a background traffic script, 53 m background slabs |
| **Kyber City** (`kyber`) | 3.15 GB | 168 / 142 | 342k (276) | 528 PNG, 103 TIF | **gritty concrete blocks**: 4 x 4 m walls, fire-stair tiles, rebar and column tops, a road constructor, a bridge module, a metro tunnel set (150 m), shops, neon holders, robots |

**What the demos show** (renders in `speedkills-paid\analysis\shots\`; open them to see the kits):
- **Cyber City** (`cyber-aerial.png`, `cyber-top.png`): a dense alley city of 4 to 6 storey blocks under a web of
  cables and pipes, neon and billboards everywhere, lit background towers behind. Its tan cones are fake lamp-light
  volumes that should be transparent.
- **High City** (`high-aerial.png`, `high-top.png`):
  - a crossroads of **streets 14 to 16 m wide**, the width of ours, between podium blocks;
  - ornate towers with lit arched windows, fire escapes on every face, and 16 x 22 m billboards;
  - raised walkways.
- **Kyber City** (`kyber-aerial.png`): concrete apartment blocks with fire stairs and cornices, unfinished rebar tops,
  cable bundles and a metro.
- **Glass City** (`glass-aerial.png`): thick sci-fi walls packed with glowing cabling and machines.
- **Cyber City Fp** (`cyberfp-aerial.png`): one detailed street corner, with crosswalks, stop lines, billboards and
  steel trusses.

## 2. The grid against our movement (measured)

**Our numbers.** From `src/config/reach.json` (the real controller, A15's movement):
- sprint 13.97 m/s;
- sprint jump 11.35 m;
- double jump 22.1 m;
- wall run 21.0 m in 1.5 s, finishing 1.59 m up;
- kick off a wall run 34.6 m;
- zig-zag unbroken from 2.5 to 4.25 m wide.

From `src/config/city.json`: storey 4 m, streets 14 m. From `src/config/movement*.json`: a body steps up 0.56 m
(22 hu), mantles 2.29 m, and climbs 5.1 m.

| Kit piece (measured) | Size (w x h x d) | Against our numbers | Use |
|---|---|---|---|
| Walls: Cyber `wall a 1` / `0.5`; Kyber `wall 1`; High `wall1a` | 8 x 4, 4 x 4 (flat); 4 x 4 x 0.74; 8 x 4 x 1.24 | = one 4 m storey | facades; flat ones for run walls |
| Glass `Wall 1`, `Wall sq tile` | 8 x 4 x 1.9; 5.5 x 4 x 5.9 | deep relief | Spire core and lobby lining, **never a run wall** |
| Street windows, shop door | 4 x 4 (and 4 x 5.57) | a 4 m bay | glazed bays; **not** the pad windows |
| Cyber `wall window 1` | 9.79 x 8.24 x 4 | two storeys | facade feature |
| Cyber shop archetypes | 8 x 7.08 x 5.02 | ground floor plus mezzanine | street fronts |
| Cyber `plate 1` / `plate 05`; Kyber `column plate` | 8 x 0.3 x 2; 4 x 0.3 x 2; 4 x 0.3 x 4 | a 2 m deep ledge | balconies, ledges, landings |
| High `parapet tile` | 4 x **0.70** x 0.64 | **over the 0.56 m step** | roof edges that are **not** gap edges |
| High `parapet fence` | 1.83 x 0.98 | rail height | bridges, balconies |
| **Fire escapes**: High `fire ladder a tile` / `b tile`; Kyber `ladder tile A` | 5.03 x **4.98**; 6.01 x 4.98; 4.04 x 4.99 | **built for 5 m storeys** against our 4 m | see 4.6, rule 7 |
| Kyber `bridge` | 2.3 wide, 4 m a segment | a skybridge module | bridges at 32 and 64 m |
| Road and sidewalk tiles | 4 x 4 | the grid | streets, concourse |
| High `advertis plane` on `advertis hold` | 16 x 22 on a 23 m pole | landmark scale | Spire and rooftop billboards |
| Background: Cyber `dist building`, High `fill build`, Glass `bkg_building` | 10 x 40; 15 to 30 x 53; 25 x 80 (10 to 18 tris, lit windows) | skyline | the ring beyond the map edge |
| High cars; `fly engine`; `traffic light fly` | 1.3k to 2.3k tris a car | | parked cars, flying traffic lanes |

**The two mismatches to handle:**
- **Fire escapes are 5 m a storey** where our storeys are 4 m (rule 7).
- **Parapets are 0.70 m**, above the 0.56 m step, so none may stand on a gap's launch or landing edge (rule 3).

## 3. What the bundle does not have (use what the game already has)

- **Apartment furniture** (kitchens, beds, sofas, TVs). The bundle has shop interiors behind glass, stands and
  machinery. The lobby floors use those, plus props the game already has.
- **Characters.** The soldier is in. The bundle's robots can be ambient props.
- **Particles and scripts.** The Steam, dust and "fuzzydust" prefabs are Unity particle systems. The traffic and route
  scripts are C#. Rebuild them in the game's own particles and a simple spline, reading the prefabs only for look and
  timing.

Per the brief, research or suggest no other packs.

## 4. The new centre

### 4.1 What stays: the measured skeleton

Keep and re-prove in place:
- the podium at 8.2 m, with its public stairs and concourse bridges;
- the **Sky Lobby** storey at 32.2 m in 16 towers;
- windows 2.0 x 3.6 m, lined up across 7 canyons for a clean sprint jump through two towers;
- the **22 window pads** (29.3 m/s);
- the lobby bridges;
- the **four chimneys** (`city.json chimneys`): 3.0 m wide, 27 m long, a landing at 5.5 m, the top at 11 m, lined in
  `#ff3df2`. They sit at north x -7.5, east x 73.45, south x 71.4 and west x -71.25;
- **THE CHAIN** course in the range;
- the checks behind all of them: `reach.ts`, `sk-chimneys.ts`, `sk-lobbies.ts`, `sk-chaincourse.ts`, `sk-roofs.ts`,
  `city-levels.ts`, `city-budget.ts`.

### 4.2 What goes

In THE SPIRE sector only, these go:
- the code-drawn tower boxes and their photo facades;
- today's massing: 54 towers with roofs at 40 to 64 m.

The outer districts stay as they are, and they are the fallback when the paid files are absent.

### 4.3 The massing, block by block (the tallest part of the map)

- **The blocks:** 3 x 3, as today (`city.json blocks` [-100,-43], [-29,29], [43,100]; 14 m streets). Heights are 4 m
  storeys above the street.
- **Four facade families, placed so no two neighbours match.** Hyper Scape's districts were called samey; ours read
  apart:
  - **Street:** Cyber City shop fronts and neon at every street edge.
  - **High:** brownstone, lit arched windows, fire escapes, billboards on the roofs.
  - **Kyber:** concrete, fire stairs, rebar crowns.
  - **Glass:** the tech lining of the Spire and of the lobby band.

| Block | Family | Towers and roofs | Decks it carries | Signature |
|---|---|---|---|---|
| **C, THE SPIRE** | Glass core, billboards | podium 8.2; tier 1 to 64.2 (the lobby band at 32.2 inside it); tier 2 to 96.2; tier 3 to 128.2; the crown deck at 140.2; mast to 180 | every deck | **12 billboards (16 x 22 m)** on the tiers' faces, Machine3 on the crown, the capture zone at 140 m, the drop atrium |
| **N** (north chimney) | High twins | two towers either side of the chimney slot, 96 to 112 | concourse, lobby, Sky Park bridge, crowns | "Neon Alley" at its base: the showpiece street (4.3.1) |
| **E** (east chimney) | Kyber twins | 96 to 112 | same | fire-stair faces |
| **W** (west chimney) | High twins | 96 to 112 | same | billboards on holders |
| **SE** (the south chimney) | Kyber twins | 96 to 112 | same | rebar crown playground |
| **S** | Kyber | 64 to 80, stepped | concourse, lobby | the metro entrance, if the owner wants it (section 9) |
| **NE**, **NW**, **SW** | alternating High / Kyber | 64 to 80, stepped | concourse, lobby, roof ring | NE and SW with **rebar crowns**: the top two storeys an open frame of columns and slabs, a parkour playground |

**Heights and targets.**
- **Tallest:** the centre is the tallest part of the map. The outer districts stay at 40 m and under.
- **Targets:** those of Phase 21 section 2.1, enforced by `city-levels.ts`:
  - highest point 120 m or more (the crown deck is at 140.2);
  - the street 20% or less of standing room;
  - room indoors in every band.

#### 4.3.1 Neon Alley (the first thing to build, and the owner's first look)

The north street run from the concourse stairs to the Spire. It is built at full density:
- Cyber shop fronts on both sides;
- neon signs stacked up the facades;
- food and hot-dog stands;
- a cable web at 6 to 14 m, never over a pad column;
- AC units and pipes;
- light cones;
- parked High City cars;
- wet asphalt (low roughness);
- steam from vents.

It is the before-and-after picture for the owner: one street at AAA density proves the rest.

### 4.4 The levels, and which kit dresses each

| Level | Height | Dressed with |
|---|---|---|
| Street ("lava") | 0 m | Cyber and Cyber Fp: shop fronts, neon, stands, clutter, lamps, cables; Kyber and High road tiles; parked cars |
| Concourse | 8.2 m | High City: podium walls, parapets on non-gap edges, fences on bridges, street and traffic lights, road tiles on the bridges |
| Tower bodies | 8 to 140 m | High, Kyber and Cyber facade modules at full detail **within one storey of a deck and at the street**; impostor facades between (section 6) |
| Sky Lobby band | 32.2 m | Glass tech walls inside; a neon trim ring at 32 m on every lobby tower, so the level reads from anywhere |
| Sky Park | 64.2 m | rooftop gear: High antenna sets, AC and vents; Cyber antennas; Glass Pumpa as rooftop plant; billboards on holders; Kyber bridges to the Spire |
| Crowns | 96 to 112 m | Kyber rebar crowns (NE, SW, SE, E); High roofs with billboards (N, W, NW) |
| The Spire's top | 128 to 180 m | Glass Machine3 and tubes, the billboard faces, the mast |
| The skyline ring | beyond the map edge, 300 m and more out | Cyber, High and Glass background towers, lit, in fog, with flying traffic lanes between the centre's towers at 40 to 90 m |

### 4.5 The movement network, placed (every number from `reach.json` and `city.json`)

| Link | How | Numbers |
|---|---|---|
| Street to concourse (8.2) | public stairs (built); street pads (built); **climb ledges** up High and Kyber faces | a ledge every 4 m storey, under the 5.1 m climb |
| Concourse to lobby (32.2) | window pads (22, built); stairs inside; **chimney stacks**: each built chimney gets a second fold | a fold climbs 11 m (landing +5.5, top +11): 8.2 to 19.2, then 19.2 to 30.2, and a 2 m mantle onto the lobby floor through a canyon window |
| Lobby to Sky Park (64.2) | pad ladders on the Spire's and the twins' terraces; stairs inside; **three-fold chimney stacks** in the four twin slots | a 32 m rise at gravity 17.5 m/s² needs about 33.5 m/s up (solve with `padSolve`, as the lobby pads were); three folds climb 33 m |
| Sky Park to the Spire | four Kyber bridges at 64.2 from the twins to tier 1's roof terrace | parapet fences; a speed strip (`paint.json`) on one, leading to a chain gap |
| Sky Park to crowns (96 to 112) | pad ladders; stairs; the owner's signature chain (below) | |
| **The roof ring** at the crowns | roof to roof round the centre | **across a 14 m street = a double gap** (12.5 to 19.9 m); **across a 3 to 6 m canyon = a run gap** (9.4 m or less); **past 22.1 m = a chain gap** with a flat run wall of 21 m or more (the Spire's tier faces) |
| The Spire's top (140.2) | pad ladders terrace to terrace (64, 96, 128, 140) | each solved by `padSolve` against the solids above its arc |
| **The drop** | the atrium down the Spire from 128 m to the concourse; no fall damage; a pad or updraft back up to 64 | the landing has a pad or paint so the fall keeps its speed |

**The named routes** (Phase 21 section 4.4), each simulated end to end in the chain checks, with its time:
1. **Stairs only** to the crown deck. The bots use this route.
2. **Pads only** to the crown deck, in 15 s or less.
3. **The owner's chain:**
   1. a window pad into the lobby;
   2. through the tower, in one side and out the other;
   3. out onto the twin slot's chimney stack;
   4. three folds to the Sky Park, each turned with the tap-strafe 180;
   5. a mantle onto the Sky Park.

   It must beat route 2.
4. **The roof ring**, using every gap class once.
5. **The drop.**

### 4.6 Dressing rules that protect the movement (each checked)

The kit is visual. Collision stays the city's own boxes (`city.ts` solids), except where a kit piece adds a surface
players will expect to stand on (plates, bridges, fire-escape landings); each of those gets a matching solid.

1. **Chain corridors** (chimneys, zig-zags):
   - faces stay flush within **0.15 m** of the collision face;
   - no prop sits inside the corridor from its floor to 2 m above its top;
   - run walls are flat modules only (never Glass's deep walls);
   - the chain line is the reserved `#ff3df2` strip light (Cyber `long lamp`, recoloured) at 1.2 m above each landing.
2. **Pad windows:**
   - **2.0 x 3.6 m clear**, with no glass (glazed kit windows are for other bays only);
   - no kit mesh inside the pad's column (radius 1.2 m) from the pad to 2 m over the sill.
3. **Gap edges:**
   - no parapet or fence on a classed gap's launch or landing edge; a curb of 0.3 m or less is allowed;
   - the 0.70 m parapets and 0.98 m fences go on every other edge.
4. **Overhead clutter:** cables, signs and holders never cross a pad column, a zipline or a gap's arc (2 m clear).
5. **Run walls** are flat for at least one wall run (21 m) wherever a chain uses them.
6. **Balcony ledges** (Cyber plates, 8 x 2 m) keep a 4 m step between them, under the 5.1 m climb.
7. **Fire escapes are 5 m a storey.** Either place them on facades whose ledges are also 5 m apart (5 m is inside the
   5.1 m climb with almost no margin, so prove it), or scale them 0.8 vertically onto our 4 m storeys (they are
   visual). Default: scale to 0.8 and check the picture. Their landings get matching solids either way.
8. **A new check, `tools/checks/kit-clear.ts`:** every chain corridor, pad column, window opening and gap arc is free
   of kit mesh bounds. Prove it by putting a sign into a chimney and watching the check fail.

## 5. From child's play to AAA: what the look is made of

Every element below comes from the bundle or from what the game already has. Each phase shows its progress with the
same six pictures (section 8).

| Pillar | How |
|---|---|
| **Silhouette** | the 150 m Spire with its billboard tiers; stepped twins; the lit skyline ring in fog behind everything |
| **Light at night** | lit windows in the kit textures; the 64 neon signs as emissive with the game's bloom; lamp cones as additive transparent volumes (Cyber `lamp cone`, `strlamp`); a few real lights near play only; fog tinted by each block's accent colour |
| **Surfaces** | the kits' PBR at 1K (albedo, normal, packed occlusion/roughness/metal); decals (Cyber's crosswalks, stop lines, stains); wet streets through low roughness |
| **Density** | at street level, **six props or more for each 10 m of street** (bins, hydrants, stands, signs, AC units, pipes); a cable web overhead; rooftop gear on every roof above the concourse |
| **Motion** | flying traffic on splines between towers (High's cars and fly engines); steam from vents; flickering neon; the billboards' art |
| **Readability** | chain lines magenta; pads gold; each deck's height and name in its accent colour; the Spire's billboards as the landmark seen from anywhere |

## 6. Performance: detail where you play

- **Where we are:** today's city is 235k triangles against its 240k budget (`city-budget.ts`). The bundle at full
  detail on 150 m towers would be millions.
- **Detail bands:** full kit modules at the street and within one storey of each deck (8.2, 32.2, 64.2, the crowns).
  Between the decks, each tower face is a few quads with an **impostor facade**: a texture rendered offline from the
  kit's own modules, the way the kits' own background towers are drawn (10 to 18 tris with lit windows).
- **Instancing:** one `InstancedMesh` per kit piece type, and static pieces merged per block.
- **LODs:** use the kits' own LOD1 meshes (Glass, High and Kyber carry them) past about 40 m; switch whole towers to
  their slab past about 120 m.
- **Interiors** (lobby floors, shop interiors) are drawn only for the tower you are in or next to.
- **Textures:** 1K WebP, 512 for small props, 2K only for the Spire's billboards. The kits reuse tiling materials,
  so cap the unique textures the centre loads and count them in the budget check.
- **The budgets, measured and written into `city-budget.ts`:**
  - triangles in view at the worst viewpoint (the Sky Park looking at the Spire);
  - draw calls;
  - texture memory.

  Measure before and after by medians over interleaved runs; the machine is often loaded. Propose the numbers after
  the first measured phase. **The owner decides the minimum PC** (section 9).

## 7. The import: extend `tools/import-paid.ts`

Found by rebuilding the demo scenes. The analysis scripts are in `C:\Users\jwilb\Downloads\speedkills-paid\analysis\`,
outside the repo:
- `resolve_scene.py` rebuilds a prefab or scene's placements;
- `render.html` and `render.mjs` render them;
- `inventory.json` and `measure.json` hold the counts and sizes.

**Port their rules into the importer; do not ship them.**

1. **Import curated prefabs, not raw FBX.** The kit's real pieces are prefabs that assemble several meshes: a shop
   front is 17 to 39 meshes, a fire-escape tile 5. Bake each curated prefab into one GLB (LOD0, plus LOD1 where it
   exists). The city instances those. Start from the pieces named in sections 2, 4.4 and 4.6: a few hundred, not 732.
2. **The 3ds Max 100x.** These FBX files keep a 100x scale on a group node above each mesh, and Unity bakes that
   group's rotation and scale into the mesh on import. **Bake each mesh's whole node chain** (rotation and scale; not
   its own translation). Missing it draws every piece at 1/100 size.
3. **LOD copies.** Prefabs hold `lod0` and `lod1` children side by side. Unity's LODGroup shows one; drawing both
   doubles the geometry. Take LOD0, and LOD1 for the far band.
4. **Unity is left-handed.** Mirror X on positions and take `(x, -y, -z, w)` for rotations when placing Unity
   transforms in three.js.
5. **Mesh references:**
   - older models list their mesh IDs by name in the FBX `.meta` (`internalIDToNameTable`, `43: 4300000`);
   - newer ones hash the IDs and list nothing. There, the prefab's GameObject name equals the mesh name;
   - a nested model prefab targets the model root by the fixed IDs `-8679921383154817045` (Transform) and
     `919132149155446097` (GameObject);
   - Unity's built-in cube and plane (`guid 0000000000000000e000000000000000`, fileIDs 10202 and 10209) appear in the
     demos.
6. **Materials:**
   - URP Lit (`_BaseMap`, `_BaseColor`, `_BumpMap`, `_EmissionMap`, `_EmissionColor`, `_Smoothness`, `_Metallic`,
     alpha clip) in four packs;
   - Built-in Standard names (`_MainTex`, `_Color`, `_Glossiness`) in High City's Built-in version.

   Map both to `MeshStandardMaterial`, neon on emissive, as `soldier.ts` and `paidgun.ts` do. The custom shaders
   (Cyber 2, High 21, mostly post-processing) are rebuilt by eye from a picture.
7. **Textures:**
   - TGA: use the soldier import's reader;
   - PNG and TIF: sharp;
   - PSD: sharp cannot read it; High City has 26 (3.3 GB, cars and posters), and Cyber City has its posters. Take the
     pieces' other maps, or decode the PSD's composite in the importer.
8. **Version the file names** (`...-v1.glb`): the server caches `/models/` for 24 hours.
9. **Paid rules as the brief says.** The guards already exist:
   - `npm run rules` refuses tracked `public/models/paid`;
   - `tools/deploy-pages.ts` strips `dist/models/paid`.

   The fallback is today's centre, drawn when the files are absent.

## 8. The build order (each step: build, verify and rules, pictures, ship)

**Testing is light**, as the brief says: `npm run verify` and `npm run rules` on every change, plus the module checks
already in verify. The full e2e gate runs only if the owner asks.

**Pictures each step:** six fixed cameras, rendered headless with `--use-angle=d3d11` like `tools/weapon-sheet.ts`,
saved before and after:
1. Neon Alley at eye height;
2. a concourse bridge looking at the Spire;
3. along a lobby window line;
4. inside a chimney looking up;
5. the Sky Park looking out at the skyline ring;
6. an aerial of the centre.

1. **Import:** curated prefabs baked to GLB, a manifest of measured sizes in config (the `paid-weapons.ts` pattern),
   and a kit viewer page for the dev build.
2. **Massing:** the new heights and decks on the 4 m grid. The built modules are re-proven in place (chimneys,
   lobbies, window pads, the chain course); the chimney stacks and pad ladders to 64 and 140 m are added; the targets
   in `city-levels.ts` are met.
3. **Neon Alley:** the showpiece street at full density (4.3.1). **Show the owner this first.**
4. **The rest of the street level and the concourse.**
5. **Facades:** detail bands, impostors, climb ledges, fire escapes.
6. **Decks:** the lobby band's lining and ring, the Sky Park, the crowns, and the Spire's billboards and machinery.
7. **Skyline ring and motion:** background towers, flying traffic, steam, flicker.
8. **Light and performance:** the lighting pass and the budgets measured and written.
9. **`kit-clear.ts`** is written in step 2, and every later step keeps it passing.

Each shipped step is a roadmap Milestone with a diary entry, released with the brief's steps.

## 9. Decisions for the owner

**Decided 27 September 2026:** a mix of styles per block, using every pack (built as 4.3's grid, Milestone 254); a metro under the centre's streets, a decent size but only the centre; and no separate minimum PC: the graphics presets are the tiers, each with its own texture size, detail and triangle budget (`citykit.json` budget).

1. **The family mix** (4.3). The proposal alternates High and Kyber round a Glass Spire, with Cyber City at every
   street. Swap any block.
2. **The metro** (Kyber's 150 m tunnel set). An optional level **below** the street under the S block: a fast,
   covered shortcut across the centre. It is more verticality, downward.
3. **The minimum PC.** It sets the triangle, draw-call and texture budgets in section 6.
