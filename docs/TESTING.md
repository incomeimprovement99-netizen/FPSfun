# Testing guide: the P1 playtest

Run it, check the numbers, then answer one question: does the gun feel right.

## Start it

```
cd C:\Users\jwilb\Downloads\apex-range
npm run dev
```

Open http://localhost:5173 in Chrome or Edge. Firefox works but does not
support `unadjustedMovement`, so mouse acceleration can leak into the aim.
Use a Chromium browser for anything you intend to judge sensitivity on.

Three other commands, none of which touch the game:

| Command | What it does |
|---|---|
| `npm run verify` | 70 assertions on the simulation. Must print VERIFY PASS. |
| `npm run build` | Typecheck plus production bundle. |
| `npm run rules` | Fails if any file references a game, EA or Steam path. |
| `npm run extract` | Rebuilds `data/weapons.json` from the reference sheet. |

## Step 1: measure your DPI (one minute, do this first)

Your mouse is a Razer DeathAdder V3 Pro. Synapse is not installed, so the DPI
is stored in the mouse's onboard memory and there is no file on this machine
that holds it. So the site measures it instead.

1. Click **Measure my DPI**.
2. Set the swipe distance. Default is 10 cm. Measure that distance on your desk
   or mousepad and mark both ends, a ruler or a strip of tape is fine.
3. Click **Start measuring**. The pointer locks.
4. Hold the left mouse button, drag the mouse in a straight line exactly that
   distance, release.
5. It fills in the DPI and snaps to the nearest common step.

Do it three times. If it lands on the same number each time, that is your DPI.
A longer swipe is more accurate, so 20 cm beats 10 cm if you have the room.

The other three fields are already filled from your game config: sensitivity
0.4, ADS multiplier 1.0, FOV scale 1.55. The panel shows your cm/360 live.
At 800 DPI that reads 129.89 cm. Check it against what you already know.

## Step 2: the four checks, in order

Click **Play**. Escape returns to the settings panel.

**1. Sensitivity.** Flick between the 10 m and 30 m dummies. Does your hand
land where it expects. This is the single biggest tell and nothing else
matters if this is wrong. If it feels off, the DPI is the first suspect.

**2. Recoil.** Right click to ADS, hold left on the 20 m dummy, empty the mag.
The climb should want about **1.4 cm of downward mouse movement** over 18
rounds, then snap back to centre a moment after you release.

Almost all of this is now taken from the data rather than tuned. The pattern,
the spring equation, and the reason recoil holds during a spray and releases
after are all specified. One number is not: `softImpulseScale` in
`src/config/recoil-tuning.json`, which sets how far the muzzle climbs. Edit it
and the page hot reloads.

| softImpulseScale | Climb over a full mag | Pulldown |
|---|---|---|
| 1 | 1.62° | 0.6 cm |
| 10 | 2.75° | 1.0 cm |
| **20** (current) | **4.00°** | **1.4 cm** |
| 30 | 5.24° | 1.9 cm |
| 50 | 7.74° | 2.8 cm |

Higher means more climb. Tell me which matches your muscle memory. The pattern
SHAPE (where it drifts left and right) does not change with this dial, so
judge the shape separately from the amount.

**3. Time to kill.** Press **T** to cycle dummy armor. Shoot each tier in the
body and count. The HUD prints the time of the last knock.

| Armor | Body shots | Time |
|---|---|---|
| none | 8 | 0.52 s |
| white 50 | 12 | 0.81 s |
| blue 75 | 14 | 0.96 s |
| purple 100 | 16 | 1.11 s |
| red 125 | 18 | 1.26 s |

Headshots do 22, legs do 9. Purple dies to 10 headshots.

**4. ADS and bullet travel.** ADS takes 0.27 s. Bullets are not hitscan: they
leave at 737 m/s and drop under gravity, so the 40 m dummy needs a little
holdover. Strafe-shoot it to see the travel time.

**5. The swap, which is what this round added.** Empty the whole R-301 mag,
press **2** or **Q**, empty the whole Wingman mag, then press **1** and
confirm the R-301 is still empty. Each slot keeps its own clip, reload and
recoil; nothing is shared.

The swap takes 0.95 s, which is the R-301's holster time plus the Wingman's
deploy time, both from the data. You cannot fire or aim during it. Change your
mind mid-swap and press the other key: it redirects instead of making you ride
it out.

The two guns should feel nothing alike:

| | R-301 | Wingman |
|---|---|---|
| Fire mode | auto, hold to spray | single, one shot per click |
| Rate | 810 rpm | 156 rpm |
| Body damage | 13 | 45 |
| Headshot | 22 | 96 |
| Mag | 18 (to 28) | 6 (to 9) |
| Purple armor | 16 body shots, 1.11 s | 5 body shots, 1.54 s |
| Headshots on purple | 10 | 3 |
| ADS | 0.27 s | 0.18 s |
| Recoil | 28-row pattern, climbs and drifts | no pattern, one hard kick per shot |

Clicking the Wingman faster than 2.6 times a second does nothing, the extra
clicks are dropped. That is correct, not input lag.

**6. Any of 29 weapons, and attachments.** Press Escape and pick a weapon for
either slot from the dropdowns. The choice is remembered between sessions.

Then build the gun in-game with V, B, N, H and G. Every effect is a real
number from the reference data, not a guess:

| Attachment | What it changes | Example |
|---|---|---|
| Optic (V) | ADS field of view, and its own ADS time | 2x narrows 55 to 38.6 and slows ADS from 0.27 s to 0.29 s |
| Barrel (B) | Recoil | Purple scales pitch kick to 0.85 and its randomness to 0.7 |
| Stock (N) | ADS, deploy, holster, reload, sway | Purple multiplies all of them by 0.75 |
| Laser (H) | Hipfire cone | Purple scales it to 0.70 |
| Mag (G) | Clip size and reload, or fire rate on shotguns | R-301 18 to 28, Mastiff pump 0.91 s to 0.76 s |

Worth trying: R-301 with nothing versus purple barrel plus purple stock, to
feel how much the attachments carry. Then a Kraber, which now takes 1.6 s
between shots because bolt-action weapons are limited by their rechamber time
rather than their fire rate.

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Shift | Sprint |
| Ctrl or C | Crouch, and slide if moving fast enough |
| Space | Jump, and slide-jump out of a slide |
| Left mouse | Fire |
| Right mouse | ADS |
| R | Reload |
| 1 / 2 | Weapon slot |
| Q or Mouse 5 | Swap to the other slot (the forward thumb button) |
| G | Mag level: none, white, blue, purple, gold |
| V | Optic |
| B | Barrel stabiliser |
| N | Stock |
| H | Laser sight |
| T | Cycle dummy armor |
| F | Reset dummies |
| Escape | Settings |

The panel bottom-right shows the current build. A slot only appears if the
weapon can take it, so the Wingman shows no barrel and the R-301 no laser.
Attachments apply to the gun in your hands, and each slot keeps its own.

The four dummies sit at 10, 20, 30 and 40 m. You spawn on the firing line, so
the lane labels are the true distance. Knocked dummies respawn after 1.2 s.
The four blocks are solid and you can stand on them.

## What to tell me

One line each is enough.

1. Sensitivity: right, too fast, or too slow.
2. Recoil amount: which `softImpulseScale` matched, or "too much / too little".
3. Recoil shape: does the R-301 drift the way you expect, independent of how
   far it climbs.
4. The swap: does 0.95 s feel right, and do the two guns feel distinct.
5. Anything that felt wrong that is not on this list.

That decides whether we move to the rest of the roster.

**7. Movement.** Every rule is now checked against Apex's documented values
(docs/MOVEMENT_AUDIT.md) and simulated frame by frame (`npm run movesim`).
The speedometer at top left reads Hammer units per second.

Things to try:
1. **Sprint is PRESS, like Apex's default.** Tap Shift once: you sprint until
   you let go of W. A press up to 3 s before you start moving still counts.
   Want hold instead? Set `"sprintMode": "hold"` in `src/config/player.json`.
2. **Holster: press 3.** The gun goes away and you move 15% faster (sprint
   299 instead of 260). Fire, aim, reload, 1, 2 or Q draws it again.
3. **Slide**: sprint, crouch. Boost to 400 (460 holstered). The 2 s boost
   cooldown restarts on every slide, boosted or not.
4. **Slide jump**: jump under 350 hu/s or at least 0.24 s into the slide, or
   it is a deadslide.
5. **Tap-strafe**: forward is bound to the scroll wheel. Jump, then scroll
   while turning your view. Each notch is a lurch, strongest in the first
   0.2 s and gone by 0.4 s. A single key press after a jump lurches too
   (A or D); holding it from before the jump does not.
6. **Climb**: jump at a wall facing it (within about 45 degrees) holding W.
   Attaching early you climb about 3.2 m; jumping first and pushing W at the
   top of the jump gets about 4.5 m, plus a mantle if there is a ledge.
   Crouch or S drops you off. Jump off a climb for a 258 hu/s push away.
7. **Superglide**: sprint into a waist-to-head-height ledge, and in the last
   0.15 s of the mantle press jump then crouch ONE frame later. You leave at
   400 hu/s. Same-frame presses do not count, exactly as in Apex.
8. **Jump fatigue**: a jump straight after landing is 30% height. Walk off a
   ledge instead of jumping and there is no fatigue.
9. **Fall stun** needs a 7.6 m fall; nothing in this range is that tall yet.

All bindings live in `src/config/binds.json`. Mouse buttons are `mouse0`
through `mouse4` (Mouse 4 and 5 are `mouse3` and `mouse4`); the scroll wheel is
`wheelup` and `wheeldown`.

## Graphics preset and frame rate

The settings screen has a **Graphics** picker. Competitive (the default) is
the fastest and lowest-latency; High is everything. It also measures your
display's refresh rate: the browser caps frames there. On this machine the
GPU can do 833 fps in Competitive (`npm run bench`), so if the counter reads
60, the cap is the display or Chrome, not the game.

## THE RUN (the movement course)

Turn round from the spawn and go through the gate in the back wall. Cross the
green line to start; the gold line stops the clock. 17 armed robots pop up as
you enter rooms: one hit drops each, and every one left standing adds 3 s.
Falling into the red floor in room 5 adds 2 s and puts you back at its door.
Your guns switch to the P2020 and Glock 17 for the run and come back after.

Each room's fastest route is written on the wall you came in by. Turn round
in any room to read it. P copies your result to paste to friends; F resets.

## Known gaps (by design, not bugs)

- Dummies are static. Strafing behaviour comes with the drills.
- Scopes change the field of view but draw no scope picture, so a 4x-8x reads
  as a zoom with iron sights rather than a sight picture.
- Hop-ups are extracted but not offered: only the five standard attachment
  families are wired up.
- Shotguns fire a single pellet rather than a spread, so the EVA and Mastiff
  will feel wrong. Pellet counts are not in the weapon files.
- No swap sound, and the first draw of a session uses the normal deploy time
  rather than the slower `deployfirst_time` in the data.
- Movement not implemented: wallbounce proper, mantle boost, zip lines, jump
  pads, abilities. See docs/MOVEMENT_AUDIT.md for everything that is in, and
  the handful of values that are still approximations.
- Slide friction on slopes is an approximation (see docs/FIDELITY.md). If a
  slide dies on a hill where it would carry in the real game, that is the
  constant to change; tell me the hill and what it should do.
- Textures are CC0 from ambientCG and props CC0 from Poly Haven
  (`public/tex/ATTRIBUTION.md`). Every weapon, the hands, the dummies and the
  targets are modelled in code (`src/game/gunmodels.ts`, `arms.ts`,
  `dummy.ts`, `targets.ts`). No game asset files are used, which is the line
  explained in `PROJECT_RULES.md`.

## What to look at on the weapons

- Fire the R-301: the bolt cycles in the ejection port, brass flies out to the
  right, the muzzle flash lights the floor for two frames.
- Fire the Wingman: the cylinder turns one chamber per shot.
- Reload either: the R-301 drops its magazine and your left hand rides the
  new one back in; the Wingman swings its cylinder out and dumps six casings.
- Press G for magazine levels: the base plate changes to the rarity colour
  and the magazine gets longer.
- Swing the mouse fast: the gun trails the view slightly, less when aiming.
- Try other weapons from the dropdowns: all 27 have a model, in seven
  families (rifle, SMG, LMG, marksman, shotgun, pistol, revolver).
- Run `npm run assets` on a fresh checkout to fetch the textures. Without them
  the range falls back to flat colours rather than breaking.
- Movement constants are community-measured, not reference data. See
  `docs/FIDELITY.md`.
- Bullets pass through walls, only dummies are hit-tested.
- Recoil random component is on, so two sprays will not trace identically.
  That is correct behaviour, not noise in the model.
