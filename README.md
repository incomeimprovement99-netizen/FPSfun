# B00G Range (beta)

A browser firing range that reproduces the feel of Apex Legends' movement and
guns from published numbers, with a timed movement course and 1v1 against a
friend by code. Own code, own art, nothing from the game's files. It runs in a
browser tab and has no connection of any kind to the Apex install, the EA App,
Steam or Easy Anti-Cheat.

## Run it

```
npm install
npm run assets     # CC0 textures (ambientCG, Poly Haven), not kept in git
npm run models     # CC0 props (Poly Haven), not kept in git
npm run dev        # http://localhost:5173
```

Chrome or Edge on a desktop is the target. Click a mode on the menu to play;
Esc brings the menu back. A controller works too: plug one in and press
Start (Settings has the sensitivity, curve, deadzone and auto sprint).

## Modes

| Mode | What it is |
|---|---|
| Firing Range | 28 weapons, dummies with armour tiers, target banks and moving rails, ladders, a vertical zipline, the wallbounce practice wall, mantle ledges, a slide ramp. |
| The Run (Basic) | Timed movement course in the range's back-left corner: seven rooms, each built round one technique (breach, vent slide, climb, superglide, gap lurch, zipline, final sprint), 20 armed pop-ups. Splits per room against your best, a ghost of your best run, a results TV at the start, ranks S/A/B/C. |
| The Run (Advanced) | The back-right corner: nine rooms, 200 m, 30 pop-ups, the techniques chained. Every gate needs its move: a 7 m gap only a superglide clears, pads only a lurch reaches, a platform only a zipline superjump gets on, two vents, a bounce slalom, a drop slide, a shooting zip, a flow room. Its own bests, splits, ghost and TV. |
| 1v1 and 1v1v1 | One player makes a match (2 or 3 players) and gets a 5-letter code; the others type it. 1v1: a three-lane warehouse arena. 1v1v1: a triangle, a corner each, spokes between the corners. First to 3 rounds, blue shields and 100 health. 20 s into a round a circle lights up in the middle; stand in it alone for 10 s to take the round. The last one standing takes it any time. |
| Arena, Bots | The 1v1 rules against one or two bots, offline, on Easy, Normal or Hard (their speed, reaction time and aim). They hunt you, strafe, go for the circle, and go down like anyone. |
| Arena, alone | The 1v1 map with nobody else, to learn it. |

The **Stats** tab keeps your name and every result in this browser: matches
(won, lost, K/D, rounds, damage, accuracy, win streak) per mode and per bot
difficulty, best time and top ten runs per course, and every piece of tech
landed or called out as a miss.

## Controls

| Key | Action | Key | Action |
|---|---|---|---|
| W A S D | move | Shift | sprint (toggle by default; hold in Settings) |
| Space, scroll up | jump (scroll makes superjumps easy) | Ctrl, C | crouch, slide (see Ctrl + W below) |
| Scroll down | forward, for tap-strafing | E | ride a zipline |
| Left mouse | fire | Right mouse | aim down sights |
| R | reload | V | melee (heirloom or fist) |
| 1, 2 | weapon slot | Q, Mouse 5 | swap weapon |
| 3 | holster (move 15% faster) | G | magazine level |
| O | cycle optic | Z | variable optic zoom |
| B, N, H | barrel, stock, laser | T | dummy armour |
| F | reset dummies and the course | K | ghost of your best run |
| P | copy your course result | Esc | menu |

Binds live in `src/config/binds.json`.

## What is in it

**Movement**, every number from the engine constants or the Apex Movement
Wiki (apexmovement.tech), with anything we had to choose marked "ours" in
`src/config/movement.json`:
ground speed bands and counter-strafing, toggle sprint with its 3 s buffer,
holster speed, jump and jump fatigue, coyote time, bunny-hop penalty, slide
boost with its cooldown and deadslides, slide on slopes, air strafing, lurch
and tap-strafing, climbing with the climb space and attach offset, climb zones
(wallbounce, wall push, mini-bounce), mantles, superglides, fall stun,
ziplines (look direction, speed caps, zip jump, zip crouch, 45 degree rule,
three mid-air grabs, re-use cooldown, climb reset) and the zipline superjump.
A tech feed names what the game registered as you do it, and says why a miss
missed: "NO WALL: look at it (62 deg off)", "SUPERGLIDE MISS: crouch 3 frames
after jump (needs exactly 1)". The game's sprint view shake is in, with its
Normal / Minimal setting.

**Guns**: 28 weapons from extracted reference numbers (damage, fire rate,
magazines, reload, spread, recoil patterns, projectile speed and drop), mag
levels, barrels, stocks, lasers, and ten optics with their own housings,
reticles, eye relief, variable zoom and full-screen scopes for 3x and up. A
weapon whose own sight is a scope (the Kraber's 4x-8x) wears it by default.

**Your character**: five operator looks, seven heirlooms (four built in code,
two free CC0 models), gloved hands in your operator's colours, and
loadouts: five defaults and five custom slots, the last one used remembered.

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

**Characters are rigid.** The robot figures have no skeleton or animation
beyond knocks and pop-ups; the other player in a 1v1 slides, turns and crouches
but does not run or climb visibly.

**Two or three players, peer to peer.**
- The browsers connect directly (WebRTC). The PeerJS public broker
  introduces them; it is free, has no uptime promise, and could be rate-limited
  or go away. Running our own broker (`peerjs-server`, one small Node process)
  removes that risk.
- No TURN relay is configured, so some strict networks (some offices, schools,
  mobile carriers) cannot connect. Adding a TURN server fixes that.
- The shooter decides hits. It feels right on your screen and is fine between
  friends; it is trivially cheatable. There is no anti-cheat, no accounts, no
  matchmaking, no voice.
- With three, the host relays between the guests, so the host's connection
  carries the match. Closing or reloading a tab ends the match for a 1v1; in
  a 1v1v1 a guest leaving drops it to a 1v1, the host leaving ends it. 10 s of
  silence from someone counts as leaving. Anyone past the player count is
  turned away.
- More than three players, or trusted results, needs a server that runs the
  game (see below and `docs/NEXT_STEPS.md`).

**Saves are per browser.** Settings, loadouts, the profile, best times and
ghosts are in localStorage: another browser or device starts fresh.

**Leaderboards are local until the server is up.** The Stats tab's boards are
yours alone. `server/leaderboard/` is a Cloudflare Worker (free tier) that
holds shared boards; deploy it with your Cloudflare account, build the game
with `VITE_LEADERBOARD_URL` and `VITE_LEADERBOARD_SECRET`, and every run and
win is posted under the player's name. It trusts the game, so it is a board
for friends, not a ranked ladder.

**Names.** Real weapon and optic names show only in the private build.
`npm run build:beta`, the public build, uses codenames and strips the real
names out of the shipped data, and `tools/beta-check.ts` fails the build if one
slips through (PROJECT_RULES.md section 2).

## When it would need to leave the browser

Most of what this is (a practice range, a course, a 1v1 with a friend) is fine
in a browser, and stays easy to share: a link. The reasons to move, in the
order you would hit them:

1. **Reliable 1v1 on any network**: stay in the browser; add a TURN server and
   our own broker. A day of work, a few dollars a month.
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

## Deploy

```
npm run build:beta   # public build into dist/, then the real-name check
```

`dist/` is a static site: GitHub Pages, Netlify, Cloudflare Pages or any web
host. It must be served over HTTPS (browsers only allow peer connections and
raw mouse input on secure pages). Paths are relative, so it works from a
sub-folder. Run `npm run assets` and `npm run models` before building, or the
textures and props will be missing from `dist/`. Keep the repository itself
private: it contains the reference data with the real names.

`dist/` is about 42 MB: 1.4 MB of code (350 KB compressed), about 10 MB of
textures and 29 MB of props. The range is playable before the props finish
loading; compressing their textures (KTX2) would cut most of it.

## Checks

| Command | What it checks |
|---|---|
| `npm run verify` | 450+ checks: weapon data, damage, recoil, sensitivity maths, and the movement simulation (every movement rule against its source number) |
| `npm run movesim` | the movement simulation alone |
| `npm run e2e` | real browser pages: load, the course, menus and loadouts, a full 1v1 over both the local and the internet connection, a 1v1v1 over three tabs, a bot match, round scoring and the circle (needs `npm run dev`) |
| `npm run probe` | a scripted wallbounce at the practice wall in the real page, printing what the feed registered (needs `npm run dev`) |
| `npm run measure` | what each technique reaches on the real controller (jump and superglide distances, superjump height), the numbers the advanced course is built from |
| `npm run bench` | frame rate per graphics preset on your GPU (needs `npm run dev`) |
| `npm run shot` | screenshots of every view into `shots/` (needs `npm run dev`) |
| `npm run rules` | nothing references the game's install or its files |
| `npm run build`, `npm run build:beta` | typecheck and bundle, private and public |

## Docs

`docs/` has a plan and a results document for every batch of work (what was
asked, what shipped, what was found wrong on the way), plus `FIDELITY.md`
(sources for every number), `MOVEMENT_AUDIT.md`, `TESTING.md` and
`NEXT_STEPS.md` (what to build next, ranked, and what each needs). Latest:
`PLAN_FEEL_CONTROLLER.md` and `RESULTS_FEEL_CONTROLLER.md`.

## Credits

Textures and props: ambientCG and Poly Haven (CC0). Heirloom models: Katana by
CreativeTrio and Dagger by Quaternius, via Poly Pizza (CC0). Font: Rajdhani
(Google Fonts, OFL). Movement research: the Apex Movement Wiki community. Game
data numbers are facts; no art, audio, code or branding from the game is used.
