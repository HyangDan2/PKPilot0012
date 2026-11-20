# Third-Party Notices — PKPilot 0012 (Vektra Vár)

이 앱은 아래 소프트웨어와 외부 자산을 사용합니다.

## 모델

| 자산 | 출처 | 라이선스 |
| --- | --- | --- |
| `public/models/yolo11n.onnx` (10.9 MB) | [Ultralytics YOLO11](https://github.com/ultralytics/assets/releases/tag/v8.3.0) `yolo11n.onnx` — COCO 80 클래스, 640×640 입력 | **AGPL-3.0** |

모델 가중치는 Ultralytics가 공개한 ONNX 익스포트를 그대로 내려받아 저장소에 함께 둔 것입니다.
추론 코드(전처리·NMS·좌표 역변환)는 이 저장소에서 직접 작성했고, 모델 파일에는 손대지 않았습니다.
AGPL-3.0 조건은 모델 파일에 그대로 적용되며, 상업적 이용이나 재배포 시에는 Ultralytics의 라이선스를
직접 확인해 주세요. 모델을 다른 것으로 바꾸려면 `public/models/`에 같은 이름으로 넣으면 됩니다
(출력 형태 `[1, 84, 8400]` 또는 `[1, 8400, 84]`).

## 런타임 라이브러리

| 패키지 | 라이선스 | 용도 |
| --- | --- | --- |
| [onnxruntime-web](https://github.com/microsoft/onnxruntime) | MIT | WebGPU · WebGL · WASM 실행 백엔드 (`.wasm`은 `public/ort/`에 자체 서빙) |
| [React](https://react.dev) / React DOM | MIT | UI |
| [Vite](https://vitejs.dev) | MIT | 빌드 (개발 의존성) |
| [Vitest](https://vitest.dev) / [Playwright](https://playwright.dev) | MIT / Apache-2.0 | 단위·E2E 검증 (개발 의존성) |

## 샘플 이미지

| 자산 | 출처 | 라이선스 |
| --- | --- | --- |
| `public/samples/sample-street.jpg` | Unsplash — 도심 도로(택시·보행자) | [Unsplash License](https://unsplash.com/license) (출처 표기 불필요) |
| `public/samples/sample-dog.jpg` | Unsplash — 강아지 초상 | [Unsplash License](https://unsplash.com/license) |

두 장 모두 실제 객체가 담겨 있어, 첫 실행에서 탐지가 진짜로 동작하는지 바로 확인할 수 있습니다.
`tools/check_samples.py`가 같은 전처리·NMS 수식으로 두 장을 다시 돌려 탐지 개수를 출력합니다.

## HD2Lab 자체 자산

| 자산 | 출처 | 라이선스 |
| --- | --- | --- |
| 듀얼 스큐 마크 · 파비콘 세트 · `og-image.png` | HD2Lab (`tools/generate_brand_assets.py`로 생성) | MIT |
| Soft Iris / Navy & Lavender 테마 토큰 | HD2Lab Web-HQ · Server-HQ | MIT |

COCO 클래스 이름은 [COCO 데이터셋](https://cocodataset.org/)의 80종 목록을 따르며, 한국어 표기는
HD2Lab이 붙인 것입니다. "Vektra Vár"는 HD2Lab의 앱 이름입니다.
