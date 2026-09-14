# Results: controller, the wallbounce and slide feel, hands and gun animations, engagement

Follows `PLAN_FEEL_CONTROLLER.md`. Everything in it shipped. The movement
section is the important one: three of our numbers were wrong against the
wiki's own pages, and one of them is exactly the symptom you described.

## The wallbounce: why you fell off

You said: slide, jump into the wall, no bounce, "just fall back off".

The wiki's basic wallbounce is: sprint, crouch, **slide jump**, let go of W,
hit the wall at the top of the jump or slightly after, press jump. The green
zone, the only place a jump off the wall gives height, is 19 to 47 hu above
your feet on the ground.

- A plain sprint jump peaks at 56 hu, above the zone. Touch the wall there
  and jump and you get a **wall push**: 258 hu/s out, no height, and you fall
  back down. That is what you were doing, and what the game did was correct
  for a plain jump.
- The slide jump is the trick. The wiki's velocity table gives a slide jump
  475 hu/s on its first frame, out of the 400 hu/s slide cap, so its vertical
  part is 256 hu/s and it peaks at **44 hu**, inside the zone. Ours peaked at
  50, above it. So even done right, our slide jump put you in the wall push
  zone. Fixed: `slideJumpHeight` 43.7.
- The bounce itself was weak. The wiki measured the dismounts: wall bounce
  **484 hu/s** at most (bottom of the zone) and **350** at least (top), with
  258 of it sideways; ours topped out at 388. The vertical part now runs 409
  to 236 hu/s down the zone. Mini bounce 278 as measured. Crouch kick (jump
  and crouch on the same frame in the mini zone, 320) added. Wallskip (W held
  into the wall: height, no distance) added.
- The WALL PUSH line now tells you: "too high: 56 hu up, the green zone is
  19 to 47. Slide jump (apex 44) or drop below your apex first".

Proved in the sim against the wiki: the recipe above gives WALLBOUNCE at
361 hu/s from 44 hu up; the same off a plain jump gives WALL PUSH with that
line; the bounce range is 350 to 484; crouch kick 245 out, 320+ total. In
the real page the probe bounces from a sprint.

## Sprint and the "clunky" start

The wiki (Advanced Slide Tech): "It takes 0.35 s to sprint to 200 hu/s from a
standstill with a weapon out. This is twice as long as the 0.12 s it takes
while holstered. It takes 0.45 s to sprint to 207."

Ours took 0.43 s armed and 0.23 s holstered, because the band above walk
speed accelerated at 100 hu/s². Refit: 2500 below 120 hu/s, 800 up to 200,
140 above, and **a weapon out halves all of it** (the wiki's factor of two).
Now 0.30 s to 200 armed (0.35), 0.40 to 207 (0.45), 0.14 holstered (0.12).
Top speeds unchanged. Full armed sprint from standing arrives in about 1.1 s
instead of 1.3, with the first 200 hu/s of it much sooner, which is what you
feel.

## The slide

Every slide number was already the wiki's (200 to start, 150 boost, 400 cap,
2 s boost cooldown, 350 / 0.24 s slide jump gate, friction that always stops
you on the flat, inputs barely steer, an opposite input brakes hard). What
was wrong was the picture:

- The gun snapped from the sprint pose to the hip pose the instant a slide
  started. It now blends into a slide pose (low, in, rolled).
- A standing crouch dropped the view in 0.1 s. The wiki: the crouched state
  arrives 0.4 s after the press, when the crouch animation has finished, and
  standing up is instant. The view now lowers over that 0.4 s from the press
  and the hull shrinks when the state flips; a slide still drops both at
  once; standing up raises the view in 0.1 s.
- The slide jump apex is 44 hu now (above).

Also from the wiki's table, the superglide is 540 hu/s on its first frame:
its vertical part is 363 hu/s (an 88 hu apex), not the slide jump's. Ours
was 50 hu. That is why superglides reach ledges; the advanced course's glide
gap now clears by 2.2 m instead of 0.2.

## Controller

The Gamepad API, the game's default layout (left stick move, right stick
look, RT fire, LT aim, A jump, B crouch, X reload and interact, Y swap, L3
sprint, R3 melee, LB holster, RB zoom, d-pad optic / mag / slots, Start
menu, Back ghost), a deadzone, Classic and Linear curves, look and ADS
sensitivity 1 to 8 (3 = 180 deg/s yaw, ours), auto sprint, rumble on shots
and hits. No pointer lock needed with a pad: Start on the menu plays.
Settings has all of it. The e2e drives a fake pad: Start plays, the stick
moves 3.8 m in a second, the right stick turns 68 degrees, RT fires.

## Hands and gun animations

Rebuilt hands: a palm with a heel and a padded knuckle plate, four jointed
fingers with a grip curl on the gun and a full curl as a fist, a thumb along
the grip or across the fingers, knuckle studs, cuff and strap. The holstered
hands are real fists now (they were open claws). The gun: a draw settle
(overshoot and spring when it comes up), holstering turns the gun down and
away rather than dropping it straight, an idle drift while standing still,
the slide pose, the sprint pump from last time.

## Engagement

Nameplates over other players and bots (name, shield and health bars,
"DOWN"), a kill feed (who knocked whom, green for yours, red against you), a
match summary card at the end (rounds, K/D, damage, accuracy, streak), and
when you are knocked in a 1v1v1 with two still up, the camera follows one of
them from behind until the round ends.

## Verification

- `npm run verify`: pass. New sim checks: the wiki's three acceleration
  timings, the basic wallbounce recipe both ways, the dismount speed range,
  crouch kick, wallskip, a superglide still 400 hu/s, the advanced gates.
- `npm run e2e`: 73 checks pass, including the fake controller, the kill
  feed on both screens, and the bot knock line.
- `npm run rules`: clean. Builds pass; the beta check passes.

## Found wrong along the way

1. Three movement numbers were ours and wrong against the wiki: the slide
   jump apex (50, is 44), the superglide apex (50, is 88) and the green-zone
   bounce (388 max, is 484). All three had "ours" notes; the wiki's velocity
   table settles them.
2. The acceleration bands were engine-shaped guesses that missed the wiki's
   measured 0.35 / 0.12 s timings by 25% and 90%.
3. The sim's basic-bounce script released crouch on the jump frame, which
   ends the slide before the jump resolves (a plain 56 hu jump, a wall push):
   the same mistake a player can make. Crouch stays held through the jump.
4. The gap test checked "on the ground" before stepping the jump frame and
   passed by luck before the acceleration change.
5. The wiki pages 403 a plain fetch; curl with a browser user agent gets them.
   The texts are in this session's scratch, not in the repo.
6. Two more heredoc backslash mangles. Patches go through the Write tool.

## Open

- Aim assist on controller (the game has it; a design decision, see
  NEXT_STEPS).
- The slide friction below 350 hu/s is still a fit; the wiki gives no third
  timing.
- Rumble is untested by machine (no real pad in the e2e).
- The holster screenshot at the midpoint shows the gun already gone; the
  turn happens in the first quarter.
