/**
 * Read-only public BadCoin Glyph lookup.
 *
 * The address typed by the visitor is only a payload-hash160 filter. The
 * explorer query key is the issuer address, matching the iPhone viewer.
 */

import { decode } from "./gly1.mjs";
import { validateAddress } from "./address.mjs";
import {
  BADCOIN_GLYPH_SNAPSHOT,
  SNAPSHOT_GENERATED_AT,
  SNAPSHOT_ISSUER_ADDRESS,
} from "./badcoin-glyph-snapshot.mjs";

export const BADCOIN_EXPLORER_BASE = "https://explorer.badcoin.dev";
export const BADCOIN_ISSUER_ADDRESS = SNAPSHOT_ISSUER_ADDRESS;
export const ISSUER_PAGE_SIZE = 20;
export const ISSUER_PAGE_CAP = 20;
export const ISSUER_TX_CAP = 200;

function hexFromBytes(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesFromHex(hex) {
  const s = String(hex ?? "").trim().replace(/^0x/i, "");
  if (!s || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function payloadFromScriptHex(hex) {
  const script = bytesFromHex(hex);
  if (!script || script.length < 2 || script[0] !== 0x6a) return null;
  let i = 1;
  const opcode = script[i++];
  let length;
  if (opcode < 0x4c) {
    length = opcode;
  } else if (opcode === 0x4c) {
    if (i >= script.length) return null;
    length = script[i++];
  } else if (opcode === 0x4d) {
    if (i + 1 >= script.length) return null;
    length = script[i] | (script[i + 1] << 8);
    i += 2;
  } else {
    return null;
  }
  if (i + length > script.length) return null;
  return script.subarray(i, i + length);
}

function extractTxids(obj) {
  const ids = [];
  const walk = (value) => {
    if (typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value)) {
      ids.push(value.toLowerCase());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      if (value.last_txs) walk(value.last_txs);
      if (value.txs) walk(value.txs);
      if (typeof value.addresses === "string") walk(value.addresses);
      if (typeof value.txid === "string") walk(value.txid);
    }
  };
  walk(obj);
  return [...new Set(ids)];
}

function scriptHexes(obj) {
  const hexes = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.hex === "string") hexes.push(value.hex);
    if (typeof value.scriptpubkey === "string") hexes.push(value.scriptpubkey);
    if (value.scriptPubKey && typeof value.scriptPubKey.hex === "string") {
      hexes.push(value.scriptPubKey.hex);
    }
    Object.values(value).forEach(walk);
  };
  walk(obj);
  return [...new Set(hexes)];
}

function blockHeight(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Number.isInteger(obj.blockheight)) return obj.blockheight;
  if (Number.isInteger(obj.height)) return obj.height;
  if (obj.tx && Number.isInteger(obj.tx.blockheight)) return obj.tx.blockheight;
  return null;
}

async function fetchJSON(url, { fetchImpl, timeoutMs = 12000 }) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function issuerTxids({ base, issuer, fetchImpl }) {
  const collected = [];
  const seen = new Set();
  let pagesRead = 0;
  let lastBatchCount = 0;
  let hitTxCap = false;
  for (let page = 0; page < ISSUER_PAGE_CAP; page++) {
    if (collected.length >= ISSUER_TX_CAP) {
      hitTxCap = true;
      break;
    }
    const start = page * ISSUER_PAGE_SIZE;
    const url = `${base}/ext/getaddresstxs/${issuer}/${start}/${ISSUER_PAGE_SIZE}`;
    const obj = await fetchJSON(url, { fetchImpl });
    const batch = extractTxids(obj);
    pagesRead += 1;
    lastBatchCount = batch.length;
    if (batch.length === 0) break;
    for (const txid of batch) {
      if (!seen.has(txid)) {
        seen.add(txid);
        collected.push(txid);
      }
      if (collected.length >= ISSUER_TX_CAP) {
        hitTxCap = true;
        break;
      }
    }
    if (hitTxCap || batch.length < ISSUER_PAGE_SIZE) break;
  }
  return {
    ids: collected,
    truncated: hitTxCap || pagesRead >= ISSUER_PAGE_CAP || lastBatchCount >= ISSUER_PAGE_SIZE,
  };
}

async function parseTx({ base, txid, filterHash160, fetchImpl }) {
  const url = `${base}/api/getrawtransaction?txid=${encodeURIComponent(txid)}&decrypt=1`;
  const obj = await fetchJSON(url, { fetchImpl });
  const scripts = scriptHexes(obj);
  const gly1 = [];
  scripts.forEach((hex, index) => {
    const payload = payloadFromScriptHex(hex) ?? bytesFromHex(hex);
    if (!payload) return;
    const decoded = decode(payload);
    if (!decoded.ok || decoded.op !== 1) return;
    gly1.push({ decoded, index, payloadHex: hexFromBytes(payload) });
  });
  const ambiguous = gly1.length > 1;
  const height = blockHeight(obj);
  return gly1
    .filter((row) => hexFromBytes(row.decoded.hash160) === filterHash160)
    .map((row) => ({
      txid,
      outputIndex: row.index,
      message: row.decoded.message,
      height,
      readable: true,
      badge: "BADGLYPH VERIFIED",
      source: "live_explorer",
      payloadHex: row.payloadHex,
      ambiguous,
      gly1OutputCount: gly1.length,
    }));
}

export function lookupBadcoinSnapshot({ addressCheck }) {
  const filterHash160 = hexFromBytes(addressCheck.hash160);
  const items = BADCOIN_GLYPH_SNAPSHOT
    .filter((row) => row.hash160Hex === filterHash160)
    .map((row) => ({
      txid: row.txid,
      outputIndex: row.outputIndex,
      message: row.message,
      height: row.blockHeight,
      readable: true,
      badge: "BADGLYPH VERIFIED",
      source: "snapshot",
      payloadHex: row.payloadHex,
      ambiguous: row.gly1OutputCount > 1,
      gly1OutputCount: row.gly1OutputCount,
    }));
  return {
    ok: true,
    reachable: true,
    reason: items.length ? "ok_snapshot" : "empty_snapshot",
    source: "snapshot",
    snapshotGeneratedAt: SNAPSHOT_GENERATED_AT,
    items,
  };
}

export async function lookupBadcoinAddress({
  address,
  addressCheck = null,
  fetchImpl = globalThis.fetch,
  base = BADCOIN_EXPLORER_BASE,
  issuer = BADCOIN_ISSUER_ADDRESS,
} = {}) {
  const checked = addressCheck ?? validateAddress(address, "mainnet");
  if (!checked.ok) {
    return { ok: false, reachable: true, reason: "bad_address", source: "none", items: [] };
  }
  if (typeof fetchImpl !== "function") {
    return lookupBadcoinSnapshot({ addressCheck: checked });
  }
  const filterHash160 = hexFromBytes(checked.hash160);
  try {
    const txids = await issuerTxids({ base, issuer, fetchImpl });
    const rows = [];
    for (const txid of txids.ids) {
      try {
        rows.push(...(await parseTx({ base, txid, filterHash160, fetchImpl })));
      } catch {
        continue;
      }
    }
    return {
      ok: true,
      reachable: true,
      reason: rows.length ? "ok" : "empty",
      source: "live_explorer",
      truncated: txids.truncated,
      items: rows,
    };
  } catch {
    const fallback = lookupBadcoinSnapshot({ addressCheck: checked });
    return {
      ...fallback,
      liveReachable: false,
      reason: fallback.items.length ? "ok_snapshot_live_unavailable" : "empty_snapshot_live_unavailable",
    };
  }
}
