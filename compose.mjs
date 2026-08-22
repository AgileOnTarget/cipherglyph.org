/**
 * CipherGlyph composer. BACKLOG: ND-SITE-012. ADR-0008.
 *
 * A text window makes Glyphs. The chain stores the letters, not a drawing.
 * Caesar and Vigenere change the sheet only. GLY1 hex is the plain message.
 */
import { encodeMessage, decodeStream, LETTERS, SHAPE_NAMES, glyphForLetter } from "./lib/cipherglyph.mjs";
import { buildSheetSvg, paintSheet, svgToDataUrl } from "./lib/cipherglyph-svg.mjs";
import { encode as encodeGly1, decode as decodeGly1, toChainMessage, MESSAGE_MAX_BYTES, CEILING } from "./lib/gly1.mjs";
import { validateAddress } from "./lib/address.mjs";
import { parseHexPayload } from "./lib/explore-model.mjs";
import { saveChoice, loadChoice } from "./lib/glyph-choice-store.mjs";
import { buildReceiptPdf, receiptFilename } from "./lib/receipt-pdf.mjs";
import { matchKnownInscription, V1_GLYPH } from "./lib/known-inscriptions.mjs";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const PLACEHOLDER_BURN_REF = new Uint8Array(8);
const SHEET_COLS = 10;
const SHEET_CELL = 24;
const SAMPLES = [
  "KILROY WAS HERE",
  "HELLO WORLD",
  "MEET ME AT THE OLD MILL",
  "ATTACK AT DAWN",
  "FOR ELLIE. ALWAYS.",
  "KEEP THIS MESSAGE SECRET",
];

const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

function currentHash160() {
  const v = $("[data-address]")?.value ?? "";
  const r = validateAddress(v, "mainnet");
  return r.ok ? { hash160: r.hash160, real: true } : { hash160: new Uint8Array(20), real: false };
}

function mode() {
  return $("[data-cg-mode]")?.value || "plain";
}

function key() {
  return $("[data-cg-key]")?.value || "";
}

function cols() {
  return SHEET_COLS;
}

function cell() {
  return SHEET_CELL;
}

function rawText() {
  return $("[data-cg-plain]")?.value ?? "";
}

export function currentMessage() {
  return toChainMessage(rawText());
}

function clampMessageInput() {
  const ta = $("[data-cg-plain]");
  if (!ta) return;
  const chain = toChainMessage(ta.value);
  if (ta.value !== chain) ta.value = chain;
}

function refreshByteBudget(enc) {
  const el = $("[data-byte-budget]");
  if (!el) return;
  const n = enc?.ok ? enc.bytes.length : 0;
  el.textContent = `${n} of ${CEILING} bytes`;
  el.dataset.tone = n >= CEILING ? "warn" : "";
}

export function currentGlyph() {
  const message = currentMessage();
  return { message, name: message };
}

function setHint() {
  const hint = $("[data-cg-key-hint]");
  if (!hint) return;
  const m = mode();
  if (m === "caesar") {
    hint.textContent = "Caesar: an integer shift (7). Negative values allowed. Changes the Glyph sheet, not the bytes on BadCoin.";
  } else if (m === "vigenere") {
    hint.textContent = "Vigenere: a keyword of letters. Changes the Glyph sheet, not the bytes on BadCoin.";
  } else {
    hint.textContent = "Plain: each Glyph maps straight to a letter. The key is ignored. This is what goes on the chain.";
  }
}

function persist() {
  try {
    saveChoice({ message: currentMessage() });
  } catch {}
}

function refreshSheet() {
  const out = encodeMessage(rawText(), mode(), key());
  const lettersEl = $("[data-cg-letters]");
  const streamEl = $("[data-cg-stream]");
  const stage = $("[data-cg-stage]");
  if (lettersEl) lettersEl.textContent = out.letters;
  if (streamEl) streamEl.textContent = out.stream;
  if (stage) {
    const sheet = buildSheetSvg(out.letters, { cols: cols(), cell: cell() });
    paintSheet(stage, sheet);
    scheduleSheetJpeg(sheet.svg, sheet.width, sheet.height);
  }
}

let sheetJpegCache = null;
let jpegTimer = 0;

function scheduleSheetJpeg(svg, width, height) {
  if (typeof document === "undefined") return;
  clearTimeout(jpegTimer);
  jpegTimer = setTimeout(async () => {
    sheetJpegCache = await jpegFromSvg(svg, width, height);
  }, 180);
}

function refreshChainHex() {
  const out = $("[data-payload-hex]");
  const note = $("[data-payload-hex-note]");
  const preview = $("[data-chain-message]");
  clampMessageInput();
  const message = currentMessage();
  if (preview) preview.textContent = message.length ? message : "(empty)";

  const known = matchKnownInscription({
    message,
    address: ($("[data-address]")?.value ?? "").trim(),
  });
  let hash160;
  let real;
  if (known) {
    const named = validateAddress(known.address, "mainnet");
    hash160 = named.ok ? named.hash160 : new Uint8Array(20);
    real = named.ok;
  } else {
    const cur = currentHash160();
    hash160 = cur.hash160;
    real = cur.real;
  }
  const enc = encodeGly1({
    hash160,
    burnRef: PLACEHOLDER_BURN_REF,
    message,
  });
  refreshByteBudget(enc);

  if (!out) return;

  if (!enc.ok) {
    out.textContent = "";
    if (note) {
      note.textContent = `Cannot encode yet: ${enc.reason}.`;
      note.dataset.tone = "warn";
    }
    return;
  }

  out.textContent = toHex(enc.bytes);
  if (note) {
    const typed = rawText();
    const chain = message;
    const parts = [`${enc.bytes.length} of ${CEILING} bytes.`];
    parts.push(`${message.length} of ${MESSAGE_MAX_BYTES} message bytes.`);
    parts.push(real
      ? "Address hash taken from the field above."
      : "Address hash is all zeroes until you enter a valid BadCoin address.");
    parts.push("Burn reference is a placeholder: no burn exists yet, so it is zeroes rather than a convincing fake.");
    if (typed && typed.toUpperCase() !== chain && toChainMessage(typed) === chain) {
      parts.push("Characters outside A-Z, space, comma, and period are dropped from the chain field.");
    } else if (typed && typed !== chain) {
      parts.push("Lowercase is stored as uppercase.");
    }
    note.textContent = parts.join(" ");
    note.dataset.tone = "";
  }
}

function renderAll() {
  refreshSheet();
  refreshChainHex();
  refreshReceiptFacts();
  persist();
}

function decodeStreamPanel() {
  const stream = $("[data-cg-decode]")?.value ?? "";
  const r = decodeStream(stream, mode(), key());
  const out = $("[data-cg-recovered]");
  if (out) out.textContent = r.plain;
}

function decodeGly1Panel() {
  const input = $("[data-decode-input]");
  const note = $("[data-decode-note]");
  const badge = $("[data-decode-badge]");
  const meta = $("[data-decode-meta]");
  const stage = $("[data-decode-sheet]");
  if (!input) return;

  const parsed = parseHexPayload(input.value.trim());
  if (!parsed.ok) {
    const why = {
      empty: "Paste the raw payload bytes as hex.",
      odd_length: "That hex has an odd number of characters, so it is incomplete.",
      not_hex: "That is not hex. Expected characters 0 to 9 and a to f.",
    };
    if (note) {
      note.textContent = why[parsed.reason] ?? "Could not read that as hex.";
      note.dataset.tone = "warn";
    }
    return;
  }

  const decoded = decodeGly1(parsed.bytes);
  if (badge) {
    badge.textContent = decoded.ok ? "GLY1 MESSAGE" : "NOT A GLYPH";
    badge.dataset.verified = "no";
  }
  if (!decoded.ok) {
    if (note) {
      note.textContent = `Not a GLY1 payload (${decoded.reason}).`;
      note.dataset.tone = "warn";
    }
    if (meta) meta.textContent = "";
    if (stage) paintSheet(stage, null);
    return;
  }

  if (note) {
    note.textContent =
      "Reconstructed in this browser from the bytes, with no server involved. This is the message that would be on the chain. It is not an inscribed Glyph, and it is not HPP VERIFIED: nothing has been issued.";
    note.dataset.tone = "";
  }
  if (stage) {
    const sheet = buildSheetSvg(decoded.message, { cols: cols(), cell: cell() });
    paintSheet(stage, sheet);
  }
  if (meta) {
    meta.innerHTML = "";
    const rows = [
      ["Message", decoded.message || "(empty)"],
      ["Address hash160", toHex(decoded.hash160)],
      ["Burn reference", toHex(decoded.burnRef)],
      ["Payload", `${decoded.hash160.length ? 34 + decoded.messageLen : 0} bytes`.replace(/^0 bytes$/, `${34 + decoded.messageLen} bytes`)],
    ];
    rows[3][1] = `${34 + decoded.messageLen} bytes`;
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      meta.append(dt, dd);
    }
  }
}

async function copyHex() {
  const hex = $("[data-payload-hex]")?.textContent ?? "";
  const btn = $("[data-copy-hex]");
  if (!hex || !btn) return;
  try {
    await navigator.clipboard.writeText(hex);
    btn.textContent = "COPIED";
  } catch {
    const el = $("[data-payload-hex]");
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = "SELECTED, PRESS COPY";
  }
  setTimeout(() => {
    btn.textContent = "COPY HEX";
  }, 1800);
}

function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function jpegFromSvg(svgMarkup, width, height) {
  if (typeof document === "undefined" || !svgMarkup) return null;
  const w = Math.max(1, Math.round(width || 1));
  const h = Math.max(1, Math.round(height || 1));
  const url = svgToDataUrl(svgMarkup);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f3e8";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    const out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!out) return null;
    return {
      jpeg: new Uint8Array(await out.arrayBuffer()),
      width: cw,
      height: ch,
    };
  } catch {
    return null;
  }
}

function receiptFacts() {
  const handoff = $("#handoff");
  const address = ($("[data-address]")?.value ?? "").trim();
  const known = matchKnownInscription({ message: currentMessage(), address });
  const txid = (handoff?.dataset.txid ?? "").trim() || known?.txid || "";
  const block = (handoff?.dataset.block ?? "").trim() || known?.block || "";
  const number = (handoff?.dataset.number ?? "").trim();
  const verified = handoff?.dataset.verified === "yes" || Boolean(known?.txid);
  return {
    address: address || known?.address || "none",
    txid: txid || "none",
    block: block || "none",
    number: number || "pending",
    verification: verified ? "BADGLYPH VERIFIED" : "unavailable",
    confirmations:
      Number.isFinite(Number(known?.confirmations)) && Number(known.confirmations) >= 1
        ? String(Number(known.confirmations))
        : "none",
    known,
  };
}

function refreshReceiptFacts() {
  const facts = receiptFacts();
  const map = {
    "[data-receipt-address]": facts.address,
    "[data-receipt-txid]": facts.txid,
    "[data-receipt-block]": facts.block,
    "[data-receipt-confirmations]": facts.confirmations,
    "[data-receipt-number]": facts.number,
  };
  for (const [sel, value] of Object.entries(map)) {
    const el = $(sel);
    if (el) el.textContent = value;
  }
  const seal = $(".seal");
  if (seal) {
    const verified = facts.verification === "BADGLYPH VERIFIED";
    seal.classList.toggle("verified", verified);
    seal.innerHTML = verified ? "BADGLYPH<br>VERIFIED" : "VERIFICATION<br>UNAVAILABLE";
    seal.setAttribute("aria-label", verified ? "BadGlyph verified" : "Verification unavailable");
  }
}

function setExportLabel(text) {
  $$("[data-export-pdf]").forEach((btn) => {
    btn.textContent = text;
  });
}

function exportPdf() {
  const message = currentMessage();
  const stream = $("[data-cg-stream]")?.textContent ?? encodeMessage(rawText(), mode(), key()).stream;
  let hex = ($("[data-payload-hex]")?.textContent ?? "").replace(/\s+/g, "");
  const { hash160, real } = currentHash160();
  const facts = receiptFacts();
  let hash160Hex = real ? toHex(hash160) : "";
  const known = facts.known;
  if (known) {
    const named = validateAddress(known.address, "mainnet");
    if (named.ok) {
      const enc = encodeGly1({
        hash160: named.hash160,
        burnRef: PLACEHOLDER_BURN_REF,
        message: known.message,
      });
      if (enc.ok) {
        hex = toHex(enc.bytes);
        hash160Hex = toHex(named.hash160);
      }
    }
  }
  const raster = sheetJpegCache;
  const pdf = buildReceiptPdf({
    message,
    stream,
    hex,
    address: facts.address === "none" ? "" : facts.address,
    hash160Hex,
    payloadLen: hex.length / 2,
    txid: facts.txid === "none" ? "" : facts.txid,
    block: facts.block === "none" ? "" : facts.block,
    confirmations: facts.known?.confirmations,
    number: facts.number,
    verification: facts.verification,
    burnId: $("#handoff")?.dataset.burnId ?? "",
    burnRefHex: toHex(PLACEHOLDER_BURN_REF),
    exportedAt: new Date().toISOString(),
    imageJpeg: raster?.jpeg ?? null,
    imageWidth: raster?.width,
    imageHeight: raster?.height,
  });
  downloadBytes(pdf, receiptFilename(message), "application/pdf");
  setExportLabel("EXPORTED");
  setTimeout(() => {
    setExportLabel("EXPORT PDF");
  }, 1800);
}

async function copyStream() {
  const text = $("[data-cg-stream]")?.textContent ?? "";
  const btn = $("[data-cg-copy]");
  if (!text || !btn) return;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "COPIED";
  } catch {
    const el = $("[data-cg-stream]");
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = "SELECTED, PRESS COPY";
  }
  setTimeout(() => {
    btn.textContent = "COPY STREAM";
  }, 1800);
}

function buildKeyboard(root) {
  const kbd = $("[data-cg-kbd]", root);
  if (!kbd) return;
  const layout = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ"];
  kbd.innerHTML = "";
  layout.forEach((row) => {
    row.split("").forEach((L) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = L;
      b.dataset.letter = L;
      kbd.append(b);
    });
  });
  [
    [" ", "Space", true],
    [".", ".", true],
    [",", ",", true],
    ["BACK", "⌫", true],
    ["CLEAR", "Clear", true],
  ].forEach(([letter, label, action]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.letter = letter;
    if (action) b.className = "action";
    kbd.append(b);
  });
  kbd.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const L = btn.getAttribute("data-letter");
    const ta = $("[data-cg-plain]", root);
    if (!ta) return;
    if (L === "BACK") ta.value = ta.value.slice(0, -1);
    else if (L === "CLEAR") ta.value = "";
    else ta.value += L;
    renderAll();
  });
}

function buildKeyTable(root) {
  const table = $("[data-cg-keytable]", root);
  if (!table) return;
  table.innerHTML = "<tr><th>Letter</th><th>Shape</th><th>Ticks</th><th>Dot</th><th>Code</th></tr>";
  LETTERS.forEach((L) => {
    const g = glyphForLetter(L);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${L}</td><td>${SHAPE_NAMES[g.shape]}</td><td>${g.ticks}</td><td>${g.dot === "R" ? "right" : "left"}</td><td>${g.code}</td>`;
    table.append(tr);
  });
}

export function initCompose(root = document) {
  const section = $("#create", root);
  if (!section) return;

  const restored = loadChoice?.();
  const ta = $("[data-cg-plain]", root);
  if (ta) {
    if (restored?.message && restored.message !== "HELLO WORLD" && restored.message !== V1_GLYPH.message) {
      ta.value = toChainMessage(restored.message);
    } else {
      ta.value = V1_GLYPH.message;
    }
  }
  const addr = $("[data-address]", root) || $("[data-address]");
  if (addr && !String(addr.value || "").trim()) addr.value = V1_GLYPH.address;

  buildKeyboard(root);
  buildKeyTable(root);
  setHint();
  renderAll();

  $("[data-cg-mode]", root)?.addEventListener("change", () => {
    setHint();
    renderAll();
  });
  ["data-cg-plain", "data-cg-key"].forEach((attr) => {
    $(`[${attr}]`, root)?.addEventListener("input", renderAll);
  });
  $("[data-cg-render]", root)?.addEventListener("click", renderAll);
  $("[data-cg-sample]", root)?.addEventListener("click", () => {
    if (ta) ta.value = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    renderAll();
  });
  $("[data-cg-decode-go]", root)?.addEventListener("click", decodeStreamPanel);
  $("[data-cg-copy]", root)?.addEventListener("click", copyStream);
  $("[data-copy-hex]", root)?.addEventListener("click", copyHex);
  $$("[data-export-pdf]", root).forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        exportPdf();
      } catch {
        setExportLabel("EXPORT FAILED");
      }
    });
  });
  $("[data-decode-go]", root)?.addEventListener("click", decodeGly1Panel);
  $("[data-address]")?.addEventListener("input", () => {
    refreshChainHex();
    refreshReceiptFacts();
  });
}

export function initCreate(root = document) {
  return initCompose(root);
}

if (typeof document !== "undefined") initCompose();
