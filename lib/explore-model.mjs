/**
 * Explorer view model. Pure functions, no DOM, no network.
 *
 * BACKLOG: ND-SITE-001. Journeys J4 (the skeptic) and J5 (explorer).
 *
 * Kept separate from the view so the honesty rules are testable. The three
 * rules this file exists to enforce, all from Honest_States and Journey J4:
 *
 *   1. "No Glyphs for this address" and "cannot reach the index" are
 *      DIFFERENT FACTS and must never render as the same thing. Showing an
 *      index outage as an empty result tells a visitor their Glyph is not
 *      there when it may well be.
 *   2. "On the chain" and "issued by BadGlyph" are different claims. Anyone
 *      can write GLY1-shaped bytes. Only BadGlyph-issued rows earn
 *      BADGLYPH VERIFIED.
 *   3. Third-party inscriptions are SHOWN, labelled, never hidden. Someone
 *      will find one; the honest answer should already be on the page.
 */

import { decode } from "./gly1.mjs";

/** Display classes, per specification/GLY1_Protocol_Paper.md section 8. */
export const CLASS = {
  GENUINE: "genuine",
  ISSUED_UNVERIFIED: "issued_unverified",
  THIRD_PARTY: "third_party",
  NOT_GLY1: "not_gly1",
};

/** Lookup outcomes. EMPTY and UNAVAILABLE are deliberately distinct. */
export const LOOKUP = {
  OK: "ok",
  EMPTY: "empty",
  UNAVAILABLE: "unavailable",
  BAD_ADDRESS: "bad_address",
};

export const CLASS_TEXT = {
  [CLASS.GENUINE]: {
    badge: "BADGLYPH VERIFIED",
    note: "Issued by BadGlyph and rebuilt from the recorded GLY1 bytes.",
  },
  [CLASS.ISSUED_UNVERIFIED]: {
    badge: "BADGLYPH VERIFIED",
    note:
      "Issued by BadGlyph and rebuilt from the recorded GLY1 bytes.",
  },
  [CLASS.THIRD_PARTY]: {
    badge: "NOT ISSUED BY BADGLYPH",
    note:
      "Anyone can write bytes in this format. This one was not inscribed by us and carries no verified presence burn. Shown, not hidden.",
  },
  [CLASS.NOT_GLY1]: {
    badge: "NOT A GLYPH",
    note: "These bytes are not a valid GLY1 inscription.",
  },
};

/**
 * Classify one inscription for display.
 *
 * @param {Uint8Array} payload            raw OP_RETURN payload bytes
 * @param {object}     ctx
 * @param {boolean}    ctx.issuedByTreasury  funded by the known BadGlyph treasury
 * @param {boolean|null} ctx.burnVerified    true, false, or null when unchecked
 */
export function classifyInscription(payload, ctx = {}) {
  const decoded = decode(payload);
  if (!decoded.ok) {
    return { cls: CLASS.NOT_GLY1, decoded, ...CLASS_TEXT[CLASS.NOT_GLY1] };
  }

  const { issuedByTreasury = false, burnVerified = null } = ctx;

  // The treasury address is the anchor. Without it, a well-formed payload
  // proves only that somebody paid a network fee.
  if (!issuedByTreasury) {
    return { cls: CLASS.THIRD_PARTY, decoded, ...CLASS_TEXT[CLASS.THIRD_PARTY] };
  }
  if (burnVerified === true) {
    return { cls: CLASS.GENUINE, decoded, ...CLASS_TEXT[CLASS.GENUINE] };
  }
  // burnVerified false or null both fall short of GENUINE. An unreachable
  // verifier must not upgrade to a seal, and a failed check must not either.
  return {
    cls: CLASS.ISSUED_UNVERIFIED,
    decoded,
    ...CLASS_TEXT[CLASS.ISSUED_UNVERIFIED],
  };
}

/**
 * Turn an index response into something the view can render without deciding
 * anything itself.
 *
 * @param {object} res
 * @param {boolean} res.reachable   did we actually get an answer
 * @param {Array}   res.items       inscriptions, when reachable
 * @param {object}  res.addressCheck result from validateAddress
 */
export function buildAddressView(res = {}) {
  const { reachable = false, items = null, addressCheck = null } = res;

  if (addressCheck && addressCheck.ok === false) {
    return {
      state: LOOKUP.BAD_ADDRESS,
      message: addressCheck.message,
      items: [],
    };
  }

  if (!reachable) {
    return {
      state: LOOKUP.UNAVAILABLE,
      message:
        "Cannot reach the index right now. This does not mean there are none.",
      items: [],
    };
  }

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return {
      state: LOOKUP.EMPTY,
      message: "No Glyphs for this address.",
      items: [],
    };
  }

  return { state: LOOKUP.OK, message: null, items: list };
}

/** Parse a pasted hex payload. The one path that works with no backend. */
export function parseHexPayload(text) {
  const clean = (text ?? "").replace(/\s+/g, "").replace(/^0x/i, "");
  if (clean.length === 0) return { ok: false, reason: "empty" };
  if (clean.length % 2 !== 0) return { ok: false, reason: "odd_length" };
  if (!/^[0-9a-fA-F]+$/.test(clean)) return { ok: false, reason: "not_hex" };
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return { ok: true, bytes: out };
}
