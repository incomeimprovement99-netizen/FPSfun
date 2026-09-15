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

## Milestone 17 — The range's own tooling ✅
2026-09-15 (Phase 11G). `src/game/rangetools.ts`, `src/game/trainer.ts`, a Range box on the Play tab.
- **Dummies that move** (Apex's panel): stand, strafe, strafe and crouch, random; slow / normal / fast; I cycles.
- **Shoot back**: the two nearest dummies that can see you fire with a bot's aim (easy / normal / hard); you
  get a shield, health and the heal kit in the range, back up 2 s after you drop.
- **Spray wall** on the right-hand wall, 20 m from a yellow mark: your hits in white and, from the first of
  a string, where the gun puts a magazine with no compensation (the game's own recoil model, run for a whole
  magazine) in gold. Y clears it.
- **Flick drill**: 30 figures one at a time, 5-30 m out in a 60 degree cone from a pad by the firing line (E
  on the pad, or the Flick drill button); time, accuracy, a best, the Stats tab and an online board.
- **Superglide trainer** on every mantle: the mantle's last 0.3 s as a bar, the window in green, where your
  jump and crouch landed and the frames between, the verdict with the reason, your last ten tries. **The
  mantle boost cue**: a ring on the crosshair while the window is open (Season 27's option; Settings).
- **Hits by zone**: a dummy flashes gold on the head, white on the body, blue on the legs. **Per-gun numbers**
  for the session on the Stats tab; Y now resets the overlay's numbers too.
- **The slide probe** (`npm run slide-probe`): speed and view height through a slide and two slide jumps,
  frame by frame from the real controller, as curves beside the wiki's numbers.
- Tests: movesim (the trainer scores a superglide one frame apart, calls a 3-frame crouch a miss with the
  reason, the cue opens in the window), e2e (strafing dummies move, shoot back hurts, the wall takes a burst,
  per-gun numbers, the drill's countdown, placement and finish), snap (the wall, the drill).

## Milestone 18 — Every heal, healing as Apex does it, shield cores and helmets ✅
2026-09-15 (Phase 11H). `src/game/kit.ts`, `src/config/items.json` (Season 30 numbers).
- **Five heals**: shield cell 25 in 2.5 s, syringe 25 in 4 s, shield battery full in 5 s, med kit full in 8 s,
  phoenix kit both full in 10 s; stacks 6 / 6 / 2 / 2 / 1.
- **Healing as Apex does it**: you walk 40% slower and cannot sprint while healing; sprinting, firing,
  aiming or a swap cancels it; the item is spent only when it finishes.
- **The heal key**: a tap is the quick heal (shields first: a battery for 50 or more missing, else a cell;
  then health the same way; a phoenix when both are half gone); holding it opens a wheel of all five with
  their counts, the mouse points, letting go uses it.
- **Shield cores**: a battle royale starts on a white 50 core that levels with EVO (the damage you deal) to
  blue 75 at 450 and purple 100 at 1,700, refilling on the level-up (ours), with an EVO bar under the shield;
  the arena and the bots stay on blue 75. Helmets cut no headshot damage since Season 24: the gold one sets
  armour to 100 and doubles the small heals, the mythic one 125 (the loot comes with the next milestone).
- **On the wire**: each player's shield size goes in the state packet, so plates and shield colours are right.
- Tests: verify (the quick heal's choices, stacks, times, the EVO thresholds, the helmets), movesim (60% pace,
  no sprint while healing), e2e (the BR's white core and a cell to its cap).

## Milestone 19 — The battle royale, filled in: loot, downs, revives, banners, beacons, pings ✅
2026-09-15 (Phase 11I). `src/game/loot.ts`, `src/game/brplay.ts`, `src/config/loot.json`, `src/config/squad.json`.
- **Land with nothing** (the new default, a setting beside the BR's other options): two empty slots and
  fists (the fire button punches), no heals, no ammo; "land with your loadout" is still there.
- **Floor loot** from the host's seed, so every browser in a squad lays out the same items under the same
  keys: around 200 items over the five places and the field, rolled by kind and rarity (guns, ammo stacks,
  heals, magazines, barrels, stocks, optics, hop-ups, helmets). A gun lies as its own model on a ring in its
  rarity's colour, the rest as a box; epic and legendary items stand in a beam. Only what is within 70 m is drawn.
- **E takes what is under the crosshair** (within 2.2 m, about 25 degrees of the line), with a TAKE prompt.
  A gun goes into an empty slot, or in place of the one in hand, which goes down where you stand with its
  fittings. Ammo goes in the pack; a heal past its stack takes what fits and leaves the rest; a magazine or
  attachment goes on whichever gun takes it; a helmet goes on. In a squad the host decides who got it first.
- **Bots land unarmed** and search (30 / 18 / 10 s by difficulty) before they have a gun and a shield.
- **Death boxes**: yours holds your guns, ammo, heals, helmet and, in a squad, your banner; a bot's holds its
  gun, ammo and a few heals.
- **Care packages** in ring rounds 2 to 4: the pod shows on the maps as it falls (8 s), then lands with a gold
  care-package gun (Kraber, 30-30, L-STAR) and two of: a gold helmet, a phoenix kit, two batteries.
- **Down, not out** (Season 30): in a squad with someone still up, a knock puts you down; you crawl (crouched,
  65% of the crouch walk, no guns, no heals) and bleed out over 90, 60, 30, then 15 s a knock. Down you have
  100 more to take before you are out. A red edge, the clock and who is reviving you are on screen.
- **Revives**: hold E for 5 s next to a downed squad mate; they are up with 20 health. Both sides see it.
- **Banners and respawn beacons**: take a squad mate's banner from their death box (90 s), hold E for 5 s at
  a beacon, and they drop in over it.
- **Jump towers** (E at the balloon, a second drop from three quarters of the height) and **launch pads** on
  the roads (about 33 m along and 6.7 m up).
- **Pings** (the middle mouse button): an enemy under the crosshair (it follows them), an item near the line,
  else the place you look at. Shown in the world (held to the screen's edge when off it, with the distance),
  on the minimap and on the full map, to the whole squad.
- **The maps** show jump towers, beacons, care packages, pings and your squad mates (red when down).
- **Watching a squad mate** when you are out: through their eyes; the third-person key puts you behind them.
- Tests: verify (the seed lays out the same floor on every browser, the rolls name only real guns and heals,
  every attachment fits a gun in the pools, the rarity weights, empty slots and fitting loot, the bleed-out
  clock), movesim (the pad's throw, the crawl), e2e (landing with nothing, the TAKE prompt and E, a second and
  a third gun, ammo, a heal past its stack, a helmet, a care package, your death box, the loadout back after;
  in a squad: a ping, down not out, the crawl seen by the host, the revive prompt and 5 s hold, 20 health, the
  second knock's 60 s, finished while down, the banner in the box), snap (br-loot, br-downed, br-map-icons).

## Milestone 20 — The arena's modes: Gun Run, team deathmatch, Crown ✅
2026-09-15 (Phase 11J). `src/game/modes.ts` (the rules), `src/game/modematch.ts` (the match), `src/config/modes.json`.
- **One match class for all three**, built on the 1v1's links like the battle royale: the host runs the bots
  and the rules and tells the guests (bots as ordinary state packets, the rules' state as a `mode` message four
  times a second and on every change). Alone it is the same class with no links. Played in the 1v1 arena.
- **Gun Run** (Apex's rules where published): one kill moves you to the next gun and puts it in your hands at
  once, with its deploy time; after the last gun comes the knife (fists; 100 a hit, 300 to the head, the
  throwing knife's numbers), and a knife kill wins. A melee death costs a level. 10 minutes, then the highest
  level wins. Health and shields come back 4 s after the last hit. Respawns 3 s after going down, at the spawn
  farthest from the enemies. The list: 10 guns, or every gun (29). Bots run the ladder too, and at the knife
  they close in and swing. Every player for themselves, friends and bots together.
- **Team deathmatch**: you and your friends, filled out with bots to four, against four bots; respawns after 4 s
  at your end; first team to 30 (Apex's 40 is for 6v6), or ahead at 10 minutes. Team mates cannot hurt each
  other and their bullets pass through; their plates are green and aim assist leaves them alone (which also
  fixes aim assist pulling toward a battle royale squad mate).
- **Crown**: rounds like the 1v1. 20 s in the crown appears in the middle; walk over it to take it; the carrier
  wears it (a gold crown and a beam over their head) and everyone sees a marker on it; 30 s held without going
  down takes the round, as does being the last one up. A carrier who goes down drops it where they fell. First
  to 3. Bots go for the crown, hunt its carrier, and carry it away from the fight.
- **Picking them**: three new Play tab buttons (alone against bots), the friends' mode list on the 1v1 tab, and
  a box for the bots in a free-for-all and Gun Run's list. The host's choice rides in the welcome.
- **The HUD**: a panel for each mode under the compass (your level, gun and the next; the teams' score; the
  rounds and where the crown is, with the hold bar), the clock, a scoreboard down the right, a respawn count,
  and the results. **Stats**: a card per mode, and online boards for each mode's wins.
- Tests: verify (the lists name real guns; the ladder: a kill, a melee death, the ring, the knife's win, the
  leader; the team score; the crown: its wait, the nearest taker, the 30 s hold, the drop; the respawn pick;
  spawns inside the walls), e2e (each mode from its Play tab button; Gun Run's gun changes, respawns, the knife
  and its win, the Stats card, the loadout back; team mates immune and the 30th kill; the crown appears, is
  taken, the hold takes the round, round 2; every spawn clear of the boxes; Gun Run with a friend and a bot
  over the local transport: the host's ladder on both screens, the guest's respawn, the guest's kill on the
  host's bot), snap (mode-gunrun, mode-tdm, mode-crown).
