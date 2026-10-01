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
  jump frame with the gun 39 mm in the body, and BOOG over the line nearly everywhere. Part of BOOG's is known and hidden
  from outside (its butt plate 2 to 4 cm into the rigid shoulder armour) and part is a known open fault (the stock's comb
  at the right wrist in a sprint jump); the reload's 30 mm hand is not yet explained. The eight copy this template, so it
  is cleaned first (step 0).

## 2. Step 0: the template clean, before any new gun

The soldier's own work on the USSO and BOOG, no new gun involved:

1. **Make the sweep a tool** (`tools/figure-sweep.ts`): the measure above, a gun list on the command line, one page a
   gun (one page for many guns died after two, "Target closed"), each sequence at 1/30 s, the worst frame of each
   measure and where it is (the audit's `locate`: which bone, which part of the gun). Minutes a gun, against the two
   hours the frame sheets take at that step.
2. **Tell the armour from the body.** The gun's depth is reported by body part (the audit's gunWhere), so BOOG's butt
   in the shoulder armour, accepted, is counted apart from a stock in the forearm or a muzzle in the chest, which are
   not. A long gun's real clash must never hide under the known one.
3. **Find and fix or explain each bad frame**: the USSO's reload hand (22 mm, which key and which hand), its sprint
   jump frame (39 mm), its look at the ends (16 mm); BOOG's reload hand (30 mm or more) and its jump (the comb, open
   since M367). Each is located, photographed close (`figure-hands.ts STEP=`), and either fixed in soldierhold.json and
   checked, or written down with why it is left (seen from outside or not).
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

- **Model:** Clip, Slide, Button; the left hand's hold ahead of the magazine, 61 cm from the butt.
- **Work:** the recipe alone; the reload's handle key at the Slide (where the left hand takes it is read off the
  guns agent's ASVal rack, as the USSO's was off the MPS5's).
- **Expected:** its magazine group may hold the procedural magazine hidden, as the USSO's did (107 mm off): the
  magazine's box is from drawn meshes only since M391, so check it on this model, not assume it. The Slide's side
  decides whether the left hand reaches over the top or round: a reach across the top passes the optic. The reload's
  wrist reached 94 degrees unfitted: watch the handle key's wrist.
- **Checks:** the recipe's. It is the gun that proves G2: if any check needs editing to take ANAKIN, the list is not
  doing its job yet.

### 5.2 PANDA (vinson), SciFiRifle01_2, 104 cm

- **Model:** Clip and Extruder only; no handle. The fore-end hold 83 cm from the butt.
- **Work:** the rack's spot is the measured one both views read (the shared plan's groundwork), never a second copy in
  soldierhold.json. The fore-end hold checked aimed on the move; if the arm comes up short, a shoulder reach of its own
  (`reach.shoulder`, as BOOG's 70) or the hold brought back along the gun, BOOG's two answers.
- **Expected:** the butt plate into the shoulder armour, as BOOG's (2 to 4 cm, hidden): photographed from four sides,
  and counted apart (step 0.2) so a real clash is not hidden under it. A long gun's sprint carry clashes at one moment
  of the stride and not another (the USSO's was clean at one and 17 mm into the chest a few tenths later). The Extruder
  is the model's own part, not a handle.
- **Checks:** the rack's hand at the shared spot (within 6 mm, its fingers on the gun).

### 5.3 BIGANTLER (mastiff), SciFiShotGun02_2, 94 cm

- **Model:** Pump, Cover (the loading gate), Bullet (one shell); no magazine. The left hand's hold is on the Pump, 71
  cm from the butt.
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

### 5.4 REZ (shotgun), SciFiShotGun01_2, 92 cm

- **Model:** Clip and Button; no handle. The furthest fore-end hold of any gun, 86 cm from the butt; it was the only
  one still sliding (0.07) after the shoulder's reach, before any fit.
- **Work:** the fore-end checked aimed on the move first, before the rest of the fit, since it decides where the left
  hand is; the rack at the shared spot (PANDA's answer).
- **Expected:** the pack's parts all sit at the gun's origin (paidgun.ts hingeParts finds their hinges off their
  geometry): the magazine's sweep box from drawn meshes, checked. The Button is not a handle.
- **Checks:** the slide aimed at a sprint is the one that matters; the recipe's otherwise.

### 5.5 CHOOCH (lstar), SciFiGrenadeLauncher01_2, 124 cm

- **Model:** Drum (turns a chamber a shot), sights; 24 cm wide at the drum. The fore-end hold 81 cm from the butt.
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

### 5.6 APUHTHEE (wingman, SciFiPistol02_2) and STRYDER (autopistol, SciFiPistol01_2), the pistols

- **Models:** Pistol02: Clip, Slide; 25 cm. Pistol01: Button, Clip, Trigger, and **no Slide**.
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

### 5.7 HAEFY (a new launcher), SciFiRocketLauncher01_2, about 1.1 m

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
body (the butt plate in the armour counted apart), both palms on their holds, the wrists inside 60 degrees; every
reload frame looked at; whole in the Loadouts panel at every turn; the trigger at the crease; the reload, swap, melee
and cycle as the first person's; its skfigure checks each seen failing with the fault put back; the frame sheets and
live shots to the owner.

## 9. The soldier's order

The shared plan's (ANAKIN, PANDA, BIGANTLER, REZ, CHOOCH, the pistols, HAEFY), each starting with the guns agent's
first person of the same gun: the hold, fingers, carries, sweep and checks need nothing from it; only the reload's keys
wait for its keys. Before the first: step 0, G1, G2 and G3 (the narrowing shipped alone). With BIGANTLER: G4's pump and
G5. With the pistols: G6, G7 and G8. With HAEFY: the launcher's gameplay first.
