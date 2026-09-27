# Phase 21 results: the vertical centre, dressed in the bought city

**Written 2026-09-27**, closing the round planned in `docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md` (what to build and
what to buy), `docs/PHASE_21_LAYOUT.md` (where) and `docs/CITY_BUNDLE_IMPLEMENTATION.md` (how, with the five packs the
owner bought). The round ran as milestones, each built, checked, documented and shipped on its own; this is the
round's summary, back-filled, as the phase pattern asks. What is left of it is Phase 22
(`docs/PHASE_22_PLAN_FINISHING_THE_CENTRE.md`).

The owner's asks, in their words: "when i come back i want the city center to be in a much better spot, using the paid
assets and goes according to our plan. Do the mix of building styles per block, yep, we want to utilize all of the
money we spent if it won't hurt us. Yep add a metro level under the street, just for this center part, not a huge
area, but a decent amount." Then, seeing it: "i am only seeing some assets looking like they are reused, i thought we
had a boat load in the 5 that we bought?"

## What shipped

| Milestone | What | Plan step |
|---|---|---|
| 254 | The five packs dress the Spire sector: a family of building styles per block, shop fronts, signs, roof gear, the lit skyline; the graphics presets pick how much and at what size | bundle plan 8, steps 1, 3 to 5 |
| 255 | The centre rises: the twins to 104 m, the Spire's crown deck at 140 m | step 2 (4.3) |
| 256 | The Sky Park at 64 m: rooms, canyon jumps and four bridges onto the Spire | 4.4, 4.5 |
| 258 | The metro: 288 m of tunnel loop under the four streets round the Spire | the owner's ask |
| 260 | Neon Alley: one street at full density, the showpiece | step 3 (4.3.1) |
| 261 | The chimney stacks: the owner's chain from the podium to the Sky Park | 4.5, route 3 |
| 262 | The levels read up every tower: the lobby's and the Sky Park's bands and rings | step 6 |
| 264 | The metro's own loot and dressing; a shared-material fault that hid the city's trim, fixed and checked | |
| 265 | The parked cars are High City's hover cars | step 4 |
| 267 | The drop: a shaft down inside the Spire, 120 m to the concourse | 4.5, route 5 |
| 268 | The vertical centre measured and held in verify (`city-levels.ts`) | step 2's end |
| 270 | Open floors and stair cores inside the towers: the 10 to 30 m band filled | 2.2, 2.3 |
| 272 | Flying traffic over the streets | step 7 |
| 273 | The bots take the stairs | 4.5, route 1 |
| 275 | Open floors up to the Sky Park: the 30 to 100 m bands | |
| 276 | A style per tower, the streets dressed, the Spire's machinery: 124 pieces in use to 172 | the owner's "reused" |
| 278 | The canyons wear their towers' walls, pressed flat (1,461 blank panels) | 4.6, rule 1 |
| 279 | Doors and windows down the shop streets, and the small pieces: 206 pieces in use | |
| 281 | Fire escapes: ladders you can fight on, up 18 towers | 4.6, rule 7 |

## The centre, measured (`tools/checks/city-levels.ts`, the Spire sector)

| | Before the round | Now | The plan's target |
|---|---|---|---|
| Highest standing top | 70.5 m | 142.5 m | 120 m and more |
| 10 to 30 m | 1,169 m² | 16,010 m² | 15,000 (107%) |
| 30 to 60 m | 7,086 m² | 18,775 m² | 20,000 (94%) |
| 60 m and up | 1,478 m² | 20,069 m² | 20,000 |
| The street's share | 42% | 20.9% | 20% or less |

## What was learned, and changed in the plans

- **Measure the bought pieces, never read their bounds.** The bundle plan's rule 7 said the fire escapes were 5 m a
  storey (their bounds are 4.98 m). Measured (`tools/measure-escape.ts`), their landings are 4.00 m apart, our storey;
  the extra is the handrail. The plan is corrected. The same habit found the facade modules' relief
  (`import-city.ts`'s planes) and the escapes' shared stair.
- **Cached materials are shared.** `flat()` and `emissive()` hand out one material a colour; hiding one to replace a
  stand-in hid every mesh of that colour in the city (Milestone 264). Every stand-in now clones its material, and
  `citykit.ts` checks each is on its own meshes only.
- **Budgets are held by bench, and a bench needs a quiet machine.** The kit's limits rose from 1,152k to 1,420k on
  Balanced with interleaved benches beside each raise (kit on and off within noise; its cost is draw calls, not
  triangles). The fire escapes' raise (to 1,540k) went without one, on the owner's call for basic checks, because the
  bench begun ran beside another worktree's e2e. It is Phase 22's first item.
- **Main moves under this worktree.** Other agents commit to main between items; every ship rebases first, and the
  docs conflict each time (both append). A diary edit once put stray carriage returns in the file, which made git
  commit it whole and conflict on every line; the text is now converted before its prefix is added.

## What the round left

Carried into Phase 22: the owed bench; the atmosphere (steam, neon flicker); doors from the fire escapes into the open
floors; a draw-call pass; the last room at 30 to 60 m and the street's share; the batch's full release tests.
