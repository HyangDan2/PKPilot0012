#!/usr/bin/env node
/**
 * onnxruntime-web loads its runtime from a directory we serve ourselves, so the
 * build never reaches a CDN (and never hits a CORS wall).
 *
 * ObjectLens imports the `onnxruntime-web/all` bundle: it carries the WebGPU,
 * WebGL and WASM execution providers, and all three share the JSEP wasm build.
 * Only that pair is copied, into `public/ort/`, which Vite then serves as
 * `/PKPilot0012/ort/`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const out = join(root, 'public', 'ort');

if (!existsSync(dist)) {
  console.error('[sync-ort] onnxruntime-web is not installed. Run `npm ci` first.');
  process.exit(1);
}

// The all-in-one bundle references the JSEP build; the loader pairs with it.
const wanted = readdirSync(dist).filter((name) => /^ort-wasm-simd-threaded\.jsep\.(mjs|wasm)$/.test(name));
if (!wanted.some((name) => name.endsWith('.wasm'))) {
  console.error('[sync-ort] could not find ort-wasm-simd-threaded.jsep.wasm in node_modules/onnxruntime-web/dist');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
let bytes = 0;
for (const name of wanted) {
  copyFileSync(join(dist, name), join(out, name));
  bytes += statSync(join(out, name)).size;
}
console.log(`[sync-ort] ${wanted.length} files (${(bytes / 1024 / 1024).toFixed(1)} MB) → public/ort/`);
