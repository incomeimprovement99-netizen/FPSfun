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
| The 1v1 should connect right away, the creator waits in the map | Done: Create match puts you in the arena with the code on the HUD; a connect takes the other in too. |
| Clear next steps against Apex and the big shooters | `docs/GAP_ANALYSIS.md`, and the ranked list below. |
| Animated figures: run, climb, mantle | Done in code (a jointed rig posed from stance and speed), sent over the network. Motion-captured animation is the next step up (item 3). |
| Third person with a look-around | Done: X, hold Alt to orbit; shots still land on the crosshair. |
| A BR against bots: a middle place, four outer ones, roads, a random drop shown on the map | Done: Outskirts, the ring, the drop, healing, placement (`docs/RESULTS_BR.md`). |
| Then a buddy or two in it | Done: a squad of up to three drops together against the bots, over the same codes and invite links. |
| Eventually people against each other | Needs the authoritative server (item 9): the host's browser runs the bots and the ring today, which is fine for a squad and not for a lobby. |

## The next implementations, ranked

The full comparison with Apex Season 30 and the other shooters, with effort
and value per item, is `docs/GAP_ANALYSIS.md`; its ranked list is the one to
work from. In short, the things every big shooter has that we still do not:

- **Sound** (the biggest gap now): footsteps by surface, slide and climb
  sounds, distance-filtered gunfire, hit sounds by shield tier, a low-health
  heartbeat, the ring's tick. CC0 sets, two days.
- **Guns that are not a plain trigger**: the HAVOC charge-up, Devotion
  spin-up, L-STAR overheat, Selectfire; the Nemesis and the Bocek. The data
  carries the charge times already. Two to three days.
- **Ammo**: reserve stacks and the energy regen; without them a 1v1's economy
  is not the game's. Two days.
- **Loot and the rest of the BR**: floor loot (weapons, attachments, heals,
  ammo), helmets and Evo shields, a downed state with revives for the
  squad, respawn beacons, care packages. Five days for the first pass.
- **Motion-captured animation**: the figures are posed in code; a rigged
  CC0 model with real run, slide and climb clips is the step up. Three days.
- **The range's own tooling**: dummies that strafe, crouch and shoot back
  with a panel, a spray wall, a scored flick drill, the superglide trainer.
  Four days.
- **Match systems**: Gun Run and TDM against bots or friends, a ping wheel
  for the squad, healing interrupted by damage, a spectator camera that
  follows a squad mate's view.
- **Accounts and the authoritative server**, for more than three humans,
  ranked boards and PvP battle royale.

### Feel (Apex first, Hyper Scape's pace second)

1. ~~**Aim assist for controller.**~~ Done: slowdown and a 0.4 rotational
   pull, `src/config/aimassist.json`. Tell me if it is too strong or too weak.
2. **A slide feel probe.** A script that records speed, view height and gun
   pose every frame through a slide and a slide jump, and a page that shows
   them as curves next to the wiki's numbers. So "weird" becomes a curve we
   can point at.
3. ~~**Third-person figures that move.**~~ Done in code. The step up is a
   rigged CC0 model with motion-captured clips (Quaternius has some).
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
