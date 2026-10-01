# Phase 27 plan: the squad you can see, and the soldier holding the gun

Started 2026-09-28. A third agent, the character agent, works beside the guns agent (the first-person arms, reloads and
animations, worktree `apex-soldier`, branch `soldier`) and the maps agent (worktree `apex-city`, branch `city`). This
one works in `apex-character`, branch `character`, and owns the third-person player model (how you see enemies,
teammates and yourself in the Loadouts tab) and the squad's awareness of each other. Every request is listed here, in
the owner's words where they matter, so none is lost. Each item is built, tested, documented, committed and shipped
in turn, and marked here as it goes.

## What the owner asked

> "When i have my friend join and paly a BR mode with me, I should be seeing his name, health and stuff right above
> mine, like the rest of the BRs do, his model should always be visible in an outline with a small name above him in
> the color that he is. Color code them by blue, green, orange, white. So just their name and a small outline around
> them should be that color and the bottom left should have their color bordering it with a number, like 1 or 3 so it
> smore distinguishable. We should be very aware that we are playing with a friend and should have the al lthe
> indicators of that, like if a tm8 died or goes down or anything like that. Do this part first, then the 3rd person /
> enemy view of the soldiers."

> "If you just simpley go to the loadouts tab and then look at the character/soldier while they are weilding the usso,
> you can tell it is purely fucked up lol. Remember we are just focusing on the usso and the boog for now, while we get
> the rest of the guns to look good and the third person views."

> "so what do we have left from the solderi/character asset bundle that we paid like $50 for that we are not using? any
> other skins? packs on top of them? like what else can we do wit hthe main characters here. the "Kits" just seem to
> be adding on bulk to the characters, you know? is that what we are limited to? if so, thats fine, the main focus
> should be how the third person view model (how we see enemies as well) has the boog and the usso being held properly
> and their reloads are shown, doesn't need to be detailed, just some simple mags dropping in and out or their arms
> doing some reload animation type stuff. check out how we have the frame by frame tool for the first person FOV, we
> should be doing the third person / enemy view the same."

> "Make a planning document and you'll be running at the same time we have two other agents (maps + guns and first
> person POV reloads / animations / arms)."

Later the same day, while the squad view was being tested:

> "Continue, does the loadout screen show pixel perfect? Have you taken all screenshots frame by frame when the enemy is
> reloading and changing weapons and jumping and stuff of that nature?"

Not yet at that point: the squad came first, as asked. That question is the bar for 27.7 to 27.10: every move an enemy
makes with the USSO and BOOG (the reload, the swap, the jump, the run, the slide, aiming, firing) photographed frame by
frame from the side an enemy sees it, and the Loadouts tab's soldier with it, until no frame is at fault.

## The order

1. **The squad (27.1 to 27.5), first**, as the owner asked.
2. **The bundle audit (27.6)**: what of the bought soldier pack is not in use. It is a question to answer, and it
   decides what 27.7 has to work with.
3. **The soldier holding the USSO and BOOG (27.7 to 27.10)**: the grip, both hands, the reload, and the frame-by-frame
   tool for the third-person view, the way `tools/pack-frames.ts` does the first-person one.

## Items

| id | item | state | milestone |
|---|---|---|---|
| 27.1 | Squad colours and numbers: blue 1, green 2, orange 3, white 4, the same on every screen in the squad | done | 316 |
| 27.2 | The squad panel: each teammate's name, health and shield above your own, bordered in their colour with their number | done | 316 |
| 27.3 | Teammates seen through walls: a thin outline in their colour, and a small name above them | done | 316 |
| 27.4 | A teammate's state: to the Gulag, a ghost, restored, eliminated, left, on the panel, over them and in the feed | done | 316 |
| 27.5 | Checks: two real players in one squad over the network see all of it | done | 316 |
| 27.6 | The soldier bundle: what was bought, what is used, what is left | done (below) | |
| 27.7 | The third-person frame tool: sheets of the body holding the USSO and BOOG, every stage, faults flagged | done | 323 |
| 27.8 | The USSO and BOOG held properly in third person: the gun in the right hand, the left on the handguard | done | 323 |
| 27.9 | The third-person reload: the magazine out and in, the arms working it, seen by enemies and teammates | done | 323 |
| 27.10 | The Loadouts tab's soldier holding the gun it shows, the same way | done | 323 |
| 27.11 | Each hand closed round its hold: the palm and the fingers on the gun, not through it or beside it | done | 332 |
| 27.12 | Perfect on every front: every sequence of both guns from every side without a faulted frame (below) | next | |

The details of each item follow as it is started.

## 27.1 to 27.5: the squad you can see (done)

What there was: nothing of a squad panel, no colour or number per teammate, and no outline of a teammate at all (the one
outline was the red one round the enemy under the crosshair, depth tested so a wall hides it). Three faults were found on
the way, and fixed:

- **A teammate's health and shield only ever went down on your screen.** `duel.ts` took the lower of what it had and
  what their packet said, so that a packet sent before your hit could not undo it; with SpeedKills giving health and
  shield back, a teammate (and an enemy's plate) stayed at the lowest they had ever been. Now their word is taken up as
  well as down once a second has passed since your last hit on them (`net.json` hitTrust, `squadview.ts` heardVital).
- **A ghost could not be told from someone out.** A player's own stage of life was never sent. It is now, as one small
  optional field on the state (`lf`: the Gulag, a ghost, waiting to redeploy, out; nothing while up), added at the end of
  the delta format's keys so an older build's mask bits do not move and it simply ignores it.
- **"No restores left" never arrived.** The message had no place with it and the receiving code returned before reading
  anything without one, so a teammate's box stayed offered after their last restore. It is read first now.

What is built:

- **Numbers and colours** (`squadview.ts`, `squad.json` colors): by player id, which every screen in the squad already
  shares, so both screens agree with no message for it; given once a match and kept by anyone who leaves. Blue, green,
  orange, white, the orange held 30 degrees of hue off the enemy red and the white under the bloom's threshold.
- **The squad panel** (`hud.ts` drawSquadPanel, `hud.json` layouts.speedkills.squad): a row a teammate over your own
  speed line, bordered in their colour, their number on a square of it, their name, how far off, the shield's segments
  and the health bar; a hit flashes the row red and the part it took stays drawn, draining, for 0.8 s; in place of the
  bars, IN THE GULAG, GHOST: RESTORE AT THEIR ECHO, OUT, CONNECTION LOST, LEFT THE MATCH, REDEPLOYING. Your own number
  sits in your colour in the margin left of your own bars. The captions and the list of who is talking move up over it.
- **The ring through walls** (`outline.ts` MateOutline): the canvas and the post chain have no stencil, so the depth
  buffer cuts the ring: the figure is drawn to the depth buffer only at the nearest depth, then its hull only where that
  depth is not. It shows round the figure through anything and never fills it, 1.6 pixels wide on the screen at any
  distance. Only while the teammate is here: not in the Gulag, not out.
- **The name over them** (`hud.ts` drawMateTags): small, in their colour with their number, at any distance, their
  bars under it within 30 m and the distance past 20 m; over a ghost where the ghost is. It replaces the old green plate.
- **The compass and the map**: their number on their colour at the bearing to them, held at the strip's end with an
  arrow when they are off it; on the minimap and the big map their dot in their colour with their number. A ghost's
  column is drawn in their colour too.
- **The news** (`squadview.ts` mateNews): a feed line in their colour and a line in the middle for each change: to the
  Gulag, won it, lost it (a ghost: restore them at their echo), a ghost, back in the fight, out, the connection lost and
  back, left the match; and the character says the ones worth saying ("They're back!", "We lost one.", "Teammate
  dropped.") on top of the "Teammate down!" the death already had.
- **Checked**: `tools/checks/squadview.ts` in verify (numbers, colours, every state from what the packets say, the news,
  the trust window, the chip, `lf` on the wire), failing with the old health rule or the key put mid-list; the e2e
  `sksquad` section, two real pages in one squad (the numbers and colours on both screens, the name, the ring through
  walls and none on a bot, a hit and the shield coming back, a silence on a guest and a held seat on the host, the Gulag,
  lost, restored with the last restore's word reaching the squad, out, left), failing with the old health rule; and
  `tools/squad-shots.ts`, pictures of all of it drawn for real from both screens.

## 27.6 The soldier bundle

The bought soldier pack is one character: AC Game Assets' Sci-Fi Modular Soldier ($49.99). Its whole contents are one
FBX (a 67-bone rig, 18 armour and body pieces, 51 face blend shapes), three material sets for the armour, body, head
and eyes, 4096 textures with colour masks, and five eye colours. There are no other skins and **no animations at all**.
What the game calls kits (VANGUARD, BREACHER, RECON, RUNNER) are that one soldier with pieces of armour hidden, and the
colours are ours, laid on through the pack's masks. Left out of the game so far: the face's blend shapes (stripped on
import), two head textures (an extra-white skin and a subsurface map), and the pack's demo scene. The third-person moves
are the free Quaternius clips retargeted onto it, and among them the only ones for holding a gun are pistol clips: that
is why the soldier holds the USSO and BOOG badly, and why its reload is a pistol's.

So the answer to "is that what we are limited to?" is yes, for this pack: one soldier, its armour pieces on and off
(the four kits), its colours, its skin and eyes. There is no second skin to unlock and no animation to use. What is
left unused is small: the face's blend shapes (expressions, useless at a game's distance) and two head textures. Doing
more with the characters means either more of our own on this soldier (colour sets, decals, the kits' pieces in new
combinations) or another purchase: a pack of rifle animations for this Unreal-style rig would let the body move as a
rifleman does rather than as posed on top of pistol clips. The hold and the reload below are built so that they would
still sit on top of such clips.

## 27.7 The third-person frame tool

`tools/figure-frames.ts`, the third-person twin of `tools/pack-frames.ts`: a lab soldier holding the USSO and BOOG,
stepped by the tool (main.ts figureLabStep) so each frame lands on its moment exactly, photographed from the front, the
right, the left and the back, far (the whole figure) and close (the upper body), at a 40 degree lens. Sequences: at
rest, aimed in, looking from 40 down to 40 up, the reload and the swap a frame every 4% of the gun's own times, a jump,
a run, a sprint, crouching still and walking, a slide. Also the Loadouts tab's soldier holding each gun from four
sides. Each frame is measured by `tools/figure-audit.js`: each palm against its hold, the barrel against the look, the
wrists, a hand's skin into the gun and the gun into the body (each skin point against the nearest surface, inside only
when behind every face it lies on), and a caption on the tile says the numbers and, in red, what is past the bar.
`XRAY=1` draws the soldier see-through with every point found inside marked. `tools/figure-solve.ts` searches the
hold's numbers against the same measures (as `tools/pack-solve.ts` does the first-person arms).

The bar: a palm within 3 cm of its grip and 4 cm of its support; the barrel within 6 degrees of the look; wrists 60
degrees or less; no hand more than 6 mm into the gun; the gun no more than 15 mm into the body.

**Before** (the figures as they were, 2026-09-28): every frame flagged. The USSO hung at the chest with its stock in
front of the shoulder, the palm 6 cm off the grip, the left hand open under the barrel or hanging below it, hand skin
up to 30 mm into the gun, the gun 40 mm into the body, the reload a pistol's with the left arm off the gun.

## 27.8 The hold (done)

The legacy figures' hold (`figure.json` hold, `hold.ts`) was measured on the Quaternius mannequin and hangs a long
gun's grip 11.5 cm under and 22 cm in front of the shoulder joint by design; the soldier inherited it. SpeedKills'
soldier now has its own (`src/game/rifle.ts`, `src/config/soldierhold.json`): the chest turned so the left shoulder
leads, the butt in the right shoulder's pocket (measured off the model, in the chest's frame), the gun along the look
exactly, each palm placed on its hold and the hand turned to it (a two-bone reach to the wrist, the forearm's twist
bone taking half the roll), the fingers closed about their measured bend axes. What a hand is comes off the bones'
places (wrist, knuckles, the line across them), not their axes, because the bought rig mirrors its right hand's.

- **Aimed in** the gun comes up until its own sight line (the eye point the first-person view aims down) runs 7 cm in
  front of the right eye (measured off the soldier's eye mesh) and 3.5 cm to its right, the head leant onto the stock:
  lined up on the eye itself, the stock ended in the middle of the chest. At rest the butt is in its pocket and the gun
  at the chest; the two blend by how far the figure aims in (the Loadouts tab's soldier aims in).
- **The lowered carry** (a sprint, which SpeedKills always does, and a swap): the gun turned down, left and rolled about
  the butt, held out from the body, the left hand taking it its own way.
- **Full-body clips** (a slide, a climb, a zipline): the gun goes with the right hand (where it sits in the hand is
  remembered while both hands hold it); it used to hang at the chest with no hand on it.
- **A shot** kicks the muzzle up 5 degrees and back 2.5 cm, fading as the figure's kick does.
- **The numbers were searched**, not typed (`tools/figure-solve.ts`, stages pocket, hands, right, left, lowered,
  fingers): the pocket, each gun's palm places and turns, the elbows, the lowered carry. The guns' own marks were
  photographed first (`gunmodels.ts` grip and support): the USSO's grip point is the top of its grip, where the web of
  the hand goes, and BOOG's is on its receiver 11 cm ahead of its real pistol grip, so each gun's palm offsets are its own
  (`soldierhold.json` guns).
- **Where it stands** (the frame sheets): both palms on their holds and the barrel along the look in every hold frame;
  the wrists 1 to 38 degrees at rest and aimed, 38 lowered; the gun 19 mm into the armour at the collarbone aimed in,
  the stock resting on it. Over the sheets' bar then, since closed (27.11): hand skin 12 to 14 mm into the USSO where
  the fingers wrapped its grip, and 27 to 28 mm into BOOG round its thick grip and fore-end.

## 27.9 The reload (done)

Procedural, keyed to the gun's own reload time, so an enemy's plays from the moment their "reload" arrives and nothing
new goes over the network: the gun turned toward the left hand, the hand to the magazine, the magazine pulled out and
let go (a copy falls to the floor and fades), a new one from the pouch at the left hip pushed home, then the USSO's
charging handle racked by the left hand, BOOG's bolt worked by the right, and back to the hold.

The steps are shares of the reload (`soldierhold.json` reload): the tilt in over 0 to 12%, the magazine out over 18 to
28%, let go at 30%, the new one in the hand from 40% to 62%, the handle racked from 70% to 80%, back from 90%. The
upper body stays in the aim clip through it (the pistol's reload clip twisted the chest).

## 27.10 The Loadouts tab (done)

(Since Milestone 342 it holds the gun at rest, not aimed in, and the camera fits the whole gun at every turn.)

The tab's soldier is the same figure aiming in, so it holds the gun the new way. Its rebuild key now includes whether
the bought guns are in: a figure built before they loaded held the procedural stand-in until the loadout changed.

## 27.11 The hands closed round the guns (done)

The owner, 2026-09-29: "we want these two guns that the char holds to be perfect on all fronts, then i'll verify, then we
can move on to the other guns with the char". What close photographs of each hand on its hold showed, that the sheets'
measures had not:

- **The USSO's right hand crossed its grip.** Its middle knuckle sat on the grip's centre line, the palm inside the grip.
- **BOOG's right hand was not on its grip at all.** It lay flat on the receiver's side with the fingers splayed forward
  and up, and measured 2 mm into the gun: depth alone called it nearly perfect. Fitted by depth alone (the first
  figure-fit), the fingers of both guns came out straight, kept out of the gun and holding nothing.
- **The glove does not fit the USSO's trigger guard.** The soldier's gloved hand is 0.094 m across the knuckles and
  0.123 m from the wrist to the middle knuckle (measured), about 1.25 times a man's; the USSO's guard closes round the
  fingers with an opening 0.075 m tall, the trigger hanging in its top. Four gloved fingers cannot go through it.

What was done:

- **The USSO is drawn at 1.1 on the figure** (`soldierhold.json` scale, per gun; `mannequin.ts` setGun): the least the
  grasp fits (1.2 and 1.3 fitted no better). Only the figure's gun; the one in your own hands is the first-person arms'.
  BOOG's grip is open and takes the glove at 1.
- **Each hand grasps** (`tools/figure-fit.ts`): the palm seated along the way it faces, out of the gun or in onto it, then
  each finger closed a phalanx at a time, each until its own skin touches the gun (no more than 2 mm into it), a joint
  opened back if it pointed the next phalanx into the gun. The hand's place is searched round a start measured off the
  grip (the grip's thickness mapped a centimetre at a time, and photographed on a centimetre grid): 5 cm along the hand,
  a centimetre either way across its knuckles, tilted 12 degrees either way, a grasp at each, scored by no skin in the
  gun, the palm and the holding fingers touching it, the fingers closed, the wrist straight and the thumb round the far
  side. The knuckles had to go back: with a glove this size on a thin grip the first phalanges run along the grip's side
  and the middle ones cross its front.
- **The thumb swings** as well as curls (a finger's fourth number, its first joint's turn about the palm's normal;
  `rifle.ts`): only curled, the USSO's thumb stood straight up beside the receiver.
- **The sheets and the e2e hold contact** (`tools/figure-frames.ts`, `tools/e2e.ts` skfigure): a palm, or a finger that
  closes round a hold, more than 8 mm off the gun is a fault, as a hand in it is.
- **The audit is 28 times faster** (`tools/figure-audit.js`): the nearest surface found cell by cell nearest first,
  stopping once no cell can hold anything nearer, and each triangle read in place: a hand's measure 2.5 s to 90 ms, the
  whole figure's 2.9 s to 140 ms, the same answers. The fit tries about 12,000 grasps a hand.

Where it stands: every hand on its hold, no skin more than 2 to 6 mm into either gun, the palms and the holding fingers
on it; at rest, aimed and crouched the USSO has no faulted frame from any side (`shots/figure-v11`, both guns, every
sequence). BOOG's left hand holds its box magazine: its fore-end is 0.83 m in front of the butt, past a man's reach
(0.59 m to the palm), and its hand had slid back and cupped the air under the magazine (`soldierhold.json` support; the
chest turned to 41 degrees, a marksman's stance).

## 27.12 Perfect on every front (next)

The owner verifies the USSO and BOOG once no frame of theirs is at fault, and only then do the other guns follow. What
the sheets of 2026-09-29 still flag, most seen first:

- **The left hand where its hold slides.** When the arm cannot reach the support (running: the USSO 0.15 of the way to
  the grip, BOOG 0.43; looking 35 down), `supportHold` moves the hold toward the grip and the fitted hand goes with it,
  12 to 20 mm into the gun. Reach further with the shoulder (the clavicle forward) before sliding, or fit the hand for the
  places it slides to.
- **BOOG's right forearm and upper arm through its stock**, 21 to 40 mm in most poses: the stock is 10.5 cm wide and the
  forearm runs back along it from the grip. The elbow further out, the hand turned to put the wrist wider, or both.
- **The reload's own hand places** (`soldierhold.json` reload keys) were never fitted: skin up to 29 mm in, the magazine
  through the left forearm and the belly on its way to and from the pouch (40 mm), the left wrist to 72 degrees.
- **The swap**: BOOG lowered through the body (40 mm), the lowered carry's numbers being the USSO's.
- **The recoil**: the kick drives the butt 20 mm (the USSO) to 35 mm (BOOG) into the collarbone.
- **A slide's and a jump's way in and out**, where the arms blend between the clip and the hold.

First round (Milestone 340): the slide fixed by the shoulder reaching (no pose slides now), the recoil and the USSO's
aim by eye relief, the reload's hand places and tilt searched, both lowered carries searched. The USSO at rest, aimed,
crouched, firing, running and sprinting has no faulted frame; BOOG running and sprinting none. Next, most seen first:
BOOG's stock in the right shoulder and arm (every still pose, 21 to 40 mm), the swap standing (a lowered carry of its
own, the sprint's being right), the reload's magazine through the left forearm, then the look's extremes, the jump and
the slide.

Rounds two to four (Milestones 341, 342 and 347): the reload's new magazine held as a hand holds it; the swap and a sprint's
jump each with a carry of their own, blended in; the gun's arc between the carry and the hold; the Loadouts tab's
soldier at rest with the whole gun framed. Left for the owner's check (2026-09-30): BOOG's stock pressed 2 to 4 cm into
the rigid shoulder armour in its still poses (hidden from outside), the reload's left fingertips at the receiver (close
up only), and the USSO's stock end in the forearm pad on a jump's takeoff (hidden).

Round five (Milestone 353), the bug hunt in the game itself (`tools/live-shots.ts`: bots, your own figure in third
person, another player over the network): the melee a strike with the gun; a returning gun shown once the hands are on
it; the shoulder's reach to 34 degrees, so nothing slides aimed on the move; no item heals for SpeedKills' bots; a swap
on the same figure. After it, what is left of the two guns is what the owner was shown on 2026-09-30: BOOG's butt plate
in the rigid shoulder armour (hidden), the reload's left fingertips at the receiver (close up only), and 0.3 s of empty
hands after a throw. The other eight guns are planned in PLAN_SOLDIER_EIGHT_GUNS.md and wait on the owner's word.

Round six (the owner's look at the two guns, 2026-09-30): the soldier's reload made the first person's, read from the
guns agent's fparms.json at run time (the two agents agreed it over messages: the point, the phase out and in, the seat,
the rack, and the guns agent's slideIn and rackOut as they land); the right index on the trigger; the fingers a tenth
smaller (half could not hold the guns); BOOG by its rail, its shoulder let reach 70 degrees; a double jump's front flip,
sent over the network as a count; PULSAR out and APUHTHEE, a Riot One-like pistol, in. The two guns go back to the owner
to verify, first and third person together, before the other guns.
