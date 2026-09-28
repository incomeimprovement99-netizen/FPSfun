// What a baked piece's materials carry (textures, factors), to set against the pack's own .mat. Local only.
//
// Run: npx tsx tools/kit-materials.ts <pack> <piece id suffix> ...
import { kitFile, kitIO } from "./kit-glb";
const [pack, ...ids] = process.argv.slice(2);
const doc = await kitIO().read(kitFile(pack));
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
for (const top of scene.listChildren()) {
  const id = String((top.getExtras() as { id?: string }).id ?? top.getName());
  if (!ids.some((w) => id.endsWith(w))) continue;
  console.log(`\n${id}`);
  const seen = new Set<string>();
  const walk = (n: typeof top): void => {
    for (const prim of n.getMesh()?.listPrimitives() ?? []) {
      const m = prim.getMaterial();
      if (!m || seen.has(m.getName())) continue;
      seen.add(m.getName());
      const t = (x: ReturnType<typeof m.getBaseColorTexture>) => (x ? `${x.getName() || x.getURI() || "tex"} ${x.getSize()?.join("x") ?? "?"}` : "none");
      console.log(`  ${m.getName()}: base ${t(m.getBaseColorTexture())}, colour ${m.getBaseColorFactor().map((v) => v.toFixed(2)).join(",")}, normal ${t(m.getNormalTexture())}, emissive ${t(m.getEmissiveTexture())} x${m.getEmissiveFactor().map((v) => v.toFixed(2)).join(",")}, mr ${t(m.getMetallicRoughnessTexture())} (metal ${m.getMetallicFactor()}, rough ${m.getRoughnessFactor().toFixed(2)}), ao ${t(m.getOcclusionTexture())}`);
    }
    for (const c of n.listChildren()) walk(c);
  };
  walk(top);
}
