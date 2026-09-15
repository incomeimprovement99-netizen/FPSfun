# Development Roadmap

Ordered, newest at the bottom. Status: ✅ shipped / 🚧 in progress / ⏭ planned.

One milestone per shipped feature or batch. Each round of work has a plan and a
results doc; from Phase 11 on they are `PHASE_N_PLAN_*.md` and `PHASE_N_*.md`.
Milestones 1 to 10 were written after the fact from the earlier rounds'
`PLAN_*` / `RESULTS_*` docs (which keep their names) and the git history.

## Milestone 1 — The look pass and the movement pass ✅
2026-09-13. Colour grade (split tone, S-curve, vignette, grain), a re-light, an authored sky dome, bevelled
structure, one palette; all 27 weapons modelled in seven families; gloved first-person hands; bolt, slide,
pump and cylinder cycling, muzzle flash, brass, reloads with the support hand; the jointed training robot
over invisible, unchanged hit zones. Movement: wall climb, tap-strafe lurch, downhill slides, landing dip.
See [`PLAN_LOOK_AND_FEEL.md`](./PLAN_LOOK_AND_FEEL.md), [`RESULTS_LOOK_AND_FEEL.md`](./RESULTS_LOOK_AND_FEEL.md),
[`MOVEMENT_AUDIT.md`](./MOVEMENT_AUDIT.md).

## Milestone 2 — Snappy, the Apex HUD, and The Run ✅
2026-09-13. Measured the frame rate (833 fps Competitive; the display is the cap) and explained it in
Settings; the HUD laid out where Apex puts it (minimap, compass, vitals, weapons, damage numbers); the
first movement course, THE RUN, with a timer, pop-ups and ranks; the course pistols.
See [`PLAN_SNAPPY_HUD_COURSE.md`](./PLAN_SNAPPY_HUD_COURSE.md), [`RESULTS_SNAPPY_HUD_COURSE.md`](./RESULTS_SNAPPY_HUD_COURSE.md).

## Milestone 3 — Ziplines, ladders, sights ✅
2026-09-13. Ziplines with the Movement Wiki's rules; ladders; interact prompts; the course moved behind a lit
gate; ten optics with housings and reticles, full-screen scopes from 3x; static meshes merged; raw mouse
input; scroll binds; hipfire-only crosshair.
See [`PLAN_ZIPLINES_LADDERS_SIGHTS.md`](./PLAN_ZIPLINES_LADDERS_SIGHTS.md), [`RESULTS_ZIPLINES_LADDERS_SIGHTS.md`](./RESULTS_ZIPLINES_LADDERS_SIGHTS.md).

## Milestone 4 — Wall tech, the tech feed, splits and a ghost ✅
2026-09-13. Climb-zone wall jumps (mini-bounce, wallbounce, wall push); the practice wall; the tech feed
that names every superglide, wallbounce and lurch and says why a miss missed; course splits and a ghost;
variable zooms; Digital Threat optics.
See [`PLAN_WALLTECH_SPLITS_GHOST.md`](./PLAN_WALLTECH_SPLITS_GHOST.md), [`RESULTS_WALLTECH_SPLITS_GHOST.md`](./RESULTS_WALLTECH_SPLITS_GHOST.md).

## Milestone 5 — 1v1 by code, loadouts, menus, the beta build ✅
2026-09-14. PeerJS 1v1 with a match code, shooter-decided hits, rounds and the circle; five default and
five custom loadouts, operators, heirlooms; the tabbed menu; the public beta build with codenames; a
24-finding bug hunt.
See [`PLAN_1V1_BETA.md`](./PLAN_1V1_BETA.md), [`RESULTS_1V1_BETA.md`](./RESULTS_1V1_BETA.md).

## Milestone 6 — Two courses, bots, 1v1v1, stats ✅
2026-09-14 (first commit `2ddccd7`). The Run: Advanced; the course engine; arena bots at three
difficulties; 1v1v1 on a star network; the profile and the Stats tab; the leaderboard worker (not
deployed).
See [`PLAN_BOTS_TRIPLES_STATS.md`](./PLAN_BOTS_TRIPLES_STATS.md), [`RESULTS_BOTS_TRIPLES_STATS.md`](./RESULTS_BOTS_TRIPLES_STATS.md).

## Milestone 7 — Controller, the wallbounce and slide from the wiki, hands and gun animations ✅
2026-09-14 (`da7e52c`). Gamepad play (Start, look curves, deadzone, auto sprint, rumble); three movement
numbers corrected against the wiki's pages (the sprint start, the slide, the wallbounce's slide-jump
recipe); rebuilt hands; draw, holster, idle, slide and sprint gun poses; kill feed and nameplates.
See [`PLAN_FEEL_CONTROLLER.md`](./PLAN_FEEL_CONTROLLER.md), [`RESULTS_FEEL_CONTROLLER.md`](./RESULTS_FEEL_CONTROLLER.md).

## Milestone 8 — Polish, the last bug hunt, the ship ✅
2026-09-14 (`0e20ca2`). Bigger signs, more animations, fourteen findings fixed, the deploy steps; live on
GitHub Pages.
See [`RESULTS_POLISH_SHIP.md`](./RESULTS_POLISH_SHIP.md), [`DEPLOY_GUIDE.md`](./DEPLOY_GUIDE.md).

## Milestone 9 — Our own server, the full bug hunt, aim assist, rebinding, invite links ✅
2026-09-15 (`fb81124`). `server/game/` (our PeerJS broker, a TURN relay, online boards, one-command deploy
to a free Oracle VM, not live yet: waiting on the VM); 31 findings fixed; controller aim assist; the
Controls tab; invite links; the first-visit welcome and device check.
See [`RESULTS_SERVER_HUNT.md`](./RESULTS_SERVER_HUNT.md), [`SERVER_GUIDE.md`](./SERVER_GUIDE.md).

## Milestone 10 — The lobby, animated figures, third person, the battle royale, the squad ✅
2026-09-15 (`c92a2d2`, `bd1873b`, `1eaf029`). Create match puts you in the arena; jointed figures posed
from stance and speed, sent over the network; third person with an orbit; the gap analysis; Outskirts (a
middle POI and four outer ones), the ring with Apex's six rounds, the drop shown on the map, healing, the
placement card; a squad of up to three against the bots over the same links.
See [`RESULTS_BR.md`](./RESULTS_BR.md), [`GAP_ANALYSIS.md`](./GAP_ANALYSIS.md), [`NEXT_STEPS.md`](./NEXT_STEPS.md).

## Milestone 11 — Phase 11 planned: the roadmap, the phase plan, the research ✅
2026-09-15. The docs pattern switches to phases and milestones. The plan for abilities (JOLT, TRIAGE),
the killcam and death recap, and every gap-analysis next step short of PvP BR, in thirteen workstreams.
Current Apex numbers with sources for the rest of the phase (heals, shields, knockdowns, throwables,
Nemesis, Bocek, the Season 30 energy-ammo regen, Gun Run).
See [`PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`](./PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md),
[`RESEARCH_PHASE_11.md`](./RESEARCH_PHASE_11.md).

## Milestone 12 — Abilities: JOLT and TRIAGE ✅
2026-09-15 (Phase 11B).
- **JOLT**: a 10 m dash the way you are moving (forward with no keys), level, over 0.18 s, walls stop it,
  out at sprint speed; 3 s cooldown; key F (LB on a pad). **TRIAGE**: every heal item twice as fast.
  Numbers in `src/config/abilities.json`; the dash is `Player.jolt` in the movement code.
- **The choice card**: "CHOOSE YOUR ABILITY [5] JOLT [6] TRIAGE" when one becomes available: on landing in
  a battle royale, at each countdown of an arena or bot match (d-pad left and right on a pad); one line in
  the range, where 5 and 6 pick one to practise any time. The HUD slot shows the key and the cooldown.
- **The option**: "Abilities on / off" for the friends' matches, the bot match and the BR (on by default),
  remembered per kind; the host's setting rides in the welcome. Bots take one at random: a JOLT bot dodges
  sideways when hit, a TRIAGE bot heals faster; every bot now heals when nobody is in its sights for 4 s.
- **Everyone sees it**: a JOLT sends an effect to the others (a streak and a whoosh); bots' too.
- Keys moved: reset dummies F to Y. Heal items moved to `src/config/items.json`.
- Tests: movesim (10.00 m in 0.18 s, the wall, level in the air, the drop refuses it), verify (cooldown,
  TRIAGE scale), e2e (off by default in bots; the card at the countdown; JOLT moves you and starts the
  cooldown; the BR card on landing; TRIAGE halves the cell; a squad guest's JOLT reaches the host);
  `tools/snap.ts` screenshots the HUD states.

## Milestone 13 — The killcam and the death recap ✅
2026-09-15 (Phase 11C).
- **Killcam** (`src/game/killcam.ts`): every match is recorded 30 times a second (every figure, you
  included: place, facing, pitch, stance, speed, gun, skin; every round fired), 8 s kept. On an elimination
  the last 4 s and the 1 s after are replayed 4 s behind real time from the killer's eyes, with their gun
  in view kicking on their shots, ghost figures posed from the recording, the rounds re-fired as tracers.
  Space / E / A skips; the next fight ends it; none for a ring kill; a Settings option turns it off.
- **Death recap** (`src/game/recap.ts`): a log per life of every hit both ways (gun, amount, headshot,
  distance) and every heal anyone finishes. The card: eliminated by whom, your damage to each opponent
  against theirs to you with hits and headshots, their guns with the closest and farthest hit, a heal of
  theirs in the 10 s before the kill, what they had left. Space closes it; the next fight does too.
- **On the wire**: a hit now carries the gun and the distance; a finished heal is an effect the others log;
  the host sends its bots' shots to the squad as tracers (guests never saw bot fire before).
- Works in the 1v1, 1v1v1, bots, BR solo and squad (a guest's killcam can be a bot the host runs). The BR
  end card holds 14 s so the replay and the recap fit.
- Tests: verify (the recap's sums, distances, heal window, the ring), e2e (the bot's elimination: the
  killcam from its eyes with its gun, the recording's length, the recap both ways; the ring: recap only; the
  squad guest's killcam), snap (the replay and the card drawn for real).

## Milestone 14 — Sound, positional and by class ✅
2026-09-15 (Phase 11D). All synthesised in code (`src/game/audio.ts`, the numbers in `src/config/audio.json`).
- **The engine**: HRTF panning on the camera, fall-off and an air-absorption low-pass with distance, sound
  arriving late by the speed of sound past 25 m, a generated reverb (more indoors, less on Outskirts), a
  compressor, a voice cap, master / effects / hit-sound volumes in Settings.
- **Guns by class** (pistol, SMG, rifle, LMG, marksman, sniper, shotgun; energy guns add a zap), heard from
  where they were fired, once a trigger pull; a round passing within 2.5 m cracks past you.
- **Movement** (`src/game/soundscape.ts`): footsteps by surface (concrete, metal, dirt) for you and every
  figure within 45 m, quieter crouched, louder sprinting; jump, landing by impact, the slide's scrape, the
  zipline's whine, climbing taps, the mantle, the drop's wind, JOLT.
- **Combat**: hit sounds pitched by the shield tier hit (white, blue, purple, red, bare health, head), the
  shield break, the knock stinger, your own hits taken (a thud, a crackle on shield); reloads in parts
  (magazine out, in, the bolt from empty); swap and holster.
- **The match**: countdown beeps and the fight tone, round and match stingers, the champion's chord, the
  ring's horn when it starts to close and its tick on you, a heal's hum and the done chime.
- **Low health**: a heartbeat under 30 and the picture losing its colour (the grade, or a blend layer in
  Competitive).
- Tests: verify (every gun has a class), e2e (a bot fight is heard, under the voice cap).

## Milestone 15 — Guns that are not a plain trigger, hop-ups, fire modes, counted ammo ✅
2026-09-15 (Phase 11E). Rules in `src/config/weapon-mechanics.json`, numbers from the data where it has them
and from Season 30 (`docs/RESEARCH_PHASE_11.md`) where it has moved on.
- **HAVOC** winds up 0.42 s before its first round (the Turbocharger: 0.01); **Devotion** spins from 5 to 15
  rounds a second over 1.75 s (Turbocharger: 6.8 and 0.85 s); **L-STAR** has no magazine: 24/26/28/30 shots
  to overheat, a forced 1.19-1.07 s cooldown, cooling when you let go; **Charge Rifle** fires 0.85 s after the
  pull and does 75 growing to 110 by 200 m; **30-30** (51 now) charges while aimed in 0.25 s for +36%;
  **Precision Choke** closes the Peacekeeper's and Triple Take's cone while aimed.
- **A hop-up slot** (L): Turbocharger, Skullpiercer, Hammerpoint (bare health ×2.7/×2.3), Disruptor
  (shields ×1.55/×1.6), Precision Choke, Double Tap, Selectfire. Shield and bare-health scales now apply to
  every hit.
- **Fire modes** (B, Apex's key): R-301 and Flatline single, Hemlok single, HAVOC charged single, Prowler auto
  (with Selectfire), G7 and EVA-8 double tap (with Double Tap). Barrel moved to J, mag level to U.
- **Counted ammo** (`src/config/ammo.json`): each gun's type and the stacks (light 60, heavy 60, sniper 28,
  shotgun 20); a match gives two stacks per gun; energy guns carry their own 2/3/4-magazine stockpile that
  refills one magazine every 18 s idle (Season 30). "NO AMMO" when there is nothing to load. The range stays
  endless unless Settings says counted.
- **The HUD**: a charge ring round the crosshair (wind-up, charge, aimed charge, choke), the L-STAR's heat
  and the Devotion's spin as bars, the fire mode, the reserve (an energy stockpile as a percentage); the
  wind-up and overheat sounds.
- Tests: verify (every mechanic timed frame by frame, the fire modes and Selectfire, the hop-up scales, the
  reserve, a partial reload, NO AMMO, the 18 s regen).

## Milestone 16 — The Nemesis and the Bocek: the roster at 29 of Apex's guns ✅
2026-09-15 (Phase 11F). Both are newer than the reference data, so they are derived weapons (as the course's
Striker 9 is) with Season 30's numbers.
- **Nemesis Burst AR**: the Hemlok's handling, 17 a round (22 head, 13 leg), bursts of 4 at 18 a second,
  0.31 s between bursts falling to 0.19 s as it charges (+16.7% a burst, draining after 8 s idle),
  20/24/28/32 rounds, reloads 2.7 / 3.0 s, energy ammo with a 3-magazine stockpile.
- **Bocek Compound Bow**: hold to draw (0.35 s), let go to loose; 55 at full draw, less and slower for a
  short draw; the next arrow nocks itself; its own 60 arrows; optics only. A bow model of its own (riser,
  limbs, cams, a string that follows the nock), drawn back in first person with the string hand.
- Codenames on the public build for both, and for the hop-up names (the check now bans the real ones).
- Tests: verify (the burst cadence charged and not, the draw's damage and timing, the auto nock, the roster
  count, every gun modelled).
