// pm2 process file for the game server on the box (docs/SERVER_GUIDE.md).
//
//   pm2 startOrReload ~/range/app/server/ecosystem.config.cjs && pm2 save
//
// Layout on the box (tools/deploy-server.ts makes it):
//   ~/range/app/site/     the public build
//   ~/range/app/server/   this folder
//   ~/range/range.env     the box's settings (TURN_SECRET, TURN_HOST), written
//                         once by setup.sh, never shipped, never overwritten
//   ~/range/boards.json   the online boards, outside the release so a deploy
//                         keeps them
//   ~/range/accounts.json the optional accounts (hashed passwords, sessions,
//                         synced profiles), outside the release for the same reason
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const envFile = join(__dirname, "..", "..", "range.env");
const boxEnv = {};
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m) boxEnv[m[1]] = m[2];
  }
}

module.exports = {
  apps: [
    {
      name: "range",
      script: "serve.mjs",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "4100",
        HOST: "127.0.0.1",
        DIST: join(__dirname, "..", "site"),
        BOARD_FILE: join(__dirname, "..", "..", "boards.json"),
        ACCOUNT_FILE: join(__dirname, "..", "..", "accounts.json"),
        ...boxEnv,
      },
      autorestart: true,
      restart_delay: 2000,
      max_memory_restart: "300M",
    },
  ],
};
