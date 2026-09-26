// The lobby: one place to set up a match and start it.
//
// Before this there were two places. The Play tab was fourteen buttons that
// started instantly on whatever the last visit left behind, and every choice
// those buttons obeyed (the map, the bots, their difficulty, the squad size,
// the ring) lived on the Friends tab in three unrelated boxes. Playing a
// battle royale with a friend meant opening a tab called 1v1, changing a box
// that said "Arena: 1v1 / 1v1v1" to the battle royale, scrolling past two
// boxes that had nothing to do with it to the one that did, and only then
// making the match. Nobody would find that, and the owner said so.
//
// So: picking a mode opens that mode's own options underneath it, and the same
// panel starts the match alone or with friends. This module is the part of it
// that is a decision rather than a document: which options a mode actually
// obeys, and which mode a friends' match is. The page (index.html) holds the
// controls, one group per `SetupGroup`, and main.ts wires them as it always
// did, so the groups here name things the page already has.
import type { Mode } from "./menu";

/** a group of controls in the panel, `data-group` in the page */
export type SetupGroup =
  /** the dummies, their speed, whether they shoot back, the flick drill */
  | "range"
  /** which arena: the warehouse, the three built maps, or the mode's own */
  | "map"
  /** how many bots in Arena Bots (its own count: the arena holds fewer) */
  | "arenabots"
  /** how many bots, whether friends share a side, what the bots carry */
  | "modebots"
  /** how good the bots are */
  | "difficulty"
  /** whether anyone in an arena or a mode match has an ability */
  | "abilities"
  /** Gun Run's ladder: ten guns or every one of them */
  | "gunrun"
  /** which guns the match allows, and friendly fire */
  | "rules"
  /** rounds to win, which only a 1v1 counts */
  | "rounds"
  /** the squad size, the rules, the bots, the ring's pace, what you land with */
  | "br"
  /** the practice helpers: the aim bot, and the movement this match runs */
  | "train";

export interface LobbyMode {
  /** what main.ts calls it, and what the card's `data-mode` says */
  id: Mode;
  /** the button that used to start it, kept so the wiring does not move */
  go: string;
  name: string;
  /** what it is, in a line, on the card */
  card: string;
  /** the options it obeys, in the order the panel shows them */
  needs: readonly SetupGroup[];
  /** true when it can be played alone */
  solo: boolean;
  /** what the friends' match calls this mode, or null when there is no such match */
  friends: string | null;
}

/**
 * Every mode, and what it obeys. A group left out is a control the mode
 * ignores, and showing a control a mode ignores is worse than hiding it: the
 * old panel showed all of them at once, which is why the difficulty box next
 * to "Gun Run: 10 guns" read as belonging to Gun Run when it belonged to
 * every mode in the game.
 */
export const LOBBY_MODES: readonly LobbyMode[] = [
  { id: "range", go: "goRange", name: "Firing Range", card: "Guns, dummies, targets, ladders, ziplines and the wallbounce wall.", needs: ["range", "train"], solo: true, friends: null },
  { id: "tour", go: "goTour", name: "Guided tour", card: "Every move and key the range teaches, a step at a time.", needs: [], solo: true, friends: null },
  { id: "lab", go: "goLab", name: "Movement lab", card: "SpeedKills: climb a storey, run the wall, clear the gaps.", needs: [], solo: true, friends: null },
  { id: "run", go: "goRun", name: "The Run (Basic)", card: "Seven rooms, one technique each, twenty pop-ups.", needs: [], solo: true, friends: null },
  { id: "runAdvanced", go: "goRunAdvanced", name: "The Run (Advanced)", card: "Nine rooms, 200 m, the techniques chained. Thirty pop-ups.", needs: [], solo: true, friends: null },
  { id: "arena", go: "goArena", name: "Walk the arena", card: "The 1v1 map by yourself, to learn it.", needs: ["map", "train"], solo: true, friends: null },
  { id: "duel", go: "goDuel", name: "1v1 and 1v1v1", card: "You against a friend, or two. First to 3, with the circle.", needs: ["map", "rules", "rounds", "train"], solo: false, friends: "arena" },
  { id: "bots", go: "goBots", name: "Arena, Bots", card: "The 1v1 rules against bots, alone or with friends.", needs: ["map", "arenabots", "difficulty", "abilities", "rules", "rounds", "train"], solo: true, friends: "arena" },
  { id: "br", go: "goBr", name: "Battle Royale", card: "Drop onto Outskirts, the ring closes, last squad standing.", needs: ["br", "difficulty", "train"], solo: true, friends: "br" },
  { id: "gunrun", go: "goGunRun", name: "Gun Run", card: "Every kill is the next gun; a knife kill at the end wins.", needs: ["map", "modebots", "gunrun", "difficulty", "abilities", "train"], solo: true, friends: "gunrun" },
  { id: "tdm", go: "goTdm", name: "Team Deathmatch", card: "Four a side, respawns, first team to 30.", needs: ["map", "modebots", "difficulty", "abilities", "rules", "train"], solo: true, friends: "tdm" },
  { id: "crown", go: "goCrown", name: "Crown", card: "The crown appears 20 s in: take it, hold it 30 s. First to 3 rounds.", needs: ["map", "modebots", "difficulty", "abilities", "rules", "train"], solo: true, friends: "crown" },
  { id: "control", go: "goControl", name: "Control", card: "Five a side over three zones, A B C. A point a second for each, first to 500.", needs: ["map", "modebots", "difficulty", "abilities", "rules", "train"], solo: true, friends: "control" },
  { id: "ffa", go: "goFfa", name: "Free-for-all", card: "Everyone for themselves, respawns, first to 20 kills.", needs: ["map", "modebots", "difficulty", "abilities", "rules", "train"], solo: true, friends: "ffa" },
  { id: "search", go: "goSearch", name: "Search", card: "Plant and defuse, one life a round. Sides swap after 6; first to 7.", needs: ["map", "modebots", "difficulty", "abilities", "rules", "train"], solo: true, friends: "search" },
];

/** the mode by its id */
export function lobbyMode(id: string): LobbyMode | undefined {
  return LOBBY_MODES.find((m) => m.id === id);
}

/** the groups a mode obeys; an unknown mode obeys none, so the panel is a Play button */
export function setupFor(id: string): readonly SetupGroup[] {
  return lobbyMode(id)?.needs ?? [];
}

/**
 * What the Friends tab's mode box has to say for this mode, or null when the
 * mode is a solo one. This is the translation that used to be the player's
 * job: they picked "Battle Royale, Bots" on one tab and then had to know it
 * was called "Battle royale: a squad against the bots" on another.
 */
export function friendsModeFor(id: string): string | null {
  return lobbyMode(id)?.friends ?? null;
}

/** every group some mode obeys, for the page to be checked against */
export const SETUP_GROUPS: readonly SetupGroup[] = Array.from(new Set(LOBBY_MODES.flatMap((m) => m.needs)));
