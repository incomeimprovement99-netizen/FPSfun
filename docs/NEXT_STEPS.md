# Next steps, in order

What to build next and what each one needs. "Server" means a process that
runs somewhere and costs a little; everything without it stays a static site.

## 1. Publish and get people in (no server)

- Push the private repo, put the public build on a static host with HTTPS
  (README, "Deploy"). Done in the same session as this file if you say where.
- Share a link and a code. The 1v1 and 1v1v1 work between friends today.

## 2. Online leaderboards (a small server, free tier)

The code is written: `server/leaderboard/worker.ts` (a Cloudflare Worker with
a KV store) and the client `src/game/leaderboard.ts`. Deploying it takes your
Cloudflare account, ten minutes, and two build variables (the worker's URL and
a shared secret). Then every course run and every match win is posted under
the player's name, and the Stats tab shows the boards: best times per course,
most 1v1 wins, most 1v1v1 wins, bot wins by difficulty.

What it does NOT give you: trust. The game posts its own scores, so a player
who opens the browser console can post anything. That is fine for friends and
a beta; for a public ladder see 5.

## 3. Accounts and cross-device saves (a server plus a login)

Today the profile (name, stats, loadouts, bests) lives in one browser. To
follow a player across devices: a login (Google, Discord, or email link via a
service like Supabase or Clerk, all with free tiers) and the profile stored
against it. Two or three days. Brings friends lists and "invite" instead of a
typed code.

## 4. Better network for the matches (a server, a few dollars a month)

- Our own PeerJS broker (`peerjs-server`, one Node process) so match codes
  do not depend on the public one.
- A TURN relay (coturn, or a hosted one) so strict networks (offices,
  schools, some mobile carriers) can connect. Today they cannot.
- Together: a day of work.

## 5. More than three players, and results you can trust (a game server)

Everything above keeps the game peer to peer with the shooter deciding hits.
That stops scaling at three (the host relays everything) and it is trivially
cheatable. The next step is an authoritative server: Node with Colyseus or a
plain WebSocket server running the movement and the hit checks, browsers as
clients. The movement code (`player.ts`) and the projectile system are already
free of rendering, so they run on the server as they are. Two to four weeks.
Gives: lobbies, 2v2 and free-for-all, kill feeds everyone agrees on, ranked
boards worth having, spectating, replays.

## 6. Feel, from the Apex and Hyper Scape side

- **Bots that use the movement**: today they walk. Give them the player
  controller and a short list of moves (slide into cover, jump a low wall,
  wallbounce out of a corner) and the bot mode becomes real practice.
- **Tech trainer with timing bars**: the feed says why a miss missed; a
  trainer screen could show the superglide as a bar with the frame you
  pressed on, and score ten tries.
- **Wall run, double jump, hack pickups** are Hyper Scape's, not Apex's, and
  would break the feel this is built for. If you want a Hyper Scape mode, make
  it a separate arena with its own rules rather than mixing them.
- **Crown Rush**: Hyper Scape's endgame (carry the crown 45 s to win) fits the
  circle mechanic well as a 1v1v1 variant: a crown spawns in the middle, the
  carrier is slower and shown to all, hold it 30 s. An afternoon.
- **Kill feed, round summary card, damage dealt per round**: the numbers are
  collected already (Stats tab); showing them in the match is a HUD job.
- **Key rebinding screen**: `binds.json` is data, a screen to edit it is half
  a day.
- **Animated characters**: the figures are rigid. A rigged model with run,
  crouch, climb and zip poses is the single biggest visual step and needs an
  artist or a CC0 rig (Quaternius has some).

## 7. When to leave the browser

Only for a frame rate cap without browser flags (a desktop wrapper: Electron
or Tauri, same code), or for a native engine if you want big maps, many
players, anti-cheat or high-end graphics. Everything in 1 to 6 stays in the
browser. See README, "When it would need to leave the browser".
