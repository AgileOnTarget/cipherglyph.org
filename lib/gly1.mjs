/**
 * GLY1 v0.6 encode and decode. CipherGlyph message, not a 24x24 bitmap.
 *
 * BACKLOG: ND-ADR-009, ND-SPEC-017, ND-LIB-001. ADR-0008 artifact, ADR-0009 size.
 * Layout: specification/GLY1_Protocol_Paper.md and docs/BYTE_BUDGETS.md.
 *
 * Glyphs is 80 bytes. This is still not the PX-80 project.
 *
 * Uint8Array only. No Node Buffer, no third-party import.
 */

export const TAG = new Uint8Array([0x47, 0x4c, 0x59, 0x31]); // GLY1
export const PACKED_V1_INSCRIBE = 0x11;
export const HASH160_BYTES = 20;
export const BURN_REF_BYTES = 8;
export const HEADER_BEFORE_MESSAGE = 34;
export const MESSAGE_MAX_BYTES = 46;
export const MIN_LEN = HEADER_BEFORE_MESSAGE; // 34, empty message
export const MAX_LEN = HEADER_BEFORE_MESSAGE + MESSAGE_MAX_BYTES; // 80
export const CEILING = 80;

export const NAMES = Object.freeze([
  "",
  "THE PILOT",
  "THE BUILDER",
  "THE SIGNAL",
  "THE ARCHIVE",
  "THE GATE",
]);

/** @deprecated v0.4 image size. Kept so old raster checks can still import it. */
export const GLYPH_BYTES = 288;
export const HEADER_BEFORE_NAME = HEADER_BEFORE_MESSAGE;
export const NAME_MAX_BYTES = MESSAGE_MAX_BYTES;

const MESSAGE_ALPHABET = /^[A-Z .,]*$/;

export function toChainMessage(raw) {
  const upper = String(raw ?? "").toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (MESSAGE_ALPHABET.test(ch)) out += ch;
  }
  if (out.length > MESSAGE_MAX_BYTES) out = out.slice(0, MESSAGE_MAX_BYTES);
  return out;
}

export function isValidMessage(message) {
  if (typeof message !== "string") return false;
  if (!MESSAGE_ALPHABET.test(message)) return false;
  return message.length <= MESSAGE_MAX_BYTES;
}

/** Alias so older call sites that checked names still compile. */
export function isValidName(name) {
  return isValidMessage(typeof name === "string" ? name.toUpperCase() : name);
}

export const REASON = {
  OK: "ok",
  TYPE: "type",
  LENGTH: "length",
  TAG: "tag",
  VERSION: "version",
  OP: "op",
  MESSAGE_LEN: "message_len",
  NAME_LEN: "message_len",
  INTERNAL_LENGTH: "internal_length",
  MESSAGE: "message",
  NAME: "message",
  HASH160: "hash160",
  BURN_REF: "burn_ref",
};

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  return null;
}

function asciiBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function asciiFrom(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function fail(reason) {
  return { ok: false, reason };
}

/**
 * Decode a GLY1 v0.6 INSCRIBE payload.
 * Syntax only. Genuineness is ADR-0004.
 */
export function decode(bytes) {
  const buf = asBytes(bytes);
  if (!buf) return fail(REASON.TYPE);
  if (buf.length < MIN_LEN || buf.length > MAX_LEN) return fail(REASON.LENGTH);
  for (let i = 0; i < 4; i++) {
    if (buf[i] !== TAG[i]) return fail(REASON.TAG);
  }
  const packed = buf[4];
  if ((packed >> 4) !== 1) return fail(REASON.VERSION);
  if ((packed & 0x0f) !== 1) return fail(REASON.OP);
  const messageLen = buf[33];
  if (messageLen > MESSAGE_MAX_BYTES) return fail(REASON.MESSAGE_LEN);
  if (buf.length !== HEADER_BEFORE_MESSAGE + messageLen) {
    return fail(REASON.INTERNAL_LENGTH);
  }
  const message = asciiFrom(buf.subarray(34, 34 + messageLen));
  if (!isValidMessage(message)) return fail(REASON.MESSAGE);
  return {
    ok: true,
    reason: REASON.OK,
    version: 1,
    op: 1,
    hash160: buf.subarray(5, 25),
    burnRef: buf.subarray(25, 33),
    message,
    messageLen,
    name: message,
    nameLen: messageLen,
  };
}

/**
 * Encode a GLY1 v0.6 INSCRIBE payload.
 * hash160: 20 bytes. burnRef: 8 bytes. message: CipherGlyph alphabet.
 */
export function encode({ hash160, burnRef, message, name } = {}) {
  const h = asBytes(hash160);
  const b = asBytes(burnRef);
  if (!h || h.length !== HASH160_BYTES) return fail(REASON.HASH160);
  if (!b || b.length !== BURN_REF_BYTES) return fail(REASON.BURN_REF);
  const msg = String(message ?? name ?? "");
  if (!isValidMessage(msg)) return fail(REASON.MESSAGE);
  const nameBuf = asciiBytes(msg);
  const out = new Uint8Array(HEADER_BEFORE_MESSAGE + nameBuf.length);
  out.set(TAG, 0);
  out[4] = PACKED_V1_INSCRIBE;
  out.set(h, 5);
  out.set(b, 25);
  out[33] = nameBuf.length;
  out.set(nameBuf, 34);
  return { ok: true, reason: REASON.OK, bytes: out, message: msg };
}
