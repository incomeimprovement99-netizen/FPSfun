# Results: wall tech, tech feed, splits and ghost, optics finished

Follows `PLAN_WALLTECH_SPLITS_GHOST.md`. Everything in the plan shipped.

| ID | Result |
|---|---|
| W1 | Jumping off a climb now depends on the climb zone, as the Apex Movement Wiki describes. Mini zone (bottom 19 hu): 28.21 hu, 188 hu/s out, 128 hu penalty (mini-bounce). Green zone (19 to 47 hu): more height the lower you are, 258 hu/s out, 256 hu penalty (wallbounce). Neutral zone (above 47 hu): no added height, 258 hu/s out, 256 hu penalty, vertical speed carried (wall push). Before, every wall jump gave 28.21 hu. |
| W2 | A wallbounce practice wall on the range's right-hand wall: the three zones painted at their true heights (taken from the movement constants, so the paint cannot drift from the rules), a sign with the steps, a take-off line on the floor. |
| T1 | Tech feed, left of the screen under the stats: SUPERGLIDE, WALLBOUNCE, MINI-BOUNCE, WALL PUSH, LURCH (angle turned and speed kept), SLIDE JUMP, DEADSLIDE (with the reason), HOP PENALTY, JUMP FATIGUE, ZIP JUMP, ZIP CROUCH. Green bar for tech, orange for penalties. |
| C1 | Course splits: the clock on entering each room, shown under the timer against your best run's split (green faster, red slower). The result card lists every room and the finish with deltas. Best splits saved with the best time. |
| C2 | Ghost: your best run recorded 30 times a second and replayed as a see-through figure while you run. K toggles it; the choice is remembered. |
| O2 | Z switches the variable holo, AOG, variable sniper and digital sniper threat between their two zooms, using the weapon data's `zoom_toggle_fov` and blending over `zoom_toggle_lerp_time`. ADS sensitivity follows the zoom. |
| O3 | Aiming through a Digital Threat optic lights enemies red, fading out over the data's `threat_scope_fadedist` range (25 to 55 m for the 1x, 150 to 300 m for the sniper). |
| S1 | Sprint toggle or hold on the start screen, remembered. |

## Numbers

From the simulation (`npm run movesim`), all at 144 fps:

| Jump off a wall | Height | Out |
|---|---|---|
| Wallbounce (green zone, jumped from 44 hu) | peak 75.2 hu above the floor | 258 hu/s |
| Jumping on contact (neutral zone, 56 hu) | peak 56 hu, no gain | 258 hu/s |
| Wall push while climbing at 225 hu/s | 33.75 hu, the carried climb speed only | 258 hu/s |
| Mini-bounce | 28.21 hu | 188 hu/s |

## Ours, where the wiki gives no number

The wiki says only that the green zone gives "various amounts of height,
ranging from small to large" and that lower in the zone is more. Our model
tops the jump up to 75.21 hu above the baseline: a full 56 hu jump from the
bottom of the zone, the climb jump's 28.21 hu from its top. It is in
`movement.json` as `climbGreenApex`, marked ours, and is the one number to
change if a measurement turns up.

The Digital Threat highlights the whole enemy wherever it is on screen; the
game shows it through the optic.

## Found wrong along the way

1. **The old climb-jump test was checking the wrong rule.** It expected 28.21
   hu from a jump high on the wall. The wiki says the neutral zone adds no
   height; what the test measured was the climb speed carried through. The
   new tests check each zone separately.
2. **The threat highlight read pink, not red.** Red glow on light grey paint
   plus filmic tone mapping comes out salmon. The highlight now darkens the
   shell as it glows and keeps the glow under 1.
3. **Scripted browser runs get one frame per teleport** in headless Chrome, so
   a room can be skipped in a scripted run (the CLIMB split read "-" in one).
   Not a game bug; real runs pass through every trigger.
4. **The practice wall's sign overflowed** at the first size; resized and
   shortened.

## Verification

`npm run verify` 442 checks pass (movesim included: wallbounce, wall push,
mini-bounce, the optics' data values); `check`, `build`, `rules` clean.
Screenshots: `wallbounce-wall`, `tech-feed`, `optic-threat-ads`,
`run1-finish` (result card with splits), `run2-breach` (a split against the
best).

## Next

- A replay of your run's inputs, not just positions, so a good run can be
  studied frame by frame (when the jump and crouch landed on a superglide).
- A key rebinding screen, so your own Apex binds can be typed in once.
- A "tech trainer" mode that scores superglide and wallbounce timing over ten
  tries.
- Rank times once someone has set real runs.
