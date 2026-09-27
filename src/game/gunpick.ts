/**
 * The player's pick of each SpeedKills gun's bought model and skin (Phase 21 W9, docs/PHASE_21_OVERNIGHT_PLAN.md).
 *
 * A gun can wear its own model or the other of its class in the pack (paidweapons.json modelGroups: the two SMGs, the
 * two shotguns), every one measured (src/config/paidmodels.json); its own comes first. A family's _1 is the same gun
 * as its _2 in one piece, so it is not a choice. The skin is which of the gun's three skins shows at levels
 * 0 and 1: the fusion levels walk on from it through the other two, so a fused gun still visibly changes.
 *
 * On the wire and in storage a pick is one digit a gun, model times three plus skin, in the roster's order after a G
 * ("G0000000000" is every gun as it comes): the look code's sixth field (outfit.ts), so friends see your guns.
 * Config only, no three.js, so the look code can use it without the loader.
 */
import cfg from "../config/paidweapons.json";
import measured from "../config/paidmodels.json";
import skCfg from "../config/games/speedkills.json";

export interface GunPick {
  /** which of gunChoices(id) */
  model: number;
  /** which of the gun's skins its levels start from */
  skin: number;
}

const GUNS = cfg.guns as Record<string, { model: string; skins: string[] }>;
const MODELS = new Set(Object.keys(measured.models));
const GROUPS = (cfg as unknown as { modelGroups?: string[][] }).modelGroups ?? [];
/** the guns a code covers, in the roster's order */
export const PICK_GUNS = (skCfg.roster as string[]).filter((id) => GUNS[id]);
export const LS_GUNS = "range.sk.guns";

/** the models a gun can wear: its own, then the rest of its group, each one measured */
export function gunChoices(id: string): string[] {
  const g = GUNS[id];
  if (!g) return [];
  const group = GROUPS.find((gr) => gr.includes(g.model)) ?? [];
  return [g.model, ...group.filter((m) => m !== g.model && MODELS.has(m))];
}

/** the model a pick puts on a gun (its own without one) */
export function pickModel(id: string, pick?: GunPick | null): string | null {
  const c = gunChoices(id);
  if (!c.length) return null;
  return c[Math.min(c.length - 1, Math.max(0, pick?.model ?? 0))];
}

/** the gun's skins in level order from a pick: levels 0 to 1, 2 to 3, 4 to 5 */
export function pickSkins(id: string, pick?: GunPick | null): string[] {
  const s = GUNS[id]?.skins ?? ["A", "B", "C"];
  const from = Math.max(0, pick?.skin ?? 0) % s.length;
  return s.map((_, i) => s[(i + from) % s.length]);
}

/** a pick as a short key, for a cache (gunmodels.ts) */
export const pickKey = (pick?: GunPick | null): string => `${pick?.model ?? 0}${pick?.skin ?? 0}`;

/** every gun's pick as the code */
export function gunPickCode(picks: Record<string, GunPick>): string {
  return `G${PICK_GUNS.map((id) => {
    const p = picks[id];
    return p ? Math.min(8, p.model * 3 + p.skin) : 0;
  }).join("")}`;
}

/** a code back to picks, anything out of range dropped to the gun's own; null when it is not a code */
export function readGunPicks(code: string | null | undefined): Record<string, GunPick> | null {
  if (!code || !/^G\d+$/.test(code)) return null;
  const out: Record<string, GunPick> = {};
  PICK_GUNS.forEach((id, i) => {
    const d = Number(code[i + 1] ?? 0);
    const model = Math.floor(d / 3);
    const skin = d % 3;
    if (model < gunChoices(id).length && skin < (GUNS[id]?.skins.length ?? 3)) out[id] = { model, skin };
  });
  return out;
}

/** this browser's picks (SpeedKills' storage) */
export function myGunPicks(): Record<string, GunPick> {
  try {
    return readGunPicks(localStorage.getItem(LS_GUNS)) ?? {};
  } catch {
    return {};
  }
}

/** this browser's code, or null when every gun is as it comes (nothing to send) */
export function myGunCode(): string | null {
  const code = gunPickCode(myGunPicks());
  return /^G0+$/.test(code) ? null : code;
}

/** one gun's pick, kept */
export function saveMyGunPick(id: string, pick: GunPick): void {
  const all = myGunPicks();
  all[id] = pick;
  try {
    localStorage.setItem(LS_GUNS, gunPickCode(all));
  } catch {
    // (storage off: the pick lasts the page)
  }
}
