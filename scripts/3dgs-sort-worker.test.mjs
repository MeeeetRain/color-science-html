import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/photo-3dgs/lib/gaussian-splats-3d.module.js', import.meta.url), 'utf8');
const wasm = Object.fromEntries([...source.matchAll(/var (SorterWasm\w*) = "([^"]+)";/g)].map(match => [match[1], match[2]]));
const workerSource = source.slice(source.indexOf('function sortWorker(self)'), source.indexOf('const WebXRMode'));

// Run the actual bundled worker initializer, including WebAssembly instantiation.
for (const version of [null, {major:15, minor:4}, {major:15, minor:7}, {major:16, minor:3}, {major:16, minor:4}, {major:17, minor:0}]) {
  for (const simd of [false, true]) {
    const name = version ? `iOS ${version.major}.${version.minor}` : 'desktop';
    test(`${name}, SIMD ${simd}: worker memory matches the selected WASM`, {timeout:5000}, async () => {
      let init;
      let resolve;
      let reject;
      const ready = new Promise((yes, no) => {resolve=yes; reject=no;});
      class Worker {
        constructor(code) {
          this.self = {postMessage: message => {
            if (message.sortSetupPhase1Complete) resolve(message);
          }};
          const checkedWasm = {
            Memory: WebAssembly.Memory,
            compile: WebAssembly.compile,
            instantiate: async (...args) => {
              try {return await WebAssembly.instantiate(...args);}
              catch (error) {reject(error); throw error;}
            }
          };
          vm.runInNewContext(code, {self:this.self, WebAssembly:checkedWasm});
        }
        postMessage(data) {init=data.init; this.self.onmessage({data});}
      }
      const context = {
        ...wasm, Worker,
        Blob: class {constructor(parts) {this.code=parts.join('');}},
        URL: {createObjectURL: blob => blob.code},
        atob,
        isIOS: () => !!version,
        getIOSSemever: () => version,
        Constants: {DefaultSplatSortDistanceMapPrecision:8, BytesPerFloat:4, BytesPerInt:4, MemoryPageSize:65536, MaxScenes:32}
      };
      vm.runInNewContext(`${workerSource}\ncreateSortWorker(8, false, ${simd}, true, false);`, context);
      await ready;
      const oldIOS = version && (version.major < 16 || (version.major === 16 && version.minor < 4));
      assert.equal(init.wasmMemoryShared, !oldIOS);
    });
  }
}
