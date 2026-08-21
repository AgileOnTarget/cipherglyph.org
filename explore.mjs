/**
 * Explorer view. BACKLOG: ND-SITE-001, ND-INDEX-001. Journey J5.
 *
 * On localhost, LOOK UP asks the loopback index for GLY1 payloads whose
 * hash160 matches the pasted address, then draws CipherGlyphs from those
 * letters. On public static hosts it refuses honestly because there is no
 * hosted index service yet.
 */
import { validateAddress } from "./lib/address.mjs";
import { buildAddressView, LOOKUP } from "./lib/explore-model.mjs";
import { lookupAddressRequest } from "./lib/inscriber-client.mjs";
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
    badge.textContent = item.badge || "";
    const msg = document.createElement("p");
    msg.textContent = item.message || "(unreadable payload)";
    const meta = document.createElement("p");
    meta.className = "small";
    const bits = [];
    if (item.txid) bits.push(`txid ${item.txid}`);
    if (item.height != null) bits.push(`block ${item.height}`);
    meta.textContent = bits.join(" · ");
    const stage = document.createElement("div");
    stage.className = "stage-wrap";
    if (item.readable && item.message) {
      const sheet = buildSheetSvg(item.message, { cols: 20, cell: 40 });
      paintSheet(stage, sheet);
    }
    card.append(badge, msg, stage, meta);
    box.append(card);
  }
}

function isLocalHost(win = window) {
  const h = win.location?.hostname || "";
  return h === "127.0.0.1" || h === "localhost" || h === "";
}

function wireAddressLookup(root) {
  const input = $("[data-lookup-input]", root);
  const btn = $("[data-lookup-go]", root);
  const note = $("[data-lookup-note]", root);
  if (!input || !btn) return;
  if (!isLocalHost()) {
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    setNote(
      note,
      "Address lookup is coming soon on the public site. Decode from GLY1 hex works in this browser today.",
      "warn",
    );
    return;
  }

  const run = async () => {
    const addressCheck = validateAddress(input.value, "mainnet");
    if (!addressCheck.ok) {
      const view = buildAddressView({ addressCheck, reachable: true, items: [] });
      setNote(note, view.message ?? "", "warn");
      renderItems(root, []);
      return;
    }
    setNote(note, "Looking up.", "");
    const res = await lookupAddressRequest({ address: input.value.trim() });
    const reachable = res.reachable !== false && res.reason !== "inscriber_unreachable";
    const view = buildAddressView({
      reachable,
      items: reachable ? res.items || [] : null,
      addressCheck,
    });
    const tone = view.state === LOOKUP.OK ? "ok" : "warn";
    setNote(note, view.message ?? (view.state === LOOKUP.OK ? `Found ${view.items.length}.` : ""), tone);
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
