import { validateAddress } from "./address.mjs";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BADCOIN_SCRIPT_ADDRESS = 0x19;
const BADCOIN_WIF_VERSION = 0x50;

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
const ZERO = Object.freeze({ inf: true, x: 0n, y: 0n });
const G = Object.freeze({ inf: false, x: GX, y: GY });

function mod(n, p = P) {
  const r = n % p;
  return r >= 0n ? r : r + p;
}

function invert(number, modulo = P) {
  let a = mod(number, modulo);
  let b = modulo;
  let x = 0n;
  let y = 1n;
  let u = 1n;
  let v = 0n;
  while (a !== 0n) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a;
    a = r;
    x = u;
    y = v;
    u = m;
    v = n;
  }
  if (b !== 1n) throw new Error("private key is outside the secp256k1 field");
  return mod(x, modulo);
}

function pointAdd(p, q) {
  if (p.inf) return q;
  if (q.inf) return p;
  if (p.x === q.x && p.y !== q.y) return ZERO;
  const m = p.x === q.x && p.y === q.y
    ? mod(3n * p.x * p.x * invert(2n * p.y))
    : mod((q.y - p.y) * invert(q.x - p.x));
  const x = mod(m * m - p.x - q.x);
  const y = mod(m * (p.x - x) - p.y);
  return { inf: false, x, y };
}

function scalarMultiply(k) {
  let n = k;
  let p = ZERO;
  let d = G;
  while (n > 0n) {
    if (n & 1n) p = pointAdd(p, d);
    d = pointAdd(d, d);
    n >>= 1n;
  }
  return p;
}

function bytesToBigInt(bytes) {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

function bigIntTo32(n) {
  const hex = n.toString(16).padStart(64, "0");
  return hexToBytes(hex);
}

function compressedPublicKey(point) {
  const out = new Uint8Array(33);
  out[0] = point.y & 1n ? 0x03 : 0x02;
  out.set(bigIntTo32(point.x), 1);
  return out;
}

function sha256Sync(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ].slice();
  const len = bytes.length;
  const withPad = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  withPad.set(bytes);
  withPad[len] = 0x80;
  const bitLen = len * 8;
  const padView = new DataView(withPad.buffer);
  padView.setUint32(withPad.length - 4, bitLen >>> 0);
  padView.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));
  const w = new Uint32Array(64);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < withPad.length; off += 64) {
    const view = new DataView(withPad.buffer, off, 64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const dv = new DataView(out.buffer);
  H.forEach((v, i) => dv.setUint32(i * 4, v));
  return out;
}

function ripemd160(input) {
  const r1 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const r2 = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const s1 = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const s2 = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
  const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
  const f = (j, x, y, z) => {
    if (j < 16) return (x ^ y ^ z) >>> 0;
    if (j < 32) return ((x & y) | (~x & z)) >>> 0;
    if (j < 48) return ((x | ~y) ^ z) >>> 0;
    if (j < 64) return ((x & z) | (y & ~z)) >>> 0;
    return (x ^ (y | ~z)) >>> 0;
  };
  const K = (j) => j < 16 ? 0 : j < 32 ? 0x5a827999 : j < 48 ? 0x6ed9eba1 : j < 64 ? 0x8f1bbcdc : 0xa953fd4e;
  const Kp = (j) => j < 16 ? 0x50a28be6 : j < 32 ? 0x5c4dd124 : j < 48 ? 0x6d703ef3 : j < 64 ? 0x7a6d76e9 : 0;
  const msgLen = input.length;
  const bitLen = msgLen * 8;
  const paddedLen = (((msgLen + 8) >>> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  for (let block = 0; block < paddedLen; block += 64) {
    const X = new Uint32Array(16);
    for (let i = 0; i < 16; i++) X[i] = view.getUint32(block + i * 4, true);
    let A = h0, B = h1, C = h2, D = h3, E = h4;
    let Ap = h0, Bp = h1, Cp = h2, Dp = h3, Ep = h4;
    for (let j = 0; j < 80; j++) {
      let T = ((A + f(j, B, C, D)) >>> 0) + X[r1[j]] + K(j);
      T = (rotl(T >>> 0, s1[j]) + E) >>> 0;
      A = E; E = D; D = rotl(C, 10); C = B; B = T;
      T = ((Ap + f(79 - j, Bp, Cp, Dp)) >>> 0) + X[r2[j]] + Kp(j);
      T = (rotl(T >>> 0, s2[j]) + Ep) >>> 0;
      Ap = Ep; Ep = Dp; Dp = rotl(Cp, 10); Cp = Bp; Bp = T;
    }
    const T = ((h1 + C) >>> 0) + Dp;
    h1 = (((h2 + D) >>> 0) + Ep) >>> 0;
    h2 = (((h3 + E) >>> 0) + Ap) >>> 0;
    h3 = (((h4 + A) >>> 0) + Bp) >>> 0;
    h4 = (((h0 + B) >>> 0) + Cp) >>> 0;
    h0 = T >>> 0;
  }
  const out = new Uint8Array(20);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, h0, true);
  dv.setUint32(4, h1, true);
  dv.setUint32(8, h2, true);
  dv.setUint32(12, h3, true);
  dv.setUint32(16, h4, true);
  return out;
}

function hash160(bytes) {
  return ripemd160(sha256Sync(bytes));
}

function base58Encode(bytes) {
  let n = 0n;
  for (const byte of bytes) n = n * 256n + BigInt(byte);
  let result = "";
  while (n > 0n) {
    result = B58[Number(n % 58n)] + result;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = "1" + result;
  }
  return result || "1";
}

function base58Check(bytes) {
  const digest = sha256Sync(sha256Sync(bytes));
  const out = new Uint8Array(bytes.length + 4);
  out.set(bytes);
  out.set(digest.subarray(0, 4), bytes.length);
  return base58Encode(out);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function generatePrivateKey() {
  for (let attempt = 0; attempt < 16; attempt++) {
    const priv = new Uint8Array(32);
    crypto.getRandomValues(priv);
    const scalar = bytesToBigInt(priv);
    if (scalar > 0n && scalar < N) return { priv, scalar };
  }
  throw new Error("could not generate a valid secp256k1 private key");
}

export function generateBadCoinColdWallet() {
  const { priv, scalar } = generatePrivateKey();
  const pubKey = compressedPublicKey(scalarMultiply(scalar));
  const pubH160 = hash160(pubKey);
  const redeem = new Uint8Array(22);
  redeem[0] = 0x00;
  redeem[1] = 0x14;
  redeem.set(pubH160, 2);
  const redeemH160 = hash160(redeem);
  const addressPayload = new Uint8Array(21);
  addressPayload[0] = BADCOIN_SCRIPT_ADDRESS;
  addressPayload.set(redeemH160, 1);
  const address = base58Check(addressPayload);

  const wifPayload = new Uint8Array(34);
  wifPayload[0] = BADCOIN_WIF_VERSION;
  wifPayload.set(priv, 1);
  wifPayload[33] = 0x01;
  const wif = base58Check(wifPayload);
  const validation = validateAddress(address, "mainnet");
  if (!validation.ok || validation.kind !== "script") {
    priv.fill(0);
    throw new Error("generated address failed BadCoin validation");
  }
  const record = {
    address,
    wif,
    publicKeyHex: bytesToHex(pubKey),
    createdAt: new Date().toISOString(),
    network: "BadCoin mainnet P2SH-P2WPKH",
  };
  priv.fill(0);
  return record;
}

export function drawColdWalletPng(record) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8f1df";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#c9bea6";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 1320, 820);
  ctx.fillStyle = "#0f3f33";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText("BADCOIN COLD WALLET", 80, 105);
  ctx.fillStyle = "#e85f12";
  ctx.font = "700 52px Arial, sans-serif";
  ctx.fillText("KEEP THE WIF PRIVATE", 80, 175);
  ctx.fillStyle = "#1f1f1d";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("PUBLIC ADDRESS", 80, 270);
  ctx.font = "28px Menlo, monospace";
  wrapText(ctx, record.address, 80, 315, 1200, 38);
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("PRIVATE KEY WIF", 80, 430);
  ctx.font = "28px Menlo, monospace";
  wrapText(ctx, record.wif, 80, 475, 1200, 38);
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("CREATED", 80, 605);
  ctx.font = "24px Menlo, monospace";
  ctx.fillText(record.createdAt, 80, 645);
  ctx.fillStyle = "#526b5d";
  ctx.font = "22px Arial, sans-serif";
  wrapText(ctx, "Generated in this browser. No private key is sent to CipherGlyph, HPP, or BadCoin. Print or save offline before funding.", 80, 745, 1160, 32);
  return canvas.toDataURL("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/(\s+)/);
  let line = "";
  for (const word of words) {
    const test = line + word;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y);
      line = word.trimStart();
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.length > 0) ctx.fillText(line, x, y);
}
