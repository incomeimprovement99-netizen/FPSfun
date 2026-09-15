# Phase 12 results: the dash, figures that let go of the gun, bot tiers, and the rest of the list

**Date:** 2026-09-15. **Status:** done, apart from putting the server live, which waits on the owner's VM. The plan: `docs/PHASE_12_PLAN_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`. The research: `docs/RESEARCH_PHASE_12.md`. Milestones 25 to 36 in `docs/DEVELOPMENT_ROADMAP.md`.

**Owner:**

> *"Ok do all the next steps except for the pvp battle royale. Thats a project on its own that needs more time. Continue with animations, having different bit difficulties, ensuring when we do go down or die we aren't holding our gun still. We also want to ensure that we do another next steps and gap analysis from big time players like apex and Hyperscape. Ensure the abilities are working as expected and that the dash is fast and meaningful. You should have two stored dashes, each recovering in 8 seconds totoso. 4 sec per dash"*

## 1. What shipped

| Workstream | Commit | Milestone | In one line |
|---|---|---|---|
| 12A The plan and the research | 467916e | - | The phase plan; `RESEARCH_PHASE_12.md`, with sources for Apex's controller defaults, S28 to S30's battle royale systems and hop-ups, Control, CS2's and TF2's bot grading, Hyper Scape, and dash references |
| 12B JOLT | e70f0d5, 467916e, a766fcf | 25 | Two stored dashes, one back every 4 s (8 s for both). The dash is 10 m in 0.14 s on an ease-out, leaves at 400 hu/s, and needs 0.25 s between dashes. It adds an FOV kick, a roll, a rumble and charge pips; bots follow the same rules. |
| 12C No gun down or out | ad153ca | 26 | Down, figures crawl with no gun and your view shows your hands on the floor. Out, the figure drops its gun and it lies there; the mannequin plays its death. The figure lab supports screenshots. |
| 12D Animation | 73db8d3 | 27 | The mannequin holds a rifle at the shoulder with two-bone IK and is the default figure. Feet stay planted turning on the spot; jumps and landings, idle breathing, sprint and stagger poses. |
| 12E Bot tiers | 9c10227 | 28 | Easy, normal, hard, elite and mixed. They differ in reaction, aim lag, a settling aim error and aim point, and in how they play: dodging, hearing, hunting, crouching, frags at campers and hiders, cover to heal, pre-aim. |
| 12F The controller | db1a49f | 29 | Apex's Default layout with its taps, holds and double taps; six presets and Range; the ability card on the D-pad; the heal wheel on the stick |
| 12G The battle royale's pieces | e747dca | 30 | EVO as Season 30 counts it; knockdown shields by EVO level; Deathbox Respawn; Executioner, Shattercaps and Redline, locked until 275 damage |
| 12H Control | 8f0f76a | 31 | Control against bots in the arena, 5 v 5: three zones with capture speeds, the bonus zone, the lockout, and spawns on linked zones |
| 12I Accounts | 0a930e8 | 32 | Optional accounts on our own server: scrypt-hashed passwords, sessions, rate limits, and a profile that syncs between browsers |
| 12J Smaller downloads | e6f53b8 | 33 | The textures as WebP: 30.5 MB down to 5.8 MB |
| 12K Recorded sounds | 29ff090 | 34 | 40 takes of Kenney's CC0 sounds layered under the synthesis |
| 12L The codename | b9ac9b6 | 35 | The phoenix kit is the Nova kit on the public build |
| 12M Close | this commit | 36 | The bug hunt below, a new gap analysis and next steps, the docs, the deploy |

About 5,000 lines added across 60 files: 4 new modules (`src/net/account.ts`, `src/ui/account.ts`, and the `Control` rules in `modes.ts`); 1 new config (`bots.json`); 3 new tools (`compress-assets`, `fetch-sounds`, and the figure lab in `snap`).

## 2. Where it went differently from the plan, and why

| Plan item | What happened | Why |
|---|---|---|
| B2 The dash's distance | Kept at 10 m; the research suggested 7.5 m | 10 m was the owner's number in Phase 11, and nothing said to change it |
| D4 The mannequin's rifle hold "via two-bone IK to the support point" | It went further: a long gun is mounted on the chest, stock in the shoulder, and **both** arms reach onto it | The first version (only the left hand onto the handguard) still held the rifle out at arm's length like a pistol, the look the Phase 11 gap called out. With the gun at the shoulder, the mannequin could become the default figure. |
| D5 "Hit_Chest layered on a hit" | Played on a shield break only, not on every hit | Every hit would take the upper body off the aim several times a second; the flinch correction already covers ordinary hits |
| E4 Bot grenades | Frags only | The arc star and thermite would each need their own targeting; the frag is the one that flushes a camper |
| G1 "EVO from damage taken and knocks" (the Phase 11 gap line) | Knocks, assists, revives and care packages; **not** damage taken | The research found Apex gives no EVO for damage taken; the gap line was wrong |
| G1 Finishers' 100 EVO | Not applied | Bots go straight out; they have no downed state to finish |
| G3 Deathbox Respawn cancelled by damage | Not done | Unverified in Apex (one guide says so, and it is contradicted elsewhere); moving off or letting go cancels it |
| H Control's ratings, loadout choice and spawn waves | Not done | Apex's rating thresholds are unpublished and we have no ultimates to charge; left on the list (NEXT_STEPS 9) |
| I Accounts: "e2e against a local serve.mjs" | Tested by the dry run instead: the API checks, then the page's sign-up and a second clean browser's sign-in, against the unpacked release | The dry run already starts the real server; the e2e runs on the dev server, which has no API |
| J "KTX2 or WebP" | WebP | KTX2 needs a native encoder we do not have; WebP with `sharp` got most of the size back |

## 3. The bug hunt

Two independent reviews read everything the phase changed: one the gameplay and the network, one the figures, UI, audio, assets, server and tools. They made **29 findings**, each checked against the code, and the reviewers reproduced three:
- the server crash, by running `serve.mjs`;
- the dash through a wall, in a movement simulation;
- the missed box item, by measuring the distances.

The e2e runs after the fixes found three more, in the bots: elite bots rarely finding cover in the lanes, a bot crouching out of its own sight, and a bot wedged in a pocket between two crates. All 32 are fixed, apart from one judged as intended and noted.

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Signing in as "constructor" or "__proto__" crashed the game server (the accounts lived in plain objects; an async handler threw past Express) | high | No-prototype tables, an own-key lookup, and every async handler's failure a 500. The dry run now signs in as "constructor" and checks the server is still up. |
| 2 | Signing in on a second browser wrote that browser's stats over the account's (the name change saved the old stats just before the reload) | high | A sign-in that brings a profile reloads at once, and the name comes with the profile |
| 3 | A Deathbox Respawn of the host emptied the box into a loadout that was then cleared, and duplicated the host's old guns | high | The box is put on last, after the life's kit and armour |
| 4 | JOLT's new peak (over 2 m a frame at 60 fps) went through 1 m walls | high | The dash moves in steps of at most 0.3 m. movesim now checks a 1 m wall at 60 and 30 fps. |
| 5 | A Deathbox Respawn gave a full shield at once (the armour reset ran after the box's 0) | med | Fixed by 3; e2e checks the shield starts below full |
| 6 | A Deathbox Respawn ignored the box's height (a mate on the hub's roof came back at the ground) | med | It stands you up at the box's own height |
| 7 | In Control, guests always came back at their base | med | A guest uses the zones the host last sent (the same rule, `controlSpawnZone`) |
| 8 | At a mate's box, E always meant the banner (no single item could be taken) | med | The box's tap and hold only when you look at the banner or at no other item |
| 9 | Hearing a shot or hunting pulled battle royale bots out of a closing ring | med | The ring's goal is urgent; it beats hunting and hearing |
| 10 | The killcam showed empty fists, not the killer's gun | med | Out, the gun is lowered only when there is no killcam. e2e checks the killer's gun is in view. |
| 11 | Course enemies lost their guns after the first run | med | A merged figure topples whole, gun and all, as before |
| 12 | Sync only uploaded: two browsers, the last to save won | med | On load, a signed-in browser takes the account's profile if another browser saved since |
| 13 | Nothing bounded the accounts file | med | At most 5,000 accounts, 128 KB profiles, and 40 saves a user per 10 minutes (with 10 sign-ups an address per 10 minutes, as before) |
| 14 | A dead player's figure changing look left its gun on the floor and dropped another (a dead player sent the killcam's gun as their own) | med-low | You send your own gun; a new look of a figure already down does not drop again, and the old one's gun goes |
| 15 | Gun Run gave dead bots their guns back | med-low | Out, nothing but getting up puts a gun in its hands (robot and mannequin) |
| 16 | The gun on the floor showed with its figure hidden, and floated when the figure was knocked in the air | med-low | It hides with its figure, and follows the body's floor down |
| 17 | An EVO level-up while down refilled the shield | low | Not while down |
| 18 | One box item was missed on a respawn (it lay exactly 1.8 m from the banner) | low | The items are taken round the box's own spot |
| 19 | A stale interact press at a box started a hold at once, and the frame after a respawn started another | low | Reset outside the box; the box is not offered for 3 s after |
| 20 | Care-package EVO went to each looter, not once a package | low | Kept, as intended: Apex pays the squad. The comment and the docs now say "each of the squad who loots from it". |
| 21 | Bots threw frags at where a dead target had been | low | Bots forget whoever goes down |
| 22 | The double-tap enemy ping left the first tap's "going here" on the squad's screens, and replaced a tracked enemy ping | low | Every screen removes the place ping an "enemy here" follows; a first tap that marked an enemy is kept |
| 23 | A guest's Control view stayed on the old match through a rematch | low | Cleared when the host sends none |
| 24 | Death boxes lost a gun's hop-up progress | low | The box's guns carry it |
| 25 | The Deathbox Respawn's hum could not be stopped | low | Giving up the hold fades it out |
| 26 | Two knockdown-shield panes in third person | low | The world pane only in first person |
| 27 | Grass footsteps were cut off mid-sound | low | The step's voice lasts as long as the longest recording |
| 28 | The account test's "never on a real server" was only an environment variable | low | It also needs the URL to be this PC, and the real deploy's check clears the variable |
| 29 | `fetch-sounds` deleted the sounds before downloading | low | The old files go only once everything is fetched |
| 30 | (e2e) Elite bots rarely found cover in the lanes: few spots are hidden standing and reachable in a straight line | med | Cover can be a spot hidden when crouched (behind low cover, where it heals crouched), reached straight or by one turn 3 m off; more rings searched, retried every 0.5 s; a crouched bot looks from crouched height |
| 31 | (e2e) A bot crouching mid-fight could duck its own sight behind low cover, and each lost glance restarted its reaction | med | It only crouches where it still sees its target; a glance lost for under 0.5 s is the same sighting |
| 32 | (e2e) A bot could wedge itself in the pocket between the middle's big crate, the step crate and the lane wall, with both slides blocked | med | No headway for 0.7 s: it takes the free way nearest the one it wants, backing out if it must, for 0.8 s |

## 4. Tests

- `npm run verify`: VERIFY PASS, 820+ checks. New this phase:
  - JOLT's charges;
  - the figures' planted feet;
  - the bot tiers (numbers, the error's decay, mixed's weights, the lob landing on its mark);
  - the battle royale's pieces (EVO levels and sources, knockdown shields, Deathbox Respawn's numbers, each hop-up);
  - Control's rules (capture, clearing, contesting, spawns, the lockout, the bonus, the limit);
  - the phoenix kit's name.
- `npm run movesim`: MOVESIM PASS. The dash: 10 m in 0.14 s, 70% by half time, leaving at 400 hu/s, well ahead of a sprint after 1 s.
- `npm run e2e`, in two batches: E2E PASS both. `E2E_ONLY=p2p` (the real PeerJS network): E2E PASS. The bots section: five passes in a row after the last bot fix. New sections and checks:
  - the dash's two charges, the roll and the pips;
  - no gun in your view, on the host's figure of you or on your own figure when down;
  - a knocked bot's gun on the floor;
  - the mannequin as the default, with its rifle on the chest mount;
  - the bot tiers (hearing, a frag and its blast, crouching, dodging, cover, easy doing none of it);
  - the pad's Default layout, presets and the card;
  - EVO, Executioner, a locked hop-up unlocking, Shattercaps' pellets;
  - the knockdown shield's arc, and a guest brought back on their box;
  - Control;
  - accounts saying they need the server;
  - WebP textures;
  - the recorded sounds.
- `npm run deploy:server -- dry`: DRY RUN PASS, now with the accounts (the API, "constructor" as a name, then a sign-up in the page and a sign-in from a second, clean browser that gets the same settings).
- `npm run rules`, `npm run build:beta` (BETA CHECK PASS), and after the Pages deploy `npm run live` (below).
- `npm run snap`: figures-robot, figures-mannequin, figures-hold, figures-hold-close, figures-crouch-close, downed-view, control.

## 5. Still open, ranked

1. **PvP battle royale and the authoritative server under it**: the owner's call, its own project.
2. **The game's own server going live**: the owner's hour (the VM, DuckDNS fpsfun, the Oracle firewall, `.env.server`), then `npm run deploy:server`. Everything on our side is built and dry-run tested, accounts included.
3. The new ranked list from the gap analysis (`docs/NEXT_STEPS.md`): the ping wheel, Game Master events, a decay round ending in the crown, bots that go down and can be finished, replicators and harvesters, a hacks-and-fusion mode, Control's ratings and loadouts, KTX2 and meshopt.
