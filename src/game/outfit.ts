// A player's look on the wire: which soldier they wear (soldier.ts soldierCode). It rides beside the operator id as the
// fifth field of the code the old wardrobe sent (outfit|build|face|body|soldier), so a page from before still finds it
// where it always did; the first four, the old game's clothes, went with its body in Milestone 568 and go empty.
import { mySoldierCode, readSoldierCode } from "./soldier";

/** the player's look as one short string, for the wire and for storage: "||||S0123456", or "" when no soldier is picked */
export function lookCode(): string {
  const soldier = mySoldierCode();
  return soldier ? `||||${soldier}` : "";
}

/** a look back off the wire: its soldier, and anything else dropped rather than trusted */
export function readLook(code: string | undefined): { soldier?: string } {
  if (typeof code !== "string" || !code) return {};
  const sd = code.split("|")[4];
  return readSoldierCode(sd) ? { soldier: sd } : {};
}
