# Phase 11 results: abilities, the killcam and death recap, and every next step short of PvP BR

**Date:** 2026-09-15. **Status:** done. The plan: `docs/PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`. Milestones 11 to 23 in `docs/DEVELOPMENT_ROADMAP.md`.

**Owner:**

> *"we can do everything except the pvp br now in one large session as long as we plan it out accordingly. do the next steps in the gap_analysis.md, next_steps.md, and add two abilities we can pick as soon as we land / spawn in the first POI, that is either dash (dash 10 meters quickly in one direction every 3 seconds) or heal twice as fast. Ensure you give them names, allow them to choose via prompting them with text when its available. Allow the two abilities in the 1v1v1 mode and bots as well, make it a configurable option on if we want it or not. BR should always have it, or jsut have the option default selected when we choose the BR mode."*
>
> *"This is a massive undertaking so ensure that you take my prompt and put it into a detailed "Phase" document. It should also update a project roadmap file with a "milestone" every time we add something that is relatively large or just a new feature worth documenting."*
>
> *"Don't forget to add a killcam (skippable) and a "death recap" to see how much you hit them for vs how much they hit you for, how many times, what gun, what distance, if they healed recently."*

## 1. What shipped

| Workstream | Commit | Milestone | In one line |
|---|---|---|---|
| 11A The roadmap, the plan, the research | 0c1b5f9 | 11 | `DEVELOPMENT_ROADMAP.md` (milestones 1 to 10 written from the earlier rounds), the phase plan, `RESEARCH_PHASE_11.md` with Season 30's numbers and their sources |
| 11B Abilities | 0c1b5f9 | 12 | JOLT (10 m every 3 s) and TRIAGE (heals twice as fast), a card when they become available, 5 / 6 to pick, F to use, a setting per kind of match (the battle royale's on), bots take one |
| 11C Killcam and death recap | a531c96 | 13 | The last 4 s from the killer's eyes, skippable; the recap: damage, hits and headshots each way, their gun and every hit's distance, a heal in the last 10 s, what they had left |
| 11D Sound | 70c5a26 | 14 | Positional synthesised sound: guns by class with distance delay and dulling, cracks past you, footsteps by surface, reloads in parts, the match's cues, volume sliders |
| 11E Weapon mechanics | 795b687 | 15 | Wind-ups, charges, the L-STAR's heat, the aimed charge, the choke, the burst charge; a hop-up slot; fire modes; counted ammo and energy stockpiles |
| 11F The Nemesis and the Bocek | f775027, 1bc071d | 16 | The roster at all 29 of Apex's guns; the public build ships no hop-up names |
| 11G The range's tooling | ec86e3d | 17 | Dummy behaviours and shoot-back, the spray wall, the flick drill, the superglide trainer and the mantle cue, zone flashes, per-gun numbers, the slide probe |
| 11H Heals and armour | 7e4ee10 | 18 | Five heals with the quick heal and the wheel, the healing slow, shield cores that level with EVO, helmets |
| 11I The battle royale, filled in | 24f8085 | 19 | Land with nothing and loot, death boxes, care packages, bots that search, down not out, revives, banners and beacons, jump towers, launch pads, pings, map icons, spectating a squad mate |
| 11J Modes | 7b2e933 | 20 | Gun Run, team deathmatch and Crown, alone against bots or with friends and bots |
| 11K Figures | 7c0f4ca | 21 | Legs apart from the aim, the hands' actions, flinches and leans over the network; a motion-captured mannequin as a setting |
| 11L Throwables | 7648756 | 22 | The frag, the arc star and thermite with Season 30's numbers, an arc preview, replayed on every screen |
| 11M Finishing touches | 58becaf | 23 | The guided tour, course medals, weapon inspect and a first draw, toggle ADS and crouch, per-optic ADS, the controller's advanced look and button rebinding |
| 11N Close | this commit | - | The bug hunt below, the docs, the deploy |

About 12,700 lines added across 74 files; 16 new game modules (`abilities`, `killcam`, `recap`, `soundscape`, `ammo`, `kit`, `rangetools`, `trainer`, `loot`, `brplay`, `modes`, `modematch`, `throwables`, `tour`, `mannequin`, `fx`) and 11 new config files.

## 2. Where it went differently from the plan, and why

| Plan item | What happened | Why |
|---|---|---|
| B4 Death boxes: "E opens it (a list)" | The box's items lie round it and E takes each like any floor item | One way of taking things everywhere, and it works for a squad through the same host messages; a list UI is open (section 5) |
| B13 The map: "the ring's next circle shown earlier" | The next circle shows when the host sends it, as before | Not needed once the map had the rest; small |
| H Healing interrupted by damage | Not done | Apex does not interrupt a heal on damage (research section 1) |
| M4 Crown: the carrier "walks" | The carrier moves at full speed; the hold is unbroken (going down resets it) | Hyper Scape's carrier penalty was to ability cooldowns, not speed (research section 14); an unbroken hold reads better in a small arena |
| M3 TDM "first to the research doc's score" | First to 30 with teams of four | Apex's 40 is for 6v6; the arena holds four a side |
| F7 A motion-captured rig "behind a setting" | Done, with the robots kept as the default | The only free clip set that could be fetched is pistol clips; rifles look held one-handed-ish. Rifle clips are open |
| T4 "the 1v1 kit (config)" | One of each grenade a life in the arena, the modes and the bot match | The config's `kit`; the battle royale finds them |
| P3 The tour's heal step | The tour lends its own shield for the step | The range has no health of its own unless the dummies shoot back |
| R9 Course medals (planned in 11G) | Built in 11M | Kept 11G to the range; medals sit with the other finishing items |
| Z2 One e2e run | The full e2e now runs about twelve minutes; checked in two batches | It grew by five sections this phase |

## 3. The bug hunt

Two independent read-only reviews, one of the match and network code, one of the client (the frame loop, the HUD, input, figures, settings). Every finding was re-read against the code before it was touched; the live check on the deployed site found one more (L1). 31 findings: 29 fixed, 1 left by design, 1 a question for the owner.

| # | Finding | Severity | What was done |
|---|---|---|---|
| N1 | A guest in a battle royale almost never took the ring's damage: its tick clock added the time `Duel.update` itself took, not the frame's | high | Fixed: the frame's time is taken before the update. e2e: a guest outside the ring loses health every 1.5 s |
| N2 | Team deathmatch and Crown bots were handed Gun Run's guns at every fight start (the ladder ran in every mode) | medium | Fixed: only Gun Run changes guns. e2e: the TDM bots keep seven different guns |
| N3 | At Gun Run's knife level any kill won, a grenade's included | medium | Fixed: only a knife (melee) kill wins there, and Gun Run gives no grenades. verify |
| N4 | A guest's respawn point ignored the host's bots (all the enemies in team deathmatch) | medium | Fixed: a guest's fighters include the bots it sees |
| N5 | The ring closed and care packages fell during the lobby, before the drop | medium | Fixed: the host's ring, pods and bots wait for the drop |
| N6 | A battle royale never ended when the host was out and the last guest left | medium | Fixed: a squad mate gone with nobody up ends it |
| N7 | Gun Run's time-up winner could be a player who had left, and a tie went to the host | low | Fixed: a leaver is off the ladder; a tie at the top is a draw. verify |
| N8 | The host's kill feed called bots "PLAYER 101" and the ring "PLAYER 0" | low | Fixed: the match's own name lookup |
| N9 | A guest's battle royale ended with "The host left the match." instead of their placement | low | Fixed: once the result is in, the end says the result |
| N10 | The bots vanished from a guest's end card with a "LOST BOT" notice each | low | Fixed: the end card does not count bots as silent |
| N11 | "X IS REVIVING YOU" stuck if the reviver left mid-revive | low | Fixed: a player gone stops their revive |
| N12 | Throws, blasts, fires, floor loot, pods and the crown made geometry and materials that were never freed | medium | Fixed: shared geometries, and the rest disposed with what owns it (with C6) |
| N13 | A grenade's fire or late frag could hurt a bot outside the fight (a countdown) | low | Fixed: throwable damage only in the fight |
| N14 | The ring message is not checked field by field on a guest | low | Left: only the host sends it, and a guest trusts its host (the peer-to-peer model's premise) |
| L1 | Over the real peer-to-peer connection a message with an undefined field was dropped whole: PeerJS packs `undefined` as `null`, which the checks rejected. A friend's JOLT streak, a heal for the recap, a hit without its gun never arrived (the local transport keeps `undefined`, so the local tests passed; the live check caught it) | high | Fixed: the link sends no undefined fields, and the checks take a null as absent. verify; the e2e's p2p section and the live check |
| C1 | A grenade throw also fired the gun on the same click (the trigger saw a fresh pull once the grenade left the hand) | high | Fixed: the gun waits for the button to come up. e2e: the click throws and the magazine stays full |
| C2 | The tour's heal step left the heal running forever once the tour took its lent shield back, which then blocked G | high | Fixed: a heal with nothing to heal ends, and the tour lends its shield until the heal is over. e2e: the tour's grenade step with the real G after the heal |
| C3 | Toggle ADS could not aim while sprinting (the latch was cleared every sprinting frame) | high | Fixed: a sprint press comes out of the aim, sprinting does not stop one |
| C4 | Putting a grenade away with the aim button also toggled the aim on | medium | Fixed: that press is spent on the grenade |
| C5 | Down in a squad you could still melee and JOLT | medium | Fixed |
| C6 | GPU memory grew with every throw and every battle royale (see N12); also the heal item mesh and the mannequin's skeletons | medium | Fixed |
| C7 | With fists and a grenade in hand, one click punched and threw | medium | Fixed: with a grenade in hand the click throws |
| C8 | A loadout picked during the last fight of a match was lost at its end | low | Fixed: it comes on when the match ends |
| C9 | The per-optic ADS multiplier ignored a gun's own scope (the Kraber's) | low | Fixed |
| C10 | The heal kit was not refilled after a match (the tour's heal step could then not be done) | low | Fixed |
| C11 | The pad's X counted as interact everywhere: an inspect held in the tour skipped a step; on the drill pad it reloaded too | low | Fixed: no inspect during the tour (the held X is its skip); on the drill pad X starts the drill |
| C12 | Saved keys from before this release could clash with the new defaults (G moved from the magazine level to the grenade) | low | Fixed: a key a player gave to one action comes off any action still on its default. verify |
| C13 | Per-frame work: the arc preview (90 steps against every box) every frame; a few small objects a frame elsewhere | low | The preview is now worked out ten times a second; the small allocations were left (no measurable cost) |
| C14 | The flick drill's clock ran with the menu open and through a match | low | Fixed: it waits with the menu, and a match stops it |
| C15 | The HUD's kit line said "4" whatever the heal key was | low | Fixed |
| C16 | The public build keeps the heal items' names ("Phoenix kit" is Apex's) | question | Asked of the owner (section 5) |

## 4. Tests

| Check | Result |
|---|---|
| `npm run check` | clean |
| `npm run verify` | VERIFY PASS: 748 checks (the movement simulation's 196 among them) |
| `npm run movesim` | MOVESIM PASS |
| `npm run e2e` (every section: page, duel, invite, triple, bots, pad, range, finish, throw, br, loot, modes, squad, and p2p over the public broker) | E2E PASS, about 200 checks |
| `npm run rules` | rules ok |
| `npm run build:beta` | BETA CHECK PASS: no real names in the public build |
| `npm run snap` | every scenario drawn (the HUD for the abilities, the killcam and the recap, the guns, the range's tools, the loot, a down, the maps, the modes, the figures, a throw, the tour) |
| `npm run deploy` then `npm run live` | deployed to https://fpsfun.duckdns.org/; LIVE CHECK PASS (two pages on the live URL, a 1v1 over the public broker, the hit landing) after the fix for L1 |
| `npm run deploy:server -- dry` | DRY RUN PASS: the release installs, starts and hosts a 1v1 through its own broker on this PC (the tool now calls Windows' own `tar` by its path: from Git Bash, GNU tar read `C:\` as a remote host) |

The mannequin's files were made with:

```
npx tsx tools/trim-glb.ts UAL1_Standard.glb public/models/mannequin/mannequin.glb Idle_Loop Walk_Loop Jog_Fwd_Loop Sprint_Loop Crouch_Idle_Loop Crouch_Fwd_Loop Jump_Loop Jump_Start Jump_Land Death01 Hit_Chest Pistol_Idle_Loop Pistol_Aim_Neutral Pistol_Aim_Up Pistol_Aim_Down Pistol_Reload Pistol_Shoot Punch_Jab Roll
npx tsx tools/trim-glb.ts UAL2_Standard.glb public/models/mannequin/mannequin-more.glb --no-mesh Slide_Loop ClimbUp_1m Consume Hit_Knockback Idle_Rail_Loop LayToIdle
```

from Quaternius's Universal Animation Library 1 and 2 (the "Standard" downloads, the Unreal-Godot `.glb`, no root motion).

## 5. Still open, ranked

1. **PvP battle royale and the authoritative game server** (2 to 4 weeks). Out of this phase by the owner's call; everything else is built so the server can take over the rules (the host already decides loot, the modes and the bots).
2. **The game's own server, live**: waiting on the owner (the separate free VM, the `fpsfun` DuckDNS name, the firewall rules, `.env.server`), then `npm run deploy:server`.
3. **Rifle clips for the mannequin**, then it can be the default figure.
4. **Controller defaults for the heal, a grenade and the ping** (they can be bound on the Controls tab today).
5. **Bots with grenades and cover.**
6. **The battle royale's remaining Apex pieces**: the Season 29 deathbox respawn, knockdown shields, EVO from damage taken, the S30 hop-ups, a death box list.
7. **Accounts** (needs the owner to pick a provider).
8. **A question**: codename the heal items in the public build ("Phoenix kit" is the game's name)?
