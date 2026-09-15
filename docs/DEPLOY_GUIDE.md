# Deploy Guide: from this folder to a link a friend can open and 1v1 you

> **The game's own server** (a proper address like `boogrange.duckdns.org`,
> our own matchmaking, a relay for strict networks, online boards) is in
> **`docs/SERVER_GUIDE.md`**. This guide is the GitHub Pages link, which keeps
> working as a backup: the same build falls back to the public broker there.

The concrete, do-it-now guide. Cost: $0. Time: about ten minutes the first
time, one command after that.

Target: the public build (`npm run build:beta`, codenames only, no source, no
real names) on **GitHub Pages**, served over HTTPS from the repo
`https://github.com/incomeimprovement99-netizen/FPSfun`. The game is a
static site, so Pages is all it needs: no server, nothing to keep running.
The 1v1 goes browser to browser (WebRTC); the free PeerJS broker only
introduces the two.

## 0. What you get

- The game at **https://incomeimprovement99-netizen.github.io/FPSfun/**
  (HTTPS, which browsers require for pointer lock, raw mouse input and
  WebRTC).
- Everything in the menu: the range, both courses, 1v1 and 1v1v1 by code,
  bots, loadouts, stats (per browser).
- Weapon and optic names are the codenames (PROJECT_RULES.md section 2);
  `tools/beta-check.ts` refuses to publish a build with a real name in it.
- The source stays in the `main` branch of the repo; the site is the
  `gh-pages` branch, which only ever holds `dist/`.

## 1. Prerequisites (already true on this PC)

- Node 20 or 22, `npm install` done, `npm run assets` and `npm run models`
  done (the CC0 textures and props are not in git; `dist/` needs them).
- Git with the credential manager signed in to GitHub as the repo owner
  (it is: the `main` push below used it).
- The repo exists and `origin` points at it:
  `git remote -v` shows `https://github.com/incomeimprovement99-netizen/FPSfun.git`.

## 2. Publish the site (once per release)

From `C:\Users\jwilb\Downloads\apex-range`:

```
npm run deploy
```

That runs `tools/deploy-pages.ts`: `npm run build:beta` (typecheck, the
public build, the real-name check), writes `dist/.nojekyll`, and force-pushes
`dist/` as the `gh-pages` branch. It prints the URL at the end. About a
minute.

## 3. Pages is on (done)

GitHub switched Pages on by itself when the `gh-pages` branch arrived (the
repo is public). It serves that branch at
**https://incomeimprovement99-netizen.github.io/FPSfun/**, confirmed live
with the textures and props loading and a real 1v1 between two browser pages
over the public broker (`npm run live` runs that check any time).

If it ever shows as off: https://github.com/incomeimprovement99-netizen/FPSfun/settings/pages,
Source "Deploy from a branch", branch `gh-pages`, folder `/ (root)`, Save.

If the repo is private: GitHub Pages on a private repo needs GitHub Pro. The
fix is Settings, General, Danger Zone, **Change visibility** to public. The
public branch only holds the built site; the source stays wherever you keep
it (see section 7 if you want the source private too).

## 4. Play a 1v1 with a friend

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

## 5. When it does not connect

- **"Could not reach the matchmaking server"**: the public PeerJS broker
  (0.peerjs.com) is down or rate-limited. Try again in a minute. The
  permanent fix is the game's own server (`docs/SERVER_GUIDE.md`), which has
  its own broker.
- **"No match with that code"**: a typo (codes never contain 0, O, 1, I or
  L), or the host closed the tab. Make a new match.
- **"Found the match but could not connect to the host"** (after 20 s), or
  connected and then "Lost the connection": one of you is on a network that
  blocks direct peer connections (some offices, schools, university halls,
  phone hotspots, VPNs). Pages has only PeerJS's shared public relay; the
  game's own server has its own. Try from home wifi, or with the VPN off.
- **Nothing happens on a phone**: it is a PC game; the menu says so.
- **The other player freezes**: their tab was hidden, or their browser
  throttled it. Alt-tabbing is fine (frames keep running on a timer); a
  minimised Chrome for minutes is not.
- **Ctrl+W closed the tab**: Settings, "Fullscreen while playing" is on by
  default and stops that in Chrome; windowed, the browser asks first.

## 6. Updating

Make changes, run the checks, commit to `main`, then:

```
npm run verify
npm run e2e          # needs npm run dev running in another terminal
git add -A && git commit -m "..."
git push
npm run deploy
npm run live         # optional: plays a 1v1 on the live site to prove it
```

Pages picks up the new `gh-pages` commit within a minute; players need a
reload (Ctrl+Shift+R if the old bundle sticks: the file names carry a hash,
so a plain reload is normally enough).

## 7. Keeping the source private (optional)

Today `main` (the source, with the reference data and the real names in
`data/weapons.json`) and `gh-pages` (the built site) are in the same repo, so
if the repo is public the source is public. To keep the source private for
$0: make this repo private and create a second, public repo for the site
only (`FPSfun-site`), then point the deploy at it:

```
git remote add site https://github.com/incomeimprovement99-netizen/FPSfun-site.git
```

and change `origin` to `site` in `tools/deploy-pages.ts` (one line). Switch
Pages on in the site repo instead. Nothing else changes.

## 8. Other hosts, if you prefer

`dist/` is a static folder. Netlify (drag the folder onto app.netlify.com/drop)
and Cloudflare Pages (connect the repo, build command `npm run build:beta`,
output `dist`) both work and are free; both need `npm run assets` and
`npm run models` in the build step or the textures will be missing. The
paths in the build are relative (`base: "./"`), so any folder on any host
works.
