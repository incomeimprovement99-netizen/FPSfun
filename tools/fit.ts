// The fit test on its own: the four lineups that count body showing through
// clothes (tools/snap.ts magentaMax, docs/TEST_AUDIT.md). Needs the dev server:
// SHOT_URL=http://localhost:5194 npm run fit (5194 is the default).
process.env.SNAP = "fit-front-a,fit-front-b,fit-back-a,fit-back-b";
process.env.SHOT_URL ??= "http://localhost:5194";
process.env.SNAP_RUN = "1";
await import("./snap");

export {};
