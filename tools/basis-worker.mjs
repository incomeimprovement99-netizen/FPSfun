// A worker thread that encodes textures to KTX2 with Basis Universal's own WebAssembly encoder (tools/basis-pool.ts
// runs a pool of these). The encoder is Apache-2.0, fetched once into the paid folder's tools (tools/basis-pool.ts), so
// nothing is installed. Only the two formats three.js's transcoder reads are used: ETC1S and UASTC LDR 4x4.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";

const require = createRequire(import.meta.url);
const BASIS = require(workerData.dir + "basis_encoder.js");
const M = await BASIS({ wasmBinary: readFileSync(workerData.dir + "basis_encoder.wasm") });
M.initializeBasis();

parentPort.on("message", ({ id, rgba, width, height, kind }) => {
  try {
    const enc = new M.BasisEncoder();
    // a colour's and a glow's pictures are sRGB; a normal map's and the packed occlusion, roughness and metal are data
    const srgb = kind === "color" || kind === "emissive";
    enc.setCreateKTX2File(true);
    enc.setKTX2UASTCSupercompression(true);
    enc.setPerceptual(srgb);
    enc.setKTX2AndBasisSRGBTransferFunc(srgb);
    enc.setMipSRGB(srgb);
    enc.setMipGen(true);
    enc.setSliceSourceImage(0, new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height, M.ldr_image_type.cRGBA32.value);
    if (kind === "normal") {
      // ETC1S blocks up a normal map's slopes: UASTC, rate-distortion tuned and zstd-packed
      enc.setFormatMode(M.basis_tex_format.cUASTC_LDR_4x4.value);
      enc.setMipRenormalize(true);
      enc.setRDOUASTC(true);
      enc.setRDOUASTCQualityScalar(1.0);
      enc.setPackUASTCFlags(1);
    } else {
      enc.setFormatMode(M.basis_tex_format.cETC1S.value);
      enc.setQualityLevel(kind === "data" ? 160 : 128);
      enc.setETC1SCompressionLevel(2);
    }
    const out = new Uint8Array(width * height * 4 + 1024 * 1024);
    const n = enc.encode(out);
    enc.delete();
    if (!n) throw new Error("the encoder returned nothing");
    const ktx2 = out.slice(0, n);
    parentPort.postMessage({ id, ktx2 }, [ktx2.buffer]);
  } catch (e) {
    parentPort.postMessage({ id, error: String(e) });
  }
});
parentPort.postMessage({ ready: true });
