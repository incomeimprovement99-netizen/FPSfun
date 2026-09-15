# Next steps

## What you asked for, and where it stands

### Phase 12 (2026-09-15)

| Ask | Status |
|---|---|
| "do all the next steps except for the pvp battle royale" | Done, apart from putting the server live, which waits on your VM (below). The plan is `docs/PHASE_12_PLAN_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`, the results `docs/PHASE_12_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`, and the roadmap has milestones 25 to 36. |
| "Continue with animations" | Done. The motion-captured mannequin is the default figure. It holds a rifle at the shoulder, with IK on both hands, turns on the spot with its feet planted, lands, staggers and dies. The robots tuck on jumps, squash on landing, breathe standing still and pump their arms in a sprint. |
| "having different bot difficulties" | Done: easy, normal, hard, elite and mixed. They differ in how they play, not just their aim: dodging, hearing, hunting, crouching, frags, cover and pre-aiming. |
| "when we do go down or die we aren't holding our gun still" | Done. Down, every figure crawls with no gun, and your view shows your hands on the floor. Out, the figure drops its gun and it lies by the body, and your view has no gun. |
| "another next steps and gap analysis from big time players like apex and Hyperscape" | Done: `docs/GAP_ANALYSIS.md` (Apex Season 30 and Hyper Scape) and the list below. |
| "Ensure the abilities are working as expected and that the dash is fast and meaningful" | Done. JOLT and TRIAGE were checked in every mode. The dash is 10 m in 0.14 s on an ease-out, leaving at 400 hu/s, with an FOV kick, a roll and a rumble. |
| "two stored dashes, each recovering in ... 4 sec per dash" | Done: two charges; a spent one comes back 4 s after the one before it, 8 s for both. The HUD shows a pip per charge. |

### Earlier asks

| Ask | Status |
|---|---|
| Two abilities, a killcam, a death recap, the modes, the phase and roadmap docs (Phase 11) | Done, and kept up in this phase. |
| "Can't we deploy on a server like Algonomics is?" | Built and tested, and it now keeps accounts too. **Waiting on you**: create the separate free VM, a DuckDNS name (fpsfun) and the Oracle firewall rules, then put its address in `.env.server` and run `npm run deploy:server`. |
| Controller, sliding, wall tech, hands and animations, engagement, 1v1v1, bots, courses, stats, playable online, a BR against bots and with friends | Done; see the Phase 11 results and the roadmap. |
| Eventually people against each other | Needs the authoritative server (below). |

## The next implementations, ranked

`docs/GAP_ANALYSIS.md` section 5 has the reasons and the sources. In short:

1. **The authoritative game server, and PvP battle royale** (2 to 4 weeks, your call: its own project).
2. **Get the game's own server live**: an hour of your time, then `npm run deploy:server`.
3. **The ping wheel** (0.5 day).
4. **Game Master events** in bot matches and the BR (1 day): Hyper Scape's Crowncast for friends.
5. **A decay round ending in the crown** (2 days): Hyper Scape's Crown Rush on Outskirts.
6. **Bots that go down and can be finished** (1.5 days).
7. **Replicators and EVO harvesters** (1.5 days).
8. **A hacks-and-fusion mode** (3 to 4 days).
9. **Control's ratings and loadouts** (2 days).
10. **KTX2 textures and meshopt geometry** (1 day).

## Decided for you this phase (say if you want otherwise)

- **Heal names in the public build**: the phoenix kit is the **Nova kit** there. The other heals are plain words and stay.
- **Where Control is played**: in the arena, 5 v 5, first to 500. Apex's 9 v 9 needs a bigger map or the server.
- **Accounts**: on our own server, so no provider sign-up is needed. Playing never needs one.
- **The deathbox respawn's lockout** (30, 60, 120 s) and **Redline's numbers** (+15% above 75% heat) are ours; Apex has published neither.

## When to leave the browser

Only for a frame rate cap without browser flags (a desktop wrapper: Electron or Tauri, same code), or a native engine if you want big maps, many players, anti-cheat or high-end graphics. Everything above stays in the browser.
