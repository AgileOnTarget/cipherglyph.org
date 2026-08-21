/**
 * BadCoin address validation.
 *
 * BACKLOG: ND-LIB-002. Journey J6 (wrong address).
 *
 * Returns a REASON, never a bare boolean. The page has to tell a visitor
 * which thing is wrong, and "invalid address" is the least useful sentence
 * a form can produce. A Glyph names an address permanently and publicly, so
 * the cost of accepting a bad one is not a retry, it is an inscription that
 * can never be corrected.
 *
 * Version bytes read from BadCoin Core `src/chainparams.cpp`, not guessed:
 *   mainnet  PUBKEY_ADDRESS 28   SCRIPT_ADDRESS 25
 *   testnet  PUBKEY_ADDRESS 85   SCRIPT_ADDRESS 87
 *   regtest  PUBKEY_ADDRESS 120  SCRIPT_ADDRESS 130
 *
 * ---------------------------------------------------------------------------
 * DO NOT "FIX" THIS TO ACCEPT ONLY VERSION 28. READ THIS FIRST.
 *
 * Every real BadCoin address begins with `B`, and `B` is version **25**, the
 * byte chainparams labels SCRIPT_ADDRESS. Verified 2026-08-15 against real
 * addresses found in the BadCoin project (`B4T5ciTCkWauSqVAcVKy88ofjcSasUkSYU`,
 * `BADCATnmi5oLwTbt1s75g5xVg8rwiTZREJ`), all of which pass base58check with
 * version 25. Version 28 encodes to a leading `C`, which no BadCoin address in
 * the wild uses.
 *
 * RESOLVED 2026-08-18, against BadCoin Core source, not just observed
 * addresses. Neither byte is mislabeled. `chainparams.cpp` (`src/chainparams.cpp:148-149`)
 * correctly names PUBKEY_ADDRESS=28 (legacy P2PKH) and SCRIPT_ADDRESS=25
 * (P2SH, including P2SH-wrapped SegWit): the same real distinction Bitcoin
 * itself has between `1...` and `3...` addresses. The reason every address
 * in the wild is 25/"B" is that the wallet's own default makes it so:
 * `src/wallet/wallet.h:112` hardcodes `OUTPUT_TYPE_DEFAULT =
 * OUTPUT_TYPE_P2SH_SEGWIT`, and every address-generation path falls back to
 * it when no type is explicitly set (`src/qt/walletmodel.cpp:690-691,
 * 742-743`; `src/qt/vanityaddresspage.cpp:563`). Version 28 legacy addresses
 * are real, valid, and would pass this validator, but nothing in the shipped
 * wallet ever produces one unless someone overrides the address type
 * explicitly. Accepting both bytes remains correct regardless: the fix here
 * was understanding why, not the code.
 * ---------------------------------------------------------------------------
 *
 * No dependencies. base58 and double-SHA-256 are implemented here rather
 * than pulled in, because this file is served to a browser from a page that
 * is forbidden to load anything from a third-party host.
 */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const NETWORKS = {
  mainnet: { pubkey: 28, script: 25, label: "BadCoin mainnet" },
  testnet: { pubkey: 85, script: 87, label: "BadCoin testnet" },
  regtest: { pubkey: 120, script: 130, label: "BadCoin regtest" },
};

/** Every failure the page may need to explain. */
export const REASON = {
  OK: "ok",
  EMPTY: "empty",
  BAD_CHARACTER: "bad_character",
  WRONG_LENGTH: "wrong_length",
  BAD_CHECKSUM: "bad_checksum",
  WRONG_NETWORK: "wrong_network",
  UNKNOWN_VERSION: "unknown_version",
};

/** Plain-language text for each reason. Wording belongs with content, not here. */
export const REASON_TEXT = {
  [REASON.EMPTY]: "Enter a BadCoin address.",
  [REASON.BAD_CHARACTER]:
    "That contains a character BadCoin addresses never use. Check for a stray space, or 0, O, I, l.",
  [REASON.WRONG_LENGTH]: "That is not the right length for a BadCoin address.",
  [REASON.BAD_CHECKSUM]:
    "That address fails its own checksum, which usually means a typo or a truncated paste.",
  [REASON.WRONG_NETWORK]: "That is a valid address, but not for this network.",
  [REASON.UNKNOWN_VERSION]: "That is not a BadCoin address.",
};

function sha256Sync(bytes) {
  // Minimal SHA-256. Present so this module has zero dependencies and can be
  // used synchronously during typing; WebCrypto's digest is async only.
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
  new DataView(withPad.buffer).setUint32(withPad.length - 4, bitLen >>> 0);
  new DataView(withPad.buffer).setUint32(
    withPad.length - 8,
    Math.floor(bitLen / 0x100000000),
  );

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

/** base58 decode. Returns null on an out-of-alphabet character. */
export function base58Decode(str) {
  const bytes = [0];
  for (const ch of str) {
    const val = B58.indexOf(ch);
    if (val < 0) return null;
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1's are leading zero bytes.
  for (const ch of str) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Validate a BadCoin address.
 *
 * @param {string} input        the pasted address
 * @param {string} network      'mainnet' | 'testnet' | 'regtest'
 * @returns {{ok: boolean, reason: string, version?: number, hash160?: Uint8Array,
 *            kind?: 'pubkey'|'script', message?: string}}
 */
export function validateAddress(input, network = "mainnet") {
  const net = NETWORKS[network];
  if (!net) throw new Error(`unknown network: ${network}`);

  const s = (input ?? "").trim();
  if (s.length === 0) {
    return { ok: false, reason: REASON.EMPTY, message: REASON_TEXT[REASON.EMPTY] };
  }

  const raw = base58Decode(s);
  if (raw === null) {
    return {
      ok: false,
      reason: REASON.BAD_CHARACTER,
      message: REASON_TEXT[REASON.BAD_CHARACTER],
    };
  }

  // version(1) + hash160(20) + checksum(4)
  if (raw.length !== 25) {
    return {
      ok: false,
      reason: REASON.WRONG_LENGTH,
      message: REASON_TEXT[REASON.WRONG_LENGTH],
    };
  }

  const body = raw.subarray(0, 21);
  const checksum = raw.subarray(21);
  const expect = sha256Sync(sha256Sync(body)).subarray(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expect[i]) {
      return {
        ok: false,
        reason: REASON.BAD_CHECKSUM,
        message: REASON_TEXT[REASON.BAD_CHECKSUM],
      };
    }
  }

  const version = body[0];
  const hash160 = body.subarray(1);

  if (version === net.pubkey) {
    return { ok: true, reason: REASON.OK, version, hash160, kind: "pubkey" };
  }
  if (version === net.script) {
    return { ok: true, reason: REASON.OK, version, hash160, kind: "script" };
  }

  // Valid base58check, but the wrong network is a materially different
  // mistake from random junk, and the visitor deserves to be told which.
  for (const [name, cfg] of Object.entries(NETWORKS)) {
    if (version === cfg.pubkey || version === cfg.script) {
      return {
        ok: false,
        reason: REASON.WRONG_NETWORK,
        version,
        message: `That is a ${cfg.label} address. This is ${net.label}.`,
      };
    }
  }

  return {
    ok: false,
    reason: REASON.UNKNOWN_VERSION,
    version,
    message: REASON_TEXT[REASON.UNKNOWN_VERSION],
  };
}
