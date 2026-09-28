# Phase 22 results: finishing the centre

The round planned in `docs/PHASE_22_PLAN_FINISHING_THE_CENTRE.md`, item by item as each ships. Started 2026-09-27.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 22.1 | The fire escapes' owed bench | done | 285 | about 0.4 ms on Balanced, up to 0.9 on High; kept, written beside the limits |
| 22.2 | Atmosphere: steam and neon flicker | shipped | 282 | 32 steam sources, 320 puffs in one draw; 6 signs flicker, at most 3 dips a second; the metro's stairwells made known to the kit again |
| 22.3 | Doors from the fire escapes into the open floors | shipped | 285 | 102 doorways on 18 escapes, each walked in and out |
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
- **The owner's report (2026-09-27, 11:50 pm):** "i don't see any of the new map stuff" on fpsfun.duckdns.org. Not a
  deploy fault: the live site, loaded headless from an empty cache, drew all five packs in about 11 s. The game's
  default preset is Competitive, which draws the lean kit, and the setting's labels did not say so. Milestone 283
  labels the presets by what they show; whether the default becomes Balanced is the owner's call, asked.
- **22.1, done (7:02 to 7:13 pm):** the queued bench found two quiet minutes and ran; my own verify and deploys and
  another worktree's e2e then shared the machine for two of its three rounds. Interleaving kept the pairs honest:
  about 0.4 ms of kit on Balanced, up to 0.9 on High. The watcher first counted its own command line as load (it
  names what it looks for); it now leaves itself out.
- **22.3:** the escapes are placed last, after the rooms, so the doorways are cut into walls already built: each room
  records its wall pieces, and the piece behind a landing is swapped for the wall round a door. The kit's door rule
  passes an escape's own pieces (they are the way to the door) and the escapes' clearance rule passes their own
  doors. The city is now at 21,735 of 22,000 meshes and 319k of 320k triangles: 22.4 has to give room back before
  22.5 can add any.
- **The owner asked for proof** (11:55 pm): four screenshots from the live server on High, the flying cars in their
  lane over the Spire's block, Neon Alley, and the centre from above.

