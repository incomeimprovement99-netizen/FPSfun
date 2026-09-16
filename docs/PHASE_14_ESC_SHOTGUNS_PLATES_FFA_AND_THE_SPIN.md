# Phase 14 results: Esc, the shotguns, the plates, free-for-all, and the spin

The plan is `PHASE_14_PLAN_ESC_SHOTGUNS_PLATES_FFA_AND_THE_SPIN.md`. Everything
in it shipped; the roadmap has milestones 39 to 43.

## What is in the game now

**Esc on the menu is Resume.** The game's own menus close on Esc; ours needed
a click. Esc now takes the button's path (read the settings, take the mouse
back). Not while a key is being rebound (that capture eats Esc first), and
Esc in a text field leaves the field instead. Chrome refuses a pointer lock
for about a second after the Esc that let the mouse go, which is exactly when
this is pressed, so a refused one is retried quietly once the second is up,
unless the menu was clicked meanwhile.

**The shotguns fire the game's blast patterns.** The Mastiff's horizontal line
of five, the EVA-8's figure 8, the Peacekeeper's star of nine, the
Mozambique's triangle, the Triple Take's three in a row, sized by the data's
own `blast_pattern_default_scale`, tightened to `blast_pattern_ads_scale` when
aimed where the gun has one (the Mastiff and the Mozambique halve), closed by
the choke, at `blast_pattern_zero_distance`. The spread stat deviates the
whole blast once a pull, so the shape holds. A pull's pellets read as one
damage number: a full Mastiff blast says 95, not five 19s.

**An enemy's plate shows only after a hit, and only in sight.** For 6 s from
the last time you hurt them, and only while your eye has a clear line to
their chest through the level, so a bar never gives away someone behind
cover. A team mate's green plate always shows. Numbers in `hud.json`.

**Free-for-all.** Everyone for themselves in the arena, you and up to five
bots (the Play tab's bot count; with friends, everyone who joins plus the
bots). Respawns 4 s after going down at the spot farthest from any enemy;
first to 20 kills, or the most at 10 minutes, the fewest deaths on a tie,
level on both a draw. The board is kills and deaths; the win is yours alone.

**The mannequin's upper body holds still.** Bots' and players' figures had
whipped their torso, head and arms round in endless loops while the legs
stayed sane. Fixed at the cause (below).

## The spin: how it was found

Three probes, run against a bot match with no drawing.

| Probe | What it measured | Before | After |
|---|---|---|---|
| Every named bone's local rotation, 60 samples over 6.3 s | which parts turn most | `spine_01` turned **2,600 degrees**, steps of up to 142 degrees a sample; `lowerarm_r` 954; the pelvis 251. The robot figure: nothing above the pelvis moved at all. | — |
| World-space yaw of the pelvis, chest, head and the hands' positions, every 50 ms | is it a local artifact or a real flail | the pelvis turned smoothly with the figure; the chest and head swung the full circle every few frames; the hands jumped 0.4 m with them | — |
| The pose forced by wrapping `setPose`: `moveDir` 0 or 0.6, speed 0 or 6, pitch 0 or 40 | isolate the leg turn from the look pitch | still with a 40-degree look: the chest turned **280 degrees** in 1.5 s and the head 330; walking with pitch 0: the chest 45 | still with a 40-degree look: the chest and head **0 degrees**; walking: within 3 |

The third probe ruled out the leg turn (forcing `moveDir` to 0 changed
nothing) and the planted turn (`plantedTurn` read 0 throughout), and pointed at
anything applied every frame: the look pitch, the head's ADS tilt, a flinch.

**The cause.** three's `AnimationMixer` writes a bone only when the clip's
value has changed since the last frame (`PropertyMixer.apply`: "value has
changed -> update scene graph"). The legs play loops, so their bones are
rewritten every frame. The upper body plays a held aim pose, so after the
first frame the mixer never wrote `spine_01..03` or the head again, and every
frame's `turnBone` piled onto the last frame's. A steep look pitch spun the
chest end over end within a second; a strafe whipped it by the leg
counter-turn every frame. It had been there since the mannequin arrived in
**Phase 11** (commit 7c0f4ca, where `turnBone` was written), through every
round since, and the figure lab's stills could not show it: a still lab figure
with pitch 0 has nothing to accumulate but the head's 0.1 rad ADS tilt, which
a screenshot does not catch.

**The fix.** `MannequinFigure` keeps the clip's own rotation of each bone it
turns (pelvis, the three spine bones, the head, both arms' upper and lower
bones), puts it back before the mixer runs, takes it again after, and applies
the edits from it every frame. The death clip starts clean the same way.

## The files

| File | What changed |
|---|---|
| `src/main.ts` | Esc on the menu → `resumeFromMenu()`, the retry, `menuEscapes` for the test; the pattern in the firing loop (`deviate`, `blastOffsets`); `platesNow` with the hit window and the line of sight, `clearTo`; `damagedAt` written for every match; the free-for-all in the dispatch and `modeGoal` |
| `index.html` | the Play hint says Esc; the free-for-all button and the 1v1 tab's option; the bots select's tooltip |
| `src/game/blast.ts` | new: `blastOffsets`, `blastWidth` |
| `src/game/weapons.ts` | `WeaponMech.blast` from the config's shape and the data's scales |
| `src/config/weapon-mechanics.json` | the `blast` table |
| `src/game/hud.ts` | one damage number a pull (`amount`, `damageNumbers`); the plates' range and fade from `hud.json`; the free-for-all panel |
| `src/config/hud.json` | new: the plates' numbers |
| `src/game/modes.ts`, `modematch.ts`, `src/config/modes.json`, `src/ui/menu.ts`, `src/game/stats.ts`, `leaderboard.ts` | free-for-all: the kind, `killLeader`, the config, the branches, the card and the board (Control's board too) |
| `src/game/mannequin.ts` | `clipPose`, `restoreClipPose`, `captureClipPose` round the mixer |
| `tools/verify.ts` | the patterns; free-for-all's rules |
| `tools/e2e.ts` | Esc; the shotgun; the plates and the line of sight; free-for-all; the spin |
| `tools/live-check.ts` | (from the round before) the "Not" names |
| `README.md`, `docs/FIDELITY.md`, `docs/DEVELOPMENT_ROADMAP.md` | the shotguns, the plates, free-for-all; the sources; milestones 39 to 43 |

## The bug hunt

| # | Found | Fix |
|---|---|---|
| 1 | The spin: `spine_01` turning 2,600 degrees in 6 s (above). | The clip pose kept and restored round the mixer. |
| 2 | The shotguns: a zero spread stat put every pellet on one line, and the HUD stacked the pellets' numbers. | The blast patterns; one number a pull. |
| 3 | Plates through walls. | The hit window and the line of sight. |
| 4 | `npm run live` would have failed the "Not R-301" names, hidden by a stale Pages build (the round before). | The check reads the new names. |
| 5 | The first probe keyed figures by a rotating value, so its per-part totals were nonsense. | Keyed by index. Worth writing down: an instrument that is wrong looks exactly like a bug that is strange. |
| 6 | The first spin check's pass criterion included the pelvis, which is *meant* to move: standing still, the feet stay planted as the aim turns, then step round. And the bot was firing, whose recoil kicks the chest by design. | The check holds the bot's fire and judges the chest and head only. |
| 7 | The e2e free-for-all check knocked the victim bot itself before asking the host's hit path to, so the path found it already down and scored nothing. | The test lets the host's path do the knock. |
| 8 | A spray-wall screenshot of the patterns showed an empty wall: the snap harness's fake trigger does not fire there (the e2e's does, after its own Play sequence). | Dropped, and the roadmap says so; the patterns are proven by verify and e2e. |
| 9 | `hitMeshes[1]` was suggested as the chest; the body zone is found by `userData.zone` instead, which does not depend on the order the meshes were built in. | — |
| 10 | Control's online board was missing from the boards list while the game posted to it. | Added with free-for-all's. |
| 11 | The recap check ("what it had left: 175 less your 35") failed once the suite ran end to end: the **hard bot had healed** between your two hits and its kill, so the recap truthfully read 175. The check was measuring the heal, not the damage. | The test empties that bot's kit first. The recap now reads 140 exactly. Not a game bug: a bot healing behind cover is Phase 12's own behaviour. |
| 12 | The Esc-in-a-text-field check was flaky: it appended its own input to the overlay, and a scripted page did not always give it focus, so the press was read as a bare Esc on the menu. | It focuses the Stats tab's real name field with the tab open, and reports whether focus was actually taken. |

## Proven

| Check | Result |
|---|---|
| `npm run check` | clean |
| `npm run verify` | VERIFY PASS (the patterns, free-for-all's rules) |
| `npm run rules` | rules ok |
| `npm run build:beta` | BETA CHECK PASS |
| `npm run e2e` | every section (the new checks: Esc ×3, the shotgun ×3, the plates ×3, free-for-all ×4, the spin ×1) |
| the spin probes | the chest and head within 3 degrees of the aim in every forced pose; 0 when still |

## What it does not do

- **The patterns' sizes are ours.** The data names each pattern and scales it
  but does not carry its points; the shapes are the game's known ones and the
  unit was sized by eye at 8 m. A measured pattern would replace the unit
  numbers in `weapon-mechanics.json`.
- **Bots still fire a random cone.** Their shots are hit tests, not visuals;
  giving them the patterns would change their hit chance and is a tuning
  question for later.
- **A plate has no fade-out.** It is on for 6 s from the last hit, then off.
- **Free-for-all with friends** is everyone who joins plus the bots, on the
  same host-run rules as the other modes; there is no separate matchmaking.
