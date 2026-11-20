import { describe, expect, it } from 'vitest';
import {
  countByClass,
  decodeYolo,
  letterboxPlan,
  nmsIndices,
  rgbaToNCHW,
  toSourcePoint,
  visibleDetections,
  type Box,
  type Detection,
} from '../src/engine/geometry';

const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });

/** One anchor of a YOLO head: cx, cy, w, h then 80 class scores. */
function anchor(cx: number, cy: number, w: number, h: number, classId: number, score: number): number[] {
  const row = new Array<number>(84).fill(0);
  row[0] = cx;
  row[1] = cy;
  row[2] = w;
  row[3] = h;
  row[4 + classId] = score;
  return row;
}

/** Channel-major [1, 84, anchors] as the shipped model returns it. */
function channelMajor(anchors: number[][]): Float32Array {
  const out = new Float32Array(84 * anchors.length);
  anchors.forEach((row, index) => {
    for (let attribute = 0; attribute < 84; attribute += 1) out[attribute * anchors.length + index] = row[attribute];
  });
  return out;
}

/** Anchor-major [1, anchors, 84], the layout a re-export may produce. */
function anchorMajor(anchors: number[][]): Float32Array {
  const out = new Float32Array(84 * anchors.length);
  anchors.forEach((row, index) => {
    for (let attribute = 0; attribute < 84; attribute += 1) out[index * 84 + attribute] = row[attribute];
  });
  return out;
}

describe('letterboxPlan', () => {
  it('keeps a landscape frame whole inside 640 and pads top and bottom', () => {
    const plan = letterboxPlan(1280, 853);
    expect(plan.size).toBe(640);
    expect(plan.scale).toBeCloseTo(0.5, 6);
    expect(plan.drawWidth).toBe(640);
    expect(plan.drawHeight).toBe(427);
    expect(plan.padX).toBe(0);
    expect(plan.padY).toBe(106);
    expect(plan.drawHeight + plan.padY * 2).toBeLessThanOrEqual(640);
  });

  it('pads the sides of a portrait frame', () => {
    const plan = letterboxPlan(1280, 1707);
    expect(plan.drawHeight).toBe(640);
    expect(plan.drawWidth).toBe(480);
    expect(plan.padY).toBe(0);
    expect(plan.padX).toBe(80);
  });

  it('leaves a square frame untouched', () => {
    const plan = letterboxPlan(1024, 1024);
    expect(plan.scale).toBeCloseTo(0.625, 6);
    expect(plan.padX).toBe(0);
    expect(plan.padY).toBe(0);
  });

  it('rejects a zero-sized frame', () => {
    expect(() => letterboxPlan(0, 100)).toThrow();
  });
});

describe('toSourcePoint', () => {
  it('undoes the letterbox exactly', () => {
    const plan = letterboxPlan(1280, 640); // scale .5, padY 160
    const model = { x: plan.padX + 100 * plan.scale, y: plan.padY + 50 * plan.scale };
    expect(toSourcePoint(model.x, model.y, plan)).toEqual({ x: 100, y: 50 });
  });
});

describe('nmsIndices', () => {
  it('keeps the strongest of two overlapping boxes of the same class', () => {
    const kept = nmsIndices([box(0, 0, 100, 100), box(5, 5, 100, 100)], [0.9, 0.8], [2, 2], 0.45);
    expect(kept).toEqual([0]);
  });

  it('never merges different classes', () => {
    const kept = nmsIndices([box(0, 0, 100, 100), box(5, 5, 100, 100)], [0.9, 0.8], [2, 5], 0.45);
    expect(kept).toHaveLength(2);
  });

  it('keeps boxes that only touch', () => {
    const kept = nmsIndices([box(0, 0, 100, 100), box(120, 0, 100, 100)], [0.9, 0.8], [2, 2], 0.45);
    expect(kept).toEqual([0, 1]);
  });

  it('returns the survivors in descending score order', () => {
    const kept = nmsIndices(
      [box(0, 0, 10, 10), box(200, 0, 10, 10), box(400, 0, 10, 10)],
      [0.3, 0.9, 0.6],
      [1, 1, 1],
      0.5,
    );
    expect(kept).toEqual([1, 2, 0]);
  });
});

describe('decodeYolo', () => {
  const plan = letterboxPlan(1280, 640); // scale .5, padY 160
  const options = { confidence: 0.25, iou: 0.45, plan, srcWidth: 1280, srcHeight: 640 };

  it('maps a channel-major detection back to source pixels', () => {
    const output = channelMajor([anchor(320, 320, 100, 100, 2, 0.9)]);
    const detections = decodeYolo(output, [1, 84, 1], options);
    expect(detections).toHaveLength(1);
    expect(detections[0].classId).toBe(2);
    expect(detections[0].score).toBeCloseTo(0.9, 5);
    // model box 270..370 / y 270..370, minus padY 160, divided by .5
    expect(detections[0].box.x).toBeCloseTo(540, 5);
    expect(detections[0].box.y).toBeCloseTo(220, 5);
    expect(detections[0].box.width).toBeCloseTo(200, 5);
    expect(detections[0].box.height).toBeCloseTo(200, 5);
  });

  it('accepts the anchor-major layout too', () => {
    const output = anchorMajor([anchor(320, 320, 100, 100, 2, 0.9)]);
    const detections = decodeYolo(output, [1, 1, 84], options);
    expect(detections).toHaveLength(1);
    expect(detections[0].box.x).toBeCloseTo(540, 5);
  });

  it('drops anchors under the confidence floor', () => {
    const output = channelMajor([anchor(320, 320, 100, 100, 2, 0.1)]);
    expect(decodeYolo(output, [1, 84, 1], options)).toHaveLength(0);
  });

  it('suppresses a duplicate anchor of the same class', () => {
    const output = channelMajor([
      anchor(320, 320, 100, 100, 2, 0.9),
      anchor(322, 320, 100, 100, 2, 0.7),
      anchor(320, 320, 100, 100, 16, 0.8),
    ]);
    const detections = decodeYolo(output, [1, 84, 3], options);
    expect(detections.map((detection) => detection.classId).sort((a, b) => a - b)).toEqual([2, 16]);
  });

  it('clamps boxes to the source frame', () => {
    const output = channelMajor([anchor(10, 170, 100, 100, 0, 0.9)]);
    const detections = decodeYolo(output, [1, 84, 1], options);
    expect(detections).toHaveLength(1);
    expect(detections[0].box.x).toBeGreaterThanOrEqual(0);
    expect(detections[0].box.y).toBeGreaterThanOrEqual(0);
  });

  it('refuses a shape it cannot read', () => {
    expect(() => decodeYolo(new Float32Array(10), [1, 7, 3], options)).toThrow();
  });
});

describe('rgbaToNCHW', () => {
  it('writes planes in RGB order normalised to 0..1', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const tensor = rgbaToNCHW(rgba, 2);
    expect(tensor).toHaveLength(12);
    expect(tensor[0]).toBeCloseTo(1, 5); // R of pixel 0
    expect(tensor[1]).toBeCloseTo(0, 5); // R of pixel 1 (green)
    expect(tensor[5]).toBeCloseTo(1, 5); // G of pixel 1
    expect(tensor[10]).toBeCloseTo(1, 5); // B of pixel 2
    expect(tensor.slice(0, 4)).toEqual(new Float32Array([1, 0, 0, 1]));
  });
});

describe('countByClass / visibleDetections', () => {
  const detections: Detection[] = [
    { classId: 2, score: 0.9, box: box(0, 0, 10, 10) },
    { classId: 2, score: 0.8, box: box(20, 0, 10, 10) },
    { classId: 0, score: 0.7, box: box(40, 0, 10, 10) },
  ];

  it('counts per class, biggest first', () => {
    expect(countByClass(detections)).toEqual([
      { classId: 2, count: 2 },
      { classId: 0, count: 1 },
    ]);
  });

  it('separates hidden classes from blurred ones', () => {
    const { visible, blurred } = visibleDetections(detections, new Set([0]), new Set([2]));
    expect(visible).toHaveLength(2);
    expect(blurred).toHaveLength(2);
    expect(blurred.every((detection) => detection.classId === 2)).toBe(true);
  });
});
