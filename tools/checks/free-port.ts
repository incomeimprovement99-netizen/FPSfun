// A port nobody is listening on, for a check that runs the real game server. The checks had fixed ones (4127, 4128,
// 4131), and two verify runs at once (a deploy's gate beside a worktree's, or two agents') started two servers on one
// port: the second never came up, its checks talked to the first's server, which went down part way through them, and
// six of them failed at once and passed on the next run (Milestone 861).
import { createServer } from "node:net";

export function freePort(): Promise<number> {
  return new Promise((ok, no) => {
    const s = createServer();
    s.once("error", no);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      s.close(() => ok(port));
    });
  });
}
