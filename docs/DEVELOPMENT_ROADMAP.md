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

- **The ten:** PANDA and STRYDER (rifles), ANAKIN and USSO (SMGs), BIGANTLER and REZ (shotguns), HAEFY and
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

## Milestone 205 — SpeedKills' dropship, ridden ✅

The owner's rule for the ship (it starts off the city and flies at least five seconds before its doors open,
so the city loads behind it) was held only by the games check, on the config. A new e2e section, `skship`,
rides it. The match starts aboard, 135 m off the city's edge, with the doors 5.8 s away. A jump held with them shut is refused,
and taken as they open. The drop lands in the city: jumping the moment the doors open lands at its rim, 0.4 m
inside the edge, so the check allows a metre (the player's bounds keep anyone from landing outside).

## Milestone 206 — A revive is credited when it happens ✅

Plan section 12, item 5. The reviver was credited the moment their hold ended: the "IS BACK UP" notice, the
sound and the revive's EVO. That included a revive that never happened, when the mate bled out as the hold
finished. The credit now waits for the revived player's own word that they are up, and is dropped if they
are out instead or say nothing for three seconds (squad.json `reviveConfirm`).

The squad e2e holds both ends: a real revive still credits the host, and a pending revive for a guest who is
out credits nothing. The second fails when the rule is put back to crediting at once. The old race itself,
a bleed-out in the same frame as the revive's end, cannot be staged reliably, so the rule is what is tested.

Of plan section 12 only item 6 is still open (the legacy game's box-respawn lockouts counted separately on
each browser; SpeedKills has no lockout).

## Milestone 207 — Bots take the high ground ✅

`src/game/botbody.ts`, `tools/checks/sk-roofs.ts`, city.ts `ROOF_ROUTES`, brmatch.ts `climb`.

- **The way up on the graph.** SpeedKills' bots never left the streets: the city's graph had no nodes inside
  its towers. The building generator now returns each tower's way up as waypoints:
  - from outside a door, in, then for each flight along the west side to its end wall;
  - along the wall to the flight's foot, hard against the wall and partly on the first step (from the side,
    the second step is in the way: a body is 0.82 m across);
  - up the axis to the top step, and off it sideways onto the floor beside the hole.

  The city puts the low towers' routes (up to 4 storeys, city.json `botRoofs`) on the graph. Each runs from a
  door on its block's edge straight out to its street, then along the street to a crossing a bot can walk to.
- **The choice.** In SpeedKills a bot arriving at a street node now and then takes the high ground, by its
  tier's chance (bots.json `skRoofs`; never a beginner). It walks the stairs to the nearest free roof within
  120 m and holds it 25 s. A climb comes before looting or a hunt, but gives way to someone in sight and to the
  decay. A climbing bot walks right onto each waypoint, not to within 1.5 m of it.
- **Checked** by `sk-roofs.ts`, which walks every route with a bot's own rules. Those rules now live in
  `botbody.ts`, which the bots, the city and the check share. It found four real faults on the way:
  - the step-off point sat where the next flight leaves half a metre;
  - doors on the side between a block's two towers;
  - the nearest crossing as the crow flies was behind a block;
  - **overlapping towers.** A block's split direction was drawn per tower, not once per block, so two towers
    could stand inside each other. That is fixed for the whole city; putting it back fails three routes.
- **Live:** the e2e sends a bot up a tower in a real match and it walks the stairs to the roof (11.8 of 12.2 m).
  It stayed on the street until a climb came before looting and walked right onto its waypoints.
- The hurry toward the final sector aims at the nearest node on the ground now, not one up a tower's stairs.

## Milestone 208 — One count of a player's deaths ✅

Plan section 12, item 6, the last of its races. The legacy game's Deathbox Respawn lockout grows with a
player's deaths, and each squad mate counted only the downs it heard. So one lost message gave a squad mate a
shorter lockout than the player's own, and a respawn the player's page would refuse. A player's "down" now
carries their own count, noted before it is sent, and squad mates take it. An older build sends none and is
read as before. `net-delta.ts` loses the guest's first down on the wire: the host counted 1 against the
guest's 2 on the old code, and 2 on the new.

## Milestone 209 — The downtown core, and jump pads you can read ✅

Phase 19, steps 1 and 2 (`docs/PHASE_19_PLAN_DOWNTOWN.md`, which also holds the gap analysis against Hyper
Scape, from its reviews and eight official screenshots).

- **The core, rebuilt as a downtown.** The Spire's block and the eight round it were a building or two each on
  wide empty streets. Each is now:
  - a lit podium a storey or two high over most of the block, one side left an open plaza;
  - two to four towers standing on the podium, split by canyons of 3 to 4.5 m that a double jump clears;
  - roofs that step in storeys, with parapets, neon edges and plant rooms to take cover behind;
  - a glowing shopfront band along the street.
- **THE SPIRE in tiers:** a podium, three tiers stepping in 5 m at a time, a pad up each, and a mast. The
  capture zone, when it opens there, is a king of the hill up its terraces.
- **Jump pads on every block of the core.** One on the plaza throws you onto the podium; one on the terrace
  throws you onto a tower's roof, up to 48 m. Hyper Scape had "jump pads on every city block" (PC Gamer).
  - They throw straight up, and carry you over the roof's edge once you are above it.
  - Timed as one arc, a fraction of a second off met the wall metres below the top. The pads' e2e caught it
    three ways: a fixed nudge, the body's middle aimed at the face, and a crossing at the peak that needed 13 m.
  - Their speed comes from the movement's own gravity, measured at 17.5 m/s², not the 19 m/s² first assumed.
- **Pads you can read from a street away,** as Hyper Scape's were: a gold disc, a beam of light up to where the
  pad throws you, and gold rings on it, one overhead and one at the roof it lands you on.
- **Checked:**
  - The e2e rides a street pad (0.2 to 8.2 m) and a terrace pad (8.2 to 56.2 m) in a real match.
  - The capture test now drops the player onto the zone, since the Spire is solid to its tiers.
  - The roof-climb check blinds its bot, which had chased someone in sight straight past its stair.
  - The city's budget holds: 12,060 meshes merged, 164k triangles.

## Milestone 210 — The mid-rise ring, and loot on the roofs ✅

Phase 19, step 3.

- **The sixteen blocks round the core** are Hyper Scape's mid-rise blocks now (city.json `perimeter`), where
  they were one or two towers on open pavement:
  - buildings 9 to 12 m deep, standing wall to wall round the block's edge on a courtyard, with one passage in
    from the street;
  - heights of 3 to 8 storeys, each never more than two from its neighbour, so the roofs run round the block:
    a storey is a climb, two a double jump and a climb;
  - a pad on the street onto the lowest roof of the north side, and one in the courtyard.
- **Loot on the roofs.** Loot was only ever put on floors up to 12 m, a number from the legacy map written into
  the code, so the city's roofs (12 to 60 m) were bare and the high ground held nothing. The height is a game's
  setting now: 60 m in SpeedKills, 12 in the legacy game. In a real match, 137 items are over 12 m and 84 over
  24 m; before, there were none over 12 m.
- **The edge ring** stays as low buildings you enter by their stairs. Those are the ones the bots climb, and
  Hyper Scape had its enterable loot buildings too.
- **Checked:** the city's budget (8,836 meshes merged to 240, 147k triangles, fewer than before: a solid
  building is cheaper than one with floors inside), the roofs' routes (12, walked), the SpeedKills e2e (47,
  with the new roof-loot check), and the snapshot `sk-city-midrise`.

## Milestone 211 — A landmark in every district ✅

Phase 19, step 4.

- **Each of the eight outer districts has a landmark** on its block nearest the Spire, each a shape of its own
  (city.json `landmarks`), so each district has a face you can navigate by. Hyper Scape's reviewers called its
  districts samey:
  - NEON ROW: a slim 16-storey tower ringed by three tilted holo rings, with screens at its foot;
  - HARBOR GLASS: the Lantern, a ten-storey round tower of lit windows with its crown lit and a pad up each
    side;
  - THE STACKS: six silos joined by catwalks at 16 m;
  - OLD TOWN: a nave with a steep roof, two bell towers and a rose window of light;
  - THE CIRCUIT: a stadium bowl of stepped stands, a ring to run round its top and floodlight masts;
  - THE GARDENS: five stepped garden terraces with trees on each;
  - THE YARDS: two gantry cranes over stacked containers, with their beams walkable and a pad up to each;
  - SKYHAVEN: a station raised on pillars, reached by stairs at both ends.
- **Round towers:** the world's collision is boxes, so a round tower stands on a cross of two boxes that reaches
  its rim where the pads throw you onto it. Its facade texture is tiled in metres like a box's; stretched once
  round the tower, the windows had smeared into a band.
- **Checked:** verify, the city's budget (8,033 meshes merged to 243, 144k triangles), the roofs' routes (11,
  walked), the SpeedKills e2e (60 ok), and new snapshots `sk-landmarks-n` and `sk-landmarks-s`.

## Milestone 212 — Buildings you climb by their stairs ✅

Phase 19, step 6 (the owner's ask: "city streets with buildings with staircases to get to the top and loot
while you don't have loot").

- **The mid-rise ring's buildings are entered.** Each one at least 9 m along the street and up to 6 storeys
  (city.json `perimeter.enter`) has:
  - a door on the street and one on the courtyard;
  - a stair up every floor to the roof;
  - loot on its floors.

  So a player who lands with nothing can climb to the roofs without a pad. The taller buildings stay solid and
  are reached from their neighbours' roofs. Hyper Scape let you into about a tenth of its buildings; this is
  most of a block.
- **The bots use them.** Each one with its door on the block's edge is on the bots' graph. The roof check now
  walks 29 routes from the street to the roof, where it walked 14.
- **Cost, measured.** Entering every building cost 200k more triangles (344k against a budget of 240k). Two
  changes brought it to 201k:
  - windows only on the faces with doors (a wall shared with the next building stays whole);
  - no interiors over 6 storeys.

  The merged mesh count rose to 321, because a sector's buildings use more of the facade materials. Its limit
  is now 400, with the measurement written beside it.
- **Checked:** verify, the city's budget, the roofs' routes (29), and the SpeedKills e2e (60 ok). Loot is now
  spread onto the interior floors: 102 items over 12 m.
- **Researched:** Red Tiger and the free asset kits (docs/PHASE_19_PLAN_DOWNTOWN.md). Nothing ahead needs
  bought assets.

## Milestone 213 — The centre as one district: the concourse ✅

Phase 19, step 5, first half (the owner's ask: the centre the most detailed place on the map, and big, as
Hyper Scape's Red Tiger was).

- **One raised district over the streets.** The core's nine podiums are all the Spire's height now, and lit
  bridges cross every street between them: 12 bridges, 4 m wide, railed, with a gold line along each (city.json
  `concourse`).
  - Each bridge crosses a third of the way along where two podiums face each other. It moves along if a jump
    pad's throw would hit it or if it would land on a stair.
  - The towers stand 3 m back from each podium's edge, a promenade round it that leads to the bridges.
- **A public stair up every core podium,** on its plaza side, with steps of 0.5 m or less. The centre is
  reached with no pad and no gun; the pads stay as the fast way up.
- **Checked by walking it.** The roofs' check walks every stair from the pavement with a bot's rules, and
  crosses every bridge from podium to podium. It failed first on a real fault, a bridge landing across the top
  of a stair, and the bridges now keep clear of the stairs.
- **Also checked:** verify, the city's budget (204k triangles, 322 merged meshes), the SpeedKills e2e (60 ok),
  and a new snapshot `sk-concourse`.

## Milestone 214 — The centre's loot comes back ✅

Phase 19, step 5, second half.

- **The hot zone restocks.** In Hyper Scape's third season, "weapons and hacks quickly respawn at the Red Tiger
  landmark". Ours works like this (speedkills.json `loot.restock`):
  - every 20 s of the fight, the host counts the guns and hack cores left in the centre;
  - once fewer than 60% of what it started with remain, it rolls the hot tier again on up to 8 of the hot
    spots that have nothing lying near them;
  - it sends them as the loot drops it already sends, so a build from before this sees them too.

  The centre stays worth fighting for all match, and the fights come to it.
- **Checked:** a new e2e check takes 70% of the centre's loot away in a real match and watches it come back
  (59 to 71 items). With the restock switched off it fails (59 stays 59), which proves it. Also checked:
  verify and the SpeedKills e2e.

## Milestone 215 — The rooftop highway ✅

Phase 19, step 7.

- **A walkable loop six storeys up** (city.json `highway`). It is a 5 m deck at 24 m over the street between the
  downtown and the mid-rise ring, 860 m round, among the mid-rise roofs and under the downtown's towers. It is
  the fast way round the city, above the fights in the streets.
  - It has railed edges, lit cyan on top and gold under the lip. The inner rails stop short of the corners so
    the turn stays open.
  - It stands on portal frames at the kerbs, so the street's middle, where the bots walk, stays clear.
  - Eight jump pads in the road throw you up onto it.
- **Checked:**
  - The roofs' check walks the whole loop, corner to corner, on the deck. With the inner rails run the full
    length, the old way, it fails at all four corners, which proves it.
  - A new e2e check rides a road pad from 0 to 24 m in a real match.
  - The city's budget: 211k triangles, 330 merged meshes.
  - A new snapshot, `sk-highway`.
- **Two e2e checks made steadier:**
  - The ghost's first walk turns until it has room. It walked forward from wherever the drop put it, and one run
    faced a wall 2 m away.
  - The restore's finish now waits up to 15 s of real time rather than 6. On a loaded machine the 3 s of game
    time it takes ran past 6 s. How fast a restore goes is still checked by the step before it.

## Milestone 216 — The night made beautiful, and golden hour as a setting ✅

Phase 19, step 8.

- **SpeedKills' own neon night** (sky.json `neonNight`). The old moonlight's grey-blue fog washed the far towers
  into flat silhouettes. The new hour is darker: a dimmer moon, a black zenith and a deep violet horizon that
  the fog takes too. The far city goes dark and violet, and its windows and neon carry the picture. The first
  violet was too strong from the air, and the snapshots were used to bring it down.
- **Golden hour as a setting.** Time of day in SpeedKills offers its own two hours: the neon night (the default,
  the owner's call) and golden hour, Hyper Scape's light. The choice is kept apart from the legacy game's hour.
- **Holo glyphs over the skyline** (city.json `skyline.glyphs`): twelve great rings, crystals and knots in the
  districts' colours hang past the edge, so the city glows to the horizon.
- **Lit streets** (city.json `lampPools`): a soft pool of light on the road under every street lamp, all in one
  instanced mesh.
- **Checked:**
  - The sky check now knows an hour outside the legacy menu is SpeedKills' own. It checks that SpeedKills' hours
    are real hours and that the neon night is darker than the moonlight it replaced.
  - A new e2e check picks golden hour in a real SpeedKills page and sees it lit brighter at once and kept.
  - The city's budget: 219k triangles.
  - Snapshots from the air, a street and the Spire.

## Milestone 217 — Street life ✅

Phase 19, step 9 (city.json `streetLife`).

- **Parked cars** on every stretch of kerb, in lanes 4.5 m either side of the street's middle. They are solid
  cover at street level, lit white in front and red behind, in six night-street colours. They keep clear of
  every pad and of every door's way in from the street, and they never stand in the street's middle, which is
  the bots' way.
- **Zebra crossings** on all four sides of every junction.
- **Canopies** over the podiums' shopfronts, on the three sides that are not the plaza's. They are solid: a
  ledge you can stand on at 3.6 m.
- **Checked:**
  - A new check walks every street link of the bots' graph both ways (229 links), with a bot's rules. With the
    cars parked in the street's middle it fails on 130, which proves it.
  - The SpeedKills e2e, 62 ok. One lab climb failed on the first run and passed on its rerun alone; it is in
    the range, not the city.
  - The city's budget: 234k triangles of 240k. The next detail has to pay for itself: stripes as planes, or
    instancing.
- **Not yet:** trees and planters, which wait for the free CC0 Quaternius nature kit
  (docs/PHASE_19_PLAN_DOWNTOWN.md).

## Milestone 218 — The enemy outlined, and speed you can see ✅

Phase 19, step 10, first half (speedkills.json `feel`).

- **A red outline on the enemy under your crosshair** (src/game/outline.ts), after Hyper Scape's. In a city of
  lit windows and neon, a figure against a busy facade is the hardest thing on the screen to read; the outline
  makes it one shape again.
  - It is an inverted hull: a copy of each of the figure's meshes, drawn back faces only and pushed out along its
    normals. A skinned mesh's copy shares its skeleton.
  - It works in every preset, including Competitive, which has no post-processing. It is depth tested like the
    figure, so it never shows anyone through a wall.
  - Its width grows with distance so it holds its size on the screen.
  - It is rebuilt when a figure's meshes change, since a body and its outfit load in the background.
- **Speed streaks.** Fine lines at the screen's edge show once you go past 1.15 times a sprint, and are full at
  1.9 times (a slide, a dash, a pad). They sit over the world and under the HUD.
- **Checked:**
  - A new e2e check stands a bot in front of you: its outline is lit (11 hull pieces) while you aim at it, and
    none once you turn away. With the outline switched off it fails, which proves it.
  - Going past a sprint shows the streaks.
  - A new snapshot, `sk-outline`: a bot in the street, outlined red.
- **Not yet:** the weapons' snap to hand and the hit feedback, the rest of step 10.

## Milestone 219 — The concourse on the bots' graph ✅

Phase 19, step 11, first half.

- **The bots' graph now has the centre's concourse on it:**
  - every podium's promenade corners, linked round;
  - every public stair, from its street's middle to the pavement at its foot, up to its top step and onto the
    podium;
  - every bridge between two podiums.

  A link is made only where a bot walks it both ways with its own rules (botWalk), so the graph never sends one
  at a wall. A bot wandering the centre now climbs to the podiums and crosses between them, the Spire's
  included.
- **The cars are parked before the graph is built,** so every link is walked past them. Parked after, one landed
  across a stair's link to its street, and the street-link check caught it.
- **Checked:**
  - A new check finds a way along the graph from a street crossing to the Spire's podium and walks every link
    of it both ways (11 links, up to 8.18 m).
  - The street-link check: 252 links.
  - Verify, and the SpeedKills e2e (65 ok).

## Milestone 220 — Bots ride the jump pads, and go for the capture zone ✅

Phase 19, step 11, second half.

- **The centre's jump pads are on the bots' graph** as one-way steps up. A pad's node says where its throw lands
  you, and the landing lists the pads that throw to it. The plan to a place (navgraph.ts) follows those lists
  back, as it follows a zipline.
  - A bot never takes a pad while wandering: the roofs a pad reaches have parapets it cannot step off, and a
    wanderer would be stranded there.
  - It takes one on its way somewhere: the capture zone, a roof's climb.
- **A bot rides a pad as a player does** (bots.ts `jumpPad`): straight up, then across once above the edge, at
  the movement's own gravity. It is the same throw city.ts solves for a player's body, which is a bot's body
  too.
- **Once the capture zone opens, the squads in its sector go for it** (brmatch.ts `zoneTree`). They follow the
  graph to the node nearest its middle, whatever its height. On the Spire that is the top tier: up a public
  stair, across the bridges and up the tiers' pads, 4 pads to 68 m. They hold it there.
- **Checked:**
  - The roofs' check throws a bot from every one of the 14 pads on the graph, with the bot's physics, and sees
    each land on the roof its node says.
  - It finds the way from a street to the zone on the Spire goes up the tiers by the pads.
  - A new e2e check stands a bot on the Spire's pad to its second tier: it is thrown up (to 51 m) and lands on
    that roof (48.18 m). With the ride switched off it stays at 28 m, which proves it. The check runs early in
    the fight with the ring held: half of all matches end away from the centre, the centre can go in an early
    wave, and one run's bot fell straight through a Spire already dissolved.
  - Another new e2e check: once the zone opens, a bot on a street in its sector takes the graph's way toward it.
    With the bots' zone branch switched off it fails.
- **Two e2e checks made steadier:**
  - The lab's storey climb presses jump for the next frame or two, counted in frames. 30 ms of real time was
    often over before the next frame at the 35 ms a frame a loaded machine draws.
  - The pad check's bot is put back as it was afterwards: its fire, its sight and the ring.

## Milestone 221 — Loot after "land with your loadout" ✅

Phase 20, Part A, item A1 (`docs/PHASE_20_PLAN.md`).

- **The owner:** "i can't loot anything so i can't fusion anything together, can't change my guns ... i did do
  the 'land with your loadout'".
- **The cause:** one flag did two jobs. `startLoot` decided what you land holding, and also whether the floor had
  any loot at all. A loadout start built no loot field, so there was nothing to pick up, fuse or swap, no death
  box, and no echo to restore a ghost at.
- **The fix:** SpeedKills' floor has its loot in both starts (brmatch.ts). The start decides only what you land
  holding. The bots still land as the start says: unarmed and looting in a loot start, armed in a loadout start.
- **What a floor in a loadout start brought with it, fixed with it:**
  - Every landing in a loadout start (the drop, a Resurgence redeploy) is your loadout, fresh and at level 0.
    What you carried is in your death box: keeping it as well put a second copy of each gun on the floor, and
    a level tried on the range's fusion key rode into the match.
  - A ghost restored at its box starts from nothing, whatever the start. Taking the box's copies onto the same
    guns still in hand fused each one a level for the price of a death.
  - Your death box keeps each gun's fusion level; it put every gun down at level 0, in the loot start too. It
    holds only your guns: a loadout start's ammo kit and grenades went down beside them as clutter.
  - A care package holds SpeedKills loot (speedkills.json `loot.carePackage`): one gun at level 3 to 5 and two
    different hack cores at 2 to 4, starting where the Spire's floor stops (3 for a gun, 2 for a hack core). It
    held the legacy game's gun, a gold helmet, batteries and a phoenix.
  - No loadout crates in SpeedKills: a crate swapped your fused guns for level-0 copies of your loadout.
  - A bot's death box is its gun at its level and nothing else. It added legacy ammo, cells and syringes.
- **Legacy is unchanged.** Every change is gated on SpeedKills, and the legacy loadout start keeps its bare
  floor.
- **Checked:**
  - A new e2e check (`speedkillsStartsTest`, in the `speedkills` section) plays both starts through the game's
    own E key:
    - the floor has its loot (930 to 981 items over the runs) and the Spire is the hot zone;
    - you land with nothing, or with your loadout at level 0 after level 3 was set on the range;
    - the bots loot, or land armed;
    - a copy of a gun you carry fuses it a level;
    - another gun swaps in at its level, and the one in hand goes down at its own;
    - your death box holds your guns at their levels, and nothing else.
  - In the loadout start it also checks 24 care packages (SpeedKills guns and hack cores at the package's
    levels), that a round's close calls no crate, and that a bot's box holds only its gun at level 0.
  - The ghost test now runs in both starts. The restored guest must hold the guns it died with, at their levels.
  - Each check fails with its bug put back:
    - without the floor, the loadout start has no drops (-1) and the ghost has no echo;
    - without the fresh loadout, you land at level 3;
    - without the box's level, it holds `r97:0,rspn101:0` for a held `r97:1,rspn101:1`;
    - with the restore not starting from nothing, the guest comes back a level up on each gun (`rspn101` 2 to
      3, `r97` 0 to 1);
    - with the legacy package, crate and bot box back, those checks fail and list the legacy items;
    - with the clutter back, the box lists light ammo and five grenades.
  - Verify, rules, the `speedkills` section (77 ok), and the legacy `loot` and `br` sections (78 ok). The legacy
    sections whose matches land with a loadout, `ship`, `console` and `gulag`, pass unchanged (38 ok).
  - A new snapshot, `sk-loadout-loot`: landed with the loadout, STRYDER in hand at level 0, a PANDA on a zebra
    crossing in NEON ROW and E's prompt to take it.
- **Not changed, noted:** a loadout start now lays out and draws the same floor as a loot start (about 960
  items), so its frame rate is a loot start's. A SpeedKills Resurgence redeploy in a loot start still hands a
  legacy pistol and heals (br.json `resurgence.kit`), as before.

## Milestone 222 — Whole numbers on screen ✅

Phase 20, A2 (the owner saw "33.66666666666666" over a bot).

- **Every damage, health and shield number is whole:**
  - the floating damage numbers and their spray totals;
  - the stats panel's DAMAGE;
  - the health readout;
  - the recaps and the end table;
  - the range's boards.

  They all go through `src/game/damagetext.ts`: a hit reads at least 1, and a pool reads what is left, rounded
  up. The fraction came from SpeedKills bots' shield and health, which come back a sliver a frame, so a hit that
  finishes a part-healed bot reported what it had left.
- **SpeedKills hits land at their tuned value.** Each hit was rounded down as it landed, which cut USSO's 7.8 to
  7 (10% off its time to kill) and made REZ's fusion add nothing. The legacy game keeps whole points.
  `tools/checks/ttk.ts` lands every gun on a figure to hold this.
- **Checked:** new e2e checks for:
  - a HUD frame drawn with fractions in every field;
  - a finishing hit on a healed bot;
  - three 11.16 rounds reading 33 while keeping 33.48 underneath.

## Milestone 223 — No arm in the sights ✅

Phase 20, A3 (the owner: "the left arm is in the red dot and sight area"). Two faults were measured by the
diagnosis at 1280x720:

- **HAEFY and PULSAR, the 3x scope.** Aimed past 0.9, the gun is hidden so the HUD's scope picture can take
  over. The player's arms are not under the gun, so they stayed drawn, frozen, and the scope's narrow view blew
  the left arm up into the picture: 23,800 to 29,200 pixels. Now the arms are hidden whenever nothing posed them.
- **PANDA, STRYDER and NOVA, a reload in the sights.** At full size the reload rolled the gun, and the support
  hand still on the handguard showed in the 2x window: 152 to 621 pixels. A reload while aiming now keeps 15% of
  its roll (speedkills.json `viewmodel.reloadAds` 0.85), so the sight holds steady.
- The four red-dot guns never showed the arm.
- Both fixes are SpeedKills only.
- **Checked:** a new e2e check: aimed through HAEFY's scope the arms are hidden, and through USSO's red dot they
  are drawn.

## Milestone 224 — The city's edge: a fence, a countdown and a laser ✅

Phase 20, A4 (the owner: the edge was vague in the game).

- **A lit red fence on all four sides** of the city, with climbing lines, posts and a strip on the ground. It
  brightens as you come within 12 m (city.json `edge.fence`).
- **38 m of grace past the edge,** where a wall stops you. The owner said about 40; the range's back wall stands
  39 m north of the city.
- **The countdown.** Past the edge the HUD says RETURN TO THE CITY and counts down from 5, in game time, with a
  red vignette. A step back in stops it.
- **The laser.** At zero a red laser comes down on you and floods the screen red. You die OUT OF BOUNDS, in the
  feed and the death recap, through a new cause id (`causes.ts`). Every screen in the match sees the laser.
  - A non-player cause on another screen read "PLAYER 0"; it is named now.
  - The death goes to the Gulag like a ring death (`edge.gulag`).
  - Its box is left where you last stood in the city.
- **The maps** shade the band red and line the edge.
- **Bots** keep to the city: its edge is a wall to them.
- **The skyline** stands out past the wall; its towers stood over the edge.
- **Checked:** a new e2e test in a real match covers all of it: out and counting down, back in and stopped, the
  wall 38 m out, then the death by OUT OF BOUNDS, in the recap and the feed, to the Gulag.

## Milestone 225 — Only the city from the dropship ✅

Phase 20, A5 (the owner saw "the old BR map" from the ship and asked whether both maps are drawn at once).

- **Both maps are never drawn together,** and the legacy map isn't built in SpeedKills at all. What showed was
  the range side of the world: its 400 m sand ground, both courses and six arenas.
  - The side drawn was picked by the camera's position alone.
  - The ship starts 156 m short of the city with the camera behind it, so on every line in from the north (a
    third of all lines) the range was drawn and the city hidden for the first 7.5 s.
  - Aboard and in the dive, SpeedKills now draws the city.
- **37 range objects sat on neither side,** drawn from everywhere: the props, the movement lab, the README TV,
  the spray wall and the drill's pad. When in view they cost 126 draw calls and 582k triangles. They are on
  the range's side now.
- **The ship flies at 175 m,** clear of the skyline's 160 m towers. At 140 m the hull passed through a tower
  top on about a third of lines.
- **Checked:** a new e2e check that aboard, the city is the side drawn.
- **Queued to Part B's frame-rate step:** the figures' skinned meshes skip frustum culling, about 324 draw
  calls and 980k triangles a frame for 27 bots.

## Milestone 226 — The HUD on the bottom edge ✅

Phase 20, A6 (the owner: everything compact on the bottom of the screen, gun names and levels left of the ammo,
the abilities right of the health and bigger, the health bar twice as big, the ammo half as big again, and dark
outlines on all of it).

- **SpeedKills' bottom HUD** is laid out from hud.json `layouts.speedkills`; the legacy HUD draws as before.
  - The shield's segments and a health bar twice the legacy thickness (12 to 24) and a little longer (330 to
    360) run along the bottom left, with the number inside the bar.
  - The two hacks sit right of the health, lower, and bigger (58 to 72).
  - The ammo count is 88 high, 1.52 times the legacy 58. Beside it, the two guns show their fusion pips and
    "LV n" (none for fists or an empty slot).
  - The band is about 100 px tall at 1080p, where it was 150.
  - A fit factor shrinks it on a screen too narrow for both sides, such as 4:3 at the largest HUD scale.
- **A dark outline under every HUD text and round every bar,** so nothing is lost against a lit wall.
- **Also:**
  - The range's stats panel is hidden in a match.
  - The ping and emote wheels, the inventory and the captions draw again while alive (they did not, in both
    games, since 18 September; fixed in SpeedKills).
- **Checked:** a new e2e check reads the boxes the HUD drew in a real match and holds the layout to all of
  that, with nothing overlapping.

## Milestone 227 — Every gun named with its class ✅

Phase 20, A7 (the owner: "USSO (Fast SMG)", so a beginner can see what each gun is).

- **Each SpeedKills gun has a two-word class** (speedkills.json `kind`), read off its numbers. Each pair reads
  Heavy or Steady against Fast or Auto: PANDA Heavy Rifle, STRYDER Fast Rifle, ANAKIN Steady SMG, USSO Fast
  SMG, BIGANTLER Heavy Shotgun, REZ Auto Shotgun, HAEFY Heavy Marksman, PULSAR Fast Marksman, BOOG Sniper,
  NOVA Energy LMG. The Run's pistols are Pistol.
- **`weaponLabel` names a gun with its class wherever there is room:**
  - the loot prompts and the reach list;
  - pickup notices and the range's fusion notice;
  - the Tab inventory, the killcam and the recap;
  - the loadout pickers (wider in SpeedKills) and the loadout list, one line a gun;
  - the bot-gun picker and the loadout crate.

  The HUD's slots show the class after the name in a smaller gold or grey tone. The kill feed names no gun, as
  before, and legacy shows bare names.
- **A fix:** the FUSED notice for a gun or a hack was written over by the bare name straight after.
- **Renamed:**
  - SpeedKills' default loadouts get names that fit their guns: Sidearms is Skirmisher, Dirt Bike is Long Shot.
  - The bot called NOVA is BOT NEXUS, beside the gun NOVA.
- **Checked:** a new e2e check for the label and the loadout picker.

## Milestone 228 — The loot card ✅

Phase 20, A8 (the owner: a UI for a gun on the floor that compares it with yours, in a verbose default that
teaches and a compact one for experienced players).

- **Looking at a floor gun or hack core** (aimed at, or stepped to with the cycle key) shows a card right of
  the crosshair. It does not show for an item that is merely nearest as you run through, or while you aim in.
  - **Its name, class and level.**
  - **What E will do:** FUSES TO LEVEL n, GOES IN SLOT n, SWAPS FOR YOUR X, or NOTHING TO GAIN at the top
    level.
  - **Its numbers beside yours,** better in green and worse in red: time to kill, damage, fire rate, magazine
    (your rounds left against its full), reload, and the headshot for a one-shot gun. A hack core shows its
    cooldown.
  - **Full** (the default) adds what the family is for, what fusion does and what the time to kill assumes.
    **Compact** keeps the verdict and the numbers that decide a swap.
- **The setting:** Loot card, Full or Compact, in Settings (SpeedKills only).
- **How the card is built** (`src/game/lootcard.ts`, pure):
  - The take decision mirrors the pickup's own: a copy fuses, an empty slot fills, the one in hand swaps.
  - The time to kill is the roster check's formula (100 health + 50 shield, 8 in 10 rounds on the body, close
    range).
- **A fix:** holding E over a hack core of the other hack in your slot swapped the two back and forth, about 14
  times in 3 s. The hold now leaves a core that would swap.
- **Checked:** a new e2e check reads the card in a real match in both modes, for a copy of your gun and for
  one you do not carry.

## Milestone 229 — The hacks as Hyper Scape's were ✅

Phase 20, A9 (the owner: the Slam barely goes up, it went about ten times higher in Hyper Scape; work out
exactly how every hack worked, and do not fill gaps by assumption).

- **Researched first.** Three source sweeps, merged and checked quote by quote: 71 of 72 numbers confirmed, one
  refuted and dropped. Two numbers no source gives were measured off gameplay footage, against a training dummy
  of known height and the floor's tiles, to about 15%. Our own config's note had six numbers wrong.
- **SLAM rises about 30 m,** measured (26 to 36; one player's claim was also 30). Ours peaked at 2.3 m, under a
  double jump. Cooldowns are 12/11/10/9/7, and damage is 20 at every level, 30 at the top.
- **DASH is Hyper Scape's Teleport:** about 26 m, measured (23 to 31), the way you look, up included, as far as
  the first wall, momentum kept. Ours was 8 m, flat only.
- **HEAL** gives 4.4 health a second, 6.6 at the top, for 9 s, on 14/13/12/11/9.
- **ARMOR** lasts 4 s on 14/13/12/11/9. It still takes 60% off a hit and lets you shoot, the owner's earlier
  choice. Hyper Scape's made you invulnerable and unable to shoot.
- **WALL** stands 15 s on 12/11/10/9/7, at most 2 up; a third takes the oldest down.
- **INVISIBILITY** lasts 4 s on 14/13/12/11/9. It breaks on firing, and now also on aiming in or using another
  hack.
- **REVEAL** is a 50 degree cone out to 60 m for 8 s, on 12/11/10/9/7. It was 360 degrees for 6 s.
- **MINE** does 40, 60 at the top, on 14/13/12/11/9. It is armed in 0.75 s and chases an enemy within 15 m for
  up to 8 s. At most one is down.
- **Kept as ours:** LEAP and GRAPPLE; Slam's hang, fall speed and radius; the Mine's chase speed and blast.
  No source gives these.
- **Checked:** `tools/checks/hacks.ts` holds the tables, Slam's apex and Teleport's reach.
- **Open for the owner:** Slam now out-climbs LEAP's 16 m; and Hyper Scape's other hacks (Shockwave, Ball,
  Magnet, Fortify) are not in the game.

## Milestone 230 — No smoke and no grenades in SpeedKills ✅

Phase 20, A10 (the owner: remove the smoke grenade from SpeedKills, keep it in the legacy game).

- **The smoke came from the bots.** Each one rolled a random legacy kit, and 6 to 8 of 27 got SMOKE and threw it
  when hurt. SpeedKills bots now take no legacy kit; they carry its hacks.
- **The grenade kit also reached SpeedKills:** every life in an arena match or a loadout start was filled with
  it, and bots carried two frags each. Both are gone.
- **The menus:** the legacy Abilities pickers and the JOLT settings are hidden in SpeedKills. A smoke cloud
  from an older build is not drawn.
- The legacy game is unchanged.
- **Checked:** a new e2e check that no SpeedKills bot carries a legacy kit or a frag.

## Milestone 231 — Two friends into one battle royale ✅

Phase 20, A14 (the owner, 2026-09-26: two friends could not join a battle royale; when the second came in, one
was sent to the lobby).

- **The cause:** a battle royale's host took as many players as the players dropdown said. That dropdown belongs
  to the 1v1 and defaults to 2, so the host and one friend filled the match and the second friend was turned
  away as "full".
- **The fix:** a battle royale's room comes from its squads. Friends as one squad get the squad's size (a trio
  is 3); squads against each other, or solo, get up to 8. Start now still starts with fewer. The dropdown is
  hidden for a battle royale.
- **Also:**
  - The e2e checks for DASH and the bots' Heal now expect A9's numbers.
  - The outline check picks a bot that is not invisible.
  - The HUD layout check runs on a rendered page (a ?norender page draws no HUD, so it read nothing).
- **Checked:** a new e2e section, `skfriends`, reproduced the bug and passes with the fix.

## Milestone 232 — The menu fits, and the game's own scrollbars ✅

Phase 20, A11 (the owner: the menu is not wide enough and shows a horizontal scrollbar; every scrollbar in the
game's colours).

- **The sideways scrollbar did not come from the menu's width.**
  - The two hack pickers on the Play tab are selects as wide as their longest option, and together they made
    the panel 844 px in a 778 px menu.
  - The controller boxes pushed the Controls tab 210 px past the edge.
  - Two SpeedKills rules make them give way.
- **The menu grows with the screen:** 1120, 1200, 1280 and 1400 px at 1280, 1600, 1920 and 2560 wide, one width
  for every tab. The settings' controls get the room to show their longer choices.
- **Every scrollbar is SpeedKills':** a cyan thumb on the panels' night blue, magenta under the mouse.
- **Checked:** a new e2e check opens every Play mode and every tab at 1024x576, 1280x720 and 1920x1080, and
  finds none wider than the menu.

## Milestone 233 — The range as SpeedKills' sandbox ✅

Phase 20, A12 (the owner: after a match it went back to the legacy range; redress it in SpeedKills' style, block
it off about 20 m in, and point to the courses and the README TV. A quick reskin was fine for now).

- **In SpeedKills the range takes the city's night look:** its pavement and street, a dark steel palette and
  magenta neon.
- **A lit edge 24 m down range** (range.json `sandbox`): a cyan grid curtain between magenta posts, where your
  bound ends.
  - It is 24, not 20, because at 20 the wallbounce wall was cut in half; every tour marker is inside.
  - Rounds pass through it to the lanes beyond.
- **The README screen hangs in the edge** at three quarters of its size, readable from the spawn. It was 107 m
  away (readme-tv.json `speedkills`).
- **After a match** your two hacks are back and ready. A notice points to The Run's two courses through the lit
  gates behind you, to the manual ahead, and to the hack keys.
- **Checked:**
  - A new e2e check: a body sent 40 m down range stops at the edge, where the three curtain panels stand.
  - A new snapshot, `sk-range`.
- **Left for later:** the floor's orange stripes and arrows and the screen's frame keep the legacy colours, and
  the courses keep their old look.

## Milestone 234 — Quicker gun swaps, quicker again with each level ✅

Phase 20, A16 (the owner, 2026-09-26: switching between guns should be quicker as a base, 1.5 or 2 times, and
level up along with damage and magazine).

- **A gun's draw and put-away times** are 1.5 times as quick as the legacy data as found, and twice as quick at
  level 5, falling each level (speedkills.json `fusion.gun[].swap`). STRYDER draws in 0.40 s as found and 0.30 s
  at level 5, where it was 0.60.
- **Checked:** `tools/checks/ttk.ts` holds the base, the top and the fall at every level.

## Milestone 235 — Twice the sprint, and always sprinting ✅

Phase 20, A15 (the owner, 2026-09-26: sprint about twice as fast; check whether Hyper Scape had a walk, and if
not, always sprint; the slide only a little faster than the sprint).

- **Always sprinting:** Hyper Scape had walk and sprint, and from its patch 2.1 Auto-Sprint was on by default.
  SpeedKills' new sprint mode, auto, sprints whenever you move forward and is its default. Toggle and hold stay,
  and each game keeps its own choice (`range.sk.sprintMode`), so a legacy toggle does not turn SpeedKills' auto
  off.
- **The speeds** (movement.speedkills.json, the owner's, since no Hyper Scape speed was ever published):
  - the run 347 hu/s (8.8 m/s);
  - the sprint 550 (14.0 m/s);
  - the slide capped at 630 (16.0 m/s), 1.15 times the sprint.
- **The same curve at twice the speed:** every ground band edge and rate is doubled, so the sprint is reached in
  1.4 s from standing, as before, and a stop takes 0.22 s.
- **Bots** move at twice their tier's speed (`botSpeedScale`), and the speed streaks start at the new sprint.
- **Checked:** `tools/sk-movesim.ts` holds the sprint, the time to reach it and the stop. Its roof tests record
  standing on the roof at any point, since a run now crosses a roof and drops off the far side. A jump and a
  double jump now clear 24 m, and every street is 14 m; A17 checks that against footage.
- **Found on the way:**
  - The friends' players count read the page's default squad at load, before the menu had put back the one you
    chose last time. It is set once the menu is built.
  - The skfriends e2e picked its squad without the change event a player's click fires, so it followed whatever
    squad an earlier section had saved. It was also missing from the release batches; it is in batch 2 now.
  - The outline check read nothing on some runs. It aimed at a fixed 1.2 m, which passes over a bot crouched in
    cover (its hit zones shrink to two thirds). It now crouches the bot, aims at its torso, and casts the old
    1.2 m ray too, which must miss, so every run proves a crouched enemy is outlined. It runs before the decay.
  - The tour's HIGH GROUND pulled the trigger on a 120 ms beat, which a page drawing few frames could miss; it
    counts frames now. `__range.triggerWhy()` names whatever holds a trigger.

## Milestone 236 — A friend's swing lands at twice the speed ✅

Phase 20, A18 (smooth play and gunfights with friends), found by working out what A15's doubled speeds do to the
host's check on a claimed hit.

- **The fault:** the host refused a swing when it saw the two players more than 5 m apart. It compares its
  latest states, while the swinger hit the other where they were drawn: up to the jitter buffer's 0.3 s behind,
  plus a trip across the network. At SpeedKills' top ground speed (16.1 m/s, a holstered sprint) a target
  running away in that time is 7.2 m further on, so a real swing at arm's reach could be 9.4 m apart at the host
  and was thrown away. At the old speeds it sat just inside the 5 m.
- **Now:** SpeedKills' limit is the swing's reach plus its fastest speed times that staleness, all read from the
  config (net.json `_hitCheckSk`): the 1.8 m swing plus an arm's corner at 0.40 m, measured off the figure's hit
  zones, and 16.1 m/s times 0.45 s. The legacy game keeps its 5 m. A gun's claim was already wide enough (10 m
  plus 30%), and a check now holds that too.
- **Checked:** `tools/checks/hitcheck.ts` runs in both games now (verify runs it with SpeedKills named too). The
  SpeedKills swing on a target at the top speed, seen as late as the buffer allows, passes, and fails with the
  old 5 m put back. Run under SpeedKills for the first time, two of its older checks failed on the test's own
  gun (built at level 0 where the host caps a claim at the top fusion level); the test builds it as the host does.

## Milestone 237 — The bots keep their aim against twice the speed ✅

Phase 20, A18 (gunfights), and the other half of what A15's doubled speeds did without anyone choosing it.

- **The fault:** a bot's aim follows its target late by its tier's lag, so it trails a steady runner by the
  runner's speed times the lag, and a body is half a metre across. A15 doubled the runner's speed, so every tier
  trailed twice as far and hit a running player about half as often: Skilled went from 1.2 m behind a legacy
  sprint to 2.6 m behind a SpeedKills one. The tiers were tuned at the old speeds.
- **Now:** SpeedKills' bots aim with their tier's lag times `botAimLagScale`, 0.5 (speedkills.json, with its
  reason), through `bots.ts aimLagOf`. Beginner, Easy and Normal trail a SpeedKills sprint within 5% of what they
  trailed a legacy one. The follow moves a frame's share of the gap rather than an exact exponential, so at 60
  fps Hard and Elite come out a little closer (0.48 m to 0.40, and 0.19 to 0.08), inside their own aim error at a
  fight's range. The legacy game keeps every tier's own lag.
- **Checked:** `tools/checks/bot-aim.ts` runs the bot's own follow behind a target at each game's sprint; no tier
  trails a SpeedKills runner by more than it trailed a legacy one. With the scale back at 1 every tier fails, its
  trail doubled.
- **The owner's to change:** 1 would leave the bots weaker against the new speeds, if easier bots are wanted.

## Milestone 238 — The bought soldier, live ✅

Phase 21 (the overnight brief, S1 to S9), live on the game server at 5ee71b4.

- **Every SpeedKills figure is the Sci-Fi Modular Soldier** (AC Game Assets) when its files are on the server, in
  four variants (VANGUARD, BREACHER, RECON, RUNNER; `src/config/soldier.json`) with their own colours rebuilt the
  way the pack's shaders make them. Without the files (a checkout, Pages) the figures are as before.
- **The game's animations on it:** `src/game/retarget.ts` carries every clip from the T-posed clip rig to the
  soldier's A-posed rig in world space; `tools/checks/soldier.ts` proves every limb points as the clip rig's do
  (0.0 degrees off, 43.6 with the alignment taken out) and the feet stay on the floor.
- **Four draws a figure:** each variant's 18 pieces are merged into one skinned mesh per material, exact to
  0.000 mm mid-sprint.
- **Kept local:** `npm run rules` fails on a tracked paid file, Pages drops them from its build, and the live check
  no longer counts a download the page cancelled as a failure.
- **Tested:** verify and rules; the three e2e batches (the failures, two bot tiers and a friend's search round,
  passed alone); `npm run fit`; the SpeedKills sections with the soldier; and the fallback with no paid files.
- **Next:** the picker for the variants and colours (S6), and the bought guns (W2 to W8, under way).

## Milestone 239 — The bought guns, live ✅

Phase 21 (W1 to W6), live on the game server at 9915b25.

- **Every SpeedKills gun wears its Sci-Fi Battle Weapons model** (Tirgames) when the files are on the server:
  the mapping is `src/config/paidweapons.json`, one line a gun, and the owner can change any of them.
- **The procedural gun stays underneath** as the skeleton the view model, the hold and the animations read; the
  bought model is turned from the pack's +Z to the game's -Z, set on the grip, and the muzzle and sight line move to
  its measured ones (`tools/checks/paid-weapons.ts`). Its magazine, slide and pump go in the procedural groups, so
  a reload takes the real magazine out. Unity's collision hulls are never drawn; the scopes' reticles are the pack's.
- **The fusion level shows:** the skin moves A, B, C and the glow brightens a step each level.
- **Tested:** verify and rules; the three batches (the one failure, the legacy host migration, is the known open
  item and also failed alone, before any of this work); `npm run fit`; the SpeedKills sections with the guns.
- **Next:** floor guns wear a simplified bought model (970 items on the floor need one), the heals and cases.

## Milestone 240 — The four chimneys, the owner's chain built into the city ✅

Phase 21 (the brief's 4.4), measured in the city and proven where they stand.

- **The centre's canyons measured** (`tools/centre-canyons.ts`): twelve between the Spire sector's towers, 4.87 to
  5.67 m wide. None takes the chain, which climbs up to 4.25 m wide (`src/config/reach.json`), so the chimneys are
  built as walls in canyons the city already has, and nothing else moves.
- **Four chimneys**, one each side of the Spire (`src/config/city.json` chimneys): two runnable walls 3.0 m apart and
  27 m long, a landing 5.5 m up at the far end, the top 11 m up at the near end, the chain line lit in magenta.
- **Proven in the built city** (`tools/checks/sk-chimneys.ts`, in verify): in all four, sprinting in and kicking
  wall to wall reaches the landing without touching the floor or climbing; turning on the landing (the tap-strafe
  180), the chain climbs on to the top; and without the kicks the same runs do not get there.
- **Where to look if it breaks:** a change to wall running or the kick shows in `tools/checks/reach.ts` first (the
  zig-zag's climb a crossing), then in sk-chimneys.

## Milestone 241 — The pack's props in the world ✅

Phase 21 W7: the rest of the Sci-Fi Battle Weapons pack, only where the game already has the thing.

- **The MINE hack** drops the pack's mine; **death boxes** are its weapon storage case; **care packages** its
  weapon case, drawn at 1.3 so it reads from further off; **a HEAL area** has its med kit standing in the middle,
  skin A in a friend's area and the orange C in an enemy's (`src/config/paidweapons.json` props).
- **Floor guns wear their bought skins** at the level they lie at; they had shown the bought shape in one flat
  colour.
- **A name that is not in the import** falls back to our own shapes without a word, so `tools/checks/paid-weapons.ts`
  looks for every prop's model and skin; a wrong skin letter fails it.
- SpeedKills has no grenades, so the pack's grenades are not used.

## Milestone 242 — The soldier, finished: its arms, its clips and where it can be hit ✅

Phase 21 S5 to S8.

- **The picker** takes the wardrobe's place on the Loadouts tab in SpeedKills, and a first visit is VANGUARD.
- **First person wears the soldier's own arms:** the black glove and white bracer in the colours picked, cut from
  the soldier the way the old body's arms were, the fingers from its own copies of the clips. The sights stay clear.
- **A contact sheet of every motion** (`tools/soldier-clips.ts`): 21 motions, front and side, five moments each.
  No feet through the floor, the gun in the hands through every held motion.
- **The hit volumes follow the soldier's bones.** They were a fixed upright column, and the soldier leans into its
  gun, runs bent over and slides on its back: its head was a third inside the head volume standing and wholly
  outside it running, sprinting, crouched and sliding (up to 690 mm off), so a shot on the head a player saw went
  through air. Now each volume keeps its size and follows its bones (`dummy.ts` followBones); the head's middle is
  within 1 mm of the volume's centre in all eight poses, 89% of it inside. Legacy keeps its column.
- **Tested:** the e2e's new `soldier` section (batch 1): it loads, the heads sit in their volumes, figures of
  different operators wear three or more kits, and with every paid file a 404 the game runs on the figures and
  guns of before without throwing; `skfriends` checks a friend's soldier code reaches the host. The two main checks
  fail with the bug put back.
- **Where to look if it breaks:** a headshot that misses a visible head: `tools/soldier-hits.ts` prints each pose's
  offset; a figure with no soldier: the `soldier` e2e section and `window.__range.soldierReady()`.

## Milestone 243 — THE CHAIN: the city's distances as a course ✅

Phase 21 4.6: the grey-box, so the owner can play the distances the centre is built to.

- **A third course in SpeedKills' range**, through a lit magenta gate in the middle of the back wall
  (`src/game/courses/chain.ts`): a run gap (9.46 m), a double gap (16.2 m), a wall gap (27.75 m, a wall run and the
  kick off it), the chimney (the city's, to its landing and on to its top), a zip down, and a window pad that throws
  you through a window 9 m up onto the finish deck. Legacy's range keeps its two.
- **Every width comes from the measured movement** (`src/config/reach.json`, the rules in
  `src/config/chaincourse.json`), so a retune moves the gaps; `tools/checks/sk-chaincourse.ts` (in verify) drives the
  real controller through the course's own colliders: each gap landed clean with its move and not with the one below
  it, the chimney climbed by kicks alone, the way off the top open. With the gaps narrowed it fails.
- **A new measurement:** the wall run's kick carries 34.6 m (reach.json wallKick), against 24.35 m for the run alone
  and 22.1 m for a double jump, which is what makes the wall gap a class of its own.
- **Pads on courses** (`course.ts` CoursePad, stepPads): a pad centres you, throws you straight up and pushes you on
  at a set height, holding the column and the push against your own steering, so the arc is the same from standing or
  a full sprint, straight or from the side, forward held or not. The window pad's throw is solved from the body and
  the gravity; the brief's 2.2 m window cannot keep 0.4 m clear over a standing 1.83 m body, so the window is sized from
  the body (2.0 by 2.8 m) and every one of eight approaches passes with 0.42 m or more clear of the frame on every side.
- **Not yet:** the pad ladder (pads deck to deck up a tower), which is the city's to build.

## Milestone 244 — Every bot its own soldier ✅

Phase 21 S6's "bots pick a random variant and colours".

- **Bots wore their operator's soldier**, and a battle royale's 27 bots share six operators, so they came in six looks.
  Each now wears a random soldier seeded by its id in the match (`soldier.ts` botSoldierCode): the host's figure of it
  (`bots.ts`) and every guest's (`duel.ts` makeAvatar, for a figure whose look carries no soldier) are the same.
- **Checked** (`tools/checks/soldier.ts`, needs no files): 27 bots wear 25 different soldiers across all four kits,
  every code one the network reads back, the same for the same id. With one seed for every bot it fails.
- **The killcam shows the soldier you saw:** its recording carries each figure's soldier (bots, friends and you), and
  its replay wears it; it had only the operator, so a bot or a friend's pick came back in the operator's look.
  `tools/checks/sk-killcam.ts` (in verify) replays a bot's kill and fails with the ghost built from the operator.

## Milestone 245 — Your guns, your pick: each gun's model and skin ✅

Phase 21 W9, the second half of W6 (the weapons' variants the owner asked for).

- **On the Loadouts tab, by each slot's gun** (SpeedKills, with the bought guns in): its model, any of its family in
  the pack (the USSO's two, NOVA's three), and the skin it shows at levels 0 and 1; fusing it still moves on through
  the other two. The finish picker, which the bought model hides, gives way to them.
- **Seen by everyone:** the picks ride the look code as its sixth field (`src/game/gunpick.ts`, one digit a gun),
  kept under `range.sk.guns`; your figure holds your picks on a friend's screen. The wire's look limit went from 64 to
  96: the longest look (every face piece, the longest names) was already 79 and clipped the soldier's code at 64.
- **Every family model measured** (`src/config/paidmodels.json`, written off the models by
  `tools/checks/paid-weapons.ts`, 15 models), so a pick sits in the hands by its own numbers.
- **Checked:** the e2e soldier section picks the USSO's other model and third skin through the selects and checks
  the gun in hand wears both and a friend's figure of you holds that model; with the pick left out of the build it
  fails. Floor guns and death boxes stay each gun as it comes.

## Milestone 246 — The Sky Lobby: towers you run through, and window pads into them ✅

Phase 21, the brief's levels: "window pads into every tower's deck floors from at least two sides".

- **16 downtown towers open at 32 m** (storey 8, `city.json` skyLobby): one storey with a floor, a ceiling light and a
  window 2.0 by 3.6 m in every face, between the mass below and the mass above. A tower is a room you run through.
- **Two lobbies across a canyon have their windows lined up** (7 canyons, 5 to 6 m): a sprint jump from one lobby
  through both windows onto the other's floor. The windows are 3.6 m tall because a jump needs it: it peaks 1.42 m up,
  and a 1.83 m body there is 3.25 m; at 2.8 m every canyon jump hit the lintel (the check fails so).
- **Across a street, a bridge** at the lobby floor from window to window (2, of 25 and 32 m), so you run in one side of
  a tower and out onto a bridge into the next (the brief's "windows are doors").
- **22 window pads** on the podiums, in front of every face with room and nothing overhead, measured off the built
  city (`tools/centre-towers.ts` surveyed it first). A window and its pad slide along the face when its middle is taken;
  a canyon's pad keeps in line with its window; a bridge's face has no pad. The throw is THE CHAIN's (29.3 m/s up for
  the 24 m rise), and the battle royale's pads now centre and hold as the course's do (`brplay.ts` through `course.ts`
  stepPads). Every lobby has a way in, and 15 of the 16 two or more.
- **Proven** (`tools/checks/sk-lobbies.ts`, in verify): every pad throws the real controller through its window onto
  the lobby floor from standing, a run and either side, with 0.44 m or more clear of the frame; every canyon is a clean
  jump and not a run off (which only mantles over the far sill); every bridge runs lobby to lobby. The city's draw cost
  is 235k triangles against its 240k budget, the window pads drawn leaner than a jump pad.
- **Not yet:** the bots, which keep to the pads they use now until their route finder knows the lobbies.

## Milestone 247 — The guns audited in every pick: reloads that move, and picks that are real

Phase 21, the owner's question "are the weapons completely in with no bugs?", answered by looking: a new picture sheet
(`tools/weapon-picks-sheet.ts`) puts every gun in every model it can be picked in, at the hip, in the sights and
mid-reload, and prints what the reload moves.

- **Three guns kept their magazines in on a reload** since the guns went live: STRYDER, HAEFY and PULSAR wore the pack's `_1` builds. The pack's `_1` of a family is the same gun as its `_2` (the same length, muzzle and
  sights, measured) in one piece, with nothing a reload can move. Every gun now wears its family's split build.
- **The model picks were not real:** a gun's "other model" was its own family's `_1`, the same gun unsplit, and NOVA
  was offered the launcher's round (0.18 m) as a model. A gun now picks between the pack's guns of its class whose
  moving parts match its animation (`paidweapons.json` modelGroups): the SMGs (USSO, ANAKIN and PULSAR choose between
  the two SMG models). The shotguns do not match (a magazine against a pump: either on the other kept everything still
  on a reload), so they, the rifles, the snipers and NOVA are picked by skin; the Loadouts tab hides the model picker
  for a gun with one model.
- **A bought gun's own scope gives way to a fitted optic** (`viewmodel.ts`): the two stacked filled the sight picture
  under the optic with the scope's back.
- **Guarded:** `tools/checks/paid-weapons.ts` fails when a gun wears or can pick a model in one piece or a part that is
  not a gun (proven with the rifle back on its `_1`); the e2e soldier section's pick is the USSO in the other SMG.

## Milestone 248 — The soldier audited: its own fit test, and everything the hands do

Phase 21 S8, finished, for the owner's "completely in with no bugs?"

- **Its own fit test** (`tools/checks/soldier-fit.ts`, in verify). `npm run fit` paints the figures of before and cannot
  see the soldier, and a picture cannot tell the suit through a plate from the suit in a gap between plates, so it is
  measured on the geometry: the full kit posed by the game's own clips, every suit and head point the armour covers at
  rest tracked with the armour point over it. None is through at rest; the most in any pose is 83 mm at the collar
  while aiming (the suit's neck tucking inside the chest plate's rim) and 10.6% of the covered points in a slide, none
  of it visible at the distances the game is played at (close pictures of aiming, the guard, idle and a slide, front,
  side and back). The check holds it there as a guard against worse; the clips without retargeting put the suit
  253 mm through and fail it.
- **Everything the hands do, on the soldier:** the contact sheet (`tools/soldier-clips.ts`) gained a row: the finisher,
  being finished, reviving, interacting and three emotes, all read right. In first person, holstered (both fists, the
  soldier's gloves and bracers) and riding a zipline (a hand on the trolley, the other on the gun) read right.

## Milestone 249 — One model a gun, by its class; the picker gone

The owner: "one model per gun ... smg is one of the two smgs ... and the skin variants for fused, higher level guns".

- **No picker.** The Loadouts tab's model and skin picks are gone (`gunpick.ts` removed, the look's sixth field with
  it), so a gun's skin says its fusion level to everyone: as found, then the second skin at levels 2 to 3, the third at
  4 to 5, brighter each level.
- **One model a gun, by its class** (`paidweapons.json` guns): ANAKIN and USSO the pack's two SMGs, BIGANTLER and REZ
  its two shotguns, PANDA and STRYDER its rifle, BOOG its sniper, NOVA its launcher (the only drum-fed heavy). The pack
  has no marksman rifle: HAEFY (heavy marksman) wears the sniper and PULSAR (fast marksman) the scoped rifle, where it
  had worn ANAKIN's SMG. Guns sharing a model start in different skins. The pack's two pistols and rocket launcher fit
  none of the ten.
- **A fitted optic mounts where the bought model's sight is** (`paidmodels.json` sightZ, measured), not where the
  procedural gun's was: PULSAR's scope hung in the air past the rifle's barrel.
- **Checked:** the e2e soldier section (the USSO in its one model in hand and on a figure, skin A as found and C at
  level 5, no picker); pictures of all ten at the hip, in the sights and mid-reload.

## Milestone 250 — The pack's own parts move, and every optic sits on its gun

The owner: "ensure it has perfect animations that were given to us". The pack gave none: no clips, no controllers,
no curves in any model (its PDF is a version history). What it gives is each gun split into its moving parts, for the
buyer to animate. Until now only the magazine, slide and pump moved.

- **Every part moves** (`paidgun.ts` hingeParts, `viewmodel.ts` animateParts, `paidweapons.json` motion). Each part is
  hinged at an edge measured off its own geometry, not at its origin (the auto shotgun's parts all sit at the gun's).
  - The triggers swing back on a shot and stay back through a burst.
  - NOVA's drum turns a chamber a shot (45 degrees, its 8 rounds counted).
  - The sniper's two side wheels turn over a rechamber and wind in going into the sights.
  - BIGANTLER's loading gate opens with the pump and for a shell reload, and the shell in the hand rides up into it.
  - The magazine releases (ANAKIN, REZ) go in as a reload starts.
  - The rifle's extruder drops on a shot.
- **The launcher's flip-up sights fold under its optic.** Standing, the front one stood in the optic's window, filling
  NOVA's sight picture. They fold forward from the back edge of the foot; from the middle, the long foot tipped back
  up into the window.
- **Every optic sits on its gun** (`paidmodels.json` railTop, measured without the pack's own sights).
  - STRYDER, PANDA and PULSAR's optic sat on the top of the rifle's hidden scope, 69 mm over the gun.
  - ANAKIN's sat 18 mm high.
  - NOVA's sat on its rear sight, which now folds.
- **BOOG and HAEFY sight down the sniper's own scope.** It is one piece with the gun, and the fitted optic stood stacked
  on it at the hip. The fitted optic's housing is off and the eye comes up the scope's measured axis.
- **HAEFY takes its magazine out on a reload.** Its procedural gun has none, so the bought one's stayed in. The support
  hand of every gun now reaches for the bought magazine's measured bottom.
- **Checked:**
  - `tools/checks/paid-weapons.ts`, on the game's own hinges: the drum turned a chamber puts every round where another
    stood; the folded sights lie under the optic's window (0.103 m against 0.116 m).
  - The e2e soldier section: NOVA's 4-round burst turns the drum 4 chambers with the trigger back, its sights folded;
    BOOG's housing off; HAEFY's magazine 133 mm out mid-reload.
  - Each failed with its bug put back: a 7-chamber step, the middle hinge, the drum left still.
  - Pictures of all ten at the hip, in the sights and mid-reload.

## Milestone 251 — Every bought gun aimed down its own sights; hands the glove's size

The owner, on Milestone 250: "our custom sights on top of the already built in sights, we don't want that", and "the
hands are huge ... the knuckles take up part of the view when aiming and then blocking the gun". Minimal testing, at
the owner's word.

- **Own sights only** (`paidmodels.json` eye, measured; `paidgun.ts` ownSight; `viewmodel.ts` fitOptic). A bought gun
  is aimed down its own sights: the rifle's and the steady SMG's scopes on their reticle dots, NOVA's holographic
  front sight, the sniper's scope on its axis, and USSO's and the shotguns' irons. The gun's optic lends its zoom and,
  magnified, its picture over the screen, and is never drawn. This replaces Milestone 250's optic seat and folding
  flip sights, which are gone.
- **The rifle's scope glass cut out on the gun in hand** (`paidgun.ts` openLenses). The pack paints its lenses on,
  opaque, so the target was behind a blue disc. Figures and the floor keep theirs.
- **Hands and forearms the drawn glove's size** (`fparms.ts` fit). The soldier's armoured hands measure 1.4 times the
  glove the grips were posed for (wrist to middle knuckle 124 mm to 87). Its hand and forearm are drawn at the glove's
  size; the upper arm keeps the body's, since a shorter one ended in the frame.
- **Checked:** pictures at the hip and in the sights of STRYDER, ANAKIN, USSO, BIGANTLER and NOVA; verify, rules; the
  e2e soldier section's parts check now reads no optic drawn on NOVA and BOOG.

## Milestone 252 — The bug hunt: no red ring in a fight, a slide that speeds you up, a support arm that reads

The owner (2026-09-27): a red circle round players in free-for-all and the battle royale, which should mean only out
of bounds; a slide slower than the holstered run; the support arm "clearly fucked up", at the widest FOV especially.

- **No red ring round a player in a fight** (`main.ts` remoteHack). The out-of-bounds laser only ever strikes a player
  who stayed past the edge; it was never the ring. An enemy's HEAL was drawn as a red wall 5 m round them, and in a
  free-for-all every heal of every other player is an enemy's. It is drawn in the heal's own green now, fainter than a
  squad mate's, so red round a figure means the edge alone. Found by logging every red ring, cylinder and column a live
  match draws: the outline under the crosshair (meant) and enemy tracers (meant) were the only other red.
- **A slide speeds you up and holds it** (`movement.speedkills.json` _slide). Apex's slide numbers, fitted to its 275
  hu/s sprint, shed anything above 350; under SpeedKills' doubled 550 sprint that took a slide from 630 to 370 in
  0.2 s. They are doubled with the sprint (the shed above 700, the slide jump's 700, a downhill slide's 1120). A slide
  from a full sprint now runs 630 falling to 560 over 1.4 s, holstered 722 to 637. Guarded in `tools/sk-movesim.ts`:
  faster than the sprint for the slide's first second, a gun out and holstered (it read 317 on the old numbers).
- **The support arm** (`fparms.ts`, `mannequin.ts` slimForearms). The FOV the owner plays at is the widest, 1.571 (110
  degrees); the default is 1.55 (108). The gun and arms are drawn by their own camera at 1.55 whatever the setting, and
  that frame is about 92 degrees tall. With the hands drawn the glove's size (Milestone 251) the forearm was too short
  to take the elbow out of that frame from a handguard: the elbow sat in the lower middle, and the upper arm's cut end
  hung under the gun.
  - The hand is the glove's size (the soldier's is 1.4 times it). The forearm keeps its length and is drawn thinner by
    the same, so it no longer flanks the gun in the sights.
  - The arm is turned until the upper arm's cut end is past the frame's edge: at the hip toward the frame's lower corner
    (straight down it stood like a post), in the sights down under the gun (to the side, it crossed half the picture),
    then on toward the eye only as far as it takes. The thickness used is measured off the soldier (0.069 m at the cut).
  - NOVA's support hand sits furthest out, and at the hip its cut end is still just inside the frame.
- **Aiming from a test's script**: a scripted page aims as it fires (`main.ts`), so a check reads the view aimed for
  real. The view's debug hold moves the gun into the sights but leaves the gun camera at the hip's wider frame.
- **Checked:** the e2e soldier section, where both cut ends are off the frame at the hip and aimed, on the USSO and
  BOOG; verify; rules; pictures at the widest FOV. The range sandbox's edge check now waits on game time, not 500 ms:
  on the e2e's CPU drawing no frame had run.

## Milestone 253 — The USSO and BOOG in the hands: the phase, their own kick, a reload that materialises

The owner (2026-09-27): "tear through two guns, the USSO and the BOOG ... top tier animations ... swapping, recoil,
reloading ... have them kind of phase in like how hyperscape does it ... it doesn't need to be realistic, it needs to
be futuristic."

- **The phase** (`src/game/phase.ts`). A shader on the gun in the hands, never on the copies on figures and the floor.
  A sweep runs along the gun: behind it the gun is solid, on it a cyan band with scanlines, and ahead of it a
  thinning scatter of cells that flicker many times a second. The edge steps by cells, a digital edge rather than a
  smooth wipe. It runs in world space along an axis the view sets each frame, so every mesh of the gun shares one sweep.
- **Swapping** (`gunfeel.json` swap, holster). The gun no longer drops out of the frame. It phases out from the muzzle
  back over the swap's first half, and the next gun phases in from the stock forward over the second, rising a few
  centimetres and unrolling into the hands. Coming whole, the glow flashes. A holster and a draw do the same. Only 12%
  of the old drop is kept: all of it hid the phase below the frame.
- **Recoil** (`gunfeel.json` kick, buzz, pulse, charge). Each gun kicks on a spring of its own. The USSO is stiff and
  quick, back and up a little a shot, with a fine buzz while it keeps firing. BOOG is a heavy punch, 11 degrees of
  muzzle a unit of kick, that settles slowly. The glow jumps on every shot. BOOG's glow drains on a shot and builds
  back over the rechamber, its side wheels turning, and flashes as it is ready.
- **Reloading** (`gunfeel.json` reload). The magazine drops a short way, in sight, as it phases out, and a new one
  materialises under the gun and goes in. It seats with a slap on the kick spring and a pulse. The plain reload's
  32 cm drop took the magazine, and its phase, out of the frame.
- **Everything else**: `tools/gunfeel-sheet.ts` takes pictures of each through a swap, a shot and a reload
  (`debugView.raise` holds a swap). The two are the proof. Any gun can be given a feel by adding it to
  `gunfeel.json`.
- **Checked:** the e2e soldier section swaps the USSO to BOOG. The USSO's own phase goes to nothing, BOOG's comes up
  whole and drawn, and STRYDER, with no feel, never phases. It failed with the USSO's feel taken out. Also verify,
  rules and the pictures. The slot keys read the real keyboard only, so the section's swaps go through the loadout;
  its earlier scripted slot presses never swapped anything.

## Milestone 254 — The city bundle on the centre: the bought kits dress the Spire sector

The owner bought five city packs (Cyber City, its first-person props, Glass, High City and Kyber) and asked for the
centre "in a much better spot, using the paid assets", a mix of building styles per block, and the kits' look tied to
the graphics presets. This is steps 1 and 3 to 5 of `docs/CITY_BUNDLE_IMPLEMENTATION.md` section 8 on today's massing;
the new heights (step 2) and the metro come next.

- **The import** (`tools/import-city.ts`, in `npm run paid`; `PAID_ONLY=city`). Each Unity package is unpacked, its
  prefabs resolved through their nested models, and each curated piece baked to one mesh in the game's frame: the
  3ds Max group scale baked in, LOD1 skipped, Unity's left hand turned right. URP and Built-in materials become PBR,
  HDR emission a strength; TGA, PSD, PNG and TIF maps become WebP at 1024 and 512 px. 431 pieces in five packs, 78 MB
  at 1024 and 31 MB at 512, all in gitignored `public/models/paid/city/`. Each piece's size, triangles, facing and wall
  plane are measured into `src/config/citykit.json`, so the placement and the checks never need the files.
- **The wall plane is measured, not the largest face.** A High City module's largest front area is its pilasters,
  with the wall and its lit windows 0.4 to 0.7 m behind them; set on the pilasters, the windows sank into the box and
  the face looked bare. The wall is the deepest plane holding a quarter of the largest area, and a module's relief in
  front of it is pressed into 0.5 m (`dress.relief`).
- **The dressing** (`src/game/citydress.ts`). A style per block: Kyber concrete on the four corners, High City
  brownstone north and south, Cyber City classic windows east and west, Glass on the Spire. Every tower face gets a
  module per 4 m storey and bay, the ground, middle and top rows each their own; the Sky Lobby's storey stays open.
  The podiums get 184 shop fronts, signs, blade signs, posters, AC units and neon holders; the roofs their parapets
  and gear, the ten tallest their antennas; the Spire's tiers carry billboards; cables cross the streets; the 56
  skyline towers each wear a lit building; two zeppelins cross. About 4,500 pieces, placed off a hash of their
  position, so the city's one random stream and its layout are untouched.
- **Looks only; the movement's volumes clear.** The collision is the city's own boxes. A face across a canyon (another
  tower within 8 m) and a bay over a pad wear Cyber City's flat panels, within 0.15 m of the wall, so no relief sits in
  a wall run or a pad's climb; nothing that stands out of a wall is in a chimney, a pad's column or across a Sky
  Lobby's windows.
- **The presets pick the look** (`quality.ts` cityKit, cityDetail). Competitive loads the 512 px packs and wears the
  lightest module of each style between ground and roof, and the lighter shop fronts; Balanced the 1024 px packs with
  signs, AC, roof gear, lamps and posters; High adds pipes, cornices, cables and street props. One instanced mesh per
  piece mesh, about 400 draws, no shadows cast (the boxes under them cast the city's).
- **Checked:**
  - `tools/checks/citykit.ts`, in verify: every piece placed is measured, all 27 centre towers' faces wear their
    facade, 184 shop fronts, the whole skyline, the flat panels within 0.15 m, the chimneys, pad columns and lobby
    windows clear, and each preset's triangles inside its budget (506k, 891k and 929k against 560k, 980k and 1,020k).
  - Over the Spire on the owner's RX 9070 XT, medians with and without the kit: Competitive 8.2 against 7.5 ms,
    Balanced 7.9 against 6.8, High 14.2 against 12.9.
  - Pictures at the plan's cameras, before and after (`tools/city-sheet.ts`), and each pack's pieces in the dev kit
    viewer (`tools/kitview.html`).
- **Known:** the kit does not fade with a decaying sector yet, and the Sky Lobby's storey keeps its old band until the
  lobby lining (step 6).

## Milestone 255 — The centre rises: the twins to 104 m, the Spire's crown deck at 140 m

Step 2 of `docs/CITY_BUNDLE_IMPLEMENTATION.md` (4.3), the heights first: the owner's "super vertical" middle. Every
tower stands where it stood and only rises, so every canyon, chimney, pad and bridge the layout measured is where it
was.

- **The heights** (`city.json` downtown towers, twins; spire tiers).
  - Round the Spire a tower is 14 to 18 storeys over its podium, its roof 64 to 80 m (it was 28 to 64).
  - The two either side of each chimney are the twins, 22 to 26 storeys, 96 to 104 m as drawn.
  - The Spire steps up in four tiers, to 64.2, 96.2, 128.2 and the crown deck at 140.2 m, its mast to 180. A pad up
    each tier's east face; the capture zone's 14 m takes in tier 2's terrace and everything above.
- **Nothing moved.** Each tower's height comes from the one random number it always drew, and the Spire's new crown
  tier draws its roof clutter from a stream of its own, so the blocks built after the Spire's (and everything
  after them) are laid out exactly as before.
- **Every tower round the Spire is now a Sky Lobby tower:** 24 lobbies (16 before), all with two ways in or more, 28
  window pads, 16 canyon windows and 6 lobby bridges, each proven by `sk-lobbies.ts` as before.
- **The plan's detail bands** (`citykit.json` dress bands). The storeys within one of a deck (the podium, the Sky
  Lobby at 32 m, the Sky Park's 64 m, the roof) wear the full modules and the AC units; the storeys between wear a
  far row (Kyber's 8 m window walls, windows on every storey at half the cost a metre) and none. The wall AC went from
  117k triangles to 17k.
- **Checked:**
  - verify and rules; `sk-chimneys`, `sk-roofs` (a bot's way up the Spire: 5 pads to 140.2 m), `sk-roofrun` (141
    gaps crossed, 9 roofs from the best), `sk-lobbies`, `city-budget` (241k), `citykit`.
  - `city-levels.ts`: the highest standing top 142.5 m (70.5 before); the centre's room above 60 m 9,433 m2 (1,478);
    its 30 to 60 m band 7,654 m2, 7,088 of it indoors (none before).
  - The kit's triangles 581k, 1,152k and 1,189k by preset; from 160 m over the Spire (the bench's `skroof`, moved up
    from 100 m, now inside tier 3) the kit's cost stayed inside a shared machine's noise.
  - Pictures: the aerial, the street, the Spire from the street, the north twins.
- **Next in step 2:** the Sky Park deck at 64 m with its bridges to the Spire, and the chimney stacks up to the lobby
  and the Sky Park. The 10 to 30 m band (532 m2) is thin: the plan's balconies and ledges fill it (step 5).

## Milestone 256 — The Sky Park at 64 m: rooms, canyon jumps and four bridges onto the Spire

The plan's second deck (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.4 and 4.5), on the heights of Milestone 255.

- **The rooms** (`city.json` skyPark; `city.ts` mass). Every lobby tower standing two storeys over storey 16 is open
  there too, the lobby's room of four windows at 64.18 m: 17 towers, the twins and the tallest round them.
- **Joined as the lobby is.** The lobby's joins are now one function run at each height (`city.ts` join): across a
  canyon the windows line up for a sprint jump (9, among them each chimney's slot between its twins), across a street
  a bridge runs window to window (4). A tower standing through the height between two rooms now blocks the join, not
  only a tower with a room at it.
- **Four bridges onto the Spire.** Its first tier ends at 64.18 m, so its roof is the Sky Park's terrace: the two
  north twins, the west and the east each have a bridge onto it, kept 3 m in from the terrace's corners and clear of
  every pad's throw, the terrace's parapet opened 4 m where each lands (`city.ts` roofEdge).
- **Faces with no join** keep a window in the middle: a way out, and a drop with no fall stun.
- **The kit** leaves the Sky Park's storey open, as it does the lobby's, and lays no parapet tile across a bridge's
  landing.
- **Checked:**
  - `sk-lobbies.ts`: 17 rooms, all joined; all 9 canyons a clean sprint jump, and none without the jump; all 8
    bridges run onto the far floor, the Spire's four onto its terrace. With the terrace's parapet left closed, the
    four Spire bridges fail.
  - Unchanged: the lobby (24 rooms, 28 window pads, 16 canyons, 6 bridges), the chimneys, a bot's pads up the Spire
    to 140.2 m, 141 roof gaps.
  - `city-budget` 245k triangles; the kit 575k, 1,132k and 1,169k by preset.
  - Pictures from the terrace and from a room.
- **Next:** the chimney stacks up to the lobby and the Sky Park, and the metro.

## Milestone 257 — The arms out of the way, and the USSO and BOOG sharper still

The owner (2026-09-27), at 1920 by 1080 and the widest FOV: the left arm "out of place and covering the weapons", the
USSO "too far down, we can't even see the animations"; and more for the two signature guns, "as crisp as possible".
`tools/pov-sheet.ts` now takes the owner's own view (1920 by 1080, FOV 1.571) standing, walking, sprinting, sliding,
aimed, firing and reloading; every change here was judged on it.

**The arms**
- **The support hand is where the bought gun is held** (`paidweapons.json` support, `paidmodels.json` support, measured
  by `tools/checks/paid-weapons.ts`). It had been where the procedural gun's handguard was: on the USSO over the top of
  the bought gun and, aimed, beside its rear sight, a hand and forearm by the eye. Now it is under the front of the
  USSO's receiver, ahead of the magazine on the rifle and the sniper, on BIGANTLER's pump and ahead of NOVA's drum,
  22 mm above the measured underside.
- **Both arms at the body's size** (`fparms.ts`). Sized to its glove, the support arm took the support glove's 1.15
  and was 15% bigger than the arm on the trigger.
- **A real forearm's thickness** (`viewmodel.json` realArms forearmRadius 0.04, `mannequin.ts` slimForearms). The
  soldier's armoured forearm is 0.079 from its axis (measured on its own points as it loads); the length is kept.
- **The whole upper arm** (`speedkills.json` viewmodel upperArm). With the hand far out on a long gun, forearm and 0.6
  of the upper arm could not reach the frame's edge, and the stub's cut end stood at the bottom. Its points near the
  shoulder are weighted to the arm alone (`mannequin.ts` armWeightsOnly), which stopped them stretching back to the
  unposed collarbone across the screen; when the forearm cannot take it out, the upper arm turns down too.
- **Aimed, the forearms lean out** (`viewmodel.json` realArms adsLean): hanging straight down, the two walled the
  magazine in.
- **Sights further from the eye** (`paidweapons.json` sights ironsEye 0.34, dotEye 0.16). At 0.26 the hands were 20 cm
  from the eye; at a scope's 7 cm relief its rim filled most of the screen.
- **The USSO higher and in** (`gunfeel.json` hip). It sat low in the right corner, half under the HUD's gun panel.

**The USSO and BOOG** (`gunfeel.json`)
- **Their shots throw light:** glowing cells for casings, shrinking as they fall, and on BOOG a shockwave ring off the
  muzzle with a bigger, longer flash.
- **BOOG's scope powers on:** a scan line draws the reticle down the picture over 0.2 s. A ring inside the rim fills
  amber as the gun recharges after a shot and turns cyan when it is ready, with a ping (`hud.ts` drawScope).
- **A scan along the gun:** two passes over an inspect, one when the gun fuses up in the hands.
- **The glow stutters** in the last fifth of the magazine (a quarter on BOOG).
- **Into the sights:** a pulse and a hum.
- **The USSO racks its handle** after a reload from empty.
- **Sounds for all of it** (`audio.ts` phase, recharge, ready, scanSweep, sightHum): digital blips climbing as a gun
  phases in and falling as it goes, BOOG's rising recharge whine and ready ping, the scan's sweep.

**Checked:** the e2e soldier section (both upper arms' cut ends off the frame at the hip and aimed on the USSO and
BOOG, now aimed for real; BOOG part-charged after a shot and whole later; an inspect's scan); verify; rules; the
owner's view of all the SpeedKills guns.

## Milestone 258 — The metro: a loop of tunnel under the centre's streets

The owner: "add a metro level under the street, just for this center part, not a huge area, but a decent amount".

- **The loop** (`city.json` metro; `city.ts` METRO). 288 m of tunnel under the four streets round the Spire's block
  (x and z of -36 and 36), 12 m wide, its floor 6 m under the street and 5 m clear, room for a double jump. Walls
  close it in, with a line of the centre's cyan at a wall run's height; ceiling lights every 4 m; a track down the
  middle; a parked two-car train on each side's inner lane as cover, too tall to stand on under the roof.
- **Eight stairs down,** two a side, from each street's outer lane (a parked car's lane, never the bots' way down the
  middle), at the concourse's rise and run, railed on their sides and over their foot, a light over each mouth. The
  street's plane and the dark plain past the edge have the stairwells cut out of them, and the parked cars keep off
  them, each still drawing its colour so nothing after them moves.
- **The world's floor is no longer always 0** (`floors.ts` floorAt). Over the metro it is the tunnel's, and the street
  is a solid slab over it, drawn only from underneath so it never flickers against the street's plane. What stood,
  flew or landed at 0 now asks floorAt, from a survey of every place that assumed it:
  - the player's ground and a bot's; a drop's surface from the ship;
  - a round (it died at 0: no gun worked down there), a grenade's path and its landing ring, every throwable's
    deploy (shockwave, rift, paint, thermite), a blast's scorch, an aimed hack's point, the dash's landing;
  - loot keeps to the street, where the field always put it: an item that would stand over a stairwell's opening
    goes down onto the stair under it, its height alone moving. Loot on the tunnel's floor moved the field's draws
    and every item after them; the e2e's vault caught it, a supply bin now in reach of its door;
  - a bot on a crossing's road pad: only on the pad's own floor, not under it;
  - a pod, a crate or a landing: never over a stairwell's opening (brmatch overHole);
  - a banner taken from a death box: within 2.5 m up and down, not through the street;
  - footsteps on concrete, not dirt; the callout "IN THE MID METRO";
  - the minimap leaves out what is under the street; the sector decay never takes the street's slab or the metro,
    so a decaying centre does not drop everyone on its streets into the tunnel.
- **Checked:**
  - `tools/checks/sk-metro.ts`, in verify, on the real movement: down all 8 stairs and back up, walking; every side of
    the loop at a sprint on its floor; the street over every side holds a walk; a body dropped in a stairwell lands
    on its stair; a bot stands on the floor and on the street; a drop lands on the street; a round flies 72 m down
    the tunnel; a grenade lands on its floor. With the player's floor at 0 three of those failed, with the round's
    and the grenade's the round stopped at 1.1 m and the grenade froze in the hand.
  - Unchanged above ground: every tower, the lobby and the Sky Park, the chimneys, the roof run, a bot's pads up the
    Spire. The bots' street graph lost one link, the Spire's east pad to a corner of the east block, which ran
    diagonally across a stairwell; the bots walk the other 256.
  - `city-budget` 249k triangles, 393 meshes merged; the kit unchanged.
  - The e2e's SpeedKills sections (speedkills, soldier, sktour, skship, throw, br, loot, brsolo): 227 passed, the four
    vault checks failing on the loot above; with the fix the br section passes, as it does on main.
  - Pictures down the tunnel, into a stairwell from the street and up one from below.
- **Next:** loot of its own for the metro, from a stream of its own so the field's stays as it is.

## Milestone 259 — A hack used in the hands, and HEAL's area, as Hyper Scape had them

The owner: "we have no healing animation or the animation when the user uses a hack, check if hyperscape had those".
It had both. A research pass read Hyper Scape's official hack stills (the archived game-info page's clip frames) and its
players' descriptions; the numbers here are ours, by eye.

- **A hack's cast** (`src/game/hackcast.ts`, `viewmodel.ts` castHack, `viewmodel.json` hackCast). As the stills show:
  - the left hand comes up off the gun in 0.12 s;
  - an amber, cut-cornered holographic card with the hack's icon (ten drawn: dash, leap, slam, grapple, heal, armor,
    wall, invisibility, reveal, mine) stands over the index finger;
  - the finger taps it at 0.17 s and the card breaks into amber pixels, with a digital blip (`audio.ts` holoTap);
  - the hand is back on the gun by 0.48 s. The gun dips to the right and rolls in the other hand while it is up.
  - The hack itself still goes off at once, as Hyper Scape's did ("it's instant. There's no buildup"). The soldier's
    fingers point for it (`mannequin.ts` restFingers: the fist with the index out).
- **HEAL's area** (`src/game/healarea.ts`, `hacks.json` healArea). Hyper Scape's was "a big blue circle" with the heal's
  station in it. Ours is:
  - a ring on the ground with a band inside it, and arcs turning both ways;
  - a low wall of light fading up;
  - sixteen "+" signs rising round it;
  - the bought med kit in the middle.
  - It is the heal's green, not Hyper Scape's cyan (cyan is the signature guns' phase here), and an enemy's is fainter.
  It was a plain translucent wall 5 m round the player.
- **Healing felt in first person** (`hud.ts` drawHealing): while an area heals you, the view's edges glow green and the
  "+" rises up both sides.
- **Other players' mines are the bought mine**, as your own is; they were still the old pink disc.
- **Checked:** the e2e soldier section (HEAL used: the hand up, its card tapped, back on the gun, the ring on the
  ground; it failed with the cast removed); verify; rules; pictures through the cast and of the area
  (`tools/hackcast-sheet.ts`).

## Milestone 260 — Neon Alley: the showpiece street in front of the Spire

Step 3 of `docs/CITY_BUNDLE_IMPLEMENTATION.md` (4.3.1): one street at full density, the before and after for the owner.
The street in front of the Spire's north face (z -36), between the Spire's block and the north twins.

- **Neon up the towers** (`citykit.json` dress alley). Every tower face fronting the street carries neon signs stacked
  in columns 6 m apart from a metre over its foot to 26 m, a horizontal sign or a vertical blade a column: the north
  twins and the Spire's first tier, clear of the pads, the chimney's mouth and the Spire's billboard. They hang in
  front of the facade's relief (a brownstone's pilasters hid them at the wall), and signs and blades now light by
  their own picture, as billboards do: at the kit's own emission they read as dark red slabs.
- **A web of cables** over it in two layers, 6 to 9 m between the podiums and 10 to 14 m between the towers, never
  across a pad's throw.
- **Food stalls** (`city.json` neonAlley). Four solid kiosks on the Spire's pavement, cover a player can use, each
  wearing one of the kit's food stands. The stands are open-fronted, so once every stall wears one the kiosks' own
  materials are hidden (`city.ts` STAND_INS) and their collision stays; on Competitive and on Pages the dark kiosk
  shows.
- **The kerbs:** street lamps, bins and hydrants, clear of the pads, the stalls and the metro's stairwells; AC units on
  the alley's tower faces at 0.35 a bay-storey near a deck.
- **Checked:** `citykit.ts`: 4 of 4 stalls dressed, 50 signs and 16 cables in the alley, nothing standing out in a
  chimney, a pad's column or a room's windows; the kit 580k, 1,166k and 1,203k triangles by preset; `sk-roofs`, the
  bots walk every street link past the stalls; verify and rules; pictures along the street, up the twins, at a stall
  and up the Spire.

## Milestone 261 — The chimney stacks: the owner's chain from the podium to the Sky Park

The rest of step 2 (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.5, route 3): "a window pad into the lobby, through the tower,
out onto the twin slot's chimney stack, three folds to the Sky Park, each turned with the tap-strafe 180, a mantle onto
the Sky Park".

- **The stack** (`city.json` chimneys legs). Each of the four chimneys now climbs ten legs of 5.5 m, a landing at its
  far end and its near end in turn, from the podium at 8.2 m to its summit at 63.2 m, the chain line lit over every
  leg's floor. The old top at 19.2 m led nowhere once the twins rose; now it is the second landing of ten.
- **Two ways off it, two ways on** (`city.json` chimneys exit). The near-end landing at 30.2 m is 2 m under the Sky
  Lobby's floor and the one at 63.2 m is 1 m under the Sky Park's: there the chimney's walls open onto a window in each
  twin's room, which the canyon's join now puts against the room's corner at the chimney's near end. A jump and a
  mantle off the landing take you into the room; from the room a step out of the window drops you onto the landing.
- **The canyon's jump still crosses the chimney,** window to window through both openings, and a run off without the
  jump still does not: the openings run from the landing up, since a sill at the floor's height was a stepping stone
  a run crossed on (sk-lobbies caught it), and a sill between caught a body stepping out.
- **Checked:**
  - `sk-chimneys.ts`: every one of the 40 legs, from standing on its landing to the next; the first two legs and the
    kicks as before; at each of the 16 exits, the mantle in and the step out. With the windows back in the middle of
    their faces seven of those fail.
  - `sk-lobbies.ts`: all 16 lobby canyons and 9 Sky Park canyons, the four chimney slots among them, a clean jump and
    no walk-off; `citykit.ts`: nothing of the kit in any chimney, to its summit; `sk-roofs`, `city-budget` (250k);
    verify and rules; pictures up the stack and from a lobby through its exit.

## Milestone 262 — The levels read up every tower: the lobby's and the Sky Park's bands and rings

Part of step 6 (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.4: "a neon trim ring at 32 m on every lobby tower, so the level
reads from anywhere"). The Sky Lobby's and the Sky Park's storeys had kept the city's old dark texture, a band round
every tower in every picture of the centre.

- **The band** (`citykit.json` dress band). The wall either side of each room's window wears Cyber City's classic
  windows, pressed to 0.1 m so a window pad's throw passes it as it passes a canyon's flat panel. The Glass pack's
  curtain wall was tried first: 204k triangles for the 41 rooms, most of a preset's budget for one storey a tower;
  these are 17k.
- **The rings** (`city.json` skyLobby ring, skyPark ring). A line of light round every room's tower at its storey's
  floor and ceiling, the window pads' blue at the lobby and the bridges' gold at the Sky Park, standing a hand's width
  out so the band leaves it showing. They are the city's own, so a copy without the kit has them too.
- **The rooms are recorded for the kit** (`city.ts` KIT_SITES rooms), and the kit's check now tests every piece
  against each room's window openings, not the whole storey: nothing across any of the 41 rooms' windows.
- **Checked:** `citykit.ts` (596k, 1,183k and 1,219k by preset); verify and rules; pictures from the air and the
  street.

## Milestone 263 — Hack cores and supply bins from the bought pack

The owner: "if there are any other assets that we can use for other things ... no custom ones that we made anymore
... if there are replacements, replace them". An inventory of every bought pack against every gameplay object the game
still built itself ranked these first, from the weapons pack already imported.

- **Hack cores** (`paidweapons.json` props hackcore, `paidgun.ts` paidPropBatch, `loot.ts`). The second most common
  thing on the floor was a spinning coloured box. Now it is the pack's canister, standing and turning, drawn 2.2 times
  its size, glowing in its slot's colour (mobility cyan, utility magenta), over a ring on the floor in that colour, as a
  gun has in its rarity's.
  - A match lays about 477 cores, so the canister (2,382 triangles) is drawn within 22 m of the eye and the box beyond
    (`loot.json` coreDetail). Everywhere, it slowed the e2e's CPU drawing until a two-page ghost check timed out.
- **Supply bins** (props supplybin). They are now the pack's weapon case in skin C, three quarters of its size. Its
  cover is a part of its own and swings open about its back edge once the bin is looted. It stands still; our crate
  spun. A match has 13.
- **Other players' mines** were fixed in Milestone 259.
- **Still ours, by the inventory:**
  - effects (beams, rings, tracers, the edge laser);
  - the dropship's hull;
  - the Gulag flag.
- **Candidates in the city packs, left to the city agent's import:**
  - the dropship's engine pods (High City's "fly engine");
  - the ring consoles (Kyber City's electric box and control panel);
  - doors, cars, fences.
- **Checked:** the SpeedKills e2e section (its ghost restore, which the canister everywhere broke); verify; rules; a
  picture of both on a street.

## Milestone 264 — The metro's own loot and dressing; the parapets and the centre's neon back

- **A fault Milestone 260 shipped, fixed.** Neon Alley's stalls hid their dark kiosks once the kit dressed them, by
  hiding the kiosks' materials. But `flat()` and `emissive()` hand out one material a colour, and the kiosks' were
  the city's dark trim and the centre's cyan neon: on Balanced and High every parapet, rail and canopy in the city went
  invisible (still solid), and every cyan neon in the centre went out. The stalls' materials are their own now, and
  `citykit.ts` holds that each stand-in material is on the stalls' meshes and nothing else: with the shared one back,
  919 meshes.
- **Loot of its own down there** (`loot.json` metro). Four spots down each side of the tunnel, on its floor and clear
  of the train and the stairs, at the small sites' tier, about 20 items a match. Drawn after everything and on a stream
  of its own: `sk-metro.ts` holds that the loot above is the same item for item with the metro and without it, on three
  seeds; with the tunnel's floor back among the field's spots, two of the three moved.
- **Dressed** (`citykit.json` dress metro): posters glowing down both walls every 9 m, above the wall's line of light and
  clear of the stairs and the parked trains; a signal lamp at each end of every side; bins here and there. From
  Balanced up.
- **Checked:** verify and rules; `citykit.ts` (596k, 1,208k and 1,245k by preset); pictures down the tunnel and along
  Neon Alley.

## Milestone 265 — The centre's parked cars are High City's hover cars

Step 4 (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.4: "parked High City cars"). The centre's parked cars were the city's
grey boxes, in every street picture.

- **Each wears one of High City's hover cars** (`citykit.json` dress cars), stretched to the car's box: at 4.4 m long
  the van-sized ones stand the box's 2.1 m with its cabin, where a sedan left the cabin's collision in the air over its
  roof. Nine stand in the centre on seed 42; the rest of the city keeps its boxes.
- **The boxes go, the collision stays.** The centre's cars are built in materials of their own (`city.ts` STAND_INS
  cars, cloned: the city's are shared a colour), which the kit hides once every one wears its car. `citykit.ts` holds
  that those materials are on the centre's cars' five meshes each and nothing else, and every car is dressed.
- **Budgets, benched** (`citykit.json` budget): the bands, the metro's dressing and the cars took Balanced and High to
  1,231k and 1,267k. Benched again kit on and off, interleaved, in the street and over the Spire on a shared machine:
  Balanced medians about 7.5 ms with the kit and 8.3 without, High 14.2 and 13.6. Balanced's limit is 1,300k and High's
  1,340k. The city's merged meshes went to 404 with the stand-ins' own materials (hidden, so not drawn); its limit is
  420.
- **Checked:** verify and rules; pictures of two cars in the street.

## Milestone 266 — A red dot on the USSO, and the draw as Hyper Scape's: a spin, dark cubes, an amber band

The owner: "Does the guns come with like red dot sights? we want to use those if they are available". The pack has
no sight attachments. Its sights are built into three guns (the rifle's scope, the steady SMG's reflex sight and the
launcher's flip-up holo), and its only reticles are two textures: a white tactical dot and the launcher's holographic
ladder.

- **The USSO wears the pack's reflex sight** (`paidweapons.json` guns r97 mount, `paidgun.ts` mountSight). The steady
  SMG's (ANAKIN's) reflex sight is a part of its own. It is lifted onto the USSO's top (it had irons alone) and sits
  into it as far as it sits into its own gun, both tops measured off the models as they load. The USSO is aimed down
  its dot, and its skin follows the fusion level.
- **Red dots** (`paidgun.ts` tintDots). A bought gun's dots take its optic's colour: red on the SMGs, orange-red on the
  rifles and NOVA. They were white.
- **The draw, from the first Hyper Scape research pass** (`gunfeel.json` phase, spin, fuse):
  - PC Gamer: "switching between weapons spins the gun ahead of you like a fractured boomerang, materialising your
    secondary weapon before your eyes and returning it fully-formed back into your hand". A signature gun now turns
    flat once about its middle, out ahead of the hand and a little up, as it phases in or out, and comes back into the
    grip whole.
  - The phase is Hyper Scape's colours: a glowing amber band, the hack cards' amber, with dark pixel cubes ahead of it,
    lit at their rims. It was a cyan band with bright cubes.
  - A fusion floods the gun (its phase dips and rebuilds over 0.55 s) with the scan, where it had the scan alone.
- **Checked:** the e2e soldier section (the USSO in its mounted sight, aimed down a red dot; it failed with the mount
  taken out); verify; rules; pictures of the owner's view hip and aimed on the USSO and ANAKIN, and through the swap
  on both signature guns.

## Milestone 267 — The drop: a shaft down inside the Spire, 120 m to the concourse

The last of step 2's named routes (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.5, route 5, "the drop").

- **The shaft** (`city.json` spire drop). 4 m square beside the crown, open in the top tier's roof at 128.2 m and
  running down through every tier to the podium at 8.2 m, lit down its corners and round its mouth in the chain's
  magenta. No fall damage in SpeedKills: 120 m in four seconds.
- **Two doors.** At its foot a corridor runs out through the first tier onto the podium's terrace; at the Sky Park's
  height another runs out through the second tier onto the Sky Park's terrace, the side no bridge lands on. So the
  crown and the Sky Park both have a fast way down to the concourse. One way: the pads up the tiers are the way back.
- **Cut, not moved** (`city.ts` cutSlab): a building's box can have boxes taken out of it, in bands up its height,
  each band's footprint less the cuts through it. The top tier's roof clutter keeps off the mouth and still draws its
  numbers, so the city's one stream is as it was.
- **The kit** leaves the doors bare: a facade bay over a door is narrowed to the wall either side of it, and the
  Spire's billboard on a face with a door stands to one side, as it does beside a pad's climb.
- **Checked:** `tools/checks/sk-drop.ts`, in verify, on the real movement: the shaft open top to foot, a step into its
  mouth landing at its foot in 4.0 s, out of the foot's door onto the terrace, and in from the Sky Park's terrace and
  down. With the tiers built whole it fails three ways. `sk-roofs` (a bot still reaches 140.2 m up the Spire by pads),
  `citykit.ts` (every tower face dressed beside its doors); verify and rules; pictures down the shaft and at its door.

## Milestone 268 — The vertical centre, measured and held

Step 2 of `docs/CITY_BUNDLE_IMPLEMENTATION.md` ends "the targets in `city-levels.ts` are met". It measured and reported;
now it is in verify.

- **Bands to the crown** (`tools/checks/city-levels.ts`): the street, 1 to 10 m, 10 to 30, 30 to 60, 60 to 100 and
  100 m and up, open and indoors, by sector.
- **The centre held** at a tenth under what it measured after the drop, so a change that takes its height away fails:
  the highest standing top 142.5 m (the plan's target 120 and more); 30 to 60 m 7,810 m2; 60 m and up 15,017 m2 (12,352
  to 100 m, 2,665 over it); 10 to 30 m 372 m2.
- **The plan's targets beside them, not yet met:** 10 to 30 m at 2% of its 15,000 m2, 30 to 60 m at 39% of 20,000, and
  the street 32.7% of the centre's room to stand against 20% or less. Towers are solid between their decks: the plan's
  answer is the floors next to each deck open inside, and stairs or pads up through the towers, which is what comes
  next for the vertical centre.

## Milestone 269 — The gap to Hyper Scape, and the first of it closed: on-gun screens, BOOG's scope, its tracer

The owner: "do the gap analysis between this and Hyperscape for the char models, guns and first person views, even when
aiming down the sights". A second research pass read Hyper Scape's patch notes, press, wiki and footage stills for
aiming, the Ripper and the Protocol V, hands, characters and hit feedback. `docs/HYPERSCAPE_GAP_ANALYSIS.md` is the
gap, matched item by item against the owner's view, with the next steps ranked.

- **A live screen on the gun** (`gunfeel.json` screen, `viewmodel.ts` mountScreen). Hyper Scape's Protocol V showed its
  magazine in blue digits on its side, with fusion as pips, gold at the top. USSO and BOOG now carry one:
  - on the side the eye sees, flush with the model (its side measured as it loads);
  - the rounds in big digits, cyan on the USSO and blue on BOOG, and the fusion level as pips;
  - all gold at level 5, Game Informer's "max a weapon out and it turns golden".
- **BOOG's scope is the Protocol V's** (`hud.ts` drawHsScope):
  - the whole screen in a soft chamfered frame, not a circle;
  - thin red lines across with a gap and range ticks, a post from above and stadia below;
  - the zoom, "x6.00", beside a chevron at the left edge;
  - our recharge as an amber bar under the readout, the lines at full red when it is ready;
  - it still powers on top to bottom.
- **BOOG's tracer**: the Protocol V's "thick, blue bullet tracer", blue and three times as wide (`projectile.ts`).
- **The USSO's flash is warm**, as the Ripper's was, where it was cyan.
- **A hack picked up or fused** taps its card, as Hyper Scape's pickup was "an animation ... where you press hologram
  buttons".
- **Checked:** the e2e soldier section (the USSO's screen shows its rounds and a shot takes one off it); verify; rules;
  the owner's view hip, aimed and firing on both guns.

## Milestone 270 — Floors and stairs inside the towers: the 10 to 30 m band filled

The plan's answer to the gap Milestone 268 measured (`docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md` 2.2 and 2.3): "the
floors next to each deck are open inside" and "every deck, by stairs inside a tower, no pad and no ability".

- **The open floors** (`city.json` skyLobby floors). Every lobby tower also opens storey 3, just over the concourse,
  and storey 7, just under the lobby, as rooms: the lobby's four windows, no pads, no ring, reached by the stair core
  (a climb from the promenade into a window, tried with the lab's climb, stalls on the wall in 92 of 96: the lintel
  3.6 m over the sill is under the climb's reach, so that way in is not claimed). An open storey straight over another
  stands on a floor of its own.
- **A stair core up every lobby tower** (`city.json` stairCore; `city.ts` mass). Two lanes, a flight of 0.5 by 0.9 m
  steps a storey in each in turn, switching back on a landing at either end, from a door in the tower's end face on
  the promenade up through the open floors to the lobby, and on to the Sky Park in the 17 towers tall for it. Cut out
  of the tower (`cutSlab`), so nothing moves; at the top the other lane and both landings are floored and the flight
  down is railed on three sides.
- **Windows and bridges keep off the cores.** A core stands by one side of its tower, set in by the deepest facade
  module, and each tower records where it stands behind its faces: every window, the joins' bridge and canyon lines,
  the window pads' and the rooms' own, is placed clear of it along its face. Two lobby bridges and one Sky Park bridge
  found no line clear of both towers' cores and are gone (4 and 2 left, with the Spire's 4).
- **The kit** leaves the rooms to their own walls (their band, Milestone 262), narrows a facade bay either side of a
  core's door (a lookup that took any door at the storey's height found another tower's: every door was covered until
  `citykit.ts` checked), and keeps Neon Alley's signs and cables off the rooms' windows and the doors.
- **Checked:**
  - `tools/checks/sk-stairs.ts`, in verify: all 24 cores walked with the real movement from the promenade up every
    flight to the lobby or the Sky Park, no climb and no jump; with 0.8 m steps none gets past its first flight.
  - `city-levels.ts`: the centre's 10 to 30 m band 14,920 m2 (372 before), 99% of the plan's 15,000, now held; 30 to
    60 m 9,014 m2; the street's share 25.4% (32.7% before).
  - `sk-lobbies` (24 lobbies, 27 window pads, every bridge and canyon; its runs now start on open floor, not on a
    core's rail), `sk-chimneys`, `sk-drop`, `citykit` (nothing across any room's window or any of the 26 doors),
    `city-budget` (299k triangles, the steps a box each; its limit 320k); verify and rules.

## Milestone 271 — BOOG's scope glints: the lens flare other players see

The first item of `docs/HYPERSCAPE_GAP_ANALYSIS.md`. Hyper Scape's patch 1.1: "a Lens Flare when players are aiming
with the rifle, to give warning to their potential victims".

- **A scoped figure aiming in throws a flare** (`muzzle.ts` fitGlint and showGlint, `mannequin.ts`, `hud.json`
  scopeGlint). On any SpeedKills gun whose optic draws a full-screen scope (BOOG, HAEFY and PULSAR), once the figure's
  aim passes 0.6. Its own texture: a hot core, a soft halo and a long thin streak across it, cool white. It measures
  0.28 m near and never under 18 pixels far; Hyper Scape's players found its flare "too big, covering the entire body".
- **Where it hangs:** 12 cm ahead of the front of the scope, found off the model: the frontmost point within 3 cm of
  the sight line. At the eyepiece, where it was first put, the figure's head and gun hid it. At the lens, the housing
  hid it from every side (the same flare drawn over everything showed there). Ahead, a wall between still does.
- **Checked:**
  - the e2e soldier section: BOOG aimed glints, BOOG at the hip does not, and the USSO's reflex sight has none;
  - verify and rules;
  - pixels at 8 m: 451 in a 140-pixel window brighter with the flare than without.

## Milestone 272 — Flying traffic over the centre's streets

Step 7 (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 5, motion: "flying traffic on splines between towers (High's cars)").

- **High City's flying cars** (`citykit.json` dress traffic) on four loops over the streets: round the Spire's block at
  46 m clockwise and 52 m the other way, at 84 m, and a wide loop over the ring road at 80 m, 17 cars spaced round
  them at 20 to 30 m/s. Between the Sky Lobby's bridges (32 m) and the Sky Park's (64 m) and over it, clear of every
  bridge, pad throw and zipline. Looks only, as all the kit is; from Balanced up.
- **Moved every frame** (`citykit.ts` tickCityKit, from main's step): one instanced mesh for each of a car piece's
  meshes, an instance a car, its matrix set along its loop, turned a quarter so its length runs the way it flies
  (standing, a car's long side faces forward). Never culled, since they cross the whole centre.
- **Checked:** `citykit.ts` holds every car a baked piece on its loop and counts their 27k triangles in Balanced and
  High (1,240k and 1,276k, inside 1,300k and 1,340k); verify and rules; pictures from the street and level with a lane.

## Milestone 273 — The bots take the stairs

The plan's route 1 (`docs/CITY_BUNDLE_IMPLEMENTATION.md` 4.5): "Stairs only to the crown deck. The bots use this route."

- **Every stair core on the bots' graph** (`city.ts`, the concourse's graph): a node on the promenade outside each
  door, linked onto its podium's corners, then one at each waypoint up the flights to the lobby or the Sky Park, each
  link kept only where a bot walks it both ways (`botWalk`), as the public stairs' are. A bot chasing a player or
  making for a place can now go up through a tower.
- **In through the middle of the door.** A core's way now enters on the door's centre line before stepping across to
  the first flight's lane: the straight line from outside to the lane clipped the door's jamb for a bot's body, and
  every core's first link failed (the player's walk slid past it).
- **Checked:** `sk-stairs.ts` holds every core's top on the graph, reached from the street by walkable links: 24 of
  24 (0 before the door's centre line); `sk-roofs` (the street links, the Spire's pads, the highway) unchanged; verify
  and rules.

## Milestone 274 — Movement trails: red behind enemies, blue behind mates, gold behind the crown

The second item of `docs/HYPERSCAPE_GAP_ANALYSIS.md`. A Hyper Scape player: "the red trail of the enemies and the blue
trail of your teammates ... something that every player has", and the crown's carrier's in gold.

- **Every other player leaves a trail** (`src/game/trails.ts`, `hud.json` trails):
  - a ribbon of light 0.14 m across, just over their feet;
  - a point every 0.25 m they go, at most 40, each fading over 0.9 s (a player gone invisible left theirs 0.5 to 1 s);
  - turned to face the eye at every point, so it reads from any side;
  - red for an enemy, blue for a squad or team mate, gold for the crown's carrier (`modematch.ts` crownCarrierId).
- **Limits:** none past 90 m. A jump of more than 6 m between frames (a respawn, a DASH) starts the trail afresh
  instead of drawing a line across the map. A player hidden (invisible, out) leaves theirs to fade, then it goes.
  SpeedKills only.
- **Checked:**
  - `tools/checks/trails.ts`, in verify: a run gathers a point a step; standing still it fades out; a jump starts it
    afresh (it failed with that taken out, 12 points drawn across the gap); past 90 m none; a player gone fades then
    goes;
  - the SpeedKills e2e section (its check on materials three.js rebuilds every frame caught the ribbon drawn two-sided in two passes; it is one pass now); rules;
  - a picture of bots running in a battle royale, their red trails on the street.

## Milestone 275 — Open floors up to the Sky Park: the 30 to 100 m bands

The same rule as Milestone 270, carried up: the floors next to each deck open inside.

- **Three more rooms in every Sky Park tower** (`city.json` skyPark floors): storeys 9 (just over the lobby), 12 and 15
  (just under the Sky Park), all on the tower's stair core, which runs through them. 99 rooms in all now between the
  concourse and the Sky Park, with the lobbies and the Sky Park's.
- **The centre's bands** (`city-levels.ts`, held at a tenth under): 30 to 60 m 17,230 m2 (9,014 before; the plan's
  20,000, 86%); 60 to 100 m 16,381 m2, past the plan's 15,000; the street's share of the centre's room to stand 21.7%
  against the plan's 20% (32.7% this morning).
- **Checked:** `sk-stairs` (99 rooms; every core walked; the bots' graph up all 24), `sk-lobbies`, `citykit` (the
  bands on the new rooms: 618k, 1,219k and 1,255k by preset; Competitive has 2k of its 620k left), verify and rules.

## Milestone 276 — More of the bought kit in use: a style per tower, the streets, the Spire's machinery

The owner: "i am only seeing some assets looking like they are reused, i thought we had a boat load in the 5 that we
bought?" Measured: the centre placed 124 of the 431 pieces imported (Glass 3 of 25, Kyber 12 of 85), each block's
family wearing two to five wall modules, and 1,400 blank panels on the canyon faces. Now 172.

- **A style per tower** (`citykit.json` dress styles). A second set of rows for High City (its wall b set, 10 m
  bays), Kyber (its plain and variant walls, its 8 m windows between decks) and Cyber City (its deep window walls,
  its classic windows between decks); each tower wears its family's first or second by a hash of where it stands,
  so two neighbours of one family differ. Kyber's second is lighter at the street, which took the presets down
  (544k, 1,160k and 1,263k, from 618k, 1,219k and 1,255k).
- **Every neon sign, poster and TV** the packs gave in the lists; roof gear with High's domes and antenna sets, the
  power and electric boxes; antenna masts; three pipe pieces for the wall runs, a piece a column; four more cable
  bundles; street robots, bins and garbage.
- **The streets** (`dress streets`): road decals and sewer covers down the centre's streets, clear of the stairwells,
  the pads and the parked cars; a traffic light at the two corners of each crossing round the Spire the lamps leave
  free; string lights over a shop front here and there.
- **The Spire's machinery** (`city.json` spire machinery): the Glass pack's pipe stacks at the four corners of the top
  tier's terrace and its machine on the crown deck, each over a solid box of the city's (cover on the capture zone's
  last ground), in materials of their own the kit hides once it dresses them.
- **Not yet:** the canyon faces still wear flat panels (Milestone 278 dresses them). High City's wall tiles, meant for
  that, are modelled lying down.
- **Checked:** `citykit.ts` (the machinery's boxes each dressed and its material theirs alone; every piece measured;
  nothing across a window or a door; the budgets); `sk-roofs` (a bot still up the Spire to its crown), `sk-drop`;
  verify and rules; pictures from the street, the crown and the air.

## Milestone 277 — The loading cards run smooth: they wait on a still until the page is calm

The owner, 2026-09-27: "the loading screens with the matrix lag, can we fix that by like slowly fading in or letting it
load first? All those matrix screen have lag".

- **Measured first** (`tools/intro-frames.ts`, new: the gaps between the card's frames while it animates, headless on
  the GPU at the owner's 1920 by 1080):
  - the boot card froze for 2.9 s, 1.0 s and 0.3 s in its first two seconds (five frames over 100 ms);
  - the match card froze twice for 0.8 s, which swallowed its title, shot and blast.
  - The card animates on the page's own thread, so every load step under it (the world, the bought guns dressed, the
    soldier's clips retargeted, the first-person arms built and their shaders compiled) stopped the rain.
- **The card opens on a still** (`src/ui/intro.ts`, `intro.json` settle): its frame, the name faint, the loading line,
  faded in over 0.4 s by the browser's compositor, which keeps going while the page is busy.
- **It starts only when the page is calm:** 12 frames in a row, each within 40 ms or 2.5 times the recent median (so a
  slow machine counts as calm and only a stall holds it). On the boot card the count starts only once the world is in,
  and in SpeedKills also the bought guns (`paidSettled`), the soldier's clips (`mannequin.ts` figuresSettled) and the
  first-person arms (`viewModel.realArms`; they are asked for twice a second, so they came in up to half a second
  after the soldier, on the moving card). It never holds past 14 s (boot) or 4 s (match).
- **Fewer pixels:** the canvas is capped at about 2.2 million (at 2x a 1920 by 1080 screen it filled 8.3 million a
  frame).
- **After:** the boot card's longest frame is 25 ms (was 2867 ms). The match card's longest is one of 110 to 125 ms in
  its fade out, as the match's own first frames show through (was two of 829 ms).
- **Checked:** the tool before and after, three runs each; the intro and SpeedKills e2e sections; verify; rules.

## Milestone 278 — The canyons wear their towers' walls

The biggest repetition left after Milestone 276: 1,461 blank panels up the faces of the centre's canyons, the gaps of
5 to 6 m between towers, where the plan's rule 1 keeps anything from standing out of a wall you run along.

- **Pressed modules** (`citykit.json` dress canyonRelief). From Balanced up, a canyon's face wears its own tower's
  style storey by storey, as its street faces do (the ground row, the top row, the full row by a deck and the far row
  between), each module's relief pressed to 0.1 m, so its front stands 0.13 m out of the wall, inside the plan's
  0.15 m. Competitive keeps the plain panels. The chimneys are unchanged: their own inner walls stand in front of
  the towers' faces.
- **The rule measured, not assumed.** Each placed piece carries how far it really stands out (`KitPlace.out`), and
  `citykit.ts` checks rule 1 against that, not against the piece's unpressed relief.
- **What it costs.** 191k triangles on Balanced and High (1,352k and 1,455k), mostly Kyber's window walls. Benched
  three rounds, interleaved, kit on and off, on a shared machine: in the street, Balanced medians 6.5 ms with the kit
  against 8.4 without and High 12.4 against 13.2; over the Spire, Balanced 5.8 against 6.2 and High 11.5 against
  12.0. The pieces are ones the kit already drew, so draw calls hardly moved. The limits go to 1,420k and 1,530k, a
  twentieth over.
- **Checked:** `citykit.ts` (rule 1 on the pieces' real depth, the budgets, doors, windows, stand-ins); verify and
  rules; pictures down two canyons on Balanced and Competitive.

## Milestone 279 — Doors and windows down the shop streets, and the small pieces

The rest of Milestone 276's pass: the pieces of the packs that were imported and measured but placed nowhere. The
centre now places 206 different pieces (176 after Milestone 278).

- **Shop pairs** (`citykit.json` dress shopPairs). From Balanced up, about a third of the podiums' 8 m shop bays are
  two 4 m pieces instead: one of Cyber City's four shop doors or three street doors beside one of its shop windows,
  either way round. A street front reads as doors, windows and brick piers, not the same shop again, and a pair is
  about a third of a shop's triangles, so Balanced went down 45k (1,306k). Cyber City's second shutter joins the
  shops.
- **The podium's upper floor** wears one of its family's styles, as its towers do (Milestone 276), not always the
  first. Competitive's podiums with it: 562k, inside its 620k.
- **In the lists:** High City's six strip signs with the signs; its wall vents (three discs and a vent box) with the
  AC units on walls near a deck; Cyber City's air pipes and valves with the small roof gear, the first-person
  pack's pipe tubs and Cyber City's pipe holder with the medium.
- **Left out, and why:** the Glass pack's walls (4,700 to 10,000 triangles a module), the metro tunnel tile (21k),
  Kyber's robots (1,600 each) and the dumpsters (2.7 m long with nothing solid under them, and you would run
  through them). The fire escapes wait on solid landings (the plan's rule 7).
- **Checked:** `citykit.ts` (every piece measured, nothing across a door or a window, the budgets); verify and rules;
  pictures of the shop streets.

## Milestone 280 — A thin outline, a heal worth taking, BOOG's reticle through the middle, the ship past the Spire

The owner's feedback, 2026-09-27: "the enemies still have this weird ball of red around them, causing us to not be able
to see/track them"; "if they are using healing, it should just be green and animated like it is now when we throw it,
we should be able to heal in it anyways ... bump that up to actually be a comparable hack"; BOOG's lines "stop in the
middle of the scope ... like we are guessing in the middle"; and "the drop ship should always go over the middle
district, can start from wherever and be slightly to any side, but we should be always able to land at the top middle
building".

- **The red ball was the aim outline** (`src/game/outline.ts`, `speedkills.json` feel.outline). Pictures of bots at 10,
  40 and 90 m, at the hip and through BOOG's scope, found two faults:
  - its width was in metres (0.02 plus 1.2 mm a metre) and ignored the zoom: through the scope at 40 m it was 13 pixels
    a side, and at 90 m the figure was a red shape;
  - the soldier is layers, a body under armour a few centimetres out, and each layer's hull came through the one over
    it: red streaks across the chest, the figure filled red at a distance.
  - Now it is 1.2 pixels at the camera's own field of view (never under 6 mm), and the hull is drawn 0.12 m behind
    where it is along the line of sight, so it lands in the same place on the screen but behind the figure's front:
    only the rim shows. Forced to the 40 m hip thickness on a bot 10 m off, the chest filled red without the push and
    was a clean rim with it.
- **HEAL** (`hacks.json` heal and `_heal`, `healarea.ts`, `main.ts` remoteHack):
  - 12 health a second for its 9 s (13, 14, 15 and 18 by fusion). Hyper Scape's 4.4 was 40 health, barely over our own
    regeneration's 4 a second;
  - anyone's area looks the same (the heal's green at full brightness, the same med kit) and heals whoever stands in
    it, an enemy's included. An enemy's was drawn at 45% and in another kit's skin, and healed nobody but them.
- **BOOG's reticle** (`hud.ts` drawHsScope): the heavy lines still stop short of the middle, and fine lines carry on
  through it to a dot where the shot goes. The gap had left 70 pixels empty at the aim point.
- **The ship past the Spire** (`dropship.ts` shipLine, `brmatch.ts`, `city.ts` SPIRE_TOP, `speedkills.json` ship
  centre): SpeedKills' line passes the crown's middle at 17 to 26 m, on any side and flown either way, square to that
  offset so it comes no nearer.
  - near: the mast on the crown reaches 180.5 m, over the ship's 175, and the ship is 27.4 m across its wings (measured
    off its model), so 13.7 m, the mast's cap and 2 m to spare is 16.8;
  - far: a level glide from the ship reaches about 37 m before it is down at the crown's 140.2 m.
  - The boarding notice says the ship passes THE SPIRE.
- **Checked:**
  - `tools/checks/sk-drop.ts` (in verify), over 60 lines: every one 17 to 26 m off, passing while the doors are open,
    from 8 of 8 headings and 4 of 4 sides, the wings clear of the mast, and a jump at the nearest point gliding level
    with the real movement lands on the crown (9 by 9 m) every time. At random angles through the same points (put
    back), 15 of 60 came nearer the mast;
  - `tools/checks/hacks.ts`: HEAL gives a whole health bar over its seconds and at least twice the regeneration's rate
    at every level (both failed at the old 4.4);
  - e2e: an enemy's HEAL at your feet is an area you heal in; a real match's line passes the crown 17 to 26 m off;
  - pictures of the outline at 10, 40 and 90 m, hip and scoped, before and after; verify; rules.

## Milestone 281 — Fire escapes: ladders you can fight on

The plan's fire escapes (docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md, "ladders you can fight on"; the bundle plan's rule
7), up 18 of the centre's towers, High City's and Kyber's, in their own packs' pieces.

- **Measured, not assumed** (`tools/measure-escape.ts`, reading the baked pieces locally). A tile is one 4 m storey,
  our storey: the plan's "5 m a storey, scale 0.8" came from its bounds, whose top is the handrail a metre over the
  landing. Its flight climbs from 0.71 m along the landing below to 3.1 m along, into a hole in the landing over it;
  High City's and Kyber's tiles carry the same stair. Rule 7 in docs/CITY_BUNDLE_IMPLEMENTATION.md is corrected.
- **How you go up.** From the promenade, jump and climb the drop ladder to the first landing, a storey up (you walk
  under it). Then walk: each flight is eight treads of 0.5 m (under the 0.56 m a body steps up) in the outer lane,
  through a hole in the landing over it cut behind a climber's back from the tread their head would meet it; the
  inner strip is the way back to the next flight's foot. From the top landing, a storey under the roof, climb the
  wall onto the roof, beside High City's gooseneck ladder. Rails round every landing, open over the drop ladder.
- **Solid as drawn.** The stair's lane is 0.8 m, less than a body (0.82 m), so every piece is drawn 1.25 times deeper
  and the solids with it; the solids' numbers are the pieces' own (`citykit.json` dress escapes), and the gameplay's
  in `city.json` fireEscape.
- **Where.** On a street face, a metre from its corner, never over a canyon (its walls are for running), only over
  the promenade, with nothing solid in its way, no pad within 3 m, no window of an open storey within a metre and no
  door; one a tower. Placed last in the build, from a stream of its own, so the city's stream is untouched.
- **What you see.** From Balanced up, the family's pieces: the drop ladder's landing (drawn 0.81 high), a tile a
  storey, and High City's top piece with its gooseneck over the parapet. The facade behind is pressed flat and no
  wall unit, pipe or wire stands in it. On Competitive, and on a copy without the files, the city draws them light:
  a landing's plates, a plate on each flight's slope and each outer rail's top bar (a box a tread and a rail was 82k
  triangles, over the city's 320k; now 317k).
- **What it costs.** 155k triangles of the kit on Balanced and High (1,461k and 1,564k) and 85 draw calls; the
  city's own stand-ins 7k triangles. The kit's limits go to 1,540k and 1,640k without a bench of their own (one
  begun ran beside another worktree's e2e and measured only that; the owner asked for basic checks until the
  next long batch), on the strength of the last one. The interleaved bench with the escapes is owed.
- **Room to stand.** 10 to 30 m: 16,010 m² (107% of the plan's target); 30 to 60 m: 18,775 m² (94%); 60 m and up
  20,069 m². The street's share of it down from 21.7% to 20.9% (the plan's 20% or less). `city-levels.ts` holds the
  new figures.
- **Checked:** a new check, `sk-escapes.ts`: every escape climbed with the real movement, the ladder, every flight
  walked with no climb or jump (1,152 waypoints) and the wall to the roof, 18 of 18; each clear of pads, doors and
  windows. Proven by cutting the landings' holes 0.6 m short: every flight then needed a climb. `citykit.ts`,
  `city-budget.ts`, `city-levels.ts`; pictures from the street, a landing and a flight on Balanced and Competitive.

## Milestone 282 — Steam and flickering signs; the kit told where the metro's stairwells are

Phase 22's item 22.2 (`docs/PHASE_22_PLAN_FINISHING_THE_CENTRE.md`): the centre's atmosphere, and a fault it found.

- **Steam** (`city.json` steam; `steam.ts`). Soft puffs rising out of the metro's eight stairwells, off 17 drains at
  the kerbs and off the plant on seven roofs: 32 sources, 320 puffs, 640 triangles in one instanced draw, moved each
  frame and turned to the camera. Added light, never paint, so it brightens a view but cannot hide a body in it. Kept
  3 m from every pad's column, fire escape and parked car. From Balanced up; Competitive has none. The first tuning
  was invisible (0.16 of added light, under the fog and the tone mapping); it is 0.3, puffs 1.4 to 3.6 m across.
- **Flickering signs** (`city.json` flicker). Six of the centre's holo signs, chosen by where they stand, each in a
  material of its own (a brand's is shared by every sign of it): now and then a burst of one to three brief dips.
  Dips are never closer than 0.36 s, so no sign flashes more than three times in a second (WCAG 2.3.1). From
  Balanced up. Both are the city's own, so they show on a copy without the bought files too.
- **A fault since Milestone 258, fixed.** The metro's stairwells were recorded for the kit (`KIT_SITES.openings`) and
  then emptied by the sites' reset further down the build, so every rule keeping the kit off a stairwell checked
  nothing: Neon Alley's bins and lamps, the metro's posters behind the stairs, Milestone 276's road markings. Cleared
  where it is filled now; `sk-metro.ts` checks the kit knows all eight (0 of 8 with the fault put back). Balanced
  draws 7k fewer triangles: pieces that stood over the stairwells.
- **Checked:** a new check, `sk-atmosphere.ts`: the three kinds of source, the cap, every source in the open and
  clear, a puff's rise and fade, six flickering signs in their own materials, and ten minutes of every sign's light
  sampled at 2 ms: at most three dips in any second, each to its range (proven: dips 0.2 s apart make four). Verify,
  rules; pictures of a stairwell, a drain and a street on Balanced and Competitive.

## Milestone 283 — The graphics setting says what the city looks like on it

The owner, on the live server: "i don't see any of the new map stuff ... the buildings all look basic like before, is
it just not getting deployed?" It was deployed: a fresh browser on fpsfun.duckdns.org drew all five packs about 11 s
after the page opened (41 MB on Competitive; 6,426 pieces, 6,884 on High). The game starts on Competitive, the
owner's "snappy above pretty", and each site keeps its own setting, so the live site was on Competitive: the lean
modules (Kyber's and the Spire's walls flat), no signs, flying cars, steam, canyon windows or fire escape pieces. The
setting's labels said nothing of that ("Balanced: bloom and colour grade").

- **The labels say it now:** Competitive "the city's lean look"; Balanced "the full city (signs, flying cars, steam)";
  High "everything, including ambient occlusion and street detail"; and the setting's hint names what Balanced and
  up add.
- **Asked of the owner:** whether the default should be Balanced, on the benches' evidence that the kit costs no
  measurable frame time on their card.
- **Checked:** verify, rules; the live server loaded headless from an empty cache, timed, and pictured on
  Competitive and High from the same spot.

## Milestone 284 — USSO and BOOG reloads in view, the hand on the charging handle, the support wrist straightened

The owner's feedback, 2026-09-27: the USSO "seems so low still, you can barely tell the mag is morphing"; "rotate the gun
when reloading so that the bottom is more facing the left ... both USSO and BOOG should twist in a bit"; "the charging
handle moves on the usso but the wrist doesn't go for it"; BOOG's charging handle, "can we twist it again, even if
slightly"; the left hand "always ... glitched into the side" of every gun and the arm sticking out; and, of the rack,
"look at how fucked up the left wrist is".

- **The reload twist** (`gunfeel.json` reload.twist, `viewmodel.ts`): through a reload the USSO rolls 0.9 rad and BOOG
  0.8, underside toward you, and each comes up and in, so the magazine phasing out and in is in full view. The plain
  reload's 0.38 roll turned the top toward you and hid the magazine under the gun, which on the USSO was already below
  the screen's edge (a picture with the part tinted: its magazine off the bottom at 1920 by 1080). The USSO's rest
  pose is 45 mm higher.
- **The rack** (`gunfeel.json` rackHand, `paidgun.ts` boltGrip): from empty, the support hand goes to the charging
  handle (the pack's Slider, measured: a knob on the left of the receiver), rides it back and forward, and returns.
- **BOOG's cycle** (`gunfeel.json` cycle): the pack's sniper has no charging handle (its moving parts are the clip, two
  wheels and the trigger), so after a shot, at the hip, it cants 0.45 rad over and back while its wheels turn.
- **The support hand** (`speedkills.json` viewmodel support, `fparms.ts`):
  - under the gun, rolled 1.2 rad and 30 mm lower on the bought guns, whose bodies are wider than the procedural
    handguard the hand was posed round;
  - its forearm sent down and back under the gun rather than to the frame's lower corner: aimed, the forearm that came
    across the sight picture is gone;
  - then rolled round what it holds, pivoted on the grip, until the wrist is nearly straight on the forearm (at most
    1.55 rad: past it the Mastiff's fingers came over the top of its pump), and on the charging handle, a knob, turned
    any way. The wrist was 44 to 83 degrees at the hip, up to 103 aimed and 122 on the rack; it is 10 to 40, up to 47,
    and 10.
  - The soldier (AC Game Assets) and the guns (Tirgames) are two sellers' packs, and neither ships a hold or an
    animation to take a grip from; a first-person arms pack is being looked for.
- **A fault found on the way** (`spring.ts`): the view's recoil springs were stepped once a frame, and the USSO's
  (stiffness 900, damping 46) grew without end below about 23 fps, flinging the gun off (its roll read -695968 radians
  on a software-rendered page). They are stepped in pieces of at most 1/240 s.
- **Checked:**
  - e2e (soldier): mid-reload the USSO and BOOG are rolled 0.9 and 0.8 over (0.38 with the twist taken out); from
    empty the support hand is on the handle for the rack and back on the gun after (15 cm off with it taken out); the
    support wrist is at most 50 degrees held on four guns and 30 on the rack (77 to 122 with the straightening off);
  - `tools/checks/spring.ts` (in verify): every signature gun's kick and the plain one stay in bounds and settle at 60,
    20 and 12 fps (stepped once a frame, the USSO's reached 2.9e28 at 20 fps);
  - pictures at the owner's view (`tools/gunfeel-sheet.ts`, now at 1920 by 1080 and 110 degrees with the rack and the
    cycle; `tools/pov-sheet.ts` ONLY=) of all ten guns; verify; rules.

## Milestone 285 — Doors from the fire escapes into the open floors; the escapes' bench

Phase 22's items 22.3 and 22.1 (`docs/PHASE_22_PLAN_FINISHING_THE_CENTRE.md`).

- **102 doorways** (`city.json` fireEscape door, doorClear). Where a fire escape's landing stands at an open storey's
  floor (the Sky Lobby, the Sky Park and the open floors round them), a doorway 1.4 m wide and the storey's window high
  through that room's wall, in the middle of the landing, onto its inner strip: the outside way up now goes in. The
  rooms record their wall pieces as they are built (the escapes are placed last, once every window and pad is known),
  and the piece behind the landing is swapped for the same wall round a door, only where the room is clear 2 m behind
  it (a stair core may stand there). Each is recorded for the kit, whose band on those storeys leaves it open, and
  whose street and alley cables now keep off an escape (one ended across a doorway on Neon Alley).
- **The escapes' bench** (22.1), from a frozen copy of the shipped build so this worktree's edits could not reload its
  page, three rounds interleaved, kit on and off: in the street Balanced 10.2 ms against 10.2, High 21.1 against 18.2;
  over the Spire Balanced 8.5 against 8.0, High 16.5 against 17.0; another worktree's e2e loaded two of the rounds, the
  third near quiet (Balanced 5.9 against 5.5). About 0.4 ms on Balanced and up to about 0.9 on High: small, kept, and
  written beside the limits.
- **Checked:** `sk-escapes.ts` walks every doorway in and out (102 on 18 escapes), fails when the doors are narrower
  than a body; its clearance rule means a stair core's or the drop's door, not its own. `citykit.ts` (nothing of the
  kit across the 128 doors), `sk-lobbies.ts`, `city-budget.ts` (21,735 meshes of 22,000, 319k triangles of 320k:
  close, for 22.4), `city-levels.ts`; verify and rules.

## Milestone 286 — BOOG's recharge ring in its scope, the USSO higher, the magazine morphing at the gun

The owner, 2026-09-27, after playing: "none of the sniper details we said were in the scope are actually there, like
when the user can shoot again, I thought we agreed on having a bar there"; "the usso needs to be brought up more ...
the cant on the reload isn't really where I thought it would be".

- **BOOG's recharge** (`hud.ts` drawHsScope, `hud.json` hsCharge): after a shot, a ring round the aim point closes
  clockwise as it recharges, RECHARGING under it, and READY flashes as it can fire again. The ring the README promised
  belonged to the older scope style and never came across when BOOG moved to the Hyper Scape scope; what was left was
  a 90 by 4 pixel bar at the frame's left edge.
- **The USSO** (`gunfeel.json`): its rest pose another 35 mm up and 10 mm in; its reload comes further up and in, with
  less roll and the muzzle turned in; and its magazine drops 3 cm, not 10, so it phases out and back in at the
  magazine well, where the morph reads as the gun's, rather than down in the hand. BOOG's drops 4 cm.
- **Checked:** e2e (soldier), aimed in with BOOG after a shot the ring is drawn part closed and later READY (with the
  ring taken out, it failed); pictures at the owner's view; verify; rules.

## Milestone 287 — The bought walls restored: the import had dropped High City's facade materials

The owner, comparing the live centre with the packs' store pages: "the assets have way more detail and look like paid
ones, ours are all stretched out and shitty looking ... was it our pipeline extraction process that broke this?" In
part, yes.

- **The fault** (`tools/import-city.ts`). A prefab that places a model sets its renderer's materials by override,
  naming the renderer by an ID newer Unity hashes from its name, which the importer cannot compute; it found no node
  and dropped the override. Materials whose names matched the FBX's own came through (the windows); the rest drew a
  plain grey. High City's wall rows (wall1a and its variants, wall3b, wall4b, wall1bb) were among the most placed
  pieces in the centre, 141, 103, 92, 82 and 72 times: whole brownstone towers in flat grey-white with yellow windows.
- **The fix.** Such an override goes to the model's only mesh, or to the one whose material slots number what it
  sets. Re-baked (kit version 2, so no browser keeps the old from its cache): High City's walls wear their brick,
  stone and concrete with their normal and occlusion-roughness-metal maps. Of the 203 pieces the centre places, 170
  are whole (155 before); what is left without a texture is plain colour in the packs (Cyber City's and Kyber's black
  trim) and three small pieces (a skyline block, a billboard frame, an AC unit). 178 overrides on models of several
  meshes still find no mesh; none of them on a piece the centre places.
- **New local tools:** `tools/kit-audit.ts` (every placed piece's materials, whole or not), `tools/kit-materials.ts`
  (a piece's materials against the pack's), `tools/kit-drawcalls.ts` (Phase 22.4).
- **Not the pipeline, and next:** the packs' own pictures are human-scale streets under Unity's lighting (fog,
  reflections, many lights) with 4K textures; ours are the vertical centre's 64 to 104 m towers, the modules
  stretched to fit their bays and their relief pressed, textures at 1K. Each is its own step.
- **22.4 (draw calls) on the way:** batching the kit by material (three.js BatchedMesh) drew 205 meshes for 604 and
  40% fewer calls, but no frame measurably faster on the owner's machine, loaded by another worktree through every
  run; with each placement culled in script it was slower. The instanced meshes stay the default, batching behind
  `?kitbatched`, and `?nosteam` measures the steam, for a quiet bench.
- **Checked:** the audit before and after; pictures of the same High City tower and canyon; verify and rules.

## Milestone 288 — A daytime to see the city by, and F8 to flip it

The owner, after comparing the centre with the packs' store pictures (most of High City's in hazy daylight): "add a
toggle for daytime to see the diff".

- **A hazy day** (`sky.json` hazyDay), SpeedKills' third hour after the neon night and golden hour: the noon sky's
  picture with a paler dome, a warm sun high and raking, the fog from 30 m, after High City's store shots. In the
  Settings' Time of day, and a battle royale plays under it too (SpeedKills matches take your hour).
- **F8** (`binds.json` dayNight, "Day or night" in Controls) flips between the neon night and the hazy day while you
  play, and keeps the choice as the menu does.
- **The picture tool** takes `SKY=<hour>` (`tools/city-sheet.ts`), for the same spots by day and by night.
- **Checked:** pictures of a street, a canyon and Neon Alley by night and by day; verify and rules.

## Milestone 289 — The USSO and BOOG in real first-person arms (KINEMATION FPS Animation Ultimate)

The owner, 2026-09-27: the left hand "glitching on the gun", and "start with the boog and the usso for the arms to be
perfect. when we get that commit push deploy then you can work on the rest of the guns". The owner bought KINEMATION's
FPS Animation Ultimate (docs/PLAN_FIRST_PERSON_ARMS.md), arms made for the camera with a hold and reloads per gun.

- **Imported** (`tools/import-fparms.ts`, part of `npm run paid`): the arms (24,360 triangles, glove, sleeve and hand,
  their textures), each clip src/config/fparms.json names as an animation-only GLB, the pack guns the clips were made
  round, and each pack gun's settings (its shoulder offsets). Paid, so never in git; they ship with the game server.
- **Measured** (`tools/checks/fparms-pack.ts`, in verify, skipped without the files): each pack gun's turn on the gun
  bone (90 degrees about x, KINEMATION's own default), its trigger, the underside under the left palm, the shoulder
  offsets.
- **The rig** (`src/game/fprig.ts`, `viewmodel.ts`): the USSO held as the pack's MPS5, BOOG as its L96X:
  - the camera fixed in the rig where the pack's player has it, the gun camera at its 80 degrees at the hip;
  - our gun fitted into the hands (trigger on trigger, tilted to meet the left palm), placed where the pack's gun was
    at the hip, and moved by our view as before (aim, recoil, sway, sprint, the swap's spin); both hands reach it from
    shoulders that stay put, moved as the pack moves them per gun, and back 12 cm more aimed;
  - the reloads are the pack's: the clip turns the gun in the hands (23 degrees for the USSO, 38 for BOOG, its muzzle
    up), our magazine follows the pack gun's own and phases out and in at the moments it leaves and comes home, and the
    left hand carries ours; from empty the USSO's handle is locked back and slapped home, the hand on it; BOOG works
    its bolt after each shot. The view's own reload twist, rack hand and cant stand down for these two.
- **Checked:**
  - e2e (soldier): the bought arms hold both; mid-reload the clip has turned the gun; from empty the handle goes back
    with the left hand's knuckle 5.5 cm from it; wrists within 50 degrees held and aimed (60 on the handle, the pack's
    own grip); the old arms' cut ends checked on the guns they still hold (ANAKIN, HAEFY); the red dot keeps its arms;
  - `tools/checks/fparms-pack.ts`; verify; rules; pictures of the hold, aim, reload, rack and bolt at the owner's view.

## Milestone 290 — Sharper textures on High, lighter on every preset: the packs GPU-compressed

Phase 23's item 23.1 (`docs/PHASE_23_PLAN_THE_PACKS_AT_FULL_STRENGTH.md`). The owner: "YEP SHARPER TEXTERS ON HIGH".

- **Why not just bigger pictures.** A browser decodes a WebP to raw RGBA on the card: the placed pieces' textures were
  1.76 GB at 1K, and would have been 7 GB at 2K (`tools/kit-texmem.ts`). So the textures are now KTX2 (Basis
  Universal), which stay compressed on the card: colours, glows and the packed occlusion, roughness and metal in
  ETC1S, normal maps in UASTC (ETC1S blocks up their slopes).
- **Three bakes** (`citykit.json` sizes, kit version 3): High loads 2048 px (normal maps 1024), Balanced 1024 (512),
  Competitive 512. Only the pieces the dressing names are written: half the packs' textures were for pieces the centre
  never places, and a pack loads whole. `citykit.json` baked lists them, and `citykit.ts` fails if a piece any preset
  places is not in the packs.
- **Measured in the browser** (`tools/kit-vram.ts`, the kit's share against `?nocitykit`): Competitive 50 MB of
  texture memory and a 24 MB download; Balanced 298 MB and 40 MB (from about 1.8 GB and 69 MB); High 1.2 GB and 119
  MB, twice the sharpness in two thirds of what Balanced took before. The rest of the game's textures come to 877
  MB, the next thing to look at.
- **The pipeline.** The importer encodes on every core (`tools/basis-pool.ts`, `tools/basis-worker.mjs`), with Basis's
  own WebAssembly encoder fetched into the paid folder, nothing installed; the game transcodes with three.js's own
  transcoder (`public/libs/basis`). Sizes go in blocks of 4, as the format works. A first bake wrote the KTX2 images
  without the glTF extension that marks them (the IO writes only extensions registered with it), and every texture
  loaded white; caught in the pictures, fixed in the importer and the packs.
- **Checked:** pictures on High from the spots of Milestone 287; the texture memory and downloads per preset;
  `citykit.ts`'s new rule, proven by taking a placed piece out of the baked list; verify and rules.

## Milestone 291 — The bought arms move with the body: the pack's walk, sprint and jump

The first gap after Milestone 289: moving, the USSO and BOOG still took our procedural sprint pose, which shoved the
gun low and right, half off the screen at the owner's view.

- **KINEMATION's moving clips** move no arm bone the FBX files keep: its controller plays idle, walk, sprint, jump and
  equip on an Additive layer masked to a bone its player adds (`ik_hand_gun_additive`), whose motion its script adds
  to the gun (`FPSProceduralJob` ProcessAdditives). Those curves exist only in the pack's Unity `.anim` files, so the
  import reads them (`tools/import-fparms.ts`, `arms/additive.json`, baked at 30 keys a second; Unity's axes to
  glTF's).
- **The rig adds them to the gun** (`fprig.ts` locomotion): idle, walk and sprint blended by our speed against
  SpeedKills' run (8.8 m/s) and sprint (14 m/s), one stride through all three as a blend tree keeps them in step; the
  jump's loop in the air; a third of it in the sights, as the pack does. Our own sprint pose, bob and idle drift stand
  down for these two guns. Sprinting, the gun now swings across the body and stays in view with both hands on it.
- **Checked:** the soldier e2e section; verify; rules; pictures of standing, walking, sprinting and aiming.

## Milestone 292 — Aim and fire on the move fixed; the red smear round enemies was their trails

The owner, 2026-09-27, on the live server: "we fucked up ads and shooting ... the gun is tilted before shooting and then
the bullets don't go where the crosshair is aiming"; and "we still have that red circle/bubble glitch".

- **Aim and fire** (`fprig.ts`, `fparms.json` sprint): Milestone 291's sprint motion was driven by speed alone, and
  SpeedKills sprints whenever you move forward, firing included, so the gun stayed swung up to 51 degrees across the
  body while firing, and a third of it stayed in the sights (about 15 degrees of tilt, the red dot off the crosshair
  that the shots follow). Now the pack's sprint comes in only while sprinting and not firing, aiming or reloading (out
  in 0.06 s, back 0.5 s after the last shot); none of the pack's walk or sprint is kept in the sights; and aimed, 85%
  of a reload's turn is taken off, as the view already did for its own reload. The shots themselves were never off:
  they go down the eye's ray.
- **The red circle round enemies was their trails** (`trails.ts`, `hud.json` trails): a bot dodging side to side in a
  fight laid its red trail back and forth under its feet, a bright zigzag smeared round the figure (a picture of one 8
  m off). The edge's laser was not it: it strikes only a player past the edge. Now a trail is laid only while running
  (6 m/s or more), a turn back on itself starts it afresh, it is thinner and dimmer, and it fades out within 12 to 25 m,
  where the eye is on the figure.
- **Checked:** `tools/checks/trails.ts` (a dodge lays at most one leg of it, 17 points with the fix taken out; a walk
  lays none, 6 without it; near you none is drawn); pictures of sprinting and firing, running aimed and firing aimed
  while reloading; the soldier e2e section; verify; rules.

## Milestone 293 — Rooms behind the windows: the packs' window walls at their real depth

Phase 23's item 23.2. Kyber's and Cyber City's window walls, the centre's most placed modules, are each a wall with a
furnished room behind the glass, 3 to 4.7 m deep, and the city had pressed every one to half a metre, so each window
showed a slab.

- **Which modules are rooms is measured** (`citykit.json` front, by the importer): the share of a module's
  front-facing area within 0.3 m of its front. The window walls have 0.57 to 0.68 of it there; High City's and Glass's
  relief modules, frames and cornices before a wall, 0.12 to 0.39.
- **A room module's front goes on the tower's face and its room inside the tower** (`dress rooms`), as deep as the room
  goes, where the tower's solid box stands. Collision is unchanged, and the front stands 0.03 m out, flat enough for a
  canyon's wall runs. It stops 0.3 m short of a stair core; a west or east room stops short of the north and south
  rooms' footprints at its storey (recorded as they are set), so no two rooms cross at a corner. 610 of the 1,395
  window walls placed are now whole rooms; the rest stand in front of a stair core's end or at a corner, and are
  pressed as before.
- **The towers' own faces step aside** (`city.ts` skins). Each centre tower's box is drawn as two meshes of one
  material each, its outward faces in a clone of the tower's material, the rest (its top, a stair shaft's walls, a
  room's ceiling) in its own, so the static merge still folds them away. Once every facade piece loaded, the kit sets
  the skins to draw no colour and no depth: the rooms show through the windows, and the towers still cast their
  shadows. Ambient occlusion leaves them out (`render.ts`, `userData.noAo`).
- **A new rule in `citykit.ts`:** every storey of every face of the centre's towers covered end to end by the kit
  (1,340 face storeys), since the towers' faces no longer draw; proven by leaving out one bay. `city-budget.ts`'s
  before-merge limit goes to 23,000 (22,226 with the skins, 418 once merged), to be set again after the outer
  districts' cut.
- **Checked:** pictures into the Kyber and Cyber City windows by day and night on High and Competitive; `citykit.ts`,
  `sk-lobbies.ts`, `sk-stairs.ts`; verify and rules.

## Milestone 294 — SpeedKills always sprints

The owner, 2026-09-27: "we should only have sprinting on and not ever walking / non sprinting. fast paced is the goal
and thats how we do it. i don't think i ever walked/run and not sprinted in hyperscape."

- **Always** (`player.ts` sprintMode "always", `main.ts`): any way you move is a sprint at the sprint's 14 m/s,
  strafing and backing too, and firing no longer drops it. It was Hyper Scape's Auto-Sprint (Phase 20 A15): forward
  only, and a shot, an aim, a heal or a strafe fell to the run's 8.8 m/s. Aiming still takes its own share off the
  speed (the gun's ADS move scale), crouching is the crouch's speed and a slide is a slide. The Settings row for sprint
  is hidden in SpeedKills; the legacy game keeps its toggle, hold and auto.
- **The first-person gun** keeps its sprint pose off while firing too (the view's own and the bought arms'), since
  firing is now done at a sprint.
- **Checked:** `tools/checks/sk-sprint.ts` (in verify): forward, right, back and left all at the sprint's speed,
  firing too, crouched not (with the old auto mode, strafing, backing and firing fell to 8.8 m/s, four failures);
  the SpeedKills e2e section (its sky check brought up to Milestone 288's third sky); verify; rules.

## Milestone 295 — The gun held ready at a run; the swap's field of view eased; a quieter recharge ring

The owner, 2026-09-27: "the guns are fucked up right now, when we are holding them they are all crossed and inverted";
and of BOOG's scope, "make the recharging like 50% transparent and then don't have the green ready state".

- **Crossed and inverted was the sprint pose**, seen all the time since SpeedKills always sprints (Milestone 294): the
  bought arms' sprint swung the gun across the chest and onto its side (KINEMATION's tactical carry, 51 degrees), and
  the view's own sprint pose lowered, rolled and swung every other gun. Now the USSO and BOOG keep their ready hold at
  a run with the walk's bob (`fparms.json` sprint swing 0), and the other guns take 0.3 of their sprint pose
  (`speedkills.json` viewmodel sprintPose).
- **The swap's field of view** (`viewmodel.ts` packFov, `main.ts`): the gun camera eases between the bought arms' 80
  degrees and the other guns' 92 over 0.2 s; it had jumped 12 degrees in one frame (measured: now 0.5 at most).
- **BOOG's recharge ring** (`hud.json` hsCharge): half see-through, and nothing drawn once it has closed.
- **Checked:** pictures at the owner's view running and strafing with the USSO, BOOG and STRYDER; the swap's field of
  view frame by frame; the soldier e2e section (the ring's check now wants no READY); verify; rules.

## Milestone 296 — The city drawn in to the middle: the outer districts cut by three quarters

Phase 23's item 23.3. The owner: "CUT DOWN ON THE OTSIDE DISTRICTS TOO BY LIKE 75% BC WE WANT IT TO BE FOCUSED IN THE
MIDDLE NOW."

- **The map is 304 m across** (`city.json` cut; `br.ts` BR_HALF from it), where it was 500. The eight districts round
  the centre keep their names, colours and landmarks on one ring of blocks, its outer side cut to 38 m: 52,400 m² of
  districts where there were 210,000, 75% less. The centre is untouched.
- **How the centre stayed the same.** The city is built block by block from one seeded stream, the outer ring first,
  and a block's draws depend on its size; dropping blocks or shrinking them would have reshuffled every draw after them,
  the centre's too, whose chimneys and routes are tuned to this layout. So every block is still built in the old order
  from the old stream, the districts' ring and the ring past it are taken away again at once (`city.ts` sandbox: what
  a block adds to the scene and the city's lists), and the districts' ring is then built again on its cut blocks from a
  stream of its own. Proven by a fingerprint of the centre before and after: the same 28 towers, 53 pads, 4 chimneys and
  24 stair cores, every solid the same but for the parked cars, which the street's own stream places.
- **Fitted to the cut:** five landmarks laid out for 57 m blocks (the holo tower's screens, the silos, the bowl, the
  terraces, the gantry, the station) take the block's share across; no car parks past the edge, none on a metro
  stairwell's way in (sk-metro found one); zebras and the crossings' pads only inside, the pads on the crossings they
  had; the jump towers and beacons only on the districts' plazas, as before; the skyline drawn in to 205 to 360 m; the
  ring's square and its pulls toward the districts (`ring.json` speedkills) to the new size.
- **What it costs now:** 15,053 solids where there were 20,216; the city 16,092 meshes (22,226), 296 once merged (418),
  242k triangles (319k).
- **Checked:** verify and rules (`ring-place.ts` now checks the city's cut, the ring's square and the sectors' edge are
  one size; `sk-roofrun.ts` holds the fewer roof crossings, 108, a tenth under, the chain from the best roof still 10);
  the e2e sections that play the map; pictures.

## Milestone 297 — Point at the magazine, then work the gun: the USSO's and BOOG's reloads; the arms leave on a swap

The owner, 2026-09-27: "the mag doesn't phase in any more and phase out ... point a finger at it while it phases out
and in for a reload and then smack the charging handle or whatever you know? same w the sniper ... a nice combo of the
two"; and "the guns fly in and out but the arms stay in a weird position".

- **The reload** (`fparms.json` reload, `fprig.ts` update): the pack's whole reload carried the magazine out of the gun
  to the belt and back, so our phase happened out of sight. Now the magazine stays in the gun and phases out over
  `phaseOut` and in over `phaseIn` while the gun turns its underside toward you (`twist`, a pack gun's own replacing
  it) and the left hand points at it: the index finger straight, its tip `gap` off the face the gun's `point` names.
  The USSO's is the magazine's left face low down (its magazine runs up the pistol grip and the hand hides its middle);
  BOOG's, a thin plate low on the gun's left, is its lower left edge, the finger coming up from below (pointed at from
  the left, the hand sat between the eye and it; from ahead, the arm reached straight across the view). Then over
  `rack` each pack gun's `rack` clip plays its moment: the MPS5's empty reload slapping the handle home, the L96X's
  fire clip throwing the bolt.
- **The pointing arm**: placed once toward the fingertip from its shoulder, then the hand aimed from where its elbow
  fell (wrist 30 degrees on the USSO, 42 on BOOG; along `aim` alone it bent 107 to 126). The elbow hangs down
  (`elbow`): bent the way the hold had it, the USSO's point, 22 cm from the shoulder, folded the arm so tight that on
  the way in the elbow passed 9 cm in front of the eye and the sleeve filled the view for a tenth of the reload
  (measured bone by bone). The first placement is undone before the real one, which bends toward it by the share
  pointed.
- **The swap** (`fparms.json` swap): as the gun phases out the whole rig drops `drop` m, comes back `back` m and
  pitches `pitch` down about the eye, and comes back up as the next one phases in; the hands go with it.
- **BOOG's right arm fixed**: the pack's clips turn the clavicles but never place them, so the L96X's shoulder offset
  (21 cm back) was added again every frame and within seconds of drawing BOOG its right arm was 100 m and more behind
  the eye, the gun held by the left hand alone. It was live. The clavicles now go back to where the body was made
  before the clips run.
- **Checked:** four new soldier e2e checks (the finger within 6 cm of its point with the gun not turned by the pack's
  reload, the rack clips playing after it, both hands out of the picture at the bottom of a swap and one in it held,
  and neither arm 1 cm short of the gun a second after drawing it, at the hip and aimed), each seen to fail with its
  bug put back (the point late, no drop, the clavicles not reset: BOOG's right arm 4.8 m short at the hip). The long
  soldier call was split in two, having run past a page call's 120 s on a busy machine. Pictures of every stage of
  both reloads and swaps; verify; rules.

## Milestone 298 — The packs' own streets on the centre's towers: facade strips from the demo scenes, and the haze

Phase 24's items 24.1 to 24.3 (`docs/PHASE_24_PLAN_THE_CENTRE_FROM_THE_PACKS_OWN_BUILDINGS.md`, results beside it),
and 23.4b's haze. The owner, after the side by sides: "the one we bought has grey buildings with balconies and shapes in
and out, why couldn't we just stack those on top of each other".

- **The textures whole (24.1).** The importer placed a prefab's material overrides only where it could match a mesh by
  name or by its number of slots, and High City's brick came out grey; material names are now matched loosely, and the
  Unity specular workflow (a spec map and gloss, where the others use metal) is read. Kit v4, then v5 (below).
- **The demo streets cut into facade strips (24.2).** The packs have no whole buildings: every one exists only as its
  artist assembled it in the pack's demo street, and those streets are film sets, faced only where the camera looks.
  Cutting them into buildings (a 2 m ground grid of their walls) gave High City one blob. Their faces lift cleanly:
  `cutFacades` (tools/import-city.ts) finds the wall modules, takes each one's facing from its triangles and the side
  with less wall behind it (the street's), runs along each wall plane, cuts runs into strips of about 14 m at module
  edges, and hangs on each everything standing up to 4 m in front of it: balconies, fire escapes, pipes, AC units, signs,
  as the artists placed them. 46 strips are used (High City 23, Kyber 12, Cyber City 11: mostly wall, 6 to 22 m wide,
  12 m tall and more).
- **Stacked up the towers (24.3).** A street face is split into columns as wide as its family's strips, each column a
  stack of strips from its foot, each near its own proportions and a whole number of storeys, so neighbouring columns
  end at different heights as a street's buildings do. The open storeys keep their walls; a fire escape, a chimney
  within a strip's depth and a pad's lane keep the modules across their width; a strip beside a pad further out is
  pressed to stand clear of the pad's column. 232 strips placed, 44% of the centre's street faces; the canyons keep their pressed modules, and Competitive its modules.
- **Found on the way:** the size helper took a strip's measured side for its facing, and three of Kyber's strips face
  sideways by area (their balconies outweigh their wall): their width and depth swapped, scaled wrong and holes left.
- **What it costs.** Kyber's strips were modelled heavy (up to 157 triangles a square metre, in their cables and pipes), so the importer now simplifies a strip to 15 mm of error with every part's edges and every UV seam held (`citykit.json` simplify, meshoptimizer): Kyber's placed strips from 1,417k triangles to 898k, kit v5. Balanced draws 2,786k and High 2,889k (limits 3,000k and 3,100k); in the street of a match on the owner's RX 9070 XT, three rounds interleaved against a copy from before, Balanced 137 fps (182 before) and High 67 (89). The download grew with the strips' own materials: 354, 133 and 91 MB for High, Balanced and Competitive (119, 40 and 26 at v4); Competitive's file carries strips it never places, which the next import leaves out. One billboard (High City's archetype plane) had no material and showed a blank grey panel: dropped.
- **The haze (23.4b).** From Balanced up the fog takes the colour of the block you are in (Cyber City green, Kyber
  warm, High City pale, Glass blue), blended between blocks, starts 4 m off and thins as you climb; the sky's horizon
  takes the same colour; the streets are wet, reflecting the lit city (one cube map, taken once the kit has dressed
  it). Competitive keeps its clear air.
- **Checked:** verify and rules; `citykit.ts` counts strips as facade and holds every storey covered, nothing in a
  chimney or a pad's column; `sk-atmosphere.ts` now checks the haze (its colour in a block, reach up a tower, the hour's
  fog back when you leave, and off on Competitive), proven by breaking the restore; pictures.

## Milestone 299 — Halls inside the podiums to fight in; the packs' materials placed by name; the flying cars' engines

Phase 24's items 24.4 (its first part) and 24.1b. The owner: "i want an inside area as well to fight in on the bottom
floor, likke the metro area".

- **The halls (24.4).** Each of the centre's eight podiums but the Spire's is now a hall at street level, 7.4 m tall
  under a roof that is walked on as before (`city.json` halls, `city.ts` podiumBody): 85 doors off the streets in all,
  3.2 by 3.4 m, under the shop canopies, kept off the corners, the pads, the public stairs, and anything more than a
  step within 4 m in front (a bridge's kerb pillar, a metro stairwell's rail: the halls are built last of the street's
  things for that). Inside, square columns on a 10 m grid and five waist-high counters as cover, the walls lined with a
  line of the block's colour, strips of light in the ceiling; the floor, columns and walls give off a little light of
  their own, since the roof shadows the sky's and a light per hall would cost every surface in the city. From Balanced
  up the walls are an arcade of the packs' shop fronts facing in, a sign over every other one.
- **For the game.** The bots' graph covers every hall (218 nodes, a way through every door to its street), and a bot
  coming down from the sky never takes a hall's node for its nearest (`brmatch.ts` nearestNode, `br.ts` GraphNode
  hall). The field's loot keeps off the halls' floors, so it lands exactly where it did, and each hall has six spots
  of its own, drawn last on a stream of their own (`loot.json` halls, `floors.ts` HALL_FLOORS).
- **The packs' materials (24.1b, kit v6 and v7).** Where a model's meshes do not tell apart by their number of slots,
  a prefab's material overrides now go by the materials' names against the model's own names for its slots, then by
  elimination: 1,645 left unplaced to 1,020. The flying cars' engines, 83k triangles of grey, wear the material named
  for their model. Competitive's files leave out the facade strips it never places: 91 MB to 44.
- **What it costs.** Competitive 620k triangles, as before (a bay with a door on Competitive keeps the very shop it
  wore, narrowed, and its halls keep their lined walls); Balanced 2,910k and High 3,013k, inside their limits.
- **Checked:** verify and rules; `sk-halls.ts`, new (every hall open floor to ceiling but for its cover under a roof
  at the podium's top, all 85 doors walked in and out with the real movement, every podium's roof walked over its
  hall, the graph, the loot), proven by leaving the doors uncut; `citykit.ts` holds nothing of the kit across a hall's
  door; `sk-escapes.ts` tests doors between an escape's foot and roof; the e2e sections speedkills, sktour and skship.

## Milestone 300 — The pads as vents in the floor: the pack's grate, a slim beam, one ring

Phase 24's item 24.5, its pads. The owner: "the jump pads are still the old texture ones we had before assets ... those
are obviously bad". In the pictures of Milestone 299 the pads' gold was the first thing the eye found in every view.

- **Before:** a solid gold disc 3 m across, a beam 0.9 m across at half opacity up to where it throws you and 4 m
  past, and two gold rings, one 3 m up and one at the roof; a road's pad a flat cyan square.
- **Now** (`city.json` padLook): a vent in the floor that throws you up. A dark grate ringed in the pad's colour (gold,
  a window pad's blue, a road's cyan); over the grate in the centre, from Balanced up, High City's round wall vent
  turned to face up and flattened (`citykit.json` dress padVent, 8k triangles); a beam 0.56 m across at 0.3; one ring,
  at the roof it lands you on. From a roof across a street the pads still read, which is what they are for.
- **Checked:** verify and rules (the kit's budgets: Balanced 2,917k, High 3,020k, Competitive 620k unchanged; the
  city's own 240k triangles); the e2e section speedkills; pictures from a roof and beside a plaza pad.

## Milestone 301 — The halls, part two: a gallery round the walls, flights up to it, kiosks in the packs' food stands

Phase 24's item 24.4b. The halls of Milestone 299 were one open floor between columns; the pictures showed a room with
nothing to climb and little in its middle.

- **The gallery** (`city.json` halls gallery): a walk 2.6 m deep round every hall's walls, 4 m over its floor, over the
  doors and the shop fronts and 3.4 m under the ceiling, railed on its inner edge in the block's colour. High ground
  inside, and a way round the hall above a fight on its floor.
- **Two flights up to it** in each hall, from the long walls into the hall, 0.5 m a step (under the 0.56 m a body
  steps), between the columns and clear of the doors' lanes, their top edges lit.
- **Three kiosks** in each hall's open floor, solid, wearing Cyber City's two food stands from Balanced up (the lightest of the
  alley's four: with all four the kiosks took Balanced to 3,007k, over its limit; now 2,982k), their boxes hidden once
  dressed, as Neon Alley's stalls are; counters and kiosks kept clear of each other, the flights and the
  lanes.
- **For the bots:** the gallery's runs and its flights on the graph; 398 nodes inside the halls, every one reached
  from the streets.
- **Found on the way:** the north and south runs were railed their full length, across the corners where the west and
  east runs join them, so every run was shut off from the next; the bots' graph lost 79 nodes. Now open.
- **Checked:** verify and rules; `sk-halls.ts` walks every flight (16) up onto its gallery, every run (32) and, new,
  every corner (32) with the real movement, proven by railing the corners again (it fails, and the graph loses its 79
  nodes); `citykit.ts` counts Neon Alley's stands apart from the kiosks'; the e2e sections speedkills, sktour and
  skship (one speedkills check, a bot's route to the capture zone read after 3 s, failed while the halls check ran
  beside it and passed alone); pictures from the floor and the gallery.

## Milestone 302 — The USSO and BOOG checked frame by frame: the magazine slides, the finger lands, the rack grabbed, no hand through a gun; the pack's swap, jump and pickup

The owner, 2026-09-28: the finger "down and left more on both, not by too much"; the magazine to "drop out and pixelate,
and then pixelate and slide in with a distance from start to end"; "check all frames of the reload for pinpoint
accuracy, and ensure the hands are the correct size and on the correct area at all times, not glitching through the gun
at any point"; "look for more things we can do with it, especially when we swap guns"; and "we for sure want to use all
the pack parts we can on those two guns and if we don't like any we remove it".

- **Every frame, measured** (`tools/pack-frames.ts`, `tools/pack-audit.js`): each sequence (the reload, the swap, the way
  into the sights, the pickup) stepped 4% at a time at the owner's view, as contact sheets with each frame's faults written
  on it: where the finger points and how far off, each wrist's bend, an arm short of the gun, and how much of the hands'
  skin is inside the gun where the eye sees it go in (each hand vertex against its nearest point of each gun part's
  surface; a point behind every face it is nearest is inside; the entry point in the picture and not hidden by the gun
  itself). The test proves itself on each frame: under the biggest part's top face is inside, over it is not. `XRAY=1`
  draws the gun as wire and each point inside red (seen) or yellow (hidden). Two faults in the first test, both caught by
  its own proof: rays counting crossings were fooled by the models' inner shells, and a part mirrored in the scene winds
  its faces the other way.
- **The magazine slides** (`fparms.json` reload slide): the old one drops `slide` down its own length as it phases out,
  the new one rises from there into the gun as it phases in; the phase's sweep follows it, and the finger follows it.
- **The finger** lands on its spot (0.0 cm, pointing 0 degrees off it, where it had been 4 cm off and 70 degrees off: the
  hand was aimed by its middle knuckle and placed by the finger's last joint, which is short of the tip), `shift` left and
  down of the magazine.
- **The USSO's rack is a grab** (`packGuns` MPS5 rack grab): the MPS5's empty reload is made for a handle at the front of
  its gun; the USSO's is at the back, and carried over the left hand came to 27 cm from the eye and filled a third of the
  view for a fifth of the reload. Now the left hand takes the pack's own grip on its handle (the moment of its clip when
  the hand is nearest the handle, measured once a gun), onto ours, turned round the gun's length to the straightest wrist,
  out round the gun's side on the way, pulls it back and lets it slam home. The gun goes straight from the point's turn to
  the rack's (`rackBlend`): back to the hold between them it had jumped in 40 ms.
- **The holds fitted to our guns** (`tools/pack-fit.ts`, `packGuns` hold): the pack's hands are made for its guns' grips
  and ours are thicker. At the hip, turned for the reload and aimed: each palm moved out of the gun, each finger tried
  from curled tighter to opened and turned at its base (judged by the whole hand: a finger shares skin with the next at
  the knuckle), and last each hand moved along the gun's axes to where the least of it is through the gun where it is
  seen (a finger pressed into a grip's far side is hidden behind the gun). The USSO's left hand is clear of its gun;
  BOOG's right hand, throwing the bolt, 12 mm out (its rack `shift`) where the glove had been 15 mm into the body. What
  is left: the right thumb presses 9 mm into the side of either grip as the gun turns over for the reload, which no
  curl, turn or move of the hand takes out without the far side's fingers coming through.
- **The gun fitted the same on every draw** (`fprig.ts` underside): the fit tilts our gun about the trigger until its
  underside meets the pack's left palm (10 degrees on the USSO, 12 on BOOG), measured by a ray up at the gun. The view
  draws its gun on a layer of its own, and the ray on the default layer found the gun only on its first draw, before it
  was moved there: from the second draw of either gun on, the tilt was none and the left palm off the gun. It was live
  since the bought arms shipped, and it is why two measurements of the same hold had disagreed.
- **The pack's clips put on the bones every frame** (`fprig.ts` update): three.js's mixer writes a bone only when its
  value has changed since the frame before, and a hold is a still, so from its second frame on nothing put the bones
  back and all the rig does to them after the clips stacked up: a finger curled a tenth a frame wandered, the arm's
  reach bent its elbow the way the last frame had left it, and a hold depended on the guns drawn before it (the right
  thumb 6 mm into the USSO's grip after one order, 16 after another). BOOG's drifting right arm yesterday was the same,
  fixed then for the shoulders alone. Now every bone goes back where the body was made each frame and the mixer is
  made to write them all.
- **The pack's swap** (`swap clips`): its Rifle_Unequip as the gun phases out, the gun swung down and in to the chest in
  both hands (29 cm across, 34 cm in, turned 58 degrees, measured off its curves), and its Rifle_Equip bringing the next
  up out of there as it phases in, the one into the other over `cross` of the swap either side of its middle. The arms
  drop out of the picture only once the gun has all but gone (`dropFrom`): dropped from the start, they left the gun
  flying on its own. The view's own spin is off under it: it turned the gun inside the hands, a hand 19 mm through it.
- **The pack's jump**: its start as you leave the ground and its end as you land, around the loop in the air.
- **The pack's pickup** (`pickup`): taking anything off the ground but a gun (`main.ts` applyLoot), the left hand goes
  down for it and back, with half the clip's own move of the gun (all of it tipped the gun onto its side and bent the
  right wrist to 88 degrees).
- **Checked:** the e2e's pack frames (`E2E_ONLY=soldier`): the fit and the grip the same on a second draw, the magazine slid, the
  finger on its spot, no skin through the gun deeper than 6 mm where it is seen in eight states on each gun, the pack's
  swap, pickup and jump played; contact sheets of every 4% of the reload, the swap, the way into the sights and the
  pickup on both guns; verify; rules.

## Milestone 303 — A district made of High City's own demo scene, playable; the Gulag's bot comes for you

Phase 25 (`docs/PHASE_25_A_DISTRICT_FROM_A_PACKS_DEMO_SCENE.md`). The owner, after 298 to 301: the city still did not
look like the store's pictures; "redo one of the corner, smaller districts with the exact assets from the bought packs"
to learn whether taking the assets out or placing them was failing, then "continue with the one district ... til it's
playable so I can test it".

- **The corner from High City's demo scene, whole** (`citydistricts.json`, `import-city.ts CITY_DISTRICTS`,
  `citydistricts.ts`): 2,640 parts and 601,571 triangles, turned a quarter and set on the map's south-east corner in
  place of three blocks, which are built and taken away again so the city's stream is as it was. It draws what the
  pack's own scene draws from the same camera, so taking the assets out works; laying them over a map drawn before
  them was the fault.
- **Its own look where you stand in it** (`look`): its haze's colour and depth, the sun and the sky's fill turned
  down, a colour grade (split tone, contrast, saturation, vignette; `render.ts setLook`), its windows dim by day, and
  shadows from its buildings. The haze now runs every frame, not only in play (`frame()`), so it shows in pictures.
- **Its collision off its own triangles** (`districtSolids`, `districts/high-corner.solids.json`, 6,312 boxes): the
  film set has no backs, so a flood from the canyons' floor marks the street and the rest of its plan is its
  buildings, solid; kept to the canyons (`fill streets`), where the first bake's flood got out at an arm's end and left
  10,316 half-metre cells open behind the faces.
- **Playable:** the canyons at the city's street level, joined to its streets at the ends of the arms; walkways 7.75 m
  up either side; five pads up to them, found off the collision and landing short of the walkways' posts
  (`padLand`); the city's parked cars, sectors' edge lines (the orange line across the canyon), bots' street links
  and drop points kept off it; loot of its own, 12 spots a match on its floor and walkways on a stream of their own
  (`loot.json districts`); `?dropat=high-corner` drops a solo battle royale onto its crossroads.
- **The Gulag's bot** (`brmatch.ts gulagFrame`, `bots.ts`): it had no goal in the fight and stood on its spawn. Now,
  after the 3 s countdown, it heads for you, by the room's middle when that is on its way, and its slide along a wall
  holds to the wall's line (`bots.json` slideProbe, slideHold, slideShare) instead of turning back and forth at a
  container's middle.
- **Checked:** verify and rules; `sk-district.ts`, new: with the real movement, into both arms from the city's streets
  and along all four, every pad onto its walkway and off it into the building (stopped by its face), and every
  half-metre of the plan off the canyons solid or a walkway, proven by the first bake (10,316 cells open) and by the
  city's 3 m landing (three pads land on a post), and its loot, proven by leaving its floors out (none);
  `sk-roofs.ts` walks every street link, the district's edge included;
  the e2e gulag check, new, proven without the fix (the bot moved 0 m; with it 12.9 m); the e2e sections
  gulag, speedkills, bots, botsquads and loot pass (botsquads failed on two runs, on different checks each time, the
  finishers and a squad keeping together at 17 of 40, and passed alone again at 40 of 40); a real match opened with
  `?dropat=high-corner` lands on its crossroads with loot round it; pictures from its floor, walkways and crossroads.

## Milestone 304 — The guns level at rest, the USSO's hand on it and its handle pinched; the bought arms' fists; an inspect's hack in the open palm; the edge laser gone

The owner, 2026-09-28: the USSO's left hand "slightly off the gun"; on the rack "our fingers don't grip it, it's like 80%
of the way there"; "both guns when we are standing still have the gun aimed up and to the left ... in the chilling /
standing position, the gun is never like that"; on an inspect, "a palm open hand and the hack glowing/levitating off of
the palm"; "taking out melee / fists, are those the old fists and not our new bought arms?"; and of the red circle round
enemies, "you said you fixed it like 3 times".

- **Level at rest** (`fparms.json` hipPitch): the fit tilts our gun up about its trigger to meet the pack's left palm, 10
  degrees on the USSO and 12 on BOOG (measured), and held so the muzzle pointed up at rest. The view takes it back down to
  2 degrees, the hands going with the gun; every gun keeps its 3 degrees in toward the crosshair.
- **The USSO's left hand on the gun**: the hold's fit (`tools/pack-fit.ts`) had moved it off the gun for the fingers' sake
  alone, 6 mm of air beside it. The fit now wants the held palm within 1 mm of the gun as well as nothing through it
  where it is seen: 0.9 mm, touching.
- **The rack pinched** (`packGuns` MPS5 rack grab pinch): the USSO's handle is a knob a centimetre off the gun's side,
  and no closed hand holds it without going into the gun (10 mm and more, every roll of the pack's grip and every turn of
  a hand round it, searched). So the thumb and forefinger's tips close on it and the other three fingers curl into the
  palm, the hand turned as the grab says in the gun's frame: on the knob to 0.0 cm, none of the hand through the gun
  where it is seen, the wrist 22 degrees. The fingertips (past the last joint) are what hook it; hooked by the middle
  joints, the palm went into the gun's body.
- **The bought arms' fists** (`fprig.ts` free, `fparms.json` free): holstered, meleeing and crawling, the bought arms and
  gloves where the view's own drawn fists were. Each finger joint bends into a fist along the axis the pack's own grip
  bends it, the hands turned by their knuckles and palms, the arms' reach to them (pulled in by `pull`: at the old fists'
  place they were straight out, 97% of their reach).
- **An inspect's hack in the palm** (`inspectPalm`): while the right hand shows the gun, the left comes off it, open and
  palm up, with the hack you carry (your mobility hack, else your utility) floating over it, bobbing and turning.
- **The edge laser gone** (`edge.ts`, `city.json` edge): the red column down on whoever stayed past the city's edge, and the
  red ring on the ground round them, drawn on every screen, was the one thing in the game that drew a red ring on a
  figure; the owner asked for it out if the circle was still seen. Past the edge the countdown runs and at its end it is
  OUT OF BOUNDS, no laser, no red flood. A photographed fight against three bots at 8 to 25 m showed no ring round them
  in this build; if one is seen again, a screenshot of it is the next thing to have.
- **A 404 the live check caught**: with the arms loading at the start for the fists, every page asked for the MPS5's and
  L96X's gun pose clips, stills the import writes no file for. They are off the config, and verify's clip check no
  longer excuses a missing pose (`tools/checks/fparms-pack.ts`: seen failing with one put back).
- **Checked:** new soldier e2e checks (level at rest, the handle pinched, the fists the bought arms', the palm and its
  hack on an inspect), the speedkills section's edge check (the death with no laser); verify; rules.

## Milestone 305 — The bots come into High City's corner; what stands on its walkways solid, and no pillar over it

Phase 25, after 303's limits: the bots' graph kept out of the district, and walking its walkways met things that were
not there.

- **On the bots' graph** (`citydistricts.json bots`, `city.ts`): a node every 6 m down each canyon's middle, from the
  city's street past an arm's end (joined to that street's crossings either side) through the crossroads to the map's
  edge; its five pads on the graph, one way up, as the centre's are; and its walkways as a grid of nodes every 3 m where
  the collision's top is a walkway's, linked where a bot walks both ways, kept where the walk reaches from a pad's
  landing. 34 nodes in its canyons, 48 on its walkways. A line of nodes laid along each walkway from its landing stopped
  within a step or two: High City's walkways are cluttered in front of their posts, with bollards, bins, hydrants and
  parked cars. In a real match 5 bots walked into its canyons in the first 2 minutes. The city's build takes about 40 ms
  more (1,003 to 1,040 ms, the median of two).
- **What stands on a walkway, solid down to it** (`fill body`): a crate's or a car's top alone in a cell, its sides
  falling in the cells round it, hovered a hand over the deck, a ledge a bot walked into and a player's feet caught on;
  anything whose foot is less than 1.9 m over the street or a walkway now reaches down to it.
- **No 40 m pillars:** a cell on a walkway with no walkway top of its own (a lamp post's foot, a gap in the deck) was
  filled as the building behind, to 40 m, invisible over the lamp and in the way of shots; with walkway on two sides and
  more it now takes its own height or the walkway's. 6,312 boxes to 5,406.
- **Checked:** verify and rules; `sk-district.ts`, new: the district on the bots' graph, its canyons reached from the
  city's streets and its walkways by its pads, every node reached, proven by cutting the canyons off the city's
  streets (82 nodes not reached); `sk-roofs.ts` throws a bot off each of its
  pads onto its walkway (29 pads) and walks every street link (847); the e2e sections bots, botsquads and
  gulag (two of the bots' tier checks in the warehouse arena failed beside them and passed alone); a real match.

## Milestone 306 — The loadout you play with, on the battle royale's panel

The owner, 2026-09-27: "my chosen loadout should be on the battle royale screen below the "play / play with friends"
button for easy reference".

- **Under Start and With friends** (`index.html` setupLoadout, `src/ui/menu.ts`): a card with the loadout's name, its two
  guns and their kinds, the operator and the heirloom, and a Change button that opens the Loadouts tab. It shows on the
  modes you play with your loadout (the battle royale, the arena, the team modes) and not on the range and the courses;
  it follows the loadout picked and every edit to it.
- **Checked:** a panel e2e check (shown under the buttons with both guns named, not on the range, Change opens
  Loadouts), seen failing with the card kept hidden; verify; rules.

## Milestone 307 — The white slabs in High City's corner were its backdrop building: materials named by their texture, as Unity does

Phase 25. Plain grey slabs stood in the gaps between the district's faces (a wall of it behind a walkway's door) and
over its skyline from the city's streets: the see-through look the owner named. They were High City's backdrop
buildings "fill build 08" and "09", drawn in the importer's grey stand-in (680 triangles of the district's 601,571).

- **Unity's "By Base Texture Name"** (`import-city.ts Pack.matByTexture`): the model's FBX asks for "Material #3020",
  and its import settings (`materialName: 0`) have Unity name its material after the texture that material uses, "fill
  build 1.psd", so it wears "fill build 1.mat". The importer now does the same where the prefab, the FBX's own name and
  the model's name found nothing: the textures' names read out of the FBX, the first that names a material of the pack.
- **A material from inside the model:** the rest (560 triangles, "fill build 09" and part of "08") were placed with the
  material inside the FBX itself, which the importer found and could not read as a material. Unity makes that one from
  the same texture, and the importer now takes the same one; its report now lists a material found but not read, as it
  did one not found.
- None of the district's parts is in the stand-in now; its file goes to v2 (`high-corner-v2.glb`) so the server hands
  it out at once.
- **Checked:** verify and rules; `sk-district.ts`; the importer's reports of materials not found and not read are both
  empty, and the file has no stand-in material; pictures of the walkway's door and the street's views that showed the
  slabs.

## Milestone 308 — High City's corner solid from the city's streets: its faces drawn from behind

Phase 25. From the city's streets round the district, bare frames stood against the sky over its edge: its facades
from behind. The demo scene is a film set faced only toward its canyons, and a single-sided face is not drawn from its
back, so from outside only the thicker framing showed, a building you saw through (picked in the page: the frames were
High City's "wall 5", facing away).

- **Its opaque faces from both sides** (`citydistricts.json look backs`, `citydistricts.ts`): from outside the district
  now reads as solid brick buildings, and the views inside it are unchanged. It costs nothing measurable: 3.09 and
  3.08 ms outside, 4.49 and 4.34 at the crossroads, 2.94 and 3.00 in a canyon, 3.82 and 3.80 from above (one side and
  both, the median of three interleaved rounds, Balanced).
- **Checked:** verify and rules; the e2e speedkills section, a new check that the district is drawn from its own file
  with all its opaque faces from both sides (64 of 64), proven with `backs` off (0 of 64); pictures from four streets
  round it and inside it.

## Milestone 309 — High City's corner in 31 MB, 24 on Competitive: its geometry meshopt-compressed

Phase 25. The district was one 51 MB file for every preset, Competitive included: 19.7 MB of KTX2 textures and 31.3 MB
of geometry (601,571 triangles). The game server sends it as it is.

- **Its geometry meshopt-compressed** (`import-city.ts writePack`, EXT_meshopt_compression, the filter method: positions
  and texture coordinates as they are, normals to 8 bits; `citydistricts.ts` loads it with three's meshopt decoder): the
  geometry to 11.6 MB, the file to 31.3 MB. No position moves, so no seam can open between two pieces.
- **Its own file for Competitive** (`<id>-v<version>-lo.glb`, the kit's lo texture size, where the preset loads the kit's
  lo files): 24.1 MB. The lo textures alone took it only to 43.8 MB, since geometry was most of it.
- The files go to v3. Checked: verify and rules; the e2e speedkills section (the district drawn from its file, 601,571
  triangles); pictures from the crossroads on Balanced (the same as from the v1 file) and on Competitive.

## Milestone 310 — The city kit v8: its geometry meshopt-compressed, and the importer's material rules

Phase 25, after 307 and 309 changed the importer for the district: the same for the city kit's own pack files.

- **Re-imported as v8** (`citykit.json` version; `import-city.ts writePack` for the kit's three sizes;
  `citykit.ts` loads them with three's meshopt decoder; `tools/kit-glb.ts`'s reader knows the extension, so the kit's
  Node tools still open them): Balanced's files 135 to 114 MB, Competitive's 44 to 37, High's 359 to 338. The kit is
  mostly KTX2 textures, so it saves less than the district, which was mostly geometry.
- **Materials:** High City's last parts in the grey stand-in in the kit (20 triangles) wear theirs by the texture rule
  of 307. Kyber's facade strips keep 15,440 grey triangles, its metro tunnel pieces, whose FBX materials name nothing in
  the pack and carry no texture: the next thing to trace, with the 1,020 material overrides the importer places on no
  mesh.
- One measurement moved (a piece's 13,701 triangles to 13,697). The centre draws the same 6,443 pieces.
- **Checked:** verify and rules; the e2e speedkills section; pictures of the centre from the v8 files. The density
  work parked for v8 (the street clutter's pieces) goes to v9.

## Milestone 311 — High City's corner with the 233 parts it lacked: a mesh found by Unity's own ID for it

Phase 25. A renderer names its mesh by an ID. Newer Unity makes a model's IDs by hashing, where its .meta keeps no
table, so the importer fell back on the renderer's name, and one called "Box06056 (1)" (Unity's name for a copy) found
no mesh and drew nothing. Its new report of such renderers (`import-city.ts`) listed Kyber's ladders (82), a shop's
parts and a robot's.

- **Unity's ID for a mesh** (`import-city.ts unityId`, `meshIndex`): xxHash64 of "Type:Mesh-><name><index>" (UTF-8,
  seed 0), read signed. Found against Kyber's "metro tonnel tile.prefab", whose meshes it references by it: all four
  tested reproduce exactly (Shape021's mesh is 2009449214765265626). A model's GameObjects and renderers hash some
  other way, not yet known (their names, paths from the model's root and other class names tried), so material
  overrides on a model of several meshes still go by slots and names (1,020).
- **The district, v4:** 2,873 parts where it had 2,640, 612,049 triangles where 601,571, 5,545 boxes of collision where
  5,406; 32.0 MB, 24.6 on Competitive.
- **The kit, held at v8:** a v9 re-import recovers 8,724 triangles in High City's pieces and 4,462 in Kyber's, but takes
  Balanced and High past their budgets (3,064k and 3,167k of 3,000k and 3,100k, `city-budget.ts`), and High City's fire
  escape tiles come out 1.05 m wider, their stair 1.05 m along from where the solids were measured
  (`tools/measure-escape.ts`, v8 against v9). Both are the next step.
- **Checked:** verify and rules; `sk-district.ts` on the new collision (every cell, pad, walk and node); the e2e
  speedkills section; pictures beside v3's from the crossroads and a canyon.

## Milestone 312 — The USSO and BOOG with no frame at fault: each finger fitted joint by joint, the wrists straight through every move; the held gun at 2048 on High

The owner, 2026-09-28: "why did you stop short of getting it perfect? That's what the animation screenshots are for? You
know it's not perfect and know what you need to do but stopped short?", and "Yes raise the textures on high settings".
The bar set: no flagged frame on any sheet for either gun (`tools/pack-frames.ts`, the reload, the swap, aiming in and
the pickup a frame every 4%), the sheets sent as proof. The first sweep flagged 127 frames; the last flagged none.

- **Each finger joint by joint** (`tools/pack-solve.ts joints`, `packGuns` hold `joint` and `rot`): the hand moved and
  turned about its wrist, then each finger's three joints turned in turn, until no skin is more than 4 mm into the gun
  while each finger that held it still touches it and the palm stays on it. Measured by depth, seen or not: a thumb in
  the grip shows the moment the gun turns over on a reload.
- **The thumbs** (`tools/pack-thumb.ts`): the local search could not move them. A cross-section of the right hand
  against the USSO's grip showed the thumb lying over the receiver, where every small turn keeps it inside. Each joint
  is searched over its whole range instead, on a grid of 729 turns, and kept where least of the finger is in the gun
  with it still touching: both guns' right thumbs down the grip's side, and BOOG's middle finger.
- **The wrists** (`tools/pack-solve.ts wrists`, `packGuns` shoulders and point): each shoulder moved, at rest and aimed,
  to where both wrists are straightest, never with more of the arms in the picture than the pack's own shoulders put
  there (`__armCover`): the first search raised the USSO's left shoulder 16 cm and its sleeve filled the aimed view.
  The pointing arm's elbow, its reach behind the fingertip and how late the finger turns onto its spot searched the
  same way, the tip still on it: the USSO's pointing wrist from 68 degrees to 50. The wrists now, left and right: the USSO's 38 and 20 degrees at rest and 44 and 21 aimed, BOOG's 30 and 41 and 47
  and 23.
- **The arms turn with the level** (`fprig.ts` level, levelAt): taking the gun's tilt off at rest bent the wrists to 56
  degrees with the hands left where they were; the arms now turn with the gun about its origin.
- **The swap's arms** (`fprig.ts` swing, `viewmodel.ts` swapArms): the pack's swap swung the gun alone and bent the left
  wrist to 67 to 72 degrees; the arms are carried through the swing with it.
- **The pickup's hands** (`fprig.ts` poseHandL): the right hand stays whole on the hold's grip through a pickup, and the
  left eases into its own grip as it comes back (the pickup clip's was made on another gun, and came back 7 to 12 mm
  into ours).
- **BOOG's bolt hand** (`packGuns` L96X rack shift): 18 mm along to 21, onto our bolt's handle.
- **The scope picture has no hand**: aimed through BOOG's scope the gun is hidden and the arms with it; a hand floated
  in the scope's picture.
- **The held gun at 2048 on High** (`paidweapons.json` textures2k, `tools/import-paid.ts`, `paidgun.ts` skinMaterial):
  the import writes each gun skin at 2048 as well as 1024 (270 files, 40 MB, on the game server only, as all the bought
  files are), and on the High preset the gun in your hands loads the 2048 ones. Only that one gun: figures, the floor
  and the other presets keep 1024.
- **The solvers kept**: `tools/pack-solve.ts` (joints, wrists) and `tools/pack-thumb.ts`. A Levenberg-Marquardt solve
  of a whole hand at once was tried and dropped: two minutes a step in the page, and it stalled where coordinate
  descent did.
- **Checked:** new soldier e2e checks (the wrists at rest and aimed within 50 degrees, pointing and swapping within 60;
  the held gun's 2048 skin on High and 1024 on Balanced), the through-the-gun check tightened from 1 cm to 4 mm, each
  seen failing with its fault put back; the soldier section; verify; rules.

## Milestone 313 — STRYDER, REZ and HAEFY; the bought arms' fists straight on their forearms, the thumbs across the fingers; the guns-in-hand plan

The owner, 2026-09-28: "Change the Zephyr to a Stryder, all mentions of it, everywhere ... change one of the guns to
REZ ... Another one could be Haefy"; "the right arm is clearly still so fucked up lol, just put the guns away and look
at the right arm"; and of the round's feedback, "make a planning / update document for this since this is perfect
feedback that you'll have to remember for context when we go for the other guns".

- **The renames** (`speedkills.json` weapons): ZEPHYR is STRYDER, RIPTIDE REZ and HELIX HAEFY, in the code, the
  config, the checks, the README and the docs (79 mentions). The guns' ids are the legacy ones (`rspn101`, `shotgun`,
  `3030`), so saved loadouts keep their guns. RIPTIDE and HELIX were the two chosen because they were ours rather than
  friends' names; PULSAR and NOVA are now the only invented ones.
- **The right fist on its forearm** (`fparms.json` free palmSign): the hands are mirror images, so a palm off the
  knuckles faces opposite ways on the two; with the right's sign the same as the left's, its palm faced out and up and
  the hand was rolled 159 degrees on its forearm (measured, `fprig.ts` wristTwist), the glove's cuff split from the
  sleeve. Now 18 degrees; the left 21. The bend check (wristBend) never saw it: a roll is not a bend.
- **The thumbs across the fingers** (`free.thumb`, `tools/fist-thumb.ts`): bent as the pack's pistol grip bends it,
  each fist's thumb lay along the top of the fist with its tip 1.3 to 1.6 phalanges out ahead, a pointing finger in the
  picture. Each thumb joint searched over its range for the tip across the index and middle fingers' middle bones
  with none of it in them: 0.42 and 0.14.
- **The plan** (`docs/PLAN_GUNS_IN_HAND.md`): the owner's feedback on the USSO and BOOG round by round, in their words,
  with what was done; the bar every gun in hand meets, as checks; the swap as it is now, tagged `swap-drop`, to revert
  to if the thrown swap is worse; the fitting recipe and the plan for the other eight.
- **Checked:** the soldier e2e's fists check now also holds each fist within 45 degrees of roll on its forearm, every
  finger curled 120 degrees and more and each thumb within a phalanx of its place, seen failing with the right palm's
  old sign and no thumb fit (159 degrees; 1.55 and 1.33); the speedkills section (the names); verify; rules.

## Milestone 314 — The bug hunt: the storage cases' missing glow, and the building assets counted

Phase 26 (`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`, the plan of the owner's requests after playing the corner). The
owner: "Do one quick bug hunt to ensure we are good on the map and tell me how many building assets we are using out
of how many."

- **The hunt, live:** a solo battle royale dropped onto the corner, the district drawn 12 s after the page opened, the
  landing on the crossroads' street and still standing 5 s on, the kit and the district drawn whole; twelve spots
  pictured, nothing broken. One fault: the storage cases (the death box, the supply bin) asked for a glow map their
  pack does not have, a 404 each time one was drawn. The importer (`import-paid.ts`) now writes a black one where the
  pack has none; `paid-weapons.ts` checks every skin has all four maps, failing on the live files and passing with the
  six written. Cosmetic: the west arm's walkway ends a few metres from a backdrop building made for the distance.
- **The count** (`import-city.ts PREFAB_REPORT`: which prefabs hold every part the facade strips and the districts
  draw, nothing baked, citykit.json left alone): of the packs' 741 prefabs, 313 are building pieces, and the game draws
  220 of them: 92 whole in the centre's dressing, 127 inside the strips it places, 120 in the corner. By pack: High City
  122 of 136, Kyber 45 of 62, Cyber City 51 of 79, Glass City 2 of 20, the first-person pack 0 of 16.
- **Checked:** verify and rules; `paid-weapons.ts` proven as above.

## Milestone 315 — The slam's ring and its damage numbers; no glitching into the corner; the wall run leans

Phase 26 (`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`), items 26.1 to 26.3, the owner's report after playing the corner.

- **The slam** (`main.ts slamTargets`, `showSlamRing`, `hackHurt`; `hacks.json slam height`): "the slam doesn't seem to
  do any damage to an enemy, it should show the radius circle ... and if it hits give the damage number". It did hurt
  (a bot's shield 50 to 30 in a test), but showed no number and counted enemies by distance in the air. Now its 5 m ring
  lies on the floor under you from the jump to the landing, red when an enemy is inside it; it hits everyone within the
  ring and 2.5 m of its floor; every hack's hit shows its damage number as a shot's does. An e2e check in a battle
  royale holds three bots round you, one beside you, one as near a storey up, one outside the ring: the ring shows red,
  the first loses 20 and its number shows, the other two lose nothing.
- **The corner's glitch** (`import-city.ts districtSolids`, `citydistricts.ts`, the collision file's covers and caps):
  "i was able to glitch into the corner map area". Its buildings were filled solid to 40 m whatever stood there, an
  invisible floor over every lower building and empty lot. Now a cell with something drawn in it is filled to the top
  of what is drawn, a building's hollow inside to the height of what is drawn round it, and city draws those hollows as
  dark blocks a cell back from every face with roofs over the faces' own cells, so the film set is closed from above and
  through its windows. The scene's open ground round its buildings (a hollow joined to the plan's edge) is solid to
  200 m and undrawn (drawn, it was a dark wall hiding the brick buildings at the corner's edge). A new check drops a
  body from 120 m on every 1 m of the corner: 3,917 landings, all on the street, a walkway, a drawn roof or the scene's
  own triangles; on the live collision 2,458 of them landed on nothing drawn. A body that starts a drop inside one of the
  200 m columns is pushed out and falls onto something solid.
- **The wall run** (`main.ts` feel, `player.ts wallSide`, `hud.ts drawWallRun`; `player.json feel wallRoll`, `hud.json
  wallRun`): "it should twist the camera a bit and have some sort of visual feedback that we are indeed wallrunning,
  like empulse does". The view leans 10 degrees away from the wall, easing in over 0.15 s and out over 0.25 s, and a
  glow with streaks runs down that side of the screen. The tour's e2e reads it during a real wall run: the lean and the
  camera's tilt away from the wall, and level again after; proven with no lean and with the lean backwards (the first
  version leaned into the wall).
- **Checked:** verify and rules; the e2e sections speedkills (the slam; one check of a death box's contents failed
  beside it and passed on the rerun) and sktour (the wall run); `sk-district.ts` with the drop check, proven on the live
  collision.

## Milestone 316 — The squad you can see: a colour and a number each, a panel over your health, a ring through walls, and every change of state said

The owner, 2026-09-28: "When i have my friend join and play a BR mode with me, I should be seeing his name, health and
stuff right above mine, like the rest of the BRs do, his model should always be visible in an outline with a small name
above him in the color that he is. Color code them by blue, green, orange, white ... the bottom left should have their
color bordering it with a number ... We should be very aware that we are playing with a friend and should have all the
indicators of that, like if a tm8 died or goes down or anything like that." SpeedKills only; the legacy game is as it
was. See PHASE_27_PLAN_THE_SQUAD_AND_THE_SOLDIER.md, items 27.1 to 27.5.

- **A colour and a number each** (`src/game/squadview.ts`, `squad.json` colors): 1 blue, 2 green, 3 orange, 4 white, by
  player id, which every screen in the squad already shares, so both agree with nothing sent; given once a match and
  kept by anyone who leaves. The orange is held 30 degrees of hue off the enemy red, the white under the bloom's
  threshold so its ring does not glow.
- **The squad panel** (`hud.ts` drawSquadPanel, `hud.json` layouts.speedkills.squad): a row a teammate over your own
  bars, bordered in their colour with their number on it: name, distance, the shield's segments and the health bar; a
  hit flashes the row and the part it took drains away over 0.8 s; or in their place IN THE GULAG, GHOST: RESTORE AT
  THEIR ECHO, OUT, CONNECTION LOST, LEFT THE MATCH. Your own number in your colour beside your own health.
- **A ring through walls** (`outline.ts` MateOutline): with no stencil on the canvas or in the post chain, the depth
  buffer cuts it: the figure to the depth buffer only at the nearest depth, then its hull only where that depth is not,
  so it is a rim round them through anything, 1.6 pixels wide at any distance, and never a filled shape.
- **A name over them** at any distance, in their colour with their number, bars within 30 m, the distance past 20 m, over
  the ghost when they are one; their number on the compass (at the strip's end with an arrow off it) and on both maps.
- **The news** (`squadview.ts` mateNews): the feed in their colour and a line in the middle for the Gulag, a win or loss
  in it, a ghost, a restore, out, the connection lost and back, and leaving; the character says the ones worth saying
  (three new lines in `announcer.json`).
- **Found and fixed on the way:** a teammate's health and shield only ever went down on your screen (and an enemy's
  plate the same): a packet is now taken up as well as down a second after your last hit on them (`net.json` hitTrust).
  A player's stage of life (the Gulag, a ghost, out) goes on the state as one optional field at the end of the delta
  keys (`state.ts` lf), which an older build ignores. The "no restores left" word, sent with no place, was dropped
  before it was read; it is read first now.
- **Checked:** `tools/checks/squadview.ts` in verify, seen failing with the old health rule and with the new key put
  mid-list; the e2e `sksquad` section, two real pages in one squad through every state, seen failing with the old
  health rule; and `tools/squad-shots.ts`, the pictures, drawn for real from both screens. verify, rules, the sksquad and
  p2p sections.

## Milestone 317 — The corner's fire escapes: High City's own, up its north arm's east walkway

Phase 26 (`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`), item 26.4, the first part of finishing the corner: ways up besides
the pads, in the packs' own pieces (the owner, 2026-09-28: "pretty sure there are versions in the asset packs").

- **One builder** (`city.ts escapeAt`): the fire escape the centre's towers have had since Phase 21 (High City's b set or
  Kyber's ladder set, over boxes measured off the pieces, walked and climbed as solids) is one function now, hung on a
  tower's face or a walkway's front. The city's 31 are unchanged box for box: a snapshot of every solid, escape and
  dressing site before and after (23,214 boxes, 31 escapes, 31 sites, 16,865 meshes) differs in nothing but the rounding
  of two climb heights.
- **The corner's** (`citydistricts.json escapes`): each walks back from a spot in the canyon to the walkway's front, as a
  pad does, and takes the front's plane and the walkway's height off the collision there, so a re-bake that moves the
  front moves it too. From the street its drop ladder climbs to a landing a storey up, and from the landing you climb
  the wall onto the walkway, at an end or the middle of the landing where the walkway is over it and nothing rises out
  of it. The dressing (`citydress.ts`) draws a one-landing escape as the drop ladder's piece (High City's top piece has a
  flight up to its landing and no ladder).
- **Where they go, measured**: every quarter metre of the corner's four walkway fronts tried by the city's rules (nothing
  in the way from the street to over the walkway, no pad within 3 m, the front flat under both ends). High City's set
  fits on the north arm's east front only, at z 87.75 to 90.5 and 122 to 123.25; it hangs at z 89 and 122.6. The rest
  were turned down for what is there: the west arm's south front has ledges at 3.05 and 7.05 m its whole length; its
  north front is a ledge half a metre deep with a wall to 9.2 m behind it, not a walkway; the one clean stretch of the
  north arm's west front is a block standing alone in the canyon; and at the west arm's end the wall is the backdrop
  building, blurry up close. Kyber's narrower set fits more of them, but it would be another pack's look on High City's
  street, so it is left out.
- **Checks**: `sk-escapes.ts` climbs all 33 (the city's 31 and the corner's 2) with the real movement: the ladder, the
  landing and the wall onto the walkway. Its climb now lets go once over the edge (on a walkway narrower than a stride it
  ran on and fell off the far side). `sk-district.ts` fails when the city's rules turn down an escape the config asks for
  (seen failing with one moved beside a pad).
- **Found on the way** (next, in 26.4): the corner's arm ends. The scene's open ground round its buildings, solid to
  200 m and undrawn since Milestone 315, meets the city's streets and the north arm's canyon in four lots: from the
  street they look like more street, and an invisible wall stops you.
- **Checked:** verify and rules; the e2e section speedkills.

## Milestone 318 — The corner's arm ends closed: its backs built, in High City's own fronts; loot up on its walkways

Phase 26 (`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`), item 26.4, found while hanging the fire escapes: at each end of the
corner's arms the scene's open ground, solid to 200 m and undrawn since Milestone 315, met the city's street and the
canyons' mouths, so the street seemed to go on into an empty lot and an invisible wall stopped you. A new check fails on
that (`sk-district.ts`: nothing undrawn beside anywhere you stand, every half metre of the city's street round the corner,
its canyons and its walkways): 491 half metres on the live corner, 0 now.

- **The backs closed** (`import-city.ts districtSolids backs and fronts`, `citydistricts.json fill backs`): measured, the
  undrawn ground was four big pieces, one at each arm end (623, 557, 439 and 328 m²), and three small ones. Rectangles laid
  over them did not fit the film set's stepped backs (they left fill beside a roof, an invisible wall up there, or cut into
  the scene's corner building), so each piece that meets ground you stand on became the block itself: solid to the median
  height of the buildings round it, whole storeys down (20, 24 and 28 m), and the city draws it as its own buildings are,
  brick under a concrete roof (`city.ts`). A piece that meets nothing you stand on stays as it was.
- **Their fronts dressed** (`city.ts`, `citydress.ts`): each run of a back's edge that faces where you stand, 3 m and
  longer, is given to the kit as a tower dressed on that face alone, in High City's own facade strips as the centre's
  High City towers wear them (whole buildings cannot be lifted out of High City's street: Phase 24.2). The arms' mouths now
  open between buildings: from the city's street a brick front with lit windows, fire escapes, pipes and a billboard where
  the empty lot was. Competitive, whose lean modules fill their limit, leaves the fronts undressed and shows the city's
  own buildings there.
- **The backdrop out of the map** (`citydistricts.json drop`, district v5): the pieces High City made for the distance that
  stood inside the map, the blurry low block at the west arm's end and faces that stood 6 m out onto the city's street, are
  left out of the bake (17 parts). `import-city.ts DISTRICT_PARTS` reports what a district keeps and where, to find them.
- **The kit's limits** (`citykit.json budget`): the fronts are 125k triangles on Balanced and High in 24 pieces the kit
  already draws and one draw call more. Raised to 3,200k and 3,300k on the precedent of the fire escapes' raise, the machine
  at 95% on other work that evening; benched after, later that evening with the machine quiet (10%): three rounds interleaved in the street of a match (skmatch) against the build before the fronts, Balanced medians 11.6 ms against 11.5, High 20.9 against 20.7, both inside the rounds' own spread (Balanced before 10.7 to 12.9 ms), 5 to 15 draw calls and 100k to 200k triangles drawn more; the limits stand.
- **Loot up on the walkways** (`loot.json districts walkways`, `loot.ts`): drawn at random over the plan, the narrow
  walkways lost to the canyons' floor (0 to 4 of 12 spots up there); half the spots now come from the walkways' own
  decks, by their area: 7 to 9 items up there a match, the rest of the field item for item the same.
- **Checked:** verify and rules; `sk-district.ts` (the new check seen failing on the live corner; the drop check counts the
  backs' drawn roofs: 2,027 of 5,601 drops land on them, none on anything undrawn; the loot's share seen failing at 2 and
  3 spots); `citykit.ts`; pictures from the city's streets, the canyons' mouths and above, on High, Balanced and
  Competitive.

## Milestone 319 — The USSO's left hand from the point straight to its handle; BOOG held by its fore-end, ahead of the magazine

The owner, 2026-09-28: "on the usso reload, the hand goes back to the grip in between pointing at the mag and hitting
the charging handle", and "for the boog, the support hand is holding the mag". Both were seen in Milestone 312's own
sheets before acting on them (docs/PLAN_GUNS_IN_HAND.md, round 4).

- **The USSO, point to handle** (`fprig.ts`): the point let go as the magazine seated (54 to 62% of the reload) and the
  grab reached for the handle only from 60 to 70%, so between them the hold had the hand, 3.8 cm from its place on
  the gun at 62%. For a gun with a grab the point is now held until the grab has the hand: 20 cm off its place at the
  least, which is the handle itself (`offHold`, measured).
- **BOOG's hand off the magazine** (`packGuns` L96X hold, shoulders): BOOG's magazine is further ahead of its trigger
  than the pack's L96X's, and the pack's hold put the palm's middle 10.4 cm back from the magazine's front
  (`palmAhead`, measured along the gun). Moved 14 cm ahead, the arm fell short of it from 6 cm on, so the shoulders
  were searched again with the hand there (`tools/pack-solve.ts wrists`); the pack's grip, made for a thicker
  fore-end, then lay flat against BOOG's side with its fingers 5 to 10 cm off it, so a new search turns and moves the
  hand into a grip (`tools/pack-grip.ts`: the palm on the gun ahead of the magazine, the fingers and thumb on it,
  none of it in it): the palm 2.7 cm ahead of the magazine, the wrists 12 and 20 degrees at rest. The left arm now
  reaches along the gun into the picture, as a rifleman's does with the hand out on the fore-end.
- **The bolt is the right hand's** (`fprig.ts` leftClip): while the pack's bolt clip plays, after a shot and on the
  reload, the left hand keeps its fit and its rest grip. Let go, it went back to where the pack's gun is held, BOOG's
  magazine, after every shot; and with the hand out on the fore-end the clip's push of the gun, 5 cm ahead, left the
  arm 1.9 cm short, so the left shoulder sits 4 cm further forward than the search put it, the arm a little bent.
- **Round the magazine** (`reload.clear`): on its way to the point and back the left hand bows out past the gun's
  left side, the most a third of the way from the hold, where the magazine is in the way (straight, BOOG's went 15 mm
  through it). A pickup's left hand is carried by the hold's move all the way down and back: eased in only as it came
  back, BOOG's came back by way of its magazine, the pack's own place for it, 6 mm through it.
- **The sheets**: every 2% now, not 4 (a frame at 14% the 4% sweeps never saw); and the point measured once it has
  settled (98% blended in), as the e2e measures it, the line from a tip still arriving to a spot 2.5 cm away being
  anything.
- **Checked:** new soldier e2e checks: the USSO's left hand 15 cm and more off its place from the magazine seated to
  the grab on the handle, and the support hand's palm 1 cm and more ahead of the magazine at rest on both guns, each
  seen failing with its fault put back; the sheets of both guns, every 2%; verify; rules.

## Milestone 320 — The bots take High City's corner's walkways as high ground

Phase 26 (`docs/PHASE_26_PLAN_FINISH_THE_CORNER.md`), item 26.4: "the bots up on the walkways, not only in the canyons
(the graph reaches them, and in a test match none went up)". A bot wanders the graph at random, and the corner's pads are
one-way links on it, so only a wander that happened onto a pad took a bot up; the high ground a bot goes for on purpose
(`brmatch.ts roofFor`, bots.json skRoofs, now and then out of a fight: take a roof and hold it 25 s) was the low towers'
roofs alone.

- **The corner's walkways are high ground now** (`city.ts DISTRICT_HOLDS`, `brmatch.ts roofFor`): each district pad's
  landing on its walkway is a place a bot takes and holds as it takes a low tower's roof, the nearest within reach; the
  way there is the graph's, up that pad (`climbTree`), and the bot rides the pad as a player does.
- **Checks:** `sk-district.ts`, each of the 5 landings reached from every node of the corner's canyons up a pad (170
  ways; seen failing with the landings not recorded). The e2e speedkills section, in a real battle royale: a bot on a
  canyon node beside a pad, nobody in sight, asks the match for its high ground with its tier's chance made a yes; it
  gets the walkway, rides the pad and stands up there holding it (seen failing, with no high ground in reach, without the
  landings). The test's own setup had to make room for three things the match does rightly: a bot with an enemy in its
  memory hunts there first, a ride it was on carries it on, and a bot in a sector the decay warns runs from it and drops
  any climb (the pad stands on the line between two sectors).
- **Checked:** verify and rules; `sk-district.ts`; the e2e section speedkills; the new test alone 12 runs of 12.

## Milestone 321 — Both hacks over the open palm, clear of the gun; the inspect and the first draw turned by the forearm

The owner, 2026-09-28: the hack "needs to be held higher and slightly more to the left so it doesn't bug in and out with
the gun when it sways back and forth on the usso when we inspect. and I have two hacks enabled, only 1 shows, the
animation should show both, so move one to the side a bit more and have the other next to it, very similar, possibly
smaller if needed to fit in the hand".

- **Why it went in and out** (`tools/pack-audit.js` __cardOverGun): the card draws with no depth test and adds its light,
  so over the white gun it washes out; as the gun swayed under it, 34 to 67% of it was over the gun on the screen (87%
  with two). Measured by filling the gun's triangles into a grid a tenth of the screen's size and counting each card's
  cells over it.
- **Both hacks** (`viewmodel.ts` palmCards, `inspectPalm.pair`): a card for each hack carried, 7 cm apart at 0.8 of one
  card's size, each bobbing a little out of step; they come up once the hand is halfway there.
- **Higher and to the left** (`tools/palm-place.ts`, `inspectPalm.at`): a search of the open hand's place up and to the
  left on both guns, for no card over the gun at any moment of the inspect with the arm reaching and the wrist straight
  enough: 3 cm left and 12 cm up, palm up as before. Raised with the elbow hanging, the wrist bent 100 degrees, so the
  elbow now goes back along the knuckles' line (the forearm runs on into the hand).
- **The wrist not wrung** (`fprig.ts` spreadTwist, `free.twistShare`): palm up with the forearm level, the hand is rolled
  150 degrees on its forearm, and with the forearm's twist bone left as it was made all of it was at the wrist: the
  glove's cuff split from the sleeve. The twist bone halfway down the forearm now takes half (`skinTwist`, the most the
  skin is wrung: 77 to 84 degrees, as the gun holds' own).
- **The inspect, first swept** (`tools/pack-frames.ts` SEQ inspect, flourish): 85 of its 98 frames at fault. Turned about
  the gun's middle, BOOG's grip swung 20 cm out of the right arm's reach; turned about the gun's own axes, the right wrist
  bent 99 degrees; BOOG's body swung through the open hand. In the bought arms' hands the forearm now turns the gun
  (`inspectPack`): rolled about the right forearm's own line through the grip, measured off the rig at rest, to show its
  left side and then its right, the forearm taking the roll along its length, and settled before the open hand comes
  back to it. The hand lets go down and out round the gun's left side (`inspectPalm.clear`: straight, 9 to 25 mm through
  it; out alone, 9 mm).
- **The first draw** (`inspectPack.flourish`, `debugView.flourish`): a whole twirl round the barrel in a hand on the grip
  wrung the wrist 152 degrees; in the bought arms' hands it is a flick of the forearm, 0.42 rad out and back, the left
  hand on the gun through it (at 0.9 its wrist bent 70 degrees).
- **Checked:** new soldier e2e checks: both hacks over the palm; all through an inspect the cards clear of the gun, no
  hand through it, the wrists 60 degrees or less, a forearm wrung 90 or less and both arms reaching; the same through a
  flourish; each seen failing with its fault put back; the sheets of every move on both guns; verify; rules.

## Milestone 322 — Your own tracers a quarter as bright, your muzzle flash at half

The owner, 2026-09-28: "When spraying the usso, the tracers ... are a bit obnoxious. its like the muzzle flash that is
factor that multiplies it ... we should make the tracers much less visible and maybe even remove muzzle flash completely
or replace it with a paid asset muzzle flash from our fps animations pack, making it like 50% transparent".

- **Your own tracers** (`hud.json` tracers ownOpacity, `projectile.ts`): 0.25, additive, where everyone's were 0.9: a
  USSO spray at 18 rounds a second drew a bright wedge from the gun to the target in the frames that caught a round.
  Other players' and bots' rounds keep 0.9, so fire coming at you still reads, and a signature gun's own tracer (BOOG's
  blue) keeps its own.
- **Your muzzle flash** (`gunfeel.json` flashOpacity, `viewmodel.ts` MuzzleFlash): drawn at half on every gun. None of the
  bought packs has a muzzle flash to use instead: the arms pack is animations, sounds and camera shakes, the guns pack
  models and textures, and the city packs a neon flicker script.
- **Checked:** the range section's tracer check also holds your own rounds at 0.3 or less, seen failing at 0.9; the
  range section; verify; rules.

## Milestone 323 — The soldier holds the USSO and BOOG as a rifleman does, reloads them where others can see, and every frame of it is photographed and measured

The owner, 2026-09-28: "If you just simpley go to the loadouts tab and then look at the character/soldier while they are
weilding the usso, you can tell it is purely fucked up ... the main focus should be how the third person view model (how
we see enemies as well) has the boog and the usso being held properly and their reloads are shown ... check out how we
have the frame by frame tool for the first person FOV, we should be doing the third person / enemy view the same", and
later "Have you taken all screenshots frame by frame when the enemy is reloading and changing weapons and jumping and
stuff of that nature?" SpeedKills' soldier only. See PHASE_27_PLAN_THE_SQUAD_AND_THE_SOLDIER.md, 27.6 to 27.11.

- **The frame tool** (`tools/figure-frames.ts`, `tools/figure-audit.js`): the third-person twin of pack-frames. A lab
  soldier stepped by the tool (`main.ts` figureLabStep), so a reload's frames land at 0, 4, 8 ... 100% of it; at rest,
  aimed, looking 40 down to 40 up, firing, the reload and the swap a frame every 4%, a jump, a run, a sprint, crouching, a
  slide; from the front, the right, the left and the back, whole and close, at a 40 degree lens; and the Loadouts tab's
  soldier holding each gun from four sides. Each frame measured: each palm against its place, the barrel against the
  look, the wrists, a hand's skin into the gun and the gun into the body, the faults written on the tile; `XRAY=1` marks
  where. Before: every frame at fault.
- **The hold** (`src/game/rifle.ts`, `src/config/soldierhold.json`): the chest turned so the left shoulder leads, the butt
  in the right shoulder's pocket (measured off the model, riding the chest), the gun along the look exactly, each palm
  placed on its hold and the hand turned to it, the forearm's twist bone taking half the roll, the fingers closed about
  their measured bend axes. What a hand is comes off the bones' places, since the bought rig mirrors its right hand.
- **Aimed in**, the gun's own sight line comes up to the soldier's right eye (measured off its eye mesh) with the head
  leant onto the stock; at rest the gun is at the chest. The Loadouts tab's soldier aims in.
- **The reload**, on the gun's own reload time, so an enemy's plays from the moment it arrives and nothing new goes over
  the network: the gun turned to the left hand, the magazine out and let go (a copy falls to the floor and is gone a
  moment later), a new one from the pouch at the left hip pushed home, the USSO's handle racked, BOOG's bolt worked by
  the right hand.
- **The lowered carry** for a sprint (which SpeedKills always does) and a swap, the left hand its own way; **a slide or a
  climb** keeps the gun in the right hand (it hung at the chest with no hand on it); **a shot** kicks the gun.
- **The search** (`tools/figure-solve.ts`): the pocket, each gun's palm places and turns, the elbows and the lowered carry,
  by coordinate descent against the audit, as pack-solve does the first-person arms; each gun's marks photographed first.
- **The Loadouts tab** rebuilds its soldier once the bought guns are in (it kept the procedural stand-in).
- **The bundle** (27.6): one soldier, its armour on and off (the kits), its colours, skin and eyes; no other skins and
  no animations. The figures' clips are the free pistol library, which is why the hold is built on top of them.
- **Where it stands:** both palms on their holds and the barrel along the look in every hold frame, the wrists 1 to 38
  degrees. Hand skin is still 12 to 14 mm into the USSO where the fingers wrap its grip and 27 to 28 mm into BOOG round its
  grip and fore-end (27.11, next).
- **Checked:** `tools/checks/soldier-hold.ts` in verify (the arms, hands and pocket measured off the model against the
  config; each hand's frame and every finger's bend on both sides of the mirrored rig; the right eye), seen failing with
  the mirrored palm put back; the e2e `skfigure` section (both guns held in four poses, the reload's magazine out, let
  fall, cleared and home, the Loadouts tab's soldier); the soldier section; verify; rules.

## Milestone 324 — The guns at rest as the view's own arms held them: the game's field of view, the barrel level

The owner, 2026-09-28: "I STILL FEEL like the guns when resting are still too angled up and to the left too much, like
the view angle isn't how it was originally ... compare it to hyperscape and you'll notice right away".

- **Measured** (the barrel's line in the view and where it runs on the screen, with the bought arms and with the view's
  own arms holding the same bought gun): the turn in toward the crosshair was the same, 3 degrees; the bought arms held
  the barrel 2 degrees up where the view's own held it level (0.3 on the USSO, -0.1 on BOOG), and drew it at the pack
  camera's field of view, 80 degrees where ours is 92 at the default setting: the gun bigger and lower (the USSO's
  origin 69% down the screen against 58%), its line steep up to the crosshair.
- **The field of view** (`main.ts`, `fparms.json` fov gone): the gun camera's own at the hip with the bought arms, as
  for every gun and as before them. It was narrowed because at ours the forearms and the gun's back end filled the
  bottom of the view; with the shoulders fitted since (Milestones 312, 319) the left sleeve shows at the bottom edge
  without filling it.
- **Level** (`fparms.json` hipPitch): 0, as the view's own arms held it.
- **Checked:** the soldier e2e's level check (its target from the config, now 0 within 1 degree); the sheets of every
  move of both guns at the game's field of view; the soldier section; verify; rules.

## Milestone 325 — The Neon City map in the game: the centre laid out from the bundle, its pads the pack's own

Phase 28 (`docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md`), items 28.2 to 28.5: the owner, 2026-09-28, "basically
wiping the entire map except the idea ... implement using all new assets, nothing at all should be custom made or not
coming from the asset packs ... Like the jump pads and path shown coming out of them is an ugly color that looks like we
drew it in ms.paint". The old city stays the default until the new one has its detail; `?map=neon` plays the new one.

- **The layout** (`tools/neon-layout.ts`, `src/config/neonmap.json`): 2,281 placements of 19 of the bundle's pieces,
  each placed by its measured bounds, never its pivot. The nine districts and their bounds as they were; the eight round
  the centre the pack's pavement and roads; the centre a 3 by 3 of blocks with 15 m streets: Neon Building 08 (151 m)
  in the middle, High City's 26 m towers on the four axis blocks, 3 to 6 storey buildings on the corners.
- **The bake** (`tools/import-neon.ts NEON=bake`): one file a texture size, lo 48 MB (512 px), hi 93 MB (1024), max
  258 MB (2048), 1.21 M triangles, and its collision measured off the same triangles, 21,142 boxes
  (`src/config/neon/neonmap.solids.json`). The centre's chunks bake as one, a mesh a material (its pieces share the
  pack's materials): a chunk at a time it drew 920 calls in the street, as one 440, and measured in turn on Competitive
  106, 106 and 98 fps became 141, 139 and 167.
- **The pack's materials as Unity draws them.** A third of them keep the surface in Unity's detail maps (the asphalt's
  main map is a noise, the asphalt the detail): multiplied in now (`src/game/detailmaps.ts`, 80 materials). The
  roughness was counted twice wherever the packed map carried a material's own smoothness, which made the asphalt a
  mirror (0.148 squared): the factors are 1 now. The light beams and glows are Unity's particle shaders, drawn unlit
  and added (`applyUnityLooks`), not the solid white columns they were read as.
- **High City's towers are shells with nothing inside**: what a solid building's ground-floor walls close in (gaps up
  to 3 m shut) collides from its foot, so nobody walks in under a roof slab and stands inside a shell (26 street nodes
  were cut off in them).
- **The jump pads are the pack's**: its CapHole plate and its StreetFocusLarge beam, blue, found by the bake in the
  collision (each high city block's face, from the street before it and the ring road behind it, with a level landing)
  and thrown by the old city's solve, now shared (`src/game/padsolve.ts`). All eight land a rider 3 m onto their 26 m
  roof.
- **The bots' graph** covers every floor a body stands on: the street every 10 m, the roofs and floors over it every
  5 m (High City's roofs step 0.3 to 0.85 m between decks, and a bot never jumps), each link walked both ways; every
  pad is a bot's way up with its landing joined to the roof.
- **Loot where the fights are**: the four high city roofs are named sites (NORTH, SOUTH, WEST and EAST DECK) with loot
  of their own, and the tallest building's lobby a fifth; 40 items over 12 m and 39 over 24 m, the old city's bar.
- **Before and after**, this build measured both ways in one session (`tools/map-stats.ts`, `tools/bench.ts`):
  on Balanced and High the map draws 1.21 M triangles in 251 meshes against 3.73 and 3.84 M in 1,533 and 1,554,
  downloads 143 and 309 MB against 199 and 424, and loads in 8.6 and 12.2 s against 10.9 and 16.7. The median frame, the
  two in turn three rounds: in the street Balanced 8.4 to 6.0 ms and High 16.0 to 9.3; over the centre Balanced 6.6 to
  4.7 and High 13.3 to 8.2. Competitive is 0.4 to 1.2 ms slower (5.0 to 5.4 in the street, 4.1 to 5.3 over the centre):
  the map's geometry is the same on every preset, where the old city gave Competitive a lighter kit.
- **Checks:** `tools/checks/sk-neon.ts`, in verify: the nine places and their drops, the street one network, every box
  of the bake's collision, the ship over the tallest top, every pad ridden by a player's own movement onto its roof,
  every bot pad joined, the loot's share up high (seen failing with the graph's overlap test taken out: 698 street nodes
  and one bot pad).
- **Checked:** verify and rules; `sk-neon.ts`; the pads ridden in a real match in the page; the e2e section speedkills
  (the old city's code the new map shares was moved, its pads, graph and collision compared identical). One bench of
  nine heavy page loads in one browser crashed its page with the chunked bake; the same nine with the merged bake did
  not.
- **The slam's e2e made steady** (found running the speedkills section): its bot "a storey over you" was held 4 m up by
  an 8 ms timer alone, fell to your floor in its own update between pins, and on the loaded machine the slam hit it
  there 3 runs in 5 (the player landed exactly where it rose, so the game's rule was right). It stands on a deck of its
  own now, removed after: 6 runs of 6, and seen failing with the slam's height reach widened to 5 m.

## Milestone 326 — The tallest building's court: its pit floored and walled, the world's floor lowered into it

Phase 28, item 28.7's first find (`docs/PHASE_28_PLAN_THE_CENTRE_FROM_NEON_CITY.md`). Neon Building 08 goes down to 7 m
under the street, a basement, and the layout leaves the ground's tiles out under its footprint. What that left, live in
`?map=neon` since Milestone 325: a 40 x 20 m hole in the plaza with the sky showing through the world under it, and the
game's floor, the street's, holding a body up over it on nothing. The collision had none of the basement either: the
districts' rule for the street's scraps (nothing topping out under 0.35 m) threw every floor below the street away.

- **The court** (`tools/neon-layout.ts`, rules.court): the hole the footprint leaves floored at the building's foot,
  7 m down, with the ground's own tiles 3 cm under the basement's floor so its floor draws where it has one, and walled
  round with the pack's concrete city wall (CityWallsWall00_Concrete, 7.0 m, exactly the hole's depth: the layout
  refuses a wall that is not). The world's floor is lowered over it (`floors.ts FLOORS`, as the old city's metro did).
- **Its collision kept below the street** (rules.below): the basement's floor at -7 m, a level at -3.5 m and the steps
  between. Dropped anywhere over the court, a body comes to rest on its floor or on the building's own stairs and
  terraces (-3.5 to 3.7 m). A player climbs out over its walls (a climb and a mantle reach 7.9 m); a bot, which never
  climbs, has no way in on the graph.
- **The map's files are version 2** (`neonmap-v2-<size>.glb`): the server lets a browser keep `/models/` a day, and a
  v1 kept would have drawn the hole over the court's collision.
- **Checks:** `sk-neon.ts` drops a body in the court's four corners: each stands on its floor, and the floor is drawn
  (seen failing with the floor not lowered: all four stood at the street's height, on nothing).
- **Checked:** verify and rules; `sk-neon.ts`; the court photographed from its floor and from above.

## Milestone 327 — The swap thrown: the gun tossed up and out of the hands, the next caught

The owner, 2026-09-28: "currently we bring the guns down like a realistic fps to swap between, but the gun just phases
out, any way we can like reverse that animation and just have the character throw it up and out or something while
after 0.5-1s and some distance, the weapon phases out and the new one phases in in its place and then animates towards
the user's hands? ... If this isn't feasible, it's ok, but I think we should try it and make a note of how it is now in
case we need to revert".

- **The throw** (`fparms.json` swap style "throw" and throw, `viewmodel.ts` throwGun): the hands lift the gun 4.5 cm,
  then it goes on alone, straight up out of the hands first and on ahead as the square of its way, 30 cm up and 70 cm
  ahead by the swap's middle, turning end over end from a third of its way; it phases out in the air over its own swap
  timing, and the next phases in out there and comes back the same way into the hands. The throw is moved as the model
  itself, below where the arms' rig holds the gun, so the rig lets it go; the hands open once it has left them, drop out
  of the picture and come back up to catch the next. Within the swap's own time: the swap is a gameplay number.
- **The way out of the hands, measured:** pushed ahead with the hands on it, the arms, near their reach, fell short; slid
  out of closed hands at an angle to the grip, its raked front came through the fingers; opened in place, the
  straightening fingers went into the USSO's magazine in front of its grip; each hand letting go in its own time, the
  right's fingers opened into the grip. Straight up out of both closed hands, the fingers opening once it has cleared
  them, is the cleanest found: BOOG clean all through; on the USSO a fingertip grazes the gun by 5 to 6 mm for about a
  hundredth of the swap as it leaves the hands, and again as the next lands (the sheets at 1% steps flag it; its
  magazine and trigger guard sit where a hand opening off a pistol grip sweeps). `tools/throw-release.ts` searches the
  let-go's settings together, for the next guns.
- **The swap as it was** is `swap.style` "drop": the pack's unequip and equip clips, the arms dropping out (tag
  `swap-drop`, docs/PLAN_GUNS_IN_HAND.md).
- **Checked:** the soldier e2e's swap check now holds a thrown swap: the gun's middle 8 cm and more up and 30 cm ahead by
  the swap's middle (measured 16 and 59 on the USSO, 21 and 60 on BOOG), and at each 4% of it no hand through the gun and
  both arms reaching. First written as 30 cm from where it was held, it passed with the old swap too, whose clip carries
  the gun far as well, down and in to the chest; up and ahead is what only a throw does, and it fails with the old swap
  (the gun's middle 5 to 15 cm down and 39 to 46 cm in). Measured by the gun's middle: its model's origin, at its back, swings down as it turns
  end over end. The sheets of every move of both guns; verify; rules.

## Milestone 328 — Neon City is SpeedKills' map; the metro's halls off the tower's court; its walls facing in

The owner, 2026-09-29: "i can't play on the new map anymore, make it the default, the url doesn't work with the
map=neon". The address worked when tried from here (the live page with `?game=speedkills&map=neon` drew the map in 16 s),
so whatever lost the word on the way, the map no longer needs it.

- **The default**: SpeedKills plays the Neon City map (`main.ts`); `?map=city` keeps the ILranch city it replaces, to
  compare and to come back to. The e2e's SpeedKills pages stay on `?map=city`, where its city tests are, unless a query
  names a map (`E2E_MAP=neon` puts every one on the new map); `tools/bench.ts` and `tools/map-stats.ts` measure the new
  map with no query and the old with `&map=city`.
- **The halls** (Phase 28.7, the underground): four of the pack's metro corridors off the tower's court through doors in
  its walls, out under the plaza on the court's floor (7 m down): 15 m north and south, 5 m east and west, floored with
  the pack's tiles (a corridor has no floor of its own) and closed with the court's wall. The world's floor is lowered in
  them, and the street's slab laid over them at the plaza's height where its tiles are drawn: without it a body on the
  plaza sank through onto a corridor's roof. The north door sits at x 10 to 15, where the tower's basement leaves the
  way clear (a body 3.5 m inside the court reaches every other segment but x -5 to 10 there).
- **The court's walls face in.** The pack's concrete city wall is one-sided (its triangles face one way: 36.5 m² and
  none the other), and turned the same way on opposite sides, the north and east walls of Milestone 326's court faced
  out: from inside the court they were not there, and the sky showed through. Each wall is turned now so its face looks
  into the court or down its hall, from the measured facing (rules.court.faces).
- **The map's files are version 3.**
- **Checks:** `sk-neon.ts`: from 3 m inside the court a body sprints down each hall to its far wall on the court's
  floor, and on the plaza over each it stands at the street's height (seen failing with the slab taken out: all four
  sank to -1.5 m, onto the corridors' roofs).
- **Checked:** verify and rules; `sk-neon.ts`; the halls and the court photographed from inside at night; a match on
  the default map.

## Milestone 329 — The USSO's sight whole aimed in: the gun's back end kept off the eye

The owner, 2026-09-29, playtesting: "ADS on the USSO, you can see part of the optic disappearing, showing all buggy and
stuff. these are things i was hoping you would notice in general."

- **Measured:** aimed at the red dot's eye relief (`paidweapons.json` sights dotEye), the USSO's receiver runs back past
  its sight to within 2 mm of the eye (0.0043 of the view's units), inside the gun camera's near plane (0.02 m, 0.048
  of them): its back end was cut off by the camera, and showed through behind the glass, the housing looking see-through
  and flickering as the gun swayed.
- **The fix** (`viewmodel.ts` fitOptic, `paidgun.ts` SIGHT_CLEAR, `paidweapons.json` sights clear): each gun's back end
  measured with its middle when it is loaded, and the eye put back along the sight line far enough that the back end
  stays `clear` (0.03, before the view's scale) in front of it, so the dot stays where it was on the screen. At 0.12 the
  gun sat far out with its rear block filling the bottom of the sight picture; at 0.03 its nearest part stays 0.067 of
  the view's units or more off the eye, aimed and firing (0.077 in the e2e's burst), with the near plane at 0.048.
- **Checked:** a new soldier e2e check: aimed and firing a burst, no part of either gun inside the near plane (the USSO
  0.077), seen failing without the clearance; the sheets of both guns aimed; the soldier section; verify; rules.

## Milestone 330 — The inspect's hacks: the arm down and nearer, the cards bigger with their levels, tossed away at the end

The owner, 2026-09-29, playtesting: "the arm looks out of place now when inspecting the hacks. If you just move it back
down and slightly closer to the camera again i think it fixes it ... the arm is weirdly up and out there, then the hacks
themselves can be slightly bigger themselves, be moved over slightly to the right as a pair, should have some more
animation to it as well, like very basic glow or something or it should show the level as well like we do on the custom
ui on the bottom. Then i think we make the whole animation like 2 seconds longer, so like a bit longer after each twist
... and if we can also include the tossing up animation of the hacks nearing the end of the inspect and they dissolve in
the air like we plan to do when swapping guns."

- **The arm** (`fparms.json` inspectPalm.at, L96X palmElbow): photographed as it was, the whole left arm lay across the
  left of the screen with the palm near eye height, its elbow inside the picture (0.5 of the way down on the USSO, 0.69
  on BOOG). Three spots between round 4's and the one before it were photographed; at [-0.15, -0.16, -0.26], 6 cm lower
  and 4 cm nearer, the forearm comes up from below the picture on the USSO, its elbow drawn 5 cm lower as well (at the
  spot alone the forearm was wrung 90 degrees, the most the checks allow; now 76, the wrist 50). BOOG's rig sits 5 cm
  lower and 6 cm further ahead, and there its elbow still swung out left with the sleeve across the bottom at every palm
  spot (lowered to match, a card lay 14% over its scope), so its open hand's elbow is drawn 14 cm lower: the forearm up
  from below as on the USSO, the wrist 52 degrees (20 cm lower bent it 67). Both elbows are now under the picture's
  bottom edge (-1.66 and -1.69).
- **The cards** (`hackcast.ts` hackCard and HackCard, `viewmodel.ts` placePalmCard): at 0.92 of a card's size where they
  were 0.8, and nearer the eye, 2 cm right as a pair. Each carries the hack's fusion level as pips along its foot, lit in
  its slot's colour as the HUD's hack boxes light them (mobility cyan, utility pink), with a soft amber halo behind it
  pulsing. They are drawn over what is behind them rather than added to it: added, over the open glove's lit palm, an
  icon washed out to white.
- **Longer** (`inspectPack.seconds`, `viewmodel.ts` inspectTime): an inspect in the bought arms is 5.2 s where the view's
  own is 3.2, a second more held after each twist, the moves themselves as long as they were.
- **The toss** (`inspectPalm.toss`): near the end the palm flicks up 3 cm and throws the cards, which rise 14 cm, slower
  as they go, spreading and turning, and phase out in the air with the gun's own sweep (`phase.ts`, the card's material
  wrapped as the gun's are), top down, gone before the hand goes back to the gun.
- **Checked:** the inspect's frame sheets on both guns, no frame flagged; the cards clear of BOOG's scope through its turn
  (it comes nearest at 64%); new soldier e2e checks: the open hand's elbow under the picture and the hand in its lower
  half, each card's hack and level, the toss (the cards 5 cm and more up and more than 40% phased by 85%, none shown by
  93%), and an inspect begun as its button begins one still going 4.4 s in and over by 5.6, each seen failing with the
  change taken out; the soldier section; verify; rules.

## Milestone 331 — The USSO and BOOG first for everyone; a visit log that says who played

The owner, 2026-09-29: "would like any new user or returning user to have their loadout defaulted to the boog and the
usso. the only one who has been connecting other than me is usso, he said he played around a bit again yesterday, can
you tell when he connects and plays? even if its just connecting to the lobby?"

- **The first loadout** (`speedkills.json` lists.loadouts[0] and loadoutNames[0]): USSO and BOOG, named for them. The
  two are the guns finished to the bar in `docs/PLAN_GUNS_IN_HAND.md`, in first person and on the soldier; a friend
  opening an invite picked up a rifle and the USSO.
- **Returning players** (`loadouts.ts` PICK, `lists.loadoutPick`): a stored loadout is kept across visits, so a new
  default alone reached nobody who had played. The store now carries the tag it was last moved to; a browser without
  `usso-boog` is put on the first default once and the tag saved, so a pick made after that sticks. A later tag moves
  everyone again. The tag rides in the store itself, which the account sync already carries between browsers.
- **Could the server say whether USSO played?** No: the broker keeps no names, Caddy keeps no access log, the relay's
  log held only port scanners, and the boards hear only of wins and course times (his last, "Usso", 2026-09-21; a few
  generated names on 09-27 and 09-28 could be anyone).
- **The visit log** (`serve.mjs` /api/seen, `src/net/seen.ts`, `tools/seen-report.ts`): the page sends a line as it
  opens (and whether from an invite), as a lobby is made or joined (code and mode), as any match starts (its kind, and
  host or guest) and as it closes (seconds on the page), by beacon, only where `/net.json` names the log. Each line
  keeps the name the player goes by, an id the browser made for itself (`seen.device`, outside `range.*` so the
  account sync never copies it to another browser), the address as an HMAC under the server's own secrets, the
  browser and system in two words and the build served; a test browser is marked. 120 lines a 10 minutes an address,
  1 KB a line, the file moved aside at 5 MB. `npm run fps seen [days] [all]` groups each browser's lines into sittings
  (a new one after half an hour of nothing) and prints them in Chicago time; `fps backup` takes the file too.
- **Checked:** `tools/checks/seen.ts` in verify: every event the game sends is in the server's list and sent from
  main.ts (seen failing with `close` taken off the server's list), and a made-up night reads as two sittings with the
  test browser left out; the server run here on a stub site: a line written with the markup stripped from the name and
  the address hashed, an unknown event and a body that is not JSON refused. New e2e section `sklobby`: a new player
  holds the USSO and BOOG, a returning one on Marksman is moved onto them with the tag stored (seen failing with the
  move taken out), and Marksman picked again survives a reload. verify, rules.

## Milestone 332 — The soldier's hands closed round the USSO and BOOG: each grasped as a hand grasps, found by search, and the USSO drawn at the glove's size

The owner, 2026-09-29: "ok good continue, we aren't perfect yet. remember we want these two guns that the char holds to
be perfect on all frontss, then i'll verify, then we can move on to the other guns with the char". SpeedKills' soldier
only. See PHASE_27_PLAN_THE_SQUAD_AND_THE_SOLDIER.md, 27.11 and 27.12.

- **Found by photographing each hand close** (`tools/figure-hands.ts`, new: each hold from the gun's right, left and
  front, half a metre off, captioned with its measures): the USSO's right hand lay across its grip, its middle knuckle on
  the grip's centre line; BOOG's lay flat on its receiver with the fingers splayed, and measured 2 mm into the gun,
  nearly perfect by depth alone. Fitted by depth alone, both guns' fingers had come out straight, holding nothing.
- **The glove and the guns, measured** (`tools/gun-shape.ts`, new: a gun's side thickness map and cross-sections;
  `tools/checks/soldier-hold.ts` now measures the knuckles): the glove is 0.094 m across the knuckles and 0.123 m wrist
  to knuckle, about 1.25 times a man's hand; the USSO's trigger guard closes round the fingers with an opening 7.5 cm
  tall and 4 cm deep. The figure's USSO is drawn at 1.1 (`soldierhold.json` scale, `mannequin.ts` setGun), the least its
  hand fits (1.2 and 1.3 fitted no better); your own is the first-person arms' and unchanged.
- **Each hand grasps** (`tools/figure-fit.ts`, rewritten): the palm seated along the way it faces, onto the gun or out of
  it; each finger closed a phalanx at a time until its own skin touches the gun, a joint opened back when it pointed the
  next into the gun; the hand's place searched round a start measured off the gun (5 cm along it, a centimetre across,
  24 degrees of tilt), a whole grasp at each, scored by no skin in it, the palm and the holding fingers on it, the
  fingers closed, the wrist straight and the thumb round the far side. The knuckles had to go back: with a glove this size
  on a thin grip, the first phalanges lie along the grip's side and the middle ones cross its front.
- **Fingers and thumbs** (`rifle.ts`): a finger's first joint swings sideways before its curl, and the rig's T-pose
  splay (measured: index 7.4, ring 8.1, little finger 17.4 degrees off the middle finger's line) is 80% closed
  (`soldierhold.json` together); the thumb is turned round the far side of its hold after its curl.
- **BOOG's left hand holds its magazine** (`soldierhold.json` support, per gun): its fore-end is 0.83 m in front of the
  butt, past a man's reach (0.59 m to the palm), so the hand had slid back and cupped the air under the magazine. With
  the chest turned further (41 degrees, a marksman's stance) it holds the box magazine from below, as an AK's is held.
- **The rest stance searched again** (`tools/figure-solve.ts` rest now moves the body, not the hands): the USSO no more
  than 8 mm into the body at rest, aimed, crouched or in the air (it was 28); BOOG's torso clear, its right upper arm
  still up to 35 mm into its stock (27.12).
- **In a slide or a climb** the right hand's fingers stay closed round the grip (the clip's fist went through it), and
  the lowered carry's left hand is each gun's own fitted hand.
- **The audit is 28 times faster** (`tools/figure-audit.js`): the nearest surface found cell by cell nearest first,
  stopping once none can hold anything nearer, triangles read in place; a hand's measure 2.5 s to 90 ms, the whole
  figure's 2.9 s to 140 ms, the same answers. The frame sheets and the e2e now hold contact as well as depth (a palm or
  a holding finger more than 8 mm off its hold is a fault); a close tile follows the figure through a jump.
- **Where it stands:** at rest, aimed and crouched the USSO has no faulted frame from any side; every hand is on its
  hold with no skin more than 2 to 6 mm into either gun. Still faulted, listed in 27.12: BOOG's right forearm and upper
  arm through its stock, the reload's own hand places (never fitted), the swap's BOOG through the body, the recoil's butt
  into the collarbone, and the left hand where the hold slides back out of the arm's reach.
- **Checked:** `tools/checks/soldier-hold.ts` in verify (the knuckles measured; the fingers' splay, index one way and
  ring and little finger the other; swung by its splay the little finger lies on the middle finger's line, seen failing
  34.9 degrees off with the sign flipped); the e2e `skfigure` section, all passing (now also each hand on its hold); the
  soldier section, all passing but one first-person check, the inspect running past 5.6 s, the same run alone: that is
  the first-person inspect main changed in Milestone 330, which none of this touches; verify; rules; the frame sheets of
  every sequence for both guns (`shots/figure-v11`).

## Milestone 333 — The USSO's reload: the hand closed on the handle, the finger leading the magazine

The owner, 2026-09-29, playtesting: "the left hand when doing the charging handle on the usso doesn't like close its
joints/fingers around the charging handle, you know? it kind of keeps its same position from the pointing ... and then
we should have the finger move up and down by a bit following where the mag goes, as if the finger controls the mag
going in, giving it a point to be like that."

- **The rack** (`fprig.ts` grab, MPS5 rack grab `close` and `hook`): photographed, the forefinger lay straight up the
  gun's side with its tip on the knob, curled 13 degrees. Now the forefinger and thumb close `close` of the way to a fist
  (0.7 and 0.3) once the pinch has the knob, the forefinger curled 133 degrees over the top of the receiver beside it.
  Closed at the old pinch point the fingertip went 5 mm into the gun, so the point is 4 mm further out, where nothing
  goes in at any 1% of the grab (2 mm further in it touched 4.3 mm); the pinch is 1.7 cm off the knob, the wrist 22
  degrees.
- **The point** (`fprig.ts`, `fparms.json` reload `lead` and `follow`): measured, the finger already went with the
  magazine, 170 pixels at 1920 by 1080, but in step with it and with the gun's turn, so nothing read as the finger's
  doing. Now it goes 0.07 of the reload ahead of the magazine: it is 65% of the way down as the magazine starts to drop,
  and rises first as the new one comes in, the magazine following it. Tried and dropped: carried 1.4 times as far, the
  finger went out of the bottom of the picture; aimed on along the magazine's way, the wrist bent 158 degrees; led by 0.1,
  the finger had finished before the magazine began.
- **Checked:** the reload's frame sheets on both guns, no frame flagged; new soldier e2e checks: the USSO's forefinger
  curled 100 degrees and more on the handle, and the finger a third of the way and more ahead of the magazine going out
  and coming in, each seen failing with the change taken out; the soldier section; verify; rules. Two checks made
  steady on the way: the thrown swap's rise is read once the held pose has settled (read 0.15 s in, at the few frames
  a second the e2e draws, BOOG's middle had come 7 to 13 cm of its 20 cm, run to run, and once failed at 8), and the
  inspect's length is timed by game time itself (its 30 s wait had run out before 5.6 s of game time had passed).

## Milestone 334 — Down from the street: the pack's metro kiosks over the north and south halls

Phase 28.7, the underground: the halls off the tower's court (Milestone 328) were reached only from the court, and the
court only by dropping in or climbing out. Now two of them are ways through from the street.

- **The kiosk** (`tools/neon-layout.ts`, rules.court.entrance): the pack's MetroEntrance00, a glass kiosk with its
  "U" over two escalator flights folded back on each other, from the street down to -6.8 m and a landing 10 m long
  (measured off its sections: the upper flight from the street near 1 m along it to -3.2 m at 5.6 m, the lower back down
  to 0). It stands end-on over the north and south halls, its landing toward the court over the hall's 10 m corridor
  (which is its walls and roof there), its flights in a well walled with the court's concrete. The plaza strips north and
  south of the court are 17.5 m to the kerb, and the kiosk 20 m, so it runs from the court's edge to the kerb.
- **The street opened over the well only**: its 10 m tiles taken up and laid again in the pack's 2.5 m tile of the same
  material (the tiles are mapped at 0.1 of their texture a metre whatever their size, measured, so they join
  seamlessly), less the well. The world's floor is lowered in the well; the street's slab stays over the corridor.
- **What had to give**: the kiosk's hanging ad board, 0.3 to 2 m over the landing's floor at its end, stood across the
  hall's mouth (in Unity it hangs in a hall wider than a corridor): a placement can now leave named parts of its prefab
  out, drawing and collision both (`without`). And at the rooms' half-metre collision cells the escalators' glass sides
  widened to half a metre each and left no room for a body: the kiosk's collision is measured at 0.25 m (rules.fine).
- **Its way through** (rules.court.entrance.route, onto the map by the layout): from the plaza beside it, in at its side,
  down the upper flight, round the balustrades' ends at 6.4 m, down the lower flight on its middle line, where its foot
  leaves a body room, and along the hall into the court. A player walks it both ways. A bot does not: the lower flight's
  foot is about 0.8 m clear, room for a player's round body and not a bot's square one, so the bots keep to the street.
- **The map's files are version 4.**
- **Checks:** `sk-neon.ts` walks each entrance's way through with a player's own movement, plaza to court and court to
  plaza (seen failing with the kiosk's fine collision taken out: stuck on the upper flight both ways), and stands a body
  on the plaza over each hall's corridor.
- **Checked:** verify and rules; `sk-neon.ts`; the way through photographed at night.

## Milestone 335 — The group: invite once, wait in the range, and the host takes everyone from match to match

The owner, 2026-09-29: "when I send a friend a join link, it needs to put me in the range waiting for him, now it goes
to a small map while I wait. I then want when he joins for it to act the same way that it does currently ... if I want
to switch, like, let's say I wanted to 1v1 them to show them the new guns ... And then I want to switch to Battle
Royale ... now that we're in the lobby together, I could just pull us both into a new match, whether that's ...
battle royale or back to a range ... we have to send them a new invite code every time."

- **Waiting in the range** (`main.ts` duelHost): SpeedKills' host waits in the range with the code on the HUD, doing
  what they like there, where the lobby used to be the 1v1's own arena. The match starts as it always did once the
  friend is in: their arrival makes the match and puts the host at its spawn. The legacy game still waits in its arena.
- **The group's next match, at any time** (`main.ts` groupNext, `duel.ts` release and onNextMatch): a group between
  matches could already play again on the links it had, but only once a match had run out, and a 1v1 never does (it
  goes straight into the rematch). Now the host's With friends, in a match or out of one, reads "Start for everyone
  (N)": the match in progress lets its links go without a goodbye, and the host's welcome to the next match goes out
  on them. A guest's page takes a welcome from its host mid-match as the end of what it is in (as its end would have
  been) and starts the next on the same link. A friend's button says the host picks; the Friends tab's Play again is
  the same move.
- **The range together** (`MatchOpts.range`, `main.ts` hangout, `Duel` mode "range"): a new friends' mode, offered on
  the range's own card and in the Friends box. It is deliberately not `duel`: over a hundred things in main.ts ask
  whether a match is on to decide that the range's rules no longer apply (the drill, the courses, the dummies, the
  tour, the heal kit), and with friends in the range they still should. It carries the figures, their shots (heard,
  not hittable: a friend's figure is not added to the bullets' targets), hacks, emotes, sprays, gun finishes and
  voice, and never counts down or scores. A guest stands beside the range's spawn by its id (`net.json` group:
  1.6 m apart, a body being 0.81 m across). The range goes on through the range's own modes (the tour, the lab, the
  Run, the arena walk); a solo match leaves the group.
- **Back in the range after a match** (`endMatch`): in SpeedKills a friends' match that runs out puts the group in the
  range together, where the host picks the next one. The legacy game keeps its Play again.
- **A friend who opens the link late** (`link.ts` HostHandle.retarget): the invite names the match it was made for,
  and a welcome from it put a latecomer into a 1v1 the group had left an hour before. The code is now told what the
  group is in: while it is in the range it takes up to seven friends again, and welcomes them into the range; a match
  shuts it to newcomers. The host's own side of an arrival is told the match's size as it stands too (`onLink`'s
  third argument), not the size the code was opened for.
- **Alone in the range again**: every friend gone, the range is no group, the button is With friends again, and a mode
  picked waits on the same code, in the range, for whoever opens the link next.
- **The effects handler** (`main.ts` remoteFx) is lifted out of wireMatch unchanged so the range can share it; the
  hack, emote, spray, banner and finish sends go through `sendFx` (the match's, else the range's).
- **Checked:** new e2e checks in `sklobby`: the host waits in the range with the code on the HUD (seen failing with the
  arena put back); the friend opening the link is in the 1v1 and the host in its arena; the host's button reads Start
  for everyone (2) and the friend's is disabled; mid-1v1 both are moved to the range together, each seeing the other,
  the friend a place along, the guns live, the friend told the host picks (seen failing when only the range, and not a
  match, followed the host's welcome); an emote crosses; from the range both go to one battle royale (the same drop,
  the friend id 1); mid-battle royale both come back; a third page on the same link lands in the range and all three
  see the other two (seen failing with the retarget taken out); a friend leaving is gone from the others; the last one
  gone, the host's button is With friends again and a 1v1 picked waits on the same code, and the next friend on the old
  link is in a 1v1 for two (seen failing with an empty range still counted as a group). The group test runs again over
  the real peer to peer path in the p2p section (a welcome mid-match packed the way PeerJS packs it): all 13 of its checks passed over the public broker, in a p2p run of 45, E2E PASS. The
  lobby check now says the range is played together. invite, duel, brsolo and skfriends, which run the Create, Join and
  Play again this changed: 55 checks, E2E PASS (the legacy host still waits in its arena; its group's button now reads
  Start for everyone (2)). verify, rules.

## Milestone 336 — The Neon City night: its roads reflecting the city, its own violet haze

Phase 28.7, the look. Beside the store's pictures the new map's streets were pale grey ice under a flat night, and
moving the moon, the sky's fill or the environment barely changed it. Measured down to two causes:

- **The roads reflected the sky.** The pack's asphalt is a wet street (smoothness 0.85); in Unity the scene's
  reflection probes show it the dark city and its neon, ours the game's sky map, bright at a grazing angle. Now the
  map's materials reflect a picture of the lit city itself (`neonmap.ts reflectCity`: one cube, 256 px a side, taken
  from the street south of the tower at eye height once the map's file is in, as the old city's wet streets did), taken
  again when the hour changes, so a golden hour's road reflects a golden city. The roads go dark and wet, the lights
  mirrored in them.
- **The ILranch city's haze was painting the new map.** Its atmosphere (`atmosphere.ts tickAir`) runs every frame over
  the same square of the world: the old blocks' colours (Cyber City green, Kyber warm, High City pale) by where those
  blocks had stood, and the old High City corner's staged light, overriding any fog set. The Neon map has its own now
  (`ownAir`, neonmap.json game.air): one pale violet by night, as the store's haze is pale (a dark one over a dark city
  did not show), from 3 to 150 m, thinning as you climb as before; the day hours keep the old day colour.
- **Looked at and kept:** the big white panels are the pack's light-box materials (its Light00 to 09), glowing white by
  design; every ad material carries its own picture as its emission. The range's sky fill (a hemisphere at 0.75, made
  for the desert range) still lights the city by night: turned down, the court went black; left for the dressing step's
  lights.
- **Checked:** verify and rules; photographed at night and at golden hour against the store's pictures; the old city
  (`?map=city`) untouched (its atmosphere and wet streets are its own).

## Milestone 337 — A live check that fails fails the deploy

The deploy of Milestone 335 printed "FAIL both sides connect over the internet (No match with that code)" and then "==
live at https://fpsfun.duckdns.org/", and exited 0. Run again alone a minute later, the live check passed.

- **The exit code** (`tools/live-check.ts`): a check that fails part way (no code from the broker, or the two sides
  never meeting) returns out of the `try`, and the verdict and `process.exit` stood after the `finally`, so they were
  never reached: the process ended with 0, and the deploy, which runs it with `execSync`, took that as a pass. The
  verdict and the exit now sit in the `finally`. Seen: with a failure forced at the start, the file as it was printed
  its FAIL line and exited 0 with no verdict; now it prints LIVE CHECK FAIL (1) and exits 1.
- **"No match" on the first Join after a deploy**: the second time it has happened (2026-09-28 was the first), each
  time the host had its code from the broker and the guest was told no match had it. Two `npm run fps restart`s, each
  followed at once by the live check with nobody connected (`/health` peers 0), did not bring it back, so it is not the
  restart alone; the cause is not found. The live check now waits for whichever comes first, in or told there is no
  such match, and on the second joins once more after 3 s, saying so on its own line; a second "no match" fails. A pass
  takes as long as it did (34 s against the live site).
- **Checked:** the forced failure both ways (above); the live check against https://fpsfun.duckdns.org/: LIVE CHECK
  PASS; verify, rules.

## Milestone 338 — The centre's streets dressed: the pack's lamps, parked cars as cover, cars flying over

Phase 28.7, the streets (`tools/neon-layout.ts`, rules.dress). The store's pictures are full; the new map's streets
were bare road between the buildings. The first pass of the pack's own dressing along the centre's streets:

- **Street lamps**: the pack's double-armed lamp (Lighting_Deco002_lgt, 5.7 m, its lamps lit) every 15 m on both
  pavements, 0.6 m in from the kerb, its arms along it.
- **Parked cars**: the pack's UrbanCar00 and its three variants (2.5 x 1.4 x 4.4 m, placed by their lowest point: their
  pivot is 0.39 m above it) in the lanes by the kerbs, a seeded 9 to 24 m apart with a car at seven slots in ten, facing
  either way: crouching cover in the street, colliding by their own triangles.
- **Flying cars**: 14 of the pack's flying and floating cars over the streets between 11 and 28 m, out of reach, so with
  no collision.
- All clear of the crossings, the jump pads, the ring road and the metro's kiosks. 137 pieces, 249k triangles (the map
  1.21 M to 1.50 M); the cars share their materials, so the centre's draw calls barely move.
- **The map's files are version 5.**
- **Checked:** verify and rules; `sk-neon.ts`; the streets photographed at night from the street and the roofs.

## Milestone 339 — Neon signs on the centre's fronts

Phase 28.7, the streets' second pass (`tools/neon-layout.ts`, rules.signs): the pack's lit sign letters ("holocall",
"movie", "COOL5", "superstars", the tall Korean signs and the rest, 15 of them) hung on the fronts along the centre's
streets and its ring.

- **Where**: found in the last bake's collision (a sign changes no building's): tried every 3 m along a line on the
  pavement a metre past the kerb, three times in four, at a height between 3 and 10 m, straight at the block to the
  first front within 6 m, kept where the front is flat to 0.3 m across the sign's width and 6 m from the last on that
  side. High City's curved faces take few; the low city's flat ones take most. 64 signs, 65k triangles.
- **Which way round**: a sign is lit on its own +z only; from behind, its letters read mirrored in bare metal (seen in
  pictures of one from both sides), so each hangs with its back on the front and that side to the street.
- They collide with nothing, as a sign on a wall a body climbs past should not stop it.
- **The map's files are version 6.**
- **Checked:** verify and rules; `sk-neon.ts`; signs photographed head-on from the street.

## Milestone 340 — The soldier reaches with its shoulder, and runs, sprints and fires with the USSO without a faulted frame

The owner's order stands (2026-09-29): the USSO and BOOG perfect on every front in third person, then the owner
verifies. This is 27.12's first round. SpeedKills' soldier only.

- **The shoulder reaches** (`rifle.ts` reachWithShoulder, `soldierhold.json` reach): when an arm comes up short of its
  hand's place, the clavicle (0.205 m, measured) swings up to 18 degrees toward it first, up to 6.4 cm, as a person
  reaching pushes the shoulder forward, and the left hand's hold slides back along the gun only past that
  (`mannequin.ts` supportHold). It used to slide 2.6 cm on the USSO and 5.5 cm on BOOG running, and took the hand fitted
  to its place into the gun (12 to 20 mm); no pose of either gun slides now.
- **A shot** no longer drives the gun 2.5 cm back into a shoulder that stays put (the chest already rocks back with it),
  and the USSO aimed sits 1.5 cm further out (its eye relief 11.5 cm): aimed 0 to 4 mm into the armour, firing 10 at most.
- **The reload searched a hand place at a time** (`tools/figure-solve.ts` reload, `KEY=`): the USSO's left hand on its
  magazine, pulling it and bringing the new one (one grip on the magazine, lower), at the handle and racking it, at the
  pouch; the gun's turn toward the left hand (15.5 degrees, it was 28); BOOG's bolt worked by the right hand, its magazine
  and pouch. The left wrist at the magazine from 65 to 45 degrees.
- **The lowered carry** (sprint and swap) searched for each gun (`ONLY=` keeps a fitted hand as it is): BOOG's through the
  body 18 mm at most sprinting, from 40.
- **Where it stands** (every sequence, four sides, whole and close, `shots/figure-v19`): the USSO at rest, aimed,
  crouched, firing, running and sprinting has no faulted frame (firing, running and sprinting all did); looking up or
  down 16 of 72 frames, jumping 44 of 168, sliding 24 of 112, the reload 136 of 224 (its magazine through the left
  forearm and the belly on the way to and from the pouch), the swap 176 of 208 (lowered standing, the magazine into the
  belly: the swap and the sprint share one lowered carry). BOOG running and sprinting has none; in the others its stock
  and receiver are 21 to 40 mm into the bulky right shoulder and arm, its one fault left in the still poses (27.12).
- **Checked:** verify; rules; the frame sheets above; the e2e `skfigure` section.

## Milestone 341 — The reload's new magazine held as a hand holds it, and a swap with a carry of its own

27.12's second round (the owner, 2026-09-30: "we want to get the boog and the usso perfect with all animations for
enemy / 3rd palyer stuff"). SpeedKills' soldier only.

- **The new magazine at the pouch** (`rifle.ts`, `soldierhold.json` reload.upright): a part of the gun whose place
  followed the left hand but whose turn stayed the gun's, so down at the hip it stood upright and ran 39 mm through the
  left forearm and 37 into the belly. It now lies across the hand there as a hand grips it (its length from the little
  finger to the index, its middle against the palm) and comes upright as the gun is on the way up, its bottom in the
  palm, so it still goes in straight. The USSO's grip on its magazine sits 13 mm further out of it. The USSO's reload from
  the front: the gun at most 25 mm into the body (it was 40).
- **A swap's own lowered carry** (`soldierhold.json` swap, per gun; `rifle.ts` swapping; `tools/figure-solve.ts` swap):
  the figure swaps standing and sprints running, and one carry for both had the searches trade one against the other.
  The USSO lowered for a swap is now at most 10 mm into the body (its magazine was 39 mm into the belly), BOOG settled
  13 to 17; both still sprint with no faulted frame.
- **Left:** a single frame at a swap's change, the new gun shown before its carry takes it (40 mm); BOOG's stock in the
  right shoulder and arm; the reload's hand at the charging handle; BOOG's reload; the look's extremes; the jump; the
  slide (plan 27.12).
- **Checked:** verify; rules; the e2e `skfigure` section; the reload, swap and sprint sheets of both guns.

## Milestone 342 — The Loadouts tab's soldier holds the gun as a soldier stands with it, the whole gun in the panel at every turn

The owner, 2026-09-30: "ensure the loadout screen shows the character holding the guns like normal". SpeedKills only.

- **The hold** (`main.ts` previewLoadout): the tab's soldier stood aimed in, its head down on the stock, and BOOG's
  scope threw its lens glint across the panel. It now stands at rest, the gun up at the shoulder as a rifleman holds it,
  the head up (the rest hold, clean from every side for both guns; no glint, which is the aimed-in figure's).
- **The framing** (`main.ts` placePreviewCam, previewFitNow): the camera stood at a fixed 3.15 m, showing 0.63 m either
  side of the turning axis; BOOG reaches 1.08 m and ran out of the panel side on, and pointed at you it ran out of it
  too. The camera now stands, for the turn the figure is at, just far enough back that every point of the held gun is
  inside the panel with 8% to spare, head to boots at the least: the USSO whole at every turn at the old distance, BOOG
  front and three-quarter on the same, stepping back as it comes round side on, continuously, since the turn is. The
  wheel's zoom works from there as before. (Fitted once for every turn, the figure was half the panel even front on.)
- **Checked:** the e2e `skfigure` section's Loadouts checks now cover both guns: both palms on their holds and not aimed
  in, and the whole gun inside the panel front on, three quarters, both sides and from behind; seen failing with the
  fixed camera put back (BOOG 0.58 to 0.83 of the panel's half-width past its edge); the Loadouts sheets of both guns;
  verify; rules.

## Milestone 343 — No music unless you want it, the battle royale row's defaults, Casual bots slower, I inspects, the keys on screen

The owner, 2026-09-29: "i didn't want music lol take that out or just default it to silent, then have the battle royale
options be defaulted for everyone at squad=duos, rules = br, friends: one squad, bots=27, ring normal, land with loadout
and casual. and for casual, make the bots move like 0.75x speed so they are easier to track for everyone to start", and
"make I the default inspect key, make sure most / all of our functionality has a default key and make default the
options/buttons to be displayed on the page, with a clear press [button] to hide this ... on the right side, below the
FPS, showing short description + button(s) ... this will help new players."

- **Music** (`audio.json` musicOff, `audio.ts`): the Music slider starts at 0, and a stored volume without the
  musicOff tag is moved to 0 once, so turning it up afterwards sticks. SpeedKills' city loop ('Scifi City - Ambient
  Loop', under every match) rode the effects volume; it is a loop with a tune in it, so it rides the Music slider now
  and is silent with it. The drop theme was already on it.
- **The battle royale row** (`speedkills.json` brDefaults, `main.ts` applyBrDefaults): duos, battle royale rules,
  friends as one squad, 28 bots, the normal ring, landing with the loadout, Casual. Written once over what a browser
  had (a tag), before the row reads it back, so a choice made after that is kept. **28, not 27:** duos' bots come in
  whole pairs, and the row offers 20, 28 and 34 (29 in the match, 30 with a friend). Rules, start, pace and the bots'
  tier are keys the legacy game shares, so its row starts there too.
- **Casual bots at 0.75** (`speedkills.json` botTierSpeed, `bots.ts` tierSpeed): a tier's speed times SpeedKills'
  botSpeedScale (2) and now its own scale, easy (Casual) at 0.75; the others as they were. One function for the bots
  and the tests, where the speed was computed inline.
- **I inspects** (`binds.json`): inspect had no key of its own, only a long press of reload with a full magazine,
  which still works. I was the range's dummy mode; every letter is in use, so that moved to the full stop. Every other
  action already had a default key.
- **The keys on screen** (`keyhints.json`, `hud.ts` drawKeyHints, `main.ts` keyHintsNow): up for everyone on the
  right under the FPS, in the HUD's panel with the prompts' white key caps: move, jump (twice: double jump), sprint,
  crouch and slide, fire, aim, reload, inspect, swap, the two hacks, pick up, melee, ping, map, emotes, third person;
  talk with friends in the match or the range; the fusion level, the dummies and their reset in the range. Each row's
  keys are read from the bindings as they are, so a rebind shows at once (not the scroll wheel's notches nor a
  right-hand twin). The last line, in the hacks' gold: Press / to hide this. `/` (new action keyHints, on the Controls
  tab) hides it, says how to bring it back, and the choice is remembered; the kill feed moves under the panel while it
  is up. Not a layout box: the SpeedKills HUD check holds every box to the bottom band.
- **Checked:** new sklobby checks: a new player's row and music (duos, br, one squad, 28, normal, loadout, Casual, 0);
  a returning one on trios, 9 bots, loot, Skilled and 60% music moved onto them once, and trios and 40% chosen after
  kept over a reload; Casual at 0.75 of its tier's speed and Skilled as it was; the keys up by default with I for
  inspect and / named; I turning the gun over; / hiding them, remembered over a reload. e2e: sklobby 24 of 24, each new check but one seen failing with its change taken out (the one: a choice kept over a reload); the speedkills section three times: its battle royale check, which read the row's old default, now sets trios and 27 itself; two other checks failed once each and passed on the other runs (host and guest in one city match; the loot start's death box); page passed. Seen: the
  panel photographed in the range at 1600x900. verify, rules.

## Milestone 344 — Rooms to fight in on the corner blocks, and the pack's floors, missing everywhere, drawn

Phase 28.7, the rooms (the owner, 2026-09-28: "start adding in the detail, ensuring we utilize the underground, higher
buildings, inside rooms to fight in").

- **The rooms**: on each corner block's inner corner, over the four cells there (the yard among them), the pack's
  realistic Neon Building 04 (20 x 19 x 20 m), turned to face the middle: a basement, a ground floor of rooms and
  corridors, two floors over it at 3.5 and 7 m joined by its own stairs, and its roof at 10.5 m with the pack's roof
  rooms on it (a climb). The block's tall building moves to its outer corner, so each block keeps a roof high over the
  streets.
- **The see-through lower floor** (the owner, 2026-09-29: "the basement / lower floor is like see through and not how
  it should be"): the tallest building's floors over its court were among the missing. On the live map, standing in
  it at street height, one looks straight down through its lower storey into the 7 m pit; with its floors drawn, it
  is a tiled floor with walls (the same spots photographed on both).
- **Its floors were not there, nor any room's.** The pack's basic floor slabs and plain walls (FloorBasic00 and the
  Wall_Simple set, 24 models) are ProBuilder's OBJ exports, and the importer read FBX only, so every room in the bundle
  was drawn with no floor: the rooms building's upper storeys were walls standing over nothing, and loot had nothing
  there to lie on. The importer reads OBJ now (`tools/import-city.ts` readObj): each face keeps its material, V is
  flipped as FBX2glTF flips it, and the coordinates are taken as they are, since ProBuilder's export and Unity's import
  flip x the same way an FBX's round trip does (FBX2glTF reads an OBJ too, but as centimetres and in one material). 431
  of the bundle's 1,826 pieces gained triangles and 78 were measured for the first time; of the 51 the map places, 14
  changed.
- **What that moved.** Neon Building 09 is 17.6 m deep with its floors and no longer fits a corner cell: out of the
  tall list. The metro kiosk turned out to be a whole entrance in Unity, two levels under the street walled down both
  sides and across both ends, its way out a gate in one side: its bottom level's end wall toward the court is left out
  (a `without` entry may now name one part by its place, name@x,y,z, as the pack's plain walls are one model in many
  places), and its way in from the plaza is its real doorway, a 2 m gap in one side (the side the route used is walled
  now, and its front end is glass). The tallest building's ground floor, at street height in the court, a storey over
  the court's floor and walled in, was taken for street by the bots' graph: two nodes an island a drop could be put on.
  The street lattice leaves the court out.
- **Stairs a body fits.** The rooms' stairs are 1.6 m wide with a railing each side, and at the collision's half-metre
  cells each railing took a whole cell and left half a metre between them: the building is measured at the kiosk's
  quarter-metre cells (rules.fine).
- **Loot upstairs.** A room's floor collides as many boxes side by side, few of them a metre across, and loot counted a
  surface only where one box was: SpeedKills' loot now counts a top where boxes at that height together cover the
  square round the spot (`loot.ts` acrossTops; the legacy game's loot is untouched), the boxes near it taken from the
  solid grid: over all 39,000 a spot at a time the pass took laying a match's loot from 170 ms to 320, from the grid
  to 175. Loot over 12 m: 34 items with the tall buildings off the corners, 61 with them on the outer corners and the
  rooms' floors counted.
- The map: 2,543 placements, 1.49 M triangles (from 1.56 M: one building where three or four stood on each corner),
  39,038 collision boxes (from 26,887: the floors, and the rooms at the finer cells). In the street (bench skmatch)
  a frame draws 462 calls and 2.74 M triangles on Competitive (454 and 2.79 M before) and 489 and 2.78 M on Balanced
  (477 and 2.84 M). Frame times were not measured: with the machine loaded, the same run swung from 5 to 41 ms.
- **The map's files are version 7.**
- Bots keep to the rooms' ground floors for now: the graph has no nodes on the stairs.
- **Checked:** `sk-neon.ts` walks each rooms building from the street round it, on foot, an eighth of a metre at a time
  with the square round the player's round body: ground floor 100%, first floor 100%, second 98%, on all four; seen
  failing (0% upstairs) with the building taken off the fine cells. The kiosks' routes walked both ways again, through
  their doorways. A player's own movement up the first flight onto the first floor. The street one network again.
  verify and rules; e2e `loot` and `br`.
- Also on main before it (3c25274): a `?norender` page, the e2e's, no longer dresses the Neon map it never draws. That
  load took the CPU from the e2e's Arena fights: the bots section's last fight failed four runs in four with it, and
  passed two in two without.

## Milestone 345 — The red orb: the outline's hull pushed out by each mesh's own scale

The owner, 2026-09-29: "we still have the red orb bug that is like a red circle around the player in the gulag ... it
happens every few seconds when fighting", then "I saw the red orb in the normal gameplay as well, fight a bot for like
20 seconds capturing every frame you'll see it". Three earlier fixes were guesses (an enemy's heal area, the movement
trails, the edge laser); `docs/PLAN_GUNS_IN_HAND.md` had left "a screenshot of it is the next step".

- **Seen:** a rendered SpeedKills 1v1 against a Skilled bot, aimed at and fired on for 20 s, every painted frame kept
  by Chrome's screencast with the match's state logged beside it. At 11.8 s, 7 m from the bot: a solid red dome some
  metres across where the bot stood, the crosshair on it, in the outline's own #ff2a3a.
- **Measured, on a live bot** (`dummy.outline`): the outline round the enemy under the crosshair (Phase 19 step 10) is
  an inverted hull, a copy of each mesh pushed out along its normals by the width over "the figure's scale", taken
  once off its first mesh (the body, 1.0). The bought guns in a figure's hands are modelled a hundredth size and drawn
  at world scale 100 (12 of the rifle's parts: the magazine, the scope, the trigger...), so their hulls stood a hundred
  times too far out: 2 m for the 2 cm rim, and more with distance, since the rim is sized in pixels. Which of the
  gun's parts are drawn changes with its state, so the ball came and went: every few seconds in a fight, round
  anybody with a bought gun, the Gulag's bot included.
- **The fix** (`outline.ts`): the hulls grouped by their mesh's scale, a material each, every group pushed by the
  width over its own scale, so every rim is the same number of metres. The teammate ring through walls (MateOutline,
  Phase 27) was built the same way and is fixed the same way.
- **After:** the same 20 s fight shot again: the bot under the crosshair has its thin rim and no ball.
- **Checked:** a new sklobby check measures every hull on a live bot holding the rifle (drawn or not, since which
  parts are drawn is a level of detail a ?norender page never updates): 79 hulls, 12 on scale-100 parts, all 2 cm;
  with the old single push put back, those 12 stood 2 m out and it failed. sklobby 25 of 25; sksquad (the teammate rings) and speedkills (the enemy outline in a fight), 117 checks, E2E PASS. verify, rules.

## Milestone 346 — The USSO aimed as it was, its sight whole: Milestone 329 undone, the sight drawn from both sides

The owner, 2026-09-29, on the live build: "adsing with the usso is completely broken right now on the live build, it
wasn't like last game"; and, earlier the same evening: "the sight's base has seethrough textures and the bottom half of
the red dot sight has them as well. that is obviously bugs and i asked for you to fix them before".

- **What broke it:** Milestone 329. Photographed aimed on the live build, on the release before it (8678608) and on the
  one before 329 (6be8698): 329 had put the eye back along the sight line until the USSO's back end was 3 cm off it, so
  the sight shrank to a speck far down a gun held at arm's length, both arms stretched across the picture. Its
  diagnosis was wrong: what the owner had seen disappear aimed in round 5 was not the gun's back end in the near plane
  but the mounted sight's own faces. And it came and went (the owner: "the usso adsing wasn't broken when i just tried
  it, so its an intermittent problem?"): the back end, like the gun's middle before it, was measured on the cached
  model where its last throw or draw's spin had left it, so the push varied draw to draw; on the live build the same
  USSO aimed far out after one draw and right after another (photographed). The middle is now measured with the
  model at rest (`viewmodel.ts`), which the spin and the throw turn about too.
- **The sight** (`paidgun.ts` mountMaterial): the USSO's reflex sight is lifted off the steady SMG's model, a shell whose
  inner faces that gun hid; drawn from the front only, the lower half of its frame and its base drew see-through from
  the USSO's hold, at rest and aimed. Drawn from both sides (a copy of the skin, so the steady SMG is drawn as before),
  photographed whole at rest and aimed.
- **Aimed** (`viewmodel.ts` fitOptic, `paidweapons.json` sights): the eye back at the dot's own eye relief, as before 329
  (its `clear` taken out); the gun's back end comes to 2 mm of the eye there, so the gun camera's near plane is half a
  millimetre (`main.ts`, from 2 cm), and nothing of the gun is cut open, with depth to spare over its 20 m.
- **The muzzle flash** (`gunfeel.json` flashOpacity): a tenth, from a half (the owner: "MAKE THE muzzle flash only like
  10% transparent, since we don't have a paid asset for it, it looks like shit still").
- **Checked:** the USSO aimed and at rest photographed and looked at, the sight zoomed; the soldier e2e's near-plane
  check now reads the camera's own near plane (nothing of either gun inside it aimed and firing), and a new one holds
  each gun's middle the same drawn first and drawn back after a thrown swap (shipped at once to put aiming right on the
  live build; the two are seen failing with their faults put back in the next milestone's proof run); the soldier
  section; verify; rules.

## Milestone 347 — A sprint's jump keeps the gun carried low, and the gun swings clear on its way up and down

27.12's third round (the owner, 2026-09-30: "we want to get the boog and the usso perfect with all animations for enemy
/ 3rd palyer stuff"). SpeedKills' soldier only.

- **A jump out of a sprint** (`mannequin.ts`): the gun was raised to the shoulder in the air and dropped again on
  landing, its stock swept through the right forearm both ways. The sprint's carry is now kept through the jump and the
  landing, as a runner's gun stays low until they aim; a gun carried low into a landing comes up once the landing is
  over, in the standing body.
- **The air's own carry** (`soldierhold.json` air, per gun; `rifle.ts` carryOf): the jump's clip tucks the body, and the
  sprint's carry was 39 mm into the belly there. Eased in as fast as the clip tucks (`airRate`, 14 a second: at the
  carry's own 8 the body tucked round a gun still in the sprint's carry as the feet left the ground). The swap's own
  carry is blended in the same way now, so a swap begun mid-sprint no longer snaps the gun from one carry to the other.
- **The arc** (`soldierhold.json` lowered.arc, per gun): between the carry and the hold the gun swings out, most at the
  middle, 4 lo (1 - lo): straight, BOOG's stock went 40 mm through the right upper arm each time a sprint stopped.
- **The tools**: `figure-solve.ts` stages `air` (both jumps' clips, the takeoff, the landing) and `rise` (a sprint
  stopping and one starting, part way through), and a pose followed by another (`then`); the frame tool jumps at
  SpeedKills' sprint (14 m/s, the athletic jump) and has a standing `hop`; a lab figure given a new gun is placed at once,
  as the game's loop places it before it draws (the swap's one frame at 40 mm was the tool's, not the game's).
- **Where it stands** (every sequence, close, four sides, `shots/figure-v28`): the USSO at rest, aimed, crouched,
  firing, running and sprinting has no faulted frame, and in the air settled and landing none; BOOG running and
  sprinting none. What is still flagged, looked at frame by frame: BOOG's stock 2 to 4 cm into the right shoulder, arm
  and chest in its still poses and its reload (its butt plate is 22 cm deep, the soldier's armour rigid: from outside it
  reads as a stock pressed into the shoulder, nothing through); the USSO's stock end inside the right forearm pad on a
  jump's takeoff and a standing hop (hidden, and flickering 0 to 35 mm with a few millimetres of elbow: the audit's
  inside test at the pad's open edge); the reload's left fingertips 9 to 23 mm into the receiver at the magazine and the
  handle, seen only close.
- **Checked:** verify; rules; the e2e `skfigure` and `soldier` sections; the sheets above.

## Milestone 348 — Loading, then the mode's card, then the match: the ship waits for the card

The owner, 2026-09-29: "I want the ship to start way further back or at least don't make the ship start moving until we
already played the animation thing and loaded. and the animation screen gets played too often now, it should only play
once we loaded everything, the basic speed kills with the progress bar is all we want them to see whenever we are
loading things, then once thats done, then we put the animation specific screen up (depending on which mode they are
playing), then when that finishs playing, then we start the drop ship and / or other modes."

SpeedKills only (the legacy game keeps its card as it was, and its intro check with it).

- **Loading** (`loading.ts` waitFor, `main.ts`): SpeedKills opens on its loading screen alone, the bar and the tips.
  The intro card had stood in for it since Phase 20, holding on its rain until the world was in, which made it a card
  on every page load. The screen now waits for the world and for SpeedKills' late steps too (the bought guns dressed,
  the figures done, the first-person arms), the line saying "GETTING THE SOLDIERS AND GUNS READY" while it does, still
  gone by its 25 s limit whatever happens.
- **The mode's card** (`main.ts` cardPending): plays as a match starts, never over the loading screen: a match started
  while the page still loads (an invite link opened) has its card wait until the screen has gone.
- **The match waits for the card** (`duel.ts` LocalState.held, `bots.ts` BotMatch): while the card is up, or waiting
  to play, the player is not ready, and every friends', battle royale and mode match already waits for everyone to be
  ready before its countdown and its ship; the bot 1v1, which counted down from the moment it was made, holds its first
  countdown the same way. So the dropship does not start until the card has ended, for every friend in the match too,
  and a key that skips the card starts it at once.
- **Checked:** new sklobby checks on a drawn SpeedKills page with the card on: while it loads the loading screen and
  its bar and no card, none when it goes either; it goes by itself inside its limit; a battle royale plays its card with
  the match waiting under it, no countdown and no ship; once the card ends the match starts and you are on the ship.
  With the old order put back (the boot card, nothing held) three of them failed. The outline check of Milestone 345
  now waits for the bought soldier before its match (a figure made before it keeps its stand-in for the match, and on
  it the check measured nothing), and puts the rifle in the bot's hands itself (a bot 1v1 draws its gun at random).
  sklobby 29 of 29; speedkills 100 of 100 run alone (a first run under load failed two of the friends' ghost checks,
  which passed alone, as they have before); verify, rules.

## Milestone 349 — Centre Station: the pack's metro station under the south street, closed on every side

Phase 28.7, the underground (the owner, 2026-09-29: "focus on the center district and take screenshots from all
angles, right now the basement / lower floor is like see through and not how it should be, we want the full layout,
you need to study each piece and compare and see what and where you can put them together before fully doing it ...
watch the youtube videos that the packs offer").

- **Studied first.** The packs' eight trailers (the store's and Daelonik's pages list them: Neon City's five, Neon
  Buildings', Neon High City's, Neon Underground's) cut into frames every 5 s and looked at: an underground of arched
  station halls, platforms and trains, corridors, shops and a noodle bar, lifts, a shaft through every level; streets
  with walkways and bridges over them, fire stairs, signs on every front. The Underground pack's own demo scene
  (NeonUnderground00) read piece by piece off its file, 1,148 placed prefabs: a -10 m station with its glass-roofed
  street hall behind it, corridors, the square shaft through every level, a -24 m station with two lines under it. The
  96 underground pieces photographed whole and cut away (the importer's OBJ fix drew their floors and walls for the
  first time), their stairs measured: the pack's stairs join levels 3 m apart.
- **The station** (`tools/neon-layout.ts`, rules.underground), put together as the demo puts its -10 m station, each
  piece where the demo has it from the station's pivot: four 10 m platform modules along the south street at -10 m
  (the platform's floor), the tunnel mouth standing on the first as the demo's does (it has no platform floor of its
  own) and the buffer stop's end at the east, the pack's 35 m train at the platform, and the brick tunnel on west under
  the street to the ring, its rails in line with the station's (measured: theirs 3 m from its edge, the station's 8 m
  from its back), closed at its end.
- **Its way down**: the pack's glass-roofed hall on the south plaza behind the platform, its arcade at the street and
  its stairs down past a -4 m floor to a marble room at the platform's level, facing the arches in the platform's back,
  as the demo has it. Walked on foot from the street: the platform and concourse reached, 476 of 478 m2.
- **Closed on every side.** The first build showed the owner's fault again: arches in the platform's back and the
  marble room's opened onto nothing, the sky and the city through the ground. Behind the platform past the hall now runs
  a concourse of the pack's marble hall modules under its floor slabs (the modules have no roof of their own; in the
  demo they stand under the floors round them), every arch on its north side, the marble room's and both ends closed
  with the pack's plain hall cap (its other caps' doorways, which open onto corridors in the demo, looked out on
  nothing here), and the platform's west end closed. Its north wall lined with the pack's ticket and vending machines.
- The court and the station are not yet joined underground: the pack's 3 m stair room climbs through its own ceiling
  to a floor 3.5 m up, not the court's; the way from the court to the concourse is next.
- The map: 2,627 placements, 1.64 M triangles (from 1.49 M), 43,031 collision boxes. **Its files are version 8.**
- **Checked:** `sk-neon.ts` looks from every metre of the platform and concourse at eye height, eight ways along the
  ground and straight up: every look meets the station's walls within 60 m (377 spots; seen failing, 2,985 looks out
  on nothing, with the concourse's caps moved away), and counts the street's slabs over the station. verify and rules;
  e2e `loot` and `br`. The station photographed at night from the street, the hall, the platform, the concourse and the
  tunnel.

## Milestone 350 — A card that stands still no longer holds a match; the live check fails on a throw

Milestone 348's deploy printed LIVE CHECK PASS with its 1v1 never having started: after "the match went through our own
broker" a wait gave out and threw, and the verdict Milestone 337 had moved into the `finally` printed PASS over the
throw and exited 0. Run again with a `catch` that counts it (`live-check.ts`: "the check ran to its end"), it failed
honestly: the fight had not started in 60 s.

- **Why** (`main.ts`): the mode's card runs on the browser's animation frames, and a tab in the background gets none.
  The live check's guest is a background tab: its card stood still, its player was never ready, and the match waited
  for ever. A player who alt-tabbed as the card played would have held everyone the same way.
- **The fix:** a tab that goes into the background skips its card (nobody is watching it), and a card holds its match
  for `intro.json` matchHold (8 s) at the most from its start, whatever happens to it (the card is 1.85 s and settles for
  4 at the most). A card waiting for the loading screen is bounded by the screen's own 25 s.
- **Checked:** the live check against the dev server: the countdown ends once both are in, a hit lands, leaving ends it
  (its site-only asset count aside); the live site's run before the fix failed at the 60 s wait. sklobby 29 of 29
  (the match still waits under a card that plays); verify, rules; and the deploy's own live check.

## Milestone 351 — A bot with no gun goes for a gun first: the host migration flake found at its cause

The battle royale host migration check had failed about one run in two for weeks (docs/TEST_AUDIT.md item 3), with a
guess on 2026-09-25 that bots were not finding guns. Its own diagnostic, run four times on 2026-09-29, failed once:
six bots, three armed after a minute, the other three one squad, one of them an elite whose looting had given up.

- **Measured, not guessed** (a probe of real legacy battle royales, nine bots in trios, nobody firing, as the check
  runs them): 60 s of match time in, **26 of 36 bots** had a gun. The squad drop spots were not the reason: from every
  one, over four matches (108 spots), the third-nearest gun on the same floor was a median 14 m off, the furthest 54 m,
  and one spot in 108 had fewer than three within the 45 m a bot searches. Each unarmed bot's state said why instead:
  - **The ring.** At 60 s the first ring is already closing, and a bot outside the next circle is `urgent`, which put
    looting down outright: five of nine unarmed bots were running for the circle empty-handed, a gun 6 to 40 m off.
  - **The nearest thing first.** A bot took the nearest thing it wanted, gun or not. On the checks' rich floor it
    picked up a syringe, a battery, two frags and a helmet (a rummage each, 4 s for a normal bot) before its first gun,
    **29 s** in.
  - **Walls.** It walks to loot in a straight line, and a spot behind a wall held it against the wall for all of
    `giveUp` (10 s): one bot gave up six guns in its first minute, each 10 to 35 m off on its own floor.
  - Someone in its sights put looting down too, so an unarmed bot squared up to them and strafed with nothing to fire.
- **The fix** (`bots.ts` BotLooter.step and the bot's frame, `bots.json` loot):
  - With no gun, the nearest gun first, then the rest. Armed, the fittings come last (a better gun, a heal, a helmet
    or a frag, whichever is nearest): they fit the gun it has, and nearest-first they filled its kit to `enough`
    before it walked to a better gun across the room.
  - Hurried with no gun (the ring, or someone in sight), it still takes a gun within `hurrySearch` (25 m, a few
    seconds' detour at every tier's 3.6 to 6.6 m/s) and nothing else, and runs for it before the ring or the enemy.
    Armed, a hurry puts looting down as before.
  - A spot it comes no nearer to by `progress` (0.3 m) in `stuck` (2 s) is given up: a wall, not a walk.
- **After:** the same probe, **33 of 36** armed (8, 7, 9, 9 of 9), up from 26 (7, 5, 6, 8); the three left had no gun
  within reach of where they landed. On the rich floor the first gun is in hand at 4.4 s, the best one at 18.7 s, and
  its kit reaches `enough` at 29 s as before.
- **Checked:** new bot-sense checks in verify, each seen failing on the looter as it was (a gun in the first few
  seconds on a place, 29.1 s before; a gun first past a heal, a frag and a helmet nearer; hurried with no gun, a gun
  within hurrySearch and nothing else; nothing further than hurrySearch; a walled spot given up at 2.1 s where it took
  10); "and frags" on the rich floor is now "armed, it still picks up a frag near it" (the frags were only ever in the
  first 20 points by being nearest). The migrate section, three runs: four runs with the fix: all 19 checks in two; in the third the migration passed and the kit comparison failed on two bots that had each gone up an armour tier with the same gun while the takeover ran (it compared whole kits, armour included, one change allowed, and a bot goes on looting through the takeover: it now compares the guns, and fails on any gun or armour lost); the fourth, with that check, 19 of 19. Before the fix, one run in four stopped at "four bots armed" (3 of 6). verify, rules.

## Milestone 352 — A moment without the broker no longer ends a lobby or a Join

Milestone 337 left the "no match with that code" of the first Join after a deploy unexplained: two restarts did not
bring it back. The broker (PeerJS's server, ours on the game's server) queues an offer for an id it does not hold and
answers "expired" 5 s later, which is that message: for 5 s the host was not registered. So this looked at what a host
and a friend do when the broker goes for a moment, on the real server run here (`serve.mjs`, the built site, our own
broker), cutting the host page's broker socket at chosen moments.

- **What happened:** cut before the Join, the host's PeerJS came back and the offer waiting for it was delivered: fine.
  Cut 50 ms after the Join, mid-handshake: the friend got "Connection failed (webrtc)", and in one run in two the
  **host's** lobby ended with "No match with that code" on its own screen. On the build as it was: both 50 ms cuts
  failed that way (a 300 ms cut got through twice that time, and failed the run before).
- **Why** (`link.ts` hostMatch and joinMatch): until a friend was in, the host took every error as the end of its
  lobby, including one friend's handshake failing ("peer-unavailable", "webrtc") and the broker socket closing ("network"),
  which PeerJS was already reconnecting from. The reconnect went at once, against a server that may still be starting
  (a deploy), and failed again. PeerJS says "open" again after every reconnect, and each time the host treated the
  same code as new: the invite copied again, a handover's next step run twice. A friend's handshake that failed was
  reported at once, where a second try a moment later goes through.
- **The fix** (`net.json` broker): a host's lobby ends on a friend's failed handshake no more; after its code is out, a
  broker that goes is waited for, reconnecting every `retry` (1.5 s) and giving the lobby up only after `lost` (25 s)
  away with nobody in (the deploy's health wait allows 20); "open" is told once. A friend whose handshake fails
  ("peer-unavailable", "webrtc") tries once more after `retry` before saying so, so a code that is really wrong still
  says so, about 7 s later than it did.
- **After:** the same four cuts, 50 and 300 ms twice each: all four in, the 50 ms ones through the second try (2.1 s).
- **Not found:** why a host's broker socket would drop in the first seconds after a deploy. This makes the lobby and
  the friend ride over it whatever it is, and Milestone 337's live check still says when its first Join needed a
  second.
- **Checked:** new e2e checks in p2p (the broker cut 50 and 300 ms into a friend's Join, over the public broker):
  both passed over the public broker in the p2p section (47 checks, E2E PASS). The same cut, at the same moments, is the probe above: on the build as it was it failed both 50 ms cuts. verify, rules.

Milestones 351 and 352 were held on a branch for the owner's review and merged on 2026-09-30, rebased onto main
and run again first: verify, rules, migrate 19 of 19, p2p 47 of 47, br and loot 78 of 78.

## Milestone 353 — The bug hunt: the soldier photographed in the game itself, a melee that is a strike with the gun, and six faults found and fixed

The owner, 2026-09-30: "Go bug hunting and ensure we have everything working as expected. Get many pics of enemies and
third person and a alone frame by frame for the 2 guns and melee." SpeedKills' soldier, the USSO and BOOG. 27.12's
fifth round.

- **Photographed in the game, not only the lab** (`tools/live-shots.ts`, new): the lab steps one figure through set
  poses; the faults below were all in how the game itself drives a figure. Three parts: `enemies` (an Arena Bots match,
  each bot given the USSO or BOOG, followed by the camera as its AI moves, fights and reloads), `self` (your own soldier
  in third person, driven by the keys a player presses, from behind, the front and the side), `remote` (a second page
  joins an arena 1v1 over the local transport and is driven by keys; this page photographs the figure it draws of them).
  The lab gained `melee`, `throw`, `heal`, `strafe` and `runaim` sequences (`tools/figure-frames.ts`).
- **The melee was a boxer's punches** (the figures' clips): the gun vanished for each swing, the second swing threw the
  whole body half a metre out to the side, and the gun came back through both hands. It is now a strike with the gun,
  both hands on it (`rifle.ts`, `soldierhold.json` melee): driven out and back in the game's own melee time, the chest
  squaring into it; a jab, a sweep across and a jab up in turn, a string going on from one to the next.
- **A gun coming back into the hands went through them** (after a throw, a heal, a reach for something: 23 to 28 mm):
  shown the frame the act ended, while the hands were still on their way. The hands now go to where it will be and it
  shows once both are on it (`soldierhold.json` gunBack); the soldier's throw ends when the grenade has gone (`throwFor`,
  0.4 s), where its arms hung empty for the rest of the 0.7 s the act lasts on the wire.
- **Aimed on the move, the left hand was in the gun** (11 to 15 mm, both guns): the running clips lean the chest 20 cm
  forward, the arm came up short, and the hold slid a third of the way back to the grip. Every bot showed it, since bots
  aim as they run; the lab's run was unaimed and its aim stood still. The shoulder now reaches up to 34 degrees of the
  clavicle (`reach.shoulder`, it was 18), only as far as is needed; nothing slides.
- **SpeedKills' bots healed with cells and syringes**, which no player there has (health and shield come back on their
  own): a bot stood behind cover with its gun put away, holding nothing, for the four seconds of a heal (`bots.ts`). Off
  in SpeedKills; a hurt bot still takes cover while its shield comes back.
- **A swap replaced the whole figure**, your own in third person and every other player's: a figure of its own for each
  gun, the new one starting from its rest pose, its hands 2 to 6 cm off the new gun and 20 mm into it for the frame it
  changed. One gun for another is now the same figure taking the new gun in its hands (`main.ts` selfFigure, `duel.ts`
  setAvatarLook), as a bot's always was.
- **Looked at and left:** BOOG's butt plate pressed 2 to 4 cm into the rigid shoulder armour (hidden from outside, as
  before); about 0.3 s of empty hands between a throw's release and the gun showing again (shown sooner, the hands
  were through it); a far figure's hold is only worked out every few frames (the figures' level of detail), which the
  live sheets can read as a palm off its hold.
- **Checked:** `tools/checks/soldier-hold.ts` in verify (the soldier's melee swing is the game's melee time); the e2e
  `skfigure` section, eight new checks (aimed at a sprint the left hand on its hold; the melee a strike driven 18 cm out
  with both palms on the gun, and back; the gun away for a throw and back with no hand through it), seen failing with
  each fault put back (the shoulder's reach at 18, the gun shown early, the thrust taken out); the `sksquad`, `duel`,
  `speedkills` and `soldier` sections; verify; rules; the live sheets and the lab's.

## Milestone 354 — High City's roofs joined: a ring of the pack's bridges round the tower, walked island to island

Phase 28.7, the bridges (the owner, 2026-09-29: "focus on the center district and take screenshots from all angles ...
we want the full layout, you need to study each piece and compare and see what and where you can put them together
before fully doing it. your layout has been good so far, expand on it").

- **The ring.** Four bridges of the pack's floating deck (`PlatformBridge00_5x5`, 5 m cells, and its corner piece,
  turned so its open sides face both legs) join the four High City islands' roofs over the street crossings between
  them: north to east, east to south, south to west, west to north, 56 decks, a rooftop circuit round the tower at
  27 m. From the street each crossing has a lit V of deck overhead (`tools/neon-layout.ts`, rules.bridges; generated
  from four paths in `neonmap.json`).
- **How a bridge meets an island, studied before it was built.** The islands are the pack's round-lobed platforms,
  fenced all round with its crystal fence (the fence's parts read off the prefabs: arcs, straights from 1 to 5 m,
  pillars, the roof's floor at 26.0 m and the pillars' tops at 26.86). Three ways were built and measured:
  1. *The deck at the roof's height, ending at the fence.* A 0.85 m fence stood across each end, and the roofs' plan
     drawn from the collision showed every end meeting a lobe's arc on a slant.
  2. *The fence cut where the deck crosses it.* A 5 m deck never covers a lobe's arc (4.5 m radius, crossed on a
     slant): with the arcs whose middle was under the deck left out, the roof's edge opened beside the bridge (46 spots
     at one landing where a body walked off, 26 m over the street); with only the parts wholly under it left out, the
     arcs stood across the way and no bridge was walked. Backed out.
  3. *Nothing cut: the deck over the fence.* The decks ride at 26.9 m, 4 cm over the fence's pillars, so where a
     bridge crosses an island's fence the fence is inside the deck's own 2 m body and the island's edge stays closed
     all round. Each end runs a cell on into its island and steps down to the roof by the pack's small stair
     (`SmallStairs00c`, its ramp measured off its collision at 0.5 m of climb: the 0.83 m in its bounds is its side
     cheeks, so the deck is a 0.4 m step over its top, under a player's 0.56 m step). This is what shipped.
  The pack's own High City demo scene was read piece by piece for how it joins roofs (868 instances): it uses a
  different roof set (walled platforms and a 340 m decorative bridge), so the join here is our own.
- **Two jump pads moved, and why.** The pads onto the north and west islands from the inner street stood exactly where
  two bridge ends now land. The pad finder allowed a rail only within the first metre behind a roof's face, and along
  those islands' whole inner face the fence stands 1.5 m in: the old spot was the one place the face sat half a metre
  further back. That distance is now a rule (`rules.pads.edge`, 1.5 m); all eight pads are found again, six of them
  a few metres nearer their blocks' middles.
- The map: 2,684 placements, 1.69 M triangles (from 1.64 M), 44,636 collision boxes. **Its files are version 9.**
- **Checked** (`tools/checks/sk-neon.ts`, 16 new checks, four a bridge): each bridge walked on foot both ways from one
  island's named deck up its stair, across, down and onto the next island's named deck, a body an eighth of a metre
  at a time (a fence's top is no floor: let stand on it the body walked the fences round to anywhere); each stair
  climbed straight up its middle from roof to deck; and from every metre of a deck's middle a look to either side at
  the waist meets a rail, the corner's two outer sides among them. Seen failing: with the stairs left out, all eight
  climbs stopped at the roof and six of the eight walks failed (the other two got up by the deck's skirt, half a
  metre proud of its sides, round the outside of the rail: why the stair has a check of its own); with a corner
  turned a quarter wrong, each bridge reported its one open side. verify and rules. The ring photographed by day and
  by night from the air on four sides, from the street under each corner, along the deck, and at all eight landings.
- Not yet: the roofs reached on foot from the street (the pack's 30 m stair towers, Phase 28 step 3), the ring out to
  the tower itself, and the bots' graph over the bridges (the owner, 2026-09-29: "don't bother with the bot's pathing
  for now").

## Milestone 355 — The melee's jabs lead with the left shoulder, and the full sweep of both guns after the bug hunt

SpeedKills' soldier. The full sweep of Milestone 353's build (every sequence of the USSO and BOOG, close, from four
sides, `shots/figure-final`) flagged the new melee: the left hand up to 14 mm into the USSO and 24 mm into BOOG.

- **The cause, measured over the chest's turn:** the two jabs squared the chest into the strike (18 and 12 degrees),
  which took the left shoulder back; the arm came up short and the hold slid most of the way to the grip. Square-on or
  further side-on, nothing slides. The jabs now lead with the left shoulder (15 and 10 degrees further side-on), as a
  bayonet's thrust does; the sweep across still squares, since it turns the gun toward the left hand
  (`soldierhold.json` melee). Through all three swings no hold slides and no hand is more than 5 mm into either gun.
- **The sweep, frames faulted of those taken, after the bug hunt:** the USSO has none at rest, aimed, crouched,
  firing, running, running aimed, sprinting, strafing, throwing or healing (a heal is the legacy game's; SpeedKills
  has none). Still flagged on the USSO: the swap (92 of 104: BOOG's stock at the shoulder once it is in the hands, and
  four frames of the USSO passing the belly on its way down), the reload (64 of 112, the left fingertips at the
  receiver), the jump's takeoff and the standing hop (the stock's end in the right forearm pad, hidden), the melee (the
  same, during the sweep), the look's extremes and the slide. BOOG is clean running and sprinting; everywhere else its
  22 cm butt plate is 2 to 4 cm into the rigid shoulder armour, hidden from outside.
- **Checked:** the `skfigure` e2e checks every swing of a string, seen failing on both guns with the old chest turn put
  back; verify; rules; the melee sheets.

## Milestone 356 — The USSO's hands: the left palm and thumb along its side, the right fingers together

The owner, 2026-09-29: "THE THUMB AND THE PALM OF THE LEFT ARM ARE NOT EXACTLY FLUSH UP WITH THE USSO ON THE GUNS LEFT
SIDE, SEE THE GAP? TAKE SCREENSHOTS FOR IT, THE GAP IS OBVIOUS", and "for the right hands bottom two fingers, why is the
middle finger so separated from the bottom two? the 3 should be next to each other and then the pointer on the
trigger".

- **Seen and measured:** photographed at 3 times the owner's size, the left hand stood off the gun's left side with a
  dark gap between; the right middle fingertip stood apart from the ring and little fingers. The fit tools had asked only
  that the palm's nearest point touch (`pack-audit.js` palmGap): it did, 0.7 mm at one point of its heel, while a tenth
  of the palm's skin was 18.6 mm off and more and the thumb's nearest quarter 21 to 28 mm. The audit now gives every
  tested skin point's gap by bone (`gapList`).
- **The left hand** (`fparms.json` MPS5 hold l, `tools/pack-flush.ts`): a new search scores how much of a bone's skin
  lies on the gun (the palm's nearest tenth, the thumb's nearest quarter), placing the palm and thumb first with only
  their own depth counted, then `tools/pack-solve.ts joints` laying the fingers back on the gun, a finishing pass with
  every bone counted and the solver again, and the hand eased 0.7 mm out (the palm pressed 3.9 mm into the gun's side,
  and 4.1 turned by a first draw's flourish). The palm's nearest tenth is now 10.9 mm off, its nearest twentieth 7.2,
  the thumb's quarter 3 to 6 mm; every finger on the gun and no skin more than 4 mm in it.
- **The pickup** (`fprig.ts` mixFit, hold `pick`): the pickup's clip carries the gun where the flush hand was out of the
  arm's reach, and it came back 10 mm into the gun (the frame sheets flagged 64 to 76% of it); a hold may now carry its
  own fit for a pickup, blended back into the hold as the pickup lets go. The USSO's is its hold from before, clean there.
- **The right hand** (MPS5 hold r joints middle_01, middle_02): the middle finger turned down beside the ring finger, its
  fingertip 24.9 mm from the ring's where it was 36.4, the ring's 25 from the little finger's; all three on the grip, the
  forefinger on the trigger.
- **Found by the frame sheets on the way:** BOOG's left wrist bent 61 degrees at 92 to 94% of the inspect, as its open
  hand went back to the gun (Milestone 330's elbow, 14 cm down; the e2e's samples at 90 and 96% had missed it): 10 cm
  down, 57 there and 43 held. And a first draw's flourish rolled the USSO's newly turned left wrist to 62: its roll 0.36
  from 0.42.
- **Checked:** close-ups before and after; the frame sheets of every state on both guns, no frame flagged; new soldier
  e2e checks, the left palm's nearest tenth within 13 mm and the thumb's quarter within 9, and the right middle finger's
  gap to the ring within a quarter of the ring's to the little finger, each seen failing with the old holds back (with
  Milestone 346's near plane check in the same run). Milestone 346's other check, the gun's middle, did not fail with
  its fault back: it drew the gun again by giving the slot a new one, which builds the model afresh, so it never drew a
  gun still carrying its last throw. It now swaps to the other slot and back as a player does, where the fault measures
  the USSO's middle 78 cm off and BOOG's 70, and is seen failing there. The soldier section; verify; rules.

## Milestone 357 — The court joined to Centre Station underground, and the court's corners closed

Phase 28.7, the underground (the owner, 2026-09-29: "right now the basement / lower floor is like see through and not
how it should be, we want the full layout, you need to study each piece and compare and see what and where you can put
them together before fully doing it").

- **The way down.** A door in the tower's court, in its south wall, onto one of the pack's vaulted metro corridors on
  the court's floor (7 m down), and from its end a ramp down to the station's level (10 m down) and in through a
  framed gate behind the marble room's first arch. A player walks from the court to the platform without going up to
  the street (`tools/neon-layout.ts`, rules.underground.link).
- **Studied before it was built.** The parked first try (Milestone 349) used the pack's stair room, whose stairs climb
  3.5 m like all the pack's stairs and escalators (measured again here: `MetroPassageLow05`'s escalators, the stair
  rooms), and the court's floor stands 3 m over the station's, so its head met a wall. The pack's low corridor set
  was photographed whole: its "vertical tunnel" pieces are round shafts, not stairs. Its terrain set has a plain
  sloped slab that climbs exactly 3 m in 5 (`CityTerrain_Base_ramp3x5x5`, its four corners read off its mesh), which
  is what joins the two here. The marble room's north wall was read off the hall's parts: its arches stand on the
  court's own 5 m lines (the first 5.5 to 9.5 m along), so the station's caps are now laid on those lines too, the
  gate straight down the corridor's middle line; and the station was moved 2 m north (its platform's back at 28 m) so
  the run from the court's wall to the gate is exactly one 5 m corridor and one 5 m ramp.
- **Seen leaking, and closed.** The ramp's room was photographed from every face and corner in daylight, where the
  sky shows through anything open:
  1. walled first with the court's own wall, a slot of sky at a corner: the court's wall is a raised panel whose face
     steps back its whole thickness at both ends (read off its mesh), so two at a right angle leave a 0.45 m opening.
     The room is walled in the pack's plain 3 m room wall instead, its plaster side in;
  2. the wall over the gate set a hair behind the cap's face left a slit at the corners and along the roof: it now
     stands from the cap's top, and each top row laps the one under it a hair in front, never behind;
  3. the corridor's side walls are open at their ends and its vault stands clear of a square room's corners: a jamb
     stands before each, and the wall hangs from the roof to the jambs, the arch a 4 by 3 m doorway from this side.
- **The court's corners, open since it was built.** The same photographs showed the same slot in all four of the
  court's own corners, the haze and the sky through them, 7 m tall. Each is now closed with a post of the pack's
  half-metre room wall standing just outside the corner, its top a hair under the plaza (rules.court.post).
- The map: 2,711 placements (from 2,684), 1.69 M triangles, 44,734 collision boxes. **Its files are version 10.**
- **Checked** (`tools/checks/sk-neon.ts`): a player's own movement sprints from the court through the door, down the
  ramp and through the gate into the marble room, on the station's floor, and back up into the court (seen failing
  first from a start inside the tower's basement wall, which stands 2.5 m in front of that stretch of the court's
  wall); the station's closed check now looks from every metre of the ramp too, eight ways and up (405 spots). verify
  and rules; e2e `loot` and `br`. The link and the court's corners photographed by day from inside and out.

## Milestone 358 — The court's east and west halls: a noodle bar and an electronics shop under the plaza

Phase 28.7, the underground (the owner, 2026-09-29: "we want the full layout ... your layout has been good so far,
expand on it").

- **The two dead ends.** The tower court's east and west halls were 5 m stubs of corridor ending in a concrete wall.
  Each is now 10 m of the pack's shop corridor: its vaulted corridor with a room off one side behind arched doorways
  and a counter window. East, a noodle bar (`MetroPassage00D3`: red neon sign, lanterns, a counter with stools, tables
  inside); west, an electronics shop (`MetroPassage00D2`: a neon shop sign, walls of screens, shelves along an aisle),
  facing the corridor's poster wall.
- **Placed by their pivots.** The hall code now places every piece by its pivot, its corridor across its own x from 0
  to the door's width (the plain corridors land exactly where they did); a shop corridor's side room stands out beyond
  that, and its floor is lowered to the court's and the street's slab laid over it like the station's floors. A first
  try put the pivot at the hall's near end for halls running toward -z and -x, which would have moved the north hall
  10 m: caught comparing the court's placements before and after, which now change only in the two halls.
- **Chosen by walking into them.** Each candidate was baked and a body walked in from its hall, an eighth of a metre
  at a time, a square round the player's round one: the pack's market (`MetroPassage00E2`, a room each side) reached
  36% and 18% of its rooms' floor (its shop's aisles narrower than a player, its bar packed with tables), `D4` 40%, and
  `D2` all of its aisle. At the map's half-metre collision the noodle bar's stools, bins and signs each filled a cell
  and only 45% of it was reached; its two corridors now collide at a quarter metre (rules.fine), 85%.
- The map: 2,713 placements, 1.73 M triangles (from 1.69 M), 45,592 collision boxes. **Its files are version 11.**
- **Checked** (`tools/checks/sk-neon.ts`): each hall's side rooms walked into from its middle, 60% and more of their
  floor with a standing body's room over it reached, and the street over them holds a body (seen failing with the
  market and `D4` above); the halls' own walks to their far walls, now 10 m. verify and rules; e2e `loot` and `br`.
  Both photographed in daylight from the halls, the doorways and inside, their roofs closed.

## Milestone 359 — SpeedKills' way into a match: the loading screen, the ship boarded under it, the card, then the ship

The owner, 2026-09-30, of the order Milestone 349 left: "the intro now is fucked up, like it loads the map, then the
animation matrix, then it shows our gun while it like loads the map again or something with black background, then we
are in the ship ... you can't test the full end to end flow with screenshots capturing frames every like 5% to tell?"

- **Seen frame by frame first** (`tools/flow-frames.ts`, new). A drawn page with every painted frame kept (Chrome's
  screencast) and, every 100 ms, what the game was doing, laid out as a sheet of a frame every 5% of the way: Start froze the menu on the screen for
  a second (the match being built), the card played over the range with WAITING FOR EVERYONE TO CLICK PLAY behind it,
  broke into the range and the gun, then one frame of the gun on black and a stall, then the ship. With the city's
  real files in, that stall was **6.8 s**: every shader of the Neon City map compiled the moment it was first drawn,
  from the ship.
- **The city warmed under the page's own loading screen.** Its side is compiled with three's `compileAsync` (off the
  page's thread where the browser can) with the side shown and the range's hidden, so the lights counted are the ones
  it is drawn with, and its 600 textures sent to the GPU forty a frame; the screen waits for it. Measured on the ship:
  the worst frame 6,829 ms before, 504 to 551 ms after (and that under the match's loading screen now).
- **A match's way in** (`show` in main.ts, `show` in intro.json): Start puts the loading screen up at once and builds
  the match two frames and 80 ms later, so the screen is on the monitor through the build; it counts the match's own
  files (the bought guns' textures for the loot and the bots); a battle royale then starts under it, you are put on
  the ship and the **ship waits at its start** (`LocalState.shipHeld`, brmatch.ts `holdShip`: its clock and each bot's
  jump moved on with the wait) until its frames are steady; the card **cuts in** over the screen (no fade, which had
  shown the screen's words through it), the screen comes down under it, the card breaks into the ship, and only then
  does the ship set off. Other modes: the screen, then the card over a match held as before. The boarding notice is
  said when the card has gone. Esc over the screen puts it aside while the menu is open; a friend's match waiting for
  the others says so on its line; a hidden tab skips the whole of it.
- **Two faults on the way.** The card's still drew its name at full strength (`globalAlpha` set, not multiplied), so a
  cut-in card flashed its name and faded it before the name smashed in. And SpeedKills put its own hour up again as a
  battle royale started, fetching the sky once more and retaking the roads' reflection, six renders of the city, on the
  match's first frames: skipped when the hour is the one already up.
- **Checked** (e2e `sklobby`, skIntroTest, the page drawn with the ship on): Start puts the screen up before the match
  is built; from Start to the card the screen is up in every 30 ms sample; the card starts with you aboard and the match
  counting down; the ship's clock is held with the card (its start moved on 5.1 to 5.9 s over a card of 6.1 to 7.0 s);
  after it the doors' count runs. Each seen failing with its fault put back (the hold off: moved on 0.00 s; the card
  before boarding and no screen at Start: four checks fail). e2e `intro` and `skship`, verify and rules. The flow sheet
  after: loading screen, menu, loading screen, card, ship, no other frame between.

## Milestone 360 — The centre's streets curve: the Loop round the tower and eight S-bends out to the edge road

Phase 28.8, the master plan's first phase (the plan: https://claude.ai/artifact/Pa1VbqmLBvytX2gBVvK9fP; the owner,
2026-09-30: "since the outer districts are straight roads, we should make the ones in the center district be not
straight, have them curve left and right along with buildings so that it's different visually", and "it's ok to wipe
what we had before if the new plan doesn't suit it").

- **Studied first.** Before this phase every category of the packs was re-photographed on current contact sheets (87
  sheets, 1,826 pieces), the eight trailers read again for how their pieces join, all eight demo scenes read piece by
  piece and drawn by height (10,113 pieces), and Hyper Scape's design rules gathered. The result is the master plan:
  the centre level by level from the station to the High City decks, every join between levels, the build order.
- **The streets** (`tools/neon-streets.ts`, rules.streets.curves). The centre's straight 3 by 3 grid is gone. A round
  road, the Loop, circles the tower 45 m out, and from four forks on it eight streets wind out in an S (a pair of Hermite
  curves each, no bend under 21 m radius) to the same eight points on the edge road where the outer districts' straight
  roads go on. Where two streets meet the kerb turns a rounded corner: the roads are one surface joined by a smooth
  minimum 4 m wide.
- **Their surface** is baked from the same curves (`tools/import-neon.ts`): the pack's asphalt, traced along its edge
  half a metre at a time (8,300 triangles), mapped as the ground's tiles are so it meets the edge road's asphalt
  without a seam. Along it the kerbs (632, traced along the edge, rounded corners too), the dashed centre lines, the
  lamps, parked cars, flying cars and signs are all laid along the curves and turned with them.
- **The blocks follow the streets.** The High City decks moved 10 m out, their inner faces on the Loop's pavement, and
  lost their back rows of small towers (no room against the edge road; they were backdrop). Each corner block now has
  a flatiron building in the wedge where its two streets leave their fork, turned to face the junction on the
  diagonal; a row of buildings down each of its streets, each turned to face its street where it stands (squared to
  the grid near the edge road, where the curve's tilt put a corner over its pavement); its rooms building in its
  outer corner; and yards between. The bridge ring moved out with the decks, so each end lands where it did.
- **Beacons and pads** follow: the respawn beacons half way along four of the streets, and the jump pads onto the decks'
  inner faces sought from the Loop's middle (all eight found again).
- The map: 2,675 placements, 1.84 M triangles (from 1.73 M), 45,908 collision boxes. **Its files are version 12.**
- **Checked** (`tools/checks/sk-neon.ts`, 4 new checks): each of the eight streets bends one way and then the other
  (seen failing with one straightened: "ne-n 0"); each meets the edge road on its outer road's line, heading along it;
  nothing taller than a parked car stands on the centre's roads (5,848 m2 of road, seen failing with a building on one);
  each corner block is built along its curves. The rooms buildings are walked into and up where they now stand, every
  bridge walked from deck to deck, the pads ridden. verify and rules; e2e `loot` and `br`. Photographed from above and
  at street level on the Loop, a fork and a curved street.
- Next (the plan's phase 2): the Sky Ring, the walkway storey at 3.5 m, its footbridges and the walkways out to the
  rooms buildings' first floors.

## Milestone 361 — The soldier's reload is the first person's, its fingers on the trigger and a tenth smaller, BOOG by its rail, a flip on the double jump, and a pistol for PULSAR

SpeedKills' soldier and roster, from the owner's look at the USSO and BOOG (2026-09-30): "there should be an
animation for when we double jump for sure, the boogs 3rd person still has the hand grabbing the magazine instead of
the had stop/rail", "trigger finger should be on the trigger, not in the ready position", "remove the pulsar, no need
for a fast marksman, just call it marksman now in all the references of it, then add the pistol to replace it", and
"the first and third person final forms agree with each others animations and movements when they reload for the
boog and the usso. It's critical to have the agents on the same page with it before we move on".

- **The reload, one timeline for both views.** The soldier's reload is laid on the first person's, read at run time
  from the guns agent's fparms.json (reload: point, phaseOut, phaseIn, seat, rack, rackBlend, slide, lead, follow, and
  slideIn and rackOut when present; guns; packGuns.<gun>.rack), so the two cannot part (rifle.ts reloadPlanOf). The
  gun turns its magazine toward the left hand as the hand leaves the fore-end and points at it (index out, the rest
  curled, the thumb tucked); the magazine slides `slide` down its own length and phases out with the first person's
  own sweep (phase.ts, gunfeel.json phase, run on this figure's magazine alone), a new one phases in and seats with a
  kick; then the USSO's left hand racks the charging handle on the MPS5's grab shares, and BOOG's left goes back to the
  fore-end while its right works the bolt over the L96X clip's bolt (0.68 to 0.86 of the reload). The magazine is
  never dropped and nothing comes from a pouch: the soldier used to pull it, drop a copy to the floor and fetch a new
  one from the hip, which the first person never did. The two agents agreed the timeline over messages, and the guns
  agent's slideIn (the new magazine phases in seated, built from the well down: the owner's "the reverse order", which
  on screen came from the rise) and rackOut (BOOG's bolt hands back over 0.86 to 0.98) are read as they land.
- **The trigger finger on the trigger:** tools/figure-fit.ts searches the right index's joints and swing onto the
  bought model's Trigger part (anywhere on its front face, tools/figure-audit.js __triggerGap). The USSO's index is 0.1
  mm from it, BOOG's 0.1 (BOOG's right hand 1 cm further up its grip, where the index reaches the trigger's loop).
- **The fingers a tenth smaller** (soldierhold.json fingerSize 0.9, each finger scaled about its root, the figure's
  alone). Half size, first asked, could not hold the guns: the index stopped 17 mm short of BOOG's trigger from any grip
  it could close round, and the left hands shut into fists beside the fore-ends; thinned to half their thickness at 0.8
  of their length instead, the owner saw them "gucked up" and asked for 90%. All four hands fitted again round them
  (the USSO drawn 1.05 times its model, where its fingers close inside its guard; 1.1 before).
- **BOOG by its rail:** the left hand on the rail under the fore-end at its rear end, 22.5 cm in front of the grip, not
  the magazine. At the rail's middle the arm fell short at rest and the hold slid back 19%, and aimed on the move 54%
  onto the magazine; there, with BOOG's shoulder let reach 70 degrees (the shared 34 slid 44% aimed at a sprint), it
  does not slide at rest, aimed, looking up or down, running or sprinting aimed, or through a melee.
- **A double jump is a front flip** (figure.json doubleJump: 360 degrees in 0.5 s, eased, round the hips, the legs
  tucked; SpeedKills' double jump rises 0.39 s): the player's count of them (player.ts airJumps) goes to the figure
  and over the network as `dj` (net/state.ts, the last optional key, so an older build ignores it). Only an explicit
  count: found from the figure's height, a wall run's start, a climb's end boost and a zipline's pop flipped it too.
- **The roster:** PULSAR (g2) is out and HAEFY is plain Marksman. HAMMER (a working name) is the legacy Wingman tuned
  to Hyper Scape's Riot One: its 26 against Hyper Scape's 120 health is five body hits, which against our 150 is 32.5
  (Wingman 50 x 0.65), six rounds, a quarter of the kick, 1.5 to the head, no drop-off, 2.8 shots a second; 1.79 s to
  kill at 80% on target, fused the same. It wears the pack's second pistol (SciFiPistol02_2, measured into
  paidmodels.json, aimed down its own dot). The defaults: Marksman is HAEFY and PANDA, Skirmisher STRYDER and HAMMER;
  the bots and the Gulag carry HAMMER where they carried PULSAR. On the soldier HAMMER has the clips' own pistol hold
  until its turn in PLAN_SOLDIER_EIGHT_GUNS.md.
- **Checked:** the skfigure e2e (44: the trigger finger on both guns, every finger at 0.9, BOOG's hold on the rail, the
  reload against fparms.json at its beats, never dropped, a double jump's flip), each new check seen failing with its
  fault put back; net-delta (the count through a keyframe, a difference and a full packet, seen failing without it);
  the TTK check; paid-weapons (a gun is over 0.22 m: the launcher's round is 0.18, the pistol 0.254); the speedkills and
  sklobby e2e (128); verify; rules; the frame sheets of every sequence and the live sheets.

## Milestone 362 — The Sky Ring: a walkway round the tower's plaza at a first floor's height

Phase 28.8, the master plan's second phase (https://claude.ai/artifact/Pa1VbqmLBvytX2gBVvK9fP).

- **The ring** (rules.skyring). A walkway 4 m wide at 3.5 m (a realistic building's first floor) round the tower's
  plaza, from 37.5 to 41.5 m out: over the plaza's edge and the Loop's inner lane, 2.7 m of headroom under it. Its deck is
  baked as a true circle of the pack's floor slab (tools/import-neon.ts, tools/neon-streets.ts ringSlab), worn as the
  pack's FloorBasic00 wears its faces: paving on top, brick edges, plaster underneath. Measured first: the pack's High
  City walkway pieces are 2 m deep (1.5 m of headroom under a 3.5 m deck), and its straight slabs round a circle leave a
  gap at every joint.
- **Its fence and stairs.** The pack's elegant glass fence along both edges, a 2.5 m length on each chord (its hex panels
  glow green at night), left open where the stairs arrive; the pack's double stair up from the plaza on each axis,
  measured to climb 3.42 m to the 3.5 m deck. The Loop's lamps no longer stand under it or at a stair's foot.
- **Moved from the plan, and why.** The plan had the ring over the Loop's outer pavement; the High City decks stand
  there now, so it rings the plaza inside the Loop instead, clear of the jump pads. The walkways from it to the rooms
  buildings are dropped (those buildings stand in the blocks' far corners now). The footbridges out to the decks come
  with the glass lifts.
- **Found by the checks.** At the map's half-metre collision the stair's last step onto the deck measured 0.65 m, over a
  player's 0.56 m step, and the deck's inner edge stood over its last tread: the stair and the deck are measured at a
  quarter metre (rules.fine) now.
- **Next, from the owner's note:** the tower becomes the main fight space, many floors of big rooms and stairs, each
  floor laid out differently (open to dense), so the centre is worth fighting in. The tower has real floors at 0 to 14 m
  and 38.5 to 49 m and nothing between; six new floors go there.
- The map: 2,869 placements, 1.87 M triangles, 49,015 collision boxes. **Its files are version 13.**
- **Checked** (`tools/checks/sk-neon.ts`, 3 new checks): walked up each stair from the plaza onto the deck and round the
  whole of it, all 248 m and all four stairs' tops (seen failing with the stairs set a metre short); railed along both
  edges from every metre but the stairs' openings (seen failing with the outer fence left off: 248 open); a standing
  body's room under it all the way round (seen failing with a 2 m deep slab: 1.5 m). verify and rules; e2e `loot` and
  `br`. Photographed on the deck by day and night, from the Loop, under it and at a stair.

## Milestone 363 — A double jump lifts the knees and a turn in it leaves a tracer, and a sniper glints only when scoped in

The owner, after Milestone 361: "honest I don't like the flip for double jump. People will double jump all the time
and that's hard to hit I assume. Can we just have the legs raise a bit at the same time as the double jump, so there's
something there? And then a tracer if they changed directions in the middle of the jump", and "remember that the
sniper should only have glint when they are ADSing".

- **The knee lift in place of the flip** (figure.json doubleJump: the thighs up 25 degrees and the knees bent 40 more,
  up and back down over 0.35 s, the body upright): the knee comes up about 11 cm, 25 degrees and 40 chosen over 35 and
  50, whose knee reached the USSO's low magazine. The thighs and calves join the bones put back from the clip each
  frame. The flip's root turn is gone.
- **The tracer** (trails.ts, hud.json jumpTracers): from a player's double jump, for up to 0.6 s of air time, the way
  they go (over the last 0.1 s) is held against the way they went over the 0.2 s before it; 25 degrees apart, and a
  ribbon of their trail's light, 0.1 m across at the body's middle, is drawn from before the jump through the turn and
  fades over 0.8 s. A double jump only gives the jump back and the turn is air control over the tenths after it, so a
  window of a fixed 0.15 s after the jump missed it. It fades out within 3 to 6 m of you, not the trails' 12 to 25:
  it is for seeing a turn in a fight. Seen by the figure's double-jump count, which Milestone 361 already sends.
- **A sniper's glint only while scoped in** (mannequin.ts scoped): the aim in, the gun up at the eye, the hands on
  nothing else (a reload, a swap, a throw, a strike), not carried low. By the pose's aim alone, a bot aiming as it
  reloaded glinted through the reload, and one aiming through a swap through the swap.
- **Checked:** the skfigure e2e (the knees up 6 cm or more and back, upright, none for a count first seen; BOOG's
  glint aimed in and not through a reload, a swap or at the hip), each seen failing with its fault put back; the
  trails check (a turn at once and one made over the air time draw a tracer, straight on and a count first seen draw
  none, it fades in its time), seen failing with the turn test broken; the soldier section's own glint check; the
  frames of the double jumps; a tracer drawn in the game's own scene, 12 m off; verify; rules.

## Milestone 364 — The bug hunt: every mode played by a scripted player, and what it found

The owner, 2026-09-30: "go on a bug hunt across all functionality game wise to ensure we don't have any bugs hidden
that we are missing now".

- **The hunt** (`tools/hunt.ts`, new): one drawn SpeedKills page plays every mode in turn (the range with all ten guns,
  a battle royale from the ship to its end, the 1v1 against bots, Gun Run, team deathmatch, Crown, Control,
  free-for-all, Search, the Run, the tour, the lab, the arena), driven by a scripted player that aims, fires, closes in,
  strafes, jumps, slides, swaps, uses its hacks and picks up. A watchdog in the page notes page and console errors,
  failed requests, NaN or fallen-through positions, health out of range, NaN in the HUD, frames over 120 ms (with the
  shaders, textures and geometry new on them), and battle royale bots standing still 25 s. Between modes it records what
  the page holds, lists assets fetched twice, and takes a screenshot every 5 s. Beside it, the full e2e sweep, now with
  `sklobby`, `sksquad`, `skfigure` and the new `skhunt` in its batches (they were missing from it).
- **Bots standing still for the rest of a match** (brmatch.ts). A bot's node was chosen by (x, z) alone. One that came
  down in the court took the deck 18 m over it and stood under it for good: it stops 1.5 m off a node's (x, z) and
  arrives only on the node's floor. 4 of 28 bots stood still 20 s and more in one match. Now a landed bot takes the
  nearest node on its own floor with links (`nearestNode` with its height). One that finds itself under or over its node
  for 2 s re-anchors the same way (`unstick`, bots.json `unstick`). After: one bot of 28 still in a match, and that one
  was shooting at the probe's invincible player. On the curved streets (map version 13, merged the same day) bots still stood still now
  and then: against walls the layout moved (two of two squads wedged together at map-local (-37, 18), 1 m up, sent to
  the maps agent) or down in the court with their node up on the street. A second check, re-anchoring any bot that
  made no metre in 8 s on its own route, was tried and taken out: squads of bots held together in 14 to 28 samples of
  35 to 40 with it, where they hold in 36 to 40 of 40 without (a lead turned loose walked its followers apart). The
  owner set pathing to minimal effort until the map is done.
- **Bots inside care packages.** A lured bot walked onto the crate's middle and stood inside it for the whole 45 s
  contest. Two bots of two squads did, each blind to the other half a metre away. Now it stands 4 m off on its own side
  (br.json `podStand`), and once the crate is down and the bot is there, its looting and fighting take over (`podsDone`).
- **The Gulag's first frame froze 0.75 s** (10 shaders compiled on it). The boot warm-up now compiles everything out of
  view as the range's side draws it, not only the city: the freeze is gone.
- **The music at nothing still streamed.** The city's loop played through every match at volume 0. Now it is not fetched
  or played until the slider is above nothing, and a slider moved up mid-match starts it (audio.ts `syncLoop`).
- **The soldier's body fetched twice.** It was loaded on its own and again for the first figure that asked, seven
  textures and two copies held. Now it loads once (mannequin.ts through `loadBody`).
- **A flaky check.** The soldier section waited a fixed 600 ms for the USSO's level-5 skin. A frame drawn in software
  took 643 ms alone, so it failed under load. It now waits for the change, 10 s at the most.
- **Found and handed on.** The Neon City's bot graph is in 757 islands. The court, the halls, the metro and the roof
  decks are joined neither to each other nor to the street, so a bot that walks into the court has no way out on the
  graph. Sent to the maps agent. The owner set pathing to minimal effort today ("just stick on the street"), so the
  bot-side re-anchoring above is the fix for now.
- **Looked at and fine.** No page errors in any mode. Nothing leaks across the 13 runs: geometries, textures and
  programs are flat after the first battle royale. Two friends in two browsers over the real broker get the loading
  screen, the card together and their ships off in step. Search's spectator watching a still defender is the defender
  holding its site. A bot match starting again after its end is by design.
- **Known, not fixed.** The killcam's first frame is 0.25 to 0.8 s: its figures are built on the spot (170 ms) and first
  drawn. The match's build takes about 1 s, now under the loading screen.
- **The sweep itself.** One wait that timed out (a 1v1's countdown, Gun Run with a friend) threw out of its section and
  took every section after it in the batch with it: each section now runs in its own `section()`, a throw failing
  that section alone. The recap's "the bot eliminates you" waited 30 s of real time, 10 s of the game on a machine at
  94% (other agents' test browsers beside it): it waits 25 s of the game's own time now.
- **Checked** (e2e `skhunt`, new, on the Neon City's graph): a landed bot takes the node on its own floor, not the deck
  over it; one stood under its node re-anchors after 2 s and not before; a lured bot stands 4 m off a care package and
  is then done with it; the body texture is fetched once; the city's loop is off at nothing and plays once the slider is
  up. All five were seen failing with their faults put back. The full sweep and `npm run fit`: every failure in it
  (the recap chain, three bot-tier timings, the ship's shut doors, the squad's downed figure and its box, a lossy
  friend's speed) was a timing under the machine's load and passed run alone. Verify and rules.

## Milestone 365 — The base: the tower's wide lower floors

Phase 28.8, from the owner's note on the centre (2026-09-30): "I want the building to be big and wide on the first x
amount of floors, it can be more narrow the higher it goes, only using the assets we have".

- **The block.** A block round the tower's foot filling the plaza inside the Loop to a few metres short of the Sky Ring
  and its stairs: its outer faces at x 25 and z 30.5 either way, its corners cut (rules.base). Three storeys of the
  tower's own 3.5 m (0, 3.5 and 7 m, the storeys of the tower's lower block, so its floors run on into the tower's)
  and a roof terrace at 10.5 m where the tower's lower block ends. Outside the tower's own footprint that is 980 m2 of
  floor on the ground storey, 740 on the first (the atria over the metro), 1,040 on the second and 1,250 on the roof.
- **Built from the tower's own pieces.** Faced with the tower's window wall a 5 m bay at a time (turned as the tower
  turns them, measured off the tower), the pack's wide gate for its doors, its plain pillar at each corner, the
  pack's glass rail round the roof and every hole. Gluing whole buildings side by side was the other way: their outer
  walls would have stood back to back inside, with no way through and facades that do not match.
- **Its floors measured against what stands there.** Each storey's slab is baked (tools/neon-base.ts) from the base's
  outline in to whatever already stands at that height, measured off its triangles a quarter metre at a time: the
  tower's lower block is a different shape on every storey, and the base's floors meet each one and run on into the
  tower's own floors where they are open. The slab is tucked a cell under what it meets, 3 mm low, so no crack shows.
- **Doors and stairs.** 14 doors in the ground floor's faces and four in the first floor's cut corners, the latter
  onto short bridges to the Sky Ring, whose inner fence is left open where they meet. 12 of the pack's double stairs,
  four between each pair of storeys, placed so each storey's stairs up are away from its stairs down: you cross the
  floor to climb on.
- **Different on every storey.** The ground floor a concourse with shop units along its north and south faces, each
  open to it through the pack's wide gate; the first floor offices, two rows of rooms either side of a corridor with
  doorways through to their neighbours; the second floor a warehouse hall of pillars and the pack's racks in aisles;
  the roof the pack's cooling boxes. Every storey strewn with the pack's crates, barrels and furniture as cover, none
  within reach of a stair, a door or an atrium, and lit by the pack's ceiling lamp on a 7.5 m grid.
- **The plaza's pieces inside it.** The metro's two kiosks and the station's glass hall now stand on the ground floor,
  the floor over each one's raised middle left open as an atrium railed round (the kiosks' tall "U" signs are left
  out: they stood through the floor above). The court round the tower's foot is roofed by the ground floor: a basement
  now, still walked to through the kiosks and from the station.
- **Found by the checks.** The pack's double stair, on the collision's quarter-metre grid, leaves its lower flight 1.0
  m clear between its cheeks: room for the player's round 0.82 m body but not for the flood's square on its own grid,
  so the stairs are walked by the player's own movement instead. Three ground doors opened straight onto a kiosk or
  the glass hall and two stairs stood under the tower's east bay: all moved. The rails at a stair's top stand back 0.4 m
  from its flight.
- The map: 2.17 million triangles, the base about 300 thousand of them (its pieces 164 thousand, its floors 137 thousand); its files lo 76 MB, hi 133 MB, max 329 MB. **Its files are version 14.**
- **Checked** (`tools/checks/sk-neon.ts`, 4 new checks, 3 changed): every stair walked up and back down by a player,
  all 12 (seen failing with the first floor's stair wells left closed: 8 of 12); every storey and the roof walked to from
  the plaza over 98% of its floor and more; every door walked through from outside, all 18 (seen failing with the doors
  walled up: 0 of 18); every bridge walked across from the Sky Ring, all 4 (seen failing with their decks left out: 0 of
  4). The court is dropped into from under the ground floor now, the halls' plaza holds a body where the base's walls
  stand over it, and the Sky Ring's inner fence may be open at a bridge. verify and rules; e2e `loot` and `br`.
  Photographed on every storey by day and night and from outside.
- **Next:** the tower's floors over the base, many floors of big rooms and stairs, each laid out differently, the
  owner's first note on the centre; their stair core runs up from the base's ground floor.

## Milestone 366 — A reload from empty and a tactical one told apart, the trigger at the finger's crease, and the soldier's swap phased as the first person's

The owner, after Milestone 363: "don't forget we need a reload differentiator for empty mag vs still 1 in the chamber
(mag not empty on reload) for most guns. We don't have that right now", and "fix the frame by frame stuff as well, then
the trigger finger should be more through the hold and still touching the trigger. right now its like the very finger
tip is the only thing that can press the trigger, visually".

- **Which reload it is** (weapon-state.ts `reloadEmpty`): set as a reload begins, from the magazine (empty: the clip at
  0 as the key or a dry trigger starts it). A bow's next arrow is never one. It goes out as its own act code, 9 (1 stays
  the tactical reload: an older page reads 9 as no act and only misses that one reload), and comes in as the figure's
  `reloadEmpty` (dummy.ts actCode, emptyReloadOf; duel.ts; main.ts for your own figure).
- **The figure's reload by it** (mannequin.ts, rifle.ts `tacticalOf`, `reloadPlanOf(id, tactical)`): from empty, the
  whole first-person timeline (the point, the magazine out and in, the seat, the rack or the bolt) over the gun's empty
  reload time; a tactical one over its tactical time. When the guns agent's fparms.json has `reload.tactical` (rack
  false, `back`: the hand's way back to the fore-end), the tactical one is its own plan, the empty one's beats in
  seconds, ending before the rack, with no rack or bolt, as the first person plays it; until then it is the whole one
  over the shorter time, as the first person also plays it today. Tried with the guns agent's pending numbers in
  place: the tactical reload ran point, magazine out and in, hold, done in its 1.8 s (USSO) and 3 s (BOOG), never a
  rack or bolt key.
- **Bots** reload only when the magazine runs out, so always from empty, and now for the empty reload's time
  (bots.ts BotMag), as a player emptying a magazine takes. The bot-fire check's player held the trigger through a
  reload of the tactical time, which no player gets from an empty magazine; it now takes the empty one's, and a bot
  fires 0.97 to 1.00 of what that player does over 20 s.
- **A host's bots, to its guests** (brmatch.ts): their state packets sent the place and nothing of the hands. A guest's
  figure of a bot now reloads, heals and aims in as the host's does, its look's pitch with it.
- **The trigger at the crease** (soldierhold.json fingers, figure-audit.js `__triggerGap`): what touches the trigger's
  front face is now measured as the skin round the index finger's last joint, not its tip. BOOG's finger had only its
  tip on the trigger, the crease 18.5 mm off it; now 0.1 mm, the finger through the guard and round the trigger. The
  USSO's crease was already 1.6 mm off; its finger now curls 15 degrees further through the guard (0.3 mm).
- **The swap phased as the first person's** (mannequin.ts gunSweep; gunfeel.json guns.<id>.swap, the first person's
  own shares): the gun going away phases out over its holster, along it from the muzzle back, its magazine with it,
  and the one coming phases in from its stock over its draw. The new gun appeared whole in the hands at the swap's
  middle: a jump in the frames, and not what your own view shows.
- **Frame by frame** (tools/figure-solve.ts, its reload stage now on the page's own plan of the empty reload):
  - the USSO's left hand at the point, its cost 273 to 28: the wrist bent 88 degrees at worst, now 49;
  - BOOG's right hand on its bolt (bolt 427 to 355, boltUp 318 to 144, boltBack 184 to 161);
  - BOOG's rest pocket and elbows (261 to 235);
  - the swap's lowered carry: the USSO's magazine went 40 mm into the belly, now clear; BOOG's stock 25 mm into the
    chest, now 16.
- **Tools:** figure-frames.ts films the reload from empty and the tactical one as two sequences; figure-solve.ts measures
  the air carry 0.15 s into a sprint jump too.
- **Checked:**
  - the skfigure e2e, 48 checks:
    - the tactical reload over its own time, with no rack or bolt where the first person has its own;
    - the trigger at the crease within 4 mm;
    - the swap's phase out and in, the magazine with the gun;
  - the squad e2e: a bot reloading on the host is seen reloading from empty on the guest's screen;
  - each check above seen failing with its fault put back (a figure that ignores which reload it is, BOOG's old finger
    at 18.5 mm, the bot packet without its act, the new gun shown whole);
  - net-delta (act code 9 round trip) and bot-fire (seen failing with the bots' old reload);
  - the frames of both reloads, the swaps and the jumps;
  - verify; rules.
- **Left for the next pass, measured:**
  - the USSO's left hand 12 to 23 mm into the receiver at its charging handle, its fingers off the handle;
  - BOOG's right hand 17 to 30 mm into the receiver at the bolt;
  - BOOG's long stock into the right arm and chest through its reload and its sprint jumps (up to 40 mm, mostly hidden
    by the arm itself), as before this milestone.

## Milestone 367 — The reload's hands have fingers of their own at the charging handle and the bolt

The owner's "ensuring each frame is perfect", after Milestone 366: the first of what it left.

- **A reload key's own fingers** (rifle.ts closeFingers; soldierhold.json reload.keys.<key>.fingers): a key may carry
  a finger table, as the hold's, blended in as the hand goes to it and out as it leaves. The point's stays
  `pointFingers`. With the hold's alone, the USSO's left hand racked its charging handle with its fingers still laid
  for the fore-end, the index and middle fingers 25 mm off the gun.
- **Searched onto the gun** (tools/figure-solve.ts `KEYFINGERS=1`: the key's place, its turn and its fingers together,
  each of that hand's fingers costed by its gap past 6 mm):
  - the USSO's handle 113 to 68, handleBack 159 to 100, the left fingers now within 0 to 6 mm of the gun;
  - BOOG's bolt 356 to 321, boltUp 225 to 197, boltBack 185 to 166.
- **Tried and not kept:** an elbow of its own for the lowered carries, searched for BOOG in the air (275 to 270): its
  stock is through the right forearm at the wrist, just behind the grip where the stock's comb rises, which no elbow
  clears. The code went back out.
- **Tools:** figure-hands.ts `STEP` photographs a moment of a pose (a reload's key), not only 0.8 s into it.
- **Checked:**
  - the skfigure e2e, 49 checks, its new one: at the USSO's charging handle each left finger is within 6 mm of the gun.
    Seen failing with the handle's own fingers taken out (the middle finger 11 mm off);
  - the frames of both reloads;
  - verify; rules.
- **Still measured, for the next pass:**
  - the USSO's left palm 12 to 22 mm into the receiver at the handle;
  - BOOG's right hand up to 28 mm into it at the bolt;
  - BOOG's stock into the right forearm in a sprint jump (32 mm).

## Milestone 368 — The tower's floors: a stair core to the top and eight floors to fight on

Phase 28.8, the owner's note on the centre (2026-09-30): "in this big center building I want it to be many floors of big
rooms and staircases and some walls partitioning the floor off, differs each floor. Some should have no or little walls,
some should have a lot of walls". The tower had floors at 0 to 14 m and 38.5 to 45.5 m and nothing between, and none of
them above the ground could be reached on foot.

- **A stair core to the top** (rules.tower.core, tools/neon-tower.ts). A core up the middle of the tower's main body from
  the lobby to its top storey: 15 storeys, the lobby, the lower block's two, the glass waist at 10.5 m, the eight new
  floors and the three sky floors, a doorway onto each. Inside, a switchback a storey: a landing, a flight up one half, a
  half landing, a flight back, a wall between. Where it passes through the pack's own floors and walls they are cut to its
  box exactly, their triangles clipped (a new leave-out, `*|`): a 10 m floor tile straddles the core, and left whole it
  stood across the stairwell, left out it left a 10 m hole.
- **Eight new floors** from 14 to 35 m, on the facade's own 3 m storeys, 364 m2 each. Each is the inside of the tower's
  shell at that storey, measured off its triangles (a flood from inside, so its round corners and the grooves down its
  faces come out as they stand), less the core. The shell's "fake" pieces, faced only toward the street, are drawn from
  inside too: before, the floors looked straight out through the corners and grooves. Four slits a storey beside the
  north and south grooves, a body's width of sky between a window wall and the groove, are closed with the pack's wall.
- **Each floor different.** Partitions run from the core's corners out to the faces, opened at their core end: two open
  floors (14 and 26 m) with cover only, two of eight rooms (17 and 29), two of three halls joined by the pack's wide gates
  (20 and 35), two mazes, the rooms with their corners parted again (23 and 32). Each strewn with the pack's crates,
  barrels, tables, racks and machines as cover, and lit by its ceiling lamp.
- **Found by the checks.** A lobby arch stood a metre before the core's west door, and a pillar's face lay on the core's
  wall (the cut now goes 2 cm past it); the base's floors filled the core's box at 3.5 and 7 m (nothing of the tower stood
  there after the cut); the core's north wall was walked through (a wall one collision cell thick, its faces on the
  cells' edges, left the cell between them empty: each wall now has a plane down its middle); a 3.5 m storey's longer wall
  between the flights stood 1.5 m over the half landing below; the landings were too thick for a head coming down; the
  halls had no gates (the walls were laid two slots at a time from the face end); doorways at the face end were crowded
  shut by the grooves; and the check's own flood dropped through walls from the sky floors' balconies, so it now drops only
  down a clear column.
- The map: 2.39 million triangles, about 220 thousand more than version 14 (the core and the new floors 69 thousand, their walls, cover and lamps 124 thousand, the shell drawn from inside the rest); its files lo 81 MB, hi 138 MB, max 334 MB. **Its files are version 15.**
- **Checked** (`tools/checks/sk-neon.ts`, 5 new checks): the core walked from the lobby to the top and back down by a
  player, 100 legs each way (seen failing with metre-high steps: 2 of 100); every storey it serves walked to from the plaza,
  and the new floors over 94% of their floor and more (seen failing with the core's doors onto them closed: 0 m2 of each);
  each the inside of the shell, the same on every storey; and sealed, the bake's 696 level rays from all over each floor at
  eye height every one meeting a wall (seen failing with the shell's back faces left off: 12 a floor got out). verify and
  rules; e2e `loot` and `br`. Photographed on every floor, in the core and at its lobby door.
- **Next:** glass lifts from the base's roof and the Sky Ring to the tower's floors (the master plan's next phase), and
  loot on the new floors.

## Milestone 369 — The range's armory: the ten guns and the ten hacks on the back wall, each with its screen, taken and fused at its stand

The owner, 2026-09-30: "We need the back end of the firing range to show the 10 guns with some futuristic way of
displaying them. Look up how Hyperscape had theirs, we want to show all hacks and guns in that similar style ... use
paid assets, make them look similar to the hacks we inspect, allow them to fusion together to upgrade the guns in the
range. Make each hack and gun have a tv behind it showing details on the gun, what it is, how to fuse ... Same for
hacks. This replaced the legacy weapon ammo types we have before", and of where: "the wall behind where the user do
send in st, where the runs are at".

- **Hyper Scape's:** its training room had every gun and every hack out to try; its loot stood as a hologram turning
  over the floor, its hacks on amber cards (our hack card, hackcast.ts, is drawn from them). So a stand here is the
  pack's own weapon case, open, with the gun (or the hack's core) turning in a column of light over it and a card
  over that, and a screen on the wall behind.
- **Where** (armory.ts places, armory.json): the back wall's runs between the Run gates, at z 6.4 (the wall's face is
  at 8). The guns left of THE CHAIN's gate, the hacks right of it; the run nearest the middle filled first (seven a
  side), the last three past the outer gates. 2.4 m apart, so seven fill the 17.5 m between two gates with 0.35 m
  spare and the 2.2 m screens clear the gates' lit posts and the middle gate's sign. At 2.5 m the end screens stood
  over the posts.
- **The stands:** SciFiWeaponCase01_2 at 0.82, its Cover open (paidweapons.json props armorygun, armoryhack): white
  (skin A) under a gun, black (skin B) under a hack, so the two runs read as one set. The flat storage case was tried
  for the hacks first and read as an open laptop. A gun's hologram is its floor model in its bought skin at the level
  you carry it (the skin changes at 2 and 4, as in your hands); a hack's is its core in its slot's colour.
- **The screens** (a canvas each, 896 px across 2.2 m by 1.6 m, drawn again only when what it shows changes: your
  level, your slot, your keys, the font coming in):
  - a gun's: its name, class and use; whether it is in your hands and at what level, as pips; damage, headshot, fire
    rate, magazine, reload and time to kill at your level and at the next, what changes in green; what level 5 adds
    in all; and a lit band along the foot saying what E does here now and that a second copy in a match fuses the same;
  - a hack's: its name, slot and key; whether your slot holds it, another, or nothing; what it does; its cooldown at
    each level with yours lit; and the band: take it, fuse it, another of its slot swaps it, its core in a match.
  - First drawn at 24 px type with a table of each fusion level, the rows came out about 5 px tall on a 720-line
    screen from where E reaches: the game's field of view is wide, and a 2.24 m screen 4 m off spanned 200 px. Now
    38 px rows (about 12 px there), fewer words, and the cards lowered so their top stays under the line from a
    1.5 m eye to the screen's foot.
- **Taking and fusing** (main.ts takeFromArmory, armorySay): E (or a pad's X) at the stand you face within 2.2 m is
  applyLoot with a level 0 copy, as one off a match's floor: the gun you carry fuses a level up, to 5; a new one fills
  an empty slot or takes the place of the one in your hand. A hack goes into its slot; the same one fuses, to 4;
  another of its slot swaps it. The prompt says which (lootcard.ts gunOutcome, hackOutcome): TAKE HAEFY FOR USSO,
  FUSE HAEFY · LEVEL 0 TO 1, HAEFY IS AT LEVEL 5, ITS TOP.
- **Solid** (armory.json solid, armory.ts armorySolids, range.ts buildRange's `solids`): each case is a box on the range's
  solids, built with the range whether or not the stands are drawn (a ?norender page builds no stands, but you collide
  the same). Its size MEASURED off the loaded case as it stands, its cover open (`__range.armory()` stands[].box):
  1.224 m across, 0.970 m to the cover's top, 0.342 m in front of the stand's middle to 0.531 m behind. Before, you
  walked through the cases and stood in the hologram.
- **Out of SpeedKills' range** (range.ts): the legacy racks by ammo type, the ammo boxes and crates beside them, and
  the yard clutter along that wall. The legacy range keeps them.
- **Tools:** `__range.armory()` (each stand, what its screen was last drawn for, its hologram's skin) and
  `__range.prompt()` (the prompt under the crosshair outside a match's own); a scripted E reaches the stands.
- **Checked:**
  - the new skarmory e2e, 5 checks: the twenty stands in armory.json's order, the guns left and the hacks right, every
    screen clear of the gates, each on its case with its hologram and screen drawn; every case's box within 3 cm of
    armory.json's solid and on the range's solids, and walking into one stops you at its face; at a gun's stand the
    prompt offers
    it and E takes it; E fuses it 1 to 5 and no further, its stand drawn again at each level and its skin changed;
    a hack taken into its slot and fused 1 to 4 and no further. Seen failing with the stands 2.5 m apart (the end
    screens over the gates' posts), with a gun's screen keyed without its level (never drawn again), with no case
    solids (you walked through to the wall, z 7.59 against the face's 6.06), and with a case size typed by eye (0.5 m
    tall: you stepped up onto it and walked over);
  - the speedkills e2e section with it (104 checks); verify; rules;
  - photographed from the spawn, at a gun's stand, a hack's, and the outer runs.

## Milestone 370 — Loot on every floor of the tower

The centre's loot went on any floor at a spot at random, so with the base and the tower's 19 storeys over the plaza the
tower's eight new floors held half an item each a match (measured over five matches' seeds), and the court under the
base 28: nothing to climb for in the part of the map built to be fought over.

- **Each tower floor stocked.** Every floor the stair core serves over the lobby (3.5 to 45.5 m, 14 of them) is a hall's
  for the loot now (src/game/neonmap.ts, the old city's podium halls' rule, loot.json halls): six spots of its own a
  match at the small sites' tier, about eight items, and the field's own loot kept off it. Over the map that is 1,180
  items a match, about 120 more, all in the tower.
- **Only on a floor.** A hall's spot is now taken only where there is floor under it (src/game/loot.ts): the tower's
  floors stop at the grooves down its faces, and a spot there hung in the air. The old city's halls are floored wall to
  wall, so they draw what they drew.
- **Checked** (`tools/checks/sk-neon.ts`): loot on every floor of the tower over its lobby, 5 items and more each (6 to 10
  a floor; seen failing with the floors left off the halls: 0 to 3). verify and rules; e2e `loot` and `br`.

## Milestone 371 — The soldier's swap in place, as the first person's cup, and which reload a player made checked between two pages

The owner, to the guns agent, of the first person's swap (2026-09-30): "keep the hands where they are while the weapon
phases / disintegrates from the outside going in and gets replaced by the new weapon ... then the new weapon should
materialize from the inside out", the hands closing round it "like the streetfighter haduken". The guns agent is
landing that as fparms.json swap style "cup", with a radial phase in phase.ts. The figure others see follows it, so the
two views agree, as the reload does.

- **The swap in place** (rifle.ts SWAP_CUP, mannequin.ts cupSwap; soldierhold.json swapCup): when the first person's
  style is the cup, the figure's swap has no lowered carry. The gun stays up in the hold while it phases out and the
  next phases in. Each hand comes off its hold and turns its palm toward the gun's middle, its fingers bent toward a
  fist, on the first person's own shares of the swap (fparms.json swap.cup: off, back, carry, moveAt, shape, turn,
  curl). In the second half the hands go from the last gun's cup to the next one's. The moves are the figure's own,
  searched over both swaps' moments: the right hand 10 cm out (the most before its wrist bends past 60 degrees), the
  left 6 cm down. Where phase.ts has the radial phase, the figure's runs out from the gun's edges in and the next from its
  middle out, its magazine with it. Until the guns agent's push, main's style is "throw" and the figure keeps the
  lowered carry it had.
- **The frames judge the gun as drawn** (figure-audit.js): a point of the gun ahead of its phase's front is not drawn,
  so it no longer counts as a hand in the gun or the gun in the body. A cup's hands report a `cup` key, as a reload's
  do, so a hand off its hold on purpose is not flagged.
- **Which reload a player made, between two pages** (tools/e2e.ts duel, p2p): the guest reloads from empty and then
  with half a magazine; the host must see the first as a reload from empty (act code 9) and the second as the
  tactical one. Seen failing with the local player's act sent without the flag.
- **Tools:** live-shots.ts films another player's tactical reload and one from empty; figure-solve.ts `START=` begins
  a search from given numbers.
- **Checked:**
  - the skfigure e2e, 50 checks, with main's fparms.json and with the guns agent's pending cup in place: in place
    (the gun up, both hands cupped through the middle, back on BOOG's holds after), or lowered when not the cup. Seen
    failing with the figure's cup switched off;
  - the duel and p2p e2e sections (the p2p's rejoin test passed on its rerun alone; the duel's two jitter-smoothness
    checks failed twice with the machine at 97% CPU and passed in the run between);
  - the frames of both swaps with the cup on;
  - verify; rules.
- **Left, measured:** with the cup, the right hand 14 mm into BOOG's grip for a moment as it leaves it and as it comes
  back, and BOOG's stock 22 mm into the outstretched right arm as BOOG builds.

## Milestone 372 — The sprint's carry fitted through the stride, and the soldier's full frame sweep for a new day

The day's sweep of the soldier's frames (tools/figure-frames.ts, both guns, every sequence, front and right, close),
against the last day's:
- **Flagged frames:** 757 to 702, with a new sequence of 68 (the tactical reload); like for like, 634.
- **Better:** the USSO's reload (42 to 18), its double hop (25 to 4), BOOG's melee (82 to 54), its rest (12 to 2), its
  throw (20 to 2) and its heal (6 to 0).
- **Worse:** BOOG's run (6 to 14) and sprint (14 to 20), whose carry Milestone 366 had fitted at one moment of the stride.

- **The sprint's carry measured through the stride** (tools/figure-solve.ts lowered): four moments of a sprint's stride
  and two of a run's, not one settled moment. Searched so for BOOG, its own `lowered` 199 to 193:
  - the gun turned 17 degrees down, 2.5 left and rolled 5.5;
  - its left hand kept where it held the gun. A search that could move the hand slid it 6 cm along the gun and the palm
    11 mm off it, which the search's cost did not see.
- **BOOG, after it:** run 14 to 6 flagged frames, sprint 20 to 4 (two frames still put the stock 35 mm into the right
  forearm), jump 40 to 34, double jump 68 to 58.
- **The USSO:** its carry searched the same way, 105 to 66, no frame of it flagged before or after; its left hand 1 mm
  into the gun, from 3.
- **Checked:** the skfigure e2e (50); the frames of every moving sequence of both guns; verify; rules.
- **Left, measured:** BOOG's hops and jumps still put its long stock 20 to 40 mm into the chest and the right forearm
  while the body tucks, mostly hidden by that arm. A carry's own elbow was tried for it at Milestone 367 and does not
  clear it.
