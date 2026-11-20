import type { EngineInfo } from '../hooks/useEngine';
import { BACKEND_LABEL } from '../engine/protocol';

const STAGE_TEXT: Record<string, string> = {
  download: '모델 내려받는 중',
  session: '엔진 시작하는 중',
  warmup: '첫 추론 준비 중',
};

/**
 * The one badge that says where the inference actually runs. It is read from the
 * worker's own report — never guessed from what the browser claims to support.
 */
export function EngineBadge({
  info,
  fps,
  inferMs,
}: {
  info: EngineInfo;
  fps: number;
  inferMs: number | null;
}) {
  if (info.phase === 'error') {
    return (
      <span className="engine-badge is-error" data-testid="engine-badge" data-backend="error">
        <span className="badge-dot" />
        엔진 오류
      </span>
    );
  }

  if (info.phase === 'loading') {
    const percent = Math.round(info.progress * 100);
    return (
      <span className="engine-badge is-loading" data-testid="engine-badge" data-backend="loading">
        <span className="badge-dot" />
        <span className="badge-stage">{STAGE_TEXT[info.stage ?? 'download'] ?? '엔진 준비 중'}</span>
        <span className="badge-value" data-testid="engine-progress">{percent}%</span>
      </span>
    );
  }

  const backend = info.backend ?? 'wasm';
  return (
    <span
      className="engine-badge is-ready"
      data-testid="engine-badge"
      data-backend={backend}
      data-fps={fps > 0 ? Math.round(fps) : ''}
    >
      <span className="badge-dot" />
      <strong>{BACKEND_LABEL[backend]}</strong>
      {fps > 0 && <span className="badge-value" data-testid="fps-value">{Math.round(fps)} FPS</span>}
      {inferMs !== null && <span className="badge-value" data-testid="infer-value">{Math.round(inferMs)} ms</span>}
    </span>
  );
}
