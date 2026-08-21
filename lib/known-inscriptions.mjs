/**
 * Inscriptions this page is allowed to print a txid for.
 *
 * The receipt does not invent a hash. Only a recorded Glyph may fill Txid.
 * ND-CHAIN-005: KILROY WAS HERE is the V1 80-byte inscription.
 */

export const NAMED_ADDRESS = "BADCoinT4LZuc2vXoAk8sPhsMRnzeqscPJ";

/** V1 80-byte Glyph. BadCoin mainnet. Burn reference all zeroes. */
export const V1_GLYPH = Object.freeze({
  txid: "15b55d23aa6611f4a5e13cc513d30adeb1805db2bc50424119834418bff2a6ab",
  address: NAMED_ADDRESS,
  message: "KILROY WAS HERE",
  payloadLen: 49,
  oversized: false,
  block: "0bc7edeb7ff94a9a5ff8b2377527cdfb6ab6aae670e886c7b18610368e2700ae",
  confirmations: 1,
});

/** Oversize first send. Encoder refuses this message under GLY1 v0.6. */
export const FIRST_GLYPH = Object.freeze({
  txid: "0b6e64b22c0b1e14cab656e50ef87231b951b39a7f71542f646c7f51a2e5bb3d",
  address: NAMED_ADDRESS,
  message:
    "HELLO WORLD. INTRODUCING BADGLYPH CIPHERGLYPH ON THE BADCOIN BLOCKCHAIN. FIRST GLYPH TRANSACTION ON BADCOIN .",
  payloadLen: 143,
  oversized: true,
  block: "",
});

const KNOWN = [V1_GLYPH, FIRST_GLYPH];

export function matchKnownInscription({ message, address } = {}) {
  const raw = String(message ?? "");
  const pasted = String(address ?? "").trim();
  for (const g of KNOWN) {
    if (raw !== g.message) continue;
    if (pasted && pasted !== g.address) continue;
    return g;
  }
  return null;
}
