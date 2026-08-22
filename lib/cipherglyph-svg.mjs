/**
 * CipherGlyph SVG sheet, ported from Tom Friend's simulator v3.0.
 *
 * Source (do not edit from this repo):
 *   ~/Desktop/_cryptocollectors/Shared Cipherglyph_Lesson_Plans/
 *   CipherGlyph_Teacher_Edition/06_Cipherglyph_Simulator_v3_0.html
 *
 * BACKLOG: ND-SITE-012. The page draws these shapes from letters. The chain
 * stores the letters, not this SVG.
 */
import { glyphForLetter } from "./cipherglyph.mjs";

export const INK = "#173f33";
export const PAPER = "#f7f3e8";
export const GRID = "#c8c1ad";

function line(x1, y1, x2, y2, w) {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${INK}" stroke-width="${(w || 2).toFixed(2)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function dot(cx, cy, r) {
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${INK}"/>`;
}

function ring(cx, cy, r, sw) {
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${PAPER}" stroke="${INK}" stroke-width="${sw.toFixed(2)}"/>`;
}

function glyph(g, x, y, c) {
  const u = c / 24;
  const px = (a) => x + a * u;
  const py = (a) => y + a * u;
  const sw = Math.max(1.4, 1.8 * u);
  const dotR = Math.max(1.6, 2.2 * u);
  const ringR = Math.max(1.8, 2.4 * u);
  const ringSW = Math.max(1.0, 1.2 * u);
  let s = "";

  if (g.shape === "ANG") {
    s += line(px(6), py(18), px(18), py(6), sw);
    s += line(px(18), py(6), px(18), py(18), sw);
    s += ring(px(6), py(18), ringR, ringSW);
  } else if (g.shape === "TRI") {
    s += line(px(5), py(19), px(12), py(5), sw);
    s += line(px(12), py(5), px(19), py(19), sw);
    s += line(px(5), py(19), px(19), py(19), sw);
  } else if (g.shape === "COR") {
    s += line(px(6), py(5), px(6), py(19), sw);
    s += line(px(6), py(19), px(19), py(19), sw);
    s += ring(px(6), py(5), ringR, ringSW);
  } else if (g.shape === "ZIG") {
    s += line(px(4), py(17), px(10), py(7), sw);
    s += line(px(10), py(7), px(16), py(17), sw);
    s += line(px(16), py(17), px(20), py(9), sw);
    s += ring(px(20), py(9), ringR * 0.85, ringSW);
  } else if (g.shape === "VER") {
    s += line(px(12), py(4), px(12), py(20), sw);
    s += ring(px(12), py(4), ringR, ringSW);
  } else if (g.shape === "HOR") {
    s += line(px(4), py(12), px(20), py(12), sw);
    s += ring(px(4), py(12), ringR, ringSW);
  } else if (g.shape === "VEE") {
    s += line(px(4), py(6), px(12), py(19), sw);
    s += line(px(12), py(19), px(20), py(6), sw);
    s += ring(px(4), py(6), ringR, ringSW);
  } else if (g.shape === "BOX") {
    s += line(px(6), py(5), px(19), py(5), sw);
    s += line(px(19), py(5), px(19), py(19), sw);
    s += line(px(19), py(19), px(6), py(19), sw);
    s += ring(px(6), py(5), ringR, ringSW);
  } else if (g.shape === "DBL") {
    s += line(px(3), py(19), px(10), py(6), sw);
    s += line(px(10), py(6), px(14), py(13), sw);
    s += line(px(14), py(13), px(18), py(6), sw);
    s += line(px(18), py(6), px(22), py(19), sw);
    s += ring(px(3), py(19), ringR * 0.85, ringSW);
  }

  if (g.dot === "R") s += dot(px(22), py(12), dotR);
  else s += dot(px(2), py(12), dotR);

  const tickY1 = py(22.2);
  const tickY2 = py(23.5);
  for (let i = 0; i < g.ticks; i++) {
    s += line(px(6 + i * 4), tickY1, px(6 + i * 4), tickY2, sw);
  }
  return s;
}

function periodMark(x, y, c) {
  const u = c / 24;
  const r = Math.max(1.6, 2.0 * u);
  return (
    dot(x + c * 0.5, y + c * 0.32, r) +
    dot(x + c * 0.5, y + c * 0.5, r) +
    dot(x + c * 0.5, y + c * 0.68, r)
  );
}

function commaMark(x, y, c) {
  const u = c / 24;
  const r = Math.max(1.6, 2.0 * u);
  return dot(x + c * 0.5, y + c * 0.42, r) + dot(x + c * 0.5, y + c * 0.6, r);
}

function gridLines(W, H, cell) {
  let g = "";
  for (let x = 0; x <= W; x += cell) {
    g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="0.6"/>`;
  }
  for (let y = 0; y <= H; y += cell) {
    g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="0.6"/>`;
  }
  return g;
}

function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

export function svgToDataUrl(markup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/**
 * Put the sheet on the page as an image. Inline SVG via innerHTML plus
 * `height: auto` collapses a one-row sheet to nothing in Safari.
 */
export function paintSheet(el, sheet) {
  if (!el || typeof document === "undefined") return;
  if (!sheet?.svg) {
    el.replaceChildren();
    return;
  }
  const img = document.createElement("img");
  img.alt = "CipherGlyph sheet";
  img.width = sheet.width;
  img.height = sheet.height;
  img.src = svgToDataUrl(sheet.svg);
  el.replaceChildren(img);
}

/**
 * @param {string|string[]} letters
 * @param {{ cols?: number, cell?: number, fixedCols?: boolean, minRows?: number }} opts
 */
export function buildSheetSvg(letters, opts = {}) {
  const chars = typeof letters === "string" ? letters.split("") : [...letters];
  const requested = clampInt(opts.cols, 4, 60, 14);
  const cols = opts.fixedCols
    ? Math.max(1, requested)
    : Math.max(1, Math.min(requested, Math.max(chars.length, 1)));
  const cell = clampInt(opts.cell, 22, 80, 40);
  const minRows = clampInt(opts.minRows, 1, 20, 1);
  const rows = Math.max(minRows, Math.ceil(Math.max(chars.length, 1) / cols));
  const W = cols * cell;
  const H = rows * cell;
  const inset = cell * 0.08;
  const drawC = cell * 0.84;

  let body = "";
  chars.forEach((ch, idx) => {
    const cx = (idx % cols) * cell;
    const cy = Math.floor(idx / cols) * cell;
    const x = cx + inset;
    const y = cy + inset;
    if (ch === " " || ch === "\n" || ch === "\t") return;
    if (ch === ".") {
      body += periodMark(cx, cy, cell);
      return;
    }
    if (ch === ",") {
      body += commaMark(cx, cy, cell);
      return;
    }
    const g = glyphForLetter(ch);
    if (g) body += glyph(g, x, y, drawC);
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="100%" height="100%" fill="${PAPER}"/>`,
    gridLines(W, H, cell),
    body,
    `</svg>`,
  ].join("");
  return { svg, chars, cols, cell, width: W, height: H };
}
