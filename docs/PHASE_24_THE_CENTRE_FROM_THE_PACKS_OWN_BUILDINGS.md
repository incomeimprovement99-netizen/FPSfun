# Phase 24 results: the centre rebuilt from the packs' own buildings

The round planned in `docs/PHASE_24_PLAN_THE_CENTRE_FROM_THE_PACKS_OWN_BUILDINGS.md`, item by item as each ships.
Started 2026-09-28.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 24.1 | All five demo streets baked, their textures whole | shipped with 24.3 | 298 | the importer placed only the overrides it could match by mesh or by slot count, so High City's brick came out grey; the Unity specular workflow read (spec map, gloss); KTX2 textures with the extension registered |
| 24.2 | The packs' buildings, cut out of their demo streets | shipped with 24.3, changed | 298 | cut as facade strips, not buildings: the demo streets are film sets, faced only where the camera looks, so a whole building cannot be lifted but a face can (below) |
| 24.3 | Towers that are stacks of the packs' buildings | first part shipped | 298 | 44% of the centre's street faces wear the demo streets' strips, stacked up each face in columns; the canyons keep pressed modules |
| 24.1b | The overrides the importer could not place | next | | 1,645 left grey parts (the flying cars' engines, the High City cars' bodies, bits of strips) |
| 24.4 | The ground floor inside | after 24.1b | | |
| 24.5 | Light and air, and the old look gone | | | |
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
