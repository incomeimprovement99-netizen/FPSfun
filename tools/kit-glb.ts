// Reading the baked city packs in Node (the local kit tools): the current bake's file, and an IO that knows their
// KTX2 textures (KHR_texture_basisu, Phase 23.1) and their meshopt-compressed geometry (EXT_meshopt_compression, from
// v8), which a plain NodeIO refuses as required extensions it lacks.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import kit from "../src/config/citykit.json";

// (its WebAssembly, ready before any read: the extension does not wait for it)
await MeshoptDecoder.ready;

/** a pack's bake: "" the 1K one Balanced loads, "-max" High's 2K, "-lo" Competitive's */
export const kitFile = (pack: string, size: "" | "-max" | "-lo" = ""): string => `public/models/paid/city/${pack}-v${kit.version}${size}.glb`;
export const kitIO = (): NodeIO => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
