// Banner cards: the card a player shows the others.
//
// The rest of "emotes, sprays, banner cards and quips": whoever eliminates
// you, their card is on your death recap, and the champion's is on the
// winning screen. A card is three picks (an icon, a frame colour, a title),
// packed into one small number so it travels in the effect message every
// build already carries, rather than a new field in the state packets, whose
// optional fields are a bit mask an older build would read wrong.
import cfg from "../config/banners.json";
import sprays from "../config/sprays.json";

export const BANNERS = cfg;

export interface BannerCard {
  /** the icon's name (public/icons), its frame colour, its title */
  icon: string;
  frame: string;
  title: string;
}

const ICONS = sprays.list.map((s) => s.icon);

/** three picks into one number (icon, then frame, then title, eight of each) */
export function bannerCode(icon: number, frame: number, title: number): number {
  const c = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v) || 0));
  return c(icon, ICONS.length) + 8 * c(frame, cfg.frames.length) + 64 * c(title, cfg.titles.length);
}

/** a number off the wire back into a card, or null if it is not one */
export function bannerOf(code: unknown): BannerCard | null {
  if (typeof code !== "number" || !Number.isInteger(code) || code < 0 || code >= 512) return null;
  const icon = ICONS[code % 8];
  const frame = cfg.frames[Math.floor(code / 8) % 8];
  const title = cfg.titles[Math.floor(code / 64) % 8];
  return icon && frame && title ? { icon, frame, title } : null;
}

/** the picks' names, for the Settings menus */
export const BANNER_ICONS = sprays.list.map((s) => s.name);
