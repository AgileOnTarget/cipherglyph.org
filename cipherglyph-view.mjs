/**
 * CipherGlyph teaching page. ND-SITE-010.
 *
 * Lesson plus simulator on a separate page from the inscribe flow.
 * Reuses the one CipherGlyph codec. Does not encode GLY1. Does not call HPP.
 */
import {
  encodeMessage,
  decodeStream,
  LETTERS,
  GROUPS,
  SHAPE_NAMES,
  glyphForLetter,
} from "./lib/cipherglyph.mjs";
import { buildSheetSvg, paintSheet } from "./lib/cipherglyph-svg.mjs";

const $ = (s, r = document) => r.querySelector(s);

const SAMPLES = [
  "HELLO WORLD",
  "MEET ME AT THE OLD MILL",
  "KEEP THIS MESSAGE SECRET",
];

function mode() {
  return $("[data-teach-mode]")?.value || "plain";
}

function key() {
  return $("[data-teach-key]")?.value || "";
}

function cols() {
  return $("[data-teach-cols]")?.value || 14;
}

function cell() {
  return $("[data-teach-cell]")?.value || 40;
}

function rawText() {
  return $("[data-teach-plain]")?.value ?? "";
}

function setHint() {
  const hint = $("[data-teach-key-hint]");
  if (!hint) return;
  const m = mode();
  if (m === "caesar") {
    hint.textContent =
      "Caesar: an integer shift (7). Negative values allowed. Classroom overlay only.";
  } else if (m === "vigenere") {
    hint.textContent =
      "Vigenere: a keyword of letters. Classroom overlay only. Not a lock. Kasiski broke it in 1863.";
  } else {
    hint.textContent = "Plain: each Glyph maps straight to a letter. That is the teaching default.";
  }
}

function refresh() {
  const out = encodeMessage(rawText(), mode(), key());
  const lettersEl = $("[data-teach-letters]");
  const streamEl = $("[data-teach-stream]");
  const stage = $("[data-teach-stage]");
  if (lettersEl) lettersEl.textContent = out.letters;
  if (streamEl) streamEl.textContent = out.stream;
  if (stage) {
    const sheet = buildSheetSvg(out.letters, { cols: cols(), cell: cell() });
    paintSheet(stage, sheet);
  }
}

function fillKeytable() {
  const table = $("[data-teach-keytable]");
  if (!table) return;
  const rows = ["<tr><th>Letter</th><th>Code</th><th>Shape</th><th>Ticks</th><th>Dot</th></tr>"];
  for (const L of LETTERS) {
    const g = glyphForLetter(L);
    rows.push(
      `<tr><td>${L}</td><td><code>${g.code}</code></td><td>${SHAPE_NAMES[g.shape]}</td><td>${g.ticks}</td><td>${g.dot === "R" ? "right (vowel)" : "left"}</td></tr>`,
    );
  }
  table.innerHTML = rows.join("");
}

function fillGroups() {
  const table = $("[data-teach-groups]");
  if (!table) return;
  const rows = ["<tr><th>Shape</th><th>Letters</th><th>Name</th></tr>"];
  for (const g of GROUPS) {
    rows.push(
      `<tr><td><code>${g.shape}</code></td><td>${g.letters.join(" ")}</td><td>${SHAPE_NAMES[g.shape]}</td></tr>`,
    );
  }
  table.innerHTML = rows.join("");
}

function fillKeyboard() {
  const kbd = $("[data-teach-kbd]");
  if (!kbd) return;
  kbd.innerHTML = "";
  for (const L of LETTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = L;
    b.addEventListener("click", () => {
      const area = $("[data-teach-plain]");
      if (!area) return;
      area.value = `${area.value}${L}`;
      refresh();
    });
    kbd.appendChild(b);
  }
}

export function initTeaching() {
  fillKeytable();
  fillGroups();
  fillKeyboard();
  setHint();
  refresh();

  $("[data-teach-plain]")?.addEventListener("input", refresh);
  $("[data-teach-mode]")?.addEventListener("change", () => {
    setHint();
    refresh();
  });
  $("[data-teach-key]")?.addEventListener("input", refresh);
  $("[data-teach-cols]")?.addEventListener("input", refresh);
  $("[data-teach-cell]")?.addEventListener("input", refresh);
  $("[data-teach-render]")?.addEventListener("click", refresh);
  $("[data-teach-sample]")?.addEventListener("click", () => {
    const area = $("[data-teach-plain]");
    if (!area) return;
    const i = SAMPLES.indexOf(area.value.trim());
    area.value = SAMPLES[(i + 1) % SAMPLES.length];
    refresh();
  });
  $("[data-teach-copy]")?.addEventListener("click", async () => {
    const stream = $("[data-teach-stream]")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(stream);
    } catch {}
  });
  $("[data-teach-decode-go]")?.addEventListener("click", () => {
    const stream = $("[data-teach-decode]")?.value ?? "";
    const rec = decodeStream(stream, mode(), key());
    const out = $("[data-teach-recovered]");
    if (out) out.textContent = rec.plain;
  });
}

if (typeof document !== "undefined") {
  initTeaching();
}
