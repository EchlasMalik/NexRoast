// Builds app/favicon.ico from public/NexRoast-Logo.png. Re-run this
// (`node scripts/generate-favicon.mjs`) if the logo ever changes — app/icon.png
// also needs regenerating separately (see app/icon.png's own history for how).
//
// sharp can't write .ico directly, so this resizes to a few common favicon
// sizes with sharp and hand-assembles a standard multi-image ICO container
// (PNG-in-ICO, valid since Vista, supported by every modern browser) —
// avoids depending on a one-off npm package for a single generated file.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SIZES = [16, 32, 48, 256];
const SOURCE = "public/NexRoast-Logo.png";
const OUT = "app/favicon.ico";

const pngBuffers = await Promise.all(
  SIZES.map((size) => sharp(SOURCE).resize(size, size).png().toBuffer()),
);

const headerSize = 6;
const dirEntrySize = 16;
const dataOffset0 = headerSize + dirEntrySize * SIZES.length;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(SIZES.length, 4); // image count

let runningOffset = dataOffset0;
const dirEntries = [];
for (let i = 0; i < SIZES.length; i++) {
  const size = SIZES[i];
  const buf = pngBuffers[i];
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(buf.length, 8); // image data size
  entry.writeUInt32LE(runningOffset, 12); // offset
  dirEntries.push(entry);
  runningOffset += buf.length;
}

const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
writeFileSync(OUT, ico);
console.log(`Wrote ${OUT} (${ico.length} bytes, sizes: ${SIZES.join(", ")})`);
