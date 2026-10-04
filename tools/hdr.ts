// A Radiance HDR sky (RGBE, run-length scanlines) at half its size, each pixel the mean of four in linear light.
//
// The skies are Poly Haven's smallest, 1024 by 512, 1.1 to 1.4 MB each, and sent as they are (the server compresses
// text, not these): the page's first screen waited for one. They light the world only through the environment map
// three makes of them (the dome is drawn from sky.json's colours, not the photograph), and at 512 by 256 the range and
// the Neon street photographed the same as at 1024 (2026-10-04) for a fifth of the bytes. The light is kept: the whole
// sky's mean within 0.1% of the original's.
//
// Used by tools/fetch-assets.ts as it fetches them, and by tools/shrink-skies.ts on ones already fetched.

export interface Hdr {
  w: number;
  h: number;
  /** linear RGB, three floats a pixel, rows from the top */
  px: Float32Array;
  /** the file's header lines before its size line */
  header: string;
}

export function decodeHdr(buf: Uint8Array): Hdr {
  const text = (a: number, b: number) => String.fromCharCode(...buf.subarray(a, b));
  let at = 0;
  const lines: string[] = [];
  for (;;) {
    const end = buf.indexOf(10, at);
    if (end < 0) throw new Error("no size line in the HDR header");
    const line = text(at, end);
    at = end + 1;
    lines.push(line);
    if (/^[-+]Y \d+ [-+]X \d+/.test(line)) break;
  }
  const size = /^-Y (\d+) \+X (\d+)/.exec(lines[lines.length - 1]);
  if (!size) throw new Error(`an HDR laid out other than -Y +X: ${lines[lines.length - 1]}`);
  const h = Number(size[1]);
  const w = Number(size[2]);
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[at] !== 2 || buf[at + 1] !== 2 || ((buf[at + 2] << 8) | buf[at + 3]) !== w) throw new Error(`not run-length scanlines at row ${y}`);
    at += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        let n = buf[at++];
        if (n > 128) {
          n -= 128;
          const v = buf[at++];
          for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = v;
        } else for (let i = 0; i < n; i++) scan[(x++) * 4 + c] = buf[at++];
      }
    }
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      const o = (y * w + x) * 3;
      px[o] = scan[x * 4] * f;
      px[o + 1] = scan[x * 4 + 1] * f;
      px[o + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { w, h, px, header: lines.slice(0, -1).join("\n") };
}

export function encodeHdr({ w, h, px, header }: Hdr): Uint8Array {
  const out: number[] = [];
  const push = (s: string) => {
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  };
  push(`${header}\n-Y ${h} +X ${w}\n`);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const v = Math.max(px[o], px[o + 1], px[o + 2]);
      if (v < 1e-32) scan.fill(0, x * 4, x * 4 + 4);
      else {
        const e = Math.ceil(Math.log2(v)) + 1;
        const f = 256 / Math.pow(2, e);
        // to the nearest step: rounded down, as the format is usually written, the whole sky came out 0.8% darker
        scan[x * 4] = Math.min(255, Math.round(px[o] * f));
        scan[x * 4 + 1] = Math.min(255, Math.round(px[o + 1] * f));
        scan[x * 4 + 2] = Math.min(255, Math.round(px[o + 2] * f));
        scan[x * 4 + 3] = e + 128;
      }
    }
    out.push(2, 2, w >> 8, w & 255);
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        // three or more of one value are a run; otherwise up to 128 as they are
        let run = 1;
        while (x + run < w && run < 127 && scan[(x + run) * 4 + c] === scan[x * 4 + c]) run++;
        if (run >= 3) {
          out.push(128 + run, scan[x * 4 + c]);
          x += run;
          continue;
        }
        let n = 0;
        while (x + n < w && n < 128) {
          let r = 1;
          while (x + n + r < w && r < 3 && scan[(x + n + r) * 4 + c] === scan[(x + n) * 4 + c]) r++;
          if (r >= 3) break;
          n++;
        }
        out.push(n);
        for (let i = 0; i < n; i++) out.push(scan[(x + i) * 4 + c]);
        x += n;
      }
    }
  }
  return Uint8Array.from(out);
}

/** half the size, each pixel the mean of the four it stands for */
export function halfHdr(src: Hdr): Hdr {
  const W = src.w >> 1;
  const H = src.h >> 1;
  const px = new Float32Array(W * H * 3);
  const at = (y: number, x: number, c: number) => src.px[(y * src.w + x) * 3 + c];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) px[(y * W + x) * 3 + c] = (at(2 * y, 2 * x, c) + at(2 * y, 2 * x + 1, c) + at(2 * y + 1, 2 * x, c) + at(2 * y + 1, 2 * x + 1, c)) / 4;
  return { w: W, h: H, px, header: src.header };
}

/** the widest a sky is kept (its environment map is made from it; the dome is not) */
export const SKY_WIDTH = 512;

/** a sky's file at no more than SKY_WIDTH across; one already that small comes back as it is */
export function shrinkSky(buf: Uint8Array): Uint8Array {
  let hdr = decodeHdr(buf);
  if (hdr.w <= SKY_WIDTH) return buf;
  while (hdr.w > SKY_WIDTH) hdr = halfHdr(hdr);
  return encodeHdr(hdr);
}

/** the mean of every channel of every pixel: the light the sky gives, for the check */
export function meanLight(hdr: Hdr): number {
  let s = 0;
  for (const v of hdr.px) s += v;
  return s / hdr.px.length;
}
