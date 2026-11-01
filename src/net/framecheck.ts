// A frame off the wire held up to what it says of itself, before anything unpacks it. PeerJS's packing reads a count from a
// frame's header and makes an array of that size with no look at how much is there: five bytes saying four billion froze
// the page that got them, on the main thread, and a host frozen is the whole lobby (Milestone 953). A count can be at most
// what the frame has left, as each item takes a byte at the least, so one walk over the headers settles it.

/** false for a frame that promises more than it holds; anything that is not bytes is not ours to judge */
export function frameFits(data: unknown): boolean {
  let b: Uint8Array;
  if (data instanceof ArrayBuffer) b = new Uint8Array(data);
  else if (ArrayBuffer.isView(data)) b = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  else return true;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 0;
  // items still to come, this frame's first among them
  let left = 1;
  while (left > 0) {
    if (i >= b.length) return true; // (short: PeerJS reads the rest as zeros, a wrong message and no hang)
    const t = b[i++];
    left--;
    let items = 0;
    let bytes = 0;
    if (t < 0x80 || t >= 0xe0) continue;
    else if (t >= 0xa0 && t <= 0xbf) bytes = t & 0x0f;
    else if (t >= 0x90 && t <= 0x9f) items = t & 0x0f;
    else if (t >= 0x80 && t <= 0x8f) items = (t & 0x0f) * 2;
    else {
      const sized = (n: number): number => {
        if (i + n > b.length) return Infinity;
        const v = n === 2 ? view.getUint16(i) : view.getUint32(i);
        i += n;
        return v;
      };
      switch (t) {
        case 0xca:
        case 0xce:
        case 0xd2:
          bytes = 4;
          break;
        case 0xcb:
        case 0xcf:
        case 0xd3:
          bytes = 8;
          break;
        case 0xcc:
        case 0xd0:
          bytes = 1;
          break;
        case 0xcd:
        case 0xd1:
          bytes = 2;
          break;
        case 0xd8:
        case 0xda:
          bytes = sized(2);
          break;
        case 0xd9:
        case 0xdb:
          bytes = sized(4);
          break;
        case 0xdc:
          items = sized(2);
          break;
        case 0xdd:
          items = sized(4);
          break;
        case 0xde:
          items = sized(2) * 2;
          break;
        case 0xdf:
          items = sized(4) * 2;
          break;
        default:
          break;
      }
    }
    i += bytes;
    left += items;
    if (i > b.length || left > b.length - Math.min(i, b.length)) return false;
  }
  return true;
}
