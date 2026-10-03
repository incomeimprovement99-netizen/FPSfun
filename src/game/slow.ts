// The frame-time savings of the performance pass (2026-10-01), each one put back by name for measuring it against the
// old way: `?slow=aoshadow,aowalk,cull,skeleton,static` in the page's address (tools/bench.ts BENCH_VARIANTS
// "old=&slow=aoshadow"), as ?noskip and ?nomerge do for the savings before them.

/**
 * a saving's name: the AO prepass's shadow map, the AO pass's walks of the scene, figures culled by a sphere, one
 * skeleton a figure, static matrices; and (2026-10-03) array uniforms sent only when changed (uniformcache.ts)
 */
export type Saving = "aoshadow" | "aowalk" | "cull" | "skeleton" | "static" | "uniforms";

const off = new Set(
  (typeof location === "undefined" ? "" : (new URLSearchParams(location.search).get("slow") ?? ""))
    .split(",")
    .filter(Boolean)
);

/** the page's address has put this saving back (?slow=name) */
export const slow = (s: Saving): boolean => off.has(s);
