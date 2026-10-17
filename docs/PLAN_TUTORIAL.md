# The tutorial, the range's cleanup and the new start menu

The owner, 2026-10-17 (the lobby agent's brief, said back before building):

> "THE JUMP PAD IN THE FIRING RANGE IS ALL FUCKED UP TOO. WE SHOULD REMOVE IT AND WE NEED TO REDO THE 3 COURSES AGAIN AND
> MAKE THEM MUCH LONGER TO COMPENSATE WITH THE NEW DISTANCES AND MOVEMENT SPEED FOR EVERYTHING. No more ziplines they
> aren't needed in there, but it should actually be the middle one the city movement one should be like a gap where we
> can't wallrun and can only get to the other side by supergliding, measure it out. Make it basic to start and more
> complex after, its like the tutorial. it should just be movement focused and then near the end it should have the
> soldiers who are like one shot and the targets as well moving through the room. Disable abilities/hacks until we
> reach the section where it describes them. This should be like a whole ass tutorial/walkthrough. and the menu at the
> start should have it there. It should be sectioned differently now, like 3 options for "TUTORIAL" "FIRING RANGE"
> "BATTLE ROYALE". Similar to how we have it but everything should be center aligned. and keep the resume and more, but
> resume should be bigger and more should be more or less hidden, and make the whole UX smooth and easy to do. New
> players should get a nudge or whatever to click on the tutorial, returning players shouldn't get that ... you can
> remove 1 of the 'the runs' and the other run just align it to today's movement speed ... Then the roof of the range
> should be different as well, make it darker themed, along with the lights by the hacks and guns are super bright and
> the podium up there we can't even stand on we glitch through, so rethink the firing range a bit as well ... Also, our
> wall run is great, but we failed in making it stop wall running after like 3 seconds. we were supposed to follow
> empulse's example"

## What it is, in order (a milestone each, shipped and documented one at a time)

| # | What | Done when |
|---|---|---|
| 630 | **The wall run ends after 3 s** (movement.json wallRun.duration, its last 0.6 s sinking); a corner is the same run; the wall it ran out on is spent until the ground | tools/checks/reach.ts measures it ending at 3.0 s, not retaken; e2e sktour |
| 631 | **The range cleaned up**: the jump pad (THE CHAIN's window pad) out, the roof darker, the over-bright lights by the gun and hack stands dimmed, the raised podium solid to stand on, a few things placed better | photographs from the same spots before and after; a check that every raised floor you can reach is stood on |
| 632 | **The start menu**: TUTORIAL, FIRING RANGE and BATTLE ROYALE as three centred choices; Resume bigger, More tucked away; a new player nudged to TUTORIAL (a first visit, nothing stored), a returning one not | e2e: a fresh browser sees the nudge, a returning one does not; each choice starts its mode |
| 633+ | **The tutorial**, in the middle bay where THE CHAIN was: a long walkthrough, movement first, simple to hard; no ziplines; a gap only a superglide crosses (no wall beside it, measured off the real controller); the hacks locked until the room that teaches them; one-shot soldiers and moving targets at the end | tools/checks drive the real controller through every room (each crossed with its move, not the one below it); e2e walks the steps; the hacks refuse before their room |
| 63x | **THE RUN** kept, retuned to today's speeds and lengthened; **THE RUN: ADVANCED** removed (the tutorial teaches its moves) | the course check drives it at today's speeds |

## The tutorial, room by room (a first cut; each room's numbers come from the measured movement, not typed in)

Each room is a step: its title and one line on the HUD (the tour's panel), a marker to the next door, and the room's
check. The next room's door stays shut until the check is done, so nothing is skipped by accident; hold interact to
skip a step, as the tour does.

1. **Move** - walk, sprint (auto sprint on a pad), crouch.
2. **Jump and double jump** - a low wall, then a gap a jump falls short of and a double jump clears.
3. **Slide** - a slide under a low beam, and a slide jump across a gap only it clears.
4. **Climb and mantle** - a tall wall climbed, a ledge mantled.
5. **Wall run** - a long wall beside a pit; run it to the far side (3 s, so it is long enough and no longer).
6. **Wall kick** - two walls across a corridor, kick from one to the other to climb out.
7. **Superglide** - a ledge, then a gap with no wall beside it: wider than any jump, slide jump or double jump carries,
   inside what a superglide (and its double jump) carries. Measured with the simulation (tools/checks/reach.ts gains the
   superglide), with a margin each way.
8. **Hacks** - the hacks unlock here: the mobility hack across a gap built for it, the utility hack on a target.
9. **Shooting** - targets, then moving targets on rails.
10. **The fight** - one-shot soldiers popping up as you move through the last rooms, with moving targets among them;
    the finish line stops the clock.

## Notes

- The tour (Play tab, "Guided tour") stays until the tutorial covers its steps, then it is folded in.
- The course engine (src/game/course.ts) already has rooms, tips, pop-up enemies, hazards and a clock; the tutorial is
  a course with steps on top.
- Hacks locked: a flag the tutorial sets and main.ts's hack keys read; it never touches a match.
