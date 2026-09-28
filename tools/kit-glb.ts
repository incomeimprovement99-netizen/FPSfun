// Reading the baked city packs in Node (the local kit tools): the current bake's file, and an IO that knows their
// KTX2 textures (KHR_texture_basisu, Phase 23.1), which a plain NodeIO refuses as a required extension it lacks.
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import kit from "../src/config/citykit.json";

/** a pack's bake: "" the 1K one Balanced loads, "-max" High's 2K, "-lo" Competitive's */
export const kitFile = (pack: string, size: "" | "-max" | "-lo" = ""): string => `public/models/paid/city/${pack}-v${kit.version}${size}.glb`;
export const kitIO = (): NodeIO => new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
