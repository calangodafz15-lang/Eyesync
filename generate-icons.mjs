import fs from 'fs';
import zlib from 'zlib';

// Minimal script to generate valid 1x1 or sized PNG chunks with CRC32
function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(2, 9); // Truecolor (RGB)
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + width * 3 bytes per scanline
  const rowLength = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Slight medical gradient effect
      const factor = (x + y) / (width + height);
      rawData[pixelOffset] = Math.round(r * (1 - factor * 0.2));
      rawData[pixelOffset + 1] = Math.round(g * (1 + factor * 0.1));
      rawData[pixelOffset + 2] = Math.round(b * (1 + factor * 0.2));
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c;
}

// Generate files for public and root
const tealRGB = [13, 148, 136]; // #0d9488
const png192 = createPNG(192, 192, tealRGB[0], tealRGB[1], tealRGB[2]);
const png512 = createPNG(512, 512, tealRGB[0], tealRGB[1], tealRGB[2]);
const pngApple = createPNG(180, 180, tealRGB[0], tealRGB[1], tealRGB[2]);

fs.writeFileSync('public/pwa-192x192.png', png192);
fs.writeFileSync('public/pwa-512x512.png', png512);
fs.writeFileSync('public/pwa-maskable-512x512.png', png512);
fs.writeFileSync('public/apple-touch-icon.png', pngApple);

console.log('PWA PNG Icons generated successfully.');
