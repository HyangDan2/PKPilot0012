import { useEffect, useRef, useState } from 'react';
import { DetectorEngine } from '../engine/client';
import type { BackendAttempt, BackendName, WorkerStage } from '../engine/protocol';

export interface EngineInfo {
  phase: 'loading' | 'ready' | 'error';
  stage: WorkerStage | null;
  progress: number;
  backend: BackendName | null;
  loadMs: number;
  fromCache: boolean;
  modelBytes: number;
  attempts: BackendAttempt[];
  error: string | null;
}

const INITIAL: EngineInfo = {
  phase: 'loading',
  stage: null,
  progress: 0,
  backend: null,
  loadMs: 0,
  fromCache: false,
  modelBytes: 0,
  attempts: [],
  error: null,
};

/**
 * Boots the detector once and keeps it for the life of the page. The model is
 * fetched while the landing screen is still showing, so the first sample opens
 * with the engine already warm.
 */
export function useEngine(forceBackend: BackendName | null) {
  const [info, setInfo] = useState<EngineInfo>(INITIAL);
  const engineRef = useRef<DetectorEngine | null>(null);

  useEffect(() => {
    const engine = new DetectorEngine(import.meta.env.BASE_URL, {
      onProgress: (stage, ratio, backend) =>
        setInfo((prev) => ({ ...prev, stage, progress: ratio, backend: backend ?? prev.backend })),
      onReady: (ready) =>
        setInfo((prev) => ({
          ...prev,
          phase: 'ready',
          backend: ready.backend,
          attempts: ready.attempts,
          loadMs: ready.loadMs,
          fromCache: ready.fromCache,
          modelBytes: ready.modelBytes,
          progress: 1,
          error: null,
        })),
      onError: (scope, message) =>
        setInfo((prev) => ({
          ...prev,
          phase: scope === 'init' ? 'error' : prev.phase,
          error: message,
        })),
    });
    engineRef.current = engine;
    engine.start({ forceBackend });
    return () => {
      engine.terminate();
      engineRef.current = null;
    };
  }, [forceBackend]);

  return { info, engineRef, ready: info.phase === 'ready' };
}
