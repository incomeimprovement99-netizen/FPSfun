# The soldier against AAA: the second round

The owner, 2026-11-04: "stop for a moment to plan and do a gap analysis vs AAA game / comparisons, then implement if it
fits our speedkills use case".

The first round was [PLAN_ENEMY_POV.md](PLAN_ENEMY_POV.md) (2026-10-18). The lobby built what is drawn on and round an
enemy from it: shield flares and shards, ARMOR's shell, the sounds of moves, REVEAL. This round is the soldier itself:
its body, its guns and what it leaves in the world as it moves, for your own soldier in third person and for every enemy
and squad mate you see.

The references are Apex Legends (the closest game to SpeedKills), with Warzone, PUBG and Halo Infinite where they differ.
For Apex, the evidence is the owner's own clips in Downloads, looked at frame by frame (contact sheets in the session
scratchpad, `apexref/`), not memory alone.

## Where the soldier stands

Level with Apex already (Milestones 603-619, 831-849, 1020-1024):

- **The hold:** the rifleman's hold on all ten guns, the trigger finger, the reloads and the swaps phased as the first
  person's.
- **The legs:** gait speeds measured off the clips, strafe legs, feet planted turning on the spot, feet on edges, eased
  steps, a lean into turns.
- **The moves seen:** slide sat up on the aim, wall run, double jump, zip line by one hand, ropes, grapple, mantle,
  skydive.
- **Hits and deaths:** a flinch on a hit, a stagger on a shield break, deaths that fall away from the shot and onto the
  floor (never through a wall or off an edge into the air), the gun dropped by the body.
- **Readability and LOD:** a muzzle flash, a glint on a scoped enemy, LOD by size on screen, the far gun in its skin.
- **The long gun on the back:** in the skydive, an emote, an interact or a climb, phased on and off (M1024).

## The gaps

| # | Gap | AAA | SpeedKills today | Fits SpeedKills? |
|---|---|---|---|---|
| 1 | **The gun not in hand is not drawn** | Apex draws it on the back: in the owner's "pk clutch win" clip, an enemy firing a pistol carries a long gun up its back. Warzone, PUBG and Halo do the same. You read an enemy's whole loadout at a glance | You carry two guns, and an enemy shows only the one in hand. Holstered (15% faster, a speed game's habit) an enemy shows no gun at all | **Yes, first.** Every player figure (your own in 3P, mates, enemy players) every second of a match |
| 2 | **Moves leave nothing in the world** | Not confirmed for Apex's slide (no source found, and none seen in the owner's clips). The opposite is on record: pros asked Respawn to cut dust that hid who was being shot ([Dexerto](https://www.dexerto.com/apex-legends/apex-legends-pro-wants-particle-effects-fix-1544385)) | A slide, a landing and a sprint are heard (M695) but not seen. A double jump's turn already draws a tracer (trails.ts) | **Maybe.** A slide's streak in the double jump's own trail style would fit, but it is a new look: show the owner pictures first. Never over the body |
| 3 | **DEVINOS swings too fast** | Apex's launcher-class guns move as one piece | At 60 frames a second the tube jumps 40 cm in one frame as a slide starts, and 25 at a hip reload's end (found by the pop scan) | **Yes**, a fault, not a feature |
| 4 | **A hit's flinch goes one way, and only on the shooter's page** | Halo and Warzone flinch away from the side hit. Every player in Apex sees an enemy react to a squad mate's shots | Every hit leans the figure straight back, and a third player sees no flinch at all (the first round's open item) | **Yes**: in squads, you watch your mates' fights. Kept small: the hit volumes must not move |
| 5 | **Others' smoothness not measured** | AAA netcode hides 20-30 Hz updates under interpolation | Every pop fixed so far was found on the lab or your own figure, never on a remote player over the network | **Measure first**, two browsers in a battle royale. Fix only what shows |

Owner's call, not taken here:

- **Stairs:** the feet float 15-52 cm over the treads on stairs. Only drawing the body lower than its hull fixes it, which
  moves where a head can be hit. Asked 2026-10-29, still open.
- **Hands on the ledge in a mantle:** Apex puts a hand on the ledge. Tried 2026-10-29 (stashed): the mantle is 0.2-0.4 s,
  and the hand lands for only 2-5 frames of it.

Do not fit, left out:

- **An outline or rim on enemies:** the owner said no (2026-10-29).
- **A downed crawl:** SpeedKills has no knock-down state; an enemy is out when their health is gone.
- **A ragdoll:** the deaths fall the way the shot pushes, already measured onto the floor; a physics body would cost
  every page a solver for a second's look.
- **A shoulder swap for your third-person camera:** Apex's own third-person mode has none, and swapping a camera to see
  round a left corner is an advantage a first-person player does not get.

## The order

1. **M1025, the guns on the back (built 2026-11-04; the roadmap has its measures).** The gun not in hand rides on the back. Holstered, both guns do. The held gun's own
   sling (a climb, an emote, the skydive) gets a second place, so two guns never share one. Measured for clipping on
   every pair of the ten guns, standing, crouched, sliding and in every emote. Your own soldier gets it from your
   loadout, and other players get it from one new field in the state they send. Bots carry one gun (their kit), so they
   show none until the lobby's looter carries a second.
2. **M1026, DEVINOS's quick swings (built 2026-11-04),** on a spring over the frames they took one in.
3. **M1027, a flinch from the side hit,** and the hit sent so that every page shows it.
4. **Remote smoothness:** a two-browser battle royale, frame by frame. A fix gets its own milestone if anything shows.
5. **A slide's streak,** only with the owner's yes on pictures.
