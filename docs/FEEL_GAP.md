# Feel, animation, skins and the world: where "clunky" comes from

**Written 2026-09-24.** A player's review called the game "clunky". The owner asked whether that is the
player not knowing how to move, and for a gap analysis on skins, movement, feel, animation and the battle
royale's world. This reads the code, the configs and fresh snapshots rather than remembering them, and ranks
what to do.

## Is it the player?

Partly, possibly, and it is not the part worth betting on.

The movement numbers are Apex's own and are measured, not typed: walk, sprint and crouch speeds, jump
height at 30, 60, 144 and 240 fps, slide boost and cap, coyote time, hop windows, lurch, jump fatigue, mantle
height (`docs/MOVEMENT_AUDIT.md`, driven frame by frame by `tools/movesim.ts` inside `npm run verify`).
Mouse input is raw (`unadjustedMovement`). Sprint and crouch each have a Toggle or Hold setting. So a
player who has never played Apex will meet Apex's momentum (sprint toggles off when you let go of forward,
a crouch takes 0.4 s to go down, a slide needs speed) and some of that will read as clunky to them.

But when a player says clunky they are almost never describing a number. They are describing what the game
**shows and plays back** when they move and shoot: how the gun and hands move, what the body does in third
person, what a shot sounds like, and what they bump into. That is where this project is thin, and it is
thin in ways a screenshot shows. Two questions for the reviewer would settle it: what frame rate were they
on, and was it turning, stopping, jumping, climbing or shooting that felt wrong.

## What exists, counted

| | Count | Notes |
|---|---|---|
| Third-person clips shipped | **25** | of **86** in the two free Quaternius libraries (43 + 43, CC0), which sit unused beyond these |
| Third-person clips for a rifle | **0** | rifles are held with the pistol's aim, idle and reload clips, corrected by IK |
| Strafe and backpedal clips | **0** | a strafe turns the hips over the forward clip; backpedal plays the forward clip in reverse |
| First-person animation | **procedural** | swap, reload, sprint, slide, inspect: pose envelopes and springs in `viewmodel.ts`, no authored motion |
| First-person arms | **built in code** | grey tubes with an orange band and blocky hands, on screen 100% of play |
| Gunshots | **synthesized** | a filtered thump, band and crack per weapon class (`audio.json`); no recorded shot |
| Recorded sounds | **62** | Kenney: clicks, mags, bolts, doors, bins, landings, two footstep surfaces (concrete, grass) |
| BR places | **9** | a hub, four cardinal and four diagonal: a symmetric wheel |
| BR buildings | **built in code** | walls, floors, stairs and balconies are textured slabs (`brpoi.ts`) |
| BR terrain | **stepped** | ridges are stacked boxes, which read as stairs from the ground |
| Outfits | **16** | published cloth, on either of two bodies (`docs/SKIN_GAP.md`) |

## What the snapshots show

- **From the dropship** the map is a flat tan disc with building clusters on it and wide empty sand
  between them. No vegetation, no terrain relief beyond the stepped ridges, a flat horizon.
- **West Town** is grey concrete frames on flat grey ground. The streets are empty: no vehicles, no
  clutter, no markings, no lights, nothing to take cover behind between buildings.
- **North Yard** reads best: real shipping containers and silos from the published props. The ground
  around it is flat and the slope beside it is a staircase of boxes.
- **East Ridge** is a terrace of steps with a tower on it. From the ground it looks like voxels.
- **Every first-person shot** has the code-built arms in the lower right: the same "shapes, not assets"
  problem the owner called out on the clothes, and the one thing on screen every second of every match.

## The gaps, and what each costs the feel

**1. The arms in your own view are built out of tubes.** The first thing the eye lands on, all the time. A
player reads blocky hands as a cheap game, and a cheap-looking game gets called clunky. The body's own
arms and the outfit's own sleeves are already on disk, rigged and textured.

**2. Shots are synthesized.** A shooter's feel is at least half audio. A filtered noise burst has no
mechanical bite, no room, no tail that sounds like a gun, and every weapon in a class sounds the same. Two
footstep surfaces means metal stairs, wood floors and gravel all sound like concrete or grass.

**3. Third-person motion pops.** A slide cuts straight into its loop and straight out (the free
`Slide_Start` and `Slide_Exit` are unused). Strafing is a hip turn over a forward run, and backpedalling is
that run in reverse, which reads as a moonwalk. A grenade throw, a door, a loot bin and a revive have no
motion at all. Every other player is watching these.

**4. The gun's motion is correct but stiff.** Locked to the view like Apex's (deliberately: look lag makes
aiming slow), with a bob, a sprint pump, a draw settle and a recoil spring. What it lacks is the small
stuff that sells hands: a roll into a strafe, a reload where the hand visibly goes to the magazine and back,
a swap with a turn in it, a reaction to a mantle.

**5. The world is boxes on a flat plane.** Buildings are slabs, ridges are steps, and the nine places sit
on a symmetric wheel, so each looks like its neighbours and the space between them is empty sand. This is
the "more world details and POIs" the owner asked about, and it is the same fix as the clothes: published
kits instead of shapes.

## The free pool for each gap

| Gap | Free source | What it gives | State |
|---|---|---|---|
| Arms | the bodies and outfits on disk | real hands and forearms, sleeves that match the outfit | ours already |
| Clips | Quaternius UAL 1 and 2, free tiers | 61 unused clips, of which about 15 matter for a shooter (below) | **downloaded today**, not yet in the game |
| Clips | Mixamo | strafes, backpedals, rifle locomotion, rifle reloads, crouch strafes, ladder climbs, crawls | free for commercial use; needs the owner's Adobe token (`npm run mixamo`) |
| Gunshots | freesound.org CC0, Sonniss GDC bundles | recorded shots, mechanics, tails, per class | free; Sonniss is royalty-free rather than CC0 (fine to ship inside a game, not to redistribute loose) |
| Footsteps | Kenney Impact Sounds, freesound CC0 | metal, wood, gravel, dirt | free |
| Buildings | Quaternius Downtown City MegaKit | 153 modular pieces free, CC0: facades, windows, roofs, street parts | free tier; the other 110 are $14.99 |
| Vegetation | Quaternius Stylized Nature MegaKit | 60 to 70% free: trees, rocks, plants, grass | free tier; stylized, so needs a look next to the realistic props |
| Props | Poly Haven (already used), Kenney City Kits | vehicles, barriers, signs, road pieces | free; Kenney is flat-coloured low poly, a style clash to check |

The free Quaternius clips that matter for this game, all on the same rig as ours:
`Slide_Start`, `Slide_Exit` (slides stop popping), `OverhandThrow` (grenades), `Melee_Hook`, `Punch_Cross`
(melee variety), `Hit_Head` (a headshot reads), `Chest_Open`, `Interact`, `PickUp_Table` (loot bins, doors,
pickups), `Fixing_Kneeling` (a revive), `NinjaJump_Start`, `NinjaJump_Land` (an athletic jump), and
`Dance_Loop`, `Yes`, `Idle_FoldArms_Loop` (emotes). What is missing from both free tiers is exactly what a
shooter needs most: strafes, backpedals and anything holding a rifle.

## Ranked

| # | Step | Why | Cost |
|---|---|---|---|
| 1 | **Real first-person arms** | Gap 1. On screen all the time, and the largest single "cheap game" tell. Built from the body's own arm and hand and the outfit's own sleeve, so the arms match what the player is wearing. | 1 to 2 days, free |
| 2 | **Recorded gunshots and more footstep surfaces** | Gap 2. Half of a shooter's feel, and it changes every shot of every fight. Per class at first, with the synthesis kept as the fallback. | 1 day, free |
| 3 | **The free clips wired in** | Gap 3. Slides with an entry and exit, a throw, two more melees, a headshot reaction, loot and door interactions, a revive, emotes. All on disk and on our rig. | 1 day, free |
| 4 | **The gun's small motion** | Gap 4. A roll into a strafe, the hand to the magazine on a reload, a turn in a swap, a reaction to a mantle and a hard landing. | half a day, free |
| 5 | **Towns out of a building kit** | Gap 5. West Town and the Hub rebuilt from Downtown City MegaKit pieces over the collision boxes we have: the boxes stay as the physics, the kit becomes what you see. | 2 to 3 days, free |
| 6 | **Terrain and vegetation** | Gap 5. A heightfield for the ridges instead of stacked boxes, trees and rocks along the empty sand, grass near the places. The stylized kit gets a look beside the realistic props first. | 2 days, free |
| 7 | **Set dressing and a landmark per place** | Gap 5. Vehicles, barriers, markings, lights and cover in every street, and one thing per place you could name from the dropship, which also breaks the wheel's symmetry. | about a day per place, free |
| 8 | **Strafe, backpedal and rifle clips** | Gap 3's harder half. Not in either free tier. | owner's call: a Mixamo token (free), or $9.99 to $14.99 for a Quaternius Pro tier |
| 9 | **Test debt** | The BR host-migration e2e check passes about one run in two, and the bot tier checks fail in a full batch and pass alone. Both predate today; a check that flakes teaches everyone to ignore it. | half a day |

## The two things only the owner can decide

- **A Mixamo token.** The same one `docs/SKIN_GAP.md` asks for. It unlocks modern clothes and the rifle
  locomotion, strafes, reloads and crawls that no free tier has.
- **$10 to $40 of Quaternius.** The Pro animation tiers, the Downtown kit's other 110 pieces, and (from the
  skin gap) the Regular body the clothes are cut for. All CC0, all on the rig we already use.
