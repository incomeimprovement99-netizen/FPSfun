# Plan: first-person arms from KINEMATION FPS Animation Ultimate

The owner, 2026-09-27: the left hand "always glitching on the gun", and the arms should do what a shooter's do: "the
pickup animation when picking up loot and placing our hands and arms differently on a pistol vs smg vs rifle vs sniper
and allow our hands to charge the rifle". Today the first-person arms are the third-person soldier's, posed by our own
solver (`src/game/fparms.ts`). Neither bought pack has anything to take a grip from: the soldier (AC Game Assets) and
the guns (Tirgames) come from two sellers, and neither ships an animation or a hold. The owner is buying
[FPS Animation Ultimate](https://assetstore.unity.com/packages/3d/animations/fps-animation-ultimate-240060) by
KINEMATION ($54.99 on sale, list $109.99), chosen from about 25 packs researched the same day.

**The goal:** in SpeedKills, when the pack's files are on disk, the arms in first person are the pack's arms, playing
its animations for each class of gun, holding our ten Tirgames guns. The phase and morph effects (`gunfeel.json`, the
swap spin, the magazine sweep, BOOG's scope) stay, laid over the animation rather than replaced by it. Without the
files, the game runs as it does today.

## 1. What the pack is (from its file list, read before buying)

- **The arms:** `Character/SK_Arms_Mono.fbx`, black tactical gloves and sleeves, on the UE4 skeleton (`upperarm_l`,
  `lowerarm_l`, `hand_l`, the fingers, and the virtual bones `ik_hand_gun`, `ik_hand_l`, `ik_hand_r`). Our soldier
  uses the same bone names, but the pack's clips play on the pack's arms directly: no retargeting.
- **Every clip is its own FBX** (238 of them), which is what FBX2glTF carries animation in:
  - `A_FP_*` the arms, `A_W_*` the pack's own gun (its magazine, bolt and charging handle), `A_Cam_*` the camera.
  - Some weapons' fire clips, and three idles (PDW90, Viper-357, Drake-12's tactical sprint), exist only as Unity
    `.anim` files. Step 1 decides whether to parse those (Generic clips are plain YAML curves) or not use them: our
    recoil is procedural anyway.
- **20 guns, each with its own pose or idle and its reloads:**

  | Class | Pack guns | Their clips |
  |---|---|---|
  | Assault rifle | AK, MX16A4, G3, ASVal | pose or idle, tactical reload, empty reload |
  | SMG | MPS5, Striker-V, PDW90 | pose, tactical and empty reloads (PDW90 also an inspect) |
  | Shotgun | KXG12 (pump), Drake-12 (magazine) | KXG12: pump, pump when empty, reload start, loop a shell, end |
  | Marksman | Mk14EBR, SVD | idle or pose, tactical and empty reloads |
  | Bolt sniper | L96X, Kar98K | fire (the bolt worked), tactical and empty reloads; Kar98K a stripper loop |
  | LMG | MGX5 | idle, three reloads, belt clips |
  | Pistols | M1911, X18, DGL50, Kolibri, Viper-357 | pose or idle, reloads, Kolibri an equip |
  | Other | RPG, grenade | reload; throw start, loop, end |

- **Shared clips** (`Animations/General`, `Jump`): idle, walk, sprint, tactical sprint, jump start, loop and end,
  rifle equip and unequip, pistol unequip, and **PickUp_Item**.
- **Procedural in their Unity scripts, not animation:** recoil, aiming down the sights, sway. We already have all three
  (`src/game/viewmodel.ts`).
- **Licence:** the standard Unity Asset Store EULA, as for our other three packs. Its files follow the same rule as
  theirs: never in git or on Pages; they ship only with the game server (`tools/import-paid.ts`).

## 2. What the owner does

1. Buy it on the Asset Store while signed in to the same Unity account.
2. In the Unity editor: Window, Package Manager, My Assets, FPS Animation Ultimate, **Download**. No need to import it
   into a project: Unity keeps the download as a `.unitypackage` under `%APPDATA%\Unity\Asset Store-5.x\KINEMATION\`,
   which is where `npm run paid` finds packages.
3. Say it is downloaded. Nothing else: the rest is ours.

## 3. How it fits the game

### 3.1 Import (`tools/import-paid.ts`, `npm run paid`)

- Unpack the package into `speedkills-paid/extract/fparms`, like the other three.
- **The arms:** `SK_Arms_Mono.fbx` to `public/models/paid/arms/arms.glb`, mesh and skeleton, materials rebuilt at run
  time from its textures (as `soldier.ts` does).
- **The clips:** each class's `A_FP_*` clips into one GLB per pack gun we use (loaded when that gun is first drawn),
  the shared ones into `general.glb`. Animation only, no meshes.
- **Measured, not shipped:** the pack's own guns (`AK-200.FBX` and the rest) and their `A_W_*` clips are read at import
  time only, to measure, for each pack gun in its pose, where `ik_hand_gun` holds it, where its grip, handguard,
  magazine well and charging handle are, and when in each reload its magazine leaves the gun and comes back. The
  numbers go into `src/config/fparms.json` with the measurement beside them. This is the "measure, do not guess" rule:
  it is what lets our guns sit in hands posed for different guns.
- **Inventory printed on the first run:** every bone, every clip's length and tracks, the arms' triangles and texture
  sizes, the `A_W_` skeletons' part names. The plan's open questions (section 6) are answered from it.

### 3.2 The rig at run time (`src/game/fprig.ts`, new)

- One skinned arms mesh and a `THREE.AnimationMixer`, hung where the viewmodel's gun now hangs, so the viewmodel's
  pose (hip, ADS, sprint, recoil, sway, the swap's spin and drop) moves arms and gun together, as KINEMATION's own
  scripts do.
- **Layers:** the gun's pose or idle as the base; walk, sprint, tactical sprint and jump as additive layers made
  against the idle (`THREE.AnimationUtils.makeClipAdditive`), weighted by our movement; one-shot actions over the top
  (reloads, pump, bolt, equip, pickup) with short cross-fades.
- **Our gun on `ik_hand_gun`:** each of our ten guns parented to that bone with an offset worked out from the
  measurements: our grip (from `paidmodels.json`) onto the pack gun's grip. Reloads that tilt or lift the gun then
  move ours the same way.
- **The left hand onto our gun:** the clip puts it on the pack gun's handguard. A two-bone IK moves it onto our gun's
  own support point (measured, `paidmodels.json` support), blended out while the clip has the hand elsewhere (at the
  magazine, on the handle). The same correction for the right hand's grip if a gun needs it. This replaces
  `fparms.ts`'s solver in SpeedKills; the solver stays for the free build and the legacy game.
- **Parts that move:**
  - the magazine: our gun's `Clip` rides the left hand between the clip's measured "out" and "in" moments, and the
    magazine's phase out and in (`gunfeel.json` reload) plays at those same moments;
  - the charging handle and bolt: our gun's bolt group follows the pack gun's handle or bolt track, scaled to our
    part's travel (the USSO's `Slider`, measured);
  - BOOG, whose model has no bolt, keeps its cant and wheels, and the L96X's hand motion is tried against it (step 7).
- **Timing:** each reload clip is scaled to that gun's own reload time (`weapons` data), tactical and empty apart.
- **Aiming:** our ADS already brings a gun's sight line to the eye. With the rig, the sight point is read through the
  rig (the gun on `ik_hand_gun`, in the pose), and the same maths places the rig.
- **The camera clips:** `A_Cam_*` played as a small additive on the camera during reloads and equips, behind a
  setting and a `fparms.json` strength.

### 3.3 Our ten guns and the pack's

A first mapping, to be judged on pictures at the owner's view (1920 by 1080, 110 degrees) in step 2:

| Ours | Class | Pack gun | Why |
|---|---|---|---|
| USSO (`r97`) | Fast SMG | MPS5 | compact SMG held by its handguard; the Striker-V holds its long magazine as a grip, 22 cm under the USSO's |
| ANAKIN (`alternator_smg`) | Steady SMG | MPS5 | full-size SMG |
| ZEPHYR (`rspn101`) | Fast Rifle | MX16A4 | light rifle |
| PANDA (`vinson`) | Heavy Rifle | G3 or AK | heavier rifle hold |
| RIPTIDE (`shotgun`) | Auto Shotgun | Drake-12 | magazine shotgun |
| BIGANTLER (`mastiff`) | Heavy Shotgun | KXG12 | pump, and a shell-by-shell reload |
| PULSAR (`g2`) | Fast Marksman | Mk14EBR | DMR |
| HELIX (`3030`) | Heavy Marksman | SVD | DMR, a long gun |
| BOOG (`sentinel`) | Sniper | L96X | bolt sniper: the bolt worked after each shot |
| NOVA (`lstar`) | Energy LMG | MGX5 | LMG hold for the drum launcher's bulk |

The pack's pistols are ready for when SpeedKills has one (the Tirgames pistols are already imported).

### 3.4 The owner's list, and where each lands

| Wanted | From the pack | Step |
|---|---|---|
| A pickup animation when looting | `A_FP_PickUp_Item` (and its camera clip), played on E at loot | 8 |
| Hands placed differently per pistol, SMG, rifle, sniper | each pack gun's own pose, per class | 2 to 3 |
| Hands that charge the rifle | empty reloads work each gun's handle; the pump; the bolt | 6 to 7 |
| Swaps | rifle equip and unequip, pistol unequip, under our phase and spin | 8 |
| Hacks cast from the left hand | the grenade throw's start, loop and end, or our cast pose on the left arm alone | 8 |
| Recoil, aim, sway | ours, as now | kept |

## 4. Steps

Each step is built, tested, documented (a roadmap milestone, the diary, the README), committed and shipped before the
next, as every item is (`CLAUDE.md`).

The owner, 2026-09-27: "start with the boog and the usso for the arms to be perfect. when we get that commit push
deploy then you can work on the rest of the guns and all the other stuff". So steps 2 to 7 are done for USSO and BOOG
alone first and shipped; then the other eight guns go through them, then step 8 and 9.

1. **Import and inventory.** Unpack, convert the arms and the clips, measure the pack's guns, print the inventory,
   answer section 6. Check: `tools/checks/fparms-pack.ts` (in verify, skipped when the files are absent) that the arms
   and each mapped gun's clips load, the bones the rig uses exist, and the measurements are in `fparms.json`; `npm
   run rules` that nothing of it is tracked; Pages drops it.
2. **One gun in the hands.** The rig in the range with the USSO on `ik_hand_gun`, its pose and idle, our procedural
   pose on top. Pictures at the owner's view against today's. Then the mapping for all ten, judged on pictures.
3. **The hands on our guns.** Left-hand IK onto each gun's support point, and the right hand's grip checked. Checks
   (e2e soldier): on all ten guns, held and aimed, the left hand within 1.5 cm of the support point and the wrist bend
   (`wristBend`) under today's; no part of the arms in the sight picture aimed in (the existing sight checks).
4. **Aiming.** The sight line through the rig to the eye on every gun; the existing ADS alignment checks hold.
5. **Moving.** Walk, sprint, tactical sprint and jump layered by speed; the slide, climb, mantle and zipline keep
   their procedural poses, blended in and out. Pictures and the e2e movement sections.
6. **Reloads.** Tactical and empty per gun, scaled to our reload times; the magazine in the hand between its measured
   moments, phasing out and in as now; the handle and bolt driven. Checks: mid-reload the magazine is at the left hand
   and away from the gun, at the end it is home; from empty the handle moves while the left hand is on it.
7. **Pump and bolt.** BIGANTLER's pump after each shot and its shell-by-shell reload; BOOG's bolt worked after each
   shot (or its cant kept, judged on pictures); the USSO's rack from the empty reload.
8. **Swaps, pickup, hacks.** Equip and unequip under the phase and spin; the pickup clip when E takes loot; the hack
   cast on the left arm. The pickup must not delay the pickup itself: it is looks only.
9. **Camera clips, the look and the cost.** `A_Cam_*` as a small additive; the arms' materials tuned to the game's
   look (tint toward the soldier's colours if they read too plain); frame cost measured with `tools/profile-frame.ts`
   (budget: under 0.3 ms for the rig at 1920 by 1080); the solver retired from SpeedKills when the pack is present.

## 4a. Progress

- **2026-09-27, USSO and BOOG (steps 1 to 4, 6, 7 for these two):** the pack imported (`tools/import-fparms.ts`), the
  pack guns measured (`tools/checks/fparms-pack.ts`, in verify), and `src/game/fprig.ts` holding the USSO (as the MPS5)
  and BOOG (as the L96X) in the pack's arms, found by building it and judging each step on pictures at the owner's
  view. What it took, beyond the plan:
  - **the camera, not the gun, fixed in the rig**, as KINEMATION's player has it (its FPSPlayer prefab's camera, 80
    degrees): hung off our gun instead, the arms' shoulders and sleeves filled a third of the view; the gun camera draws
    at the pack's 80 degrees at the hip (ours was 92);
  - **our gun fitted into the hands**, trigger on the pack gun's trigger, tilted about it until its underside meets the
    left palm, and the hands reaching it wherever our view puts it (hip, aim, recoil, sway, sprint);
  - **the pack's own shoulder offsets**, read off each gun's settings asset (the L96X's right one 21 cm back): without
    it BOOG's right wrist bent 87 degrees at the hold and 155 aimed; aimed, both shoulders a further 12 cm back, since
    our sights bring the gun nearer the eye than the pack's (the USSO's wrists 109 and 70 degrees aimed, now 4 and 11);
  - **the left hand onto our magazine and handle** over the moments the pack gun's own clip moves them (measured off
    it), its offset turning with the magazine, and at the hold kept at its height against our underside;
  - the gun's quarter turn on the gun bone, measured, is KINEMATION's own `rotationOffset` (90 degrees about x, its
    `FPSWeaponSettings` default).
- **Moving (step 5) for USSO and BOOG:** the pack's walk, sprint and jump, read off its `.anim` files' additive bone
  (the FBX clips do not carry it), blended by our speed.
- Next: the equip on swaps, the magazine seen in the hand through the reload, then the other eight guns, the pickup
  and the hack cast (step 8), camera clips and cost (step 9).

## 5. What stays

- The phase and morph effects on USSO and BOOG, the swap spin, the gun screens, BOOG's scope, the glint.
- The third-person figures: the soldier and his retargeted clips, untouched.
- `fparms.ts`, for the free build and the legacy game.
- Every number in config with a note: clip choices, offsets, blend times and strengths in `src/config/fparms.json`.

## 6. Open questions, answered in step 1

Answered by the first look at the owner's download, 2026-09-27 (unpacked outside the repo, converted with our
FBX2glTF, read in `speedkills-paid/analysis/fparms`):

- **The arms:** 24,360 triangles in three meshes (glove, sleeve, hand) and three materials, textures as separate PNGs
  (`T_Arm01_C`, `T_Glove01_N`, `T_Cloth01_Roughness` and the rest). A full UE4 skeleton, with `ik_hand_gun`,
  `ik_hand_l` and `ik_hand_r`.
- **The scale is metres:** upper arm 0.30 m, forearm 0.27 m, wrist to middle knuckle 0.12 m.
- **The clips convert whole:** each `A_FP_*` FBX becomes one take of about 130 bone tracks; each also carries the arms'
  meshes, which the import strips.
- **The pack's guns name their parts plainly** (the MP5: `Root`, `Mag`, `ChargingHandle`, `Bolt`, `Trigger`,
  `ReleaseHandle`, `FireSelect`), and its `A_W_*` clips move those, so the magazine's and the handle's moments are read
  straight off the tracks.
- Still open: how the pose and locomotion clips combine (KINEMATION's controller and masks; read in step 2), and
  whether any `.anim`-only clip is worth a parser (not for USSO and BOOG: their stand-ins have FBX clips).
