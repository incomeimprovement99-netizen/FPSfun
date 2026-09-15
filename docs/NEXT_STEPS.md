# Next steps

## What you asked for, and where it stands

| Ask | Status |
|---|---|
| Play with a controller | Done. Plug in, press Start. Settings tab for sensitivity, curve, deadzone, auto sprint, rumble. |
| Sliding does not feel like Apex | Done as far as the wiki reaches: every slide number matches its pages; the picture was fixed (gun pose, crouch timing, slide jump apex). If it still feels off, say what: the length of the slide, the camera, the sound, the jump out of it. |
| Wall tech: fall off instead of bouncing | Done: the recipe is a SLIDE jump (apex 44 hu, in the green zone); a plain jump peaks above it. The feed now says so on a miss. The practice wall's sign has the recipe. |
| Hands look goofy | Rebuilt. |
| Gun animations, holster and unholster | Done: draw settle, holster turn, idle, slide pose, sprint pump. |
| Movement feels clunky | The sprint start was 25% slower than the wiki's measurement armed and 90% slower holstered; fixed. Tell me the next thing you notice. |
| Engagement | Nameplates, kill feed, match summary, spectate in 1v1v1, the Stats tab. |
| 1v1v1, bots, two courses, stats | Done. |
| Playable online | Live on GitHub Pages. |
| "Can't we deploy on a server like Algonomics is?" | Built and tested (`docs/SERVER_GUIDE.md`): our own broker, a TURN relay, online boards, one-command deploy. Waiting on you: which VM (the Algonomics one or a separate free one), a DuckDNS name, three Oracle firewall rules. |
| "My friend wasn't able to do anything" | A first-visit welcome, a device check (a phone is told it is a PC game), and invite links that join a match from the address alone. |
| Finish the bug hunt | Done: 31 more findings, all fixed (`docs/RESULTS_SERVER_HUNT.md`). |

## The next implementations, ranked

### Feel (Apex first, Hyper Scape's pace second)

1. ~~**Aim assist for controller.**~~ Done: slowdown and a 0.4 rotational
   pull, `src/config/aimassist.json`. Tell me if it is too strong or too weak.
2. **A slide feel probe.** A script that records speed, view height and gun
   pose every frame through a slide and a slide jump, and a page that shows
   them as curves next to the wiki's numbers. So "weird" becomes a curve we
   can point at.
3. **Third-person figures that move.** The rigid robot slides and crouches;
   it does not run, climb or ride a zip. A rigged CC0 model with those poses
   is the biggest visual step left. Two or three days with a free rig
   (Quaternius has some), more for our own.
4. **Sound.** Footsteps by surface, the slide scrape, the wall grab, the
   zip whine, a reload with parts, distant gunfire for other players. Free
   CC0 sets exist (freesound). Two days.
5. **Hyper Scape's pace, as a mode.** A "Crown" 1v1v1 variant: a crown
   spawns in the middle at 20 s, the carrier is shown to all and moves at
   walk speed, hold it 30 s to win the round. Same arena, one afternoon.
   Wall running and double jumps would break the Apex model; a separate
   arena with its own rules is the way if you want them.

### Multiplayer

6. ~~**Aim assist and the leaderboard first.**~~ Done: the online boards are
   on the game's own server.
7. ~~**Our own broker and a TURN relay.**~~ Built (`server/game/`), free on
   an Oracle VM; goes live with the server.
8. **Accounts** (Supabase or Clerk, free tier): the profile follows you,
   friends lists. Two or three days. (Invite links are done.)
9. **An authoritative game server** (Node with Colyseus or a WebSocket
   server running `player.ts` and the projectiles): more than three players,
   2v2, free-for-all, trusted hits and boards, replays, spectating from a
   lobby. Two to four weeks. The movement code runs on the server as it is.
10. **Ranked boards** on top of 9, with the server as the referee.

### Small things that make it feel finished

11. ~~Key rebinding screen.~~ Done: the Controls tab.
12. Weapon inspect (a long press of R), a first-equip flourish per weapon.
13. A tech trainer screen: the superglide as a timing bar, score ten tries.
14. Course medals and a par time per room on the results TV.
15. ~~A "welcome" on first launch.~~ Done, with the device check. A guided
    walk through the range itself (the gates, the practice wall) is still open.

## When to leave the browser

Only for a frame rate cap without browser flags (a desktop wrapper: Electron
or Tauri, same code), or a native engine if you want big maps, many players,
anti-cheat or high-end graphics. Everything above stays in the browser.
