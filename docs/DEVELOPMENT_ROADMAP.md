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

