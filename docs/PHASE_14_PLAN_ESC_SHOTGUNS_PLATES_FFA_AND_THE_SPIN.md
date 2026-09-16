# Phase 14 plan: Esc, the shotguns, the plates, free-for-all, and the spin

**Asked for**, in the owner's words, over one evening:

> try to fix the bots and person characters from doing like insanely jerky
> movement with their upper half they do like spinning never ending loops and
> weird shit only in the torso and up

> ON THE BOOG RANGE MENU, WE SHOULD BE ABLE TO HIT ESCAPE AND HAVE IT BE THE
> SAME AS HITTING THE "RESUME" BUTTON.

> i also want a mode where we can do FFA instead of TDM, and the bots health
> bars show even when they are behind cover, they should never show until we
> hit them and they are in our line of sight. The shotguns seem to only shoot
> 1 pellet, mastiff does 19 per shot.

## What that means, and the order taken

| # | Ask | Read as | Why this order |
|---|---|---|---|
| 1 | Esc = Resume | Esc on the menu does what the button does. | Smallest, self-contained; done first while the spin was being measured. |
| 2 | Shotguns fire one pellet | Something makes a shotgun's pellets land as one. | A gameplay bug in every mode: taken before the features. |
| 3 | Health bars through cover | An enemy's plate only after a hit and only in line of sight. | A competitive fairness bug; small once the LOS helper was found. |
| 4 | FFA | A free-for-all beside team deathmatch. | A feature; the arena modes' shared rules made it cheap. |
| 5 | The upper-body spin | A real bug in the mannequin: measure it, do not guess. | Asked first, but it needed instruments; it ran alongside the rest. |

## The decisions

| Question | Answer, and why |
|---|---|
| Esc while a key is being rebound, or while typing a name? | The rebind's capture eats Esc first (it cancels the capture, as before); Esc in a text field leaves the field. Only a bare Esc on the menu resumes. |
| Esc right after the Esc that opened the menu? | Chrome refuses a pointer lock for about a second after Esc, and that is exactly when this is pressed. A refused resume is retried once quietly when the second is up, unless the menu was clicked meanwhile. |
| Were the shotguns really firing one pellet? | No: a Mastiff pull at a dummy landed 5 pellets for 95. But its spread stat is 0 (the game sizes shotgun spread by a **blast pattern**, not the stat), so all five flew one line and the HUD stacked five 19s on one spot. It looked and felt like one pellet, and the whole blast hit or missed together. |
| Patterns from where? | The data carries each gun's `blast_pattern_default_scale`, `_ads_scale` and `_zero_distance` but not the shape. The shapes are the game's known ones (the Mastiff's line, the EVA-8's figure 8, the Peacekeeper's star, the Mozambique's triangle, the Triple Take's three); their unit is ours, sized from how wide each reads at 8 m, and marked so in FIDELITY. |
| Where does the spread stat go? | On the blast as a whole, once a pull, so the shape holds: that is how the game's patterns behave. |
| Damage numbers | One number a pull, summed over the pellets, as the game shows it. |
| When does an enemy's plate show? | After you have hurt them (6 s from the last hit, `hud.json`), and only while your eye has a clear line to their chest through `solidHit`, the bullets' own test, which already covers the range, both arenas and the battle royale map. A team mate's always. |
| FFA's rules | Ours (Apex has none): first to 20 kills or the most at 10 minutes, the fewest deaths on a tie, a 4 s respawn at the spot farthest from any enemy, bots by the host's setting. |
| The spin: guess or measure? | Measure. A probe sampled every named bone's rotation in a bot match and found `spine_01` turning 2,600 degrees in 6 s while the pelvis was calm; a second probe in world space showed the chest and head swinging the full circle every few frames; a third forced the pose (still, a 40-degree look) and the chest still turned 280 degrees in 1.5 s. The robot figure never did it. |
| The spin: the cause | three's mixer writes a bone only when the clip's value has changed since the last frame. The upper body plays a held pose, so after the first frame the mixer never wrote the spine or head again, and every frame's `turnBone` piled onto the last frame's. |
| The spin: the fix | Put the clip's own rotation back on the edited bones before the mixer runs, take it again after, and apply the edits from it every frame. Not a wrapper node per bone (a rig change) and not a damping (which would hide, not fix). |

## The work

1. `src/main.ts`, `index.html`: Esc on the menu, the retry, the hint.
2. `src/game/blast.ts` (new), `weapons.ts`, `main.ts`, `hud.ts`, `src/config/weapon-mechanics.json`: the patterns and the summed damage number.
3. `src/main.ts`, `hud.ts`, `src/config/hud.json` (new): the plates' rule.
4. `src/game/modes.ts`, `modematch.ts`, `hud.ts`, `src/config/modes.json`, `index.html`, `src/ui/menu.ts`, `stats.ts`, `leaderboard.ts`: free-for-all.
5. `src/game/mannequin.ts`: the clip pose kept and restored.
6. Tests in verify and e2e for each; README, FIDELITY, the roadmap (milestones 39 to 43), this plan and the results.

## How it is proven

- verify: the patterns (a place per pellet, widths, the ads and choke scales, symmetry), FFA's rules (`killLeader`).
- e2e: Esc taken as Resume and not in a field or in game; a Mastiff pull is 5 pellets, 5 hits, 95 dealt, one number; no plate before a hit and the plate exactly when the line is clear; FFA's board, scoring and win; a still mannequin's chest and head holding their yaw.
- The three probes that found the spin are in the results document, with their numbers before and after.
