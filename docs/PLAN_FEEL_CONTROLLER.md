# Plan: controller, the wallbounce and slide feel, hands and gun animations, engagement

Every ask from the last message, with an ID, what will be done and how it is
checked. The movement changes come from the Apex Movement Wiki's own pages,
fetched and read in full this time (Climb Fundamentals, Wallbounce, Fundamental
Slide, Advanced Slide, Fundamental Ground, Fundamental Air, Velocities).

## What you asked for, in your words

1. Connect a controller and play.
2. Sliding feels weird, not like Apex: research and fix.
3. Wall tech: "slide, jump into the wall, we don't bounce, just fall back off".
4. The hands look goofy.
5. Animations for the guns, and for holstering and unholstering.
6. Movement still feels clunky.
7. Continue the next steps that engage users; list what you want and the
   next implementations, around multiplayer and the Apex feel.

## Movement (the wiki's numbers, not ours)

| ID | Finding | What will be done | Checked by |
|---|---|---|---|
| M1 | **Why you fall off instead of bouncing.** The wiki's basic wallbounce is: sprint, crouch, slide JUMP, let go of W, hit the wall at the top of the jump or slightly after, jump. The green zone is 19 to 47 hu above your feet on the ground. A plain sprint jump peaks at 56 hu, above the zone, so touching at the apex and jumping is a wall push (no height): exactly your symptom. The slide jump's apex is what makes it work: the wiki's velocity table gives a slide jump 475 hu/s total out of the 400 cap, so its vertical part is 256 hu/s and it peaks at 44 hu, inside the zone. Ours was 50 hu, above it. | `slideJumpHeight` 50 to 43.7 (256²/1500). The bounce itself uses the wiki's measured dismount speeds: wall bounce max 484 at the bottom of the zone, min 350 at the top, with 258 sideways, so the vertical part runs 409 to 236 hu/s down the zone (ours topped at 290). Mini bounce 278 (188 out, 28.21 hu) unchanged. Crouch kick added (mini bounce with crouch on the same frame: 320). Wallskip (W held into the wall: height, no distance) as the wiki describes. The WALL PUSH line now says "too high: 52 hu up, the green zone is 19 to 47: slide jump so your apex is 44, or drop below it first". The practice wall's sign and the course tips rewritten to the wiki's steps. | movesim: a slide jump at the wall, W released, jump on contact gives WALLBOUNCE with the wiki's speed; a sprint jump the same way gives WALL PUSH; the bounce speeds are 484 and 350 at the zone's ends; crouch kick 320; probe in the real page |
| M2 | **Why sprinting feels slow to start.** The wiki: "It takes 0.35 s to sprint to 200 hu/s from a standstill with a weapon out, twice as long as the 0.12 s while holstered." Ours: 0.43 s armed and 0.23 s holstered, because the band above walk speed accelerates at only 100 hu/s², so reaching full sprint took a second. | The three bands refit to both timings: 2500 up to 120 hu/s, 1100 to walk speed, 340 above it, with holding a weapon halving the acceleration (the wiki's factor of two). Full sprint from standing in about 0.7 s armed instead of 1.0. Marked as a fit to the wiki's timings. | movesim: 0 to 200 in 0.35 s armed and 0.12 s holstered, top speeds unchanged |
| M3 | **The slide.** The wiki's slide numbers (200 to start, 150 boost, 400 cap, 2 s boost cooldown, 350 / 0.24 s slide jump gate, friction that always stops you on the flat, no timer, inputs barely steer, opposite input brakes hard) are all already in. What is not Apex about ours is the picture: the gun snapped from the sprint pose to the hip pose the instant a slide started, and a standing crouch dropped the view in 0.1 s where the game's crouch animation takes 0.4 s (the wiki: "the game only switches into the crouch state 0.4 s after pressing crouch, after the animation has finished"). | A slide pose for the gun (low and rolled, blending from the sprint pose, still ready to fire), a standing crouch that lowers the view over 0.35 s while a slide still drops it at once, and the slide jump apex from M1. Slide friction stays as fitted to the wiki's two timings (no third number exists). | screenshot mid slide; movesim: the two slide-jump timings still hold |

## Controller

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| C1 | Play with a controller | The browser Gamepad API. The game's default layout: left stick move, right stick look, RT fire, LT aim, A jump, B crouch (hold), X reload / interact, Y swap weapon, L3 sprint, R3 melee, LB holster, RB zoom toggle, d-pad up/down optic, left/right slot, Start the menu, Back the ghost. Look: a deadzone, the game's Classic-style response curve (a power curve), yaw and pitch speeds from a Look sensitivity 1 to 8 like the game's (ours: 3 = 200 deg/s yaw, 150 pitch), ADS sensitivity 1 to 8, an outer-deflection extra turn. Air strafing works from the stick without turning the view, as on the game's controllers. Sprint by clicking the stick, or auto sprint (a setting). The menu stays mouse-driven; Start opens it. | e2e: a fake gamepad object drives the player forward and turns the view; hand test with a real pad |

## Hands and animations

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| H1 | The hands look goofy | Rebuilt: a palm with a heel and a knuckle ridge, four fingers of three segments each with proper curl (a grip curl on the gun, a full fist when holstered), a thumb across the top, glove seams. Two builds from one parametric hand: gripping and fist. Proportions from a real hand (19 cm palm to fingertip). | screenshots: hip, ADS, holstered, zip |
| G1 | Gun animations, holster and unholster | A draw: the gun comes up from low right with a roll, overshoots a touch and settles (a spring), the support hand catches the handguard a beat after. A holster: the muzzle drops and the gun turns down and away, the hands go to the fists. First-draw flourish on the first equip after a swap. Idle sway while standing still. Landing thump on the gun. | screenshots mid draw and mid holster; the timings stay the weapon data's holster and deploy times |

## Engagement (multiplayer)

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| E1 | Engage users | Nameplates over players and bots (name, shield and health bars, fading with distance); a kill feed (who knocked whom, with what); a match summary card at the end (rounds, kills, deaths, damage, accuracy, streak); when knocked in a 1v1v1 the camera follows a player still standing until the round ends. | e2e: the feed line appears on a knock; screenshot of nameplates and the summary |
| N1 | Next steps list | `docs/NEXT_STEPS.md` rewritten: what you asked for (with status) and the next implementations, ranked, multiplayer and feel first. | read |

## Out of this batch

Aim assist for controller (needs a design decision: the game's is a slowdown near targets and rotational assist; I will propose values in NEXT_STEPS and do it next if you want it), animated third-person characters, the leaderboard deploy (your Cloudflare account), the push (your GitHub login).
