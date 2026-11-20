import type { Detection, LetterboxPlan } from './geometry';

export type BackendName = 'webgpu' | 'webgl' | 'wasm';

export interface BackendAttempt {
  backend: BackendName;
  ok: boolean;
  error?: string;
}

export interface InitRequest {
  type: 'init';
  /** Absolute URL of the ONNX model, already under the app's base path. */
  modelUrl: string;
  /** Absolute URL of the directory serving `ort-wasm-simd-threaded.jsep.wasm`. */
  wasmBase: string;
  /** Whether the main thread could create a WebGL2 context. */
  allowWebgl: boolean;
  /** Set only by a verification run that wants a fixed engine. */
  forceBackend?: BackendName | null;
}

export interface InferRequest {
  type: 'infer';
  id: number;
  /** 640×640 letterboxed RGBA pixels. Transferred, not copied. */
  rgba: Uint8ClampedArray;
  plan: LetterboxPlan;
  srcWidth: number;
  srcHeight: number;
  confidence: number;
  iou: number;
}

export type WorkerRequest = InitRequest | InferRequest;

export type WorkerStage = 'download' | 'session' | 'warmup';

export type WorkerResponse =
  | { type: 'progress'; stage: WorkerStage; ratio: number; backend?: BackendName; fromCache?: boolean }
  | { type: 'ready'; backend: BackendName; attempts: BackendAttempt[]; loadMs: number; modelBytes: number; fromCache: boolean }
  | { type: 'error'; scope: 'init' | 'infer'; message: string }
  | {
      type: 'result';
      id: number;
      detections: Detection[];
      preprocessMs: number;
      inferMs: number;
      postprocessMs: number;
      totalMs: number;
      backend: BackendName;
    };

export const BACKEND_LABEL: Record<BackendName, string> = {
  webgpu: 'WebGPU',
  webgl: 'WebGL',
  wasm: 'WASM',
};
