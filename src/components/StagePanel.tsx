import { IconFlip, IconPause, IconPlay, IconPhoto } from './Icons';

export interface ThumbItem {
  id: string;
  name: string;
  url: string;
}

export type StageMode = 'photo' | 'video' | 'camera';

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mode: StageMode;
  hasSource: boolean;
  title: string;
  sizeLabel: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onFlipCamera: () => void;
  onChoosePhoto: () => void;
  onDropFiles: (files: FileList | File[]) => void;
  dragging: boolean;
  onDragging: (dragging: boolean) => void;
  thumbs: ThumbItem[];
  /** CSS aspect-ratio string of the frame currently on the stage ("1280 / 853"). */
  aspect: string;
  activeIndex: number;
  onSelectPhoto: (index: number) => void;
  notice: string | null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

export function StagePanel(props: Props) {
  return (
    <section className="stage-col">
      <div
        className={`stage-frame ${props.dragging ? 'is-dragging' : ''}`}
        data-testid="stage-frame"
        data-mode={props.mode}
        style={{ '--stage-aspect': props.aspect } as React.CSSProperties}
        onDragOver={(event) => {
          event.preventDefault();
          props.onDragging(true);
        }}
        onDragLeave={() => props.onDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          props.onDragging(false);
          if (event.dataTransfer?.files?.length) props.onDropFiles(event.dataTransfer.files);
        }}
      >
        <canvas ref={props.canvasRef} className="stage-canvas" data-testid="stage-canvas" />
        {!props.hasSource && (
          <div className="stage-empty" data-testid="stage-empty">
            <IconPhoto size={26} />
            <p>사진을 끌어다 놓으면 바로 탐지합니다.</p>
          </div>
        )}
        {props.dragging && <div className="stage-drop">놓아서 열기</div>}
        {props.notice && (
          <div className="stage-notice" data-testid="stage-notice">
            {props.notice}
          </div>
        )}
      </div>

      <div className="stage-bar">
        <div className="stage-meta">
          <span className="stage-name" data-testid="stage-name" title={props.title}>
            {props.title}
          </span>
          <span className="stage-size" data-testid="stage-size">
            {props.sizeLabel}
          </span>
        </div>

        {props.mode === 'video' && (
          <div className="stage-controls">
            <button
              type="button"
              className="icon-btn"
              onClick={props.onTogglePlay}
              aria-label={props.playing ? '일시정지' : '재생'}
              data-testid="play-toggle"
            >
              {props.playing ? <IconPause size={15} /> : <IconPlay size={15} />}
            </button>
            <input
              type="range"
              className="timeline"
              min={0}
              max={Math.max(0.1, props.duration)}
              step={0.01}
              value={Math.min(props.currentTime, props.duration || 0)}
              onChange={(event) => props.onSeek(Number(event.target.value))}
              aria-label="재생 위치"
              data-testid="timeline"
            />
            <span className="stage-time" data-testid="stage-time">
              {formatTime(props.currentTime)} / {formatTime(props.duration)}
            </span>
          </div>
        )}

        {props.mode === 'camera' && (
          <div className="stage-controls">
            <button type="button" className="chip" onClick={props.onFlipCamera} data-testid="camera-flip">
              <IconFlip size={15} /> 카메라 전환
            </button>
          </div>
        )}
      </div>

      {props.thumbs.length > 1 && (
        <div className="photo-strip" data-testid="photo-strip">
          {props.thumbs.map((thumb, index) => (
            <button
              key={thumb.id}
              type="button"
              className={`thumb ${index === props.activeIndex ? 'is-active' : ''}`}
              onClick={() => props.onSelectPhoto(index)}
              title={thumb.name}
              aria-label={`${thumb.name} 열기`}
              data-testid={`thumb-${index}`}
            >
              <img src={thumb.url} alt="" loading="lazy" />
            </button>
          ))}
          <button
            type="button"
            className="thumb thumb-add"
            onClick={props.onChoosePhoto}
            aria-label="사진 더 열기"
            data-testid="thumb-add"
          >
            +
          </button>
        </div>
      )}
    </section>
  );
}
