import type { EngineInfo } from '../hooks/useEngine';
import { IconCamera, IconPhoto, IconTarget, IconVideo } from './Icons';

export interface SampleDefinition {
  id: string;
  name: string;
  hint: string;
  url: string;
}

interface Props {
  info: EngineInfo;
  samples: readonly SampleDefinition[];
  session: { name: string; count: number } | null;
  onResume: () => void;
  onChoosePhoto: () => void;
  onChooseVideo: () => void;
  onStartCamera: () => void;
  onOpenSample: (sample: SampleDefinition) => void;
  onDropFiles: (files: FileList | File[]) => void;
  dragging: boolean;
  onDragging: (dragging: boolean) => void;
  error: string | null;
}

/**
 * The first screen: what the studio is, the three ways in, and two photographs
 * that already contain real objects so the first tap proves the detector.
 */
export function Landing({ info, samples, session, onResume, onChoosePhoto, onChooseVideo, onStartCamera, onOpenSample, onDropFiles, dragging, onDragging, error }: Props) {
  return (
    <div
      className={`landing ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragging(true);
      }}
      onDragLeave={() => onDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDragging(false);
        if (event.dataTransfer?.files?.length) onDropFiles(event.dataTransfer.files);
      }}
    >
      <div className="landing-scroll">
        <section className="hero">
          <div className="hero-mark" aria-hidden>
            <IconTarget size={30} />
          </div>
          <p className="hero-kicker">HD2LAB · VEKTRA VÁR</p>
          <h1>
            기기 안에서, <em>객체</em>를 봅니다.
          </h1>
          <p className="hero-copy">
            사진과 동영상, 카메라 화면에서 COCO 80종 객체를 찾아냅니다. 모델 11 MB를 한 번 내려받으면,
            그 뒤의 모든 추론은 이 브라우저 안에서 끝납니다.
          </p>
          <div className="hero-stats">
            <span>
              <b>80</b> COCO 클래스
            </span>
            <span>
              <b>640²</b> 입력 해상도
            </span>
            <span>
              <b>0 B</b> 서버 업로드
            </span>
          </div>
        </section>

        {error && (
          <p className="landing-error" role="alert" data-testid="landing-error">
            {error}
          </p>
        )}

        <section className="open-grid" aria-label="입력 방법">
          {session && (
            <button type="button" className="session-card" onClick={onResume} data-testid="resume-session">
              <span className="session-thumb">
                <IconPhoto size={18} />
              </span>
              <span className="session-body">
                <small>작업 중인 사진</small>
                <strong>{session.name}</strong>
              </span>
              <span className="session-go">이어서 보기 →</span>
            </button>
          )}
          <button type="button" className="open-card" onClick={onChoosePhoto} data-testid="open-photo">
            <span className="open-icon">
              <IconPhoto size={22} />
            </span>
            <strong>사진 열기</strong>
            <span className="open-copy">여러 장을 한 번에 열고, 장마다 결과를 남깁니다.</span>
            <span className="open-hint">JPG · PNG · WebP · 끌어다 놓기</span>
          </button>
          <button type="button" className="open-card" onClick={onChooseVideo} data-testid="open-video">
            <span className="open-icon">
              <IconVideo size={22} />
            </span>
            <strong>동영상 열기</strong>
            <span className="open-copy">재생되는 프레임을 실시간으로 탐지합니다.</span>
            <span className="open-hint">MP4 · WebM · MOV</span>
          </button>
          <button type="button" className="open-card" onClick={onStartCamera} data-testid="open-camera">
            <span className="open-icon">
              <IconCamera size={22} />
            </span>
            <strong>웹캠 켜기</strong>
            <span className="open-copy">카메라 화면에서 바로 탐지하고 전·후면을 바꿉니다.</span>
            <span className="open-hint">권한을 허용해 주세요</span>
          </button>
        </section>

        <section className="samples" aria-label="샘플">
          <div className="samples-head">
            <h2>샘플로 먼저 확인해 보세요</h2>
            <p>내려받은 모델이 실제로 상자를 그리는지 바로 볼 수 있습니다.</p>
          </div>
          <div className="sample-grid">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="sample-card"
                onClick={() => onOpenSample(sample)}
                data-testid={`sample-${sample.id}`}
                disabled={info.phase === 'error'}
              >
                <span className="sample-thumb">
                  <img src={sample.url} alt={sample.name} loading="lazy" />
                </span>
                <span className="sample-body">
                  <strong>{sample.name}</strong>
                  <span>{sample.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="landing-status">
          {info.phase === 'loading' && (
            <div className="model-progress" data-testid="model-progress">
              <div className="model-progress-head">
                <span>YOLO11n 모델을 준비하고 있습니다</span>
                <b>{Math.round(info.progress * 100)}%</b>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, info.progress * 100)}%` }} />
              </div>
            </div>
          )}
          {info.phase === 'ready' && (
            <p className="landing-ready" data-testid="landing-ready">
              엔진 준비 완료 · {info.backend === 'webgpu' ? 'WebGPU' : info.backend === 'webgl' ? 'WebGL' : 'WASM'} ·{' '}
              {(info.loadMs / 1000).toFixed(1)}초{info.fromCache ? ' · 캐시 재사용' : ''}
            </p>
          )}
        </section>

        <footer className="landing-foot">
          <p>
            모델은 처음 한 번만 내려받고, 다음 방문에는 브라우저 캐시에서 불러옵니다. 사진과 영상은 어디에도 전송되지
            않습니다.
          </p>
          <p className="landing-license">YOLO11n · Ultralytics AGPL-3.0 · COCO 80 클래스 · ONNX Runtime Web</p>
        </footer>
      </div>
      {dragging && <div className="landing-drop">놓아서 열기</div>}
    </div>
  );
}
