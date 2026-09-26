import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadModelParts} from '../assets/photo-3dgs/model-parts.mjs';

const directory = new URL('../assets/photo-3dgs/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('horse-sharp.manifest.json', directory), 'utf8'));
const manifestURL = new URL('horse-sharp.manifest.json', directory);

function mockFiles(t, transform = response => response) {
  t.mock.method(globalThis, 'fetch', async url => {
    const file = new URL(url);
    const response = file.pathname.endsWith('.json')
      ? new Response(JSON.stringify(manifest), {headers: {'Content-Type': 'application/json'}})
      : new Response(await readFile(file));
    return transform(response, file);
  });
}

test('all parts fit Pages and reproduce the exact original PLY', async t => {
  mockFiles(t);
  assert.equal(manifest.parts.length, 3);
  for (const part of manifest.parts) assert.ok(part.byteLength < 25 * 1024 * 1024);
  const progress = [];
  const blob = await loadModelParts(manifestURL, value => progress.push(value));
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.length, manifest.byteLength);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.deepEqual(bytes, await readFile(new URL('horse-sharp.ply', directory)));
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]));
});

test('missing manifest is reported', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 404}));
  await assert.rejects(loadModelParts(manifestURL), /404/);
});

test('missing part is reported instead of rendering incomplete data', async t => {
  mockFiles(t, (response, file) => file.pathname.endsWith('.bin') ? new Response('', {status: 404}) : response);
  await assert.rejects(loadModelParts(manifestURL), /404/);
});

test('truncated part is rejected', async t => {
  mockFiles(t, (response, file) => file.pathname.endsWith('.bin') ? new Response('truncated') : response);
  await assert.rejects(loadModelParts(manifestURL), /不完整/);
});

test('same-size corrupted data is rejected', async t => {
  mockFiles(t, async (response, file) => {
    if (!file.pathname.endsWith('.bin')) return response;
    const bytes = new Uint8Array(await response.arrayBuffer());
    bytes[0] ^= 1;
    return new Response(bytes);
  });
  await assert.rejects(loadModelParts(manifestURL), /校验失败/);
});

test('invalid manifest sizes are rejected', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({...manifest, byteLength: 1})));
  await assert.rejects(loadModelParts(manifestURL), /清单/);
});
