// Generates the PWA icon set with zero dependencies (zlib + hand-rolled PNG chunks).
// Run: npm run icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "icons");

const CANVAS = [0x07, 0x07, 0x0b];
const VIOLET = [0x8b, 0x5c, 0xf6];
const CYAN = [0x22, 0xd3, 0xee];

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Rounded-square coverage test in normalized space, for a squircle app mark. */
function inSquircle(x, y, size, radius) {
  const nx = x / size;
  const ny = y / size;
  const r = radius / size;
  const dx = Math.max(Math.abs(nx - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(ny - 0.5) - (0.5 - r), 0);
  return Math.hypot(dx, dy) <= r;
}

/**
 * The mark: a violet-to-cyan garment silhouette (a hanger / draped top) inside a
 * dark squircle. Drawn analytically so the same code renders every size crisply.
 */
function drawIcon(size, { bleed = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const corner = bleed ? size * 0.5 : size * 0.235;
  const cx = size / 2;
  const cy = size * 0.5;
  const shoulderY = size * 0.4;
  const shoulderHalf = size * 0.235;
  const hemY = size * 0.78;
  const hemHalf = size * 0.175;
  const neckHalf = size * 0.082;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      let [r, g, b, a] = [CANVAS[0], CANVAS[1], CANVAS[2], 255];

      if (inSquircle(x, y, size, corner)) {
        const t = (x / size) * 0.55 + (y / size) * 0.45;
        r = Math.round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * t);
        g = Math.round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * t);
        b = Math.round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * t);

        // Carve out the garment silhouette: shoulders taper from a wide yoke
        // down to a narrower hem, with a neck notch at the top.
        const localY = y - shoulderY;
        if (localY >= 0) {
          const p = Math.min(localY / (hemY - shoulderY), 1);
          const half = shoulderHalf + (hemHalf - shoulderHalf) * Math.pow(p, 0.85);
          const inHem = y <= hemY;
          const inNeck = Math.abs(x - cx) < neckHalf && localY < neckHalf * 1.5;
          if (inHem && Math.abs(x - cx) < half && !inNeck) {
            // Sleeve notches: cut the outer top corners away.
            const sleeveCut = p < 0.34 && half - Math.abs(x - cx) < size * 0.03;
            if (!sleeveCut) {
              const shade = 0.86 + 0.14 * (1 - p);
              r = Math.round(r * shade);
              g = Math.round(g * shade);
              b = Math.round(b * shade);
              // Collar highlight arc.
              const d = Math.hypot(x - cx, (y - shoulderY) * 1.35);
              if (Math.abs(d - size * 0.115) < size * 0.014) {
                r = 255; g = 255; b = 255;
              }
            } else {
              r = CANVAS[0]; g = CANVAS[1]; b = CANVAS[2];
            }
          }
        }
        // Hanger hook above the shoulders.
        const hookD = Math.hypot(x - cx, y - size * 0.235);
        if (Math.abs(hookD - size * 0.052) < size * 0.016 && y < shoulderY) {
          r = 255; g = 255; b = 255;
        }
      }
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { bleed: true }],
  ["apple-touch-icon.png", 180, { bleed: true }],
  ["favicon-32.png", 32, {}],
];

for (const [name, size, opts] of targets) {
  const file = resolve(outDir, name);
  writeFileSync(file, drawIcon(size, opts));
  process.stdout.write(`icons: wrote ${name} (${size}x${size})\n`);
}
