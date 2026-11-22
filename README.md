# ObjectLens — HD2Lab 객체 탐지 스튜디오

**브라우저가 스스로 객체를 봅니다.**

`ObjectLens`는 사진·동영상·웹캠에서 COCO 80종 객체를 찾아내는 HD2Lab의 클라이언트 사이드
YOLO 스튜디오입니다. 모델(YOLO11n, 10.9 MB)은 처음 한 번만 내려받고, 그 뒤의 모든 추론은
**이 기기 안에서** 끝납니다. 업로드 0 B, 외부 CDN 없음, 서버 추론 없음.

- Live: <https://hyangdan2.github.io/PKPilot0012/>
- 스택: React 19 · TypeScript · Vite 6 · onnxruntime-web 1.31 · Vitest 3 · Playwright

---

## 무엇이 들어 있나

### 추론 파이프라인

| 단계 | 위치 | 하는 일 |
| --- | --- | --- |
| 입력 | UI 스레드 | 프레임을 640×640 **레터박스**(비율 유지, 회색 여백)로 캔버스에 그린 뒤 RGBA만 워커로 전송 |
| 전처리 | Web Worker | RGBA → Float32 **NCHW**, 0~1 정규화 |
| 추론 | Web Worker | onnxruntime-web 세션 (`yolo11n.onnx`, 입력 `images` `[1,3,640,640]`) |
| 후처리 | Web Worker | 84×8400 헤드 해석 → 클래스별 **NMS(IoU)** → 원본 픽셀 좌표 **역변환**·클램프 |

- **UI 스레드는 절대 막히지 않습니다.** 모델 다운로드·세션 생성·추론·NMS가 모두 전용
  Web Worker(`src/engine/worker.ts`)에서 일어나고, 메인 스레드는 픽셀을 보내고 박스를 받습니다.
- **실행 백엔드 자동 선택** — `WebGPU → WebGL → WASM` 순서로 세션을 만들어 보고, 실제로
  만들어진 백엔드를 배지와 패널에 그대로 보고합니다(추측하지 않습니다). 이 모델의 `Split`
  연산을 WebGL 실행기가 풀지 못하는 브라우저에서는 자동으로 WASM으로 내려갑니다.
- **모델 캐시** — Cache API(`vektra-var-model-v1`)에 저장해 두 번째 방문은 디스크에서 바로
  읽고, 첫 다운로드는 진행률을 %로 보여 줍니다.
- **정적 서빙** — `onnxruntime-web/all`이 쓰는 `ort-wasm-simd-threaded.jsep.wasm`과 로더를
  `public/ort/`에 두고 `ort.env.wasm.wasmPaths`로 지정합니다. CDN·CORS 문제가 없습니다.

### 입력 세 가지

1. **사진** — 다중 파일 열기, 드래그 앤 드롭, 썸네일 스트립으로 전환. 첫 화면에 실제 객체가 담긴
   샘플 2장(도심 거리 · 강아지)이 있어 바로 탐지를 확인할 수 있습니다.
2. **동영상 파일** — 재생·일시정지·타임라인 스크럽. 재생 중인 프레임을 실시간으로 탐지합니다.
3. **웹캠** — `getUserMedia`, 전면/후면 카메라 전환, 권한 거부 시 안내 문구.

### 제어와 내보내기

- 신뢰도(Confidence) 0.05~0.95 · IoU 0.10~0.90 슬라이더
- COCO 80종 클래스 칩 — 탐지된 클래스가 앞에 오고, 실시간 개수 배지가 붙습니다.
  `표시` 모드에서 눌러 숨기고, `모자이크` 모드에서 눌러 가릴 클래스를 고릅니다.
- 바운딩 박스 · 클래스 라벨 · **선택 클래스 모자이크** 토글(모자이크는 원본 픽셀을 블록 단위로
  다시 그려 화면과 PNG 모두에서 가립니다).
- 탐지 결과 **PNG 저장**(원본 해상도, 박스·라벨·모자이크 포함)과 **JSON 복사/저장**
  (좌표는 원본 픽셀, 클래스 id·영문/한글 이름·신뢰도).

---

## 검증

```bash
npm ci
npm test            # 단위 테스트 30개: 레터박스 · NMS · 디코드 · 좌표 역변환 · JSON
npm run build       # tsc --noEmit + vite build (public/ort 준비 포함)
npm run test:e2e    # Playwright: 샘플 실탐지 · 필터 · 내보내기 · 테마 · 가로 넘침 · 모자이크
npm run check:samples   # 파이썬 onnxruntime으로 두 샘플을 같은 수식으로 다시 돌려 보기
```

E2E는 기본적으로 `npm run build && npm run preview`로 로컬 서버를 띄웁니다.
이미 배포된 사이트를 검사하려면 `PK12_BASE=https://hyangdan2.github.io/PKPilot0012/ npm run test:e2e`.
`?backend=wasm|webgl|webgpu` 쿼리로 특정 백엔드만 강제해 확인할 수 있습니다.

## 구조

```
src/
  engine/    geometry.ts (레터박스·NMS·디코드, 순수 함수) · worker.ts · client.ts · labels.ts
  media/     capture.ts (640×640 레터박스 캔버스)
  render/    annotate.ts (박스·라벨·모자이크를 캔버스에 그리는 한 곳)
  export/    exporters.ts (PNG 합성, JSON)
  components/ Landing · StagePanel · ControlPanel · ClassFilter · EngineBadge · ThemeFab · Icons
  hooks/     useEngine.ts
tests/       geometry · labels · exporters + e2e/studio.spec.ts
tools/       generate_brand_assets.py (파비콘·OG) · check_samples.py
scripts/     sync-ort.mjs (onnxruntime wasm을 public/ort로 복사)
```

## 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 `tsc --noEmit` → `npm test` →
`npm run build` → Playwright E2E를 통과한 뒤 GitHub Pages로 올립니다.
`base`는 `/PKPilot0012/`이므로 프로젝트 하위 경로에서 그대로 동작합니다.
