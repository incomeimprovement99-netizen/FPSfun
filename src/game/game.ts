// Which game this page is: the legacy game (Milestones 1 to 182, frozen at
// the git tag apex-era-final) or SpeedKills, the direction the project is
// moving in (docs/PHASE_18_PLAN_SPEEDKILLS.md).
//
// One switch, read once at startup, because the world is built once: the
// battle royale map, the roster and the menu all follow it, and changing it
// is a reload (the way the graphics preset changes). The order is the URL
// (?game=speedkills), then what this browser last chose, then the build's
// default, which stays legacy until SpeedKills is ready to be the front door.
//
// "legacy", never the other game's name: the public build may not carry it
// (tools/beta-check.ts).
//
// Pure: no three.js and no DOM work at import, so the node checks load it.
import legacy from "../config/games/legacy.json";
import speedkills from "../config/games/speedkills.json";

export type GameId = "legacy" | "speedkills";
export const GAME_IDS: readonly GameId[] = ["legacy", "speedkills"];

/** where this browser keeps its choice */
export const LS_GAME = "range.game";

/** a game's profile, src/config/games/<id>.json; the notes there say what each part means */
export interface GameProfile {
  id: string;
  name: string;
  tagline: string;
  /** every gun in play */
  roster: string[];
  /** the roster in families, each with its label */
  families: Record<string, { label: string; guns: string[] }>;
  /** a gun's own name, its role in its pair and its fixed optic, where the game gives them */
  weapons: Record<string, { name: string; role: string; optic: string }>;
  /** the attachment slots in play (none: fusion is the upgrade) */
  attachments: string[];
  ammo: "infinite" | "typed" | string;
  fusion: { on: boolean; levels: number; gun: Array<{ mag: number; reload: number; damage: number; recoil: number }>; abilityLevels: number; cooldownStep: number };
  abilities: { slots: string[]; passives: boolean; ultimates: boolean; set: Array<{ id: string; slot: string; from: string | null; name: string; blurb: string }> };
  life: { knockdowns: boolean; gulag: boolean; ghost: boolean; reviveSeconds: number; awaySlowdown: number; followRadius: number; ghostRevives: number; ghostSight: number; ghostSpeed?: number; restoreHealth?: number };
  /** null: the legacy game's own health, shields, EVO and heals */
  health: { health: number; shield: number; shieldDelay: number; shieldFill: number; healthDelay: number; healthRegen: number } | null;
  /** the battle royale's size: most players, and how many to a squad by default */
  match: { maxPlayers: number; team: number; teams?: Array<{ id: string; size: number; label: string; bots: number[]; defaultBots: number; bleed: number }> };
  map: string;
  hud: string;
  menu: string;
  bots: string[];
  /** what this game calls each bot tier (absent: the tier's own name) */
  botNames?: Record<string, string>;
  identity: { title: string; accent: string; accent2: string; sky: string };
  /** the game's own versions of lists the legacy game keeps in its configs; absent: the legacy game's own */
  lists?: { botWeapons: string[]; loadouts: string[][]; gulagGuns: string[] };
  /** the battle royale's floor: spots a sector by tier, the chances of a gun and a hack core, their fusion odds */
  loot?: { spots: Record<string, number>; gunChance: number; hackChance: number; gunOdds: Record<string, number[]>; hackOdds: Record<string, number[]>; maxFloor?: number; restock?: LootRestock };
  /** the dropship over squad.json's (doorsIn: the seconds before a jump is allowed) */
  ship?: { doorsIn: number };
  /** each gun's tuning over its legacy numbers (multipliers; headshotDamage outright) */
  tuning?: Record<string, { damage: number; fireRate: number; recoil: number; mag?: number; headshotDamage?: number }>;
}

/** the hot zone's loot coming back (speedkills.json loot.restock): seconds, a share, spots, metres */
export interface LootRestock {
  every: number;
  below: number;
  batch: number;
  near: number;
}

const PROFILES: Record<GameId, GameProfile> = { legacy, speedkills };

const isGame = (v: unknown): v is GameId => typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);

/** the build's default: vite sets it (vite.config.ts); anywhere else (the node checks) it is legacy */
function buildDefault(): GameId {
  // a node tool may name its game (GAME=speedkills npx tsx tools/sk-movesim.ts); a page never has `process`
  const env = typeof process !== "undefined" ? process.env?.GAME : undefined;
  const d = env ?? (typeof __DEFAULT_GAME__ !== "undefined" ? __DEFAULT_GAME__ : "legacy");
  return isGame(d) ? d : "legacy";
}

/**
 * The game for this page, from the URL, this browser's last choice and the
 * build's default, in that order. A URL choice is remembered, so a link that
 * says ?game=speedkills keeps the player in SpeedKills after they follow it.
 */
export function resolveGame(search: string | null, stored: string | null, fallback: GameId): GameId {
  const fromUrl = search ? new URLSearchParams(search).get("game") : null;
  if (isGame(fromUrl)) return fromUrl;
  if (isGame(stored)) return stored;
  return fallback;
}

function readGame(): GameId {
  let search: string | null = null;
  let stored: string | null = null;
  try {
    if (typeof location !== "undefined") search = location.search;
    if (typeof localStorage !== "undefined") stored = localStorage.getItem(LS_GAME);
  } catch {
    /* storage refused (a private window): the URL and the default still decide */
  }
  const g = resolveGame(search, stored, buildDefault());
  try {
    if (typeof localStorage !== "undefined" && isGame(new URLSearchParams(search ?? "").get("game"))) localStorage.setItem(LS_GAME, g);
  } catch {
    /* ignore */
  }
  return g;
}

/** this page's game, fixed for its life */
export const GAME: GameId = readGame();

/** a game's profile (src/config/games/*.json): what is in play, and the design that differs */
export function profileOf(id: GameId): GameProfile {
  return PROFILES[id];
}

/** this page's profile */
export const PROFILE: GameProfile = profileOf(GAME);

/** this page is SpeedKills: the one test most code needs */
export const IS_SK: boolean = GAME === "speedkills";
