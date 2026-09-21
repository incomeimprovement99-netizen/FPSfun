// The leaderboards: every board the game posts to and reads is one the
// server keeps (server/game/serve.mjs's BOARD_IDS).
//
// The free-for-all wins board was added to the game and never to the
// server, so every win was posted into a 400 and the board never showed a
// row. Nothing noticed, because nothing compared the two lists.
//
// Run on its own: npx tsx tools/checks/boards.ts.
import { readFileSync } from "node:fs";
// @ts-expect-error: a plain JavaScript module of the server's
import { BEST_OF, nextBoardValue } from "../../server/game/boardrules.mjs";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The leaderboards, the game's and the server's");
const src = readFileSync(process.env.SERVE_PATH ?? new URL("../../server/game/serve.mjs", import.meta.url), "utf8");
const m = /const BOARD_IDS = new Set\(\[([^\]]*)\]\)/.exec(src);
const server = new Set(m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []);
check("the server's board list is where the check looks for it", server.size > 0);
// read as text: leaderboard.ts needs Vite's env to load
const client = readFileSync(new URL("../../src/game/leaderboard.ts", import.meta.url), "utf8");
const list = /export const BOARDS[^=]*= \[([\s\S]*?)\n\];/.exec(client);
const ids = list ? [...list[1].matchAll(/id: "([^"]+)"/g)].map((x) => x[1]) : [];
check("the game's board list is where the check looks for it", ids.length > 0);
const missing = ids.filter((id) => !server.has(id));
check("every board the game posts to is one the server keeps", missing.length === 0, missing.join(", ") || `${ids.length} boards`);

// What a post may change (server/game/boardrules.mjs): a forged total of
// wins moves a name one win, not to the top; a time is the best, over 5 s.
{
  const wins = (prev: number | undefined, v: number) => nextBoardValue(false, prev, v);
  check("a wins post of 99,999 from nobody counts as one win", wins(undefined, 99999) === 1);
  check("and from a name at 12, as 13", wins(12, 99999) === 13);
  check("an honest post of the next total counts it", wins(12, 13) === 13 && wins(undefined, 1) === 1);
  check("a total that went down changes nothing", wins(12, 3) === 12);
  const time = (prev: number | undefined, v: number) => nextBoardValue(true, prev, v);
  check("a course time keeps the best, and a time under 5 s or out of range is refused", time(40, 38) === 38 && time(40, 45) === 40 && time(undefined, 4) === null && time(undefined, -1) === null && wins(undefined, Number.NaN) === null);
  // the best of one match, which cannot be counted post by post the way a
  // total can, so it is bounded by what a match can produce instead
  const best = (prev: number | undefined, v: number, board = "match:kills") => nextBoardValue(false, prev, v, board);
  check("a best-of-a-match board keeps the best rather than counting posts", best(undefined, 12) === 12 && best(12, 17) === 17, `${best(undefined, 12)}, then ${best(12, 17)}`);
  check("and a worse match changes nothing", best(17, 3) === 17);
  check("a forged match above anything a match can produce is refused", best(17, 999) === null && best(undefined, 19999, "match:damage") === 19999, `kills cap ${BEST_OF["match:kills"]}, damage cap ${BEST_OF["match:damage"]}`);
}

console.log(fails === 0 ? "\nBOARDS PASS" : `\nBOARDS FAIL (${fails})`);
export const boardsFails = fails;
if (process.argv[1]?.endsWith("boards.ts")) process.exit(fails === 0 ? 0 : 1);
