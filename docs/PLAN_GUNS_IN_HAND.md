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
   isn't how it was originally ... compare it to hyperscape": **done** (Milestone 324). Measured against the view's own
   arms on the same gun: the bought arms drew the gun at the pack camera's 80 degrees where ours is 92, and held it 2
   degrees up; now the game's own field of view and level. The lesson: "the view angle" can be the field of view.
4. "The hack animation also needs to be held higher and slightly more to the left so it doesn't bug in and out with
   the gun when it sways back and forth on the usso when we inspect": **done** (Milestone 321), measured: no card over
   the gun at any moment of the inspect.
5. "I have two hacks enabled, only 1 shows, the animation should show both, so move one to the side a bit more and
   have the other next to it, very similar, possibly smaller if needed to fit in the hand": **done** (Milestone 321).
   The inspect itself, swept for the first time then, had 85 of 98 frames at fault and was rebuilt: the forearm turns
   the gun. The lesson: every move the hands make goes in the sheets, not only the ones asked about.
6. "When spraying the usso, the tracers ... are a bit obnoxious ... we should make the tracers much less visible and
   maybe even remove muzzle flash completely or replace it with a paid asset muzzle flash from our fps animations
   pack, making it like 50% transparent": **done** (Milestone 322): your own tracers a quarter as bright, your flash at
   half (no bought pack has a muzzle flash).
7. The swap: "any way we can like reverse that animation and just have the character throw it up and out or
   something while after 0.5-1s and some distance, the weapon phases out and the new one phases in in its place and
   then animates towards the user's hands? so the timing is probably much quicker ... If this isn't feasible, it's ok,
   but I think we should try it and make a note of how it is now in case we need to revert": **done** (Milestone 327),
   `swap.style` "throw"; the swap as it was is "drop" (section 3). One fault left and known: on the USSO a fingertip
   grazes the gun, 5 to 6 mm for about a hundredth of the swap, as it leaves the hands and as the next lands.
8. Renames: ZEPHYR is STRYDER, and two more of the guns are named for people who matter to the owner, REZ and HAEFY
   (RIPTIDE and HELIX, the names that were ours rather than friends'): **done** (Milestone 313).
9. "the right arm is clearly still so fucked up lol, just put the guns away and look at the right arm": **done**
   (Milestone 313). The right fist was rolled 159 degrees on its forearm (the glove's cuff split open) and both thumbs
   stuck out ahead of the fists. The lesson for every gun: a wrist's roll on the forearm is measured as well as its
   bend, and each state of the hands is looked at, not just measured.

### Round 5 (2026-09-29, playtesting the build before the thrown swap)

1. "the arm looks out of place now when inspecting the hacks. If you just move it back down and slightly closer to the
   camera again i think it fixes it ... the arm is weirdly up and out there": **seen** (the elbow inside the picture on
   its left, the whole arm in from the side) and **done** (Milestone 330), 6 cm lower and 4 cm nearer, the forearm up
   from below the picture, and the elbow drawn down, BOOG's most (its rig sits lower and further ahead). The lesson:
   a pose is looked at on every gun, since each pack gun's rig sits in its own place.
2. "the hacks themselves can be slightly bigger themselves, be moved over slightly to the right as a pair, should have
   some more animation to it as well, like very basic glow or something or it should show the level as well like we do
   on the custom ui on the bottom": **done** (Milestone 330), bigger, 2 cm right, a pulsing halo, and the level as the
   HUD's pips in the slot's colour.
3. "make the whole animation like 2 seconds longer, so like a bit longer after each twist": **done** (Milestone 330),
   5.2 s, a second more held after each twist.
4. "include the tossing up animation of the hacks nearing the end of the inspect and they dissolve in the air like we
   plan to do when swapping guns": **done** (Milestone 330), tossed up off a flick of the palm and phased out with the
   gun's own sweep.
5. "ADS on the USSO, you can see part of the optic disappearing, showing all buggy and stuff. these are things i was
   hoping you would notice in general": taken at first for the gun's back end inside the camera's near plane
   (Milestone 329, which pushed the gun out and broke aiming: undone in Milestone 346); it was the mounted sight's own
   faces, drawn from one side (round 6, item 2). The lesson, kept: every state of a gun is photographed and looked at, aimed in and firing included, not only
   the ones the measures check.
6. "the left hand when doing the charging handle on the usso doesn't like close its joints/fingers around the charging
   handle ... it kind of keeps its same position from the pointing": **seen** (the forefinger straight up the gun's side,
   curled 13 degrees) and **done** (Milestone 333), the forefinger and thumb closed round the knob, the forefinger
   curled 133 degrees over the receiver's top.
7. "we should have the finger move up and down by a bit following where the mag goes, as if the finger controls the mag
   going in": **measured** (the finger already went with the magazine, 170 pixels, but in step with it and the gun's
   turn, so nothing read as the finger's doing) and **done** (Milestone 333), the finger 0.07 of the reload ahead of
   the magazine, down first and up first, the magazine following it.

### Round 6 (2026-09-29, the owner playing Milestones 329 to 333)

"We need to continue getting these two guns perfect. other than what i pointed out changed, the rest looks perfect ...
only once i approve we can move on to the other 8 guns".

1. "THE THUMB AND THE PALM OF THE LEFT ARM ARE NOT EXACTLY FLUSH UP WITH THE USSO ON THE GUNS LEFT SIDE, SEE THE GAP?
   TAKE SCREENSHOTS FOR IT, THE GAP IS OBVIOUS": **seen** (a dark gap between hand and gun at 3 times the owner's size;
   the palm touched at one point, a tenth of it 18.6 mm off, the thumb 21 to 28 mm) and **done** (Milestone 356), the
   palm's tenth 10.5 mm, the thumb 2 to 5 mm, no skin in the gun. The lesson: a hand on a gun is measured by how much
   of it lies on the gun, not its nearest point (`tools/pack-flush.ts`).
2. "the sight's base has seethrough textures and the bottom half of the red dot sight has them as well. that is
   obviously bugs and i asked for you to fix them before": **seen** (the lower half of the hex frame and the base
   see-through at rest, the sight a shell lifted off the steady SMG and drawn from the front only) and **done**
   (Milestone 346), drawn from both sides. And the owner, the same evening: "adsing with the usso is completely broken
   right now on the live build": Milestone 329's push undone, the near plane brought in instead (Milestone 346).
3. "for the right hands bottom two fingers, why is the middle finger so separated from the bottom two? the 3 should be
   next to each other and then the pointer on the trigger": **done** (Milestone 356), the middle fingertip 24.9 mm from
   the ring's where it was 36.4, as the ring's from the little finger's.
4. "MAKE THE muzzle flash only like 10% transparent, since we don't have a paid asset for it, it looks like shit still":
   **done** (Milestone 346), a tenth of it drawn (read as less of it: "only", and "it looks like shit still").
5. The swap: "we need the arms to go flying upwards and hands opening, then the reverse to catch the gun ... currently,
   the gun goes up and the hands go down. the hands should go up with the gun like if a person holding it were to move
   from the steady standing still position, then opened their palms up to throw it up and it disintegrates and then the
   reverse motion, other weapon phases in and they catch it higher up and bring it down. we don't want the hands to go
   too far up, just a bit to show the toss. and with how quick it is now the animation we want doesn't show the phasing
   in, you should have seen this in your screenshot frame by frame reviews, it needs to just be a slightly longer swap
   time and a faster animation for throwing it up and making it vaporize": done, then replaced by round 7's swap in
   place (item 3).
6. "Like we are doing the same things already with the hacks in the left hand, we should do that pretty much for the
   weapon swap. also we should use that animation/phase style with the weapon when it goes to swap and when we inspect
   it should be that glow we are using on the hacks, not the janky looking highlight we made from our non-assets days":
   **done** (Milestones 358 and 360): the swap phases as the cards do, out from the gun's middle; an inspect glows amber
   round the gun's edges, pulsing as the cards glow, the scan band gone.
7. "WE SHOULD UPDATE OUR HACKS ON THE UI TO LOOK MORE LIKE THE HACKS IN THE ANIMATION": to do.
8. (2026-09-30) "THE LAST THING I WANT IS FOR THE GUNS TO BE PUSHED RIGHT SLIGHTLY, FEELS LIKE THEY ARE TOO CLOSE TO THE
   MIDDLE OF THE SCREEN. THEN WE WILL NEED TO ANGLE THE GUN SLIGHTLY MORE TO THE LEFT AND UP TO COMPENSATE. IT SHOULD BE
   SIMILAR TO THE HYPERSCAPE AND HOW IT HAD THEIR GUNS. YOU'LL HAVE TO RECHECK ALL ANIMATIONS WITH THEM TO SEE IF ANYTHING
   GOT MESSED UP FROM IT"; and "LIKE WHEN WE GO TO MELEE THE GUN IS IN A BETTER ANGLE". First read as a move of my own (5 cm
   right, turned 4.6 degrees back in), which was not what was asked: see round 7, item 1.
9. The melee: "THE MELEE IS BROKE, THE GUN SHOULD JUST DISAPPEAR WHILE WE PUNCH FOR NOW. REVISIT THE MELEE IF NEEDED, IT
   SHOULD JUST BE LIKE THIS INSTEAD: HOLD THE WEAPON WITH THE RIGHT ARM, SWING AT THEM WITH THE LEFT ARM, LEFT ARM SHOULD GO
   FROM SUPPORTING THE GUN, BACK A BIT TOWARDS THE PLAYERS CHEST, THEN SWING OUT. ENSURE THE MELEE ACTUALLY WORKS AND DOES
   DAMAGE, WE SHOULDN'T BE ABLE TO SHOOT WITH MELEEING": **done** (Milestone 381): the right hand keeps the gun, the left
   goes back beside the body and punches, a fist; 30 a hit, measured on a dummy; the trigger holds nothing through it.
10. BOOG's bolt: "the sniper doesn't even have a visible bolt on it ... add something small on that side? we have paid
    assets that we can find something for": to do, a handle lifted from one of the bought sci-fi guns, moved by the clip
    that throws it.

### Round 7 (2026-09-30, the owner on round 6's first fixes)

"Everything else I mentioned is perfect except you did NOT fix the viewmodel of the gun that i requested."

1. The rest place: "when we melee currently, the gun goes to a different spot, which actually looks smaller and palced at
   a more natural angle and looks more like other shooters. simply equip the boog or usso, melee and within the melee
   frames, you'll see it jump to another spot. we want it defaulted there at that spot, have all our animations and frame
   inspects based off of that. The hack inspect is perfect though": the spot is the gun's own hold, where it goes when a
   melee lets the bought arms go (measured: the USSO 5.5 cm right, 2.3 cm up and 15 cm further out than the pack's hold,
   BOOG 10.5 cm right, 13 cm down and 12 cm out, neither turned). **Done** (Milestone 379): the rest hold moved there, gun
   and arms as one (`fparms.json` hipOwn), every state's frame sheets on both guns taken again from there.
2. BOOG's right hand: "the bottom 3 fingers on the BOOG are not lined up like they are on the USSO, it looks bad, then the
   trigger / pointer finger extends weirdly out to the right, there shouldn't be much of a gap if any there. only visible
   when we inspect". Seen from the gun's side: the forefinger lay straight along the gun above the trigger guard, the
   middle finger stood out in the air in front of the grip, the ring and little fingers far apart (fingertips 106 and 74 mm
   apart where the USSO's are 25). And the owner to the character agent, of the soldier: "trigger finger should be on the
   trigger, not in the ready position": both guns' forefingers onto the trigger. **Done** (Milestone 382): BOOG's hand
   turned down its grip, the three fingers wrapped round it, the forefinger's tip on the trigger; the USSO's forefinger
   onto its trigger (its tip 20 mm off before).
3. The swap: "lets toss out the throw up and vaporize ... keep the hands where they are while the weapon phases /
   disintegrates from the outside going in and gets replaced by the new weapon, it should go from the outside in, then the
   new weapon should materialize from the inside out ... more time for the vaporizing/materializing without the weapon
   moving much", and the hands "close and open around the phasing out/in of the weapon, like the streetfighter haduken",
   then, more exactly: "just have the two hands move together slightly and have the hands form facing the center like the
   street fighter does it ... slightly come off of where they were originally ... then slowly turn both hands inwards to
   that like ball type motion with the fingers bent in. Like, doesn't need to be too close to the center because then
   you're moving the hands a lot. And then as the next one forms in, we know where to place the hands because it's already
   that gun and selected. So then we just slightly move the left and the right hand back to where the right hand's on the
   trigger and the left hand's on the hand rest for that specific gun". And "i think our swaps are too quick for how we
   wanted it". **Done** (Milestone 380): swap style "cup", the phase radial round the gun's middle, each hand's own move
   off the gun and its own order, the swap 1.35 times longer.
4. "I also want the mag phase in for reload in to be in the reverse order it currently is. Makes it visually pop a bit
   more. So it goes from bottom to top now, should go from top to bottom now": **done** (Milestone 382). Filmed every 3%:
   the sweep already built the new magazine from its top down; the magazine rising 8 cm into the gun as it built read
   as bottom to top. It now phases in seated (`reload.slideIn` 0).
5. "ensuring each frame is perfect, no resetting states, jumping UI, or bugging in any frame from start to finish for
   each animation type. Pay extra attention to details like some of the arm missing or something like that and that the
   first and third person final forms agree with each others animations and movements when they reload for the boog and
   the usso. It's critical to have the agents on the same page with it before we move on to the remaining 8 guns": the
   frame sheets now catch jumps (each hand and the gun measured every frame, a spike re-held at four steps between to
   tell a snap from a quick move), and the soldier's reload is driven from the first person's own keys (`fparms.json`
   reload, packGuns rack), agreed with the character agent: no pouch, no drop, the magazine sliding and phasing out, the
   new one phasing in seated, the USSO's left hand racking and BOOG's right working the bolt over the same shares, and
   their e2e fails when the two part.
6. The look (the owner, after the first side by side): "the left arm a bit too high and the part of the arm that connects
   to the shoulder is like see through ... the support arm is much less pronounced than ours", "the gun is angled out of
   the bottom right corner", "I want it to look exactly like that ... Ours looks cheap in comparison", "Do the grid stuff
   with apex as well": **done** (Milestone 379), Hyper Scape's, Apex's and EMPULSE's frames gridded and measured, each
   gun fitted to the combined framing (an SMG covering 15% of the screen from the bottom right, a sniper 19%; ours had
   covered 10.5 and 6.9), the support arm only a forearm from under the gun.
7. "we need a reload differentiator for empty mag vs still 1 in the chamber (mag not empty on reload) for most guns":
   **done** (Milestone 383), no rack or bolt with a round chambered, the magazine on the same beats in seconds, the
   soldier the same (agreed with the character agent).

### Round 8 (2026-10-01, the owner: the two guns "like 95%+ perfect")

1. "make the magazine phase in from the middle out and then we take the mag out it should be from the outside in":
   **done** (Milestone 384), the magazine's phase radial round its own middle (`reload.magPhase`), as a gun's is on a
   swap; the key is the soldier's to read too (the character agent told).
2. Found on the way: BOOG's left ring finger drawn from nowhere in every frame it was held (a joint's position NaN in
   the animation mixer, which the L96X's hold clip never refilled). **Fixed** (Milestone 384): every pack gun's hold
   carries every bone its clips move.
3. Open for the owner: since the corner hold the USSO's reload turn brings it to 1.5 times its size at rest, its
   magazine at the picture's bottom edge (part under the weapon panel) and the pointing hand under the picture with
   only the fingertip in it. A search found turns that bring the hand and magazine up, but each moves the gun further
   from its corner; pictures sent, kept as it is until the owner picks.

## 2. The bar every gun in hand meets

Each is a check in the e2e soldier section (`tools/e2e.ts` packFrames) or on the frame sheets
(`tools/pack-frames.ts`), so a new gun cannot ship short of it.

| What | The measure |
|---|---|
| Every frame of the reload, the swap, aiming in, the pickup, the inspect, the first draw's flourish and the melee, a frame every 4% | no frame flagged on any sheet, a jump (a hand or the gun moved in one step of four between two frames) included |
| No hand through the gun | no seen skin more than 4 mm into it, in every state |
| Wrists | 50 degrees or less at rest and aimed, 60 pointing and swapping |
| The fists | the bought arms', rolled 45 degrees or less on the forearm, every finger curled, the thumb across the fingers |
| The point | the fingertip on its spot, down and left of the magazine, within 1 cm and 10 degrees |
| The magazine | out 8 cm as it phases out, the pointing finger leading it a third of the way and more; the new one phases in seated, built from the well down, the finger back at its spot |
| From the point to the rack | the support hand goes straight to the handle or bolt, never back to the gun between |
| The support hand at rest | on the handguard, ahead of the magazine, never on it; its palm and thumb lying along the gun (the palm's nearest tenth of skin within 13 mm, the thumb's quarter within 9), not touching at one point |
| The grip hand | the three last fingers together round the grip, each gap as the next, the forefinger's tip on the gun's Trigger part (not in the ready position), seen from both sides of the gun |
| The rack | the fingers close on the handle (the USSO's: the thumb and forefinger's tips within 2 cm of its knob, the forefinger curled 100 degrees and more round it) |
| At rest | the gun level, as Hyper Scape holds it, not pointed up and left, at the gun's own hold's place (where a melee used to show it), the arms moved with it |
| The swap | the gun kept in place (its middle within 1 cm), phasing out from its edges in and the next from its middle out; the hands 1 to 4 cm off it, turned in round its middle, the fingers bent; no knowledge of the next gun needed |
| The melee | the bought arms keep the gun in the right hand; the left punches from beside the body, a fist; 30 a hit on a dummy; no shot through it |
| First and third person | the soldier's reload beats read from the same keys as the first person's (fparms.json reload, packGuns rack), the character agent's e2e failing when they part |
| The inspect | the gun glowing amber round its edges as the hack cards glow; the other hand open, palm up, its forearm up from below the picture (the elbow under its bottom edge), every hack carried floating over it with its level, clear of the gun's sway; tossed up and phased out before the hand goes back |
| The inspect's own move | no frame at fault: the gun turned by the forearm, both arms reaching, wrists 60 or less, a forearm wrung 90 or less |
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
| CHOOCH (energy LMG, never reloads) | MGX5, the hold only | ahead of the drum | on overheating, a short vent gesture | |

Open for the owner: HAEFY on the SVD or on a Kar98K-style bolt loaded round by round; whether REZ's G3 hold is close
enough; whether CHOOCH gets a vent gesture. The order: BIGANTLER first (the exact match), then PANDA.
