# The firing range rebuilt from the Neon City

The owner's ask, 2026-10-18, after playtesting the tutorial:

> We should redo the range so that nothing is the old UI anymore, its all built off the city. It shouldn't be big
> though, like i enjoy how we can load into the firing range and the tutorial rather quickly so reuse certain elements,
> don't have too many soldiers and don't get too creative it should just be like a section on the map already and then
> have our range stuff setup for it (moving targets plus all the guns and hacks and descriptions + TVs that we used to
> have. so you can keep the TVs unless there is clearly a better version in the bundle that you can replace them with.

## What it is

The range becomes a street of the Neon City at night, the size it is now (68 m across, 117 m from the gate wall to the
far end), with our range set up in it.

- **The street:**
  - The lanes are the road: the city's own asphalt and road marks down the middle.
  - Sidewalks run either side, the city's tiles.
- **Its sides:** the bundle's fake buildings, which are made to stand along a street (BuildingFake00 to 07, 21.5 m
  tall, 5,500 to 21,000 triangles each).
  - Their fronts are where the range's side walls are, at x plus and minus 34.
  - At the ground floor, the bundle's shop fronts with their lit awnings (BuildingFake07_Facade).
- **Its far end:** a building across the street, the README TV on its front where the backstop's is now.
- **Its near end:** the wall with the three gates (THE RUN, the tutorial in, the tutorial out) as a building's ground
  floor, each gate a lit doorway.
- **Above:** the night sky, open, as the battle royale's. No warehouse roof and no canopy.
- **Lights:** the bundle's street lights, and its English neon signs only (the pack's foreign letter signs are read
  first; the banned list stands).

## What stays

- **Every gun and every hack** on their stands along the gate wall, each with its hologram and its screen of numbers
  (armory.ts).
- **The moving targets** on their two rails, and the target banks.
- **The TVs:** the README screen at the far end. The bundle's screens are adverts, not a better screen to put ours on,
  so ours stay.
- **Fewer dummies:** four standing, from 8, and the two on the rails. All are the range's own Dummy.
- **The spawn** where it is, facing down the street.

## What goes

The movement practice is the tutorial's and the movement lab's now. It goes, with the old look:

- the bays' dividers;
- the cover row;
- the two side platforms with their stairs, ramp, railings and ladders;
- the wallbounce wall and its recipe sign;
- the mantle ledges;
- the warehouse roof, the canopy over the stands, its pillars and fascia, and the floodlights.

## Loading

- **Its own small file,** as the tutorial's is (`range-v<N>.glb`, its textures at 512 and normals at 256, a few MB),
  baked by `tools/range-dress.ts` from `src/config/rangedress.json`. It is loaded first, before the tutorial's.
- **Until it is in,** the range's plain boxes stand in its place, in the night palette.
- **The colliders are the range's own,** its walls where the building fronts are.
- **The city's 155 MB file is not needed** for any of it.

## Order

1. A plain range: the old look and the movement practice out, the walls, floor, gates and stands as boxes in a dark
   street palette. The e2e's range checks moved off what went.
2. The dressing: the street, the buildings, the gate wall, the lights and signs, from its own file.
3. Photographed from the spawn, down the street, from the far end back, at the stands and at each gate. Then shown to
   the owner.

## Shipped

Milestone 691: steps 1 to 3 as above, with one change from the plan. The sides are blocks dressed in the bundle's own
window materials, not its buildings. The buildings' prefabs bring scores of materials each (142 materials, 14 MB in a
try), and the range's file had to stay small: it is 2.9 MB.
