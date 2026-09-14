# Results: ziplines, ladders, sights, and the course start

Follows `PLAN_ZIPLINES_LADDERS_SIGHTS.md`. Two asks arrived mid-batch and are
included: the course start was hard to find, and the scroll and crosshair
changes (S2, X1 below).

## What shipped

| ID | Ask | Result |
|---|---|---|
| Z1 | Ziplines with Apex's rules | `zip` state in `player.ts`, every number from the Apex Movement Wiki's zipline pages (see below). |
| Z2 | Zipline in the course | New room 6 "ZIPLINE": a vertical zip up a 4.5 m deck (ladder beside it), then a 17 m zip across the room over three pop-ups to the exit. The final sprint moved back to room 7; finish at z 130. |
| L1 | Ladders | On the 4.2 m climb wall, the zip deck, and both range platforms (each platform got a wall column to climb). |
| L2 | Hints | Apex-style prompt under the crosshair: `E  RIDE ZIPLINE` when a zip is in reach and in view, `SPACE  JUMP INTO THE WALL, HOLD W TO CLIMB` facing a ladder. |
| S1 | Course start hard to find | Course moved to the back-left corner (gate at x -23.5 to -19.5, between the first two racks). Lit orange gate frame, "THE RUN" sign over it facing the spawn, floor arrows from the spawn, a painted note on the floor in front of the spawn, the gate and ziplines on the minimap, and a notice the first time you click Play. |
| H1 | Hands when holstered | Holstering lowers the gun in the first half of the holster time and brings two gloved fists up in the second; they swing in turn while you run, harder sprinting. On a zipline the left hand goes up to a trolley on the rope and the gun is held one-handed. |
| B1 | B00G on the walls | Stencilled and sprayed "B00G" at five sizes and colours on painted panel steel, one 4 m by 2 m tile laid on in world space, on every course wall. |
| R1 | Roof | Solid ceiling at 7 m with light strips, a frosted skylight every third bay, steel beams. It is a collider. |
| O1 | Sights | Ten optics with housings and reticles: HCOG Classic, Bruiser, Ranger, Digital Threat (hood), 1x Holo (ring), Variable Holo (box), AOG and the three sniper scopes (tubes). Aiming lines up the optic's own sight line. Rifle irons come off when an optic is fitted. 3x and up show a full-screen scope picture at full aim with the gun hidden. |
| P1 | Snappier | Static meshes merged by material; `pointerrawupdate` mouse input; per-frame allocations removed from the camera path. Numbers below. |
| G1 | Refresh-rate text as a hover | One line with the measured refresh rate, and an "i" that opens a seven-step guide (monitor refresh rate, restarting Chrome, Energy Saver, hardware acceleration, dual-GPU setting, an uncapped Chrome shortcut with a Copy button, driver V-Sync). |
| S2 | Scroll binds | Scroll down is forward (one W tap per notch, for tap-strafing); scroll up is jump. |
| X1 | No crosshair when aiming | The crosshair is hipfire only: it is gone within the first 30% of the aim transition, on irons as well as optics. Hit markers still show. |

## Zipline rules implemented

From apexmovement.tech (Zipline Basics, Zip Jump, Zip Crouch, Dismounts):

- Interact (E) to ride, in the direction you look; near a pole you are forced away from it.
- Top speed 600 hu/s, vertical zips 480. Momentum already along the zip is kept up to that.
- Engine values: mount acceleration 1000 hu/s² for the first 0.5 s, then 400; 0.4 s before you can grab again.
- Jump off (zip jump): a slight pop, not a jump, so no jump fatigue and no lurch window. Crouch off (zip crouch): the zip's momentum, no pop. Manual exits leave at up to 445 hu/s; riding to the end, up to 600.
- Steeper than 45°: jump off whichever way you steer. Shallower: thrown off along the zip whatever you press.
- The prompt: within 35° of where you face on the ground, 90° in the air, or looking straight up or down in the air (not down while jump fatigue is on). No grabbing on the ground while aiming.
- Three mid-air grabs, all back on touching the ground or mantling, one back after 3 s off a zip.
- Geometry in the way throws you off. Riding 0.5 s resets the climb space, so you can climb straight out of a zip.
- Lurch window, coyote time and jump fatigue are left as they were.

Ours, where the wiki gives no number: reach (95 hu from the hands), how far below the rope you hang, the pull-in time, the pole zone, the zip jump's pop (the climb jump's 28.21 hu), the push at the top of a vertical zip, and a graze keeping half your speed.

## Ladders

Apex has no ladder mechanic that I could find documented. The movement wiki
has no ladder page, and its climb pages cover walls only. So these follow your
description: rungs on a wall that a normal climb gets you up, which tells you
where to climb. The simulation proves each one: 4.2 m course wall, 4.5 m deck,
4.6 m platforms, and the zip up the deck beats the ladder (1.00 s against
1.08 s).

## Performance

`npm run bench` on the RX 9070 XT, v-sync and the frame cap off, with the new
course in place, merge on and off (`?nomerge`):

| Preset | Unmerged | Merged | Draw calls |
|---|---|---|---|
| Competitive | 714 fps (1.40 ms) | 833 fps (1.20 ms) | 495 to 373 |
| High | 294 fps (3.40 ms) | 385 fps (2.60 ms) | |

498 static meshes become 79. The course added a lot of geometry; with the merge
the game is back at the frame time it had before.

The 60 Hz display cap is still what limits the feel on a 60 Hz setup; the
guide in the settings screen is how to lift it.

## Found wrong along the way

1. **The first merge call would have merged the dummies and targets.** It took
   everything added after the range, which included them, and they move. It
   now takes exactly what the range and the course build. Caught before it ran.
2. **An all-skylight roof still read as open sky.** 28% glass over the whole
   course looked like no roof. Now solid panels with a skylight every third bay.
3. **The R-301's rear iron sight blocked every optic.** It sits at the optic's
   height, closer to the eye. The irons are now their own group and come off
   when an optic is fitted, as in Apex. Pistol and revolver sights stay: they
   sit under the optic line.
4. **Scope reticles were drawn as bars.** Stroke widths scaled with the window,
   right for a lens texture, 18 px at full screen. Strokes now have their own
   unit.
5. **The holstered fists read as open claws**: the hand model grips a vertical
   bar, so from behind you saw curled fingers round an empty hole. Rolled a
   quarter turn, you see knuckles.
6. **The gate could not be seen from the spawn**: a roof pillar and the racks
   hide it. Hence the floor note in front of the spawn and the first-Play notice.
7. **Three zipline tests were wrong, not the code.** Two were off by one frame
   (the grab frame does not accelerate). One "no jump fatigue after a zip jump"
   check jumped within 0.1 s of landing, where the bunny-hop penalty correctly
   cut the height to 75%; it now waits 0.2 s, where fatigue would show and the
   hop penalty does not.
8. **The long zip throws you 0.6 m short of the exit door.** You land in line
   with it and run straight through (tested), so the layout stayed.

## Verification

`npm run verify` 425 checks pass (movesim included, 43 of them new for
ziplines and ladders); `check`, `build`, `rules` clean. Screenshots in `shots/`,
including every optic, the holstered hands, the zip hands, the course rooms and
the open guide. `npm run bench` for the table above.

## Open

- Rank times (S 34, A 40, B 50) are provisional until real runs exist.
- Variable optics stay at the zoom in the weapon data; no zoom toggle yet.
- The Digital Threat does not highlight enemies yet.
- The zip hand, the fist swing and the numbers marked "ours" above are ours.
- Advanced zip tech (mantle cancels off zips, ghost interacts, zip carries) is
  not in.
