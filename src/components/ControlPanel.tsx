import type { Detection } from '../engine/geometry';
import { BACKEND_LABEL } from '../engine/protocol';
import type { EngineInfo } from '../hooks/useEngine';
import { ClassFilter, type ClassMode } from './ClassFilter';
import { IconCopy, IconDownload, IconEye, IconMosaic } from './Icons';

interface Props {
  confidence: number;
  iou: number;
  onConfidence: (value: number) => void;
  onIou: (value: number) => void;
  showBoxes: boolean;
  showLabels: boolean;
  mosaic: boolean;
  onToggleBoxes: () => void;
  onToggleLabels: () => void;
  onToggleMosaic: () => void;
  detections: readonly Detection[];
  hidden: ReadonlySet<number>;
  blurred: ReadonlySet<number>;
  classMode: ClassMode;
  onClassMode: (mode: ClassMode) => void;
  onToggleHidden: (classId: number) => void;
  onToggleBlur: (classId: number) => void;
  onShowAll: () => void;
  onExportPng: () => void;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  exportBusy: boolean;
  canExport: boolean;
  info: EngineInfo;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  testId,
  icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
  testId: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-row ${checked ? 'is-on' : ''}`}
      onClick={onChange}
      data-testid={testId}
    >
      <span className="toggle-icon" aria-hidden>
        {icon}
      </span>
      <span className="toggle-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}

export function ControlPanel(props: Props) {
  const { detections, hidden, blurred } = props;
  const visible = detections.filter((detection) => !hidden.has(detection.classId));
  const visibleClasses = new Set(visible.map((detection) => detection.classId));
  const blurredVisible = visible.filter((detection) => blurred.has(detection.classId)).length;

  return (
    <aside className="panel" aria-label="탐지 제어" data-testid="control-panel">
      <section className="panel-block">
        <div className="block-head">
          <h2>탐지 감도</h2>
          <span className="block-value" data-testid="detection-summary">
            탐지 {visible.length}개 · 클래스 {visibleClasses.size}종
          </span>
        </div>
        <label className="slider-row">
          <span className="slider-label">
            신뢰도 <b data-testid="conf-value">{Math.round(props.confidence * 100)}%</b>
          </span>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={props.confidence}
            onChange={(event) => props.onConfidence(Number(event.target.value))}
            data-testid="conf-slider"
            aria-label="신뢰도 하한"
          />
          <span className="slider-scale">
            <i>낮게</i>
            <i>높게</i>
          </span>
        </label>
        <label className="slider-row">
          <span className="slider-label">
            IoU <b data-testid="iou-value">{props.iou.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.01}
            value={props.iou}
            onChange={(event) => props.onIou(Number(event.target.value))}
            data-testid="iou-slider"
            aria-label="IoU 병합 기준"
          />
          <span className="slider-scale">
            <i>많이 병합</i>
            <i>적게 병합</i>
          </span>
        </label>
      </section>

      <section className="panel-block">
        <div className="block-head">
          <h2>클래스</h2>
          <span className="block-value">{blurredVisible > 0 ? `모자이크 ${blurredVisible}개` : 'COCO 80종'}</span>
        </div>
        <ClassFilter
          detections={detections}
          hidden={hidden}
          blurred={blurred}
          mode={props.classMode}
          onMode={props.onClassMode}
          onToggleHidden={props.onToggleHidden}
          onToggleBlur={props.onToggleBlur}
          onShowAll={props.onShowAll}
        />
      </section>

      <section className="panel-block">
        <div className="block-head">
          <h2>화면 표시</h2>
        </div>
        <div className="toggle-list">
          <Toggle label="바운딩 박스" checked={props.showBoxes} onChange={props.onToggleBoxes} testId="toggle-boxes" icon={<IconEye size={15} />} />
          <Toggle label="클래스 라벨" checked={props.showLabels} onChange={props.onToggleLabels} testId="toggle-labels" icon={<IconEye size={15} />} />
          <Toggle
            label="선택 클래스 모자이크"
            hint="가릴 클래스의 픽셀을 가립니다."
            checked={props.mosaic}
            onChange={props.onToggleMosaic}
            testId="toggle-mosaic"
            icon={<IconMosaic size={15} />}
          />
        </div>
      </section>

      <section className="panel-block">
        <div className="block-head">
          <h2>내보내기</h2>
          <span className="block-value">좌표는 원본 픽셀</span>
        </div>
        <div className="export-list">
          <button type="button" className="btn primary" onClick={props.onExportPng} disabled={!props.canExport || props.exportBusy} data-testid="export-png">
            <IconDownload size={16} /> 탐지 결과 PNG 저장
          </button>
          <div className="export-row">
            <button type="button" className="btn" onClick={props.onCopyJson} disabled={!props.canExport} data-testid="export-copy">
              <IconCopy size={15} /> JSON 복사
            </button>
            <button type="button" className="btn" onClick={props.onDownloadJson} disabled={!props.canExport} data-testid="export-json">
              <IconDownload size={15} /> JSON 저장
            </button>
          </div>
        </div>
      </section>

      <section className="panel-block engine-block">
        <div className="block-head">
          <h2>추론 엔진</h2>
          <span className="block-value">{props.info.phase === 'ready' ? '준비됨' : props.info.phase === 'error' ? '오류' : '준비 중'}</span>
        </div>
        <dl className="engine-facts">
          <div>
            <dt>실행 백엔드</dt>
            <dd data-testid="engine-backend">{props.info.backend ? BACKEND_LABEL[props.info.backend] : '—'}</dd>
          </div>
          <div>
            <dt>모델</dt>
            <dd>yolo11n.onnx · {(props.info.modelBytes / 1024 / 1024).toFixed(1)} MB</dd>
          </div>
          <div>
            <dt>준비 시간</dt>
            <dd>{props.info.loadMs > 0 ? `${(props.info.loadMs / 1000).toFixed(1)}초` : '—'}</dd>
          </div>
          <div>
            <dt>모델 캐시</dt>
            <dd>{props.info.phase === 'ready' ? (props.info.fromCache ? '캐시에서 불러옴' : '새로 내려받음') : '—'}</dd>
          </div>
        </dl>
        {props.info.attempts.some((attempt) => !attempt.ok) && (
          <p className="engine-note">
            {props.info.attempts
              .filter((attempt) => !attempt.ok)
              .map((attempt) => (
                <span key={attempt.backend} data-testid={`attempt-${attempt.backend}`} title={attempt.error ?? undefined}>
                  {BACKEND_LABEL[attempt.backend]} 미지원
                </span>
              ))
              .reduce<React.ReactNode[]>((all, item, index) => (index === 0 ? [item] : [...all, ' · ', item]), [])}
            {' → 자동으로 다음 백엔드로 넘어갔습니다.'}
          </p>
        )}
      </section>
    </aside>
  );
}
