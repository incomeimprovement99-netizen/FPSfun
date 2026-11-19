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

## C. Batch 16, from the fourth layout reviews (version 148: 5.5 and 5.5, the ending 5 and 5)

Both reviewers, each without the other (docs/LAYOUT_REVIEW.md round 4): the centre's ending is watched from above by what
it does not count; a contest freezes the meter and nothing makes it end; the four edge zones are still one flat-roof
fight; the centre has 22 m of wall to run where half the matches end; the ring road wants cover, not only crossings.

0. **dress16, the new structures finished, first (Milestones 1192 and 1193).** The picture review of the same version
   (docs/CENTRE_REVIEW.md round 26) scored the centre 6.0 where round 25 on version 144 gave 6.4: batches 13 to 15's decks,
   terraces, gantries and hoardings are thin tinted floor tiles and wall panels on lattice legs, "greybox beside the pack's
   art", and seen edge on a deck is its lit edge strips alone, bars in the air (day-26). Each in the pack's own metal and
   floor materials with a fascia and beams under it and one lit edge strip of colour, every hoarding framed down to what
   it stands on, each quarter's in one colour family with its corner block; the unsupported and leaning pieces and the odd
   materials it names put right. The play changes below follow, renumbered after it. One proposal agent, judged by pictures
   as well as the checks.
1. **A contest that ends (the rule, no bake), Milestone 1191.** Once a zone has been contested for 8 s running
   (decay.json `capture.reveal`), every body in it, inside its circle and its heights, is shown to every player who stands
   in it too, by the game's own reveal (the red glow SCOUT's scan and SMOKE's passive use), until the contest ends (H). It
   makes the squads in the zone fight instead of hiding on its three floors. G's other way, the squad with more bodies in
   ticking at half rate, rewards numbers over the fight, and is left.
2. **centre16, the deck under the tower, Milestones 1192 and 1193.** A lid at about 16 m over the deck's north half (G),
   so a body on the deck has cover from the tower's floors and the base's annex; the tower's and the annex's openings that
   look onto the deck shut from 13 to 40 m (G); 4 m walls to run along on the backs of the Loop's kiosks, chained onto the
   deck (H); nothing a body stands on over the zone's 13 m that sees the deck. One proposal agent.
3. **roofs16, the four edge roofs as two levels, Milestones 1194 and 1195.** On each, a raised platform at 31 to 33 m and
   a lower level at 24 m (a sunken court or the block's top floor opened, both inside the band), and 8 to 10 cover pieces,
   each roof laid out its own way (G and H); W first (the worst: nothing lands inside its circle from the street side). One
   proposal agent.
4. **ring16, cover over the ring road, Milestones 1196 and 1197.** Roofs at 4.5 m over its pavements on the south and
   west legs (G) and over its north leg and south-west corner (H), and walls down its middle where the carriageway is
   widest (G). One proposal agent.
5. Then, smaller and left for after a fifth review: the north-west's west spoke under canopies, the outer band's roof
   routes cleared, leaps to the south-east's dead islands, something to drop for in THE TERRACES and the CAPSULE HOTEL, a
   kiosk and a hoarding half way down each spoke.
