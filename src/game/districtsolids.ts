// The collision of the districts made of the packs' own demo scenes (Phase 25; citydistricts.json), measured off their
// triangles by tools/import-city.ts: one file a district, by its id. Loaded with or without the bought files, since the
// checks and the server's game run without them.
import highCorner from "../config/districts/high-corner.solids.json";

export const DISTRICT_SOLIDS: Record<string, number[][]> = {
  "high-corner": highCorner.solids,
};

/**
 * What is drawn of each district's buildings' insides (citydistricts.ts), from the same file: `covers`, dark blocks a
 * cell back from every face, and `caps`, a roof over the faces' own cells, each [x0, x1, z0, z1, top], map-local
 */
export const DISTRICT_INSIDES: Record<string, { covers: number[][]; caps: number[][] }> = {
  "high-corner": { covers: highCorner.covers, caps: highCorner.caps },
};
