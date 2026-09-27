# Phase 22 plan: finishing the centre

**Written 2026-09-27**, before the first edit of the round. Phase 21 (`docs/PHASE_21_THE_VERTICAL_CENTRE.md`) built and
dressed the vertical centre; this round finishes what it left, in the order the owner ranked it. Results, item by item
as each ships: `docs/PHASE_22_FINISHING_THE_CENTRE.md`.

The owner, 2026-09-27: "Continue and ensure that if it's in a stable enough spot, we push and deploy. Just basic checks
until we do a bigger batch, like hours worth of map creation instead of 20-30min ones we have been doing." And then:
"ship what we have and then continue implementing. ensure our process and planning / implementation stuff is being
documented. do the next steps in the ranked order".

## Where it starts

The centre is about 80% of the plan: the heights, levels and routes are in (Sky Lobby 32 m, Sky Park 64 m, crown 142.5
m, 24 stair cores, four chimneys, the drop, the metro, 18 fire escapes); the five packs dress it (206 of 431 imported
pieces in use); room to stand is 107% of the plan's 10 to 30 m target and 94% of the 30 to 60 m. Left: the atmosphere,
a performance pass, the last of the room, and the tests a release of this size owes.

## The items, in the owner's order

| id | item | how | verified by |
|---|---|---|---|
| 22.1 | **The fire escapes' owed bench** | `tools/bench.ts`, three rounds interleaved, kit on and off (`?nocitykit`), in the street (skmatch) and over the Spire (skroof), Balanced and High, from a frozen copy of the shipped build (its own worktree and port, so edits to this one cannot reload the page mid-run), started only when no e2e or bench runs anywhere on the machine (checked in the process list: another worktree's e2e spoiled the first attempt) | medians kit on against off within the noise, every Balanced run with the kit under 9 ms; the result written into `citykit.json`'s budget note. If it shows a cost, the escapes' count or tier comes down, not the limit up |
| 22.2 | **Atmosphere: steam and neon flicker** | Steam rising from the metro's gratings, drains at the kerbs and roof vents: soft sprites in one instanced draw, moved each frame like the flying traffic, thin (never enough to hide a body: a sightline through it stays readable), from Balanced up, off on Competitive, where seeing is the game. A few of the centre's neon signs flicker: each its own material, a brief dip at a random interval, never more than three flashes a second (the photosensitive line), from Balanced up. Numbers in config with notes | a check: the sources clear of pads, doors and windows; the draw count and triangles inside the budgets; no sign dips faster than 3 Hz; pictures on Balanced and Competitive; the frame cost read off a bench |
| 22.3 | **Doors from the fire escapes into the open floors** | Where a landing stands at an open storey's floor (the Sky Lobby, the Sky Park, their open floors), a doorway through that room's wall onto the landing's inner strip, cut as the city cuts the stair cores' doors, and left bare by the kit (`KIT_SITES.doors`) | `sk-escapes.ts` walks from each such landing into the room and back; `sk-lobbies.ts` and the kit's door check still pass |
| 22.4 | **A draw-call pass** | Count the kit's draw calls by piece (each piece's meshes and materials); merge the meshes of a piece that share a material at import, turn off shadows for pieces too small to cast one worth drawing, and drop what costs a call for little on screen | the kit's draw calls on Balanced in the street down by a quarter or more (1,077 with the escapes), read by the bench, and the frame medians with them |
| 22.5 | **The last room at 30 to 60 m, and the street's share** | Another open storey in the 30 to 60 m band on the stair cores that pass it, or terraces on the towers' set-backs, measured before and after | `city-levels.ts`: 30 to 60 m at 20,000 m² or more, the street's share 20% or less, both then held |
| 22.6 | **The batch's release tests** | The three e2e batches (`$TEMP/run-e2e.sh`), each failed section rerun alone, `npm run fit`, `npm run live` | all green, or each failure named with its cause |

## How each item is done

Build it, check it (`npm run verify`, `npm run rules`, pictures from the spots it changes), write it down (a roadmap
milestone, a diary entry, a row in the results doc, the README and deploy guide kept true), commit it, rebase onto
main, fast-forward main alone and confirm it moved, push, `npm run fps backup`, `npm run fps deploy`, `npm run
deploy`. The heavy tests (22.6) run once, at the end of the batch, as the owner asked. Gameplay numbers go in
`src/config/*.json` with a note; numbers about the bought pieces are measured off them.

## Time

About five hours: 22.1 half an hour of machine time; 22.2 an hour and a half; 22.3 an hour; 22.4 an hour and a half;
22.5 an hour; 22.6 an hour and a half, mostly waiting on the e2e batches.
