# Phase 20 plan: where Phase 19 left SpeedKills, and what comes next

Written 2026-09-26 at the close of Phase 19 (`docs/PHASE_19_PLAN_DOWNTOWN.md`, Milestones 209 to 220). The
ranked steps at the end are a proposal for the owner to confirm or reorder.

## Where Phase 19 ended

Live on fpsfun.duckdns.org and Pages:

- **The downtown core:** podiums and towers split by canyons.
- **Jump pads** with gold beams and rings, their throws solved from the movement's gravity.
- **The mid-rise ring:** its buildings are entered from the street and climbed by their stairs, with loot on
  every floor.
- **A landmark in each of the eight districts.**
- **The centre as one raised district** after Red Tiger: nine podiums at one height, bridges over the streets,
  a public stair up each, and loot that comes back as it is taken.
- **The rooftop highway.**
- **The neon night,** with golden hour as a setting.
- **Street life:** parked cars, crossings and canopies.
- **The red outline** on the enemy under the crosshair, and **speed streaks** past a sprint.
- **Bots** that climb the concourse, ride the centre's pads and go for the capture zone.

Not done from Phase 19's list:

- **The rest of step 10:** the guns' snap to hand. It needs the owner's decision; see step 2 below.
- **Trees and planters** from the free Quaternius nature kit.

## If something breaks, where to look

| Symptom | Where it is made | What checks it |
|---|---|---|
| A jump pad throws you short, or into a wall | `city.ts` padOnto (the solver), city.json `padSolve`; `brplay.ts` padCarry (the push over the edge) | e2e pad rides (street, highway, terrace) in speedkillsBrTest |
| A bot stuck on a roof or against a wall | `city.ts` the graph (the concourse and pads block, `walkLink`), `navgraph.ts` (`padFrom`), `brmatch.ts` botTraversal (the pad ride) and the zone branch (`zoneTree`), `bots.ts` jumpPad | `tools/checks/sk-roofs.ts` (street links, stairs, bridges, pads, the way to the Spire), e2e bot pad ride and zone checks |
| A bot falls through the Spire | usually right: a decaying sector's solids are taken out (`city.ts` cityDecay) | the pad e2e runs early in the fight for this reason |
| A stair or a building cannot be climbed | `brpoi.ts` building (stairs; treads under 0.25 m are too shallow for the bots), `city.ts` perimeterBlock and tower(), city.json `perimeter.enter` | sk-roofs route walks |
| A concourse stair or bridge is blocked | `city.ts` downtownBlock (the public stair, `stairZones`), the concourse bridges (`underPad`) | sk-roofs stairs and bridges |
| The highway | `city.ts` the rooftop highway block, city.json `highway` | sk-roofs highway walk, e2e highway pad |
| A car in the way | `city.ts` street life (placed before the graph, kept clear of pads and doors) | sk-roofs street links |
| No loot up high, or the centre's loot not coming back | `loot.ts` generate (maxFloor, hotSpots, restockPlan), `brmatch.ts` tick (the restock), speedkills.json `loot` | e2e roof loot and restock checks |
| The outline missing, wrong, or showing through a wall | `outline.ts`, `dummy.ts` setOutline, `main.ts` (the outline ray), speedkills.json `feel` | e2e outline check, snapshot `sk-outline` |
| The streaks over the HUD | `main.ts` speedLines (inserted just before `#hud`) | e2e streaks check |
| The sky wrong in SpeedKills | sky.json `neonNight`, `sky.ts` loadSkHour and saveSkHour, `main.ts` gameHour | `tools/checks/sky-hours.ts`, e2e sky check |
| The city too heavy | city.json and `city.ts` | `tools/checks/city-budget.ts` (225k of 240k triangles, 354 merged meshes), `npm run bench` |

These e2e checks have failed under load and passed alone: the tour's double jump, one bot-squads sample and the
legacy supply bin. Three were made steadier in Phase 19:

- the lab climb presses jump in frames, not milliseconds;
- the ghost's walk turns until it has room;
- the restore's finish waits 15 s.

## A measurement not to trust yet

Frame rate in SpeedKills' street facing the Spire (`BENCH_SPOT=skmatch`, Competitive, one run each, 26
September):

| Build | fps (median) |
|---|---|
| 502e05b, before Phase 19 | 120 |
| 86accca, landmarks | 164 |
| ff22362, the concourse | 116 |
| e1ba530, the neon night | 159 |
| 774e548, street life | 132 |
| 65ede41, now | 169 |

Single runs swing by about 25%: the current code read 114 fps in one run and 169 in the next. Nothing here
shows Phase 19 made the city slower, and nothing shows it did not.

## Ranked next steps (proposal)

1. **A frame-rate number to trust.** The bench takes the median of several runs, and SpeedKills gets a floor
   in fps per preset for its street and roof views, checked before a release. Smooth was the first thing
   Hyper Scape was.
2. **The guns' pace: the owner's call.** They draw in 0.6 s and aim in 0.31 s, from the legacy data, and no
   public source gives Hyper Scape's numbers. The rest of step 10 follows the decision.
3. **The free Quaternius kits:** trees and planters on the streets, and props for the interiors, so the rooms
   differ (Hyper Scape's reviewers called its rooms all the same).
4. **Bots, further:**
   - the pads outside the centre and the highway on their graph;
   - a bot's whole walk to the capture zone checked end to end. Today the plan and the pad ride are checked,
     not the full climb.
5. **A second Hyper Scape gap pass,** from snapshots of the live build set beside its screenshots.
6. **Open items from before:** the host-migration flake, and the guns' look (the owner's call).
