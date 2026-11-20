import type { Detection } from '../engine/geometry';
import { COCO_CLASSES, classNameKo } from '../engine/labels';
import { IconMosaic } from './Icons';

export type ClassMode = 'show' | 'blur';

interface Props {
  detections: readonly Detection[];
  hidden: ReadonlySet<number>;
  blurred: ReadonlySet<number>;
  mode: ClassMode;
  onMode: (mode: ClassMode) => void;
  onToggleHidden: (classId: number) => void;
  onToggleBlur: (classId: number) => void;
  onShowAll: () => void;
}

/**
 * All 80 COCO classes, the ones actually on screen first. In `표시` the tap hides
 * or restores a class; in `모자이크` the same tap marks it for pixelation.
 */
export function ClassFilter({ detections, hidden, blurred, mode, onMode, onToggleHidden, onToggleBlur, onShowAll }: Props) {
  const counts = new Map<number, number>();
  for (const detection of detections) counts.set(detection.classId, (counts.get(detection.classId) ?? 0) + 1);

  const ordered = [...COCO_CLASSES].sort((a, b) => {
    const ca = counts.get(a.id) ?? 0;
    const cb = counts.get(b.id) ?? 0;
    if (ca !== cb) return cb - ca;
    return a.id - b.id;
  });
  const detectedCount = counts.size;

  return (
    <div className="class-filter" data-testid="class-filter">
      <div className="class-head">
        <div className="segmented" role="group" aria-label="클래스 조작 모드">
          <button
            type="button"
            className={mode === 'show' ? 'is-on' : ''}
            onClick={() => onMode('show')}
            data-testid="class-mode-show"
            aria-pressed={mode === 'show'}
          >
            표시
          </button>
          <button
            type="button"
            className={mode === 'blur' ? 'is-on' : ''}
            onClick={() => onMode('blur')}
            data-testid="class-mode-blur"
            aria-pressed={mode === 'blur'}
          >
            <IconMosaic size={13} /> 모자이크
          </button>
        </div>
        <button type="button" className="link-btn" onClick={onShowAll} data-testid="class-show-all">
          전체 표시
        </button>
      </div>

      <p className="class-hint">
        {mode === 'show'
          ? `탐지된 ${detectedCount}종 · 눌러서 화면에서 숨기거나 되돌립니다.`
          : '가릴 클래스를 고르세요. 위의 모자이크 스위치를 켜면 픽셀 단위로 가립니다.'}
      </p>

      <div className="class-chips" role="list">
        {ordered.map((entry) => {
          const count = counts.get(entry.id) ?? 0;
          const isHidden = hidden.has(entry.id);
          const isBlurred = blurred.has(entry.id);
          const state = mode === 'show' ? (isHidden ? 'off' : 'on') : isBlurred ? 'blur' : 'idle';
          return (
            <button
              key={entry.id}
              type="button"
              role="listitem"
              className={`class-chip ${count > 0 ? 'has-count' : ''} ${state === 'off' ? 'is-off' : ''} ${state === 'blur' ? 'is-blur' : ''}`}
              data-testid={`class-${entry.id}`}
              data-class-id={entry.id}
              data-state={state}
              title={`${entry.ko} · ${entry.en}`}
              onClick={() => (mode === 'show' ? onToggleHidden(entry.id) : onToggleBlur(entry.id))}
            >
              {mode === 'blur' && isBlurred && <IconMosaic size={11} />}
              <span className="chip-label">{classNameKo(entry.id)}</span>
              {count > 0 && <span className="chip-count">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
