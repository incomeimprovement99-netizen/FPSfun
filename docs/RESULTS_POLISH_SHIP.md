# Results: the polish round, the last bug hunt, and the ship

No plan doc this round: the ask was "polish, more animations, the signs, one
last bug hunt, then the exact deploy steps", and each item was small enough
to do straight from the message. This records what shipped, what the bug
hunt found (fourteen findings, all fixed), what was verified, and what is
still open.

## 1. The signs ("tv screens not big enough")

`textPanel` in `src/game/geo.ts` laid the text out at a fixed body size and
let the bottom lines run off the canvas, which is what you saw on the
wallbounce sign and the course rules sign. It now lays the body out at 30 and
steps down (to 18 at the smallest) until the whole text fits above the
bottom margin, then paints. Checked by screenshot of both signs; the shot
tool's `adv-gate` view has the rules sign in frame.

## 2. Animations

The view model (`src/game/viewmodel.ts`) reads more of the player now:
`sliding`, `climbing`, `mantling`, `clipEmpty` and `vy` come through
`VMFrame`.

- **Slide**: the gun drops and cants, the support hand comes off toward the
  ground; blends in over the slide and settles out with the spring.
- **Climb and mantle**: the gun swings down and aside, the support hand goes
  to the wall (the fists are the old open-hand pose with the fingers
  curled: `Hand(mirrored, fist)` in `arms.ts`).
- **Jump and fall**: a lift on leaving the ground (`settleVel += 1.6` when
  vy > 1), a float while falling, and the landing dip that was already there.
- **Chamber check** on a reload from an empty magazine: a 0.36 s look at the
  chamber after the magazine goes in. Pistols lock the slide back on empty
  and it rides forward on the reload.
- **Holster / unholster**: the gun turns away and drops as it goes, the
  swap dip is folded into the same turn.
- Idle drift on top of the breathing sway; sprint pump 1.6.

## 3. The bug hunt: fourteen findings, all fixed

A read-only audit of the match, network, controller and bot code. Ranked.

| # | Sev | Where | What was wrong | Fix |
|---|-----|-------|----------------|-----|
| 1 | HIGH | `duel.ts` respawn | A new round never reset the other players' figures. The guest sees the host's `round` before the host's next state packet, so the alive transition was missed and a knocked figure lay on the floor, unhittable, for the rest of the match. | `respawn()` resets every remote: alive, health, shield, `avatar.reset()`. |
| 2 | HIGH | `duel.ts` guestLeft | A guest dropped for silence was not closed; a late message from it rebuilt a Remote with no link, and the next `r.link.send` threw inside the frame loop, which killed the game. | `guestLeft` closes the link, nulls its handlers, and is idempotent; the host ignores messages from ids it holds no link for. |
| 3 | MED-HIGH | `input.ts` | The pad drove the player while the menu was open (`held`/`pressedNow` read the pad whether or not the game was playing). | The pad branch is gated on `playing`. |
| 4 | MED | `input.ts` | `padPlaying` was never cleared on pointer-lock loss, so Esc off a mouse session left the pad live behind the menu. | Cleared in the pointerlockchange handler. |
| 5 | MED | `duel.ts` | Kills were counted per bullet after a knock, and re-armed by the victim's lagging state packet (health 0, 40, 0). | Kills are credited once, on the `down` message that names us; a state packet can only lower predicted health/shield unless it is the respawn transition. |
| 6 | MED | `duel.ts` | The countdown started the moment the last guest connected, with everyone still on the menu. | `ready` in the state packet (`input.playing`); the host leaves "waiting" for round 1 only when everyone is connected and ready. The HUD says "WAITING FOR EVERYONE TO CLICK PLAY". |
| 7 | MED-LOW | `main.ts` | Pad disconnect or idle while it was the way in left no input and no menu. | When `pad.active` drops while `padPlaying` and not locked: back to the menu. Idle window 30 s to 120 s. |
| 8 | LOW | `duel.ts` | The host pinged only guest 1. | Every link is pinged; the ping is cleared when a guest goes. |
| 9 | LOW | `duel.ts` | `guestLeft` ran twice per departure (bye and close both fire); `receive` made a Remote for a `bye` or an unknown id. | Idempotent; a figure is only made for state/shot/hit/down messages. |
| 10 | LOW | `bots.ts` | The kill feed and the round credited the first standing bot, not the one that hit you. | `lastHitBy` tracked per frame; feed and round use it. |
| 11 | LOW | `player.ts` | A stale `sgJumpFrame` across mantles gave "crouch 4713 frames after jump". | Reset in `finishMantle`. |
| 12 | LOW | `main.ts` | "CONTROLLER CONNECTED" repeated after every idle gap. | The notice keys on the connect event (`justConnected`), and now says "PRESS START TO PLAY". |
| 13 | LOW | `link.ts` | `conn.on("open")` did not re-check `cancelled`. | It does. |
| 14 | LOW | `menu.ts` | The course board's `rank` text went into innerHTML unescaped. | `esc(e.rank)`. |

Finding 6 changed the tests: a scripted page cannot take a pointer lock, so
`tools/e2e.ts` and `tools/live-check.ts` "click Play" through a fake
controller's Start (the controller's way in) on every page of a match. The
e2e also checks the new behaviour: the host holds at "waiting" with a
"PLAY" line until both have pressed it, and one player pressing it is not
enough.

## 4. Verified

- `npx tsc --noEmit` clean.
- `npx tsx tools/movesim.ts`: MOVESIM PASS (wiki timing, wallbounce recipe,
  crouch kick, wallskip, both courses' gates, teleport fatigue).
- `npx tsx tools/verify.ts`: VERIFY PASS.
- `npx tsx tools/e2e.ts`: E2E PASS (see the run log for the count; two new
  checks for the Play gate).
- `npx tsx tools/rules-check.ts`: rules ok.
- `npm run build` and `npm run build:beta` (codenames only).
- `npm run deploy` republished `gh-pages`; `npm run live` played a 1v1
  between two pages on the live URL over the public broker.

## 5. Still open

- Finding 7's idle window is a guess (120 s). A pad that goes quiet for two
  minutes mid-match drops the player to the menu; if that bites, tie it to
  a disconnect event only.
- The kill count in a 1v1v1 is right on the host and on the guest that
  landed the knock; a guest that lands damage but not the knock gets no
  credit, as intended (assist tracking is on the NEXT_STEPS list).
- Everything in `docs/NEXT_STEPS.md` (aim assist, sound, a TURN relay for
  networks that block direct connections, accounts and online boards).
