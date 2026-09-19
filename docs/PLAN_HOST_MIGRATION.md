# Plan: host migration

Today, if the host's connection drops mid-match, the match ends for everyone. After Milestone 91 the guests do try to get back in: each one retries the match's code every `net.json rejoin.retry` seconds for `rejoin.hold` seconds and shows its seat key. But the host they are retrying is gone, so nobody answers.

The plan: one guest, the **heir**, keeps a warm copy of everything only the host knows. When the host goes, the heir takes over the match's code. The other guests' existing retries then reach the heir, and it takes each of them back into its seat. Nobody types a code, and the match carries on from where the heir's copy left off.

This is the largest item left on `docs/NEXT_STEPS.md`. It is done in four phases. Each phase ships on its own.

## What exists to build on

| Piece | Where | What it gives us |
| --- | --- | --- |
| Rejoin with seat keys (91) | `link.ts` `openHosting` / `rejoin`, `main.ts` `getBackIn`, `Duel.hostDropped` / `swapHost` | The guests' whole side of a migration: they detect the loss, keep playing, retry the same code, and swap in a new host link. |
| Host handover (96) | `host` messages `take` / `code` / `move`, `openHosting`, `joinCode` | Moving a lobby to a friend's new code, while nothing is in play. |
| Held seats (91) | `Duel.held`, `guestDropped`, `rejoinSeat` | A host that keeps a seat, and the figure in it, while its player is away. |
| Seeded match | loot field, ring plan, map, loadout crates from the match seed | Every browser can rebuild the loot field and the ring plan without being sent them. |
| Replicated views | ring `view`, `crownView`, `controlView`, doors, pods, scores, ladder rows | Most of what the HUD shows is already on every guest. |

## What only the host knows

From the survey of `duel.ts`, `brmatch.ts` and `modematch.ts`:

- **Duel base:** the phase clock (`phaseEndsAt`), `caps`, `fightStartedAt`, the hit check's history, the held seats, the seat keys (`link.ts keys`), and each guest's delta baseline.
- **Battle royale:**
  - Bots: tier, abilities, kit and ammo, nav `node` / `goal`, `armedAt`, redeploy and bleed-out timers, whether they are still aboard the ship, and each bot's memory.
  - Ring: the live `Ring` object and where its RNG has got to (the plan is seeded, but the progress is not sent).
  - Storm Surge: `surgeAt`, `surgeSince`, `dealt`, `surgeHumans`.
  - Care packages: `podPhases`, `podCount`, and each pod's contents.
  - Loot: `nextKey` (the guests' copies drift slightly).
  - The judge: `placedAt`, `judgeSides`, `botsLaunched`, `jumpAt`.
- **Arena modes:** the bots (as above), `Crown` and `Control` objects with their own random numbers, `timeEndsAt`, and the Gun Run ladder's decisions.
- **Places that assume id 0 is the host:** the role test `id === 0`, `receive(m, 0)`, `remote(0)`, `forgetPeer(0)`, `[[0, hostLink]]`, handover, kick, bye, ping, the silence check. Squads also assume they start at id 0 (`sideOfHuman`, the jumpmaster).
- **The code's PeerJS id** is `${PREFIX}${code}`, registered by the host's `Peer`. It is freed when the host's connection to the broker closes. After a crashed tab, that can take the broker's heartbeat timeout to happen.

The bots could be rebuilt roughly from the guests' remotes (index, squad and slot come from the id; position, health and downed come from the last state). But the tier, kit and timers would be lost. **So the heir is sent a snapshot**, rather than guessing.

## Design

### 1. The heir

- The host names an heir: its lowest-numbered connected guest, or the next one after a leaver.
- It tells everyone who the heir is, in a new `heir` message.
- It sends the heir alone a **snapshot** every `net.json migrate.snapshot` seconds (about 1 s), and again whenever the heir changes.
- The snapshot contains:
  - the seat keys and the players' names, sides and squads
  - the phase clock, scores and caps
  - the mode's host-only state, through a `snapshot()` / `restore()` pair on each match class (`Duel`, `BrMatch`, `ModeMatch`)
- The snapshot stays small: bots as rows of numbers, and no geometry. It goes on the reliable channel. The target is under 4 kB per second at 60 bots, which the rehearsal tool measures.
- Why a warm copy and not an election at the time of loss: at that moment nobody can reach the host to ask. The one who takes over has to already hold what it needs, and everybody has to already agree on who that is.

### 2. Detecting the loss

- A guest already detects it: `hostDropped` (the link closed without a bye), or silence past `net.json` `silence`.
- A bye or a close from the host is still the end of the match. Leaving on purpose is not a crash.
- The other guests do what they do now: keep playing, and retry the code with their seat keys.
- The heir does not retry. It goes to step 3.

### 3. Taking the code

- The heir opens hosting on **the same code**. It retries on `unavailable-id` for up to `migrate.claim` seconds (about 20 s), while the broker frees the old host's id.
- A new `openHosting` option, `resume: { keys, next }`, makes it:
  - answer a seat hello with the keys from the snapshot
  - hand out new seats after the highest one in use
- A guest's retry that reaches the heir is taken back in exactly as a rejoin is now (`welcome` with `back`).
- The guest's `swapHost` puts the new link in the host's place.
- If the code can't be claimed in time:
  - the heir hosts on a fresh code
  - it sends that code to every guest it still has a direct peer link to (the voice links are direct already)
  - otherwise the match ends as it does now

### 4. Ids after the move

The hardest part is that ids are baked in: 0 is the host everywhere. The cheapest correct rule is **ids do not change**.

- The old host's id 0 becomes a held seat. If that player comes back (their tab reloads with the same seat key), they get their figure back as a guest.
- The heir keeps its own id and becomes the host.
- To make that work, `Duel` stops deriving the role from `id === 0`:
  - `role` becomes a field, set by the welcome and by the takeover
  - `hostId` replaces every literal 0 in the list above
- Guests address the host as "the host link" everywhere already, except for those literals. They are a fixed list, and each one gets a unit check in `tools/checks`.

### 5. The heir becomes the host

- `Duel.takeOver(snapshot)`:
  - role becomes host
  - the old host's figure goes to a held seat
  - the mode's `restore(snapshot)` rebuilds the `Bot` objects, `Ring`, `Crown` / `Control`, the surge and the pods from the snapshot
  - the delta baselines start over from whole states (as a rejoin does now)
  - the hit check starts empty, which only means its first second is lenient
- The time between the last snapshot and the takeover is lost. That is about a second of bot movement, and any ring tick in that second is replayed from its seeded plan.
- Bots stand where the guests last saw them. The heir moves each bot to its last replicated state, not to the snapshot's position, so nothing jumps on the others' screens.

## Phases

1. **Host id and role as fields.**
   - Replace `id === 0` and the other literal 0s with `hostId` and a `role` field. There is no change to what anyone sees.
   - Unit check: a `Duel` built with `hostId = 3` routes, pings and relays correctly (a local match in `tools/checks`).
   - Full e2e plus `mixed`: old builds still assume host 0, and new builds send `hostId` only after a migration.
2. **Migration for the 1v1 lobby modes with no bots** (arena modes with friends only).
   - The `heir` message, the snapshot of the duel base, `openHosting({ resume })`, `takeOver`.
   - e2e `migrate` section:
     1. three pages in TDM
     2. the host's page is closed with no goodbye
     3. both guests keep the match: the heir hosts it, the other one is back in within `rejoin.retry` + 2 s, the scores carry over, and the clock is within 2 s
   - Run over the `p2p` broker too, since the broker's id release is the real risk.
3. **The arena modes with bots, Crown and Control.**
   - `ModeMatch.snapshot` / `restore`.
   - e2e: the bots keep their names, tiers and teams, and Control's zones keep their owners.
4. **Battle royale.**
   - `BrMatch.snapshot` / `restore`: bots with kit and timers, ring progress, the surge, pods, `nextKey`, the judge's placings.
   - e2e: in a trios match with bots, the host's page is closed mid-ring. After that, the ring keeps its stage and its timer, the bots keep their squads, the loot the host dropped is still there, and the match ends with a winner.
   - The eight-page `npm run rehearsal` gets a `--kill-host` flag, to measure the gap in seconds and the snapshot's upload.

## Config (`net.json`, `migrate`)

- `snapshot`: seconds between snapshots to the heir (1).
- `claim`: seconds the heir keeps trying for the code (20).
- `on`: false turns migration off (the match ends, as now). `?migrate=0` in the address does the same, for comparison.

## Risks

- **The broker's id release.** If PeerJS's cloud broker holds a dead peer's id longer than `claim`, the fresh code over the direct links is the fallback. Phase 2 measures this over the internet before anything else is built on it.
- **Split brain.** A host that was only cut off from one guest is still alive. The heir only takes over when it has itself lost the host. A guest that reaches a different host from the one it knew is refused unless that host's `hostId` matches the `heir` message it last had.
- **Mixed builds.** An older guest can't be an heir. The host only names an heir whose hello said it supports migration. An older guest that loses its host behaves as now, and stays in if the heir's code claim lands, because its rejoin is the same message.
