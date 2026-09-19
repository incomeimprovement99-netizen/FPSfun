# Plan: ability kits

Today a player picks one of two abilities: JOLT (a dash with two charges) or TRIAGE (heals twice as fast). The genre this game follows gives every character a kit instead: a tactical on a cooldown, a passive that is always on, and an ultimate that charges over the match. That kit is most of what makes one player's fight different from another's, and it is the largest slice of the genre still missing (`docs/NEXT_STEPS.md`, item 15).

The plan: turn the two abilities into the first two kits, add the ultimate meter and key they need, then add kits one at a time, each built from code the game already has. Kits are ours, with our own names. Operators stay cosmetic, so nothing is gated behind a figure.

## What exists to build on

| Piece | Where | What it gives |
| --- | --- | --- |
| The pick | `abilities.ts` (`Abilities`, the choice card), `main.ts` (the card, keys 1 and 2, the ability key) | When a pick is offered (landing, countdowns), the card, and switching it on per match (the host's setting, in the welcome) |
| JOLT | `Player.jolt`, `abilities.ts` charges, the `jolt` effect | A tactical with charges, its feel (FOV kick, roll, rumble), how the others see it (a lean on the figure) |
| TRIAGE | `healScale` in `main.ts` | A passive that scales an existing number |
| Bots' abilities | `Bot.setAbilities`, `BOT_ABILITY` | Bots with a random ability, and when they use it |
| Throwables | `throwables.ts` | An arc, a bounce and a blast, sent as effects: the base for a smoke or a launcher |
| Ziplines | `traversal.ts` `zipline()` | A rope that can be put up at runtime |
| Pings | the `mark` message, `brPlay.addMarker` | Marks the squad sees: the base for a scan |
| The HUD | `hud.ts` ability slot | Where a tactical's charges and cooldown are drawn |

## The kit

- **Tactical** (F, the ability key): a cooldown or charges. JOLT's model generalised: `charges`, `recharge`, `gap`.
- **Passive**: always on. Read by the code it changes (heal time, movement, the map), as TRIAGE is now.
- **Ultimate** (Z): a meter from 0 to 1. It fills with time (`fullAfter` seconds from empty), with damage dealt (`perDamage`), and later at once with an ultimate accelerant item from the floor. It is spent whole when used.

`src/config/kits.json` holds each kit's name, blurb and numbers, with a `_note` for where each number comes from.

## Phases

1. **The framework and the first two kits.**
   - The card offers kits. The ids stay "jolt" and "triage" underneath, so the bots, the settings and their checks are unchanged.
   - The two kits:
     - **RUNNER**: tactical JOLT; passive SURE FOOTING (no stun from a hard landing); ultimate OVERDRIVE (8 s of +25% move speed with JOLT's charges refilled).
     - **MEDIC**: passive TRIAGE; tactical PATCH (25 health over 3 s, 18 s cooldown); ultimate FIELD HEAL (60 health over 5 s for you and every mate within 10 m, each page healing its own player).
   - Plus the meter, the Z key and its bind, and the HUD's ultimate ring.
   - On the network: each use as an effect (`patch`, `ult`), so others see it and older builds ignore it. No kit code rides in the state packet: every page runs its own player's kit.
   - Bots pick a kit and use its tactical and passive, as they did. Their ultimates, and the accelerant item, come with phase 2, where a bot's rule for each ultimate is written once for all the kits so far.
   - Checks: `tools/checks/kits.ts` for the meter's arithmetic and each tactical's charges. e2e: pick each kit, use its tactical and its ultimate, and see a friend's use on the other screen.
2. **SCOUT** (done, Milestone 117): tactical PULSE (every enemy within 40 m and inside 60 degrees of where you look shown for 2 s, in red on the figure and marked for the squad through the ping path); passive SHARP EARS (an enemy firing within 45 m shown the same way, in place of the footsteps on the compass, which the compass has no room for); ultimate SWEEP (every enemy within 60 m, any way they are, for 6 s). With it, the bots' ultimates: a bot's meter is time alone and it spends it the moment it has someone to fight.
3. **HOOK** (done, Milestone 118): tactical GRAPPLE (a line at whatever you look at within 30 m and a pull to it; a tether held down was dropped as a second control to learn, and a miss costs no cooldown instead); passive STRONG ARMS (half again the climb space, in place of a shorter zipline mount, which nobody would feel); ultimate ZIP LINE (a zipline up to 45 m from where you stand to where you look, put up on every page through its effect, for 90 s).
4. **SMOKE** (done, Milestone 119): tactical CANISTER (a canister thrown at what you look at, blooming into a cloud that blocks sight for the bots and for anyone looking through it); passive THERMAL (an enemy in your own smoke shown to you, in place of a faster reload, which nobody would notice); ultimate SCREEN (three of them in a line). The clouds are their own piece, `smoke.ts`, rather than a carried grenade.
5. **WARD** (done, Milestone 120): tactical WALL (a wall put up in front of you, a real solid, so it stops bullets, bodies and sight); passive HARD SHELL (5 shield a second out of a fight); ultimate BASTION (three of them in a horseshoe, in place of a dome: a dome that stops bullets but not bodies would need a second kind of blocker everywhere a shot is worked out, and three walls give the same cover out of the piece that already exists).

Each phase ships on its own, with its checks and docs, like host migration did.

## Risks

- **Old builds.** A kit code an older build does not know reads as "no ability" there. The effects of a new kit are new effect kinds, which an older build ignores. The mixed e2e plays the two against each other every phase.
- **Balance.** The numbers are ours and go in `kits.json` with notes, so the owner can tune them without code.
- **The bots.** Each kit needs a rule for when a bot uses it. Phase 2 writes the rule for each ultimate (at a full meter, in a fight), and each later kit adds one line of intent.
