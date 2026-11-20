/**
 * The maths of the detector, kept free of DOM and ORT so every step — the
 * letterbox, the NMS, the way a box travels back to the original pixels — can be
 * unit tested on its own.
 */

export const INPUT_SIZE = 640;
export const PAD_VALUE = 114;
export const COCO_ATTRIBUTES = 84; // 4 box values + 80 class scores

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  classId: number;
  score: number;
  box: Box;
}

export interface LetterboxPlan {
  /** Square side fed to the model. */
  size: number;
  /** Source pixel → model pixel factor. */
  scale: number;
  /** The resized source rectangle inside the square. */
  drawWidth: number;
  drawHeight: number;
  /** Grey margins on each side. */
  padX: number;
  padY: number;
}

/**
 * `min(size/w, size/h)` puts the whole frame inside the square without
 * distorting it; the leftovers become the grey margins.
 */
export function letterboxPlan(srcWidth: number, srcHeight: number, size = INPUT_SIZE): LetterboxPlan {
  if (!(srcWidth > 0) || !(srcHeight > 0) || !Number.isFinite(srcWidth) || !Number.isFinite(srcHeight)) {
    throw new Error('이미지 크기가 올바르지 않습니다.');
  }
  const scale = Math.min(size / srcWidth, size / srcHeight);
  const drawWidth = Math.min(size, Math.max(1, Math.round(srcWidth * scale)));
  const drawHeight = Math.min(size, Math.max(1, Math.round(srcHeight * scale)));
  return {
    size,
    scale,
    drawWidth,
    drawHeight,
    padX: Math.floor((size - drawWidth) / 2),
    padY: Math.floor((size - drawHeight) / 2),
  };
}

/** Model-space point back to a source-space point. */
export function toSourcePoint(x: number, y: number, plan: LetterboxPlan): { x: number; y: number } {
  return {
    x: (x - plan.padX) / plan.scale,
    y: (y - plan.padY) / plan.scale,
  };
}

export interface DecodeOptions {
  /** Score floor a detection must clear. */
  confidence: number;
  /** IoU above which two boxes of the same class are the same object. */
  iou: number;
  plan: LetterboxPlan;
  srcWidth: number;
  srcHeight: number;
  /** 80 for the shipped model; configurable so the decoder stays testable. */
  classCount?: number;
}

/**
 * Greedy, class-aware non-maximum suppression. Returns the indices kept, in
 * descending score order.
 */
export function nmsIndices(boxes: readonly Box[], scores: readonly number[], classIds: readonly number[], iou: number): number[] {
  const order = Array.from(boxes.keys()).sort((a, b) => scores[b] - scores[a]);
  const keep: number[] = [];
  const suppressed = new Uint8Array(boxes.length);

  for (const i of order) {
    if (suppressed[i]) continue;
    keep.push(i);
    const a = boxes[i];
    const areaA = Math.max(0, a.width) * Math.max(0, a.height);
    for (const j of order) {
      if (j === i || suppressed[j] || classIds[j] !== classIds[i]) continue;
      const b = boxes[j];
      const x1 = Math.max(a.x, b.x);
      const y1 = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.width, b.x + b.width);
      const y2 = Math.min(a.y + a.height, b.y + b.height);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      if (inter <= 0) continue;
      const areaB = Math.max(0, b.width) * Math.max(0, b.height);
      const union = areaA + areaB - inter;
      if (union > 0 && inter / union > iou) suppressed[j] = 1;
    }
  }
  return keep;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Turn the raw YOLO head into source-pixel detections.
 *
 * The shipped export is `[1, 84, 8400]` — 8400 anchors, each carrying
 * `cx, cy, w, h` (already in model pixels) followed by 80 sigmoid class scores.
 * A `[1, 8400, 84]` layout is accepted too, so a re-export does not silently
 * break the studio.
 */
export function decodeYolo(
  output: Float32Array,
  dims: readonly number[],
  options: DecodeOptions,
): Detection[] {
  const classCount = options.classCount ?? 80;
  const attributes = 4 + classCount;
  const shape = dims.length === 3 ? [dims[1], dims[2]] : dims.length === 2 ? [dims[0], dims[1]] : [0, 0];
  const [d1, d2] = shape;

  let anchors: number;
  let channelMajor: boolean;
  if (d1 === attributes) {
    anchors = d2;
    channelMajor = true;
  } else if (d2 === attributes) {
    anchors = d1;
    channelMajor = false;
  } else {
    throw new Error(`모델 출력 형태를 해석할 수 없습니다: [${dims.join(', ')}]`);
  }

  const at = (attribute: number, anchor: number) =>
    channelMajor ? output[attribute * anchors + anchor] : output[anchor * attributes + attribute];

  const candidates: Detection[] = [];
  for (let a = 0; a < anchors; a += 1) {
    let bestClass = -1;
    let bestScore = 0;
    for (let c = 0; c < classCount; c += 1) {
      const score = at(4 + c, a);
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestClass < 0 || bestScore < options.confidence) continue;

    const cx = at(0, a);
    const cy = at(1, a);
    const w = at(2, a);
    const h = at(3, a);
    if (!(w > 0) || !(h > 0)) continue;

    candidates.push({
      classId: bestClass,
      score: bestScore,
      box: { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
    });
  }

  const kept = nmsIndices(
    candidates.map((d) => d.box),
    candidates.map((d) => d.score),
    candidates.map((d) => d.classId),
    options.iou,
  );

  const { plan, srcWidth, srcHeight } = options;
  const result: Detection[] = [];
  for (const index of kept) {
    const candidate = candidates[index];
    const x1 = (candidate.box.x - plan.padX) / plan.scale;
    const y1 = (candidate.box.y - plan.padY) / plan.scale;
    const x2 = (candidate.box.x + candidate.box.width - plan.padX) / plan.scale;
    const y2 = (candidate.box.y + candidate.box.height - plan.padY) / plan.scale;

    const left = clamp(x1, 0, srcWidth);
    const top = clamp(y1, 0, srcHeight);
    const right = clamp(x2, 0, srcWidth);
    const bottom = clamp(y2, 0, srcHeight);
    if (right - left < 2 || bottom - top < 2) continue;

    result.push({
      classId: candidate.classId,
      score: candidate.score,
      box: { x: left, y: top, width: right - left, height: bottom - top },
    });
  }
  return result;
}

/** RGBA pixels of the letterboxed frame → Float32 NCHW in 0..1. */
export function rgbaToNCHW(rgba: Uint8ClampedArray, size = INPUT_SIZE): Float32Array {
  const pixels = size * size;
  if (rgba.length < pixels * 4) throw new Error('전처리 픽셀 수가 모자랍니다.');
  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const s = i * 4;
    out[i] = rgba[s] / 255;
    out[pixels + i] = rgba[s + 1] / 255;
    out[pixels * 2 + i] = rgba[s + 2] / 255;
  }
  return out;
}

/** Per-class tally of the current frame, sorted by count then class id. */
export function countByClass(detections: readonly Detection[]): Array<{ classId: number; count: number }> {
  const tally = new Map<number, number>();
  for (const detection of detections) {
    tally.set(detection.classId, (tally.get(detection.classId) ?? 0) + 1);
  }
  return Array.from(tally, ([classId, count]) => ({ classId, count })).sort(
    (a, b) => b.count - a.count || a.classId - b.classId,
  );
}

/** The detections the studio should draw, given the class filters. */
export function visibleDetections(
  detections: readonly Detection[],
  hiddenClasses: ReadonlySet<number>,
  blurredClasses: ReadonlySet<number>,
): { visible: Detection[]; blurred: Detection[] } {
  const visible: Detection[] = [];
  const blurred: Detection[] = [];
  for (const detection of detections) {
    if (hiddenClasses.has(detection.classId)) continue;
    visible.push(detection);
    if (blurredClasses.has(detection.classId)) blurred.push(detection);
  }
  return { visible, blurred };
}
