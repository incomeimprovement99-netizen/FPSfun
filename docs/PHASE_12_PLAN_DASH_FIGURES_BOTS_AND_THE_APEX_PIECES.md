# Phase 12 plan: the dash, figures that let go of the gun, bot tiers, and the rest of the list

**Date:** 2026-09-15. **Status:** in progress; built in the order below, one committed checkpoint and one roadmap milestone per workstream. Results: `docs/PHASE_12_DASH_FIGURES_BOTS_AND_THE_APEX_PIECES.md`. Research with sources: `docs/RESEARCH_PHASE_12.md`.

**Owner:**

> *"Ok do all the next steps except for the pvp battle royale. Thats a project on its own that needs more time. Continue with animations, having different bot difficulties, ensuring when we do go down or die we aren't holding our gun still. We also want to ensure that we do another next steps and gap analysis from big time players like apex and Hyperscape. Ensure the abilities are working as expected and that the dash is fast and meaningful. You should have two stored dashes, each recovering in 8 seconds totoso. 4 sec per dash"*

## How this phase is run

The same as Phase 11 (`docs/PHASE_11_PLAN_*.md`):

- One checkpoint commit to `main` per workstream, with tests. No push unless asked.
- One `## Milestone N` in `docs/DEVELOPMENT_ROADMAP.md` per shipped workstream.
- Gameplay numbers go in `src/config/*.json`. Apex's numbers cite `docs/RESEARCH_PHASE_12.md`; ours are marked *ours*.
- The tests: `npm run check`, `verify`, `movesim`, and e2e in two batches, `page,duel,invite,triple,bots,pad,range,finish` and `throw,br,loot,modes,squad`.
- Before closing: the `p2p` section and `npm run live`. They talk over the real PeerJS link, which the local transport cannot stand in for.
- At the end:
  - two independent bug hunts;
  - README, the guides, NEXT_STEPS, a new GAP_ANALYSIS (against Apex and Hyper Scape), and FIDELITY;
  - the results doc;
  - the Pages deploy and its live check;
  - what is still open.

## Not in this phase (and why)

| Item | Why not now |
|---|---|
| PvP battle royale | The owner's call: "a project on its own that needs more time". |
| The authoritative game server | PvP needs it; 2 to 4 weeks on its own. |
| The game server going live | Waits on the owner: the VM, the DuckDNS name and the firewall, then `.env.server`. Everything on our side is built and dry-run tested. |
| Ultimates, 28 legends | Out of scope. We have two picked abilities; the owner has not asked for more. |
| Hyper Scape's hacks-and-fusion mode, sector decay, Game Master events | New ideas from the research (NEXT_STEPS ranks them), not items on the list this phase finishes. |

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| JOLT's charges | **Two stored dashes. A spent charge comes back 4 s after the one before it; both take 8 s.** | The owner's numbers. |
| Dash distance | **10 m**, as in Phase 11 | The owner's number. The research suggests 7.5 m (Tracer), but the owner set 10 and did not ask to change it. |
| Making the dash fast and meaningful | 10 m over **0.14 s** (was 0.18 s), on an **ease-out curve** with 70% of the distance in the first half. You leave it at **400 hu/s** (10 m/s, the slide cap), which a sprint, a slide or a jump carries on. At least **0.25 s** between two dashes. The feel: an FOV kick, a 2.5 degree roll toward the side you went, a pad rumble, the whoosh and the streak. | RESEARCH_PHASE_12 section 6: a 0.1 to 0.3 s travel time and a peak speed several times sprint read as fast. The curve and the gap are its suggestions. |
| Down or out | Down: no gun, in view or on any figure. The figure crawls on its hands; your view shows your hands low on the floor. Out: the figure drops its gun, and it lies by the body; the mannequin plays its motion-captured death. Your view has no gun and no hands. | The owner's ask. |
| Bot tiers | **Easy, normal, hard, elite**, and **mixed** for the battle royale (each bot a random tier, weighted toward normal). Each tier sets reaction time, how often the aim updates, a starting aim error that shrinks as it keeps the target, the aim point (chest to head), the chance to dodge under fire, hearing, grenades, cover and a crouch-peek. | The CS2 bot profile and the TF2 bot source give exact values by tier (RESEARCH section 4). "Different difficulties" means behaviour, not just aim. |
| Bot grenades and cover | Normal and up throw a frag at a target that has held still behind cover. Hard and up break line of sight to heal and peek back. Elite also pre-aims where you went. | RESEARCH section 4 table. |
| Controller | **Apex's Default layout.** RB pings, with a double tap for an enemy ping. D-pad up heals (tap), with the wheel on hold. D-pad right equips a grenade, and again cycles the kind. D-pad left toggles fire mode, with inspect on hold. Holding Y holsters; Back opens the map. D-pad down is the variable zoom (*ours*). The ability card takes D-pad left and right only while it is up. **Presets:** Default, Bumper Jumper, Button Puncher, Evolved, Grenadier, Ninja, and **Range**, our Phase 11 layout with the optic and magazine keys on the D-pad. | RESEARCH section 1 (EA's own table). |
| EVO | **As Apex counts it:** 1 per point of damage dealt, 150 a knock, 100 an assist, 100 a finisher. A revive gives 100 twice per match, then 25 less each time. Care package loot gives 100. **Taking damage earns nothing.** | The research corrects our Phase 11 gap line ("EVO from damage taken"). Apex's own table has no such source. |
| Knockdown shields | **Tied to your EVO level, not loot:** 200, 450 or 750 HP. Hold fire while down to raise it. Front only; you crawl 45% slower behind it; it stays broken until your next knock. | Apex since Season 28 (RESEARCH 2.2). |
| Deathbox respawn | Hold interact **7 s** at a dead squad mate's box. A green beam and a hum warn everyone. They come back on the box at **20 HP**, with the box's items put back on. Each death adds a lockout before the next such respawn: 30, then 60, then 120 s (*ours*; Apex has not published its values). It resets after 3 minutes alive. Moving away or shooting cancels it. | Season 29 onward (RESEARCH 2.1). |
| Hop-ups | **Executioner** on the Peacekeeper and Mastiff: a knock gives 50 shield over 5 s. It is locked until 275 points of damage with that gun. **Shattercaps** on the 30-30: hip fire is 7 pellets of 8, heads ×1.25. **Redline** on the L-STAR: above 75% heat, +15% damage and a projectile half as big again (*ours*: Apex has not published its numbers). Care-package guns come with theirs unlocked. | RESEARCH 2.4. |
| Control | **Control against bots on the battle royale map**, around its middle place. **Teams:** 6 v 6, with you and your friends on one team and bots filling both. **Three zones:** A, B and C, 1 point a second each. **Scoring:** first to **500** or a **15 min** limit (*ours*: Apex plays 1,000 with 9 v 9). **Also:** a 150-point bonus zone event, spawns only on zones linked to your base, 10 s spawn waves, Apex's capture speed by the number of players on the zone, and a lockout when one team holds all three. | RESEARCH section 3, scaled to our player count. |
| Accounts | **Optional, on our own server** (`server/game/serve.mjs`), with no third-party provider. A name and a password, hashed with scrypt, and a session token. The profile syncs: stats, settings, loadouts and binds. Online boards take the account's name. No account is ever needed to play. The Pages build has no server, so it says accounts need the game's server. | Phase 11 left accounts waiting on a provider. Our own server removes that, and the "play without logging in" goal stands. |
| Smaller downloads | The props' textures re-encoded to WebP at up to 1024 px (`EXT_texture_webp`, which three.js loads) in `tools/fetch-models.ts`. The ammo textures get the same. | KTX2 needs a native encoder we do not have. WebP gets most of the size back. |
| Recorded sounds | Kenney's CC0 packs, fetched by a script into `public/audio/`. They layer over the synthesis for footsteps, landings, reload clicks, impacts, UI and explosions. The guns stay synthesised, each under its own class. Credited in the README and an ATTRIBUTION file. | The Phase 11 gap: synthesis alone sounds thin on impacts and feet. |
| Heal names in the public build | **"Phoenix kit" becomes "Nova kit"** in the public build. The other heals are generic words and stay. | The owner's question from Phase 11. We decide it here and the owner can say otherwise. |

## Workstreams

Each table: **id**, **item**, **how it is done**, **verified by**.

### 12A. The plan, the research, the roadmap

| id | item | how | verified by |
|---|---|---|---|
| A1 | This plan | this file | the file |
| A2 | Research with sources | `docs/RESEARCH_PHASE_12.md`: Apex's controller defaults, S29 and S30 BR systems, Control, bot difficulty from CS2 and TF2, Hyper Scape, dash references, the gap table | every number used cites it or is marked ours |
| A3 | Roadmap | Milestone 25 onward | the file |

### 12B. JOLT: two charges, and fast

| id | item | how | verified by |
|---|---|---|---|
| B1 | Charges | `Abilities`: two charges, a sequential 4 s recharge, the 0.25 s gap, a refund when the movement refuses. Full every life and round. | verify: 2 charges, one back at +4 s, both at +8 s, the gap, the refund |
| B2 | The dash | 0.14 s on an ease-out curve (70% in the first half), exit 400 hu/s | movesim: 10 m in 0.14 s, 70% by half time, 400 hu/s out, 8 m+ ahead of a plain sprint after 1 s |
| B3 | The feel | FOV kick, a roll toward the side, a rumble, the whoosh | e2e: the roll and FOV numbers during a dash |
| B4 | HUD | A pip per charge under the ability square; the next one fills as it comes back | e2e: `hud.last.ability` charges; snap |
| B5 | Bots | The same charges | verify with a scripted bot |
| B6 | TRIAGE and the abilities in every mode | An audit: the arena, 1v1v1, the bots, the BR, Gun Run, TDM and Crown | e2e per mode |

### 12C. No gun when down or out (done: `ad153ca`)

| id | item | how | verified by |
|---|---|---|---|
| C1 | Figures down | The robot's arms go to the floor and reach in turn; the mannequin bends into a crawl. No gun. | e2e: the host's figure of a downed guest holds no gun |
| C2 | Figures out | The held gun drops: a copy falls, bounces and lies there until the figure is back up. The mannequin plays its death clip. | e2e: a knocked bot's gun is on the floor |
| C3 | You | In third person your figure is downed too; in first person no gun and your hands on the floor; out, no gun and no hands | e2e: the view and the self figure while down |
| C4 | Killcam | The recording says "downed" | the recorder sample |

### 12D. More animation

| id | item | how | verified by |
|---|---|---|---|
| D1 | Jump and land | Robot: the legs tuck in the air and a landing squash. Mannequin: `Jump_Loop` in the air and `Jump_Land` on a standing landing. | snap (figure lab) |
| D2 | Turn in place | The feet stay planted while the body turns, then step round past 50 degrees (both figures) | verify: a Dummy's leg yaw against its facing |
| D3 | Idle and sprint | Robot: a breathing idle, and a sprint that lowers and cants the gun while the arms pump | snap |
| D4 | The mannequin's rifle hold | A two-bone IK brings the left hand to each gun's support point (its handguard), blended out for a reload, a heal or a swap | snap: the lab from the side |
| D5 | A hit and a stagger | Mannequin: `Hit_Chest` layered on a hit | snap |

### 12E. Bot tiers, grenades and cover

| id | item | how | verified by |
|---|---|---|---|
| E1 | Tiers in config | `src/config/bots.json`: easy, normal, hard and elite, from RESEARCH section 4 | verify: the numbers read |
| E2 | Aim | The reaction to a newly seen target; the aim updating on its interval; the error that shrinks while it keeps the target; the aim point by tier | verify: easy's first 0.6 s has no shot; elite's error |
| E3 | Behaviour | Strafe or dodge by tier, crouch-peek, heal behind cover, hearing shots | verify with scripted bots |
| E4 | Grenades | A frag at a still target past a set time (normal and up) | verify: a bot throws; e2e: a bot's frag in a match |
| E5 | Cover | Hard and up break line of sight to heal, then peek back | verify |
| E6 | The menus | The bot difficulty select gains elite; the BR gains mixed | e2e |

### 12F. The controller: Apex's Default, and presets

| id | item | how | verified by |
|---|---|---|---|
| F1 | Tap and hold on one button | The gamepad layer gets hold actions (Y: swap tap, holster hold; D-pad left: fire mode tap, inspect hold) and a double tap (RB: an enemy ping) | verify on a fake pad |
| F2 | The Default layout | As in the decisions table | e2e (fake pad): heal, grenade, ping, holster |
| F3 | Presets | A select on the Controls tab | e2e: Bumper Jumper puts jump on LB |
| F4 | The card on the D-pad | While it is up, left and right pick an ability, not fire mode or a grenade | e2e |
| F5 | The heal wheel on a pad | The right stick picks while it is open | e2e |

### 12G. The battle royale's Apex pieces

| id | item | how | verified by |
|---|---|---|---|
| G1 | EVO sources | Knock 150, assist 100, finisher 100, revives, care package loot; damage dealt stays; damage taken never counted | verify: the EVO table |
| G2 | Knockdown shield | By EVO level; hold fire while down; front only; slower crawl; broken for the rest of that knock | verify: the blocking arc; e2e: raised while down |
| G3 | Deathbox respawn | As in the decisions table, through the host | e2e (squad): a guest respawned at their box |
| G4 | Hop-ups | Executioner, Shattercaps and Redline in `weapon-mechanics.json`, the locked progress and the care-package unlock | verify: each effect's numbers |

### 12H. Control against bots

| id | item | how | verified by |
|---|---|---|---|
| H1 | Rules | `src/game/control.ts`: zones, capture speed by count, points, bonus, lockout, spawn links, waves | verify in Node |
| H2 | The match | A `ControlMatch` on the BR map's middle place, the host running the bots | e2e (modes): a capture, points, a respawn on a zone |
| H3 | HUD | A, B, C along the top in team colours, the scores, a zone's capture ring | snap |

### 12I. Accounts on our own server

| id | item | how | verified by |
|---|---|---|---|
| I1 | Server | `serve.mjs`: register, login, logout, profile get and put. Passwords hashed with scrypt, rate limited, tokens expire; the data lives in a JSON file on the box. | The dry run: sign up, log in, sync, a bad password refused, rate limited |
| I2 | Client | Settings → Account: sign up, sign in, sign out, sync now; the profile merges on sign-in | e2e against a local serve.mjs |

### 12J–12L. Smaller downloads, recorded sounds, the codename

| id | item | how | verified by |
|---|---|---|---|
| J1 | WebP textures | `tools/fetch-models.ts` re-encodes textures | the sizes before and after; the models still load (e2e page) |
| K1 | Kenney sounds | `tools/fetch-sounds.ts`, `public/audio/`, the audio module layering them | e2e: the samples decode; the synthesis remains the fallback |
| L1 | Nova kit | `names.ts`; `beta-check` bans "Phoenix" in the public build | `npm run build:beta` |

### 12M. Close

A bug hunt with two independent reviewers; every test including p2p and live; the docs (README, DEPLOY_GUIDE, SERVER_GUIDE, a new NEXT_STEPS and a new GAP_ANALYSIS against Apex and Hyper Scape, FIDELITY); the results doc; `npm run deploy`, then `npm run live`; what is still open.
