# Next steps

## What you asked for, and where it stands

### Phase 11 (2026-09-15)

| Ask | Status |
|---|---|
| "do everything except the pvp br now in one large session" | Done: every item on the gap analysis's and this file's lists except PvP (the plan, `docs/PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`; the results, `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`). |
| Two abilities to pick when you land or spawn: a 10 m dash every 3 s, or heals twice as fast; named; picked from a text prompt | Done: **JOLT** and **TRIAGE**, a card when they become available (the countdown, the landing), 5 or 6 to pick, F (LB) for JOLT. |
| In the 1v1v1 and the bots too, as an option; the BR always, or on by default | Done: a setting per kind of match (the arena and modes, the bots, the battle royale); the battle royale's is on by default; bots take one too. |
| A detailed phase document; a roadmap with a milestone per feature, in the arb-poc / Algonomics style | Done: `docs/PHASE_11_PLAN_*.md` and `docs/PHASE_11_*.md`; `docs/DEVELOPMENT_ROADMAP.md` with milestones 1 to 23 (the first ten written from the earlier rounds). |
| A skippable killcam | Done: the last 4 s from your killer's eyes, then 1 s after; Space (or E, or A) skips; a setting turns it off. |
| A death recap: your damage against theirs, how many hits, which gun, what distance, whether they healed recently | Done, and what they had left. |

### Before

| Ask | Status |
|---|---|
| Play with a controller | Done, and now with the advanced look controls and every button rebindable. |
| Sliding does not feel like Apex | Done as far as the wiki reaches; `npm run slide-probe` draws the slide's curves beside the wiki's numbers. |
| Wall tech: fall off instead of bouncing | Done: the recipe is a SLIDE jump; the feed says why on a miss. |
| Hands, gun animations, holster and unholster | Done, and an inspect and a first-draw flourish. |
| Engagement | Nameplates, kill feed, match summary, spectating, the Stats tab, and the modes and the tour. |
| 1v1v1, bots, two courses, stats | Done; the courses have medals per room. |
| Playable online | Live on GitHub Pages. |
| "Can't we deploy on a server like Algonomics is?" | Built and tested (`docs/SERVER_GUIDE.md`): our own broker, a TURN relay, online boards, one-command deploy. **Waiting on you**: create the separate free VM, a DuckDNS name (fpsfun), the Oracle firewall rules, then put its address in `.env.server`. |
| "My friend wasn't able to do anything" | A first-visit welcome, a device check, invite links, and now the guided tour. |
| Animated figures | Done in code, much further this phase; a motion-captured mannequin as a setting. |
| A BR against bots, then a buddy or two in it | Done, and now with loot, downs, revives, banners, beacons, pings. |
| Eventually people against each other | Needs the authoritative server (item 1 below). |

## The next implementations, ranked

`docs/GAP_ANALYSIS.md` section 5 has the reasons and the effort; in short:

1. **The authoritative game server** (2 to 4 weeks): PvP battle royale, more than three humans, 2v2, trusted hits and ranked boards.
2. **Get the game's own server live**: an hour of your time (the VM, the DuckDNS name, the firewall), then `npm run deploy:server`.
3. **Rifle animation for the mannequin** (2 days), then it can be the default figure.
4. **Controller defaults for the heal, a grenade and the ping** (0.5 day).
5. **Bots that throw grenades and use cover** (2 days).
6. **The battle royale's last Apex pieces** (2 days): the Season 29 deathbox respawn, knockdown shields, EVO from damage taken, the S30 hop-ups.
7. **Control** (3 days), with a bigger arena or the server.
8. **Accounts** (2 to 3 days, needs you to pick a provider).
9. **Smaller downloads** (1 day): KTX2 textures.
10. **Recorded sounds** (2 days) layered over the synthesis.

## A question for you

- **Heal item names in the public build.** The public build codenames the guns, the hop-ups and now the arc star; the heals keep their plain names (shield cell, syringe, shield battery, med kit, phoenix kit). "Phoenix kit" is the game's own name. Codename it (a one-line change in `src/config/names.ts`), or keep it?

## When to leave the browser

Only for a frame rate cap without browser flags (a desktop wrapper: Electron
or Tauri, same code), or a native engine if you want big maps, many players,
anti-cheat or high-end graphics. Everything above stays in the browser.
