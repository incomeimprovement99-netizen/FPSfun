# Phase 20 plan: the owner's playtest fixes, then what comes next

Written 2026-09-26 at the close of Phase 19 (`docs/PHASE_19_PLAN_DOWNTOWN.md`, Milestones 209 to 220).

- **Part A** is the owner's feedback from playing the live build. All of it is done before the game is shared
  with the owner's friends, in the order below.
- **Part B** is the ranked next steps. They follow Part A.

"The game" in this plan is SpeedKills. Nothing here changes the legacy game (B00G FPS, the BOOG range) unless
an item says so.

## Part A: the owner's playtest fixes (before sharing)

**How each item is proven:**
- Each fix gets a check that fails with the bug put back.
- Each fix gets a snapshot where it shows on screen.
- Each fix gets a roadmap Milestone and a diary line.
- Part A ends with the full release run: the three e2e batches, `npm run fit`, and both deploys.

**Numbers:** where an item needs a number about Hyper Scape, the number comes from a source or a measurement
and says which. Where there is neither, the owner is asked rather than a value invented.

### Decisions taken for the owner (reversible)

The diagnoses (2026-09-26) raised questions. Each was decided with the recommended option so the work does not
stop; any of them can be reversed. Legacy stays untouched throughout, by the owner's rule.

- **A1:**
  - In a loadout start the bots still land armed.
  - SpeedKills care packages hold SpeedKills loot, not legacy guns, batteries or a phoenix.
  - Loadout crates are off in SpeedKills: they handed level-0 copies, against fusion.
- **A2:**
  - Damage is rounded for display only.
  - SpeedKills stops rounding each hit down before it lands (dummy.ts). The rounding cut USSO 10% and made some
    guns' fusion add nothing.
- **A3:**
  - Real arms that nothing posed are hidden; they showed in the 3x scope on HELIX and PULSAR.
  - A reload while aiming keeps the sight steady (reloadAds 0.85), instead of leaving the sights.
- **A4:**
  - 38 m of grace, not 40, because the range's back wall stands 39 m north of the city.
  - An out-of-bounds death goes to the Gulag like a ring death.
  - The skyline moves out past the fence.
- **A5:**
  - SpeedKills draws the city from the ship's first frame.
  - The stray range props join the range side.
  - The ship flies above the skyline's tallest towers.
  - The mannequins' frustum culling being off (about 324 draw calls and 980k triangles for 27 bots) becomes the
    first lead of Part B step 1.
- **A6:**
  - The health bar is twice as thick and a little longer.
  - Only the bottom HUD moves.
  - The range's stats panel is hidden in a match.
  - The ping and emote wheels and the captions are drawn again in SpeedKills.
  - Gun levels show as pips and "LV n".
  - The speed readout stays, smaller.
- **A7:**
  - The kinds: PANDA Heavy Rifle, ZEPHYR Fast Rifle, ANAKIN Steady SMG, USSO Fast SMG, BIGANTLER Heavy
    Shotgun, RIPTIDE Auto Shotgun, HELIX Heavy Marksman, PULSAR Fast Marksman, BOOG Sniper, NOVA Energy LMG.
    The Run's pistols are Pistol.
  - The kill feed names no gun, as today.
  - The bot called NOVA is renamed in SpeedKills.
  - SpeedKills' default loadouts get names that fit their guns.
  - The FUSED notice is no longer overwritten.
- **A8:**
  - Full (the default) and Compact, no Off.
  - The card shows for the item you look at or cycle to, and steps aside while aiming.
  - The per-family lines are as proposed.
  - The hack-core swap flip-flop is fixed.
- **A9:**
  - Slam's height is measured from footage. If that is impossible, the one sourced number (30 m, a player's
    claim) is used and flagged.
  - Every other hack takes the final published values, and their missing behaviours are built: the Mine seeks,
    the Wall has 250 HP and at most 2, Reveal is a 50 degree cone, and Invisibility breaks on aiming and on a
    hack.
  - The owner's earlier choice for Armor stays: it takes 60% of damage off and you can still shoot. Its
    duration and cooldowns follow Hyper Scape.
  - Unpublished numbers (Teleport's distance) are measured from footage or left and flagged.
- **A10:**
  - SpeedKills bots lose every legacy kit (hacks only).
  - The grenade kit leaves SpeedKills.
  - The Frag spray stays; it is a spray.
- **A11:**
  - The menu grows with the screen: 1120, 1200, 1280 and 1400 px.
  - Scrollbars have a cyan thumb that turns magenta under the mouse.
  - The settings' control column is wider.
- **A12:**
  - The barrier stands 24 m down range.
  - The TV hangs in it at three-quarter size.
  - Signs point to The Run (Basic and Advanced) and a sign to the movement lab.
  - The courses keep their old look for now.
  - The hacks reset at a match's end.

### A1. Loot does not work after "land with your loadout"

- **The owner:** "i can't loot anything so i can't fusion anything together, can't change my guns ... i did do
  the 'land with your loadout'".
- **Found:** `brmatch.ts:756`, `this.startLoot = opts.start !== "loadout"`. With a loadout start the floor gets
  no loot at all, so nothing can be picked up, fused or swapped.
- **Fix:** in SpeedKills the floor always has its loot. The loadout start changes only what you land holding.
- **Also check** everything else that reads `startLoot`: the bots' arming (`botArmed`), their gun visibility,
  the supply bins. Legacy keeps its behaviour.
- **Done when:** an e2e check in both start modes finds loot on the floor, picks up a copy of the held gun (its
  level goes up), and picks up a different gun (it swaps in).

*Done (Milestone 221).*

### A2. Damage numbers show long decimals

- **The owner:** each shot shows "33.66666666666666".
- **Found:** `hud.ts:387` writes `String(amount)`. SpeedKills' tuned damage is fractional, and a spray's summed
  number is too.
- **Fix:** whole numbers wherever damage is shown: the damage numbers, their spray totals, the range's stats,
  the recap, the death recap and the kill feed.
- **Done when:** an e2e check lands several hits of a fractional-damage gun and finds only whole numbers on
  screen.
- **On a closer look:** the fraction did not come from the guns, because every hit was rounded down as it landed
  (`dummy.ts`). It came from SpeedKills bots' shield and health, which come back a sliver a frame: a hit that
  finishes a part-healed bot reports what it had left. The stats panel's DAMAGE line was a second raw site. So
  the "Done when" above could not fail as written (a fractional gun on a dummy read whole). The checks became a
  drawn HUD frame with real fractions in every field, a finishing hit on a healed bot in a match, and, once
  SpeedKills' hits stopped being rounded down (the decision above), USSO's rounds on a range dummy and a board.

*Done (Milestone 222).*

### A3. The left arm covers the red dot when aiming

- **The owner:** "the left arm is in the red dot and sight area".
- **Where:** the first-person arms and the aim pose (`viewmodel.ts`, `fparms.ts`, `arms.ts`, `viewmodel.json`),
  per gun and per optic.
- **Fix:** measure it first. A snapshot aiming down the sights with every SpeedKills gun and every optic finds
  which pairs show the arm inside the sight picture. Then fix the pose or the hand's grip for those.
- **Done when:** a picture test, like `npm run fit`, counts the arm's pixels inside each optic's window while
  aiming, and every one is 0.

*Done (Milestone 223).*

### A4. The map's edge: visible, a 40 m grace with a countdown, then a red laser

- **The owner:** the edge is vague in the game (clear only on the minimap). Allow about 40 m out with a timer
  saying you will be terminated in 5 s if you do not come back. If you test it, a big red laser zaps you: it
  lights up your view so all you see is the red laser, and it tells you that you died out of bounds.
- **Where:** today the battle royale's bounds are a hard wall (`main.ts` `player.setBounds(BR_BOUNDS)`).
- **Fix:**
  - The bounds become the map plus 40 m.
  - The edge gets a boundary you can see in the world (a lit holographic fence on all four sides).
  - Past the edge, the HUD says RETURN TO THE CITY and counts down from 5. Coming back cancels it.
  - At 0, a red laser comes down on you, the screen floods red, and you die with the cause OUT OF BOUNDS (in the
    kill feed and the death recap).
  - Every screen in the match sees the laser.
  - All of it is set in config with a note (the grace distance, the seconds, the laser's look).
- **Done when:** an e2e check walks out and sees the countdown, walks back and sees it cancelled, walks out and
  stays, and sees the death by OUT OF BOUNDS. Snapshots show the fence and the laser.

*Done (Milestone 224).*

### A5. The dropship shows other maps: is everything rendered at once?

- **The owner:** from the dropship at the start they could see "the old BR map". Are both maps rendered, and
  does that hurt performance?
- **To find out first:** a snapshot from the ship at the start of a match, to see exactly what shows. The
  legacy battle royale map itself is not built in SpeedKills (`main.ts`: the city OR the old map). The range,
  the arenas and the tri arena are all in the scene, a few hundred metres away.
- **Fix:** during a match only the city and its skyline are drawn. The range and the arenas are hidden in the
  battle royale's region and shown again after it.
- **Done when:** measured from the ship, the draw calls and frame rate before and after are written down (the
  median of several bench runs, since single runs swing about 25%), and a snapshot from the ship shows only the
  city.

*Done (Milestone 225).*

### A6. The HUD, compact at the bottom of the screen

- **The owner:**
  - Make it all compact on the lowest part of the monitor.
  - Gun names and levels to the left of the current ammo count.
  - The two abilities to the right of the health, moved slightly down and right.
  - The Slam and Heal boxes (the hack boxes) bigger.
  - The health bar about twice as big, the ammo at least 1.5 times as big.
  - Slight black outlines on all UI so it is never hard to read.
- **Where:** `hud.ts` (the canvas HUD) and `hud.json`.
- **Fix:**
  - The bottom band re-laid out as asked, with the sizes as config numbers.
  - Every piece of HUD text and every bar gets a thin dark outline.
  - Checked at the smallest and the largest HUD scale.
- **Done when:** a HUD layout check reads each element's box and finds:
  - the health bar at least 2x and the ammo at least 1.5x their old sizes;
  - the gun names left of the ammo;
  - the hacks right of the health;
  - everything in the bottom band.

  Snapshots at 1080p and 1440p show it.

*Done (Milestone 226).*

### A7. Every gun named with its class

- **The owner:** "USSO (Fast SMG)" and so on, so a beginner can see what each gun is.
- **Fix:**
  - Each gun gets a short class in speedkills.json, with a note (Fast SMG, Steady SMG, Sniper, and so on).
  - One helper names a gun everywhere a gun is named: the HUD slots, loot labels and prompts, the loadout and
    setup menus, pickup notices, the kill feed, the recap and the tour.
- **Done when:** an e2e check reads the menus and the HUD and finds no gun named without its class.

*Done (Milestone 227).*

### A8. The loot card: this gun against yours

- **The owner:** looking at a gun on the floor shows what it is and compares it with your current gun: level,
  stats, ammo count, "all that". There are two versions:
  - the default, verbose, which helps a player learn;
  - a compact one for experienced players, with just what a quick call needs.
- **Fix:**
  - A card when aiming at floor loot within reach: its name and class, its level, and its stats set beside the
    gun it would replace, with better or worse marked. The stats are damage, fire rate, magazine, and time to
    kill against a full 150.
  - For a copy of your own gun, the card says FUSES TO LEVEL N.
  - Hack cores get the same card.
  - A setting, Loot card: Full (the default) or Compact.
- **Done when:** an e2e check aims at a floor gun in both modes and reads the card, and snapshots show both
  modes.

*Done (Milestone 228).*

### A9. The hacks as Hyper Scape's were, from sources, Slam first

- **The owner:** "the slam barely goes up, it went like 10x higher in hyperscape, make sure you look into that
  exactly and the other abilities so you know how they are supposed to work exactly instead of assuming or
  filling in holes".
- **Found:** Slam launches at 9 m/s (`hacks.json` slam.up). At SpeedKills' gravity of 17.5 m/s² that is a peak
  of about 2.3 m.
- **Fix:**
  - First, research each hack: what it did, and every number the sources give. That means height, distance,
    duration, radius, damage and the cooldown at each fusion level, from wikis, patch notes, guides and footage.
  - Where there is no number, measure the footage where possible, for example a Slam's height against a
    building of known storeys, and label it measured.
  - Then tune each hack to the result, Slam first. Then Heal, Dash (Hyper Scape's Teleport), Invisibility,
    Armor, Wall, Reveal and Mine. LEAP and GRAPPLE are ours, with their numbers kept.
  - A table in the plan lists every hack number with its source, measurement or owner decision.
- **Done when:** a hack check measures each hack in the movement simulator (Slam's peak, a dash's distance, a
  heal's rate) and holds it to the table.

*Done (Milestone 229).*

### A10. No smoke grenade in SpeedKills

- **The owner:** "remove the smoke grenade, i don't like it for this type of gameplay, keep it in boog fps,
  legacy one".
- **Found:** it is the legacy SMOKE kit (kits.json `smoke`, `main.ts` stepSmokeKit), still offered in
  SpeedKills.
- **Fix:** gone from SpeedKills' pickers, loot, keys, HUD and tour. Unchanged in legacy.
- **Done when:** an e2e check finds no smoke anywhere in a SpeedKills page, and still finds it in a legacy one.

*Done (Milestone 230).*

### A14. Two friends could not both join one battle royale (added 2026-09-27, done first)

- **The owner:** two friends could not join a battle royale; once one friend joined, the other was sent to the
  lobby.
- **Found:** a battle royale's host took as many players as the players dropdown said. That dropdown belongs to
  the 1v1 and defaults to 2, so the host and one friend filled the match. The second friend was turned away with
  "the match is full", back to the lobby. A test with a trio battle royale and the dropdown left alone reproduced
  it: the host's match had 2 players and the second friend read "The host turned the connection away".
- **Fix:** a battle royale's room comes from its squads. Friends as one squad get the squad's size, so a trio is
  3. Squads against each other, or solo, get up to 8. Start now still starts with fewer. The dropdown is hidden
  for a battle royale.
- **Checked:** the new e2e section `skfriends`, which failed before the fix and passes after: all three are in,
  3 players, 2 friends connected.

*Done (Milestone 231).*

### A15. Movement: sprint about twice as fast, always sprinting if Hyper Scape had no walk, a slide just above it (added 2026-09-27)

- **The owner:** sprint should be about twice as fast. Check whether Hyper Scape even had a walk mode; if not,
  always sprint. Adjust the slide to match: only slightly faster than sprinting, using Hyper Scape's values if
  they are known.
- **Now:** SpeedKills sprints at 275 hu/s (7.0 m/s). A slide boosts to at most 400 hu/s (10.2 m/s).
- **Plan:**
  - Research Hyper Scape's walk, sprint and slide from sources (started 2026-09-27).
  - Set sprint to about twice today's, with the source or the owner's number beside it.
  - Make movement always sprint if Hyper Scape had no walk.
  - Retune the slide to sit slightly above the new sprint.
  - Recheck the movement checks (tools/checks), the movement lab's gaps and climbs, the city's canyons, the jump
    pads' landings (their throws are solved from gravity, not run speed) and the bots' walk.

### A16. Switching guns quicker, and quicker again with each level (added 2026-09-27)

- **The owner:** switching between guns should be quicker as a base, 1.5 or 2 times, and level up along with
  damage and magazine, so a level 5 SMG swaps quicker than a level 1.
- **Done:** a gun's draw and put-away times are 1.5 times as quick as found and twice as quick at level 5,
  falling each level (speedkills.json `fusion.gun[].swap`). ZEPHYR draws in 0.40 s as found and 0.30 s at level
  5, where it was 0.60. `tools/checks/ttk.ts` holds it.

### A11. The main menu too narrow, and scrollbars in our colours

- **The owner:** the main screen's menu is not wide enough and shows a horizontal scrollbar. All scrollbars
  should be our custom colours.
- **Found:** `index.html`, `.menu { width: 780px; ... overflow-y: auto }`. A row wider than that makes the
  horizontal bar. No scrollbar is styled anywhere.
- **Fix:**
  - A wider menu, with the wide row found and made to fit, so there is no horizontal scroll at any window size
    from 1280 wide up.
  - Every scrollbar in the page styled in SpeedKills' colours (`scrollbar-color` and `::-webkit-scrollbar`).
- **Done when:** an e2e check finds the menu's scroll width no wider than its box at 1280, 1920 and 2560, and
  every scrolling panel with the custom scrollbar. A snapshot shows it.

*Done (Milestone 232).*

### A12. After a match, a SpeedKills range

- **The owner:** after winning the battle royale it goes back to the BOOG range (the legacy one). Redress it in
  SpeedKills' style:
  - keep what it has, but block it off about 20 m in, so it is a sandbox;
  - guide the player to the two courses and to the TV that explains the README;
  - the new abilities work there.

  A quick reskin and a smaller area is fine for now.
- **Where:** the range (`range.ts`), the return after a match (`main.ts`, setRegion "range"), the courses
  (`course.ts`, `courses/`) and the TV (`readmetv.ts`).
- **Fix:**
  - In SpeedKills the range takes the city's night materials and neon.
  - A lit barrier about 20 m in (a config number).
  - Markers and signs to the two courses and to the TV.
  - Both hacks usable there.
- **Done when:** an e2e check after a match finds you in the SpeedKills range, can't go past the barrier, finds
  the markers, and uses a hack. Snapshots show the reskinned range.

*Done (Milestone 233).*

### A13. Memory: SpeedKills and legacy kept apart (done)

The owner's rule, saved in memory on 2026-09-26: everything is SpeedKills unless legacy is named.

### Every point of the feedback, and the item that covers it

| The owner said | Item |
|---|---|
| left arm in the red dot and sight area | A3 |
| main menu not wide enough, a scroll bar at the bottom | A11 |
| all scroll bars in our custom colours | A11 |
| gun names with a quick description, "USSO (Fast SMG)" | A7 |
| the slam barely goes up, 10x higher in Hyper Scape; look into the other abilities exactly, do not assume | A9 |
| the slam and heal boxes bigger | A6 |
| all compact at the bottom; gun names and levels left of the ammo; abilities right of the health, slightly down and right | A6 |
| health bar twice as big, ammo at least 1.5x | A6 |
| slight black outlines on all UI | A6 |
| can't loot, can't fuse, can't change guns (after "land with your loadout") | A1 |
| damage numbers with long decimals | A2 |
| remove the smoke grenade, keep it in legacy | A10 |
| memory distinguishes the two games; everything is the new one unless stated | A13 |
| a loot UI comparing the floor gun with ours (level, stats, ammo), default verbose and compact | A8 |
| after winning, back to the BOOG range: reskin, block it about 20 m in, guide to the two courses and the README TV | A12 |
| the old map visible from the dropship; are both rendered, does it hurt performance | A5 |
| the map's edge vague; 40 m out, a 5 s termination timer, a big red laser that fills your view, told you died out of bounds | A4 |

## Part B: after the playtest fixes

### Where Phase 19 ended

Live on fpsfun.duckdns.org and Pages at e4971df:

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

### If something breaks, where to look

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

### A measurement not to trust yet

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

### Ranked next steps (proposal)

1. **A frame-rate number to trust, and the first lead.**
   - The bench takes the median of several runs, run interleaved A/B since the owner may be using the PC.
   - SpeedKills gets a floor in fps per preset for its street and roof views, checked before a release. Smooth
     was the first thing Hyper Scape was.
   - The first lead, from A5's diagnosis: every figure's skinned meshes skip frustum culling. That costs about
     324 draw calls and 980k triangles a frame for 27 bots.
2. **The guns' pace: the owner's call.** They draw in 0.6 s and aim in 0.31 s, from the legacy data, and no
   public source gives Hyper Scape's numbers. The rest of Phase 19's step 10 follows the decision.
3. **The free Quaternius kits,** downloaded and added (already agreed): trees and planters on the streets, and
   props for the interiors, so the rooms differ (Hyper Scape's reviewers called its rooms all the same).
4. **Bots, further:**
   - the pads outside the centre and the highway on their graph;
   - a bot's whole walk to the capture zone checked end to end. Today the plan and the pad ride are checked,
     not the full climb.
5. **A second Hyper Scape gap pass,** from snapshots of the live build set beside its screenshots.
6. **Open items from before:** the host-migration flake, and the guns' look (the owner's call).
