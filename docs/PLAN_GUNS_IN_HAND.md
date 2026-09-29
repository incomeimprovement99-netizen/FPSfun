# Plan: the guns in hand, with the USSO and BOOG as the template

The USSO and BOOG are the first two guns held by the bought first-person arms (KINEMATION's FPS Animation Ultimate;
docs/PLAN_FIRST_PERSON_ARMS.md). They are the template: the other eight follow only once the owner has played these two
and called them right. This file keeps the owner's feedback on them, round by round and in their words, with what was
done about each point, and turns it into the bar every gun has to meet. Read it before touching any gun in hand.

## 1. The owner's feedback, round by round

### Round 1 (2026-09-27): the reload, the swap, every frame

- "the finger pointing to go down and left more on both, not by too much": **done** (Milestone 302), the fingertip
  `shift` left and down of its spot, `fparms.json` reload.
- "if it can drop out and pixelate, and then pixelate and slide in with a distance from start to end makes it
  cleaner": **done**, the magazine slides 8 cm out as it phases out and the new one phases in below and slides home.
- "check all frames of the reload for pinpoint accuracy, and ensure the hands are the correct size and on the correct
  area at all times, not glitching through the gun at any point": **done** (Milestone 312), `tools/pack-frames.ts`
  sheets of every stage, no frame flagged.
- "look for more things we can do with it, especially when we swap guns, what the hands and arms can do": **done**, the
  pack's own swap, jump and pickup clips.
- "We for sure want to use all the pack parts we can on those two guns and if we don't like any we remove it."
- "Ensure to give screenshots in this chat so that I can see the proof. Like 5-10 total so I see the stages of the
  animation": every round ends with the sheets and close-ups sent.

### Round 2 (2026-09-28): the hands on the gun

- "the usso, the left hand is still slightly off the gun": **done** (Milestone 304), the palm within 1 mm.
- "when we rack the charging handle, we get close to it, but our fingers don't grip it, it's like 80% of the way
  there": **done**, the thumb and forefinger pinch the handle's knob.
- "both guns when we are standing still have the gun aimed up and to the left still, look at hyperscape and apex, in
  the chilling / standing position, the gun is never like that": levelled to 2 degrees (Milestone 304); **still open**,
  see round 4.
- "on the inspect, we should 'inspect' whatever hack we have in our inventory at that moment in the off hand ... a palm
  open hand and the hack glowing/levitating off of the palm with the palm facing up": **done** for one hack; round 4
  asks for all of them.
- "taking out melee / fists, are those the old fists and not our new bought arms?": **done**, the bought arms' fists.
- "the red circle still appears around the enemies": the edge laser, the only red ring drawn on a figure, removed. If
  it is seen again, a screenshot of it is the next step.

### Round 3 (2026-09-28): perfect, not nearly

- "Yes raise the textures on high settings": **done** (Milestone 312), the held gun at 2048 on High.
- "why did you stop short of getting it perfect? That's what the animation screenshots are for? You know it's not
  perfect and know what you need to do but stopped short?": the bar is now no flagged frame on any sheet, and a fault
  seen in a picture is fixed before the round ships, not listed as a known issue.

### Round 4 (2026-09-28, given before Milestone 312 was deployed)

Checked against the deployed build's own sheets before acting on each.

1. "on the usso reload, the hand goes back to the grip in between pointing at the mag and hitting the charging
   handle": **seen in the sheets** (56 to 60% of the reload the left hand is back on the handguard, then goes up to the
   handle); **done** (Milestone 319), the point held until the grab has the hand.
2. "for the boog, the support hand is holding the mag": **seen** (the palm's middle 10.4 cm back from the magazine's
   front) and **done** (Milestone 319), the hand out on the fore-end 2.7 cm ahead of it, the arm reaching along the gun.
   The lesson: a pack gun's hold sits where its own gun is held; measure it against our gun's magazine.
3. "I STILL FEEL like the guns when resting are still too angled up and to the left too much, like the view angle
   isn't how it was originally ... compare it to hyperscape": to do, measured against the view's own gun pose from
   before the bought arms and against Hyper Scape's.
4. "The hack animation also needs to be held higher and slightly more to the left so it doesn't bug in and out with
   the gun when it sways back and forth on the usso when we inspect": to do.
5. "I have two hacks enabled, only 1 shows, the animation should show both, so move one to the side a bit more and
   have the other next to it, very similar, possibly smaller if needed to fit in the hand": to do.
6. "When spraying the usso, the tracers ... are a bit obnoxious ... we should make the tracers much less visible and
   maybe even remove muzzle flash completely or replace it with a paid asset muzzle flash from our fps animations
   pack, making it like 50% transparent": to do.
7. The swap: "any way we can like reverse that animation and just have the character throw it up and out or
   something while after 0.5-1s and some distance, the weapon phases out and the new one phases in in its place and
   then animates towards the user's hands? so the timing is probably much quicker ... If this isn't feasible, it's ok,
   but I think we should try it and make a note of how it is now in case we need to revert": to try; the swap as it
   is now is written down in section 3.
8. Renames: ZEPHYR is STRYDER, and two more of the guns are named for people who matter to the owner, REZ and HAEFY
   (RIPTIDE and HELIX, the names that were ours rather than friends'): **done** (Milestone 313).
9. "the right arm is clearly still so fucked up lol, just put the guns away and look at the right arm": **done**
   (Milestone 313). The right fist was rolled 159 degrees on its forearm (the glove's cuff split open) and both thumbs
   stuck out ahead of the fists. The lesson for every gun: a wrist's roll on the forearm is measured as well as its
   bend, and each state of the hands is looked at, not just measured.

## 2. The bar every gun in hand meets

Each is a check in the e2e soldier section (`tools/e2e.ts` packFrames) or on the frame sheets
(`tools/pack-frames.ts`), so a new gun cannot ship short of it.

| What | The measure |
|---|---|
| Every frame of the reload, the swap, aiming in and the pickup, a frame every 4% | no frame flagged on any sheet |
| No hand through the gun | no seen skin more than 4 mm into it, in every state |
| Wrists | 50 degrees or less at rest and aimed, 60 pointing and swapping |
| The fists | the bought arms', rolled 45 degrees or less on the forearm, every finger curled, the thumb across the fingers |
| The point | the fingertip on its spot, down and left of the magazine, within 1 cm and 10 degrees |
| The magazine | out 8 cm as it phases out; the new one phases in below and slides home |
| From the point to the rack | the support hand goes straight to the handle or bolt, never back to the gun between |
| The support hand at rest | on the handguard, ahead of the magazine, never on it |
| The rack | the fingers close on the handle (the USSO's: the thumb and forefinger's tips within 2 cm of its knob) |
| At rest | the gun level, as Hyper Scape holds it, not pointed up and left |
| The inspect | the other hand open, palm up, every hack carried floating over it, clear of the gun's sway |
| Firing | a muzzle flash and tracers that read without covering the target |
| The textures | the held gun at 2048 on High |
| Proof | the sheets and 5 to 10 close-ups of the stages sent to the owner every round |

## 3. The swap as it is now (Milestone 312, commit fbc6343, tag `swap-drop`)

Kept here so it can be put back if the thrown swap is worse. The old gun phases out while the pack's Rifle_Unequip
swings it down to the chest in both hands (29 cm across, 34 cm in, turned 58 degrees, measured), and from 70% of the
way out the arms drop out of the picture (`fparms.json` swap: drop 0.35 m, back 0.12 m, pitch 0.6 rad, dropFrom 0.7);
the new gun phases in as Rifle_Equip brings it up into the hold, the two clips crossing over 6% of the swap either side
of its middle (cross 0.06). The arms are carried through the swing with the gun (`fprig.ts` swing), which keeps the
wrists under 40 degrees. To revert: revert the thrown swap's commit, or take the `swap` block of `fparms.json` and
`fprig.ts` swapMotion back from the tag (`git show swap-drop:src/config/fparms.json`); the sheets of this swap are
Milestone 312's.

## 4. How a gun is fitted (the recipe)

1. Import the pack gun (`tools/import-fparms.ts`).
2. Fit our gun to it: trigger on trigger, tilted into the left palm (`fprig.ts` fitGun).
3. Fit the hands: `tools/pack-fit.ts` (whole hands and fingers), then `tools/pack-solve.ts joints` joint by joint, and
   `tools/pack-thumb.ts` for any finger a local search cannot move (a thumb over a receiver).
4. Fit the arms: `tools/pack-solve.ts wrists`, the shoulders and the pointing arm, never with more of the arms in the
   picture.
5. Measure when its clips move the magazine, handle or bolt, and where the finger points.
6. Sheets of every stage (`tools/pack-frames.ts`) until none is flagged; look at them too.
7. Add it to the soldier e2e checks and send the owner the sheets and close-ups.

## 5. The other eight

| Our gun | Pack gun | Support hand | Reload: the point, then | Per shot |
|---|---|---|---|---|
| PANDA (heavy rifle) | AK | handguard | the AK's side charging handle | |
| STRYDER (fast rifle) | MX16A4 | handguard | the rear charging handle pulled | |
| ANAKIN (steady SMG) | ASVal | handguard, ahead of the magazine | its handle | |
| BIGANTLER (pump shotgun) | KXG12, an exact match | on the pump | shells phase in one by one at the loading gate (the pack's start, loop and end), then a pump | a pump after each shot |
| REZ (auto shotgun) | G3, a weak match | the long handguard | the G3-style handle slap | |
| HAEFY (heavy marksman, lever) | SVD | handguard | its bolt | the bolt (the pack has no lever gun) |
| PULSAR (fast marksman) | Mk14 EBR | handguard | its handle | |
| NOVA (energy LMG, never reloads) | MGX5, the hold only | ahead of the drum | on overheating, a short vent gesture | |

Open for the owner: HAEFY on the SVD or on a Kar98K-style bolt loaded round by round; whether REZ's G3 hold is close
enough; whether NOVA gets a vent gesture. The order: BIGANTLER first (the exact match), then PANDA.
