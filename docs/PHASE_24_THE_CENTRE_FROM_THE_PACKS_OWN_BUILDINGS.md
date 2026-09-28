# Phase 24 results: the centre rebuilt from the packs' own buildings

The round planned in `docs/PHASE_24_PLAN_THE_CENTRE_FROM_THE_PACKS_OWN_BUILDINGS.md`, item by item as each ships.
Started 2026-09-28.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 24.1 | All five demo streets baked, their textures whole | shipped with 24.3 | 298 | the importer placed only the overrides it could match by mesh or by slot count, so High City's brick came out grey; the Unity specular workflow read (spec map, gloss); KTX2 textures with the extension registered |
| 24.2 | The packs' buildings, cut out of their demo streets | shipped with 24.3, changed | 298 | cut as facade strips, not buildings: the demo streets are film sets, faced only where the camera looks, so a whole building cannot be lifted but a face can (below) |
| 24.3 | Towers that are stacks of the packs' buildings | first part shipped | 298 | 44% of the centre's street faces wear the demo streets' strips, stacked up each face in columns; the canyons keep pressed modules |
| 24.1b | The overrides the importer could not place | shipped | 299 | 1,645 unplaced to 1,020 (matched by the materials' names, then by elimination); the flying cars' engines by their model's name; Competitive's file without the strips, 91 MB to 44 |
| 24.4 | The ground floor inside | first part shipped | 299 | the eight centre podiums opened into halls at street level: 85 doors, columns and counters for cover, an arcade of shop fronts, the bots' graph and loot of their own |
| 24.5 | Light and air, and the old look gone | in progress | 298, 300 | the haze (298); the pads as vents in the floor, the pack's round vent over each grate, a slim beam, one ring (300) |
| 24.6 | The release tests | | | |

## Notes as it goes

- **24.2, buildings first:** `CITY_BUILDINGS` cut each demo street by rasterising its wall parts onto a 2 m ground grid
  and taking connected cells as buildings. High City's street came out as one blob: its buildings touch along the whole
  street, and the film set has no backs or sides to separate them. Abandoned for faces.
- **24.2, faces:** `CITY_FACADES` finds the wall modules (a storey tall and more, wide one way and thin the other),
  takes each one's facing from its triangles' normals and which side has less wall mass (the street's), groups them by
  plane, runs along each plane where the modules meet, cuts runs into strips of about 14 m at module edges, and hangs
  on each strip everything that stands up to 4 m in front of it: balconies, fire escapes, pipes, AC units and signs, as
  the pack's artists placed them. Each strip is baked in its own frame, x along the wall, y up, z out of it.
- **24.3, the first pass:** a street face split into columns as wide as its family's strips, each column a stack of
  strips from its foot, each scaled near its own proportions and to a whole number of storeys, so neighbouring columns
  end at different heights as a street's buildings do. The open storeys (the Sky Lobby's, the Sky Park's, the open
  floors) keep their walls; the modules fill whatever the strips leave.
- **24.3, the first pass looked at:** 23% of the centre's tower faces wore strips, 27% of the street faces. Counting
  what kept the rest: a pad anywhere near a column dropped it for the tower's whole height (26,000 m² of street face),
  a fire escape the same (12,000 m²). And a Kyber tower had holes: the size helper took a strip's measured side for its
  facing, and three of Kyber's strips face sideways by area (their balconies outweigh their wall), so their width and
  depth swapped.
- **24.3, the second pass:** the columns laid in the face's free stretches, a fire escape, a chimney within a strip's
  depth in front of the face (its mouth on the face or its length along it) and a pad's lane cut out of the face with
  half a metre spare; a strip beside a pad further out pressed to stand 0.15 m clear of the pad's column. 44% of the
  street faces. The canyons' faces keep their modules pressed flat: pressing a strip 5 m deep to the canyons' 0.1 m would
  leave its layers millimetres apart, flickering.
- **24.3, the cost:** 3,635k triangles on Balanced, over twice the limit, Kyber's strips 1,417k of it (their heaviest
  157 a square metre, in cables and pipes). Simplified at import (meshoptimizer, every part's edges and every UV seam
  held; measured on Kyber's 29 strips: 530k triangles, 368k at 5 mm, 281k at 10 mm, 214k at 20 mm), at 15 mm, as kit
  v5: 2,786k on Balanced, 2,889k on High. Benched in the street of a match, three rounds interleaved against a copy from
  before the strips: Balanced 137 fps against 182, High 67 against 89. The limits raised to 3,000k and 3,100k, the
  owner's word on the centre being "we want this very detailed center district because that is the focus of the map".
- **Pictures, v5 (2026-09-28):** the streets now read as streets (shop fronts, a traffic light, grey buildings with
  depth and balconies, wet road). Still wrong, in the order the eye finds them: the pads' gold beams dominate every
  view; one billboard piece had no material and showed a blank grey panel (dropped); 1,645 material overrides the
  importer could not place leave parts grey, the flying cars' engines (42k triangles) and the High City cars' bodies
  among them; the districts at the edge are the old boxes (the owner: later).
- **24.1b, the overrides (kit v6):** a prefab's material override names its renderer by an ID newer Unity hashes, so
  the importer placed one only where the model had one mesh, or one mesh with that many slots. Where the counts do not
  decide, it now matches the materials an override sets against the model's own names for its slots, each target to
  its best mesh, then gives a last target the last mesh with room for it: 1,645 unplaced to 1,020. And Competitive, the
  one preset on the `-lo` file, never places a strip, so that file leaves them out: 91 MB to 44.
- **24.1b, the engines (kit v7):** the flying cars' engines (83k triangles) were grey: their part calls for "cars
  detz", which no material is, and no override reaches them. A part whose own name finds nothing now wears the
  material named for its model, its level of detail and side left off ("fly engine L lod0" to "fly engine").
- **24.4, the halls:** each centre podium but the Spire's is a shell 0.35 m thick under a 0.6 m roof that is walked on
  as before, the hall inside 7.4 m tall. Doors 3.2 by 3.4 m (under the shop canopies at 3.6 m), about one per 16 m of
  each face, kept off the corners, the pads, the public stair, and anything more than a step within 4 m in front: the
  first build put three doors behind a bridge's kerb pillar and a metro stairwell's rail, which the new check's walk
  found, so the halls are now built last of the street's things. Inside: square columns on a 10 m grid, five
  waist-high counters from the hall's own stream, lined walls with a line of the block's colour, strips of light in
  the ceiling. The roof shadows the sky's light, and a light of ours per hall would cost every surface in the city,
  so the hall's floor, columns and walls give off a little light of their own.
- **24.4, the game:** the bots' graph has a grid of nodes over each floor and a way through every door to its street
  (218 nodes, all reached from the streets); a bot coming down from the sky never takes a hall's node for its nearest.
  The field's own loot keeps off the halls' floors, so it lands exactly where it did, and each hall gets six spots of
  its own, drawn last on a stream of their own, as the metro's are. From Balanced up the walls are an arcade of the
  packs' shop fronts facing in (107k triangles, kept off Competitive, which sat at its limit); on the street, a bay
  with a door keeps a shop window either side.
- **24.4, checked:** `sk-halls.ts`, new: every hall built, open floor to ceiling but for its cover, its roof at the
  podium's top; through all 85 doors in and out with the real movement; along every podium's roof over its hall; the
  graph; the loot. Proven by leaving the doors uncut (the walk and the graph both failed). `sk-escapes.ts` now tests a
  door against an escape between the escape's foot and roof, as the city places them (a hall's door in the street
  below had tripped it).
- **24.5, the pads:** the first thing the eye found in every picture was the pads' gold: a solid disc 3 m across, a
  beam 0.9 m across at half opacity, two rings. A pad is now a vent in the floor that throws you up: a dark grate
  ringed in the pad's colour (gold, a window pad's blue, a road's cyan), High City's round wall vent turned to face up
  and laid over the grate in the centre from Balanced up (8k triangles), a beam 0.56 m across at 0.3, and one ring,
  at the roof it lands you on. From a roof the pads still read a street away.
