# Phase 21 plan: the vertical centre, and what to buy for it

**Written 2026-09-27.** The owner: move the play up. Hyper Scape's city was indoor and rooftop play with jump
pads everywhere to get onto the roofs or in through the windows without an ability. Make the middle far more
vertical, shrink the rest, and let jump pads connect everything so a good player can outplay from above,
below and inside. Buy a futuristic neon pack or 3 to 5 packs that cover the whole city, up to **$100**, so
an agent can build the centre overnight. The buy list and the overnight brief are at the end.

Research for this plan: three research passes on 2026-09-26/27 (city kits; characters, arms and props; every
store's licence), prices read live from the stores' own data, and a measurement of today's city.

## 1. Today's city, measured

`GAME=speedkills npx tsx tools/checks/city-levels.ts`: every surface a body can stand on with 1.8 m of head
room, sampled on a 1 m grid over SpeedKills' 500 m square, all doors open.

| Height | Open | Indoors | Share of all standing room |
|---|---|---|---|
| Street, 0 to 1 m | 171,186 m2 | 39,544 m2 | **58.7%** |
| Low, 1 to 10 m (1 to 2 storeys) | 23,007 | 56,191 | 22.1% |
| Mid, 10 to 30 m (3 to 7 storeys) | 41,210 | 12,959 | 15.1% |
| High, 30 to 60 m (8 to 15 storeys) | 12,872 | **0** | 3.6% |
| Top, 60 m and up | 1,734 | **0** | 0.5% |
| All | 358,703 m2, 1.43 times the footprint | | highest standing top **70.5 m** |

By sector, street / low / mid / high / top, m2:

| Sector | Street | Low | Mid | High | Top |
|---|---|---|---|---|---|
| THE SPIRE (the centre, 200 m) | 18,313 | 15,074 | **1,169** | 7,086 | 1,478 |
| NEON ROW | 26,936 | 9,658 | 10,468 | 1,322 | 256 |
| HARBOR GLASS | 26,929 | 10,647 | 9,256 | 1,978 | 0 |
| OLD TOWN | 27,044 | 8,032 | 10,018 | 886 | 0 |
| THE STACKS | 26,295 | 6,208 | 8,187 | 1,600 | 0 |
| SKYHAVEN | 22,097 | 8,385 | 4,959 | 0 | 0 |
| THE YARDS | 21,720 | 8,401 | 4,267 | 0 | 0 |
| THE CIRCUIT | 21,362 | 3,882 | 2,267 | 0 | 0 |
| THE GARDENS | 20,034 | 8,911 | 3,578 | 0 | 0 |

What it says:
- **The city is still a street map.** Six square metres in ten are at street level, where Hyper Scape's
  players said "any floor lower than a rooftop might as well be lava" (PC Gamer, docs/PHASE_19_PLAN_DOWNTOWN.md).
- **Nothing is indoors above 30 m**, and only 4% of all standing room is up there at all.
- **The centre is hollow in the middle band.** Its podium holds 15,074 m2 and its tower tops 8,564 m2, with
  1,169 m2 between 10 and 30 m. That is the band where roof-to-roof, window-to-window play happens.

## 2. The vertical centre (the design)

### 2.1 Targets for THE SPIRE sector (proposed; the owner can move them)

| Measure | Today | Target |
|---|---|---|
| Highest standing point | 70.5 m | 120 m or more; the Spire's crown 140 to 160 m (35 to 40 storeys) |
| Standing room in the sector | 43,120 m2 | 2.5 times: 110,000 m2 or more |
| Street's share of it | 42% | 20% or less |
| Mid band, 10 to 30 m | 1,169 m2 | 15,000 m2 or more |
| High band, 30 to 60 m | 7,086 m2, none indoors | 20,000 m2 or more, a third indoors |
| 60 to 100 m | part of 1,478 m2 | 15,000 m2 or more, a third indoors |
| 100 m and up | 0 | 5,000 m2 or more |
| Ways up with no pad and no ability | the podium stairs | every deck, by stairs inside a tower (bots too) |
| Street to the Spire's crown by pads | not possible | 15 s or less along a pad chain |

`tools/checks/city-levels.ts` holds these, with a band per 30 to 40 m, split open and indoors.

### 2.2 The shape: five levels, and everything between them joined

The centre stays the 3 by 3 blocks it is (city.json `blocks`, 57 to 58 m each, 14 m streets). The rest of the
city is untouched tonight.

| Level | Height | What it is | Play |
|---|---|---|---|
| Street | 0 m | Streets, crossings, a pad at every crossing | Transit. Little loot. "Lava" |
| Concourse | 8 m | The raised concourse over the streets (exists, Phase 19 step 5) | The first floor of fighting; stairs from every plaza |
| Sky Lobby deck | about 32 m (storey 8) | Skybridges between the eight core towers and the Spire; each tower's storey 8 an open lobby | Indoor fights, windows onto the bridges |
| Sky Park deck | about 64 m (storey 16) | Terraces and gardens on setbacks; fewer, longer bridges | Exposed, fast; pads up and ziplines out |
| Crowns | 96 to 120 m (storeys 24 to 30) | Each core tower's top: helipad, antenna mast, plant | High ground with cover, each seen from two others |
| The Spire | 140 to 160 m | The crown of the city and the end of the match | The capture zone's last place (sector decay) |

Between the decks, tower floors are every 4 m (city.json `storey`). The floors next to each deck are open
inside (rooms that differ, not Hyper Scape's "same non-decorated rooms"). The rest show lit fake interiors
behind glass, which costs almost nothing to draw.

### 2.3 The ways up, down and across (the outplay)

Every deck is reachable four ways, so no height can be locked:
1. **Stairs inside every tower**, no pad and no ability. Hyper Scape's rule: "stairways and jump pads ensure you
   almost always have a means of accessing their rooftops". Bots use these.
2. **Jump pads, deck to deck**, on every terrace and every bridge end. Their throws are worked out from the
   movement config (city.json `padSolve`, from gravity), so A15 and A17's new movement cannot break them.
3. **Window pads.** Some pads aim through an open window on a deck floor, the owner's "through windows without
   abilities". On the deck floors, a share of each facade's bays have no glass.
4. **Balconies up the outside.** A balcony every storey, offset a bay, so a double jump and a climb goes up a
   facade storey by storey. A climb reaches 5.1 m and a storey is 4 m (movement.speedkills.json).

And across and down:
- **Skybridges**: glass tubes and open trusses at each deck.
- **Ziplines**: from the crowns down to the concourse and out to the districts.
- **Drops**: an atrium through the Spire from the Sky Park deck to the concourse (no fall damage), with an
  updraft that lifts you back up it (ours; Hyper Scape had none).
- **Fire escapes** on the lower towers, which are ladders you can fight on.

Rules that keep the high ground fair:
- Every crown can be reached from the deck below by a pad in 3 s or less.
- Every crown is seen from at least two others.
- There is no sealed sniper nest: every perch has a way in that the perch cannot cover.
- Loot runs from the top down, as Hyper Scape's did ("start from the tops of buildings and loot downwards"),
  and the best is on the Sky Park deck and the crowns.

Readability, so a player always knows what is above and below:
- Each deck carries a floor number and its name in the sector's accent colour.
- The damage direction indicator says above or below.
- Footsteps are placed in 3D so they carry height.

### 2.4 Performance (a browser, 30 players)

Draw calls first, as the bench work taught (memory: bench under owner load):
- one InstancedMesh per kit piece type;
- static pieces merged per block;
- interiors drawn only for the tower you are in or next to;
- tower shells with LODs, and the far skyline as impostors.

The measures are frame time and draw calls in the centre, before and after, by medians over interleaved runs.
Textures ship at 1024 or 2048 as WebP. A 4K map costs about 89 MB of GPU memory with mips, so none ship at 4K.

### 2.5 The rest of the city, later (not tonight)

- **Shrink.** Drop the outer ring of blocks (city.json `blocks` [-250,-185] and [185,250]). The map goes from
  500 m to about 350 m square, half the footprint. The eight districts become one block deep round a taller
  centre, which gives more height and less width, as the owner asked.
- **Rebuild the ring** as mid-rise blocks of 4 to 10 storeys with interiors, fire escapes and rooftops you run.
- **Give every district a landmark**, Hyper Scape's fix that it still did too little of ("samey districts",
  GameSpot, Game Rant):
  - OLD TOWN: a church;
  - HARBOR GLASS: a marina with boats;
  - THE CIRCUIT: an arcade;
  - THE STACKS: a data centre;
  - THE GARDENS: a sky garden.

## 3. What a whole city needs, and where each thing comes from

**A** = in the buy (section 7). **F** = free CC0, fetched by script. **C** = ours, built in code or already in
the game.

| Need | Detail | From |
|---|---|---|
| Tower shells and shapes | the massing, floors, decks, bridges, collision | **C** (city.ts; the checks measure it) |
| Facade modules | window bays, balcony bays, doors, shop fronts, blank walls with vents, corners, parapets | **A** Sci-Fi City and City modular sections; **F** Quaternius Downtown City MegaKit |
| Balconies, fire escapes, rooftop access | climbable outside routes | **A** City (3 fire escapes, rooftop access); **C** balcony slabs |
| Rooftop clutter | AC units, vents, pipes, water tanks, antennas, dishes, solar panels | **A** City (4 AC units, 7 modular vents, 9 pipes), Sci-Fi City (antennas, satellites, solar panels); **F** KayKit Space Base Bits |
| Neon, signs, billboards, holograms | readable from anywhere | **A** City (17 large signs, 33 billboards and signs), Sci-Fi City (billboards, signs); **C** neon and window glow (city.json) |
| Street props | lamps, traffic lights, bins, bus stops, subway entrances, barriers, benches | **A** City; **F** Kenney City Kit Roads |
| Cars and hover cars | parked and ambient traffic | **A** City (8 cars: ambulance, police, taxi, sedan, smart car, 4x4, van, muscle car), Sci-Fi City (9: hover bike, future car, taxi, police car, trucks) |
| Interiors: apartments | kitchens, TVs, sofas, beds, bathrooms | **A** Sci-Fi City (beds, screens); **F** Kenney Furniture Kit, KayKit Furniture Bits |
| Interiors: shops, bars, offices | counters, shelves, arcade machines, desks, server racks | **A** City (10 shop interior items); **F** KayKit Restaurant Bits, Kenney Mini Arcade, Quaternius Sci-Fi MegaKit |
| Landmarks | city hall, stations, a church, the Spire | **A** City (stations, city halls); **C** the Spire and a church built from kit pieces |
| Boats | the harbour | **F** Kenney Watercraft Kit (45 boats, glTF) |
| Skyline | the far city | **C** city.json `skyline`, dressed with the kits' buildings as impostors |
| Player characters (2 detailed) | male and female, cyberpunk | **A** CoreCharacters Techwear Hacker, Male and Female |
| Bots and crowds | many, light | **A** Sci-Fi City (20 characters), City (9 characters) |
| Animations | run, jump, slide, climb, reloads | **C** Mixamo (already fetched; see 5.4) |
| Guns, first person and third | the ten SpeedKills guns | **C** gunmodels.ts, and Phase 20 A19 (the PANDA showcase) |
| First-person hands | gloves and forearms | **C** fparms.ts (the player's own arms) |
| Jump pads, beacons, loot boxes, doors | gameplay objects | **C** (the pads are ours by design, readable gold rings) |

## 4. The packs compared (the shortlist)

Prices are USD, read on 2026-09-26/27 from the stores' own data. "Web" means how well it works in three.js as GLB.

**City kits**

| Pack | Price | What it covers | Style | Web | Why or why not |
|---|---|---|---|---|---|
| **Synty POLYGON Sci-Fi City** (Synty Store) | $49.99 | 509 assets: modular buildings and sections, 9 vehicles, 20 characters, 18 weapons, antennas, dishes, solar panels, billboards, beds, screens; FBX source | low-poly, one palette atlas | Good | **In the buy.** The sci-fi core |
| **Synty POLYGON City** (Synty Store) | $19.99 | 331 assets: modular office and apartment buildings, shop fronts, fire escapes, rooftop access, AC units, vents, pipes, 8 cars, 9 characters, 50 signs, subway, bridges | low-poly | Good | **In the buy.** Rooftops and streets |
| Synty POLYGON Sci-Fi Cyber City | $199.99 | nearly everything, the most neon | low-poly with custom shaders | Workable | Twice the budget; mixed reviews ("more of a props pack"); its triplanar and glow shaders need rewriting |
| Synty POLYGON Office | $49.99 | 772 assets, office interiors, kitchens, bathrooms | low-poly | Good | Next buy if the free interiors fall short |
| Humble "Best of Synty 6" | $30, ends 2026-10-13 | POLYGON Shops (1,900+ prefabs of shop interiors), Shopping Plaza, SIMPLE Buildings; one seat | low-poly | Good | Good value, but no neon and not the priority |
| GYP Cyberpunk Bundle (Unity) | $159.99 | modular buildings, 50 presets, interiors, signs; no cars | low-poly | Good | Over budget, and Unity-only download |
| Daelonik Neon City (Unity) | $119.50 core | the closest look to Hyper Scape: grid modular, skybridges, interiors | semi-realistic PBR | Workable | Over budget; 4.3 GB; custom shaders |
| JustCreate3D Cyberpunk City + Interiors (itch.io) | $19.99 each | 301 + 290 models, GLB included, 1 texture | flat low-poly | Good | Licence says assets "should be compiled": needs the seller's written OK |
| Quaternius Downtown City MegaKit (itch.io) | free (153) / $14.99 source | 300+ Boston/NYC modular pieces; the source has a fake window interior shader | low-poly | Good | **Free half fetched**; CC0 |
| Kitbash3D Cyberpunk / Cyber District | $95 to $245 | film-grade, millions of polys | realistic | Poor | Too heavy; a GLB needs extra "Usage Rights" |
| Unreal-format Fab kits (KK Design, Hivemind, SilverTm) | $65 to $300 | good neon cities | realistic | Poor | Unreal-only format: needs Unreal to export |

**Characters**

| Pack | Price | Detail | Web | Note |
|---|---|---|---|---|
| **CoreCharacters Techwear Hacker, Male & Female** (Fab) | $24.99 Personal | rigged male and female base bodies (Epic skeleton), modular techwear outfit, two hairstyles, colour customisation, FBX | Good once baked | **In the buy.** Stylised hand-painted with a cel shader, which sits with Synty's look. **Unrated** (new) |
| Artlix Customizable Cyberpunk Characters (Unity) | $49.99 | 1,260+ parts, 60 demo characters, 12 to 19k tris, one 1024 texture | Good | The best fit on paper, but Unity-only download and Unity's AI clause (section 5) |
| AhmedSagov Sci-Fi Player, Man / Woman (Fab) | $69.99 each | 37k tris, 4K PBR, realistic, rated 5.0 (2) | Workable | The realistic route; $140 for the pair |
| Cyberpunk Female Cyborg (Fab) | $14.99 | 25k tris, GLB, PBR with emissive, realistic | Workable | One character, unrated |
| Synty's own (in the buy) | included | 29 characters, low-poly, one atlas | Good | The bots and crowds |

## 5. Licences, and how paid files ship

### 5.1 Verdicts (research, not legal advice)

| Store | Other engines | A web game | Public repo | Verdict |
|---|---|---|---|---|
| **Synty Store, one-time** | yes, "not limited by game engine, OS, platform or device" | yes, no protection clause | **no** ("must not share the source files ... outside your team") | **Safe with conditions**. 5 seats. No NFTs, no gen-AI model generation, no uploading source files to 3D-generation services |
| SyntyPass subscription | yes | yes | no | **Avoid**: after cancelling, no use in new IP, minor fixes only |
| **Fab Standard** | yes, "not limited to Unreal Engine" | yes, but "you must restrict end users from extracting" | no (collaborators or a private repo only) | **Safe with conditions**: player terms plus light obfuscation. Personal tier under $100k revenue |
| Unity Asset Store | yes, except Unity Companion Licence packs | yes, "as incorporated and embedded" | no | Safe with conditions, **but** downloads need the Unity Editor, and its AI clause ("as inputs for artificial intelligence ... programs") is broad enough to worry a project that AI agents build |
| CGTrader | only in a "proprietary format" | needs encryption | no | Risky |
| TurboSquid | only listed engines' WebGL | **no** for GLB without written approval | no | No |
| Kitbash3D | yes | needs extra Usage Rights | no | Risky |
| Daz3D | yes | **no** for GLB | no | No |
| Mixamo | yes | yes | **no** for raw FBX | Safe with conditions |
| Quaternius, Kenney, Poly Haven | yes | yes | yes | Safe (CC0) |

The buy is Synty Store and Fab for these reasons:
- **Synty Store's licence is the most permissive for the web.**
- **Both stores download in the browser.** The Unity store needs the Unity Editor to download at all.
- **Neither has a broad AI-input clause**, which matters in a project that AI agents build.

### 5.2 How they ship (what the overnight agent builds first)

1. **Sources never enter git.** The owner's downloads stay in `C:\Users\jwilb\Downloads\speedkills-paid\`,
   outside the repo, with the receipts and a PDF of each licence as on the day.
2. **Only optimised GLBs ship**, built by `tools/import-paid.ts` into `public/models/paid/` (gitignored). They
   are pruned, merged and meshopt-compressed, with WebP textures at 1024 or 2048 and the copyright fields kept.
3. **They are served only by the game server** (fpsfun.duckdns.org, `npm run fps deploy`), never by GitHub Pages.
   Pages pushes the build into a branch of a public repo. The owner is retiring Pages; until then,
   `npm run deploy` must not carry paid files.
4. **The release gate refuses a leak.** `npm run rules` / `tools/release-gate.ts` fails if any path under a paid
   folder is tracked by git or appears in the Pages build.
5. **The game works without them.** A checkout without the paid files falls back to today's look, as
   materials.ts falls back from WebP to JPEG, so verify and e2e run anywhere.
6. **Fab content is packed**: its GLBs sit in one custom container with a light XOR and are decoded before
   `GLTFLoader.parse`. This meets Fab's "restrict end users from extracting". It stops "save as", not a
   determined ripper, and no licence here asks for more.
7. **Player terms.** A line in the menu: no extracting or reusing the game's assets outside the game.
8. **AI agents touch paid files only with local tools** (unzip, fbx2gltf, gltf-transform, three.js), never
   upload them anywhere, and never paste their bytes into a prompt.

### 5.3 The repo

The repo is public today (GitHub reports it so), and the owner means to make it private. Private or not, paid
files stay out of git: a private repo keeps them in its history, and any collaborator added later would see
them.

### 5.4 A flag on Mixamo

`tools/fetch-mixamo.ts` calls Mixamo's internal API with a pasted token. Adobe's terms (3 Oct 2025, section 6.6)
forbid access "by any means other than the interface we provide or authorize". Fetching through the site is
the safe way for new characters and clips.

## 6. The overnight brief (paste into a fresh session, or tell this one "go")

> Owner's request: build Phase 21 step 1, the vertical centre with the bought kits, overnight. The plan is
> docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md; read sections 1, 2, 5 and 6 first. The owner is asleep: do not
> stop for anything CLAUDE.md does not stop for.
>
> **Where.** A new worktree: `git worktree add ../apex-city -b vertical-centre main`. apex-range-f5 is doing
> Phase 20 A15 to A19 in apex-net (branch resurgence); do not touch it. A17 changes jump numbers, so every
> gap and pad here is worked out from MOVE, never typed in.
>
> **Inputs.** The owner's downloads in `C:\Users\jwilb\Downloads\speedkills-paid\`: Synty POLYGON Sci-Fi City
> and POLYGON City (FBX source zips), CoreCharacters Techwear Hacker (Fab FBX zip). Never commit anything from
> there, never upload it anywhere, never paste its bytes into a prompt.
>
> **Order.** Each step is build, test, document, commit. If the night runs short, stop at a step's end; the
> order is what gets cut.
> 1. **The pipeline (plan 5.2).**
>    - `tools/import-paid.ts` (npm `fbx2gltf` and `@gltf-transform/cli`) writes `public/models/paid/`
>      (gitignored).
>    - The gate refuses tracked or Pages-bound paid files.
>    - A checkout without paid files falls back to today's look.
>    - Fab files go in the XOR container.
>    - Measure each kit piece, bounds, storey height and bay width, into `src/config/kit-paid.json` with the
>      measurements in its `_note` (CLAUDE.md: measure, do not guess). Only file names and sizes are committed,
>      never geometry.
> 2. **The measure (plan 1).**
>    - `tools/checks/city-levels.ts` exists and reports today's numbers
>      (`GAME=speedkills npx tsx tools/checks/city-levels.ts`).
>    - Add bands to 100 m and up, and the targets in plan 2.1 for THE SPIRE sector.
>    - Wire it into verify.
>    - Check it fails by building today's centre against the targets.
> 3. **The shells (plan 2.2 and 2.3), in city.ts and city.json**, every number with a `_note`:
>    - towers of 20 to 40 storeys, and the decks at storeys 8 and 16;
>    - skybridges, and stairs inside every tower;
>    - pads deck to deck, and window pads;
>    - climbable balconies and ziplines down;
>    - the Spire's crown at 140 to 160 m and the atrium with its updraft;
>    - the capture zone on the Spire's crown.
> 4. **Dressing (plan 3):**
>    - facades per bay per storey from the measured pieces, with open bays on the deck floors;
>    - rooftop clutter;
>    - interiors on the deck floors (rooms that differ), with the free kits fetched for furniture;
>    - street props and parked cars.
>    - Use instancing and per-block merges; draw interiors only near the player.
> 5. **Bots:**
>    - the nav graph over decks, stairs and pads;
>    - extend `tools/checks/sk-roofs.ts` so a bot reaches every deck and every crown from the street.
> 6. **Performance:** draw calls and frame time in the centre before and after, as medians over interleaved
>    runs. Do not ship a regression you cannot explain.
> 7. **Characters (last):**
>    - the male and female Techwear Hacker as SpeedKills player skins, baked to one or two 2048 materials, with
>      LODs, and Mixamo clips retargeted (`SkeletonUtils.retargetClip`);
>    - Synty characters for bots.
>
> **Release, only if everything passes:**
> - Run `npm run verify`, `npm run rules`, the three e2e batches, `npm run fit` and the new checks.
> - Then rebase onto main, `git merge --ff-only` in apex-range, push, `npm run fps backup` and
>   `npm run fps deploy`.
> - **Do not run `npm run deploy` (Pages)** while paid files are in the build.
>
> If anything fails and cannot be fixed by morning, leave it on the branch. Either way, write the morning
> report in `docs/updates/2026-09-28.md`: before-and-after numbers, screenshots, what was cut, what is next.
> Never touch the Algonomics VM.

## 7. The buy

### 7.0 The owner's decision, 2026-09-27: the realistic route (this replaces 7.1 below)

The owner preferred a realistic look over Synty's low-poly and chose:
- **Daelonik Neon City Bundle** (Unity Asset Store, package 315692; Unity 6000.0.48 or later): Neon City, High
  City (skybridges and high platforms), Buildings (300+ premade blueprints) and Underground. It is
  semi-realistic PBR with neon, the closest look to Hyper Scape.
- **Sci-Fi Modular Soldier** by AC Game Assets (Unity, package 279661, $49.99, unrated), one male hero:
  - 36k tris, a Humanoid rig and 51 ARKit blend shapes;
  - modular armour, colour masks and skin tones.

What changes in the overnight brief (section 6):
- **Inputs.** The .unitypackage files the owner downloads through Unity 6's Package Manager, in
  `%APPDATA%\Unity\Asset Store-5.x\`. The agent waits until each file's size stops changing, since big
  downloads may still be running when the owner goes to bed.
- **Pipeline step 1** gains a Unity stage, before fbx2gltf and gltf-transform:
  - a project of the agent's own at `C:\Users\jwilb\Downloads\speedkills-paid\unity\`;
  - the packages imported with `Unity.exe -batchmode -importPackage`;
  - KhronosGroup UnityGLTF added to that project;
  - an editor script, run with `-executeMethod`, that exports each prefab the centre uses to GLB.
- **Materials.** Daelonik's custom shaders do not export (DLNK's pipeline page). Rebuild each material the
  centre uses as a three.js MeshStandardMaterial from its textures, with the neon on emissive and the game's
  bloom. Screenshot a Neon City prefab in Unity against the same prefab in three.js before dressing the centre.
- **Textures.** Realistic PBR ships at 1K WebP, 2K only for hero pieces. Merge by material, since tileable
  textures share well.
- **Characters.** The soldier is baked to one or two 2048 materials with LODs. Mixamo clips are retargeted to
  its Humanoid rig.
- **Licence.** Unity Asset Store EULA: engine-agnostic for these publishers' packs. Its AI clause is broad, so
  agents run only local tools on the files (Unity batch, fbx2gltf, gltf-transform) and never paste their bytes
  into a prompt.

### 7.1 The earlier stylised pick (not bought)

**Total: $94.97 plus any sales tax.** One style throughout: clean stylised low-poly with neon, which is also the
cheapest to draw for 30 players in a browser.

1. **syntystore.com**: make an account.
   - Buy **POLYGON - Sci-Fi City Pack** ($49.99) and **POLYGON - City Pack** ($19.99) as the one-time purchase.
     Not SyntyPass.
   - Download each pack's **FBX Source Files**; the Unity, Unreal and Godot projects are not needed.
2. **fab.com**: sign in with an Epic account.
   - Buy **Stylized Techwear Hacker Outfit: Male & Female Character Pack** by CoreCharacters, the **Personal**
     licence ($24.99). Not "Reference Only", which has no files.
   - Download the **FBX** format.
3. **Save the files.** Put all the zips in `C:\Users\jwilb\Downloads\speedkills-paid\` (make the folder). Save
   the receipt emails there too.
4. **Start the overnight run**: say "go" in this session, or paste section 6 into a new one.

What this does not cover, and why that is fine for tonight:
- **Guns and first-person hands** are ours (gunmodels.ts, fparms.ts, Phase 20 A19).
- **Kitchens, TVs, sofas, boats and more street props** come from free CC0 kits: Kenney Furniture Kit, KayKit
  Furniture and Restaurant Bits, Kenney Watercraft Kit, Kenney City Kit Roads and Quaternius.
- **A church** is not in any pack. It is OLD TOWN's landmark, built from kit pieces when the ring is rebuilt,
  not tonight.
- **The characters are the one gamble.** They are new with no reviews, and cel-shaded. If they disappoint,
  Synty's 29 characters stand in, and the realistic pair (AhmedSagov, $140) or Artlix through Unity ($49.99)
  are the fallbacks.
- **The look changes.** The centre will be stylised while the rest of the city keeps its photo textures, until
  the ring is rebuilt the same way.

**Next buys, if they are wanted later:** POLYGON Office ($49.99) for interiors; the Humble Synty 6 bundle ($30,
ends 2026-10-13) for shop interiors; Quaternius Downtown source ($14.99) for its fake window interior shader.

## Sources

- Synty Store product data (`/products/<handle>.js`, prices and stock): polygon-sci-fi-city, polygon-city-pack,
  polygon-sci-fi-cyber-city, polygon-office-pack, polygon-shops-pack, polygon-town-pack; product pages for
  contents.
- Synty one-time licence: https://syntystore.com/pages/one-time-purchase-licence; subscription:
  https://syntystore.com/pages/standard-subscription-licence
- Fab listing data (`fab.com/i/listings/<id>`): d264c46e-a498-400e-804a-eb9c83e2781c (CoreCharacters),
  e2b0457b-1dab-4958-9ae6-82455d93b1a2 (Female Cyborg), df1630a9-6902-4c47-ae69-f9ed2ab367eb (AhmedSagov),
  cbcdcc43-7b27-4c37-9f15-849aaa25d434 (iPoly3D)
- Fab EULA: https://www.fab.com/eula (full text: https://www.fab.com/i/eula/fab_eula, 1 Oct 2024)
- Unity Asset Store EULA: https://unity.com/legal/as-terms; downloads through the Editor:
  https://docs.unity.com/en-us/asset-store/downloads/purchase-asset-packages
- TurboSquid licence: https://blog.turbosquid.com/turbosquid-3d-model-license/; CGTrader terms:
  https://www.cgtrader.com/pages/terms-and-conditions; Kitbash3D: https://kitbash3d.com/pages/license-text;
  Daz: https://www.daz3d.com/eula/; Mixamo FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- GitHub Pages and private repos: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Quaternius Downtown City MegaKit: https://quaternius.itch.io/downtown-city-megakit; Kenney Watercraft Kit:
  https://kenney.nl/assets/watercraft-kit
- Hyper Scape's city: docs/PHASE_19_PLAN_DOWNTOWN.md and its sources
