# Results: 1v1, loadouts, menus, polish, bug hunt, beta build

Follows `PLAN_1V1_BETA.md`. Everything in the plan shipped; the bug hunt
found 24 real bugs (six while building, eighteen in a second full read of
every system against every other) and all 24 are fixed. The open items are
at the end.

## What shipped

### Network and the 1v1 mode

| ID | Result |
|---|---|
| N1 | Peer to peer over WebRTC with PeerJS. The free public broker only introduces the two browsers; the game traffic goes straight between them, so there is no game server and the build stays a static site. **Make a match** gives a 5-letter code (no 0/O/1/I/L, so it can be read out loud) and copies it; the friend types it and presses **Join**. `?net=local` joins two tabs of one browser for testing. |
| N2 | One arena, 36 m by 64 m, well away from the range. Three lanes split by 3 m walls; spawns at the two ends; the lanes open up in the middle, where 1.4 m boxes (with 0.7 m step crates), 2.4 m containers and crates let you climb onto and over the lane walls. |
| N3 | Warehouse roof: solid panels, girders, light strips, a skylight every few bays. |
| N4 | B00G tiled on the arena walls in several shades and colours at about 30% strength, so it reads as paint and not as a target. |
| N5 | 20 s into a round a circle 3.5 m across lights up in the middle (a column of light above it). Stand in it alone for 10 s and the round is yours; both of you in it and nobody gains. A knock still wins at any time. The host decides; both screens show both capture bars. First to 3 rounds; a rematch starts on its own after the match screen. |
| N6 | The other player is drawn as their chosen operator holding their weapon, turned to their view, crouched when they crouch or slide, 100 ms behind and interpolated. Knocked, the figure falls over. Their shots draw red tracers and make sound, one per trigger pull. |
| N7 | The shooter decides hits and sends the damage; the other side takes it off the 75 blue shield, then the 100 health. Right between friends, no protection against cheating. |
| N8 | Frames keep running on a timer while the tab is hidden, and the round clock is real time, so an alt-tabbed player neither freezes nor slows the match. |

### Loadouts, operators, heirlooms, hands

| ID | Result |
|---|---|
| L1 | A loadout is an operator, slot 1, slot 2 and an heirloom. Five defaults (Assault, Close Quarters, Marksman, Heavy, Sidearms), five custom slots you name and edit, the last one used remembered across visits. A default can be copied into a custom slot. A 1v1 uses whatever loadout is selected. |
| L2 | Five operators built in code, each a different look of the range robot: Vanguard, Nightshade (crest), Sandstorm (brim and mask), Frost (shoulder plates), Inferno (antenna and shoulders). Your gloves take your operator's colours; the other player sees your operator. |
| L3 | Seven heirlooms: fists, karambit, butterfly knife (it flips open), kukri and tanto built in code, and two free CC0 models, a katana (CreativeTrio) and a dagger (Quaternius), from Poly Pizza. Holstered, you hold your heirloom. Searched and not used: the Sketchfab karambits need an account and are CC-BY; CS:GO knife replicas carry Valve's designs; "CC0" AI-generated models had unclear terms. |
| L4 | V is melee (the optic key moved to O): a swing with your heirloom or fist, 30 damage at up to 1.8 m, 0.9 s between swings. Hits dummies, targets and the other player. |
| L5 | Gloves with knuckle studs, fingertip caps and a wrist strap, two-tone in your operator's colours. |

### The game itself

| ID | Result |
|---|---|
| G1 | The slide starts on the frame crouch is pressed while sprinting, and the view now drops at a constant rate over 0.1 s instead of easing in, so the camera is down as fast as the slide begins. |
| G2 | Zipline superjump as the Apex Movement Wiki describes it: grab the zipline from the ground or in coyote time, then jump. The zip jump and the coyote jump stack their upward speed. Scroll up is jump, so a scroll spin does it. The tech feed names it. |
| G3 | The range has a warehouse roof at 10 m with closing strips down to the walls. |
| G4 | Each of the course's rooms has its own wall theme, trim and light colour (eight palettes, the start area included), and a nameplate over its door. |
| G5 | 1.5 s after crossing the finish you are put back by the start, facing a TV on the wall: time, rank, best, the split for every room against your best, enemies missed, and your last five runs. Turn round and the start line is right there. |

### Menus and pages

| ID | Result |
|---|---|
| U1 | A main menu with tabs: Play (Firing Range, The Run, Arena alone, Resume), 1v1 (make or join, the rules, the loadout you will use), Loadouts (list, editor, operator and heirloom cards), Settings (mouse, DPI measurement, FOV, sprint, fullscreen, graphics, the frame-rate guide), Controls. Esc in game brings it back. |

### Quality, docs, release

| ID | Result |
|---|---|
| Q1 | `npm run e2e`: real browser pages covering the page, a course run, the menus and loadouts, and a full 1v1 over both the local and the internet connection. |
| Q2 | Below: every bug found, with its fix and its test where one was possible. |
| Q3 | README.md rewritten: how to run, the modes, controls, what is in it, what it cannot do and its limits, when it would need to leave the browser, how to deploy, the checks. |
| B1 | `npm run build:beta` builds the public version: codenames for every weapon and optic, the game's name out of the text, the real names scrubbed out of the bundled data, and `tools/beta-check.ts` fails the build if one is left. It passes on the beta build and fails (28 names) on the private build, so it tells the two apart. The folder is a git repository with everything staged; the first commit, the push and the hosting wait for your go-ahead. |

## Found wrong along the way

### While building (6)

1. **A background tab stopped the host's rounds.** The frame loop ran on
   requestAnimationFrame only, which a hidden tab never fires, so an
   alt-tabbed host froze the match for both. Frames now run on a timer
   while hidden.
2. **The landing dip spring went unstable** at frame times above about 80
   ms (a hitch, a hidden tab): the camera bounced. It is now stepped at
   1/120 s whatever the frame rate; the movement sim checks it at 10, 30 and
   144 fps.
3. **A range pillar stuck 15 cm through the back wall**, in front of the
   course TV. Pillars moved in, the TV moved along.
4. **The Arena button worked during a 1v1** and put you on the host's spawn
   whatever your side, mid-round. Every mode button now waits until you
   leave the match.
5. **You could aim down sights while knocked** in a 1v1, scope overlay
   included.
6. **36 MB of old texture zips were shipping in `dist/`**, left in
   `public/tex` by an earlier version of the asset script, and git would
   have taken them too. Deleted; the ignore file now keeps every fetched
   download out.

### The second full read (18)

A separate read of the whole codebase, one system against another. All
eighteen were checked against the code before fixing; all were real (4 and
9 duplicated 4 and 5 above).

| # | Bug | Fix | Test |
|---|---|---|---|
| 1 | **Optics piled up on the guns.** Gun models are cached per weapon, and switching weapons left the fitted optic on the old model, so swapping away and back added a second one, and a finished course run could put a scope over the iron sights. Range dummies and the 1v1 opponent cloned your live gun too, so they showed your optic, your magazine colour and a bolt caught mid-cycle. | The optic comes off (and is freed) before the model changes. Figures in the world clone a second, untouched copy of each gun. Shared geometry is marked so freeing an optic never frees a shape the guns use. | e2e: one optic in the scene after four swaps |
| 2 | **Ctrl+W closed the tab.** Browsers do not let a page cancel Ctrl+W, Ctrl+T or Ctrl+N, so crouch on Ctrl then W closed the game, mid-1v1 included. | Playing goes fullscreen with Keyboard Lock (Chrome, Edge), which hands those keys to the game; a setting turns it off. Windowed, the browser asks "Leave site?" first. | not automatable (needs a real key press); checked by reading |
| 3 | **The opponent's figure never updated**: a knocked player stayed standing, no hit flash, and the Digital Threat optic did not light them. | The figure is updated every frame and is in the threat list. | e2e: the knocked figure falls over on the other screen |
| 4 | Arena button during a 1v1 (as 4 above). | | |
| 5 | **A second connection replaced a live match** on the internet connection: the host kept accepting, and the old match's figure stayed in the world. | The host takes the first connection only; `startDuel` refuses a second. | by reading |
| 6 | **A hidden host tab slowed the round clock about tenfold.** The game clock moves at most 0.1 s a frame and a hidden tab gets one frame a second. | Countdowns, the circle and capture run on real time. | e2e: the circle goes live 20 s into a round, measured in real seconds |
| 7 | **The guest's first countdown showed "1" throughout**: its clock started at 0. | The match clock starts at the moment the match does (part of 6). | by reading |
| 8 | **A new figure was built on every opponent weapon swap**, never freed, with a hitch each time. | One figure per weapon and operator seen, reused; all freed when the match ends. | by reading |
| 9 | Aiming while knocked (as 5 above); reload, swap, holster and attachment keys also still worked. | All weapon keys off while knocked. | by reading |
| 10 | **Holstering did not stop a burst** (or a reload): the rest of the burst fired as the gun went away. | Holstering cancels it, as a swap does. | by reading |
| 11 | **A course run stripped your attachments**: the guns came back by id alone, with no optic, barrel, stock, laser or mag level. | The whole slot is saved and put back. | e2e: the optic is back after a run |
| 12 | **Accuracy could read over 100%**: shots counted per trigger pull, hits per pellet (an EVA-8 read 800%), and melee hits counted with no shot. | Shots count per pellet; a melee swing counts as one attack. | by reading |
| 13 | **Closing a tab left the other player facing a frozen figure** on the local connection, forever. | A tab that closes or reloads says goodbye; 10 s of silence ends the match on either connection. | by reading |
| 14 | **Messages arriving just after a match ended still acted**: a late weapon change built a figure nobody removed, a late hit flashed red in the range. | Ended matches and closed links ignore messages. | by reading |
| 15 | **A broker hiccup during a match showed a connection error** in the 1v1 panel while the fight carried on fine. | Broker errors are ignored once the match is connected. | by reading |
| 16 | **A teleport kept jump fatigue, fall stun, the sprint buffer and the landing dip**: a round started mid-jump gave a 30% first jump. | `teleport()` clears them. | movesim: full-height first jump after a teleport taken mid-jump (fails at 20.6 hu without the fix) |
| 17 | **The opponent's crouch blend depended on frame rate**, and the hit zones scale with it. | Blended by time, the same at any frame rate. | by reading |
| 18 | **A remote shotgun blast played eight gunshots**, one per pellet. | One sound per trigger pull. | by reading |

### Test mistakes, not game bugs

- A scripted zipline throw landed 0.6 m short of the door the test expected;
  the test now runs through the door.
- The fatigue test first hit the bunny-hop penalty instead (a different rule
  inside 0.1 s of landing); it now waits 0.2 s.
- The arena box test read `onGround`, which is true during a mantle; it now
  reads the stance.
- Headless Chrome needs script clicks and a polled wait on background pages,
  or a test stalls. `?norender` runs two pages at once on the software
  renderer.

## Verification

| Check | Result |
|---|---|
| `npm run check` | clean |
| `npm run verify` (incl. movesim) | pass: weapon data, damage, recoil, sensitivity, every movement rule, the new teleport test |
| `npm run e2e` | pass, see below |
| `npm run build`, `npm run build:beta` | pass; beta check: no real names in the public bundle |
| `npm run rules` | clean: nothing references the game's install or files |

The e2e run: 47 checks, all pass. The page loads with the static merge done
(934 meshes to 118) and no errors. A scripted course run finishes with a split
for all eight sections, puts you back at the TV (x -14.5, z 11.4, facing it),
and gives your optic back. Four swaps leave one optic in the scene; with the
old code in place the same check counts four and fails. All five menu tabs
work, and a loadout choice, an edit and a copy survive a reload.

The 1v1 runs over both connections. It connects, both spawns are right, the
countdown ends, and a 50 hit comes off the shield first. A knock scores 1-0
on both screens and the knocked figure falls, then round 2 restores shields
and health. On the local connection, the circle went live 20.0 real seconds
into the round and a 10 s hold took it 2-0 on both screens. Leaving ends the
match on the other side.

Movement: jump height, fatigue, coyote time, bunny-hop penalty, slides,
superglides, lurch, climb zones, mantles, ziplines with the superjump,
ladders and the arena boxes all match their source numbers, at 10, 30 and
144 fps where frame rate matters.

## Open

- **The first load is about 42 MB**, 29 MB of it prop models with 1K
  textures. Playable before the props finish; compressing their textures
  (KTX2) would cut most of it.
- **No TURN relay and a borrowed broker.** Strict networks cannot connect,
  and the public PeerJS broker has no uptime promise. Our own broker plus a
  TURN server fixes both (README, "When it would need to leave the browser").
- **The shooter decides hits**: fine for friends, trivially cheatable.
- **The Ctrl+W fix is untested by machine**: the e2e cannot send a real key
  press or go fullscreen headless. Worth a check by hand in Chrome: crouch on
  Ctrl, press W, the game should keep running.
- **A hidden local-transport tab** (two tabs, `?net=local`) is throttled to a
  frame a minute after five minutes hidden, and would hit the 10 s silence
  limit; pages with a live peer connection are exempt, so the real 1v1 is not
  affected.
- The other player's figure slides, turns and crouches but has no run, climb
  or zipline animation.
