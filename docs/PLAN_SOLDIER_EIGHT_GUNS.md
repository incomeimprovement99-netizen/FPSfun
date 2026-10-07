# Plan: the eight guns on the soldier, as other players see them

The owner, 2026-10-01: "No need to do the first persons agent work for them, just stick to the 3rd person and enemies
view and have it planned well so you can finish better or have less bugs."

This is the character agent's working plan for the eight guns after the USSO and BOOG: the soldier as everyone else sees
it (enemies, teammates, your own figure in third person, the Loadouts tab, the bots). The order, the roster and what is
agreed with the guns agent are in `PLAN_THE_EIGHT_GUNS.md`, the plan both agents share; this one sits under it and says
how the soldier's side gets built with the fewest faults. The first person is the guns agent's and is not planned here.

Nothing on the eight starts until the owner signs off the USSO and BOOG and approves the shared plan. Step 0 and the
groundwork below are the soldier's own and can go first.

## 1. Where the soldier stands, measured (2026-10-01)

Each gun on a lab figure, each sequence stepped at 1/30 s and audited every frame (`tools/figure-audit.js`): **hand** is
the deepest skin of either hand inside the gun, **gun** the deepest point of the drawn gun inside the body (torso, arms,
head), mm, the worst frame of the sequence. The audit stops looking at 30 mm (hand) and 40 mm (gun), so 30 and 40 mean
"that much or more". A frame is counted bad past 6 mm (hand), 15 mm (gun), a palm 3 mm (right) or 4 mm (left) off its
hold, or a wrist bent past 60 degrees. Look is aimed from 40 degrees down to 40 up; jump is out of a sprint.

| Gun (id) | idle | aim | look | run aimed | sprint | crouch | reload | jump | melee |
|---|---|---|---|---|---|---|---|---|---|
| USSO (r97) | 0/36 | 0/31 | 1/31, gun 16 | 0/36 | 0/31 | 0/31 | 27/87, hand 22 | 1/42, gun 39 | 0/25 |
| BOOG (sentinel) | 9/36, gun 16 | 31/31, gun 23 | 31/31, gun 40 | 36/36, gun 30 | 7/31, gun 35 | 31/31, gun 35 | 122/139, hand 30, gun 40 | 34/42, gun 40 | 9/25, gun 16 |
| ANAKIN (alternator_smg) | all, hand 29, gun 40 | all | all | all | all | all | all, wrist 94 | all | all |
| PANDA (vinson) | all, hand 28, gun 37 | all | all | all | all | all | all | all | all |
| REZ (shotgun) | all, hand 29, gun 38 | all | all | all | all | all | all | all | all |
| BIGANTLER (mastiff) | all, hand 27, gun 31 | all | all | all | all | all | all | all | all |
| CHOOCH (lstar) | all, hand 25, gun 40 | all | all | all | all | all | all | all | all |
| APUHTHEE (wingman) | all, hand 30, palms 3.9 and 4.4 off | all | all | all | all | all | all, left 67 mm off | all | 13/25 |

STRYDER (rspn101 today) and HAEFY (3030 today) are not measured: both change model (section 6).

What it says:

- **The six fitted to nothing are fits from scratch, not touch-ups.** Every frame of every sequence has a hand 25 to 30
  mm or more through the gun and the gun 31 to 40 mm or more into the body. They are held by the shared numbers only.
- **APUHTHEE is on the old clips' pistol hold** (mannequin.ts setGun: the gun parented to the right hand, the clips'
  Pistol_Idle_Loop and Pistol_Reload, no rifle rig), so none of the soldier's reload, swap cup or punch applies to it.
- **The template is not clean between its frames.** The USSO and BOOG pass their e2e checks, which look at chosen
  moments, but the sweep finds the USSO's reload with a hand up to 22 mm in the gun over 27 of its 87 frames, one sprint
  jump frame with the gun 39 mm in the body, and BOOG over the line nearly everywhere. Located (`figure-sweep.ts
  DETAIL=1`):
  - **The USSO's charging handle**: from 1.53 s to 2.30 s of the reload from empty the left palm is up to 22 mm into the
    receiver, its deepest skin at the gun's own middle plane, with the gun rolled toward it; the key was only ever
    searched at the middle of its span, where it measures 17 mm, and no single move of the key or its fingers lowers it
    (a local minimum). Also 13 to 17 mm of the left ring and middle fingers at the reload's first 0.2 s, as the gun
    starts to roll and the hand is still on its hold.
  - ~~The USSO's sprint jump~~: the 39 mm frame was a false reading; measured exactly (below) it is 8 mm.
  - **The USSO aimed 40 degrees up**: the gun 16 mm into the left collarbone at the very end.
  - **BOOG's stock in the right forearm**: 179 of its bad frames are the gun into the right forearm (16 mm at rest, 30
    running aimed, 35 sprinting, 40 or more in the reload and the jump), then the right upper arm crouched (35), the left
    collarbone aimed (23) and the chest looking down (40). It is not the butt in the shoulder armour, as was thought: the
    measure puts it on the forearm. **Every long gun of the eight has a stock**, so this is the template fault that
    matters most to them.
  - **BOOG's reload**: the right thumb up to 30 mm in at the bolt's end (2.5 s), and the left hand at its point (58
    frames).
  The eight copy this template, so it is cleaned first (step 0).
- **The gun-in-body measure was blind past 4 cm (found 2026-10-02).** figure-audit.js looks 4 cm in from a gun point
  for the body's surface and calls a point with none that near outside, so a stock right through an arm showed only
  its edge (40 at most), and a longer look alone took points beside an armour shell for inside (the USSO's stock "74
  mm" in a forearm it only runs beside). Its exact look (`exact`) searches 15 cm and keeps a point only if rays from it
  cross the mesh it is in an odd number of times; the sweep and the solver use it. Measured so:
  - **The USSO is clean** (its sprint-jump frame really 8 mm).
  - **BOOG**: the stock 73 mm into the chest looking 35 up (the plain look said 39), 104 mm into the right forearm at
    the reload's end (2.67 s), 61 in a sprint jump; 16 at rest and 23 aimed as before.
  - **ANAKIN**: 59 to 79 mm into the right forearm just behind the hand at rest, running, sprinting and reloading, and
    150 or more into the belly in a sprint jump; 26 aimed (the butt in the shoulder armour).
  - The skfigure e2e still uses the plain look (its BAR.gunIn 40): moved to the exact one once these are fixed, or its
    checks would fail on faults already written here.

## 2. Step 0: the template clean, before any new gun

The soldier's own work on the USSO and BOOG, no new gun involved:

1. **Make the sweep a tool** (`tools/figure-sweep.ts`): the measure above, a gun list on the command line, one page a
   gun (one page for many guns died after two, "Target closed"), each sequence at 1/30 s, the worst frame of each
   measure and where it is (the audit's `locate`: which bone, which part of the gun). Minutes a gun, against the two
   hours the frame sheets take at that step.
2. **Say where each clash is.** The sweep reports the gun's depth by part and bone and the hand's skin in the gun's
   own frame (done: it is what showed BOOG's clash is the forearm, not the armour it had been taken for).
3. **Fix or explain each located fault** (section 1), BOOG's stock in the forearm first since every long gun meets it:
   each photographed close (`figure-hands.ts STEP=`), and either fixed in soldierhold.json and checked, or written down
   with why it is left. A key searched at one moment needs searching across its span (figure-solve.ts measures the
   middle only), and a local minimum needs a restart with combined moves, not one number at a time.
4. **The numbers become the bar.** The sweep's clean numbers for the USSO and BOOG are what each new gun is held to.

## 3. Groundwork, once, before the first new gun

| # | What | Why | Where |
|---|---|---|---|
| G1 | The sweep tool (step 0) | the frame sheets step 4%, and a finger 16 mm through BOOG's fore-end lived at 7% | tools/figure-sweep.ts |
| G2 | **Tools and checks over the fitted list**: the list is the keys of soldierhold.json `guns`; figure-frames.ts and figure-hands.ts default to it; the skfigure e2e's loops (now `["r97", "sentinel"]` twice) and its swap check (now the USSO into BOOG by name) read it; BOOG's own checks (the glint, the rail) keyed on what the gun has (an optic with an overlay; a `support` of its own), not on its name | adding a gun is then adding its fit, and no check is forgotten for it | tools/, tools/e2e.ts skfigure |
| G3 | **The act code narrowed**: a heal is 10 to 19, not 10 and up (dummy.ts actFromCode, duel.ts's heal item), shipped alone, a release ahead of the vent | every page today reads any code from 10 as a heal, so a page from before would show CHOOCH's vent as a heal with no item; narrowed first, pages in play read 20 as nothing by the time it is sent | src/game/dummy.ts, src/game/duel.ts |
| G4 | **A gun's reload shape**: rifle.ts reloadPlanOf builds its keys by the gun's style (mag as today, pump, slide, tube, none), read from the shape the guns agent proposes in the shared keys; the figure finds each style's parts by name on the model (Pump, Cover and Bullet; the Clip in a grip; the rocket) | the soldier's reload is the first person's and must not grow a second timeline | src/game/rifle.ts, mannequin.ts reloadParts |
| G5 | **A shot's cycle on the figure**: Dummy.kick() already runs on every shot of every figure (yours, a bot's, a remote's); the mannequin keeps the time of it and rifle.ts plays the gun's cycle on gunfeel.json's `cycle` shares: BOOG's cant first (the first person has it), then BIGANTLER's pump | the pump after every shot is part of the gun; nothing new goes over the network | src/game/dummy.ts, mannequin.ts, rifle.ts |
| G6 | **Stances in the rig**: soldierhold.json guns.&lt;id&gt;.`stance` of long (today's, the butt in the shoulder pocket), pistol or launcher; mannequin.ts setGun sends the soldier's pistol to the rig instead of the right hand, and leaves the legacy game's figures on their clips | the cup, the punch and the reload then apply to every gun, and B00G FPS does not change | src/game/rifle.ts, mannequin.ts |
| G7 | **Hand on hand in the audit**: the left hand's skin into the right hand's | the pistols hold both hands on one grip, and nothing measures one hand through the other today | tools/figure-audit.js |
| G8 | **figure-fit's left search with the right hand in place** | the left hand's grasp on a pistol is round the right hand, not only the gun | tools/figure-fit.ts |

G1, G2 and G3 are small and go first; G4 and G5 are agreed with the guns agent before they are built (section 4 of the
shared plan); G6 to G8 land with the pistols.

## 4. The recipe a gun, with its checks

The USSO's and BOOG's, in the order that worked, with the sweep added. Every number is measured; none is typed by eye.

1. **Measure the gun**: `gun-shape.ts` (the side map and cross-sections), a photograph alone on a centimetre grid
   (`figure-hands.ts GUNONLY`), its moving parts' names off the .glb. Read the grip, the trigger guard's opening, the
   magazine or pump, the fore-end's width and underside, the widest part.
2. **Its size**: if four gloved fingers (the glove is 0.094 m across, fingers drawn at 0.9) do not fit the guard, the
   least scale at which they do (the USSO is drawn at 1.05).
3. **The hands** (`figure-fit.ts`): the right grasp, the index onto the Trigger part at the last joint's crease, then
   the left. Judged in close photographs from three sides as well as by the numbers.
4. **The body round it** (`figure-solve.ts`): rest, lowered (measured through the stride, not at one moment), swap, air
   and rise.
5. **The reload** on the first person's keys for this gun, once the guns agent has them: only where each hand goes and
   the gun's tilt are the soldier's (`reload.keys`, with a key's own fingers where it holds a part, `KEYFINGERS=1`).
6. **The shared moves checked on this gun's shape**: the swap's cup (its hands placed for the USSO's size), the punch
   (the left hand leaving round this gun's fore-end), the throw, the double jump's tuck.
7. **Sweep it** (G1) to the template's numbers; look at every state close (aimed optic, inspect, every carry), the
   Loadouts panel at every turn, the frame sheets, then the game (`live-shots.ts`: a bot with it, your own figure,
   another player's).
8. **Hold it**: its id in the fitted list (G2) puts it under every skfigure check (the hold in four poses, aimed at a
   sprint, the trigger crease, the finger size, three punches, the throw, the reload's magazine and keys, the hands
   back after, the Loadouts panel), plus its own checks below, each seen failing with its fault put back. A roadmap
   milestone, the diary, shipped.

## 5. Each gun

Each: what the model gives, the work beyond the recipe, the faults expected and what heads each off, and the checks
added. Lengths and hold points are the 2026-09-30 survey's (`gun-shape.ts` on the figure).

### 5.1 ANAKIN (alternator_smg), SciFiSMG01_2, 86 cm

- **Model, measured 2026-10-02** (the parts' boxes in the gun's own frame, `gun-shape.ts side`, `figure-hands.ts GUNONLY
  WHOLE=1`): 85 cm long. The **magazine is in the pistol grip** (Clip, 9.5 to 29 cm under the bore, raked back), as the
  USSO's is; the Trigger 4.5 cm in front of the grip's top, inside a big guard whose front slopes from 14.5 cm in front at
  the bore to 2.5 cm in front 19 cm under; the **charging handle (Slide) on the left side, 18 to 20 cm in front of the
  trigger**, 3 to 6 cm under the bore; the magazine release (Button) on the left above the grip; a stock reaching 48 cm
  behind the trigger. The fore-end is the receiver's flat underside, 6 cm wide, 7.5 to 8.5 cm under the bore from 16 to
  35 cm in front of the trigger. The survey's "61 cm from the butt" was the shared default, inside the guard: the left
  hand's hold is set at 20.5 cm in front of the trigger (69 cm from the butt), the palm's middle 1.5 cm under the
  underside.
- **Work:** the recipe alone; the reload's handle key at the Slide (where the left hand takes it is read off the
  guns agent's ASVal rack, as the USSO's was off the MPS5's).
- **Expected:** its magazine group may hold the procedural magazine hidden, as the USSO's did (107 mm off): the
  magazine's box is from drawn meshes only since M391, so check it on this model, not assume it. The Slide's side
  decides whether the left hand reaches over the top or round: a reach across the top passes the optic. The reload's
  wrist reached 94 degrees unfitted: watch the handle key's wrist.
- **Checks:** the recipe's. It is the gun that proves G2: if any check needs editing to take ANAKIN, the list is not
  doing its job yet.
- **Done on the soldier, 2026-10-02** (soldierhold.json guns.alternator_smg): the left hand under the receiver, the right
  round the grip's top with the index on the trigger at its crease, the body round the gun at rest, the carries (sprint,
  air, swap, rise), the reload's point and tilt, and the shoulder's reach (70, as BOOG's: at the shared 34 the hold slid
  30% back aimed at a sprint). Every skfigure check passes for it (22), with two checks made fair to any gun on the way:
  the punch's fist judged by how far it closes toward the fist from the gun's own hold (ANAKIN's hold is already curled
  round its fore-end), and the magazine's middle measured in the magazine's own frame (a box along the world's axes round
  a raked magazine on a gun rolled for the reload put it 9 mm off). Its reload is the magazine alone until the guns
  agent's ANAKIN rack lands; its swap has no phase or cup until its gunfeel.json entry does.
- **Left open, measured:** the stock in the right forearm. Behind the grip the stock is a solid slab 5.2 cm wide and up
  to 30 cm tall, and the armoured forearm runs into it just behind the hand: 67 mm at rest, 59 running aimed, 76
  sprinting (the audit's exact look), 26 aimed (the butt in the shoulder armour); and 150 or more into the belly in a
  sprint jump, which the plain look hid from the first carry solve. No place of the butt, chest turn, elbow, eye relief,
  hand turn or the gun's size clears every pose (the best hand turn, 10 degrees out, brought running aimed to 21 and
  sprinting to 59 but put the hand 9 mm into the grip). Seen from outside it reads as the forearm laid along the stock,
  hidden from behind. The way out is the template fault's (step 0): the right arm fitted against the stock through the
  sweep, the forearm angled out past it; or the owner's call on how such a stock is carried.
- **Learnt:** a hand search from the shared start laid the right hand flat on the receiver's side, its fingers straight
  (a hand can measure 2 mm and hold nothing): start a hand from a fitted gun with the same kind of grip (the USSO's,
  carried over by each gun's trigger and grip) and grasp it there. And the audit's plain look is blind past 4 cm, so a
  tuning grid saw no change where the clash was 67 mm and getting better: tune and solve with its exact look.

## 5.2 PANDA (vinson), SciFiRifle01_2, 104 cm

- **Model:** Clip and Extruder only; no handle. The fore-end hold 83 cm from the butt. Measured 2026-10-02 (cm, the
  gun's own frame, from the trigger): 96.5 cm long; the magazine (Clip) 18 to 31 cm in front of the trigger, 7 to 16.5
  under the bore; the Extruder a block under the receiver between the magazine and the trigger (8 to 18 in front, 13 to
  16.5 under); 10.6 cm wide at most.
- **Work:** the rack's spot is the measured one both views read (the shared plan's groundwork), never a second copy in
  soldierhold.json. The fore-end hold checked aimed on the move; if the arm comes up short, a shoulder reach of its own
  (`reach.shoulder`, as BOOG's 70) or the hold brought back along the gun, BOOG's two answers.
- **Expected:** the stock in the right forearm, as BOOG's (16 mm at rest, 40 in a reload): the right elbow and grip
  fitted with the sweep's forearm number in the cost, through every sequence, not at rest alone. A long gun's sprint carry clashes at one moment
  of the stride and not another (the USSO's was clean at one and 17 mm into the chest a few tenths later). The Extruder
  is the model's own part, not a handle.
- **Checks:** the rack's hand at the shared spot (within 6 mm, its fingers on the gun).
- **Done on the soldier, 2026-10-03** (soldierhold.json guns.vinson): every skfigure check passes for it (24 of 100).
  - The left hand under the handguard 37 cm ahead of the gun's middle; the right on the grip, 1.5 mm further forward
    than its first fit so the index's crease is on the trigger (0.1 mm; 4.1 had failed the check).
  - The shoulder reaches 85 degrees (aimed at a sprint its hold slid 43% back at 34, 14% at 70, 3% at 85).
  - The butt placed and the chest turned by a grid on the exact measure (the solver's own pick left the stock 68 mm in
    the right upper arm at rest).
  - The sprint and jump carries solved **counting the left hold's slide** (figure-solve.ts): solved without it, the
    muzzle went 44 degrees down, the arm fell short and the hold slid back into the magazine (the left hand 30 mm in, the
    gun 145 mm into the left forearm); now the gun is 28 mm in sprinting. The carries keep the hold's own left hand: a
    search put it 3.6 cm up into the handguard.
  - The punch bows 22 cm down (its own melee.punch.clear): the magazine block hangs between the hold and the chest, and at
    the shared 15 cm the fingers dragged 22 mm through it.
  - The reload's point and tilt solved (the left wrist 59 to 40 degrees).
- **Left open, measured exactly:** the butt in the right shoulder armour, 18 to 26 mm, as BOOG's; looking 40 up, 65 into
  the collarbone; crouched, the stock 115 mm into the right forearm (the template fault, step 0); the sprint jump 41
  into the chest; the left fingers at the reload's first instant, 30 mm. Photographed at rest, aimed, sprinting and
  crouched: from outside the crouch reads as the forearm along the stock.

### 5.3 BIGANTLER (mastiff), SciFiShotGun02_2, 94 cm

- **Model:** Pump, Cover (the loading gate), Bullet (one shell); no magazine. The left hand's hold is on the Pump, 71
  cm from the butt. Measured 2026-10-02 (cm, from the trigger): 90 cm long, 6 wide; the Pump 26 to 45 in front, 10 to 13
  under the bore; the gate (Cover) 16 to 27 in front, 12 to 17 under, the shell (Bullet) lying in it 19 to 24 in front:
  the gate is under the gun just behind the pump, so the hand that feeds it works right behind the one on the pump.
- **Work:** the pump reload (G4): the hands as the first person's KXG12 (which hand feeds the gate and which works the
  pump comes from the guns agent's reading of its clips), the same fixed count of shells from the shared key, each a
  Bullet shown in the hand (phased in, no pouch, as the magazine never came from one), pushed in at the Cover and gone;
  then the pump, from empty only (a shell chambered: the loop alone, the tactical rule). The pump after every shot (G5).
  **The left hand's hold moves with the Pump**: today a hold is fixed to the gun; here it is in the Pump's own frame,
  so the hand rides the part.
- **Expected:** a hand fixed to the gun while the Pump slides goes through it or off it (the hold in the part's frame
  heads it off). A count that fits the first person's time but not the soldier's (both read one key, one time). A
  reload ended part way by a shot or a swap: the hands come back from any moment of the loop, not only its end. A
  remote firing again before its pump ends: the next shot's cycle starts clean. A far figure updated every few frames
  (the level of detail) must not skip a pump: the cycle runs on time, not on a frame count.
- **Checks:** each shell reaches the gate (the Bullet at the Cover at each loop's end), the count is the shared key's,
  the Pump travels after a reload from empty and after every shot of a remote, the left hand on the Pump through its
  travel (6 mm), nothing from a pouch, the hands back after a reload stopped at its middle.
- **Done on the soldier, 2026-10-03, the hold** (soldierhold.json guns.mastiff; the pump reload and the per-shot pump
  wait on the guns agent's shape, G4 and G5): every skfigure check passes for it (14 of 114).
  - The left hand under the pump's middle, 24 cm ahead of the gun's middle, closed round it; the right on the grip
    behind the trigger, placed from the USSO's carried over by the trigger, the index's crease 0.2 mm off it. Both fitted
    at the first try (skin 2 mm in, palms and fingers on).
  - The shoulder reaches 45 degrees (aimed at a sprint the hold slid 14% back at the shared 34).
  - The body and the carries solved with the exact measure and the slide counted, the carries keeping the hold's own
    left hand (PANDA's lessons, used from the start): sprinting, 1 bad frame in 31 (the gun 8 mm in); a sprint jump,
    none in 42.
  - The punch bows 8 cm out and 22 cm down (its own melee.punch.clear): at the shared path the fingers landed 20 mm
    into the pump coming back.
  - The skfigure e2e skips the magazine's checks for a gun with none (it had crashed reading BIGANTLER's absent
    magazine); whether the hands come back after its reload is still checked.
- **Left open, measured exactly:** the butt in the shoulder armour, 26 mm at rest and aimed, 52 running aimed; looking
  40 up, 81 into the chest; the reload, which has none of its own yet (the left fingers 30 mm in the gun at its start,
  the wrist 65 degrees).

### 5.4 REZ (shotgun), SciFiShotGun01_2, 92 cm

- **Model:** Clip and Button; no handle. The furthest fore-end hold of any gun, 86 cm from the butt; it was the only
  one still sliding (0.07) after the shoulder's reach, before any fit. Measured 2026-10-02 (cm, from the trigger): 90.5
  long, 5.6 wide; the magazine (Clip) a long box under the fore-end, 12 to 37 in front, 12 to 16 under, so the left hand
  holds in front of it or along it; the Button on the left side 10 to 13 in front.
- **Work:** the fore-end checked aimed on the move first, before the rest of the fit, since it decides where the left
  hand is; the rack at the shared spot (PANDA's answer).
- **Expected:** the pack's parts all sit at the gun's origin (paidgun.ts hingeParts finds their hinges off their
  geometry): the magazine's sweep box from drawn meshes, checked. The Button is not a handle.
- **Checks:** the slide aimed at a sprint is the one that matters; the recipe's otherwise.

- **Done on the soldier, 2026-10-04** (soldierhold.json guns.shotgun): every skfigure check passes for it (22 of 136).
  - The left hand under the fore-end 36 cm ahead of the gun's middle, ahead of the long magazine flush in the fore-end's
    back half, so it holds the fore-end and not the magazine; the right on the grip, placed from the USSO's carried over
    by the trigger and searched from there (the placed grasp's ring finger hung 12 mm off), the index's crease 0.1 mm off
    the trigger.
  - The shoulder reaches 85 degrees, the furthest hold's need: at the shared 34 the hold slid 24 to 29% back running and
    sprinting, and with the body solved 8% aimed at a sprint at 70.
  - The body and carries solved with the exact measure and the slide counted, the carries keeping the hold's own left
    hand; the punch bows 8 cm out (its fingers caught the fore-end, 10 mm); the reload's point and tilt solved (the
    left wrist 71 to 34 degrees).
  - **A measure's fault found:** after a grenade throw, as the gun came back, the audit read the right ring finger 30 mm
    inside REZ's Trigger part, from a point 3 cm under the trigger's own box: by a thin part's edge the inside rule
    misreads. figure-audit.js now counts skin in a part only inside that part's own box (3 mm there after, as the hand
    is).
- **Left open, measured exactly:** the butt in the shoulder armour (19 to 26 mm); looking 40 up, 50 into the collarbone;
  a sprint jump, 40 into the belly; the reload's first instant, the left fingers 26.

### 5.5 CHOOCH (lstar), SciFiGrenadeLauncher01_2, 124 cm

- **Model:** Drum (turns a chamber a shot), sights; 24 cm wide at the drum. The fore-end hold 81 cm from the butt.
  Measured 2026-10-02 (cm, from the trigger): 88 long; the Drum is an eight-grenade cylinder (Grenade1 to 8) 8 to 29 in
  front of the trigger, 22 wide and 4 to 26 under the bore, so the left hand holds in front of it (29 cm and on) and the
  drum sits right where the left forearm passes.
- **A fault live today:** an overheat sets the gun's `reloading` (weapon-state.ts), so main.ts sends the act
  "reload" and every other player sees CHOOCH start a magazine reload on the lstar's reload time, cut off when the
  1.19 s lockout ends. The vent replaces it.
- **Work:** the hold and every carry round the drum (the drum against the chest and the left forearm at rest, in the
  sprint, the air and the swap, through the stride); the support hand ahead of the drum. The vent: act code 20 (after
  G3) sent while the gun is overheated, ahead of the reload line in main.ts's act and in the bots'; the figure plays it
  on the first person's vent shares, the hands and the gun's turn being the soldier's own (soldierhold.json). The drum's
  turn a shot on the figure too, from G5, if it is seen at play distance.
- **Expected:** the widest gun in the forearm in a carry the hold never shows; the Loadouts panel cut at its 124 cm at
  some turn; a bot's overheat still sending a reload.
- **Checks:** an overheated CHOOCH, yours and a bot's, shows the vent on another player's page (code 20 over the
  network), never a reload; an older code read as nothing; the drum clear of the forearm in every carry.

- **Done on the soldier, 2026-10-04** (soldierhold.json guns.lstar, the vent): every skfigure check passes for it.
  - The left hand under the barrel shroud 37 cm ahead of the gun's middle: at 30 cm the left forearm ran past the drum's
    front edge (57 mm into it at rest, 113 sprinting, measured exactly); from 35 cm out it clears it. The shoulder reaches
    70 degrees for it.
  - The right hand on a thumbhole stock's grip: a slanted bar, the drum close in front, the finger space 5 cm deep and 8
    tall and closed below by the guard's bar, too small for the soldier's glove to wrap (drawn 1.15 or 1.25 times as big,
    no better). The palm sits behind the bar, the index's crease on the trigger (0.0 mm); the ring and pinky are curled
    round the bar, 18 mm into the guard's frame where nothing outside shows it, rather than left straight out along it
    as a finger gun (photographed both ways).
  - The chest turned 40 degrees and the butt placed by a grid on the exact measure; the carries solved, the slide counted.
  - **The vent** (the owner, 2026-10-01: other players see it): act code 20 (dummy.ts VENT; the heals were narrowed to 10
    to 19 for it in M398), sent while the gun is overheated (main.ts) and by a bot whose gun overheats (bots.ts
    BotMag.venting), where both had sent a reload. The figure eases into a carry of its own while it vents
    (soldierhold.json vent, solved by figure-solve.ts vent): the gun tipped up and canted in both hands, then back. The
    guns agent's first-person vent shares, when they come, are for the soldier to follow.
  - **Two checks made fair to a grip:** the punch's and the throw's hand-in-the-gun checks hold a hand to 8 mm or 3 past
    its own depth at rest, so a deliberate grip (CHOOCH's right) is the hold checks' to bound and what these catch is a
    hand passing through the gun as it moves (seen failing with BIGANTLER's punch bowed into its gun, 17 mm).
- **Left open, measured exactly:** the stock in the right forearm (28 to 38 mm at rest and aimed, 98 crouched), the
  template fault; looking 40 up, 83 into the chest.

### 5.6 APUHTHEE (wingman, SciFiPistol02_2) and STRYDER (autopistol, SciFiPistol01_2), the pistols

- **Models:** Pistol02: Scope (a red dot), Clip, Slide, Trigger; 25 cm. Pistol01: Button, Clip, Trigger, and **no
  Slide**. Measured again 2026-10-04 the right way round (Milestone 464: the 2026-10-02 reading was off the gun mounted
  backwards, and had the magazine under the barrel), cm in the held gun's frame: the Slide the whole top, -5.8 to 17.5;
  the red dot on it, 5.1 to 9.8; the Trigger 8.6 to 11, 7 to 9 under the bore, its guard's opening in front of it; the
  **magazine (Clip) in the handle**, 10.7 to 19.2 and 7 to 19 under the bore, raked back. **The pack's origin is
  mid-slide, not at the handle** as on the long guns: the gun's named grip point (0, -7, 6.4) is in the slide ahead of
  the guard, about 8 cm from the handle, so the hands are placed from it by their own `at` (the hold points are the
  palms' own targets, not the grip point), and the USSO's right hand carried over by the trigger lands 3 cm behind the
  handle (a rifle's grip is raked back, a pistol's handle nearly upright): the right hand is searched, not carried.
- **Work:** the pistol stance (G6). Its places are the figure's own, measured off the soldier as the punch's were (the
  shoulders, the arm's length, the eye): aimed, both arms out and the sight on the eye's line; at the hip, a low ready;
  lowered for the sprint and the swap as the first person's; crouched. The look turns the arms about the shoulders,
  not the gun about a pocket. Both hands on the grip (the shared plan's default): the right grasp fitted, the left round
  it (G8), measured hand on hand (G7). The reload: the Clip down out of the grip on the magazine's own sweep (its axis
  down the grip), the left hand under it, the new one phased in and seated by the left palm; from empty, APUHTHEE's
  Slide released as the first person's DGL50 does it; STRYDER has no Slide, so its from-empty is whatever the guns
  agent's X18 does with the Button or nothing. The swap's cup and the punch on the new stance: the cup's hands round a
  small gun (soldierhold.json swapCup by stance), the punch leaving from the grip near the body's middle.
- **Expected:** the old path (the gun on the right hand, the clips' poses) must give way on the soldier only; B00G
  FPS's figures keep theirs. One hand through the other (G7). The gun up at the eye through the head or visor at the
  ends of the look (measured across 70 down to 70 up, not 40). The trigger in a small guard with a big glove: the guard
  measured first; a pistol may need drawing larger, as the USSO is. The punch's places were fitted from a rifle's hold
  and may cross the right arm from a pistol's. The aimed sight off the eye: checked from the side.
- **Checks:** the recipe's on both, plus: no hand into the other (G7's bar, set by the fit), the sight within reach of
  the eye's line aimed, the magazine leaving the grip's bottom, the slide (APUHTHEE) going back on a reload from empty,
  and B00G FPS's figure still on its clips with a pistol.

- **APUHTHEE done on the soldier, 2026-10-04** (soldierhold.json guns.wingman, `stance` "pistol"): every skfigure check
  passes for it.
  - **Turned the right way round first** (Milestone 464): the pack's second pistol had been mounted backwards in both
    views, the measuring tool choosing its back as the muzzle by 2 mm.
  - **G6, the stance:** rifle.ts pistolStance sends the soldier's pistol to the rifleman's rig (mannequin.ts setGun),
    the legacy game's figures keeping the clips' one-handed hold. Its numbers: the gun out in front of the chest at
    rest (`pocket`), aimed at **0.36 m from the eye** (`aim.relief`), the chest turned 10 degrees. Measured: at 0.45 the
    right arm was straight (173 degrees) with the palm 7.4 cm short of its target, and at 0.40 still 2.5 short; at 0.36
    it reaches with the elbow at 169, the two-handed stance's nearly straight arms.
  - **The right hand** searched on the handle (the USSO's carried over by the trigger lands 3 cm behind it): the index's
    crease on the trigger (0.1 mm), the fingers round the handle's front, the thumb high along the left side, the wrist
    9 degrees. Until the arm reached, every place tried left the index 10 to 26 mm off the trigger: the search had fitted
    a hand the arm never got to.
  - **G7, hand on hand** (figure-audit.js `handOnHand`, `handOnHandN`, `handOnHandWhere`, `handGap`): the left hand's skin
    in the right's, against the right hand and forearm as drawn (the rays agree point for point; 0 on every long gun and
    with the hand moved clear). A depth alone is at most half a hand's thickness however far one goes through the
    other (a hand 2 cm in read 16 mm), so how much is in, its skin points 4 mm or more, is the measure that grows. The
    hold checks hold it to 8 mm and 5 points, set by the fit (5 mm at one point); the left hand put 1 cm into the right
    reads 10 mm and 9 to 12 points, 2 cm 23 to 52.
  - **G8, the left round the right** (figure-fit.ts): the left palm seats onto the right hand's fingers as onto the gun,
    each left finger closes until it touches either, its skin in the right hand costs as in the gun (by the count too),
    and on a pistol a straight left finger counts as open, as a right one does. The first fits, which knew only the
    gun, put the left palm under the right fingers with the left middle and ring curled through them (72 skin points
    in) or left the index and middle straight out under the slide. Searched from the fingers pointing down and forward:
    the palm on the right fingers and the handle's left side, the middle, ring and pinky round them, the wrist 35
    degrees; the index curled as the ring is and the thumb laid forward along the frame under the slide (its tip at the
    guard's front), each measured against the gun and the right hand and photographed (the fit had left the index
    straight and the thumb standing up the slide's side).
  - **The carries solved** from the shared ones with the fitted left hand: lowered (down 32, left 11; it had taken a long
    gun's left hand under a fore-end, 18 mm into the pistol in a swap), the swap's (the left wrist 65 degrees to 43), the
    air's (81 to 43) and the rise's arc.
  - **The left hand does not slide at a sprint:** a long gun's support hand slides back along the gun toward the grip
    when the arm cannot reach; on a pistol it is at the grip already, and the slide pushed it 4 cm across into the gun
    (17 mm in). mannequin.ts supportHold leaves a pistol's hold where it is.
  - **The fit tool knows when a hand cannot reach:** figure-fit.ts adds a palm's distance from its target past 1 cm to
    its cost and reports it.
  - **Passed as they were:** the punch, the throw, the reload (the magazine down out of the handle's bottom and back,
    the left hand pointing at it, until the first person's pistol moves are made), the Loadouts tab.

- **STRYDER's pistol done on the soldier, 2026-10-04, ahead of its roster change** (soldierhold.json guns.autopistol,
  Milestone 482): Pistol01 mapped and measured (no slide; the magazine under the barrel ahead of the trigger; the trigger
  in a short hook of a guard). Aimed at 0.34 m, drawn 1.1 times as big so the glove's index reaches the trigger, the
  right palm 4 mm off the handle for it, its pinky under the handle (excused by the audit's `below`); the left round the
  right, its thumb forward, its ring curled; carries solved; every skfigure check passes for it. The roster change waits
  on the owner's numbers.

- **The stock in the right arm, studied 2026-10-05 (ANAKIN):** measured exactly, the gun 64 mm into the right forearm at
  rest, 67 sprinting, 63 crouched (26 aimed, at the collarbone where the butt sits). ANAKIN's gun is laid out as a
  bullpup's: the magazine (Clip) hangs behind the pistol grip (z 0 to 14 cm) and the body runs 39 cm back from the grip
  to the shoulder pocket, and the forearm leaves the wrist straight back through it, 12 cm behind the grip. Nothing in
  the shoulder hold moves it: the right elbow's direction over a grid, 62 to 76 mm (the elbow only swings round the line
  from the shoulder to the wrist, which runs along the gun); the hand turned on the grip to put the wrist further out,
  the clash moves into the upper arm (58 to 61) and the index leaves the trigger; the butt moved in toward the chest's
  middle or the chest turned 10 to 20 degrees more, 59 to 76; the butt moved out and down toward the armpit (a low
  ready), 68 to 86 and the wrists bent further. With the gun along the look, its body behind the grip is where the arm
  must be: a fix is a different kind of hold for this gun, the owner's to choose.
- **BOOG's deep spots, located 2026-10-05:** running aimed (as every bot fights), the heel of its tall butt 33 to 36 mm
  into the chest and collarbones (the bar 40); standing aimed within it. Seen in the live enemy photographs, it reads as
  the butt plate against the armour.

### 5.7 HAEFY (a new launcher), SciFiRocketLauncher01_2, about 1.1 m

- **Done on the soldier, 2026-10-06 (Milestone 510):** the gameplay and the roster change first (rocket.ts; `launcher`
  replaces `3030`). Measured, the model's front is its +Z end (its trigger in front of its pistol grip; the far end's
  round openings are the tubes' back vents) and its sight is the Visor beside the tube (an eye across as well as up).
  Held on the rifleman's rig with its butt 30 cm behind and 8 cm above the shoulder joint, so the tubes lie on the right
  shoulder: no launcher stance of its own was needed. Hands searched onto its pistol grip and vertical foregrip, the
  elbow, the reach, the punch and the carries set; every skfigure check passes for it.

- **Model:** Trigger, Visor; **no rocket part**.
- **Work, after its gameplay (section 6):** the launcher stance (G6): the tube's rest on the top of the right shoulder
  (a point on the tube and one on the armour, both measured), the right hand on the rear grip, the left on the front,
  the eye at the Visor; the look turns it about the rest. Carries for the sprint, the air and the swap, through the
  stride. The reload, a rocket into the tube, on the first person's RPG shares. **The rocket is one model all three
  places use** (the soldier's reload, the first person's, the shot in flight), agreed with the guns agent, since the
  pack has none.
- **Expected:** the tube through the head or helmet aimed (the cheek beside it); its rear through the back in a carry;
  its length across the left arm; the Loadouts panel cut. Others must see the rocket fly, not only its burst.
- **Checks:** the head and the tube apart aimed, through the look's range; the rocket in the tube before a shot and
  gone after it, back after a reload; a remote's rocket seen in flight on another page.

## 6. The roster change, the character agent's

Each lands with its gun's turn, so no gun is ever without its look.

- **STRYDER: rspn101 to autopistol** (the RE-45's data, already in the game's data and ammo lists), on Pistol01, kind
  "Fast Pistol", tuned into the band tools/checks/ttk.ts holds a pistol to. **HAEFY: 3030 to a new launcher id**, on
  RocketLauncher01, kind "Launcher", its gameplay new (a rocket that flies, projectile.ts; a blast, throwables.ts
  blastDamage, under the thrower-decides rule over the network; seen in flight by others), its numbers from the
  Skybreaker's ratios with the owner approving the blast's reach and whether it hurts its holder. **PANDA's kind
  "Rifle".**
- **A player's saved choice follows the name.** loadouts.ts valid() drops any gun not in the roster to the default, so
  a player who chose STRYDER would quietly get the USSO. rspn101 maps to autopistol and 3030 to the launcher's id
  instead, and a check holds it.
- The lists: speedkills.json (roster, families, the bots' guns, the six default loadouts whose Marksman and Skirmisher
  pairs change, the Gulag's pool, tuning, notes), paidweapons.json, the README, the guides and docs, the e2e's name
  list.
- **A page from before, in the same match**, gets a gun id it may not hold a model for: what such a page draws for an
  unknown SpeedKills id is checked before the change ships.

## 7. Faults to head off on every gun

- **Between the frames**: the sweep at 1/30 s, never the 4% sheet alone.
- **The audit's own limits**: its plain look reads a gun point more than 4 cm inside the body as outside, and a hand's
  at 3 cm; use its exact look (`exact`, rays to confirm), which the sweep and the solver now do. A tuning grid on the
  plain look saw nothing change while the clash moved from 67 to 52 mm.
- **A hand search's start**: start from a fitted gun with the same kind of grip, not the shared numbers (ANAKIN's right
  hand came out flat on the receiver from the shared start).
- **The solver scores still poses, the sweep scores motion**: figure-solve's rest stage, run on BOOG with the exact look,
  cut its four still poses' cost by a quarter to a third (the butt 3 cm out and 4.5 higher, the right elbow out), yet over
  the sweep it made rest 16 to 31 mm, the sprint's bad frames 3 to 24 and the reload 104 to 115 (2026-10-02; not kept).
  A solve is kept only if the sweep agrees; the lasting fix is a solve whose cost is the sweep's sequences.
- **The stock in the right forearm**: BOOG's 179 bad frames; on every long gun the right arm is fitted against the stock
  through the sweep, not at rest.
- **Hidden meshes**: measure drawn meshes only (the procedural magazine in a bought gun's magazine group).
- **A search's blind spots**: every fit and solve looked at in photographs (a cost with no palm term moved BOOG's
  carried hand 6 cm off).
- **The dev server reloads every page** on an edit under src/ or to the README, killing a running page tool; no such
  edit while a fit, sweep, frames or live shots run, and never two writing runs at once. A python write can be missed
  by the watcher: touch the file.
- **Shared keys**: the reload, rack, swap and melee shares are the guns agent's; message before changing one, and the
  skfigure e2e reads the same file so a parting fails it.
- **Per gun, in config**: every number in soldierhold.json guns.&lt;id&gt; with a note of how it was measured.
- **The figure's construction**: figure culling (perf.json figureCull, 1.2 heights) and shared skeletons stay as they
  are; a held gun is a plain mesh culled on its own.
- **The network**: only the vent is new (code 20, after G3); the shell count is fixed; a shot's cycle comes from the
  kick every figure already gets.
- **Bots**: they reload only from empty, carry every gun, and overheat CHOOCH: each gun's bot is looked at in live
  shots.
- **A busy machine**: timing e2e checks flake under the other agents' load; the frame tools step their own clock.

## 8. Done, for a gun, on the soldier

The template's bar, made a number by the sweep: at rest, aimed, looking up and down, running aimed, sprinting,
crouched, jumping and in the melee, no frame with a hand more than 6 mm into the gun or the gun more than 15 mm into the
body, both palms on their holds, the wrists inside 60 degrees; every
reload frame looked at; whole in the Loadouts panel at every turn; the trigger at the crease; the reload, swap, melee
and cycle as the first person's; its skfigure checks each seen failing with the fault put back; the frame sheets and
live shots to the owner.

## 9. The soldier's order

The shared plan's (ANAKIN, PANDA, BIGANTLER, REZ, CHOOCH, the pistols, HAEFY), each starting with the guns agent's
first person of the same gun: the hold, fingers, carries, sweep and checks need nothing from it; only the reload's keys
wait for its keys. Before the first: step 0, G1, G2 and G3 (the narrowing shipped alone). With BIGANTLER: G4's pump and
G5. With the pistols: G6, G7 and G8. With HAEFY: the launcher's gameplay first.
