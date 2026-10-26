const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Minimal, zero-dependency ZIP archive creator using Node built-ins.
function createZip(files, outPath) {
  const buffers = [];
  const centralDirectory = [];
  let offset = 0;

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // DOS time / date
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
    const content = file.content;
    const uncompressedSize = content.length;
    const crc = crc32(content);
    const compressed = zlib.deflateRawSync(content, { level: 9 });
    const useCompressed = compressed.length < uncompressedSize;
    const data = useCompressed ? compressed : content;
    const method = useCompressed ? 8 : 0;
    const compressedSize = data.length;

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // flags (UTF-8)
    localHeader.writeUInt16LE(method, 8);     // compression method
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra field length
    nameBytes.copy(localHeader, 30);

    const localOffset = offset;
    buffers.push(localHeader, data);
    offset += localHeader.length + data.length;

    // Central directory header (46 bytes + name length)
    const cdHeader = Buffer.alloc(46 + nameBytes.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // signature
    cdHeader.writeUInt16LE(20, 4);         // version made by
    cdHeader.writeUInt16LE(20, 6);         // version needed
    cdHeader.writeUInt16LE(0x0800, 8);     // flags (UTF-8)
    cdHeader.writeUInt16LE(method, 10);    // compression method
    cdHeader.writeUInt16LE(dosTime, 12);
    cdHeader.writeUInt16LE(dosDate, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBytes.length, 28);
    cdHeader.writeUInt16LE(0, 30);         // extra field length
    cdHeader.writeUInt16LE(0, 32);         // comment length
    cdHeader.writeUInt16LE(0, 34);         // disk number start
    cdHeader.writeUInt16LE(0, 36);         // internal attrs
    cdHeader.writeUInt32LE(0, 38);         // external attrs
    cdHeader.writeUInt32LE(localOffset, 42); // relative offset of local header
    nameBytes.copy(cdHeader, 46);

    centralDirectory.push(cdHeader);
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const cdh of centralDirectory) {
    buffers.push(cdh);
    cdSize += cdh.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);                 // signature
  eocd.writeUInt16LE(0, 4);                          // disk number
  eocd.writeUInt16LE(0, 6);                          // disk where central dir starts
  eocd.writeUInt16LE(centralDirectory.length, 8);    // total entries on this disk
  eocd.writeUInt16LE(centralDirectory.length, 10);   // total entries
  eocd.writeUInt32LE(cdSize, 12);                    // central directory size
  eocd.writeUInt32LE(cdStart, 16);                   // offset of central directory
  eocd.writeUInt16LE(0, 20);                         // comment length

  buffers.push(eocd);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.concat(buffers));
}

function collectFiles(dir, base = '') {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'Thumbs.db') continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      result.push({ name: relPath, content: fs.readFileSync(fullPath) });
    }
  }
  return result;
}

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'pretty-fitgirl');
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const version = manifest.version;

const files = collectFiles(extDir, 'pretty-fitgirl');
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const versionedZip = path.join(distDir, `pretty-fitgirl-v${version}.zip`);
const standardZip = path.join(root, 'pretty-fitgirl.zip');

createZip(files, versionedZip);
createZip(files, standardZip);

const sizeKb = (fs.statSync(standardZip).size / 1024).toFixed(1);
console.log(`Successfully packaged Pretty FitGirl v${version}`);
console.log(`- ${path.relative(root, standardZip)} (${sizeKb} KB)`);
console.log(`- ${path.relative(root, versionedZip)} (${sizeKb} KB)`);
