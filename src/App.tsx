import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Landing, type SampleDefinition } from './components/Landing';
import { StagePanel, type ThumbItem } from './components/StagePanel';
import { ControlPanel } from './components/ControlPanel';
import { EngineBadge } from './components/EngineBadge';
import { ThemeFab } from './components/ThemeFab';
import type { ClassMode } from './components/ClassFilter';
import { IconCamera, IconPhoto, IconVideo } from './components/Icons';
import { useEngine } from './hooks/useEngine';
import { FrameCapture } from './media/capture';
import { paintDetections } from './render/annotate';
import { buildDetectionJson, composeAnnotatedPng, downloadBlob, safeBaseName } from './export/exporters';
import type { Detection } from './engine/geometry';
import type { BackendName, WorkerStage } from './engine/protocol';

const THEME_KEY = 'hd2-theme';

type Mode = 'photo' | 'video' | 'camera';
type View = 'landing' | 'studio';

interface PhotoItem {
  id: string;
  name: string;
  url: string;
  source: CanvasImageSource;
  width: number;
  height: number;
  detections: Detection[];
}

interface VideoInfo {
  name: string;
  width: number;
  height: number;
  duration: number;
}

interface Runtime {
  mode: Mode;
  photo: PhotoItem | null;
  videoEl: HTMLVideoElement | null;
  detections: Detection[];
  hidden: Set<number>;
  blurred: Set<number>;
  showBoxes: boolean;
  showLabels: boolean;
  mosaic: boolean;
  confidence: number;
  iou: number;
  dirty: boolean;
  pending: boolean;
  fpsSamples: number[];
  lastStatePush: number;
}

function drawFrame(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  runtime: Runtime,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round((rect.width || srcWidth) * dpr));
  const height = Math.max(1, Math.round((rect.height || srcHeight) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const scale = Math.min(width / srcWidth, height / srcHeight);
  const drawWidth = srcWidth * scale;
  const drawHeight = srcHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);

  const visible = runtime.detections.filter((detection) => !runtime.hidden.has(detection.classId));
  const blurred = visible.filter((detection) => runtime.blurred.has(detection.classId));
  paintDetections(ctx, {
    detections: visible,
    blurred,
    source,
    srcWidth,
    srcHeight,
    transform: { scale, offsetX, offsetY },
    showBoxes: runtime.showBoxes,
    showLabels: runtime.showLabels,
    mosaic: runtime.mosaic,
  });
}

function readBackendParam(): BackendName | null {
  const raw = new URLSearchParams(window.location.search).get('backend');
  return raw === 'webgpu' || raw === 'webgl' || raw === 'wasm' ? raw : null;
}

export default function App() {
  const forceBackend = useMemo(readBackendParam, []);
  const { info, engineRef, ready } = useEngine(forceBackend);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [view, setView] = useState<View>('landing');
  const [mode, setMode] = useState<Mode>('photo');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const cameraFacingRef = useRef<'user' | 'environment'>('environment');
  const [cameraSize, setCameraSize] = useState<{ width: number; height: number } | null>(null);
  const [cameraCount, setCameraCount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [liveDetections, setLiveDetections] = useState<Detection[]>([]);
  const [confidence, setConfidence] = useState(0.25);
  const [iou, setIou] = useState(0.45);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [mosaic, setMosaic] = useState(false);
  const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(() => new Set());
  const [blurredClasses, setBlurredClasses] = useState<Set<number>>(() => new Set());
  const [classMode, setClassMode] = useState<ClassMode>('show');
  const [fps, setFps] = useState(0);
  const [inferMs, setInferMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const captureRef = useRef<FrameCapture | null>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  const readyRef = useRef(false);
  const videoUrlRef = useRef<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const runtime = useRef<Runtime>({
    mode: 'photo',
    photo: null,
    videoEl: null,
    detections: [],
    hidden: new Set(),
    blurred: new Set(),
    showBoxes: true,
    showLabels: true,
    mosaic: false,
    confidence: 0.25,
    iou: 0.45,
    dirty: true,
    pending: false,
    fpsSamples: [],
    lastStatePush: 0,
  });

  photosRef.current = photos;
  readyRef.current = ready;

  const samples: SampleDefinition[] = useMemo(
    () => [
      {
        id: 'street',
        name: '도심 거리',
        hint: '자동차와 사람이 여러 개 · 탐지 20여 개',
        url: `${import.meta.env.BASE_URL}samples/sample-street.jpg`,
      },
      {
        id: 'dog',
        name: '강아지 초상',
        hint: '단일 객체 · 개 1개',
        url: `${import.meta.env.BASE_URL}samples/sample-dog.jpg`,
      },
    ],
    [],
  );

  const activePhoto = photos[activeIndex] ?? null;
  const activePhotoId = activePhoto?.id ?? null;

  const capture = useCallback(() => {
    if (!captureRef.current) captureRef.current = new FrameCapture();
    return captureRef.current;
  }, []);

  /* ── theme ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode: the theme simply will not persist */
    }
  }, [theme]);

  /* ── runtime mirrors of the UI state, read by the draw loop ────────────── */
  useEffect(() => {
    const rt = runtime.current;
    rt.hidden = hiddenClasses;
    rt.blurred = blurredClasses;
    rt.showBoxes = showBoxes;
    rt.showLabels = showLabels;
    rt.mosaic = mosaic;
    rt.confidence = confidence;
    rt.iou = iou;
    rt.dirty = true;
  }, [hiddenClasses, blurredClasses, showBoxes, showLabels, mosaic, confidence, iou]);

  useEffect(() => {
    const rt = runtime.current;
    rt.mode = mode;
    rt.photo = mode === 'photo' ? activePhoto : null;
    rt.videoEl = mode === 'video' ? videoRef.current : mode === 'camera' ? cameraRef.current : null;
    if (mode === 'photo' && activePhoto) {
      rt.detections = activePhoto.detections;
      setLiveDetections(activePhoto.detections);
    }
    rt.dirty = true;
    // `activePhoto` is intentionally out of the dependency list: a new detection
    // array must not bounce back into the loop. The id is the identity that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activePhotoId]);

  /* ── the one animation loop: draws, and on live sources feeds the worker ─ */
  const inferLive = useCallback(
    async (element: HTMLVideoElement) => {
      const engine = engineRef.current;
      if (!engine) return;
      const rt = runtime.current;
      rt.pending = true;
      const startedAt = performance.now();
      try {
        const frame = capture().capture(element, element.videoWidth, element.videoHeight);
        const result = await engine.infer(
          frame.rgba,
          frame.plan,
          element.videoWidth,
          element.videoHeight,
          rt.confidence,
          rt.iou,
        );
        rt.detections = result.detections;
        rt.fpsSamples.push(startedAt);
        const cutoff = performance.now() - 2500;
        rt.fpsSamples = rt.fpsSamples.filter((stamp) => stamp >= cutoff);

        const now = performance.now();
        if (now - rt.lastStatePush > 240) {
          rt.lastStatePush = now;
          setLiveDetections(result.detections);
          setInferMs(result.inferMs);
          const stamps = rt.fpsSamples;
          setFps(stamps.length > 1 ? ((stamps.length - 1) * 1000) / (stamps[stamps.length - 1] - stamps[0]) : 0);
          if (element === videoRef.current) setCurrentTime(element.currentTime);
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '탐지에 실패했습니다.');
      } finally {
        rt.pending = false;
      }
    },
    [capture, engineRef],
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rt = runtime.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (rt.mode === 'photo') {
        if (!rt.dirty || !rt.photo) return;
        drawFrame(canvas, rt.photo.source, rt.photo.width, rt.photo.height, rt);
        rt.dirty = false;
        return;
      }

      const element = rt.videoEl;
      if (!element || element.readyState < 2 || !element.videoWidth) return;
      drawFrame(canvas, element, element.videoWidth, element.videoHeight, rt);
      if (!rt.pending && readyRef.current && engineRef.current) void inferLive(element);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineRef, inferLive]);

  /* ── still photos: one inference per photo (and per slider change) ─────── */
  useEffect(() => {
    if (mode !== 'photo' || !ready || !activePhotoId) return;
    let cancelled = false;
    const run = async () => {
      const engine = engineRef.current;
      const photo = photosRef.current[activeIndex];
      if (!engine || !photo) return;
      setBusy(true);
      try {
        const frame = capture().capture(photo.source, photo.width, photo.height);
        const result = await engine.infer(frame.rgba, frame.plan, photo.width, photo.height, confidence, iou);
        if (cancelled) return;
        setPhotos((prev) =>
          prev.map((item) => (item.id === photo.id ? { ...item, detections: result.detections } : item)),
        );
        runtime.current.detections = result.detections;
        runtime.current.dirty = true;
        setLiveDetections(result.detections);
        setInferMs(result.inferMs);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : '탐지에 실패했습니다.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, ready, activePhotoId, activeIndex, confidence, iou, capture, engineRef]);

  /* ── sources ───────────────────────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      cameraStreamRef.current = null;
    }
    if (cameraRef.current) cameraRef.current.srcObject = null;
    setCameraActive(false);
    setCameraSize(null);
  }, []);

  const stopVideo = useCallback(() => {
    const element = videoRef.current;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setPlaying(false);
    setCurrentTime(0);
    setVideo(null);
  }, []);

  const openPhotoFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (list.length === 0) {
        setNotice('사진 파일을 골라 주세요. (JPG · PNG · WebP)');
        return;
      }
      stopVideo();
      stopCamera();
      const created: PhotoItem[] = [];
      for (const file of list) {
        try {
          const source = await createImageBitmap(file);
          const url = URL.createObjectURL(file);
          objectUrlsRef.current.push(url);
          created.push({
            id: `${file.name}-${Date.now()}-${created.length}`,
            name: file.name,
            url,
            source,
            width: source.width,
            height: source.height,
            detections: [],
          });
        } catch {
          setNotice(`${file.name} 파일을 열지 못했습니다.`);
        }
      }
      if (created.length === 0) return;
      const startIndex = photosRef.current.length;
      setPhotos((prev) => [...prev, ...created]);
      setActiveIndex(startIndex);
      setMode('photo');
      setView('studio');
      setLiveDetections([]);
      setInferMs(null);
      setFps(0);
      runtime.current.detections = [];
      runtime.current.dirty = true;
      setNotice(null);
    },
    [stopCamera, stopVideo],
  );

  const openSample = useCallback(
    async (sample: SampleDefinition) => {
      stopVideo();
      stopCamera();
      const image = new Image();
      image.src = sample.url;
      try {
        await image.decode();
      } catch {
        setNotice('샘플 이미지를 불러오지 못했습니다.');
        return;
      }
      const item: PhotoItem = {
        id: `sample-${sample.id}`,
        name: sample.name,
        url: sample.url,
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        detections: [],
      };
      setPhotos([item]);
      setActiveIndex(0);
      setMode('photo');
      setView('studio');
      setLiveDetections([]);
      setInferMs(null);
      setFps(0);
      runtime.current.detections = [];
      runtime.current.dirty = true;
      setNotice(null);
    },
    [stopCamera, stopVideo],
  );

  const openVideoFile = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files).find(
        (candidate) => candidate.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(candidate.name),
      );
      if (!file) {
        setNotice('동영상 파일을 골라 주세요. (MP4 · WebM · MOV)');
        return;
      }
      const element = videoRef.current;
      if (!element) return;
      stopCamera();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      const url = URL.createObjectURL(file);
      videoUrlRef.current = url;
      element.src = url;
      element.loop = true;
      element.muted = true;

      try {
        await new Promise<void>((resolve, reject) => {
          const onMeta = () => {
            element.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          const onError = () => {
            element.removeEventListener('error', onError);
            reject(new Error('동영상을 열지 못했습니다.'));
          };
          element.addEventListener('loadedmetadata', onMeta);
          element.addEventListener('error', onError);
          element.load();
        });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '동영상을 열지 못했습니다.');
        return;
      }

      setVideo({
        name: file.name,
        width: element.videoWidth,
        height: element.videoHeight,
        duration: element.duration,
      });
      setMode('video');
      setView('studio');
      setLiveDetections([]);
      setInferMs(null);
      setFps(0);
      runtime.current.detections = [];
      runtime.current.videoEl = element;
      runtime.current.mode = 'video';
      runtime.current.dirty = true;
      setNotice(null);
      try {
        await element.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(
    async (facing: 'user' | 'environment' = 'environment') => {
      stopVideo();
      stopCamera();
      const element = cameraRef.current;
      if (!element) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        cameraStreamRef.current = stream;
        element.srcObject = stream;
        await element.play();
        cameraFacingRef.current = facing;
        setCameraActive(true);
        setCameraSize({ width: element.videoWidth || 1280, height: element.videoHeight || 720 });
        setMode('camera');
        setView('studio');
        setLiveDetections([]);
        setInferMs(null);
        setFps(0);
        runtime.current.detections = [];
        runtime.current.videoEl = element;
        runtime.current.mode = 'camera';
        runtime.current.dirty = true;
        setNotice(null);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraCount(Math.max(1, devices.filter((device) => device.kind === 'videoinput').length));
      } catch {
        setNotice('카메라를 열지 못했습니다. 브라우저 주소창의 카메라 권한을 허용해 주세요.');
      }
    },
    [stopCamera, stopVideo],
  );

  const togglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      void element
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      element.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = time;
    setCurrentTime(time);
  }, []);

  const goHome = useCallback(() => {
    stopVideo();
    stopCamera();
    setView('landing');
    setNotice(null);
  }, [stopCamera, stopVideo]);

  useEffect(
    () => () => {
      if (cameraStreamRef.current) {
        for (const track of cameraStreamRef.current.getTracks()) track.stop();
      }
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  /* ── class filters ─────────────────────────────────────────────────────── */
  const toggleFrom = useCallback((setter: React.Dispatch<React.SetStateAction<Set<number>>>, classId: number) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }, []);

  const toggleHidden = useCallback((classId: number) => toggleFrom(setHiddenClasses, classId), [toggleFrom]);
  const toggleBlur = useCallback((classId: number) => toggleFrom(setBlurredClasses, classId), [toggleFrom]);

  /* ── export ────────────────────────────────────────────────────────────── */
  const visibleDetections = useMemo(
    () => liveDetections.filter((detection) => !hiddenClasses.has(detection.classId)),
    [liveDetections, hiddenClasses],
  );
  const blurredDetections = useMemo(
    () => visibleDetections.filter((detection) => blurredClasses.has(detection.classId)),
    [visibleDetections, blurredClasses],
  );

  const currentTarget = useCallback((): { source: CanvasImageSource; width: number; height: number; name: string } | null => {
    if (mode === 'photo' && activePhoto) {
      return { source: activePhoto.source, width: activePhoto.width, height: activePhoto.height, name: activePhoto.name };
    }
    const element = mode === 'camera' ? cameraRef.current : videoRef.current;
    if (element && element.videoWidth > 0) {
      return {
        source: element,
        width: element.videoWidth,
        height: element.videoHeight,
        name: mode === 'camera' ? 'webcam' : (video?.name ?? 'video'),
      };
    }
    return null;
  }, [mode, activePhoto, video]);

  const exportPng = useCallback(async () => {
    const target = currentTarget();
    if (!target) return;
    setExportBusy(true);
    try {
      const blob = await composeAnnotatedPng({
        source: target.source,
        width: target.width,
        height: target.height,
        detections: visibleDetections,
        blurred: blurredDetections,
        showBoxes,
        showLabels,
        mosaic,
      });
      downloadBlob(blob, `vektra-var-${safeBaseName(target.name)}.png`);
      setNotice('탐지 결과를 PNG로 저장했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'PNG를 저장하지 못했습니다.');
    } finally {
      setExportBusy(false);
    }
  }, [currentTarget, visibleDetections, blurredDetections, showBoxes, showLabels, mosaic]);

  const jsonText = useCallback((): string | null => {
    const target = currentTarget();
    if (!target) return null;
    return buildDetectionJson(
      { name: target.name, width: target.width, height: target.height, confidence, iou },
      visibleDetections,
    );
  }, [currentTarget, confidence, iou, visibleDetections]);

  const copyJson = useCallback(async () => {
    const text = jsonText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice('탐지 좌표 JSON을 복사했습니다.');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        setNotice('탐지 좌표 JSON을 복사했습니다.');
      } catch {
        setNotice('복사하지 못했습니다. JSON 저장을 이용해 주세요.');
      }
      area.remove();
    }
  }, [jsonText]);

  const downloadJson = useCallback(() => {
    const text = jsonText();
    if (!text) return;
    const name = mode === 'photo' ? activePhoto?.name : video?.name;
    downloadBlob(new Blob([text], { type: 'application/json' }), `vektra-var-${safeBaseName(name ?? 'detections')}.json`);
    setNotice('탐지 좌표 JSON을 저장했습니다.');
  }, [jsonText, mode, activePhoto, video]);

  /* ── derived view data ─────────────────────────────────────────────────── */
  const thumbs: ThumbItem[] = useMemo(
    () => photos.map((photo) => ({ id: photo.id, name: photo.name, url: photo.url })),
    [photos],
  );

  const stageTitle =
    mode === 'photo' ? (activePhoto?.name ?? '사진 없음') : mode === 'video' ? (video?.name ?? '동영상') : '웹캠';
  const stageSize =
    mode === 'photo' && activePhoto
      ? `${activePhoto.width} × ${activePhoto.height}`
      : mode === 'video' && video
        ? `${video.width} × ${video.height}`
        : mode === 'camera' && cameraSize
          ? `${cameraSize.width} × ${cameraSize.height}`
          : '—';

  const hasSource =
    (mode === 'photo' && Boolean(activePhoto)) || (mode === 'video' && Boolean(video)) || (mode === 'camera' && cameraActive);

  const handleDrop = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.some((file) => file.type.startsWith('video/'))) void openVideoFile(list);
      else void openPhotoFiles(list);
    },
    [openPhotoFiles, openVideoFile],
  );

  return (
    <div className="app" data-view={view}>
      <header className="topbar">
        <button type="button" className="brand" onClick={goHome} aria-label="Vektra Vár 홈으로 이동">
          <span className="mark" aria-hidden />
          <span className="brand-name">HD2Lab</span>
          <em>Vektra Vár</em>
        </button>

        <div className="topbar-actions">
          <EngineBadge info={info} fps={mode === 'photo' ? 0 : fps} inferMs={inferMs} />
          {view === 'studio' && (
            <>
              <button type="button" className="chip desktop-only" onClick={() => photoInputRef.current?.click()}>
                <IconPhoto size={14} /> 사진
              </button>
              <button type="button" className="chip desktop-only" onClick={() => videoInputRef.current?.click()}>
                <IconVideo size={14} /> 동영상
              </button>
              <button type="button" className="chip desktop-only" onClick={() => void startCamera()}>
                <IconCamera size={14} /> 웹캠
              </button>
              <button type="button" className="chip mobile-only" onClick={goHome}>
                입력
              </button>
            </>
          )}
        </div>
      </header>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="photo-input"
        onChange={(event) => {
          if (event.target.files?.length) void openPhotoFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        data-testid="video-input"
        onChange={(event) => {
          if (event.target.files?.length) void openVideoFile(event.target.files);
          event.target.value = '';
        }}
      />

      {/* The sources themselves are never shown: the stage canvas paints them. */}
      <video ref={videoRef} className="hidden-video" muted playsInline loop preload="auto" data-testid="video-source" />
      <video ref={cameraRef} className="hidden-video" muted playsInline data-testid="camera-source" />

      {info.phase === 'error' && (
        <div className="error-banner" role="alert" data-testid="engine-error">
          <span>{info.error ?? '추론 엔진을 시작하지 못했습니다.'}</span>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      )}

      {view === 'landing' ? (
        <Landing
          info={info}
          samples={samples}
          session={activePhoto ? { name: activePhoto.name, count: photos.length } : null}
          onResume={() => setView('studio')}
          onChoosePhoto={() => photoInputRef.current?.click()}
          onChooseVideo={() => videoInputRef.current?.click()}
          onStartCamera={() => void startCamera()}
          onOpenSample={(sample) => void openSample(sample)}
          onDropFiles={handleDrop}
          dragging={dragging}
          onDragging={setDragging}
          error={info.error}
        />
      ) : (
        <main className="workbench">
          <StagePanel
            canvasRef={canvasRef}
            mode={mode}
            hasSource={hasSource}
            title={stageTitle}
            sizeLabel={stageSize}
            playing={playing}
            currentTime={currentTime}
            duration={video?.duration ?? 0}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onFlipCamera={() => void startCamera(cameraActive ? (cameraFacingRef.current === 'user' ? 'environment' : 'user') : 'environment')}
            onChoosePhoto={() => photoInputRef.current?.click()}
            onDropFiles={handleDrop}
            dragging={dragging}
            onDragging={setDragging}
            thumbs={thumbs}
            activeIndex={activeIndex}
            onSelectPhoto={(index) => {
              setActiveIndex(index);
              setMode('photo');
            }}
            notice={notice}
          />
          <ControlPanel
            confidence={confidence}
            iou={iou}
            onConfidence={setConfidence}
            onIou={setIou}
            showBoxes={showBoxes}
            showLabels={showLabels}
            mosaic={mosaic}
            onToggleBoxes={() => setShowBoxes((value) => !value)}
            onToggleLabels={() => setShowLabels((value) => !value)}
            onToggleMosaic={() => setMosaic((value) => !value)}
            detections={liveDetections}
            hidden={hiddenClasses}
            blurred={blurredClasses}
            classMode={classMode}
            onClassMode={setClassMode}
            onToggleHidden={toggleHidden}
            onToggleBlur={toggleBlur}
            onShowAll={() => setHiddenClasses(new Set())}
            onExportPng={() => void exportPng()}
            onCopyJson={() => void copyJson()}
            onDownloadJson={downloadJson}
            exportBusy={exportBusy}
            canExport={hasSource && !busy}
            info={info}
          />
        </main>
      )}

      <ThemeFab theme={theme} onToggle={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))} />
      <span className="sr-only" aria-live="polite" data-testid="live-notice">
        {notice ?? ''}
      </span>
      <span className="sr-only" data-testid="busy-flag">
        {busy ? 'busy' : 'idle'}
      </span>
      <span className="sr-only" data-testid="mode-flag">
        {mode}
      </span>
      <span className="sr-only" data-testid="camera-count">
        {cameraCount}
      </span>
      <span className="sr-only" data-testid="engine-stage">
        {(info.stage ?? 'idle') as WorkerStage}
      </span>
    </div>
  );
}
