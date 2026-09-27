# Phase 22 results: finishing the centre

The round planned in `docs/PHASE_22_PLAN_FINISHING_THE_CENTRE.md`, item by item as each ships. Started 2026-09-27.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 22.1 | The fire escapes' owed bench | waiting for a quiet machine | | |
| 22.2 | Atmosphere: steam and neon flicker | shipped | 282 | 32 steam sources, 320 puffs in one draw; 6 signs flicker, at most 3 dips a second; the metro's stairwells made known to the kit again |
| 22.3 | Doors from the fire escapes into the open floors | | | |
| 22.4 | A draw-call pass | | | |
| 22.5 | The last room at 30 to 60 m, and the street's share | | | |
| 22.6 | The batch's release tests | | | |

## Notes as it goes

- **22.1, first attempt (2026-09-27, 5:33 pm):** begun beside another worktree's e2e; kit off measured slower than kit
  on (13.5 against 10.1 ms), which is the load, not the kit. Stopped, so as not to load their run either. At 6:33 pm
  their next batch started. The bench runs from a frozen copy of the shipped build at the first quiet window, while
  22.2 goes on here.
- **22.2, a fault found on the way (2026-09-27):** steam from the metro's stairwells came out nowhere, because the
  list of stairwells the kit keeps off was emptied by the sites' reset after it was filled, since Milestone 258. Fixed
  where the list is filled, and held by `sk-metro.ts`. The steam's first tuning was invisible in the pictures; a probe
  at five times the light showed it working, and it was set by eye from pictures to 0.3.
- **22.2 while 22.1 waits:** the bench runs from a frozen copy (`apex-bench` at the shipped commit, port 5212), so
  this worktree's edits cannot reload its page; it starts itself after two quiet minutes.

