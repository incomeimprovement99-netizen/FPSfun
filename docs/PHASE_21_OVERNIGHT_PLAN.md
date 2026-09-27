# Phase 21 overnight: the soldier, the weapons and the centre

Written 2026-09-27 by the agent working overnight, from `docs/OVERNIGHT_BRIEF_SOLDIER_AND_VERTICAL_CENTRE.md` (the
brief) and the owner's message that night. **The brief holds the detail for the soldier and the centre; this plan
adds the weapons, sets the order, and keeps the progress.** A scheduled prompt resumes the work every 20 minutes
if the session stops (a usage limit, a crash), and it reads the progress section first.

## The owner's three goals

1. **The centre's layout with exact measurements, for chained movement** (the brief, section 4).
2. **The soldier and its variants** (the brief, section 3): the bought Sci-Fi Modular Soldier, 4 variants, colours
   and pieces the player can change, animations right in first and third person, live.
3. **The weapons and their variants** (new, below): the bought Sci-Fi Battle Weapons replace SpeedKills' gun models
   and skins.

The owner: "We have the full plan laid out already so do not stop until we are done here."

## What changed since the brief was written

- **A15 is live** (292bf1c): SpeedKills sprints at 550 hu/s (14.0 m/s), always when moving forward; the ground bands
  doubled with it; the slide caps at 630 hu/s. The brief's section 4.1 table is the first pass; the reach harness
  (4.2) measures what is live now. A jump and a double jump already clear 24 m (`tools/sk-movesim.ts`), and
  `tools/checks/sk-roofrun.ts` maps the city's roof network (147 of 958 gaps).
- **A18's first fixes are live:** bots aim with half the lag, a friend's swing at 9.4 m, the frame-phase timer
  (`?perf`) and the repeating bench (`BENCH_RUNS`, `BENCH_SPOT=skrun`). Use the bench for the soldier's 30-figure
  measurement (S8).
- **A17's footage numbers never landed** (the research agent stopped with the session). Every distance in the
  centre is computed from `MOVE` and re-proven by a check, as the brief says, so they follow when A17 lands.
- **This branch (`soldier`) starts behind main** (made at 4456723; main is at 0de459b). Rebase before the first
  commit of code, so the soldier work sits on A15 to A18.

## The weapons (new): Sci-Fi Battle Weapons by Tirgames

### What was bought, and what is in it

- The download: `%APPDATA%\Unity\Asset Store-5.x\Tirgames assets\3D ModelsPropsWeapons\Sci-Fi Battle Weapons.unitypackage`
  (626 MB), unpacked to `C:\Users\jwilb\Downloads\speedkills-paid\extract\weapons\`. The same licence rules as the
  soldier (the brief 2.5): paid files never enter git, ship only with the game server, and the game works without
  them.
- **Guns, each as two models (`_1`, `_2`) and three skins (A, B, C)** with PNG colour, metallic (smoothness in its
  alpha, Unity's layout), normal, occlusion and emission maps:

| Pack model | Models | Proposed SpeedKills gun |
|---|---|---|
| SciFiRifle01 | _1, _2 | ZEPHYR (fast rifle) and PANDA (hard rifle) |
| SciFiSMG01 | _1, _2 | USSO (fast SMG) |
| SciFiSMG02 | _1, _2 | ANAKIN (hard SMG) |
| SciFiShotGun01 | _1, _2 | RIPTIDE (fast shotgun) |
| SciFiShotGun02 | _1, _2 | BIGANTLER (hard shotgun) |
| SciFiSniperRifle01 | _1, _2 | BOOG (sniper) and HELIX (hard marksman) |
| SciFiPistol01, 02 | _1, _2 each | none in SpeedKills' roster today; PULSAR (fast marksman) if it reads right |
| SciFiGrenadeLauncher01 | three parts | NOVA (special), if it reads right |
| SciFiRocketLauncher01 | _1, _2 | spare |

- **Also in the pack:** grenades, a smoke grenade, two mines (the MINE hack's model), med injectors, med packs and a
  med kit (the heal items), an ammo box, weapon cases and storage cases (the loot crates and care packages), and five
  sci-fi wall, floor and ceiling modules.
- The mapping is a proposal: each gun's model is picked from a render beside the others in its family, so the fast
  and the hard one of a pair read as different at a glance.

### What the import showed (2026-09-27, W1 done: 21 GLBs and 120 skin textures, 21 MB, local only)

- **Each family is one gun in two builds.** `_1` is the gun as one mesh; `_2` is the same gun split into its moving
  parts: `Clip` (the magazine), `Slide` or `Slider` (the bolt), `Pump`, `Trigger`, `Button`, and its extras (`Scope`
  with a `ScopeDot`, `Extruder`, `Silencer`, `Spinner1/2`). **Use `_2` in first person** so the reload has a
  magazine to take out; `_1` is fine for the floor and for far figures.
- **`UCX_*` meshes (material `Phy`) are Unity collision hulls: never draw them.** Skip them at load.
- **Axes and units:** metres; each gun lies along Z with its origin near the grip (the rifle from z -0.42 to 0.56).
  SpeedKills' procedural guns point down -Z with the origin at the grip, so the paid ones may need a half turn:
  W2 decides it per model by measuring which end is the narrow barrel.
- **Scope dots** use `SciFiScopeDot01` (and the launcher's `_Dot`), which the import did not convert: draw them with
  a plain emissive material.
- **The mapping, revised** (seven long-gun families for ten guns, so three pairs share a family and differ by build
  and skin; the owner can change any line in `src/config/paidweapons.json`):

| Gun | Model | Why |
|---|---|---|
| ZEPHYR (fast rifle) | SciFiRifle01_1 | the plain rifle |
| PANDA (hard rifle) | SciFiRifle01_2 | the same rifle with its scope and extruder |
| USSO (fast SMG) | SciFiSMG02_2 | the compact one (0.64 m) |
| ANAKIN (hard SMG) | SciFiSMG01_2 | the long one with a scope (0.86 m) |
| RIPTIDE (fast shotgun) | SciFiShotGun01_2 | magazine-fed |
| BIGANTLER (hard shotgun) | SciFiShotGun02_2 | the pump |
| PULSAR (fast marksman) | SciFiSMG01_1 | the long SMG without a scope, as a carbine |
| HELIX (hard marksman) | SciFiSniperRifle01_1 | the plain long rifle |
| BOOG (sniper) | SciFiSniperRifle01_2 | the long rifle with its spinners and magazine |
| NOVA (special) | SciFiGrenadeLauncher01_2 | the heavy energy gun, with its own sight |

- **Skins:** a gun sharing a family with another starts from a different skin (A, B or C), so the pair differs at
  a glance; the fusion level moves it on (as found, levels 2 to 3, levels 4 to 5) and brightens the glow.

### The steps

**W1. Import (`npm run paid`, `tools/import-paid.ts`).** Add the weapons to the tool: every gun model FBX to GLB
(FBX2glTF, as the soldier), materials stripped to named slots, textures to WebP (colour and emission sRGB; normal,
metallic and occlusion linear; the metallic map's alpha is smoothness, so roughness = 1 - A), 1024 for the
first-person view and a 512 set for third person. Versioned file names (`-v1`), since the server caches `/models/`
for a day. Output to `public/models/paid/weapons/`.

**W2. Measure each gun (`tools/checks/paid-weapons.ts`, skipped with a note without the paid files).** Off each GLB:
length, the grip's position (where the hand goes), the sight line (the top of the rear sight to the front), the
muzzle point and the magazine's node if it is separate. These go into `src/config/paidweapons.json` with the
measurement beside each number, the way the soldier's go into soldier.json. Nothing placed by eye.

**W3. The loader (`src/game/paidgun.ts`).** Load a gun's GLB once and clone it; build its material from the WebP
maps (`MeshStandardMaterial`, emission on, so the neon night lights them); scale and orient it so its grip, sight
line and muzzle sit where the procedural model's did (`gunmodels.ts`), so the view model's poses, the hold
(`hold.ts`) and the muzzle flash need no new numbers except the measured offsets.

**W4. First person (`viewmodel.ts`).** The paid model replaces the procedural one in the view model when present.
Check each gun in the sights: the sight line on the crosshair, the muzzle flash at the muzzle, nothing covering the
red dot (Phase 20 A3's lesson), the reload and swap still reading. Screenshots of every gun at hip and in the sights.

**W5. Third person.** The same models on the soldier's hands (`hold.ts`, the soldier's aim sockets, S5), at the 512
texture set; on the floor as loot (`loot.ts` drops), and in death boxes.

**W6. The variants.** Two kinds:
- **the fusion level shows on the gun:** skin A as found (level 0 and 1), B at levels 2 and 3, C at 4 and 5, with
  the emission brighter each level. A fused gun is visibly better, which is also A19's "a fusion level-up where the
  gun visibly upgrades";
- **the player's choice:** on the Loadouts tab, each gun's model (_1 or _2) where both fit its class, and its
  default skin family.

**W7. The rest of the pack where it fits:** the mine for the MINE hack, the med items for heals, the weapon cases for
care packages and loot crates, the ammo box for ammo. Each only where the game has the thing already.

**W8. Tests and ship.** verify and rules; `tools/checks/paid-weapons.ts`; the e2e gun sections (the hold test on
every gun, the view model checks) with and without the paid files; the bench for draw calls (a gun is one or two
meshes, so it should cost nothing new). Then the release as the brief's S9 says: from a copy that has the paid
files, with Pages kept free of them (S1).

**Legacy:** the legacy game (`?game=legacy`) keeps its procedural guns, as it keeps its figures.

**W9. The player's choice (W6's second half, not done in W1 to W8).** On the Loadouts tab, each gun's model and
its skin, seen by everyone:
- **The model:** any model of the gun's own family in the pack (SciFiRifle01 _1 or _2, SciFiSMG02 _1 or _2,
  SciFiGrenadeLauncher01 _1, _2 or _3, and so on), so a choice always fits its class. Every one of them measured
  (length, muzzle end, muzzle, sight top) into a `models` table in `paidweapons.json`, and
  `tools/checks/paid-weapons.ts` measures them all.
- **The skin:** which of the gun's three skins shows at levels 0 and 1; the fusion levels walk on from it through
  the other two, so a fused gun still visibly changes.
- **Carried:** one digit a gun (model and skin) after a `G`, a sixth field of the look code, as the soldier is the
  fifth, so friends see your guns; saved under `range.sk.guns`.
- **Built:** your hands' gun wears your pick; a figure's gun is its look's pick (the shared display copy keyed by the
  pick); floor guns and death boxes stay the gun's default.
- **Checked:** the code round trip, every model measured, and the e2e: a pick changes the gun in your hands and on
  your figure as a friend sees it.

## The order

1. **Rebase `soldier` onto main** (0de459b).
2. **The soldier:** the brief's S1 (the guards) to S9 (ship), in its order: S1, S2, S3, S5, S4, S6, S7, S8, S9.
3. **The weapons:** W1 to W8, shipped on their own.
4. **The centre:** the brief's 4.2 (the reach harness), 4.3 (the modules and `chains.ts`), 4.4 (the layout doc),
   4.6 (the grey-box in the range).

Each shipped piece gets its roadmap milestone, a diary entry (`docs/updates/2026-09-28.md`) and README and deploy
guide kept true. The morning report is the diary, as the brief's section 5 describes, with the weapons added.

**Cut line if the night runs short:** a soldier that looks right and ships beats every option on it; guns that look
right in first person beat every variant; a measured reach table and proven modules beat a pretty layout doc.

## Progress (updated as each step lands)

- [x] Rebase onto main (onto 0de459b)
- [x] S1 guards (19e8805): rules fails on a tracked paid file (proven); Pages drops `models/paid`; the soldier loads only when its file answers
- [x] S2 measured (6a922af): 1.845 m, pelvis 0.959, shoulders 0.494, all bones and pieces; drawn at 1.829/1.845 for the hit boxes
- [x] S3 loader, tinted materials, per-variant merge to 4 draws (6a922af); clips retargeted (`retarget.ts`, limbs 0.0 degrees off, proven)
- [x] S5 animations: retargeted (S3); the contact sheet of every motion, front and side, five moments each (`tools/soldier-clips.ts`), looked at; the guns in the hands (W5); first person wears the soldier's own arms (8d61bc8)
- [~] S4 variants: the four and their palettes are in soldier.json and render distinct (tools/soldier-sheet.ts); the picker is S6
- [x] S6 the picker (Loadouts tab: kit, armour, accent, suit, skin, eyes, beret, shoulders, pouches), kept under `range.sk.soldier`, carried to friends as a fifth look field (the wire's look limit 48 to 64); bots take their operator's look, the same on every machine
- [x] S7 hit volumes: the fixed column missed the soldier's head in most poses (`tools/soldier-hits.ts`: 110 mm off standing, 690 mm sliding); the soldier's volumes now follow its bones, the head within 1 mm (1b97ae5)
- [x] S8 finished (Milestone 248): the soldier's own fit test on the geometry (`tools/checks/soldier-fit.ts`, in verify), the contact sheet's finisher, revive, interact and emotes, first person holstered and on a zipline
- [x] S8 tests: the e2e `soldier` section (loads, heads in their volumes in eight poses, bots' kits, the fallback with every paid file a 404) and a friend's soldier code in `skfriends`; the bench with and without the volumes following (below)
- [x] W1 import (eec969f; run `PAID_ONLY=weapons npm run paid`)
- [x] W2 measured (`tools/checks/paid-weapons.ts`, `src/config/paidweapons.json`): length, muzzle end, muzzle, sight top
- [x] W3 and W4 (`src/game/paidgun.ts`): each SpeedKills gun wears its bought model in first and third person, its muzzle and sight line moved to the model's, its magazine, slide and pump in the procedural groups, fitted optics on its top
- [x] W6 the fusion level shows: the skin moves A, B, C and the glow brightens each level
- [x] W5 the guns in the soldiers' hands, checked in a picture
- [x] W7 the pack's props: the MINE hack's mine, death boxes (the storage case), care packages (the weapon case), floor guns in their skins, the med kit in a HEAL area; SpeedKills has no grenades, so the pack's are unused; `tools/checks/paid-weapons.ts` looks for every prop's files
- [x] W8 the guns are live (9915b25, Milestone 239)
- [x] W9 audited (Milestone 247): every gun on its split build (three kept their magazines in on a reload), model picks only between the SMGs (the rest by skin); the audit sheet is `tools/weapon-picks-sheet.ts`
- [x] W9 the player's choice of each gun's model and skin: on the Loadouts tab by each slot, kept and carried to friends as the look's sixth field; every family model measured into `src/config/paidmodels.json`; the e2e soldier section checks a pick in hand and on a friend's figure of you (Milestone 245)
- [x] Floor guns wear the bought gun's skin (they had shown its shape in one flat colour since 9915b25)
- [ ] Open: the legacy host-migration e2e stops at "four bots armed" (3 of 6 armed), in the batch and alone, and still with a minute of game time rather than wall time, so it is the legacy bots' looting and not load; first seen at 540e676, before the soldier and guns. To look into, not to paper over by lowering the bar.
- [x] 4.2 the reach harness (`tools/checks/reach.ts`, `src/config/reach.json`), and the modules' geometry in `docs/PHASE_21_LAYOUT.md`
- [x] S9 the soldier is live (5ee71b4, Milestone 238): batches (failures passed alone), fit, fallback, both deploys
- [x] 4.3 the modules proven (run gap, double gap, chimney: tools/checks/reach.ts)
- [x] 4.4 the layout: the centre's canyons measured (none took the chain), the four chimneys built in the city and proven there (tools/checks/sk-chimneys.ts)
- [x] Bots each wear their own soldier, seeded by their id, the same on every machine (Milestone 244); the killcam replays each figure in the soldier it wore
- [x] 4.6 grey-box: THE CHAIN, SpeedKills' third course (run gap, double gap, wall gap, chimney), every width from reach.json and proven on its own geometry (`tools/checks/sk-chaincourse.ts`); the window pad too, with pads brought to the course engine

## In the morning

- Put the PC's sleep back: `powercfg /change standby-timeout-ac 300`.
- The scheduled resume prompt runs every 20 minutes (at :07, :27, :47) while this Claude session is open; ask to
  cancel it once the work is done.
- **What to try first:** THE CHAIN, through the magenta gate in the middle of the range's back wall (SpeedKills): the
  three gaps, the chimney and the window pad at the city's measured distances. Then a battle royale: a blue window pad
  on any downtown podium throws you into that tower's Sky Lobby at 32 m, and across a canyon the next tower's window is
  a jump away. Every bot in its own soldier, the bought guns, the med kit in a HEAL area. On the Loadouts tab, each
  gun's model and skin by its slot. In first person, your soldier's own arms.

### Ranked next steps

1. **Play THE CHAIN and set its ranks.** Its S time (35 s) is a guess; the owner's times set the real ones, and any
   distance that feels wrong is one number in `src/config/chaincourse.json` or the movement (`reach.json` follows).
2. ~~Window pads into the city's towers~~ done: the Sky Lobby, 16 towers open at 32 m, 22 window pads, 7 canyon
   jumps and 2 bridges (Milestone 246, live at 48fce72). Next there: the bots' route finder taught the lobbies, a way
   down as well as up (a pad in and no way out would trap a bot 32 m up).
3. **The pad ladder** (pads deck to deck up a tower) and the balcony ladder, proven the same way.
4. **The owner's signature chain as a named route** in the centre, from the chimneys up to the Spire's crown.
5. **The legacy host-migration e2e: the cause found, the fix is the owner's call.** "Four bots armed" fails when bots
   land far from loot, not under load (it failed alone twice in a row, and passed throttled). The failure record now
   says what each unarmed bot is doing (tools/e2e.ts brMigrateTest): most have a loot source, are still looking, and
   have no goal at all, because a bot looks for loot within `bots.json` loot.search (45 m) of where it stands, and one
   that landed farther than that from anything it wants sets no goal and only drifts with its other goals; an elite
   gives up unarmed when its search time runs out (by design, `overtime`). The fix that follows the looter's own intent
   ("one that is not keeps looking") is an unarmed bot looking further for a gun, which changes the bots in the legacy
   game as well as SpeedKills (the looter is shared), so it waits for the owner. Found on the way and fixed: the "heard
   from" checks of the same section held a peer to 1.5 s, under the protocol's own keyframe interval (2 s, with a still
   peer sending nothing between), and failed whenever a bot stood still; they now take the keyframe plus its spread
   and half a second (tools/e2e.ts HEARD).
6. ~~A frame-rate reading on a quiet machine~~ done, after rel6 (the Sky Lobby in): a 30-player battle royale at high
   @skmatch, three runs each way interleaved, the soldier's volumes following its bones against not: median 12.4 ms
   (81 fps) against 12.7 ms (79 fps), inside the machine's swing, so following costs nothing measurable; no frame
   over 50 ms in any run (worst 33 ms), about 1,800 draw calls and 4.0 to 4.2 million triangles.
