/**
 * Explorer view. BACKLOG: ND-SITE-001, ND-INDEX-001. Journey J5.
 *
 * LOOK UP asks the public BadCoin explorer for the issuer history, filters
 * GLY1 payloads by the typed address hash160, and draws CipherGlyphs from
 * those letters. If browser CORS blocks the explorer, it uses the bundled
 * public chain snapshot so the reader still works.
 */
import { validateAddress } from "./lib/address.mjs";
import { buildAddressView, LOOKUP } from "./lib/explore-model.mjs";
import { lookupBadcoinAddress } from "./lib/badcoin-explorer-client.mjs";
import { buildSheetSvg, paintSheet } from "./lib/cipherglyph-svg.mjs";

const $ = (sel, root = document) => root.querySelector(sel);

function setNote(el, text, tone = "") {
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function renderItems(root, items) {
  const box = $("[data-lookup-results]", root);
  if (!box) return;
  box.replaceChildren();
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "lookup-card";
    const badge = document.createElement("p");
    badge.className = "lookup-badge";
    badge.textContent = lookupBadge(item);
    if (badge.textContent === "BADGLYPH VERIFIED") badge.dataset.verified = "yes";
    const msg = document.createElement("p");
    msg.textContent = item.message || "(unreadable payload)";
    const meta = document.createElement("p");
    meta.className = "small";
    const bits = [];
    if (item.txid) bits.push(`txid ${item.txid}`);
    if (item.height != null) bits.push(`block ${item.height}`);
    meta.textContent = bits.join(" · ");
    const stage = document.createElement("div");
    stage.className = "stage-wrap lookup-stage";
    if (item.readable && item.message) {
      const sheet = buildSheetSvg(item.message, { cols: 23, minRows: 2, fixedCols: true, cell: 64 });
      paintSheet(stage, sheet);
    }
    card.append(badge, msg, stage, meta);
    box.append(card);
  }
}

function lookupBadge(item) {
  if (!item) return "";
  if (
    item.source === "snapshot" ||
    item.source === "live_explorer" ||
    item.source === "badcoin_glyph_snapshot"
  ) {
    return "BADGLYPH VERIFIED";
  }
  if (item.txid && item.payloadHex && item.readable) return "BADGLYPH VERIFIED";
  return item.badge || "";
}

function wireAddressLookup(root) {
  const input = $("[data-lookup-input]", root);
  const btn = $("[data-lookup-go]", root);
  const note = $("[data-lookup-note]", root);
  if (!input || !btn) return;

  const run = async () => {
    const addressCheck = validateAddress(input.value, "mainnet");
    if (!addressCheck.ok) {
      const view = buildAddressView({ addressCheck, reachable: true, items: [] });
      setNote(note, view.message ?? "", "warn");
      renderItems(root, []);
      return;
    }
    setNote(note, "Looking up public BadCoin Glyphs.", "");
    const res = await lookupBadcoinAddress({
      address: input.value.trim(),
      addressCheck,
    });
    const reachable = res.reachable !== false;
    const view = buildAddressView({
      reachable,
      items: reachable ? res.items || [] : null,
      addressCheck,
    });
    const tone = view.state === LOOKUP.OK ? "ok" : "warn";
    const suffix = res.source === "snapshot"
      ? ` Loaded from the public chain snapshot generated ${res.snapshotGeneratedAt}.`
      : "";
    const truncation = res.truncated ? " Lookup hit the MVP history cap, so the list may be incomplete." : "";
    const message = view.message ??
      (view.state === LOOKUP.OK ? `Found ${view.items.length}.` : "") + suffix + truncation;
    setNote(
      note,
      message,
      tone,
    );
    renderItems(root, view.items);
  };

  btn.addEventListener("click", () => {
    run().catch(() => {
      setNote(note, "Cannot reach the index right now. This does not mean there are none.", "warn");
      renderItems(root, []);
    });
  });
}

export function initExplore(root = document) {
  const section = $("#explore", root);
  if (!section) return;
  wireAddressLookup(section);
}

if (typeof document !== "undefined") initExplore();
