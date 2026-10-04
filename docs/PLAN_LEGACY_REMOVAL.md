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

- The `game=legacy` profile and every branch that only it takes (`IS_SK` false): its modes (Walk the arena, Gun Run,
  Crown, Search), Resurgence, the Outskirts map, its loot (ammo, attachments, hop-ups, helmets, backpacks, knockdown
  shields, heal items, EVO armour), its HUD paths, its menu options, and its tests.
- The abilities stay, loaded at startup.
- The README stays in the repo, and on the TV only if the owner wants it there beside the manual.

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
