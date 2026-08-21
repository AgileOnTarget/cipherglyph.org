/**
 * CipherGlyph teaching cipher, ported from Tom Friend's simulator.
 *
 * Source (do not edit from this repo):
 *   ~/Desktop/_cryptocollectors/Shared Cipherglyph_Lesson_Plans/
 *   CipherGlyph_Teacher_Edition/06_Cipherglyph_Simulator_v3_0.html
 *
 * BACKLOG: ND-SITE-011, ND-SITE-012. Classroom encoder and decoder, plus
 * 24x24 starting drawings used as history. The product create surface is
 * the SVG sheet; GLY1 v0.5 stores the letters themselves.
 *
 * The raster is a pixel snap of the simulator's 24-unit strokes, not a
 * 1:1 anti-aliased conversion. Claude holds ND-DES-006 for Design of Record
 * hand-rasterisation. These presets are starting points a visitor can draw
 * over.
 */
import { WIDTH, HEIGHT, PIXEL_COUNT, packGlyph } from "./glyph.mjs";

const INK = 1;
const ORANGE = 2;

export const GROUPS = [
  { letters: ["A", "B", "C"], shape: "ANG" },
  { letters: ["D", "E", "F"], shape: "TRI" },
  { letters: ["G", "H", "I"], shape: "COR" },
  { letters: ["J", "K", "L"], shape: "ZIG" },
  { letters: ["M", "N", "O"], shape: "VER" },
  { letters: ["P", "Q", "R"], shape: "HOR" },
  { letters: ["S", "T", "U"], shape: "VEE" },
  { letters: ["V", "W", "X"], shape: "BOX" },
  { letters: ["Y", "Z"], shape: "DBL" },
];

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export const SHAPE_NAMES = {
  ANG: "angle",
  TRI: "triangle",
  COR: "corner",
  ZIG: "zigzag",
  VER: "vertical",
  HOR: "horizontal",
  VEE: "vee",
  BOX: "box",
  DBL: "double-angle",
};

const letterMap = {};
const codeMap = {};
for (const g of GROUPS) {
  g.letters.forEach((L, i) => {
    const dot = VOWELS.has(L) ? "R" : "L";
    const code = `${g.shape}${i + 1}${dot}`;
    letterMap[L] = { shape: g.shape, ticks: i + 1, dot, code };
    codeMap[code] = L;
  });
}

export const LETTERS = Object.freeze(Object.keys(letterMap));

export function glyphForLetter(letter) {
  const L = String(letter || "").toUpperCase();
  return letterMap[L] || null;
}

export function letterForCode(code) {
  return codeMap[String(code || "").toUpperCase()] || null;
}

export function shiftChar(ch, k) {
  if (!/[A-Z]/.test(ch)) return ch;
  const n = ch.charCodeAt(0) - 65;
  return String.fromCharCode((((n + k) % 26) + 26) % 26 + 65);
}

export function vigenereEncode(text, key) {
  const k = String(key || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!k.length) return text;
  let ki = 0;
  return String(text)
    .split("")
    .map((ch) => {
      if (!/[A-Z]/.test(ch)) return ch;
      const shift = k.charCodeAt(ki % k.length) - 65;
      ki++;
      return shiftChar(ch, shift);
    })
    .join("");
}

export function vigenereDecode(text, key) {
  const k = String(key || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!k.length) return text;
  let ki = 0;
  return String(text)
    .split("")
    .map((ch) => {
      if (!/[A-Z]/.test(ch)) return ch;
      const shift = k.charCodeAt(ki % k.length) - 65;
      ki++;
      return shiftChar(ch, -shift);
    })
    .join("");
}

function symbolForChar(ch) {
  if (ch === " " || ch === "\n" || ch === "\t") return "SPACE";
  if (ch === ".") return "DOT3";
  if (ch === ",") return "DOT2";
  const g = letterMap[ch];
  return g ? g.code : "";
}

function charForSymbol(token) {
  const t = String(token || "").toUpperCase();
  if (t === "SPACE") return " ";
  if (t === "DOT3") return ".";
  if (t === "DOT2") return ",";
  return codeMap[t] || "?";
}

/**
 * @param {string} raw
 * @param {"plain"|"caesar"|"vigenere"} mode
 * @param {string|number} key
 */
export function encodeMessage(raw, mode = "plain", key = "") {
  const upper = String(raw || "").toUpperCase();
  let letters;
  if (mode === "caesar") {
    const k = parseInt(String(key), 10) || 0;
    letters = upper.split("").map((ch) => shiftChar(ch, k));
  } else if (mode === "vigenere") {
    letters = vigenereEncode(upper, key).split("");
  } else {
    letters = upper.split("");
  }
  const encoded = letters.join("");
  const stream = letters.map(symbolForChar).filter(Boolean).join(" ");
  return { letters: encoded, stream };
}

/**
 * @param {string} stream
 * @param {"plain"|"caesar"|"vigenere"} mode
 * @param {string|number} key
 */
export function decodeStream(stream, mode = "plain", key = "") {
  const tokens = String(stream || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return { shifted: "", plain: "" };
  const shifted = tokens.map(charForSymbol).join("");
  let plain = shifted;
  if (mode === "caesar") {
    const k = parseInt(String(key), 10) || 0;
    plain = shifted
      .split("")
      .map((ch) => shiftChar(ch, -k))
      .join("");
  } else if (mode === "vigenere") {
    plain = vigenereDecode(shifted, key);
  }
  return { shifted, plain };
}

function blank() {
  return new Uint8Array(PIXEL_COUNT);
}

function plot(px, x, y, c) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) px[yi * WIDTH + xi] = c;
}

function brush(px, x, y, c, r) {
  const x0 = Math.floor(x - r);
  const x1 = Math.ceil(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.ceil(y + r);
  const r2 = r * r + 0.15;
  for (let yi = y0; yi <= y1; yi++) {
    for (let xi = x0; xi <= x1; xi++) {
      const dx = xi - x;
      const dy = yi - y;
      if (dx * dx + dy * dy <= r2) plot(px, xi, yi, c);
    }
  }
}

function line(px, x1, y1, x2, y2, c, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    brush(px, x1 + dx * t, y1 + dy * t, c, width);
  }
}

function fillDisk(px, cx, cy, r, c) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) plot(px, x, y, c);
    }
  }
}

function ring(px, cx, cy, r, c) {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - r) < 0.9) plot(px, x, y, c);
    }
  }
}

/** Map the simulator's 0..24 unit space onto pixels 0..23. */
function u(a) {
  return (a / 24) * 23;
}

const SW = 0.85;
const DOT_R = 1.35;
const RING_R = 1.45;

function drawShape(px, g) {
  const p = u;
  if (g.shape === "ANG") {
    line(px, p(6), p(18), p(18), p(6), INK, SW);
    line(px, p(18), p(6), p(18), p(18), INK, SW);
    ring(px, p(6), p(18), RING_R, INK);
  } else if (g.shape === "TRI") {
    line(px, p(5), p(19), p(12), p(5), INK, SW);
    line(px, p(12), p(5), p(19), p(19), INK, SW);
    line(px, p(5), p(19), p(19), p(19), INK, SW);
  } else if (g.shape === "COR") {
    line(px, p(6), p(5), p(6), p(19), INK, SW);
    line(px, p(6), p(19), p(19), p(19), INK, SW);
    ring(px, p(6), p(5), RING_R, INK);
  } else if (g.shape === "ZIG") {
    line(px, p(4), p(17), p(10), p(7), INK, SW);
    line(px, p(10), p(7), p(16), p(17), INK, SW);
    line(px, p(16), p(17), p(20), p(9), INK, SW);
    ring(px, p(20), p(9), RING_R * 0.85, INK);
  } else if (g.shape === "VER") {
    line(px, p(12), p(4), p(12), p(20), INK, SW);
    ring(px, p(12), p(4), RING_R, INK);
  } else if (g.shape === "HOR") {
    line(px, p(4), p(12), p(20), p(12), INK, SW);
    ring(px, p(4), p(12), RING_R, INK);
  } else if (g.shape === "VEE") {
    line(px, p(4), p(6), p(12), p(19), INK, SW);
    line(px, p(12), p(19), p(20), p(6), INK, SW);
    ring(px, p(4), p(6), RING_R, INK);
  } else if (g.shape === "BOX") {
    line(px, p(6), p(5), p(19), p(5), INK, SW);
    line(px, p(19), p(5), p(19), p(19), INK, SW);
    line(px, p(19), p(19), p(6), p(19), INK, SW);
    ring(px, p(6), p(5), RING_R, INK);
  } else if (g.shape === "DBL") {
    line(px, p(3), p(19), p(10), p(6), INK, SW);
    line(px, p(10), p(6), p(14), p(13), INK, SW);
    line(px, p(14), p(13), p(18), p(6), INK, SW);
    line(px, p(18), p(6), p(22), p(19), INK, SW);
    ring(px, p(3), p(19), RING_R * 0.85, INK);
  }

  if (g.dot === "R") fillDisk(px, p(22), p(12), DOT_R, ORANGE);
  else fillDisk(px, p(2), p(12), DOT_R, ORANGE);

  const tickY1 = p(22.2);
  const tickY2 = p(23.5);
  for (let i = 0; i < g.ticks; i++) {
    const x = p(6 + i * 4);
    line(px, x, tickY1, x, tickY2, INK, SW);
  }
}

function drawPeriod(px) {
  fillDisk(px, u(12), u(8), DOT_R, ORANGE);
  fillDisk(px, u(12), u(12), DOT_R, ORANGE);
  fillDisk(px, u(12), u(16), DOT_R, ORANGE);
}

function drawComma(px) {
  fillDisk(px, u(12), u(10), DOT_R, ORANGE);
  fillDisk(px, u(12), u(14.5), DOT_R, ORANGE);
}

/** One 24x24 pixel buffer for a letter, SPACE, period, or comma. */
export function letterPixels(ch) {
  const px = blank();
  const upper = String(ch || "").toUpperCase();
  if (upper === " " || upper === "\n" || upper === "\t") return px;
  if (upper === ".") {
    drawPeriod(px);
    return px;
  }
  if (upper === ",") {
    drawComma(px);
    return px;
  }
  const g = letterMap[upper];
  if (g) drawShape(px, g);
  return px;
}

export function letterGlyph(ch) {
  return packGlyph(letterPixels(ch));
}

export const LETTER_PRESETS = LETTERS.map((name) => ({
  name,
  pixels: letterPixels(name),
  glyph: letterGlyph(name),
}));

/** Starting drawings for the create row. Shape names would duplicate A-Z. */
export function cipherglyphPresets() {
  return LETTER_PRESETS.map(({ name, pixels }) => ({ name, pixels: Uint8Array.from(pixels) }));
}
