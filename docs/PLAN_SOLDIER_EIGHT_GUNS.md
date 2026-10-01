# Plan: the other eight guns in the soldier's hands

The owner, 2026-09-30: "Once we have that perfect we plan out each 8 remaining guns." This is that plan. Nothing in it
is started: the USSO and BOOG are with the owner to verify first (PHASE_27_PLAN_THE_SQUAD_AND_THE_SOLDIER.md, 27.12),
and the eight follow on the owner's word.

It covers the soldier as other players see it (enemies, teammates, your own figure in third person, the Loadouts tab).
The guns in your own hands in first person are the guns agent's (PLAN_GUNS_IN_HAND.md).

**The owner's changes, 2026-09-30.** PULSAR is gone ("no need for a fast marksman, just call it marksman now"): HAEFY
is the one Marksman. In its place is a pistol, "just like the riot 1 from Hyperscape", wearing the pack's second pistol
("yep use pitstol 02"): APUHTHEE, the owner's name for it (2026-10-01; speedkills.json weapons.wingman). So the eight
still to do are HAEFY, PANDA, STRYDER, ANAKIN, REZ, BIGANTLER, NOVA and APUHTHEE. BIGANTLER's reload is decided: the
KINEMATION KXG12 pump's clips ("the kxg12 pump shotgun is clear answer"). Skins do not matter to the owner ("as long as
each gun is different thats fine, idc about skins"): two guns may share a model when they play differently.

## What the eight are

Measured on the figure on 2026-09-30, each gun held as the soldier holds the USSO today (`tools/gun-shape.ts`, and a
survey of each gun's hold points and reload parts). Lengths are the bought models' as drawn.

| Gun | Class | Model | Length | Left hand's hold, from the butt | Reload | What is its own |
|---|---|---|---|---|---|---|
| HAEFY | Marksman | the sniper (BOOG's) | 125 cm | 78 cm, BOOG's rail | magazine, 2.6 s | nothing new: BOOG's model |
| PANDA | Heavy Rifle | the rifle | 104 cm | 83 cm | magazine, 2.4 s | shares the rifle with STRYDER |
| STRYDER | Fast Rifle | the rifle | 104 cm | 83 cm | magazine, 2.4 s | the same model as PANDA |
| APUHTHEE | Heavy Pistol | the second pistol | 25 cm | both hands on the grip | a block under the barrel, 2.1 s | the only one-handed gun: the clips' own pistol hold |
| ANAKIN | Steady SMG | the second SMG | 86 cm | 61 cm | magazine and a charging handle, 1.9 s | a handle to rack, as the USSO has |
| REZ | Auto Shotgun | the first shotgun | 92 cm | 86 cm | magazine, 2.75 s | the furthest hold of any gun |
| BIGANTLER | Heavy Shotgun | the second shotgun | 94 cm | 71 cm | no magazine: a pump, 2.0 s | the only gun that needs a new kind of reload |
| NOVA | Energy LMG | the launcher | 124 cm | 81 cm | a drum, 3.26 s | 24 cm wide at its drum |

So the eight guns are **six new shapes**, not eight: the rifle (two guns), the second SMG, the two shotguns, the
launcher and the pistol. HAEFY wears the model BOOG already holds.

Two things the USSO and BOOG taught that set the order of work for each:

- **The glove is a big man's** (0.094 m across the knuckles, about 1.25 times a man's hand), its fingers drawn a tenth
  smaller than the model's (soldierhold.json fingerSize 0.9, the owner's choice after half size could not hold the
  guns). A gun whose trigger guard closes round the fingers may still need drawing a little bigger, as the USSO is
  (1.05); each new model's guard is measured first.
- **The right index goes on the trigger**, not along the frame (the owner, 2026-09-30): tools/figure-fit.ts searches
  it onto the trigger part's face once the hand is placed, and the skfigure e2e holds it to 4 mm.
- **The left arm's reach.** With the shoulder's reach (34 degrees of the collarbone) every hold in the table is now
  inside the arm's reach standing still; REZ's is the only one that still slides a little (0.07). BOOG was fitted before
  that, at its magazine. Each long gun's fore-end hold is checked aimed on the move before it is kept.

## The recipe, a gun at a time

What was done for the USSO and BOOG, in the order that worked. Each step's tool is named; none of it is typed in by eye.

1. **Measure the gun**: its side thickness map and cross-sections (`tools/gun-shape.ts`), and a photograph alone on a
   centimetre grid (`tools/figure-hands.ts` GUNONLY). Read off the grip, the trigger guard's opening, the magazine or
   pump, the fore-end's width and underside.
2. **Decide its size on the figure**: if four gloved fingers do not fit the guard, the least scale at which they do.
3. **Fit the hands** (`tools/figure-fit.ts`): a start measured off step 1, then the grasp search for the right hand,
   then the left. Judged by the close photographs from three sides as well as the numbers (a hand can measure 2 mm and
   be holding nothing).
4. **Fit the body round the gun** (`tools/figure-solve.ts`): `rest` (the butt's pocket, the chest's turn, the elbows,
   the eye relief), `lowered` (the sprint's carry), `swap`, `air` (a jump out of a sprint) and `rise`.
5. **The reload**: the first person's, never the soldier's own (the owner, 2026-09-30: the two "agree with each
   others animations and movements when they reload"). Its timing is read from the guns agent's fparms.json at run time
   (rifle.ts reloadPlanOf): the point at the magazine, its phase out and in, the seat, and the rack as the gun's pack gun
   does it. What is the soldier's own is only where each hand goes (`reload.keys`: the point, the handle, the bolt) and
   the gun's tilt, each fitted and photographed. A gun whose first person is not settled yet waits for it.
6. **Look at everything**: the lab's sheets for every sequence from four sides (`tools/figure-frames.ts`: at rest,
   aimed, looking up and down, firing, reload, swap, jump, hop, run, run aimed, sprint, crouch, slide, melee, throw,
   strafe), the Loadouts tab's soldier, then the game itself (`tools/live-shots.ts`: a bot with it, your own figure,
   another player's).
7. **Hold it**: the gun added to the `skfigure` e2e checks (the hold in four poses, aimed at a sprint, the melee, the
   throw, the reload's magazine, the Loadouts panel), a roadmap milestone, the diary, and shipped.

**Done, for a gun, means the USSO's bar**: no flagged frame at rest, aimed, crouched, firing, running, running aimed
and sprinting from any side; no hand more than 6 mm into it; both palms and the holding fingers on it; whole in the
Loadouts panel at every turn. What is flagged beyond that is looked at frame by frame and written down, not left.

## The order

Most shared and most seen first, the new code last.

1. **HAEFY.** BOOG's model, so BOOG's hands, rail, pocket and carries as they are; its own reload time, its own
   checks. The smallest of the eight, and it proves the first piece of groundwork below.
2. **The rifle: PANDA and STRYDER.** One fit, two guns.
3. **APUHTHEE.** The pistol is the one gun the soldier's clip library was made for (Pistol_Idle_Loop, Pistol_Aim_Neutral
   and its up and down, Pistol_Shoot, Pistol_Reload): the legacy figures' pistol hold (mannequin.ts, a gun on the right
   hand), the pistol's grip and trigger measured and both hands fitted to it, its block of a magazine out from under the
   barrel on the reload clip.
4. **ANAKIN.** The closest to the USSO: a magazine ahead of the grip and a charging handle the left hand racks. Its
   guard is measured for a scale.
5. **REZ.** A magazine-fed shotgun with the furthest hold of any gun; if the fore-end cannot be held aimed on the
   move, its hold comes back along the gun as BOOG's did.
6. **BIGANTLER.** No magazine: shells and a pump. Its reload is new (below), and its pump is where the left hand
   already is, which no other gun has.
7. **NOVA.** The widest gun by far: its drum against the chest and the left forearm at rest, in the carries and in a
   swap, and a drum to change.

## Groundwork, once, before the first of them

- **One fit a shape.** The hold's numbers are kept a gun (`soldierhold.json` guns). Three guns on one rifle and two on
  one sniper need a gun to take another's numbers (`guns.vinson` like `rspn101`) with only what differs written down,
  so a shape is fitted once and cannot drift apart between the guns that wear it.
- **The tools and checks over a list.** The frame sheets, the live sheets and the `skfigure` e2e name the USSO and BOOG;
  they take the list of fitted guns instead, so adding a gun is adding its name.
- **A pump reload** (for BIGANTLER), decided: KINEMATION's KXG12 (its pump, its pump when empty, and its reload's start,
  a shell each loop, and its end), the guns agent's in first person. On the soldier the same beats, read from their
  config as the USSO's and BOOG's are: the left hand on the pump racks it, the right feeds a shell at the gate each
  loop; the pump is already a moving part of the bought model.
- **A drum** (for NOVA): taken off and put on as a magazine is, from the pouch at the hip; its size in the left hand is
  the new part.

## What is carried over, known

- A long gun's butt plate sits 2 to 4 cm into the soldier's rigid shoulder armour in the still poses, as BOOG's does:
  hidden from outside, and flagged by the measure. The rifle and the launcher are as long; expect the same, and the
  same look at it from four sides.
- About 0.3 s of empty hands between a throw's release and the gun showing again, on every gun.
- A far figure's hold is only worked out every few frames (the figures' level of detail): a saving, not a fault.

## Parked

- **Grenades in a thrown hack's hand.** The pack's two grenades could be what the soldier visibly throws when a hack is
  thrown. The owner, 2026-09-30: only a note, since a real grenade does not fit the hacks' materialising look.

## For the owner to say

- **Go, and in this order?** The order above is by what is shared and what is seen most. If a gun you play matters more
  (REZ, NOVA, APUHTHEE), it moves up; nothing later depends on the order except HAEFY coming first.
