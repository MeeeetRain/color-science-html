import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const directory = new URL('../assets/photo-3dgs/', import.meta.url);
const source = await readFile(new URL('horse-sharp.ply', directory));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const modelHash = sha256(source);
const partSize = 24 * 1024 * 1024;
const parts = [];

for (let offset = 0; offset < source.length; offset += partSize) {
  const bytes = source.subarray(offset, offset + partSize);
  const file = `horse-sharp.${modelHash.slice(0, 12)}.part-${String(parts.length + 1).padStart(2, '0')}.bin`;
  await writeFile(new URL(file, directory), bytes);
  parts.push({file, byteLength: bytes.length, sha256: sha256(bytes)});
}

const manifest = {version: 1, source: 'horse-sharp.ply', byteLength: source.length, sha256: modelHash, parts};
await writeFile(new URL('horse-sharp.manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Lossless PLY: ${source.length} bytes, ${parts.length} parts, SHA-256 ${modelHash}`);
console.log(`Output: ${fileURLToPath(directory)}`);
