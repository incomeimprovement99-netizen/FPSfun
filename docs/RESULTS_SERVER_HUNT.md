# Results: our own server, the full bug hunt, and the next steps

The ask: "do we have to have that as the URL? my friend wasn't able to do
anything by just visiting the website. Can't we deploy on a server like
Algonomics is?", and "finish the bug hunt and the next steps".

## 1. Why the friend got nothing, and the server

The GitHub Pages site was up and healthy: a first visit in a clean browser
loaded the menu with no errors and no failed requests. So the page was not
broken; it gave a newcomer nothing to go on. The likeliest story is a link
sent by text and opened on a phone, where this game cannot run and nothing
said so. The other two: a Safari or Firefox browser, or the repo link
instead of the game link. Section 3 fixes all three on the page itself.

The server is `server/game/serve.mjs`, set up the way Algonomics is (Oracle
Always Free VM, pm2, Caddy, DuckDNS). One Node process:

- serves the public build;
- runs **our own PeerJS broker** at `/peerjs`, so codes never depend on the
  public one;
- answers `/net.json` with the broker's path and **TURN credentials** (coturn,
  shared-secret auth, 12 h expiry), so friends on networks that block direct
  connections still meet (NEXT_STEPS 7);
- keeps the **online boards** at `/api/board` in a JSON file that survives
  deploys (course times and wins, one entry per name, the best kept, a
  per-address rate limit);
- answers `/health`.

The game reads `/net.json` when a match is made or joined, and falls back to
the public broker when there is none, so the same build still works on
GitHub Pages.

Tooling: `npm run deploy:server` (build, ship over ssh, swap, pm2 reload,
`/health`, then a 1v1 on the live URL through its own broker), `-- setup`
(`server/game/setup.sh`: coturn with no relaying into the box or private
networks, the box's firewall, one validated Caddy block with a backup),
`-- health`, `-- logs`, `-- rollback`, and `-- dry`: the whole release
unpacked and run on this PC, with the board rules checked and a 1v1 played
through it. `docs/SERVER_GUIDE.md` is the step-by-step.

**Not done: nothing is on a server yet.** Reaching the Algonomics box needs
your go-ahead: it runs a live trader, and the choice between it and a
separate free VM is yours (guide section 1). You also need a DuckDNS name and
three Oracle firewall rules (guide sections 2 and 3).

## 2. The bug hunt: 31 findings, all fixed

Four read-only audits of everything the last round did not cover: movement,
weapons and targets, course/menu/stats/boards, and render plus connection
lifecycle. Two findings came up twice (the name injection, lost taps); each
is listed once here.

| # | Sev | Where | What was wrong | Fix |
|---|-----|-------|----------------|-----|
| 1 | HIGH | `duel.ts`, `main.ts` | A guest's name from the network went into `innerHTML` when they left: a modified client could run script in the host's page. | Names are cleaned where they arrive (text only, 16 characters); status lines built from them are set as text. Malformed state, shot, hit and down packets (a NaN position or damage) are dropped whole. |
| 2 | HIGH | `link.ts` | A guest could sit on "Joining..." for ever: PeerJS sends no close for a connection that never opened (ICE failure), and a full host closed the connection before it opened, which the guest never heard. | A 20 s join timeout with a message that says what to try, an error handler on the connection, and a full host now lets the connection open and then turns it away, so the guest hears "the match is full". |
| 3 | HIGH | `weapon-state.ts` | A fresh pull within one interval of a stale schedule fired early: Wingman shots 83 ms apart (interval 357), Kraber 0.2 s (rechamber 2.4 s). | A new pull always schedules from now. |
| 4 | HIGH | `weapon-state.ts`, `main.ts` | The mag and every attachment key filled the magazine and ended a reload: an instant reload in matches and on timed course runs. A loadout picked mid-fight came up full with no deploy time. | Attachments keep the rounds in the gun and the reload running. A loadout picked mid-fight waits for the next round. |
| 5 | HIGH | `worker.ts` | The Worker answered the browser's preflight with a 204 that had a body, which throws: no score could ever reach the online board. | A bodiless 204 with the CORS headers. |
| 6 | MED | `player.ts` | In the air the step allowance let the body into the top 0.56 m of any box: a jump at a 1.1 m wall went into it and out the far side. | In the air the body goes up onto such a top when there is room (keeping the jump's apex: the lift is paid for out of the rise to come), and back out the way it came when there is not. The FLOW room's slide-jump walls and the stepped ramps still work. |
| 7 | MED | `duel.ts`, `link.ts` | A 1v1v1 guest who left before round 1 deadlocked the match: the host waited for 2 guests and turned every arrival away as full. | Their place opens again (the same code works), and the roster line updates. |
| 8 | MED | `course.ts`, `main.ts` | The run's clock kept going behind the Esc menu, and the ghost kept recording with no limit. | The menu stops the clock, the ghost, the recording and the return to the start; a run left going for 10 minutes is abandoned. |
| 9 | MED | `targets.ts`, `projectile.ts` | A folded flipper still took hits and counted damage (its "live" test used the browser's clock against the game's). | Tested on the game clock. |
| 10 | MED | `input.ts` | A click or key tap that went down and up between two frames was lost: no shot, no lurch direction. Common in a hitch. | A press this frame counts as held for this frame, as the wheel already did. |
| 11 | MED | `main.ts` | After a GPU reset the static shadow map came back empty (the whole range in shadow) and the environment map black. | Both are redrawn on `webglcontextrestored`; a notice on loss. |
| 12 | MED | `worker.ts` | Any lowercase board name made a new KV key; a result that did not make a full board still cost a write. | The seven real boards only; no write for a result that does not place. |
| 13 | MED-LOW | `link.ts` | A host waiting for its third player never re-registered after a broker blip, so the code stopped working while it was still shown. | It reconnects while a place is open. |
| 14 | LOW-MED | `main.ts`, `weapon-state.ts` | A burst kept firing after you were knocked or the round was decided. | The burst stops. |
| 15 | LOW-MED | `player.ts` | A climb under a ceiling never let go at 144 fps or below (the 1 s rule read the speed before the ceiling zeroed it). | Checked after collision. |
| 16 | LOW | `player.ts` | `teleport()` kept the slide boost's cooldown, a superglide's jump frame and a zip exit time (a hazard respawn read as a deadslide). | Reset. |
| 17 | LOW | `weapon-state.ts` | A weapon change kept the old gun's cooldown (a lent pistol waited out a Kraber's 2.4 s). | Reset on a weapon change. |
| 18 | LOW | `loadout.ts` | Swapping back to the gun in hand was an instant cancel: you could fire at once. | The gun has to come back up. |
| 19 | LOW | `dummy.ts`, `projectile.ts` | A head hit past headshot range did body damage but still showed as a headshot and counted one. | Not a headshot. |
| 20 | LOW | `main.ts` | Editing a loadout mid-run stripped the attachments off the guns you get back. | Only a slot whose gun changed is replaced. |
| 21 | LOW | `render.ts` | After any resize, AO and bloom ran at a quarter of the pixels on a 2x screen. | The composer sizes every pass; the extra resize is gone. |
| 22 | LOW | `main.ts` | No WebGL 2 meant a dead page: the menu showed and no button worked. | A message that says what to do. |
| 23 | LOW | `main.ts` | The pixel ratio was set once: a move to another screen or a zoom left the view blurry. | Updated on resize. |
| 24 | LOW | `input.ts`, `main.ts` | A refused pointer lock (too soon after Esc, or not allowed) did nothing and said nothing. | A line on the menu. |
| 25 | LOW | `index.html` | A first visit showed "Resume". | "Play" until the first time in. |
| 26 | LOW | `course.ts` | The result card and its P/K keys followed you to other modes. | Cleared when you leave the course's mode. |
| 27 | LOW | `stats.ts` | Names with other characters were taken but refused by the board on every post. | Names keep the board's characters; the field shows what was kept. |
| 28 | LOW | `stats.ts` | One bad course entry in storage threw, and the fresh profile it fell back to was saved over the real one. | The bad entry is skipped. |
| 29 | LOW | `main.ts` | Controller deadzone 0 read as "empty" and became 12. | 0 is kept. |
| 30 | LOW | `main.ts` | Settings typed in the session skipped the ranges the loader applies (sens -1 inverted the mouse, then reset on reload). | The same ranges. |
| 31 | LOW | `worker.ts` | A JSON `null` body crashed the Worker. | A 400. |

Also: the frame loop is guarded, so one bad frame can no longer freeze the
game; the error is still rethrown outside the loop for the console and the
tests.

## 3. Next steps done this round

- **A first-visit welcome** on the Play tab: what to click, the keys that
  matter, how to play a friend. Above every tab, on every visit, a
  **device check**: a phone or tablet is told this is a PC game (and to send
  itself the link), Safari to use Chrome or Edge, Firefox that it lacks raw
  mouse input.
- **Invite links** (from NEXT_STEPS 8): Create match copies
  `.../?join=CODE`, and opening it joins the match. The code comes off the
  address at once, so a reload does not try to rejoin.
- **Aim assist for the controller** (NEXT_STEPS 1, `src/game/aimassist.ts`,
  numbers in `src/config/aimassist.json`): slowdown on a target (0.8 hip,
  0.6 ADS), and rotational: while you move, the view follows 40% of the
  target's movement across the screen (the PC value). A sphere round the
  chest, so it shrinks with distance; line of sight required; never with no
  input; never on the mouse. On by default, a setting to turn it off.
- **Key rebinding** (NEXT_STEPS 11): the Controls tab is a table of every
  action; click a key and press the new one (a key, a mouse button, a
  scroll). A key another action had moves over, and the tab says so. Stored
  in the browser on top of `binds.json`; reset to defaults.
- **Online boards** (part of NEXT_STEPS 8): on the server, a Stats-tab card
  with the top 15 of each board, you highlighted; after a run or a win the
  HUD says your place.
- **Our own broker and TURN relay** (NEXT_STEPS 7): section 1.

## 4. Verified

- `npx tsc --noEmit` clean; the Worker typechecks on its own.
- MOVESIM PASS (every course gate both ways, with the air lift in).
- VERIFY PASS, with new checks: the fire-rate floor for Wingman and Kraber,
  the cooldown on a weapon change, the swap-cancel raise, attachments not
  refilling, and nine aim assist checks.
- E2E PASS, with new checks: the menu stops a run's clock, the first-visit
  welcome and device warnings, invite links join from the address alone,
  rebinding (move-over, the note, storage, reset).
- `rules ok`; `build:beta` and BETA CHECK PASS.
- `npm run deploy:server -- dry`: DRY RUN PASS. The release installs and
  starts, the board rules hold (ordering, one entry per name, bad board, markup
  names, a 2 s time, a null body, the rate limit), the Stats tab finds the
  board, and a 1v1 is played through the server's own broker.

## 5. Still open

- **Going live on a server**: your call, section 1 and `docs/SERVER_GUIDE.md`.
- **The GitHub Pages site still has the old build** (no welcome, no invite
  links, none of these fixes) until `npm run deploy` is run again.
- TURN between two players who *both* need the relay goes out and back in
  through Oracle's NAT; that should work, but it is untested until the
  server is live.
- The boards take whatever a browser posts; ranked boards need the
  authoritative game server (NEXT_STEPS 9 and 10).
- A pad-only player (Start, never a click or key) gets no sound: browsers
  only start audio after a click or a key.
- From NEXT_STEPS: the slide feel probe, rigged third-person figures, sound,
  the Crown mode, accounts, the game server, the tech trainer, course
  medals.
