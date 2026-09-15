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

## Milestone 21 — Figures that move like players, and motion-captured mannequins ✅
2026-09-15 (Phase 11K). `src/game/dummy.ts`, `src/game/mannequin.ts`, `tools/trim-glb.ts`, `public/models/mannequin/`.
- **Legs and aim apart**: the legs walk the way a figure moves while its body stays on its aim: the hips turn
  toward a strafe (up to 72 degrees) and the torso turns back, and walking backward runs the stride backward.
  Worked out from the figure's movement against its facing, for players (from their state packets), bots and
  your own third-person figure alike.
- **The hands**: aiming down sights brings the gun up to the eye and the head down to it; every shot kicks the
  gun into the shoulder; a reload rolls and dips it; a swap takes it down out of sight; a heal puts it away and
  holds the item (blue for shields, red for health, gold for the phoenix).
- **Hits and abilities**: a flinch on every hit, a bigger stagger when the shield breaks; a JOLT's lean into the
  dash with the legs trailing. Down and eliminated keep their knees-and-crawl and fall.
- **Over the network**: aiming (0 to 10) and what the hands are doing (a reload, a swap, a heal and its item) ride
  in the state packet; shots and JOLTs trigger the kick and the lean from the messages already sent.
- **Motion-captured mannequins** (a setting, Figures: mannequins): Quaternius's mannequin and 25 clips from his
  Universal Animation Library 1 and 2 (CC0), trimmed from 15.7 MB to 4.4 MB with a new tool. Two layers: the legs
  play idle, walk, jog, sprint or crouch at the figure's speed (backward in reverse), the upper body the aim pose,
  the reload, the heal or the lowered gun; slides, climbs and ziplines play whole-body clips. The same strafe
  turn, pitch, kick, flinch and lean go on top; the operator's colours tint it and its joints glow in its armour
  tier. The robots stay the default: the library's clips are pistol clips, so every gun is held the pistol's way.
- Tests: verify (the movement direction against the facing, the hands' codes on the wire), e2e (a guest aiming
  and healing is seen on the host's copy of the guest with the right item; with the setting on, a match's bots
  are mannequins with their clips playing), snap (figure-poses, figure-mannequins).

## Milestone 22 — Throwables: the frag, the arc star, thermite ✅
2026-09-15 (Phase 11L). `src/game/throwables.ts`, `src/config/throwables.json` (Season 30 numbers).
- **G** readies a grenade (again: the next kind you have; after the last, your gun again); after the pin (0.45 s)
  the fire button throws and aiming puts it away. While one is in hand the gun is down, and dots show the arc it
  would take with a ring where it lands.
- **The frag**: bounces and rolls, 4 s fuse from the throw; 100 inside 2.4 m falling to nothing at 8 m, +10 on a
  direct hit. **The arc star**: sticks to the first thing it touches (a wall, the floor, or a figure, which it then
  follows) and goes off 2.8 s later: 75 inside 1.8 m to nothing at 8.75 m, +10 to whoever it stuck to, and a slow
  of up to 5 s scaled by the damage. **Thermite**: a 6 m line of fire across the throw for 8 s, 4 a tick twice a
  second inside it, and 25 more over 2.5 s after leaving it. Walls stop a blast (it needs a line of sight).
- **Who decides**: the thrower, like the shooter decides a bullet's; the damage goes through the bullets' own
  path (damage numbers, hit markers, the match's hit messages, the recap names the grenade). The others' screens
  replay a throw from its start and its speed alone (the flight is deterministic): they see it fly, bounce,
  stick and go off, and hear it.
- **Where you get them**: one of each per life in the arena, the modes and the bot match; the battle royale's
  floor and death boxes (a stack holds two); the range never runs out. The HUD counts them over the heals and
  names the one in hand. Drawn in code: the grenades, the blast's flash and ring, flames from a generated
  texture. Sounds: the pin, a frag's bounce, the arc star's stick, the booms, the fire catching.
- Tests: verify (the fall-off at the radii, the slow, a frag's flight and 4 s fuse on the floor, the arc star
  sticking to the floor and to a moving figure, thermite's 6 m line across the throw and its 16 ticks, the
  carried counts, G's cycle and the stack), e2e (G readies and cycles through the real key, a frag at a bot's
  feet takes exactly 100 after the fuse, thermite burns, the range again; a friend's arc star over the local
  transport: seen in the air, sticks, 85 in all, slowed), snap (throw-preview).

## Milestone 23 — Finishing touches: the tour, medals, inspect, toggles, the controller ✅
2026-09-15 (Phase 11M). `src/game/tour.ts`, `course.ts` medals, `gamepad.ts`, `sens.ts`, `viewmodel.ts`.
- **The guided tour** (the Play tab's first mode after the range): thirteen steps through the range, each with a
  green marker to walk to (a beam, and an arrow at the screen's edge when it is off screen) and what to do with
  your own keys filled in: move, sprint, slide under the rail, jump, mantle the 2.4 m ledge, climb the ladder, a
  superglide, shoot a target, reload, swap, heal (the tour lends a shield to heal), JOLT, a grenade. It watches
  the game's own state and moves on when you do each; holding interact skips a step. Finishing it is remembered.
- **Course medals**: every room has a par (its own, or the S time shared out by the room's length) and each run
  earns gold (at par), silver (within 25%) or bronze (within 60%) per room, on the results TV (with the room's
  time against its par) and the result card. The last room runs to the line (the missed-enemy penalty is the
  run's, not the room's).
- **Weapon inspect**: hold reload with a full magazine and the gun comes up and turns to show one side, then the
  other; firing, aiming, a swap or a sprint ends it. **A first draw**: a gun just picked up (the battle royale,
  Gun Run's next gun) comes out with a twirl; cosmetic, the gun is usable throughout.
- **Toggle ADS and toggle crouch** (Settings): a press in and a press out; a sprint or a swap comes out of the
  aim, a jump or a sprint stands you up. **Per-optic ADS sensitivity** like the game's: a multiplier for each
  zoom (1x, 2x, 3x, 4x, 6x, 8x, 10x) on top of the ADS one, by the optic in hand and a variable optic's zoom.
- **The controller**: the game's **advanced look** (yaw and pitch speeds for hip and aim, an extra yaw and pitch at
  the stick's edge that ramps in over a time after a delay), and **button rebinding** on the Controls tab (every
  button but Start, which stays the menu so you cannot lock yourself out).
- Tests: verify (the medal steps, the pars adding to the S time, the optic zoom buckets, the advanced look's rate
  through its ramp and at ADS, a pickup's first draw), e2e (toggle ADS and crouch, the 3x's multiplier, Y rebound
  to reload reloads, the advanced look saved, inspect and its cancel, the first draw, the whole tour from the Play
  tab with real inputs where it can: the marker walk, a sprint, a slide, a jump, a mantle, a climb, a skip, a real
  hit with the trigger, a reload, a swap, a heal, JOLT, a grenade, remembered; gold in every room of a quick
  course run), snap (tour).

## Milestone 24 — Phase 11 closed: the bug hunt, the docs, the deploy ✅
2026-09-15 (Phase 11N). `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`.
- **Two independent reviews** of everything the phase touched and the live check, 31 findings, each re-read against
  the code: 29 fixed, one left by design, one a question for the owner. The live check found that a message with
  an undefined field was dropped over the real peer-to-peer link (PeerJS packs it as null). The worst: a guest in a battle royale hardly ever
  took the ring's damage; team deathmatch and Crown bots were handed Gun Run's guns; a grenade throw fired the
  gun on the same click; the tour's heal step left a heal running that blocked grenades; toggle ADS could not
  aim while sprinting; GPU memory grew with every throw and every battle royale.
- Regression tests for the worst of them (verify: the knife's rule, the ladder without a leaver, saved keys
  against new defaults; e2e: the guest's ring damage, the TDM bots' guns, the throw without a shot, the tour's
  grenade with the real key after the heal).
- README, the deploy and server guides, NEXT_STEPS, GAP_ANALYSIS and FIDELITY brought up to date; the results
  document; the Pages build deployed and checked live.

## Milestone 25 — JOLT: two charges, 4 s each, and a dash that feels fast ✅
2026-09-15 (Phase 12B). `src/game/abilities.ts`, `player.ts`, `hud.ts`, `bots.ts`, `src/config/abilities.json`.
Plan: [`PHASE_12_PLAN_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`](./PHASE_12_PLAN_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md);
research: [`RESEARCH_PHASE_12.md`](./RESEARCH_PHASE_12.md).
- **Two stored dashes** (the owner's numbers): a spent charge comes back 4 s after the one before it, so both
  take 8 s. At least 0.25 s between two dashes, so they cannot merge into one 20 m jump. Every life and every
  round starts with both. Bots follow the same rules.
- **Faster**: still 10 m, now over 0.14 s (was 0.18 s), on an ease-out curve with 70% of the distance in the
  first half, a pop rather than a slide. You leave it at 400 hu/s (10 m/s, the slide cap), which a sprint, slide
  or jump carries on. After one second a dash then a sprint is 9 m ahead of a plain sprint.
- **The feel**: the view widens by 8 degrees at once and settles as the dash hands over, a sideways dash rolls
  the view 2.5 degrees into it, and the pad rumbles.
- **HUD**: a pip per charge under the ability square; the next one fills as it comes back. The notice says when
  the next charge is back only when both are spent.
- Tests: verify (the charges, one at a time, the gap, the refund, a pick filling them), movesim (10 m in
  0.14 s, 70% by half time, leaving at 400 hu/s and at the curve's own end speed, ahead of a sprint), e2e (two
  dashes, the second sideways with the roll and the FOV, the charges on the HUD).

## Milestone 26 — No gun in the hands when down or out ✅
2026-09-15 (Phase 12C). `src/game/dummy.ts`, `mannequin.ts`, `viewmodel.ts`, `main.ts`.
- **Down**: every figure crawls with no gun. The robot's arms go to the floor and reach in turn; the mannequin
  bends its crouched walk into a crawl. Your own figure in third person and the killcam's recording show you
  down too. In first person the gun goes and your hands sit low in the frame, reaching as you crawl.
- **Out**: the figure drops the gun it held. A copy falls from its hands, bounces once and lies on its side
  by the body until the figure is back up. The mannequin plays its motion-captured death (sped up to 1.5 s)
  in place of the toppled rig. Your view shows no gun and no hands (the killcam still shows the killer's).
- **The figure lab** (`window.__range.figureLab`) lines up posed figures for screenshots. `tools/snap.ts` gains
  figures-robot, figures-mannequin and downed-view, which wait on game time rather than wall time.
- Tests: e2e (a knocked bot's gun on the floor and not in its hands; down in a squad: no gun in your view,
  your hands on the floor, no gun on the host's figure of you or on your own in third person; out: the
  host's figure of you is down and empty-handed).

## Milestone 27 — Figures: the rifle at the shoulder, turning on the spot, jumps and landings ✅
2026-09-15 (Phase 12D). `src/game/mannequin.ts`, `dummy.ts`.
- **The mannequin holds a rifle like a rifle, and is now the default figure.** The library's clips are pistol
  clips, so a long gun no longer hangs from the hand at arm's length. It sits on the chest with its stock in
  the right shoulder, and a two-bone IK puts the right hand on its grip and the left on its handguard (each gun's
  own support point). For a sprint or a swap it comes down and cants across the body, the hands with it. Pistols
  keep the clip's two-hand grip, with the left hand on the frame. The robots stay as the setting's other choice
  (lighter to draw) and the stand-in until the files have loaded.
- **Turning on the spot** (both figures): standing still, the feet stay planted while the body turns on its aim,
  then step round, one foot then the other, once it has turned 50 degrees.
- **Jumps and landings**: the robot tucks its knees on the takeoff and squashes on landing, more after a longer
  fall; the mannequin plays its landing clip after a jump from standing.
- **Idle and sprint**: the robot breathes standing still, and sprinting lowers and cants its gun with the arms
  pumping. A shield break staggers the mannequin (its hit clip).
- Tests: verify (the feet planted through a 0.5 rad turn, a step round past 50 degrees, walking keeps them with the
  body), e2e (the mannequin is the default; a mannequin's rifle hangs off its chest with the right hand on the
  grip), snap (figures-hold, figures-hold-close, figures-crouch-close, and the labs with a sprint).

## Milestone 28 — Bot tiers that play differently, with frags, cover and hearing ✅
2026-09-15 (Phase 12E). `src/game/bots.ts`, `src/config/bots.json`, `brmatch.ts`, `modematch.ts`.
- **Four tiers, and mixed**: easy, normal, hard and elite, plus "mixed" (each bot drawn by weight: 20 / 45 / 25
  / 10). Built the way CS2's shipped bot profile and TF2's published bot code grade theirs
  (RESEARCH_PHASE_12 section 4):
  - **Reaction** to a new sighting: 0.6 / 0.4 / 0.2 / 0.12 s.
  - **Aim lag** behind a moving target: 0.35 / 0.2 / 0.09 / 0.045 s, so strafing beats an easy bot and not an
    elite one.
  - **Aim error**: starts wide on a new target and settles while the bot keeps it (14 degrees down to 5 for
    easy; 2.5 down to 0.8 for elite).
  - **Aim point**: from the chest up to the neck.
- **Behaviour by tier**:
  - **Dodging**: easy never; normal half the time; hard and elite reverse their strafe on every hit.
  - **Hearing**: shots within 70 m, heard 20 / 50 / 90 / 100% of the time; a bot that hears one goes to look.
  - **Hunting**: normal and up go to where they last saw you.
  - **Crouching** now and then while firing (hard and up).
  - **Heals**: sooner after a fight by tier.
  - **Elite** comes back round a corner already aimed where it lost you.
- **Frags** (normal and up): a bot throws one at a target that has stood still in its view too long (8 / 5 / 4 s)
  or has been hiding out of sight. It lobs to land where you were, two a life, 14 s apart. The flight is drawn on
  every screen, and the side running the bots works out the blast as it does their bullets: you, your squad and
  rival bots. Gun Run's bots throw none.
- **Cover** (normal and up): hurt below 55%, a bot picks a spot within 9 m, out of your sight, that it can walk
  to in a straight line. It heals there once it is out of sight, then comes back to peek. It gives up on a spot it
  cannot get nearer to.
- The difficulty select gains Elite and Mixed; the Stats tab counts them; the bots' crouch reaches the guests.
- Tests: verify (the tiers' numbers, the error's decay, mixed's weights, the lob landing on its mark), e2e (an elite
  bot hears a shot out of its sight, throws a frag at you standing still and its blast lands, crouches, dodges,
  finds cover out of your sight and heals there; an easy bot does none of it; both e2e batches pass with tiered,
  frag-throwing bots in every mode).

## Milestone 29 — The controller: Apex's Default layout, its presets, taps and holds ✅
2026-09-15 (Phase 12F). `src/game/gamepad.ts`, `src/ui/binds.ts`, `brplay.ts`, `main.ts`.
- **The game's Default layout** (EA's own table, RESEARCH_PHASE_12 section 1):
  - RB pings, and twice quickly pings an enemy there.
  - D-pad up heals: a tap is the quick heal, holding opens the wheel, and the right stick picks.
  - D-pad right readies a grenade, and again the next kind.
  - D-pad left toggles the fire mode; held, it inspects the gun.
  - Y swaps; held, it holsters.
  - Back opens the map; LB is the ability (the game's tactical button).
  - D-pad down is the variable zoom (ours: the game puts a character action there).
- **Taps and holds on one button**: a button with a hold does its tap as it comes up and its hold after 0.3 s
  down, as the game does.
- **Presets** on the Controls tab: Default, Bumper Jumper, Button Puncher, Evolved, Grenadier and Ninja, and
  Range, the Phase 11 layout with the optic, the magazine level and the slots on the D-pad. Every button can
  still be changed one at a time; Start stays the menu.
- **The ability card on the D-pad**: while it is up, left and right pick JOLT or TRIAGE, and do nothing else.
- **The keyboard** gets an Inspect action of its own (no key by default; holding R with a full magazine still
  inspects) and the same double-click enemy ping on the middle button.
- Tests: e2e (in the battle royale, RB twice is an enemy ping, D-pad up a quick heal, D-pad right a grenade; in
  the range, Y's tap swaps on its release and its hold holsters, D-pad left held inspects, a preset puts jump on
  LB and Default puts it back; with the card up, D-pad left picks JOLT and readies nothing).

## Milestone 30 — The battle royale's Season 29 and 30 pieces ✅
2026-09-15 (Phase 12G). `src/main.ts`, `duel.ts`, `brmatch.ts`, `brplay.ts`, `attachments.ts`, `src/config/squad.json`,
`weapon-mechanics.json`, `items.json`.
- **EVO as Season 30 counts it** (RESEARCH_PHASE_12 section 2.3):
  - the damage you deal, as before;
  - 150 a knock, 100 an assist (you hurt them in the last 15 s and someone else knocked them);
  - revives: 100 for the first two, then 25 less each;
  - 100 for looting a care package, once a package.
  - Taking damage earns nothing. That corrects the Phase 11 gap line, and purple is now 1,700 more after blue
    (2,150 in all), not 1,700 in all.
- **Knockdown shields tied to your EVO level**, as since Season 28: 200, 450 or 750. Hold fire while down to raise
  it. It takes what comes from within 70 degrees of where you face, and you crawl 45% slower behind it; broken, it
  stays broken for that knock. Your view shows the pane and a bar under DOWN, and the others see it on your figure.
- **Deathbox Respawn** (Season 29 on): at a dead squad mate's death box, a tap takes their banner as before, and a
  7 s hold of interact brings them back on the box. They return at 20 health, their shield comes back over 6 s,
  and they get whatever is left in the box. A green beam and a rising hum mark it for everyone, and the bots come
  to see (it is heard twice as far as a shot). Each death adds a lockout before the next such respawn: 30, 60,
  then 120 s (ours; Apex has not published its values), reset after 3 minutes alive.
- **Seasons 29 and 30's hop-ups**, as effects rather than weapon-data mods:
  - **Executioner** (Peacekeeper, Mastiff): a knock with the gun brings 50 shield back over 5 s.
  - **Shattercaps** (30-30): hip fire is a blast of 7 pellets of 8, heads x1.25.
  - **Redline** (L-STAR): +15% damage above 75% heat (ours; Apex has published no numbers).
  - In a battle royale a floor gun comes with its hop-up **locked**, and it unlocks after 275 points of damage
    with that gun; the HUD shows the progress. A dropped gun keeps its progress, and a care-package gun comes
    unlocked. In the range they are on the hop-up key like any other.
- Tests: verify (the EVO levels, sources and revive steps, the knockdown shield's sizes and crawl, the respawn's
  numbers and lockouts, each hop-up's guns and numbers, hop-ups out of the mod chain), e2e (a knock earns 150 over
  its damage, a care package 100 once; Executioner brings shield back after a knock; a Peacekeeper off the floor
  comes locked and unlocks with damage; the 30-30 with Shattercaps fires 7 pellets from the hip; down, held fire
  raises the knockdown shield, the host sees it, a shot from in front goes into it and one from behind does not;
  the host holds at the guest's box, the beam shows on the guest's screen, and the guest is back on the box at 20
  health with the shield coming back).

## Milestone 31 — Control against bots ✅
2026-09-15 (Phase 12H). `src/game/modes.ts` (Control), `modematch.ts`, `hud.ts`, `src/config/modes.json` control.
- **Apex's Control, scaled to the arena** (RESEARCH_PHASE_12 section 3): five a side, you (and friends) with bots
  against bots, over zones A, B and C (A on your side in the left lane, B in the middle, C on theirs in the right
  lane). A point a second for each zone your team holds; first to 500 or the most after 10 minutes (Apex: 9 v 9,
  1,000, 30 minutes).
- **Capture**: Apex's speed by the number on a zone (1, 1.5, 2, 2.25, 2.5, 2.75, 3 times) over our 8 s from neutral.
  An enemy zone is cleared to neutral first, then captured, and a zone with both teams on it holds.
- **The bonus zone** (a gold pole; whoever holds it when its minute is up takes 150), **the lockout** (all three
  held starts 30 s; unbroken, it wins the match), and **spawns on zones linked to your base**: you come back 5 s
  after going down on the most forward zone your team holds in a line from its base, never the one beside the
  enemy's base.
- **Bots play the zones**: they go for a zone of theirs under attack first, then the nearest one not theirs,
  spread over the three, and fight whoever they meet.
- **In the world**: a ring on each zone's floor in the holder's colour, a fill that grows with the capture, and a
  pole of light (gold for the bonus). **On the HUD**: the scores, A B C in their colours with the capture filling,
  a mark on the zone you stand on, the bonus and the lockout's clocks, and each zone's letter over it in the
  world. It is on the Play tab, and in the friends' mode list (the host runs it, the guests are sent its state).
- Tests: verify (8 s to take a neutral zone alone, a point a second held, two of the other team clear it then take
  it, contested holds, the spawn chain, the lockout's win, the bonus's 150, the limit), e2e (five a side, zones A B
  C, standing on A takes it and it scores, down you come back on A), snap (control).

## Milestone 32 — Optional accounts, on the game's own server ✅
2026-09-15 (Phase 12I). `server/game/serve.mjs` (/api/account), `src/net/account.ts`, `src/ui/account.ts`.
- **No third-party provider**: accounts live on our own server, next to the boards. A name (the boards' rules,
  unique whatever its case) and a password of 8 to 128 characters, kept only as an scrypt hash with its own
  salt; signing up or in gives a random 30-day session. Wrong names and wrong passwords get the same answer in
  the same time, sign-ups and sign-ins are rate limited, and the file lives outside each release on the box, so
  a deploy keeps it.
- **What syncs**: the game's saved data in this browser (settings, keys and the controller's buttons,
  loadouts, stats and records, the setting choices), all but the session and the graphics quality. Signing in
  to an account with a profile puts it on and reloads; a new account takes this browser's. New stats go up
  after each match and course run, and "Sync now" sends them at once.
- **On the Stats tab**, by your name: sign up, sign in, sync, sign out. Signed in, your name is the account's.
  Nobody needs an account to play. On GitHub Pages there is no server, and the tab says so.
- The boards also take Control and the new bot tiers.
- Tests: the dry run (`npm run deploy:server -- dry`) now checks the accounts against the unpacked release. The
  API: sign up, the same name in another case refused, a short password and markup refused, a wrong password and
  an unknown name alike refused, sign-in, the profile saved and read back, no token no profile, sign-out kills
  the token, guessing rate limited. Through the page: sign up on the Stats tab, sync a setting, and a second,
  clean browser signs in and has the same setting and name. e2e: without the server the tab says so.

## Milestone 33 — Smaller downloads: the textures as WebP ✅
2026-09-15 (Phase 12J). `tools/compress-assets.ts` (`npm run compress`), `src/game/materials.ts`.
- The range's surfaces and the props' maps came from ambientCG and Poly Haven as high-quality JPEGs of about
  800 KB each. They are re-encoded as WebP, the normal maps at a higher quality because their errors show in
  the lighting first. The 49 textures went from **30.5 MB to 5.8 MB**, with no visible change.
- `npm run assets` and `npm run models` compress what they fetch, and each prop's .gltf is pointed at its new
  maps. The game loads `.webp` and falls back to `.jpg`, so a checkout that has not compressed still works.
- KTX2 (GPU-compressed textures) would also cut video memory, but it needs a native encoder we do not have; it
  stays on the list. The props' geometry (.bin, about 11 MB, the fence alone 3 MB) is untouched.
- Tests: e2e (the page's surfaces and props load 34 WebP maps, no JPEG and nothing missing), snap (the range
  textured as before).

## Milestone 34 — Recorded sounds layered over the synthesis ✅
2026-09-15 (Phase 12K). `tools/fetch-sounds.ts` (`npm run sounds`), `src/game/audio.ts`, `public/audio/ATTRIBUTION.md`.
- **Kenney's CC0 packs** (Impact Sounds, Sci-Fi Sounds, Interface Sounds): 40 takes of 13 sounds, 436 KB, fetched
  into `public/audio/kenney` and credited. Each is layered under the game's own synthesis where a recording carries
  what oscillators cannot, with every take picked at random and its pitch varied a little:
  - footsteps on concrete and grass (metal is the concrete step pitched up under its ring), and landings;
  - a body hitting the floor where a figure is knocked, and a dropped gun clattering;
  - the punch of a melee that lands, the magazine out and in and the bolt, and the crunch under a frag's boom;
  - the menu's clicks.
- The guns stay synthesised, each by its class. Without the files (a checkout that has not run `npm run sounds`)
  every sound is the synthesis alone, as before.
- Tests: e2e (in a bot fight the samples are loaded and layered into what is heard).

## Milestone 35 — The phoenix kit's codename ✅
2026-09-15 (Phase 12L). `src/config/names.ts`, `items.json`, `tools/beta-check.ts`.
- The owner's Phase 11 question, decided here: of the heals, only the phoenix kit carries the game's own name, so
  the public build calls it the **Nova kit** (NOVA on the kit line); the others are plain words and stay. The name
  lives in `names.ts` behind the build flag, so the real one is not in the public bundle at all.
- `beta-check` now also bans Phoenix and the three new hop-ups' names (Executioner, Shattercaps, Redline, codenamed
  "knock recharge", "split rounds" and "hot bolts" on a public build).
