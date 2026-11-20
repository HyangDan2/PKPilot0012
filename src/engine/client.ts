import { INPUT_SIZE, type Detection, type LetterboxPlan } from './geometry';
import type { BackendAttempt, BackendName, WorkerRequest, WorkerResponse, WorkerStage } from './protocol';

export interface EngineReadyInfo {
  backend: BackendName;
  attempts: BackendAttempt[];
  loadMs: number;
  modelBytes: number;
  fromCache: boolean;
}

export interface InferenceResult {
  detections: Detection[];
  preprocessMs: number;
  inferMs: number;
  postprocessMs: number;
  totalMs: number;
  backend: BackendName;
}

export interface EngineCallbacks {
  onProgress?: (stage: WorkerStage, ratio: number, backend?: BackendName) => void;
  onReady?: (info: EngineReadyInfo) => void;
  onError?: (scope: 'init' | 'infer', message: string) => void;
}

interface Pending {
  resolve: (result: InferenceResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** WebGL2 is what the WebGL execution provider needs; asking costs one context. */
export function canUseWebgl2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * The page's only handle on the detector: it owns the worker, hands it pixels,
 * and turns its messages into one promise per frame.
 */
export class DetectorEngine {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private callbacks: EngineCallbacks;

  constructor(baseUrl: string, callbacks: EngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data);
    this.worker.onerror = (event) => {
      this.callbacks.onError?.('init', event.message || '추론 워커가 중단되었습니다.');
    };
    this.baseUrl = baseUrl;
  }

  private baseUrl: string;

  start(options: { forceBackend?: BackendName | null } = {}): void {
    const root = new URL(this.baseUrl, window.location.origin);
    const request: WorkerRequest = {
      type: 'init',
      modelUrl: new URL('models/yolo11n.onnx', root).href,
      wasmBase: new URL('ort/', root).href,
      allowWebgl: canUseWebgl2(),
      forceBackend: options.forceBackend ?? null,
    };
    this.worker.postMessage(request);
  }

  infer(
    rgba: Uint8ClampedArray,
    plan: LetterboxPlan,
    srcWidth: number,
    srcHeight: number,
    confidence: number,
    iou: number,
  ): Promise<InferenceResult> {
    const id = this.nextId++;
    return new Promise<InferenceResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('추론 응답이 없습니다.'));
      }, 60_000);
      this.pending.set(id, { resolve, reject, timer });
      const request: WorkerRequest = {
        type: 'infer',
        id,
        rgba,
        plan,
        srcWidth,
        srcHeight,
        confidence,
        iou,
      };
      this.worker.postMessage(request, [rgba.buffer]);
    });
  }

  terminate(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('엔진을 종료했습니다.'));
    }
    this.pending.clear();
    this.worker.terminate();
  }

  private receive(message: WorkerResponse): void {
    switch (message.type) {
      case 'progress':
        this.callbacks.onProgress?.(message.stage, message.ratio, message.backend);
        return;
      case 'ready':
        this.callbacks.onReady?.({
          backend: message.backend,
          attempts: message.attempts,
          loadMs: message.loadMs,
          modelBytes: message.modelBytes,
          fromCache: message.fromCache,
        });
        return;
      case 'error':
        this.callbacks.onError?.(message.scope, message.message);
        return;
      case 'result': {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(message.id);
        entry.resolve({
          detections: message.detections,
          preprocessMs: message.preprocessMs,
          inferMs: message.inferMs,
          postprocessMs: message.postprocessMs,
          totalMs: message.totalMs,
          backend: message.backend,
        });
        return;
      }
      default:
        return;
    }
  }
}

export { INPUT_SIZE };
