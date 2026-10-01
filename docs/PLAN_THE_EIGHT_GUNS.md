# Plan: the other eight guns, in both views

The owner, 2026-10-01: "once I finalize the first person guns and reload animations and weapon swap and inspect, we
have like a clear plan that you can share with the other agents on which guns we'll do first and how we'll plan to
attack them ... break down each part ... that the agent ... will need to know about each gun ... tell the other agent to
do their homework too but to use this as a stepping stone ... which ones we'll do in order, why, all the things to look
out for ... since they use a shared platform now". And on the roster: "We don't want repeats where only the skin
changes", choosing ten guns with every name kept ("Yes option 2 idc about a marksman").

This is the shared plan for the guns agent (the first person: `apex-soldier`, fparms.json, gunfeel.json, viewmodel.ts,
fprig.ts) and the character agent (the soldier as others see it: `apex-character`, soldierhold.json, rifle.ts,
mannequin.ts). It starts when the owner signs off the USSO and BOOG in first person (their guns, reload, swap and
inspect) and gives this plan its final approval; then both agents read it, agree it, and each builds its own view of the
same gun at the same time. It replaces the order in `PLAN_SOLDIER_EIGHT_GUNS.md` and sits beside `PLAN_GUNS_IN_HAND.md`,
whose bar (its section 2) and fitting recipe (its section 4) still hold for the first person.

**It is a stepping stone.** Each agent does its own homework on each gun before building it (its pack gun's clips, its
model measured, the owner's words on it) and writes what it finds into its lines below, correcting anything here that
turns out wrong. Nothing here is typed in by eye: where a number appears, it came from the configs or a measurement
named beside it.

## 0. The owner's decisions (2026-10-01)

| Question | Decided |
|---|---|
| Repeats where only the skin changes (PANDA and STRYDER on one rifle, HAEFY and BOOG on one sniper) | **None.** Ten guns, every name kept: STRYDER becomes a fast pistol on the unused Pistol01, HAEFY a launcher on the unused RocketLauncher01. No marksman ("idc about a marksman"); no fast rifle. |
| CHOOCH's overheat | **A vent, seen by other players too** (a new act code). |
| BIGANTLER's reload as others see it | **A fixed number of shells** every reload, so nothing new goes over the network. |

Defaults written in, for the owner's final approval to confirm or change: the two pistols held in **both hands** in
both views; REZ on the pack's **Drake-12** (a magazine shotgun, closer than the G3); PANDA's class label **Rifle**, now
it is the only one; STRYDER's and HAEFY's numbers proposed when their turn comes (section 5).

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

## 2. The ten guns, as they will be

What the packs hold:

- **The guns you see (Tirgames' Sci-Fi Battle Weapons):** ten gun families, each in a one-piece `_1` and a split `_2`
  build of the same shape: Rifle01, SMG01, SMG02, ShotGun01, ShotGun02, SniperRifle01, GrenadeLauncher01, Pistol01,
  Pistol02, RocketLauncher01. With the owner's choice, **each gun wears its own**.
- **The first-person arms (KINEMATION FPS Animation Ultimate):** twenty guns' clips (`PLAN_FIRST_PERSON_ARMS.md` section
  1): rifles AK, MX16A4, G3, ASVal; SMGs MPS5, Striker-V, PDW90; shotguns KXG12 (pump), Drake-12 (magazine); marksman
  Mk14EBR, SVD; bolt snipers L96X, Kar98K; the LMG MGX5; pistols M1911, X18, DGL50, Kolibri, Viper-357; the RPG. Only
  MPS5, L96X and Striker-V are imported so far. These are the hands and the clips; the pack's own gun meshes are
  measured, not shown.

Hyper Scape's guns are its Season 1 list (`RESEARCH_PHASE_12.md` 5.4); the Apex ones are each gun's data id.

| Gun | Class | Apex equivalent (data id) | Hyper Scape equivalent | Model | First-person pack gun |
|---|---|---|---|---|---|
| USSO (done) | Fast SMG | R-99 (r97) | Harpy | SMG02 | MPS5 |
| ANAKIN | Steady SMG | Alternator (alternator_smg) | Ripper, nearest | SMG01 | ASVal (or PDW90) |
| PANDA | Rifle | VK-47 Flatline (vinson) | Ripper | Rifle01 | AK (or G3) |
| REZ | Auto Shotgun | EVA-8 Auto (shotgun) | none: Hyper Scape had one shotgun | ShotGun01 | Drake-12 |
| BIGANTLER | Heavy Shotgun | Mastiff (mastiff) | Mammoth MK1 | ShotGun02 | KXG12 |
| BOOG (done) | Sniper | Sentinel (sentinel) | Protocol V | SniperRifle01 | L96X |
| CHOOCH | Energy LMG | L-STAR (lstar) | Hexfire | GrenadeLauncher01 | MGX5, the hold only |
| APUHTHEE | Heavy Pistol | Wingman (wingman) | Riot One | Pistol02 | DGL50 (or Viper-357) |
| **STRYDER** | **Fast Pistol** (was the Fast Rifle) | RE-45 Auto (autopistol, in our data) | D-Tap | **Pistol01** | X18 (an automatic; or M1911, Kolibri) |
| **HAEFY** | **Launcher** (was the Marksman) | none: Apex has no rocket launcher; a new gun | Skybreaker | **RocketLauncher01** | RPG |

The families now: two SMGs (fast, steady), two shotguns (auto, heavy), two pistols (fast, heavy), and one each of the
rifle, the sniper, the LMG and the launcher.

Today's numbers (weapons.ts resolveWeapon at fusion 0, SpeedKills' tuning) and the bought models' moving parts, read
off each .glb:

| Gun | Magazine | Reload, round chambered / from empty | Fire | Its model's moving parts |
|---|---|---|---|---|
| ANAKIN | 18 | 1.90 / 2.20 s | auto, 600 a minute | Clip, Slide, Button |
| PANDA | 19 | 2.40 / 3.10 s | auto, 510 | Clip, Extruder; no handle |
| REZ | 8 | 2.75 / 3.00 s | auto, 168 | Clip, Button; no handle |
| BIGANTLER | 5 | 2.00 / 3.00 s | semi, 60 | Pump, Cover (the gate), Bullet (a shell); no magazine |
| CHOOCH | 24 shots of heat | never reloads: cools when it overheats | auto, 600 | Drum (turns a chamber a shot), sights |
| APUHTHEE | 6 | 2.10 / 2.10 s | semi, 168 | Clip, Slide |
| STRYDER | from the RE-45's data, to be tuned (section 5.6) | | automatic | Pistol01's parts, read at its turn |
| HAEFY | a new launcher's, to be set (section 5.7) | | a rocket a shot | RocketLauncher01's parts, read at its turn |

## 3. The order, and why

The soldier follows the first person (its reload, rack and swap keys are the first person's), so each gun is the guns
agent's first and the character agent's right after. Both start a gun at once: the soldier's hold, fingers, carries
and checks need nothing from the first person; only its reload's keys wait for the first person's.

| # | Gun | Why here |
|---|---|---|
| 1 | **ANAKIN** | The nearest to the USSO in both views: a magazine ahead of the grip and a real Slide to rack (SciFiSMG01_2), a good pack match (ASVal). No new kind of reload in either view, so it proves the per-gun pipeline (the groundwork below) with the least new code. |
| 2 | **PANDA** | The one rifle, much played. New: its model has no handle part, so where the rack's hand goes is decided once for both views (section 4); the same answer serves REZ. |
| 3 | **BIGANTLER** | The exact pack match (KXG12), but the one new kind of reload in both views (shells at the gate in a loop, a fixed count, then a pump) and a pump after every shot. Built once the pipeline is proven. |
| 4 | **REZ** | A magazine shotgun with the furthest fore-end hold of any gun (the soldier's left arm may come up short, as BOOG's did) and no handle part (PANDA's answer). |
| 5 | **CHOOCH** | No reload; the hold of the widest gun (its drum against the chest and the left forearm), its carries and swap, and the overheat's vent, which others see (a new act code). |
| 6 | **APUHTHEE and STRYDER** | The two pistols together: one new kind of hold in both views (no stock, both hands on the grip) serves both. STRYDER's move onto the RE-45's data and Pistol01 lands here. |
| 7 | **HAEFY** | The launcher: new gameplay (a rocket and its blast) before either view can hold it, and a hold of its own (a launcher on the shoulder), so last. |

The guns agent's own order once put BIGANTLER first, for its exact match; if the owner plays it most, it moves up. The
owner's word moves any gun up.

## 4. Groundwork, once, before the first gun

Both agents, agreed in a message before either builds:

- **A gun's reload in the shared keys, per gun.** Today `reload` is one timeline for both guns and only the rack differs
  (packGuns.&lt;g&gt;.rack). The eight need a gun's own: a pump's loop with its fixed shell count (BIGANTLER), a slide
  (the pistols), none (CHOOCH), a rocket into the tube (HAEFY). The guns agent proposes the shape (for example
  packGuns.&lt;g&gt;.reload over the shared one, with a `style` of mag, pump, slide, tube or none, and a loop's start,
  each, end and count), and the soldier reads the same.
- **Where a rack's hand goes on a model without a handle** (PANDA's Rifle01, REZ's ShotGun01): a measured spot on the
  bought model, one per gun, kept in one place both views read (paidweapons.json or fparms.json), not two places that
  can disagree.
- **A gunfeel.json entry per gun** (the guns agent): its swap's out and in shares and its feel. Without it the soldier's
  swap pops the gun and has no cup (mannequin.ts swapOf).
- **The tools and checks take a list of guns**, not the USSO and BOOG by name: figure-frames.ts, figure-hands.ts and the
  skfigure e2e (the character agent's); pack-frames.ts and the soldier e2e (the guns agent's). Adding a gun is then
  adding its id.
- **A shot's own motion on the soldier.** In first person BOOG's gun cycles after a shot (gunfeel.json `cycle`: it
  cants and its wheels turn) and BIGANTLER will pump; the soldier shows only a kick today. A remote's shots already
  reach its figure (the kick), so the figure can play a per-shot cycle from them: BOOG's now, BIGANTLER's pump with it.
- **The roster change** (the character agent, as it made PULSAR's on 2026-09-30, each at its gun's turn so no gun is
  ever without its look):
  - STRYDER onto the RE-45's data (`autopistol`), tuned into the TTK band the checks hold (tools/checks/ttk.ts), on
    Pistol01, kind "Fast Pistol"; HAEFY onto a new launcher (below); PANDA's kind "Rifle".
  - speedkills.json's families, lists (the bots' guns, the six default loadouts, whose Marksman and Skirmisher pairs
    change, the Gulag's pool), tuning and notes; paidweapons.json; the README, the guides and the docs; the e2e's name
    list.
  - **The launcher is new gameplay:** no Apex gun to start from. A rocket that flies (projectile.ts) and bursts with a
    blast (throwables.ts blastDamage, and the thrower-decides rule over the network), seen in flight by others, its
    numbers from the Skybreaker's ratios (in Hyper Scape 40 a hit, full damage and area from 20 m, one in the tube),
    held to the TTK and fusion rules the other guns are. Its feel in first person (the rocket, its trail, the burst) is
    the guns agent's.

## 5. Each gun

Each section: what is new in it, the first person's work (the guns agent's, theirs to correct), the soldier's work (the
character agent's), and what to look out for. Everything not named here is as the USSO and BOOG (the recipe in
`PLAN_GUNS_IN_HAND.md` section 4 and `PLAN_SOLDIER_EIGHT_GUNS.md`'s recipe).

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

### 5.2 PANDA (vinson), the rifle

- **New:** a model with no handle part (Rifle01: Clip and Extruder only).
- **First person:** the AK (or the G3); its rack spot measured on our model (groundwork); its gunfeel entry.
- **Soldier:** the hands, the trigger at the crease, the fore-end hold 83 cm from the butt, inside the arm's reach
  standing (`PLAN_SOLDIER_EIGHT_GUNS.md`'s survey), checked aimed on the move; the carries through the stride; the
  reload's keys at its rack spot.
- **Look out for:** the stock in the soldier's right forearm, as BOOG's is (16 mm at rest, 40 in a reload; measured by
  the soldier's sweep, 2026-10-01, which put it on the forearm and not in the shoulder armour as had been thought). The Extruder is the model's own
  part, not a handle.

### 5.3 BIGANTLER (mastiff), the pump shotgun

- **New:** the one new reload in both views: no magazine, a fixed number of shells fed at the gate one by one (the
  pack's start, loop and end), then a pump; and a pump after every shot.
- **First person:** the KXG12's clips (an exact match); the pump is a moving part of our model (Pump), the gate is
  Cover and a shell is Bullet; the shell count chosen to fit the reload's time, in the shared keys; its gunfeel entry.
- **Soldier:** a pump reload in rifle.ts, the hands as the KXG12's (which hand feeds the gate and which works the pump
  is read off its clips by the guns agent, and the soldier follows), the same fixed count of shells, then the pump; the
  per-shot pump from the remote's shots (groundwork). The left hand's hold is on the pump already (71 cm from the butt).
- **Decided:** a fixed number of shells, so another player's figure needs nothing new over the network. A reload from
  empty is the loop plus a pump; with a shell chambered, the loop only (the tactical rule).

### 5.4 REZ (shotgun), the auto shotgun

- **New:** the furthest fore-end hold of any gun (86 cm from the butt); no handle part.
- **First person:** the Drake-12 (a magazine shotgun, the default; the G3 was the weaker match); its handle at the spot
  PANDA's answer gives.
- **Soldier:** the fore-end hold checked aimed on the move: if the arm comes up short it slides back along the gun, as
  BOOG's did before its rail fit; the reload as the USSO's with the rack at its spot.
- **Look out for:** the auto shotgun's parts all sit at the gun's origin in the pack (paidgun.ts hingeParts finds their
  hinges off their geometry); its Button is not a handle.

### 5.5 CHOOCH (lstar), the energy LMG

- **New:** no reload: it cools when it overheats (speedkills.json `_ammo`). The widest gun, 24 cm at its drum.
- **First person:** the MGX5's hold only; the vent gesture while it cools; the drum already turns a chamber a shot.
- **Soldier:** the hold and the carries round the drum (the drum against the chest and the left forearm at rest, in
  the sprint, the air and the swap carries, measured through the stride); the support hand ahead of the drum; the vent
  on the figure on the first person's shares, from a new act code sent while the gun cools (appended, so an older page
  shows nothing rather than the wrong thing).
- **Look out for:** the drum is the gun's widest part and sits where the left forearm passes; check every carry, not
  only the hold.

### 5.6 APUHTHEE (wingman) and STRYDER (autopistol), the pistols

- **New:** the pistols: no stock, so neither view's long-gun hold applies; both hands on the grip (the default); no pack
  pistol imported yet. STRYDER changes from a rifle to the fast pistol here (the roster change, groundwork).
- **First person:** the pistols' arms and clips: the DGL50 (or Viper-357) for APUHTHEE, the X18 (an automatic; or the
  M1911, Kolibri) for STRYDER; each one's slide (Slide) and magazine (Clip, in the grip); gunfeel entries. APUHTHEE's
  reload is 2.1 s from empty and with a round chambered alike, so the slide's release on an empty one is a look, not a
  time.
- **Soldier:** a pistol stance in rifle.ts, for both (the gun placed by the hands and the look, not a shoulder pocket;
  both hands on the grip; aimed at the eye; carried low for a sprint and the swap); the reload from the grip's bottom;
  the swap's cup round a small gun; the punch with the pistol in the right hand.
- **STRYDER's numbers**, proposed at its turn: the RE-45's data tuned into the band tools/checks/ttk.ts holds a pistol
  to (APUHTHEE was tuned the same way), a fast automatic against APUHTHEE's heavy single shots, as the SMG and shotgun
  pairs are.
- **Look out for:** the old pistol hold (mannequin.ts, the clips' own) must give way only for these guns on the
  soldier; the legacy game's figures keep theirs. Pistol01's parts are read off its .glb at its turn.

### 5.7 HAEFY, the launcher

- **New:** everything: a new gun in the game (groundwork), a launcher held on the shoulder in both views, a rocket that
  flies and bursts, its reload a rocket into the tube.
- **First person:** the RPG's arms and clips (the hold and its reload); the rocket, its trail and the burst; a gunfeel
  entry.
- **Soldier:** a launcher stance (on the right shoulder, both hands on it, aimed along the look); its carries; the reload
  (a rocket into the tube) on the first person's shares; the swap's cup round a long tube; the punch.
- **HAEFY's numbers**, proposed at its turn: from the Skybreaker's ratios (a rocket a shot, its burst's full damage and
  area, a slow reload), held to the TTK and fusion rules; how far its blast reaches and whether it hurts its own holder
  are the owner's to approve.
- **Look out for:** the launcher's length on the shoulder against the head and the left arm in every carry; others must
  see the rocket in flight, not only its burst.

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

## 8. For the owner's final approval

- Go, and in this order (section 3)?
- The defaults in section 0: the pistols in both hands, REZ on the Drake-12, PANDA labelled Rifle.
- STRYDER's and HAEFY's numbers, shown at their turn (sections 5.6 and 5.7), including whether HAEFY's blast hurts its
  own holder.

## 9. Each agent's homework, before its first gun

- **The guns agent:** for each gun, its pack gun's clips (the reload, the rack, the hold), the match against our model,
  the rack spot where there is no handle, and a gunfeel entry; the reload's per-gun shape in the shared keys (section
  4); the pistols' and the RPG's arms and clips; the launcher's first-person feel. Write it into section 5's
  first-person lines.
- **The character agent:** for each gun, the trigger guard against the glove, the fore-end hold's reach standing and on
  the move, the carries round the gun's widest part, and the soldier's new kinds of hold and reload (the pump, the
  pistol, the launcher); the tools and checks over a list (section 4); the roster change and the launcher's gameplay
  (section 4). Write it into section 5's soldier lines. Done for the plan (2026-10-01): `PLAN_SOLDIER_EIGHT_GUNS.md`
  has each gun measured on the soldier today, the soldier's groundwork, and the faults expected a gun with what heads
  each off. Two found on the way: CHOOCH's overheat already shows other players the start of a reload (the vent fixes
  it), and a saved loadout naming STRYDER or HAEFY falls back to the default once their ids change (mapped instead).
