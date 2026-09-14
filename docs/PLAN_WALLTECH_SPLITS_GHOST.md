# Plan: wall tech, a tech feed, splits and a ghost, optics finished

Next steps after `RESULTS_ZIPLINES_LADDERS_SIGHTS.md`, ranked by what they add
to practising Apex movement.

| ID | What | How it will be done | Verified by |
|---|---|---|---|
| W1 | Climb zones: wallbounce, wall push, mini-bounce | A jump off a climb depends on where you are in the climb space (Apex Movement Wiki, Climb Zones): the mini zone (bottom 19 hu) gives 28.21 hu and 188 hu/s, the normal 128 hu penalty; the green zone (19 to 47 hu) gives more height the lower you are and 258 hu/s, 256 hu penalty; the neutral zone (above 47 hu) gives no added height, only 258 hu/s out (a wall push), carrying whatever vertical speed you had. Today every jump off a wall gives 28.21 hu. | movesim: a wallbounce out of the green zone climbs clearly higher than a neutral-zone jump; mini-bounce height and penalty; wall push keeps vertical speed |
| W2 | A wallbounce practice wall on the range | A wall with the green zone painted as a band at the height a jump reaches it, and a sign with the steps. | screenshot |
| T1 | Tech feed | A short feed on the left of the screen naming what the game registered: superglide (with speed), wallbounce, mini-bounce, wall push, lurch (with the angle), slide jump or deadslide, hop penalty, fatigued jump, zip jump, zip crouch. | movesim checks the events fire; screenshot |
| C1 | Course splits | A split at each room entry, shown under the timer with the difference to your best run's split (green faster, red slower); the result lists every room. Best splits saved with the best time. | a scripted run in the browser; screenshot |
| C2 | Ghost | Your best run recorded 30 times a second and replayed as a translucent figure while you run. K toggles it. | screenshot |
| O2 | Variable optics | Z toggles the variable holo, AOG and variable sniper scopes between their two zooms, using the weapon data's `zoom_toggle_fov` and `zoom_toggle_lerp_time`. | verify check on the data; screenshot |
| O3 | Digital Threat | Aiming through a Digital Threat optic highlights enemies in red, inside the data's `threat_scope_fadedist` range. | screenshot |
| S1 | Sprint mode setting | Toggle (Apex default) or hold, on the start screen, saved. | verify |

Everything the wiki does not give a number for is marked "ours" in the code and
the config, as before.
