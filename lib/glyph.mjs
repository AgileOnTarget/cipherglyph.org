/**
 * BadPixies encoding = 0x01 pixel packing for a GLY1 glyph field.
 * 24x24, 4 bits per pixel, row-major, high nibble first. Exactly 288 bytes.
 *
 * Glyphs is 80 bytes. This is still not the PX-80 project.
 */
export const WIDTH = 24;
export const HEIGHT = 24;
export const PIXEL_COUNT = WIDTH * HEIGHT;
export const GLYPH_BYTES = PIXEL_COUNT / 2;

/** Paper, ink, orange. Indices 3 to 15 unused in V1 fixtures; render as ink. */
export const PALETTE = [
  "#f4ead8",
  "#141210",
  "#e36a1a",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
  "#141210",
];

export function packGlyph(pixels) {
  if (!(pixels instanceof Uint8Array) || pixels.length !== PIXEL_COUNT) {
    throw new Error("glyph pixels must be 576 indices");
  }
  const out = new Uint8Array(GLYPH_BYTES);
  for (let i = 0; i < PIXEL_COUNT; i += 2) {
    out[i / 2] = ((pixels[i] & 0x0f) << 4) | (pixels[i + 1] & 0x0f);
  }
  return out;
}

export function unpackGlyph(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== GLYPH_BYTES) {
    throw new Error("glyph field must be 288 bytes");
  }
  const out = new Uint8Array(PIXEL_COUNT);
  for (let i = 0; i < GLYPH_BYTES; i++) {
    out[i * 2] = bytes[i] >> 4;
    out[i * 2 + 1] = bytes[i] & 0x0f;
  }
  return out;
}

/**
 * Nearest-neighbour only. Smoothing would lie about the 24x24 that goes on chain.
 */
export function paintGlyph(ctx, bytes, scale) {
  const pixels = unpackGlyph(bytes);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      ctx.fillStyle = PALETTE[pixels[y * WIDTH + x]] || PALETTE[1];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
