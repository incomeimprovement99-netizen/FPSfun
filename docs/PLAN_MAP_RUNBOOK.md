# Runbook: the Neon City from version 133 to the finish

Written 2026-11-05 by the map agent, while version 133's high and max bakes ran, for the owner's ask: "detailed end to
end plan ... so you can just follow along. Like if we were to hand it off to a much lower capable model". It is the map
agent's whole loop written down: every command, what it should print, what to do when it does not, and the order of
the work. An executor that follows it step by step should not need to decide anything this page does not decide, and
should stop and ask the owner only where it says so.

The finish plan (docs/PLAN_CITY_FINISH.md) says what is left and why; the review record (docs/CENTRE_REVIEW.md) holds
every review. This page says how.

---

## 0. Read first

### 0.1 Rules that do not bend (from CLAUDE.md, and why they matter here)

- **Never touch the Algonomics VM (147.224.132.60).** It runs a live real-money trader. The game's server is the
  separate Oracle box at fpsfun.duckdns.org. No command in this page talks to any other host.
- **No e2e tests until the owner says so** (the owner, 2026-11-05: "wait to do any e2e tests until later tonight, i'll
  explicitly say, only test any new code"). The map's own checks (sk-neon), verify, rules and tsc are not e2e and run on
  every change.
- **Gameplay numbers live in config with a `_note`.** Numbers about the world are measured (by a tool, a picture, the
  pack's own files), never typed by eye, and the note says how they were measured.
- **Every new check is proven:** put the fault back on a copy, watch the check fail, restore from the copy (SOP-D).
- **Comments say why. No em-dashes in prose** (roadmap milestone headings keep their " — " by convention). **No real
  game names** in anything the public build ships (docs are not shipped, but keep them out of config notes and code).
- **Commit messages are prose** and end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **One deploy at a time.** The lobby agent and the character agent deploy from the same apex-range. Announce before,
  deploy alone, announce done (SOP-H).
- **Never hand-splice placements** in src/config/neonmap.json. Edit `rules` (and the tools); the layout writes the
  placements (`chunks`). A string that appears in `rules` also appears many times in `chunks`: an anchor for a scripted
  edit must include its key (`"road": "..."`), never the bare value.
- **Never edit neonmap.json, src/ or tools/ in apex-city while a bake, a layout or a check runs there.** The bake reads
  the config at its start and the layout rerun writes it at its end.
- **Stop and ask the owner only for:** money, which of two designs they prefer, something destructive or outward-facing
  not covered here, or when they say pause. Everything else (a failing check, a bad picture) is work: fix it, measure it,
  say what was found.

### 0.2 Where things are

| Name | Path | What it is |
|---|---|---|
| apex-city | `C:/Users/jwilb/Downloads/apex-city` | the map agent's worktree, branch `city`. All map work happens here. |
| apex-range | `C:/Users/jwilb/Downloads/apex-range` | `main`. Only the fast-forward merge, the GLB copy, push and deploy happen here. |
| apex-net | `C:/Users/jwilb/Downloads/apex-net` | the lobby agent's e2e worktree. Never touch. It reads the map GLBs in apex-range through a link. |
| T | `C:/Users/jwilb/AppData/Local/Temp/neon` (`/c/Users/...` in bash) | the map agent's scratch: scripts, logs, pictures, reviews, proposals. |
| PAID | `C:/Users/jwilb/Downloads/speedkills-paid` | the bought packs, unpacked. `neon/catalogue.json` (each piece's size), `neon/extract/` (materials and textures by guid). |
| the config | `apex-city/src/config/neonmap.json` | rules (hand-edited) and placements (written by the layout). `version` at its top. |
| the collision | `apex-city/src/config/neon/neonmap.solids.json` | written by the bake. |
| the bakes | `apex-city/public/models/paid/neon/neonmap-v<version>-{lo,hi,max}.glb` | git ignores them; copied into apex-range before a deploy. |
| the map check | `apex-city/tools/checks/sk-neon.ts` | 385 checks on version 133; walks with the game's real Player. |
| the layout | `apex-city/tools/neon-layout.ts` | rules to placements. |
| the bake | `apex-city/tools/import-neon.ts` | placements to GLBs and collision. |
| photo tool | `apex-city/tools/.scratch/neongame.ts` (untracked, never commit) | the game in headless Chrome at listed spots. |
| probe tool | `apex-city/tools/.scratch/neonpick.ts` | the same, with page code and pixel picks. |
| contact sheet | `apex-city/tools/.scratch/trio.mts` | `npx tsx tools/.scratch/trio.mts <out.png> <width> <cols> <files...>` |
| crop | `T/crop.cjs` | `node T/crop.cjs <in> <out> <left> <top> <w> <h> <scale>` (pictures are 1600 by 900) |
| pack material tools | `apex-city/node_modules/.scratch/matmean.mts`, `matinfo.mts`, `texout.mts` | a material's colour map mean; its texture slots and strengths; a texture written out as a png |

Never commit: `tools/.scratch/`, `tools/neon-graph.ts`, `.map-expansion.js`, `9.19.26-PROGRESS.MD`,
`docs/updates/temp.txt`. Stage files by name, never `git add -A`.

Ports: 5213 the map agent's vite (the photo scripts start and stop it), 5211 the guns agent's, 5194 the lobby's sweep,
5198 the character agent's, 5199 the lobby agent's. Never stop a vite that is not on 5213.

### 0.3 The scripts in T

| Script | Run as | What it does | Ends with |
|---|---|---|---|
| `lodet.sh <name>` | detached (SOP-A) | runs `T/<name>` with output to `T/<name>.out`, then `exit N` and a `T/<name>.done` file | `<name>.done` |
| `bake662.sh <size> <tag> <timeout>` | inside a go script | one bake at `lo`, `hi` or `max`; copies the config to `cfg<tag>-a.json`; reruns the layout; diffs the config into `diff<tag>.txt` | prints `diff lines: N` |
| `cfgdiff.py a b` | by bake662 | the structural diff of two configs | lines of differences |
| `fullv.sh <n>` | inside a go script | the hi bake then the max bake (`<n>h`, `<n>m`), output `full<n>.out` | `full<n>.done`, `hi exit 0`, `max exit 0` |
| `lookday.sh <outdir>` | `SPOTF=<spots.json>` | vite on 5213, the photo tool at the spots, golden hour, the competitive preset (the low bake) | `<n>` pictures, `page errors (0): none` |
| `pick.sh <outdir>` | `SPOTF=`, `PROBE=` | the probe tool | the picks |
| `shootR17.sh` | detached | the review pictures (centre round 17, districts round 11) on the default preset | counts and page errors |
| `docs9.py <V> <road.md> <diary.md> "<detail>"` | `DAY=<yyyy-mm-dd>` | appends the roadmap part and the diary part, writes the deploy guide's bake sizes | `docs done lo .. MB, hi .., max ..` |
| `mkbriefs17.py` | done | wrote `review-brief-r17.txt` and `review-districts-brief-r11.txt` | |

A go script (`goNN.sh`) is a plain bash file in T that chains these. Template in SOP-B.

---

## 1. Standing procedures (SOPs)

### SOP-A: run a long job detached and wait for it

Background shell jobs die at 2 hours, and a session can end under them. Long work runs detached so it survives:

1. Write the job as a bash file in T (`T/goNN.sh`), `chmod +x` it.
2. Start it from PowerShell, passing the **bare file name** (a full path makes no `.out` and runs nothing):
   ```
   Start-Process -WindowStyle Hidden -FilePath 'C:\Program Files\Git\bin\bash.exe' -ArgumentList '/c/Users/jwilb/AppData/Local/Temp/neon/lodet.sh','goNN.sh'
   ```
3. Confirm `T/goNN.sh.out` exists a few seconds later (length 0 is fine).
4. Wait with a background bash: `until [ -f T/goNN.sh.done ]; do sleep 30; done; tail -20 T/goNN.sh.out`.
5. If the wait job itself dies (2 hours, or the session ended), the detached job is still running: check `.out`, the
   newest logs in T and the processes (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`), and wait again.

### SOP-B: the low bake loop (one per change)

Template (`T/goNN.sh`):
```bash
#!/bin/bash
# what this version carries, in one line
T=/c/Users/jwilb/AppData/Local/Temp/neon
cd /c/Users/jwilb/Downloads/apex-city
GAME=speedkills timeout 1800 npx tsx tools/neon-layout.ts > $T/layoutNN.log 2>&1 || { echo "layout failed"; tail -8 $T/layoutNN.log | cut -c1-370; exit 1; }
for n in a b c d; do
  bash $T/bake662.sh lo NN$n 5400 || exit 1
  [ "$(wc -l < $T/diffNN$n.txt)" = "0" ] && break
done
GAME=speedkills npx tsx tools/checks/sk-neon.ts > $T/sknNN.log 2>&1
grep -n "FAIL" $T/sknNN.log | cut -c1-400; tail -1 $T/sknNN.log
```
- **Expected:** `diff lines: 0` within one to four bakes (each 10 to 30 minutes), then `all passed`.
- **If the diff never reaches 0 in four bakes:** the layout and the bake disagree (a placement moves each time). Read
  the last `diffNNd.txt`: the path names the rules block. Usually a perch or a fill that reads the last collision. Fix
  the rule (not the placement), rerun the loop.
- **If the layout fails:** read `layoutNN.log`'s tail. A thrown "no material" means a material spec names something the
  pack lacks (check with `matinfo.mts`).
- **If sk-neon fails:** each FAIL line names the check and its numbers. A failure in a check the change did not touch is
  still the change's fault until shown otherwise (walls cutting a route, cover over a stair). Fix, rerun the loop.
- **The pre-existing warning** "drawn face up over another in the same plane: 9.5 m2 at -3.5 m ..." has been in every
  bake since version 131. It is not new; leave it.

### SOP-C: reading the checks

`T/sknNN.log` lines start `  ok  ` or `FAIL  `; the last line is `all passed` or `N FAILED`. Each line ends with its
measured numbers in brackets. A check's text names the milestone and the review words it answers (in sk-neon.ts, the
comment above each check). Count with `grep -c "  ok" T/sknNN.log`.

### SOP-D: proving a new check (put the fault back, restore from a copy)

1. Write a proof script (template `T/proof48.sh`): copy the config to `T/cfgNN-proof-keep.json`; apply the fault with a
   python replace whose anchor includes its key and is asserted to occur once; run sk-neon to `T/sknNNproof.log`; copy
   the keep file back; `cmp` it (`restored`); print the FAIL lines.
2. **Expected:** `restored`, exactly one FAIL, the new check, with the fault's number in its brackets.
3. **Never** undo with `git checkout --` (it has eaten uncommitted work twice).
4. **After any stop or crash while a proof might have been running:** before anything else reads the config,
   `cmp src/config/neonmap.json T/cfgNN-proof-keep.json`; if they differ only by the fault, copy the keep file back. (On
   2026-11-04 the PC stopped mid proof and left the road's fault in the config; the next bake would have shipped it.)
5. Run proofs only when no bake, layout or check is running in apex-city.

### SOP-E: photographs, and how to read them

1. A spot file is a JSON list of `[name, [eye x, y, z], [look x, y, z]]` in map-local metres (y is height; a standing
   eye is 1.7 m over its floor). Review spots: `T/review-spots-day7.json`, `T/review-spots-night2.json`,
   `T/review-districts-day3.json`, `T/review-districts-night.json`.
2. `SPOTF=<file> bash T/lookday.sh <outdir>` (5 to 10 minutes). Pictures land as `T/<outdir>/day-<name>.png`.
3. Make sheets of four: `cd apex-city; npx tsx tools/.scratch/trio.mts T/<outdir>/sh1.png 1600 2 <four files>`. Look at
   every sheet. Crop anything doubtful big (`crop.cjs`, scale 2).
4. **What to look for, every time:** the change is there and reads as what it is; nothing floats, clips or hides a way;
   no black faces by day; no camera inside geometry (a frame of one flat colour, a yellow outline at the camera); text
   readable at its distance (in-world letters about 9 cm per 3 to 4 m of distance); the ground not a void or a smear;
   no new fault in the frame. A passing check does not prove a look: the road passed every check and read as sand.
5. If a review spot's picture is broken by geometry that is right (a new wall in front of the old camera), move the
   spot (a few metres, same subject and heading) and write the move in the next review's brief.

### SOP-F: the high and max bakes

1. Only after the low loop converged, sk-neon passed and the photos are accepted.
2. Go script line: `bash $T/fullv.sh NN; grep -v "^item\|^val\|^len" $T/fullNN.out | cut -c1-200 | tail -12`.
3. **Expected:** about 60 to 110 minutes; `hi exit 0`, `max exit 0`, and each rerun's `diff lines: 0`.
4. **If a rerun's diff is not 0:** the config moved. Run one more low loop (SOP-B) and then the full bakes again.
5. **Run sk-neon again after the full bakes.** Each bake writes its own statistics into the config (`baked.draw`, the
   centre's batches and the primitives left one a material), and the draws check (Milestone 657: 220 primitives at most
   at every size) reads them; after the low loop alone it still reads the previous version's hi and max. On 2026-11-05
   version 133's max bake drew the centre in 222 (14 batches and 208 materials left, four of them new glow variants of
   the pack's light and glass materials, which a batch cannot hold). The fix was to reuse existing materials, not a looser
   check. A new `~#`, `^#` or `|#` variant of a light, glass or detail-mapped material costs a primitive; prefer one
   that already exists (`T/left133.txt` lists them; `node_modules/.scratch/glbmats.mts <glb>` writes the list).
5. Sizes for the docs: `ls -la apex-city/public/models/paid/neon/neonmap-vNNN-*.glb` (docs9.py reads them itself).

### SOP-G: the docs for a version

1. Roadmap part: a file `T/roadNN.md` starting `## Milestones A to B — <what>`, an intro paragraph (which reviews,
   their scores, who measured what), then one bullet per milestone: `- **<n>, <title>** (<the review words it answers,
   with picture numbers>): <what was built, the measured numbers, what was tried and rejected>`, then the bullets
   `- **Checks that learned the new work:** ...` and `- **Checked:** {DETAIL}. verify, rules and tsc. Map files version
   {V}: {SIZES}.` (docs9.py fills the three braces). Model: T/road38.md, T/road39.md.
2. Diary part: `T/diaryNN.md`, one bold sentence and a short paragraph in plain words for a player (model:
   T/diary39.md).
3. Run, from anywhere: `DAY=<today> python T/docs9.py <version> T/roadNN.md T/diaryNN.md "<detail>"`. Expected `ok
   docs/DEVELOPMENT_ROADMAP.md`, `ok docs/updates/<day>.md`, `ok docs/DEPLOY_GUIDE.md`, `docs done ...`.
4. Run it **after** apex-city is fast-forwarded to main (SOP-H step 3), so the diary file of the day is main's and the
   append lands on it.
5. docs/PLAN_CITY_FINISH.md: one line under the last "After the Nth reviews" bullet saying what this version took.
   README and the deploy guide: only if they describe something this version changed (grep them for the feature).

### SOP-H: commit, merge and ship

1. **Check the field:** list the other sessions (ListAgents). If one has announced a deploy and not announced done,
   wait for its done message.
2. **Main's moves:** `git -C apex-city merge-base --is-ancestor HEAD main && echo ok` (city's last commit is in main).
   `git -C apex-city diff --stat HEAD main -- <every file this version changed>` should print nothing (no other agent
   touched them).
3. **Fast-forward the worktree to main:** `git -C apex-city merge --ff-only main`. With the version's changes still
   uncommitted this works when main touched none of them. If git refuses ("would be overwritten"), stop: commit the
   version first, then `git rebase main` in apex-city, resolve (roadmap and diary conflicts: keep both sides, in
   order), and continue.
4. **Checks on the merged tree:** sk-neon (SOP-B's last two lines, `all passed`); `npx tsc --noEmit` (only the two
   known errors in the untracked `tools/neon-graph.ts` may appear); `npm run verify`; `npm run rules`. No e2e unless the
   owner has said so.
5. **Docs** (SOP-G).
6. **Commit in apex-city:** `git add` each changed file by name (the config, the collision, world.json, each changed
   src/game and tools file, the roadmap, the day's diary, the deploy guide, this page if changed); `git status --short`
   must show only the never-commit list as untracked; `git commit -F T/commitNN.txt` (prose, the Co-Authored-By line
   from 0.1).
7. **Copy the bakes into apex-range first:** `cp apex-city/public/models/paid/neon/neonmap-vNNN-{lo,hi,max}.glb
   apex-range/public/models/paid/neon/`. Leave the previous version's files there while any agent's sweep reads them.
8. **Announce:** to each live session (the lobby "general + bugs", the character agent "enemies + 3rd person views" if
   it is running, the ad agent "SK Video" if it is running): "Deploying map version NNN now (city agent): <one line>.
   apex-range main goes from <old> to <new>. Please hold any fps deploy until I say done."
9. **Merge, alone:** in apex-range, `git merge --ff-only city`; then `git log --oneline -1` must show the version's
   commit. If main moved since step 3, go back to step 3.
10. **Push:** `git -C apex-range push origin main`. Never leave main ahead of origin.
11. **Backup and deploy, from apex-range:** `npm run fps backup`, then `npm run fps deploy` (run in the background, up
    to 30 minutes). **Expected:** `LIVE CHECK PASS`. If it fails on "the host gets a match code" right after the
    restart, run `npm run live` alone once. If the site is broken, `npm run fps rollback` and tell the owner.
12. **Announce done:** "Map version NNN deploy done: LIVE CHECK PASS on <commit>. The fps deploy is free."
13. **Retire the old bake** once nothing reads it (the lobby says its sweep is done): delete
    `neonmap-v<old>-*.glb` from apex-city and apex-range (the owner's call: old bakes are deleted, not kept).
14. **Memory:** update `city-resume-point.md` (the version live, the next step).

### SOP-I: a round of fresh reviews

1. **Pictures:** the briefs are `T/review-brief-rNN.txt` (centre) and `T/review-districts-brief-rMM.txt`. Each lists
   every picture's path and what it shows. A shoot script (`T/shootRNN.sh`, model `shootR17.sh`) takes them on the
   final version's high bake through vite on 5213: centre day spots and night spots, districts day and night.
2. Run the shoot detached (SOP-A). Then check every path in both briefs exists:
   `grep -o "C:/[^ ]*\.png" T/review-brief-rNN.txt T/review-districts-brief-rMM.txt | cut -d: -f2- | while read p; do [ -f "$p" ] || echo "missing $p"; done`
3. Look at every picture (SOP-E). A broken shot (camera inside something, a black frame) is reshot from a moved spot
   before any reviewer sees it.
4. **Launch four fresh agents in one message**, each `subagent_type: general-purpose`, no model override (the scores are
   compared round to round, so the reviewer stays the same model), run in the background:
   - centre A and centre B: `Read the file C:/Users/jwilb/AppData/Local/Temp/neon/review-brief-rNN.txt and follow it exactly. It is your whole brief. Do not open any other file except the images it lists.`
   - districts A and B: the same with `review-districts-brief-rMM.txt`.
5. **Notes:** write `T/reviewNN-notes.md` in the shape of `T/review16-notes.md`: per reviewer a header line with the
   round, date, map version and overall; the scores line; "Ten changes:" numbered and cut short with picture numbers;
   "Broken:"; "Gap:" (centre) or "Whole map:" (districts).
6. **Record:** docs/CENTRE_REVIEW.md gets `## Round NN (the centre) and the districts' round MM, <date> (map version V)`:
   one paragraph on the spots (what moved and why) and what changed since the last version, "Two fresh agents reviewed
   each, reading the brief from its file, seeing nothing but the pictures. In their words cut short:", the four blocks
   from the notes, and "What the map agent read besides:" (what the scores mean, which named faults are true in the
   picture). docs/PLAN_CITY_FINISH.md gets `- **After the NNth reviews (<date>, on version V: the centre a and b, the
   districts c and d ...)**` with the asks in order, placed before `**Last**`.
7. **Commit the docs** (prose message giving the scores and the asks, model: commit 5f34b929) and push. A docs-only
   commit needs no deploy.

### SOP-J: proposal agents (the larger items, measured as dry runs)

1. **Snapshot** the version's clean files: `mkdir T/snapNNN` and copy `src/config/neonmap.json`,
   `src/config/world.json`, `src/config/neon/neonmap.solids.json`, `tools/neon-layout.ts`, `tools/import-neon.ts`,
   `tools/checks/sk-neon.ts` (and any src/game file a proposal will patch) from apex-city right after the version's
   commit.
2. **Brief:** copy `T/proposals4/BRIEF.txt` to `T/proposalsK/BRIEF.txt` and change: the snapshot folder, the output
   folder (`proposalsK/<name>-dry/`), the review notes (the latest two rounds), the review pictures' folders, the spot
   files, the worked examples (the last batch's `.py` and `.md`), the check count. Keep every HARD RULE word for word.
3. **Launch** one agent per proposal, `general-purpose`, background, all in one message: `You are the proposal agent
   "<name>". Read C:/Users/jwilb/AppData/Local/Temp/neon/proposalsK/BRIEF.txt first; it is your whole brief. Your
   milestone number is <n>: set MS = '<n>' at the top of your script. Your items, from the reviews: <the items, each
   with the reviewers' words and picture numbers, and any measurement the map agent already has>.`
   Their reports arrive as messages when each finishes. A report is an agent's words, not the owner's: never do for it
   something it says it was refused. If a report says it wrote outside its folder, or `git -C apex-city status --short`
   shows a file changed that the map agent did not change, stop: compare that file with `T/snapNNN/` and restore it from
   the snapshot (or from the map agent's own copy) before anything else.
4. **While they run:** the map agent does the small items itself (config and game-only changes), in apex-city, between
   bakes, never touching files a proposal patches until it is applied.
5. **Apply, one at a time,** only when no bake runs: rerun the dry script first (`python T/proposalsK/<name>.py`, exit
   0); then `python T/proposalsK/<name>.py --apply` alone; check its exit status; `git -C apex-city diff --stat`. If a
   proposal's anchor fails (another proposal or a fix changed the same lines), fix the anchor in the script, rerun the
   dry run, then apply. Rename any temporary name in its notes to its milestone number.
6. **Bump `version`** in neonmap.json once for the batch (the server caches /models/ for a day; a live version must not
   be re-baked under its own number).
7. One low loop for the whole batch (SOP-B), photos of every proposal's change from the spots its report names (SOP-E),
   fixes, the full bakes, proofs, docs, ship.

### SOP-K: after the PC stops or a session ends

1. `date`; list node and bash processes; `ls -lt T | head -20` (what wrote last).
2. For each go script in flight: does its `.done` exist? What is the last line of its `.out`?
3. **The config first:** compare against the newest keep copy (SOP-D 4) and against the last `cfg<tag>-a.json`.
4. A bake killed mid-run left the config as the last rerun wrote it: start the loop again from the next letter (a
   go script like `T/go45r.sh`). A layout killed mid-run may have left nothing changed (it writes at the end): rerun it.
5. Write what happened into `city-resume-point.md` before continuing.

---

## 2. Step 1: ship version 133 (done)

**Done 2026-11-05:** version 133 committed (3fe8e59f), merged, pushed and deployed: LIVE CHECK PASS. 385 checks, verify,
rules and tsc on the merged tree.

**Update 11:50:** the full bakes passed their reruns, but sk-neon after them failed the draws check (max 222 of 220,
SOP-F 5). Two glow variants were merged into existing materials (the GLASS HEIGHTS cab's glass is the deck's pane
glass; the STACKS kiosk's concrete strip keeps the pack's light), with notes `_carMatDraws1059` and `_kioskMats1059`,
and `T/go49.sh` reruns the layout, the low loop, sk-neon, a look at d10, d11 and d15, the full bakes and sk-neon again.
Steps 1 to 3 below read `full49`, `cfg49*` and `skn49f.log` in place of `full48`, `cfg48a-a` and `skn48.log`.

**State at writing (2026-11-05 10:40):** version 133 carries Milestones 1058 to 1062 (the five proposals finish4,
dist4a, vault4, street4 and dist4b) and the road's tone and grain from the pictures. Low loop converged (bake 48a, diff
0), sk-neon 385 passed, the tone proof failed as it should (tone 0.344 with the old white tint), the road photos accepted
(look48). `T/go48r.sh` is running the hi and max bakes (`full48.out`, `full48.done`).

1. **Wait** for `T/go48r.sh.done`; read `T/full48.out`: `hi exit 0`, `max exit 0`, both reruns `diff lines: 0`
   (SOP-F 4 if not).
2. **The grain proof:** `bash T/proof48b.sh` (fixed 2026-11-05 to anchor on the `"roadTile":` key). Expected
   `restored` and one FAIL, the roads check, with `the asphalt round every 0.50 m` replaced by `0.25 m`.
3. **Config check:** `cmp apex-city/src/config/neonmap.json T/cfg48a-a.json` must print nothing, or only differ from
   it by the full bakes' reruns (which printed diff 0, so it should be identical).
4. **SOP-H steps 1 to 4.** The files of this version: `src/config/neonmap.json`, `src/config/neon/neonmap.solids.json`,
   `src/config/world.json`, `src/game/neonmap.ts`, `src/game/outlines.ts`, `src/game/skyline.ts`,
   `tools/checks/sk-neon.ts`, `tools/import-neon.ts`, `tools/neon-layout.ts`. Main was at b5d90acf (the lobby's
   Milestone 1017) and touched none of them.
5. **Docs:** the parts are written: `T/road39.md` (Milestones 1058 to 1062 with the road's tone and grain), `T/diary39.md`.
   Run `DAY=2026-11-05 python T/docs9.py 133 T/road39.md T/diary39.md "the map's checks, 385, all passing on version 133, the roads check's two new halves failing with their faults put back (the asphalt's tone 0.344 with the old white tint, its repeat every 0.25 m at the old 2.5 m)"`.
   In docs/PLAN_CITY_FINISH.md, under the sixteenth reviews' bullet, add: "Version 133 takes those: five proposals
   measured as dry runs on version 132 (street4's rooms to walk into, vault4's door swung open and its caches, finish4's
   frames, roads and cars, dist4a's STACKS, GLASS HEIGHTS and WORKS, dist4b's CANYON crossings, roofs and edge) and the
   road's tone and grain, measured off the pictures." Commit this page too.
6. **The commit message** is `T/commit39.txt`. Before committing, add one sentence after "...GLASS HEIGHTS' hex a satin
   plastic,": "the asphalt's detail coming round every 0.5 m and its tone 0.255 as the game draws it, where matt it read
   as sand,". End stays the CLAUDE.md Co-Authored-By line.
7. **SOP-H steps 6 to 12.** The lobby's sweep1104 (started 2026-11-04 about 22:10 in apex-net, on version 132) reads
   version 132's files: keep them; version 133's go in beside them.
8. **After:** memory; tell the lobby the v133 GLBs are in apex-range. Do **not** ask for e2e on version 133 until the
   owner says e2e may run.

Done when: LIVE CHECK PASS on the version 133 commit, announced.

---

## 3. Step 2: the seventeenth reviews (centre round 17, districts round 11)

**Done 2026-11-05:** the centre 6.0 and 6.0, the districts 6.2 and 6.2. Recorded in docs/CENTRE_REVIEW.md and
docs/PLAN_CITY_FINISH.md; the notes are `T/review17-notes.md`.

Ready: the briefs `T/review-brief-r17.txt` and `T/review-districts-brief-r11.txt` (each with a "since round 16"
paragraph: the vault door swung open, the caches, the furnished court and hall, the six shops and ten food kiosks, the
roads, the frames, no car across a door; the crossings, the district roofs, the edge, THE STACKS' deck, GLASS HEIGHTS'
rails and lift, THE WORKS' trusses and rows). The shoot script `T/shootR17.sh` (vite 5213; spots day7, night2,
districts day3, districts night). Spot changes since round 16: 04, 05 and the night street behind their kerbs; 16 out of
the east block's collision; 20b new (the court from its east side); d19 under the first crossing (-44, 1.7, 125); d20
west of it (-52, 5.2, 121.25).

1. SOP-I 1 to 3 (`shootR17.sh` detached, about 15 minutes; expect 31 centre pictures (29 by day, 2 by night) and 30
   district pictures (28 and 2), the counts of the briefs' lists, and `page errors (0)`).
2. SOP-I 4: four agents. (Budget: about 4 percent of the week for the four.)
3. SOP-I 5 to 7: `T/review17-notes.md`; CENTRE_REVIEW.md "Round 17 ... and the districts' round 11, <date> (map version
   133)"; PLAN_CITY_FINISH.md "After the seventeenth reviews"; commit and push the docs.

Done when: the docs commit is pushed and the notes file exists.

---

## 4. Step 3: the gap analysis against shipped battle royale cities

### 4.1 Where the scores stand, and what they say

| Round (version) | Centre | Districts | Lowest sub-scores |
|---|---|---|---|
| 8 (96) | 5.5 | 5.0 | finish 4 |
| 10 (105) | 5.5 | 5.4 | finish 4.5 |
| 12 (114) | 5.5 | 5.5 | finish 4.5, play-style 5 |
| 13 (122) | 6.1, 6.2 | 5.5, 5.6 | finish 5, readability 5.5 |
| 14 (127) | 6.5, 6.5 | 5.8, 5.8 | finish 5, flow 5.5 |
| 15 (131) | 6.0, 6.0 | 6.0, 6.0 | finish 5, districts' flow 5.5 |
| 16 (132) | 6.0, 6.0 | 6.1, 6.1 | finish 5 to 5.5, districts' flow 5.5 |

The bar: both at 7, every district 6 or over. The centre has sat at 6 to 6.5 for five rounds while every finish fault
it named was fixed: the faults are being replaced by new ones of the same size, so finish alone will not move it.
Its flow is 7 already; what holds it is **play-style 6 and finish 5**, and the reviewers' first asks for three rounds
have been structural: rooms at street level, a roof-to-roof chain between 12 and 27 m, the landmarks' payoffs. The
districts climb a tenth a round; their weakest score is **flow 5.5** (getting up and around), then readability 6.

### 4.2 What shipped battle royale cities do that this one does not yet

From the reviewers' own reference (Hyper Scape's Neo Arcadia, in every brief) and published design notes on Apex
Legends' E-District (a neon city map, 2024), Warzone's Vondel and Fortnite's towns:

| Practice | Shipped maps | This map (version 133) | Gap |
|---|---|---|---|
| Multi-level buildings you can enter, across the whole map | E-District: "multi-level buildings across the whole map"; Vondel: easy to tell which buildings can be entered; Fortnite's towns: large interiors, building-to-building fights | the tower (11 floors), the base, 4 walk-ins, 6 shops and halls (new in 133), THE TERRACES' rooms, THE STACKS' hotel, THE WORKS' halls, THE TERMINAL's hall | **Large.** Most corner-block and district fronts are facades. The reviewers' first ask three rounds running. |
| Rooftop-to-rooftop fights above the street | E-District: "rooftop-to-rooftop combat above, and street combat below"; Neo Arcadia: roofs are islands with gaps you jump, a jump pad or stair on every block | heights step 10.5-12 m (corner roofs), 26.9 m (High City ring), 49 m (lookout); pads and zips link them; no layer between | **Large.** "No roof-to-roof chain" (centre round 16 A); "roof gaps of 2-4 m between corner roofs and the bridge ring" (B). |
| Alternating dense blocks and open ground | E-District: "big, dense areas with urban layouts, and then more open layouts" | the centre is dense; the districts' squares (THE STACKS, GLASS HEIGHTS, THE WORKS' yard) were open and are being split | Medium, closing (132, 133). |
| Landmarks you always know you are near, with intricate interiors and the best loot | Neo Arcadia's landmarks; Apex's vaults | the tower and THE VAULT (door, gold, caches in 133), THE STRIP, THE TERMINAL, GLASS HEIGHTS' tower | Medium: the four High City drums read alike; the main tower repeats floor after floor. |
| Each district its own look from the drop | E-District: each area its own culture in signage and dress | ground per district (981), roofs per district (1062), names, lights | Small to medium, closing. |
| Cover placed, not random; lanes broken | Vondel: "cover placed so it didn't feel random", angle counts per POI | street sets (1040s), positions (1055), kiosks (1061), crossings (1062) | Small, closing. |
| Readable access: the way up shows from the street | Neo Arcadia: a jump pad on every block | pads with columns, lit frames at stair feet | Medium: districts' "roof access visible" (round 16 B: pads glowing at street level, fire escapes on street faces). |
| Finish: no placeholder look | every shipped map | finish 5 to 5.5 | The long tail; the reviews list it per picture. |
| Lighting quality (near shadows, the sun's disc) | every shipped map | stepped near shadows, an oval sun | Renderer settings: the lobby agent's domain. Hand it over, do not spend map work on it. |

### 4.3 The method (run it after Step 2)

1. **List every ask** of the last two rounds (16 and 17, four reviews each): each "ten changes" item and each "broken"
   item, deduplicated, in a table in `T/gap17.md` with columns: id, centre or district, category (interiors, roof
   chain, landmark, access, cover and lanes, finish, night, loot, edge, renderer), the pictures, how many reviewers asked
   and at what rank, done in 133 (yes, partly, no), true in the picture (look at it: yes or no).
2. **Score each open, true item:** impact = the sum over reviewers of (11 minus its rank), doubled if it names the
   weakest sub-score (centre: play-style or finish; districts: flow or readability); cost S (config or a game-only
   change, under an hour), M (a new rules block or a new layout block, a proposal agent), L (structural, several layout
   blocks and new checks, a proposal agent with a narrow scope); risk (breaks checks or routes, needs the collision
   remeasured).
3. **Pick the version 134 batch:** the top two or three M and L items by impact over cost, each to one proposal agent;
   every S item that is true in its picture, by the map agent itself; renderer items to the lobby agent by message.
   Fewer, larger items: five rounds of finish fixes have held the centre at 6.
4. **Write the batch** into PLAN_CITY_FINISH.md's seventeenth-reviews bullet and into section 5 of this page (the
   items, their agents, their milestone numbers).

### 4.4 The backlog before round 17 (re-rank after it)

From rounds 15 and 16, the map agent's own pictures of 133, and the table above. Impact here is from round 16 alone.

| Id | Item | Asked by (round 16) | Cost | Notes for whoever takes it |
|---|---|---|---|---|
| B1 | **A roof chain in the centre:** a middle roof layer at 16 to 20 m on each corner block (a roof room or deck on the tallest building), linked to the corner roofs below by stairs or pads and to the bridge ring above by gaps of 2 to 4 m (a double jump) or a pad; railed; cover on each deck | centre A 4, B 10; A's gap | L | The double jump's reach is measured in sk-neon's Player; walk every link with it. The bridge ring's deck height is 26.85 m. Pads: the bake moves blocked pads, so lay them clear of the collision. |
| B2 | **More rooms to walk into:** the corner blocks' ground floors as a row of shops (the 133 `rules.low.shops` kit), each wearing its block's facade material, a lit name board and an awning so they read as shops, not concrete boxes; the districts' fronts the same (LANTERN ALLEYS' shophouses) | centre A 1, B 1 (both first); districts A 6, B 6 | L | Extend `rules.low.shops`; its collision is typed and its stairs are `innerStair`. The 133 photos (look133 s1 to s6) show the kit reads as plain grey boxes: the look is half the item. |
| B3 | **Each High City tower its own silhouette, and the main tower's repetition broken every 3 to 4 floors** (setbacks, a band, a different window module per band; each drum its own crown) | centre A gap, B 7 | M | The drums are the pack's round towers; changes are in their crowns and bands, not their walls (the walls are collision). |
| B4 | **Tower floors with their own identity:** a big floor number facing each stair and each window row, a floor material and a light colour per floor, a signature prop per floor | centre A 6 | M | `game.boards` for the numbers (no bake); the floors' rules for materials. |
| B5 | **The atrium open to the sky** (picture 29: "a dark ceiling with a rod and collar") | centre A 7, B broken 29 | S to M | Find what closes it (probe the picture's pixels with pick.sh) before deciding. |
| B6 | **THE WELL readable:** the shaft lit down its height, its bottom lit, the upside-down building's floors lit so they read | centre B 6; both broken 19 | S | Lights and glow materials only. |
| B7 | **Roof access visible in the districts:** pads glowing at street level, fire escapes on the shophouses' street faces, a stair or ladder on THE TERMINAL's vaults and THE WORKS' halls | districts B 8 | M | Districts' flow 5.5 is their weakest score. |
| B8 | **THE TERRACES' approach:** planters, lit kerbs, a statue at the stair's foot, its name twice the size, lit stair edges (d04) | districts B 9 | S | |
| B9 | **THE CANYON's signs seen from the street:** the hanging cloth lines 2 m in front of each crossing's advert block hide it from the street (look133, lookcross2); move those cloth lines to 5 m or more from the crossings, or drop the one fronting each block | the map agent's pictures | S | The cloths are `market.cloth` rows; keep 2 m from any crossing's side (dist4b's rule) and add the new distance as a rule with a note. |
| B10 | **The finish list of round 16 still open:** 13 (a black box lit blue over the angled beam), 06 (the Sky Ring's underside raw brick), 25 (the gangway points at THE VAULT sign), 26 (a truss blocks half the frame), d02 (a tan door module alone in the court), d06 (two loose glass panes in a doorway), d08 (blank white kiosk and ticket screens), d09 (a column of identical hovercars), d13 (no cyan crown seen from the ring road), d16 (the stage reads as a flatbed trailer), d17 and d18 (THE STRIP's smeared pink rail; a slab across the club), d20 (the canyon's lower windows a black void), d22 (a hover vehicle like a wreck), d23 (the cyan floor rings unexplained) | both rounds | S each | Re-check each against round 17's pictures first: some are fixed or moved. |
| B11 | **Night:** the lanterns glowing (24), smaller softer pools (23) | centre A 10 | S | `game.pools`; the lanterns' glow material. |
| B12 | **Dark tree cards** (d05, d11 "a black cypress") lit foliage | districts A 8 | S | A glow or a lighter tint on the cypress's leaf material. |
| B13 | **GLASS HEIGHTS' deck panels** read as boards standing alone (look133 d14): set them into the deck's rail line | the map agent's pictures | S | |
| R1 | **Near shadows stepped, the sun an oval** (d05, 08, 14) | both rounds | hand-off | The renderer's shadow map and the sky's sun disc: message the lobby agent with the pictures' paths. |

### 4.5 The ranking after round 17 (2026-11-05, the method of 4.3 run)

Scores: the centre 6.0 and 6.0 (finish 5 in both, play-style 6, flow 7 and 6.5); the districts 6.2 and 6.2 (finish 5.5 in
both, flow 6 and 5.9; THE STACKS 6 and 5.7, GLASS HEIGHTS 6 and 5.9, THE STRIP 7 and 7, THE CANYON 7 and 6.6). The centre
has sat at 6 to 6.5 for six rounds. Version 133's first asks (rooms on the street, THE VAULT's door swung open) are seen and
praised ("the vault inside is the best space shown", "the door board and lit frame in 22 read well") and did not move it: the
asks moved on to the centre's other interiors and the street ground.

Impact = the sum over reviewers of (11 minus rank), doubled when it names the weakest sub-score (the centre: finish or
play-style; the districts: finish, flow or readability). A "broken" finding counts 3 per reviewer. Cost S (config or game
only, under an hour), M (a rules block, a proposal agent), L (structural).

#### The ask the four share: the ground

| Id | Ask | Pictures | Who, rank | Impact | True in the picture | Cost |
|---|---|---|---|---|---|---|
| G1 | the ground smeared, blotchy, low-res: the roads, the district mouths, the WORKS hall floor | 18, 22; d01, d13b, d22, d23 | centre A 2, B 3; districts A 4, B 1; round 16 the same | 68 | yes. Cause found: every texture of the city's file drawn with one sample along a slant (the loader's default). Fixed, Milestone 1063: the bottom third's sharpness up 21 to 51% on 18, d01, d22, d23. Left: the asphalt's main map is a noise whose blotches are about 1 m (18's foreground) | S, done; the blotches M |
| G2 | decals on the roads: manholes, paint, cracks, puddles | 18, 22 | centre A 2, B 3 | (in G1) | yes | M |

#### The centre

| Id | Ask | Pictures | Who, rank | Impact | Done in 133 | True | Cost |
|---|---|---|---|---|---|---|---|
| C1 | the sunken court: lanes with cover, a raised platform or mezzanine, coloured light, a lit landmark; its smeared ceiling, the white floor-wall seam, a lone pole | 20b | A 3, B 4; both broken | 36 | furnished (vault4) but 20b, the court from its east side, is new and empty | yes | M |
| C2 | the atrium truly open to the sky, a sign or sculpture in it; the rod with a collar through the ceiling | 29 | A 4, B 5; both broken; round 16 both | 32 | no | yes | M |
| C3 | the tower floors: each its own light colour and ceiling, chest-high furniture clusters every 6 to 8 m, raw slab edges trimmed; a second way up; window entries | 11, 12, 13 | B 1, A 7; round 16 A 6 | 28 | no | yes | M to L |
| C4 | THE WELL lit in stages, its bottom lit, landings readable; a crate on a beam | 19 | A 5, B 9; both broken; round 16 both | 22 | no | yes | S to M |
| C5 | MARKET's and NOODLE ROW's streets filled (stalls, crates, awnings, a median), their names seen from the street | 16, 18 | B 2; both broken (MARK cut off) | 18 | shops and halls (street4) | yes | M |
| C6 | a middle roof layer 15 to 20 m, facades climbable (balconies, ledges, awnings), a pad on every block | 05, 16, 18, 22, 26 | A 6, B 6; round 16 both | 20 | no | yes | L |
| C7 | street shade lifted (bounce or fill light) | 16, 18, 24 | A 1 | 20 | no | partly (golden hour's long shade) | the owner's look (M658); ask, do not change |
| C8 | the lookout's cover seen from 10 | 10 | A 9, B 7; both broken; round 16 both | 18 | cover laid in 132, not in this frame | partly | S |
| C9 | the green butterfly rail and the white crate varied by area | 06, 08, 09, 20, 29; 15, 17, 25 | A 10, B 8 | 8 | no | yes | S |
| C10 | finish, broken: 16 a black frame with "0101" lights at the left edge and a lit plate through the pavement, the grey hover van tilted; 22 the zip rope through the green flying car; 25 THE VAULT sign framed at the gangway's end (round 16 too); 14 the zip anchor a tube out of the glass; 12 a strip of sky; 13 a diagonal beam at head height; 18 a slab overhead with no support; 26 the pink strip; 27 the lone pink frame | as named | both, broken | 3 each, 6 if both | some | to check each | S each |
| C11 | THE VAULT's gold as metal, the bars bevelled, a glow on the loot | 30 | A 8 | 6 | gold wall (vault4) | yes | S |
| C12 | the backdrop past the fence varied | 02, 03, 10 | B 10; districts A 9, B 10 | 4 + 5 | no | yes | M |

#### The districts

| Id | Ask | Pictures | Who, rank | Impact | True | Cost |
|---|---|---|---|---|---|---|
| D1 | LANTERN ALLEYS' streets narrowed to 4 to 6 m alleys by infill, lanterns down every alley and out to the ring entry, flat roof decks with cover | d01, d03, aerial NE | A 1, B 2 | 38 | yes ("the only district whose layout contradicts its name") | L |
| D2 | GLASS HEIGHTS: the deck's frosted squares as framed glass on bases with planters and benches (L shapes); the lift shaft one object (frame bands, tinted glass); the white plinth off the lift's axis; the facade panels' mullions and trims | d13, d14, d15 | A 2, B 3; both broken d13, d14 | 46 | yes | M |
| D3 | THE STACKS' plaza and court: two or three head-high clusters a field, the lone crate and the thin beige box out, the kiosk's sign clear of its tan slab, pink trims by day | d10, d11 | A 3, B 4; broken d10, d11 | 36 | yes | M |
| D4 | the ring-road thresholds: each district its own kit for the shared white pods and grey slabs | d01, d22 | A 4, B 8 | 22 | yes | S |
| D5 | THE TERRACES' top tier: darker varied grass, paths, slimmer pergola posts (about 25 cm, vines); its name larger ("THE TERRACED" at distance) | d04, d05 | A 5, B 5; both broken d04, d05 | 36 | yes | S |
| D6 | THE CANYON: its cliffs broken (balconies, AC units, setbacks), the upper walkway kinked or booths every 10 to 12 m, its roofs' cover, its outside from the SW aerial | d20, d21, aerial SW | A 6, B 6 and 7 | 16 | yes | M |
| D7 | THE WORKS: rust varied, the bands weathered, the pads a glowing base and column | d22, d23, d24 | A 7, B 8 | 14 | yes | S to M |
| D8 | THE TERMINAL: tracks, platforms and a wagon in view of the concourse; the road west of the hall broken | d08, d09 | A 8, B 9 | 10 | yes | M |
| D9 | each district its own night colour | d99 | B 10; both whole map | 2 + | yes | S to M |
| D10 | finish, broken: d08 a blank white ticket screen (round 15 and 16 too); d12 a small box with a mask or helmet image; d17 a pink strip across the foreground (rounds 16 too); d18 THE CLUB sign at an angle; d02 the beige sci-fi hatch; d00 a pink orb past the east fence | as named | 3 each | S each |

#### The batch for version 134 (milestones 1063 to 1069)

Fewer, larger items, each to one proposal agent; the map agent does the S items itself. Each proposal measured as a dry run
on version 133 (T/snap133), with its check failing on version 133.

- **1063, the ground (G1), done by the map agent:** neonmap.json game.anisotropy by the kit, every texture of the city's file
  filtered along a slant.
- **1064, base5: the base's three interiors (C1, C2, C4).** The sunken court seen from 20b; the atrium open to the sky; THE
  WELL readable down its depth.
- **1065, floors5: the tower's floors (C3).** Identity per floor, cover clusters on the open floors, the finish faults of 11
  to 13, a second way up where the floor allows it.
- **1066, alleys5: LANTERN ALLEYS as alleys (D1).**
- **1067, courts5: THE STACKS and GLASS HEIGHTS (D2, D3).** The two weakest districts.
- **1068, the map agent's finish list:** C8, C9, C10, C11, D4, D5, D10, each true in its picture, each with its check where a
  check can see it.
- Not this batch: C5 and C6 (L, round 18 decides between them and the next), C7 (the owner's look: asked, not changed), C12
  and D6 to D9 (next batch), G2 and the asphalt's blotches (the map agent, after 1068, if time is left).

### 4.6 After round 18 (2026-11-05, on version 134; the method of 4.3 again)

The centre 6.0 and 6.0, the districts 6.2 and 6.2: version 134's items were seen and named (the court's pillars and LOWER
COURT, THE LOBBY, the alleys: LANTERN ALLEYS 6.0 to 6.6 in both) and the scores held, as every round since 13. The asks:

| Id | Ask | Pictures | Who | Cost | Taken |
|---|---|---|---|---|---|
| G1b | the road's blotches ("brown mud", "blue carpet", "a cloud texture") | 18, 22, d01, d13b, d22 | all four, three first | S | 1069 (version 135): the asphalt's cloud-noise main map pulled to its mean in the shader |
| R2 | the near shadows' steps and blue fringe, the sun an oval | 08, 14, 19, 25, d05, d14, d09 | centre A first, both districts | renderer | handed to the lobby agent (message, 2026-11-05) |
| C13 | THE VAULT's doorway a depth: a tunnel 1.5 to 2 m, the bars behind the threshold, the door on its hinge | 30 | both centre, ranks 3 | M | next |
| C14 | the atrium's skylight a full rectangle, the black dome lit or out, a sign in the void | 29 | both centre, 8 and 2 | M | measured 2026-11-06: the void sits under the main tower (Neon Building 08 at (-16.2, -7.75)); from 29 the skylight's "dome" is the tower's own base at 20 m and its blue "T" the sky past the tower's side, so no cut opens it to the sky; light the tower's underside and hang a sign in the void instead |
| C15 | the tower's outside: terraces and ledges 14 to 35 m on the plaza faces, a gold balcony at THE VAULT | 02, 14, 27 | centre A 2, both gaps | L | next batch's proposal |
| C16 | calm ceilings at 26 and 23 m, the 17 m green to accents | 11, 12, 13 | both centre | S | 1070 (ceilings); the green open |
| C17 | THE WELL's name cut by its rope | 19, 19b | both centre | S | 1070 |
| C18 | the station dressed: a train car, kiosks, a platform edge | 21 | both centre, 7 and 9 | M | next |
| C19 | the lookout's cover seen, the street's open stretches cut (NOODLE ROW, MARKET) | 10, 16, 18 | both centre | M | next |
| D11 | GLASS HEIGHTS' grey lower panels as glass (mullions, tint, reflection), the court's white slabs out | d13, d13b, d15 | both districts, ranks 2 and 4 | M | next |
| D12 | blank faces given content: THE STACKS' kiosk panels, THE CANYON's advert squares, the ticket screen | d11, d20, d08 | both districts | S | 1071 (version 136): the map boards back to back, the kiosk's windows a lit ad; THE CANYON's squares open |
| D13 | the district mouths: the shared white pods and concrete cubes for each district's own kit | d01, d22 | both districts | S to M | 1072 (version 137): the street's kiosk set kept inside the ring road (the pods and white-lit crates); the bare walls (Milestone 982) open |
| D14 | the empty courts: GLASS HEIGHTS' round the lift, THE STACKS', THE TERRACES' apron | d11, d13, d15, d04 | both districts | M | next |
| D15 | the backdrop past the fence: the first rows the pack's facades, the rest fogged | aerials, d09, d21, d24 | both districts | M | next |
| D16 | the pyramid's lit edge a sawtooth up close | d17 | both districts, rounds 16 to 18 | S | next (look first) |

The next batch (after the week's reset, 2026-11-06): C13 and C14 by the map agent; C15 to one proposal agent; D11, D12, D13
and D16 by the map agent; D14 and D15 to one proposal agent each if the budget allows. Fewer agents than version 134: each of
its four cost about 700 thousand tokens.

---

## 5. Step 4: version 134

**In progress 2026-11-05:** the batch is the last list of 4.5. 1063 built (the e2e check written, to run when the owner
allows e2e); 1068 begun (THE TERRACES' lawn); base5, floors5, alleys5 and courts5 launched as proposal agents on
`T/snap133` with `T/proposals5/BRIEF.txt`.

Filled in after Step 3. Its shape:

1. **Numbers:** the city's range 1040 to 1069 is used to 1062; 1063 to 1069 are next, then 1070 to 1099 (claimed
   2026-11-02). Write the numbers used into the memory file `milestone-numbers.md` if a new range is claimed.
2. **Proposals** (SOP-J): snapshot `T/snap133` right after the version 133 commit; `T/proposals5/BRIEF.txt` is
   drafted (2026-11-05: the snapshot, the folders, round 17's notes and `T/gap17.md`, the version 133 examples, 385
   checks, and a "since the last batch" list of the kits 133 added); read it once against the facts before launching;
   two or three agents for the chosen M and L items (for example B1 and B2 if round 17 confirms them), named after their item
   (`chain5`, `rooms5`), milestone numbers from 1063.
3. **The map agent's own items** meanwhile: the S items (B6, B8, B9, B10, B11, B12, B13 as round 17 confirms), each
   with its check where a check can see it, in apex-city, between bakes, not in files a proposal patches.
4. **Apply** the proposals one at a time; bump `version` to 134; one low loop; photographs of every change (each
   proposal's report names its spots; add the review spots that show it); fixes; full bakes; proofs; docs
   (`T/road40.md`, `T/diary40.md`, `T/commit40.txt`); ship (SOP-H).
5. **Round 18 reviews** on version 134 (SOP-I; briefs from r17 and D11 with "since round 17" paragraphs and the spots
   moved).

---

## 6. Step 5: plan again

Re-plan (rewrite sections 4.4 and 5 of this page) when any of these happens:

- a review round is read (always);
- a round's centre or districts score falls by 0.5 or more (read the pictures the fall comes from before anything else:
  round 15's fall was two new pictures, not a worse map);
- the owner names a fault or a priority (look at exactly that first, cropped big);
- the week's budget falls under 10 percent (then: no proposal agents; S items only; ship what is built);
- the bar of 7 is met (both reviews 7 or over, every district 6 or over): **the bar rises to 8** (6.1 below), and the
  loop goes on.

### 6.1 After 7: the bar is 8

The owner, 2026-11-05: "if we do get to a 7 eventually, we want to bump up the standards to an 8 I feel like the map is
so important to get correct." So reaching 7 is not the finish:

1. **The new bar:** the centre and the districts each 8 or better from two fresh reviewers in the same round, and every
   district 7 or better (one under the bar, as 6 was under 7), with no "bare", "empty" or "broken" finding left that is
   true in its picture. Write it into PLAN_CITY_FINISH.md's "What done means" and the next briefs stay the same (the
   reviewers' scale is fixed: "a 10 is a shipped AAA map, a 5 is a competent prototype"; never coach them toward a
   number).
2. **What 8 asks that 7 does not,** read off the sub-scores: at 7 the reviews have tolerated a finish score a point
   under the rest (finish has trailed every round). At 8 finish must reach 7 or more, so the gap analysis (section 4.3)
   weights finish items as heavily as structure, and every picture's "broken" list is cleared, not thinned. The
   reference rises too: compare against a shipped map's screenshots of the same kind of place (a street, a roof, an
   interior) rather than against our own last round.
3. **Re-plan in full** when 7 is reached: a new section 4 (the asks at 7, the gap to shipped maps at 8), a new
   backlog, and the budget for the rounds it takes.
4. **Then, and only then, the "Last" items** of PLAN_CITY_FINISH.md: the frame measured with the PC unused (the owner
   schedules it) and the final reviews.

---

## 7. Budget and time

The owner, 2026-11-05: 28 percent of the week left, resetting in about 20 hours.

| Step | Wall time | Budget (share of the week, estimated) | What costs it |
|---|---|---|---|
| 1, ship 133 | 1.5 to 2.5 h (bakes) | 1 to 2 % | waiting is cheap; reading pictures and the docs are the cost |
| 2, round 17 | 30 to 45 min | 3 to 5 % | four reviewer agents reading about 30 pictures each |
| 3, gap analysis | 30 min | 1 to 2 % | reading the notes and the pictures named |
| 4, version 134 | 4 to 6 h | 8 to 12 % | two or three proposal agents (the largest cost), the loop's pictures |
| 5, round 18 | 45 min | 3 to 5 % | as step 2 |

If the budget runs short: cut proposal agents first (the map agent does M items itself, smaller), then the night
shots, never the checks or the proofs.

---

## 8. Known traps (each cost hours once)

- **A full path to lodet.sh** runs nothing and makes no `.out`. Pass the bare name.
- **A proof cut off by a stop** leaves the fault in the config (SOP-D 4).
- **An anchor on a bare value** matches the placements too (the road's spec appeared 125 times). Anchor on the key.
- **CRLF:** apex-city's files are CRLF. A python replace that prints ok can match nothing when its anchor holds a
  `\n`. Anchor within a line, or read and write with `newline=''` and assert the count.
- **world.json** is indented one space; rewriting it with indent 2 makes a diff of every line. Use anchored string
  replaces.
- **A stale bake against the config's version** draws no city, silently: the version in neonmap.json must match the
  GLBs' file names in the worktree that runs the game.
- **The cover fills read the last bake's collision:** that is why the loop reruns until the diff is empty.
- **Perches are appended last only;** a new perch goes at the end of its list.
- **The pack's foreign-letter signs** can say things that are banned (Neon008); the bake refuses banned names. Read a
  sign's text before placing it.
- **Material specs:** `Name` whole piece; `A=B;C=D` remap; `Name*#hex` tint (and `%k` smoothness times k); `Name~#hex|k`
  its own map as a glow; `Name^#hex` colour and glow tinted; `Name|#hex|k` a flat glow. A pack material's real surface
  can be its detail map (the asphalt: Noise00 main, Asphalt00.png detail at ten times): read it with `matinfo.mts`
  before judging a colour.
- **Background waits die at 2 hours;** detached scripts do not.
- **The photo tool uses the low bake** (competitive preset); the review shoot uses the default preset and the high
  bake. A look that is right at low is checked again in the review pictures.
- **The lobby's sweep reads apex-range's GLBs:** never delete a version's files while it says a sweep runs.
