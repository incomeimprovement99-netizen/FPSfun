# The endings: what counts in a zone, and the edge roofs and the centre's deck to fight on

From the third layout reviews asked again with the zones where they open (docs/LAYOUT_REVIEW.md, round 3 and its
correction): the ending 6 and 5.5, the map 5.5 and 5.5. The corners are the best endings on the map and stay as they are.
Two faults are the rule's, two the map's.

## The rule as it is

The final sector is the centre half the time, else one of the eight outer sectors (decay.json `finalCentre`). When only it
is left its zone opens at the sector's own `middle` (neonmap.json game.sectors, decay.ts centreOf), 14 m round
(`capture.radius`), and counts a body at any height over the circle (brmatch.ts updateCapture reads x and z). A side alone
in it for 45 s wins; two sides in it and neither's meter moves.

## A. The rule (no bake): Milestones 1182 and 1183

1. **A zone counts only its own heights.** Each sector names a band in game.sectors, `band` [lowest, highest] metres, and
   a body counts only with its feet inside it; a sector with none counts every height, as now.
   - The centre: -8 to 13 m. Its circle reaches 2 m inside the tower's north wall, and the bots' graph has nodes on the
     tower's floors from 45 to 110 m inside it (measured, version 147): a body in a north room at any height counts. The
     band keeps the court under the base (7 m down), the street and the 6 to 12 m deck, where the fight is.
   - The four edge sectors (the High City blocks): 24 to 36 m, the roof (26 to 27 m) and High City N's drum. Their circles
     hang over the street at the block's foot (19 and 24% of s and e) and over the blocks' rooms, so a squad 27 m below
     by the pads, or one body in an office under the roof, freezes the roof's meter.
   - The corners: every height (both reviewers: keep them).
   - The bots: the node they aim for in each zone is already inside these bands (the edges' at 26 m, the centre's and
     three corners' on the ground, THE WELL's at 7.5 m). The map's check of the bots' way to each zone also asks that.
2. **A body counts after 2 s in the zone** (decay.json `capture.settle`): a sprint through, or a pad's throw over it, no
   longer freezes a held meter (E). F's other ask, a contested meter that drains, is left for a review to judge after this.

Checked: the map's check of the bots' way to each zone holds the target node inside its band; a check that every tower
floor in the centre's circle is outside the centre's band; the speedkills e2e section (its capture tests), verify, rules,
tsc. Shipped as a config and code release, no bake.

## B. The map (a bake, version 148): Milestones 1184 and on

1. **The four edge roofs as places to fight**, one proposal agent at a time: inside each zone three or four structures
   about 3 m tall (the pack's roof kit: vents, plant rooms, a stair head), so a holder has corners and an attacker a
   landing out of sight; the ways up that land on each roof (its pads, lift, stack) set behind them; a second way up onto
   s, e and w, landing inside the zone (E and F). Not on the bridge ring's walks or the High City climbs' decks.
2. **The centre's deck north of the tower**: cover on it and two walls 7 m tall to run along (both), and a ledge ring or
   balconies at 12 to 16 m round the base (E).
3. **Decks across the ring road** at 9 to 12 m at four points (both): its 78 to 95% exposure is the way in to every
   outer ending.
4. After a fourth layout review on version 148: the north-west's inner streets roofed, MARKET's west spoke decked, ways
   up in the west band, THE CANYON's plate.

## The result (version 148, 2026-11-19)

Part A shipped on version 147 as Milestones 1182 and 1183; part B as Milestones 1184 to 1190, baked as version 148
(docs/DEVELOPMENT_ROADMAP.md has each number). Built as planned: the four roofs' pieces with the arrivals hidden (26 of
34) and a second way up onto the west block; the centre's deck panels and two run walls; four decks across the ring road.
Changed on the way: the deck's walls are 2.4 m, not 7 (a 7 m wall's top overlooked the zone from outside it, where a body
does not count), and no ledge ring round the tower's base (for the same reason); a second way onto e did not fit beside
its pad (its fire escape steps off inside the zone already). Not met: the ring road's exposure, 91 to 90% (the decks are
routes, not cover). Next: the fourth layout review and a picture round on version 148.
