# The tutorial, the range's cleanup and the new start menu

Two briefs from the owner, both 2026-10-17. Each was said back before anything was built.

**The first brief:**

> "THE JUMP PAD IN THE FIRING RANGE IS ALL FUCKED UP TOO. WE SHOULD REMOVE IT AND WE NEED TO REDO THE 3 COURSES AGAIN AND
> MAKE THEM MUCH LONGER TO COMPENSATE WITH THE NEW DISTANCES AND MOVEMENT SPEED FOR EVERYTHING. No more ziplines they
> aren't needed in there, but it should actually be the middle one the city movement one should be like a gap where we
> can't wallrun and can only get to the other side by supergliding, measure it out. Make it basic to start and more
> complex after, its like the tutorial. ... Disable abilities/hacks until we reach the section where it describes them.
> This should be like a whole ass tutorial/walkthrough. and the menu at the start should have it there. It should be
> sectioned differently now, like 3 options for "TUTORIAL" "FIRING RANGE" "BATTLE ROYALE" ... New players should get a
> nudge ... you can remove 1 of the 'the runs' and the other run just align it to today's movement speed ... the roof
> of the range should be different as well, make it darker themed, along with the lights by the hacks and guns are super
> bright and the podium up there we can't even stand on we glitch through ... our wall run is great, but we failed in
> making it stop wall running after like 3 seconds."

**The second brief**, given while the first version of the tutorial was being built. It replaced that version.

> "when we do tutorial it should be like walking through a "run" and it should be the player spawning in a different
> location and going through a "tutorial run" and the end they will come out near the area they would have with the
> firing range ... they shouldn't be able to advance through the tutorial if they don't perform the moves. Obviously like
> first move forward, then jump up a ledge then double jump up a ledge then we tell them that they can mantle, then we
> have a next section they can only reach with the double jump and mantle, then only an area that they can get past by
> wall running and then have the hacks in the next room/area/part and have dash be there and make them double jump and
> then dash to get across. make the walls invalid there. Then a couple rooms after that where the ANAKIN is defaulted to
> the user, they should then have to do some sort of movement like now double jump / climb up and shoot a couple
> soldiers, give them like 50 health. Then the last part of it should be a superglide area, but this is difficult for
> inexperienced users, so allow a small section / bridge to the side of it clearly labeling this one is optional. Do it
> in this order and build it out of the neon city map bundle we have built our whole BR on. Remember that measuring the
> dimensions and travel/jump speed and stuff while armed and unarmed is crucial for this and make sure the instructions
> are blatantly obvious near the top, like at least twice as big as they are now on the "Tour". Also on the main screen,
> the 3 buttons should be bigger. taller and wider and then you can simply move the firing range one to be on the right
> side and the battle royale will be on the bottom/middle, making it below the other two. So raise up the speedkills text
> as well and make the resume button slightly smaller ... can we add the matrix falling style stuff we have? it could be
> like 50% transparant or something with blue and pink ones to match the theme ... somewhere on the initial screen we
> should put like a login or something with some helper text saying something like "If you change your settings, they
> will be saved as long as you connect from the same browser. Making an account will always keep your settings and allow
> for stat tracking." Then do a link for settings and the account tab."

The second brief also gives the reason for the order: the tutorial hooks a new player. They finish it and walk straight
out into the range, among the guns, the hacks and the dummies, which interests them more. Then they play the battle
royale.

## What it is, in order (each one shipped and documented in turn)

| # | What | State |
|---|---|---|
| 630 | **The wall run ends after 3 s.** movement.json wallRun.duration, with its last 0.6 s sinking. A corner turn is the same run. The wall it ran out on is spent until you touch the ground. | live |
| 631 | **The range darker.** The roof dark, the lamps and the stands' columns of light dimmed, the floor's sky reflection cut to a third. The canopy over the stands is solid to stand on. | live |
| 632 | **The start screen.** TUTORIAL, FIRING RANGE and BATTLE ROYALE, centred. Resume bigger, More quiet. A new player is nudged to the tutorial. | live |
| 633 | **The tutorial run.** The second brief's nine rooms in its order, each door shut until its move is done. Hacks are off until DASH and the gun is put away until the ANAKIN. Out into the range at the end. The instructions are twice the tour's size. THE CHAIN and THE RUN: ADVANCED are removed. | shipped (roadmap Milestone 633) |
| 634 | **The tutorial dressed in the Neon City bundle's pieces.** It gets a small file of its own for just the pieces it uses, because the city's file is 155 MB and a new player would wait for all of it first. The city's file then loads in the background while they play. | next |
| 635 | **The start screen again.** The three ways in bigger. Tutorial left, Firing Range right, Battle Royale under both in the middle. The title higher, Resume a little smaller. The rain behind it in blue and pink at half strength. A sign-in line with the owner's helper text and links to Settings and the Account tab. | after 634 |
| 636 | **THE RUN retuned** to today's speeds and lengthened, with no ziplines. | after 635 |

## The tutorial as built (Milestone 633)

Every number is in src/config/tutorial.json, with the measurement beside it. tools/checks/sk-tutorial.ts drives the
real controller through the course's own colliders.

The way out runs up the right-hand bay, facing +z, unarmed. Holstered you are 15% faster (movement.json holsterBoost),
and the gun stays put away.

1. **Move:** forward to the door.
2. **Jump:** a 1.6 m slick ledge. One jump gets onto it from any distance 0.5 to 3 m out. A walk does not.
3. **Double jump:** a 4 m slick ledge. One jump gets onto none from 3.8 m up. The double jump gets on at 63 of 72 timings.
4. **Mantle:** a 6 m pit to a ledge 4.2 m above the deck. One jump falls in. The double jump 0.2 to 0.7 s after the first gets there by mantling.
5. **Wall run:** a 32 m pit beside the lit wall. The double jump at its best carries 25.7 m. A wall run carries 45.2 m.

The way back runs down the middle bay, facing -z.

6. **Dash:** the hacks come on, with DASH in the move slot. A 24 m pit leads to a ledge 4.5 m above the deck. The dash
   stops at the ledge's face. A dash from a jump leaves you out of a mantle's reach. A dash from a double jump leaves
   you a mantle from the top.
   - Measured: every double jump then dash tried lands, and the dash then double jump lands at most timings. A jump
     and dash looking level falls in, and so does the dash alone.
   - The room's walls are slick. A fall gives the dash back.
7. **High ground** (the ANAKIN handed over, armed from here): a 4 m slick platform. Its two soldiers have 50 health
   and stand up once you are on it.
8. **Climb:** a 6 m wall, not slick. Its two soldiers stand up once you are on top.
9. **Superglide:** 14.5 m off a 3.8 m ledge. The gap is midway between what nothing else reaches (12.5 m) and the least
   a superglide carries (16.9 m), each with a tenth to spare. The optional bridge beside it, under a green OPTIONAL
   sign, is stairs and a walkway.

**Out:** the middle gate opens into the range, between the gun stands and the hack stands, and TUTORIAL COMPLETE shows.

**Slick walls** (range.ts Solid.slick) take no wall run and no climb, but a mantle still takes their top. A climb from
a sprint gets you onto any wall up to 8 m, so every wall in a room gated by a jump is slick. Without that, a climb gets
past the jump ledges, and the check fails when slick is taken out.

## Notes

- The guided tour (More, "Guided tour") stays for now. The tutorial covers most of its steps. Fusion, the decay and the
  Gulag are summed up on the tutorial's finish card instead.
- Looking a few degrees up, a jump and dash in room 6 goes over the ledge's top instead of into its face, as the dash
  does anywhere. That is the dash learned all the same.
