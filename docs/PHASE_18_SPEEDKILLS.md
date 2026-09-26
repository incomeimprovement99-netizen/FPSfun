# Phase 18: SpeedKills

**Written 2026-09-26.** The results of `docs/PHASE_18_PLAN_SPEEDKILLS.md`. The legacy game is frozen whole
at the git tag `apex-era-final` and is still one setting away (Settings, Game, or `?game=legacy`); the site
opens in SpeedKills.

## Shipped, stage by stage

| Stage | What | Milestones |
|---|---|---|
| A | The game switch, a profile per game, the legacy game frozen | 183 |
| B | SpeedKills is the front door: PLAY and TRAINING | 184 |
| C | Movement for a city of roofs: double jump, wall run, a climb of a storey (two with a double jump) | 185 |
| D, E | Ten guns (five named for the owner's friends), fusion to level 5, infinite ammo, 100 health and a 50 shield that come back | 186 |
| F | Ten hacks, two carried, Hyper Scape's published cooldowns where it published them | 187 |
| G | Guns and hack cores on the floor; the Spire always hot, half the bots on it | 189 |
| H | The 500 m neon city, nine sectors, all CC0; a collision grid under the whole world | 188 |
| I | No knockdowns; the Gulag first, then a ghost restored at its echo, twice a match | 191 |
| J | Sector decay in four waves toward a final sector; a 45 s capture zone ends the match | 190 |
| K | Thirty in the city, measured with a new CPU profiler and made cheaper | 194 |
| L | NEON BLOCK, an arena from the city (1v1, bots, FFA, TDM, Control) | 198 |
| M | The controller: config, outer deadzone, curve strength, per-optic ADS, aim assist with falloff and no snapping | 192 |
| N | Five bot tiers, bots on a player's health, Heal and Dash by tier | 193 |
| O | The tour, eight steps done for real | 195 |
| P | Fusion pips on the gun panel, the city's ambience, the movement lab, the dropship ridden | 197, 200, 204, 205 |

Alongside: every multiplayer race the plan's recon found, bar one legacy item, fixed and each held by a check
(199, 201, 202, 203, 206).

## The numbers

- **A match:** 30 players in trios, a 6 s dropship from 135 m off the city, four decay waves of 70 s, a capture
  zone of 45 s: 6 to 7 minutes, the owner's number.
- **Frames:** in the street with thirty in the match, 200 fps on Competitive, 196 on Balanced and 97 on High
  (from 133, 118 and 71). Over the Spire: 213, 208 and 102 (from 96, 156 and 85). The legacy match gained
  too: 345, 312 and 149 (from 250, 196 and 110).
- **The city:** 14,852 meshes merged to 212, 180k triangles, held by `tools/checks/city-budget.ts`.
- **Fusion:** +2% damage and +10% magazine a level, +10% and +50% at level 5 (the owner's numbers).

## What went wrong, and what it taught

- **The release run finds what a single section does not.** Its first run found a supply bin offered through
  the vault's shut door, and bots stranding on walls when frames ran slow. The second only showed on a loaded
  machine, so the e2e can now throttle the CPU (`E2E_THROTTLE`) and make it fail alone.
- **Measure the frame before changing it.** The city's triangles were never the cost. three.js walked hidden
  objects every frame, bots cast sight rays at everyone, and see-through glass rebuilt its shader twice a draw.
  One CPU profile found all three; a guess would have started on the geometry.
- **Tests that pass for the wrong reason.** The shield check passed with its bug back (the legacy armour tier
  happened to be 50 too); the glass check passed because the test page's window was smaller than the bench's.
  Both were rewritten to test the rule itself, and every new check this phase was run with its bug put back.
- **Shared settings between the games.** The squad size and bot count were one key for both games, and the
  arena picker's first option was the legacy warehouse. SpeedKills now keeps its own.

## Still open

- **Plan section 12, item 6:** the legacy game's box-respawn lockouts are counted separately on each browser.
  SpeedKills has no lockout.
- **The battle royale host migration's setup** failed twice in the full second batch and never alone or
  throttled. Its failure now says which step it stopped at and what each bot held.
- **Bots stay on the streets:** the city's nav graph has no nodes on the roofs, so a bot on a roof is one that
  landed there. A roof graph is the next thing for the city's vertical fights.
- **The guns' look:** SpeedKills uses the legacy models. The free CC0 options and the one paid pack found are in
  `docs/SPEEDKILLS_ASSETS.md`; the look is the owner's call.
- **Tuning in play:** the capture hold (45 s), the ghost's sight (25 m), the five non-friend gun names and the
  district names are starting values, as the plan said.
