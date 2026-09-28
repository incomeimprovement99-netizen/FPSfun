// The collision of the districts made of the packs' own demo scenes (Phase 25; citydistricts.json), measured off their
// triangles by tools/import-city.ts: one file a district, by its id. Loaded with or without the bought files, since the
// checks and the server's game run without them.
import highCorner from "../config/districts/high-corner.solids.json";

export const DISTRICT_SOLIDS: Record<string, number[][]> = {
  "high-corner": highCorner.solids,
};
