import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../artifacts/wordle-war/public/icons");
mkdirSync(OUT, { recursive: true });

// ── Minimal PNG encoder ───────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeB = Buffer.from(type);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const crcIn = Buffer.concat([typeB, data]);
  const crcB = Buffer.allocUnsafe(4); crcB.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function makePNG(pixels: Uint8Array, size: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

  // Raw image data with filter byte 0 per row
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 3;
      const ri = y * (1 + size * 3) + 1 + x * 3;
      raw[ri]     = pixels[pi];
      raw[ri + 1] = pixels[pi + 1];
      raw[ri + 2] = pixels[pi + 2];
    }
  }

  const idat = deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk("IHDR", ihdrData), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Icon design ───────────────────────────────────────────────────────────────
// Dark background with a Wordle-style 5-cell grid and red "W" letter

function renderIcon(size: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const pad = size * 0.1;

  // Background: very dark blue-black
  const BG: [number, number, number] = [8, 8, 18];
  // Red accent
  const RED: [number, number, number] = [220, 38, 38];
  // Light grey
  const LIGHT: [number, number, number] = [226, 232, 240];

  // Draw rounded rectangle helper
  function setPixel(x: number, y: number, color: [number, number, number], alpha = 1) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (Math.round(y) * size + Math.round(x)) * 3;
    pixels[i]     = Math.round(pixels[i]     * (1 - alpha) + color[0] * alpha);
    pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + color[1] * alpha);
    pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + color[2] * alpha);
  }

  function fillRect(x0: number, y0: number, w: number, h: number, color: [number, number, number], r = 0) {
    for (let y = Math.floor(y0); y <= Math.ceil(y0 + h); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x0 + w); x++) {
        // Corner rounding via distance to nearest corner
        let inside = true;
        if (r > 0) {
          const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r));
          const dy = Math.max(y0 + r - y, 0, y - (y0 + h - r));
          inside = dx * dx + dy * dy <= r * r;
        }
        if (inside) setPixel(x, y, color);
      }
    }
  }

  // Fill background
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = BG[0]; pixels[i + 1] = BG[1]; pixels[i + 2] = BG[2];
  }

  // Outer rounded card background (slightly lighter)
  const cardPad = size * 0.08;
  fillRect(cardPad, cardPad, size - cardPad * 2, size - cardPad * 2, [14, 14, 28], size * 0.1);

  // Draw 5 Wordle-style tiles across the top third
  const tileCount = 5;
  const tileSize = (size - pad * 2) / tileCount * 0.82;
  const tileGap = (size - pad * 2 - tileSize * tileCount) / (tileCount - 1);
  const tileTop = cy - size * 0.28;
  const tileColors: Array<[number, number, number]> = [
    [57, 121, 67],   // correct (green)
    [181, 159, 59],  // present (yellow)
    RED,             // red
    [181, 159, 59],
    [57, 121, 67],
  ];

  for (let i = 0; i < tileCount; i++) {
    const tx = pad + i * (tileSize + tileGap);
    fillRect(tx, tileTop, tileSize, tileSize, tileColors[i], tileSize * 0.12);
  }

  // Draw "WW" text using thick strokes (approximated with rectangles)
  const letterTop = cy + size * 0.05;
  const letterH = size * 0.32;
  const letterW = size * 0.35;
  const stroke = size * 0.065;

  // Letter W (left) — 5 bars forming W shape
  function drawW(lx: number, color: [number, number, number]) {
    const lw = letterW;
    const lh = letterH;
    // Left leg
    fillRect(lx, letterTop, stroke, lh, color);
    // Right leg
    fillRect(lx + lw - stroke, letterTop, stroke, lh, color);
    // Center peak going up from bottom center
    fillRect(lx + lw / 2 - stroke / 2, letterTop + lh * 0.35, stroke, lh * 0.65, color);
    // Bottom-left diagonal (approximated)
    for (let t = 0; t <= 1; t += 0.01) {
      const x = lx + t * (lw / 2 - stroke / 2);
      const y = letterTop + lh - t * lh * 0.5;
      fillRect(x, y, stroke * 0.8, stroke * 0.8, color);
    }
    // Bottom-right diagonal
    for (let t = 0; t <= 1; t += 0.01) {
      const x = lx + lw / 2 + stroke / 2 + t * (lw / 2 - stroke / 2);
      const y = letterTop + lh * 0.5 + t * lh * 0.5;
      fillRect(x, y, stroke * 0.8, stroke * 0.8, color);
    }
  }

  const totalW = letterW * 2 + size * 0.04;
  const startX = cx - totalW / 2;
  drawW(startX, LIGHT);
  drawW(startX + letterW + size * 0.04, RED);

  return pixels;
}

// ── Write icons ───────────────────────────────────────────────────────────────

const sizes: Array<[number, string]> = [
  [512, "icon-512.png"],
  [192, "icon-192.png"],
  [180, "icon-180.png"],  // apple-touch-icon
];

console.log("Generating app icons...");
for (const [size, name] of sizes) {
  const pixels = renderIcon(size);
  const png = makePNG(pixels, size);
  writeFileSync(join(OUT, name), png);
  console.log(`  ✓ ${name} (${size}x${size})`);
}
console.log("\nDone!");
