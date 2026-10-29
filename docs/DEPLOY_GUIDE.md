# Deploy Guide: from this folder to the live game, and a 1v1 with a friend

The game lives at **https://fpsfun.duckdns.org/**, on its own server: an Oracle Always Free VM with the game under pm2,
Caddy in front for HTTPS, our own broker for the match codes and our own relay for friends on strict networks. Setting
the server up is **`docs/SERVER_GUIDE.md`**; this guide is shipping to it and playing on it. (A GitHub Pages mirror
stood beside it until the owner stopped its deploys on 2026-09-27; its tool, its branch and its site went in Milestone
600.)

## 0. What you get

- The game at **https://fpsfun.duckdns.org/** (HTTPS, which browsers require for pointer lock, raw mouse input and
  WebRTC).
- Everything in the menu: the range, the courses, 1v1 and 1v1v1 by code, the modes, the battle royale with friends,
  bots, loadouts, the online boards and the optional accounts on the Stats tab.
- Guns are named by their codenames, optics and hop-ups generically (PROJECT_RULES.md section 2); `tools/beta-check.ts`
  refuses to ship a build with a real name in it.

## 1. Prerequisites (already true on this PC)

- Node 20 or 22, `npm install` done, `npm run assets`, `npm run sounds` and `npm run guns` done (the CC0 textures,
  recorded sounds and gunshots are not in git; the build needs them). The first leaves its textures as WebP. `npm run guns` fetches a 194 MB archive once, into the temp folder, and writes 2.4 MB of takes;
  `npm run sounds` also fetches the 3.3 MB drop theme into `public/audio/music`. Run them in `apex-range` as well as in
  a worktree: the release gate refuses to build without them.
- `.env.server` at the repo root (not in git) with `RANGE_HOST`, `RANGE_KEY` and `RANGE_DOMAIN`
  (`docs/SERVER_GUIDE.md`). The game's box is **not** the Algonomics trader's, and nothing here ever touches that one.

## 2. Ship a release

From `C:\Users\jwilb\Downloads\apex-range`, with the release on `main` and pushed:

```
npm run fps backup     # the boards, the accounts and the visit log down to server-backup/
npm run fps deploy     # the release gate, the public build of the last commit, ship, reload, check, a live 1v1
```

`npm run fps deploy` runs the release gate first (`npm run verify`, `npm run rules` and the recorded sounds on disk:
`tools/release-gate.ts`), builds the **last commit** in a clean copy (whatever is half-edited here is left out), packs
it with `server/game/`, copies it to the box, swaps it in, reloads pm2, checks `/health`, and then plays a 1v1 on the
live site through its own broker (LIVE CHECK). `npm run fps rollback` puts the previous release back. Only one deploy
at a time: they share `apex-range/dist`.

If the LIVE CHECK fails right after the restart on "the host gets a match code", run `npm run live` on its own a
minute later before anything else: it has passed every time so far.

## 2b. The bought assets (the soldier, the guns, the city)

The owner's Unity Asset Store purchases (the Sci-Fi Modular Soldier, the Sci-Fi Battle Weapons and Daelonik's Neon City
bundle) are licensed to the owner, not the public, so they never enter git. (The five ILranch city packs the city
before the Neon City was dressed in went with it on 2026-10-09; their bakes are kept outside the game, in
`speedkills-paid\old-city\`.)

- **Where they come from:** Unity keeps each download as a `.unitypackage` under
  `%APPDATA%\Unity\Asset Store-5.x\` (download them in Unity's Package Manager, My Assets).
- **Making what the game loads:** `npm run paid` (or `PAID_ONLY=soldier` or `weapons npm run paid`) unpacks them into
  `C:\Users\jwilb\Downloads\speedkills-paid\` and writes `public/models/paid/`, which git ignores; `npm run rules` fails
  if any of it is ever tracked.
- **The Neon City map** (Phase 28): Daelonik's Neon City bundle, four packages (download them in Unity's
  Package Manager). `npx tsx tools/neon-layout.ts` writes the placements into `src/config/neonmap.json`, then
  `GAME=speedkills NEON=bake NEON_SIZES=lo,hi,max npx tsx tools/import-neon.ts` bakes
  `public/models/paid/neon/neonmap-v<version>-<size>.glb` (lo 183.9 MB, hi 264.1 MB, max 557.4 MB; about 9 minutes on
  every core with the machine idle, half an hour with it in use) and writes the collision to `src/config/neon/neonmap.solids.json` and the pads and measurements back to
  `neonmap.json`, all in git, so commit them. `NEON_SIZES=preview` (256 px) is for looking at a layout, and the gallery
  sheets under `neon/gallery/` are for choosing pieces: neither goes to the server, so copy only the three
  `neonmap-v<version>-{lo,hi,max}.glb` into `apex-range`'s `public/models/paid/neon/` before a deploy.
  Every file under `public/` ships with a release, so an older version's three files are moved out when a new one
  goes in (to `speedkills-paid/neon/old-bakes/`): three versions left there were 1.4 GB sent with every deploy that
  no build asked for.
- **The guns' sounds:** `npm run paid:sounds` writes the FPS Animation Ultimate pack's recordings the guns use
  (`src/config/packsounds.json`) to `public/audio/paid/` (44 files, 3.2 MB), which git ignores and `npm run rules`
  refuses if tracked. It reads the pack `npm run paid` unpacked (or unpacks it) and the reload clips' lengths from
  `public/models/paid/arms/clips/`. A deploy builds from `apex-range`: run it there, or copy a worktree's
  `public/audio/paid/` into it. Without them every gun sounds as before (the free recordings and the synthesis).
- **The guns' skins:** `PAID_ONLY=weapons npm run paid` writes each one twice, `public/models/paid/weapons/tex/` at
  1024 px and `weapons/tex2k/` at 2048 (270 files, 40 MB); the 2048 ones are loaded only for the gun in your hands on
  High (`paidweapons.json` textures2k).
- **Shipping them:** `npm run fps deploy` carries `public/models/paid/` to the game server, so **run it from a copy
  that has the files** (run `npm run paid` there, or copy the folder in: a re-import in a worktree lands only in that
  worktree's `public/`, and a deploy of the code without the files it names leaves the city undrawn). Without the
  soldier's files a figure is its hit volumes alone.
- **A re-import** is seen at once only if `version` in `src/config/soldier.json` (or `paidweapons.json`, or
  `neonmap.json`) goes up: the server keeps `/models/` for a day.

## 3. Play a 1v1 with a friend

1. Both of you on **Chrome or Edge on a PC** (Firefox works without raw
   mouse input; Safari and phones are not supported, and the page says so).
2. You: open the link, **1v1 tab**, leave "2 players", **Create match**. A
   5-letter code appears with an **invite link**, copied to your clipboard.
   Send the link (Discord, text, anything).
3. Friend: opens the link. It joins your match by itself. (Or: 1v1 tab,
   type the code, **Join**.)
4. Both screens say connected. **Click Play** (both of you; the match holds
   at "WAITING FOR EVERYONE TO CLICK PLAY" until the last one is in). A 3 s
   countdown, then fight: first to 3 rounds, blue shields, 100 health. 20 s
   into a round the circle in the middle goes live; alone in it for 10 s
   takes the round.
5. Esc, 1v1 tab, **Leave match** to stop. A rematch starts by itself after
   the match screen.

For three: choose "3 players" before Create match; both friends open the
same link; it starts once all three have clicked Play.

With a controller: plug it in, press **Start** instead of clicking Play
(Start also brings the menu back). Settings tab for the look speed, curve
and deadzone.

Loadouts: the Loadouts tab, before or during a match (weapons swap at once).
Your name for the kill feed: the Stats tab.

## 4. When it does not connect

- **"Could not reach the matchmaking server"**: the server's broker did not answer (`npm run fps health` says why), or
  the page could not reach the site at all. Try again in a minute.
- **"No match with that code"**: a typo (codes never contain 0, O, 1, I or
  L), or the host closed the tab. Make a new match.
- **"Found the match but could not connect to the host"** (after 20 s), or connected and then "Lost the connection":
  one of you is on a network that blocks peer connections (some offices, schools, university halls, phone hotspots,
  VPNs). The server's own relay carries the match then; if it still fails, `npm run fps check` tests the relay's ports
  from this PC.
- **Nothing happens on a phone**: it is a PC game; the menu says so.
- **The other player freezes**: their tab was hidden, or their browser
  throttled it. Alt-tabbing is fine (frames keep running on a timer); a
  minimised Chrome for minutes is not.
- **Ctrl+W closed the tab**: Settings, "Fullscreen while playing" is on by
  default and stops that in Chrome; windowed, the browser asks first.

## 4b. A battle royale, or a mode, with friends

The same codes and invite links: on the 1v1 tab, pick the mode in the first
box before **Create match**: **"Battle royale: a squad against the bots"**,
Gun Run, team deathmatch, Crown or Control (and the squad or player count), then send
the invite link. When everyone has clicked Play the match starts with what
the host set: the bots and their difficulty, Gun Run's list, whether
abilities are on, and for the battle royale whether you land with nothing
and loot. The host's browser runs the bots, the ring, the loot and the
modes' rules, so the host's connection is the one that matters.

In a battle royale squad there are no knockdowns: out, what you had goes down
loose where you fell with your echo beside it, and a squad mate can hold E for 7 s at the echo to bring you
back there with what you died with; the middle mouse button pings for the squad (twice for an enemy).

## 5. Updating

Make changes, run the checks, commit to `main`, then:

```
npm run verify
npm run rules
E2E_ONLY=<section> npm run e2e   # needs npm run dev running; the section the change touches
git push
npm run fps backup
npm run fps deploy
npm run live         # optional: plays a 1v1 on the live site again
```

The full e2e and its batches are the once-a-day regression sweep, not every release.

The figures' animation files (`public/models/mannequin/`, 1.6 MB, CC0)
are in git and in every build; every figure plays their clips (SpeedKills'
soldier through them carried over to its rig), so every player downloads them
(a figure is its hit volumes until they have loaded). `npm run clips` remakes them from
the library with the clips `tools/fetch-clips.ts` lists, and
`tools/checks/clips.ts` (in verify) fails a file carrying a clip nothing plays.

Players need a reload after a release (Ctrl+Shift+R if the old bundle sticks: the file names carry a hash, so a plain
reload is normally enough).
