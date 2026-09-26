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

## Milestone 36 — Phase 12 closed: the bug hunt, a new gap analysis, the docs, the deploy ✅
2026-09-15 (Phase 12M). `docs/PHASE_12_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`.
- **Two independent reviews**, 29 findings, and 3 more from the e2e runs: 32 in all, each checked against the code.
  All are fixed, apart from one that was intended (the care package's EVO goes to each looter). The worst were:
  - a request that crashed the game server (a name like "constructor");
  - a second browser's sign-in wiping the account's stats;
  - a Deathbox Respawn of the host losing the box and duplicating guns;
  - the faster JOLT passing through 1 m walls at 60 fps;
  - guests in Control always spawning at base;
  - the killcam showing fists;
  - course enemies losing their guns;
  - bots wedging in a pocket between crates.
- Regression checks for the worst: movesim (a 1 m wall at 60 and 30 fps), the dry run (signing in as "constructor",
  the server still up), e2e (the killer's gun in the killcam; the box's things on after a Deathbox Respawn and the
  shield coming back from nothing).
- **A new gap analysis** against Apex (Season 30) and **Hyper Scape**, and a new ranked NEXT_STEPS; README, the
  deploy and server guides, and FIDELITY brought up to date; the results document; the Pages build deployed and
  checked live.

## Milestone 37 — The README in the range, paged by shooting it ✅
2026-09-15 (Phase 13). `src/game/readme.ts`, `readmetv.ts`, `src/config/readme-tv.json`, `projectile.ts`, `main.ts`.
- A **16 m × 6.5 m screen on the far backstop**, 107 m down the range, under a lit **B00G'S RANGE** sign: this
  repository's README, in 22 sections, paginated to fit, with the list of sections down its left side and the
  section and page number in its header.
- It is **the README itself**, not a copy: `README.md?raw` is bundled with the build, parsed into blocks
  (headings, paragraphs, lists, fenced code, tables, bold, code, links) and laid out by measuring the text, so it
  paginates itself and follows every later edit to the file.
- **Shot to page.** Four plates beside it: ◀ ▶ a page, ▲ ▼ a section, wrapping at both ends. The list of sections
  is shootable too, so a round on a name opens it. Every gun, every pellet, an arrow and a melee punch work,
  through a new `Shootable` in the projectile system (`addShootable`), gathered with the dummies and the targets.
  A hit gives a hit marker and a click and does no damage; a round anywhere else on the screen is an ordinary
  miss, so stray fire down range never moves the page.
- Tests: six e2e checks in the `range` section (the screen is the README, ▶ pages, ▼ and ▲ move a section each
  way, a round on the page changes nothing, a punch on a name opens that section) and two snap scenarios.

## Milestone 38 — "Not R-301": the public build's gun names ✅
2026-09-15 (Phase 13). `src/config/names.ts`, `tools/public-text.ts`, `tools/beta-check.ts`, `weapons.ts`.
- The owner's call, replacing the class names ("Carbine A", "SMG A") that had been the public build's since the
  first beta: a gun is now **"Not" its real name** — Not R-301, Not Kraber, Not Peacekeeper — which reads as what
  it is, a replica built from published numbers. Optics, hop-ups and the one branded heal keep their generic
  labels, and the course pistol keeps a made-up name (its real one is a firearm brand, not a game's weapon).
- That puts a real name on a public screen on purpose, so the guard was narrowed rather than dropped:
  `tools/beta-check.ts` now allows a real name **only** directly after "Not ", and a bare one anywhere in `dist/`
  still fails the build. It also matches a name across a line break, which caught "the Charge\nRifle" in the
  README's own prose.
- The README on the range's screen is renamed the same way on the public build (`tools/public-text.ts`), so the
  manual and the HUD agree.

## Milestone 39 — Esc on the menu is Resume ✅
2026-09-16 (Phase 14). `src/main.ts`, `index.html`.
- The game's own menus close on Esc; ours needed a click on Resume. Esc on the menu now takes the button's path
  (read the settings, take the mouse back). Not while a key is being rebound (that capture eats Esc first), and
  Esc in a text field leaves the field instead. Chrome refuses a pointer lock for about a second after the Esc that
  let the mouse go, which is exactly when this is pressed, so a refused one is retried quietly once the second is
  up, unless the menu was clicked in the meantime. The hint under the button says so.
- Tests: e2e (taken as Resume on the menu; only leaves a text field; nothing with the menu closed).

## Milestone 40 — The shotguns fire the game's blast patterns ✅
2026-09-16 (Phase 14). `src/game/blast.ts`, `weapons.ts`, `main.ts`, `hud.ts`, `src/config/weapon-mechanics.json`.
- **The bug:** the Mastiff read as one 19-damage pellet. Its spread stat is 0 in the data (the game sizes shotgun
  spread by a blast pattern, not by the stat), so all five pellets flew one line and the HUD stacked five 19s on
  one spot. The damage landed (95 on a dummy) but it looked and felt like a single pellet, and against a moving
  target the whole blast hit or missed together.
- **The fix:** each shotgun fires its pattern — the Mastiff's horizontal line of five, the EVA-8's figure 8, the
  Peacekeeper's star of nine, the Mozambique's triangle, the Triple Take's three in a row — sized by the data's own
  `blast_pattern_default_scale`, tightened to `blast_pattern_ads_scale` when aimed where the gun has one (the
  Mastiff and Mozambique halve), closed by the choke, at `blast_pattern_zero_distance`. The shapes and their unit
  are ours (FIDELITY). The spread stat now deviates the whole blast once a pull, so the shape holds.
- A pull's pellets are summed into one damage number on the HUD, as the game shows them: 95, not five 19s.
- Tests: verify (a place per pellet for every shotgun, none for a rifle or the Shattercaps blast, the Mastiff's
  line 5.9 degrees and half that aimed, the Peacekeeper's star closing to 0.45, the line horizontal and
  symmetric); e2e (a Mastiff pull at 4 m is 5 pellets, 5 hits, 95 dealt, one number). A spray-wall screenshot
  was tried and dropped: the snap harness's fake trigger does not fire there, so it showed an empty wall.

## Milestone 41 — An enemy's plate only after a hit, and only in sight ✅
2026-09-16 (Phase 14). `src/main.ts`, `src/game/hud.ts`, `src/config/hud.json`.
- Names and bars over enemies showed through walls, which gave their positions away. Now an enemy's plate shows
  only after you have hurt them (6 s from the last hit) and only while your eye has a clear line to their chest,
  through the same `solidHit` the bullets use, which covers the range, both arenas and the battle royale map. A
  team mate's green plate always shows. The numbers (and the old 40 and 60 m fade) are in `hud.json`.
- Tests: e2e (no plate before a hit; once hurt, the plate shows exactly when the line is clear; the line-of-sight
  test is open down the range and blocked through the backstop).

## Milestone 42 — Free-for-all ✅
2026-09-16 (Phase 14). `src/game/modes.ts`, `modematch.ts`, `hud.ts`, `src/config/modes.json`, `index.html`, `src/ui/menu.ts`.
- Team deathmatch's sibling with no sides: everyone for themselves in the arena, you and up to five bots (the
  Play tab's bot count; with friends, everyone who joins plus the bots). Respawns 4 s after going down, at the
  spot farthest from any enemy (the modes' own `pickSpawn`); **first to 20 kills, or the most at 10 minutes**,
  the fewest deaths on a tie, level on both a draw (`killLeader`, tested in Node). The board is kills and deaths,
  the panel you against the best of the others; the win is yours alone ("YOU WIN"), never a team's.
- Most of it came free from the arena modes' shared rules: with `teamMode` false, nobody is friendly, every other
  fighter is a target, and the respawn already avoided enemies. What was added is the kind, its config, the kill
  limit and clock branches, the summary, the HUD block, the menu button and select option, the Stats card and
  the online board (Control's board, which was missing from the list, is added too).
- Tests: verify (a mode kind and not a team mode; the config; `killLeader` with a leader, a tie on kills, a
  draw, one fighter, nobody); e2e (three bots and no allies, 0 - 0 first to 20, no team score; a kill is yours
  alone and tops the board; a bot's kill on another bot is that bot's own; the 20th kill wins it for you alone).

## Milestone 43 — The mannequin's upper body no longer spins ✅
2026-09-16 (Phase 14). `src/game/mannequin.ts`.
- **The bug:** bots' and players' mannequins whipped their torso, head and arms round in endless loops while the
  legs stayed sane. Measured in world space: the pelvis held its yaw; the chest and head swung the full circle
  every few frames, and the hands went with them.
- **The cause:** three's `AnimationMixer` writes a bone only when the clip's value has changed since the last frame
  (`PropertyMixer.apply`: "value has changed -> update scene graph"). The legs play loops, so their bones are
  rewritten every frame. The upper body plays a held aim pose, so after the first frame the mixer never wrote
  `spine_01..03` or the head again, and every frame's `turnBone` (the leg counter-turn, the look pitch, the
  head's ADS tilt, a flinch) piled onto the last frame's. A steep look pitch spun the chest end over end within a
  second; a strafe whipped it by the leg turn every frame. The robot figure sets its rotations absolutely and
  never had it. The fix was found by forcing the pose: still with a 40-degree pitch, the chest turned 280 degrees
  in 1.5 s; with the fix, none.
- **The fix:** the clip's own rotation of each edited bone is put back before the mixer runs and taken again after
  it, so the edits start from the pure clip pose every frame (and the death clip starts clean).
- Tests: e2e (a still mannequin bot with a steep look: over 1.2 s the chest, head and pelvis hold their yaw
  within 15 degrees).

## Milestone 44 — Clipping a wall stops costing you your speed ✅
2026-09-16 (Phase 15). `src/game/player.ts`, `tools/movesim.ts`.
- Measured first: sprinting along a wall met at 45 degrees left **0.31 m/s of 6.54**, at 20 degrees 1.80, at 10
  degrees 3.24. The collision was not at fault. `groundMove` splits velocity into "along the wish" and
  "perpendicular" and brakes the perpendicular at the turn rate; once a wall has taken the into-wall axis, the
  speed you have left IS the perpendicular part, so the movement model was braking the only direction you could go.
- The wish is now clipped to the wall plane and renormalised, as every Source-family engine does it: **255 to 257
  hu/s at every angle** against 257 in the open. Straight into a wall still stops you. Ground only — in the air,
  pressing into a wall is how a climb and a wallbounce are asked for.
- Tests: six movesim checks (5, 10, 20 and 45 degrees against the open, and head-on still stopping).

## Milestone 45 — The practice aim bot, and it cannot be hidden ✅
2026-09-16 (Phase 15). `src/game/aimbot.ts`, `src/config/aimbot.json`, `hud.ts`, `duel.ts`, `net/link.ts`.
- Settings, off by default: the view sweeps onto the nearest enemy chest in sight, capped by a turn rate, using
  the torso hitbox and `solidHit`, so it takes nothing it cannot see.
- The owner's call: it works in a match with friends too. The price is that it is never secret — whoever has it on
  wears a **red bar and the word AIM BOT** over them on every other screen, at any range, through walls, carried
  on the state packet.
- Also: the dash is configurable (distance, time, charges, recharge) and the ability card rewrites its own blurb;
  the fire button swings when the gun is holstered on 3; enemy plates are cut to 30 m.

## Milestone 46 — A buddy plus bots in every mode, lobbies to eight ✅
2026-09-16 (Phase 15). `duel.ts`, `modematch.ts`, `arena.ts`, `index.html`, `main.ts`.
- The report was that a buddy could not join a TDM or FFA with bots. A probe of the exact path showed the code was
  fine in tdm, ffa, control and crown — the way in was the problem: every mode with friends sat behind a tab
  labelled "1v1", and the Play tab's buttons start offline with no code to share. The tab is **Friends** now.
- The cap went from three humans to **eight** (`MAX_PLAYERS`), the warehouse got eight spawns, and a spawn past the
  end of the list steps round and pushes out rather than stacking players in one cubic metre.
- The bot count you pick is the side you **face** in every mode, including team modes that used to ignore it; your
  side fills to match. Plus a **Bot guns** picker, carried to guests.

## Milestone 47 — Land and live ✅
2026-09-16 (Phase 15). `brmatch.ts`, `src/config/squad.json`.
- "I died right away from people spawning near me... then i land and die." The bots were dealt round every place
  including the squad's, so two or three landed on top of you while you had nothing. They take the other places
  now; the nearest bot at landing went from on top of you to **150 to 190 m away**. They also spread in 18 m rings
  round a drop point, and no gun works for 4 s after its owner lands.

## Milestone 48 — The weapon inspect stops shoving a forearm into the camera ✅
2026-09-16 (Phase 15). `src/game/viewmodel.ts`.
- Reproduced with a screenshot: the flat end cap of the forearm cylinder sat dead centre of the frame as a dark
  disc. An elbow is a point in GUN space, so turning the gun 60 degrees swung the elbow round to face the eye.
- While the gun is being turned in the hands (an inspect, a first draw's flourish) the elbows are pinned in VIEW
  space through the inverse of the gun's own pose, so the forearms keep running off the bottom of the frame. At
  rest, aimed and reloading nothing changes.

## Milestone 49 — Outskirts has buildings you can fight inside, and four more places ✅
2026-09-16 (Phase 15). `src/game/brpoi.ts`, `br.ts`, `src/config/loot.json`.
- Every POI was solid boxes: `box(12, 5, 10, ...)` is a building you can only stand ON, so every fight was outdoors
  on open sand. `brpoi.ts`'s `building()` makes shells instead — wall runs with doorway and window gaps, a floor
  per storey with a hole for the stairs, stairs whose steps clear the 0.56 m the movement walks, roofs with
  parapets, balconies — plus `crateStair`, `jumpTower` and `coverWall`.
- WEST TOWN is six houses on a street; THE HUB four two-storey buildings round the tower; NORTH YARD a warehouse;
  SOUTH DEPOT three sheds and an office; EAST RIDGE a room under the bunker.
- **Four new compounds** fill the empty diagonals (NORTHWEST FARM, NORTHEAST STORE, SOUTHWEST PENS, SOUTHEAST
  WORKS): three buildings each, a wall open toward the middle, and a watch tower with a zipline pointing at the
  nearest big place. Nine POIs now, so the bots spread wider and the ring can end somewhere worth fighting in.
- Loot follows the rooms: 30 spots a place instead of 16, 2 to 4 items a spot instead of 1 to 3, the open field cut
  from 26 spots to 20, and weapons weighted up from 22 to 30 of the kind roll.

## Milestone 50 — Bots can reach every node on Outskirts, and a test that says so ✅
2026-09-16 (Phase 15). `src/game/br.ts`, `tools/e2e.ts`.
- Three of the nineteen graph nodes stood inside solid boxes: the hub's node was the tower's own base, the ridge's
  foot node was inside its first 2 m step, and its top node was in the bunker wall. A bot that picked one walked
  until it touched the box and then ground against it for the rest of the match, because the arrival test is 3 m
  and the box held it 4.4 m out.
- The ridge's ramp climbed 0.5 m a step, which a bot can take, and then **stopped five metres short of the top in
  open air**. A bot walked the whole ramp, dropped back to the shelf at 6 m, and could not climb the last 2 m, so
  nothing but the zipline ever put anyone in the bunker. A landing joins the ramp's head to the top step now.
- Three drop spots were half a metre inside walls, two at West Town and one at the Northeast Store.
- The guard floods the whole map on a half-metre grid using the bot's own rules from `bots.ts` (0.41 m radius,
  0.56 m step, 1.83 m standing room) and fails on any node, link or drop the flood does not reach. It reaches
  **779,941 cells**, which is the map. `verify.ts` cannot do this one: building the map wants a DOM for its
  textures, so it lives in the browser half of the suite.

## Milestone 51 — More free assets: materials, skies, rocks, doors and the fonts come home ✅
2026-09-16 (Phase 15). `tools/fetch-assets.ts`, `fetch-models.ts`, `fetch-sounds.ts`, `fetch-fonts.ts`,
`fetch-icons.ts`, `src/game/materials.ts`, `index.html`.
- **Ten material sets** (ambientCG, CC0): sand, rock, gravel, corrugated steel, rust, plaster, brick, roof tile,
  planks and steel, so each place on Outskirts can stop being the same grey. Lazy: a set nothing uses costs no
  bandwidth, and each falls back to the flat colour the map already used.
- **Six more skies** (Poly Haven, CC0) and **nine models**: six rock scans and three dead trees.
  `sand_rocks_small_01` was fetched and dropped again, because its geometry alone is a 21 MB `.bin`.
- **Seventeen more sounds** (Kenney, CC0): a door opening, closing and kicked, a bin lid, a pickup, a beacon, the
  drop's horn, a ping, a zipline.
- **Forty-five icons**: Lucide (ISC) for the interface, game-icons.net (CC BY 3.0, so credited by name) for ammo,
  magazines, grenades, armour and a parachute.
- **The fonts stopped being a third-party request.** Rajdhani came from fonts.googleapis.com on every load, which
  held the menu on a slow connection, failed offline, and reflowed the HUD mid-fight when it landed late. Now
  self-hosted with Barlow Condensed beside it: latin only, five weights, 110 KB, SIL OFL with the licence text.

## Milestone 52 — Seven hours of the day ✅
2026-09-16 (Phase 15). `src/config/sky.json`, `src/game/sky.ts`, `range.ts`, `materials.ts`, `main.ts`.
- One sky meant every match was the same hour of the same day. Morning, hard noon, afternoon, golden hour,
  overcast, dusk and moonlight, each with its own dome palette, sun, light colour, environment intensity and fog.
- Changing hour writes four colours into one shader, moves one light and reloads the environment map, so it costs
  a frame and needs no reload. It sits under Graphics and is kept like the graphics preset.
- The afternoon is the range's old look to the digit, and a check fails if that drifts. The sun **disk** and the
  **light** turned out to be two different colours (fff0d0 and fff2dc) and conflating them quietly relit the range.

## Milestone 53 — Three new arenas and a map picker ✅
2026-09-16 (Phase 15). `src/game/arenas/`, `arena.ts`, `duel.ts`, `modematch.ts`, `modes.ts`, `main.ts`, `index.html`.
- "More maps small for 1v1s and FFA modes." One map for six modes was why every mode played the same.
- **The Vault** (26 by 30, two storeys round a hole, two ropes) for 1v1, free-for-all and Gun Run. **The Crossing**
  (56 by 68, symmetric high ground) for team deathmatch, Control and Crown. **The Ringworks** (44 by 44, open sky)
  for free-for-all, Gun Run and Crown.
- Drawn from plans so a check walks them in node: spawns clear, no spawn-to-spawn shot, a bot route between every
  pair of spawns, a bot staircase to every raised floor, zones on a bot route, no pocket to be shut in. 34 checks.
- A Map picker in the modes row; the warehouse stays the default. A friends' match carries the host's pick in the
  welcome. The mode rules moved from warehouse offsets to a per-map layout, and the player is clamped to the chosen
  map's walls.

## Milestone 54 — The bots on Outskirts see and loot, and the looting you do works ✅
2026-09-16 to 18 (Phase 15). `brmatch.ts`, `bots.ts`, `brplay.ts`, `kit.ts`, `loot.ts`, `main.ts`.
- Battle royale bots see 60 to 170 m by tier instead of the arena's 60, and loot their own gun, armour, heals and
  grenades off the floor. A probe found two bugs the wiring exposed: bots chasing loot on the floor above, and bots
  landing inside the ridge's rock. Both fixed.
- The walk-over pickup had never run in a real match (its carry hook was never set). It runs, and keeps out of death
  boxes, because a squad mate respawning the owner swept up the owner's things.
- Taking a gun with both slots full swapped back and forth every frame of a held press; fixed.
- Backpacks and knockdown shields are floor loot; a gold shield's self-revive works.

## Milestone 55 — Who is shooting me ✅
2026-09-18 (Phase 15). `hud.ts`, `main.ts`, `src/config/hud.json`.
- A red arc round the crosshair points at whoever hit you, anchored to where they stood so it keeps pointing at them
  as you turn, and drawn apart from the crosshair so it still shows while you aim.

## Milestone 56 — Crosshair, accessibility, and spawning facing open floor ✅
2026-09-18 (Phase 15). `reticle.ts`, `palette.ts`, `hud.ts`, `main.ts`, `index.html`, `src/config/modes.json`.
- Crosshair customisation: five styles, six colours, size, thickness, gap, dot, outline, spread, opacity. The default
  is the old crosshair exactly.
- Colour vision modes and a HUD scale. A check runs the enemy and ally pair through a deuteranopia simulation.
- The new arenas put cover on the line between opposite spawns, so you spawned staring at a box. A spawn now turns to
  the nearest heading with 8 m of open view.

## Milestone 57 — Progression, the match summary, and quick chat ✅
2026-09-18 (Phase 15). `progress.ts`, `hud.ts`, `main.ts`, `src/ui/menu.ts`, `src/config/progress.json`.
- XP from every match and course run, an account level (about five matches for the first, seven hundred for level
  50), and three rolling challenges from a pool of ten. The Stats tab opens on a level card.
- A summary card when a match ends: the result, your numbers, the XP and the level bar filling.
- Quick chat: Enter, then 1 to 6, says a line to everyone in the match. It travels as a number over the relayed
  effect message, so nobody's typed text reaches anyone else's screen.

## Milestone 58 — The battle royale's rules: squads, the drop's theatre, the loadout crate, Storm Surge ✅
2026-09-18 (Phase 15). `brmatch.ts`, `hud.ts`, `main.ts`, `src/config/br.json`, `index.html`, `src/ui/menu.ts`.
- Solo, duos and trios, with bot counts that make whole bot squads, placement counted in squads, a solo knock an
  elimination, and a duo's bleed-out half a trio's. The host's size travels to guests in the welcome.
- The care package is called before it appears, falls under a canopy with a smoke trail, lands with a thump and
  stays lit for a contest window; bots within 90 m go for it.
- A loadout crate in two late rings hands each player their own saved loadout, kitted, once each.
- Storm Surge: late, with too many alive, whoever has dealt no damage recently takes escalating damage.
- Reviewed on its own branch before merging; twenty problems fixed there, among them a surge that never reached a
  guest and a squad count that was always zero on one.

## Milestone 59 — Bots look before they throw, and grenades fly the same everywhere ✅
2026-09-18 (Phase 15). `bots.ts`, `throwables.ts`, `src/config/bots.json`, `src/config/throwables.json`.
- A bot traces its lob against the world and throws only an arc that comes down near its target, trying steeper
  ones over a wall and keeping the frag when the target is shut in a room.
- A throw's flight is cut into slices no longer than 1/120 s, so the same frag goes off within 5 cm at 10 fps as at
  60 fps (46 cm before).
- The online board posts a result under your account's name when you are signed in, and refuses an account's name
  from anyone who is not.

## Milestone 60 — The skydive has two states: look down to dive, look level to glide ✅
2026-09-18 (Phase 15). `player.ts`, `hud.ts`, `main.ts`, `bots.ts`, `src/config/squad.json`.
- Where you look is the trade between falling and travelling: level glides at 12 m/s down and 14 across, about
  105 m from the drop's 90; straight down dives at 30 down and 5 across, on the ground in 3 s. It blends between.
- The drop starts looking 35 degrees down, which falls at about the old single speed, so nobody's drop changes
  unless they look.
- The drop's full map steps aside after 2.5 s so you can see the ground you are steering onto (M brings it back),
  and a guest who lands before the host no longer stares at it until the host does. A readout says which state you
  are in and how high you are, and the hands are put away for the fall.
- The drop's numbers moved from literals in `player.ts` and `bots.ts` into `squad.json` `dive`; movesim checks the
  four speeds, e2e checks them in the page, and `npm run snap` has a picture of the readout.

## Milestone 61 — The dropship, the jumpmaster, and bots that drop again ✅
2026-09-18 (Phase 15). `dropship.ts` (new), `brmatch.ts`, `bots.ts`, `player.ts`, `main.ts`, `hud.ts`, `soundscape.ts`,
`src/config/squad.json`.
- The battle royale starts on a ship flying a straight line across the map at 140 m and 26 m/s. The line passes
  within 30 m of the squad's place and comes in from the far side, so the place is ahead of you; it is at least
  320 m long, so a place in a corner does not get a line that clips the corner. Every browser works it out from
  the match seed, so nothing about the ship goes over the wire.
- Aboard: a chase camera behind the ship, the map up with the line on it (flown faint, to come bright), the doors
  shut for the first 2 s. Space jumps once they open; the far edge puts out whoever is still aboard. No weapons,
  no hands, the engines under the wind.
- In a squad the host is the jumpmaster. A linked squad mate jumps when the host jumps and is held in formation
  behind them until C breaks off or the jumpmaster is 25 m off the ground; Space on the ship jumps alone.
- The bots ride it out of sight (a guest draws nobody until the host sends a bot's first packet off the ship),
  leave as it passes their places, a squad together, and glide down onto them flying the player's numbers. They had
  not dropped at all since the squad match came in: they started on the ground.
- Checks: `tools/checks/dropship.ts` (the line over ten thousand seeded matches, the flight's clock, the glide with
  and without a wall), the e2e `ship` section (the ride, the refused and taken jump, the bots landing on their
  places, the end of the line, the jumpmaster and the break), and three `npm run snap` pictures.

## Milestone 62 — Delta state packets: a fraction of the host's upload, and an old build still plays ✅
2026-09-18 (Phase 15). `src/net/state.ts`, `statesync.ts`, `wire.ts`, `link.ts`, `duel.ts`, `src/config/net.json`.
- Between two browsers of this build a player's state goes as its difference from a state the other end has
  acknowledged: position in centimetres, look in tenths of a degree, health in whole points (a sliver stays above
  zero), a mask naming any field that has gone, and a whole keyframe every two seconds or when a peer asks. A player
  standing still sends nothing but the keyframe. Nothing is ever sent as null.
- Everything one frame tells a peer (your state, the host's bots) goes in one packet, because every packet carries
  about 90 bytes of SCTP, DTLS, UDP and IP, which is more than the differences inside it.
- Measured over the real peer to peer path with `tools/net-cost.ts`, the host's upload to a guest: a 1v1 from 8.1 to
  5.7 kB/s running and from 8.1 to 1.5 standing still; team deathmatch with eight bots from 31.5 to 11.9; a battle
  royale squad with eleven bots from 34.8 to 7.3 (285 to 60 kbit/s).
- A peer names the version it reads on its own full packet; an older build names nothing and is sent the full
  packets it always had, so old and new play together at the old cost. The e2e `mixed` section plays the previous
  build against this one over the internet both ways round, and as a 1v1v1 whose host relays between the two.
- Wired where every state already passed in `duel.ts`, so the battle royale and the arena modes use it with no
  change of their own. `?deltas=0` turns it off for one browser; `enabled` in `net.json` for a build.
- The version on `wip/phase15-unfinished` was reviewed first and was inert: nothing called it. The review fixed a
  negotiation that could not have worked (the hello never reached the match), a scheduler that would have re-sent
  stale states to old builds and doubled their bot traffic, a restarted stream that froze a figure for good,
  malformed differences taken as no movement, and a sliver of health rounded to zero. The first run over the real
  broker found one more: whichever end switched first stayed the only one sending deltas. Distance bands and a byte
  budget were left out; at today's lobby sizes the budget never bites and the bands would only thin far figures.

## Milestone 63 — Ring Consoles: the circle after next ✅
2026-09-18 (Phase 15). `ringconsole.ts` (new), `ring.ts`, `brmatch.ts`, `brplay.ts`, `hud.ts`, `main.ts`, `src/config/br.json`.
- The ring works out its whole chain of circles when it is made, in the order the rounds would have drawn them one at
  a time, so the same random stream closes onto the same circles as before. Its stream now comes from the match seed,
  so a guest draws the same chain; before, only the host knew where the ring was going.
- Four consoles stand by four of the places, on clear ground 7 to 22 m from each middle, chosen from the seed. Hold E
  for 7.5 s at one and the circle after next is on the whole squad's map (full map and minimap), dashed cyan, until
  the ring gets there. The console goes dark until the ring closes, and the scan pays 100 EVO.
- A scan is one effect message naming the console and the circle; nothing else about the consoles goes over the wire.
- Checks: `tools/checks/ring-console.ts` (two hundred rings closing onto their plans, a guest's chain, the placement
  and its way round a building), and the e2e `console` section (the prompt, the hold, the circle shown being the
  chain's, the console spent, the EVO, and a guest's scan on the host's map).

## Milestone 64 — Outskirts has ground, an edge and a landmark ✅
2026-09-18 (Phase 15). `br.ts`, `brpoi.ts`, `src/config/brmap.json` (new), `src/config/loot.json`, `brplay.ts`, `main.ts`.
- Built by the map expansion's first three stages and most of the fourth, designed as six from three competing designs
  and judged; the session limit stopped the rest (the compounds, the micro-POIs, the rotation network, the bot graph).
- The ground has a shape, built of stepped 0.5 m tiers because the collision is boxes and the bots step 0.56 m: a
  bowl of berms round the hub with passes on the roads, the Notch (a 6 m ridge north of the hub with a sheer defile
  and scarp ledges), the Table (an 8 m mesa, sheer on its east face), the Wash (banks and a bed with six box culverts
  you can hide in), and the Knuckles (two mounds to the west).
- The map ends at a 10 m cliff on a five-tier shelf with four gate towers, in place of the 92 posts.
- THE MAST stands at the hub: seven floors to a 28 m roof, a lattice to 40 m, a lamp, and a balloon ridden from the
  roof. East Ridge has a room inside the mesa, a second ramp, a bunker the crates reach and a 31 m chimney stack. West
  Town has roof stairs, a clocktower and a water tower. North Yard's containers are walk-through runs under a catwalk
  the bots can climb to, beside a four-storey silo block and two silos. South Depot's bays are walled rooms, beside a
  three-storey loading building and a portal crane with the depot's name on its girder. Each big place has its own tint.
- Every building's stair climbs to its roof, so a bot stands on a roof for the first time. `slab()` builds the big
  flat pieces unbevelled: the map went from 457k triangles to under 200k while its meshes grew.
- Checked in node by the stages (the bot flood, every rope ridden both ways, the loot counts over five seeds, the
  real player on the cliff) and here by the whole e2e suite and eight new `npm run snap` views of the map. The
  jump tower's prompt now asks for the tower's own floor (the Mast's balloon is on its roof), the hub's loot is
  high, and walking into a place puts its name up.

## Milestone 65 — Resurgence: the dead come back ✅
2026-09-18 (Phase 15). `resurgence.ts` (new), `brmatch.ts`, `bots.ts`, `ring.ts`, `main.ts`, `hud.ts`, `menu.ts`, `link.ts`,
`index.html`, `src/config/br.json`.
- A rules choice beside the squad size; the host's goes in the welcome, so it is everyone's.
- Out, you redeploy from the sky after a wait of 15 s early to 39 s late, and every kill by your side takes 5 s off it
  (a knock 2), never below 3 s. You come down 8 to 30 m from a squad mate who is up, or alone anywhere well inside the
  ring, with a sidearm, two stacks of its ammo and four heals; the killcam gives way.
- The bots come back by the same rules, near a squad mate, and search for their kit again.
- A side all down or dead at the same moment is out. From the fifth ring every death is final; a wait already running
  when it comes still finishes. The ring's waits and closes run at 60% of the battle royale's over the same circles.
- The HUD says how long the dead still come back and, while you are out, your wait.
- Checks: `tools/checks/resurgence.ts` (the waits, who comes back, the cuts and their floor, the faster ring, the clock
  to final deaths) and the e2e `resurgence` section (alone: the wait, the way back and its kit, a bot's way back, the
  final round; as a squad: the host's kill cutting the guest's wait, the guest landing near the host, both down at
  once ending it).
## Milestone 66 — A loading screen, and loot where you can reach it ✅
2026-09-18 (Phase 15). `src/ui/loading.ts` (new), `index.html`, `main.ts`, `loot.ts`, `brmatch.ts`, `src/config/hud.json`,
`src/config/loot.json`, `tools/bench.ts`, `tools/snap.ts`.
- The page opened straight onto the menu with 30 MB of models and 16 MB of textures still arriving. It now opens on a
  loading screen that counts every model and texture in through three.js's default loading manager (every loader in
  the game goes through it), with a tip that turns over, and goes once everything asked for is in and a frame is
  drawn: never under 0.6 s, so it does not flash, and never over 25 s, so a stuck request cannot keep you out.
- snap and bench wait for it, so no picture or measurement catches the world half loaded; the e2e checks it counts the
  world in and goes. `BENCH_SPOT=br` measures from the Mast's roof across the whole battle royale map.
- Loot is laid over each place's whole reach rather than a fixed 34 m, so West Town's clocktower and water tower get
  theirs, and a box's top is a floor for loot only if it is 1 m across both ways: nothing lands on a parapet, a wall
  or a stair tread, where it could be seen and not reached.

## Milestone 67 — The Gulag: a 1v1 for your way back ✅
2026-09-18 (Phase 15). `gulag.ts` (new), `brmatch.ts`, `main.ts`, `hud.ts`, `src/config/br.json`.
- Under the battle royale's own rules, your first death before the fourth ring is not the end: a moment after it you
  are up again in the Vault, one of the arenas, against a bot of your own, the two of you on the same two guns drawn
  for the fight. A 3 s countdown, 40 s to win, then overtime: a flag in the room's middle, won by 4 s alone on it.
- Win and you drop back into the match near a squad mate who is up, with the guns you fought with; lose and you are
  out. One trip a match, and none under Resurgence, which has its own way back.
- The room is yours alone: nobody else sees the fight and the bot is yours, not the host's. The host hears you went
  in and came out, so your squad is not out while you are in it and the match's bots do not hunt you there; the ring
  and Storm Surge cannot reach you in it. A knock in the Gulag is final: nobody can pick you up there.
- A squad mate who brings you back at a beacon or your death box meanwhile is your way back instead: the trip ends.
- The HUD counts you in, down the countdown and the clock, and fills two bars on the flag in overtime; a squad mate's
  trip comes up as a notice.
- Checks: `tools/checks/gulag.ts` (who goes, the two guns, the clock, the flag's stand-off and capture) and the e2e
  `gulag` section (alone: in, the fight, the win and the drop back with the same guns, the second death; a fresh
  match: overtime's flag taken by the bot; a squad mate's trip reaching the host).

## Milestone 68 — Emotes ✅
2026-09-18 (Phase 15). `emotes.ts` (new), `dummy.ts`, `mannequin.ts`, `main.ts`, `hud.ts`, `binds.ts`, `src/config/emotes.json`,
`src/config/binds.json`.
- A wheel on 7, held as the heal wheel on 4 is: move to an emote and let go; a tap plays the last one again. Six:
  wave, cheer, over there, salute, shrug, dance.
- Each is described once, as angles for a generic body eased in and out over 0.4 s, and each rig reads what it can:
  the mannequin turns each arm and bends it at the elbow, the spine, the head and the hips; the armed robot, whose
  arms are one piece with its gun, raises them together and moves its body. The gun goes away for it.
- Your view steps back and comes round in front of you to watch. Moving, jumping, crouching, aiming, firing or being
  hit ends it, and everyone in the match sees it on your figure through one effect message.
- Checks: `tools/checks/emotes.ts` (nothing before or after one, eased with no jump between two frames at 60 fps,
  every one moving the body, none alike; the first blends were 0.25 s and the cheer's arms snapped a quarter of a
  radian in a frame) and the e2e `emote` section (yours, the camera, a step ending it, a 1v1 host's on the guest's
  screen); three `npm run snap` pictures.

## Milestone 69 — A battle royale at its own hour ✅
2026-09-18 (Phase 15). `sky.ts`, `main.ts`, `brmatch.ts`, `index.html`, `src/config/sky.json`.
- Each battle royale draws its hour of the day from the match seed, weighted in `sky.json`: the afternoon most often,
  dusk and moonlight least, because a 165 m sightline in low light is a different game, good now and then and tiring
  every time. Every browser has the seed, so a squad plays under one sky with nothing new on the network, and the
  hash is salted so the loot, the ring and the ship draw exactly what they drew before.
- A setting, Battle royale sky, keeps your own time of day instead; changing it mid-match applies at once. Leaving
  the match puts your own hour back.
- Checks: `tools/checks/sky-hours.ts` (the same seed is the same hour, only weighted hours come up and each as often
  as its weight within 1.5 points over 20,000 seeds, forty seeds in a row see at least five hours), and the e2e `br`
  (the seed's hour, the setting keeping yours, yours back after) and `squad` (host and guest under the same sky)
  sections. `npm run snap` keeps your own hour so two runs compare.

## Milestone 70 — The test tools let go of the mouse, and the benchmark counts the whole frame ✅
2026-09-18 (Phase 15). `input.ts`, `dpi-calibrate.ts`, `main.ts`, `tools/bench.ts`, `tools/e2e.ts`.
- The owner's mouse was held in a small square in a corner of one monitor, and the keys taken, while e2e, snap or
  the benchmark ran: headless Chrome keeps a real, invisible window, and the game's lock took raw pointer lock (the
  OS pins the cursor inside that window) and fullscreen with Keyboard Lock. Under a test tool (`navigator.webdriver`)
  the lock is now pretend: a button's lock counts, one the game asks for by itself is refused as a real browser
  refuses it, and the browser is asked for nothing. The DPI calibration refuses there.
- The draw-call counter was reset by every render call, so with post-processing on it counted one pass. It is now
  reset once a frame, and `__range.frameCost()` gives the whole frame's draw calls and triangles.
- `npm run bench` reports the 99th percentile and triangles, averaged over the run, and `BENCH_SPOT=brmatch` plays a
  real match on seed 42 at the hub through `__range.startBr({ seed, poi })`. The baseline is in
  `docs/PLAN_LOD_DRAW_DISTANCE.md`: the empty map is already 1,238 draw calls and 2.85M triangles on Competitive, so
  the world's merge, not the loot, is the first target.
- Checks: the e2e `page` section (a lock the game asks for itself is refused; a button's counts, and the browser holds
  no pointer lock and no fullscreen).

## Milestone 71 — Outskirts finished: the compounds, eight sites, a rotation network and a bot graph ✅
2026-09-18 (Phase 15). `br.ts`, `brpoi.ts`, `brmatch.ts`, `loot.ts`, `src/config/loot.json`, `tools/e2e.ts`,
`tools/checks/loot-tiers.ts`.
- The rest of the map expansion, stages 4 to 6 and an audit, each stage checked by node copies of the e2e flood,
  the bots' own walk and the zipline rules before the suite ran.
- The four corner compounds each gained a fourth building and an identity: the farm's Dutch barn and wind pump, the
  store's loading shed and stock room, the pens' walled runs, the works' tank yard and flare stack.
- Eight sites between the big places, each 15 to 30 m across: the Notch (guard blocks, a chicane, a crest post in
  the defile), Table Station (a relay house and dish on the mesa), the Crossing (a broken bridge and a pump house on
  the wash), the Well (a walled farmyard and a fuel canopy), Highpoint and the Sump (mesas off two corners, one with
  a crane house, one with four tanks and catwalks between them), Motor Pool (a workshop and truck hulks) and the
  Relay (containers round a 23 m mast). A ground plan of gravel, dirt tracks and the wash's bed reads from the drop.
- The rotation network: thirteen ziplines that land on roofs and decks, not sand (every place out to a site, four
  spokes off the Mast's roof), eight launch pads (four new ones inward), seven balloons and six beacons.
- The bot graph grew from 19 nodes to 113 (188 links): a ring of berm crests round the hub, a shelf round the map's
  edge, the diagonals through the compounds, and every site. A node on a crest or a deck carries its floor, and a
  bot counts as arrived only on it; a bot no longer turns straight back to the node it came from while there is
  another way on.
- Each site carries loot of its own tier (four spots, leaning a little richer than a mid place), laid after
  everything else so the places, the Hot Zone and the field draw what they drew before; the field's loose spots went
  from 20 to 2 to pay for them, and the floor stays inside its density targets (973 items and 244 guns a match).
- Fixed on the way: the north pad's throw came down on a chicane wall, a beacon stood inside the depot office, the
  inward pads stood where the outward throw lands (a step onto one off its middle threw you straight back; they
  stand behind the landing now, at 99, the west one at 101 to clear a roadside wall), and eleven of the old graph's
  twenty-two links were walls a bot's slide could not get round.
- Checks: the e2e nav flood now also fails a node whose declared floor the flood does not stand on;
  `tools/checks/loot-tiers.ts` (every site holds loot, never the Hot Zone, the places' loot unmoved by the sites, a
  site's rarity lean); a throw from fifteen points of every pad lands on sand with no slide into another pad; all
  376 one-way bot links walked twelve times; all thirteen ropes ridden both ways.

## Milestone 72 — The gap pass's bugs: a guest speaks only for itself, the bots' gun, the first ring, death boxes ✅
2026-09-19 (Phase 15). `duel.ts`, `bots.ts`, `brmatch.ts`, `modematch.ts`, `loot.ts`, `projectile.ts`,
`server/game/serve.mjs`, `tools/checks/bot-fire.ts` (new), `tools/checks/boards.ts` (new).
- The first items of the second AAA gap pass (docs/NEXT_STEPS.md), each a bug or close to one.
- A guest speaks only for itself: the host took a message's sender from the message, so a guest could send another
  player's goodbye (and drop them), their down, or a hit dressed as a bot's. The host now takes the sender from the
  link it came in on.
- The free-for-all wins board existed in the game and not on the server, so every win was posted into an error and
  the board never showed a row. The server keeps it, and a check fails if the two lists ever differ again.
- A bot's gun plays by the players' rules: it empties its magazine and reloads for the gun's reload time (it used to
  fire for ever, about two and a half times a player's damage over a fight with an R-99), its rounds take the
  players' damage falloff, and a crouched or sliding target is hit as a crouched body, in the battle royale and the
  modes alike, so crouching behind a waist-high box protects you from a bot as it does from a player. A reloading bot
  shows it: its figure plays the reload.
- The first ring's wait starts once the dropship has flown its line. It was set before there was a ship, and the ride
  and the dive ate 12 to 25 s of it.
- A bot's death box holds what it looted: its gun at the grade it found with its magazine, its fittings and hop-up,
  its frags, and its heals (never fewer than a box always held). It used to be a rare gun whatever the bot had.
- Checks: `tools/checks/bot-fire.ts` (a bot's shots over 20 s against a player's with four guns, the reload, the
  falloff rule, the crouched body, the death box), `tools/checks/boards.ts`, and e2e: a forged goodbye in the 1v1v1
  leaves both guests in, and the ring's clock holds while the ship flies.

## Milestone 73 — Solo with friends is everyone against everyone; a hidden host keeps the match running ✅
2026-09-19 (Phase 15). `brmatch.ts`, `main.ts`, `tools/e2e.ts`.
- In a solo battle royale every human was on one side: friends could not hurt each other, and two left alive both
  "won" once the bots were gone. Solo now treats the other humans as opponents. The host notes where each placed as
  they go out (a trip to the Gulag or a redeploy keeps them in), and the match ends when one side is left, or when no
  human is; each player is sent their own result. Nobody drops a banner in solo, so nobody brings an opponent back.
- A host who alt-tabbed (to paste the invite) ran the whole match at one frame a second: Chrome slows a background
  tab's timers and the loop ran on one. While hidden, a small worker, whose timer is not slowed, ticks the game at
  30 Hz, and nothing is drawn that nobody can see.
- Checks: the e2e `brsolo` section (an opponent, the knock the end, the match going on, first and seventh of seven),
  the squad section's solo pair each placed where they went out, and the `hidden` section (30 frames a second hidden,
  against 2 on the page's own timer).

## Milestone 74 — Feel: muzzle flashes, impacts, kill confirmation, gunfire that carries ✅
2026-09-19 (Phase 15). `muzzle.ts` (new), `impacts.ts` (new), `dummy.ts`, `mannequin.ts`, `projectile.ts`, `audio.ts`,
`hud.ts`, `duel.ts`, `brmatch.ts`, `main.ts`, `src/config/hud.json`, `src/config/audio.json`, `tools/checks/feel.ts` (new).
- Other players' guns flash at the muzzle (a pooled additive sprite for 35 ms, never under 6 px on screen): the
  flash had been taken off every third-person gun and nothing put back.
- Rounds into the level are marked in a match, anyone's: a hole flat on the face hit, dust or sparks, a crack or a
  thud close by. solidHit() records the face it entered through.
- A kill confirms as one: a bigger red marker held longer (orange for a knock), ELIMINATED, a chime that climbs with a
  streak; the feed says "eliminated" for a bot's death or a player out, and a wiped bot squad is called.
- Gunfire carries: one distance curve for every sound had a gun at 100 m 31 dB down; guns now carry 20 m at full
  level, blasts 25, footsteps still 3, and a far shot echoes. Near footsteps are never dropped for the voice cap,
  and your own gun has its own bus and compressor so it no longer pushes the enemy's steps down.
- A spray at one target is one growing number; LOW AMMO and RELOAD under the crosshair with a climbing click.

## Milestone 75 — Feel: tracers, a knock that looks like one, contact shadows ✅
2026-09-19 (Phase 15). `projectile.ts`, `viewmodel.ts`, `dummy.ts`, `mannequin.ts`, `bots.ts`, `duel.ts`, `main.ts`,
`src/config/hud.json`.
- A tracer is a streak along the round's flight, a frame's travel long (up to 6 m) and never under 1.5 px, drawn from
  the gun's muzzle and joined to the real path (which leaves the eye) over the first 8 m: a 4 cm sphere from the eye
  sat on the line of sight and read as dots.
- A knocked figure is low and bent into a crawl (the mannequin about 70 degrees and sunk, the robot on its knees and
  hands), where at 45 degrees it read as a live player crouching.
- On the presets whose shadow map is drawn once, every figure has a soft contact shadow at its feet, so a moving
  figure no longer floats; hidden once it falls.
- Checks: e2e: a tracer in flight is a streak a metre or more long; snapshots `tracers`, `br-downed-3p`.

## Milestone 76 — Blasts you feel, and friends split into sides ✅
2026-09-19 (Phase 15). `impacts.ts`, `audio.ts`, `main.ts`, `modematch.ts`, `net/link.ts`, `index.html`,
`src/config/hud.json`, `tools/checks/feel.ts`.
- A grenade going off is felt: within 20 m the view shakes by up to 1.2 degrees, falling off with the square of the
  distance and dying away in 0.4 s (the screen-shake setting scales it, and Off turns it off); within 6 m the world is
  muffled and your ears ring for up to 1.5 s; a scorch stays on the ground and a column of smoke rises for 3 s. It
  used to be a ball and a ring for half a second.
- Team deathmatch and Control with friends can split them into two sides ("Friends: split sides" in the Modes row):
  the humans alternate sides and bots fill whichever side is short; every human used to be on one side, so a group
  could never fight each other in a team mode. The split travels in the welcome.
- Checks: `tools/checks/feel.ts` (the shake's falloff, the ringing's reach), e2e: a frag leaves its scorch and smoke,
  and two friends split in team deathmatch are opponents whose hits land.

## Milestone 77 — Start with those in, and a ping per friend ✅
2026-09-19 (Phase 15). `duel.ts`, `brmatch.ts`, `net/link.ts`, `main.ts`, `index.html`.
- A host who made a match for eight with seven in waited for ever: the match waited for every seat. With at least
  one friend in and places still open, the host gets "Start with N": the match is for those in, the code takes nobody
  after, and a battle royale counts its sides again. Not the 1v1s, whose arena is chosen by the count.
- The host keeps a ping per guest and shows the worst: each guest's answer used to overwrite the last, so it
  flickered between them.
- Checks: the e2e `modes` section: a match for four with two friends in offers "Start with 3", starts for the
  three, and turns a late fourth away.

## Milestone 78 — Bots that see what is in front of them, and find their way to the ring ✅
2026-09-19 (Phase 15). `bots.ts`, `brmatch.ts`, `duel.ts`, `navgraph.ts` (new), `src/config/bots.json`,
`tools/checks/bot-walk.ts` (new).
- The bots' sight cues were tuned and never used: every caller asked `sees()` with nothing. In the battle royale a
  bot now knows how fast you move, whether you are crouched, and whether you fired in the last half second, so
  walking and crouching keep you hidden further and a shot gives you away.
- A bot not in a fight sees within a 150 degree cone in front of it (anything within 14 m it always notices); it
  used to see behind itself, so nobody could come up on one unseen. One that saw someone in the last 5 s looks all
  round.
- A bot running from the ring walks the graph to the node nearest the circle's middle, finishing the link it is on
  first, then goes straight in; it used to walk a straight line at the middle across the Table, the Notch's defile
  and the edge cliffs, none of it a tested link.
- Checks: `tools/checks/bot-walk.ts` builds the real map in node: from all 113 nodes, along the graph's own links, to
  the node nearest each of the 21 places a ring closes toward (the longest 11 steps); the cone's front, back and
  close-by rules.

## Milestone 79 — Bot squads act as squads ✅
2026-09-19 (Phase 15). `brmatch.ts`, `src/config/bots.json`, `tools/e2e.ts`.
- In duos and trios each bot picked its own next node, so a squad scattered on landing. A squad now follows its first
  bot, the others closing in to their own places 4 m round it when they drift past 12 m; a bot that sees someone
  tells its mates within 80 m, who go to look; and a downed human counts as three times as far off, so a bot turns
  to whoever is still up rather than finishing the one on the floor.
- The squad keeps following its first bot when it runs from the ring; the first cut only followed while wandering,
  and a closing ring split every squad.
- Checks: the e2e `botsquads` section: in trios with six bots, each squad's members are within 25 m of each other in
  at least 70 per cent of 40 samples over 30 s after landing (measured 75 to 100 per cent; about 50 with the
  following turned off).

## Milestone 80 — An ammo limit, and the lobby's roster and kick ✅
2026-09-19 (Phase 15). `ammo.ts`, `brplay.ts`, `duel.ts`, `net/link.ts`, `main.ts`, `index.html`,
`src/config/ammo.json`, `tools/checks/loot-tiers.ts`.
- In the battle royale each ammo type holds 4 stacks with the white backpack and one more for each tier above it:
  there was no limit, the walk-over pickup took every matching stack and a match ended with thousands of rounds. The
  sweep takes a stack only when it all fits; taken by hand, what does not fit goes back down. The range and the modes
  are unlimited as before.
- The host's lobby lists each friend in, whether they have clicked Play and their ping, with a Kick for each: the
  status line only said how many were in. A kicked friend is told so, and their place is open again.
- Fixed on the way, in the local test transport: a goodbye the host relays for one guest closed every other guest's
  link with it, so a friend leaving a lobby of three over it ended the match for the rest (the real peer to peer
  links never closed on a message).
- Checks: `tools/checks/loot-tiers.ts` (the stacks by backpack, a stack that half fits, no limit outside), and the e2e
  `modes` lobby: the roster's rows, a kick told as one, and the match starting for the two left.

## Milestone 81 — Outskirts in its own materials ✅
2026-09-19 (Phase 15). `br.ts`, `staticmerge.ts`.
- The CC0 sets fetched and credited for the map (ambientCG) were never put on it: every wall was one concrete and
  every rock a flat colour. Now the hub is concrete, North Yard's sheds and silos corrugated metal, South Depot block
  masonry, East Ridge and West Town rendered plaster, each in its colour; the containers are corrugated metal, the
  crates planks, the roofs roofing, the rocks and cliff faces rock, and the raised ground the floor's own earth.
- The map's boxes share one geometry per size with 0-to-1 texture coordinates, so a texture stretched once across a
  20 m wall. The static merge now gives a material that asks for it (userData.worldUV, metres a tile) coordinates
  from where each vertex is in the world, projected along its face, so every box shows its texture at one real size.
- Matte: the sets' roughness maps have glossy texels, and in full sun, looking into the light, treads and the floor
  itself flashed white (the floor did before any of this). The map's textured surfaces keep their normal maps for the
  detail and take one roughness of their own.
- No change in draw calls (a set in a colour is one merge group, as the flat colour was); `npm run bench` at the hub
  within noise of before.

## Milestone 82 — Resurgence on a quarter of Outskirts ✅
2026-09-19 (Phase 15). `resurgence.ts`, `brmatch.ts`, `src/config/br.json`, `tools/checks/resurgence.ts`.
- The item's smaller play area, waiting on the map: under Resurgence the first circle is 130 m across the hub,
  leaning 55 m toward one of the four big places round it (from the match seed, so every browser draws the same),
  which takes in the hub, that place and the compounds beside it. The squad drops on a place inside it (the nearest
  to the host's pick, the same on every browser), the bots take the other places inside, and every round's circle
  shrinks with the area so each still fits inside the last. Resurgence was the whole map on a faster clock.
- A place counts as inside only when every spot a squad drops on there is: a drop can be 30 m from its middle.
- Checks: `tools/checks/resurgence.ts` (the area the same for a seed and leaning toward each of the four over many,
  the hub and its place inside, every round's circle inside the last), and the e2e `resurgence` section (the first
  circle is the area, and everyone drops inside it).

## Milestone 83 — Supply bins ✅
2026-09-19 (Phase 15). `loot.ts`, `brmatch.ts`, `brplay.ts`, `audio.ts`, `main.ts`, `src/config/loot.json`.
- There were no containers: every item lay loose, seen from outside a building and taken in silence. Each place
  has two spots for a supply bin and each site one, each there with a 70 per cent chance from the match seed, so a
  place is rich one match and thin the next (about 18 bins a match, 13 to 25). A closed bin hums (heard to 40 m);
  hold E for 0.7 s to open it, heard across the place; it throws out two rolls of the high tier round it and stands
  open for the rest of the match.
- Opening rides on the loot's own messages: whoever takes the closed bin first opens it, and the host puts down an
  open one and the contents, from the seed and the bin's key. Bins are placed last, on a random stream of their own,
  so the places, the field, the Hot Zone and the sites draw exactly what they drew before; a bin is never counted as
  floor loot nor offered in the reach list.
- Checks: `tools/checks/loot-tiers.ts` (the bins a match and their spread, a bin's contents the same for the same bin
  and different bin to bin, the floor's density unchanged), the e2e `loot` section (hold E at a bin: it opens, what
  it held round it, never in the reach list), and the snapshot `br-bins`.

## Milestone 84 — A wins board counts wins, and the README says eight ✅
2026-09-19 (Phase 15). `server/game/boardrules.mjs` (new), `server/game/serve.mjs`, `tools/deploy-server.ts`,
`tools/checks/boards.ts`, `README.md`.
- A wins board took whatever total a post said, up to 100,000, so one forged post put anyone at the top. The game
  posts its running total after every win, so the server now counts posts instead: a post raises a name's wins by
  one at most over what the board has, and the per-address rate limit bounds how fast. Course times keep the best,
  over 5 s. (The bundled secret the old list worried about is never read by this server.)
- The README said "two or three players" and "the 1v1 tab" from before matches took eight: it says up to eight, and
  the Friends tab.
- Checks: `tools/checks/boards.ts` (a forged 99,999 counts as one win, an honest next total counts, a lower total
  changes nothing, a time keeps its best and a time under 5 s is refused).

## Milestone 85 — Sprays ✅
2026-09-19 (Phase 15). `sprays.ts` (new), `main.ts`, `audio.ts`, `binds.ts`, `index.html`, `src/config/sprays.json`,
`src/config/binds.json`.
- The second half of "emotes, sprays, banner cards and quips". A tap of 8 paints your spray on the wall you look at,
  within 5 m, with a hiss; everyone in the match sees it where you put it, through one effect message. One each: a
  new one replaces your last, and it fades after two minutes. Eight to pick from in Settings (a skull, a crown, a
  trophy, crossed swords, a target, a frag, an eye, a parachute), each the HUD's own credited icon cut out of a
  painted disc in its colour, with drips: no new asset.
- It aims from your own view angles, not the camera, which is a frame behind a turn.
- Checks: the e2e `emote` section (the host sprays the wall in front of it and the guest sees the host's spray there),
  and the snapshot `spray`.

## Milestone 86 — Banner cards ✅
2026-09-19 (Phase 15). `banners.ts` (new), `hud.ts`, `main.ts`, `index.html`, `src/config/banners.json`.
- The last of "emotes, sprays, banner cards and quips". Each player picks a card in Settings (an icon from the
  sprays' set, a frame colour, a title); whoever eliminates you, their card is on your death recap, and yours is on
  the champion screen when you win. A killer who never sent one (a bot, a friend on an older build) shows a card
  fixed by their id, the same one every time.
- The card is three picks packed into one number and sent as an effect every 10 s of a match, so a friend who
  arrives late has it; not a field of the state packets, whose optional fields are a bit mask an older build would
  read wrong.
- Checks: `tools/checks/emotes.ts` (every pick round trips off the wire, anything else is no card), the e2e `emote`
  section (the host's card reaches the guest), and the `recap` snapshot with the killer's card.
- The bot tests: the elite bot's crouch check stood the player behind a bot that had wandered off, which its view
  cone rightly does not see (the check now says what the bot saw when it fails, which is how this was found); it
  stands the player in front of it. The bot-squads check asks for 55 per cent out of a fight (60 to 100 measured,
  nearer 37 with following off).

## Milestone 87 — The group stays together, and one table at the end ✅
2026-09-19 (Phase 15). `duel.ts`, `brmatch.ts`, `hud.ts`, `main.ts`, `index.html`.
- A match used to end by closing every connection, so a night of eight friends meant a new code for all eight after
  every battle royale. A match that runs to its end now hands its links back (`Duel.takeLinks`), open and with
  nothing of the old match listening: the host keeps its friends', a guest its link to the host. The host's Friends
  tab offers **Play again with N**; it reads the tab as it stands (the settings code a new match uses, now one
  function), gives the friends fresh ids from 1 so one who left leaves no gap, and sends each the same welcome a new
  code would. A guest waiting in the group starts on that welcome. **Leave the group** closes the links; a host that
  leaves tells everyone, and the last friend leaving ends the group.
- The host's code stops taking new people while the group waits, so a stranger with the old code cannot slip in.
- A finished battle royale no longer leaves the match to end it (which closed the links); it finishes in place.
- The end screen with friends carries one table: every player's kills, damage and place, sent by the host as one
  effect message when the match ends.
- Checks: the e2e `brsolo` section (the end table lists both, then both are back in the range with the host offered
  Play again with 2 and the guest told the group is together, and the host's click puts both into Gun Run as host and
  player 1 with no new code).

## Milestone 88 — Knocked bots, and their squads pick them up ✅
2026-09-19 (Phase 15). `bots.ts`, `brmatch.ts`, `duel.ts`, `main.ts`, `src/config/bots.json`.
- In duos and trios every bot's knock was its death, so a bot squad was three solos walking together and the
  knock, the thirst and the revive that decide a squad fight never happened against bots. A bot knocked with a mate
  still standing now goes down as a player does: on the floor with the players' bleed-out pool (squad.json), crawling
  toward its nearest standing mate, doing nothing else. Its bleed-out runs on the players' clock (a trio's 90 s, a
  duo's half). A standing mate with nothing in sight, and no ring pushing it on, walks to it within 60 m, kneels and
  picks it up after the revive's 5 s, on 20 health and no shield; a target breaks the revive off. The last of a squad
  standing going down takes the downed with it.
- The kill is the finish, the bleed-out or the wipe, credited to whoever knocked it when nobody fired the last shot.
  Your hit marker says knock for a bot that went down and kill for one that died (a bot's health refills to its
  bleed-out pool when it goes down, so the host reads the bot's downed flag, not its health). Enemy bots weigh a
  downed bot as further off, as they do a downed player, and only its low body takes their shots.
- The guests see it: the bots' state packets carry the downed stance and flag, the knock is the players' own knock
  message, and a revive is the players' revive message, which a guest shows in the feed.
- The crouched walk of a bot (0.6 of its speed, a literal until now) is in bots.json with the revive range.
- Checks: the e2e `botsquads` section (a trio's bot knocked with its squad up is down, a mate revives it on 20 health,
  one left to bleed dies of it, and with the last standing gone the downed go too), and the `squad` section (a duo's
  bot knocked shows down on the guest's screen, and up again once revived).
- The group (Milestone 87): a player who clicks Leave on the end screen, or a guest whose host left there, was kept
  in a group over links already closed, and a host so kept could not make a new match. Leaving, either way, now keeps
  nothing; the `squad` section's second match, made after the first was left on its end screen, caught it.

## Milestone 89 — The gun has its own FOV ✅
2026-09-19 (Phase 15). `render.ts`, `sens.ts`, `main.ts`, `src/config/viewmodel.json`.
- The gun in your hands was drawn by the world's camera, so the FOV setting stretched it (on the widest setting it
  was pushed into the corner, on the narrowest it filled a third of the screen) and every slide and JOLT shrank it
  for their length. It now has a camera of its own, at the world camera's place, drawn after the world on a layer
  only it sees, with the depth cleared so it never sinks into a wall. Its FOV is the world's hip-to-aimed blend at
  the default setting's scale (viewmodel.json `fovScale`, 1.55, what the gun was built and checked at), whatever
  yours is, and a slide or a JOLT is not in it. At the default setting the picture is the same as before, lighting
  and all; aimed, every optic's sight picture is the default's on every setting.
- It is lit by the world's lights (each on the gun's layer as well; the scene is walked again for them only when
  its top level changes) and the world's environment map; the second pass draws no sky and no shadow maps of its
  own. In the post chain it goes after the world's ambient occlusion (the gun takes none now) and before bloom (its
  flash still blooms).
- The tracer leaves the muzzle you see: the gun's muzzle is carried from the gun's FOV into the world's at the same
  depth, since the two cameras put it at different places on screen off the default setting.
- Cost: about 0.2 ms a frame on Competitive (1.8 to 2.0-2.1 ms median here, a depth clear and a second draw on the
  multisampled canvas) and within noise on High (3.7-3.8 to 3.8-3.9 ms). Leaving the world's lightless parts out of
  the gun's pass measured no difference, so the pass stays simple.
- Checks: `tools/checks/viewmodel-arms.ts` (the gun's FOV is the same on the narrowest, default and widest setting,
  hip and aimed, and equals the world's at the default), the e2e `page` section (the setting moves the world's FOV
  by over 20 degrees and the gun's not at all), and the snapshots `gun-fov-wide` and `gun-fov-narrow`.

## Milestone 90 — Squads of friends against each other ✅
2026-09-19 (Phase 15). `brmatch.ts`, `duel.ts`, `brplay.ts`, `main.ts`, `link.ts`, `index.html`.
- Friends in a duo or trio battle royale were always one side, however many came. A box on the lobby row now splits
  them into squads of the size in the order they joined (ids 0 and 1 a duo, 2 and 3 the next; a trio of five is a
  trio and a pair), told to every browser in the welcome as one flag, so each works out every side the same way.
  Solo is everyone for themselves either way; an older host sends no flag and plays one side.
- Every "a human is a squad mate" rule is now "a human of your squad": no damage between squad mates only, the
  plates and aim assist, reviving, the banner in a death box (another squad's is not yours to carry or respawn on),
  the redeploy and Gulag drop spots, spectating, the map (another squad is enemies, so it is not on yours), and pings
  (passed on by the host, shown only to the pinger's squad). Each squad has its own jumpmaster, its first player.
- A player down whose last standing squad mate is then knocked goes out with them, on whoever knocked them (each
  browser decides it for itself on the knock or the elimination it is told of, so no new message). With one side
  the match still ends there instead, as before.
- The host's judge of solo with friends, which placed each player as they went out, now places each side: a side is
  standing while one of it is up or in the Gulag, and the match ends when one side is left or no human stands. The
  placement's count of squads counts each squad of friends.
- The bots' own knocks and revives (Milestone 88) stay on in split squads.
- Checks: `tools/checks/br-rules.ts` (the sides by join order, together, split and solo, and the squads counted),
  `tools/checks/pickup-reach.ts` (another squad's banner is left out of the list), and the e2e `brsolo` section
  (four tabs in split duos: the allies and jumpmasters, the host's shots hurting the other duo, the map showing only
  your duo, the last of a duo knocked taking its downed mate out, and the host's duo winning with the other placed
  third of three).

## Milestone 91 — Getting back in after a dropped connection ✅
2026-09-19 (Phase 15). `link.ts`, `duel.ts`, `main.ts`, `src/config/net.json`.
- A guest whose connection dropped was out of the match for good, and the host saw them leave: one bad second of
  Wi-Fi ended a battle royale for a friend. Now a close with no goodbye first (a leave always says goodbye) is a
  dropped connection, and both ends treat it as one. The host holds the seat, figure and all, for net.json's
  rejoin.hold (60 s); the guest's match keeps running on its own screen while the page tries the same code again
  every rejoin.retry (3 s) with the seat's key; the host takes it back on the same seat, and both ends' state
  streams start over from whole states. A seat nobody comes back for is let go as if they had left; a guest that
  cannot get back is out with "Lost the connection to the host". A 1v1 does not hold: it ends as before.
- The welcome gives each guest a key for its seat (the host's handle makes one per seat), so nobody else can take a
  held seat by claiming its number. The host now reads a guest's hello before it welcomes them (a hello says whether
  they are new or back), and a full match still takes a guest back on its own seat. The host's code re-registers
  with the broker after a blip even once the match is full, so a guest can still find it.
- A connection that goes quiet for 10 s is treated the same way, from either end: the guest drops it without a
  goodbye and gets back in, the host holds the seat.
- The local transport's goodbye is delivered before its close now, so a match hears a leave as a leave; a dropped
  connection there is its own signal, which is how the tests drop one.
- An older host's welcome has no key, and its guests play as before (no retry). An older guest never tries to come
  back, so its held seat is let go when the hold runs out.
- Checks: the e2e `brsolo` section over two tabs and the `p2p` section over the internet (a dropped guest keeps its
  match and is taken back on its held seat, the two hear each other again within a second, a seat nobody comes back
  for is given up, and a guest that cannot get back is out).

## Milestone 92 — The host checks every claimed hit ✅
2026-09-19 (Phase 15). `hitcheck.ts` (new), `duel.ts`, `brmatch.ts`, `modematch.ts`, `src/config/net.json`.
- The shooter's own browser decides a hit and tells the others what it did, which is what keeps a hit where you saw
  it at any ping. It also meant a page could claim anything: a 999 from across the map with a gun it never fired.
  The host sees every shot and every hit, so it now holds each claim to what the gun can do before it reaches
  anyone: no more than one round of that gun (a headshot at its nearest range with every bonus it can carry, 30%
  over), only within 2.5 s of a shot from that player, from within 10 m plus 30% of the distance the host sees
  between the two (a round trip stale), a swing only from within 5 m, and no more in a second than the gun fires
  in one, 60% over, and never less than one whole trigger pull. A claim that fails is dropped, and the first from
  each player is noted in the console; nothing is shown to players.
- Every gun's best real round, and a whole magazine of them at the gun's fastest, passes: the unit check runs all
  30. It caught the sniper on the first run (slower than a shot a second, its per-second limit was below one round).
- Three e2e steps that faked a guest's hits with no shot behind them and more than a round could do now claim as a
  gun would (a shot, then R-301 rounds of 25).
- Checks: `tools/checks/hitcheck.ts` (every gun's best round and full magazine pass; a round too many, a hit with no
  shot, a claim from the wrong distance, a swing from 20 m and a stream faster than the gun are refused), and the
  e2e `squad` section (a guest's 900 from an R-301 and a hit with no shot behind it are both dropped by the host).

## Milestone 93 — Tonight's tally ✅
2026-09-19 (Phase 15). `main.ts`, `index.html`.
- A night of friends had one table per match and nothing across them. The Friends tab now keeps **Tonight**: every
  match with friends since the code was made, each player's wins, kills and damage added up and the number played.
  Each browser adds up the end tables it is sent (Milestone 87), which are the same on every browser, so every
  screen's tally is the same with no message of its own. A match goes on the tally once its end screen is over,
  when every line has come in: back in the range after a battle royale, or as the next match begins in the arena and
  the modes (which rematch in place); the end card keeps showing that match's table meanwhile. Play again keeps
  adding to it, a new code starts it over, and a match alone (the bots only) is not on it.
- Players are keyed by name, since ids change when a group plays again; two with the same name are told apart by
  their order in the match, which Play again keeps. The first run of the test found it: its two tabs share a profile
  and so a name.
- Two test timings: the old-build 1v1v1 counted the relayed figure after a fixed 1.5 s, and a player standing still
  sends a whole state only every keyframe, across two streams through the host, so it now waits up to 6 s for it;
  and a bot squad's revive check could land while the ring pushed the squad on, which kept the mate from reviving.
  A bot the ring is pushing on no longer walks back for a downed mate, but one already beside it picks it up.
- Checks: the e2e `brsolo` section (after the battle royale both screens show the same table of the two, one played
  and the one win for the winner, and Play again keeps it).

## Milestone 94 — Figures placed on the sender's clock, with a jitter buffer ✅
2026-09-19 (Phase 15). `state.ts`, `link.ts`, `duel.ts`, `brmatch.ts`, `modematch.ts`, `src/config/net.json`.
- A friend's figure was placed by when their states ARRIVED, 100 ms behind. Arrivals bunch and gap as a connection
  jitters, so a friend running at one speed ran, stalled and lurched on your screen. Each state now carries its
  sender's clock (the low 16 bits of its milliseconds, unwrapped by the receiver), and the figure is placed by when
  the states were sent: each sender's clock is mapped onto ours through the smallest gap seen between the two (the
  least delayed state), creeping up 2 ms a second so one lucky state does not pin it. The host's bots carry the
  host's clock; a relayed state keeps its sender's.
- A jitter buffer: how far behind a figure is drawn follows the worst recent wait from one state's time to the next
  state's arrival (a figure drawn less far behind than that runs out of states and stands still), between 100 ms
  (what it always was) and 300 ms; it grows fast and shrinks slowly, eased so the figure never jumps. Past the newest
  state (a burst of lost ones) the figure carries on along its last motion for up to 150 ms rather than freezing. On
  a good connection nothing changes. The first version followed lateness plus the average gap, which a spike beat:
  the full e2e run caught it at 0.47 with ten stalls, where alone it had read 0.13.
- The stamp rides only on a state that is sent anyway: a player standing still still costs nothing between
  keyframes. It is the delta format's ninth optional field, added at the end of the list (an older build ignores a
  key it does not know, and it is never cleared, so it never sets a mask bit an older build would misread). Measured
  with tools/net-cost.ts: a battle royale squad's host upload 6.5 kB/s on the wire before, 6.4 after; the guest's
  1.3 kB/s of messages before, 1.4 after.
- The local transport takes `?jitter=N` (up to N ms on each message, in order, as a reliable channel delivers), and
  `?senderclock=0` places figures by arrival again, for comparison.
- Checks: `tools/checks/net-delta.ts` (the clock survives the codec and wraps at 16 bits, a still player costs
  nothing though the clock moved, a moving one carries it), and the e2e `duel` section: two tabs with 60 ms of jitter,
  the guest running a steady circle, the host measuring its figure's speed frame to frame. Placed by send time the
  spread is 0.06 to 0.09 of the mean with no stalls over three runs, evener than the guest's own states (0.12);
  placed by arrival it is 0.55 to 0.76. The first
  version of the measurement stamped each frame after the match's update rather than before, whose own few
  milliseconds on a 6.6 ms frame read as unevenness that was not on screen.

## Milestone 95 — The state packets on an unordered channel ✅
2026-09-19 (Phase 15). `link.ts`, `duel.ts`, `src/config/net.json`.
- Every message rode PeerJS's one reliable, ordered channel, so a single lost packet held every later state behind
  it until it was resent: every figure stalled at once, then caught up in a lurch. The delta format was built for
  loss from the start (a difference from an acknowledged state, a keyframe every couple of seconds, a late part
  dropped as stale), so the delta packets and their acks now ride a second data channel on the same connection,
  unordered and never resent. It is a negotiated channel: both ends open it with the same id, so there is no
  signalling and no second connection to set up. An older build opens none, the channel never pairs, and everything
  goes on the reliable channel as before; so does anything sent while it is not open or has 64 kB waiting.
  Everything else (shots, hits, downs, the full packets an older build reads) stays reliable and ordered.
- On the wire it is packed as PeerJS packs the reliable channel (binarypack); only a delta packet or an ack is
  accepted off it.
- A negotiated channel opens as soon as the connection is up whether or not the other end made one, so "open" does
  not mean anyone is listening: the first version sent a new host's states to an older guest into nothing (the
  `mixed` run caught it, the older guest applying 0 of 167). Each end now says hello on the channel as it opens and
  answers the first thing it hears with one of its own, and states go on it only once the other end has been heard
  there; until then, and always with an older build, they stay on the reliable channel.
- The local transport takes `?loss=P`: that channel drops P of its messages and delivers the rest in any order.
- Measured with tools/net-cost.ts over the real peer to peer path: a battle royale squad's host upload 6.8 kB/s on
  the wire, against 6.4 to 6.5 before (the second channel's own overhead, about 5%).
- Checks: the e2e `duel` section (with 15% of the state packets lost and the rest out of order, a friend running at
  one speed still moves at one speed: a spread of 0.07 to 0.10 of the mean, no stalls, over three runs), and the
  `p2p` section (over the internet the channel opens both ways and carries the delta packets and acks, none lost).

## Milestone 96 — Handing the host over in the lobby ✅
2026-09-19 (Phase 15). `main.ts`, `duel.ts`, `link.ts`.
- The host is the one whose upload carries the lobby, and whoever clicked Create match first was it, however bad
  their connection. The host's roster now has a **Make host** button by each friend. The host asks that friend to
  take it (with the match it made: the mode, the bots, the map); the friend's page opens a new code for the same
  match, sends it back and leaves the old lobby with the new code kept open; the host tells everyone else to move
  there, then goes itself. Three lobby messages (`host` take, code and move), only while waiting; a guest acts on
  them only from its host, and the host only takes a code from the friend it asked.
- The host button's code and the Join button's are one function each now (openHosting, joinCode), which the
  handover calls as a player would.
- Choosing the new host by ping is left: in a star the host knows only its own ping to each guest, not theirs to
  each other, so "best connection" needs every guest to measure the others first.
- The first version had the new host leave the old lobby 150 ms after sending its code, and a friend told to move
  in that time reached the new code while its host was still a guest there, and was turned away. It now sends the
  code and leaves in the same moment (the code goes first on the ordered channel).
- Checks: the e2e `triple` section over two tabs and the `p2p` section over the internet (three pages in a
  free-for-all lobby; the host clicks Make host on player 2, and all three are in player 2's new lobby with player 2
  hosting and the same mode, nobody typing a code).

## Milestone 97 — Doors ✅
2026-09-19 (Phase 15). `doors.ts` (new), `brpoi.ts`, `br.ts`, `brmatch.ts`, `brplay.ts`, `duel.ts`, `link.ts`, `range.ts`,
`main.ts`, `src/config/doors.json`.
- Every doorway on Outskirts was a hole with a lintel: nobody inside heard anyone coming, and a building could not
  be held. Each ground-floor doorway the buildings make now has a door hung in it, 64 of them, shut when a match
  starts. E opens or shuts the one you look at (unless there is loot under the crosshair, which is what you meant);
  one opening or shutting is heard across a building (the recorded door sounds the audio already had, unused); a shut
  one stops bullets, the bots' sight and sound through walls, since it is a solid like any wall; and a door will not
  shut on anybody standing in it.
- A door is a panel on a hinge at one end of the gap, eased through 90 degrees into the building in 0.35 s, and a
  solid in the map's collision list that is moved, not added or removed: closed it fills the doorway, open it is the
  panel against the hinge side. The list keeps its length, so the minimap does not redraw. The panel is left out of
  the map's static merge so it can move.
- The host decides every door for everyone. A friend's E shows at once on their screen and asks the host, which does
  it (only for a friend within 5 m of it: a page can claim anything) and tells everyone, or answers with the truth.
  The ring packet, twice a second, lists the open doors, which puts right anyone who missed one (a friend who came
  back after a dropped connection, say), except a door that page asked about in the last second. An older build has
  no doors and ignores both.
- The bots open a shut door they walk into (within 1.4 m of it), as anyone would. The tests' walk of the map treats a
  doorway as a way through for the same reason.
- Checks: the e2e `br` section (64 doors, all shut on the ship; walking into one stops you outside, the prompt says
  OPEN THE DOOR, E opens it and the walk carries on inside; a bot put against a shut door opens it; leaving the match
  shuts them all), the `squad` section (the guest opens one and the host sees it, the host shuts it and the guest
  sees that, and a door the guest had wrong is put right by the host), and the snapshots `br-door` and
  `br-door-open`.
- Not yet: a door's panel does not push a body it swings into. (Kicking a door in came next, Milestone 98.)

## Milestone 98 — Kicking a door in ✅
2026-09-19 (Phase 15). `doors.ts`, `brmatch.ts`, `main.ts`, `link.ts`, `src/config/doors.json`.
- A held building had one answer to a shut door: open it with E and walk into the guns behind it. As in Apex, two
  melee swings into a shut door now kick it in: the first shakes it (heard as a kick), the second breaks it, and it
  is gone from the doorway for the rest of the match, with nothing left to bump into or shut. The recorded kick the
  audio already had plays for both.
- The host counts the kicks (a friend's from within a swing of the door) and tells everyone; a break carries the
  door's new state, and the ring packet lists the broken doors alongside the open ones, so a friend who missed one
  is put right. A new match hangs every door again.
- A test hook starts a swing as the V key does (`swing`).
- Checks: the e2e `br` section (one swing into a shut door leaves it shut with one hit on it, the second kicks it
  in: broken, its solid flat, the panel gone).

## Milestone 99 — Rocks for the field's cover ✅
2026-09-19 (Phase 15). `geo.ts`, `br.ts`, `tools/snap.ts`.
- The field's cover between the places, the forty scattered rocks, the rocks of the spoke clusters and the four in
  the dry wash, were bevelled boxes the colour of rock. Each is now a rock made to its box: the box cut into facets,
  pulled part way toward the egg inside it and pushed in and out a little at random, its underside flat on the
  ground. It keeps its footprint and height, so the box it collides with still fits it (it never reaches more than
  4% past its box, and its corners sit inside it) and nothing a bot or a test walks changed. The random is fixed by
  the rock's place and the facet grid, so every load makes the same rocks and the seams between faces stay shut.
- 160 triangles a rock against the bevelled box's 300, merged with the rest of the map.
- They take a lighter tint of the same stone than the mesas and the scarp: the rock set is dark, and on the tint the
  cliffs use, a boulder on the sand read as a black lump.
- Made rather than fetched: no model or licence to carry. Cliffs and vegetation are still to do.
- Checks: the snapshot `br-rocks` (the north spoke's cover), and the e2e `br` section's walk of the map, unchanged.

## Milestone 100 — The map drawn once, and only from itself ✅
2026-09-19 (Phase 15). `staticmerge.ts`, `geo.ts`, `doors.ts`, `main.ts`, `tools/bench.ts`, `docs/PLAN_LOD_DRAW_DISTANCE.md`.
- Step F of the LOD plan, after profiling the frame by object found what its first measurement had missed (the plan
  now has the whole account): the battle royale map was in the range's list of roots as well as its own, so the
  merge took each of its meshes twice and the whole map was drawn double; and each side of the world, the range and
  the map 500 m apart, drew the other through 400 m of fog (from the Mast's roof, the range's target frames, course
  signs and fetched props were about 350 draw calls and a million triangles).
- The map is out of the range's list; the merge keeps each region's meshes apart and puts them in the caller's group;
  main draws only the side the camera is on (the lights the range builds stay out of it: hiding them with the range
  turned the sun off on the map, which the door snapshot showed at once); and the bevelled box is indexed (900
  vertices to 212). Cells of 73 m inside a region were built, measured worse (1,262 draw calls to 1,986 from the
  Mast's roof for 15% fewer triangles, on a frame bound by its calls) and dropped.
- A door is one mesh now, its handle's colour in the vertices: two a door was about sixty draw calls at the hub.
- The benchmark's `brmatch` spot measured the range's edge with a match waiting: nothing took the pointer lock a
  click takes, so the match never began and the teleport onto the hub was clamped by the range. It takes the lock
  now, and it measures a match.
- From the Mast's roof: Competitive 159 to 385 fps median (p99 9.0 to 3.7 ms), Balanced 270 to 500, High 175 to 333;
  draw calls 1,262 to 400. In a match at the hub: Competitive 172 to 185, High 93 to 106 (p99 14.6 to 12.3 ms). The
  range is unchanged. The full table is in the plan.
- Checks: the benchmark before and after at all three spots and presets; the door snapshot (the lighting, and the
  one-mesh door); the e2e walk of the map and every section, unchanged.

## Milestone 101 — Loot drawn in batches ✅
2026-09-19 (Phase 15). `loot.ts`, `src/config/loot.json`.
- Step C of the LOD plan. With the map drawn once, what was left of a match's draw calls was the loot: every item's
  box, every gun's ring on the floor and every rare item's beam its own mesh, and every gun on the floor a full copy
  of its display model, 11 to 15 meshes. A box, a ring and a beam are now copies of one instanced mesh per material
  (a rarity's colour), refilled each frame with the items inside the 70 m draw distance, so each kind is one draw
  call however many there are. A gun on the floor is one mesh: its display model's parts baked into one geometry
  with their colours in the vertices, made once a gun. The parts keep their shapes; each part's own shine is gone,
  which on the floor at 0.3 m tall nobody reads. The floor guns cast no shadow, as the display models did not.
- In a match at the hub (the benchmark's `brmatch`, 9 bots): Competitive 864 draw calls to about 280 and 192 fps to
  278-333 median (bots and loot move from run to run), Balanced about 333, High 1,885 calls to 709 and 105 fps to 179.
- Checks: the e2e `loot` and `br` sections, unchanged; the `br-loot` snapshot (boxes, rings, beams and floor guns all
  drawn); the benchmark before and after.

## Milestone 102 — The eight-player rehearsal ✅
2026-09-19 (Phase 15). `tools/rehearsal.ts` (new), `package.json`.
- Everything about eight friends had been tested with two or four tabs. `npm run rehearsal` plays the full lobby:
  eight pages join one battle royale through the public broker (WebRTC between them, as friends play), split into
  four duos with three bot duos, land, and play for a minute with every guest running circles and looking about, so
  every state stream changes every tick. It fails if anyone cannot connect or land, if anyone does not see all seven
  others, if anyone is out of the match by the end, or if any page logs an error; and it reports the host's upload
  to each guest (the wire bytes of both data channels) and how long its match update takes a frame.
- First run, on this machine, 45 s: all eight connected, landed and saw the other seven, and nothing logged an
  error. The host sent 19 kB/s to each guest, 132 kB/s (about 1.1 Mbit/s) in all; its match update took 1.5 ms
  median, 2.9 ms p95, 3.5 ms p99.
- What it says next: the host's upload grows with the square of the lobby (every guest gets every other player's
  state at the full 30 a second, and the bots'), and a megabit is more than a phone's hotspot always has. Sending a
  guest the players far from it less often (interest management) is the next saving; the rehearsal is how to
  measure it.

## Milestone 103 — Interest management ✅
2026-09-19 (Phase 15). `duel.ts`, `src/config/net.json`, `tools/rehearsal.ts`.
- What the rehearsal pointed at. The host passed every guest every other player's and bot's state at the full 30 a
  second wherever they were. Now a subject within 90 m of a guest still goes at the full rate; beyond that, at 15 a
  second; beyond 200 m, at 10. A far figure is drawn from fewer states, which the jitter buffer takes in its stride
  (Milestone 95: a gap of 100 ms). Only the delta packets are thinned; a guest's own state to the host, and the full
  packets an older build reads, are not. `?interest=0` in the host's address sends everything at the full rate.
- The rehearsal gains `REHEARSAL_SPREAD=1` (each duo to a place of its own after landing: in one place everyone is
  near everyone, and nothing is saved) and `REHEARSAL_QUERY` (more for the address).
- Measured, eight players spread over four places, 30 s: the host's upload 131.6 kB/s (1.05 Mbit/s) with it off,
  79.8 kB/s (0.64 Mbit/s) with it on, about 19 to about 11.5 kB/s a guest; everyone still saw all seven others. The
  host's match update was 1.9 and 2.1 ms median.

## Milestone 104 — Voice chat ✅
2026-09-19 (Phase 15). `voice.ts` (new), `link.ts`, `duel.ts`, `main.ts`, `hud.ts`, `src/config/voice.json`,
`src/config/binds.json`, `src/ui/binds.ts`.
- Eight friends had quick chat lines and nothing else. Hold Caps Lock (the `voice` key) to talk: your squad hears
  you in a battle royale, your team in the team modes (anyone you are allied with), and everyone in a lobby, a 1v1
  or a free-for-all. Who is talking shows at the bottom left, you first.
- Peer to peer between the players, not through the host: the host already carries every state in the match, and
  voice through it would multiply its upload by the lobby again. The host sends everyone each player's PeerJS id
  (the `voice` message, again whenever someone arrives, leaves or comes back), and each page calls the ones it may
  talk to with PeerJS's media calls, on the same broker and relays as the game's own connection; a page that never
  talks answers receiving only. A call from outside the group is turned away.
- The microphone is asked for on the first press of the key, not before, with the browser's echo cancelling, noise
  suppression and gain; while the key is up its track is off and nothing is sent. No microphone, or a no, and the key
  says so once. On the local transport (the tests' two tabs) there is no voice.
- Checks: the e2e `p2p` section over the internet, with Chrome's fake microphone (a tone): the guest holds the key
  and the host hears it (a peak of 0.59), and a moment after it is let go the host hears nothing.
- A volume slider and a per-player mute came next (Milestone 105).

## Milestone 105 — Voice chat's volume and mute ✅
2026-09-19 (Phase 15). `voice.ts`, `main.ts`, `index.html`, `tools/e2e.ts`.
- The Settings tab has a Voice chat volume, remembered. During a match the Friends tab lists who you can hear, each
  with a Mute: a muted player plays at nothing and shows no talking mark, and their call stays up so unmuting is at
  once. A mute is kept by name for the night, since ids change when a group plays again or someone comes back.
- Checks: the e2e `p2p` section (the host mutes the guest on the Friends tab, the guest talks, and the host hears
  nothing; the button reads Unmute).

## Milestone 106 — Custom match rules ✅
2026-09-19 (Phase 15). `main.ts`, `duel.ts`, `weapons.ts`, `link.ts`, `index.html`, `src/config/rules.json`.
- A night of friends had the modes as they come. The Friends tab's Rules boxes: which guns the match allows (any, or
  one class by the weapon data's own category: assault rifles, SMGs, LMGs, shotguns, snipers and marksmen, pistols,
  the Mozambique counting as a pistol), how many rounds win the 1v1 (first to 1, 2, 3, 4, 5 or 7), and friendly
  fire. They go to every friend in the welcome's match options; an older host sends none and plays as ever.
- A class of guns: anyone holding another gun is handed the class's first two (rules.json), checked every frame, so
  the start, a respawn and a change on the Loadouts tab all land on the class; the bots are armed with its first
  unless the Bot guns box already picked one. It is for the 1v1s and the arena modes: a battle royale's guns are what
  you find, and Gun Run has its ladder.
- Friendly fire: squad mates and team mates can hurt each other (the plates and aim assist still know them as
  friends).
- Checks: `tools/checks/rules.ts` (each class's guns are real guns of that class), and the e2e `duel` section (a 1v1
  with shotguns only and first to 1: both hold only shotguns and one knock ends the match; a team deathmatch with a
  friend on the same side and friendly fire on: the host's round hurts its team mate).

## Milestone 107 — Bots on the ropes and the pads ✅
2026-09-19 (Phase 15). `bots.ts`, `brmatch.ts`, `src/config/bots.json`.
- Every zipline and launch pad was scenery to the bots: a bot wanting the other side of the map walked it. Now a bot
  takes the traversal as a player passing by would. A launch pad throws any bot that steps on it, along the road at
  the players' speed and lift, and it comes down under the players' gravity (33 m on, as a player's throw). A bot
  out of a fight standing at a zipline's end rides it when the rope's far end is at least 30 m nearer where it is
  going, hanging 2.13 m under the rope at the ride's 600 hu/s, and steps off at the far end.
- While it flies or rides it does nothing else, and its friends see it do so: its state packets carry the air or
  zipline stance.
- Opportunistic rather than planned: the graph has no typed rope and pad edges yet, so a bot uses one when its walk
  brings it there, not as a planned route. The balloons are left too.
- Checks: the e2e `br` section (a bot put on a launch pad is thrown 33 m along it; a bot at a rope's end heading for a
  node by the far end rides the rope and lands 0.4 m from the end).

## Milestone 108 — Weapon finishes, unlocked by level ✅
2026-09-19 (Phase 15). `finishes.ts` (new), `gunmodels.ts`, `main.ts`, `menu.ts`, `index.html`, `src/config/finishes.json`.
- XP had nothing to unlock. Eight finishes, each paint for a gun's body and accents: Factory (the gun as built,
  always yours), then Carbon at level 2, Desert at 4, Arctic at 6, Forest at 9, Crimson at 12, Cobalt at 16 and Gold
  at 25 (metal, not paint). Beside each slot on the Loadouts tab is its gun's finish picker: the locked ones show the
  level that opens them and cannot be picked. Every gun keeps its own, remembered in the browser.
- A finish swaps the model's body and accent materials (tagged where the palettes are made) for the finish's, kept
  per finish, part and palette, so two guns sharing a palette do not change together, and a change of mind puts the
  model's own back. The gun in hand wears its finish, checked each frame, and a pick on the Loadouts tab goes on at
  once (the frame is not running while the menu is up, which the first test run showed).
- A finish chosen when it was open but that the level no longer allows (a reset profile) falls back to the factory
  paint.
- Other players seeing your finish came next (Milestone 109); floor guns and your own third-person figure's gun are
  left in their factory paint.
- Checks: `tools/checks/finishes.ts` (the factory paint first and always open, the rest in order of level, a locked
  one not taken, a level that no longer allows one falls back, every gun its own), the e2e `page` section (at level 1
  Gold and Carbon are locked; at the level, Gold is picked for the first slot's gun and the gun in hand wears it), and
  the snapshots `gun-finish-gold` and `gun-finish-arctic`.

## Milestone 109 — Finishes seen by the others, and squads that ride together ✅
2026-09-19 (Phase 15). `gunmodels.ts`, `dummy.ts`, `mannequin.ts`, `duel.ts`, `main.ts`, `brmatch.ts`, `tools/e2e.ts`.
- Your finish is on the gun in your figure's hands on your friends' screens. Each page tells the match the finish of
  the gun in hand as an effect (on a change, and every 10 s for anyone who arrives late), and paints it on that
  player's figure, on either rig, and again after any change of gun. A finish is painted on a figure's own copy of the
  display model, with each mesh's own material kept apart from its data (a clone copies data, and a material there
  would be copied as data).
- Bots on the pads and ropes (Milestone 107) split their squads: a follower that stepped onto a launch pad was
  thrown 33 m down the road away from its squad, and the squads' check fell to 39% together. A squad's first bot
  takes a pad or a rope where it will; a follower takes a pad only where it throws it toward its lead, and a rope only
  toward it; and a lead takes a rope (a choice, unlike stepping on a pad) only with its squad about it. The check
  now leaves out a squad with a bot in mid-flight, as it leaves out one in a fight: it is apart for the length of
  the ride. Measured over four runs: 55, 75, 100 and 91% together, against 60, 100 and 86% with the traversal off.
- Checks: the e2e `emote` section (the host's gun in Gold, and the guest's figure of the host wears it) and the
  `botsquads` section.

## Milestone 110 — Host migration, phase 1: the host's id is a field ✅
2026-09-19 (Phase 15). `duel.ts`, `tools/checks/net-delta.ts`, `docs/PLAN_HOST_MIGRATION.md` (new).
- The plan for a match that outlives its host: one guest, the heir, is kept a snapshot of everything only the host
  knows, and when the host drops it takes over the match's code, so the other guests' rejoin retries (Milestone 91)
  land on it. Four phases, each shipped on its own.
- Phase 1 changes nothing anyone sees. A match's host was the player with id 0, taken for granted in a dozen places:
  a guest's figure of its host, the ping, the relay's targets, the host's goodbye, its kick, its handover, its voice
  roster, and the silence that means a dropped host. A migrated match's host keeps its own id, and the old host's
  id 0 becomes a held seat it can come back to, so each of those now goes by `hostId`, and the role follows from it.
- Checks: `tools/checks/net-delta.ts` runs real matches hosted by id 2 and id 3 (the roles, the relay in deltas both
  ways, no figure of guest 0 for itself, pings answered, a host gone quiet noticed by both guests, the host's goodbye
  ending the guest's match).

## Milestone 111 — Host migration, phase 2: the match outlives its host ✅
2026-09-19 (Phase 15). `duel.ts`, `modematch.ts`, `link.ts`, `main.ts`, `src/config/net.json` (`migrate`),
`tools/checks/net-delta.ts`, `tools/e2e.ts`.
- A guest of this build tells the host it can take the match over. The host names the lowest such guest its heir,
  tells everyone every second who that is, and sends the heir alone what no guest's copy of the match holds: each
  seat's key and who is in. In Free-for-all and Gun Run among friends that is all of it: the ladder, the clock, the
  winner and the phase are already every guest's.
- When the host's connection drops, or the host leaves mid-match (its goodbye is handed on, not the end), the heir
  asks the broker for the match's own code and, meanwhile, tries to get back in as a guest like everyone else. It
  becomes the host only once the code is its own. If only the heir's connection dropped, the host is still there,
  keeps the code, and the heir is simply back in. So one page's blip can never split the match in two.
- Having the code, the heir takes over: its role and `hostId` change, the others' seats are held with their figures
  where they stood, the old host is off the board, and the clock goes on from what the last update said. The
  others' existing retries (Milestone 91) find it on the same code with their seats' keys, and the welcome back
  names the new host, so each guest's figure of its host changes to the heir. The new host then names its own heir.
- Measured over the public broker, three tabs, the host's tab crashing: the heir held the code 0.41 s later and the
  third player was back in on their seat at 1.7 s. On the first run that took 7 s: the others' first retry went out
  before the heir held the code and waited out a whole timeout, so now they give a named heir `wait` (1 s) first.
- `net.json migrate`: `snapshot` 1 s, `claim` 20 s (how long the heir asks for a code the broker still holds for a
  crashed host), `fresh` 4 s, `wait` 1 s. `?migrate=0` turns it off for comparison.
- Left: the modes with bots, the crown and Control (phase 3), and the battle royale (phase 4).
- Checks: `tools/checks/net-delta.ts` (ten: the heir named to both guests, only the heir sent the keys, a host gone
  with no goodbye sends the heir for the code and the other back in, the takeover holds the other's seat and drops
  the old host, the other back on its seat with the heir as its host, deltas both ways again, the match going on,
  the next heir named, a goodbye handed on, and a match that cannot migrate still ending), and the e2e `migrate`
  section (three pages in a Free-for-all; the host's tab crashes; the heir is the host and the third page is back on
  its seat, the same match on both, three kills and the clock carried over), also run over the internet in `p2p`.

## Milestone 112 — Host migration, phase 3: the arena modes with bots, the crown and Control ✅
2026-09-19 (Phase 15). `modematch.ts`, `modes.ts`, `duel.ts`, `link.ts`, `tools/checks/mode-restore.ts` (new),
`tools/e2e.ts`.
- Every arena mode now outlives its host. The heir's snapshot carries what only the host had: each bot's index,
  tier, team, gun, respawn time and waypoint; when the crown appears, if it has not; and when Control's next bonus
  comes. The rest (where each bot stands and its health, the crown's carrier and hold, each zone's owner and value,
  the scores, the bonus and the lockout) is in the heir's own copy already.
- The heir makes each bot again where it last saw that bot's figure, with its health and shield, and the figure
  gives way to it, so nothing jumps on anyone's screen. A bot that was down comes back when its respawn was due.
  Bots are made in one place (`makeBot`) for the host at the start and for the heir.
- `Crown.restore` and `Control.restore` put the crown and the zones back as they stood, so the hold keeps counting
  to the same win, a zone held keeps scoring, and a lockout keeps its clock.
- Checks: `tools/checks/mode-restore.ts` (the crown carried through a takeover wins as the host's would have; one
  still waiting appears when the snapshot said; Control's zones and score run on exactly as the host's; a lockout
  keeps its clock), and the e2e `migrate` section in team deathmatch (seven bots, allies and foes) and Control
  (three), on mixed difficulty so each bot draws its own tier (the same bots, each with its tier and team, run by
  the new host and heard from on the other guest's screen; three zones on the new host). Both took over in 0.05 s
  and had the third player back in at 1.05 s.

## Milestone 113 — Host migration, phase 4: the battle royale ✅
2026-09-19 (Phase 15). `brmatch.ts`, `ring.ts`, `bots.ts`, `loot.ts`, `tools/checks/mode-restore.ts`,
`tools/e2e.ts`.
- A battle royale with friends now outlives its host, from the moment every bot is off the ship and down on the map
  until the match is decided. (A bot aboard or gliding in sends nothing a guest could put it back from, so the host
  names no heir until they are down.)
- The heir's snapshot carries each bot's tier, squad, waypoints, the kit it has looted (gun, magazine, mods, armour)
  and the heals and frags it still carries, and whether it is up, down (who knocked it and the bleed-out left) or
  waiting to redeploy; the damage record the Storm Surge ranks on and its clock; the care packages called; the
  placings; and the loot field's next key.
- The ring is not in it. Every browser draws the ring's plan from the seed, and a guest's view says the round, the
  state and the clock, so `Ring.restore` puts it where it was, waiting or part way through a close. The heir makes
  each bot again where it last saw its figure, with its kit and health (`Bot.restoreKit`), and the figure gives way
  to it. Bots are made in one place (`makeBot`) for the host at the start and for the heir.
- What is not carried: a bot's memory of where it last saw someone (it looks again) and its current loot target (it
  picks the next).
- The first full run caught a split brain on the tests' local transport: in the rejoin test only the guest's own
  link drops and the host is still there, but a BroadcastChannel lets any page listen on a code, so the guest (now
  an heir) "claimed" it and made itself host beside the real one. Over PeerJS the broker refuses a taken id, which
  is the whole of the heir's safety. The local hosting now asks the channel first whether a host still answers
  there, and treats a yes as the broker's refusal.
- While a named heir takes over, the others retry every `wait` second rather than every `rejoin.retry` seconds.
- Host migration's four phases are done. Measured over the internet (the e2e `p2p` section, the host's tab closing
  mid-match): the heir held the code 0.42 s later and the third friend was back in at 1.8 s. In the battle royale
  case the looted kits matched bot for bot, and the ring mid-close was within 0.03 s of where the host's would have
  been.
- Checks: `tools/checks/mode-restore.ts` (a ring rebuilt from the seed where a guest saw it, waiting or mid-close,
  early and late, runs in step with the host's to the end: twelve cases, exact), and the e2e `migrate` section's
  battle royale (a trio against two bot squads on mixed difficulty; the host's tab crashes mid-close with most bots
  armed; the same bots with their tiers, squads and kits, the ring where it was, and the third friend back in
  hearing the bots).

## Milestone 114 — Search: plant and defuse ✅
2026-09-19 (Phase 15). `modes.ts` (`Search`), `modematch.ts`, `hud.ts`, `audio.ts`, `duel.ts`, `main.ts`, `menu.ts`,
`index.html`, `src/config/modes.json` (`search`), `tools/checks/search.ts` (new), `tools/e2e.ts`.
- The genre's highest-tension format, built from the arena modes' parts: Crown's rounds with one life, Control's
  zones as the sites, and the round clock. Two teams of up to four (bots fill the sides, and friends can be split);
  sites A and B are the arena's Control zones A and C. The attackers plant by holding interact on a site for 4 s; the
  defenders run out the 1:45 clock, wipe out the attackers before a plant, or defuse by holding interact within
  2.2 m of the bomb for 7 s. The bomb goes off 40 s after it is planted. Letting go, stepping off, or going down
  starts a plant or defuse over. Attackers wiped out after a plant still leave the bomb to be defused. Team A
  attacks the first six rounds and team B after; first to seven.
- The rules are a class on their own (`Search` in `modes.ts`) that the host steps with who is where, who is up and
  who is holding interact, so the checks drive it bare. A guest tells the host when it holds interact or lets go
  (a `hold` effect the mode keeps for itself, through a new `onFx` hook, again every 0.3 s while it holds). The host
  sends the round in the `mode` packet (`sr`: phase, clock, the bomb's site and place, a plant or defuse under way,
  who attacks), ten times a second while someone is at work so the bar moves on every screen.
- On screen: the rounds, your job this round and the clock; once it is planted, the bomb's site and seconds in red.
  The prompt says HOLD E TO PLANT ON A or HOLD E TO DEFUSE where it would work, a bar over the crosshair shows a plant
  or defuse and whose it is, and the sites' letters stand in the world. The bomb is a case on the floor with a red
  light that blinks with its beep, a square tone where it lies, from 1 s apart to 0.12 s, higher in its last ten
  seconds.
- Bots: attackers take the round's site together and plant when they are on it; defenders split between the two
  sites; once the bomb is down the defenders go for it and the attackers guard it from a few metres off. A bot whose
  job is the objective (an attacker before the plant, a defender after it) makes for it and turns on an enemy only
  within `engage` metres (14). The first test run showed why: a bot goes at anyone it sees, and the attackers spent
  the round closing on a player across the map instead of planting.
- Host migration covers it: the heir rebuilds the round from its view, with the bomb and any plant or defuse.
- The numbers are the genre's (Counter-Strike and Valorant: a round of 1:40 to 1:55, a 3.2 to 4 s plant, a 5 to 7 s
  defuse, a 40 to 45 s bomb); teams of four and first to seven are ours, for a lobby of eight.
- Checks: `tools/checks/search.ts` (nineteen: the plant's time, the bomb's clock, going off, holding off a site,
  starting over, only attackers plant and only on their side of the swap, the defuse's time and reach and starting
  over, the clock, the wipes and the planted-bomb exception, the swap, the quickening beep, and a round rebuilt from
  a guest's view mid-defuse finishing at the same moment), and the e2e `modes` section (three a side; the prompt, the
  bar and the plant on A; the bomb beeping 0.32 s apart with 20 s left and 0.12 s with 2 s, and going off for the round; the clock running out for the
  defenders; after round six you defend, and the bots attack a site and plant on their own; you defuse it), and with
  a friend (the guest holds E on site B, both screens show its bar, the host plants the bomb for it, and the guest
  sees it).

## Milestone 115 — The vault, its keycard and its guard ✅
2026-09-19 (Phase 15). `br.ts`, `doors.ts`, `loot.ts`, `brmatch.ts`, `brplay.ts`, `main.ts`, `src/config/br.json`
(`vault`), `tools/e2e.ts`.
- Nothing on the map was locked, guarded or unique. Now the small building in the Well's yard is the vault: sealed
  (its window wall is solid), its one door locked, VAULT on the wall beside it. It is the same building in the same
  build order, so every door's index, which the door packets carry, is as it was.
- `Doors` can lock a door: it will not open, cannot be kicked in, and no bot takes it for a way through. The host
  opens it only for whoever holds the keycard, and the opening uses the card. A guest that hears the host open a
  locked door (the door message, or the ring packet's open list) unlocks it there.
- Its guard, THE WARDEN, is an elite bot made by the host after the squads' bots: on no side (team -1), at his post
  3.5 m in front of the door with a purple rifle, armour and a few heals. He fights whatever comes within 30 m of
  his post and walks back to it. He is left out of those counted as left, the bot squads, the ship, the pads and
  ropes, redeploys, and every check that decides the match, so he never holds a match open.
- His death box holds the `keycard` (a new loot kind; an older build does not see it). The host knows who took it,
  and drops it where its holder falls. The holder's page marks the way to the vault, renewed every 5 s, and the
  door's prompt changes from LOCKED to OPEN THE VAULT. The news (the guard is down, the keycard is on the floor, the
  vault is open) goes to every screen as a small effect a guest turns back into words.
- As the fight starts the host stocks the vault: two supply bins and a mythic gun, a care-package gun at gold mag
  with every attachment and its hop-up unlocked. Mythic is a flag on a legendary item, drawn and named in red, so an
  older build sees a legendary.
- Host migration carries the guard's post, the keycard's holder and whether the vault is stocked.
- The vault is off in Resurgence when its smaller area leaves the Well out. The tests turn it off (`__noVault`)
  where they count the bots, as they turn off the Gulag, and its own section turns it back on: the first run of the
  battle royale checks with the vault in counted the Warden three times over.
- Checks: the e2e `br` section's vault (the Warden elite, on no side, at his post, not on the ship, not counted; the
  mythic gun at gold mag and two bins inside; without the card the door says LOCKED, stays shut and cannot be kicked;
  the Warden down, his box holds the keycard and everyone is told; holding it, the way is marked and the door offers
  to open; E opens it and the card is used).

## Milestone 116 — Ability kits, phase 1: the ultimate, RUNNER and MEDIC ✅
2026-09-19 (Phase 15). `abilities.ts`, `main.ts`, `hud.ts`, `player.ts`, `duel.ts`, `src/config/kits.json` (new),
`src/config/binds.json` (`ultimate`: Z), `tools/checks/kits.ts` (new), `tools/e2e.ts`,
`docs/PLAN_ABILITY_KITS.md` (new).
- The two abilities are now the first two kits, each a tactical, a passive and an ultimate. RUNNER: JOLT; SURE
  FOOTING (no stun from a hard landing); OVERDRIVE (8 s of every move speed times 1.25, JOLT's charges refilled).
  MEDIC: PATCH (25 health over 3 s, every 18 s); TRIAGE (heals twice as fast); FIELD HEAL (60 health over 5 s for
  you and every team or squad mate within 10 m). The ids stay "jolt" and "triage", so the bots, the settings and the
  checks that use them are unchanged; the card shows the kit.
- The ultimate's meter fills with time alone in 150 s, and a point of damage dealt adds 0.0004 of it (2,500 damage
  is a meter), and is spent whole. It is kept through deaths and emptied by a new match. Z uses it; the HUD's gold
  ring beside the ability fills with it, glows full and counts down while the ultimate runs.
- FIELD HEAL goes to the others as an effect with where it was used; a team or squad mate's page within reach heals
  its own player, as every page runs its own health. An older build ignores the new effects.
- Health given back over time (PATCH and FIELD HEAL) works in any match with a health bar. The first run of the
  checks found it doing nothing in a bot match, which is its own class and not a `Duel`.
- Left for later phases: the bots' ultimates, the accelerant item, and four more kits (SCOUT, HOOK, SMOKE, WARD).
- Checks: `tools/checks/kits.ts` (eleven: no meter before a kit, full in 150 s by time, capped, spent whole, damage
  fills it, a new match and abilities off empty it, PATCH is MEDIC's and waits its cooldown, and the card's names
  and numbers), the e2e `bots` section (the meter fills in a match; OVERDRIVE's speed, refill and HUD; PATCH's 25
  health and cooldown; FIELD HEAL's 60), and the `modes` section with a friend (a MEDIC guest's FIELD HEAL heals the
  host beside them).

## Milestone 117 — Ability kits, phase 2: SCOUT, and the bots' ultimates ✅
2026-09-19 (Phase 15). `abilities.ts`, `duel.ts`, `modematch.ts`, `brmatch.ts`, `bots.ts`, `main.ts`, `hud.ts`,
`src/config/kits.json`, `src/config/binds.json` (`pickAbility3`: 7), `tools/checks/kits.ts`, `tools/e2e.ts`.
- A third kit, all sight. **SCOUT**: PULSE (F), every enemy within 40 m and inside 60 degrees of where you look
  shown in red for 2 s, every 12 s; SHARP EARS, an enemy firing within 45 m shown the same way; SWEEP (Z), every
  enemy within 60 m whichever way they are, for 6 s.
- An enemy shown glows red on the figure (the threat highlight the aim-bot practice already draws) and is marked for
  the squad through the ping path (a `scan` mark, one per enemy), so a friend sees the same contacts: in a battle
  royale on the map and the compass, and in the modes as the same red glow.
- A scan finds the bots this page runs itself as well as its remotes: a host keeps its bots outside the remotes, so
  `reveal` asks the match for its own figures (`ownFigures`, overridden by the arena modes and the battle royale).
- The bots now use their ultimates: a bot's meter is time alone (150 s), and it spends it the first moment it has
  someone to fight. A RUNNER bot moves 25% faster for 8 s with its dash charges refilled; a MEDIC bot heals itself
  60 over 5 s. Bots take only RUNNER or MEDIC: SCOUT's kit is sight, which a bot's own eyes already are.
- Checks: `tools/checks/kits.ts` (PULSE is SCOUT's and waits its cooldown; a bot never takes SCOUT; SCOUT's card and
  its numbers), and the e2e (the `modes` section: PULSE shows the bot 20 m in front and not the one 45 m behind,
  they fade after its seconds, and SWEEP shows both; the `bots` section: a RUNNER bot with a full meter and someone
  in front of it goes from 6.6 to 8.25 m/s).
- The threat highlight is drawn in one place, per frame, from the optic's range, and it wrote over a scan's glow: the
  match now says which figures are shown (`Duel.shown`) and that one place takes the brighter of the two.

## Milestone 118 — Ability kits, phase 3: HOOK ✅
2026-09-19 (Phase 15). `abilities.ts`, `traversal.ts`, `player.ts`, `main.ts`, `hud.ts`, `src/config/kits.json`,
`src/config/binds.json` (`pickAbility4`: 8), `tools/checks/kits.ts`, `tools/e2e.ts`.
- A fourth kit, all movement. **HOOK**: GRAPPLE (F), a line at whatever you look at within 30 m and a pull to it at
  24 m/s with a little lift, every 10 s; STRONG ARMS, half again as much climb space, so a climb reaches higher;
  ZIP LINE (Z), a zipline from where you stand to where you look, up to 45 m, for 90 s.
- A line that finds nothing in reach costs no cooldown, and says so.
- The zipline goes up on every page: the one who used it, and the others through its effect, so anyone can ride it,
  and it comes down when its time is up or the match ends. `traversal.ts deployZipline` puts a rope in the world and
  its line in `ZIPLINES`, which is what the ride reads, and hands back the way to take it down again.
- The grapple's line is drawn with the dash's streak, and the others see it through a `grap` effect.
- Checks: `tools/checks/kits.ts` (GRAPPLE is HOOK's, its cooldown, a miss costing nothing, and its card's numbers),
  and the e2e `bots` section (the climb passive at 1.5, a grapple that pulls you at 23.8 m/s and then waits out its
  cooldown; a ZIP LINE put up in play that comes down with the match).

## Milestone 119 — Ability kits, phase 4: SMOKE ✅
2026-09-19 (Phase 15). `smoke.ts` (new), `reveal.ts` (new), `abilities.ts`, `duel.ts`, `bots.ts`, `modematch.ts`,
`brmatch.ts`, `main.ts`, `hud.ts`, `src/config/kits.json`, `src/config/binds.json` (`pickAbility5`: 9),
`tools/checks/smoke.ts` (new), `tools/checks/kits.ts`, `tools/e2e.ts`.
- A fifth kit, all cover. **SMOKE**: CANISTER (F), a canister thrown at what you look at within 30 m that blooms
  into a cloud 11 m across for 18 s, every 14 s; THERMAL, an enemy standing in one of your clouds is shown to you;
  SCREEN (Z), three clouds in a line across your view, 9 m apart.
- A cloud blocks sight both ways: a bot cannot see through one (`bots.ts sees` asks `smokeBlocks`), and nor can
  anyone, because it is opaque. Bullets go through it: smoke hides, it does not stop, as in the game this follows.
- The clouds are their own small piece (`smoke.ts`), not a carried grenade: the canister flies for 0.55 s, blooms into
  a ball of puffs that swells over half a second and fades over its last two, and every page blooms its own from the
  two points the effect carries, so they stand in the same places everywhere with nothing more on the wire.
- The kits that show an enemy (SCOUT's scans, SMOKE's THERMAL) were built into `Duel`, so they did nothing in the
  offline bot practice, which is its own class: that work is now `reveal.ts`, which both hold, and the page asks the
  match for its kit sight rather than for a class. A kit is learned in the practice, so it has to work there.
- Checks: `tools/checks/smoke.ts` (eight: a canister blocks nothing in the air, its cloud blooms and blocks a line
  through it, a line past it or wide of it is not blocked, standing inside it everything is, the cloud and its puffs
  go when its seconds are up, and three of them block three lines), `tools/checks/kits.ts` (CANISTER is SMOKE's, its
  cooldown, and its card's numbers), and the e2e `bots` section (a canister between you and a bot: it cannot see you
  and THERMAL shows it; SCREEN throws three).

## Milestone 120 — Ability kits, phase 5: WARD, and the six kits done ✅
2026-09-19 (Phase 15). `walls.ts` (new), `abilities.ts`, `main.ts`, `hud.ts`, `src/config/kits.json`,
`src/config/binds.json` (`pickAbility6`: 0), `tools/checks/walls.ts` (new), `tools/checks/kits.ts`, `tools/e2e.ts`.
- The sixth kit, all cover held. **WARD**: WALL (F), a wall 4.2 m wide and 2.4 m tall up on the ground a few metres
  in front of you for 14 s, every 16 s; HARD SHELL, 5 shield a second once nothing has hurt you for 6 s; BASTION (Z),
  three of them in a horseshoe round you for 22 s.
- A wall put up in play is a real solid (`RANGE_SOLIDS`), so everything that already asks the world a question gets
  the right answer: bullets stop at it, bodies walk into it, bots path round it, and a figure behind it is out of
  sight. A wall at an angle takes the box round it, as every other solid is square to the world.
- It goes up on every page (the one who used it, and the others through its effect), and comes down when its time is
  up or the match ends.
- With it the plan's six kits are done: RUNNER, MEDIC, SCOUT, HOOK, SMOKE and WARD, each with a tactical, a passive
  and an ultimate, and the bots play RUNNER and MEDIC in full.
- Checks: `tools/checks/walls.ts` (nine: a wall stops a shot through where it stands, one past its end or over its
  top goes on, its solid is in the world once and goes with it, a wall turned 45 degrees has the box round it, and
  the horseshoe's three stand for their longer time), `tools/checks/kits.ts` (WALL is WARD's, its cooldown, its
  card), and the e2e `bots` section (a wall takes the bot's line to you away; the shield comes back out of a fight;
  BASTION puts up three).

## Milestone 121 — LOD step D: figures by distance ✅
2026-09-19 (Phase 15). `figlod.ts` (new), `src/config/lod.json` (new), `dummy.ts`, `mannequin.ts`, `loot.ts`,
`main.ts`, `tools/checks/figlod.ts` (new).
- Step D of `docs/PLAN_LOD_DRAW_DISTANCE.md`, the last of the big ones: a battle royale's bots cost more than its
  map, and every figure animated and cast a shadow every frame however far away it was.
- The page says once a frame where it is looking from and what it can see; each figure asks what it owes at that
  distance (`figlod.ts`): its animation every frame within 30 m, every second frame to 80 m, every fourth beyond,
  and not at all off screen past 20 m. A figure that sits a frame out keeps the time and hands it to its mixer on the
  next one it plays, so nothing drifts, and the frames are spread by each figure's own number so they do not all
  animate on the same one.
- A figure casts a shadow only within 60 m. Past 15 m its gun is the one merged mesh the floor guns already use
  (`loot.ts floorGun`), in place of the full model's eleven to fifteen, on the rig's hand as well as the plain
  figure's. The muzzle's marker stays visible through the swap, so a shot from across the map still flashes.
- Nothing here changes what a bullet hits: the hit boxes come from the figure's own boxes, not from the animation.
- Measured at `BENCH_SPOT=brmatch` (a solo battle royale on seed 42, ten bots round the hub), against the same spot
  on the build before it: **High 167 to 185 fps, 799 to 599 draw calls, 2.39M to 1.99M triangles**; Competitive 278
  to 286 fps (its shadows are drawn once, so the gain there is the animation's).
- The first run showed no gain at all on Competitive: the merged gun was being put in the plain figure's gun slot,
  while a rigged figure holds its gun on the mannequin. With both roots covered, High's draw calls fell by 200.
- The plan's frustum culling for figures was left out: a skinned figure has no reliable bounds without computing
  them, and a figure popping out of view is worse than the calls it saves. The off-screen animation skip gives most
  of the same gain.
- Checks: `tools/checks/figlod.ts` (ten: the three bands, two far figures taking turns, off screen past 20 m and
  within it, the shadow and gun distances, and everything on before the page has said where it looks from), and the
  e2e `bots`, `br` and `squad` sections (155 checks) for the figures, knocks and revives.

## Milestone 122 — The gun's hands in one mesh each ✅
2026-09-20 (Phase 15). `arms.ts`, `tools/checks/viewmodel-arms.ts`.
- The last of the draw calls the LOD plan named: the hands in front of you were about seventy-five meshes of
  capsules and spheres in the gun's own pass, and none of them ever moves against another. Each hand is now merged
  into one mesh per material as it is built (`mergeByMaterial`), keeping the shared materials, so Settings' arm
  colours still reach them and the wrist is where the forearm looks for it.
- Measured in the range against the build before it: **497 draw calls to 421** (the 76 the plan predicted),
  Competitive 400 to 435 fps, High 227 to 256 fps.
- Checks: `tools/checks/viewmodel-arms.ts` (a hand is four meshes, one per material, still hand-sized and with its
  wrist where it was).
## Milestone 123 — The bots' planned rope routes ✅
2026-09-20 (Phase 15). `br.ts`, `navgraph.ts`, `brmatch.ts`, `tools/checks/bot-walk.ts`, `tools/e2e.ts`.
- Until now a bot took a rope only where its walk happened to bring it to one whose far end was nearer its goal
  (Milestone 107). The ropes are now steps on the bots' graph: each zipline's two ends are joined to the nodes
  nearest them (within 22 m and on their floor) as a **rope step**, kept apart from the walking links, because
  walking a rope's line would be a fall.
- The walk to the ring (`navgraph.ts`) plans through them like any other step, and a bot whose next step is a rope
  rides it from that end whichever way the ring happens to lie: the graph chose that step for the distance it saves.
  Five of the map's thirteen ropes have a node at both ends, which is six nodes and ten rope steps.
- Checks: `tools/checks/bot-walk.ts` (the ropes are on the graph both ways round, a rope step is never also a
  walking link, every one of the 113 nodes still reaches each of the 21 ring targets along the graph's own steps,
  and a route with a rope on it is one step where the walk round is three), and the e2e `br` section (a bot whose
  route plans through a rope rides it and lands 0.2 m from its far end).

## Milestone 124 — The field in rock, scrub and cliff ✅
2026-09-20 (Phase 15). `props.ts`, `br.ts`, `main.ts`, `tools/checks/scenery.ts` (new), `tools/snap.ts`.
- The last of `docs/NEXT_STEPS.md` item 8, and the biggest "this looks like a game" jump left: the field's cover is
  the Poly Haven rock scans already fetched (three boulder sets), the open ground carries dead quiver trunks,
  branches and dry twigs, and the cliff that walls the map in has rock faces along its four edges, each a different
  size and turn and set a little into the wall.
- `props.ts placeInstanced` draws them: one instanced mesh per mesh of a model per cell of the map (64 m), each with
  its own bounds, so what is behind you is culled. The scrub casts no shadow, the cliff faces none either, and
  beyond a distance a cell is not drawn at all: 170 m for the rocks, 260 m for the faces, 150 m for the scrub.
- A rock is cover, so it may never simply vanish: past its distance the boxed shape the map already drew comes back
  in its place (`standIn`), which is a few hundred triangles instead of tens of thousands.
- The colliders are the map's own boxes, untouched, so movement is exactly as tuned, and a checkout without
  `npm run models` still gets the boxed rocks it always had.
- Measured at High with the scans in view: the hub 278 to 256 fps. Drawn whole and always (no cells, no distance,
  shadows on everything) the same view was 29.7M triangles against 9.2M; the cells and the stand-ins are what make
  the scans affordable.
- Checks: `tools/checks/scenery.ts` (every rock has its box and a boxed stand-in, the scrub is in its three kinds
  and never on a road or in a place, and the faces lie along the four edges), and the snapshots `br-rocks` and the
  new `br-field`.

## Milestone 125 — The bots ride the balloons ✅
2026-09-20 (Phase 15). `brmatch.ts`, `src/config/bots.json` (`squads.towerGain`), `tools/e2e.ts`.
- The last of the map's ways across it that the bots did not use. A bot standing at a jump tower with more than
  110 m still to go rides the balloon and glides for its goal, the way a player does (`leaveShip`, the same glide
  the drop uses); under that it walks, because the ride costs it the climb and the fall. Not while it has someone
  to fight, and a follower only takes a tower its lead is already past, so a squad is not scattered by one.
- Checks: the e2e `br` section (a bot at a tower with a long way to go is 67 m up and lands 78 m away).

## Milestone 126 — LOD steps B and E: a draw distance per preset, a budget to draw inside, and a sky over the map ✅
2026-09-20 (Phase 15). `src/game/quality.ts`, `src/main.ts`, `tools/bench.ts`, `tools/snap.ts`, `tools/checks/render-budget.ts` (new), `tools/verify.ts`, `tools/e2e.ts`.
- The last two steps of `docs/PLAN_LOD_DRAW_DISTANCE.md`. **Step E:** the camera's far plane was a flat 400 m while
  the open map's fog ran to 680 m and its corners are 622 m apart, so a ridge in clear air was cut off at a seam
  that travelled with you. There is now a draw distance per preset (Competitive 460 m, Balanced 620, High 760): the
  fog ends where the preset stops drawing, its near end keeps its proportion so the fall-off keeps its shape, and
  the far plane sits 60 m past the fog's end, where everything is already fogged to nothing.
- A region whose own fog is shorter than the preset draws keeps its own fog, so the firing range still ends at
  290 m on High. The maths is one pure function, `drawRange()`, which is why it can be asserted exactly.
- **Drawing further has to mean drawing more.** The map is merged into meshes that span the whole of it, so nothing
  in it is culled by how far you asked to see: on its own the draw distance moved the fog and left the work
  identical. The distances the field's scenery is drawn to (a rock's scan 170 m, a cliff face 260, a dead branch
  150, tuned on Balanced) now scale with the preset, which is what makes Competitive cheaper than Balanced at the
  same view: 598k triangles to 391k from the map's corner, with the boxed rock standing in beyond 126 m.
- The cost of never clipping in clear air, from that corner: about ten more draw calls a preset, and 60k more
  triangles on Balanced. The frame rates are not worth quoting at this view (repeats of one configuration came back
  between 417 and 667 fps, a spread wider than the change); the table in the plan says so and gives the counters.
- **The battle royale had no sky.** The new picture of the map's corner came back with the world under pure black.
  The sky dome is built by the range, so the region split of Milestone 100 put it on the range's side of the world
  and hid it the moment you were on the map. The fog still took its colour, so the ground faded into haze and
  nothing looked broken until something was photographed against the horizon. The dome stays on the scene now, as
  the sun and the fill light already did, and it follows the camera wherever it goes. Live since Milestone 100,
  which is nineteen milestones of battle royale played under a black sky.
- Checks: `tools/checks/render-budget.ts` (twelve), the e2e `br` section (the draw distance read back out of a page,
  and the sky over the map), and a new snapshot `br-far`, the view the whole thing was written for.
- **The benchmark had been measuring the map under the range's fog.** Nothing on the `br` and `brmatch` spots starts
  a match, and the fog and the shadow box follow the region you are playing in, so every number ever taken on the
  map was taken with a 290 m fog over it. The spots now set the region themselves, and a new `BENCH_SPOT=brcorner`
  stands 36 m over one corner looking diagonally across the whole map: the longest sightline in the game.
- **Step B:** `tools/checks/render-budget.ts` builds the map in node, merges its static meshes as the page does, and
  holds it to a budget: 190 meshes after the merge (125 today, from 3,496 before it), 330k triangles (237k today),
  the field's scenery a few hundred copies, and the merge has to take the mesh count down by at least three times.
  That last one is what would have caught
  Milestone 100's doubled map, which only a profiler could see. The draw-distance arithmetic is checked preset by
  preset, and the e2e's `br` section reads the numbers back out of a real page (`__range.viewRange()`), so the
  wiring is checked as well as the maths.

## Milestone 127 — B00G's FPS: Full Power Surge, the title card ✅
2026-09-20 (Phase 15). `src/ui/intro.ts` (new), `src/config/intro.json` (new), `index.html`, `src/main.ts`, `tools/checks/intro.ts` (new), `tools/verify.ts`, `tools/e2e.ts`, `tools/snap.ts`, `tools/bench.ts`.
- Asked for by the owner: a card at the door. Green rain falling at its own speed in every column, the game's name
  smashed in over it from two and a half times its size with a green and a cyan copy a few pixels either side, and
  then a shot through the middle of the screen: a flash, a kick, a bullet hole, thirteen cracks running out to the
  edges with rings of glass between them, and the pane falling away in shards into the game behind it. Corner
  brackets, scan lines and a sweeping refresh line round it off.
- It plays when the page opens and again, shorter (1.5 s against 2.6 s), as you drop into any match. `wireMatch` is
  the one door every match goes through, so nothing had to be wired mode by mode.
- **It never gets in the way.** The canvas takes no pointer events, the match starts underneath it and nothing waits
  on it, a key or a click takes the rest of it, `?nointro` turns it off, and it takes itself off the page when it is
  done. The name is in the page as text as well, for a screen reader.
- **Where it starts mattered.** Started with the page it ran its beats through the first seconds of loading, which
  are one long stutter of models and textures being decoded: a card nobody sees. It now starts on the frame the
  loading screen finishes, where the frames are steady. Measured over a card: 605 frames, 4.2 ms median, worst 17 ms.
  Getting there meant warming the sound (the first noise a page makes costs 50 ms to build its graph, and that fell
  on the frame of the shot) and the letters (a font is rasterised at the size it is drawn, so both ends of the smash
  are drawn once where nobody looks), and drawing the crack's glow as a wide soft stroke rather than a canvas blur.
- The break and the rain are worked out from a seed, so the same card draws the same picture: that is what makes the
  snapshots worth comparing and the checks able to hold it.
- Accessibility: `prefers-reduced-motion` gets a shorter card with no shake, no flash and no falling glass.
- Checks: `tools/checks/intro.ts` (16: the beats in order, the match card the short one, the same seed breaking the
  glass the same way, every crack starting at the hole and running off the pane, a shard for every crack, the rain
  covering the width at its own speed per column), the e2e `intro` section (9, including the reduced-motion card and
  that the menu underneath is live while the card plays), and three snapshots: `intro-title`, `intro-crack`,
  `intro-shards`.

## Milestone 128 — The card is the loading screen, and the rest of the magazine ✅
2026-09-20 (Phase 15). `src/ui/intro.ts`, `src/config/intro.json`, `src/ui/loading.ts`, `src/main.ts`, `tools/checks/intro.ts`, `tools/e2e.ts`, `tools/snap.ts`.
- The owner's notes on Milestone 127, in order. **The loading screen is gone from under it**: the card starts on the
  first drawn frame, the bar, the brand and the tip step off the page, and how much of the world is in is drawn as
  the line under the name. The card then holds at the moment of the shot, rain still falling, until the world is in
  (14 s at the outside), so the animation covers loading instead of playing after it.
- **Three seconds longer, and a burst.** 2.6 s to 5.7 s: the name lands at 0.5, the first round goes through at 1.9,
  a beat of quiet, and from 2.75 the rest of the magazine, eleven rounds over two and a bit seconds, each its own
  hole with six short cracks of its own and its own kick of the picture. The pane lets go at 5.0 and the shards
  carry every hole and crack down with them.
- The card into a match keeps its proportions at 2.3 s: a shot, a beat, three rounds, gone.
- Performance, which the owner asked about: the card's own frames are 4.2 ms median and 4.8 ms at the 95th over
  1,018 of them, the burst costing nothing measurable. The hitches left in a first load (one of about 120 ms) are
  the world's models and textures being decoded while the card holds, which is work that used to happen under a
  static bar instead.
- Checks: `tools/checks/intro.ts` is 20 now (the burst in order, inside the beat, never twice in one place, local to
  its hole, the same from the same seed), the e2e `intro` section 11 (it stands in for the loading screen, and the
  shot waits for the world), and the three snapshots are retaken on the new beats.
## Milestone 129 — The crosshair over the shoulder, a red dot on every loadout, and a diary ✅
2026-09-20 (Phase 15). `src/game/hud.ts`, `src/game/loadout.ts`, `src/game/attachments.ts`, `src/main.ts`, `tools/verify.ts`, `README.md`, `docs/updates/` (new), `docs/NEXT_STEPS.md`, `docs/PLAN_MOVEMENT_CHAIN.md` (new).
- **Aiming in third person kept the crosshair.** The crosshair goes when you aim, as it does in Apex, because the
  gun's own sights replace it. Over the shoulder there are no sights on the screen to replace it with, so aiming
  left nothing to aim with. It stays now whenever the camera is behind you.
- **Every loadout's guns come with a red dot.** Nobody builds a class and leaves it on irons. A loadout's guns are
  fitted with the 1x holo, or whatever 1x that gun can take, when the loadout is built and when a gun is swapped
  into a slot; a gun with its own scope (the snipers) keeps it and a gun that takes no optic gets none. The floor
  loot of a battle royale is untouched: what you find is still what you find.
- **`docs/updates/`**, one file a working day: what shipped, what it cost, what was found on the way, what is next.
  The diary beside the roadmap, because the roadmap says what a feature is and not what a day was.
- **The ranked list against AAA, rewritten** (`docs/NEXT_STEPS.md`, "2026-09-20"): twenty items, with the three
  things that still separate this from a shipped game named plainly (the feel between the inputs, the chain, and
  recorded audio), and **`docs/PLAN_MOVEMENT_CHAIN.md`**, the plan for the first of them.
- The README's opening, which is the first page of the screen in the firing range, now describes the game as it is
  rather than as it was ten milestones ago.
- Checks: `npm run verify` (a loadout's gun starts on the red dot, the sight is really in the mod chain, a swap
  resets to it, a scoped gun is left alone).

## Milestone 130 — PAINT: the movement chain ✅
2026-09-20 (Phase 15). `src/config/paint.json` (new), `src/game/throwables.ts`, `src/game/player.ts`, `src/game/hud.ts`, `src/main.ts`, `src/config/names.ts`, `src/config/loot.json`, `src/config/throwables.json`, `tools/checks/paint.ts` (new), `tools/movesim.ts`, `tools/e2e.ts`, `tools/snap.ts`, `docs/PLAN_MOVEMENT_CHAIN.md`.
- The first item of the new ranked list, and the owner's ask: *"the other shooter that had really good movement recently
  was Empulse. They had like speed grenades / paint where you boosted speed and could chain movements together."*
- Two bombs in the grenade slots that splash paint over whatever they hit, floor or wall: **orange** raises your top
  speed by a third and your acceleration by half while you are on it, **blue** sends a jump that leaves from it 1.6
  times as high. Both are ordinary throwables, so G reaches them, the arena kit gives one of each, the battle
  royale's floor has them, and the ability kits are untouched.
- **The carry is the mechanic.** The speed boost decays over 1.2 s after you leave the paint rather than ending with
  it, so a run over the orange into a slide into a jump is one movement. Measured in the simulator, which drives the
  real controller: a sprint on the paint is 1.33x a sprint, and a slide-jump off the end of a patch leaves at
  337 hu/s against a 260 hu/s sprint. The jump boost is all or nothing inside a 0.12 s grace, so the jump you meant
  counts and the one a second later does not.
- Nothing changes with no paint down: an ordinary jump is still exactly 56 hu and every Apex rule in
  `docs/MOVEMENT_AUDIT.md` still measures the same. The boosted speed stays far under the 1200 hu/s lurch cap, so
  air control is Apex's.
- The speed readout on the HUD turns the colour of the paint you are carrying, because a boost you cannot see is a
  boost nobody chains.
- Checks: `tools/checks/paint.ts` (17: the patch, the lookup through floors and walls, the decay, the grace, and
  that the numbers are worth chaining), `tools/movesim.ts` (five, in the real controller), the e2e `throw` section
  (the bomb paints, the boost carries, the HUD says so), and the snapshot `paint`.

## Milestone 131 — The camera that moves with the body ✅
2026-09-20 (Phase 15). `src/config/player.json` (`feel`), `src/game/player.ts`, `src/main.ts`, `tools/checks/feel.ts`, `tools/e2e.ts`.
- Step B of `docs/PLAN_MOVEMENT_CHAIN.md`, and the other half of what "buttery" means: the movement numbers were
  already Apex's rule by rule, and what was missing was everything between the inputs.
- Four pieces, all small on purpose: a **slide lean** of up to 5.5 degrees into the way the slide is carrying you,
  in over 0.12 s and out over 0.25; a **landing roll** of up to 3.2 degrees by the sideways speed you came down
  with, gone in a third of a second; a **lurch kick** of 2 degrees that settles in 0.18 s, so a tap-strafe has a
  weight to it; and a **boost pull** while paint is carrying you, 1.4 degrees forward with the view 2.5% wider, so
  speed reads on the screen and not only on the ground. The sprint's own settle was already eased rather than cut,
  so it needed nothing.
- **None of it moves the aim.** Every piece is applied to the camera's roll, pitch offset and field of view, never
  to the player's yaw or pitch, and the e2e drives a real diagonal slide in a real page and checks both halves: the
  camera leans to 98% of its full lean and comes back to nothing, and the angles the shot uses do not move by so
  much as a floating-point step.
- Settings' Sprint view shake is the switch: Normal is all of it, Minimal 40%, Off none. It already said what it
  meant, so a second switch would have been a second thing to find.
- Checks: `tools/checks/feel.ts` (six: every piece is the size of a camera move and not a stumble, and nothing
  lasts long enough to be a state you live in) and the e2e `range` section (two, above).
## Milestone 132 — The mantle boost, and an audit that tells the truth ✅
2026-09-20 (Phase 15). `src/game/player.ts`, `src/main.ts`, `index.html`, `tools/movesim.ts`, `docs/MOVEMENT_AUDIT.md`, `README.md`.
- Step C of `docs/PLAN_MOVEMENT_CHAIN.md`, half of which turned out to be built already. **The wallbounce is in**,
  with the wiki's own dismount numbers, and has been since the map work; the audit's "not implemented" list was two
  months stale and now says what is actually true.
- **The mantle boost**, the game's own setting of that name, is new: with it on, holding jump through the end of a
  mantle superglides for you. The real window is one frame after the jump, about seven milliseconds at 144 fps,
  which is a wall rather than a skill for a lot of people. Off by default, because the window is what the superglide
  trainer and the crosshair cue exist to teach, and what it hands you is the same superglide (400 hu/s), not a
  better one.
- Checks: `tools/movesim.ts` (holding jump into the end of a mantle superglides with the setting on, does nothing
  with it off, and leaves at a superglide's speed either way).

## Milestone 133 — One shotgun instead of a strobe, and rain that says nothing ✅
2026-09-20 (Phase 15). `src/ui/intro.ts`, `src/config/intro.json`, `tools/checks/intro.ts`, `tools/e2e.ts`, `tools/snap.ts`, `README.md`.
- The owner's notes on the card, all three. **The rain opened by drawing the word "undefined"**: every column's
  glyphs were only filled on the first swap, a twentieth of a second in, and until then each column held an empty
  array whose missing character the canvas printed as a word. They are laid out with the columns now, and the draw
  has a character to fall back on whatever happens.
- **The eleven rounds are one shotgun.** A string of single rounds read as a strobe: one flash, then another, then
  another. It is one blast now, fourteen pellets through the pane in the same instant with one flash and one kick,
  each pellet its own hole and its own short cracks, so the first rifle round stays the break that carries the
  glass and the shotgun is what finishes it.
- **And the card is 1.8 s shorter**, 5.7 s to 3.9 (the match card 2.3 to 1.85), which is what the single blast
  bought: the beats it used to spend on the burst are gone.
- Checks: `tools/checks/intro.ts` (the pattern goes through at once, no two pellets in the same place, spread over
  the middle rather than heaped in it, local breaks, the same from the same seed, and the whole card under four
  seconds), and the three snapshots retaken on the new beats.

## Milestone 134 — The bots play four kits ✅
2026-09-20 (Phase 15). `src/game/bots.ts`, `src/game/abilities.ts`, `src/config/abilities.json`, `src/game/brmatch.ts`, `src/game/modematch.ts`, `tools/checks/kits.ts`, `tools/e2e.ts`, `README.md`.
- Item 8 of the ranked list: six kits, and the bots played two of them. They play four now. **SMOKE and WARD's
  cover** is the readable half of each from the other end of a fight: hurt (under 65% health), with whoever is
  shooting them between 4 and 42 m away, a SMOKE bot throws a cloud between the two of you and a WARD bot puts a
  wall up a couple of metres in front of itself, and then it moves. Nine seconds between one and the next, so a bot
  breaks a line of sight it is already losing rather than fencing itself in.
- Not SCOUT, whose whole kit is sight that a bot's eyes already have, and not HOOK, whose grapple is a route a bot
  would have to plan rather than a thing it can use where it stands.
- The decision is `coverPlan` in `bots.ts`, free of the scene, so the checks ask it directly; what a bot puts up
  goes out through the same path a thrown frag does, so it is drawn on every screen in a match, not just the host's.
- Checks: `tools/checks/kits.ts` (seven: what each kit puts up and where, and the three cases where it does not) and
  the e2e `bots` section (a hurt SMOKE bot's cloud goes up in a real match, and what a WARD bot puts up reaches the
  world).

## Milestone 135 — The shotgun's pattern, out across the pane ✅
2026-09-20 (Phase 15). `src/config/intro.json`, `src/ui/intro.ts`, `tools/checks/intro.ts`, `tools/snap.ts`, `README.md`.
- The owner's note on Milestone 133: the blast was heaped in the middle of the screen, over the name, and each
  pellet broke the glass nearly as hard as the rifle round had. The pattern is eighteen pellets now, thrown out
  over 95% of the screen with the middle 42% of that kept clear, so it lands round the name rather than on it and
  the rifle round's own hole stays the one in the centre. Each pellet is a smaller hole (5 px against 13) with four
  short cracks at 7.5% of the first shot's length: 202 px against 2,618.
- Checks: `tools/checks/intro.ts` (the pattern keeps off the middle, is thrown out across the pane, and a pellet's
  cracks are under a quarter of the rifle round's), and the two snapshots retaken.
## Milestone 136 — Out, and watching whoever is left ✅
2026-09-20 (Phase 15). `src/game/duel.ts`, `src/game/brmatch.ts`, `src/game/modematch.ts`, `src/game/bots.ts`, `src/game/hud.ts`, `src/main.ts`, `tools/e2e.ts`, `README.md`.
- Item 7 of the ranked list. Being out of a battle royale already put you behind somebody's shoulder, but it was
  whoever the match picked, it changed under you as people died, and there was no way to look at anyone else. Eight
  friends on a ten minute match means a bad landing is ten minutes of nothing.
- A match now offers a **list** of everyone worth watching (`spectateList`), friends first and then the rest in the
  order of how near they were to where you fell, bots included, each with a name. The page keeps its place in it,
  so you stay with whoever you chose until they are out; **fire takes the next and aim the one before**, the
  third-person key still swaps between their eyes and just behind them, and the HUD says whose view you are in and
  where you are in the list ("2 of 6").
- Checks: the e2e `brsolo` section (out of a solo battle royale with six still standing, the HUD names the first of
  them and a click moves you along).

## Milestone 137 — A recorded action under every shot ✅
2026-09-20 (Phase 15). `src/config/audio.json` (`recorded`), `src/game/audio.ts`, `tools/fetch-sounds.ts`, `tools/checks/feel.ts`, `README.md`.
- The first half of item 2 on the ranked list, and the owner's own next step: every gun in the game was made of
  oscillators. A gun's attack is a mechanism as much as a crack, and the mechanism is the part no filter and no
  envelope gets right, so a CC0 take of a metal action (Kenney, four takes) is now mixed under the attack of every
  shot, quietly, at a rate per class: an SMG's action is quick and bright at 1.5, an LMG's slow and heavy at 0.9.
- The crack, the body and the tail stay synthesised, and the layer is at half the class's own level: it is there to
  be felt on the attack rather than heard as a second sound. Far-off gunfire skips it, as it skips the crack, since
  the air takes both.
- A checkout that has not run `npm run sounds` plays nothing extra and sounds exactly as it did.
- **What is left of the item**: recorded cracks per weapon class. There is no CC0 gunshot set with a stable address
  that I could verify, and picking one is a judgement by ear rather than by licence, so it waits on the owner.
- Checks: `tools/checks/feel.ts` (the layer is under the shot and not the shot, every class has a rate, and a
  heavier gun's action is slower than a lighter one's).

## Milestone 138 — A card in the gap between rounds ✅
2026-09-20 (Phase 15). `src/game/hud.ts`, `src/game/duel.ts`, `src/game/modematch.ts`, `tools/e2e.ts`, `docs/NEXT_STEPS.md`.
- What was actually missing from item 6 of the ranked list, once the list was checked against the code: the modes
  have a clock and a round-end intermission already, and what that gap showed was a banner saying ROUND WON and
  nothing else. It carries a card now: every player in the round just played, your side first with your own row
  lit, and what they did (kills and deaths).
- Checks: the e2e `modes` section (the gap between Crown's rounds carries a row per player with both columns
  filled, and your own row among them).
## Milestone 139 — The two missing boards ✅
2026-09-20 (Phase 15). `src/game/leaderboard.ts`, `src/main.ts`, `src/ui/menu.ts`, `server/game/serve.mjs`, `server/game/boardrules.mjs`, `tools/checks/boards.ts`, `README.md`.
- Item 10 of the ranked list. Fifteen boards, and every one of them counted how much you had played: course times
  and win totals. The two that were missing are the two that reward a good night rather than a long one, **most
  kills in a match** and **most damage in a match**, posted from the match's own summary the moment it ends, with
  the HUD saying so for a top ten.
- **They needed a rule of their own.** A wins board is safe because the server counts the posts rather than
  trusting the total (a forged 99,999 moves a name one win). A personal best cannot be counted that way, so it is
  bounded instead: the server keeps the higher of what it has and what was posted, and refuses anything above what
  a match can produce (60 kills, 20,000 damage).
- Checks: `tools/checks/boards.ts` (the new rule keeps the best, ignores a worse match and refuses a forgery, and
  every board the game posts to is one the server keeps).

## Milestone 140 — The ping wheel ✅
2026-09-20 (Phase 15). `src/game/brplay.ts`, `src/main.ts`, `src/game/hud.ts`, `src/config/squad.json`, `tools/checks/pingwheel.ts` (new), `tools/verify.ts`, `tools/e2e.ts`, `README.md`.
- Item 11 of the ranked list. One ping marked a place, an enemy or an item, and said nothing about why. **Holding**
  the ping key now opens Apex's wheel: going here, attacking here, watching here, enemy here, need ammo, defending
  here. A tap still does what it always did, so nothing anyone has learned changes.
- **A plan outlives a warning**: an enemy call stays up 6 s, attacking and watching 14, ammo 16, defending 20. A
  mark about this second and a mark about the next minute are not the same thing and should not live the same
  length of time.
- The marks go out through `sendMark`, which already carried a label, so a squad mate sees the words you chose
  without a new message on the wire.
- Checks: `tools/checks/pingwheel.ts` (12: the wheel says what a squad has to say, in words rather than symbols,
  every slice can be picked and the middle picks none, and every intent has a life with a plan outliving a
  warning) and the e2e `squad` section (the real middle button held opens it, and what it marked reaches the host
  in the words it was marked with).
## Milestone 141 — The pack, held open on Tab ✅
2026-09-20 (Phase 15). `src/config/binds.json`, `src/game/hud.ts`, `src/main.ts`, `tools/e2e.ts`, `tools/snap.ts`, `README.md`.
- Item 12 of the ranked list, whose premise was wrong in the same way two others were: it said "Tab shows a list",
  and Tab showed nothing at all. What a player had was one HUD row of heals and grenades, and no way to see the
  other gun's ammo, the build on the gun in hand, or what armour they were wearing without taking it off.
- **Hold Tab** now for everything at once: both guns with what is in the magazine and the ammo behind it, the build
  on the one in hand, the heals, the grenades, the ammo by kind and the shield and helmet. Read only on purpose:
  dropping and swapping are done where the item is, and what a player needs mid-match is the answer to "what have
  I got".
- Checks: the e2e `throw` section (holding Tab shows both guns, the build in hand and the ammo; letting go puts it
  away) and the snapshot `inventory`.
- Found by the suite while this was in it: the ping wheel moved the ping from the press to the release, and the
  controller's double tap stopped meaning "enemy here" whenever the first tap had already marked a figure. That
  refusal was deliberate once (a precise mark should not be replaced by a vague one) and is wrong: a player who
  taps twice has said what they mean, and which of the two marks they get should not depend on whether a bot
  happened to be under the crosshair. A double tap always means an enemy now.

## Milestone 142 — The hot zone, where anyone can see it ✅
2026-09-20 (Phase 15). `src/game/brmatch.ts`, `src/game/hud.ts`, `src/main.ts`, `tools/e2e.ts`, `README.md`.
- Part of item 9 of the ranked list, and another one the code had half-built: every match has drawn a **hot zone**
  from its seed since the loot field existed, one of the nine places filled with guns that come built (nineteen of
  them in the match the check runs). Nothing ever showed it. A hot zone nobody can see is not a decision, it is a
  secret the match keeps from everyone in it.
- The match now carries it in its HUD packet, so a guest has it too; **the map rings it in dashed gold** and the
  drop names it a moment after it says where you are landing.
- Checks: the e2e `loot` section (the match kitted one of the places out, the name is a place's own, and the guns
  lying in it came built).
## Milestone 143 — Captions for the sounds that matter ✅
2026-09-20 (Phase 15). `src/game/captions.ts` (new), `src/config/captions.json` (new), `src/game/audio.ts`, `src/game/hud.ts`, `src/main.ts`, `index.html`, `tools/checks/access.ts`, `tools/e2e.ts`, `README.md`.
- Item 14 of the ranked list, whose colourblind palettes and HUD scale were already done (four vision modes, six
  scales). What was left is the half nothing covered: **a player who cannot hear is playing a different game**. A
  door two rooms away, a reload behind a wall, a zipline over the roof: none of it is on the screen anywhere.
- The sounds worth acting on are written down as they play, in the words a player would use, with which way they
  came from and roughly how far: "DOOR  LEFT  NEAR". The direction is measured off where you are looking rather
  than off north, because a caption is read while looking at something and a compass bearing would have to be
  translated by the person reading it: turn round and the same sound swaps sides.
- Three settings: off, the ones that mean somebody is near you (footsteps, doors, bins, gunfire, blasts, reloads,
  heals, revives, ziplines, knocks), or everything the game can caption. A run of footsteps is one line that stays
  up rather than eight that scroll, and a line goes after four seconds.
- The mixer only says what it played and where from (`audio.onCue`); the words, the direction and the list are the
  captions', and the drawing is the HUD's, which is what lets the checks ask the questions that matter without a
  browser.
- Checks: `tools/checks/access.ts` (10 more: the sides are the screen's sides whichever way you face, the distance
  bands are words, a run is one line, off is off, and the important list is the short one) and the e2e `throw`
  section (a door and a gunshot in a real page are written down from opposite sides, and off writes nothing).

## Milestone 144 — One place to start a match ✅

The Play tab was fourteen buttons and nothing else. Every choice those buttons obeyed (which map, how many
bots, how good they were, the squad size, what the ring does) lived on a tab called **1v1**, in three boxes
that had nothing to do with each other. Playing a battle royale with a friend meant opening the 1v1 tab,
changing a box that said "Arena: 1v1 / 1v1v1" to the battle royale, scrolling past two boxes that were about
something else to the one that was not, and only then making the match. The owner said it plainly: "having to
pick the 1v1 tab and then change to BR to play with a friend is kind of bad."

- **The lobby.** The modes are a list down one side. Picking one opens that mode's own options beside it, and
  only that mode's: the arena asks which of the five maps, how many bots and how good; the battle royale asks
  the squad size, the rules, the bot squads, the ring's pace and what you land with; the range asks about its
  dummies; the courses ask nothing, because they are one button each. Then one green button starts it.
- **With friends is the same panel.** The button next to it makes the match on exactly those settings and
  copies the invite link, translating the mode across on the way (the thing the player used to do by hand).
  A 1v1 is the one mode that has no green button, because there is nobody to play.
- **The ring has a pace** (`src/config/ring.json` `pace`): slow, normal or fast, multiplying every wait and
  close while the circles and the damage stay where they are, so a fast match is a shorter one and not a
  harder one. It travels in the host's welcome packet, because a guest on another clock would be standing
  outside a ring nobody else can see. Resurgence's own faster clock multiplies on top.
- **Boarding the dropship no longer throws the map over the screen.** The first thing anyone saw of a match
  was a map with the ship, the sky and the island behind it (`src/config/squad.json` `dive.mapOnBoard`). The
  minimap and the ship's own line say where it is going, and M opens the big one. A redeploy straight into
  the sky keeps its two-second glance.
- Nothing moved but the controls themselves: every box kept its id, so what reads it is unchanged, and the
  page is checked against the table that says which mode obeys what.
- Checks: `tools/checks/lobby.ts` (26: every mode has a card, every option a mode names has a group on the
  page, no group is shown that nothing reads, every mode that can be played with friends names one the
  Friends box offers, and the pace moves clocks without moving circles) and the e2e `panel` section (a card
  picks rather than starts, each mode shows its own options in a real page, the setup survives a reload, the
  green button starts what the panel is set to, the pace reaches the live ring, and With friends carries the
  mode across).
## Milestone 145 — The way a figure holds a gun, and where its shots come from ✅

Four things the owner reported were one thing: nobody had ever measured what a figure does with a gun. Two of
them turned out to be worse than reported.

- **No figure in the game has ever had a muzzle.** A figure's gun looks for a marker called "muzzleflash",
  which is the name the **first-person** view model gives its own flash. Figures clone the display model, a
  separate build the view model never touches, so the marker was never there and the code quietly gave up.
  Every bot and every friend has therefore fired without a muzzle flash, and every one of their tracers was
  drawn from the middle of their chest instead of the end of the barrel. The muzzle is a point the model
  already knows, so it is passed in and the marker goes there; the marker is now what the game asks for
  (`muzzleOf`), because a muzzle is a place and a flash is a picture that may be out between shots.
- **Stocks through chests.** The animation library is a pistol library: it has no rifle clips, so a long gun
  is hung off the chest at a point we choose and both arms are reached onto it. That point was five
  centimetres *inboard* of the shoulder, and a stock is behind the grip, so on every rifle the stock ended up
  beside the neck. It now hangs in the shoulder pocket, outboard of the joint where the torso is not, and a
  gun too long for that is pushed forward until it clears: 22 cm for an SMG, 27 for the longest gun in the
  game (`src/config/figure.json`).
- **The floating hand.** The support hand reached for the handguard whether or not the arm was long enough.
  On the LMGs it was 65 cm away from a 55 cm arm, so the hand stopped short and hung in the air. It now
  slides back along the gun until it has hold of it, which is what a person does: the handguard on an SMG,
  a quarter of the way back on a rifle, half on an LMG.
- Every number about the hold is now in `src/config/figure.json` rather than in the middle of the rigging.
- Checks: `tools/checks/hold.ts` (20: a longer gun never hangs closer in, no gun's stock is deeper in the
  body than a stock goes, an absurd gun stops at the limit, and a slid hand lands exactly within reach rather
  than short of it) and the e2e `hold` section, which measures every length of gun in a real page: the muzzle
  is at the end of the barrel and out in front of the figure, both hands are on the gun, and a bot's gun has
  a muzzle too.

## Milestone 146 — The operators get dressed ✅

"Focus on putting clothes/skins on characters that we play as and like make shades / gas masks and stuff to
hide out our character models to make them look more like AAA games." The figures were a bare mannequin in a
flat colour. What you recognise about a soldier at 80 m is a silhouette made of a helmet, a vest, a mask and a
pack, and a smooth body in grey has no silhouette but its own.

- **Ten pieces of kit** (`src/game/gear.ts`, `src/config/gear.json`): a plate carrier with shoulder webbing
  and magazine pouches, a daypack with a roll on top, a helmet with a rear lip and side rails, shades on a
  strap, a gas mask with a snout, a filter can and lenses, a soft hood that stands off the back of the head,
  a cap peak, shoulder plates, thigh pouches and knee pads.
- **A different kit each**, so the five operators are told apart by their outline before their colour:
  Vanguard in a carrier and shades, Nightshade hooded and masked, Sandstorm in a gas mask and a peaked cap
  with a pack, Frost helmeted with plates, Inferno masked and helmeted.
- **Built, not downloaded.** A prop can be a scan; a garment has to be rigged and weighted to the body that
  wears it, which is a different pipeline. Hard kit does not deform: a plate carrier is strapped to a chest,
  so it hangs off the chest bone and is right. The one soft piece, the hood, is shaped to stand off the head
  rather than lie on it, which is how a hood behaves and also why it does not have to bend.
- **Both figure styles wear it.** Each piece names the bone it hangs from, so the mannequin hangs it on that
  bone and the robot, whose parts are baked in the figure's own space, moves it to where that bone would be.
- The colours come from the operator's own: the webbing its darkest, the plates a step off its shell, and the
  trim its accent, so two operators in the same kit are still told apart across a street.

## Milestone 147 — The dropship, as a shape ✅

"Make the ship actually look better." It was fifteen boxes, the biggest of them a slab 4.4 by 3.8 by 26
metres, and from the ground it read as a crate with a light on it.

- **A lofted hull** (`src/game/hull.ts`): a run of seven cross-sections with the skin stretched over them,
  a point at the nose, the section deepest over the bay, drawn back in at the tail. Each station slides
  between the rectangle it would be and the ellipse inside it, which is how a fuselage gets a flat floor,
  flat flanks and a rounded spine out of one kind of geometry. 168 triangles for the whole fuselage.
- **The bay you ride in**: a floor, a bench down each side and a strip light, seen the whole way down the
  ship because the ramp is open from the moment the doors are, with a door that lifts as the ramp drops.
- **Four nacelles on two swept wings**, each with an intake ring at the front and its fire at the back;
  twin canted tail fins; panel lines and a spine along the hull; and navigation lights, red to port and
  green to starboard, as an aircraft carries them, so which way it is going reads at any hour.
- Checks: `tools/checks/hull.ts` (15: a hull is closed, every triangle faces outwards, the rounding is what
  it says at both ends and halfway between, the nose is a point rather than a wall, the section grows to the
  bay and draws back in, and the whole fuselage stays under 250 triangles). The three of those that matter
  are invisible in a screenshot until the frame where they are not: a hole in the hull is a hole you see the
  ship's inside through, and this is a ship you sit inside and then fall out of the back of.

## Milestone 148 — The spray, measured against what the range draws of it ✅

"The gun spray seems off visually right now." The pattern itself is simulated and checked frame by frame,
but nothing had ever checked the claim the range makes about it: the spray wall draws a gold line of where
the gun sends a magazine and white marks where your rounds went, and if those two disagree the wall is
lying to whoever is standing at the mark trying to learn the gun. They disagreed, for two reasons.

- **The wall drew the aimed pattern whether or not you were aiming.** Its reference was generated with the
  gun aimed in, always. Hip-fired, your rounds carry a 2.5-degree cone the line knows nothing about, so the
  marks could never follow it: 69 cm out at 20 m, measured. It now draws the pattern of the way you are
  actually firing.
- **The recoil spring only ran between frames, not between the shots of a frame.** At 144 fps that is one
  shot a frame and makes no difference; at 25 it is four or five shots stacked on each other with no
  recovery in between, so the pattern a burst drew depended on the machine it was fired on. The spring is
  now advanced from one shot to the next inside the frame, and the frame's own update advances only what is
  left.
- **And the line is a path with a band round it**, not a row of dots to land on. The reference is a dozen
  magazines averaged, with how far they wandered from each other drawn as a ring at each point, plus the
  gun's own cone. A dot you are asked to land on is a promise the gun cannot keep; a corridor you are asked
  to stay inside is one it can.
- Checked in a real page (the e2e `spray` section): stand on the mark, hold the trigger for a magazine with
  the mouse still, and every round has to land along the drawn path and inside the drawn band. It also
  needed one small opening: the trigger now reads a scripted input the way the crouch, the interact and the
  movement already did, so a magazine can be asked for without a fake gamepad.
## Milestone 149 — What a player on a real ping actually experiences ✅

The gap analysis put it plainly: "we interpolate and reconcile, but nothing measures what a 120 ms player
experiences against". Both halves were built and both were checked in isolation; the thing they are *for*
had never been measured.

- **`?ping=N`** (`src/net/link.ts`): a fixed one-way delay on the test transport. Jitter is the spread
  around a ping; this is the ping itself, and the two add up. A player across a country is 30 to 60 ms one
  way, one across an ocean 80 to 120.
- **Measured at 60 ms and 120 ms round trip**, with one player strafing across the other's view: six rounds
  into the figure you can see land on the player it stands for, every time. That is what "the shooter's own
  browser decides the hit" buys, and it is now a number rather than a claim.
- **The figure is behind, never ahead.** A figure drawn ahead of where a player may be is a hit on somebody
  who was never there; the check fails if it ever leads.
- **And the buffer is the gap between states rather than more**: it is checked against the gap it is
  covering, not against a constant, because a test page rendering at fifteen frames a second sends states
  that slowly and the delay it needs is the machine's as much as the network's.

## Milestone 150 — The arenas stop being boxes ✅

"There has to be more free assets we can use to make things look less like roblox overall." Seven of the
game's modes are played in the arenas, and every piece of cover in them was a grey box with a texture on it.
The battle royale map and the range both carry modelled and scanned CC0 props; the arenas carried none.

- **A prop stands in for the box** (`src/game/arenas/dress.ts`): the box's mesh is not drawn, and a stack of
  crates, a run of barriers, a rack or a generator is drawn in the same space. 20 of the Crossing's 48 cover
  boxes, 16 of the Ringworks' 36, 14 of the Vault's 24.
- **The collider never moves.** The solid comes from the plan exactly as before, and the check proves the
  map's collision is identical before and after dressing. That is the whole safety of it: the cover is the
  same cover, the same height to shoot over and the same width to hide behind, and the bots' walk is the
  walk that was checked.
- **Which means a prop may only take a box it fills.** A crate two thirds the height of the box it replaced
  would be cover you could see over but not shoot over, and one narrower than its box would be a bullet
  stopping in mid air. A prop that comes in sizes (a crate, a barrier, a rack) is stretched to the box
  exactly, within the proportions a thing of that kind plausibly has; one that does not (a drum) has to fit
  as it is. Where nothing fits, the box stays a box, and about half of them do.
- Checks: `tools/checks/dress.ts` (20: nothing but cover is dressed, no prop stands outside the box it
  stands in for, every dressed box is filled on all three axes, no prop brings a collider of its own, a box
  wears the same thing every time, and the map's collision is untouched).

## Milestone 152 — The owner's list of the 21st ✅

Seven things, in one message, after playing the build.

- **"B00G's Range"**, with the apostrophe: the brand on the menu and the page's own title. The intro card
  keeps the words it was asked for, "B00G's FPS: FULL POWER SURGE".
- **Thirty bots and more, in any mode.** Twelve was a cap nobody chose: there were twelve bot names, and a
  thirteenth bot would have been a second BOT ASH. Past the list a bot takes a number, the way a squad with
  two Smiths does, and the cap is now what the frame rate carries (48). The Arena Bots match was worse than
  the cap: its box offered five and the code made one or two whatever it said. Every mode's picker goes to
  36 now, the battle royale's to 45, and past the spawns a map has they are stepped out around them in a
  grid so thirty bots do not start inside each other.
- **The kit card fits.** It laid every option out in one row of two: with two kits that was a card, with six
  it was six tiles across a 620 px box running off the screen with a sentence in each too long to read. It
  is a grid now, as many columns as fit, and each tile says what the kit *gives* you: the tactical on its
  key, the ultimate, the passive. Which also answers the owner's question: JOLT was never renamed. It is
  RUNNER's tactical, and the card now says so.
- **The callouts we never built** (`src/game/callouts.ts`). The battle royale names its places; the arenas
  named nothing, so in seven of the game's modes "he is over there" was all anybody could say. The ground
  you stand on is now named under the compass and said when it changes, and being on top of something is
  said as a roof, because that is the one thing that changes where everybody has to look. Worked out from
  where you stand rather than hand-written, so every map has them and none can go stale.
- **The 1v1 maps have a pitched roof.** Walls and a flat lid is a box; walls and two slopes is a building.
  It is stepped, because this engine collides against axis-aligned boxes and nothing else, so the steps are
  both what is drawn and what stops a bullet: a drawn slope over a flat collider would be a ceiling you
  could see into and not shoot into.
- **Picking a mode ends the match you are in.** It used to refuse and send you to a tab to resign from it
  first, and that tab was called 1v1 and no longer exists. And **Esc, Esc goes back in**: Chrome blocks a
  pointer lock for about a second after the Esc that let the mouse go and only grants one inside a real
  gesture, so the old retry-on-a-timer was refused in silence. A refused resume is now remembered and taken
  by the next thing the player does, and the hint says so.
- **The movement.** See the day's update for the full call-out: what is in, what we changed, what is next.
  In short, a **double jump** and a **wall run** now exist and are **off** unless the lobby's Movement box
  asks for them, because everything else in this game's movement is measured against Apex and these two are
  ours.

## Milestone 153 — The lean in the air ✅

The first of the five movement items written up in the day's update, done the same day.

A slide leans the camera into the way it carries you and a landing rolls it by the speed it came down with.
Between them the view sat flat: a jump out of a slide dropped the lean the moment it left the ground and
picked it up again when it came down, which made the middle of every chain the one part that did not move
with the body.

- **The air has a lean of its own** (`src/config/player.json` `feel.airRoll`): 2.4 degrees at full steer,
  in over 0.16 s and out over 0.22. It follows the **wish** rather than the velocity, because in the air you
  are steering and not being carried, and it is smaller than the slide's for the same reason.
- It reads the input the movement itself reads, which is also what let it be measured: a scripted jump and
  strafe in a real page leans to 0.68 of full at the diagonal and returns to nothing on the ground.
- Checks: five more in `tools/checks/feel.ts` (the air has a lean, it is smaller than the slide's, it
  arrives faster than it leaves, both are quick enough to belong to the jump they are part of, and the whole
  of a chain's roll stays inside what a view can take: 11.1 degrees if slide, air and landing all peaked at
  once).

## Milestone 154 — Momentum through a mantle, and a wall run that ends when you leave it ✅

The second and third of the five movement items from the day's update.

- **A mantle used to spend every bit of the speed you arrived with.** You reached the ledge standing still
  and built it again, which made a run of ledges read as a series of climbs rather than one movement.
  `mantleCarry` (0.55) now brings that fraction out on top along the way you were facing, capped at a
  sprint so a slide into a ledge does not throw you off the far side of it. Measured: 221 hu/s on the ledge
  against a sprint's 260, where it used to be nothing.
- **The wall run ended on a clock.** It still has one, as a backstop, but what ends it now is the wall: you
  steer off it and it lets go. A run that ends because you turned away is your decision; one that ends on a
  timer is a rule the player cannot see. It also has to be the *same* wall it started on, and the speed it
  measures is the speed along the wall rather than through the air.
- Checks: two more in `tools/movesim.ts` (you come out of a mantle moving, and never faster than you
  arrived), and the wall run measured in a real page: on the wall for the whole run, and gone the frame
  after you steer off it.

## Milestone 155 — A slide that steers ✅

The fourth of the five movement items, and a correction to the fifth.

- **A slide could only be nudged.** Holding a direction added acceleration along itself, which over the
  length of a slide is a drift rather than a turn: a slide held its line, and corners were taken by ending
  it. It steers now, turning the speed you already have toward the way you are asking at up to 55 degrees a
  second (`src/config/movement.json` `slideTurn`), and the wish's push is applied along your line of travel
  only, because both at once turned a slide at twice the rate the cap says and made the cap a number that
  meant nothing. Measured: 16 degrees over 0.3 s against a cap of 16.5, still sliding, with the speed kept.
- **The fifth item was wrong, and is withdrawn.** "Air control off a superglide" assumed the half second
  after a glide was loose. It is not: the air move is the Source-family accelerate (add toward the wish, up
  to a 60 hu projected cap, at 500 hu/s²), which is what Apex, Titanfall and every game in the family do,
  and it is what makes air strafing work at all. Loosening it would not make a superglide feel better, it
  would make every jump in the game float. What is actually true is that the glide's *exit* is exact and its
  feel is the camera's, which is Milestone 153's air lean, already done.

## Milestone 156 — The view over a step, the mantle's path, and a landing that lands ✅

"Ensure the movement is super smooth and not janky at all, this is the core mechanic." Three things were
making it not, and all three were the camera rather than the body.

- **Every step in the game was a jolt.** Walking onto a kerb moves the feet by up to the step height (0.56 m)
  in one frame, and the camera sat on the feet, so a staircase was a stutter per step and a kerb was a flick.
  The view keeps its height for a moment and closes the gap over 0.12 s (`stepSmoothTime`), which is what
  every game in this family does and is the single biggest thing between this and smooth. Measured in a real
  page: the feet jump 0.44 m in a frame and the eye moves 0.098 m. The feet, the collision and the hit boxes
  are untouched.
- **A mantle had three corners in it.** Its path was two linear ramps: the climb started at full speed and
  stopped dead at 65% through, and the reach forward began dead at 35%, so one mantle carried three jolts you
  could see. Both parts are smoothstepped now, which has zero slope at each end.
- **A landing arrived with a roll and nothing else**, so a drop of any height read as a stop rather than an
  impact. It dips the camera now by how hard it came down, 11 cm at a full-speed fall, back over 0.3 s.
- **And one thing deliberately left alone**: the crouch's view drop is a *measured* timing (0.1 s to
  0.635 m), so easing it would have been smoother and wrong. The smoothing here is on the parts nobody
  measured.
- Checks: four in `tools/movesim.ts` (the feet step in one frame, the view does not, it does catch up, and
  the body is where it always was) and three in `tools/checks/feel.ts` for the dip.

## Milestone 157 — The operators get dressed properly ✅

Milestone 146 put kit on them: plates, helmets, masks, packs. This is the clothes under it, which is the
part that says who somebody is. A man in fatigues and a man in a t-shirt read as two different people before
you see a single piece of their kit, and ours were all the same bare body in a different colour.

- **Six outfits** (`src/config/outfits.json`): FATIGUES (field uniform, sleeves down, boots), PLAIN CLOTHES
  (a t-shirt and shorts), IRREGULAR (a head wrap and loose clothes over a chest rig, no uniform at all),
  URBAN (dark layers, a covered face), ARCTIC (white over everything, goggles against the glare) and DESERT
  (sand fatigues, sleeves rolled). One each, so five operators are five silhouettes.
- **Three more things for a face**: a head wrap with a tail, goggles (two round lenses on a strap, which read
  as goggles where the shades' flat bar reads as shades), and a full-face mask, on top of the gas mask and
  shades the kit already had.
- **Why it is cheap**: every bone in this rig points along its own +y with a measured length (thigh 0.400 m,
  calf 0.429, upper arm 0.274, forearm 0.273, measured off the rig). So a sleeve is a tube from 0 to a
  fraction of that length hung on the bone, and it moves with the arm without being rigged or weighted.
  A garment that bends at a joint is a different kind of asset and a different pipeline.
- One measurement worth keeping: the spine bone runs up the **back**, so a garment centred on it sits behind
  the body. The chest's own middle is 4.8 cm in front of it, measured off the rig.
- Checks: `tools/checks/outfit.ts` (40: every piece stays on the bone it hangs from except the torso, which
  has to cover hips to neck instead; cloth is thicker than the limb inside it and not by a barrel; a sleeve
  starts above the shoulder so no bare arm shows; shorts are shorter than trousers; what comes in pairs comes
  in pairs; and no two operators wear the same thing). The look is `outfits` and `outfit-close`.

## Milestone 158 — The asset gap, written down ✅

`docs/ASSET_GAP.md`: what we have against what a shipped battle royale has, per category, with what each
difference actually costs a player, and ten ranked next steps. The ranking is by what a player notices per
hour of work, which puts more outfits and body variety above a second map, and puts bespoke characters,
facial animation and a voice cast on the "deliberately not doing this" list with the reason why.

## Milestone 159 — A wardrobe you can choose from, and a body measured off the model ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

Milestone 157 dressed the five operators. This lets a **player** dress, and fixes something the eye had been
seeing without my naming it.

- **Ten outfits** instead of six: HOODIE, COVERALLS, GHILLIE and TRACKSUIT join the five the operators wear
  and PLAIN CLOTHES. A set is about ten lines of `src/config/outfits.json`.
- **Three builds**: LEAN, REGULAR, HEAVY. They scale the **cloth** and the shoulders of the garment, 0.72 to
  1.45, and nothing else. The body underneath is one mannequin and one set of hit boxes, and that does not
  change: a heavy operator is not a bigger target, which is a thing a shooter must not get wrong.
- **A picker on the Loadouts tab**: the outfit as cards, the build and what goes on the face (a wrap,
  goggles, a full mask, or a wrap and goggles) as two selects, kept per loadout and stored with it.
- **It crosses the wire.** The choice rides beside the operator id as one short string, `lk`
  ("urban|heavy|wrap,goggles"), so a friend sees what you chose. It is beside the id rather than inside it
  on purpose: a build that has never heard of clothes ignores the field and still draws the right operator,
  where a look packed into the id would have fallen back to the first one. Anything in it we do not
  recognise is dropped rather than handed to the builder.
- **The body, measured** (`tools/checks/body.ts`). The fit table said the upper arm was 62 mm thick. It is
  84 mm at the shoulder. Every sleeve in the game was inside the arm it covered, and the bare body came
  through it in stripes on the lean and regular builds: a defect you could see in a screenshot and nothing
  could state. The check now reads the mannequin's own .glb, puts every vertex of the skinned mesh in the
  frame of the bone that owns it, and measures how far out it sits from that bone's axis. Six samples per
  bone, each the widest the body gets in the stretch it governs, went into `fit.profile`.
- **So a garment follows the body.** `tube()` turns a lathe along that profile instead of extruding one
  radius: the sleeve is 84 mm across the shoulder and 61 mm at the elbow, the calf swells at the muscle and
  narrows at the ankle. The check fails if any garment in the wardrobe would touch the body at the leanest
  build, which is the eye's complaint written down.
- **Three pieces that change an outline, not a colour.** The picker showed ten cards and three of them were
  describing clothes that did not exist: HOODIE said "a hood up" and had none, GHILLIE said "ragged strips"
  and was a plain green jacket, TRACKSUIT said "two stripes" and had none. So: a **hood** that stands up off
  the back of the head with a brow and a collar, **ragged strips** hung in a spiral off the body and thighs
  (by count, not at random, so an outfit looks the same on every screen), and a **stripe** down the outside
  of each arm and leg. Five different sets of garments across the ten outfits now, where there were two.
- **And a check that keeps the cards honest**: what an outfit's own description says it wears, it has to
  wear. Hood, rags, stripes, shorts, boots, sleeves. A blurb rewritten to promise something new fails until
  the something exists.
- Checks: `tools/checks/body.ts` (21), `tools/checks/outfit.ts` (still 40+), the wire in
  `tools/checks/net-delta.ts` (8 more: the choice survives the codec, going back to the operator's own set
  is said in the clear mask rather than by leaving the field out, and an outfit we do not have is dropped),
  and the e2e `duel` section, where the guest arrives in a tracksuit and the host has to draw it. The look
  is `outfit-wardrobe`, `outfit-wardrobe-2`, `outfit-builds` and `loadout-wear`.

## Milestone 160 — The body measured up the spine, not across it ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The second half of the measuring Milestone 159 started. The limbs got a profile off the model; the body was
still one box with three numbers I had typed in by eye, and it showed.

- **The spine bone leans back.** A vertex 45 cm up the chest lands 18 cm behind that bone's own axis. Every
  garment on the bone leans with it, so a single box centred on an average of the body is wrong in three
  ways at once, and the measurements say by how much: 360 mm wide at a waist that is 249, 220 mm deep at a
  chest that is 300, and its middle 90 mm behind where the collar's middle actually is.
- **So the body is six bands now** (`outfits.json` `fit.body`), each with its width, its depth and where its
  middle sits front to back, measured off the model by `tools/checks/body.ts`. The middle runs from +20 mm
  at the hips to -69 mm at the collar: 89 mm of lean, written down.
- **And the jacket follows them.** It is a tube of rectangular sections up the bone rather than a box: seven
  rings, four corners each, capped at the hem and the collar so it is not open at either end. The ghillie's
  strips hang off the same bands, so they sit on the body rather than around an average of it.
- Checks: `tools/checks/body.ts` gained three (the config holds six bands; the jacket clears the body at
  every one of them on the leanest build, worst case 24.8 mm; and the lean is there at all, 89 mm, which is
  the thing one box could not hold). The look is `outfit-close` and `outfit-shapes`.
- `fit.torso` and `fit.torsoAt` are gone from the code with it. The kit in `gear.ts` never used them: it
  has its own numbers in `gear.json` and hangs off the upper spine bone. Measuring the kit against these
  bands the way the clothes now are is the next one of these.

## Milestone 161 — The same movement on a laptop as on a desktop ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

Every movement number in this game was measured at 144 frames a second, because that is the machine it was
written on. Nobody had asked what the same inputs do at 30 or 60, and that is the most expensive kind of
jank: the player who has it cannot see it, because they have never seen the other one.

- **`tools/movesim.ts` runs at any frame rate now**, and a new section runs six scripted runs (a sprint, a
  walk from standing, a jump, an air strafe, a slide, a turn into a run) at 30, 60, 144 and **240** and
  compares where the player ends up and how fast they are going. 240 is there because it is what the owner
  and the people he plays with actually run, which makes it the rate that has to be right rather than the
  one that is convenient; 144 is the rate every other number in the file was measured at, so it is what the
  others are compared against.
- **The slide was the one that was really wrong**: 10.6 cm further along and **2.1 hu/s faster** at 30 frames
  a second than at 144. Its friction depends on its own speed (`dv/dt = -(a + b(v - c))`), so the speed decays
  exponentially, and taking the rate off once a frame is Euler's method on that: wrong by an amount that
  depends on the frame length.
- **`slideDecay()` solves it instead** (`src/game/movement.ts`): the exponential above the knee, the straight
  line below it, and the crossing solved rather than stepped over. The spread fell to 3.4 cm and 0.5 hu/s,
  and every measured slide timing in the file still passes, because the closed form IS what the small steps
  were converging to.
- **At 240 everything is tighter than at 144**, which is what convergence looks like: the slide is 0.4 cm
  out, the sprint 0.2, the turn 0.5. The one exception is where a jump lands, 2.0 cm, and it is instructive:
  a landing is noticed at a frame boundary, so a jump carries up to one frame of travel either way, and at
  240 one frame at a sprint is 1.8 cm. 30 fps scored better on that row by landing on a boundary that suited
  it, which is luck rather than quality.
- **What is left is the position step, and it is named rather than tuned away.** Position advances by
  `velocity x dt` once a frame, so at 30 fps each step is a 23 cm-long guess at where the speed was during
  it: about 3 cm of spread after two seconds. Removing it needs a trapezoidal or substepped position (and
  sub-frame landing for the jump), which would move every measured number in the file for under a centimetre
  of gain. Speed is checked to 1 hu/s because speed compounds; position is checked to 4 cm because a player
  cannot feel it.

## Milestone 162 — The ability numbers belong to the match ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner: "ensure that the number of dashes is configurable and stuff like that for each of the abilities
that we can choose from when we are creating a 1v1 for example (or ffa with a buddy and bots)". He is right
about where it belongs. What a dash is worth is a property of the game being played, the way the gun class
and the rounds to win already are, so it goes where the match is made rather than in a menu that belongs to
one player's page.

- **Nineteen numbers across the six kits** (`ABILITY_KNOBS` in `src/game/abilities.ts`): RUNNER's **dashes**,
  how far a dash goes, how long one takes and how often one comes back; MEDIC's patch, its time and its
  cooldown; SCOUT's pulse range, how long it shows them and its cooldown; HOOK's grapple range, pull speed
  and cooldown; SMOKE's cloud radius, how long it lasts and its cooldown; WARD's wall width, life and
  cooldown. Each knob says its own range, and a value is held to it.
- **The dash goes to six charges**, up from a cap of four, because that is the one the owner named. The HUD
  draws a pip each across the ability square and thins them to fit.
- **It is in two places, one store**: the Friends row where a match with friends is made, and the lobby's
  own Abilities panel for a match on your own. The four dash boxes in Settings write the same store, because
  they are the same four numbers and two places that disagreed would be worse than either.
- **The host's are everyone's.** They ride in the welcome as `MatchRules.abil`, and only what the host
  changed is sent, so most matches carry nothing at all. A build that has never heard of the field plays its
  own numbers rather than breaking. The bots read the same objects, so they play by them too.
- **And they are the match's, not the page's**: leaving gives you your own numbers back. Checked with two
  pages that each have their own: the host's six dashes of twelve metres and nine-metre cloud are what the
  guest plays by, and its own three dashes of eight metres are what it has back when it leaves.
- Checks: `tools/checks/kits.ts` (every knob moves, comes back, is held to its range, and a value that is
  not a number at all falls back to the config's own), and the e2e `duel` section's rules test for the two
  above. The look is `ability-numbers`.

## Milestone 163 — Nobody's eyes, and a dirt bike ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner: "the default loadouts should always have full wearables / skins like we made. Should always have
a mask and some kind of eye wear or a helmet and / or covering their face completely. Do a dirt bike one and
they should all have the dark shade on the glasses so you can't see their eyes."

- **Every loadout the game ships is dressed outright**, rather than inheriting whatever its operator wears:
  an outfit, a build and a face each. Assault goggles, Close Quarters a full mask, Marksman goggles, Heavy
  and Sidearms a wrap and goggles, and a sixth, **Dirt Bike**, in the motocross kit.
- **MOTOCROSS**, the eleventh outfit: a jersey and pants in blue and orange, boots, and a helmet with a
  peak, a chin bar and a dark visor band. The helmet is built against the head **measured off the model**
  (`tools/checks/body.ts` now reports it: 173 mm across, -9 to 256 mm up the Head bone, a face that reaches
  106 mm forward), not against a guess. It covers a face by itself, so the set wears nothing else on its own.
- **A sixth operator, Scrambler**, comes in it: dirt bike blue and orange, lean, helmet and visor. (It was
  called Redline for an hour, until the public build's own check pointed out that Redline is a real game's
  hop-up and this build may not say it.)
- **Every operator's eyes are covered.** Vanguard had nothing over its eyes but the kit's flat shades bar,
  and Sandstorm only a head wrap, which leaves them. Both wear goggles now, and Vanguard's kit bar is gone
  so the two do not fight.
- **The glass is dark everywhere**, in the clothes and in the kit: a quarter of the operator's visor colour,
  its glow cut from 0.12 to 0.012, and every lens **backed** with flat black so nothing reads through it
  under a bright sky. A gas mask that used to light up violet is now a dark pair of lenses.
- **And a thing nobody had noticed.** Every figure lineup in `tools/snap.ts` was shot with `turnDeg 180`,
  which is a figure's OWN facing, not the camera's: every wardrobe picture ever taken was of their backs.
  Ten of them now say 0, and `figureLab` says which is which in its own comment.
- Checks: `tools/checks/outfit.ts` (every operator and every shipped loadout covers its eyes, with a wrap on
  its own not counting; the glass is dark by luminance; the goggles and the helmet are backed),
  `tools/checks/gear.ts` (headgear is counted across the kit AND the clothes, so a helmeted operator does
  not need the kit's shades as well), `tools/checks/body.ts` (the head). The look is `face-close`,
  `operators-faces` and `outfit-wardrobe`.

## Milestone 164 — Real bodies and real clothes ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner, on the wardrobe: "the clothes look rediculasly bad lol are you just making shit up or are you
ripping free assets? bc this looks like you are just putting together roblox shapes and calling it a day".

He was right, and the answer was the first one: every garment was built in code out of a lathed tube per
limb, a box-section tube for the body and a squashed sphere for the motocross helmet. Nothing was ripped and
nothing was an asset. It reads as Roblox because it is boxes.

- **The body is a real body now.** Quaternius's **Universal Base Characters** (CC0): real topology, a face,
  base colour, normal and roughness maps. It is built on the **same universal humanoid rig** as the
  Universal Animation Library our clips already come from - the Unreal mannequin's own bone names, `pelvis`,
  `spine_01..03`, `clavicle_l`, `upperarm_l`, `calf_l`, `ball_l` - so the clips drive it with no retargeting
  and the clothes hang on the bones the outfit system already measures against.
- **Four outfits are real assets**: RANGER and WORKWEAR, male and female, from Quaternius's **Modular
  Character Outfits** (CC0). An outfit with a `character` in `outfits.json` replaces the figure's own mesh,
  because its clothes ARE its mesh; the game builds no garments for it and only puts what the player chose
  on its face.
- **`npm run characters`** (`tools/fetch-characters.ts`) fetches both packs through itch.io's own free
  download flow - the page for a CSRF token, a POST for a signed download-page URL, a POST to that page's
  file endpoint for the storage URL, no account - then pulls out what is used and re-encodes 108 MB of 2k
  and 4k PNGs into 8.9 MB of 1k WebP, pointing every `.gltf` at the new files.
- The fetched assets are **kept in git**, unlike the props and textures, for the reason the mannequin is:
  what a figure IS now lives in them.
- **A claim I got wrong and should not have made**: I told the owner these packs needed a manual download
  and that he would have to fetch them. He asked how the mannequin got there if he never did that, which was
  the right question. itch.io's free flow is three plain requests and an earlier session had clearly used
  it. The tool now records exactly how, so nobody has to guess again.

## Milestone 165 — Nine outfits made of real cloth ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

Milestone 164 put four real outfits in by swapping the whole figure for a clothed one. That is the blunt
way to use a modular pack, and it caps out at however many assembled figures the pack ships. The pack also
ships the **parts** those figures are made of, which is what it is actually for.

- **Garment parts are rebound, not hung.** Each part (a body, arms, legs, feet, a hood, a shoulder guard)
  is a skinned mesh on the same universal rig, so it is rebound to *this* figure's bones and then moves
  exactly as the body does. No bone to hang it from, no piece that fails to bend at a knee - the thing the
  code-built shells could never do.
- **Five outfits mixed from two sets**: SCOUT (a ranger's coat and shoulder guard over working trousers),
  HOODED (the hood up over a plain shirt with ranger legs), SHIRTSLEEVES (a worker's shirt and trousers, no
  coat), and SCOUT and HOODED again on the other build. None of them ships in the pack; all of them are
  real cloth.
- **The skin underneath goes** where a full set covers it, because two surfaces in the same place fight
  each other in the depth buffer. The face and eyes stay, which is what the player's face covering goes on.
- Nine real outfits now against eleven built in code, and the built ones are the ones to replace next.
- Checks: `tools/checks/outfit.ts` knows both kinds of real outfit and does not look for a garment list on
  either; it also checks that a mixed set covers a body, arms and legs, and that its parts are all the same
  build so nothing is two sizes. The look is `outfit-real`.

## Milestone 166 — Our boxes come off the real clothes ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner, once the real assets were in: "do we take away our extra stuff that is on the models now thats
just sitting above the new assets we implemented?" Yes, and it turned out two things were wrong rather than
one.

- **The kit comes off.** A figure wearing real cloth wears no kit at all: the plate carrier, the pack, the
  helmet, the pouches and the knee pads are ours, built out of boxes, and stacking them on somebody's asset
  is exactly what he spotted. The pack already brings a hood and a shoulder guard of its own.
- **What stays is the face**, because nothing in the pack covers a pair of eyes and the rule is that
  everybody's are covered.
- **And the face pieces did not fit.** They were authored against the grey mannequin's head, and the real
  head is a different head: **159 mm across against 172, 3 to 194 mm up the bone against -9 to 256, and its
  eyes at y 69 against y 99**. Everything we put on a face was placed 30 to 60 mm too high, which is why the
  motocross helmet floated above the head with its peak in the air. Every head piece - the goggles, the
  wrap, the full mask, the hood and the helmet - is re-placed against the measured head, and the
  measurements are written into `outfits.json` beside them.
- **An outfit also names the body its clothes were cut for.** The four "(F)" sets were wearing garments
  shaped for the second body on the first one. The skeleton is identical either way, which is the part that
  matters: hit boxes are built from the bones, so nobody is a bigger or a smaller target for the body their
  clothes came on.

## Milestone 167 — Published assets only, and each outfit its own colour ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner, on the live build: "feature flag off the custom pixal shit that we built and just do the
published assets... i still see shit that looks horrible and can't see the base skin."

- **Our geometry is off.** `buildOutfit` returns nothing unless `?ourgeometry=1` asks for it, and a figure in
  published cloth wears no kit of ours either. The code stays as the fallback if a download fails and as
  what would dress a rig no pack covers, and the checks switch it on so it is still tested. Nobody sees it.
- **All twenty outfits are published cloth.** The nine that were tubes and boxes are the pack's own garments;
  the two with no published equivalent (a motocross helmet, a pair of shorts) are dressed in what the pack
  does have rather than kept as boxes.
- **Each outfit has its own recoloured atlas** (`tools/tint-outfits.ts`, `npm run tints`). Multiplying a
  colour into the material was the first attempt and it could only darken: every outfit stayed in the
  atlas's brown-green family and ARCTIC's white came out as a pale coat. The colour goes into the picture
  now - the artist's folds and seams as luminance, the outfit's colour scaled into each channel - so arctic
  is pale, urban is near black, coveralls are orange and the dirt bike is blue. Eleven atlases, 484 KB.
- Two things went wrong on the way and both are worth keeping: `.tint()` after `.greyscale()` does not
  colourise (it wrote eleven identical grey atlases), and the atlas load was started inside the dressing
  loop, which a cold page never reaches because the parts are not in yet - so every figure wore the multiply
  and the recoloured atlases were never seen.
- **One rule is no longer met**, deliberately and in writing: "everybody's eyes are covered". The only
  eyewear we had was built out of boxes and this pack has none. It comes back with a pack that has some.

## Milestone 168 — The clothes cover the body, and the free pool is searched to the bottom ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

The owner, on the live build: "THE CLOTHES AREN'T FULLY COVERING THE BODY AND SHIT, EXHAUST OUR OPTIONS
FOR FREE ASSETS, THAT IS A GOLD MINE COMPARED TO MAKING NEW ONES."

**Two faults, neither visible from the code.** A garment file holds more than one skinned mesh - the Ranger
body is a coat plus two belts - and we wore the first and dropped the rest, so a figure turned up in a belt
on a bare chest. And the cloth is cut for a body we do not have: the garments reference `T_Regular_Male_*`,
while the free tier ships only Superhero, measured at 424 mm across the shoulders against the mannequin's
384. A coat cut for one does not close on the other. The torso is narrowed towards the shoulders so the
cloth meets, and a garment sits on a 22 mm shell above the skin. The narrowing is kept off the arms: in the
bind pose they lie out at shoulder height, and scaling them in dragged the hands off their wrist bones and
fanned them out.

**Nobody is bald.** Four hairstyles and a beard came down with the bodies weeks ago and were worn by
nobody. They are rigged to the same 65 joints, so they go on by the same path a garment does. The pack
ships its hair as a greyscale mask, mean 143 of 255 measured off the webp, and leaves the colouring to the
engine, so each outfit names a hair colour too.

**Twenty outfits, twenty outlines.** The wardrobe was twelve shapes wearing twenty names. The forty part
files allow sixty-four combinations per body, so every outfit takes its own: a body from one set, legs from
the other, hood up or down, a plate on the shoulder or not. The sets cut for the lighter body wear the male
garments, because the pack's female tops are corsets with bare shoulders. Mixing the packs broke the
recoloured atlases, which were one per outfit and are now one per outfit and pack, since the two packs lay
their UVs out differently.

**The free pool, searched.** Both Quaternius free tiers are fully taken; the rest of both packs is $40.
Sketchfab's CC0 downloadable rigged humans are museum scans. itch's CC0 character packs are fantasy or
blocky, each on its own rig. What is left is **Mixamo**: 108 rigged characters, free for unlimited
commercial use, including the swat, gas mask, coveralls and sixty-odd men and women in modern clothes this
game has been asking for. `npm run mixamo` lists them without a login and writes the catalogue; the export
needs one Adobe bearer token. `docs/SKIN_GAP.md` has the whole table.

**Checks.** Every garment and hairstyle an outfit names is on disk; every outfit has hair and a colour for
it; no two outfits are the same body in the same parts. Snapshots got easier to take: the gun in your own
hands can be put away for a shot, and there are close front and back scenarios and four wardrobe lineups.

## Milestone 169 — A body to pick, a build that means something, and seams that stop showing skin ✅

Phase 16. See `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md` and `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

Next on the ranked list in `docs/SKIN_GAP.md` was letting a player pick the body. Beside it sat a dead
control: LEAN, REGULAR and HEAVY were saved and sent over the wire and changed nothing, because they
thickened the garments we built in code and those are off.

- **Body.** A row in the Loadouts tab. Every garment binds to either body, so the pick is free of the
  outfit. It goes over the wire as a fourth field on the look, which a page from before it reads past. The
  four "(F)" outfits were the same clothes on the lighter body and are gone; a loadout that stored one is
  given the matching outfit on that body. Hair follows the body too, so there are no beards on the lighter
  one.
- **Build.** The chest's width, applied to the body and to the cloth over it by the same amount, so the fit
  holds at every build. The skeleton does not change and neither does a hit box.
- **Four faults found on the way**, each in a snapshot and each measured: every head 29% too narrow (the
  cloth-fit narrowing never eased back out above the shoulders); one black face per lineup (bodies painted
  in the operator's shell colour, a multiply over the skin texture); the back of every shoulder through its
  sleeve (the upper arm is 101 to 104 mm from the bone, the sleeves 60 to 69, so it is brought in around its
  bone to 0.8 and `tools/checks/body.ts` measures it against every sleeve); and skin at every seam, which no
  shaping closes because each piece was cut against a different outline. The body wears a dark undersuit
  under the clothes, so a seam reads as fabric.
- The torso and arm numbers and the shell moved out of the code into `outfits.json` `fit` with the
  measurements beside them.

## Milestone 170 — Your own arms in your own view ✅

Phase 17, item 17.1. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The first-person hands were a glove of capsules and a sleeve that was a cylinder, which from behind the gun
read as two grey pipes: on screen every second of every match, and the largest single "cheap game" tell in
`docs/FEEL_GAP.md`.

- **The arms are the published body's**, cut down to the arm (`mannequin.ts buildArmRig`), in the body and
  build the loadout picked, wearing the outfit's own sleeves in the outfit's own colour; a Ranger arm comes
  gloved, a Peasant arm bare. The fingers are the clips' own: the two-handed pistol aim for a grip, a jab
  a third of the way in for a fist.
- **None of the viewmodel's animation changed.** It still decides where every hand goes: the grip, the
  handguard, the magazine in a reload, the zipline trolley, the holstered fists, the crawl. A real arm is
  posed onto each glove every frame (`fparms.ts`), and the gloves are no longer drawn. Until the body is in,
  the drawn arms show, so nothing is ever empty-handed.
- **Found on the way, all in snapshots.** A shoulder run back to where a real one is put a wall of deltoid
  across the screen; the arm continued along the forearm's line swept up both edges past the eye; cut at
  the elbow the cut showed in frame. The upper arm is now 60% drawn and turned down, the shortest way out
  of the frame. The support glove is drawn 15% bigger than the grip hand, and sizing the shared rig per arm
  compounded into the bones until a forearm was five times its size; each arm is sized at its own upper arm
  now. A left hand's frame built as the mirror of the right's was a reflection, not a rotation, and the arm
  came out a ribbon to the horizon. The wrist's twist is split between the wrist and the forearm, which is
  where a real arm puts it.
- `realArms()` for the tests, an e2e check in the `page` section, six snapshot scenarios (`fp-arms`, `-ads`,
  `-reload`, `-holstered`, `-zip`, `-down`), and `tools/shot-tile.ts` to crop and tile snapshots. The three
  numbers that shape it are in `viewmodel.json` `realArms`.

## Milestone 171 — Real guns, and steps on metal and gravel ✅

Phase 17, item 17.2. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

Every shot in the game was synthesised: a filtered thump, a band of noise and a crack per weapon class, with
a recorded metal action quietly under it. Half of a shooter's feel is how a shot sounds, and a noise burst
has no mechanism, no room and no tail.

- **Recorded gunshots per class**, from The Free Firearm Sound Library (CC0, 24 real firearms recorded by
  Still North Media): Walther PPQ, 1911 and Bersa for pistols; Carl Gustav M45 and PPSh for SMGs; AR-15 and
  AK-47 for rifles; the AK and a Marlin .30-30 for LMGs; SKS and a Winchester 1894 for marksman rifles; Mosin
  Nagant, Savage 10 and Tikka T3 for snipers; Benelli Nova, Winchester Model 12 and a Charles Daly for
  shotguns. Each has near takes and mid-distance takes, and a shot past 80 m plays a mid-distance one.
- `npm run guns` (`tools/fetch-guns.ts`) fetches the 194 MB archive once, unpacks it with the system's tar,
  finds each shot by its onset (the level gate with a 0.4 s refractory period: waiting for quiet first
  missed every mid-distance shot, whose noise floor never goes quiet), and writes 51 takes: near at 32 kHz,
  far at 16 kHz since the air has taken the top off a distant shot anyway, 2.4 MB in all. Every near take's
  report lands within 2.3 ms of its start, measured, so no trigger pull is late.
- When a class has takes the recording is the shot; the synthesised body is not layered under it. The far
  echo and an energy weapon's whine still are. A voice lives as long as its longest take, so no take is cut
  off with a click. Without the files the synthesis plays exactly as before.
- **Footsteps on metal and gravel**, from congusbongus's OpenGameArt pack (metal CC-BY 3.0 by Eelke, credited;
  gravel CC0), fetched by `npm run sounds`. Metal was the concrete step pitched up; the outdoor ground was
  the grass step.
- An e2e check in the `bots` section: every class has near and far takes and a shot plays one. The deploy
  guide and the README say to run `npm run guns`.

## Milestone 172 — Figures that throw, swing, kneel, reach and dance ✅

Phase 17, item 17.3. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

Every other player is watching the third-person figures, and they had 25 clips: a slide cut straight into
its loop and out of it, and a throw, a melee, a revive or a hand on a bin had no motion at all. The two free
Universal Animation Library downloads hold 86 clips, on our rig, and 61 were sitting unused.

- **Twelve more clips**, trimmed out of the free libraries by `npm run clips` (`tools/fetch-clips.ts`, which
  is now the record of every clip the game ships and regenerates the two original files byte for byte).
  They load after the figures are up, in two extra files, so 2.1 MB of them never holds a page up; until
  they arrive a figure plays what it did before.
- **A slide with a way in and a way out** (`Slide_Start`, `Slide_Exit`). **A throw** overhand. **Three melee
  swings** in turn (a jab, a cross, a hook) instead of one punch over and over. **Kneeling over a revive.**
  **A reach** while holding interact on a bin, a box or a console. **A headshot** snaps the head back.
  **A fast jump** tucks the legs; a standing hop does not.
- The hands' act on the wire grew from reload, swap and heal to throw, melee, revive and interact, as codes
  3 to 6 that an older page reads as nothing. A throw, a swing, a revive or a reach puts the gun away for the
  moment: the rifle's two-handed hold ran after the clip and pulled both arms straight back onto the gun.
- **Emotes can be clips.** The dance is the real dance now, and YES (a nod) and ARMS FOLDED join the wheel,
  on the end of the list so an older page reads nothing for them.
- Checks: every clip emote names a clip the fetch provides; the extras arrive (e2e `page`); snapshots
  `motion-acts`, `motion-slide`, `motion-air`, `motion-emotes`. The athletic jump's threshold and a throw's
  length on screen are in `figure.json`.

## Milestone 173 — The gun leans into a strafe ✅

Phase 17, item 17.4. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The viewmodel already swung the gun down and away through a swap, dropped it forward into a mantle, dipped
it on a landing and pumped it through a sprint; reading it for this item showed those were there. What
nothing in it answered was a strafe: the body stepped sideways and the gun stayed rigid in the frame.

- The gun rolls toward the way you step and slides a little the other way, full at sprint speed sideways,
  eased over 0.12 s, and mostly held still when aiming (`viewmodel.json` `strafe`).
- The view model frame carries the sideways speed against the view (`strafe`).

## Milestone 174 — A card for every mode, half the flash, and a 12 gauge ✅

Phase 17, items 17.10 to 17.12. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The owner: "we want a unique animation screen for each different game mode, they can be the same as the
intro, but the text should change and the name of the mode should be prominent, and make the flashes of
light only like half as bright, and the second gunshot should sound more like a shotgun, so like a bit
deeper like a 12 gauge."

- **A card per mode.** The card that plays as a match starts is the intro's animation with the mode's own
  words: BATTLE ROYALE, RESURGENCE, 1V1, 1V1V1, VS BOTS, GUN RUN, TEAM DEATHMATCH, FREE FOR ALL, CROWN,
  CONTROL and SEARCH, each large with its own line under it and the game's name small above. A long name
  is sized down to fit nine tenths of the screen. The words are in `intro.json` `modes`, and a check fails
  if a kind of match has no card.
- **Half the flash.** The shot's flash went from 0.9 to 0.45 and the blast's from 0.75 to 0.375, both now
  in `intro.json` rather than written into the drawing.
- **A 12 gauge.** Both of the card's shots used one short synthesised crack. The first is now a recorded
  rifle take; the blast has its own sound, a recorded 12 gauge take slowed to 0.82 with a low thump from
  72 Hz under it (`audio.json` `intro`).
- Snapshots `intro-mode` (the longest name, TEAM DEATHMATCH) and `intro-flash` (the frame of the shot).

## Milestone 175 — Nobody runs out of ammo ✅

Phase 17, item 17.13. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The owner: "make battle royale when we spawn in with guns have way more ammo and the ammo stacks should be a
lot more per stack on the ground. I don't want ppl running out of ammo."

- **A stack is about two and a half times what it was**: 150 light, 150 heavy, 60 sniper, 48 shotgun rounds,
  against Apex's 60 / 60 / 28 / 20. One stack is one pickup on the floor, and four of them are what you can
  carry, so both went up together (`ammo.json` `stacks`).
- **A spawn with guns starts with four stacks** of each gun's ammo, a full pouch: 600 light rounds against
  120 (`ammo.json` `kitStacks`). The same kit is what a 1v1 or a bot match gives each life.
- A check in `verify` reads the kit from the config rather than holding the old 120, and holds the floor of
  150 a stack and four stacks. The e2e loadout crate check expected a fixed amount on top of what you had;
  a full pouch has no room, so it now expects what fits.

## Milestone 176 — The battle royale's buildings dressed from a kit ✅

Phase 17 item 17.5, `docs/AAA_GAP.md` step 1. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The buildings already wore real CC0 textures. What made them read as boxes is that nothing on them was
modelled: no roofline, no corners, no frame round a door, nothing on a roof.

- **Quaternius's Downtown City MegaKit** (CC0, free tier), fetched by `npm run kits` (`tools/fetch-kits.ts`,
  through the itch flow now shared with the characters in `tools/itch.ts`) and kept in git.
- Every building records its dressing as it is built (`brpoi.ts` `DRESSING`, beside `DOORWAYS`): a metal
  cornice under each roofline, a brick column up each corner, a storey at a time with a cap, a frame on each
  doorway, and an AC unit or two on the roof. A side is split into the kit's two metre modules and each is
  stretched a little, so any wall ends on a whole piece.
- `kitdress.ts` draws each kind of piece as one instanced mesh, after the map is up: 1,701 pieces in six
  draws per mesh. Nothing collides; the buildings are the boxes they were, and bots, doors and loot see
  only those.
- **The budget caught the first version.** A moulded cornice and a brick band at every floor line came to
  521k triangles, two and a half maps. The band is gone and the cornice is the kit's 30-triangle metal one:
  127k. `render-budget.ts` measures the dressing off the files and holds it under 200k; the e2e checks it
  is drawn.

## Milestone 177 — Something grows on the sand, and the field's rocks were never showing ✅

Phase 17 item 17.6, `docs/AAA_GAP.md` step 2. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

- **Vegetation from the Stylized Nature MegaKit** (CC0): 35 dead trees in a loose ring round each place and
  along the roads, where they break a long sightline without walling it off; dry grass and bushes where the
  places meet the sand and at the verges; pebbles on the road shoulders; a tuft or a bush here and there on
  the open field. The kit's greens are tinted to straw and olive for this ground. Nothing collides. 433
  pieces, drawn by the same cell-and-distance instancing as the rocks (`br.ts` flora, `props.ts` now takes
  a kit path and a tint).
- **A bug found on the way, there since Phase 15.** Each cell of instanced scenery stored its middle in the
  map's own space and was measured against the camera in the world's, and the battle royale's map sits
  500 m off the world's origin. So the cells drawn were the ones 500 m from wherever you stood: in the
  battle royale the field's rock scans showed their boxes nearly everywhere, the cliff faces were missing,
  and 60 cells of it were drawn in the firing range, out of sight. The middle is stored in world space now.
- **A test that catches it, proven.** The e2e works out each cell's place from its mesh's own bounds, not
  the stored middle, and checks the nearest cell to you is drawn and none past its distance, and that
  nothing of the battle royale is drawn from the range. With the old line put back, both fail.
- `render-budget.ts` holds the growth between 300 and 1,500 pieces with the trees in the dozens.

## Milestone 178 — Streets with something on them ✅

Phase 17 item 17.7, `docs/AAA_GAP.md` step 3, a first pass. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

- A bollard either side of every doorway, a step out from the wall, so a doorway reads as a way in; manhole
  covers down the lanes and drains at the kerbs of both roads, so a road reads as a street rather than a
  dark strip on the sand. All from the city kit, all through the same dressing list and instanced drawing
  (1,876 pieces, 154k triangles, inside the check's 200k).
- **What this pass is not.** Vehicles want a free set that matches a textured world: Quaternius's free cars
  are flat-coloured low poly and would read as toys beside scanned rock. And each place already has a thing
  you can name from the dropship (the Hub's mast, North Yard's silos, East Ridge's tower, West Town's clock),
  so the landmark half of this step was already done; making the nine places less alike is the second map's
  job (`docs/AAA_GAP.md` step 10).

## Milestone 179 — Weapon fusion ✅

Phase 17, `docs/AAA_GAP.md` step 4 (Hyper Scape's). See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

The battle royale had no reason to pick up a gun you already carry except to swap one copy for another. Now
the gun you carry, found again, fuses into yours: its magazine goes up a level (to gold), any attachment
slot it has empty takes the found copy's, and a stack of its ammo comes with it; the copy is used up and
the HUD says what it gave (`br.json` `fusion`). The Gulag's pair is always two different guns and a
Resurgence landing starts with empty slots, so neither kit can fuse by accident. The e2e `br` section checks
a fused R-301 keeps both slots, goes up a magazine, takes the optic and the ammo. README's battle royale
section says so, and the ammo stacks from Milestone 175.

## Milestone 180 — Tests that catch bugs, and a gate on the deploys ✅

Phase 17 item 17.15. See `docs/TEST_AUDIT.md`.

The audit counted this week's bugs: of twenty-three, the owner found six, snapshots found eleven and the
suites found five, because every snapshot passed whenever the page threw no error. Three of its five fixes:

- **Pictures that assert.** A snapshot scenario can carry `magentaMax`. `npm run fit` shoots all sixteen
  outfits front and back with the clothed body painted flat, unlit magenta (`mannequin.ts setFitDebug`:
  the undersuit region only, so face and hands do not count) and counts it. Today 0.009 to 0.037% of the
  frame; with the body's narrowing turned off, the back lineup is 0.144% and fails. A first limit of 0.2%
  passed that, so the limit is 0.06%: a check has to fail on the bug it is for, and this one was made to.
- **No vacuous passes.** The recorded-sound and gunshot checks failed open when their files were missing;
  they fail now.
- **A release gate.** `tools/release-gate.ts`: both deploys run verify and rules and check the recorded
  sounds are on disk before building, and stop on a failure.
- `CLAUDE.md`'s release steps add `npm run fit`, and say a new check is proven by putting the bug back.

## Milestone 181 — Finishers ✅

Phase 17 item 17.16, `docs/AAA_GAP.md` step 6. See `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.

A knocked enemy in front of you and the melee key: instead of a swing, a finisher. You turn to face them and
crouch over them, and throw a hook and then a cross from the hips up; they stay down through both, and on
the last blow they go back. Your camera steps out to the side to watch, and every key is held until it
ends. At the end they are dead and your shield is full again, Apex's reward. Any damage you take breaks it
off with them still down, so finishing someone in the open is a risk, as it is in Apex. The prompt names
them: `V  FINISH <name>`.

- `src/game/finisher.ts` picks who can be finished: in reach on the flat, inside a cone of your facing (not
  your look, so nobody has to aim at the floor to be offered it), not a floor above or below.
- Two new figure acts, `finish` and `finished`, ride the state packet as codes 7 and 8. The old codes keep
  their places, so a page from before reads the new ones as nothing rather than as a reload.
- The kill goes to the figure the way a bullet's hit does, its own `hit()` and then the match's `localHit`
  named a melee, so the feed, the credit and the host's bots need nothing new. The first version sent it
  as a swing's ray, and the proof run caught that ray passing over a figure on the floor.
- Every number is in `src/config/finisher.json`: reach 2 m, cone 55 degrees, 2.2 s, the two blows' moments,
  the camera.
- The first snapshot had a standing figure punching a metre over a knocked head, and the knocked figure
  flat on its back from the first frame. The finisher crouches now, and the knockback waits for the
  last blow.

Checked by `tools/checks/finisher.ts` (12) and by the e2e's bot squads section on a real knocked bot: it is
offered, it starts and both figures play it, it ends in the kill and a full shield, and a hit breaks it off.
Proven: with the shield reward and the break-off taken out, both of those checks fail.

## Milestone 182 — Voice callouts, an announcer, and a drop theme ✅

Phase 17 item 17.17, `docs/AAA_GAP.md` step 7.

The game said everything in captions and effects. Now it speaks, through the browser's own speech
synthesis in two voices. Free recorded voice lines are scarce and never match each other; a set voice
reading short lines is consistent and costs nothing to download.

- **Yours**, the way an Apex legend talks: "Enemy knocked!", "Enemy down!", "I'm down!", "Teammate down!",
  "Enemy spotted!" on an enemy ping (yours or a squad mate's), "Back up." after a revive, and a line after
  a finisher.
- **The match's**, the way Warzone's announcer does it: the drop, the ring closing, the final ring, stepping
  outside it, three squads and two squads left, a squad wiped, the win and the loss.
- `src/game/announcer.ts`: `cues` compares the battle royale's HUD this frame with last frame's and names the
  lines the change calls for, which is pure and checked. The speaker says one line at a time, the most
  important first, each no more often than its cooldown. A line that waited too long is dropped rather
  than said late, and one more important cuts a lesser one off. All of it is in `src/config/announcer.json`,
  with two or three wordings a line so it does not repeat word for word.
- **The drop theme**: "Battle Theme A" by cynicmusic, CC0, from OpenGameArt. It plays from boarding the
  dropship to landing and then fades, streamed rather than decoded whole. `npm run sounds` fetches it
  (`tools/fetch-music.ts`), and the release gate checks it is on disk.
- Settings has a Voice slider and a Music slider; all the way down is off.

Checked by `tools/checks/announcer.ts` (16, proven by making the ring line repeat every frame) and by the
e2e: aboard the ship the drop is said and the theme is on, landed it is off, and a finisher is spoken.

## Milestone 183 — The Apex era frozen, and SpeedKills' first footing ✅

Phase 18 item 18.1a. See `docs/PHASE_18_PLAN_SPEEDKILLS.md`.

The owner turned the project toward **SpeedKills**, a fast, vertical, futuristic-city shooter and battle
royale of its own design, keeping everything built so far.

- **Frozen.** The whole game as it stood (Milestones 1 to 182) is the git tag `apex-era-final`, pushed and
  deployed to both the game server and Pages through the release gate. Unfinished local work went to the
  branch `wip/follower-graph`.
- **Read before changing anything.** Four passes over the code (weapons and loot; abilities, movement and
  input; the battle royale, life states and the network; maps, modes, UI and tests) are the basis of the plan,
  which says what is reused, what changes, what is added, in which of twelve phases, and what is still the
  owner's to decide. The passes also found fourteen bugs, eight of them states that can contradict each other.
- **The switch.** `src/game/game.ts`: one game per page, `legacy` or `speedkills`, from the URL, then the
  browser's last choice, then the build's default (`__DEFAULT_GAME__`, legacy). Nothing reads it yet, so the
  legacy game is untouched by construction.
- **The profiles.** `src/config/games/legacy.json` (the design as it froze) and `speedkills.json` (the first
  version of the new one: twelve guns in pairs with their own names and fixed optics, no attachments,
  universal ammo, fusion levels 1 to 5, seven abilities in a mobility and a utility slot, ghosts and a
  follow-to-revive rule, the city map, five bot tiers).
- **Checked.** `tools/checks/games.ts` (34 checks) holds every profile to naming only guns, optics,
  abilities and maps that exist, legacy to the whole catalogue, and SpeedKills to the brief's shape: two guns
  a family at most, a hard-hitter and a fast one in each pair, six to eight abilities, fusion that is better
  but not decisive (a level-5 gun at most 15% quicker to kill on damage). Proven by planting a misspelt gun
  and an optic the gun cannot take: five checks fail.

## Milestone 184 — SpeedKills is the front door ✅

Phase 18, stages A and B. See `docs/PHASE_18_PLAN_SPEEDKILLS.md`.

- **The switch, on.** A page with no word opens in SpeedKills. `?game=legacy` (or Settings, Game, which
  reloads) opens the game frozen at `apex-era-final`. index.html's first script sets the look before
  anything draws; the build carries its default (`DEFAULT_GAME`, SpeedKills).
- **Friends on one game.** The host's game rides in invites and welcomes. A guest on the other game reloads
  into the host's rather than playing guns the host's hit check refuses.
- **The tests stay the legacy game's.** The e2e and the snapshots open `?game=legacy` unless a section asks
  for SpeedKills (`E2E_GAME`, `SNAP_GAME`), so the whole suite remains the frozen game's regression net.
- **The look.** A neon menu in two groups, PLAY (Battle Royale, 1v1, Arena bots, FFA, TDM, Control) and
  TRAINING (Range, the two Runs, the Tour); the legacy game's other modes are hidden, never removed, since the
  e2e clicks their cards. SpeedKills' title card in cyan and magenta, its own loading tips.
- **The battle royale's size.** Up to 30 in a match (27 bots in nine squads of three with your squad), and
  no knockdowns: `bleed: 0`.
- **How it was done.** The plan said to move the legacy game's lists into its profile. Instead each place
  that chooses branches on the switch, leaving the legacy lists where they were: the same guarantee that the
  frozen game cannot change, at a fraction of the edit.

## Milestone 185 — Movement for a city of roofs ✅

Stage C. `src/config/movement.speedkills.json` is laid over `movement.json` before the movement numbers are
built, on SpeedKills pages only, so the legacy game's measured Apex numbers are untouched by construction.

- **Everyone's baseline:** double jump, wall run and wall kick, the slide and its tech, and auto-climb: run
  at a wall too tall to mantle and you climb it without a jump.
- **Hyper Scape's lightness:** gravity 690 hu/s squared (750), more air control, climbs at 300 hu/s (225) that
  go 5.1 m above where they start (2.5), no fall stun, sprint 7 m/s (6.6).
- **Measured**, by `tools/sk-movesim.ts` driving the real controller: a 4 m wall climbed with no jump; a
  waist-high wall not climbed; a jump, a double jump and a climb reach a 9 m roof (two storeys); an 11 m
  street crossed roof to roof; a 30 m drop with no stun. The two-storey climb stopped at 5.5 m until the
  climb's attach offset was found to be the real limit, and a double jump now starts the climb's space afresh.

## Milestone 186 — Ten guns, fusion, and nobody runs dry ✅

Stages D and E.

- **The ten:** PANDA and ZEPHYR (rifles), ANAKIN and USSO (SMGs), BIGANTLER and RIPTIDE (shotguns), HELIX and
  PULSAR (marksman), BOOG (sniper) and NOVA (an energy gun that overheats), each with one fixed optic and no
  attachments.
- **Tuned to the owner's longer fights:** `tools/checks/ttk.ts` measures every gun at every fusion level
  against 150 at 80% on target. The rifles, SMGs and NOVA kill in 1.3 to 1.8 s (the legacy numbers were about
  0.9), the shotguns in 0.8 to 1.4, the marksman guns in 1.2 to 2.4. USSO is the fastest gun and the hardest
  to hold (recoil 1.6x), ANAKIN the easiest (0.6x). BOOG's headshot is 450, a kill through full health, shield
  and an ARMOR hack. USSO's magazine went to 27 when the check showed a fused magazine removing a reload.
- **Fusion, the owner's numbers:** a gun on the floor is level 0; each of five fusions adds 2% damage and 10%
  magazine (+10% and +50% at level 5; Hyper Scape's Ripper went 24 to 36 rounds, the same +50%), and 4% off
  reload and recoil. In the range the magazine key steps a gun through its levels.
- **Infinite reserve** in every SpeedKills match.
- **Health:** 100 health and 50 shield for everyone. The shield starts back 4 s after the last hit and fills
  in 3; health comes back at 4 a second after 8 s. No heals, no EVO, no armour to find.

## Milestone 187 — Ten hacks ✅

Stage F. `src/game/hacks.ts`, `src/config/hacks.json`.

- **Two slots:** mobility (DASH, SLAM, LEAP, GRAPPLE) on F or a pad's LB, and utility (HEAL, ARMOR, WALL,
  INVISIBILITY, REVEAL, MINE) on G or RB, the grenade key, since SpeedKills carries no grenades. Picked in the
  lobby before a match; the legacy kits are off in SpeedKills.
- **Hyper Scape's published numbers where it published them:** Teleport's cooldowns 12, 11, 10, 9, 7 s by
  fusion level (our DASH), Invisibility's the same and 10 s long, Reveal 14 to 9 s marking everyone within
  60 m all round for 6 s, Slam to about 10 s, Wall to 7 s, Armor 5 s, a Mine 50 damage. The rest are ours.
- **What they do:** DASH a blink the way you look; SLAM up, a hang, down onto a spot hurting whoever is under
  it; LEAP four storeys up then the skydive's glide; GRAPPLE a pull along a line; HEAL an area that heals you
  and your squad; ARMOR 60% of a hit taken away while you are slower; WALL a barrier; INVISIBILITY unseen past
  6 m and by the bots until you fire; REVEAL; MINE a mine that homes in on an enemy and goes off.
- **Fusion:** a copy of a hack you hold raises it a level (a higher-level copy, to its level); another of the
  slot swaps in and keeps the cooldown that was running, so swapping is never a free use.
- **Checked:** `tools/checks/hacks.ts` (the rules and Hyper Scape's tables), the e2e's `speedkills` section
  (each hack does what its card says in a real page), and the HUD's two squares in the snapshot `sk-hud`.

## Milestone 188 — The neon city ✅

Stage H. `src/game/city.ts`, `src/config/city.json`. The owner: the battle royale is full of buildings,
neo-futuristic and dark, from free assets.

- **A 500 m city at night** in the square Outskirts stands in: nine sectors, the centre THE SPIRE the
  biggest (200 m) with an 18-storey megatower on a plaza, eight districts round it each lit in its own neon
  (Neon Row, Harbor Glass, The Stacks, Old Town, The Circuit, The Gardens, The Yards, Skyhaven).
- **49 blocks** between 14 m streets: towers of 8 to 16 storeys in the core, mid-rises, low blocks at the
  edge, every one 4 m storeys with stairs, windows you can vault and a roof you can reach; plazas with cover.
- **Ways over:** skybridges between core towers at floors 3 and 6, ziplines between the tallest roofs,
  launch pads at the crossings, jump towers in the plazas.
- **The look, all CC0 or ours:** ambientCG's six night facades, whose emission maps light their windows;
  dark glass, brick, asphalt, black metal and dark concrete; neon up every tower's corners, round its roof and
  along every kerb; holo signs in our own brands (USSO LABS, PANDA BANK, BIGANTLER, B00G CORP and more); red
  lights on the tallest roofs; a skyline past the edge. The sky is always night.
- **The collision grid** (`src/game/solidgrid.ts`): an 8 m grid over the world's boxes, rebuilt when the list
  changes, with doors and huge boxes on a list every query reads. The player, projectiles, bots and
  throwables go through it; `tools/checks/solidgrid.ts` holds it to the brute force on the real map (none
  missed in 4,500 queries, 97% of the list skipped), proven by breaking it (3,291 misses).
- **Found on the way:** the building shell dressed every tower in the legacy kit's brick columns (the first
  pictures showed them on every corner); it takes a `dress` option now.
- **Checked** by the e2e (a match starts, nine sectors, 27 bots, loot on the floors, bots moving) and the
  snapshots `sk-city-air`, `sk-city-street`, `sk-city-roof`.

## Milestone 189 — Guns and hack cores on the floor ✅

Stage G. SpeedKills' floor is guns and hack cores only (speedkills.json `loot`). A gun is found at fusion level
0 or higher (its colour on the floor is its level); a copy fuses the gun you carry, a higher-level copy takes it
to its level; a hack core fuses or swaps. The Spire is always the hot zone, twice the spots and the best odds,
and every other bot squad drops there. Bots fuse their own guns. The wire's item check takes hack cores and
fusion levels, and no longer drops backpacks and knockdown shields (a bug the recon found). Checked in a real
match: 953 items, 204 of them in the Spire, 151 guns already fused, fusion 0 to 1 to 4 by pickup, 15 of 27 bots
on the Spire.

## Milestone 190 — The city decays, and a capture zone ends it ✅

Stage J. `src/game/decay.ts`, `src/config/decay.json`.

- **Hyper Scape's shape as it was left:** sectors phased out from the edges toward a final one. A seeded plan
  picks the final sector (the Spire half the time) and takes the other eight in four waves of two, furthest
  first. Each wave is a round of the ring, so every guest already has its clock.
- **The warning:** the sector pulses magenta; the HUD says which and when; the announcer speaks.
- **The decay:** a shader on every city material dissolves the sector from the ground up with a glowing
  line, the ground left corrupted red; its boxes leave the collision list as the line passes, so upper floors
  hang a moment and a player high in a tower has longer to get out. The city is whole again after a match.
- **Damage** in a decaying or gone sector, for players and bots; bots run for the final sector once theirs is
  warned.
- **The endgame:** after the fourth wave a 14 m capture zone opens in the final sector. A squad alone in it
  fills its meter, two at once neither, and 45 s wins outright (Hyper Scape's crown time, in Ubisoft's words).
- **The owner's match length:** a 6 s dropship, four 70 s waves and the capture make 6 to 7 minutes.
- **The dropship** now starts about 156 m off the city and flies 6 s before its doors open, so the city loads
  behind it (the owner's rule, held by `tools/checks/games.ts`).
- **Checked in a real match** by the e2e: the plan, the first wave decaying with 544 boxes held out, damage in
  it, eight sectors gone and the zone open, and 45 s alone winning. Snapshot `sk-decay`.

## Milestone 191 — The Gulag, then a ghost that follows its squad ✅

Stage I. `src/game/brmatch.ts`, `src/game/brplay.ts`, speedkills.json `life`.

- **No knockdowns:** at zero a SpeedKills player is out.
- **The Gulag first:** every first death goes to the Gulag until the capture zone opens (the legacy game stops
  at the third ring).
- **Then a ghost:** a later death with a squad mate up and a restore left. It moves at 1.35x, sees enemies
  within 25 m, pings, and cannot shoot, pick up or use hacks. Enemies never see it; its squad sees a pale
  figure where it is, and its body stays where it fell.
- **The echo:** its death box. A squad mate holding interact there restores it in 5 s, a third as fast while
  the ghost is more than 12 m from them (the owner's follow rule, said on the prompt). The hold fills at a
  rate now, not by the time since it began. A restored player stands up at 100.
- **Two restores a match**, the owner's number; after them a death is final and the squad is told.
- **Checked** over two real pages by the e2e: the ghost moving, the prompt saying it is away, 5 s not enough
  while it is, and the restore finishing once it comes over.

## Milestone 192 — The controller, first class ✅

Stage M. `src/game/gamepad.ts`, `src/config/gamepad.json`, `src/game/aimassist.ts`, `src/config/aimassist.json`.

- **Every pad number in config:** the stick-as-keys and trigger thresholds, the hold time, the stick's edge,
  the look speeds and the auto-sprint push, each with its note.
- **An outer deadzone** (2% by default: a worn stick that never reads a full 1.0 still turns at full speed)
  and a **curve strength** (the Classic curve's power, 1.7, from 1 to 3), both in Settings.
- **Per-optic ADS** now scales the pad's advanced look too; the simple look already used the table.
- **Aim assist:**
  - rotation hip and aimed set apart (both 0.4 for now);
  - strength full to 25 m and easing to none at 60 m, so a far target is the player's own aim;
  - no snapping: it holds the target it has while that target is still in its zone, even if another comes
    nearer the reticle.
  - Still never through walls, never with no input, never on a mouse.
- **Keys:** a check that no key does two things among the actions SpeedKills uses. The three legacy
  collisions (ultimate and zoom on Z, kit picks 3 and 4 on the emote and spray keys) are legacy-only; the kit
  is off in SpeedKills.
- **The Controller heading** said an old layout; it now says the default one with the hacks on LB and D-pad
  right.
- **Proven** by putting each bug back: stickiness off and no falloff failed 4 checks; a second action on F
  failed the key check.

## Milestone 193 — Five bot tiers, on a player's health, with hacks ✅

Stage N, first part. `src/game/bots.ts`, `src/config/bots.json` (`beginner`, `skHacks`).

- **Five tiers,** named in SpeedKills as Beginner, Casual, Skilled, Advanced and Extreme (the code's
  beginner, easy, normal, hard, elite).
- **Beginner is new:** it walks, reacts in 0.9 s, misses wide, fires a third as often, takes cover when hurt,
  and uses no hacks, so a new player can learn to fight one. It sits below Easy on every axis the checks hold
  (aim, sight, looting time), and a mixed lobby never draws it.
- **On the wire** the four older tiers keep their numbers and Beginner comes after them, so a page from
  before it reads every bot right.
- **A player's health for bots:** in SpeedKills a bot had the legacy armour tiers (up to 125 shield as it
  looted) and healed only from items the city does not have. It now has the one 50 shield whatever its kit
  says, and the same regeneration as a player.
- **Bot hacks:** by tier, Casual has Heal, Skilled and up Heal and Dash. Heal fires under half health and
  shield; Dash goes across the line of fire when hit with a target in view. Both use hacks.json's own numbers
  and cooldowns.
- **Found by the new checks:** a tier weighted 0 could still be drawn on a roll of exactly 0 (fixed); the bots
  config had its `_squads` note twice, and the two notes are now one (plan bug 13).
- **Checked** by verify (the tiers, the wire, the draw) and the e2e in a real city match: 50 shield even at
  armour tier 4, a Skilled bot carrying Heal and Dash, and a hurt bot healing 30 to 96 in 3 s. Each was proven
  by putting the bug back (125 shield; no heal).

## Milestone 194 — Thirty in the city, measured and made cheaper ✅

Stage K. `src/game/hiddenskip.ts`, `tools/profile-frame.ts`, `tools/checks/city-budget.ts`, `tools/bench.ts`.

- **Measured first.** The bench gained the SpeedKills spots `skmatch` (thirty in the city, in the street
  facing the Spire) and `skroof` (100 m over it). It also names the game on every spot: the site opens in
  SpeedKills now, and a legacy spot would have measured the city. A new CPU profiler (`npm run profile`)
  says where a frame goes, by function, with the scene's objects by group and who calls what.
- **What it found:** not the city's triangles (180k once merged, fewer than the legacy map), but three
  costs.
  - **Hidden objects walked every frame.** three.js updated every matrix every frame: 6,741 of 9,892
    objects were hidden (the range, every figure's spare guns). A hidden subtree is now skipped until shown;
    a hidden leaf, such as a hit box, still updates.
  - **Line-of-sight rays.** Every bot cast one at everyone in range every frame. It now tries the nearest
    first and keeps each answer 0.1 s (bots.json `sight.recheck`, under the quickest tier's 0.12 s
    reaction).
  - **Two-pass see-through materials.** three.js draws a see-through two-sided material twice and rebuilds
    its shader before each pass. A security light's glass on every block cost 4 ms of 12 from over the
    Spire. Glass is drawn in one pass now, refracting glass is plain, and so are our own rings, glows and
    panes (one pass looks the same for a single colour or additive light).
- **Result** (Competitive / Balanced / High, fps):

  | Spot | Before | After |
  |---|---|---|
  | The street | 133 / 118 / 71 | 200 / 196 / 97 |
  | Over the Spire | 96 / 156 / 85 | 213 / 208 / 102 |
  | The legacy match | 250 / 196 / 110 | 345 / 312 / 149 |

  The legacy match's Balanced draw calls were halved.
- **Held by checks:**
  - `city-budget.ts`: 14,852 meshes, 212 merged, 180k triangles, no lights, with a third of room; a doubled
    city fails it.
  - An e2e rule that no material in a match is the rebuilding kind; it found the last two, a muzzle flash
    and a warehouse skylight.
- **The squads test** sampled on the wall's clock, so a page slowed by a busy machine had walked less far.
  The release run saw 6 of 40 squads together where a run alone saw 40 of 40. It samples on the game's
  clock now, and a failure says where each bot of a squad stood, with its height.

## Milestone 195 — SpeedKills' tour, eight steps ✅

Stage O. `src/game/tour.ts` (`SK_STEPS`).

- **The steps:** move; a double jump, a wall run and a climb; shoot; both hacks on their keys; fusion; a hit
  from high ground; five seconds in a capture ring; the walk to a squad mate's echo. Each says what the match
  does, since the last three belong to a match and the range stands in for them.
- **Checked** by a new e2e section, `sktour`, which does every step for real in the range: a wall run along
  the range's right-hand wall, a climb up a ladder's wall, F and G for the hacks, U for fusion, a hit on the
  figure that stands on the left platform.
- **Found on the way** (all in the test, none in the game): a second jump pressed twenty frames on came inside
  the coyote grace on a fast headless page, so presses are timed by the clock now; the fusion key reads the
  keyboard, not the movement script; a slow page runs fewer game seconds than the wall, so the ring's five
  seconds are waited on the game's clock.

## Milestone 196 — What the release run found ✅

The release run on the stage K build failed six checks in its second batch. Two were real bugs, both
fixed and proven; two were timing, and pass alone.

- **A supply bin offered through a shut door.** The bin prompt measured reach without asking what was in
  the way, so on a seed that stood a vault bin by the door, a player outside the locked vault was offered its
  bin (and the vault's three checks failed on the prompt). A bin now needs a clear line to it. The vault test
  puts one of its bins just inside the door and checks it is not offered: it fails with the old code and
  passes with the new.
- **Bots stranded when frames ran slow.** A frame's step is capped at 0.1 s, and a bot walked a slow frame
  as one step of up to 0.66 m, which a wall or a box's corner stopped whole where small steps slide round it.
  Under load a squad's follower stood pinned to a wall for the rest of the match. The e2e can now throttle
  the CPU (`E2E_THROTTLE=6`), which made the squads check fail alone, 20 and 21 of 40 together. A bot's walk
  is now taken in pieces of at most 0.2 m (bots.json `maxStep`), and the same throttled runs gave 36 of 36
  and 40 of 40.
- **Timing, passing alone:** Resurgence's 5 s off a wait read 6.5 s on the loaded machine (5.7 alone), and the
  battle royale host migration's heir, both rerun alone and passing.

## Milestone 197 — The gun panel says its fusion ✅

Stage P, first piece. In SpeedKills each gun slot on the HUD carries its fusion as five pips along its foot,
lit to its level, as the hack squares show theirs, and the line over the slots reads FUSION 3/5 where the
legacy game reads the magazine level. The legacy game's attachment lines are no longer drawn in SpeedKills,
whose guns carry their own optic (the plan's HUD: the gun and its fusion level, nothing to sort). Checked by
the e2e (the panel's levels and no attachment lines) and the snapshot `sk-hud`, now with slot 1 at level 3.

## Milestone 198 — NEON BLOCK, an arena from the city ✅

Stage L. `src/game/arenas/neonblock.ts`; the builder's city look (`src/game/arenas/build.ts`).

- **The map:** a street crossing cut out of the city at night, 44 m by 48.
  - Four blocks, each a concrete deck a storey (4 m) up, with a lit tower on its outer corner. Each deck is
    reached by a run of half-metre steps, so bots take them too.
  - Skybridges across the north and south streets join the decks into a ring of high ground.
  - Parked cars and barriers in the streets, lit kiosks across the ends of the long one, and alleys between
    the blocks and the walls.
- **In SpeedKills**, 1v1, bots, FFA, team deathmatch and Control are played there. The map picker starts on
  "picked for the mode" and keeps its own choice; the legacy game's first option, the warehouse, was where
  SpeedKills' bot matches landed until then.
- **The look:** a plan can ask for `look: "city"`, which draws it in the city's own materials with their world
  tiling (the facades' lit windows the size they are in the city). Caps are neon, and no legacy prop stands in
  for the cover.
- **Checked:** the arena checks walk it with a bot's rules. The first draft failed three of them, each a real
  fault fixed:
  - two spawns inside parked cars;
  - the long street letting the two ends see each other (now kiosks, and the other spawns behind the blocks);
  - a spawn a bot could not walk from.

  The e2e holds that a SpeedKills bot match is fought there. It failed until the picker's default was fixed.
  Snapshots `arena-neonblock` and `arena-neonblock-deck`.
- **Also:** the utility hack's pick said "G / RB", but RB is ping on a controller; it says D-pad right. The
  README has a SpeedKills section.

## Milestone 199 — A Gulag lost is not a second death ✅

Plan section 12, item 3. Losing the Gulag ran the whole elimination a second time. It sent the match a
second "down", from the Gulag's bot, whose id (991) the other pages did not know, so their feed read "PLAYER
991 eliminated" you. It also dropped a second death box, in the Gulag's room. The match had already counted
the first death, and the Gulag's own note already tells everyone the trip is over. A loss now does only
that: you are out, the one box is the first death's, and the feed names who won it ("GULAG BOT STEEL won the
Gulag against" you). The Gulag e2e holds the feed and that no box lies in the Gulag's room (it fails on the old
code's feed line).

Still open from the release runs: the battle royale host migration's setup failed twice in the full second
batch. Five of six bots had landed but not armed themselves before the ring closed. It passes alone and on a
throttled CPU, so it is not reproduced yet, and its failure now says which step it stopped at and what each
bot held.

## Milestone 200 — The city has a sound ✅

Stage P, audio. SpeedKills' matches were silent between shots. "Scifi City - Ambient Loop" by TinyWorlds
(CC0, OpenGameArt) now plays under every SpeedKills match on the ground, faded in and out, and gives way to
the drop theme in the air. It rides the effects volume at a low share (audio.json `ambience`), so steps and
shots stay on top. `npm run sounds` fetches it with the drop theme, the release gate refuses a build without
it, and the README credits it. The e2e holds that it plays in an arena match and that its file is there; it
fails with the file moved away.

## Milestone 201 — Revives and respawns only from the squad ✅

Plan section 12, items 4, 7 and 8, the squad messages' races.

- **Item 7:** a respawn or a revive sent to you was acted on whoever sent it, an opponent included. Only a
  squad mate's counts now, and a respawn only brings back someone who is out or in the Gulag (a beacon brings
  you out of it). The ghost e2e sends one from an enemy bot and holds that it is ignored.
- **Item 4:** with two squad mates reviving you, either one letting go stopped the revive for both. Each
  reviver is kept on its own now, and the HUD names the first still at it.
- **Item 8:** who was reviving you stayed set through your death, so a later knock began "being revived".
  It is cleared when you are out.
- **Found on the way:** the squad size and the battle royale's bot count were kept under one key for both
  games, so duos chosen in the legacy game made SpeedKills' next match a duo with the legacy count. The e2e
  caught it as 28 bots in what it expected to be trios, when the Gulag section ran first. Each game keeps its
  own now.

## Milestone 202 — In the Gulag is not up in the match ✅

Plan section 12, item 2. A player in the Gulag's room is alive there, and once their packets from it
arrived their squad counted them as standing. So a knock with only them left went down to bleed out, with
nobody who could come, and they counted towards the humans still up. "Standing" now leaves out anyone in the
Gulag: for a knock, for the humans up, and for Resurgence's mates. Their squad is still not out while they are
in it, which the side's own count keeps as before. One consequence is deliberate: the match is not won while
your only survivor is fighting in the Gulag; it is won when they come back.

The Gulag e2e reads the host's count with its only mate in the room. It passed on the old code when read at
once, before the room's first packet; read 1.5 s later it fails on the old code and passes on the new.

## Milestone 203 — A late packet does not bring the dead back ✅

Plan section 12, item 1. State packets travel on the fast channel, which keeps no order, so one sent a
moment before a player went out could arrive after their "down". It said alive, and stood them back up on
everyone else's screen until their next packet. A "down" now carries the sender's clock stamp, the same one
their states carry. A state stamped at or before it is stale and does not stand them up; their next life is
stamped later, so a respawn still does. An older build sends no stamp and is read as before, and a clock that
starts over forgets the old time rather than hold it against the new one.

`tools/checks/net-delta.ts` plays it between two real Duels over the test wire: an early state replayed after
the down leaves the player out, and a later-stamped one brings them back. The first fails on the old code.
The duel, triple and squad e2e sections pass.

Of plan section 12's items, 1, 2, 3, 4, 7, 8, 12, 13 and 14 are now done. 9 and 10 are settled for SpeedKills
only: its hacks sit on their own buttons and keys (Milestone 192), while the legacy kit's card can still pick
two of six on a pad and its ultimate still shares Z with the zoom. Still open: 5 (a reviver is credited before
the revive is confirmed) and 6 (the legacy game's box-respawn lockouts counted separately on each browser).

## Milestone 204 — The movement lab ✅

Plan section 7.13, practice is core. `src/game/arenas/movelab.ts`, a TRAINING card in SpeedKills.

- **Three stations** in a walled night yard:
  - blocks of 2, 4 and 8 m to climb (a mantle, a storey, two storeys with a double jump first);
  - a 30 m wall to wall-run along either side, neon at a run's height;
  - decks a storey up with a 4 m and a 6 m gap between them, and a stair to the first.
- **Built by the arena builder** in the city's look, only in SpeedKills. It is no match's map, so it is not held
  to the arenas' bot-route rules (its floors are exactly the ones a bot cannot reach), but the arena check still
  holds it clear of every other place in the world.
- **Checked:** the e2e opens it from TRAINING and climbs the storey block to its top for real; snapshot
  `sk-lab`. The lobby check counted mode cards by an exact class and now allows a card with more classes.
- **Found on the way:** the range's first-lock hint ("THE RUN: the two movement courses are through the lit
  gates behind you") came up wherever you were first in play, the arenas and the lab included. It waits for the
  range's spawn now.
