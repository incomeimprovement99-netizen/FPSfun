# Deploy Guide: from this folder to a link a friend can open and 1v1 you

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

1. Both of you open the link in **Chrome or Edge on a PC** (Firefox works
   without raw mouse input; Safari and phones are not supported).
2. Both: **Play tab, Firing Range** once, to click into the game (the browser
   needs one click before it will lock the mouse). Esc brings the menu back.
3. You: **1v1 tab**, leave "2 players", **Create match**. A 5-letter code
   appears and is copied to your clipboard. Send it (Discord, text, anything).
4. Friend: **1v1 tab**, type the code, **Join**.
5. Both screens say connected. **Click Play** (both of you; the match holds
   at "WAITING FOR EVERYONE TO CLICK PLAY" until the last one is in). A 3 s
   countdown, then fight: first to 3 rounds, blue shields, 100 health. 20 s
   into a round the circle in the middle goes live; alone in it for 10 s
   takes the round.
6. Esc, 1v1 tab, **Leave match** to stop. A rematch starts by itself after
   the match screen.

For three: choose "3 players" before Create match; both friends join with
the same code; it starts once all three have clicked Play.

With a controller: plug it in, press **Start** instead of clicking Play
(Start also brings the menu back). Settings tab for the look speed, curve
and deadzone.

Loadouts: the Loadouts tab, before or during a match (weapons swap at once).
Your name for the kill feed: the Stats tab.

## 5. When it does not connect

- **"Could not reach the matchmaking server"**: the public PeerJS broker
  (0.peerjs.com) is down or rate-limited. Try again in a minute. The
  permanent fix is our own broker (NEXT_STEPS 7).
- **"No match with that code"**: a typo (codes never contain 0, O, 1, I or
  L), or the host closed the tab. Make a new match.
- **Connected, then "Lost the connection"** within seconds: one of you is on
  a network that blocks direct peer connections (some offices, schools,
  university halls, phone hotspots, VPNs). No TURN relay is configured yet
  (NEXT_STEPS 7). Try from home wifi, or with the VPN off.
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
