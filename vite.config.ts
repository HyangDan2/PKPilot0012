import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The `onnxruntime-web/all` bundle carries a `new URL('ort-wasm-…wasm',
 * import.meta.url)`, so Vite copies a 29 MB runtime into `dist/assets` that the
 * app never loads: `ort.env.wasm.wasmPaths` points at `public/ort/`, which is
 * the copy we serve. Drop the duplicate so the deployed artifact stays half
 * the size.
 */
function dropBundledOrtWasm() {
  return {
    name: 'vektra-drop-bundled-ort-wasm',
    apply: 'build' as const,
    closeBundle() {
      const assets = join(process.cwd(), 'dist', 'assets');
      let removed = 0;
      try {
        for (const name of readdirSync(assets)) {
          if (/^ort-wasm-.*\.wasm$/.test(name)) {
            rmSync(join(assets, name));
            removed += 1;
          }
        }
      } catch {
        /* no dist/assets is not an error worth failing a build over */
      }
      if (removed > 0) console.log(`[vektra] removed ${removed} duplicate ORT wasm from dist/assets`);
    },
  };
}

// Vektra Vár is published under a GitHub Pages project sub-path.
export default defineConfig({
  base: '/PKPilot0012/',
  plugins: [react(), dropBundledOrtWasm()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2048,
  },
  worker: { format: 'es' },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true, strictPort: true },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
