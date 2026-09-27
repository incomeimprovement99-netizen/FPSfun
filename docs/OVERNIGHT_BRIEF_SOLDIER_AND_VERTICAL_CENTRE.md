# Overnight brief: the soldier, and the vertical centre measured

**For the agent that works tonight, 2026-09-27 into 2026-09-28.** The owner is asleep and wants to wake to two
things:

1. **The soldier in SpeedKills, deployed.**
   - The bought Sci-Fi Modular Soldier is the only player character, in **4 variants**.
   - The player can change its colours and pieces.
   - Animations look right in first and third person.
   - It is live on fpsfun.duckdns.org.
2. **The vertical centre fully planned, with the distances proven.**
   - Every jump pad, window pad, wall-run corridor, climb shaft and roof gap is placed at a distance worked out
     from the game's real movement code.
   - Checks prove each movement chain works, and that the chains the owner described are the fast way round.

Read this whole document once, then work through it in order. It holds your hand through the Unity assets because
they are new to this project. Everything else follows the project's usual rules (`CLAUDE.md`). When a step says
"measure", measure; do not type a number in by eye.

## 0. Before you start (10 minutes)

1. **Where you work:** the worktree `C:\Users\jwilb\Downloads\apex-soldier`, branch `soldier`. It was made from
   `main` at `4456723` and already holds the paid-asset import (section 2).
   - It has its own `node_modules`.
   - It has copies of the fetched free assets in `public/`.
   - Run `git log --oneline -5` there first.
2. **Who else is working:**
   - **apex-range-f5** is doing Phase 20 A15 to A19 in `C:\Users\jwilb\Downloads\apex-net` (branch `resurgence`).
     Do not touch that worktree.
     - Its **A15 changes movement**: sprint about twice as fast, and possibly always-sprint.
     - Its **A17 measures Hyper Scape's movement** and will change gravity and jump numbers.
     - So nothing in section 4 may hard-code a distance. Every distance is computed from `MOVE` (`src/game/movement.ts`)
       and re-proven by a check, so the layout follows when A15 and A17 land.
   - **apex-range-4b** wrote this brief and the import tool, and it stops here so you two do not collide. If
     something in sections 1 to 3 is unclear, send it a message (SendMessage to `apex-range-4b`); it has the whole
     history of the purchase and research.
3. **The house rules that matter tonight (from `CLAUDE.md`):**
   - **Every change:** `npm run verify` and `npm run rules`.
   - **Before a release:** the three e2e batches (`$TEMP/run-e2e.sh apex-soldier <port> <tag>`, with a free port
     such as 5196), then `npm run fit`.
   - **Do not edit `src/` or the README while this worktree's e2e is running.**
   - **Config:** gameplay numbers live in `src/config/*.json` with a `_note`. Numbers about a model are measured off
     it, and the measurement is written beside the number.
   - **Style:** comments say why, not what. No em-dashes in prose.
   - **Commit messages** are prose, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
   - **Never touch the Algonomics VM** (147.224.132.60). The game server is fpsfun.duckdns.org.
   - **Test tools never take the real mouse or keyboard** (the webdriver guard in `input.ts` stays).
   - **Keep going between steps.** Stop only for money, the owner's taste between two designs, or something
     destructive.

## 1. What the owner wants, in their words, and what that means

- "Implement the soldier completely so it's only these 2 or 3 soldiers we can choose from, with perfect animations
  and a couple different colors/skins", then: "Make 4 variants total, allowing us to change certain things."
- "I want to wake up with the soldiers fully imported and deployed into the game, with variants, and the animations
  looking great."
- "The map fully planned out, proving out that you worked out the distances for jump pads into windows, wall jump and
  roof to roof movement."
- On chains, with Empulse as the model: "Wallrun off of left wall, double jump to the right wall, wall run that for
  10m and double jump and dash up to wall run left again and repeat like 3 times and tap strafe 180 and then mantle
  climb to get up... to where chaining stuff is important and can provide good movement addiction."
- "The assets will come, but determining the distance between these things is crucial right now."
- From earlier tonight: movement is what draws players back; smooth play and gunfights are why they stay. The map's
  point is to be **vertical in a way no other battle royale is**: indoor and rooftop play, jump pads everywhere onto
  roofs and in through windows, no ability needed to get up.

So the order tonight is: **the soldier, deployed** (section 3), then **the centre, measured and proven** (section 4).
If the night runs short, the soldier ships and the city plan is as far as it got, written down honestly.

## 2. The Unity assets, step by step (done so far, and how it works)

### 2.1 What was bought, and where it is

- **Bought:** Sci-Fi Modular Soldier by AC Game Assets, Unity Asset Store package 279661, $49.99, under the
  Unity Asset Store EULA. The Neon City Bundle (the city kit) did **not** go through; the owner will retry. Nothing
  tonight depends on it.
- **The download:** `C:\Users\jwilb\AppData\Roaming\Unity\Asset Store-5.x\AC Game Assets\3D ModelsCharactersHumanoids\Sci-Fi Modular Soldier.unitypackage`
  (351 MB).
  - Unity Hub and a Unity project exist on this PC, but **you do not need Unity for the soldier**.
  - A `.unitypackage` is a gzipped tar with one folder per asset. Each folder holds `asset` (the bytes) and
    `pathname` (its project path).
- **The owner's paid folder:** `C:\Users\jwilb\Downloads\speedkills-paid\`, outside every repo.
  - `extract\soldier\` is the unpacked package.
  - `conv\` holds the FBX2glTF intermediates.
  - `receipts\` and `licences\` hold proof of purchase.
  - `power-before.txt` holds the PC's sleep setting before tonight. apex-range-4b set the PC to never sleep while
    plugged in; **put it back in the morning:** `powercfg /change standby-timeout-ac 300` (it was 5 hours).

### 2.2 The import tool (`npm run paid`, `tools/import-paid.ts`), already working

It unpacks the package, converts `Soldier.fbx` with FBX2glTF (the npm `fbx2gltf` binary, a devDependency), removes
the 104 face morphs and the embedded textures with `@gltf-transform/core`, and turns the 4K TGA textures into WebP.
The output is in `public/models/paid/soldier/`, which is **gitignored** (it falls under `public/models/*`), 4.7 MB in
all:

| File | Size | What |
|---|---|---|
| `soldier.glb` | 1.7 MB | 18 skinned meshes on one 67-bone skeleton, 4 empty named material slots |
| `tex/armor_color.webp`, `armor_normal.webp` | 2048 | the armour's colour and normal |
| `tex/armor_orm.webp` | 1024 | occlusion (R), roughness (G), metalness (B), the glTF layout |
| `tex/armor_mask.webp` | 1024, lossless | **R = the armour tint mask, G = the helmet tint mask** |
| `tex/body_color.webp`, `body_normal.webp` | 2048 | the suit |
| `tex/body_orm.webp`, `body_mask.webp` | 1024 | R of the mask = the suit tint mask |
| `tex/head_color.webp`, `head_normal.webp`, `head_orm.webp`, `head_mask.webp` | 1024 | R of the mask = the skin tone mask |
| `tex/eyes_color_1.webp` to `eyes_color_5.webp`, `eyes_normal.webp`, `eyes_orm.webp` | 256 | five eye colours |

Two traps already solved, so do not undo them:
- **Two copies of `sharp`.** `@gltf-transform/functions` brings its own `sharp` (0.35) through `ndarray-pixels`. Two
  copies of libvips in one process break each other's colour handling ("colourspace: parameter space not set").
  The tool therefore uses glTF-Transform's **core** only, and the textures are written before it is loaded.
  `@gltf-transform/functions` was uninstalled on purpose.
- **Texture jobs run one at a time.** Each 4096 TGA is 50 MB raw.

### 2.3 The model, measured

Read off `soldier.glb` by apex-range-4b with a script. **Measure again yourself** in a check (section 3, S2)
before any number goes into config.

- **Units and axes:** metres, with the root rotated -90 degrees about X (FBX Z-up to glTF Y-up). The figure stands
  **1.84 m** to the top of the head. The pelvis is at **0.959 m**.
- **Skeleton:** 67 bones with **Unreal mannequin names**: `pelvis`, `spine_01` to `spine_03`, `neck_01`, `head`,
  `clavicle_l/r`, `upperarm_l/r`, `lowerarm_l/r`, `hand_l/r`, the fingers, `thigh_l/r`, `calf_l/r`, `foot_l/r`,
  `ball_l/r`, and twist bones. **These are the bone names the game's figures and Quaternius animation clips already
  use** (`tools/fetch-clips.ts`: "the Unreal mannequin's bone names"). The clips can drive it directly; check the
  rest pose (S5).
- **The 18 parts** (triangles), with the material each uses:

| Part | Material | Triangles | What it is (check visually) |
|---|---|---|---|
| `body` | M_body | 14,914 | the suit, arms and legs |
| `head_eyes` | M_head + M_eyes | 6,402 | head and eyes |
| `armor_body` | M_armor | 5,070 | the chest and back vest |
| `misc` | M_body | 1,734 | belt and gear at the waist |
| `armor_knees` | M_body | 1,468 | knee pads |
| `armor_shoulder_l`, `armor_shoulder_r` | M_armor | 1,052 each | shoulder plates |
| `hat` | M_armor | 768 | a cap or helmet, tinted by the helmet mask |
| `bagL0`, `bagR0` | M_armor | 466 each | thigh or hip pouches |
| `bagL1` to `bagL4`, `bagR1` to `bagR4` | M_armor | 338 each | chest pouches |
| **All** | | **36,096** | |

### 2.4 How the pack colours it (rebuild exactly this)

Decoded from the pack's Shader Graphs. Blend mode 13 is **Multiply**, with the mask as opacity.

- **Armour:** `color = base * mix(1, tintArmor, maskArmor) * mix(1, tintHat, maskHat)`. Roughness is the ORM's G
  (smoothness is 1 - G), metalness is B, occlusion is R.
- **Suit:** `color = base * mix(1, tintSuit, maskSuit)`.
- **Head:** `color = base * mix(1, skinTone, maskHead)`.
- **Eyes:** one of the five eye textures, no tint.

The pack's own colours, a good start for the palettes (linear 0 to 1):

| Tint | Default | Variant 1 | Variant 2 |
|---|---|---|---|
| armour | 0.757, 0.837, 0.915 (pale blue-grey) | 0.132, 0.132, 0.132 (black) | 0.783, 0.606, 0.182 (gold) |
| helmet | 0.121, 0.269, 0.623 (blue) | 0.613, 0.000, 0.053 (red) | 0.472, 0.009, 0.000 (dark red) |
| suit | 0.757, 0.837, 0.915 | | 0.784, 0.608, 0.184 |
| skin | 1.000, 0.933, 0.894 | | 0.340, 0.248, 0.214 |

### 2.5 The licence rules (Unity Asset Store EULA; the owner's plan, section 5 of `docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md`)

- **Paid files never enter git.** Only the tool and the code that loads the files are committed.
  - `public/models/paid/` is ignored.
  - **Add a guard**: `npm run rules` fails if `git ls-files public/models/paid` is not empty.
- **They ship only with the game server** (`npm run fps deploy`), never GitHub Pages.
  - **Make `tools/deploy-pages.ts` delete `dist/models/paid` after the build**, and fail if any paid file is left.
    The owner is retiring Pages anyway.
  - Check that `tools/deploy-server.ts` does carry `public/models/paid` into the server's copy. It packs the working
    copy, which has the files; confirm it does not filter by git.
- **The game works without them.** A checkout with no paid files (apex-net, apex-range, CI) must show today's figures
  and pass verify and e2e. The soldier loads only if `models/paid/soldier/soldier.glb` answers.
- **Only local tools touch the files.** Never upload them anywhere, and never paste their bytes into a prompt.
  Screenshots of the game for the morning report are fine.

## 3. The soldier, step by step

Map the figure code first. The game's figures are Quaternius base bodies with garments on the same Unreal-named
skeleton, animated by Quaternius's Universal Animation Library clips. Start with these:
- `src/game/mannequin.ts` (loadMannequin; the clips load first);
- `src/game/kitdress.ts`, `src/game/heirlooms.ts`;
- `src/config/figure.json`, `src/config/outfits.json`;
- `src/game/fparms.ts` (the first-person arms);
- `tools/fit.ts` (`npm run fit`, the picture test);
- `tools/checks/body.ts` (measurements);
- the figure and outfit sections of `tools/e2e.ts`.

apex-range-4b asked a reader for a full map of these, and **section 6 has it** if it arrived before you started.

**S1. The guards (plan 2.5).** The rules guard, the Pages drop and the no-paid fallback. Commit.

**S2. Measure the soldier (`tools/checks/soldier.ts`, wired into verify, skipped with a note when the paid files are
absent).**
- **The figure's measurements:** height, pelvis height, head and eye heights, shoulder width, hand positions in
  bind pose. Use the same method as `tools/checks/body.ts`.
- **Bone names:** every bone the game's clips drive exists.
- **The parts:** all 18 are present, and every part named in `src/config/soldier.json` exists.
- **The textures:** every texture it names exists.

Put the measured numbers into the new config with the measurements beside them.

**S3. `src/game/soldier.ts`, the loader and materials.**
- **Loading:** load `soldier.glb` once; clone per figure with `SkeletonUtils.clone`.
- **Materials:** build four `MeshStandardMaterial`s from the WebP textures.
  - Colour textures are sRGB; normal, ORM and mask textures are linear.
  - Use `aoMap` and `roughnessMap` from the ORM (three.js reads G for roughness and B for metalness when the same
    texture is `metalnessMap`).
- **The tint:** add it with `onBeforeCompile`, after `#include <map_fragment>`:
  `diffuseColor.rgb *= mix(vec3(1.0), uTintA, mask.r) * mix(vec3(1.0), uTintB, mask.g);`
  - `mask = texture2D(uMask, vMapUv)`;
  - per-figure tints are uniforms, so each figure gets its own material clone that shares the textures.
- **Eyes:** swap the eye `map` between the five textures.
- **Draw calls, the trap:** 18 parts times 30 figures is 540 draws.
  - Once per variant, merge the visible parts that share a material into one `SkinnedMesh` on the shared skeleton
    (`BufferGeometryUtils.mergeGeometries`; all parts are bound to the same skeleton, so check the bind matrices
    match first).
  - That makes each figure 4 draws.
  - Measure draw calls with 30 figures, before and after.
- **LOD:** the repo has `meshoptimizer`. Add a simplified LOD for figures past about 30 m if the frame time needs it,
  and measure it.

**S4. The 4 variants and what the player can change (`src/config/soldier.json`, every number with a `_note`).**

Proposed; confirm each looks right in a screenshot and adjust:

| Variant | Parts shown | Default colours | Reads as |
|---|---|---|---|
| **VANGUARD** | everything: vest, helmet, both shoulders, knees, all 10 pouches, belt | pale armour, blue helmet | the full kit |
| **BREACHER** | vest, helmet, both shoulders, knees, belt; no chest pouches (thigh pouches kept) | black armour, red helmet | heavy, clean silhouette |
| **RECON** | vest, knees, belt, thigh pouches, 4 chest pouches; no helmet, no shoulders | gold armour, dark red accents | light, face showing |
| **RUNNER** | suit, knees and belt only; no vest, helmet, shoulders or pouches | suit tinted, bright accent | fast, lean |

What the player can change, on top of the variant:
- **armour colour**, **accent (helmet) colour** and **suit colour**, each from a palette of 8 in config, neon-night
  friendly;
- **skin tone**, 6 steps;
- **eye colour**, the 5 textures;
- **optionally, each piece on or off.** The owner said "allowing us to change certain things". A per-piece toggle
  is cheap once the parts are separate, so offer helmet, shoulders and pouches as toggles under the variant.

**S5. Animations, the part the owner will judge first.**
1. **Play the game's existing clips on the soldier:** idle, walk, run, sprint, jump, fall, land, crouch, slide,
   climb, mantle, wall run, death, and the weapon holds and reloads.
2. **Check the rest pose.** If both rigs share the Unreal mannequin's bone axes, the local rotations transfer
   directly.
   - Remove position tracks except the pelvis's, and scale the pelvis's height track by (soldier pelvis 0.959 m / the
     clip rig's pelvis, measured).
   - If limbs twist, retarget with `SkeletonUtils.retargetClip` from the clips' rig to the soldier's, and cache the
     retargeted clips.
3. **Make a contact sheet:** a puppeteer script under `tools/`, headless, never taking the real mouse. For every clip
   the game plays, render the soldier at 5 moments, front and side, into
   `docs/updates/2026-09-28-soldier-clips.png` (or several). Look at every frame. Fix feet through the floor, hands
   off the gun, elbows through the vest and shoulder plates clipping the head.
4. **Hands on the gun** in third person: find how the gun socket works today (the hand bone names match) and check
   every gun class on the soldier.
5. **First person:** read `fparms.ts`. Either keep its gloves and forearms, tinted to the variant's suit, or use the
   soldier's own forearms. Pick the one that looks right in a screenshot of each gun in the sights. **The arm must
   not cover the red dot** (Phase 20 A3's lesson).

**S6. The picker, saving, the network and bots.**
- **Picker:** a character picker in SpeedKills' menu where outfits are chosen today. It shows the 4 variants, the
  colour swatches, skin and eyes, and the piece toggles, with a turning preview.
- **Saving:** the choice goes to localStorage (keep SpeedKills and legacy apart, as Phase 20 A13 did).
- **Network:** send the choice as a compact code, not a JSON blob, in the same message that carries the outfit
  today, so friends see each other's soldiers.
- **Bots:** each bot picks a random variant and colours.
- **Legacy:** the legacy game (`?game=legacy`) keeps its figures exactly as they are.

**S7. Hit volumes and heights.** Any hitbox or camera height derived from the old bodies' measurements is measured
again on the soldier (1.84 m to the top of the head). If the soldier is taller than the old figure, decide whether to
scale it to the game's player height (in config, with the measurement) rather than change hitboxes. Headshots must
land on the soldier's head in a screenshot test.

**S8. Tests.**
- **Checks:** `tools/checks/soldier.ts` (S2).
- **Fit:** `npm run fit` adapted if it measures the old garments (the soldier has no loose cloth, so its fit test is
  "no body through armour" at the contact-sheet poses).
- **e2e:** the soldier renders; a variant and colours chosen in one browser are seen by a friend in another (the p2p
  section); bots show variants; the fallback holds with the paid files moved away. Run that case once by renaming
  the folder, then put it back.
- **Performance:** 30 soldiers in the battle royale, median frame time and draw calls against today's figures,
  interleaved runs (the owner uses the PC; see `bench-owner-load` in memory).

**S9. Ship it.**
1. verify, rules, the three e2e batches (rerun any failed section alone) and fit, all passing.
2. `git rebase main` in apex-soldier, then `git merge --ff-only soldier` in `C:\Users\jwilb\Downloads\apex-range`,
   then push.
3. `npm run fps backup`, then `npm run fps deploy` (LIVE CHECK). **Run the deploy from a copy that has
   `public/models/paid`:** apex-soldier has them, apex-range does not, until you run `npm run paid` there too.
4. **Do not run `npm run deploy`** (Pages) unless the paid files are stripped from its build (S1).
5. Docs: a roadmap milestone, a diary entry in `docs/updates/2026-09-28.md`, and README and the deploy guide kept
   true (the deploy guide gains `npm run paid` and where the Unity downloads live).

## 4. The vertical centre: distances first, measured from the real movement

The owner: "The assets will come, but determining the distance between these things is crucial right now." So
tonight's city work is **numbers and proofs, not art.** Its output:
1. a reach table measured with the real controller;
2. chain modules with their geometry computed from it;
3. the centre's layout, with every pad, window, corridor and shaft placed by coordinates;
4. checks that prove every chain;
5. **if time allows, a playable grey-box of the chain modules in the range**, so the owner can try them in the
   morning.

### 4.1 Tonight's movement numbers (first pass, from the configs; the harness replaces them)

`HU = 0.0254 m` (Hammer units, inches; `src/game/movement.ts`). SpeedKills lays `src/config/movement.speedkills.json`
over `movement.json`. As of `4456723`:

| Quantity | Config | Value |
|---|---|---|
| sprint | `sprintSpeed` 275 hu/s | 7.0 m/s. **A15 is making this about twice as fast** |
| gravity | `gravity` 690 hu/s2 | 17.5 m/s2 |
| ground jump | `jumpHeight` 56 hu | 1.42 m up, take-off speed 278 hu/s, 0.81 s in the air on the flat |
| double jump | `extra.doubleJump.height` 52 hu | +1.32 m; used at the top of a jump, 2.74 m in all. It comes back on touching a wall (`_doubleJump`: "once until you touch ground, a wall or a rope") |
| wall run | `extra.wallRun`: seconds 1.5, fall 0.45 g, minSpeed 140, out 230, up 56, cooldown 0.3, hold 0.45 | at sprint speed about 10.5 m of wall in 1.5 s (the owner's "10 m") |
| climb | `climbAttachOffset` 200 hu, `climbSpeed` 300 | a climb rises up to 5.1 m above where it began (measured; the movement note) |
| mantle | `mantleHeight` 90 hu | 2.29 m |
| air control | `airAcceleration` 650, `airSpeed` 75 | measure the steer |
| fall | `fallstunMinHeight` 100000 | no fall stun in SpeedKills |

First-order consequences at today's sprint, **to be replaced by measurements**:
- a flat sprint jump carries about **5.6 m**; jump plus double jump about **9.4 m** if speed holds;
- a wall kick (`out` 230 hu/s, `up` 56 hu) crosses about **4.7 m** before dropping back to kick height, so zig-zag
  walls sit about **3.5 to 4.5 m** apart (the downtown config's `canyon` is already 3 to 4.5 m, "a double jump's
  width").

**At twice the sprint (A15), the horizontal numbers roughly double. That is why nothing may be typed in.**

### 4.2 The reach harness (`tools/checks/reach.ts`; build it first)

Drive the real `Player` (`src/game/player.ts`) the way `tools/movesim.ts` does:
- `new Player(bounds)`;
- a scripted `MoveInput` (the `Script` class);
- collision boxes pushed into `RANGE_SOLIDS`;
- a fixed timestep.

Measure, with SpeedKills' movement profile applied, and print a table:
1. sprint speed, and the time to reach it;
2. apex and flat carry of a ground jump from a sprint;
3. the best double-jump timing, and its apex and carry;
4. a slide-jump's carry;
5. **the wall run:** metres along the wall and height lost from a sprint jump entry, by entry angle (10 to 45
   degrees) and entry speed;
6. **the wall kick:** the lateral and upward reach, with and without a double jump after it; the widest corridor a
   kick plus double jump crosses back and forth while still gaining height; and the net height change per
   left-right cycle, measured for widths from 2.5 to 6 m in 0.25 m steps;
7. the climb's greatest height, and its time for each storey (4 m);
8. the mantle's greatest ledge height;
9. **the tap-strafe:** how much speed a 180-degree turn in the air keeps, and the radius;
10. **pads:** for a pad's throw (`padSolve` in `city.json`), the arc to a target point, as a height-over-distance
    envelope;
11. **the dash** (the DASH hack, 26 m and cooldown 12 to 7 s by fusion level, `hacks.json`): once per chain at most,
    so a chain never needs two;
12. **paint** (`src/config/paint.json`): what each paint does to speed and jump, since painted strips can make a
    chain's gap reachable only on paint.

**Save the table as `src/config/reach.json` (generated, with a `_note` naming the tool), or print it into the plan.**
Everything in 4.3 and 4.4 reads it. Rerun it when A15 or A17 lands.

### 4.3 The chain modules (geometry as functions of the reach table)

Each module is a small, parameterised piece. `city.ts` places it, and `tools/checks/chains.ts` simulates it with the
real controller. For every module, the check proves the **intended chain succeeds** and, where the module is meant
to reward skill, that **a plain run or jump does not**.

| Module | What it is | Geometry, from the reach table |
|---|---|---|
| **Gap classes** (roof to roof) | 4 kinds of gap between roofs at the same height: **run** (a sprint jump makes it with 20% to spare), **double** (needs the double jump), **slide** (needs a slide jump), **chain** (needs a wall run on a side wall) | each gap sits between one move's reach and the next's, with a margin of 10% of the reach on each side |
| **Zig-zag corridor** (the owner's chain, flat) | two parallel walls, left and right, each marked runnable, forward along the corridor | width = the measured kick-plus-double-jump crossing, minus a margin. Each wall segment is at least one wall run's length (about 10.5 m now), and the segments are staggered so each kick lands on the next |
| **Chimney** (the chain, climbing) | the same two walls, closer, going **up** between two towers | width where the net height gain per left-right cycle is greatest (measured in 4.2, item 6). Three cycles, the owner's "repeat like 3 times", climb one deck gap; a stair inside the tower does the same climb slower |
| **The owner's signature chain** | wall-run left, double jump to the right wall, run 10 m, double jump plus DASH up to the left wall, repeat three times, tap-strafe 180, mantle out | built once as a named route (4.4, route 3), with each segment's length from the table. The DASH is used once; the repeats use kick plus double jump, which comes back on each wall touch |
| **Window pad** | a pad on a street, plaza or terrace that throws you **through an open window** on a deck floor | the window is at least 2.2 m tall and 2.0 m wide. The pad's `up` and `over` are solved (like `padSolve`) so the arc's middle passes the window's centre with at least 0.4 m clear on every side, **for every entry speed from standing to full sprint** |
| **Pad ladder** | pads on setbacks, deck to deck, each landing on the next terrace | landing within 2 m of the target; no pad throws you into a ceiling (a check against the solids above the arc) |
| **Balcony ladder** (up a facade, no ability) | a balcony every storey, offset a bay | vertical step = one storey (4 m), under the climb's reach (5.1 m); offset under a jump's carry |
| **Drop** | an atrium or edge you fall through to a lower deck | no fall stun in SpeedKills; add a landing pad or paint at the bottom so the fall keeps its speed |
| **Tap-strafe gate** | a dead end with the exit behind and above you | the exit's height is what a 180-degree tap-strafe plus double jump reaches, measured |
| **Speed strip** (paint) | a painted run-up before a gap that only paint makes | gap between the painted and unpainted reach |

### 4.4 The centre's layout (write it as `docs/PHASE_21_LAYOUT.md`, placed by `city.ts` later)

**Start from what exists**, in `src/config/city.json`:
- the centre sector THE SPIRE, 3 by 3 blocks (`blocks` [-100,-43], [-29,29], [43,100]; 14 m streets);
- the concourse at the podium height (bridges over every street);
- `downtown` (towers on podiums, canyons of 3 to 4.5 m between them);
- `spire` (tiers and a mast);
- `padSolve`.

Measured today (`GAME=speedkills npx tsx tools/checks/city-levels.ts`): THE SPIRE sector has 18,313 m2 of standing
room at the street, 15,074 m2 at 1 to 10 m, **1,169 m2** at 10 to 30 m, 7,086 m2 at 30 to 60 m, 1,478 m2 at 60 m and
up. The targets are in `docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md` 2.1 (highest point 120 m or more, the Spire's crown
140 to 160 m, the street 20% or less of standing room, indoor room in every band).

The layout to write, block by block, **with coordinates**:
- **Levels:** street (0), concourse (8 m), Sky Lobby deck (storey 8, about 32 m), Sky Park deck (storey 16, about
  64 m), crowns (storeys 24 to 30), the Spire (140 to 160 m).
- **Every pad:** position, floor, target and module. At least one street pad per block onto the concourse, **window
  pads into every tower's deck floors from at least two sides**, and a pad ladder up every tower.
- **Every chimney:** which two towers, which faces, from which deck to which. **At least four in the centre**, one
  per side of the Spire, so the fastest way up is always a chain.
- **Every zig-zag corridor:** the canyons between towers at deck height, along the bridges.
- **Every open window and room on the deck floors:** which rooms connect straight through a tower, so a player can
  run in one side and out the other onto a bridge.
- **The named routes**, each simulated in `chains.ts` end to end with its time:
  1. **Street to the Spire's crown by stairs only.** The slow, safe way, reachable by bots.
  2. **Street to the crown by pads only.** The target is 15 s or less.
  3. **The owner's chain:** street, window pad into the Sky Lobby, through the tower, out onto a chimney,
     wall-run zig-zag up three cycles to the Sky Park, tap-strafe 180 at the gate, mantle onto the crown. Faster than
     route 2.
  4. **Roof to roof round the ring:** the concourse and the lower crowns in a loop, using every gap class once.
  5. **The drop:** from the crown down the atrium to the concourse, the fast way into a fight.

What makes it stand out from other battle royales (write this section in the layout doc, in the owner's terms):
- the fight is on four stacked levels, not one;
- every level can be reached three ways (stairs, pads, chains), so a height is never locked;
- the fastest way anywhere is a chain a good player can do and a new player can see;
- windows are doors, and a tower is a room you run through, not a box you run round.

### 4.5 The Empulse notes

apex-range-4b set a researcher on Empulse's wall-running and level design, and wall-running level design in general
(Titanfall 2, Mirror's Edge, Ghostrunner, Neon White), for concrete spacing rules. **Section 7 has its findings** if
they arrived before you started. If section 7 is empty, do that research yourself (web) before 4.3, and write down
where every rule came from.

### 4.6 Grey-box (only if the soldier has shipped and 4.2 to 4.4 are done)

Build the chain modules as a test course in the range, beside the two existing courses (`src/game/course.ts`,
`src/game/courses/`): a zig-zag, a chimney, a window pad, the four gap classes, and the owner's signature chain. That
way the owner can play the distances in the morning. The courses are code, not art, like the city.

## 5. Order, cut line and the morning report

**Order:**
1. S1 guards.
2. S2 measure.
3. S3 loader and materials.
4. S5 animations and contact sheet.
5. S4 variants.
6. S6 picker, network and bots.
7. S7 hitboxes.
8. S8 tests.
9. S9 ship.
10. 4.2 reach harness.
11. 4.3 modules and checks.
12. 4.4 layout doc.
13. 4.6 grey-box.

**If the night runs short:**
- a soldier that looks right in 4 variants with good animations and ships beats a picker with every option;
- a measured reach table and proven modules beat a pretty layout doc.

**The morning report**, `docs/updates/2026-09-28.md`, written for the owner in plain words:
- what shipped (with the live check result);
- the contact sheet and a screenshot of each variant;
- the reach table;
- the modules proven;
- the named routes and their times;
- what did not get done, and what is next.

**Put the PC's sleep setting back:** `powercfg /change standby-timeout-ac 300`.

## 6. The figure system map (from apex-range-4b's reader, 2026-09-27)

A read-only reader mapped the figure code in this worktree. Line numbers are as of `f20e955`. **Its traps change
parts of section 3; where they disagree, this section wins.**

### 6.1 How a figure is built

- **Every moving figure is a `Dummy`** (`src/game/dummy.ts`), built with `{ rig: true, skin }`:
  - bots: `bots.ts:766`
  - remote players: `duel.ts:984-1008`
  - you in third person: `main.ts:5906`
  - the loadout preview: `main.ts:1763`
  - killcam ghosts: `killcam.ts:211`
  - the test lineup `figureLab`: `main.ts:7903`

  The Dummy builds the code robot first, then, if `useMannequin()`, a `MannequinFigure`, and hides the robot's
  pelvis (`dummy.ts:716-720`). **A figure made before the models load stays a robot**; only the preview rebuilds.
- **`src/game/mannequin.ts` is the whole pipeline** (there is no figure.ts).
  - `loadMannequin()` (`:567-635`) loads the clip files and samples `Pistol_Aim_Neutral` to store the aim sockets
    `template.handAim` (`hand_r`), `chestAim` (`spine_03`) and `shoulderR` (`upperarm_r`). It then swaps in the
    default body `models/body/Superhero_Male_FullBody.gltf`.
  - `bodyFor()` reshapes the body's geometry (torso and arms, from `outfits.json fit`).
  - `MannequinFigure` (`:702`, constructor `:780-827`) clones with `SkeletonUtils.clone`, names the root
    `"mannequin"`, collects bones by name and clones every material, with rules keyed **by material name**:
    - no `map` means it is painted the operator's shell colour;
    - `MI_Hair*` gets the hair tint;
    - `MI_Superhero*` with vertex colours is the body.
  - `wearParts` (`:845-875`) re-binds each garment to the figure's bones by name, and **silently skips a garment if
    any bone name is missing**.
- **Kits and dressing are not figure code.** `kitdress.ts`, `dress.ts`, `heirlooms.ts`, `tools/checks/dress.ts` and
  `tools/checks/hitcheck.ts` are not about figures.
- **Config:**
  - `src/config/outfits.json`: fit, builds, bodies, pieces, head, and 16 `sets` with parts, tint, hair and hair
    colour;
  - `src/config/figure.json`: the gun hold, used by `src/game/hold.ts`.

### 6.2 Animation

- **Clips:** Quaternius UAL1 and UAL2, trimmed into `public/models/mannequin/mannequin.glb`, `mannequin-more.glb`,
  `-extra-1` and `-extra-2`. The list is in `tools/fetch-clips.ts:33-55`. **Every clip has translation, rotation and
  scale tracks on all 65 bones**, including `root`.
- **Layers:** `addClips` (`:508-516`) splits each clip into `lower:` (`/^(root|pelvis|thigh_|calf_|foot_|ball_)/`),
  `upper:` and `full:`. The state machine is `update()` (`:1227-1489`).
  - **Legs:**
    - Idle, then Walk above 0.3 m/s, Jog above 2.6 and Sprint above 6.2;
    - crouch; Slide_Start, Slide_Loop and Slide_Exit;
    - in the air, Jump_Loop, or NinjaJump above `figure.json athleticJump` 7.2 m/s;
    - climb and mantle, ClimbUp_1m; the zipline; downed; landing; revive; emotes; finishers.
  - **Upper body:** Pistol_Aim_Neutral, Pistol_Reload, the lowered Pistol_Idle_Loop when sprinting or swapping,
    heal, hits, throws, melee.
  - **Death:** Death01 at 1.6x.
- **Code on top of the clips:**
  - `EDITED` bones are restored each frame (`:720-733`, the spin fix);
  - `turnBone` (`:645`) does the strafe yaw, look pitch and lean;
  - **two-bone IK** puts the hands on the gun (`reach`, `:1108-1136`), with elbow poles tuned by eye on the
    Quaternius figure.
- **Guns:**
  - a pistol goes on `hand_r`, with the offset `(0.02,-0.02,0.06)`;
  - a long gun goes on a `"gunMount"` object on `spine_03`, at `gripAt(template.shoulderR, ...)` from `hold.ts`;
  - `holdGaps()` feeds the e2e hold test.
- **No retargeting exists anywhere.** The code relies on the body sharing the clips' rig.

### 6.3 The look: choosing, saving, sending, bots

- **Operators and looks:**
  - `OperatorSkin` and the 6 `OPERATORS` are in `src/game/operators.ts`;
  - `lookCode()` / `readLook()` (`src/game/outfit.ts:89-107`) produce `"outfit|build|face[|body]"`.
- **Loadouts:** `src/game/loadouts.ts` holds `outfit/build/body/face`. Its storage key is `"range.loadouts.sk.v1"`
  in SpeedKills, and `valid()` accepts only real-cloth outfits.
- **Menu:** `src/ui/menu.ts:468-526` (operator and outfit cards, `#opBody`, `#opBuild`, `#opFace`; HTML at
  `index.html:451-469`). `main.ts:5390 applyLoadout` calls `viewModel.setLook(...)`.
- **Network:** `op` and `lk` in the state message (`src/net/link.ts:53-56`, `src/net/state.ts:72-73`, codec around
  `:185, :214, :513`). The look is sent from `duel.ts:1998` and received at `duel.ts:1422` (`setAvatarLook`, then
  `makeAvatar`, cached by `${weapon}|${op}|${look}`).
  - **`LOOK_MAX = 48` truncates today's longest look code.** Use short ids for the soldier's choice.
  - Older builds still clip at 48, so the mixed e2e section will notice.
- **Bots:** bots take `OPERATORS[(index+1)%6]` and never send a look (`bots.ts:766-780`); hosts send `op` only.
  Killcam ghosts ignore the look.
- **No figure or outfit field exists in either game profile.** `IS_SK` touches figures only for the loadout key, the
  enemy outline and a few hit details.

### 6.4 First-person arms

- **The rig:** `buildArmRig` (`mannequin.ts:1598-1674`) cuts the forearms and hands out of the body mesh.
  - It **keeps only meshes whose material name starts with `MI_Superhero`** and hides the rest.
  - It takes the finger poses from Quaternius clips.
- **The trap:** with the soldier, every mesh would be hidden but `FpArms.ready` would still be true. **The drawn
  gloves vanish and first person has no hands.**
- **Measuring:** `FpArms.measure()` (`fparms.ts:122-144`) needs `upperarm_*`, `lowerarm_*`, `hand_*`,
  `index_01_*`, `pinky_01_*` and `middle_01_*`. The soldier has them. Axes come from child offsets, so bone
  orientation does not matter there.
- **Decide S5's first-person question here:**
  - either filter the soldier's `body` mesh (M_body), which should include the gloved hands (check visually);
  - or keep the drawn gloves (`arms.ts`) tinted to the suit colour.

### 6.5 Tests, and where they would lie

- **`tools/checks/body.ts`** measures `public/models/mannequin/mannequin.glb`, hard-coded at `:37`, and assumes
  **bones point along +Y**. It would keep passing while measuring the wrong model. Point a new measurement at the
  soldier (S2); do not break the old one.
- **Other checks:**
  - `tools/checks/outfit.ts`, `gear.ts` (a hard-coded bone list with `"Head"`), `hold.ts`, `figlod.ts`,
    `emotes.ts`, `finisher.ts`;
  - `net-delta.ts:1107-1119`, the `lk` codec;
  - `verify.ts:409-415`, which pins the robot's hit-box neck.
- **`npm run fit`** (`tools/snap.ts`, `MAGENTA_MAX`) only paints `MI_Superhero` undersuit skin. **On the soldier it
  would show 0 magenta and pass without testing anything.** Give the soldier its own clipping test (S8).
- **e2e:**
  - `:1215-1233`: bots have a `"mannequin"`, `thigh_l` moves, the rifle's parent is `"gunMount"`,
    `gripReach > 0.5`;
  - `:2154-2176`: `figureWear` must count 4 or more `wear:*` meshes including `Peasant_Body`;
  - `:2452-2486`: the spin check reads `"Head"`;
  - `:5865-5926`: `holdTest` on 8 guns;
  - `:6405-6413`: `realArms()` is true, and the extra clips load in 10 s.
- **`tools/release-gate.ts`** runs verify and rules only.
- **`tools/rules-check.ts`** only greps text files for real names. It has **no paid-file guard yet**.

### 6.6 Serving

- **`tools/deploy-server.ts`** snapshots `git archive HEAD` **plus every gitignored file under `public/`**
  (`:99-111`), so the paid files do reach the server. Good.
- **The server caches `/models/` for 24 hours** (`serve.mjs:339-347`, `max-age=86400`). **Put a version in the
  soldier's file names** (for example `soldier-v1.glb`), or a re-import leaves players on the old model for a day.
- **`tools/deploy-pages.ts` pushes the whole `dist/` to the public `gh-pages` branch, with no paid-file exclusion.**
  S1 must add it, or not run Pages at all.

### 6.7 The traps, and what to do about each

1. **`Head` against `head`.** The Quaternius rig's head bone is `"Head"`; the soldier's is `"head"`.
   - Hard-coded `"Head"` appears at `mannequin.ts:721, :931, :1420, :1427, :1442-1444`,
     `outfit.ts:44, :532, :540` and `gear.ts:28`.
   - Clip tracks `Head.*` will not bind.
   - The e2e spin check hangs if `getObjectByName("Head")` is undefined (it throws inside a `setInterval`).
   - Fix: look the head up case-insensitively, or rename the soldier's bone to `Head` in the import. **The
     import-time rename is the smaller change.**
2. **A different rest pose and different bone axes, so a retarget is required, not optional.**
   - Quaternius is a T-pose with bones along +Y (`lowerarm_l` t = (0, 0.251, 0)).
   - The soldier is an A-pose with Unreal-style bones along +X (`lowerarm_l` t = (0.262, 0, 0)).
   - Retarget every clip once, at load or at import:
     - `SkeletonUtils.retargetClip`, or a world-space rotation-offset retarget per bone;
     - keep only the pelvis translation, scaled by leg length (the proportions differ: shoulders 0.494 against
       0.424 m, calf 0.391 against 0.459 m);
     - cache the result.
   - **Resample the aim sockets from the retargeted Pistol_Aim_Neutral on the soldier**, or every gun sits wrong.
   - Re-tune the hand-picked numbers against the soldier, in config, from screenshots: the pistol offset, the elbow
     poles and the downed -0.15.
3. **Bone sets differ.**
   - The soldier has no `root` joint, no `*_leaf_*`, and extra `*_twist_01_*` and `ik_*` bones.
   - Garments would be skipped, which is fine, since the soldier wears no Quaternius garments.
   - **Do not use `ik_hand_gun` as a socket**: it is not under `hand_r` and nothing animates it.
   - The twist bones get no roll from the IK, so watch for candy-wrapped forearms in the contact sheet.
4. **Materials are routed by name** (`MI_Superhero`, `MI_Hair`, `M_Joints`, no map means shell colour).
   - The soldier's materials must be set before the constructor's rules run, or be excluded from them. Otherwise it
     is painted flat in the operator's colour.
   - **`hat`, `body` and `head_eyes` carry COLOR_0**, which GLTFLoader turns into a vertex-colour multiply. Turn
     `vertexColors` off on the soldier's materials unless the colours are wanted (check what they hold first).
5. **The hit boxes are fixed numbers, not taken from bones** (`dummy.ts:428-459`: H 1.829 m, head sphere r 0.13 at
   1.679 m, arm boxes x ±0.33). The soldier is 1.84 m, 1.85 m with the helmet, and its shoulder plates reach x ±0.39.
   - The simplest honest fix is to scale the soldier to the hit-box figure's height (a config number with both
     measurements beside it).
   - Then check with a screenshot test that a headshot lands on the helmet.
6. **Performance.** About 36k tris against about 13.7k today; 18 meshes; 19 primitives; 18 skeletons per clone;
   19 shadow casters; 19 outline hulls.
   - Merge by material into one skinned mesh per material on one shared skeleton, **after baking the `hat` and
     shoulder nodes' own transforms**.
   - Measure draw calls and frame time with 30 figures.
   - Add a LOD through `figlod.ts` / `lod.json`.
7. **Loading is asynchronous.** e2e expects mannequins about 800 ms into a fight. Keep the root name `"mannequin"`
   and the mount `"gunMount"` (e2e looks for them), or update e2e in the same change.
8. **Paid files and tests.** verify and e2e must pass in a worktree with no `public/models/paid`. Test that once by
   moving the folder away.

## 7. Empulse and wall-run level design (from apex-range-4b's researcher, 2026-09-27)

Research from the web. The sources are linked; the developer's Steam posts, read through Steam's news API, were the
best primary source.

### 7.1 What Empulse actually is (three corrections to what we assumed)

- **The game:** Empulse is by **1047 Games** (the Splitgate studio), a **6v6 arena movement shooter**, not a battle
  royale. Early Access opened on 24 June 2026. The studio stopped active development on 26 August 2026
  ([Shacknews](https://www.shacknews.com/article/150495/splitgate-arena-reloaded-empulse-discontinued),
  [Steam](https://store.steampowered.com/app/4323990/EMPULSE/)).
- **Its kit** is wall-running (forwards and backwards, on almost any wall), a grapple, a metered **jetpack** burst
  where we have a double jump, Holojump pads ("closer to a snowboard jump, where you maintain momentum"), and Wall
  Boost Pads. **Only its mechs have a dash.** The owner's chain uses our DASH hack, which is a 26 m teleport on a 7
  to 12 s cooldown. **So a chain uses DASH once at most; the repeats come from kick plus double jump, which comes back
  on each wall touch.**
- **"Speed paint"** is **Speed P.A.I.N.T.**, an orange throwable (Portal 2's orange gel is its ancestor), per the
  developer's patch notes:
  - it gives **1.7x top speed**, capped at 18 m/s;
  - the boost **lingers 3 s** after you leave the surface;
  - it **lasts 15 s**, with a **12 s cooldown**;
  - it was nerfed because it was "the obvious pick in almost every situation"; players called the game "speed paint:
    the game".

  **Lesson: build speed surfaces into the map, as our `paint.json` strips; do not make them a throwable.**
- **Published speeds:**
  - wall run 20 m/s;
  - grapple 18.5 m/s;
  - base acceleration 35 m/s2.

  Wall-run length, jump height and map sizes are not published. Its movement was praised, and its maps were called
  small and generic.

### 7.2 What other wall-running games teach (sourced)

- **Titanfall 2's shipped settings, a worked example only** (from the game's pilot settings files):
  - sprint 6.6 m/s;
  - jump and double jump 1.52 m each;
  - gravity 15.2 m/s2;
  - wall run up to 10.7 m/s (1.6x sprint);
  - **a wall run lasts 1.75 s and starts slipping at 1.5 s**;
  - the kick off a wall is 5.2 m/s out and 5.8 m/s up;
  - **a wall touch gives the double jump back.**

  Respawn's designers:
  - new players "wouldn't trust the wall-run", and training sections fixed it;
  - the code ignores the sides of steps as walls;
  - runs started near the top of a wall were fixed so they no longer fall off;
  - **tilting the camera just before wall contact** "immediately made it feel much better"
    ([Game Developer](https://www.gamedeveloper.com/design/designer-interview-getting-i-titanfall-i-s-controls-just-right));
  - on the War Games map they used coloured wall-run panels "with arrows" to show the lines
    ([PCGamesN](https://www.pcgamesn.com/theres-titanfall-dlc-map-set-simulated-world-smooth-clean-and-abstract-parkour-playground)).
- **Mirror's Edge:** red Runner Vision marks the *accessible* route and fades as players learn. The level designer
  later preferred geometry that shows what is coming next over colour flashes.
- **Ghostrunner:** yellow guides, and "every exit from the arena should be in your view".
- **Neon White** ([Game Developer](https://www.gamedeveloper.com/business/-neon-white-and-designing-for-player-creativity)):
  - the player always knows where to go next;
  - there is at least one non-trivial shortcut;
  - the shortcut is never hidden;
  - it uses only moves from the main path;
  - and "the time where you're fully optimized also needs to feel really good".
- **Dying Light 2:** parkour forced exact distances between objects and flat roofs, with yellow reserved for
  parkour.
- **No designer has published a wall-to-wall spacing number.** Ours must come from our own physics (section 4.2),
  which is what the owner asked for.

### 7.3 Rules to turn into geometry (inference; every input measured from SpeedKills' movement)

Symbols:
- `v_wr`: wall-run speed; `T_slip`: when the run starts to sink;
- `v_out`, `v_up`: the kick's speed away from the wall and upward;
- `g`: gravity; `h_dj`: the double jump's height;
- `r`: player radius; `h_m`: the highest mantle; `h_c`: the highest climb.

Measure every one in `reach.ts` and put the config value beside each rule.

1. **Corridor width with no double jump:** `W_level = 2r + v_out * (2 v_up / g)`. Build the main path at **0.6 to
   0.85 x W_level**, so imperfect input still makes it, and never below 2 player widths.
2. **A double-jump gap:** wider than `W_level` and no wider than the kick-plus-double-jump reach. **The check must
   fail it without the double jump and pass it with one.**
3. **Size a run wall by time, not metres:** `L = v_wr x 0.8 to 1.2 s`.
   - Never require more than `v_wr x T_slip`.
   - A wall shorter than `v_wr x 0.4 s` is a kick plate, not a run wall. Avoid the ambiguous lengths between the two.
4. **Stagger between walls on opposite sides.** A player flies forward `v_wr x t_x` while crossing (`t_x` is the time
   in the air). The next wall starts no later than take-off plus that carry, minus one player width, and runs at
   least one player width past the landing.
5. **A zig-zag climb eats floor length.** Each crossing takes about `L + v_wr x t_x` of length and gains `Δh`
   (measure it).
   - The owner's "repeat 3 times" is 6 crossings, **about 100 m of alley with Titanfall-like numbers**, and a block
     is 57 m.
   - **So chains must fold:**
     - a **switchback**, where the owner's tap-strafe 180 *is* the turn;
     - or a spiral light-well inside a tower;
     - or a chimney between two towers, climbing on the spot.
   - This is the key layout constraint for 4.4.
6. **The chain's end:** the last peak reaches a ledge no higher than `h_m`, with 1.5 m or more of landing past the
   lip, or a climb no higher than `h_c`.
7. **Exactly one air jump between wall touches** (ours already restores the double jump on a wall touch). The dash is
   assumed at most once per chain.
8. **A runnable wall** has at least one player height of wall above the run line and is flat for at least `L`. Steps
   and props must never start a wall run.
9. **One colour for chain lines only.** Every wall can be runnable, but the intended lines wear one reserved neon.
   Let the geometry show the next target first; the colour is the backup.
10. **Frame the next target:** at every take-off, the next wall or ledge is within about 45 degrees of the direction
    of travel. Chains turn one way. **Add the camera tilt before wall contact** if ours lacks it.
11. **The chain route must pay:** it takes **0.7 times the ground route's time or less** between the same two points,
    and it is more exposed (less cover), so it is a risk worth taking.
12. **Speed strips** (our paint):
    - model them as about 1.7x speed with a cap, lingering about 3 s;
    - a gap a strip pays for is within 3 s of boosted speed downstream;
    - it is always an optional, visible shortcut.
13. **Minimum time across the map:** at top chain speed, the main loop across the centre still takes a set minimum
    (propose 15 s; the owner decides). **Recheck it when A15 doubles sprint.** Empulse's maps broke when speeds rose
    and the maps did not grow.
14. **No dead ends.** From any point where a chain can fail, a way back to its start, or into another chain, exists
    within about 10 s. A failed chain lands somewhere playable, never a pit or out of bounds.
15. **Never kill momentum by accident:**
    - stairs, lips under the step height and seams keep speed (Empulse's stairs were a bug players hated);
    - a slide survives uneven ground.
16. **Pacing:** after a hard stretch (3 or more inputs within 2 s), give a 1 to 2 s landing to recover before the
    next decision.

**The proof:** `chains.ts` runs each authored chain through the real controller.
- It must **pass at nominal input**.
- It must **fail when the key gap is widened by 10%**.

The second half proves the check itself works (`CLAUDE.md`: a new check is proven by putting the bug back and
watching it fail).
