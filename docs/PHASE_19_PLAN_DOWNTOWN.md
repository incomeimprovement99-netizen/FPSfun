# Phase 19 plan: the downtown, and the rest of the way to Hyper Scape's feel

**Written 2026-09-26**, from the owner's ask: "the 1v1 and other modes are just sub stuff to help the user learn.
Continue on making the map, focusing on the center and expanding out, all downtown futuristic verticality.
Then continue on the gap analysis between Hyper Scape and SpeedKills ... rank the next steps to get there,
implement them in that order."

## What Hyper Scape was (sourced)

I could not watch video; I read the reviews and the developer's pages, and looked at eight official press
screenshots (saved locally, not in the repo). No public source gives Hyper Scape's movement numbers, so the feel
is matched to what reviewers said, not copied.

- **The city.** Neo Arcadia was one square kilometre, "100% urban", nine districts each round a landmark
  monument (Ubisoft Montreal; PowerUp). "One big concrete jungle sliced up by districts and surface streets"
  (PC Gamer). "Most buildings are at least three stories, and stairways and jump pads ensure you almost always
  have a means of accessing their rooftops" (GameSpot). The centre, Red Tiger, was the busiest drop.
- **The screenshots:** dense mid-rise blocks packed wall to wall, their roofs a patchwork of heights; narrow
  streets two lanes wide with pavements; skybridges over the streets; curved elevated tracks on the roofs; jump
  pads drawn as gold rings floating on a beam of light, readable across a district; landmarks (a round
  cylinder tower, a dome, industrial silos) that give each district a face; a low golden sun and haze, the far
  skyline fading into it with floating cyan hologram glyphs.
- **Movement:** "a generous double jump, precise air control, and jump pads on every city block that can
  quickly send you to the clouds" (PC Gamer); an "aggressive slide" and a ledge grab with "a real sense of
  momentum" (GameSpot); no fall damage (Engadget, GamingTrend).
- **Fights:** "any floor lower than a rooftop might as well be lava" (PC Gamer); fights move from roof to
  street "in a flash" (Push Square).
- **Criticised:** samey districts that were hard to navigate (GameSpot, Game Rant), floaty guns and a long
  time to kill (PC Gamer, IGN), no wall clamber (PC Gamer).

## Where SpeedKills stands

Already matched: sector decay to a capture zone, ten hacks with fusion, fused guns, the Gulag and the ghost,
no knockdowns, health that comes back, infinite ammo, 30 players, the double jump, the wall run, a climb (the
wall clamber Hyper Scape lacked), no fall damage (a landing stun only), a 1.5 s time to kill (shorter than
Hyper Scape's, on purpose).

The gaps, from our own pictures against theirs: the city was an office park, not a downtown (a building or two
a block, wide empty streets, flat identical boxes); few pads and none up to a roof; nothing between the street
and the roofs; no landmark in any district but the centre; murky, monotone night; nothing on the streets.

## The ranked steps

In this order, each built, checked, documented and committed before the next:

1. **The downtown core (the Spire and the eight blocks round it).** A podium over each block, towers on it
   split by canyons a double jump clears, roofs that step up in storeys, clutter on the roofs, a jump pad on
   every block up onto its podium and one on its terrace up to a roof, and the Spire in tiers with a pad up
   each. *Started 2026-09-26.*
2. **Jump pads you can read from a street away:** a gold ring floating over a beam of light, as Hyper Scape's,
   on every pad; the pads on every block of the city, not only the core.
3. **The downtown outward:** the middle ring of blocks as dense mid-rise (several buildings a block, wall to
   wall, roofs of different heights you can run across), then the edge ring as low dense blocks and an
   industrial edge.
4. **A landmark per district:** eight, each a different shape (a cylinder tower, a dome, silos, a stadium bowl,
   a hall, a garden terrace, a crane yard, a monorail station), so every district has a face and a name you can
   navigate by (the thing Hyper Scape was criticised for lacking). *Done 2026-09-26 (Milestone 211).*

The owner re-ranked after step 4, calling the next two key: the centre must be the most detailed place on the
map and big, as Hyper Scape's Red Tiger was, and the streets must be buildings you climb by their stairs, with
loot inside, so a player who lands with nothing can reach the roofs without a pad. Before deciding any of it
needs bought assets, the free ones are searched again (the players' models were found free after being called
unavailable). The old steps 5 to 9 follow these as 7 to 11.

5. **The centre as a district of its own (Red Tiger).** The Spire's block and the eight round it made one big,
   dense complex: a lower concourse you walk inside, mezzanines and bridges between the towers, stairs as well
   as pads between its levels, the most loot and the most detail on the map, and the capture zone's fight in
   it.
6. **Streets of buildings you climb by their stairs.** The mid-rise blocks entered from the street: a door, a
   stair up through every floor to the roof, loot on the floors and landings, so the way up needs no pad and
   no gun. The pads stay as the fast way. *Done 2026-09-26 (Milestone 212), before step 5 while its research
   ran.*
7. **The rooftop highway:** an elevated track looping the downtown's roofs, walkable, with pads onto it: a fast
   way across the city above the streets.
8. **Atmosphere and readability:** the night made beautiful rather than murky (a glowing horizon, haze with the
   districts' colours in it, lit streets, hologram glyphs over the skyline), and a golden-hour sky as a setting,
   the owner's night staying the default.
9. **Street life:** parked cars, planters, trees, canopies, crossings, shop signs: cover at street level and a
   city that looks lived in.
10. **Feel in the fight:** a red outline on the enemy you aim at, speed streaks when running fast, weapons that
   snap to hand, hit feedback checked against Hyper Scape's weakest points (floaty guns).
11. **Bots in the new city:** bots onto the podiums and terraces (the graph up the podium stairs), and the
   capture zone contested by them when it opens on the Spire.

Each step keeps the city's budget check, the bots' walk checks and the e2e passing, measures the frame rate,
and ends with snapshots from the street, a roof and the air.

## Red Tiger, and the buildings round it (research, 2026-09-26)

Sourced:
- **Red Tiger** stood "bang in the centre of the map": "a fancy-looking French-style selection of buildings",
  "probably the busiest of all drop spots", with "fantastic loot" (Gfinity). It was climbed by its roofs and
  jump platforms, and had rooms to hide in. In Season 3, weapons and hacks "quickly respawn at the Red Tiger
  landmark" (patch notes). No source gives its size or how many floors it had.
- **Its neighbours:** M.O.N.A., "the biggest building on the map"; Limelight, "a big cylindrical building
  that's full of loot"; T-Loop; Throne Hall; Tora Garden, between Red Tiger and Throne Hall.
- **The districts** each had "a central reference point called a landmark", with "lots of equipment as well as
  enemies". You looted the buildings round a landmark first, then went to it (Ubisoft Montreal).
- **Ordinary buildings:** "Most buildings are at least three stories, and stairways and jump pads ensure you
  almost always have a means of accessing their rooftops" (GameSpot). Only about a tenth had interiors, marked
  by orange barriers over their doors and windows, and those were "the same non-decorated rooms" (Gamereactor).
  "Start from the tops of buildings and loot downwards" (Gfinity).

What this means for us:
- The centre should hold the best loot, and the most of it, restocked as the match goes.
- Every building needs a way up that is not a pad.
- More of ours can be entered than Hyper Scape's tenth, with rooms that differ from one another.

## Free assets (research, 2026-09-26)

All CC0, which allows a public web build:
- Quaternius Modular Sci-Fi MegaKit (a free tier of walls, floors, doors, columns and props on a grid);
- Quaternius Cyberpunk Game Kit (71 models: doors, loot boxes, street lights, terminals);
- Kenney City Kit (Commercial) and City Kit (Roads);
- Quaternius Cars Bundle and Kenney Car Kit;
- the Quaternius Stylized Nature MegaKit (trees);
- the ambientCG facade materials and all of Poly Haven.

The two Sketchfab night-city models are CC-BY and need a credit. A paid store's "royalty free" licence usually
forbids shipping the raw files, which a web build does. So nothing in steps 5 to 11 needs bought assets. The
kits are for detail: props, doors, cars and trees, with a glowing underside for hover cars. The city's shapes
stay built in code, where the checks can measure them.

## Sources

- https://powerup-gaming.com/hyper-scapes-map-is-100-urban-one-square-kilometre/
- https://montreal.ubisoft.com/en/hyper-scape-ubisofts-first-battle-royale/
- https://www.pcgamer.com/hands-on-with-hyper-scape-ubisofts-urban-battle-royale-shooter/
- https://web.archive.org/web/2020/https://www.gamespot.com/reviews/hyper-scape-review-scape-from-the-city/1900-6417530/
- https://www.windowscentral.com/hyper-scape-review
- https://www.ign.com/articles/hyper-scape-review
- https://www.engadget.com/ubisoft-battle-royale-hyper-scape-twitch-beta-key-172241694.html
- https://gamingtrend.com/previews/hyperspeed-hyper-scape-preview/
- https://www.pushsquare.com/news/2020/08/hands_on_hyper_scape_might_be_too_chaotic_for_its_own_good
- https://techraptor.net/gaming/previews/hyper-scape-preview
- https://hyperscape.fandom.com/wiki/Neo_Arcadia (press screenshots from its image host)
