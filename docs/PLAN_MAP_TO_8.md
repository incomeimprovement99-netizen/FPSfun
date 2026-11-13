# The Neon City map to 8: what holds it at 6.4, and what would move it

Written 2026-11-13 by the map agent, on map version 144 (live) with version 145 in the bake. The owner asked for an overall
analysis of the map against shipped maps such as Hyper Scape's and Apex's: how it plays, how it looks, and what would raise
it to 8 of 10, by placement and engagement more than by new features.

This is not another list of items from the reviewers. It measures the map itself, off the collision the game plays on, and
reads those numbers against how the game moves.

## 1. The short of it

1. **The map is judged as an Apex-speed map and played at twice that speed.** The sprint is 14.0 m/s (the owner's change of
   2026-09-26), about twice Apex's or Hyper Scape's. In seconds, the whole 300 m map is as wide as one large Apex point of
   interest. Twenty-five rounds of picture reviewers, who know none of this, have asked for more small cover, and the map
   now has about 1,360 cover pieces at street level, one for every 34 m2 of open ground.
2. **Half the map is open ground, and the high ground sees nearly all of it.** 52% of the play area is open street level.
   In the ring between the tower and the districts, 98% of open spots are in view of ten or more high spots, and 75% are
   in view of forty or more. Small cover does not hide a body from above. The likely result is that fights live on the
   roofs and the dressed streets are crossed in seconds or avoided.
3. **The roofs are a ring and a few plates, not islands.** Three plates hold 41% of all roof area. Only 9% of roof area
   stands between 12 and 20 m, so there is a low tier, a high tier, and almost nothing to climb between them but pads and
   lifts. A sprint jump carries about 11 m and a double jump about 20 m, and the map barely uses either.
4. **The shade renders near black, and the sun's height is not why.** 21% of six test pictures is darker than 30 of 255
   (18% across round 25's 55 daytime pictures). The game lights the city from 41 degrees up at every hour, whatever the
   hour's own sun says: the golden hour paints its sun at 15 degrees, and an earlier version of this document took that
   for the light and was wrong. What is black is what the sun does not reach, every face turned from it and every cast
   shadow, lit by a sky fill that the tone mapping presses toward black, and the dark materials themselves. Raising the
   fill takes the near black from 21% to 13%. This is behind a large share of the "black slabs", "black pits" and "dark
   empty pavement" complaints, and behind the agents adding a glow to every new material.
5. **The review loop is saturated, and nobody has played a match.** The centre has moved from 6.0 to 6.4 in ten rounds,
   about 0.04 a round. The visit log for the last three weeks shows no session longer than 7 minutes and no feedback.
   The picture score is a measure of screenshots. The fun of the map has no measure at all yet.

What follows from that: stop buying 0.04 a round with dressing, settle the light once, and spend the next versions on how the
map plays at 14 m/s, proved on one quarter of the map first and by people playing it.

## 2. What was measured

`tools/neon-mapstats.cjs` reads the bake's collision (147,883 boxes) and the game's floor, and measures on version 144:

| Measure | Centre sector (tower, plaza) | Inner ring (High City, corner blocks) | Outer band (the eight districts) |
|---|---|---|---|
| Area | 10,000 m2 | 30,000 m2 | 50,000 m2 |
| Open street level | 41% | 60% | 49% |
| Street level under a roof | 36% | 9% | 17% |
| Solid mass (not enterable at street level) | 12% | 21% | 25% |
| Longest sightline from a street spot, median | 69 m | 68 m | 60 m |
| Street spots with a 60 m line | 71% | 67% | 50% |
| Best straight free run from a street spot, median | 45 m | 47 m | 47 m |
| Free run averaged over all directions, median | 11 m | 11 m | 11 m |
| Open street spots seen by 10 or more high spots | 94% | 98% | 85% |
| Open street spots seen by 40 or more high spots | 47% | 75% | 42% |
| Open street spots no high spot sees | 0% | 0% | 3% |
| Straight walls to run along (4 m tall, 6 m long, a clear lane) | 22 m | 416 m | 1,149 m |

A "high spot" is 25 m2 of roof or upper floor 6 m or more up. Roofs, measured as islands of open roof 6 m and higher:

- 27,600 m2 of open roof in 99 islands of 40 m2 or more.
- The three largest: THE CANYON's roof plate (4,300 m2), the High City ring's north-east half (4,200 m2) and its south-west
  half (2,700 m2). Together 41% of all roof area.
- By height: 11,100 m2 at 6 to 12 m, 2,500 m2 at 12 to 20 m, 11,500 m2 at 20 to 30 m, 2,000 m2 over 30 m.
- 51 pairs of islands are a level leap apart (2 to 18 m, 2.7 m of rise or less). 44 of the 99 islands have no such leap.

The game's own numbers these are read against (src/config): sprint 14.0 m/s, slide to 16.0, wall run 15.7 to 20 m/s, a
jump of 1.42 m and a second of 1.32 m, a mantle of 2.3 m. A match is about seven and a half minutes: a 60 s grace, four
waves that each delete two of the eight outer sectors, then the centre sector with a 14 m capture zone on the Loop.
Twelve players by default (a trio and nine bots), up to 48.

Also measured: the review pictures. Of the 55 daytime pictures of round 25, 18% of pixels are under 30 of 255 and 37% under
60. The darkest: THE TERRACES from the ring road (d04), 57% under 30.

Limits of these numbers: they are proxies. A roof no body can reach still counts as high ground. Only straight walls are
counted, so the round High City towers are missed. Nothing here is a play test.

## 3. Findings

### 3.1 The speed changes what the map is

At 14 m/s the map is 21 seconds across and a sector is 7 seconds across. Apex and Hyper Scape run at roughly 7 m/s, so
their players see cover 6 m apart as a second of safety. Here it is 0.4 s, and off the best line a sprint meets something
every 11 m, 0.8 s. The closest shipped reference for this speed is not a battle royale at all but a wall-running arena
shooter, whose maps are built from long clean lanes, parallel walls a jump apart, and big cover, with very little small
furniture in the lanes.

The picture reviewers were never told the speed. Their asks ("cover every 8 to 10 m", "stalls every 4 to 6 m", "break the
open square") are right for the games they know and were built faithfully. Whether they are right for this game is
unknown, because the map's movement has no test: none of the 477 map checks mentions a wall run, and there are 22 m of
straight wall to run along in the sector where every match ends.

### 3.2 The street is exposed from above, and small cover does not answer that

Hyper Scape's best-known fault was the same: the roofs owned the streets. Its answer was that almost every building could
be entered within two seconds. Apex's answer is dead ground: high positions that cannot see their own base, few ways up,
and overhead cover on the routes between places.

Here the inner ring, which every rotation toward the tower crosses, is 60% open ground and 9% street-level interior, with
the 27 m High City ring standing over it. A 1.8 m panel throws a 2.7 m shadow of safety against a roof 40 m away. The
places that are safe from above today are the base's hall and the ground under the Sky Ring, the districts' halls, and a
few shops.

### 3.3 Two tiers and a ring

The roofs at 20 to 30 m (the High City ring, THE CANYON, GLASS HEIGHTS' deck) are reached by pads, lifts, ledges and fire
escapes, and that works: the reviewers score flow highest, 6.5 to 7.0. But once up, the High City roofs are one walk, the
bridge ring, cut in two since batch 7. Both centre reviewers of round 25 said it again: the roofs read as a corridor, not
islands with gaps to leap. The movement can leap 20 m and climb about 5 m, and the map has only 2,500 m2 of roof between
12 and 20 m for it to land on. The corner blocks (NOODLE ROW, MOTEL HILL, MARKET, THE WELL) stand exactly where that middle
tier belongs, and their roofs are a handful of small boxes.

### 3.4 The light

Measured on version 145, on six of the review's pictures (02, 05, 06, d04, d11, d22), each option from a fresh page load
(`tools/neon-darkshare.cjs` counts the pixels):

| Option | Near black (under 30 of 255) | Dark (under 60) | Blown (over 235) |
|---|---|---|---|
| As now: golden hour, sky fill 0.75, ACES at exposure 1.05 | 21.2% | 35.4% | 0.5% |
| Sky fill 1.3 | 15.4% | 31.6% | 0.5% |
| Sky fill 1.7 | 13.0% | 28.8% | 0.5% |
| Exposure 1.35 | 16.0% | 31.5% | 0.8% |
| AgX tone mapping | 11.1% | 27.0% | 0.1% |
| AgX and sky fill 1.3 | 8.9% | 22.6% | 0.1% |
| Neutral tone mapping | 24.4% | 39.9% | 0.3% |
| Hazy day | 20.7% | 34.3% | 0.5% |
| The light aimed from where the golden hour's sun is painted (15 degrees) | 27.2% | 48.3% | 0.4% |

- **The sun's height is not the lever.** The city's light does not come from the hour's sun at all. Entering the city
  aims the light by a constant (range.ts `SUN_DIR`, 41.3 degrees up, read off the running page) at every hour; the hour's
  `dir` in sky.json moves only the painted disk. So the golden hour's sun is painted 15 degrees up while shadows fall as
  from 41, about 1.15 times as long as what casts them. An earlier version of this section computed 3.7 times from
  sky.json and was wrong. Aimed from the painted sun the city is darker, not better: 27% near black.
- **What is near black is what the sun does not reach:** faces turned from it, cast shadows, and dark materials. Those
  are lit by the sky fill (a hemisphere light at 0.75 beside a sun of 2.9) and the environment, and ACES' toe presses
  them toward black. Batch 12's agents each measured it in their own corner (container faces at 1, 1, 3; the plaza's
  ground at 1 to 33; hedges at 29, 50, 27) and each answered with a glow on its own material, which then stands out at
  night.
- **The fill is the cheap lever:** one number in sky.json. 1.7 takes the near black from 21% to 13% with nothing more
  blown and the golden look kept. AgX goes further, but it greys the colours of a neon map, and it is the renderer's, for
  every gun and body too.
- **About a tenth stays near black whatever the light,** and THE TERRACES from the ring road (d04) stays between 27% and
  57%: the High City's dark glass and the ring road's dark ground. That is material, and map work.
- **A fault found on the way, and mended (Milestone 1158).** Changing the hour inside a match (F8, or the menu) aimed the
  light by the hour's own direction instead. F8 pressed twice brought the same golden hour back lit from 15 degrees: the
  streets lost their sun, the near black went from 21% to 27% and the dark from 35% to 48%. The light now comes from the
  hour's own sun everywhere, and the golden hour's sun is painted at the 41 degrees the city was always lit from.

For play it matters more than for pictures: a body in black shade is invisible at 14 m/s.

### 3.5 The instrument

Since round 15 the centre has scored 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.25, 6.3, 6.3, 6.4, 6.4. Finish has sat at 5.5 to 5.8
throughout. Each batch costs eight agents and ships forty to sixty item fixes. The reviewers do read the fixes ("finally
read as roofs"), and then name the next items; the total barely moves, because the total is set by things no item changes:
the light, the shadows, the plain towers, the boxes past the fence.

And the pictures cannot see play. The server's log shows the last three weeks: a few sessions, the longest 7 minutes, most
under 3, no feedback left. So every claim about fun, in this document too, is an inference.

### 3.6 Every match ends in the same place

The four waves delete the eight outer sectors and the match ends in the centre sector: the tower, the base, the plaza and
the court, with one of three capture zones on the Loop. The High City roofs are outside it. The last fight is always tower
floors against the plaza. Shipped battle royales end somewhere new each match, and that is a large part of why a map stays
interesting past ten matches.

### 3.7 What is already strong, and should be kept

- The ways up: 40 pads, four lifts, five zip lines, seven fire escapes, ledge stacks. Flow is the best score.
- Places with names and landmarks that fresh reviewers repeat back: THE VAULT, the lower court, NOODLE ROW, LANTERN ALLEYS,
  THE STRIP (7.0 in round 25), THE WORKS' silhouette.
- Loot in tiers with a reason to go somewhere: THE VAULT, landmarks, a hot zone.
- An underground (7,000 m2: the court, the metro, THE WELL) that is safe from above. It serves the south and east only.
- The pipeline: 477 checks that walk the real player, a 15 minute cached bake, proof by putting the fault back.

## 4. The plan, ranked by what it moves

Each step names its measure, so it can be seen to work.

**Step 0. Ship version 145 (in the bake now).** Batch 12 as built. It is the last batch of its kind until the steps below
have been tried.

**Step 1. The light, once. Done (Milestone 1158, 2026-11-13).** On the owner's word to act on the recommendations: both
day hours' sky fill is 1.7 for 0.75, and one rule sets where the light comes from, the hour's own sun. Measured after:
13.0% of the six pictures under 30 of 255, from 21.2%. Left of this step, to go with the next bake: take back the glows
the agents added to fight the shade where they now overdo it, and lighten what is black by material (the ring road's
ground, the High City's glass), aiming under 10%.

**Step 2. Measures for play.** Three, all cheap:
- *A layout review.* Fresh reviewers get the measured maps (heights, exposure, roof islands, free runs), the movement
  numbers and the match rules, and are asked level-design questions: the lanes, the loops, the power positions and their
  counters, the rotations as sectors go. This replaces one of the two picture reviews each round.
- *Movement lines in the checks.* Done (Milestone 1159): rules.lines, run by the real player each bake
  (tools/neon-lines.ts), three on version 145 and more with each quarter rebuilt. The first finding: the north-east
  block's three roofs take 5.9 s for 30 m, four mantles over their own kerbs.
- *People.* Three to five full matches by the owner and two friends, with five questions after each (where did you die,
  from where, did you see it coming, where was it fun, where did you get stuck). This is the only real measure of fun and
  it needs the owner.

**Step 3. One quarter rebuilt for 14 m/s, as a trial.** The north-east quarter (the north and east High City blocks,
NOODLE ROW, the ring road there), then measured against the other three, played, and photographed:
- *Fewer, larger cover.* On the run lines, the small pieces consolidated into walls 2.5 to 3 m tall, vans and roofed
  kiosks, with clean lanes between. Measure: free run averaged over directions, 11 m now, 18 m or more; the cover-within-
  reach check kept.
- *Overhead cover on the rotations.* Arcades along the High City blocks' feet, awning runs, a second walkway like the Sky
  Ring. Measure: open spots seen by forty or more high spots, 75% now in the inner ring, under 50%.
- *The middle tier.* The corner block's buildings stepped at about 8, 12, 16 and 20 m toward the ring, each a leap from
  the next. Measure: roof area at 12 to 20 m; leaps per island; a roof route from the district to the ring with no pad.
- *Edges that cost something.* Solid parapets on the high roofs with gaps to shoot from, so high ground sees less and
  shows itself when it looks. Measure: the same exposure number.
- *Two wall-run lanes.* The lower 6 m of two facing walls kept flat and clear, tested by a movement line.

**Step 4. Roll out what the trial proves** to the other three quarters and the districts' mouths.

**Step 5. The ending.** More capture zones in the centre sector, on other levels (the base roof, the Sky Ring, the court),
or a final sector that is not always the centre. This is a match rule, the lobby's and the owner's.

**Step 6. The big shapes.** What the reviewers call "one model tinted four ways" and "a generic skyscraper": the four High
City blocks at four heights, which also breaks the ring into stepped roofs. This is the largest build, and it should wait
for the trial quarter's result.

**Not the map's, but on the path to 8:** the renderer's shadows (all four reviewers, every round), and the city past the
fence, which fills half of every aerial with plain boxes.

## 5. What to stop

- Eight-agent dressing batches driven by the reviewers' item lists. Their return is about 0.04 a round.
- Adding small cover to answer "open" in a picture. The exposure is from above, and the speed is 14 m/s.
- A glow on each new material to fight the shade. Raise the fill once.

## 6. Decisions that are the owner's

1. The look. Decided 2026-11-13 by the owner's word to act on the recommendations: the fill at 1.7, the light where the
   city was always lit from.
2. Whether the next versions go to play (steps 2 and 3) instead of another picture-driven batch. Decided the same way: they do.
3. Playing matches, and asking two friends to. Nothing else measures fun.
4. Who takes the shadows and the ending: both are outside the map.
5. Whether the bots should use the roofs. Today they keep to the street by the owner's own rule, so bot matches cannot
   show how the roofs play.

## 7. Honest limits

- This document's first version said the default hour's sun stood 15 degrees up and that a 27 m block cast a 100 m
  shadow. That was read off sky.json; the running game lights the city from 41 degrees. Corrected 2026-11-13 from the
  light pictures: section 3.4's table is measured, the first version's forecast (18% to under 6% by raising the sun) was
  not.
- The reference speeds for Apex, Hyper Scape and the wall-running shooter are from memory, not measured.
- The measures are proxies built in a day. They rank quarters of this map against each other well; they do not prove fun.
- An 8 from picture reviewers needs finish at 7 or more, which needs the shadows and the light. Placement alone will not
  reach it. Placement and play can make the map better to play than its pictures score, and that is the part nobody is
  measuring yet.
