# Movement audit against Apex

Owner ask: *"focus on apex specific stuff like ensuring the movement is spot on
exactly the same."*

## Sources

1. **Engine constants** in `src/config/movement.json`, from a retail ConVar
   dump and a player-settings memory dump (see `FIDELITY.md`).
2. **The Apex Movement Wiki**, apexmovement.tech. The movement community's
   reference, built by frame-by-frame measurement and, for some entries,
   scripts run in R5. Pages used: Fundamental Ground Tech, Fundamental Slide
   Tech, Fundamental Air Tech, Lurch Fundamentals, Basic Lurch Tech, Climb
   Fundamentals (with Climb Space), Advanced Climb Tech, Mantle, Superglide,
   Wallbounce, Bunnyhop vs Slidehop.
3. **The R5 scripts** only override movement settings (Flowstate's movement
   gym and custom modes); they never define the defaults, so they could not
   settle anything here.

Every rule below is now exercised by `tools/movesim.ts`, which drives the real
controller frame by frame with scripted key presses (`npm run movesim`, and
inside `npm run verify`).

## Confirmed exact, no change

| Rule | Apex | Ours |
|---|---|---|
| Walk / sprint / crouch walk | 173.5 / 260 / 80 hu/s | same, measured in sim |
| Holstered | x1.15: 199.5 / 299 / 92 | same, measured in sim |
| Jump height | 56 hu | 56.00 at 30, 60, 144 and 240 fps |
| Air acceleration / air speed / air friction | 500 / 60 / none | same |
| Coyote time | 0.2 s | same, tested both sides of it |
| Crouch state delay | 0.4 s down, instant up, instant in a slide | same |
| Slide start | 200 hu/s | same |
| Slide boost / cap / cooldown | +150, cap 400, 2 s (all x holster) | same, measured 397.7 hu/s |
| Slide jump gate | under 350 hu/s or 0.24 s in | same |
| Jump fatigue | 30% for 0.15 s after landing, full by 0.75 s | 16.80 hu, then 56.00 |
| Auto-mantle height | 80 hu | same |
| Hop window | leaving the ground within 0.1 s of landing | same |

## Wrong before, fixed now

| Rule | Apex (source) | Before | Now |
|---|---|---|---|
| Sprint input | **Press** (toggle) by default, 3 s buffer, letting go of forward ends it (wiki: Sprint) | hold-to-sprint only | toggle by default with the buffer; `sprintMode: "hold"` in player.json for the Hold setting |
| Holster | key to put the gun away, x1.15 movement (wiki: Holster) | not implemented | key 3; fire, aim, reload or a weapon key draws it again, timed by the weapon's holster and deploy times |
| Acceleration by stance | identical for crouch, walk, sprint; only top speed differs (wiki) | crouch had its own 2500 hu/s² | same speed bands for every stance; tested |
| Jump fatigue | a STATE: on after a jump, off after a mantle, a walk off a ledge, or a climb detach without jumping (wiki) | any landing started it | state machine; walking off a ledge and jumping is full height, tested |
| Coyote jump | never fatigued (wiki) | could be | never |
| Slide on landing | needs 90 hu/s horizontal AND 200 hu/s falling (wiki) | horizontal only | both; 0.62 m drop does not slide, 1 m does |
| Slide boost cooldown | 2 s from the last slide ENTRY (wiki) | from the last boosted slide | from every entry, tested |
| Slide jump | only out of a slide that got the boost (wiki) | any slide | boosted slides only |
| Uphill slides | upward slopes increase decay (wiki) | only downhill modelled | gravity along the slope both ways |
| Hop penalty | only ABOVE sprint speed, up to 100 hu/s (wiki, R5 script) | above 450, height cut stacked on fatigue | above sprint speed, floor at sprint speed; no stacking with fatigue |
| Lurch window | 400 ms, full for 200 ms (wiki) | 500 ms | 400 ms |
| Lurch trigger | a key PRESS only; not a release, not a key held before the jump (wiki) | any change in direction, releases included | presses only, tested |
| Lurch direction | combination of every held direction; left held + right pressed = null (wiki) | last wish direction | combined, null lurch tested |
| Lurch effect | changes direction AND costs speed by strength (wiki) | pure rotation, no speed loss | blend toward speed x new direction: 66.8 degrees and 76% speed for a full-strength 90 degree lurch; a scroll tap-strafe turned 79 degrees keeping 97% |
| Lurch speed cap | stops above about 1150-1300 hu/s (wiki) | none | 1200 |
| Scroll-wheel tap-strafe | forward bound to the scroll wheel (wiki) | wheel not bindable | `wheelup` / `wheeldown` bindable; forward bound to both by default |
| Climb start | must be airborne, face within 45.57 degrees (arccos 0.7), push into the wall (wiki) | 63 degrees, any airborne jump press | 45.57 degrees; 44 attaches, 47 does not |
| Climb height | climb space 147 hu above your last ground contact, or 100 hu above the attach point, whichever is lower, then a 28 hu end boost (wiki) | 118 hu from the start of the climb | the real system: 127 hu above a low attach, 176 hu from a high one |
| Climb speed | 225 hu/s up on mouse and keyboard; 115 hu/s sideways while climbing; 258 hu/s pure sideways for 1 s (wiki) | 230, no sideways | 225, 115, 258 with the 1 s non-upward timer |
| Climb detach | crouch, backwards, or turning 45.57 degrees away; each drops the climb space 128 hu (wiki) | releasing jump | the documented detaches and penalties |
| Climb jump | 28.21 hu up; 188 hu/s away in the bottom 19 hu, 258 above; climb space drops 128 / 256 (wiki) | a standalone wall jump from beside ANY wall, 40 hu up | from a climb only, 28.21 hu and 258 hu/s measured |
| Reattach | not above your previous attach point on the same wall (wiki) | cooldown timer | attach-point rule, tested |
| Wall jump beside a wall | does not exist in Apex | we had one | removed |
| Mantle input | movement input within 50 degrees of the wall (wiki) | any forward-ish input | 50 degrees |
| Superglide | jump then crouch exactly ONE frame later, in the last 0.15 s of a mantle; out of a sprint (wiki) | not implemented | implemented: 400 hu/s out of a sprint; same-frame and early inputs rejected, tested |
| Fall stun | none below a 300 hu fall, full 1 s and all speed lost at 800 hu, driven by landing speed, non-linear (wiki) | not implemented | quadratic between the landing speeds of those falls, tested |
| Sprint FOV kick | Apex has none | we had one (mine) | removed |
| Strafe camera roll | Apex has none | we had one (mine) | removed |
| Jump apex integration | exact | plain Euler put the 56 hu apex at 57.0 at 144 fps | trapezoidal, exact at every framerate |

## Still approximated, and why

| Item | What is known | What we use |
|---|---|---|
| Slide friction curve | `slideDecel` 100 and `slideVelocityDecay` 0.7 are engine values; how they combine is not published. Two wiki timings (a slide from just over 200 hu/s drops below 350 in 0.11-0.12 s; a full holstered sprint slide in 0.21 s) cannot both be met by any linear formula I tried. | `100 + 0.7 x speed`, as before |
| Lurch formula | behaviour documented, formula not public (the Titanfall 2 write-up it cites was unreachable) | blend with the engine's 0.7 strength, which reproduces the documented speed loss |
| Climb acceleration | the wiki gives the 225 hu/s peak, not how fast it is reached | 1500 hu/s² |
| Fall stun acceleration penalty | "slows walk and sprint acceleration", amount not given | acceleration x0.3 at a full stun |
| Deadslide result | "the slide speed does not come with you" | speed capped at sprint speed |
| Mantle duration | engine values bucketed by ledge height; the wiki gives 0.45 s grab + 0.45 s pull out of a climb, and a separate page says 0.3 s pull | engine buckets unchanged |
| Step-up height | engine value 22 hu; wiki says ledges "around 30 hu" are overwalkable | 22 |
| Jump air time | wiki says 0.74 s; 56 hu under 750 hu/s² gravity is 0.77 s | engine values, flagged |
| Landing camera dip | not documented | kept, small, cosmetic |

## Not implemented

**Updated 2026-09-20.** Everything this section used to list has since been
built, so what is left is the short version:

- **Wallbounce**: built, with the wiki's own dismount numbers (258 hu/s away
  from the wall, 350 to 484 hu/s total out of the green zone), the jump-fatigue
  and no-mantle interactions it depends on, and the basic sprint-slide-jump
  version it is taught as. `tools/movesim.ts` drives both.
- **Mantle boost**: built as the game's own setting of that name (Settings,
  off by default): holding jump through the end of a mantle superglides for
  you, instead of asking for a crouch exactly one frame after the jump. Off,
  the one-frame window is the real one, which is what the trainer and the
  crosshair cue are there to teach.
- **Zip lines, jump pads and legend abilities**: all built (traversal.ts, the
  roads' pads and balloons, and six ability kits with a tactical, a passive and
  an ultimate each).
- **Still not ours**: controller-only climbing behaviour, and the parts of the
  slide friction curve, the lurch formula and the mantle bucket durations that
  are not published (listed above under "Still approximated, and why").

What has been added beyond Apex, on purpose and marked as ours: **PAINT**
(`docs/PLAN_MOVEMENT_CHAIN.md`, Empulse's idea), which gives the chain
something to spend, and the camera that moves with the body, neither of which
changes an Apex number when no paint is down.
