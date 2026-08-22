/**
 * Build a Glyph receipt PDF. ND-SITE-014.
 *
 * No third-party library. Helvetica is a PDF standard font.
 * Optional JPEG of the CipherGlyph sheet. Transaction fields stay honest:
 * empty txid unless this page has a recorded inscription for that message.
 *
 * Glyphs is 80 bytes. This is still not the PX-80 project.
 */

function utf8(s) {
  return new TextEncoder().encode(s);
}

function concat(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function pdfEscape(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

export function wrap(text, widthChars) {
  const raw = String(text ?? "");
  if (!raw.length) return ["(empty)"];
  const words = raw.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!w) continue;
    if (w.length > widthChars) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += widthChars) {
        lines.push(w.slice(i, i + widthChars));
      }
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > widthChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ["(empty)"];
}

export function wrapFixed(text, widthChars) {
  const raw = String(text ?? "");
  if (!raw.length) return ["(empty)"];
  const lines = [];
  for (let i = 0; i < raw.length; i += widthChars) {
    lines.push(raw.slice(i, i + widthChars));
  }
  return lines;
}

function txidLine(txid) {
  const t = String(txid ?? "").trim();
  if (!t) return "Txid: none";
  return `Txid: ${t}`;
}

function blockLine(block) {
  const t = String(block ?? "").trim();
  if (!t) return "Block: none";
  return `Block: ${t}`;
}

function confirmationsLine(n) {
  if (n === 0 || n === "0") return "Confirmations: 0";
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return "Confirmations: none";
  return `Confirmations: ${v}`;
}

function numberLine(number) {
  const t = String(number ?? "").trim();
  if (!t || t === "pending") return "Number: pending";
  return `Number: ${t}`;
}

function verificationLine(verification) {
  const t = String(verification ?? "").trim();
  if (t === "HPP VERIFIED") return "Verification: HPP VERIFIED";
  if (t === "BADGLYPH VERIFIED") return "Verification: BADGLYPH VERIFIED";
  return "Verification: unavailable";
}

/**
 * @param {object} fields
 * @param {string} fields.message
 * @param {string} fields.stream
 * @param {string} fields.hex
 * @param {string} fields.address
 * @param {string} [fields.hash160Hex]
 * @param {number} [fields.payloadLen]
 * @param {string} [fields.txid]
 * @param {string} [fields.block]
 * @param {number|string} [fields.confirmations]
 * @param {string} [fields.number]
 * @param {string} [fields.verification]
 * @param {string} [fields.burnId]
 * @param {string} [fields.burnRefHex]
 * @param {string} [fields.exportedAt]
 * @param {Uint8Array|null} [fields.imageJpeg]
 * @param {number} [fields.imageWidth]
 * @param {number} [fields.imageHeight]
 */
export function buildReceiptPdf(fields = {}) {
  const message = String(fields.message ?? "");
  const stream = String(fields.stream ?? "");
  const hex = String(fields.hex ?? "").replace(/\s+/g, "");
  const address = String(fields.address ?? "").trim();
  const hash160Hex = String(fields.hash160Hex ?? "");
  const payloadLen = Number.isFinite(fields.payloadLen) ? fields.payloadLen : hex.length / 2;
  const txid = String(fields.txid ?? "").trim();
  const block = String(fields.block ?? "").trim();
  const confirmations = fields.confirmations;
  const number = String(fields.number ?? "").trim();
  const verification = String(fields.verification ?? "").trim();
  const burnId = String(fields.burnId ?? "").trim();
  const burnRefHex = String(fields.burnRefHex ?? "");
  const exportedAt = String(fields.exportedAt ?? "");
  const jpeg = fields.imageJpeg instanceof Uint8Array && fields.imageJpeg.length ? fields.imageJpeg : null;
  const imgW = fields.imageWidth || 1;
  const imgH = fields.imageHeight || 1;

  const pageW = 612;
  const pageH = 792;
  const left = 48;
  const right = pageW - 48;
  const widthPt = right - left;
  const wrapW = 90;
  const hexW = 90;
  const topY = pageH - 56;
  const bottomY = 52;

  const items = [];
  function title(str, size) {
    items.push({ kind: "text", str, size });
  }
  function heading(str) {
    items.push({ kind: "gap", h: 10 });
    items.push({ kind: "text", str, size: 11 });
    items.push({ kind: "gap", h: 4 });
  }
  function body(lines, size = 9) {
    for (const line of lines) items.push({ kind: "text", str: line, size });
  }

  title("BADGLYPH", 22);
  items.push({ kind: "gap", h: 4 });
  title("CipherGlyph receipt", 11);
  items.push({ kind: "gap", h: 2 });
  title("Human presence. Permanently inscribed. Local export, not a chain proof.", 8);

  if (jpeg) {
    const maxW = widthPt;
    const maxH = 220;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    items.push({
      kind: "image",
      drawW: imgW * scale,
      drawH: imgH * scale,
    });
  }

  heading("MESSAGE");
  body(wrap(message || "(empty)", wrapW));
  heading("SYMBOL STREAM");
  body(wrap(stream || "(empty)", wrapW), 8);
  heading("GLY1 HEX");
  body(wrapFixed(hex || "(empty)", hexW), 8);
  heading("BADCOIN ADDRESS");
  body([address || "none"]);
  heading("TRANSACTION");
  body(
    [
      numberLine(number),
      txidLine(txid),
      blockLine(block),
      confirmationsLine(confirmations),
      verificationLine(verification),
      `Payload: ${payloadLen || 0} bytes (GLY1 v0.6, ceiling 80)`,
      `Address hash160: ${hash160Hex || "(zeroes until a valid address)"}`,
      `Burn id: ${burnId || "(none. HPP presence credits not spent)"}`,
      `Burn reference: ${burnRefHex || "(placeholder zeroes until a real burn)"}`,
      `Export time: ${exportedAt || "(unknown)"} (this computer, not a block time)`,
    ],
    8,
  );

  const pageOps = [];
  let ops = [];
  let y = topY;

  function flushPage() {
    pageOps.push(ops);
    ops = [];
    y = topY;
  }

  function need(h) {
    if (y - h < bottomY) flushPage();
  }

  for (const item of items) {
    if (item.kind === "gap") {
      need(item.h);
      y -= item.h;
      continue;
    }
    if (item.kind === "image") {
      need(item.drawH + 16);
      y -= item.drawH + 12;
      ops.push(
        `q ${item.drawW.toFixed(1)} 0 0 ${item.drawH.toFixed(1)} ${left.toFixed(1)} ${y.toFixed(1)} cm /Im1 Do Q`,
      );
      y -= 8;
      continue;
    }
    const lineH = item.size + 3;
    need(lineH);
    y -= lineH;
    ops.push(`BT /F1 ${item.size} Tf ${left.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(item.str)}) Tj ET`);
  }
  pageOps.push(ops);

  const pageCount = pageOps.length;
  const pageObjFirst = 3;
  const contentObjFirst = pageObjFirst + pageCount;
  const fontObj = contentObjFirst + pageCount;
  const imageObj = fontObj + 1;
  const lastObj = jpeg ? imageObj : fontObj;

  const objects = [];
  objects[1] = utf8("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObjFirst + i} 0 R`).join(" ");
  objects[2] = utf8(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  const resources = jpeg
    ? `<< /Font << /F1 ${fontObj} 0 R >> /XObject << /Im1 ${imageObj} 0 R >> >>`
    : `<< /Font << /F1 ${fontObj} 0 R >> >>`;

  for (let i = 0; i < pageCount; i++) {
    const contentId = contentObjFirst + i;
    objects[pageObjFirst + i] = utf8(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentId} 0 R /Resources ${resources} >>`,
    );
    const content = utf8(pageOps[i].join("\n") + "\n");
    objects[contentId] = concat([
      utf8(`<< /Length ${content.length} >>\nstream\n`),
      content,
      utf8("\nendstream"),
    ]);
  }
  objects[fontObj] = utf8("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  if (jpeg) {
    objects[imageObj] = concat([
      utf8(
        `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      utf8("\nendstream"),
    ]);
  }

  const encoder = new TextEncoder();
  const header = encoder.encode("%PDF-1.4\n");
  const parts = [header];
  const offsets = [0];
  let pos = header.length;
  for (let i = 1; i <= lastObj; i++) {
    offsets[i] = pos;
    const objHead = encoder.encode(`${i} 0 obj\n`);
    const objTail = encoder.encode("\nendobj\n");
    parts.push(objHead, objects[i], objTail);
    pos += objHead.length + objects[i].length + objTail.length;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${lastObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= lastObj; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${lastObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  parts.push(encoder.encode(xref), encoder.encode(trailer));
  return concat(parts);
}

export function receiptFilename(message) {
  const slug = String(message ?? "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug ? `badglyph-${slug.toLowerCase()}.pdf` : "badglyph-receipt.pdf";
}
