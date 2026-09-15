# B00G Range (beta)

A browser firing range that reproduces the feel of Apex Legends' movement and
guns from published numbers, with two timed movement courses, a guided tour,
bots, a battle royale with loot, Gun Run, team deathmatch and Crown, and a 1v1
or 1v1v1 against friends by code. Own code, own art, nothing from the game's
files. It runs in a browser tab and has no connection of any kind to the Apex
install, the EA App, Steam or Easy Anti-Cheat.

**Play it: https://incomeimprovement99-netizen.github.io/FPSfun/**
(Chrome or Edge on a PC; the public build uses codenames for the guns.)

## Contents

1. [Play it now](#play-it-now)
2. [1v1 a friend](#1v1-a-friend)
3. [Run it locally](#run-it-locally)
4. [Modes](#modes)
5. [Controls](#controls)
6. [Controller](#controller)
7. [Settings](#settings)
8. [Movement tech, and how to do it here](#movement-tech-and-how-to-do-it-here)
9. [Guns, attachments, optics, loadouts](#guns-attachments-optics-loadouts)
10. [Your character, stats and boards](#your-character-stats-and-boards)
11. [How it works](#how-it-works)
12. [Project layout](#project-layout)
13. [Config and data files](#config-and-data-files)
14. [Scripts and checks](#scripts-and-checks)
15. [Deploy](#deploy)
16. [What it can't do, and the limits](#what-it-cant-do-and-the-limits)
17. [When it would need to leave the browser](#when-it-would-need-to-leave-the-browser)
18. [Troubleshooting](#troubleshooting)
19. [Docs](#docs)
20. [Rules of the project](#rules-of-the-project)
21. [Credits](#credits)

## Play it now

1. Open the link above in **Chrome or Edge on a PC**. Firefox works without
   raw mouse input (acceleration can leak into the aim); Safari and phones
   are not supported.
2. The menu is up, with a short welcome on a first visit (and a warning on a
   phone, a tablet or Safari, which cannot play). **Play tab, Firing Range.**
   The browser locks the mouse and goes fullscreen (Settings can turn that
   off). **Esc** brings the menu back; **Play / Resume** goes back in.
3. Everything else is a menu button: the guided tour (start here if you are
   new: it walks you through every move and key), the two courses, the arena
   alone, the bots, the battle royale, Gun Run, team deathmatch, Crown, and the
   1v1 tab for friends.

Nothing is installed and nothing is sent anywhere: settings, loadouts, your
name, your best times and your stats live in this browser's localStorage.

## 1v1 a friend

1. You: **1v1 tab**, leave "2 players", **Create match**. A 5-letter code
   appears with an **invite link**, copied to your clipboard. Send the link
   (Discord, a text).
2. Friend: open the link (on a PC, in Chrome or Edge). It joins your match by
   itself. (Or: 1v1 tab, type the code, **Join**.)
3. Both screens say connected. **Both click Play.** The HUD holds at
   "WAITING FOR EVERYONE TO CLICK PLAY" until the last one is in, then a 3 s
   countdown.
4. First to 3 rounds. Blue shields (75) and 100 health. 20 s into a round the
   circle in the middle goes live; stand in it alone for 10 s to take the
   round. The last one standing takes it any time. A rematch starts by itself
   after the match screen.
5. Esc, 1v1 tab, **Leave match** to stop.

**Three players**: pick "3 players" before Create match; both friends open
the same link; it starts once all three have clicked Play. The map is a
triangle with a corner each. A guest leaving before round 1 frees their
place (the link works again); during the match it drops it to a 1v1; the
host leaving ends it.

**Other modes with friends**: the first box on the 1v1 tab picks what to
play before Create match: the arena 1v1 / 1v1v1, Gun Run, team deathmatch
(you and your friends against the bots), Crown, or the battle royale as a
squad. The host's choice (and the bots, their difficulty, Gun Run's list and
whether abilities are on) goes to everyone who joins.

**Your name** for the kill feed and the scoreboard: the Stats tab.
**Loadouts**: the Loadouts tab, before or during a match (mid-fight, the new
guns come at the next round).

Codes never contain 0, O, 1, I or L, so they can be read out loud. The
connection is browser to browser (WebRTC); a PeerJS broker only introduces
the two (our own on the game's server, the free public one on GitHub Pages),
and a TURN relay carries the match when a network blocks the direct path.
See [Troubleshooting](#troubleshooting) when it will not connect.

## Run it locally

```
npm install
npm run assets     # CC0 textures (ambientCG, Poly Haven), not kept in git
npm run models     # CC0 props (Poly Haven), not kept in git
npm run dev        # http://localhost:5173
```

Node 20 or 22. The dev server hot-reloads on every change to `src/`,
`data/` and the JSON in `src/config/`, so a tuning number can be edited with
the game open.

URL flags, all for testing:

| Flag | What it does |
|---|---|
| `?net=local` | the 1v1 joins tabs of the same browser through a BroadcastChannel instead of the internet: open two tabs, create in one, join in the other |
| `?norender` | runs the game without drawing (the test tools use it; the simulation still runs) |
| `?nomerge` | skips the static-mesh merge, to compare frame rates |

The local build (`npm run dev`, `npm run build`) shows the real weapon and
optic names; only `npm run build:beta` (what is deployed) swaps in codenames.

## Modes

| Mode | What it is |
|---|---|
| Firing Range | 29 of Apex's guns (and the course pistol), dummies with armour tiers, target banks and moving rails, ladders, a vertical zipline, the wallbounce practice wall with its recipe on a sign, mantle ledges, a slide ramp, the spray wall, the flick drill's pad and the superglide trainer. Two lit gates on the back wall lead to the courses. The Range box on the Play tab sets what the dummies do (stand, strafe, crouch, random; slow to fast) and whether they shoot back. |
| Guided tour | Thirteen steps through the range, a green marker for each: move, sprint, slide, jump, mantle, climb, a superglide, shoot, reload, swap, heal, JOLT, a grenade. It watches what you do and moves on; hold E (X on a controller) to skip a step. |
| The Run (Basic) | Timed movement course in the range's back-left corner: seven rooms, each built round one technique (breach, vent slide, climb, superglide, gap lurch, zipline, final sprint), 20 armed pop-ups. Splits per room against your best, a gold, silver or bronze medal per room against its par, a ghost of your best run, a results TV at the start, ranks S/A/B/C. |
| The Run (Advanced) | The back-right corner: nine rooms, 200 m, 30 pop-ups, the techniques chained. Every gate needs its move: a 7 m gap only a superglide clears, pads only a lurch reaches, a platform only a zipline superjump gets on, two vents, a bounce slalom, a drop slide, a shooting zip, a flow room. Its own bests, splits, ghost and TV. |
| 1v1 and 1v1v1 | One player makes a match (2 or 3 players) and gets a 5-letter code; the others type it. 1v1: a three-lane warehouse arena. 1v1v1: a triangle, a corner each, spokes between the corners. First to 3 rounds, blue shields and 100 health. 20 s into a round a circle lights up in the middle; stand in it alone for 10 s to take the round. The last one standing takes it any time. |
| Arena, Bots | The 1v1 rules against one or two bots, offline, on Easy, Normal or Hard (their speed, reaction time and aim). They hunt you, strafe, go for the circle, heal when nobody is in sight, and go down like anyone. |
| Gun Run | Every kill moves you to the next gun and puts it in your hands at once; after the last gun comes the knife (melee, 100 a hit, 300 to the head), and a knife kill wins. A melee death costs a level. 10 minutes, then the highest level wins. Health and shields come back 4 s after the last hit; you are back in 3 s after going down. Ten guns or every gun. Against bots (Play tab), with friends and bots (1v1 tab). |
| Team Deathmatch | You and your friends, filled out with bots to four, against four bots in the 1v1 arena; respawns after 4 s at your end; first team to 30, or ahead at 10 minutes. Team mates cannot hurt each other and their plates are green. |
| Crown | Rounds like the 1v1: 20 s in, a crown appears in the middle; walk over it to take it; 30 s held without going down takes the round (so does being the last one up). Everyone sees who has it. First to 3. |
| Arena, alone | The 1v1 map with nobody else, to learn it. |
| Battle Royale, Bots | Outskirts: 440 m of open ground with the Hub in the middle and four places round it (a container yard, a depot of sheds, a stepped ridge with a bunker, a small town with a water tower). You and up to 11 bots drop from the sky onto one of the five (the map shows where, the movement keys steer the fall), the ring closes six times with Apex's damage per tick, bots walk the roads, fight each other and you, and the last one standing wins. **You land with nothing** (a setting keeps your loadout instead): about 200 items on the floor (guns, ammo, heals, magazines, barrels, stocks, optics, hop-ups, helmets, grenades), E takes the one you look at; the bots land unarmed and search first. Death boxes, care packages in ring rounds 2 to 4, jump towers, launch pads on the roads. A white shield core that levels with the damage you deal (EVO). M for the map. Out: your placement, your kills and how long you lasted; the champion screen when it is you. **As a squad**: the 1v1 tab, "Battle royale" as the mode, Create match, and two or three friends drop together on the same place against the bots. Knocked with a squad mate still up, you are down, not out: crawl, bleed out over 90, 60, 30, 15 s a knock, and a squad mate holds E for 5 s to revive you. Out, your banner is in your death box: a squad mate takes it to a respawn beacon and brings you back. Pings (the middle mouse button) mark an enemy, an item or a place for the squad; out, you watch a squad mate through their eyes. |

In every mode the HUD is laid out where the game puts things: health and
shield bottom left (with the heal kit beside them in a match), weapon and
ammo bottom right, the tech feed on the left, the kill feed and scoreboard
top right in a match, damage numbers and hit markers on the target, a notice
line in the middle; in a battle royale the alive count, your kills and the
ring's clock top centre, the rings on the minimap, and an orange edge when
you are outside.

**Abilities.** Pick **JOLT** (a 10 m dash the way you are moving, every 3 s,
F) or **TRIAGE** (every heal twice as fast) with 5 or 6 when the card comes
up: at each countdown in the arena, the modes and the bots, or when you land
in a battle royale. A setting per kind of match turns them on or off (the
battle royale's is on). Bots take one too.

**The killcam and the death recap.** Eliminated, you see the last 4 s from
your killer's eyes (Space skips; a setting turns it off), then a card: for
everyone who hurt you this life, the damage, hits and headshots each way,
their gun and the distance of each hit, whether they healed in the 10 s
before (and with what), and what they had left.

**The lobby.** Create match puts you straight into the arena with the code on
the HUD; run around until your friends arrive (a connect takes them in too).
The countdown starts once everyone is in.

**Third person.** X switches the camera behind your shoulder (Settings has it
too); hold Alt to turn the camera round your own figure and see the skin.
Shots go from your eye to what the crosshair is on, so they land where it
says. Other players, bots and your own figure are jointed and animate: a run
cycle whose legs go the way the figure moves while its body stays on its aim
(a strafe, a backpedal), the crouch, the slide lean, arms up on a climb or a
mantle, the jump tuck, the zipline hang, the gun up to the eye when aiming,
a kick with every shot, the reload, the swap, a heal with the item in hand, a
flinch when hit, a JOLT's lean, and down on the knees. Settings can swap the
robots for a **motion-captured mannequin** (Quaternius's CC0 clips: walk, jog,
sprint, crouch, the aim, the reload, the heal, the slide, the climb).

## Controls

Keyboard and mouse. The defaults are in `src/config/binds.json` (key codes,
so the layout does not matter; `mouse3`/`mouse4` are the thumb buttons,
`wheelup`/`wheeldown` the scroll wheel, one press per notch). **The Controls
tab rebinds any of them**: click a key, press the new key, mouse button or
scroll (Esc cancels, Backspace removes it). A key another action had moves
over, and the tab says which. Your keys are kept in the browser; Reset to
defaults puts `binds.json` back.

| Key | Action | Key | Action |
|---|---|---|---|
| W A S D | move | Shift | sprint (press, like the game; hold in Settings) |
| Space, scroll up | jump (scroll makes superjumps and bunny hops easy) | Ctrl, C | crouch, slide (see Ctrl + W under limits; toggle in Settings) |
| Scroll down | forward, one tap per notch, for tap-strafing | E | interact: a zipline, an item; hold: a revive, a beacon, skip a tour step |
| Left mouse | fire | Right mouse | aim down sights (toggle in Settings) |
| R | reload; hold with a full magazine to inspect the gun | V | melee (heirloom or fist) |
| 1, 2 | weapon slot | Q, Mouse 5 | swap weapon |
| 3 | holster (move 15% faster) | 4 | heal: a tap is the quick heal, hold for the wheel of every heal |
| G | a grenade in hand (again: the next kind); fire throws, aim puts it away | F | your ability (JOLT) |
| 5, 6 | pick JOLT or TRIAGE when the card is up | B | fire mode (where a gun has two) |
| Middle mouse | ping, for the squad | M | the full map |
| U | magazine level | O | cycle optic |
| J, N, H | barrel, stock, laser | L | hop-up |
| Z | variable optic zoom | T | dummy armour tier |
| I | what the dummies do | Y | reset dummies and the course |
| K | ghost of your best run on/off | P | copy your course result |
| X | third person on/off | Alt (hold) | look round your character |
| Esc | menu | | |

The defaults, as the Controls tab first shows them.

## Controller

Plug one in and press **Start**; that is the controller's "click Play" (Start
also brings the menu back). The layout is the game's default one:

| Control | Action | Control | Action |
|---|---|---|---|
| Left stick | move (auto sprint when pushed all the way, by default) | Right stick | look |
| RT | fire | LT | aim down sights |
| A | jump | B | crouch, slide |
| X | reload; interact where there is a prompt (a zipline, an item); hold for a revive, a beacon, a tour skip | Y | swap weapon |
| LB | your ability (JOLT) | RB | variable optic zoom |
| L3 | sprint (when auto sprint is off) | R3 | melee |
| D-pad up | cycle optic | D-pad down | magazine level |
| D-pad left / right | weapon slot 1 / 2 (and pick an ability while the card is up) | Back | holster |
| Start | play / menu | | |

**Every button but Start can be moved** on the Controls tab (a column for the
controller under the keys); the heal, a grenade and the ping have no button
by default, so give them one there if you play on a pad.

Look sensitivity 1 to 8 like the game (3 is the game's default, 180 deg/s of
yaw), a separate ADS level, a Classic (curved) or Linear response, an inner
deadzone, and rumble on shots and hits. **Advanced look** (Settings) is the
game's custom look controls: yaw and pitch speeds for hipfire and aiming, and
an extra yaw and pitch at the stick's edge that ramps in over a time after a
delay. The stick is turned into the four movement keys at a threshold, so
every movement rule (lurch, the 45-degree sprint cone, air strafing) sees the
same inputs a keyboard gives.

**Aim assist**, on by default (Settings to turn it off), in the game's two
parts: the stick slows with the reticle on a target (0.8 hipfire, 0.6 aiming),
and while you move, the view follows 40% of the target's movement across the
screen (the PC controller value). The zone is a sphere round the target's
chest, so it shrinks with distance; a wall between switches it off; with no
input it does nothing, and the mouse never gets it. Numbers in
`src/config/aimassist.json`.

## Settings

The Settings tab, all remembered in this browser:

| Setting | What it is |
|---|---|
| Mouse DPI, **Measure my DPI** | your mouse's DPI, or measure it: swipe a marked distance with the button held and it counts the raw hardware counts. Needed for cm/360 to be right. |
| Mouse sensitivity, ADS multiplier, FOV scale | the game's three numbers, with the same maths (0.022 degrees per count; ADS scaled by the zoom). The panel shows your cm/360 live. |
| ADS per optic | a multiplier for each zoom (1x, 2x, 3x, 4x, 6x, 8x, 10x) on top of the ADS one, like the game's; a variable optic uses the zoom it is on |
| Aim down sights, Crouch | hold, or toggle (a press in, a press out) |
| Sprint | press (the game's default: press once, it arms for 3 s and runs while you hold forward) or hold |
| Sprint view shake | Normal or Minimal, the game's setting |
| Fullscreen while playing | on by default: fullscreen with Keyboard Lock, which hands Ctrl+W to the game in Chrome and Edge |
| Graphics | Competitive (straight to the screen with MSAA, fastest), Balanced, High (post-processing, shadows, bloom) |
| Figures | the other players and bots as our robots, or the motion-captured mannequin |
| Killcam | on (the replay, then the recap) or off (the recap only) |
| Volume | master, effects, hits |
| The range's ammo | endless, or counted like a match |
| Mantle boost cue | the ring on the crosshair in the last frames of a mantle, where a superglide is possible |
| Controller: look, ADS, curve, deadzone, auto sprint, rumble, aim assist, advanced look | see [Controller](#controller) |
| Getting past the frame cap | a step-by-step guide to raise the browser's frame limit (monitor refresh rate, Chrome flags) |

## Movement tech, and how to do it here

Every number is from the engine constants or the Apex Movement Wiki
(apexmovement.tech); the few we had to choose are marked "ours" in
`src/config/movement.json`, and `docs/FIDELITY.md` has the source of each.
The tech feed on the left names what the game registered as you do it, and
says why a miss missed.

| Tech | How | Feed line |
|---|---|---|
| Slide | sprint, crouch. Instant boost to 400 hu/s cap, 2 s cooldown; a slide from a stand (a deadslide) gives nothing. Down slopes speed it up. | DEADSLIDE on a miss |
| Slide jump | jump out of a slide. Keeps its speed if taken below 350 hu/s or at least 0.24 s in. Peaks at 44 hu, lower than a plain jump (56). | SLIDE JUMP |
| Bunny hop | jump on landing; a jump within 0.1 s of landing loses speed (never below 450 hu/s), and a jump within 0.15 s of landing is cut to 30% height, recovering to full by 0.75 s. | HOP PENALTY, JUMP FATIGUE |
| Lurch, tap-strafe | in the air, press a direction key within 0.4 s of the jump: full redirect for 0.2 s, fading to nothing at 0.4. Scroll down is forward, one tap per notch, so jump and scroll turns you round a corner. | LURCH |
| Wallbounce | the wiki's recipe, on the practice wall's sign: sprint at the wall, crouch to slide, jump out of the slide, let go of W, touch the wall at the top of the jump (the green zone is 19 to 47 hu up), press jump. Lower in the zone is a bigger bounce (350 to 484 hu/s). | WALLBOUNCE; WALL PUSH with the reason ("too high: 56 hu up, the green zone is 19 to 47. Slide jump or drop below your apex first"); NO WALL ("look at it (62 deg off)") |
| Mini bounce, crouch kick, wallskip | jump off the bottom 19 hu of a climb (mini bounce, 188 out); crouch on the same frame (crouch kick, 245 out); hold W into the wall for height with no distance (wallskip). | WALLBOUNCE variants |
| Climb | leave the ground, face the wall within 45 degrees, push into it. The climb space is 147 hu from your last ground contact or 100 hu above where you attached, then an end boost of 28 hu. | (silent) |
| Mantle | run at a ledge up to the mantle height with your input toward it; it pulls you up. | (silent) |
| Superglide | in the last 0.15 s of a mantle, press jump and then crouch exactly one frame later: a slide boost and a jump together, in the air. Peaks at 88 hu, which is why it clears the 7 m gap on the advanced course. Scroll up for jump makes the timing easier. | SUPERGLIDE; SUPERGLIDE MISS ("crouch 3 frames after jump (needs exactly 1)") |
| Zipline | E to ride, in the direction you look; 600 hu/s (480 on vertical zips). Jump or crouch to leave (up to 445 hu/s), ride to the end for the full 600. Three mid-air grabs, then you must touch the ground. | ZIP JUMP, ZIP CROUCH |
| Zipline superjump | interact, jump, jump: the second jump in the grace window after a zip jump adds a full jump on top. | SUPERJUMP ("+N hu on the zip jump") |
| Fall stun | a landing from 300 hu is free; from 800 hu, a full 1 s stun. | (the screen dip) |

The basic course teaches them one room at a time; the advanced course gates
each room on one. `npm run measure` prints what each technique reaches on
the real controller (the numbers the advanced course was built from) and
`npm run probe` performs a scripted wallbounce in the real page and prints
what the feed registered.

## Guns, attachments, optics, loadouts

29 of Apex's guns (and the course pistol) from extracted reference numbers
with Season 30's changes on top: damage per zone, fire rate, magazine sizes
per level, reload and tactical reload times, spread by stance, recoil
patterns, projectile speed and drop (hitscan where the game is). Mag levels
(U), barrels (J), stocks (N), lasers (H) and hop-ups (L) apply the reference
mod blocks. Ten optics with their own housings, reticles, eye relief,
variable zoom (Z) and full-screen scopes at 3x and up; a weapon whose own
sight is a scope (the Kraber's 4x-8x) wears it by default.

The guns that are not a plain trigger work the way the game's do: the
Havoc's and the Devotion's wind-up (a turbocharger shortens it), the Charge
Rifle's charge and its damage growing with range, the L-STAR's heat and
lockout (it cools only when you let go), the 30-30's aimed charge, the
Peacekeeper's choke, the Nemesis's burst charge, the Bocek's draw, and fire
modes on B (the Hemlok, the Prowler, the R-301...). Ammo is counted in a
match: light, heavy, sniper, shotgun rounds and arrows in stacks, and an
energy gun's own stockpile of whole magazines that comes back one every 18 s
while the gun is idle (Season 30's rework).

**Throwables** (G): the frag grenade (100 inside 2.4 m falling to nothing at
8 m, a 4 s fuse, it bounces and rolls), the arc star (sticks to the first
thing it touches, a wall or a player, and goes off 2.8 s later: 75 and a slow
of up to 5 s), thermite (a 6 m line of fire across the throw for 8 s, 8 a
second inside it and 25 more after). A dotted arc shows where it will land.
One of each per life in a match; the battle royale's floor has them; the
range never runs out.

The view model is built in code: each gun with its grip at the hand, gloved
hands in your operator's colours, and animations for sprint, slide, climb,
mantle, jump and fall, ADS, fire, reload (with a chamber check after an
empty magazine and a pistol slide lock), holster and swap, and the melee
swing.

Loadouts, the way CoD does classes: five defaults and five custom slots
(pick two weapons, name it), the last one used remembered. Loadouts can be
changed mid-match; mid-fight the new guns come at the next round. Changing
an attachment keeps the rounds in the gun (a bigger magazine fills on the
next reload), so the attachment keys are never a free reload.

**Healing**, Season 30's items and times: the shield cell (25 in 2.5 s), the
syringe (25 health in 4 s), the shield battery (full in 5 s), the med kit
(full in 8 s) and the phoenix kit (both full in 10 s). A tap of the heal key
is the quick heal (shields first, the right size for what is missing); hold
it for a wheel of all five. You walk 40% slower and cannot sprint while
healing; sprinting, firing, aiming or a swap cancels it; the item is only
spent when it finishes. The arena kit is four cells, two batteries, four
syringes and two med kits a life. Helmets: the gold one sets the armour to
100 and doubles the small heals, the mythic one 125.

Dummies have head, body and leg zones (a hit flashes gold, white or blue by
zone), shield tiers (T cycles them), knock and stand-up, damage numbers and a
knock time on the HUD for time-to-kill checks. They can stand, strafe,
strafe and crouch or dodge at random (I, or the Range box), and shoot back
with a bot's aim, in which case you have a shield and health in the range
too. Pop-up targets on the courses are armed and count.

**The range's tools**: the spray wall (a mag from the mark 20 m out leaves
your hits beside the gun's own pattern, scaled to the distance), the flick
drill (thirty figures one at a time in a 60-degree cone, a clock, your best on
the Stats tab and the online board; the pad by the firing line or the Play
tab's button starts it), the superglide trainer (every mantle draws a bar of
its last 0.3 s with your jump and crouch on it and the frame you hit, ten
tries scored), and the per-gun session numbers on the Stats tab.

## Your character, stats and boards

Five operator looks (the other player sees yours), seven heirlooms (four built
in code, two free CC0 models) as the melee weapon when holstered.

The **Stats** tab keeps your name and every result in this browser: matches
(won, lost, K/D, rounds, damage, accuracy, win streak) per mode and per bot
difficulty, best time and the top ten runs per course, and every piece of
tech landed or called out as a miss.

**Online boards** come with the game's own server (`server/game/serve.mjs`,
[Deploy](#deploy)): every course run and every win is posted under the
player's name, the Stats tab shows the top 15 of each board with you
highlighted, and the HUD says your place after a run or a win. The game
finds the board by itself (`/net.json`); on GitHub Pages there is none and
everything stays local. `server/leaderboard/` is the same boards as a
Cloudflare Worker, for a build made with `VITE_LEADERBOARD_URL`. Either way
it trusts the game, so it is a board for friends, not a ranked ladder.

## How it works

- **One frame loop** (`src/main.ts`): read the mouse, keyboard and pad; step
  the player controller against the level's collision boxes; step the
  projectiles, dummies, courses and the match; draw the scene and then the
  HUD on a 2D canvas over it. Game time is the frame clock; match timers
  are wall-clock so both sides agree.
- **Movement** (`src/game/player.ts`) is a capsule against axis-aligned
  boxes with the game's rules on top: the three ground acceleration bands,
  Quake-style air movement with no drag, the slide, climb zones, mantles,
  lurch windows, jump fatigue, fall stun, ziplines and ladders. Constants
  are in Hammer units in `src/config/movement.json` and converted once in
  `src/game/movement.ts`.
- **Courses** (`src/game/course.ts`) are layouts: each room is a list of
  boxes, pop-ups, hazards and a gate; `src/game/courses/basic.ts` and
  `advanced.ts` are the data. The same layout is fed to the collision
  world and to the movement simulation in `tools/movesim.ts`, which is how
  every gate is proven clearable before the level is built.
- **Weapons** (`src/game/weapons.ts`, `weapon-state.ts`, `recoil.ts`,
  `spread.ts`, `projectile.ts`) resolve `data/weapons.json` plus attachments
  into the numbers a shot uses. Recoil is the reference pattern driven
  through a spring; spread is the stance cone plus a per-shot bloom.
- **Multiplayer** (`src/net/link.ts`, `src/game/duel.ts`) is a star: the
  player who creates the match is the host, guests connect to it by code
  through the PeerJS broker (the site's own when `/net.json` names one, with
  TURN credentials for the relay; else the public one), and in a 1v1v1 the host relays between the
  guests. State packets go 30 times a second with position, look, weapon,
  health and whether you are in the game; shots and hits are messages; the
  shooter decides hits. The host runs the round clock, the circle and the
  scores; guests apply what it sends. `?net=local` swaps the transport for
  a BroadcastChannel so two tabs can play without the internet.
- **The server** (`server/game/serve.mjs`): one Node process that serves the
  public build, runs the PeerJS broker, hands out TURN credentials for the
  coturn relay, keeps the online boards and answers `/health`.
  `docs/SERVER_GUIDE.md` sets it up.
- **Bots** (`src/game/bots.ts`) run the same match rules with a bot
  controller: a path down the lanes with slide-along collision, line of
  sight through the level's boxes, a reaction time and an aim error per
  difficulty. The match tells a bot what it senses (the nearest enemy it can
  see, where to walk); the arena sends it to the circle, the battle royale
  along a graph of the map's nodes and into the next ring.
- **The battle royale** (`src/game/br.ts`, `ring.ts`, `brmatch.ts`) is a
  `Duel` subclass: the same links and figures, with the host running the
  bots and the ring and sending the bots as ordinary state packets (ids from
  100), so a friend's game draws a bot like any player and a friend's hits
  reach a bot as hit messages the host applies. Alone it is the same class
  with no links. The ring is pure logic with six phases (verified in
  `tools/verify.ts`).
- **The arena's modes** (`src/game/modes.ts`, `modematch.ts`) are a `Duel`
  subclass too: the rules alone in `modes.ts` (Gun Run's ladder, the team
  score, the crown, the respawn pick), tested in Node; the host runs them and
  the bots and sends the state as a `mode` message.
- **The battle royale's floor** (`src/game/loot.ts`, `brplay.ts`): the items
  come from a seed in the host's welcome, so every browser lays out the same
  items under the same keys; taking one is asked of the host (first come,
  first served). Downs, revives, banners, beacons and pings are messages on
  the same links.
- **Throwables** (`src/game/throwables.ts`): a throw is a body under gravity
  against the world's boxes, one axis at a time; the flight is deterministic,
  so the others replay it from one message, and the thrower decides the
  damage the way the shooter decides a bullet's.
- **The killcam** (`src/game/killcam.ts`) records every figure 30 times a
  second and replays the last seconds from the killer's eye; **the recap**
  (`recap.ts`) keeps the life's hits and heals each way.
- **Sound** (`src/game/audio.ts`, `soundscape.ts`) is synthesised: positional
  (HRTF), dulled and delayed with distance, a gun class per weapon, footsteps
  by surface, the reload in parts, the match's cues.
- **Figures** (`src/game/dummy.ts`) are either merged into a few meshes (the
  range's dummies) or, for anything that moves, built as jointed parts about
  their pivots (pelvis, torso, head, arms with the gun, thighs, shins) and
  posed from a stance, a speed, the aim, the way it moves and what the hands
  are doing, sent in the state packet. `mannequin.ts` swaps in the
  motion-captured mannequin (two animation layers, legs and upper body).
- **Rendering** (`src/game/render.ts`, `quality.ts`, `staticmerge.ts`,
  `materials.ts`, `props.ts`): the static level is merged into one mesh per
  material, PBR textures and glTF props are CC0 and fetched by script, and
  three presets trade post-processing for frame rate.
- **Names** (`src/config/names.ts`): the private build shows the real
  weapon and optic names; the public build (`--mode beta`) uses codenames
  and strips the real names from the shipped data, and `tools/beta-check.ts`
  refuses a build with one in it.

## Project layout

```
index.html                 the page: canvas, menu panels, settings, controls table
src/main.ts                wiring: settings, menu, modes, the frame loop, the match hooks
src/config/
  movement.json            movement constants (Hammer units) with a note per group
  player.json              hull, camera, view feel
  binds.json               the default key and mouse bindings
  aimassist.json           controller aim assist: slowdown, rotational strength, zone
  recoil-tuning.json       the one tuned recoil dial (softImpulseScale)
  names.ts                 real names vs codenames (private vs public build)
src/game/
  player.ts                the first-person controller: every movement rule
  movement.ts              constants converted to metres, once
  input.ts                 pointer lock, raw mouse, keyboard, wheel, the pad
  gamepad.ts               controller mapping, curves, rumble
  aimassist.ts             controller aim assist
  traversal.ts             ziplines and ladders
  range.ts                 the range level: walls, banks, rails, signs, gates
  arena.ts                 the 1v1 warehouse and the 1v1v1 triangle
  warehouse.ts             the roof and beams
  course.ts                the course engine: rooms, gates, splits, ghosts, results TV
  courses/basic.ts         The Run (Basic), seven rooms
  courses/advanced.ts      The Run (Advanced), nine rooms
  duel.ts                  the match: rounds, scores, the circle, remotes, spectate, downs and revives
  bots.ts                  the bot controller and the offline match
  br.ts                    the battle royale map: Outskirts, its places, roads, towers, beacons, pads
  ring.ts                  the ring: six phases, the tick, the next circle
  brmatch.ts               the battle royale match, alone or as a squad, on the Duel
  brplay.ts                the battle royale from your side: E, revives, beacons, pads, pings
  loot.ts                  the floor's loot: the seeded layout, rarities, labels
  modes.ts, modematch.ts   Gun Run, team deathmatch, Crown: the rules and the match
  abilities.ts             JOLT and TRIAGE
  killcam.ts, recap.ts     the killcam's recording and replay; the death recap
  throwables.ts            the frag, the arc star, thermite; what you carry
  kit.ts                   the heals and the armour (shield cores, helmets)
  ammo.ts                  counted ammo and energy stockpiles
  rangetools.ts, trainer.ts  dummy behaviours, shoot-back, the spray wall, the flick drill; the superglide trainer
  tour.ts                  the guided tour
  mannequin.ts             the motion-captured figure (a setting)
  fx.ts                    effects drawn in the world (a JOLT's streak)
  soundscape.ts            footsteps, surfaces, the loops
  stats.ts                 the profile: matches, courses, tech, in localStorage
  leaderboard.ts           the online board client (finds the board through /net.json)
  weapons.ts               typed access to data/weapons.json
  weapon-state.ts          firing, ammo, reload, ADS transition
  loadout.ts               two slots with their own state
  loadouts.ts              the five defaults and five custom loadouts
  attachments.ts           mags, barrels, stocks, lasers
  optics.ts                the ten optics: housings, reticles, zoom, scopes
  recoil.ts                view kick from the reference patterns
  spread.ts                hipfire and ADS cones
  projectile.ts            projectiles: speed, drop, sub-stepped sweeps
  dummy.ts                 the training dummy: zones, shields, knocks
  targets.ts               banks, rails, pop-ups
  viewmodel.ts             the first-person gun, hands and every animation
  arms.ts                  hands and forearms
  gunmodels.ts             the 28 gun models, built in code
  heirlooms.ts             the seven melee weapons
  operators.ts             the five character looks
  hud.ts                   the HUD canvas
  audio.ts                 synthesised sounds
  render.ts                the render pipeline and post-processing
  quality.ts               the three graphics presets
  staticmerge.ts           merges the static level per material
  materials.ts             CC0 PBR materials
  props.ts                 CC0 glTF props
  geo.ts                   geometry helpers, the text panels (signs)
  sky.ts, grade.ts         the sky dome, the colour grade
  sens.ts                  sensitivity and FOV maths
  dpi-calibrate.ts         the DPI measurement
src/net/link.ts            the connection: PeerJS links, the local transport, codes, /net.json
src/ui/menu.ts             tabs, loadout editor, the Stats tab and its online boards
src/ui/binds.ts            the Controls tab: rebinding
src/ui/welcome.ts          the first-visit welcome and the device check
data/weapons.json          the extracted weapon numbers (real names; stripped in the beta)
data/overrides.json        hand corrections to the extract, each with a reason
server/game/               the game's own server: serve.mjs, the pm2 file, setup.sh for the box
server/leaderboard/        the same online boards as a Cloudflare Worker (optional)
tools/                     every check and script (next section)
docs/                      plans, results, fidelity, next steps, the deploy guide
public/tex, public/models  fetched CC0 assets (not in git), with attribution files
```

## Config and data files

| File | Edit it to |
|---|---|
| `src/config/movement.json` | change a movement number. Every group has a `_note` with the source; keep "ours" honest when a value is a choice rather than a documented one. `npm run movesim` will tell you what the change broke. |
| `src/config/player.json` | hull size, eye height, camera feel |
| `src/config/binds.json` | the default keys (KeyboardEvent codes) and mouse buttons; players rebind on the Controls tab |
| `src/config/aimassist.json` | controller aim assist: slowdown, rotational strength, zone size, range |
| `src/config/recoil-tuning.json` | `softImpulseScale`, the one tuned recoil number (docs/TESTING.md has the table) |
| `data/weapons.json` | the extracted numbers; regenerate with `npm run extract` rather than editing |
| `data/overrides.json` | a correction to an extracted number, with the reason |
| `src/config/names.ts` | the codename for each weapon and optic in the public build |
| `src/game/loadouts.ts` | the five default loadouts |
| `src/game/courses/*.ts` | the course rooms (and a room's par, if it should not be its share of the S time); the sim proves the gates |
| `src/config/abilities.json` | JOLT's distance, time and cooldown; TRIAGE's speed; what the bots do with them |
| `src/config/items.json` | the heals (amounts, times, stacks), the kits, shield cores and helmets |
| `src/config/ammo.json`, `weapon-mechanics.json` | ammo types and stacks, energy stockpiles; wind-ups, charges, heat, chokes, draws, hop-ups, fire modes |
| `src/config/loot.json`, `squad.json` | the battle royale's loot tables; downs, revives, banners, beacons, pads, pings |
| `src/config/modes.json` | Gun Run's lists and rules, team deathmatch's score and size, Crown's times, the arena's spawns |
| `src/config/throwables.json` | the frag, the arc star, thermite |
| `src/config/killcam.json`, `audio.json`, `rangetools.json` | the killcam's timing; the gun classes and the sound's distances; the range's tools |

## Scripts and checks

| Command | What it does |
|---|---|
| `npm run dev` | the dev server at http://localhost:5173 |
| `npm run build` | typecheck and bundle the private build into `dist/` |
| `npm run build:beta` | typecheck, the public build (codenames), then `tools/beta-check.ts` |
| `npm run preview` | serve `dist/` locally |
| `npm run check` | typecheck only |
| `npm run assets` | fetch the CC0 textures into `public/tex` |
| `npm run models` | fetch the CC0 props into `public/models` |
| `npm run extract` | rebuild `data/weapons.json` from the reference sheet (read-only, outside the repo) |
| `npm run compare-sources` | compare two reference trees on the numbers we use |
| `npm run verify` | 450+ checks: weapon data, damage, recoil, sensitivity maths, and the whole movement simulation (every movement rule against its source number). Must print VERIFY PASS. |
| `npm run movesim` | the movement simulation alone: wiki timings, the wallbounce recipe, crouch kick, wallskip, every course gate, teleports |
| `npm run e2e` | real browser pages (puppeteer): load, the first visit, the course and its medals, menus, loadouts and rebinding, third person, a full 1v1 over the local transport and over the internet, invite links, a 1v1v1 over three tabs, a bot match with the killcam and the recap, the controller, the range's tools, the settings and the tour, throwables, the battle royale alone, with loot and as a squad (downs, revives, banners, pings), Gun Run, team deathmatch and Crown alone and Gun Run with a friend. Needs `npm run dev`. Must print E2E PASS. `E2E_ONLY=page,br,...` runs only those sections (the file lists them); the whole run takes about twelve minutes. |
| `npm run snap` | screenshots of named scenarios drawn for real (the HUD, the killcam, the figures, the loot, the modes) into `shots/`; `SNAP=name,name` for some |
| `npm run slide-probe` | the slide and slide jump frame by frame in the simulation, as a page of curves beside the wiki's numbers |
| `npx tsx tools/trim-glb.ts` | cut a .glb down to the animations named (how the mannequin's files were made) |
| `npm run probe` | a scripted wallbounce at the practice wall in the real page, printing what the feed registered (needs `npm run dev`) |
| `npm run measure` | what each technique reaches on the real controller (needs `npm run dev`) |
| `npm run bench` | frame rate per graphics preset on your GPU (needs `npm run dev`) |
| `npm run shot` | screenshots of every view into `shots/` (needs `npm run dev`) |
| `npm run rules` | nothing in the repo references the game's install or its files |
| `npm run deploy` | `build:beta`, then publish `dist/` as the `gh-pages` branch (GitHub Pages) |
| `npm run deploy:server` | `build:beta`, ship it to the game's own server, reload, check, and play a 1v1 there (`-- dry` does it all on this PC, `-- setup`, `-- health`, `-- logs`, `-- rollback`; `docs/SERVER_GUIDE.md`) |
| `npm run server` | run the game's server here on :4100 (after `build:beta`) |
| `npm run live` | opens the deployed site in two browser pages and plays a 1v1 over the real broker (`LIVE_URL`, and `BROKER=own` on our server). Must print LIVE CHECK PASS. |

Before a push: `npm run verify`, `npm run e2e` (with `npm run dev` running in
another terminal), `npm run rules`, `npm run build:beta`. Do not edit `src/`
while the e2e runs; the dev server's reload kills the pages it is driving.

## Deploy

Two places, the same build:

**The game's own server** (`docs/SERVER_GUIDE.md`): an Oracle Always Free
VM like Algonomics', with pm2, Caddy and a DuckDNS name, running
`server/game/serve.mjs`: the site, our own broker, a TURN relay and the
online boards. `npm run deploy:server` ships it and plays a 1v1 on it.

**GitHub Pages**: https://incomeimprovement99-netizen.github.io/FPSfun/ ,
served from the `gh-pages` branch of this repo, which only ever holds the
built `dist/`. It uses the public broker and has no relay or boards.
`docs/DEPLOY_GUIDE.md` has the step by step; the short form:

```
git push             # the source, to main
npm run deploy       # the site: build:beta, then force-push dist/ to gh-pages
npm run live         # optional: prove it with a real 1v1 on the live URL
```

Pages picks the new commit up within a minute; players need a reload (the
file names carry a hash, so a plain reload is enough).

`dist/` is a static site and would work on Netlify, Cloudflare Pages or any
web host. It must be served over HTTPS (browsers only allow peer connections
and raw mouse input on secure pages). Paths are relative, so it works from a
sub-folder. Run `npm run assets` and `npm run models` before building, or the
textures and props will be missing. The repository is public (GitHub Pages
on a free account needs that); the reference data with the real names is in
it, so `DEPLOY_GUIDE.md` section 7 has the split-repo setup if that should
change.

`dist/` is about 46 MB: 1.8 MB of code (490 KB compressed), about 10 MB of
textures, 29 MB of props and 4.4 MB for the mannequin (loaded only when
Settings asks for it). The range is playable before the props finish
loading; compressing their textures (KTX2) would cut most of it.

## What it can't do, and the limits

**Frame rate is capped by your screen, not the game.** A browser draws only
when the display can show a frame, so a 60 Hz monitor means 60 fps. The game
itself runs at 800+ fps on the Competitive preset on the owner's RX 9070 XT.
Settings has a step-by-step guide to raise the cap (monitor refresh rate,
Chrome settings, and a Chrome shortcut with `--disable-frame-rate-limit
--disable-gpu-vsync`). There is no way for a web page to do this itself.

**Input** goes through the browser's pointer lock with raw (unaccelerated)
mouse movement, read on every mouse report. Add about a frame of compositor
latency that a native game does not have. Safari does not support raw mouse
movement.

**Ctrl + W.** Browsers keep Ctrl+W (close tab), Ctrl+T and Ctrl+N for
themselves, so crouching on Ctrl and pressing W would close the tab. Playing
goes fullscreen with Keyboard Lock by default (Settings, "Fullscreen while
playing"), which hands those keys to the game in Chrome and Edge. Windowed, or
in Firefox or Safari, the browser asks "Leave site?" instead of closing; C is
also bound to crouch.

**Collision is boxes.** Every wall, floor and step is an axis-aligned box; slopes
are stepped. That covers everything built so far, but curved or angled level
geometry would need a real physics engine.

**Characters.** The default figures are jointed robots posed in code; the
motion-captured mannequin (a setting) uses a free library's clips, which are
pistol clips: every gun is held the way its aim pose holds a pistol, and a
jog's forward lean carries into the aim. No fingers on the gun, no faces.

**Two or three players, peer to peer.**
- The browsers connect directly (WebRTC). On the game's own server our own
  broker introduces them and a TURN relay carries the match when a strict
  network (some offices, schools, mobile carriers) blocks the direct path.
  On GitHub Pages the free public broker does the introducing (no uptime
  promise) and only PeerJS's shared public relay is there.
- The shooter decides hits. It feels right on your screen and is fine between
  friends; it is trivially cheatable. There is no anti-cheat, no accounts, no
  matchmaking, no voice.
- With three, the host relays between the guests, so the host's connection
  carries the match. Closing or reloading a tab ends the match for a 1v1; in
  a 1v1v1 a guest leaving drops it to a 1v1, the host leaving ends it. 10 s of
  silence from someone counts as leaving. Anyone past the player count is
  turned away.
- More than three players, or trusted results, needs a server that runs the
  game (see below and `docs/NEXT_STEPS.md`). The battle royale is a squad of
  up to three humans against bots for the same reason: the host's browser
  runs the bots and the ring, and a full lobby of humans would need the
  server.
- **The battle royale is a squad against bots.** A lobby of other squads
  needs the authoritative server. The loot tables are ours (Apex's are not
  published); the deathbox respawn of Season 29 is not in (beacons are).

**Saves are per browser.** Settings, loadouts, the profile, best times and
ghosts are in localStorage: another browser or device starts fresh. Clearing
site data clears them.

**Sound is synthesised**, not recorded: every gun, step and cue is made in
the browser, which keeps it small and ours but short of a recorded mix. A
player who only ever presses Start on a controller gets none at all
(browsers start audio only after a click or a key).

## When it would need to leave the browser

Most of what this is (a practice range, a course, a 1v1 with a friend) is fine
in a browser, and stays easy to share: a link. The reasons to move, in the
order you would hit them:

1. **Reliable 1v1 on any network**: stay in the browser; our own broker and
   a TURN relay, which `server/game/` now is (free, on an Oracle VM).
2. **Uncapped frame rate without flags, for everyone**: wrap the same code in a
   desktop app (Electron or Tauri) with the frame limit off. The game code does
   not change; you ship an installer instead of a link.
3. **More than two players, or results you can trust (leaderboards, ranked)**:
   an authoritative game server (Node with Colyseus, or similar) that runs the
   movement and hit checks. The client can stay in the browser. This is the
   first big step: weeks, plus hosting.
4. **Anti-cheat, big maps, many players, animated characters, high-end
   graphics or serious VR**: a native engine (Unity, Unreal, Godot). The data
   (weapons, movement constants) carries over; the code does not.

VR of the range itself is possible in the browser (WebXR, Quest browser); the
guns are built with their grips at the hand for that.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing works on a phone or tablet | it is a PC game (keyboard and mouse, or a controller); the menu says so on a phone. Open the link on a PC in Chrome or Edge. |
| Clicking Play does nothing | the menu now says why: Chrome waits about a second after Esc before it locks the mouse again; click again. A DPI measurement in progress also holds the lock. |
| "Could not reach the matchmaking server" | on GitHub Pages: the public PeerJS broker is down or rate-limited; try again in a minute, or use the game's own server. On our server: the server is down (`npm run deploy:server -- health`). |
| "No match with that code" | a typo (codes never contain 0, O, 1, I or L) or the host closed the tab. Make a new match. |
| "Found the match but could not connect to the host" (after 20 s) | one of you is on a network that blocks direct peer connections (offices, schools, university halls, phone hotspots, VPNs) and no relay got through. On our server, check the relay (SERVER_GUIDE section 8). Try home wifi, or with the VPN off. |
| "WAITING FOR EVERYONE TO CLICK PLAY" | someone is still on the menu; every player clicks Play (or presses Start) before round 1. |
| The other player freezes | their tab was hidden or throttled. Alt-tabbing is fine (frames keep running on a timer); a minimised Chrome for minutes is not. |
| Ctrl+W closed the tab | Settings, "Fullscreen while playing" is on by default and stops that in Chrome and Edge; windowed, the browser asks first. Or crouch on C. |
| The aim feels off | Settings: measure your DPI, then check the cm/360 against what you know. Use Chrome or Edge (Firefox cannot turn mouse acceleration off). |
| Low frame rate | Settings, Graphics: Competitive. The frame cap is the monitor's refresh rate; the guide under "Getting past" raises it. |
| No textures or props locally | `npm run assets` and `npm run models` were not run (they are not in git). |
| Controller does nothing | press a button so the browser exposes it, then Start. Only standard-mapping pads (Xbox, PlayStation, most others) map by default. |
| Course timer will not start | cross the start line going forward (the course button puts you facing it); stepping back over it or off the course resets the run. F resets the course and the dummies. |

## Docs

| Doc | What it is |
|---|---|
| `docs/SERVER_GUIDE.md` | the game on its own server like Algonomics: a DuckDNS name, the Oracle firewall rules, one-time setup, `npm run deploy:server`, day to day, troubleshooting |
| `docs/DEPLOY_GUIDE.md` | the GitHub Pages link: publish, play, update, troubleshoot, the split-repo option |
| `docs/DEVELOPMENT_ROADMAP.md` | a milestone for every feature shipped, newest last, with what it does and how it was tested |
| `docs/PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`, `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md` | phase 11's plan and its results (the docs pattern from here on: a plan and a results document per phase) |
| `docs/RESEARCH_PHASE_11.md` | Season 30's numbers with their sources: heals, helmets, shield cores, downs and revives, throwables, the new guns, ammo, the charge weapons, Gun Run and TDM, Crown |
| `docs/NEXT_STEPS.md` | what you asked for and where it stands, and the next implementations ranked |
| `docs/GAP_ANALYSIS.md` | what Apex (Season 30) and the other big shooters have against what we have, per area, with effort and value, and the ranked next steps that come out of it |
| `docs/FIDELITY.md` | the source and confidence of every number in the game |
| `docs/MOVEMENT_AUDIT.md` | the movement rules audited line by line against the wiki |
| `docs/TESTING.md` | the first playtest guide: DPI, sensitivity, recoil, time to kill |
| `docs/PLAN_*.md`, `docs/RESULTS_*.md` | a plan and a results document for every batch of work (what was asked, what shipped, what was found wrong on the way): the look pass, the HUD and course, wall tech and ghosts, ziplines and sights, the 1v1 beta, bots and triples and stats, feel and controller, the polish and ship, the server and the full bug hunt, the battle royale round |
| `PROJECT_RULES.md` | the rules below, in full |
| `public/tex/ATTRIBUTION.md`, `public/models/heirlooms/ATTRIBUTION.md`, `public/models/mannequin/ATTRIBUTION.md` | where every asset came from and its licence |

## Rules of the project

`PROJECT_RULES.md`, enforced by scripts where a script can:

1. **Separation from the game.** No file in this repo reads, writes or
   references the game's install, the EA App, Steam or their paths; no
   overlays, hooks or process interaction of any kind. The product runs in
   a browser tab. `npm run rules` scans every file and fails on a reference.
2. **The legal line.** Mechanics and their numbers are facts and are
   replicated on purpose; the game's own art, audio, script code, fonts,
   icons, map geometry, UI files and branding are never copied. Every asset
   is CC0 or made here, with attribution files. Real weapon and optic names
   only in the private build: the public build uses codenames, and
   `tools/beta-check.ts` fails `npm run build:beta` if a real name is in
   `dist/`.
3. **Engineering.** Every gameplay constant comes from `data/weapons.json`
   or `src/config/*.json`, never a literal in game code, so a patch-note
   change is a data edit; every substitute number is documented in
   `docs/FIDELITY.md` with its source, and marked "ours" where it was a
   choice.

## Credits

Textures and props: ambientCG and Poly Haven (CC0). Heirloom models: Katana by
CreativeTrio and Dagger by Quaternius, via Poly Pizza (CC0). The mannequin and
its motion-captured clips: Quaternius's Universal Animation Library 1 and 2
(CC0). Font: Rajdhani
(Google Fonts, OFL). Movement research: the Apex Movement Wiki community. Game
data numbers are facts; no art, audio, code or branding from the game is used.
