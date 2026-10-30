// What a release does on the box, as the shell lines tools/deploy-server.ts runs there, kept apart so that
// tools/checks/release-steps.ts can run them against a stand-in box: nothing else proves them short of a bad release.

/**
 * after pm2 reloads the server: /health once it answers, up to 20 s, else the failing probe (a second after the reload
 * the server was not yet listening, and a deploy that had gone out whole failed there, 2026-09-29)
 */
export const HEALTH_AFTER_RELOAD = "for i in $(seq 1 20); do curl -fsS localhost:4100/health >/dev/null 2>&1 && break; sleep 1; done; curl -fsS localhost:4100/health; echo";

/**
 * This release answering /health, up to 20 s. Any answer was taken before: with a reload that failed the old server went
 * on answering, and the deploy passed with old server code over the new site (Milestone 938).
 */
export const answersAs = (sha: string): string =>
  `for i in $(seq 1 20); do curl -fsS localhost:4100/health 2>/dev/null | grep -qF "${sha}" && break; sleep 1; done; curl -fsS localhost:4100/health 2>/dev/null | grep -qF "${sha}"`;

const RELOAD = "pm2 startOrReload app/server/ecosystem.config.cjs --update-env";

/**
 * The release unpacked, swapped in and answering, or the last one back. A release that did not come up stayed up, and
 * pm2 looped on it until someone ran a rollback (Milestone 938). One command a step, so set -e stops at the first that
 * fails: chained with &&, a tar that ran out of disk did not stop it, and the half-unpacked release was swapped in over
 * the running one, 2026-10-13. What a failed unpack leaves goes with it: the disk it filled stops the accounts being
 * written while the site runs on (Milestone 938).
 */
export const shipSteps = (sha: string): string =>
  [
    "set -e",
    "trap 'rm -rf ~/range/next ~/range/incoming.tgz' EXIT",
    "cd ~/range",
    "rm -rf next",
    "mkdir next",
    "tar -xzf incoming.tgz -C next",
    "rm incoming.tgz",
    "cd next/server",
    "npm ci --omit=dev --no-audit --no-fund --loglevel=error",
    "cd ~/range",
    "rm -rf prev; if [ -d app ]; then mv app prev; fi; mv next app",
    `if ! { ${RELOAD} && ${answersAs(sha)}; }; then echo 'the new release did not come up: the last one goes back'; mv app failed; mv prev app; mv failed prev; ${RELOAD} || true; ${HEALTH_AFTER_RELOAD}; exit 1; fi`,
    "pm2 save >/dev/null",
    HEALTH_AFTER_RELOAD,
  ].join("; ");

/** the previous release back, its own version answering (a failed reload passed here as it did in a deploy) */
export const rollbackSteps = [
  "set -e",
  "cd ~/range",
  "test -d prev || { echo 'no previous release'; exit 1; }",
  "mv app failed; mv prev app; mv failed prev",
  RELOAD,
  `v=$(cut -d' ' -f1 app/site/version.txt); ${answersAs("$v")}`,
  "pm2 save >/dev/null",
  HEALTH_AFTER_RELOAD,
].join("; ");
