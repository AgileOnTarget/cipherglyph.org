/**
 * QR encoder, byte mode. No dependencies.
 *
 * BACKLOG: ND-SITE-006.
 *
 * Why this exists rather than a library: the page may not load anything from
 * a third-party host, and after Tom's two-device decision (ND-SITE-005) the
 * QR is the ONLY handoff path in V1. So the one thing standing between a
 * visitor and a burn is code that has to be written here and has to be right.
 *
 * Correctness is not asserted. `tools/check-qr.mjs` compares the output
 * matrix against `qrencode`, an independent reference encoder, and renders a
 * PNG that Apple's Vision detector must decode. Vision is the same stack the
 * iPhone Camera uses, so a pass there is close to the real test.
 *
 * Scope: byte mode, ECC levels L/M/Q/H, versions 1 to 40, automatic version
 * selection, automatic mask selection by the standard penalty rules.
 */

// ---------------------------------------------------------------------------
// GF(256) arithmetic for Reed-Solomon. Primitive polynomial 0x11d.
// ---------------------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(ecLen);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Standard tables. ECC order used throughout is L, M, Q, H.
// ---------------------------------------------------------------------------
const ECC = { L: 0, M: 1, Q: 2, H: 3 };

// EC codewords per block, per version (1..40), per ECC level.
const EC_PER_BLOCK = [
  [7,10,13,17],[10,16,22,28],[15,26,18,22],[20,18,26,16],[26,24,18,22],
  [18,16,24,28],[20,18,18,26],[24,22,22,26],[30,22,20,24],[18,26,24,28],
  [20,30,28,24],[24,22,26,28],[26,22,24,22],[30,24,20,24],[22,24,30,24],
  [24,28,24,30],[28,28,28,28],[30,26,28,28],[28,26,26,26],[28,26,30,28],
  [28,26,28,30],[28,28,30,24],[30,28,30,30],[30,28,30,30],[26,28,30,30],
  [28,28,28,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
  [30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
  [30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
];

// Number of EC blocks, per version, per ECC level.
const NUM_BLOCKS = [
  [1,1,1,1],[1,1,1,1],[1,1,2,2],[1,2,2,4],[1,2,4,4],
  [2,4,4,4],[2,4,6,5],[2,4,6,6],[2,5,8,8],[4,5,8,8],
  [4,5,8,11],[4,8,10,11],[4,9,12,16],[4,9,16,16],[6,10,12,18],
  [6,10,17,16],[6,11,16,19],[6,13,18,21],[7,14,21,25],[8,16,20,25],
  [8,17,23,25],[9,17,23,34],[9,18,25,30],[10,20,27,32],[12,21,29,35],
  [12,23,34,37],[12,25,34,40],[13,26,35,42],[14,28,38,45],[15,29,40,48],
  [16,31,43,51],[17,33,45,54],[18,35,48,57],[19,37,51,60],[19,38,53,63],
  [20,40,56,66],[21,43,59,70],[22,45,62,74],[24,47,65,77],[25,49,68,81],
];

// Total codewords per version (data + EC).
const TOTAL_CODEWORDS = [
  26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,
  1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,
  2876,3034,3196,3362,3532,3706,
];

const ALIGN_POS = [
  [],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],
  [6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],
  [6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],
  [6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],
  [6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],
  [6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],
  [6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],
  [6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],
  [6,26,54,82,110,138,166],[6,30,58,86,114,142,170],
];

const dataCodewords = (v, ecc) =>
  TOTAL_CODEWORDS[v - 1] - EC_PER_BLOCK[v - 1][ecc] * NUM_BLOCKS[v - 1][ecc];

/** Smallest version that fits `byteLen` in byte mode at this ECC level. */
export function chooseVersion(byteLen, ecc) {
  for (let v = 1; v <= 40; v++) {
    const countBits = v <= 9 ? 8 : 16;
    const needBits = 4 + countBits + byteLen * 8;
    if (needBits <= dataCodewords(v, ecc) * 8) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bit stream
// ---------------------------------------------------------------------------
class Bits {
  constructor() { this.bits = []; }
  push(value, len) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length() { return this.bits.length; }
}

function buildCodewords(bytes, version, ecc) {
  const capacityBits = dataCodewords(version, ecc) * 8;
  const b = new Bits();
  b.push(0b0100, 4); // byte mode
  b.push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) b.push(byte, 8);
  // Terminator, up to four zero bits.
  b.push(0, Math.min(4, capacityBits - b.length));
  while (b.length % 8 !== 0) b.bits.push(0);

  const cw = [];
  for (let i = 0; i < b.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | b.bits[i + j];
    cw.push(v);
  }
  // Pad alternately with 0xEC, 0x11 as the standard requires.
  const pads = [0xec, 0x11];
  let p = 0;
  while (cw.length < dataCodewords(version, ecc)) cw.push(pads[p++ % 2]);
  return cw;
}

function interleave(cw, version, ecc) {
  const numBlocks = NUM_BLOCKS[version - 1][ecc];
  const ecLen = EC_PER_BLOCK[version - 1][ecc];
  const total = dataCodewords(version, ecc);
  const shortLen = Math.floor(total / numBlocks);
  const numLong = total % numBlocks;

  const dataBlocks = [];
  const ecBlocks = [];
  let off = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen + (i >= numBlocks - numLong ? 1 : 0);
    const block = cw.slice(off, off + len);
    off += len;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecLen));
  }

  const out = [];
  const maxData = Math.max(...dataBlocks.map((d) => d.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const blk of ecBlocks) out.push(blk[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------
function newMatrix(size) {
  return {
    size,
    mod: Array.from({ length: size }, () => new Int8Array(size).fill(-1)),
    fn: Array.from({ length: size }, () => new Uint8Array(size)),
  };
}
const setF = (m, x, y, v) => { m.mod[y][x] = v; m.fn[y][x] = 1; };

function placeFunctionPatterns(m, version) {
  const n = m.size;
  const finder = (cx, cy) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const inRing = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const on = inRing && (dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setF(m, x, y, on ? 1 : 0);
      }
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);

  for (let i = 8; i < n - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    setF(m, i, 6, v); setF(m, 6, i, v);
  }

  for (const cy of ALIGN_POS[version - 1]) {
    for (const cx of ALIGN_POS[version - 1]) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          setF(m, cx + dx, cy + dy, on ? 1 : 0);
        }
      }
    }
  }

  setF(m, 8, n - 8, 1); // dark module
  // Reserve format areas.
  for (let i = 0; i < 9; i++) { if (m.fn[8][i] === 0) setF(m, i, 8, 0); if (m.fn[i][8] === 0) setF(m, 8, i, 0); }
  for (let i = 0; i < 8; i++) { if (m.fn[8][n - 1 - i] === 0) setF(m, n - 1 - i, 8, 0); if (m.fn[n - 1 - i][8] === 0) setF(m, 8, n - 1 - i, 0); }

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (bits >>> i) & 1;
      const a = Math.floor(i / 3), b = (i % 3) + n - 11;
      setF(m, a, b, bit); setF(m, b, a, bit);
    }
  }
}

function placeData(m, codewords) {
  const n = m.size;
  let bitIdx = 0;
  const total = codewords.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (m.fn[y][x]) continue;
        let bit = 0;
        if (bitIdx < total) {
          bit = (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
        }
        m.mod[y][x] = bit;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, maskIdx) {
  const f = MASKS[maskIdx];
  for (let y = 0; y < m.size; y++)
    for (let x = 0; x < m.size; x++)
      if (!m.fn[y][x] && f(x, y)) m.mod[y][x] ^= 1;
}

function placeFormat(m, ecc, maskIdx) {
  const eccBits = [1, 0, 3, 2][ecc]; // L=01, M=00, Q=11, H=10
  const data = (eccBits << 3) | maskIdx;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const n = m.size;
  for (let i = 0; i <= 5; i++) setF(m, 8, i, (bits >>> i) & 1);
  setF(m, 8, 7, (bits >>> 6) & 1);
  setF(m, 8, 8, (bits >>> 7) & 1);
  setF(m, 7, 8, (bits >>> 8) & 1);
  for (let i = 9; i < 15; i++) setF(m, 14 - i, 8, (bits >>> i) & 1);
  for (let i = 0; i < 8; i++) setF(m, n - 1 - i, 8, (bits >>> i) & 1);
  for (let i = 8; i < 15; i++) setF(m, 8, n - 15 + i, (bits >>> i) & 1);
  setF(m, 8, n - 8, 1);
}

function penalty(m) {
  const n = m.size;
  let p = 0;
  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);
  for (let y = 0; y < n; y++) {
    let run = 1;
    for (let x = 1; x < n; x++) {
      if (m.mod[y][x] === m.mod[y][x - 1]) run++;
      else { p += runScore(run); run = 1; }
    }
    p += runScore(run);
  }
  for (let x = 0; x < n; x++) {
    let run = 1;
    for (let y = 1; y < n; y++) {
      if (m.mod[y][x] === m.mod[y - 1][x]) run++;
      else { p += runScore(run); run = 1; }
    }
    p += runScore(run);
  }
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const v = m.mod[y][x];
      if (v === m.mod[y][x + 1] && v === m.mod[y + 1][x] && v === m.mod[y + 1][x + 1]) p += 3;
    }
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const rpat = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (get, i) => {
    let a = true, b = true;
    for (let k = 0; k < 11; k++) { if (get(i + k) !== pat[k]) a = false; if (get(i + k) !== rpat[k]) b = false; }
    return a || b;
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x <= n - 11; x++)
      if (match((i) => m.mod[y][i], x)) p += 40;
  for (let x = 0; x < n; x++)
    for (let y = 0; y <= n - 11; y++)
      if (match((i) => m.mod[i][x], y)) p += 40;
  let dark = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) dark += m.mod[y][x];
  const pct = (dark * 100) / (n * n);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}

/**
 * Encode a string as a QR matrix.
 * @returns {{ok:true, size:number, modules:number[][], version:number, mask:number}}
 */
export function encodeQr(text, { ecc = "M", version = null } = {}) {
  const level = ECC[ecc];
  if (level === undefined) return { ok: false, reason: "bad_ecc" };
  const bytes = new TextEncoder().encode(text);
  const v = version ?? chooseVersion(bytes.length, level);
  if (!v) return { ok: false, reason: "too_long" };
  if (bytes.length * 8 + 4 + (v <= 9 ? 8 : 16) > dataCodewords(v, level) * 8) {
    return { ok: false, reason: "too_long_for_version" };
  }

  const cw = interleave(buildCodewords(bytes, v, level), v, level);
  const size = v * 4 + 17;

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = newMatrix(size);
    placeFunctionPatterns(m, v);
    placeData(m, cw);
    applyMask(m, mask);
    placeFormat(m, level, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { score, mask, m };
  }

  return {
    ok: true,
    version: v,
    mask: best.mask,
    size,
    modules: best.m.mod.map((row) => Array.from(row)),
  };
}

/** Draw onto a canvas 2d context. `quiet` is in modules; 4 is the standard. */
export function drawQr(ctx, qr, { scale = 4, quiet = 4, dark = "#000", light = "#fff" } = {}) {
  const dim = (qr.size + quiet * 2) * scale;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = dark;
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++)
      if (qr.modules[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
  return dim;
}
