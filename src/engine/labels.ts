/**
 * COCO 80 — the class list yolo11n.onnx was trained on. Order matters: index 0
 * is `person` and the model's 80 score channels follow this exact sequence.
 */
export interface CocoClass {
  id: number;
  en: string;
  ko: string;
}

export const COCO_CLASSES: readonly CocoClass[] = [
  { id: 0, en: 'person', ko: '사람' },
  { id: 1, en: 'bicycle', ko: '자전거' },
  { id: 2, en: 'car', ko: '자동차' },
  { id: 3, en: 'motorcycle', ko: '오토바이' },
  { id: 4, en: 'airplane', ko: '비행기' },
  { id: 5, en: 'bus', ko: '버스' },
  { id: 6, en: 'train', ko: '기차' },
  { id: 7, en: 'truck', ko: '트럭' },
  { id: 8, en: 'boat', ko: '보트' },
  { id: 9, en: 'traffic light', ko: '신호등' },
  { id: 10, en: 'fire hydrant', ko: '소화전' },
  { id: 11, en: 'stop sign', ko: '정지 표지판' },
  { id: 12, en: 'parking meter', ko: '주차 정산 기기' },
  { id: 13, en: 'bench', ko: '벤치' },
  { id: 14, en: 'bird', ko: '새' },
  { id: 15, en: 'cat', ko: '고양이' },
  { id: 16, en: 'dog', ko: '개' },
  { id: 17, en: 'horse', ko: '말' },
  { id: 18, en: 'sheep', ko: '양' },
  { id: 19, en: 'cow', ko: '소' },
  { id: 20, en: 'elephant', ko: '코끼리' },
  { id: 21, en: 'bear', ko: '곰' },
  { id: 22, en: 'zebra', ko: '얼룩말' },
  { id: 23, en: 'giraffe', ko: '기린' },
  { id: 24, en: 'backpack', ko: '배낭' },
  { id: 25, en: 'umbrella', ko: '우산' },
  { id: 26, en: 'handbag', ko: '핸드백' },
  { id: 27, en: 'tie', ko: '넥타이' },
  { id: 28, en: 'suitcase', ko: '여행 가방' },
  { id: 29, en: 'frisbee', ko: '프리스비' },
  { id: 30, en: 'skis', ko: '스키' },
  { id: 31, en: 'snowboard', ko: '스노보드' },
  { id: 32, en: 'sports ball', ko: '공' },
  { id: 33, en: 'kite', ko: '연' },
  { id: 34, en: 'baseball bat', ko: '야구 방망이' },
  { id: 35, en: 'baseball glove', ko: '야구 글러브' },
  { id: 36, en: 'skateboard', ko: '스케이트보드' },
  { id: 37, en: 'surfboard', ko: '서핑보드' },
  { id: 38, en: 'tennis racket', ko: '테니스 라켓' },
  { id: 39, en: 'bottle', ko: '병' },
  { id: 40, en: 'wine glass', ko: '와인 잔' },
  { id: 41, en: 'cup', ko: '컵' },
  { id: 42, en: 'fork', ko: '포크' },
  { id: 43, en: 'knife', ko: '칼' },
  { id: 44, en: 'spoon', ko: '숟가락' },
  { id: 45, en: 'bowl', ko: '그릇' },
  { id: 46, en: 'banana', ko: '바나나' },
  { id: 47, en: 'apple', ko: '사과' },
  { id: 48, en: 'sandwich', ko: '샌드위치' },
  { id: 49, en: 'orange', ko: '오렌지' },
  { id: 50, en: 'broccoli', ko: '브로콜리' },
  { id: 51, en: 'carrot', ko: '당근' },
  { id: 52, en: 'hot dog', ko: '핫도그' },
  { id: 53, en: 'pizza', ko: '피자' },
  { id: 54, en: 'donut', ko: '도넛' },
  { id: 55, en: 'cake', ko: '케이크' },
  { id: 56, en: 'chair', ko: '의자' },
  { id: 57, en: 'couch', ko: '소파' },
  { id: 58, en: 'potted plant', ko: '화분' },
  { id: 59, en: 'bed', ko: '침대' },
  { id: 60, en: 'dining table', ko: '식탁' },
  { id: 61, en: 'toilet', ko: '변기' },
  { id: 62, en: 'tv', ko: 'TV' },
  { id: 63, en: 'laptop', ko: '노트북' },
  { id: 64, en: 'mouse', ko: '마우스' },
  { id: 65, en: 'remote', ko: '리모컨' },
  { id: 66, en: 'keyboard', ko: '키보드' },
  { id: 67, en: 'cell phone', ko: '휴대전화' },
  { id: 68, en: 'microwave', ko: '전자레인지' },
  { id: 69, en: 'oven', ko: '오븐' },
  { id: 70, en: 'toaster', ko: '토스터' },
  { id: 71, en: 'sink', ko: '싱크대' },
  { id: 72, en: 'refrigerator', ko: '냉장고' },
  { id: 73, en: 'book', ko: '책' },
  { id: 74, en: 'clock', ko: '시계' },
  { id: 75, en: 'vase', ko: '꽃병' },
  { id: 76, en: 'scissors', ko: '가위' },
  { id: 77, en: 'teddy bear', ko: '곰인형' },
  { id: 78, en: 'hair drier', ko: '헤어드라이어' },
  { id: 79, en: 'toothbrush', ko: '칫솔' },
];

export const COCO_COUNT = COCO_CLASSES.length;

const BY_ID = new Map<number, CocoClass>(COCO_CLASSES.map((entry) => [entry.id, entry]));

export function cocoClass(id: number): CocoClass {
  return BY_ID.get(id) ?? { id, en: `class ${id}`, ko: `클래스 ${id}` };
}

export function classNameKo(id: number): string {
  return cocoClass(id).ko;
}

/** A stable HUE per class, so a car is always the same orange from frame to frame. */
export function classHue(id: number): number {
  return Math.round((id * 137.508) % 360);
}

export function classColor(id: number, alpha = 1): string {
  return `hsla(${classHue(id)}, 82%, 62%, ${alpha})`;
}
