# Results: wall tech, Kraber, sprint feel, two courses, bots, 1v1v1, stats

Follows `PLAN_BOTS_TRIPLES_STATS.md`. Everything in the plan shipped except
the two that need your accounts (G1 push, G2 host), which are staged and wait
on a repo URL. Verification numbers and what was found wrong are below.

## What shipped

| ID | Result |
|---|---|
| T1 | **The wall tech works; what was missing was feedback.** `tools/tech-probe.ts` drives a scripted wallbounce at the practice wall in the REAL page (real geometry, frame loop, input path). From a walk: attached at 1.42 m, `WALLBOUNCE +31 hu`. From a sprint: attached at 1.27 m, `WALLBOUNCE +30 hu`. So the rule fires in the game exactly as in the simulation. What a player got before, on a failed attempt, was nothing. Now the feed says why, in orange: `NO WALL: look at it (90 deg off, 45 max)`, `NO WALL: push into it (W, or speed toward it)`, `NO WALL: climb space used up: land first`, `NO WALL: same wall: drop below where you let go`; and for the superglide `SUPERGLIDE MISS: crouch 3 frames after jump (needs exactly 1)`, `jump and crouch on the same frame: crouch one frame later`, `crouch came before jump`, `jump early: 0.29 s of mantle left (window 0.15)`, `not sprinting into the mantle: the window is 0.01 s`. Every one has a simulation test that provokes it and reads the line. The Stats tab counts tech landed and misses called out. |
| T2 | The Kraber's own sight is a 4x-8x (the data's zoom_fov 13.3 with an 8.0 toggle), and the game was drawing iron sights for it. A weapon whose base zoom is a scope now has an `integralOptic`: the 4x-8x sniper model and full-screen scope by default, Z switches 4x/8x, the attachment line reads "4x-8x Variable Sniper (built in)", a fitted 3x or 2x-4x replaces it. |
| T3 | Sprint speed is the game's (260 hu/s, 299 holstered; the sim pins both) and was not changed. The presentation was: the gun pumps across and down with every stride and rolls with it (1.6x the old swing, `SPRINT_PUMP`), the empty hands and heirloom swing as hard, and the camera has the game's **Sprint view shake** (a 2.8 cm bob and a 0.55 degree roll at stride rate) with the game's setting: Normal (its default), Minimal, Off. The bob is a camera offset only: shots leave along the player's angles, so aim is untouched. |
| R1 | The Run (Basic): the same course, renamed, bests and ghost carried over (its storage keys did not change). |
| R2 | The Run (Advanced): back-right corner through a second lit gate, nine rooms, 200 m, 30 pop-ups, ranks S 80 / A 95 / B 120 (provisional). The course code became a layout (`CourseLayout`, `courses/basic.ts`, `courses/advanced.ts`) sharing one engine (`course.ts`: the run, splits, ghost, TV, compound walls). The gates were built from measurements on the real controller (`tools/measure.ts`) and each is proved both ways in the simulation against the exact geometry the game draws (`courseColliders` runs the layout through a collision-only builder): a superglide clears the 7 m gap onto the pad (lands 7.16 m out at 1.00 m) and a plain jump lands in the red (4.65 m); a slide jump with a lurch lands on the first pad (x -4.13) and a straight one lands in the red; a zipline superjump reaches the floating 4.6 m platform and a plain sprint jump does not; both vents pass sliding; the 5 m drop lands with no stun and the vent after it passes crouched; the long zip lands you by the exit door. |
| A1 | Arena, Bots: one or two bots, Easy / Normal / Hard (speed 4.2 / 5.4 / 6.6 m/s, reaction 0.9 / 0.5 / 0.22 s, aim error 6 / 3.2 / 1.6 degrees, fire rate 45 / 70 / 100%). A bot walks to the middle until it sees you, then closes to its distance and strafes, fires its weapon with tracers and a hit test against your body, goes for the circle when it is live, and takes hits like any dummy. Same rounds and circle as the 1v1. In the e2e a Hard bot left its spawn, closed 40 m down the middle lane and took your shield to 45 within the round. |
| M1 | 1v1v1: a third arena north of the 1v1's (a 46 m square, spawns at the points of an equilateral triangle 19 m from the middle, three spokes of staggered 3 m blocks between the corners, boxes at the circle, the same 20 s / 10 s circle). The network is a star: the host takes two guests, gives them ids, and relays each one's state, shots, downs and hits to the other. Last one standing takes the round; a guest leaving drops it to a 1v1; the host leaving ends it. The 1v1 tab has "2 players / 3 players". |
| S1 | A profile (a name, kept in this browser) and stats: per mode (1v1, 1v1v1, bots by difficulty) played, won, lost, rounds, kills, deaths, K/D, damage, accuracy, current and best win streak; per course runs, best and the top ten with dates; tech landed and misses. The Stats tab shows it all; results are written when a run or match ends. |
| S2 | `server/leaderboard/worker.ts` (Cloudflare Worker, KV, free tier): `POST /submit`, `GET /top`, one entry per name per board, best kept, a shared secret. `src/game/leaderboard.ts` posts every run and win when `VITE_LEADERBOARD_URL` is set and is a no-op otherwise. Not deployed: needs your Cloudflare account (`wrangler.toml` has the five commands). |
| N1 | `docs/NEXT_STEPS.md`: seven steps, ranked, each with what it needs. |
| G1 | The repository is initialised with every file staged; the first commit is made at the end of this batch. The push waits on a private repo URL from you (GitHub's CLI is not installed here, and creating a repo needs your login). |
| G2 | The public build passes the real-name check. Hosting waits on G1: GitHub Pages needs a public repo, so the plan is a second, public repo with only `dist/` in it, or Cloudflare Pages / Netlify from the same folder. |

## Numbers

- Sprint jump 5.09 m flat, peak 1.37 m. Slide jump 4.82 m. Superglide off a
  3 m ledge onto a 1 m pad: 7.6 m past the edge (400 hu/s). Zipline superjump
  peak 5.0 m. Jump plus mantle 3.4 m; jump, climb and mantle 5.76 m; the
  mantle reaches 2.03 m, the climb space is 3.73 m. (`npm run measure`)
- Advanced course sim: superglide lands z 54.16 (gap ends 54.0) at y 1.00;
  plain jump z 51.65 at y 0.67 (in the red). Lurch pad landing x -4.13 z 70.14
  (pad x -4.4 to -1.4, z 69.5 to 73); straight jump x 0 z 75.0 in the red.
- e2e: 66 checks. The 1v1v1 connects three tabs, the host sees two figures
  and a guest sees two (one relayed), spawns at (90, 79), (106.5, 50.5) and
  (73.5, 50.5), a knock leaves the round going with two standing, the second
  knock scores for the host on all three screens, a guest leaving leaves one
  figure on the host. The circle still goes live at 20.0 real seconds.
- `npm run verify`: pass, movesim included (the four superglide misses, the
  three wall-attach reasons, the seven advanced gates, the Kraber's built-in
  optic).

## Found wrong along the way

1. **The measurement scripts lied twice before they told the truth.** The
   first wallbounce reach test spawned the player inside the target ledge's
   footprint (it was pushed 12 m sideways by the collision push-out) and the
   wall push test pressed jump after the climb had already ended at the
   attach offset. Both read as "the technique does not reach". The advanced
   course was then designed only round gates the corrected measurements
   support; the wallbounce got a slalom (a redirect, which is what it is for)
   rather than a height gate, because on our numbers a climb plus a mantle
   reaches higher than a bounce plus a mantle.
2. **A superglide landing at floor level counted as a fall.** The hazard rule
   is "below 0.7 m inside the gap", and a flight down to a floor at 0 dips
   under that before it lands past the gap. The landing is a 1 m pad now, so
   a good glide never crosses the line; the sim test uses the game's exact
   rule and caught it.
3. **The knocked figure stopped falling on the other screen** after the
   network became a star: the `down` message marks the player dead before
   their next state packet, which is what used to trigger the fall. The e2e
   caught it (two failures); the fall now fires on `down`.
4. **Editing files while the e2e runs kills it**: Vite's hot reload navigates
   the pages mid-test ("Execution context was destroyed"). Not a game bug; a
   note for the workflow.
5. **The sprint probe was walking.** The first probe held sprint instead of
   pressing it; with toggle sprint (the game's default) a held key never arms
   it. The bounce still registered, from 174 hu/s; the probe now presses it
   and runs at 260.
6. **bash heredocs mangle backslashes**: two patch scripts silently failed
   their anchors. Patches go through the Write tool now (already a rule in
   this project's notes; broken twice more).

## Open

- The Ctrl+W fullscreen fix from the last batch is still untested by machine.
- The bots walk: no slides, jumps or climbs, so a player on a lane wall is
  out of their reach except by gun. See NEXT_STEPS 6.
- Bot difficulty numbers are ours, untuned against real players.
- Rank times on the advanced course are provisional until someone sets real
  runs.
- The leaderboard worker is written and reviewed, not run: it needs a
  Cloudflare account for `wrangler dev`.
