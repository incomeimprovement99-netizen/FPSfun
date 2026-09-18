// The colours that carry meaning, and the settings that change them
// (Settings, Accessibility).
//
// Red for an enemy and green for your side is the one thing a HUD must never
// get wrong, and it is the pair about one man in twelve cannot tell apart.
// So those colours live here, not scattered as hex through the HUD: the kill
// feed, the pings, the name plates and the damage arcs all ask this module,
// and a colour vision mode swaps the whole set at once. Everything else on the
// HUD (the white text, the gold of a reward) reads the same for everyone.
//
// The HUD scale lives here too, because it is the other accessibility setting
// and both are kept together in one small store.
import hudCfg from "../config/hud.json";

export type VisionMode = "normal" | "deuteranopia" | "protanopia" | "tritanopia";

export interface Palette {
  /** an enemy: a ping, a kill feed line that is not yours */
  enemy: string;
  /** your side: a team mate's plate, your own kill in the feed */
  ally: string;
  /** a hit landing on you: the damage direction arcs, as "r,g,b" */
  damage: string;
  /** the kill feed's softer pair, which reads better as text than the plate colours */
  feedEnemy: string;
  feedAlly: string;
}

const CFG = hudCfg.accessibility;
export const VISION_MODES = CFG.vision as Array<{ id: VisionMode } & Palette & { label: string }>;
export const HUD_SCALES = CFG.scales as number[];
const KEY = "range.access.v1";

/** the live palette: the HUD reads it every frame, so a change shows at once */
export const P: Palette = { enemy: VISION_MODES[0].enemy, ally: VISION_MODES[0].ally, damage: VISION_MODES[0].damage, feedEnemy: VISION_MODES[0].feedEnemy, feedAlly: VISION_MODES[0].feedAlly };

export const access = { vision: "normal" as VisionMode, hudScale: 1 };

export function setVision(mode: VisionMode): void {
  const m = VISION_MODES.find((v) => v.id === mode) ?? VISION_MODES[0];
  access.vision = m.id;
  P.enemy = m.enemy;
  P.ally = m.ally;
  P.damage = m.damage;
  P.feedEnemy = m.feedEnemy;
  P.feedAlly = m.feedAlly;
}

export function setHudScale(scale: number): void {
  // only the offered steps: a free number here is a HUD off the screen
  access.hudScale = HUD_SCALES.includes(scale) ? scale : 1;
}

export function loadAccess(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { vision?: unknown; hudScale?: unknown } | null;
    setVision((raw?.vision as VisionMode) ?? "normal");
    setHudScale(Number(raw?.hudScale ?? 1));
  } catch {
    setVision("normal");
    setHudScale(1);
  }
}

export function saveAccess(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(access));
  } catch {
    // storage off: the choice holds for the session
  }
}
