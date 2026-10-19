# Gap analysis: the Neon City against Hyper Scape, Apex and Empulse

The owner, 2026-10-18: a gap analysis of the map against Hyper Scape, Apex and Empulse, the most important gaps built,
why and how, and the rest listed as nice-to-haves. This is the map's part. How an enemy reads from your view (third
person, the enemy's look) is the lobby agent's part of the same request.

## What each one does with its map

- **Hyper Scape, Neo Arcadia** (Ubisoft, 2020). A fully urban battle royale map whose fights live on the roofs; its
  designers said the verticality is the point. It has seven districts (more in the Season 3 redesign, "more identifiable
  zones"). There are jump pads and double jumps from streets to roofs. Landmarks such as Red Tiger hold the best and
  fastest-respawning loot. The crown is the late-match objective. The common criticism: buildings looked alike, so it
  was hard to find your way.
- **Apex Legends, E-District** (Respawn, Season 22; its first night map). It is dense and vertical, with "the most
  playable space of any map" in multi-layered buildings and little open ground between its 17 places. Its ways up are
  jump towers and gravity launchers between places, and ziplines up buildings. Apex as a whole adds vaults and
  high-tier places for loot, doors on most buildings, and a named, distinct landmark for every place.
- **Empulse, Freehold** (1047 Games, early access 2026). A 6v6 movement shooter in one city. Every district is built to
  "give you the surfaces, the verticality and the routes to chain together movement": walls laid out for wall-running,
  grapple and Holojump routes, and "no single correct path through a fight". It has mechs as objectives, and P.A.I.N.T.
  bombs that change surfaces.

## The gaps, ranked by what they cost a match

| # | Gap | What they do | What SpeedKills had (map v94) | Fix |
|---|---|---|---|---|
| 1 | **Open ground with no head-high cover** | Apex's places have cover everywhere at street level; Empulse lays out routes, not plazas | 6 to 21% of each district's open ground was more than 8 m from cover a body hides behind (the districts' review: "shotguns and SMGs have no way to close the distance") | **Built, Milestone 660** |
| 2 | **No best loot in the districts' landmarks** | Hyper Scape puts the best loot in its landmarks (Red Tiger); Apex in high-tier places and vaults: it is why you drop somewhere | Loot sites, the richer spots, stood only in the centre (the four decks, the lobby, the four corner blocks, THE VAULT); the eight districts' landmarks had none | **Built, Milestone 661** |
| 3 | **Few buildings to walk into at street level** | Apex has doors on most buildings; Hyper Scape has shops on every street | The centre has four walk-in buildings and the halls; the reviewers ask for shopfronts first | Planned, 673 (shopfronts) |
| 4 | **Nothing to stand on between the low and the high roofs** | Hyper Scape's roofs are islands a jump apart; Empulse lays routes up a district | Corner roofs 12 m, High City roofs 27 m, the lookout 49 m, and little between | Planned, 675 (a 16 to 20 m tier) |
| 5 | **Districts told apart by one colour, not shape** | Every Apex place has its own silhouette; Neo Arcadia 2.0 was redesigned for "more identifiable zones" | Five districts share the High City window grid; two scored 3/10 | Planned, 664 to 670 (THE WORKS, THE TERRACES, THE STRIP, LANTERN ALLEYS, GLASS HEIGHTS, THE CANYON) |
| 6 | **Wide empty ground between buildings** | E-District has "virtually no space between places" | LANTERN ALLEYS' houses far apart, the north-east and south-east bands open | Planned, 667 and 660's cover |
| 7 | **No long rotation launchers** | E-District's jump towers and gravity launchers throw a squad between places | Pads throw you onto the next roof only; across districts you run | Nice-to-have (below) |
| 8 | **Few walls laid out for wall-running** | Empulse builds its routes from runnable walls over gaps | Wall runs happen where walls happen to be | Nice-to-have (below) |
| 9 | **Night readability from the air** | E-District, a night map, reads by its neon from the dropship | Only THE STRIP and the fence read at night from the air | Planned, 671 |
| 10 | **The map ends in fog** | Apex maps stand in a world (a horizon, a skyline) | A red fence, then fog: "a diorama" | Planned, 672 |

## What is built, why, and how

### Milestone 660: head-high cover in every open district space (gap 1)

- **Why first:** it was the districts' review's first ask, and the gap a fight feels at once. A shotgun or an SMG
  cannot cross 15 m of open ground under fire.
- **How:** the street cover's farthest-point fill, extended over the band past the ring road. It covers the ground,
  THE TERRACES' tiers and GLASS HEIGHTS' deck, with each district's own pieces: machinery in THE WORKS, food stalls in
  LANTERN ALLEYS, ticket machines at THE TERMINAL and so on.
- **What it keeps clear:** each district's own walks and the names' views.
- **Measured:** every district's open ground now has head-high cover within 8 m, the farthest spot 8.3 m (before, up
  to 21% past 8 m and spots 16 m out). The check measures the bake's own collision.

### Milestone 661: the best loot in every district's landmark (gap 2)

- **Why:** a place is worth dropping on for what it holds. Hyper Scape and Apex both make their landmarks the rich
  places, which spreads the drop and gives each district a reason to be fought over. The districts each had a landmark
  but no loot of their own beyond their sector's spread.
- **How:** a loot site at each district's landmark, in the map's own list (`game.sites`). The loot code already rolls
  sites as richer spots, the way it does for THE VAULT and the corner blocks. The landmarks:
  - LANTERN ALLEYS: its courtyard;
  - THE TERRACES: its top tier's rooms;
  - THE TERMINAL: its station hall;
  - THE STACKS: the capsule hotel;
  - GLASS HEIGHTS: its front deck;
  - THE STRIP: the club;
  - THE CANYON: its market floor;
  - THE WORKS: the block hall.
- **Checked:** each site's loot lands on its landmark's floor in a real match.

## Nice-to-haves, in order

1. **Rotation launchers between districts** (Apex's jump towers and gravity launchers): one per district edge,
   throwing a squad toward the centre or the next district, so a squad caught by the decay has a way out that is not a
   run. Needs a long throw in the pads' code (brplay.ts), so it is shared with the lobby agent.
2. **Wall-run lanes** (Empulse): on the main routes, runnable walls laid over the gaps between roofs, with a double
   jump at the end. They chain a district's roofs without pads.
3. **Grapple anchor points**: SpeedKills has a grapple hack. Lit anchor points on the tall faces (THE CANYON's cliffs,
   GLASS HEIGHTS' tower) would show where it pays.
4. **Vault rooms behind a door** (Apex's vaults): one locked room a district, opened by a key found in the match.
   Needs a key item in the loot code.
5. **A district objective** (Hyper Scape's crown, Empulse's mechs): the late-match capture zone exists. A mid-match
   event on one district (a supply drop on its landmark) would pull squads in.
6. **Surfaces that change** (Empulse's P.A.I.N.T.): game code, not map. Noted for the lobby agent.
7. **Loot seen from afar**: the beams over epic and legendary loot are there; a district landmark's light could pulse
   while its site holds loot. Game code, shared.
