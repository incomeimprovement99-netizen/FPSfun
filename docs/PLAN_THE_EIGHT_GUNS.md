# Plan: the other eight guns, in both views

The owner, 2026-10-01: "once I finalize the first person guns and reload animations and weapon swap and inspect, we
have like a clear plan that you can share with the other agents on which guns we'll do first and how we'll plan to
attack them ... break down each part ... that the agent ... will need to know about each gun ... tell the other agent to
do their homework too but to use this as a stepping stone ... which ones we'll do in order, why, all the things to look
out for ... since they use a shared platform now".

This is the shared plan for the guns agent (the first person: `apex-soldier`, fparms.json, gunfeel.json, viewmodel.ts,
fprig.ts) and the character agent (the soldier as others see it: `apex-character`, soldierhold.json, rifle.ts,
mannequin.ts). It starts when the owner signs off the USSO and BOOG in first person (their guns, reload, swap and
inspect). It replaces the order in `PLAN_SOLDIER_EIGHT_GUNS.md` and sits beside `PLAN_GUNS_IN_HAND.md`, whose bar (its
section 2) and fitting recipe (its section 4) still hold for the first person.

**It is a stepping stone.** Each agent does its own homework on each gun before building it (its pack gun's clips, its
model measured, the owner's words on it) and writes what it finds into its row below, correcting anything here that
turns out wrong. Nothing here is typed in by eye: where a number appears, it came from the configs or a measurement
named beside it.

## 1. Where we stand

- **The USSO and BOOG are done in both views** (the guns agent's Milestones 379 to 384, the character agent's 366 to
  393): the hold, the trigger finger, the reload from empty and the tactical one, the magazine phased round its middle,
  the swap in place (the cup), the melee (the left hand's punch), every frame of each on the sheets, and the checks.
- **The soldier already follows the first person through one shared set of keys**, read at run time, so the two views
  cannot drift apart. The character agent's skfigure e2e reads the same keys and fails when they part. Change one only
  after messaging the other agent.

| Key (the guns agent's file) | What the soldier does with it |
|---|---|
| fparms.json `reload` point, phaseOut, phaseIn, seat, rack, rackBlend, slide, slideIn, lead, follow, tipBack, rackOut | the reload's beats, shares of the empty reload's time (rifle.ts reloadPlanOf) |
| fparms.json `reload.tactical` {rack, back}, packGuns.&lt;g&gt;.tacticalRack | the reload with a round chambered: no rack or bolt, the hand back over `back` |
| fparms.json `reload.magPhase` | "radial": the magazine phases round its own drawn middle |
| fparms.json `guns`, packGuns.&lt;g&gt;.rack (clip, window, grab) | which hand works the gun after the seat, and when |
| fparms.json `swap.style`, `swap.cup` | "cup": the swap in place, the hands cupped round the gun on the same shares |
| fparms.json `melee` {on, punch, off, fist} | the punch's shares (the soldier's own places in soldierhold.json melee.punch) |
| gunfeel.json guns.&lt;id&gt;.swap {out, in}, `phase` | the swap's phase out and in, the sweep's look |

- **The other eight are in the game today but not fitted in either view.** On the soldier they are held by the shared
  numbers (rifle.ts, soldierhold.json without a `guns.<id>` entry): roughly right, hands not fitted, no reload of their
  own. APUHTHEE, the pistol, is held by the old clips' pistol hold (mannequin.ts, `kind: "pistol"`). In first person
  they are on the older arms, not the bought pack's.
- **Only the USSO and BOOG have a gunfeel.json entry**, and the soldier's swap phase and cup need one per gun
  (mannequin.ts swapOf). Each new gun's gunfeel entry is the guns agent's.

## 2. The eight, as they are

Numbers from the game (weapons.ts resolveWeapon at fusion 0, SpeedKills' tuning, 2026-10-01). Parts are the bought
model's own named parts (read off each .glb), which are what both views can move.

| Gun | Class | Magazine | Reload, round chambered / from empty | Fire | Bought model | Its moving parts | Shares a model with |
|---|---|---|---|---|---|---|---|
| ANAKIN | Steady SMG | 18 | 1.90 / 2.20 s | auto, 600 a minute | SciFiSMG01_2 | Clip, Slide, Button | (the USSO wears its scope) |
| PANDA | Heavy Rifle | 19 | 2.40 / 3.10 s | auto, 510 | SciFiRifle01_2 | Clip, Extruder; no handle | STRYDER |
| STRYDER | Fast Rifle | 21 | 2.40 / 3.20 s | auto, 810 | SciFiRifle01_2 | Clip, Extruder; no handle | PANDA |
| HAEFY | Marksman | 6 | 2.60 / 3.40 s | semi, 139 | SciFiSniperRifle01_2 | Clip, Spinners | BOOG |
| BIGANTLER | Heavy Shotgun | 5 | 2.00 / 3.00 s | semi, 60 | SciFiShotGun02_2 | Pump, Cover, Bullet; no magazine | none |
| REZ | Auto Shotgun | 8 | 2.75 / 3.00 s | auto, 168 | SciFiShotGun01_2 | Clip, Button; no handle | none |
| CHOOCH | Energy LMG | 24 (heat) | never reloads: cools when it overheats | auto, 600 | SciFiGrenadeLauncher01_2 | Drum (turns a chamber a shot), sights | none |
| APUHTHEE | Heavy Pistol | 6 | 2.10 / 2.10 s | semi, 168 | SciFiPistol02_2 | Clip, Slide | none |

First person, from `PLAN_GUNS_IN_HAND.md` section 5 (the guns agent's, to be confirmed in their homework):

| Gun | Pack gun | Match | Support hand | After the seat |
|---|---|---|---|---|
| ANAKIN | ASVal | good | handguard, ahead of the magazine | its handle |
| PANDA | AK | good | handguard | the AK's side handle |
| STRYDER | MX16A4 | good | handguard | the rear handle pulled |
| HAEFY | SVD (or a Kar98K-style bolt: the owner's call) | open | handguard | its bolt or handle |
| BIGANTLER | KXG12 | exact | on the pump | shells one by one at the gate, then a pump; a pump after each shot |
| REZ | G3 | weak (the owner's call) | the long handguard | the G3 handle slap |
| CHOOCH | MGX5, the hold only | hold only | ahead of the drum | none; a vent on overheating if the owner wants one |
| APUHTHEE | **none chosen yet** | gap | both hands on the grip | the slide |

## 3. The order, and why

The soldier follows the first person (its reload, rack and swap keys are the first person's), so each gun is the guns
agent's first and the character agent's right after. Both can start a gun at once: the soldier's hold, fingers,
carries and checks need nothing from the first person; only its reload's keys wait for the first person's.

| # | Gun | Why here |
|---|---|---|
| 1 | **ANAKIN** | The nearest to the USSO in both views: a magazine ahead of the grip and a real Slide to rack (SciFiSMG01_2), a good pack match (ASVal). No new kind of reload in either view, so it proves the per-gun pipeline (the groundwork below) with the least new code. |
| 2 | **PANDA and STRYDER** | Two of the most played guns on one bought model: one fit of the soldier's hands and carries for both. Two pack guns in first person (AK, MX16A4), so two racks. New: the model has no handle part, so where the rack's hand goes is decided once for both views (section 4). |
| 3 | **HAEFY** | Nearly free on the soldier (BOOG's model, BOOG's fit), once the owner picks its first-person action (SVD or a bolt). Waits on that word, so it may swap places with 4. |
| 4 | **BIGANTLER** | The exact pack match (KXG12), but the one new kind of reload in both views (shells at the gate in a loop, then a pump) and a pump after every shot. Built once the pipeline is proven on simpler guns. |
| 5 | **REZ** | A magazine shotgun with the furthest fore-end hold of any gun (the soldier's left arm may come up short, as BOOG's did, so its hold may come back along the gun) and a weak pack match: the owner looks at the G3 first. |
| 6 | **CHOOCH** | No reload in either view; the work is the hold of the widest gun (its drum against the chest and the left forearm), its carries and swap, and the vent if the owner wants it. |
| 7 | **APUHTHEE** | The one pistol: a new kind of hold in both views (no stock, both hands on the grip, no pack pistol chosen yet), so the most new code, last. |

The guns agent's own order put BIGANTLER first, for its exact match. What decides it: if the owner plays BIGANTLER most,
it goes first and the pipeline is proven on it; otherwise ANAKIN first. The owner's word moves any gun up.

## 4. Groundwork, once, before the first gun

Both agents, agreed in a message before either builds:

- **A gun's reload in the shared keys, per gun.** Today `reload` is one timeline for both guns and only the rack differs
  (packGuns.&lt;g&gt;.rack). The eight need a gun's own: a pump's loop (BIGANTLER), a slide (APUHTHEE), none (CHOOCH). The
  guns agent proposes the shape (for example packGuns.&lt;g&gt;.reload over the shared one, with a `style` of mag, pump or
  none, and a pump's start, each and end shares), and the soldier reads the same.
- **Where a rack's hand goes on a model without a handle** (both rifles, REZ): a measured spot on the bought model,
  one per gun (the AK's handle is on the right side, the MX16A4's at the rear top, though PANDA and STRYDER share a
  model), kept in one place both views read (paidweapons.json or fparms.json), not two places that can disagree.
- **A gunfeel.json entry per gun** (the guns agent): its swap's out and in shares and its feel. Without it the soldier's
  swap pops the gun and has no cup (mannequin.ts swapOf).
- **The tools and checks take a list of guns**, not the USSO and BOOG by name: figure-frames.ts, figure-hands.ts and the
  skfigure e2e (the character agent's); pack-frames.ts and the soldier e2e (the guns agent's). Adding a gun is then
  adding its id.
- **One fit a shape on the soldier** (soldierhold.json `guns.<id>`): a gun may take another's numbers and write only
  what differs (`guns.3030` from `guns.sentinel`, `guns.vinson` from `guns.rspn101`), so a shape is fitted once.
- **A shot's own motion on the soldier.** In first person BOOG's gun cycles after a shot (gunfeel.json `cycle`: it
  cants and its wheels turn) and BIGANTLER will pump; the soldier shows only a kick today. A remote's shots already reach its figure (the kick), so the figure can play a
  per-shot cycle from them: BOOG's now, BIGANTLER's pump with it.

## 5. Each gun

Each section: what is new in it, the first person's work (the guns agent's, from their plan; theirs to correct), the
soldier's work (the character agent's), and what to look out for. Everything not named here is as the USSO and BOOG
(the recipe in `PLAN_GUNS_IN_HAND.md` section 4 and `PLAN_SOLDIER_EIGHT_GUNS.md`'s recipe).

### 5.1 ANAKIN (alternator_smg), the Steady SMG

- **New:** nothing in kind; it is the USSO's recipe on another model and pack gun.
- **First person:** import the ASVal; fit the hands (the support hand ahead of the magazine, the forefinger's tip on
  the Trigger part); measure when its clip racks the handle and where the hand takes it; its gunfeel entry.
- **Soldier:** measure its trigger guard against the gloved fingers (the USSO had to be drawn 1.05); fit both hands
  (figure-fit.ts), the trigger at the last joint's crease; the body round the gun (figure-solve.ts rest, lowered through
  the stride, swap, air); the reload's keys off its Slide, with the handle's own fingers (KEYFINGERS); its checks.
- **Look out for:** SciFiSMG01_2 lends its scope to the USSO (paidweapons.json mount), so the two share a sight but
  not a hold; its magazine group may hold the procedural magazine hidden, as the USSO's did (measure drawn meshes
  only).

### 5.2 PANDA (vinson) and STRYDER (rspn101), the rifles

- **New:** one soldier fit for two guns; two first-person racks on a model with no handle part.
- **First person:** two pack guns (AK, MX16A4), each fitted; the rack spot measured on our model for each (groundwork);
  two gunfeel entries.
- **Soldier:** one fit (guns.vinson takes guns.rspn101's numbers, groundwork); each gun's reload keys at its own rack
  spot; the fore-end hold 83 cm from the butt, inside the arm's reach standing (`PLAN_SOLDIER_EIGHT_GUNS.md`'s survey),
  checked aimed on the move.
- **Look out for:** a long gun's butt plate sits 2 to 4 cm into the soldier's rigid shoulder armour at rest, as BOOG's
  does, hidden from outside and flagged by the measure; the rifle is as long, expect the same and photograph it from
  four sides. The Extruder part is the model's own, not a handle.

### 5.3 HAEFY (3030), the Marksman

- **New:** the owner's choice of action in first person (SVD semi with a handle, or a bolt worked round by round).
- **First person:** the chosen pack gun; HAEFY fires semi-automatic at 139 a minute with no rechamber, so whichever is
  chosen, no bolt between shots.
- **Soldier:** BOOG's fit as it stands (same model, same rail hold, same carries), its own reload keys for the chosen
  action, its own reload time (2.6 / 3.4 s against BOOG's 3.0 / 4.0).
- **Look out for:** HAEFY and BOOG must still read as different guns (the owner: "as long as each gun is different"):
  the skins differ (B C A against A B C), the action and the fire rate differ; the per-shot cycle is BOOG's alone.

### 5.4 BIGANTLER (mastiff), the pump shotgun

- **New:** the one new reload in both views: no magazine, shells fed at the gate one by one (the pack's start, loop and
  end), then a pump; and a pump after every shot.
- **First person:** the KXG12's clips (an exact match); the pump is a moving part of our model (Pump), the gate is
  Cover and a shell is Bullet; its gunfeel entry; the reload's shape in the shared keys (groundwork).
- **Soldier:** a pump reload in rifle.ts, the hands as the KXG12's (which hand feeds the gate and which works the pump
  is read off its clips by the guns agent, and the soldier follows), a shell a loop, then the pump; the per-shot pump
  from the remote's shots (groundwork). The left hand's hold is on the pump already (71 cm from the butt).
- **Look out for:** another player's figure does not know how many shells are missing; the loop count it plays must
  come from the reload's time (a fixed count per reload), not the ammo, or be sent (an act code change, appended). A
  reload from empty is the loop plus a pump; with a shell chambered, the loop only (the tactical rule).

### 5.5 REZ (shotgun), the auto shotgun

- **New:** the furthest fore-end hold of any gun (86 cm from the butt) and a weak pack match.
- **First person:** the G3, if the owner keeps it; its handle slap at a measured spot (no handle part, groundwork).
- **Soldier:** the fore-end hold checked aimed on the move: if the arm comes up short it slides back along the gun, as
  BOOG's did before its rail fit; the reload as the USSO's with the slap at its spot.
- **Look out for:** the auto shotgun's parts all sit at the gun's origin in the pack (paidgun.ts hingeParts finds their
  hinges off their geometry); its Button is not a handle.

### 5.6 CHOOCH (lstar), the energy LMG

- **New:** no reload: it cools when it overheats (speedkills.json `_ammo`). The widest gun, 24 cm at its drum.
- **First person:** the MGX5's hold only; a vent gesture on overheating if the owner wants one; the drum already turns a
  chamber a shot.
- **Soldier:** the hold and the carries round the drum (the drum against the chest and the left forearm at rest, in
  the sprint, the air and the swap carries, measured through the stride); the support hand ahead of the drum; no reload
  keys; a vent on the figure only if the first person has one (an act code if it is to be seen by others).
- **Look out for:** the drum is the gun's widest part and sits where the left forearm passes; check every carry, not
  only the hold. `PLAN_SOLDIER_EIGHT_GUNS.md` gave it a drum change, which it does not have.

### 5.7 APUHTHEE (wingman), the heavy pistol

- **New:** the only pistol: no stock, so neither view's long-gun hold applies; no pack pistol chosen in first person.
- **First person:** choose the pistol's arms and clips (which pistol, if any, the bought arms' packs have is the guns
  agent's homework); the slide (Slide) and the magazine (Clip, in the grip); its reload is 2.1 s from empty
  and with a round chambered alike, so the slide's release on an empty one is a look, not a time.
- **Soldier:** a pistol stance in rifle.ts (the gun placed by the hands and the look, not a shoulder pocket; both hands
  on the grip; aimed at the eye; carried low for a sprint and the swap); the reload from the grip's bottom; the swap's
  cup round a small gun; the punch with the pistol in the right hand.
- **Look out for:** the old pistol hold (mannequin.ts, the clips' own) must give way only for this gun on the soldier;
  the legacy game's figures keep theirs.

## 6. Done, for a gun

Both bars hold, each agent's own:

- **First person:** `PLAN_GUNS_IN_HAND.md` section 2 (every frame of the reload, swap, aim, pickup, inspect, draw and
  melee unflagged at 4%, no hand more than 4 mm into the gun, the wrists, the fists, the point, the magazine, the rack,
  the grip hand, the swap in place, the melee, the inspect).
- **Soldier:** `PLAN_SOLDIER_EIGHT_GUNS.md`'s bar (no flagged frame at rest, aimed, crouched, firing, running, running
  aimed and sprinting from any side; no hand more than 6 mm into the gun; both palms and the holding fingers on it;
  whole in the Loadouts panel), the trigger at the crease, the reload, swap and melee as the first person's, and the
  skfigure e2e for the gun, each check seen failing with its fault put back.
- **Together:** the soldier's reload, swap and melee read the gun's keys, the soldier's e2e fails when the two part,
  and the owner gets the sheets and close-ups of both views for each gun.

## 7. Things to look out for, learnt on the USSO and BOOG

- **Measure, never type a number in by eye.** Sleeves inside arms and heads 30 to 60 mm high came from guesses.
- **Look at every state, close.** The USSO's optic clipped only aimed; a hand can measure 2 mm and hold nothing.
- **Between the frames.** A 4% sheet missed BOOG's finger sliding 16 mm through its fore-end at 7% (found at 0.5%);
  the soldier's sprint carry was clean at one moment of the stride and 17 mm into the chest a few tenths later. Measure
  through the motion, not at one moment.
- **The fingers, not only the palm.** The trigger is pressed at the last joint's crease, not the tip; a hand turning
  while its fingers still hook the gun drags them through it (the soldier's punch, 18 to 24 mm); a reload key may need
  its own fingers (the USSO's handle).
- **Hidden parts.** A bought gun's magazine group also holds the procedural magazine, hidden (107 mm off on the USSO):
  measure drawn meshes only. A pack gun's hold clip without a track for a bone left that joint NaN in the mixer
  (BOOG's ring finger): pad every hold clip.
- **A search's blind spots.** A solver moved BOOG's carried left hand 6 cm along the gun and its palm off it because the
  cost had no palm term; check every search's result in photographs.
- **The measure must see what is drawn.** The soldier's audit counted the parts of a gun already phased out of sight; it
  now counts only what is drawn.
- **Shared keys change together.** Message before changing any key in section 1; the other's e2e fails otherwise.
- **The network.** A new act the others must see gets an act code appended (the empty reload's 9), never a reused one,
  so an older page shows nothing rather than the wrong thing. Bots reload only from empty.
- **The dev server reloads every page on a src or README edit**, killing a running page tool; and a python write can be
  missed by its watcher (touch the file).
- **A busy machine.** Timing e2e checks flake when other agents' tests run; the frame tools step their own clock and do
  not.
- **The bought files deploy from main** (`npm run fps deploy` builds from apex-range): a re-bake made in a worktree is
  copied into apex-range's public/models/paid.

## 8. For the owner to say

- Go, and in this order (section 3)? Any gun you play most moves up.
- HAEFY's first-person action: the SVD (semi, a handle) or a bolt worked round by round.
- REZ on the G3, or another pack gun.
- CHOOCH: a vent gesture when it overheats, seen by others too?
- APUHTHEE: one hand or two, and which pistol arms in first person.
- BIGANTLER: how many shells the loop shows when others see it reload (a fixed count, or the real count sent).

## 9. Each agent's homework, before its first gun

- **The guns agent:** for each gun, its pack gun's clips (the reload, the rack, the hold), the match against our model,
  the rack spot where there is no handle, and a gunfeel entry; the reload's per-gun shape in the shared keys (section
  4); a pistol for APUHTHEE. Write it into section 5's first-person lines and section 2's second table.
- **The character agent:** for each gun, the trigger guard against the glove, the fore-end hold's reach standing and on
  the move, the carries round the gun's widest part, and the soldier's reload kinds still to build (the pump, the
  pistol); the tools and checks over a list (section 4). Write it into section 5's soldier lines.
