# The guns, a fix round from the owner's look (2026-10-11)

The owner looked at every gun in both views and found faults a step back shows at once. This is the plan for them: the
first person is the guns agent's (apex-soldier), the third person the character agent's (apex-character). Each fix is
proven by our picture laid over the related Apex and Hyper Scape gun's, in the view it is for.

## The owner's words

> ok so the anakin third person and first don't match up,, third person is cvorrect. then the panda looks retarded lmao
> look where the first person hands are... the stryder third person holds it way too far to the right, and the first
> person should be a bit closer to the face, match it over the riot one to compare, if equalish, leave it. tHEN THE
> BIGANTLERS LEFT HAND FIRST PERSON DOESN'T GRIP THE PUMP... then the rez is just like the panda where the left hand is
> way too forward on the gun and the left arm is seethrough... like looks terrible there, some of these you need to take
> a step back and look at it and you'll be like wow thats obbvouisly off. and the third person looks off too for rez,
> then same for apuhthee, its too far off on the right, at least for third person.
>
> Jmake a planning doc out of this and go for al lfixes. provide proof for each gun with the layers over the related
> apex and hyperscape gun in third and first person to prove it out. if off on third person, delegate to the third
> person agent for this. i want you only working on first person while they do the third
>
> also make sure you ADS on each gun first person and look at everything overall, multiple guns look slightly mesesd up,
> like the scope and the hand placement becomes more obvious when ADS down
>
> also wow the fists out look obvously fucked up too lmao the fingers are all bent unnaturally

## What went wrong in how they were made

Each gun was fitted to measures (no skin in the gun, no daylight, wrists, reach) and searched until the measures passed.
The measures passed while the picture did not: a left hand far out on a fore-end it should not be on, a palm that does
not close on a pump, an arm drawn from inside. The fix is the reverse order: first where a hand should be, read off the
references and the soldier (where ANAKIN's third person is right), then the measures; and every state looked at as a
player sees it, aimed in above all, before it ships.

## The first person (guns agent)

| Gun | The owner | The fix | Proof |
|---|---|---|---|
| REZ | left hand way too far forward, left arm see-through, "looks terrible" | the left hand back on the fore-end where the EVA-8 and the soldier hold it; find why the arm is drawn see-through (the camera's near plane in the sleeve, or its back faces) and stop it | over Apex's EVA-8 at rest and aimed; the arm from the eye and from the side |
| PANDA | "look where the first person hands are" | the hands where the Flatline's are: left on the handguard, right on the grip | over Apex's Flatline and Hyper Scape's Ripper |
| BIGANTLER | left hand does not grip the pump | the left palm and fingers closed round the pump, at rest and as it pumps | over Apex's Mastiff and Hyper Scape's Mammoth MK1 |
| ANAKIN | first person does not match the third, the third is right | the first person's hands where the soldier's are on ANAKIN (left under the front, right on the grip) | over Apex's Alternator, Hyper Scape's Ripper, and the soldier's own hold |
| STRYDER | "a bit closer to the face; match it over the Riot One; if equalish, leave it" | measured over the Riot One first; brought nearer only if it is off | over Hyper Scape's Riot One and Apex's RE-45 |
| APUHTHEE | (third person only) | checked in the first person over the Wingman and the Riot One while here | over both |
| Every gun aimed | "the scope and the hand placement becomes more obvious when ADS down" | aimed in on all ten, each looked at whole: the sight in the middle and clear, no hand or sleeve where it should not be | each gun aimed, over the Apex gun aimed where there is one |
| The fists | "the fingers are all bent unnaturally" | the fists' fingers curled as a fist is, each joint within a hand's range | the fists out, over Apex's and Hyper Scape's empty hands |

Then the rest looked at the same way, whether the owner named them or not: the USSO, BOOG, CHOOCH and HAEFY at rest,
aimed, in a reload, a swap and an inspect.

## The third person (character agent)

(Hyper Scape has no third person, so the third person's proof is over Apex alone.)

| Gun | The owner | Proof |
|---|---|---|
| STRYDER | "holds it way too far to the right" | over the RE-45's and the D-Tap's third person |
| REZ | "the third person looks off too" | over the EVA-8's third person |
| APUHTHEE | "too far off on the right, at least for third person" | over the Wingman's and the Riot One's third person |
| ANAKIN | right as it is: the first person is matched to it | |

## What the first look found (2026-10-11)

Every gun photographed at rest and aimed at the owner's size and field of view (1920 by 1080, 1.571), and the hands
measured on each gun's own model (the palm between the wrist and the middle knuckle, in the model's cm):

- **The see-through arm is the inside of a sleeve.** The bought arms are cut off on the upper arm; where a left hand
  reaches far out along the gun the upper arm comes up into the picture open end first, and the eye looks into it. Drawn
  with each face's side told apart (tools/pack-audit.js `__sleeveInside`), at rest: PANDA 4616 pixels of its inside,
  CHOOCH 5628, REZ 3721 (of a 480 wide picture), every other gun none. Aimed, none. The shoulder search now counts it
  (tools/pack-solve.ts wrists) and the e2e checks it in every state it measures skin in the gun.
- **REZ's left palm was past the gun's nose:** model z 50.8 cm, the gun ending at 49.3, its magazine tube running 8.9 to
  36.1 (middle 22.5) and its trigger at -4.1. Its left shoulder sat 7 cm in and 6 up, so the forearm stood straight up
  from the bottom of the picture. Apex's long guns at rest show the left hand on the handguard's side just ahead of the
  magazine, its forearm going down out of the picture, no upper arm.
- Aimed, APUHTHEE is a blown-out white block right of the middle with both hands beside it; REZ and BIGANTLER aimed fill
  the bottom of the picture with the receiver's top.

## The proof

For each gun, in each view: our picture at the same field of view laid over the reference (outline and ghost, as
tools/gun-fit.ts lays it), at rest and aimed, and a sheet of every state. The references: Apex's own weapon frames at
rest (the apex-rest set; more found where a gun has none), Hyper Scape's from its videos (the gun named above). Where a
reference cannot be found for a gun and view, that is said, not skipped. A fix that changes a measure gets a check in the
e2e, seen failing with the fault put back.

## The order

1. REZ (the worst: the arm drawn see-through), 2. BIGANTLER, 3. PANDA, 4. ANAKIN, 5. every gun aimed, 6. the fists,
7. STRYDER and APUHTHEE over their references, 8. the rest looked at whole. Each shipped as it is done, with its proof.

## Status

| Item | First person | Third person |
|---|---|---|
| REZ | done (Milestone 540): the hand on the tube's middle (palm z 22.5), the forearm in from the lower left, no sleeve seen, every move without fault; over Apex's EVA-8 at rest and aimed | done (Milestone 563): the left hand on the tube's middle at model z 22, the muzzle 16 px under Apex's Mastiff's (40 before) |
| BIGANTLER | done (Milestone 540): the fingers up the pump's sides (within 1.1 mm), and aimed the hand stays on the pump (it had slid 22 cm back onto the receiver) | |
| PANDA | done (Milestone 540): under the handguard ahead of the magazine (palm z 37.3, the soldier's 39.1), no sleeve seen, its own pointing shoulder; over Apex's Flatline and Hyper Scape's Ripper at rest and aimed | |
| CHOOCH | done (Milestone 540): its shoulder down and in, no sleeve seen at rest, venting or swapping, the wrist 26 degrees; over Apex's Devotion at rest and its L-STAR aimed | |
| ANAKIN | done (Milestone 540): under its front where the soldier holds it (palm z 29.7, the soldier's 29.0); over Apex's Alternator and Hyper Scape's Harpy at rest and aimed. Left: its right palm sits 9 mm into the grip, hidden in every state measured | right |
| STRYDER | next: half the Riot One's size on the screen, more than the guns' sizes explain: to come nearer, "a bit" | done (Milestone 563): the hand within 8 px of Apex's RE-45 from the hip (66 px right before) |
| APUHTHEE | next: at rest 0.05 right of and 0.08 higher than Apex's Wingman; aimed 2.3 times nearer the eye than Apex's pistols (every bought gun's irons come to 34 cm: a pistol needs its own distance) | done (Milestone 563), over the RE-45 as STRYDER |
| Aimed, every gun | looked at: the pistols are the fault (above); REZ, PANDA, ANAKIN and CHOOCH aimed laid over Apex's aimed frames | |
| The fists | done (Milestone 540): each finger bent about its own knuckle hinge (7 degrees off its plane, the old 75), the thumbs refitted across the fingers | |
