# Working on B00G Range

## Keep going

**Do not stop between steps when the next one is clear.** A shipped item is not the end of a turn: if
there is a ranked next step, start it. Report progress as you pass it, not by halting and waiting to be
told to carry on. The owner's words: "stop stopping, we should be continuing if we have clear next steps".

Stop only for these:
- A decision that is genuinely the owner's (money, what to play, which of two designs they prefer).
- Something destructive or outward-facing that needs a yes (never the Algonomics VM: see below).
- The owner says to pause.

Everything else - a failing check, a missing asset, a thing that looks bad, an unclear name - is work, not
a question. Do it, measure it, and say what you found.

## The shape of the work

Each item: **build it, test it, document it, commit it, ship it**, then pick up the next.

- **Tests**: `npm run verify` and `npm run rules` on every change. Before a release, the three e2e batches
  (`$TEMP/run-e2e.sh apex-net 5194 <tag>`) and a rerun, alone, of any section that failed. Never edit `src/`
  or the README in a worktree while that worktree's e2e is running - the run is invalid if you do.
- **Docs**: a `docs/DEVELOPMENT_ROADMAP.md` milestone per shipped feature, a diary entry in
  `docs/updates/<date>.md`, and README and the deploy guide kept true.
- **Release**: commit in the worktree, rebase onto main, `git merge --ff-only` in `apex-range`, push,
  `npm run fps backup`, `npm run fps deploy` (LIVE CHECK), `npm run deploy` (Pages, which prints
  `== LIVE:` or `== NOT LIVE:`).

## Rules that do not bend

- **Never touch the Algonomics VM** (147.224.132.60): it runs a live real-money trader. The game's server is
  the separate Oracle box at fpsfun.duckdns.org.
- Gameplay numbers live in `src/config/*.json` with a `_note`, never as literals in code.
- The public build carries no real game names (`npm run rules`, `tools/beta-check.ts`, `tools/public-text.ts`).
- Comments say **why**, not what. No em-dashes in prose.
- Test tools must never take the real mouse or keyboard (the webdriver guard in `input.ts` stays).
- Commit messages are prose and end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Measure, do not guess

Numbers about the world - a bone's length, a head's height, how thick a body is - are **measured off the
model** by `tools/checks/body.ts` and written into the config with the measurement beside them. Two separate
faults this project has already had came from typing a number in by eye: sleeves inside the arms they
covered, and every head piece 30 to 60 mm too high. If a number describes something that exists, measure it.
