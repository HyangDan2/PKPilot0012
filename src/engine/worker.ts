/// <reference lib="webworker" />
/**
 * The detector's whole back end lives here, off the UI thread: the model
 * download, the execution-provider race (WebGPU → WebGL → WASM), the tensor,
 * and the NMS. The page only ever posts pixels and receives boxes.
 */
import * as ort from 'onnxruntime-web/all';
import { decodeYolo, rgbaToNCHW, INPUT_SIZE, type Detection } from './geometry';
import type { BackendAttempt, BackendName, InitRequest, InferRequest, WorkerResponse } from './protocol';

const CACHE_NAME = 'vektra-var-model-v1';
let session: ort.InferenceSession | null = null;
let backend: BackendName | null = null;

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} 응답이 없습니다 (${ms} ms).`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Download once, keep it in the Cache API: the second visit boots from disk and
 * the progress bar goes straight to 100 %.
 */
async function loadModelBytes(
  url: string,
  onProgress: (ratio: number, fromCache: boolean) => void,
): Promise<{ bytes: Uint8Array; fromCache: boolean }> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      onProgress(1, true);
      return { bytes, fromCache: true };
    }
  } catch {
    cache = null;
  }

  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`모델을 내려받지 못했습니다 (HTTP ${response.status}).`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total > 0) onProgress(Math.min(0.99, received / total), false);
      }
    }
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer());
    chunks.push(buffer);
    received = buffer.length;
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress(1, false);

  if (cache) {
    try {
      await cache.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }));
    } catch {
      /* a full or blocked cache is not a reason to fail the load */
    }
  }
  return { bytes, fromCache: false };
}

async function webgpuUsable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await withTimeout(gpu.requestAdapter(), 4000, 'WebGPU 어댑터');
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function createSession(bytes: Uint8Array, provider: BackendName): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(bytes, {
    executionProviders: [provider],
    graphOptimizationLevel: 'all',
    executionMode: 'sequential',
  });
}

async function init(request: InitRequest): Promise<void> {
  const started = performance.now();
  ort.env.logLevel = 'error';
  ort.env.wasm.wasmPaths = request.wasmBase;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  if (ort.env.webgpu) ort.env.webgpu.powerPreference = 'high-performance';

  post({ type: 'progress', stage: 'download', ratio: 0 });
  const { bytes, fromCache } = await loadModelBytes(request.modelUrl, (ratio, cached) =>
    post({ type: 'progress', stage: 'download', ratio, fromCache: cached }),
  );

  const candidates: BackendName[] = [];
  if (request.forceBackend) {
    candidates.push(request.forceBackend);
  } else {
    if (await webgpuUsable()) candidates.push('webgpu');
    if (request.allowWebgl) candidates.push('webgl');
    candidates.push('wasm');
  }

  const attempts: BackendAttempt[] = [];
  for (const [index, candidate] of candidates.entries()) {
    post({ type: 'progress', stage: 'session', ratio: index / candidates.length, backend: candidate });
    try {
      const created = await withTimeout(createSession(bytes, candidate), candidate === 'wasm' ? 120_000 : 30_000, `${candidate} 세션`);
      session = created;
      backend = candidate;
      attempts.push({ backend: candidate, ok: true });
      break;
    } catch (error) {
      attempts.push({ backend: candidate, ok: false, error: describe(error) });
    }
  }

  if (!session || !backend) {
    post({ type: 'error', scope: 'init', message: '추론 엔진을 시작하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.' });
    return;
  }

  post({ type: 'progress', stage: 'warmup', ratio: 0.5, backend });
  try {
    const warm = new ort.Tensor('float32', new Float32Array(3 * INPUT_SIZE * INPUT_SIZE), [1, 3, INPUT_SIZE, INPUT_SIZE]);
    await session.run({ images: warm });
  } catch {
    /* a failed warm-up is not fatal — the first real frame will report it */
  }

  post({
    type: 'ready',
    backend,
    attempts,
    loadMs: Math.round(performance.now() - started),
    modelBytes: bytes.length,
    fromCache,
  });
}

async function infer(request: InferRequest): Promise<void> {
  const started = performance.now();
  if (!session || !backend) {
    post({ type: 'error', scope: 'infer', message: '추론 엔진이 아직 준비되지 않았습니다.' });
    return;
  }

  const preprocessStarted = performance.now();
  const tensorData = rgbaToNCHW(request.rgba, INPUT_SIZE);
  const preprocessMs = performance.now() - preprocessStarted;

  try {
    const input = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const inferStarted = performance.now();
    const output = await session.run({ images: input });
    const inferMs = performance.now() - inferStarted;

    const postStarted = performance.now();
    const head = output[session.outputNames[0]];
    const detections: Detection[] = decodeYolo(head.data as Float32Array, head.dims as number[], {
      confidence: request.confidence,
      iou: request.iou,
      plan: request.plan,
      srcWidth: request.srcWidth,
      srcHeight: request.srcHeight,
    });

    post({
      type: 'result',
      id: request.id,
      detections,
      preprocessMs: Math.round(preprocessMs * 10) / 10,
      inferMs: Math.round(inferMs * 10) / 10,
      postprocessMs: Math.round((performance.now() - postStarted) * 10) / 10,
      totalMs: Math.round((performance.now() - started) * 10) / 10,
      backend,
    });
  } catch (error) {
    post({ type: 'error', scope: 'infer', message: `추론에 실패했습니다: ${describe(error)}` });
  }
}

self.onmessage = (event: MessageEvent<InitRequest | InferRequest>) => {
  const message = event.data;
  if (message.type === 'init') {
    void init(message).catch((error) => {
      post({ type: 'error', scope: 'init', message: `엔진 준비에 실패했습니다: ${describe(error)}` });
    });
    return;
  }
  if (message.type === 'infer') {
    void infer(message);
  }
};
