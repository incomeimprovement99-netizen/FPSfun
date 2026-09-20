# Plan: the movement chain, and paint

**Written 2026-09-20.** The owner's ask: *"continue working on the movement and
trying to get it buttery silky smooth, like Apex is and like Hyper Scape was,
and the other shooter that had really good movement recently was Empulse. They
had like speed grenades / paint where you boosted speed and could chain
movements together."*

## Where the movement already is

`docs/MOVEMENT_AUDIT.md` is the rule-by-rule comparison against the Apex
movement wiki, and `npm run movesim` drives the real controller frame by frame
against every number in it. Walk, sprint, crouch, holster, jump height and
fatigue, coyote time, slide entry, boost, cap and cooldown, the slide-jump
gate, lurch (window, trigger, direction, speed cost and cap), the whole climb
system with climb space, mantle, superglide and fall stun are all measured and
all match. **The problem is not the numbers.**

What is missing is everything *between* the moves:

1. **Nothing carries.** A boost ends the moment its move does. Apex's feel
   comes from a slide's speed surviving into a jump and a lurch; ours does too,
   but there is nothing that *gives* you speed to carry, so a chain can only
   ever lose energy. Empulse's answer is paint: a patch of floor that hands you
   speed, and a boost that lasts a moment after you leave it, so the chain is
   the point rather than a way of not slowing down.
2. **The camera does not move with the body.** No lean into a slide, no roll on
   a hard landing, no kick out of a lurch, no settle when a sprint ends. This is
   most of what people mean by "silky": Apex's camera is always a fraction
   behind the body and always returning.
3. **The figure does not blend.** Stances snap. That is a separate item (next
   steps #3) and is not in this plan.

## What is being built

### A. PAINT (Empulse's mechanic, our rules)

A throwable that paints the surface it hits.

- **Orange, speed.** Standing or sliding on it, your top speed and acceleration
  rise. Leaving it does not end it: the boost decays over `carry` seconds, so a
  slide off the paint into a jump keeps most of it and a lurch keeps the rest.
- **Blue, jump.** A jump that leaves from it is higher, and a climb started
  from it starts faster. Landing on it does not bounce you: it is a boost you
  take, not a trampoline, which keeps it out of the way of the Apex jump rules.
- It sticks to floors and walls, lasts about 25 s, and anybody can use anybody
  else's: a squad painting a rotation is the point.
- Both are ordinary throwables in the grenade slots, so nothing about the
  ability kits changes and the bots can be taught to use them later.

The numbers live in `src/config/paint.json` with their reasons. First cut:
speed x1.35 with a 1.2 s carry, jump x1.6, patch radius 3.5 m, 25 s, two in a
slot, 8 s between throws.

**Why a throwable and not a kit.** The kits are a fixed set of six with a
tactical, a passive and an ultimate each, and adding a seventh would mean
rebalancing all of them. A throwable is picked up off the floor in the battle
royale and given in the arenas, which is exactly how Empulse hands it out.

### B. The camera that moves with you

Five cheap pieces, each with a number in `src/config/player.json` and each
turn-off-able in Settings (one switch, "Camera movement", for people who feel
it in their stomach):

1. **Slide lean**: up to 6 degrees of roll into the slide's direction, eased in
   over 0.12 s and out over 0.25 s.
2. **Landing dip**: we have a small one; add a roll proportional to the sideways
   speed at the moment of landing, so a running landing reads as a stumble.
3. **Lurch kick**: a 2 degree yaw overshoot that settles in 0.18 s, so a
   tap-strafe has a weight to it.
4. **Boost pull**: while a paint boost is on, a 1.5 degree forward pitch and a
   2% FOV widen, eased, so speed reads on the screen as well as the ground.
5. **Sprint settle**: the existing sprint bob eased out over 0.2 s instead of
   cut, so stopping does not snap.

None of these move the aim: they are applied to the camera's own roll, pitch
offset and FOV, never to `player.yaw` or `player.pitch`, and the checks assert
exactly that (a bullet fired mid-slide goes where the crosshair was).

### C. Wallbounce and the mantle boost

Both are in the audit's "not implemented" list, both are what an Apex player
tries first, and both are chain moves: a wallbounce turns a mistake into speed
and the mantle boost is the official superglide. They come after A and B
because they need the fatigue and mantle interactions read again carefully.

## Build order

| Step | Work | Test |
|---|---|---|
| A1 | `src/game/paint.ts`: patches, lookup, expiry, decals; `paint.json` | `tools/checks/paint.ts`: a patch is found from where you stand, expires on time, a wall patch never catches a floor walker, the boost decays over `carry` |
| A2 | The throwable: two kinds, the throw, the splat, replication | e2e: throw one, stand on it, the speed rises; a friend's page sees the patch and gets the boost |
| A3 | Movement: the speed boost and the jump boost, and the carry | `movesim`: a slide off speed paint into a jump keeps its speed; the boost never exceeds the lurch cap; nothing changes when no paint is down |
| B | The camera pieces, behind one setting | `tools/checks/feel.ts`: every piece returns to zero, none of them touches yaw or pitch, and a shot mid-slide goes where the crosshair is |
| C | Wallbounce, mantle boost | `movesim` against the wiki's numbers |

Ship A and B together as one milestone (the chain is not a chain with only
half of it), C as its own.
