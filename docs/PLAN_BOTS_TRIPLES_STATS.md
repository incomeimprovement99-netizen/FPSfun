# Plan: wall tech, Kraber, sprint feel, two courses, bots, 1v1v1, stats, GitHub

Every ask from the last message, with an ID, what will be done and how it is
checked. "Ours" marks anything with no published number behind it.

## Movement and feel

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| T1 | "None of the movement tech like walljump works" | Two parts. (a) A probe that runs a wallbounce in the REAL page (real range geometry, real frame loop, real input path) rather than the simulation: `tools/tech-probe.ts`. First run: the rule fires (`WALLBOUNCE +31 hu`), so the game registers it; what is missing is any word on WHY an attempt did not. (b) So: tech diagnostics in the feed, in orange, for the near misses. Jump at a wall without attaching: "NO WALL: look at it (62 deg off)", "NO WALL: climb space used, land first", "NO WALL: same wall, drop lower first", "NO WALL: push into it". Superglide: "SUPERGLIDE MISS: crouch 3 frames after jump (needs 1)", "crouch before jump", "too early: 0.31 s left of the mantle (window 0.15)". Wallbounce from the neutral zone already says WALL PUSH; from the mini zone MINI-BOUNCE. Plus a Trainer panel (Stats tab) counting every piece of tech landed and missed, per session and all time. The practice wall's sign is rewritten from what the probe did. | probe: wallbounce and superglide register in the real page; movesim: each miss reason fires on its own scenario |
| T2 | Kraber should default to a sniper scope | The data says the Kraber's own sight is a 4x-8x (zoom_fov 13.3, toggle 8.0); the game was drawing iron sights and no scope picture for it. Weapons whose base zoom is a scope get an integral optic: the 4x-8x sniper model and full-screen scope by default, Z switches 4x/8x, the attachment line reads "4x-8x (built in)". Fitting a 3x or 2x-4x still replaces it, as in the game. | verify: the Kraber resolves with the integral optic; screenshot |
| T3 | Sprint does not feel like Apex; faster, or arms that swing more | The speed IS the game's (260 hu/s, 299 holstered), checked by the sim. The feel is the presentation: the game has "Sprint View Shake" (Normal by default) and a pumping weapon. So: the gun pumps harder and rolls with the stride, the empty hands and the heirloom swing further, and the camera gets the game's sprint view shake (a small vertical bob and roll at stride rate), with the game's own setting: Sprint view shake Normal / Minimal. Not a sprint FOV kick: the game has none. A speed readout was already on the HUD. | screenshot; movesim confirms speeds unchanged |

## Modes

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| R1 | Keep one course as "The Run (Basic)" | The current course, renamed. Its best time, splits and ghost carry over. | e2e |
| R2 | "The Run (Advanced)": much longer, uses movement tech together | A second course on the range's back-RIGHT corner, through a second gate in the back wall, 200 m long, eleven rooms, each built so the tech is the fast route and chained into the next: double vent slide, wallbounce over a gap, superglide off a mantle across a wider gap, a tap-strafe zigzag over hazard floor, a wall-push climb chain, a zipline superjump to a high ledge, a ladder drop into a slide, a bounce corridor to the finish. 30 pop-ups. Its own ranks, splits, ghost and results TV. The course code becomes a layout the two courses share. | movesim: each room's intended route makes it (the gaps are too wide without the tech); e2e: a scripted run through every room |
| A1 | "Arena, Bots" | The 1v1 arena against 1 or 2 bots, same rounds and circle as the 1v1. Bots run the lanes on a waypoint graph, hunt you when they have line of sight, strafe, fire their loadout weapon with a spread that depends on the difficulty (Easy, Normal, Hard: reaction time and accuracy), go for the circle when it is live, and take hits like the 1v1 opponent. You have the 1v1's blue shield and 100 health. Wins, kills and deaths count in Stats. | e2e: a bot match runs a round to a result; movesim: bots reach the circle on the graph |
| M1 | 1v1v1 for three people, a triangle, same middle circle | A three-cornered arena: spawns at the three corners, a lane from each corner to the middle, walls between the lanes with boxes to get over them, the circle in the middle under the same roof. The network becomes host plus up to two guests: guests connect to the host's code, the host relays every message to the other guest, hits go to their target. Last one standing takes the round, or alone in the circle 10 s; first to 3. The 1v1 tab gets "Players: 2 / 3". | e2e: three tabs over the local transport, a knock and a capture score correctly on all three |

## Stats and next steps

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| S1 | Who won the most 1v1s, K/D, best times, leaderboards for everything | A profile (your name, kept in this browser) and stats: 1v1 and 1v1v1 matches played, won, lost, rounds, kills, deaths, K/D, damage, accuracy; bot matches the same per difficulty; best times per course with splits; tech landed. A Stats tab with all of it, and local leaderboards: your top 10 runs per course with dates, your longest 1v1 win streak. | e2e: a result writes the stats and survives a reload |
| S2 | Leaderboards across players (online) | Needs a server, which a static site cannot be: `server/leaderboard/` holds a Cloudflare Worker (free tier) with a KV store, endpoints to post a result and read a board, a shared secret so only the game posts, and the client that talks to it when `VITE_LEADERBOARD_URL` is set. Deploying it needs your Cloudflare account, so it ships ready but off. | worker unit run locally with `wrangler dev` if available; else code reviewed and documented |
| N1 | Clear next steps, especially multiplayer | `docs/NEXT_STEPS.md`: ranked, with what each needs (a server or not, accounts or not), in the order to do them. | read |

## Release

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| G1 | Private GitHub repo | Local commits of everything. GitHub's CLI is not installed and creating a repo needs your login, so the push waits on a repo URL from you (or `gh auth login` once, then I do the rest). | git log |
| G2 | Make it playable online with multiplayer | The public build (`npm run build:beta`, codenames only) goes to a static host over HTTPS. GitHub Pages is free only for public repos, so the plan is a separate public repo holding only `dist/` (no source, no real names), published from a script. Or Cloudflare Pages / Netlify from the same folder if you prefer. Waits on G1. | the beta check passes on what is published |

## Out of scope this batch, listed in NEXT_STEPS

Accounts and cross-device saves, a TURN relay and our own broker, an
authoritative server for more than three players or trusted scores, key
rebinding, animated character models.
