# Plan: the legacy game out, the play menu round the battle royale

The owner, 2026-10-04: "remove all legacy stuff except the tv, remove the grenades, we need the abilities to load at
startup bc of the range, rest can be removed or wait, then hide the rest of the modes other than battle royale (make
that the main obvious mode), then we want firing range underneath it, then one button saying "Extra modes" and we click
that and the others appear and can select from there. we want them in the firing range or the BR. Also, it should be
defaulted to what we have it defaulted to now, but have an option saying "Adjust settings" on the right side that when
clicked shows the same as what we have today. Yep ensure we remove the old tests. Can we keep the readme and stuff in
the TV but have it lazy load, like only load it all when the user interacts with it?"

Read as: SpeedKills is the game. Everything only the legacy game (B00G FPS) uses goes, with its tests. Kept: the TV
(its text loaded only when someone uses it), the abilities (the range needs them from the start), and the extra modes,
played on the Firing Range or the battle royale's city instead of the old arenas.

Each step is its own milestone: built, checked (tsc, verify, rules, the e2e sections it touches), documented, shipped,
then the next. Who owns what: the new-stuff agent (apex-lobby) does the steps below; the old city's files are the city
agent's (apex-city) and the legacy guns' data the guns agent's (apex-soldier), each asked before their part goes.

## 1. The play menu

- The battle royale first, big, the obvious way in; the Firing Range under it; one **Extra modes** button that opens
  the rest (1v1, Arena Bots, Free-for-all, Team Deathmatch, Control, the tour, the lab, the two Runs). A pick among
  the extras keeps them open next visit.
- The right-hand panel: the mode, its line, Start and With friends, and the loadout, with today's defaults. An
  **Adjust settings** button there opens today's options (squad, bots, difficulty, the hacks and the rest) in place.
- Nothing about the defaults changes.

## 2. The TV loads its text when used

- The range's screen shows a cover (THE MANUAL, shoot an arrow to open) until someone shoots it; the text is a
  separate file fetched then (a dynamic import, its own chunk), so the first screen no longer carries it. Today the
  page carries the 150 KB README for the legacy game and the 5.5 KB manual for SpeedKills.

## 3. No grenades

- Frags, arc stars and thermite: the throws, their loot, the HUD's count and wheel, the bots' throws, their messages on
  the wire, their sounds and config, and their tests. SpeedKills carries none (G is its utility hack), so nothing a
  SpeedKills player has changes; what goes is code loaded and stepped for nothing.
- The two carried charges (shockwave, rift) go with them unless a hack uses their flight; checked before cutting.

## 4. The legacy game

Done so far: no supply bins (475), no death boxes (476), no grenades (481), the legacy-only modes (485), Resurgence
(486), the e2e on SpeedKills (494), the abilities and kits (491). What is left, surveyed 2026-10-04, one milestone each
(the new-stuff agent's numbers are 494 to 499, the guns agent having taken 490, 492 and 493 on 2026-10-09; each takes the next number as it starts, the heaviest in SpeedKills' first script first):

- **494, the e2e on SpeedKills (done).** The e2e pages run the legacy game unless told otherwise (`e2e.ts` E2E_GAME); 28
  sections do, many of them on shared systems (the network, host migration, the killcam, the recap, the controller,
  the lobby, the arena modes, the range's tools, the Gulag). The default becomes SpeedKills with no change to the
  game, and every check is sorted: one that passes is a SpeedKills test from now on; one that tests the legacy game
  alone names it (`game=legacy`) and goes with its code.
- **497, the Node checks on SpeedKills (done).** Outside a browser the game is SpeedKills now (game.ts buildDefault):
  verify and movesim run as the game people play. Each of the 148 checks that failed so was sorted: the legacy game's
  own numbers went (Apex's movement constants and timings, the old guns' stats, mag levels, attachments, the bleed-out),
  shared physics was pointed at SpeedKills' own config, and the legacy battle royale's whole files (loot tiers, the
  ring's circles) run as the legacy game in a process of their own until their code goes. It found one SpeedKills bug,
  the custom rules handing out guns the game does not have.
- **498, the shared e2e tests on SpeedKills (done).** Nine of the tests 494 left pinned test systems SpeedKills shares
  (the network, jitter and loss, the bots and their tiers, the killcam and recap, the range's tools, the jump pads):
  they run on SpeedKills now. 21 tests of the legacy game alone stay pinned until their code goes.
- **499, the battle royale with friends tested on SpeedKills (done).** Six more pinned tests (an arena mode with a
  friend, bot squads, solo with a friend, split squads, a battle royale's host migration, a squad of two) run on
  SpeedKills, and found three SpeedKills bugs: a ghost left with only opponents up, legacy guns on the city's floor,
  and a forged hit naming no gun that the host let through. 11 tests of the legacy game alone stay pinned.
- **520, the game switch (done).** `game=legacy` and legacy.json gone, the 11 pinned tests with them, and the two Node
  checks that ran as the legacy game (loot-tiers.ts, the Outskirts' loot; ring-place.ts, the ring SpeedKills never
  draws).
- **The owner, 2026-10-09: retire all of it.** "i am fine with retiring all old apex-range stuff, don't break speed
  hack. can remove old guns and old abilities that we don't use." Next: the game switch (`game=legacy` gone, IS_SK
  folded), after the city agent's old-city removal lands; then the dead code below, the 18 old guns with it (the guns
  agent asked for that), the knockdowns with the character agent taking the figure's downed side.
- **Later, the UI's crumbs:** the `legacyOnly` controls, the legacy tour's steps, the README branch of the screen (the
  TV and the manual stay), the legacy intro card and tips, the cross-game join message. About 300 lines.
- **491, abilities and kits (done)** (JOLT, TRIAGE, MEDIC, SCOUT, HOOK, SMOKE, WARD): SpeedKills turns them off and runs its
  hacks, which load at startup for the range and stay, with what they borrow (walls.ts and the ward's numbers,
  reveal.ts, healarea.ts, DASH's look and sound). About 1,600 lines.
- **Later, attachments, mag levels and hop-ups;** SpeedKills keeps one fixed optic per gun and fusion. About 350 lines.
- **524, the battle royale's side rules (done):** the keycard vault and its guard, the Ring Consoles, Storm Surge and
  the loadout crate, each switched off in SpeedKills by its own guard. About 1,260 lines.
- **526, the legacy floor (done):** ammo, attachment, hop-up, helmet and knockdown-shield loot, the floor's spot kinds
  and single-item roll, the walk-over sweep, the bots' looting of them. About 920 lines.
- **527, armour, helmets and EVO (done):** kit.ts Armor, the shield levels and helmets, giveEvo and all it paid,
  the HUD's EVO bar. About 210 lines.
- **523, the heal items, the heal wheel and the backpacks (done):** the player's kit, the bots' item heals, the
  floor's heals and backpacks, the walk-over's small heals and the recap's "healed recently". The battle royale's ammo
  limit stays the white pack's. The figure's heal pose and its act codes are the character agent's (told). Armour and
  EVO go with the loot below.
- **Later, the Outskirts map** (br.ts's builder, its scenery and about 15 MB of its assets); the shared types stay.
  About 3,050 lines.
- **Later, knockdowns, bleed-out, revives, finishers, the knockdown shield** (SpeedKills has none: `noKnocks`). The
  Gulag, the echo restore and the figure's death fall stay. About 1,000 lines; the character agent told first.
- **521, the legacy guns (done):** fifteen of the data's guns, the Nemesis and the Bocek, with their models, sounds
  lists, loot, mechanics entries and checks; the R-301 goes with 522.
- **522, the attachments, magazine levels, hop-ups and fire modes, the old guns' mechanics and the R-301 (done).**
  SpeedKills keeps each gun's fixed optic, fusion, the L-STAR's heat and the shotguns' blast patterns.
- **Next:** the Outskirts map, then the match side of the
  knockdowns (the character agent takes the figure's).
- **As each piece goes, its `IS_SK` branches fold** (the switch itself went first, 520: `IS_SK` is a constant now, so
  every `!IS_SK` branch is dead code; the SpeedKills storage keys are kept, so nobody loses a setting).
- **The legacy guns' data** (18 guns not in SpeedKills' roster): the new-stuff agent's now (the guns agent asked,
  2026-10-09), once the guns agent's packFrames reads its field of view from the settings rather than off the old
  R-301. The old ILranch city went with the city agent's 507.

About 9,500 to 10,000 lines of code, 1,500 of config and 5,000 of tests in all, and about 15 MB of assets.


## 5. The extra modes on the range or the city

- 1v1, Arena Bots, Free-for-all, Team Deathmatch and Control played on the Firing Range or the Neon City (its
  spawns, its bounds, bots that stay on the streets) instead of the Warehouse, the Crossing and the Ringworks, which
  then go. The Gulag's room is checked first: SpeedKills still uses it.

## 6. With the other agents

- The old city (High City corner solids, citykit.json, buildCityMap, its dressing; about 430 KB): the city agent,
  once nothing of SpeedKills reads it.
- The legacy guns' data (about 230 KB): the guns agent, once the legacy game is gone.

## What it buys

Measured before and after each step and written in its milestone: the first script's size, the first screen, the
start of a battle royale, and the frame's CPU. The old city and the legacy guns are the big ones for the download;
the grenades and the legacy branches are per frame and at startup.
